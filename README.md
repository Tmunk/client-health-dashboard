# Client Health Dashboard + AI Summary Layer

A CS Ops account health dashboard: a 100-point scoring model turns raw account signals into a red/yellow/green risk score, and an AI layer turns that score into a plain-English explanation and recommendation for the Account Manager.

## Why this exists

Rebuilt from a real dashboard built at a small B2B SaaS EdTech company, where Account Managers needed a fast way to see which accounts needed attention without digging through raw usage data themselves. Engineering bandwidth was scarce and consistently pulled toward higher-priority product work, so building and maintaining CS-facing reporting tools fell to the CS team — this dashboard, and the Google Sheet + Looker Studio version it's based on, were built to close that gap without needing engineering time.

This version is a from-scratch rebuild on synthetic data (14 fictional tutoring-platform accounts, no real client names or numbers). The scoring formulas below — including the exact NPS failsafe logic — match the real model, and so does the underlying data shape: three independently-maintained sources (session/new-student data, client-reported NPS, and AM sentiment + notes) that get joined together, the same way three separate Google Sheets fed one Looker Studio report in the original. **See [`ARCHITECTURE.md`](ARCHITECTURE.md) for the full comparison** — what's identical, what changed, and why, including what the original deliberately didn't have (no source abstraction, no validation, no tests).

## The scoring model

100 points total, split across four categories:

| Category | Points | Formula |
|---|---|---|
| AM Sentiment | 30 | `(rating / 5) * 30` — AM's 1–5 relationship rating |
| Platform Sessions | 30 | `(actual sessions / expected sessions) * 30`, capped at 30 |
| NPS | 30 | see failsafe below |
| New Students | 10 | `(actual new students / target) * 10`, capped at 10 |

**NPS failsafe** — real survey responses aren't guaranteed every period, so the score falls back to the AM's own estimate when one's missing:

```
=IF(ISBLANK(H2), J2, H2 * 3)
```

`H2` is a real 0–10 survey response for the period (×3 puts it on the same 0–30 scale as everything else). `J2` is the AM's own estimate, already expressed 0–30. A status flag makes it obvious which one drove the score:

```
=IF(ISBLANK(H2), "⚠️ AM Estimate", "✅ Actual Survey")
```

Tiers: **green ≥ 80, yellow 60–79, red < 60.**

`scoring.js` is the only place that implements the formulas above — it receives already-joined client records and doesn't know or care where they came from.

## Where the data comes from

Three independent sources, matching the three real Google Sheets described in `ARCHITECTURE.md`:

| Source | Fallback fixture | Real columns |
|---|---|---|
| Sessions & new students (master client list) | `fallback-data.js` → `FALLBACK_SESSIONS_ROWS` | client_id, client_name, segment, account_owner, actual/expected sessions, actual/target new students, previous_total_score |
| NPS responses | `FALLBACK_NPS_ROWS` | client_id, nps_survey_score |
| AM sentiment & notes | `FALLBACK_AM_SENTIMENT_ROWS` | client_id, am_sentiment_rating, am_nps_estimate_points, notes |

**`adapters.js`** defines one contract — `{ key, label, async load() }` — with two implementations: a static adapter (reads the fallback fixtures) and a Google Sheets adapter (fetches a published-to-web CSV URL). Which one runs per source is decided by whether a URL is set in `config.js`. Adding a REST API or database as a source later means writing a third adapter with the same shape, not touching the pipeline.

**`pipeline.js`** runs the three sources through: schema validation and type coercion (spreadsheet data arrives as untyped text), a join by client ID with the sessions source as the master list, and reconciliation — records that reference a client ID the master list doesn't recognize, or a client missing from a source entirely, get surfaced as data quality issues rather than silently producing a wrong score. The bundled fixtures include two deliberately: an NPS response for a client that isn't in the master list, and a client with no AM sentiment record at all (which means 60 of the 100 points are unknown, so that client is excluded from scoring rather than shown with a fabricated number).

