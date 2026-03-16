/* Solitaire — Klondike, draw-1 */

const SUITS = ["clubs", "diamonds", "hearts", "spades"];
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const SUIT_SYMBOLS = { clubs: "\u2663", diamonds: "\u2666", hearts: "\u2665", spades: "\u2660" };
const RED_SUITS = new Set(["diamonds", "hearts"]);

function rankValue(rank) { return RANKS.indexOf(rank) + 1; }
function isRed(suit) { return RED_SUITS.has(suit); }

/* ── State ── */

let state = {
  stock: [],
  waste: [],
  foundations: [[], [], [], []],
  tableau: [[], [], [], [], [], [], []],
  score: 0,
  moves: 0,
  time: 0,
  firstMove: false,
  recycleCount: 0
};

let undoStack = [];
let timerInterval = null;
let hintTimeout = null;

/* ── Deck ── */

function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank, faceUp: false });
    }
  }
  return deck;
}

function shuffle(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

/* ── Deal ── */

function dealGame() {
  const deck = shuffle(createDeck());
  state = {
    stock: [],
    waste: [],
    foundations: [[], [], [], []],
    tableau: [[], [], [], [], [], [], []],
    score: 0,
    moves: 0,
    time: 0,
    firstMove: false,
    recycleCount: 0
  };
  undoStack = [];

  // Deal to tableau
  for (let col = 0; col < 7; col++) {
    for (let row = 0; row <= col; row++) {
      const card = deck.pop();
      card.faceUp = (row === col);
      state.tableau[col].push(card);
    }
  }

  // Remaining cards go to stock
  state.stock = deck.reverse();

  stopTimer();
  updateStatusBar();
  render();
  saveState();
  updateUndoButton();
}

/* ── Rules ── */

function canPlaceOnFoundation(card, pile) {
  if (pile.length === 0) return card.rank === "A";
  const top = pile[pile.length - 1];
  return card.suit === top.suit && rankValue(card.rank) === rankValue(top.rank) + 1;
}

function canPlaceOnTableau(card, column) {
  if (column.length === 0) return card.rank === "K";
  const top = column[column.length - 1];
  if (!top.faceUp) return false;
  return isRed(card.suit) !== isRed(top.suit) && rankValue(card.rank) === rankValue(top.rank) - 1;
}

/* ── Move finding ── */

function findBestDestination(card, sourceType, sourceIndex) {
  // Try foundations first
  for (let i = 0; i < 4; i++) {
    if (canPlaceOnFoundation(card, state.foundations[i])) {
      return { type: "foundation", index: i };
    }
  }
  // Try tableau (prefer columns with cards over empty)
  let emptyCol = -1;
  for (let i = 0; i < 7; i++) {
    if (sourceType === "tableau" && i === sourceIndex) continue;
    if (state.tableau[i].length === 0) {
      if (emptyCol === -1) emptyCol = i;
      continue;
    }
    if (canPlaceOnTableau(card, state.tableau[i])) {
      return { type: "tableau", index: i };
    }
  }
  // Use empty column for kings
  if (emptyCol !== -1 && card.rank === "K") {
    return { type: "tableau", index: emptyCol };
  }
  return null;
}

/* ── State snapshot for undo ── */

function cloneState() {
  return JSON.parse(JSON.stringify({
    stock: state.stock,
    waste: state.waste,
    foundations: state.foundations,
    tableau: state.tableau,
    score: state.score,
    moves: state.moves,
    recycleCount: state.recycleCount
  }));
}

function pushUndo() {
  undoStack.push(cloneState());
  updateUndoButton();
}

function updateUndoButton() {
  document.getElementById("btn-undo").disabled = undoStack.length === 0;
}

/* ── Moves ── */

function startTimerIfNeeded() {
  if (!state.firstMove) {
    state.firstMove = true;
    startTimer();
  }
}

function drawFromStock() {
  if (state.stock.length === 0) return;
  pushUndo();
  startTimerIfNeeded();
  const card = state.stock.pop();
  card.faceUp = true;
  state.waste.push(card);
  state.moves++;
  render();
  saveState();
}

function recycleWaste() {
  if (state.waste.length === 0) return;
  pushUndo();
  startTimerIfNeeded();
  state.recycleCount++;
  if (state.recycleCount > 1) {
    state.score = Math.max(0, state.score - 100);
  }
  while (state.waste.length > 0) {
    const card = state.waste.pop();
    card.faceUp = false;
    state.stock.push(card);
  }
  state.moves++;
  render();
  saveState();
}

function moveCardToFoundation(card, fromPile, foundationIndex) {
  fromPile.pop();
  state.foundations[foundationIndex].push(card);
  state.score += 10;
}

function moveCardToTableau(card, fromPile, tableauIndex) {
  fromPile.pop();
  state.tableau[tableauIndex].push(card);
}

function moveStackToTableau(fromCol, startIdx, toColIndex) {
  const cards = state.tableau[fromCol].splice(startIdx);
  state.tableau[toColIndex].push(...cards);
}

function autoFlipTableau(colIndex) {
  const col = state.tableau[colIndex];
  if (col.length > 0 && !col[col.length - 1].faceUp) {
    col[col.length - 1].faceUp = true;
    state.score += 5;
  }
}

function handleCardTap(cardEl) {
  const source = cardEl.dataset.source;
  const sourceIndex = parseInt(cardEl.dataset.sourceIndex, 10);

  if (source === "waste") {
    const card = state.waste[state.waste.length - 1];
    if (!card) return;
    const dest = findBestDestination(card, "waste", -1);
    if (!dest) return;
    pushUndo();
    startTimerIfNeeded();
    if (dest.type === "foundation") {
      moveCardToFoundation(card, state.waste, dest.index);
    } else {
      state.score += 5; // waste to tableau
      moveCardToTableau(card, state.waste, dest.index);
    }
    state.moves++;
    render();
    checkWin();
    saveState();
    return;
  }

  if (source === "foundation") {
    const pile = state.foundations[sourceIndex];
    const card = pile[pile.length - 1];
    if (!card) return;
    // Only move to tableau
    for (let i = 0; i < 7; i++) {
      if (canPlaceOnTableau(card, state.tableau[i])) {
        pushUndo();
        startTimerIfNeeded();
        pile.pop();
        state.tableau[i].push(card);
        state.score = Math.max(0, state.score - 15);
        state.moves++;
        render();
        saveState();
        return;
      }
    }
    return;
  }

  if (source === "tableau") {
    const cardIndex = parseInt(cardEl.dataset.cardIndex, 10);
    const col = state.tableau[sourceIndex];
    const card = col[cardIndex];
    if (!card || !card.faceUp) return;

    // If it's the top card, try foundation first
    if (cardIndex === col.length - 1) {
      const dest = findBestDestination(card, "tableau", sourceIndex);
      if (!dest) return;
      pushUndo();
      startTimerIfNeeded();
      if (dest.type === "foundation") {
        moveCardToFoundation(card, col, dest.index);
      } else {
        moveStackToTableau(sourceIndex, cardIndex, dest.index);
      }
      autoFlipTableau(sourceIndex);
      state.moves++;
      render();
      checkWin();
      saveState();
      return;
    }

    // It's a stack move — find a tableau destination for the bottom card of the sub-stack
    for (let i = 0; i < 7; i++) {
      if (i === sourceIndex) continue;
      if (canPlaceOnTableau(card, state.tableau[i])) {
        pushUndo();
        startTimerIfNeeded();
        moveStackToTableau(sourceIndex, cardIndex, i);
        autoFlipTableau(sourceIndex);
        state.moves++;
        render();
        saveState();
        return;
      }
    }
    // Try empty columns for king sub-stacks
    if (card.rank === "K") {
      for (let i = 0; i < 7; i++) {
        if (i === sourceIndex) continue;
        if (state.tableau[i].length === 0) {
          pushUndo();
          startTimerIfNeeded();
          moveStackToTableau(sourceIndex, cardIndex, i);
          autoFlipTableau(sourceIndex);
          state.moves++;
          render();
          saveState();
          return;
        }
      }
    }
  }
}

/* ── Undo ── */

function undo() {
  if (undoStack.length === 0) return;
  const prev = undoStack.pop();
  state.stock = prev.stock;
  state.waste = prev.waste;
  state.foundations = prev.foundations;
  state.tableau = prev.tableau;
  state.score = prev.score;
  state.moves = prev.moves;
  state.recycleCount = prev.recycleCount;
  updateUndoButton();
  render();
  saveState();
}

/* ── Hint ── */

function findValidMoves() {
  const moves = [];

  // Waste top card
  if (state.waste.length > 0) {
    const card = state.waste[state.waste.length - 1];
    for (let i = 0; i < 4; i++) {
      if (canPlaceOnFoundation(card, state.foundations[i])) {
        moves.push({ from: "waste", card, toType: "foundation", toIndex: i, priority: 1 });
      }
    }
    for (let i = 0; i < 7; i++) {
      if (state.tableau[i].length > 0 && canPlaceOnTableau(card, state.tableau[i])) {
        moves.push({ from: "waste", card, toType: "tableau", toIndex: i, priority: 2 });
      }
    }
  }

  // Tableau cards
  for (let col = 0; col < 7; col++) {
    const column = state.tableau[col];
    if (column.length === 0) continue;
    const topCard = column[column.length - 1];
    if (topCard.faceUp) {
      // Top card to foundation
      for (let i = 0; i < 4; i++) {
        if (canPlaceOnFoundation(topCard, state.foundations[i])) {
          moves.push({ from: "tableau", fromIndex: col, cardIndex: column.length - 1, card: topCard, toType: "foundation", toIndex: i, priority: 1 });
        }
      }
    }
    // Stack moves (face-up runs)
    for (let ci = column.length - 1; ci >= 0; ci--) {
      if (!column[ci].faceUp) break;
      const card = column[ci];
      for (let i = 0; i < 7; i++) {
        if (i === col) continue;
        if (canPlaceOnTableau(card, state.tableau[i])) {
          // Skip pointless king moves to empty columns if nothing to reveal
          if (card.rank === "K" && state.tableau[i].length === 0 && ci === 0) continue;
          moves.push({ from: "tableau", fromIndex: col, cardIndex: ci, card, toType: "tableau", toIndex: i, priority: 3 });
        }
      }
    }
  }

  // Draw from stock
  if (state.stock.length > 0) {
    moves.push({ from: "stock", toType: "draw", priority: 4 });
  } else if (state.waste.length > 0) {
    moves.push({ from: "recycle", toType: "recycle", priority: 5 });
  }

  moves.sort((a, b) => a.priority - b.priority);
  return moves;
}

function showHint() {
  clearHint();
  const moves = findValidMoves();
  if (moves.length === 0) return;

  const move = moves[0];

  if (move.from === "stock") {
    const stockEl = document.querySelector(".stock-slot");
    if (stockEl) stockEl.classList.add("highlighted");
  } else if (move.from === "recycle") {
    const stockEl = document.querySelector(".stock-slot");
    if (stockEl) stockEl.classList.add("highlighted");
  } else if (move.from === "waste") {
    const wasteCard = document.querySelector('.card[data-source="waste"]');
    if (wasteCard) wasteCard.classList.add("highlighted");
    highlightDestination(move);
  } else if (move.from === "tableau") {
    const cardEl = document.querySelector(
      `.card[data-source="tableau"][data-source-index="${move.fromIndex}"][data-card-index="${move.cardIndex}"]`
    );
    if (cardEl) cardEl.classList.add("highlighted");
    highlightDestination(move);
  }

  hintTimeout = setTimeout(clearHint, 2000);
}

function highlightDestination(move) {
  if (move.toType === "foundation") {
    const slotEl = document.querySelector(`.foundation-slot[data-index="${move.toIndex}"]`);
    if (slotEl) slotEl.classList.add("highlighted");
  } else if (move.toType === "tableau") {
    const col = state.tableau[move.toIndex];
    if (col.length === 0) {
      const colEl = document.querySelector(`.tableau-column[data-col="${move.toIndex}"]`);
      if (colEl) colEl.classList.add("highlighted");
    } else {
      const topCardEl = document.querySelector(
        `.card[data-source="tableau"][data-source-index="${move.toIndex}"][data-card-index="${col.length - 1}"]`
      );
      if (topCardEl) topCardEl.classList.add("highlighted");
    }
  }
}

function clearHint() {
  if (hintTimeout) {
    clearTimeout(hintTimeout);
    hintTimeout = null;
  }
  document.querySelectorAll(".highlighted").forEach(el => el.classList.remove("highlighted"));
}

/* ── Win ── */

function checkWin() {
  const won = state.foundations.every(f => f.length === 13);
  if (!won) return;
  stopTimer();
  showWinOverlay();
  launchConfetti();
  clearSavedState();
}

function showWinOverlay() {
  document.getElementById("win-score").textContent = `Score: ${state.score}`;
  document.getElementById("win-time").textContent = `Time: ${formatTime(state.time)}`;
  document.getElementById("win-moves").textContent = `Moves: ${state.moves}`;
  document.getElementById("win-overlay").classList.remove("hidden");
}

function launchConfetti() {
  const colours = ["#ff0", "#f00", "#0f0", "#00f", "#f0f", "#0ff", "#ff8800"];
  for (let i = 0; i < 80; i++) {
    const el = document.createElement("div");
    el.className = "confetti";
    el.style.left = Math.random() * 100 + "vw";
    el.style.background = colours[Math.floor(Math.random() * colours.length)];
    el.style.animationDelay = Math.random() * 2 + "s";
    el.style.animationDuration = (2 + Math.random() * 2) + "s";
    el.style.borderRadius = Math.random() > 0.5 ? "50%" : "0";
    document.body.appendChild(el);
    el.addEventListener("animationend", () => el.remove());
  }
}

/* ── Timer ── */

function startTimer() {
  if (timerInterval) return;
  timerInterval = setInterval(() => {
    state.time++;
    document.getElementById("time").textContent = formatTime(state.time);
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/* ── Persistence ── */

function saveState() {
  try {
    localStorage.setItem("solitaire-state", JSON.stringify({
      stock: state.stock,
      waste: state.waste,
      foundations: state.foundations,
      tableau: state.tableau,
      score: state.score,
      moves: state.moves,
      time: state.time,
      firstMove: state.firstMove,
      recycleCount: state.recycleCount
    }));
  } catch (e) { /* quota exceeded — ignore */ }
}

function loadState() {
  try {
    const saved = localStorage.getItem("solitaire-state");
    if (!saved) return false;
    const data = JSON.parse(saved);
    // Validate required structure before applying
    if (!Array.isArray(data.stock) ||
        !Array.isArray(data.waste) ||
        !Array.isArray(data.foundations) || data.foundations.length !== 4 ||
        !data.foundations.every(f => Array.isArray(f)) ||
        !Array.isArray(data.tableau) || data.tableau.length !== 7 ||
        !data.tableau.every(c => Array.isArray(c)) ||
        typeof data.score !== "number" ||
        typeof data.moves !== "number") {
      return false;
    }
    state.stock = data.stock;
    state.waste = data.waste;
    state.foundations = data.foundations;
    state.tableau = data.tableau;
    state.score = data.score;
    state.moves = data.moves;
    state.time = data.time || 0;
    state.firstMove = data.firstMove || false;
    state.recycleCount = data.recycleCount || 0;
    undoStack = [];
    if (state.firstMove) startTimer();
    return true;
  } catch (e) {
    return false;
  }
}

function clearSavedState() {
  localStorage.removeItem("solitaire-state");
}

/* ── Status bar ── */

function updateStatusBar() {
  document.getElementById("score").textContent = state.score;
  document.getElementById("time").textContent = formatTime(state.time);
  document.getElementById("moves").textContent = state.moves;
}

/* ── Rendering ── */

function createCardElement(card, source, sourceIndex, cardIndex) {
  const el = document.createElement("div");
  el.className = "card";
  el.dataset.source = source;
  el.dataset.sourceIndex = sourceIndex;
  if (cardIndex !== undefined) el.dataset.cardIndex = cardIndex;

  if (card.faceUp) {
    el.classList.add("face-up");
    el.classList.add(isRed(card.suit) ? "red" : "black");
    const symbol = SUIT_SYMBOLS[card.suit];

    const parts = [
      ["span", "card-rank-top", card.rank],
      ["span", "card-suit-top", symbol],
      ["span", "card-suit-centre", symbol],
      ["span", "card-rank-bottom", card.rank],
      ["span", "card-suit-bottom", symbol]
    ];
    for (const [tag, cls, text] of parts) {
      const s = document.createElement(tag);
      s.className = cls;
      s.textContent = text;
      el.appendChild(s);
    }
  } else {
    el.classList.add("face-down");
  }

  return el;
}

function render() {
  updateStatusBar();
  renderTopRow();
  renderTableau();
  updateUndoButton();
}

function renderTopRow() {
  const topRow = document.getElementById("top-row");
  topRow.innerHTML = "";

  // 4 foundation slots
  for (let i = 0; i < 4; i++) {
    const slot = document.createElement("div");
    slot.className = "slot foundation-slot";
    slot.dataset.index = i;
    const pile = state.foundations[i];
    if (pile.length > 0) {
      slot.classList.add("has-card");
      const cardEl = createCardElement(pile[pile.length - 1], "foundation", i);
      slot.appendChild(cardEl);
    }
    topRow.appendChild(slot);
  }

  // Waste area (spans 2 columns)
  const wasteArea = document.createElement("div");
  wasteArea.className = "slot waste-area";
  const wasteCount = state.waste.length;
  // Show up to 3 fanned cards
  const showCount = Math.min(wasteCount, 3);
  const startIdx = wasteCount - showCount;
  for (let i = 0; i < showCount; i++) {
    const card = state.waste[startIdx + i];
    const cardEl = createCardElement(card, "waste", startIdx + i);
    cardEl.style.left = `calc(var(--card-width) * 0.25 + ${i} * var(--card-width) * 0.28)`;
    // Only the top card is tappable
    if (startIdx + i < wasteCount - 1) {
      cardEl.style.pointerEvents = "none";
    }
    wasteArea.appendChild(cardEl);
  }
  topRow.appendChild(wasteArea);

  // Stock pile
  const stockSlot = document.createElement("div");
  stockSlot.className = "slot stock-slot";
  if (state.stock.length > 0) {
    stockSlot.classList.add("has-card");
    const backCard = document.createElement("div");
    backCard.className = "card face-down";
    backCard.dataset.source = "stock";
    stockSlot.appendChild(backCard);
  }
  topRow.appendChild(stockSlot);
}

function renderTableau() {
  const tableau = document.getElementById("tableau");
  tableau.innerHTML = "";

  for (let col = 0; col < 7; col++) {
    const colEl = document.createElement("div");
    colEl.className = "tableau-column";
    colEl.dataset.col = col;

    const column = state.tableau[col];
    if (column.length === 0) {
      colEl.classList.add("empty-col");
      colEl.dataset.source = "tableau-empty";
      colEl.dataset.sourceIndex = col;
    } else {
      for (let ci = 0; ci < column.length; ci++) {
        const cardEl = createCardElement(column[ci], "tableau", col, ci);
        colEl.appendChild(cardEl);
      }
    }

    tableau.appendChild(colEl);
  }
}

/* ── Event handling — Tap detection ── */

function overlayActive() {
  return !document.getElementById("win-overlay").classList.contains("hidden") ||
         !document.getElementById("confirm-overlay").classList.contains("hidden");
}

let pointerStart = null;

document.getElementById("play-area").addEventListener("pointerdown", (e) => {
  if (overlayActive()) return;
  pointerStart = { x: e.clientX, y: e.clientY, time: Date.now() };
});

document.getElementById("play-area").addEventListener("pointerup", (e) => {
  if (overlayActive() || !pointerStart) return;
  const dx = e.clientX - pointerStart.x;
  const dy = e.clientY - pointerStart.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const elapsed = Date.now() - pointerStart.time;
  pointerStart = null;

  if (dist > 15 || elapsed > 400) return; // Not a tap

  clearHint();

  const target = e.target.closest(".card, .stock-slot, .tableau-column.empty-col");
  if (!target) return;

  // Stock tap
  if (target.classList.contains("stock-slot") || target.dataset.source === "stock") {
    if (state.stock.length > 0) {
      drawFromStock();
    } else {
      recycleWaste();
    }
    return;
  }

  // Empty tableau column — do nothing (kings land here via tap on the king card)
  if (target.classList.contains("empty-col")) return;

  // Card tap
  if (target.classList.contains("card")) {
    handleCardTap(target);
  }
});

/* ── Action bar buttons ── */

document.getElementById("btn-new-game").addEventListener("click", () => {
  // If game in progress, confirm
  if (state.firstMove && !state.foundations.every(f => f.length === 13)) {
    document.getElementById("confirm-overlay").classList.remove("hidden");
  } else {
    dealGame();
  }
});

document.getElementById("btn-confirm-yes").addEventListener("click", () => {
  document.getElementById("confirm-overlay").classList.add("hidden");
  clearSavedState();
  dealGame();
});

document.getElementById("btn-confirm-no").addEventListener("click", () => {
  document.getElementById("confirm-overlay").classList.add("hidden");
});

document.getElementById("btn-hint").addEventListener("click", () => {
  if (overlayActive()) return;
  showHint();
});

document.getElementById("btn-undo").addEventListener("click", () => {
  if (overlayActive()) return;
  undo();
});

document.getElementById("btn-win-new-game").addEventListener("click", () => {
  document.getElementById("win-overlay").classList.add("hidden");
  dealGame();
});

/* ── Visibility change for timer ── */

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    stopTimer();
    saveState();
  } else if (state.firstMove && !state.foundations.every(f => f.length === 13)) {
    startTimer();
  }
});

/* ── Init ── */

if (!loadState()) {
  dealGame();
} else {
  render();
}
