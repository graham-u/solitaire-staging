# Solitaire PWA

A solitaire card game for an elderly UK user, installed as a PWA on a tablet.

## Key Files

- `DESIGN.md` — Full spec, architecture, and **reference screenshots** (Google Photos album of the app the user currently plays — consult before making visual/layout changes)
- `index.html` — App shell
- `style.css` — Layout and styles
- `app.js` — Game logic, card handling, touch interactions
- `sw.js` — Service worker (network-first caching)
- `manifest.json` — PWA manifest
- `tests/` — Automated test suite (see Running Automated Tests below)

## Version Bumping

**Every push that changes user-facing files requires a version bump.** User-facing files are: `app.js`, `style.css`, `index.html`, `sw.js`, `manifest.json`, `icon.svg`. Pushes that only change non-deployed files (`CLAUDE.md`, `DESIGN.md`, `TODO.md`, `tests/`, `.github/`) do not need a bump.

Bump in **two places** simultaneously (in the same commit as the user-facing changes):

1. `index.html` — the `<div id="version">v1</div>` element (user-visible)
2. `sw.js` — the `CACHE_NAME = "solitaire-v1"` constant (triggers cache refresh)

Both must use the same version number. The version number tells the user which build they're running (visible bottom-right corner).

A **pre-push hook** (`.githooks/pre-push`) enforces this — it blocks pushes that change user-facing files without bumping both version locations. After a fresh clone, activate hooks with:

```bash
git config core.hooksPath .githooks
```

## Deployment

There are two deployment targets — **staging** and **production** — both using GitHub Pages. Always deploy to staging first, test, then promote to production.

| Environment | Repo | URL |
|-------------|------|-----|
| Staging | `graham-u/solitaire-staging` | https://graham-u.github.io/solitaire-staging/ |
| Production | `graham-u/solitaire` | https://graham-u.github.io/solitaire/ |

Both repos use the same `main` branch and the same Pages workflow. The staging repo is configured as a git remote called `staging`.

```bash
# 1. Deploy to staging
git push staging main
run_id=$(gh run list --repo graham-u/solitaire-staging --limit 1 --json databaseId -q '.[0].databaseId') && gh run watch "$run_id" --repo graham-u/solitaire-staging --exit-status

# 2. Test on the staging URL, then deploy to production
git push origin main
run_id=$(gh run list --limit 1 --json databaseId -q '.[0].databaseId') && gh run watch "$run_id" --exit-status
```

**Never push directly to production without deploying to staging first.** The production URL is installed as a PWA on the end user's tablet.

## Testing Locally

```bash
python3 -m http.server 8086  # start local server (avoid ports 8080-8081, used by mitmproxy)
```

## Running Automated Tests

**The full test suite must pass before committing and pushing.** If a change is truly trivial (e.g. a comment-only edit), confirm with the user before skipping tests.

Requires local HTTP server running. Start the server as a background task before running tests, and stop it with `TaskStop` afterwards:

```bash
# 1. Start local server (use run_in_background, note the task ID)
python3 -m http.server 8086

# 2. Run full test suite
npx tsx tests/run-all.mjs

# 3. Stop the server using TaskStop with the background task ID
```

Individual test suites can also be run via their export:

| File | Coverage |
|------|----------|
| `tests/game-logic.mjs` | Pure game rules: deck, deal, placement rules |
| `tests/gameplay.mjs` | Integration: stock/waste, scoring, undo, hint, win, persistence |
| `tests/ui.mjs` | Browser: layout, rendering, card elements, interactions, PWA |

## Browser Testing

In addition to the dev-browser test runner, Chrome browser automation (claude-in-chrome) and Chrome DevTools MCP tools are available for interactive testing, visual inspection, and debugging during development.

**Always resize the browser window to portrait tablet dimensions (e.g. 810x1080) immediately after creating/navigating a tab**, before taking any screenshots. The app targets a portrait tablet — desktop-width views are misleading.

## Audience

The target user is an elderly person in the UK. UI should be clear, simple, with large touch targets and high-contrast visuals. Card suits and values must be easy to read. Avoid small text or fiddly interactions.

## Device & Orientation

The app runs as a PWA on a tablet in **portrait mode**. Always test and evaluate layout in portrait orientation.
