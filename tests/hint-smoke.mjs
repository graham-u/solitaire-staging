/* Smoke test: verify the new solver-based hint flow end-to-end. */
import { chromium } from "playwright";

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
page.on("pageerror", (err) => console.log("[pageerror]", err.message));

await page.goto("http://localhost:8086/");
await page.evaluate(() => dealGame());

// Press the hint button and wait for highlights.
console.log("Clicking hint...");
await page.click("#btn-hint");

let highlighted = 0;
for (let i = 0; i < 30; i++) {
  await new Promise((r) => setTimeout(r, 200));
  highlighted = await page.evaluate(() => document.querySelectorAll(".highlighted").length);
  const overlayVisible = await page.evaluate(() => !document.getElementById("hint-overlay").classList.contains("hidden"));
  console.log(`t=${((i + 1) * 200) / 1000}s highlighted=${highlighted} overlay=${overlayVisible}`);
  if (highlighted > 0) break;
}

if (highlighted === 0) {
  console.log("FAIL: hint didn't highlight anything");
  process.exit(1);
}

// Clear any highlights that remain, then test cancel flow by clicking hint again
// and cancelling during the loading overlay.
await page.evaluate(() => clearHint());
console.log("\nTesting cancel flow...");
await page.evaluate(() => dealGame());
await page.click("#btn-hint");
// Wait just until the loading overlay appears (up to 1s), then cancel.
const overlayAppeared = await page.waitForFunction(
  () => !document.getElementById("hint-overlay").classList.contains("hidden"),
  { timeout: 2000 }
).then(() => true).catch(() => false);
console.log("overlay appeared:", overlayAppeared);

if (overlayAppeared) {
  await page.click("#btn-hint-cancel");
  await new Promise((r) => setTimeout(r, 200));
  const hiddenAfterCancel = await page.evaluate(() => document.getElementById("hint-overlay").classList.contains("hidden"));
  console.log("overlay hidden after cancel:", hiddenAfterCancel);
  if (!hiddenAfterCancel) { console.log("FAIL: cancel didn't hide overlay"); process.exit(1); }
}

console.log("\nAll smoke checks passed.");
await browser.close();
