/**
 * Solver tests — DFS solver correctness, move generation, dominance, integration.
 */
import { withPage, test, assert, assertEqual, summary, resetCounts } from "./helpers.mjs";

export default async function run() {
  console.log("\n--- Solver Tests ---");
  resetCounts();

  await withPage(async (page) => {
    const ev = (fn) => page.evaluate(fn);

    // ── Solver correctness ──

    await test("near-won game returns winnable", async () => {
      const result = await ev(() => {
        // Set up a near-won state: all foundations at 12, last 4 cards on tableau
        dealGame();
        state.stock = [];
        state.waste = [];
        state.foundations = [[], [], [], []];
        state.tableau = [[], [], [], [], [], [], []];

        const suits = ["clubs", "diamonds", "hearts", "spades"];
        for (let si = 0; si < 4; si++) {
          const suit = suits[si];
          const RANKS = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
          // Put A through Q on foundation
          for (let r = 0; r < 12; r++) {
            state.foundations[si].push({ suit, rank: RANKS[r], faceUp: true });
          }
          // Put K on tableau column si
          state.tableau[si].push({ suit, rank: "K", faceUp: true });
        }

        state.recycleCount = 1;
        solverState.hasCompletedFirstCycle = true;
        solverState.lastResult = null;
        solverState.running = false;
        maybeTriggerSolver();
        return waitForSolverResult();
      });
      assertEqual(result, "winnable", "near-won game should be winnable");
    });

    await test("provably blocked game returns unwinnable", async () => {
      const result = await ev(() => {
        // Deadlocked: aces buried under same-colour 3s, nothing can move
        dealGame();
        state.stock = [];
        state.waste = [];
        state.foundations = [[], [], [], []];
        state.tableau = [[], [], [], [], [], [], []];

        // Column 0: face-down A♣, face-up 3♠
        // Column 1: face-down A♠, face-up 3♣
        // 3♠ and 3♣ are same colour, can't stack. Can't play to foundation. Aces are buried.
        state.tableau[0] = [
          { suit: "clubs", rank: "A", faceUp: false },
          { suit: "spades", rank: "3", faceUp: true }
        ];
        state.tableau[1] = [
          { suit: "spades", rank: "A", faceUp: false },
          { suit: "clubs", rank: "3", faceUp: true }
        ];

        state.recycleCount = 1;
        solverState.hasCompletedFirstCycle = true;
        solverState.lastResult = null;
        solverState.running = false;
        maybeTriggerSolver();
        return waitForSolverResult();
      });
      assertEqual(result, "unwinnable", "blocked game should be unwinnable");
    });

    await test("all-face-up trivial position returns winnable (early check)", async () => {
      const result = await ev(() => {
        // All cards face-up on tableau, stock/waste empty
        dealGame();
        state.stock = [];
        state.waste = [];
        state.foundations = [[], [], [], []];
        state.tableau = [[], [], [], [], [], [], []];

        // Build a valid descending alternating-colour run on column 0
        const suits = ["clubs", "diamonds", "hearts", "spades"];
        const RANKS = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
        let cardNum = 0;
        for (let col = 0; col < 7; col++) {
          const count = col < 4 ? 8 : 7; // distribute 52 cards across 7 cols
          for (let i = 0; i < count; i++) {
            const si = cardNum % 4;
            const ri = Math.floor(cardNum / 4);
            state.tableau[col].push({ suit: suits[si], rank: RANKS[ri], faceUp: true });
            cardNum++;
          }
        }

        state.recycleCount = 1;
        solverState.hasCompletedFirstCycle = true;
        solverState.lastResult = null;
        solverState.running = false;
        maybeTriggerSolver();
        return waitForSolverResult();
      });
      assertEqual(result, "winnable", "all face-up should be trivially winnable");
    });

    await test("very short timeout returns timeout", async () => {
      const result = await ev(() => {
        // Build a large state that can't be solved quickly: full stock with
        // interleaved suits so dominance moves don't cascade, and face-down
        // tableau cards to prevent the trivially-winnable early exit.
        const suits = ["clubs", "diamonds", "hearts", "spades"];
        const RANKS = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
        const allCards = [];
        for (const s of suits) {
          for (const r of RANKS) {
            allCards.push({ suit: s, rank: r, faceUp: false });
          }
        }
        // Put 28 cards in tableau (7 columns, 1-7 cards each, only top face-up)
        const tableau = [[], [], [], [], [], [], []];
        let idx = 0;
        for (let col = 0; col < 7; col++) {
          for (let row = 0; row <= col; row++) {
            const card = { ...allCards[idx++] };
            card.faceUp = (row === col);
            tableau[col].push(card);
          }
        }
        // Remaining 24 cards go to stock
        const stock = allCards.slice(idx).map(c => ({ ...c }));

        const testWorker = new Worker("solver-worker.js");
        return new Promise(resolve => {
          testWorker.onmessage = function(e) {
            if (e.data.type === "result") {
              testWorker.terminate();
              resolve(e.data.outcome);
            }
          };
          testWorker.postMessage({
            type: "solve",
            state: {
              stock,
              waste: [],
              foundations: [[], [], [], []],
              tableau,
              recycleCount: 0
            },
            timeLimit: -1,
            solveId: 1
          });
        });
      });
      assertEqual(result, "timeout", "0ms timeout should return timeout");
    });

    // ── Integration tests ──

    await test("solver doesn't trigger before first stock cycle", async () => {
      const result = await ev(() => {
        dealGame();
        // Draw some cards but don't complete a cycle
        drawFromStock();
        drawFromStock();
        return {
          hasCompleted: solverState.hasCompletedFirstCycle,
          running: solverState.running,
          lastResult: solverState.lastResult
        };
      });
      assertEqual(result.hasCompleted, false, "should not have completed first cycle");
      assertEqual(result.running, false, "solver should not be running");
      assertEqual(result.lastResult, null, "no result yet");
    });

    await test("solver triggers after first recycle once face-down count is low", async () => {
      const result = await ev(() => {
        dealGame();
        while (state.stock.length > 0) drawFromStock();
        recycleWaste();
        // Flip all tableau cards face-up so the progress gate passes
        for (const col of state.tableau) for (const c of col) c.faceUp = true;
        maybeTriggerSolver();
        return {
          hasCompleted: solverState.hasCompletedFirstCycle,
          running: solverState.running || solverState.lastResult !== null
        };
      });
      assertEqual(result.hasCompleted, true, "should have completed first cycle");
      assert(result.running, "solver should have been triggered");
    });

    await test("solver does not trigger when face-down count is still high", async () => {
      const result = await ev(() => {
        dealGame();
        while (state.stock.length > 0) drawFromStock();
        recycleWaste();
        // Fresh deal has 21 face-down cards — gate should block
        maybeTriggerSolver();
        return {
          running: solverState.running,
          lastResult: solverState.lastResult
        };
      });
      assertEqual(result.running, false, "solver should not run with many face-down cards");
      assertEqual(result.lastResult, null, "no result expected");
    });

    await test("unwinnable result shows overlay", async () => {
      const result = await ev(() => {
        // Set up blocked state and trigger solver
        dealGame();
        state.stock = [];
        state.waste = [];
        state.foundations = [[], [], [], []];
        state.tableau = [[], [], [], [], [], [], []];
        state.tableau[0] = [
          { suit: "clubs", rank: "A", faceUp: false },
          { suit: "spades", rank: "3", faceUp: true }
        ];
        state.tableau[1] = [
          { suit: "spades", rank: "A", faceUp: false },
          { suit: "clubs", rank: "3", faceUp: true }
        ];

        state.recycleCount = 1;
        solverState.hasCompletedFirstCycle = true;
        solverState.lastResult = null;
        solverState.running = false;
        maybeTriggerSolver();
        return waitForSolverResult().then(() => {
          return !document.getElementById("unwinnable-overlay").classList.contains("hidden");
        });
      });
      assert(result, "unwinnable overlay should be visible");
    });

    await test("New Game button from unwinnable overlay works", async () => {
      const result = await ev(() => {
        // Set up and show overlay
        dealGame();
        state.stock = [];
        state.waste = [];
        state.foundations = [[], [], [], []];
        state.tableau = [[], [], [], [], [], [], []];
        state.tableau[0] = [{ suit: "clubs", rank: "3", faceUp: true }];

        document.getElementById("unwinnable-overlay").classList.remove("hidden");
        // Click the button
        document.getElementById("btn-unwinnable-new-game").click();
        return {
          overlayHidden: document.getElementById("unwinnable-overlay").classList.contains("hidden"),
          stockLen: state.stock.length,
          tabLen: state.tableau.reduce((sum, col) => sum + col.length, 0)
        };
      });
      assert(result.overlayHidden, "overlay should be hidden after New Game");
      assertEqual(result.stockLen, 24, "new game should deal 24 to stock");
      assertEqual(result.tabLen, 28, "new game should deal 28 to tableau");
    });

    await test("undo hides unwinnable overlay", async () => {
      const result = await ev(() => {
        dealGame();
        // Draw all stock then recycle to enable solver
        while (state.stock.length > 0) drawFromStock();
        recycleWaste();
        // Now show the overlay as if solver returned unwinnable
        document.getElementById("unwinnable-overlay").classList.remove("hidden");
        solverState.lastResult = "unwinnable";
        // Undo
        undo();
        return {
          overlayHidden: document.getElementById("unwinnable-overlay").classList.contains("hidden"),
          lastResult: solverState.lastResult
        };
      });
      assert(result.overlayHidden, "overlay should be hidden after undo");
      assertEqual(result.lastResult, null, "lastResult should be cleared after undo");
    });

    await test("stale solver result (wrong solveId) is ignored", async () => {
      const result = await ev(() => {
        dealGame();
        // Manually advance solveId to make any in-flight result stale
        solverState.currentSolveId = 999;
        solverState.lastResult = null;

        // Simulate receiving a result with an old solveId
        if (!solverWorker && typeof Worker !== "undefined") {
          solverWorker = new Worker("solver-worker.js");
          solverWorker.onmessage = function(e) {
            const msg = e.data;
            if (msg.type === "result") {
              solverState.running = false;
              if (msg.solveId !== solverState.currentSolveId) return;
              solverState.lastResult = msg.outcome;
            }
          };
        }

        // Send a solve with solveId 1 (stale compared to 999)
        solverState.running = true;
        solverWorker.postMessage({
          type: "solve",
          state: {
            stock: [],
            waste: [],
            foundations: [[], [], [], []],
            tableau: [[{ suit: "clubs", rank: "3", faceUp: true }], [], [], [], [], [], []],
            recycleCount: 0
          },
          timeLimit: 3000,
          solveId: 1
        });

        return new Promise(resolve => {
          setTimeout(() => {
            resolve({
              lastResult: solverState.lastResult,
              overlayHidden: document.getElementById("unwinnable-overlay").classList.contains("hidden")
            });
          }, 500);
        });
      });
      assertEqual(result.lastResult, null, "stale result should be ignored");
      assert(result.overlayHidden, "overlay should remain hidden for stale result");
    });
  });

  return summary();
}
