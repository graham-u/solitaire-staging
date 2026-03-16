/**
 * Test helpers — shared browser setup and assertion utilities.
 */
import { chromium } from "playwright";

const BASE_URL = "http://localhost:8086";

export async function withPage(fn) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 810, height: 1080 },
    deviceScaleFactor: 2,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto(BASE_URL);
  await page.waitForFunction(() => typeof state !== "undefined");
  try {
    await fn(page);
  } finally {
    await browser.close();
  }
}

export function assert(condition, message) {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

export function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(
      `FAIL: ${message}\n  Expected: ${JSON.stringify(expected)}\n  Actual:   ${JSON.stringify(actual)}`
    );
  }
}

export function assertDeepEqual(actual, expected, message) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) {
    throw new Error(`FAIL: ${message}\n  Expected: ${b}\n  Actual:   ${a}`);
  }
}

let passCount = 0;
let failCount = 0;
const failures = [];

export function resetCounts() {
  passCount = 0;
  failCount = 0;
  failures.length = 0;
}

export async function test(name, fn) {
  try {
    await fn();
    passCount++;
    process.stdout.write(`  \x1b[32m✓\x1b[0m ${name}\n`);
  } catch (e) {
    failCount++;
    failures.push({ name, error: e.message });
    process.stdout.write(`  \x1b[31m✗\x1b[0m ${name}\n    ${e.message}\n`);
  }
}

export function summary() {
  console.log(`\n${passCount} passed, ${failCount} failed`);
  if (failures.length > 0) {
    console.log("\nFailures:");
    for (const f of failures) {
      console.log(`  - ${f.name}: ${f.error}`);
    }
  }
  return failCount;
}
