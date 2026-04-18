/* Path-tracking solver — finds the actual sequence of moves to a win. */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, "..", "solver-worker.js"), "utf8");

const sandbox = { self: {}, performance: { now: () => Number(process.hrtime.bigint()) / 1e6 } };
// Expose all internal helpers so we can build a path-tracking DFS on top.
const fn = new Function(
  "self", "performance",
  src +
  "\nreturn { applyDominanceMoves, findAllMoves, applyMove, cloneState, hashState, isWon, isTriviallyWinnable };"
);
const api = fn(sandbox.self, sandbox.performance);

const stateJson = process.argv[2];
if (!stateJson) { console.error("Usage: node tests/find-path.mjs '<JSON>'"); process.exit(1); }
const gameState = JSON.parse(stateJson);

const root = api.cloneState({
  stock: gameState.stock, waste: gameState.waste,
  foundations: gameState.foundations, tableau: gameState.tableau,
  recycleCount: 0
});

const visited = new Set();
const maxDepth = 2000;
const TIME_LIMIT = 60000;
const t0 = Date.now();

function dfs(s, path) {
  if (Date.now() - t0 > TIME_LIMIT) return null;
  if (path.length > maxDepth) return false;
  api.applyDominanceMoves(s);
  if (api.isWon(s)) return path;
  const hash = api.hashState(s);
  if (visited.has(hash)) return false;
  visited.add(hash);
  const moves = api.findAllMoves(s);
  for (const move of moves) {
    const child = api.cloneState(s);
    api.applyMove(child, move);
    const r = dfs(child, [...path, { move, snapshot: snapshotFor(move, s) }]);
    if (r) return r;
    if (r === null) return null;
  }
  return false;
}

function snapshotFor(move, s) {
  // Capture just enough to describe the move in words.
  switch (move.type) {
    case "waste-to-foundation":
      return { card: describeCard(s.waste[s.waste.length - 1]), foundation: move.fi };
    case "waste-to-tableau":
      return { card: describeCard(s.waste[s.waste.length - 1]), toCol: move.ti };
    case "tableau-to-foundation": {
      const col = s.tableau[move.fromCol];
      return { card: describeCard(col[col.length - 1]), fromCol: move.fromCol, foundation: move.fi };
    }
    case "foundation-to-tableau": {
      const pile = s.foundations[move.fi];
      return { card: describeCard(pile[pile.length - 1]), foundation: move.fi, toCol: move.ti };
    }
    case "tableau-to-tableau": {
      const col = s.tableau[move.fromCol];
      const cards = col.slice(move.startIdx).map(describeCard);
      return { cards, fromCol: move.fromCol, toCol: move.toCol };
    }
    case "draw":
      return { top: s.stock.length ? describeCard(s.stock[s.stock.length - 1]) : "?" };
    case "recycle":
      return { wasteLen: s.waste.length };
  }
}

function describeCard(c) {
  const suitSym = { clubs: "♣", diamonds: "♦", hearts: "♥", spades: "♠" }[c.suit];
  return `${c.rank}${suitSym}`;
}

function describeMove(entry) {
  const { move, snapshot } = entry;
  switch (move.type) {
    case "waste-to-foundation":
      return `Waste → Foundation: ${snapshot.card}`;
    case "waste-to-tableau":
      return `Waste → Col ${snapshot.toCol + 1}: ${snapshot.card}`;
    case "tableau-to-foundation":
      return `Col ${snapshot.fromCol + 1} → Foundation: ${snapshot.card}`;
    case "foundation-to-tableau":
      return `Foundation → Col ${snapshot.toCol + 1}: ${snapshot.card}`;
    case "tableau-to-tableau":
      return `Col ${snapshot.fromCol + 1} → Col ${snapshot.toCol + 1}: ${snapshot.cards.join("-")}`;
    case "draw":
      return `Draw from stock`;
    case "recycle":
      return `Recycle waste to stock`;
  }
}

const path = dfs(root, []);
if (path === null) {
  console.log("Timeout before finding a path");
} else if (!path) {
  console.log("No winning path exists");
} else {
  console.log(`Found winning path in ${path.length} moves (includes dominance auto-plays, which happen implicitly):`);
  path.forEach((entry, i) => console.log(`${String(i + 1).padStart(3, " ")}. ${describeMove(entry)}`));
}