The **Data Sources panel** at the top of the dashboard shows each source's live/fallback status, row count, and last-fetched time, plus every data quality issue found, expandable on click.

**To connect real Google Sheets:** see the comment at the top of `config.js` for the publish-to-web steps and the exact column names each source expects.

## The AI insights layer

"Generate AI Insights" is a single API call, not one call per account. It sends all 14 accounts' score breakdowns to Claude in one request and asks for structured JSON back: a 2-3 sentence portfolio-level takeaway (rendered as a banner at the top) plus a one-line note per account (dropped into that account's card). Earlier versions of this had a "Generate AI Summary" button on every card — one API call each — which meant 14 near-identical buttons and up to 14 calls to look at the whole portfolio. Batching into one call is cheaper, faster, and removes the repetition.

Accounts that drop into the red tier also show a **playbook trigger** banner ("schedule a save call within 3 business days"). That trigger is rule-based, fired off the tier alone — not AI-generated — simulating what a real implementation would hand off to an actual workflow tool (Slack alert, Salesforce task, etc). It's always visible for red accounts, no AI call required.

Every card also shows a **primary driver line** (e.g. "NPS is dragging the score down; new student growth is strong") — also rule-based, computed from which scoring category is furthest below its max. It's free and instant, and gives every card genuinely distinct content even before the AI insights are generated.

**Example output, no key required:** since asking every visitor to bring their own API key is real friction, the page loads with a pre-written example already filled in (tagged `EXAMPLE` on the banner and on every card) so anyone can see what the feature produces without doing anything. That example was written by hand against the real computed scores, in the same format the live prompt requests — not literally captured from an API response — see `EXAMPLE_INSIGHTS` in `ai-summary.js`. Clicking "Generate AI Insights" with a real key replaces it with a fresh, genuinely live result.

**On the API key:** this is a static site with no backend, so there's no server-side place to hide a key. The page asks whoever's using it to paste in their own Anthropic API key, which is stored only in that browser's `localStorage` and sent directly to `api.anthropic.com` — never to any third party, never committed to this repo. This is a deliberate, disclosed simplification for a demo: a real product would proxy the call through a backend so the key never touches the browser. Worth being able to explain that tradeoff if asked, rather than presenting client-side key entry as production-ready practice.

## Known limitations

- **No live Sheets connected by default.** `config.js` ships with all three `csvUrl` fields empty, so the dashboard runs entirely on the bundled fallback fixtures out of the box. Connecting real sheets is one edit away (see `config.js`), but isn't required to clone and run this.
- **"Live" means polled, not pushed.** A published Google Sheet CSV is cached by Google for a few minutes, so an edit shows up on next fetch/refresh, not instantly. That's an accurate match to the original's behavior, not a compromise — Looker Studio's Sheets connector worked the same way.
- **Category weights (30/30/30/10)** and the NPS failsafe formula match the real model. The specific per-account benchmarks used to normalize sessions and new-student counts (the "expected" values in the sessions source) are invented for this synthetic dataset, since real account-sizing data isn't something to reproduce here.
- **Playbook trigger is simulated**, not wired to any real messaging or task system — it demonstrates the concept, not a working integration.
- **No AI response caching** — every click on "Generate AI Insights" makes a fresh API call for the whole portfolio.
- **Client-side API key** — see above. Fine for a portfolio demo, not how you'd ship this for real users.

## Running it

No build step. Clone the repo and open `index.html`, or serve the folder locally:

```bash
python -m http.server 8000
```

Then visit `http://localhost:8000`. (Opening `index.html` directly via `file://` also works in a real browser — some sandboxed preview tools handle `file://` script loading inconsistently, which is a tool quirk, not an issue with the app.)

To use the AI insights layer, paste an Anthropic API key into the box at the top of the page.

## Built with

Vanilla HTML, CSS, and JavaScript. No framework, no build step. Uses the Anthropic Claude API directly from the browser.
