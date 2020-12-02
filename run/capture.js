const path = require('path');
const fs = require('fs');
const rimraf = require('rimraf');
const cypress = require('cypress');

const SERVER_MINOR = 36;
const INITIAL_SUMMARY = {
    count: 0,
    totalResponseSize: 0,
    duplicates: 0,
    nonDeterministicResponses: 0,
    serverMinorVersion: 0,
    fixtureFiles: [],
};

function run() {
    try {
        const dir = path.join(
            __dirname,
            '../cypress/fixtures/network',
            SERVER_MINOR.toString()
        );

        rimraf.sync(dir);

        fs.mkdirSync(dir);
        fs.writeFileSync(
            path.join(dir, 'summary.json'),
            JSON.stringify(INITIAL_SUMMARY, null, 4)
        );

        cypress.run({
            browser: 'chrome',
            exit: true,
            headless: true,
            config: {
                screenshotOnRunFailure: false,
                video: false,
            },
            env: {
                dhis2_base_url: 'http://localhost:1337',
                dhis2_username: 'admin',
                dhis2_password: 'district',
                dhis2_api_stub_mode: 'CAPTURE',
                dhis2_server_minor_version: SERVER_MINOR,
            },
        });
    } catch (error) {
        console.error('Encountered an error when starting capture run', error);
    }
}

run();
