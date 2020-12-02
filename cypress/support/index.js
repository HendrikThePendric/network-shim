import './commands';
import './all.js';
import enableNetworkShim from './enableNetworkShim';
import { resetDb } from '../../src/json-server/resetDb';
import { isCaptureMode } from './enableNetworkShim/utils';

afterEach(() => {
    if (isCaptureMode()) {
        resetDb();
    }
});
enableNetworkShim({ staticResources: ['animals'] });
