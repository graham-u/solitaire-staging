/* Solver Web Worker — DFS-based unwinnable game detector */

/* ── Game rules (parallel implementations adapted from app.js) ── */

const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const RED_SUITS = new Set(["diamonds", "hearts"]);

function rankValue(rank) { return RANKS.indexOf(rank) + 1; }
function isRed(suit) { return RED_SUITS.has(suit); }

function canPlaceOnFoundation(card, pileTop) {
  if (!pileTop) return card.rank === "A";
  return card.suit === pileTop.suit && rankValue(card.rank) === rankValue(pileTop.rank) + 1;
}

function canPlaceOnTableau(card, columnTop) {
  if (!columnTop) return card.rank === "K";
  return isRed(card.suit) !== isRed(columnTop.suit) && rankValue(card.rank) === rankValue(columnTop.rank) - 1;
}

/* ── Card encoding for state hashing ── */

const SUIT_INDEX = { clubs: 0, diamonds: 1, hearts: 2, spades: 3 };

function cardId(card) {
  return SUIT_INDEX[card.suit] * 13 + (rankValue(card.rank) - 1);
}

/* ── State hashing ── */

function hashState(s) {
  const parts = [];

  // Foundations: 4 counts indexed by suit
  const fCounts = [0, 0, 0, 0];
  for (let i = 0; i < 4; i++) {
    if (s.foundations[i].length > 0) {
      const top = s.foundations[i][s.foundations[i].length - 1];
      fCounts[SUIT_INDEX[top.suit]] = s.foundations[i].length;
    }
  }
  parts.push("F" + fCounts.join(","));

  // Stock: ordered card IDs
  parts.push("S" + s.stock.map(cardId).join(","));

  // Waste: ordered card IDs
  parts.push("W" + s.waste.map(cardId).join(","));

  // Tableau: each column with face-up boundary
  for (let col = 0; col < 7; col++) {
    const column = s.tableau[col];
    const faceUpIdx = column.findIndex(c => c.faceUp);
    const boundary = faceUpIdx === -1 ? column.length : faceUpIdx;
    const ids = column.map(cardId).join(",");
    parts.push("T" + boundary + ":" + ids);
  }

  parts.push("R" + s.recycleCount);

  return parts.join("|");
}

/* ── Deep clone state ── */

function cloneState(s) {
  return {
    stock: s.stock.map(c => ({ suit: c.suit, rank: c.rank, faceUp: c.faceUp })),
    waste: s.waste.map(c => ({ suit: c.suit, rank: c.rank, faceUp: c.faceUp })),
    foundations: s.foundations.map(f => f.map(c => ({ suit: c.suit, rank: c.rank, faceUp: c.faceUp }))),
    tableau: s.tableau.map(col => col.map(c => ({ suit: c.suit, rank: c.rank, faceUp: c.faceUp }))),
    recycleCount: s.recycleCount
  };
}

/* ── Early winnability check ── */

function isTriviallyWinnable(s) {
  if (s.stock.length > 0 || s.waste.length > 0) return false;
  return s.tableau.every(col => col.every(c => c.faceUp));
}

/* ── Dominance (safe) moves ── */

function foundationRankBySuit(foundations) {
  const ranks = { clubs: 0, diamonds: 0, hearts: 0, spades: 0 };
  for (let i = 0; i < 4; i++) {
    const f = foundations[i];
    if (f.length > 0) {
      ranks[f[0].suit] = f.length; // length == rank of top card
    }
  }
  return ranks;
}

function isSafeFoundationMove(card, foundations) {
  const rv = rankValue(card.rank);
  // Aces and twos are always safe
  if (rv <= 2) return true;
  // Card of rank N is safe if both opposite-colour foundations have reached N-1
  const fRanks = foundationRankBySuit(foundations);
  const oppSuits = isRed(card.suit) ? ["clubs", "spades"] : ["diamonds", "hearts"];
  return oppSuits.every(s => fRanks[s] >= rv - 1);
}

