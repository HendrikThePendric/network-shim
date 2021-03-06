import {
    isDisabledMode,
    isCaptureMode,
    getDefaultHosts,
    getDefaultFixtureMode,
    getDefaultStaticResources,
} from './utils.js';
import createStateFromFixtures from './createStateFromFixtures.js';
import captureRequests from './captureRequests.js';
import stubRequests from './stubRequests.js';
import createFixturesFromState from './createFixturesFromState.js';

export default function enableNetworkShim({
    hosts = getDefaultHosts(),
    fixtureMode = getDefaultFixtureMode(),
    staticResources = getDefaultStaticResources(),
} = {}) {
    if (isDisabledMode()) {
        return;
    }

    before(() => {
        createStateFromFixtures({
            hosts,
            fixtureMode,
            staticResources,
        }).then((state) => {
            cy.wrap(state).as('networkShimState');
        });
    });

    beforeEach(() => {
        cy.get('@networkShimState').then((networkShimState) => {
            if (isCaptureMode()) {
                captureRequests(networkShimState);
            } else {
                stubRequests(networkShimState);
            }
        });
    });

    after(() => {
        cy.get('@networkShimState').then((networkShimState) => {
            if (isCaptureMode()) {
                createFixturesFromState(networkShimState);
            }
        });
    });
}
