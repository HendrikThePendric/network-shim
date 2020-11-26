import NetworkShim from './NetworkShim.js';
import {
    isDisabledMode,
    isCaptureMode,
    getDefaultHosts,
    getDefaultFixtureMode,
    getDefaultStaticResources,
    getStubServerVersionMinor,
} from './utils.js';

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

    before(() => {
        if (isCaptureMode()) {
            networkShim.initCaptureMode();
        } else {
            networkShim.initStubMode();
        }
    });

    beforeEach(() => {
        if (isCaptureMode()) {
            networkShim.captureRequests();
        } else {
            networkShim.stubRequests();
        }
    });

    after(() => {
        if (isCaptureMode()) {
            networkShim.createFixtures();
        }
    });
}
