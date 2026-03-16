/**
 * Gameplay integration tests — stock, waste, moves, scoring, undo, hint, win.
 */
import { withPage, test, assert, assertEqual, summary, resetCounts } from "./helpers.mjs";

export default async function run() {
  console.log("\n--- Gameplay Tests ---");
  resetCounts();

  await withPage(async (page) => {
    const ev = (fn) => page.evaluate(fn);

    await test("drawFromStock moves top card to waste", async () => {
      const result = await ev(() => {
        dealGame();
        const stockBefore = state.stock.length;
        drawFromStock();
        return {
          stockDelta: state.stock.length - stockBefore,
          wasteLen: state.waste.length,
          wasteFaceUp: state.waste[0]?.faceUp,
        };
      });
      assertEqual(result.stockDelta, -1, "stock should decrease by 1");
      assertEqual(result.wasteLen, 1, "waste should have 1 card");
      assertEqual(result.wasteFaceUp, true, "waste card should be face-up");
    });

    await test("drawFromStock increments moves", async () => {
      const result = await ev(() => {
        dealGame();
        drawFromStock();
        return state.moves;
      });
      assertEqual(result, 1, "moves should be 1");
    });

    await test("drawFromStock starts timer", async () => {
      const result = await ev(() => {
        dealGame();
        drawFromStock();
        return state.firstMove;
      });
      assert(result, "firstMove should be true after draw");
    });

    await test("recycleWaste moves all waste cards back to stock", async () => {
      const result = await ev(() => {
        dealGame();
        // Draw all stock cards
        while (state.stock.length > 0) drawFromStock();
        const wasteBefore = state.waste.length;
        recycleWaste();
        return {
          wasteBefore,
          stockAfter: state.stock.length,
          wasteAfter: state.waste.length,
        };
      });
      assertEqual(result.wasteBefore, 24, "should have drawn 24 cards");
      assertEqual(result.stockAfter, 24, "all cards back in stock");
      assertEqual(result.wasteAfter, 0, "waste should be empty");
    });

    await test("recycleWaste: first recycle has no score penalty", async () => {
      const result = await ev(() => {
        dealGame();
        while (state.stock.length > 0) drawFromStock();
        recycleWaste();
        return { score: state.score, recycleCount: state.recycleCount };
      });
      assertEqual(result.score, 0, "no penalty on first recycle");
      assertEqual(result.recycleCount, 1, "recycle count should be 1");
    });

    await test("recycleWaste: second recycle penalises -100", async () => {
      const result = await ev(() => {
        dealGame();
        state.score = 200;
        // First cycle
        while (state.stock.length > 0) drawFromStock();
        recycleWaste();
        // Second cycle
        while (state.stock.length > 0) drawFromStock();
        recycleWaste();
        return { score: state.score, recycleCount: state.recycleCount };
      });
      assertEqual(result.score, 100, "score should be 200 - 100 = 100");
      assertEqual(result.recycleCount, 2, "recycle count should be 2");
    });

    await test("foundation move scores +10", async () => {
      const result = await ev(() => {
        dealGame();
        state.tableau[0] = [{ suit: "hearts", rank: "A", faceUp: true }];
        render();
        const el = document.querySelector(
          '.card[data-source="tableau"][data-source-index="0"]'
        );
        handleCardTap(el);
        return {
          score: state.score,
          foundationLen: state.foundations[0].length,
        };
      });
      assertEqual(result.score, 10, "foundation move should score +10");
      assertEqual(result.foundationLen, 1, "foundation should have 1 card");
    });

    await test("waste to tableau scores +5", async () => {
      const result = await ev(() => {
        dealGame();
        // Set up deterministic scenario:
        // Col 0 has a black 6 face-up, waste has a red 5 (not an Ace, so won't go to foundation)
        state.tableau[0] = [{ suit: "spades", rank: "6", faceUp: true }];
        state.waste = [{ suit: "hearts", rank: "5", faceUp: true }];
        state.score = 0;
        render();
        const el = document.querySelector('.card[data-source="waste"]');
        handleCardTap(el);
        return { score: state.score };
      });
      assertEqual(result.score, 5, "waste to tableau should score +5");
    });

    await test("revealing face-down card scores +5", async () => {
      const result = await ev(() => {
        dealGame();
        // Set up a deterministic scenario:
        // Col 1: face-down card + red 5 face-up
        // Col 2: black 6 face-up (so red 5 can move there)
        state.tableau[1] = [
          { suit: "clubs", rank: "K", faceUp: false },
          { suit: "hearts", rank: "5", faceUp: true },
        ];
        state.tableau[2] = [{ suit: "spades", rank: "6", faceUp: true }];
        state.score = 0;
        render();
        const el = document.querySelector(
          '.card[data-source="tableau"][data-source-index="1"][data-card-index="1"]'
        );
        handleCardTap(el);
        return {
          score: state.score,
          revealed: state.tableau[1][0]?.faceUp,
        };
      });
      assertEqual(result.score, 5, "reveal should score +5");
      assertEqual(result.revealed, true, "face-down card should flip");
    });

    await test("undo reverses last move", async () => {
      const result = await ev(() => {
        dealGame();
        const stockBefore = state.stock.length;
        drawFromStock();
        undo();
        return {
          stockAfter: state.stock.length,
          wasteAfter: state.waste.length,
          moves: state.moves,
        };
      });
      assertEqual(result.wasteAfter, 0, "waste should be empty after undo");
      assertEqual(result.moves, 0, "moves should be 0 after undo");
    });

    await test("multiple undos work", async () => {
      const result = await ev(() => {
        dealGame();
        drawFromStock();
        drawFromStock();
        drawFromStock();
        undo();
        undo();
        return {
          wasteLen: state.waste.length,
          moves: state.moves,
          undoStackLen: undoStack.length,
        };
      });
      assertEqual(result.wasteLen, 1, "waste should have 1 card");
      assertEqual(result.moves, 1, "moves should be 1");
      assertEqual(result.undoStackLen, 1, "undo stack should have 1 entry");
    });

    await test("undo button disabled when stack empty", async () => {
      const result = await ev(() => {
        dealGame();
        return document.getElementById("btn-undo").disabled;
      });
      assertEqual(result, true, "undo button should be disabled");
    });

    await test("hint finds valid moves", async () => {
      const result = await ev(() => {
        dealGame();
        const moves = findValidMoves();
        return { count: moves.length, hasMove: moves.length > 0 };
      });
      assert(result.hasMove, "should find at least one valid move");
    });

    await test("hint highlights elements", async () => {
      const result = await ev(() => {
        dealGame();
        showHint();
        const count = document.querySelectorAll(".highlighted").length;
        clearHint();
        return count;
      });
      assert(result > 0, "hint should highlight at least one element");
    });

    await test("win detection triggers on full foundations", async () => {
      const result = await ev(() => {
        dealGame();
        const suits = ["clubs", "diamonds", "hearts", "spades"];
        const ranks = [
          "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K",
        ];
        state.foundations = suits.map((suit) =>
          ranks.map((rank) => ({ suit, rank, faceUp: true }))
        );
        state.tableau = [[], [], [], [], [], [], []];
        state.stock = [];
        state.waste = [];
        render();
        checkWin();
        return !document.getElementById("win-overlay").classList.contains("hidden");
      });
      assert(result, "win overlay should be visible");
    });

    await test("new game from win overlay deals fresh game", async () => {
      const result = await ev(() => {
        // Already in win state from previous test
        document.getElementById("btn-win-new-game").click();
        return {
          winHidden: document
            .getElementById("win-overlay")
            .classList.contains("hidden"),
          stock: state.stock.length,
          score: state.score,
        };
      });
      assert(result.winHidden, "win overlay should be hidden");
      assertEqual(result.stock, 24, "new game should have 24 stock cards");
      assertEqual(result.score, 0, "score should be 0");
    });

    await test("new game confirmation during active game", async () => {
      const result = await ev(() => {
        dealGame();
        drawFromStock(); // start the game
        document.getElementById("btn-new-game").click();
        const confirmVisible = !document
          .getElementById("confirm-overlay")
          .classList.contains("hidden");
        document.getElementById("btn-confirm-no").click();
        const dismissed = document
          .getElementById("confirm-overlay")
          .classList.contains("hidden");
        return { confirmVisible, dismissed };
      });
      assert(result.confirmVisible, "confirmation should appear");
      assert(result.dismissed, "clicking No should dismiss");
    });

    await test("game input blocked while overlay is showing", async () => {
      const result = await ev(() => {
        dealGame();
        drawFromStock(); // start game
        const movesBefore = state.moves;
        // Show win overlay
        document.getElementById("win-overlay").classList.remove("hidden");
        // Try to draw from stock via direct stock tap simulation
        // The overlayActive() guard should prevent this
        const stockSlot = document.querySelector(".stock-slot");
        const rect = stockSlot.getBoundingClientRect();
        const area = document.getElementById("play-area");
        // Simulate pointerdown + pointerup
        area.dispatchEvent(new PointerEvent("pointerdown", {
          clientX: rect.x + 5, clientY: rect.y + 5, bubbles: true
        }));
        area.dispatchEvent(new PointerEvent("pointerup", {
          clientX: rect.x + 5, clientY: rect.y + 5, bubbles: true
        }));
        const movesAfter = state.moves;
        document.getElementById("win-overlay").classList.add("hidden");
        return { movesBefore, movesAfter };
      });
      assertEqual(
        result.movesBefore, result.movesAfter,
        "moves should not change while overlay is active"
      );
    });

    await test("stack move: multiple face-up cards move together", async () => {
      const result = await ev(() => {
        dealGame();
        // Col 0: 8♠, 7♥, 6♠ (alternating colour run)
        // Col 1: face-down K♣, face-up 9♥ (8♠ can go on 9♥)
        state.tableau[0] = [
          { suit: "spades", rank: "8", faceUp: true },
          { suit: "hearts", rank: "7", faceUp: true },
          { suit: "spades", rank: "6", faceUp: true },
        ];
        state.tableau[1] = [
          { suit: "clubs", rank: "K", faceUp: false },
          { suit: "hearts", rank: "9", faceUp: true },
        ];
        render();
        const el = document.querySelector(
          '.card[data-source="tableau"][data-source-index="0"][data-card-index="0"]'
        );
        handleCardTap(el);
        return {
          col0Len: state.tableau[0].length,
          col1Len: state.tableau[1].length,
        };
      });
      assertEqual(result.col0Len, 0, "source column should be empty");
      assertEqual(result.col1Len, 5, "dest should have all 5 cards");
    });

    await test("score cannot go below zero", async () => {
      const result = await ev(() => {
        dealGame();
        state.score = 50;
        state.recycleCount = 1; // next recycle costs -100
        while (state.stock.length > 0) drawFromStock();
        recycleWaste();
        return state.score;
      });
      assertEqual(result, 0, "score should floor at 0");
    });

    await test("foundation to tableau scores -15", async () => {
      const result = await ev(() => {
        dealGame();
        state.foundations[0] = [{ suit: "hearts", rank: "A", faceUp: true }];
        state.tableau[0] = [{ suit: "spades", rank: "2", faceUp: true }];
        state.score = 30;
        render();
        const el = document.querySelector('.card[data-source="foundation"]');
        handleCardTap(el);
        return {
          score: state.score,
          foundationLen: state.foundations[0].length,
        };
      });
      assertEqual(result.score, 15, "score should be 30 - 15 = 15");
      assertEqual(result.foundationLen, 0, "foundation should be empty");
    });

    await test("empty stock shows recycle indicator", async () => {
      const result = await ev(() => {
        dealGame();
        while (state.stock.length > 0) drawFromStock();
        render();
        const slot = document.querySelector(".stock-slot");
        return !slot.classList.contains("has-card");
      });
      assert(result, "stock slot should not have has-card class when empty");
    });

    await test("persistence: state saved to localStorage", async () => {
      const result = await ev(() => {
        dealGame();
        drawFromStock();
        const saved = localStorage.getItem("solitaire-state");
        return saved !== null;
      });
      assert(result, "state should be saved to localStorage");
    });

    await test("persistence: state restored on reload", async () => {
      // Draw cards to create distinctive state
      await ev(() => {
        dealGame();
        drawFromStock();
        drawFromStock();
        drawFromStock();
      });
      // Reload page
      await page.reload();
      await page.waitForFunction(() => typeof state !== "undefined");
      const result = await ev(() => ({
        wasteLen: state.waste.length,
        moves: state.moves,
      }));
      assertEqual(result.wasteLen, 3, "waste should restore with 3 cards");
      assertEqual(result.moves, 3, "moves should restore");
    });
  });

  return summary();
}
