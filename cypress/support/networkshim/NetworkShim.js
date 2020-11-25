import {
    isStubMode,
    getProjectNetworkFixturesDir,
    getFullTestName,
    splitHostAndPath,
    isStaticFixtureMode,
    isStaticResource,
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

    initCaptureMode() {
        // This assumes the first host is the dhis2-core instance
        cy.request(`${this.hosts[0]}/api/system/info`).then(({ body }) => {
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

    initStubMode() {
        try {
            cy.readFile(`${this.getNetworkFixturesDir()}/summary.json`).then(
                ({ fixtureFiles }) =>
                    this.parseFixtureFiles(fixtureFiles).then((requests) => {
                        this.state.requests = requests.map((request) => ({
                            ...request,
                            stubResponseCount: 0,
                        }));
                        // STUB STRATEGY 1: using xhook
                        // patchWindow(true, this.handleStubbedRoute);
                    })
            );
        } catch (error) {
            console.error('NetworkShim stub mode initialzation error', error);
        }
    }

    cleanup() {
        cy.exec(`rm -rf ./${this.getNetworkFixturesDir()}`);
    }

    getNetworkFixturesDir() {
        return [
            getProjectNetworkFixturesDir(),
            this.state.serverMinorVersion,
        ].join('/');
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

    captureRequestsAndResponses() {
        cy.server({
            onAnyRequest: (_, xhr) => {
                try {
                    this.captureRequest(xhr);
                } catch (error) {
                    console.error(
                        'NetworkShim capture error on request',
                        error
                    );
                }
            },
            onAnyResponse: (_, xhr) => {
                try {
                    this.captureResponse(xhr);
                } catch (error) {
                    console.error(
                        'NetworkShim capture error on response',
                        error
                    );
                }
            },
        });
    }

    // STUB STRATEGY 2: using cy.route2
    createStubRoutes() {
        // const baseUrl = getApiBaseUrl()
        // const uniqueMethodPathCombos = Array.from(
        //     new Set(
        //         this.state.requests.map(({ method, path }) =>
        //             JSON.stringify({ method, path })
        //         )
        //     )
        // ).map(jsonStr => JSON.parse(jsonStr))
        // uniqueMethodPathCombos.forEach(({ method, path }) => {
        //     const url = baseUrl + path
        //     cy.route2(method, url, this.handleStubbedRoute)
        // })
    }
    // STUB STRATEGY 3 would be to use the old cy.route API
    // But that would require some changes in the request matching logic
    // because that wouldn't allow us to differentiate on requestBody

    handleStubbedRoute = (request) => {
        const { path } = splitHostAndPath(request.url, this.hosts);

        const matchingRequest = this.findMatchingRequest({
            path,
            method: request.method,
            testName: getFullTestName(),
            // Cast '' to null to match fixtures
            requestBody: request.body || null,
            isStaticResource: this.isPathStaticResource(path),
        });

        // nonDeterministic requests have a responseBody array
        const responseBody = matchingRequest.nonDeterministic
            ? this.getNonDeterministicResponseBody(matchingRequest)
            : matchingRequest.responseBody;

        matchingRequest.stubResponseCount++;

        if (path === '/names' && request.method === 'GET') {
            console.log('Responsebody', responseBody);
        }

        return {
            ...matchingRequest,
            responseBody,
        };
    };

    getNonDeterministicResponseBody({
        responseBody,
        responseLookup,
        stubResponseCount,
    }) {
        const responseBodyIndex = responseLookup[stubResponseCount];

        return responseBody[responseBodyIndex];
    }

    isPathStaticResource(path) {
        return (
            isStaticFixtureMode(this.fixtureMode) ||
            isStaticResource(path, this.staticResources)
        );
    }

    findMatchingRequest({
        id,
        path,
        method,
        testName,
        requestBody,
        isStaticResource,
    }) {
        return this.state.requests.find((r) => {
            if (id && id === r.id) {
                return true;
            }

            if (path !== r.path || method !== r.method) {
                return false;
            }

            if (
                requestBody !== r.requestBody &&
                requestBody !== JSON.stringify(r.requestBody)
            ) {
                return false;
            }

            if (isStaticResource && testName !== r.testName) {
                return false;
            }

            return true;

            // if (path === r.path && method === r.method) {
            //     console.log(requestBody, r.requestBody);
            //     console.log(requestBody, r.requestBody);
            // }

            // // const isMatchingRequest =
            // //     path === r.path &&
            // //     method === r.method &&
            // //     JSON.parse(requestBody) === r.requestBody;

            // if (isMatchingRequest) {
            //     console.log('Found one!');
            // }

            // // For dynamic resource we store a seperate request per test
            // // because the data might get mutated in other tests
            // return isStaticResource
            //     ? isMatchingRequest
            //     : isMatchingRequest && testName === r.testName;
        });
    }

    captureRequest = (xhr) => {
        const { host, path } = splitHostAndPath(xhr.url, this.hosts);
        if (!host) {
            // pass through
            return xhr;
        }

        this.state.count++;

        const testName = getFullTestName();
        const isStaticResource = this.isPathStaticResource(path);
        const duplicatedRequest = this.findMatchingRequest({
            id: xhr.id,
            path,
            method: xhr.method,
            testName,
            requestBody: xhr.request.body,
            isStaticResource,
        });

        if (duplicatedRequest) {
            // Repeated request
            duplicatedRequest.count += 1;
            this.state.duplicates += 1;
        } else {
            // New request
            this.state.requests.push({
                path,
                id: xhr.id,
                testName: isStaticResource ? null : testName,
                static: isStaticResource,
                count: 1,
                nonDeterministic: false,
                method: xhr.method,
                requestBody: xhr.request.body,
                requestHeaders: xhr.request.headers,
                status: null,
                responseBody: null,
                responseSize: null,
                responseHeaders: null,
            });
        }
        return xhr;
    };

    captureResponse = async (xhr) => {
        const { host, path } = splitHostAndPath(xhr.url, this.hosts);

        if (!host) {
            // pass through
            return xhr;
        }

        const request = this.findMatchingRequest({
            id: xhr.id,
            path,
            method: xhr.method,
            testName: getFullTestName(),
            requestBody: xhr.request.body,
            isStaticResource: this.isPathStaticResource(path),
        });
        const { size, text } = await this.createResponseBlob(xhr);

        if (!request) {
            throw new Error('Could not find request to match response');
        }

        if (request.count > 1) {
            this.processDuplicatedRequestResponse(request, text);
        } else {
            request.status = xhr.status;
            request.responseBody = text;
            request.responseSize = size;
            request.responseHeaders = xhr.response.headers;

            this.state.totalResponseSize += size;
        }

        return xhr;
    };

    processDuplicatedRequestResponse(request, newResponseBody) {
        if (!request.nonDeterministic) {
            // if request.responseBody equals newResponseBody this is a simple
            // duplicated request and we don't take any action

            if (request.responseBody !== newResponseBody) {
                // Switch to nonDeterministic request mode with responseBody array
                this.state.nonDeterministicResponses += 1;
                request.nonDeterministic = true;
                request.responseBody = [request.responseBody, newResponseBody];
                request.responseLookup = [0, 1];
            }
        } else {
            // Request was already nonDeterministic, responseBody is already an array
            const matchingResponseBodyIndex = request.responseBody.findIndex(
                (responseBody) => responseBody === newResponseBody
            );

            if (matchingResponseBodyIndex >= 0) {
                // No need to store the responseBody, we already have it
                request.responseLookup.push(matchingResponseBodyIndex);
            } else {
                // Add a new responseBody
                this.state.nonDeterministicResponses += 1;
                request.responseBody.push(newResponseBody);
                request.responseLookup.push(request.responseBody.length - 1);
            }
        }
    }

    async createResponseBlob(xhr) {
        const responseBodyStr = JSON.stringify(xhr.response.body);
        const blob = new Blob([responseBodyStr], { type: 'application/json' });
        const size = blob.size;
        const text = await blob.text();

        return { size, text };
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

                // request id is not valid across test-runs
                // so needs to be removed from fixtures
                delete request.id;
                acc[fileName].push(request);
                return acc;
            },
            { summary }
        );
        console.log(files);

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
}
