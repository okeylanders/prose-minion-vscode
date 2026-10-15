/**
 * jsdom does not provide TextEncoder/TextDecoder, which host-side modules
 * create at load time. A jsdom test that wires real host code (handler,
 * stores) to the webview imports this FIRST, so the globals exist before
 * those modules evaluate.
 */
import { TextDecoder, TextEncoder } from 'util';

const globals = globalThis as Record<string, unknown>;
globals['TextEncoder'] ??= TextEncoder;
globals['TextDecoder'] ??= TextDecoder;
