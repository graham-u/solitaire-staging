/**
 * Game logic unit tests — tests pure game rules via browser page evaluation.
 */
import { withPage, test, assert, assertEqual, summary, resetCounts } from "./helpers.mjs";

export default async function run() {
  console.log("\n--- Game Logic Tests ---");
  resetCounts();

  await withPage(async (page) => {
    // Helper to evaluate in page context
    const ev = (fn) => page.evaluate(fn);

    await test("createDeck returns 52 cards", async () => {
      const count = await ev(() => createDeck().length);
      assertEqual(count, 52, "deck should have 52 cards");
    });

    await test("createDeck has 4 suits × 13 ranks", async () => {
      const result = await ev(() => {
        const deck = createDeck();
        const suits = new Set(deck.map((c) => c.suit));
        const ranks = new Set(deck.map((c) => c.rank));
        return { suits: suits.size, ranks: ranks.size };
      });
      assertEqual(result.suits, 4, "should have 4 suits");
      assertEqual(result.ranks, 13, "should have 13 ranks");
    });

    await test("shuffle produces different order", async () => {
      const result = await ev(() => {
        const d1 = createDeck();
        const d2 = shuffle(createDeck());
        // Compare first 10 cards — vanishingly unlikely to match
        const same = d1.slice(0, 10).every(
          (c, i) => c.suit === d2[i].suit && c.rank === d2[i].rank
        );
        return !same;
      });
      assert(result, "shuffled deck should differ from unshuffled");
    });

    await test("dealGame sets up 7 tableau columns correctly", async () => {
      const result = await ev(() => {
        dealGame();
        return state.tableau.map((col) => col.length);
      });
      for (let i = 0; i < 7; i++) {
        assertEqual(result[i], i + 1, `column ${i} should have ${i + 1} cards`);
      }
    });

    await test("dealGame puts 24 cards in stock", async () => {
      const count = await ev(() => {
        dealGame();
        return state.stock.length;
      });
      assertEqual(count, 24, "stock should have 24 cards");
    });

    await test("dealGame: only top card of each column is face-up", async () => {
      const result = await ev(() => {
        dealGame();
        return state.tableau.map((col) =>
          col.map((c) => c.faceUp)
        );
      });
      for (let col = 0; col < 7; col++) {
        for (let row = 0; row < result[col].length; row++) {
          const expected = row === result[col].length - 1;
          assertEqual(
            result[col][row],
            expected,
            `col ${col} row ${row} faceUp should be ${expected}`
          );
        }
      }
    });

    await test("dealGame resets score, moves, time", async () => {
      const result = await ev(() => {
        dealGame();
        return { score: state.score, moves: state.moves, time: state.time };
      });
      assertEqual(result.score, 0, "score should be 0");
      assertEqual(result.moves, 0, "moves should be 0");
      assertEqual(result.time, 0, "time should be 0");
    });

    await test("rankValue returns correct values", async () => {
      const result = await ev(() => ({
        A: rankValue("A"),
        "5": rankValue("5"),
        "10": rankValue("10"),
        K: rankValue("K"),
      }));
      assertEqual(result.A, 1, "Ace = 1");
      assertEqual(result["5"], 5, "5 = 5");
      assertEqual(result["10"], 10, "10 = 10");
      assertEqual(result.K, 13, "King = 13");
    });

    await test("isRed identifies suits correctly", async () => {
      const result = await ev(() => ({
        hearts: isRed("hearts"),
        diamonds: isRed("diamonds"),
        clubs: isRed("clubs"),
        spades: isRed("spades"),
      }));
      assertEqual(result.hearts, true, "hearts is red");
      assertEqual(result.diamonds, true, "diamonds is red");
      assertEqual(result.clubs, false, "clubs is not red");
      assertEqual(result.spades, false, "spades is not red");
    });

    await test("canPlaceOnFoundation: ace on empty pile", async () => {
      const result = await ev(() => {
        const ace = { suit: "hearts", rank: "A", faceUp: true };
        return canPlaceOnFoundation(ace, []);
      });
      assert(result, "ace should go on empty foundation");
    });

    await test("canPlaceOnFoundation: non-ace on empty pile rejected", async () => {
      const result = await ev(() => {
        const two = { suit: "hearts", rank: "2", faceUp: true };
        return canPlaceOnFoundation(two, []);
      });
      assert(!result, "non-ace should be rejected on empty foundation");
    });

    await test("canPlaceOnFoundation: same suit, one higher", async () => {
      const result = await ev(() => {
        const ace = { suit: "hearts", rank: "A", faceUp: true };
        const two = { suit: "hearts", rank: "2", faceUp: true };
        return canPlaceOnFoundation(two, [ace]);
      });
      assert(result, "2 of hearts should go on ace of hearts");
    });

    await test("canPlaceOnFoundation: different suit rejected", async () => {
      const result = await ev(() => {
        const ace = { suit: "hearts", rank: "A", faceUp: true };
        const two = { suit: "spades", rank: "2", faceUp: true };
        return canPlaceOnFoundation(two, [ace]);
      });
      assert(!result, "different suit should be rejected");
    });

    await test("canPlaceOnTableau: king on empty column", async () => {
      const result = await ev(() => {
        const king = { suit: "hearts", rank: "K", faceUp: true };
        return canPlaceOnTableau(king, []);
      });
      assert(result, "king should go on empty column");
    });

    await test("canPlaceOnTableau: non-king on empty column rejected", async () => {
      const result = await ev(() => {
        const queen = { suit: "hearts", rank: "Q", faceUp: true };
        return canPlaceOnTableau(queen, []);
      });
      assert(!result, "non-king should be rejected on empty column");
    });

    await test("canPlaceOnTableau: opposite colour, one lower", async () => {
      const result = await ev(() => {
        const blackJ = { suit: "spades", rank: "J", faceUp: true };
        const red10 = { suit: "hearts", rank: "10", faceUp: true };
        return canPlaceOnTableau(red10, [blackJ]);
      });
      assert(result, "red 10 should go on black J");
    });

    await test("canPlaceOnTableau: same colour rejected", async () => {
      const result = await ev(() => {
        const redJ = { suit: "hearts", rank: "J", faceUp: true };
        const red10 = { suit: "diamonds", rank: "10", faceUp: true };
        return canPlaceOnTableau(red10, [redJ]);
      });
      assert(!result, "same colour should be rejected");
    });

    await test("canPlaceOnTableau: wrong rank rejected", async () => {
      const result = await ev(() => {
        const blackJ = { suit: "spades", rank: "J", faceUp: true };
        const red9 = { suit: "hearts", rank: "9", faceUp: true };
        return canPlaceOnTableau(red9, [blackJ]);
      });
      assert(!result, "9 on J should be rejected (need 10)");
    });
  });

  return summary();
}