function applyDominanceMoves(s) {
  let changed = true;
  while (changed) {
    changed = false;

    // Check waste top
    if (s.waste.length > 0) {
      const card = s.waste[s.waste.length - 1];
      for (let i = 0; i < 4; i++) {
        const fTop = s.foundations[i].length > 0 ? s.foundations[i][s.foundations[i].length - 1] : null;
        if (canPlaceOnFoundation(card, fTop) && isSafeFoundationMove(card, s.foundations)) {
          s.waste.pop();
          s.foundations[i].push(card);
          changed = true;
          break;
        }
      }
    }

    // Check tableau tops
    for (let col = 0; col < 7; col++) {
      const column = s.tableau[col];
      if (column.length === 0) continue;
      const card = column[column.length - 1];
      if (!card.faceUp) continue;
      for (let i = 0; i < 4; i++) {
        const fTop = s.foundations[i].length > 0 ? s.foundations[i][s.foundations[i].length - 1] : null;
        if (canPlaceOnFoundation(card, fTop) && isSafeFoundationMove(card, s.foundations)) {
          column.pop();
          s.foundations[i].push(card);
          // Auto-flip
          if (column.length > 0 && !column[column.length - 1].faceUp) {
            column[column.length - 1].faceUp = true;
          }
          changed = true;
          break;
        }
      }
    }
  }
}

/* ── Find all legal moves ── */

function findAllMoves(s) {
  const moves = [];

  // Waste top card to foundation or tableau
  if (s.waste.length > 0) {
    const card = s.waste[s.waste.length - 1];
    for (let i = 0; i < 4; i++) {
      const fTop = s.foundations[i].length > 0 ? s.foundations[i][s.foundations[i].length - 1] : null;
      if (canPlaceOnFoundation(card, fTop)) {
        moves.push({ type: "waste-to-foundation", fi: i, priority: 0 });
      }
    }
    for (let i = 0; i < 7; i++) {
      const col = s.tableau[i];
      const colTop = col.length > 0 ? col[col.length - 1] : null;
      if (canPlaceOnTableau(card, colTop)) {
        moves.push({ type: "waste-to-tableau", ti: i, priority: 2 });
      }
    }
  }

  // Tableau top cards to foundation
  for (let col = 0; col < 7; col++) {
    const column = s.tableau[col];
    if (column.length === 0) continue;
    const card = column[column.length - 1];
    if (!card.faceUp) continue;
    for (let i = 0; i < 4; i++) {
      const fTop = s.foundations[i].length > 0 ? s.foundations[i][s.foundations[i].length - 1] : null;
      if (canPlaceOnFoundation(card, fTop)) {
        moves.push({ type: "tableau-to-foundation", fromCol: col, fi: i, priority: 0 });
      }
    }
  }

  // Foundation top cards back to tableau (the game allows this)
  for (let fi = 0; fi < 4; fi++) {
    const pile = s.foundations[fi];
    if (pile.length === 0) continue;
    const card = pile[pile.length - 1];
    for (let ti = 0; ti < 7; ti++) {
      const col = s.tableau[ti];
      const colTop = col.length > 0 ? col[col.length - 1] : null;
      if (canPlaceOnTableau(card, colTop)) {
        moves.push({ type: "foundation-to-tableau", fi, ti, priority: 3 });
      }
    }
  }

  // Face-up sub-stacks between tableau columns (full and partial runs)
  for (let col = 0; col < 7; col++) {
    const column = s.tableau[col];
    if (column.length === 0) continue;
    // Find the start of the face-up run
    let runStart = column.length - 1;
    while (runStart > 0 && column[runStart - 1].faceUp) {
      runStart--;
    }

    // Try moving each possible sub-stack starting from each face-up card
    for (let startIdx = runStart; startIdx < column.length; startIdx++) {
      const bottomCard = column[startIdx];
      // Determine priority: does moving reveal a face-down card?
      const revealsCard = startIdx === runStart && runStart > 0 && !column[runStart - 1].faceUp;

      for (let dest = 0; dest < 7; dest++) {
        if (dest === col) continue;
        const destCol = s.tableau[dest];
        const destTop = destCol.length > 0 ? destCol[destCol.length - 1] : null;
        if (canPlaceOnTableau(bottomCard, destTop)) {
          // Skip pointless king moves from position 0 to empty column
          if (bottomCard.rank === "K" && destCol.length === 0 && startIdx === 0) continue;
          moves.push({
            type: "tableau-to-tableau",
            fromCol: col,
            startIdx: startIdx,
            toCol: dest,
            priority: revealsCard ? 1 : 3
          });
        }
      }
    }
  }

  // Draw from stock
  if (s.stock.length > 0) {
    moves.push({ type: "draw", priority: 4 });
  }

  // Recycle waste to stock (capped at 5 recycles within solver)
  if (s.stock.length === 0 && s.waste.length > 0 && s.recycleCount < 5) {
    moves.push({ type: "recycle", priority: 5 });
  }

  // Sort by priority (lower = more promising)
  moves.sort((a, b) => a.priority - b.priority);
  return moves;
}

