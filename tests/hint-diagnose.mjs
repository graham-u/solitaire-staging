/* More detailed diagnose: instrument worker messages. */
import { chromium } from "playwright";

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
page.on("pageerror", (err) => console.log("[pageerror]", err.message));
page.on("console", (m) => console.log("[console]", m.type(), m.text()));

await page.goto("http://localhost:8086/");

await page.evaluate(() => {
  // Patch worker to log all messages
  const origPost = Worker.prototype.postMessage;
  Worker.prototype.postMessage = function(msg) {
    console.log("[worker-post]", JSON.stringify({ type: msg.type, solveId: msg.solveId }));
    return origPost.apply(this, arguments);
  };
  dealGame();
});

await new Promise((r) => setTimeout(r, 500));

console.log("--- clicking hint ---");
await page.click("#btn-hint");

for (let i = 0; i < 40; i++) {
  await new Promise((r) => setTimeout(r, 500));
  const snap = await page.evaluate(() => ({
    sourceCount: document.querySelectorAll(".highlighted-source").length,
    destCount: document.querySelectorAll(".highlighted-dest").length,
    msgText: document.getElementById("hint-message")?.textContent ?? null,
    overlayVisible: !document.getElementById("hint-overlay").classList.contains("hidden"),
    workerExists: !!window.solverWorker,
    hintReqId: window.hintRequestId
  }));
  console.log(`t=${((i + 1) * 500) / 1000}s`, JSON.stringify(snap));
  if (snap.sourceCount > 0 || snap.destCount > 0) break;
}

await browser.close();
