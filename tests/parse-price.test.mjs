/**
 * Unit tests for parsePrice / aggregation helpers (mirrors content.js).
 * Run: node tests/parse-price.test.mjs
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import vm from 'vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const contentSrc = readFileSync(join(__dirname, '..', 'content.js'), 'utf8');

// Evaluate only the pure helpers we need by extracting function bodies via a sandbox
// that stubs chrome/DOM globals used at module load.
const sandbox = {
    chrome: {
        storage: { local: { get() {}, set() {} } },
        runtime: { sendMessage() {}, onMessage: { addListener() {} } }
    },
    document: {
        readyState: 'complete',
        getElementById() { return null; },
        querySelector() { return null; },
        querySelectorAll() { return []; },
        addEventListener() {},
        createElement() {
            return {
                style: {},
                querySelector() { return null; },
                appendChild() {},
                remove() {},
                addEventListener() {}
            };
        },
        body: { appendChild() {} }
    },
    window: { location: { hostname: 'store.gaijin.net' } },
    console,
};
sandbox.window = sandbox.window;
sandbox.self = sandbox;
vm.createContext(sandbox);
vm.runInContext(contentSrc, sandbox);

const { parsePrice, getSelectors } = sandbox;

let passed = 0;
let failed = 0;

function assertEq(name, actual, expected) {
    const ok = typeof actual === 'number' && typeof expected === 'number'
        ? Math.abs(actual - expected) < 1e-9
        : actual === expected;
    if (ok) {
        passed++;
        console.log(`PASS  ${name}`);
    } else {
        failed++;
        console.log(`FAIL  ${name}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
    }
}

console.log('=== parsePrice ===');
assertEq('integer RUB', parsePrice('1500 ₽'), 1500);
assertEq('spaced thousands RUB', parsePrice('1 500 ₽'), 1500);
assertEq('dot decimal USD', parsePrice('$59.99'), 59.99);
assertEq('dot decimal trailing currency', parsePrice('9.99 $'), 9.99);
assertEq('euro catalog style', parsePrice('79.99 €'), 79.99);
assertEq('half dollar', parsePrice('$49.5'), 49.5);
assertEq('comma decimal RUB', parsePrice('1234,56 ₽'), 1234.56);
assertEq('space + comma decimal', parsePrice('1 234,56 ₽'), 1234.56);
assertEq('US thousands', parsePrice('1,234.56'), 1234.56);
assertEq('EU thousands', parsePrice('1.234,56'), 1234.56);
assertEq('dual old/new → last', parsePrice(' $165  $114 '), 114);
assertEq('dual with decimal new', parsePrice(' $66  $49.5 '), 49.5);
assertEq('free', parsePrice('Free'), 0);
assertEq('empty', parsePrice(''), 0);

console.log('=== selectors ===');
const sel = getSelectors();
assertEq('price prefers new/default', sel.price.includes('showcase-item-price__new'), true);

console.log(`\npassed=${passed} failed=${failed}`);
process.exit(failed ? 1 : 0);
