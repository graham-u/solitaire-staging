/* Diagnose hint outcomes on random fresh deals.
   Runs solveTrace (same logic the hint uses) against N fresh deals and
   reports the outcome distribution, timings, and whether budgets saturated. */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, "..", "solver-worker.js"), "utf8");

const sandbox = { self: {}, performance: { now: () => Number(process.hrtime.bigint()) / 1e6 } };
const fn = new Function(
  "self", "performance",
  src + "\nreturn { solveTrace, cloneState };"
);
const api = fn(sandbox.self, sandbox.performance);

const SUITS = ["hearts", "diamonds", "clubs", "spades"];
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

function createDeck() {
  const deck = [];
  for (const s of SUITS) for (const r of RANKS) deck.push({ suit: s, rank: r, faceUp: false });
  return deck;
}
function shuffle(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}
function dealFresh() {
  const deck = shuffle(createDeck());
  const tableau = [[], [], [], [], [], [], []];
  for (let col = 0; col < 7; col++) {
    for (let row = 0; row <= col; row++) {
      const card = deck.pop();
      card.faceUp = (row === col);
      tableau[col].push(card);
    }
  }
  return {
    stock: deck.reverse(),
    waste: [],
    foundations: [[], [], [], []],
    tableau,
    recycleCount: 0
  };
}

const N = Number(process.argv[2] || 20);
const TIME_LIMIT = Number(process.argv[3] || 15000);
console.log(`Running solveTrace on ${N} fresh deals, timeLimit=${TIME_LIMIT}ms each\n`);

const results = { winnable: 0, unwinnable: 0, timeout: 0 };
const times = [];
for (let i = 0; i < N; i++) {
  const state = dealFresh();
  const t0 = Date.now();
  const r = api.solveTrace(state, TIME_LIMIT);
  const elapsed = Date.now() - t0;
  times.push(elapsed);
  results[r.outcome] = (results[r.outcome] || 0) + 1;
  const moves = r.moves ? r.moves.length : "-";
  console.log(`  deal ${String(i + 1).padStart(2)}: ${r.outcome.padEnd(12)} ${elapsed}ms  moves=${moves}`);
}

console.log("\nSummary:");
console.log(`  winnable:   ${results.winnable}`);
console.log(`  unwinnable: ${results.unwinnable}`);
console.log(`  timeout:    ${results.timeout}`);
console.log(`  elapsed:    min=${Math.min(...times)}ms  max=${Math.max(...times)}ms  avg=${Math.round(times.reduce((a,b)=>a+b,0)/times.length)}ms`);
