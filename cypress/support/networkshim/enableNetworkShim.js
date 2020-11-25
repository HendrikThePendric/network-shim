import NetworkShim from './NetworkShim.js';
import {
    isDisabledMode,
    isCaptureMode,
    getDefaultHosts,
    getDefaultFixtureMode,
    getDefaultStaticResources,
    getStubServerVersionMinor,
    isStubMode,
} from './utils.js';
import loadXHook from './loadXHook.js';

export function enableNetworkShim({
    hosts = getDefaultHosts(),
    fixtureMode = getDefaultFixtureMode(),
    staticResources = getDefaultStaticResources(),
    stubServerVersionMinor = getStubServerVersionMinor(),
} = {}) {
    if (isDisabledMode()) {
        return;
    }

    const networkShim = new NetworkShim({
        hosts,
        fixtureMode,
        staticResources,
        stubServerVersionMinor,
    });

    Cypress.on('window:before:load', (win) => {
        // Cypress currently still prefers XHR
        delete win.fetch;
        if (isStubMode()) {
            loadXHook(win, networkShim);
        }
    });

    before(() => {
        if (isCaptureMode()) {
            networkShim.initCaptureMode();
        } else {
            networkShim.initStubMode();
        }
    });

    beforeEach(() => {
        if (isCaptureMode()) {
            networkShim.captureRequestsAndResponses();
        } else {
            networkShim.createStubRoutes();
        }
    });

    after(() => {
        if (isCaptureMode()) {
            networkShim.createFixtures();
        }
    });
}
