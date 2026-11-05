/**
 * jsdom has no `TextEncoder` or `TextDecoder`, which host modules (the
 * session store) create at load. A webview test that bridges to the real host
 * routes imports this first, so they exist before those modules load.
 */

import { TextDecoder, TextEncoder } from 'util';

Object.assign(globalThis, { TextEncoder, TextDecoder });
