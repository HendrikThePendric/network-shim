import {
    isStubMode,
    getProjectNetworkFixturesDir,
    getFullTestName,
    splitHostAndPath,
    isStaticFixtureMode,
    isStaticResource,
    toJsonBlob,
    getApiBaseUrl,
} from './utils.js';

export default class NetworkShim {
    constructor({
        hosts,
        fixtureMode,
        staticResources,
        stubServerVersionMinor,
    }) {
        this.state = isStubMode()
            ? { serverMinorVersion: stubServerVersionMinor }
            : null;
        this.hosts = hosts;
        this.fixtureMode = fixtureMode;
        this.staticResources = staticResources;
    }

    /****************
     * Capture mode *
     ****************/
    initCaptureMode() {
        // This assumes the first host is the dhis2-core instance
        cy.request(`${getApiBaseUrl()}/api/system/info`).then(({ body }) => {
            const minor = parseInt(body.version.split(/\.|-/)[1]);
            this.state = {
                count: 0,
                totalResponseSize: 0,
                duplicates: 0,
                nonDeterministicResponses: 0,
                requests: [],
                serverMinorVersion: minor,
            };
            this.cleanup();
        });
    }

    cleanup() {
        cy.exec(`rm -rf ./${this.getNetworkFixturesDir()}`);
    }

    captureRequests() {
        this.hosts.forEach((host) => {
            cy.intercept(host, (request) => {
                request.reply((response) => {
                    try {
                        this.captureRequest(request, response);
                    } catch (error) {
                        console.error('NetworkShim capture error', error);
                    }
                });
            });
        });
    }

    captureRequest = async (request, response) => {
        const { host, path } = splitHostAndPath(request.url, this.hosts);
        if (!host) {
            // pass through
            return response;
        }

        this.state.count++;

        const testName = getFullTestName();
        const isStaticResource = this.isPathStaticResource(path);
        const requestStub = this.findMatchingRequestStub({
            path,
            method: request.method,
            testName,
            requestBody: request.body,
            isStaticResource,
        });

        const { size, text } = await toJsonBlob(response.body);

        if (requestStub) {
            // Repeated request
            this.processDuplicatedRequestStub(requestStub, text);
        } else {
            // New request
            this.state.requests.push({
                path,
                testName: isStaticResource ? null : testName,
                static: isStaticResource,
                count: 1,
                nonDeterministic: false,
                method: request.method,
                requestBody: request.body,
                requestHeaders: request.headers,
                statusCode: response.statusCode,
                responseBody: text,
                responseSize: size,
                responseHeaders: response.headers,
            });
            this.state.totalResponseSize += size;
        }
        return response;
    };

    processDuplicatedRequestStub(requestStub, newResponseBody) {
        requestStub.count += 1;
        this.state.duplicates += 1;

        if (!requestStub.nonDeterministic) {
            // if requestStub.responseBody equals newResponseBody this is a simple
            // duplicated requestStub and we don't take any action

            if (requestStub.responseBody !== newResponseBody) {
                // Switch to nonDeterministic requestStub mode with responseBody array
                this.state.nonDeterministicResponses += 1;
                requestStub.nonDeterministic = true;
                requestStub.responseBody = [
                    requestStub.responseBody,
                    newResponseBody,
                ];
                requestStub.responseLookup = [0, 1];
            }
        } else {
            // RequestStub was already nonDeterministic, responseBody is already an array
            const matchingResponseBodyIndex = requestStub.responseBody.findIndex(
                (responseBody) => responseBody === newResponseBody
            );

            if (matchingResponseBodyIndex >= 0) {
                // No need to store the responseBody, we already have it
                requestStub.responseLookup.push(matchingResponseBodyIndex);
            } else {
                // Add a new responseBody
                this.state.nonDeterministicResponses += 1;
                requestStub.responseBody.push(newResponseBody);
                requestStub.responseLookup.push(
                    requestStub.responseBody.length - 1
                );
            }
        }
    }

