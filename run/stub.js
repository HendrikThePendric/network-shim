const cypress = require('cypress');

const SERVER_MINOR = 36;

function run() {
    try {
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
                dhis2_api_stub_mode: 'STUB',
                dhis2_server_minor_version: SERVER_MINOR,
            },
        });
    } catch (error) {
        console.error('Encountered an error when starting stub run', error);
    }
}

run();
