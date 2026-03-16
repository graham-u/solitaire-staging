#!/usr/bin/env npx tsx
/**
 * Solitaire test runner — runs all test suites.
 *
 * Usage:
 *   npx tsx tests/run-all.mjs
 *
 * Requires:
 *   - Local server running on port 8086 (python3 -m http.server 8086)
 *   - Playwright installed (npx playwright install chromium)
 */

import gameLogic from "./game-logic.mjs";
import gameplay from "./gameplay.mjs";
import ui from "./ui.mjs";

console.log("Solitaire Test Suite");
console.log("====================");

let totalFails = 0;

totalFails += await gameLogic();
totalFails += await gameplay();
totalFails += await ui();

console.log("\n====================");
if (totalFails === 0) {
  console.log("\x1b[32mAll tests passed!\x1b[0m");
} else {
  console.log(`\x1b[31m${totalFails} test(s) failed\x1b[0m`);
}

process.exit(totalFails > 0 ? 1 : 0);