/* ── Apply a move to a state (mutates state) ── */

function applyMove(s, move) {
  switch (move.type) {
    case "waste-to-foundation": {
      const card = s.waste.pop();
      s.foundations[move.fi].push(card);
      break;
    }
    case "waste-to-tableau": {
      const card = s.waste.pop();
      s.tableau[move.ti].push(card);
      break;
    }
    case "tableau-to-foundation": {
      const col = s.tableau[move.fromCol];
      const card = col.pop();
      s.foundations[move.fi].push(card);
      // Auto-flip
      if (col.length > 0 && !col[col.length - 1].faceUp) {
        col[col.length - 1].faceUp = true;
      }
      break;
    }
    case "tableau-to-tableau": {
      const fromCol = s.tableau[move.fromCol];
      const cards = fromCol.splice(move.startIdx);
      s.tableau[move.toCol].push(...cards);
      // Auto-flip
      if (fromCol.length > 0 && !fromCol[fromCol.length - 1].faceUp) {
        fromCol[fromCol.length - 1].faceUp = true;
      }
      break;
    }
    case "draw": {
      const card = s.stock.pop();
      card.faceUp = true;
      s.waste.push(card);
      break;
    }
    case "foundation-to-tableau": {
      const card = s.foundations[move.fi].pop();
      s.tableau[move.ti].push(card);
      break;
    }
    case "recycle": {
      s.recycleCount++;
      while (s.waste.length > 0) {
        const card = s.waste.pop();
        card.faceUp = false;
        s.stock.push(card);
      }
      break;
    }
  }
}

/* ── Win check ── */

function isWon(s) {
  return s.foundations.every(f => f.length === 13);
}

/* ── DFS Solver ── */

function solve(initialState, timeLimit) {
  // Early winnability check
  if (isTriviallyWinnable(initialState)) {
    return "winnable";
  }

  const visited = new Set();
  const startTime = performance.now();
  const maxVisited = 500000;
  const maxDepth = 500;
  let statesExplored = 0;
  let hitDepthLimit = false;

  function dfs(s, depth) {
    if (depth > maxDepth) {
      hitDepthLimit = true;
      return false; // skip this branch but track that search was incomplete
    }

    // Apply dominance moves
    applyDominanceMoves(s);

    // Win check
    if (isWon(s)) return true;

    // Check timeout
    statesExplored++;
    if (performance.now() - startTime > timeLimit) return null; // timeout

    // Hash and check visited
    const hash = hashState(s);
    if (visited.has(hash)) return false;
    if (visited.size >= maxVisited) return null; // too many states
    visited.add(hash);

    // Generate and try all moves
    const moves = findAllMoves(s);
    for (const move of moves) {
      const child = cloneState(s);
      applyMove(child, move);
      const result = dfs(child, depth + 1);
      if (result === true) return true;   // winnable
      if (result === null) return null;    // timeout/memory
    }

    return false; // no moves lead to win
  }

  const root = cloneState(initialState);
  // Reset recycle count for solver (solver counts recycles from 0)
  root.recycleCount = 0;
  const result = dfs(root, 0);

  if (result === true) return "winnable";
  if (result === null) return "timeout";
  // Only declare unwinnable if search was truly exhaustive (no depth limits hit)
  if (hitDepthLimit) return "timeout";
  return "unwinnable";
}

/* ── Worker message handling ── */

self.onmessage = function(e) {
  const msg = e.data;
  if (msg.type === "solve") {
    const outcome = solve(msg.state, msg.timeLimit || 3000);
    self.postMessage({ type: "result", outcome, solveId: msg.solveId });
  }
};
