/* Diagnostic: simulate a page reload with a captured state in localStorage
   and verify the solver fires and shows the unwinnable overlay. */
import { chromium } from "playwright";

const capturedState = {"stock":[{"suit":"clubs","rank":"K","faceUp":false},{"suit":"hearts","rank":"K","faceUp":false},{"suit":"spades","rank":"6","faceUp":false},{"suit":"clubs","rank":"4","faceUp":false},{"suit":"diamonds","rank":"8","faceUp":false},{"suit":"hearts","rank":"7","faceUp":false}],"waste":[{"suit":"diamonds","rank":"5","faceUp":true},{"suit":"clubs","rank":"6","faceUp":true},{"suit":"spades","rank":"9","faceUp":true},{"suit":"diamonds","rank":"7","faceUp":true},{"suit":"hearts","rank":"8","faceUp":true}],"foundations":[[{"suit":"diamonds","rank":"A","faceUp":true},{"suit":"diamonds","rank":"2","faceUp":true},{"suit":"diamonds","rank":"3","faceUp":true}],[{"suit":"spades","rank":"A","faceUp":true},{"suit":"spades","rank":"2","faceUp":true},{"suit":"spades","rank":"3","faceUp":true}],[{"suit":"hearts","rank":"A","faceUp":true},{"suit":"hearts","rank":"2","faceUp":true}],[]],"tableau":[[{"suit":"diamonds","rank":"K","faceUp":true},{"suit":"clubs","rank":"Q","faceUp":true},{"suit":"diamonds","rank":"J","faceUp":true}],[{"suit":"diamonds","rank":"4","faceUp":false},{"suit":"hearts","rank":"9","faceUp":true}],[{"suit":"clubs","rank":"J","faceUp":false},{"suit":"clubs","rank":"10","faceUp":false},{"suit":"diamonds","rank":"9","faceUp":true}],[{"suit":"hearts","rank":"J","faceUp":false},{"suit":"hearts","rank":"5","faceUp":true},{"suit":"spades","rank":"4","faceUp":true},{"suit":"hearts","rank":"3","faceUp":true},{"suit":"clubs","rank":"2","faceUp":true}],[{"suit":"spades","rank":"10","faceUp":false},{"suit":"hearts","rank":"10","faceUp":false},{"suit":"clubs","rank":"8","faceUp":false},{"suit":"hearts","rank":"Q","faceUp":true}],[{"suit":"spades","rank":"8","faceUp":false},{"suit":"diamonds","rank":"10","faceUp":false},{"suit":"spades","rank":"K","faceUp":false},{"suit":"spades","rank":"7","faceUp":false},{"suit":"clubs","rank":"7","faceUp":true},{"suit":"hearts","rank":"6","faceUp":true},{"suit":"spades","rank":"5","faceUp":true},{"suit":"hearts","rank":"4","faceUp":true}],[{"suit":"spades","rank":"Q","faceUp":false},{"suit":"clubs","rank":"9","faceUp":false},{"suit":"clubs","rank":"A","faceUp":false},{"suit":"clubs","rank":"3","faceUp":false},{"suit":"diamonds","rank":"6","faceUp":false},{"suit":"clubs","rank":"5","faceUp":false},{"suit":"diamonds","rank":"Q","faceUp":true},{"suit":"spades","rank":"J","faceUp":true}]],"score":0,"moves":86,"time":497,"firstMove":true,"recycleCount":4};

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();

page.on("console", (msg) => console.log("[browser]", msg.type(), msg.text()));
page.on("pageerror", (err) => console.log("[pageerror]", err.message));

// Seed localStorage *before* the app loads
await page.addInitScript((s) => {
  localStorage.setItem("solitaire-state", JSON.stringify(s));
}, capturedState);

console.log("Navigating to http://localhost:8086/");
await page.goto("http://localhost:8086/");

// Sample solver state every 500ms for up to 15s
for (let i = 0; i < 30; i++) {
  await new Promise((r) => setTimeout(r, 500));
  const snap = await page.evaluate(() => ({
    hasWorker: !!solverWorker,
    hasCompleted: solverState.hasCompletedFirstCycle,
    running: solverState.running,
    lastResult: solverState.lastResult,
    overlayVisible: !document.getElementById("unwinnable-overlay").classList.contains("hidden")
  }));
  console.log(`t=${((i + 1) * 500) / 1000}s`, snap);
  if (snap.overlayVisible || snap.lastResult) break;
}

await browser.close();