    createFixtures() {
        const dir = this.getNetworkFixturesDir();
        const summary = {
            count: this.state.count,
            totalResponseSize: this.state.totalResponseSize,
            duplicates: this.state.duplicates,
            nonDeterministicResponses: this.state.nonDeterministicResponses,
            serverMinorVersion: this.state.serverMinorVersion,
            fixtureFiles: [],
        };
        const files = this.state.requests.reduce(
            (acc, request) => {
                const fileName = request.static
                    ? 'static_resources'
                    : request.testName
                          .split(' -- ')[0]
                          .toLowerCase()
                          .replaceAll(' ', '_');

                if (!acc[fileName]) {
                    acc[fileName] = [];
                    acc.summary.fixtureFiles.push(`${fileName}.json`);
                }

                acc[fileName].push(request);
                return acc;
            },
            { summary }
        );

        for (const [name, requests] of Object.entries(files)) {
            const filePath =
                name === 'summary'
                    ? `${dir}/${name}`
                    : `${dir}/requests/${name}`;

            cy.writeFile(`${filePath}.json`, requests);
        }

        cy.log(
            `Networkshim successfully captured ${this.state.requests.length} requests`
        );
    }

    /****************
     * Stub mode    *
     ****************/
    initStubMode() {
        try {
            cy.readFile(`${this.getNetworkFixturesDir()}/summary.json`).then(
                ({ fixtureFiles }) =>
                    this.parseFixtureFiles(fixtureFiles).then((requests) => {
                        this.state.requests = requests.map((request) => ({
                            ...request,
                            stubResponseCount: 0,
                        }));
                    })
            );
        } catch (error) {
            console.error('NetworkShim stub mode initialzation error', error);
        }
    }

    parseFixtureFiles(fileNames) {
        return cy
            .all(
                ...fileNames.map((fileName) => () =>
                    cy.readFile(
                        `${this.getNetworkFixturesDir()}/requests/${fileName}`
                    )
                )
            )
            .then((results) => results.flat());
    }

    stubRequests() {
        this.hosts.forEach((host) => {
            cy.intercept(host, (request) => {
                try {
                    this.stubRequest(request);
                } catch (error) {
                    console.error('NetworkShim stub error', error);
                }
            });
        });
    }

    stubRequest = (request) => {
        const { host, path } = splitHostAndPath(request.url, this.hosts);

        if (!host) {
            // Could a be configuration error
            console.error(
                'NetworkShim encountered a request to an unknown host'
            );
            return request;
        }

        const requestStub = this.findMatchingRequestStub({
            path,
            method: request.method,
            testName: getFullTestName(),
            requestBody: request.body,
            isStaticResource: this.isPathStaticResource(path),
        });
        const responseBody = this.getRequesStubResponseBody(requestStub);

        requestStub.stubResponseCount++;

        request.reply({
            body: responseBody,
            headers: requestStub.responseHeaders,
            statusCode: requestStub.statusCode,
        });
    };

    getRequesStubResponseBody({
        nonDeterministic,
        responseBody,
        responseLookup,
        stubResponseCount,
    }) {
        if (nonDeterministic) {
            const responseBodyIndex = responseLookup[stubResponseCount];
            return JSON.parse(responseBody[responseBodyIndex]);
        }

        return JSON.parse(responseBody);
    }

    /****************
     * Common       *
     ****************/
    getNetworkFixturesDir() {
        return [
            getProjectNetworkFixturesDir(),
            this.state.serverMinorVersion,
        ].join('/');
    }

    isPathStaticResource(path) {
        return (
            isStaticFixtureMode(this.fixtureMode) ||
            isStaticResource(path, this.staticResources)
        );
    }

    findMatchingRequestStub({
        path,
        method,
        testName,
        requestBody,
        isStaticResource,
    }) {
        return this.state.requests.find((r) => {
            // console.log(
            //     'isStaticResource: ',
            //     isStaticResource,
            //     testName,
            //     ' === ',
            //     r.testName
            // );

            const isMatchingRequest =
                path === r.path &&
                method === r.method &&
                (requestBody === r.requestBody ||
                    JSON.stringify(requestBody) ===
                        JSON.stringify(r.requestBody));

            return isStaticResource
                ? isMatchingRequest
                : isMatchingRequest && testName === r.testName;
        });
    }
}
