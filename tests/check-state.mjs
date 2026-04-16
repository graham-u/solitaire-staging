/* One-off diagnostic: load the solver and run it on a captured game state. */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, "..", "solver-worker.js"), "utf8");

// Emulate the worker environment so we can evaluate solver-worker.js in Node.
const sandbox = { self: {}, performance: { now: () => Number(process.hrtime.bigint()) / 1e6 } };
const fn = new Function("self", "performance", src + "\nreturn { solve };");
const { solve } = fn(sandbox.self, sandbox.performance);

const stateJson = process.argv[2];
if (!stateJson) {
  console.error("Usage: node tests/check-state.mjs '<JSON string>'");
  console.error("       TIME_LIMIT=<ms> node tests/check-state.mjs '<JSON string>'");
  process.exit(1);
}
const state = JSON.parse(stateJson);

// Re-enter the solver's shape. The worker expects: stock, waste, foundations, tableau, recycleCount.
const solverInput = {
  stock: state.stock,
  waste: state.waste,
  foundations: state.foundations,
  tableau: state.tableau,
  recycleCount: state.recycleCount
};

const faceDown = state.tableau.reduce((n, col) => n + col.filter(c => !c.faceUp).length, 0);
console.log(`Face-down cards: ${faceDown}`);
console.log(`Recycle count: ${state.recycleCount}`);
console.log(`Foundations: ${state.foundations.map(f => f.length).join("/")}`);

const timeLimit = parseInt(process.env.TIME_LIMIT || "60000", 10);
console.log(`Running solver with ${timeLimit}ms budget…`);
const t0 = Date.now();
const outcome = solve(solverInput, timeLimit);
const elapsed = Date.now() - t0;
console.log(`Result: ${outcome} (in ${elapsed}ms)`);
