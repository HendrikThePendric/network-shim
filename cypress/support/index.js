import './commands';
import './all.js';
import { enableNetworkShim } from './networkshim';
import { resetDb } from '../../src/json-server/resetDb';
import { isCaptureMode } from './networkshim/utils';

afterEach(() => {
    if (isCaptureMode()) {
        resetDb();
    }
});
enableNetworkShim();
