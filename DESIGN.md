# Solitaire PWA — Design Specification

## Reference Screenshots

A shared Google Photos album contains screenshots of the solitaire app the end user currently plays. These are the primary design and interaction reference — our app should feel familiar to this user.

**Album:** https://photos.app.goo.gl/CBv4byqRMgmFZ6L3A

This album may be updated with additional screenshots as needed. When new screenshots are added, this section should be updated to describe them.

### Screenshot 1 — Initial Deal

[View full size](https://photos.google.com/share/AF1QipNe-LKQmjsy4-bhoVmaaxWQSmc1r1dteCJCwXgSq7kUR6oQzYYaMe0gVVH9epvPnQ/photo/AF1QipMJDFuoYn76U5D1d53ycf-ykk3g0RahzqRVbHOl?key=cldXQmtFR0FWanZkQkdwZ1BKUGVhak15R1BNNGxB)

A freshly dealt game. Score 0, Time 0:00, Moves 0.

- **Status bar** across the top: Score, Time, and Moves counters on a dark semi-transparent background.
- **Foundation row** (top-left): 4 empty slots, each marked with a large "A" to indicate where aces go. Dark recessed appearance against the green baize.
- **Stock pile** (top-right): A single face-down card with a blue crosshatch back design.
- **Tableau**: 7 columns. Column 1 has 1 face-up card, column 2 has 1 face-down + 1 face-up, and so on up to column 7 with 6 face-down + 1 face-up. Face-down cards show blue backs; face-up cards are white with large, clearly readable values and suit symbols.
- **Green baize background** fills the play area.
- Cards have generous sizing with bold rank numbers and large suit symbols — designed for readability.

### Screenshot 2 — Stock Tapped (Draw-3 Waste Pile)

[View full size](https://photos.google.com/share/AF1QipNe-LKQmjsy4-bhoVmaaxWQSmc1r1dteCJCwXgSq7kUR6oQzYYaMe0gVVH9epvPnQ/photo/AF1QipPPAqnCj9_jh7pHyWoWSllTrPgXPiua09fjGQaN?key=cldXQmtFR0FWanZkQkdwZ1BKUGVhak15R1BNNGxB)

Score 0, Time 0:06, Moves 4. The stock has been tapped.

- **Waste pile** (between foundation and stock): Shows previously drawn cards fanned left-to-right (3, 9, 2 of clubs), with the rightmost being the most recently drawn and playable. This is **draw-1 mode** — one card is drawn from stock per tap, and the waste fans to show recent history.
- The waste pile sits in the same row as the foundation and stock, to the right of the foundation slots.
- Tableau is unchanged from the initial deal — no tableau moves have been made yet.

### Screenshot 3 — Tableau Move

[View full size](https://photos.google.com/share/AF1QipNe-LKQmjsy4-bhoVmaaxWQSmc1r1dteCJCwXgSq7kUR6oQzYYaMe0gVVH9epvPnQ/photo/AF1QipPx6GybD4qpGSORV2C0Hp3v5b7CyfZf4pptFsIm?key=cldXQmtFR0FWanZkQkdwZ1BKUGVhak15R1BNNGxB)

Score 5, Time 0:27, Moves 6. A card has been moved within the tableau.

- **Column 7** now shows Jack of diamonds with 10 of spades stacked below it — demonstrating the alternating-colour, descending-rank stacking rule.
- Cards in a tableau stack overlap vertically so that the rank and suit of each card remain visible.
- Waste pile still shows the same 3 fanned cards (no waste card has been played to tableau).

### Screenshot 4 — Foundation Progress and Card Reveal

[View full size](https://photos.google.com/share/AF1QipNe-LKQmjsy4-bhoVmaaxWQSmc1r1dteCJCwXgSq7kUR6oQzYYaMe0gVVH9epvPnQ/photo/AF1QipPUOhSNwcJoJ2d2R18_zwn3e7c4gr90d8hnIN2N?key=cldXQmtFR0FWanZkQkdwZ1BKUGVhak15R1BNNGxB)

Score 31, Time 0:41, Moves 8. Aces have been moved to the foundation.

- **Foundation slots 1 and 2** now contain the Ace of clubs and Ace of diamonds respectively. Slots 3 and 4 remain empty.
- **Column 6** has revealed a King of hearts — previously hidden under a face-down card that was covering the Ace of diamonds. When a face-up card is moved, the top face-down card flips automatically.
- Score has jumped to 31, reflecting points for foundation moves and card reveals.

---

## Game Overview

**Klondike Solitaire** — the classic single-player card game, commonly known simply as "Solitaire". Our implementation is a progressive web app targeting an elderly user who is already familiar with this game on their tablet.

### Design Principles

1. **Familiarity** — Match the look and feel of the reference app so the user feels immediately at home.
2. **Simplicity** — No ads, no upsells, no distracting UI. Just the game.
3. **Readability** — Large cards, bold ranks, clear suit symbols, high contrast.
4. **Forgiveness** — Undo and hint features to reduce frustration.

### Scope — What We Build

- Standard Klondike solitaire with draw-1 from stock
- 7-column tableau, 4 foundation piles, stock and waste
- Tap-to-move interaction (tap a card, it moves to the best valid destination)
- Drag-and-drop as an alternative interaction
- Status bar: Score, Time, Moves
- **New Game** button — the primary way to start over or play again after winning
- **Hint** button — highlights a valid move
- **Undo** button — reverses the last move
- Win detection and a completion celebration
- Green baize background matching the reference app aesthetic
- Portrait tablet layout

### Scope — What We Omit

- Settings screen (no configurable options needed)
- Daily challenge mode
- Advertisements and ad bar
- Social features, leaderboards, accounts
- Multiple game variants (Spider, FreeCell, etc.)
- Draw-3 mode (we use draw-1 to match the user's preference)

## Layout

The screen is divided into three vertical zones in portrait orientation:

### 1. Status Bar (top)

A dark semi-transparent bar spanning the full width, displaying:
- **Score** (left) — Points accumulated from moves
- **Time** (centre) — Elapsed time since first move
- **Moves** (right) — Total move count

### 2. Play Area (middle, fills available space)

Green baize background. Contains all card areas:

**Top row** (foundation + stock/waste):
- **Foundation** (left side): 4 slots for building up by suit from Ace to King. Empty slots show a recessed "A" marker.
- **Waste pile** (right of foundation): Shows drawn cards fanned to reveal recent history, only the topmost (rightmost) card is playable.
- **Stock pile** (far right): Face-down draw pile. Tap to draw 1 card to the waste. When empty, tap to recycle the waste back into the stock.

**Tableau** (below the top row):
- 7 columns of cards. Face-down cards are stacked tightly; face-up cards cascade downward with enough overlap to show rank and suit.
- Cards stack in alternating colours, descending rank (e.g. black 10 on red Jack).
- Empty columns accept only Kings.

### 3. Action Bar (bottom)

A simple toolbar with three buttons:
- **New Game** — Deals a fresh game (with confirmation if a game is in progress)
- **Hint** — Highlights a valid move if one exists
- **Undo** — Reverses the last move (can be pressed multiple times)

## Interaction

- **Tap a card** — Moves it to the best valid destination (foundation preferred, then tableau).
- **Tap the stock** — Draws 1 card to the waste pile.
- **Tap empty stock** — Recycles the waste pile back to stock.
- **Drag a card or stack** — Drag from one tableau column to another, or to the foundation.
- **Double-tap** — Sends a card directly to the foundation if valid.

## Scoring

Match the reference app's scoring model:
- Move card to foundation: +10 points
- Move card from waste to tableau: +5 points
- Reveal a face-down tableau card: +5 points
- Move card from foundation back to tableau: -15 points
- Recycle waste to stock: -100 points (only after first cycle)

## Win Condition

The game is won when all 52 cards are moved to the four foundation piles (each built Ace through King by suit). On completion, display a celebration animation and prompt to start a new game.
