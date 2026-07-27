# Client Health Dashboard + AI Summary Layer

A CS Ops account health dashboard: a 100-point scoring model turns raw account signals into a red/yellow/green risk score, and an AI layer turns that score into a plain-English explanation and recommendation for the Account Manager.

## Why this exists

Rebuilt from a real dashboard built at a small B2B SaaS EdTech company, where Account Managers needed a fast way to see which accounts needed attention without digging through raw usage data themselves. Engineering bandwidth was scarce and consistently pulled toward higher-priority product work, so building and maintaining CS-facing reporting tools fell to the CS team — this dashboard, and the Google Sheet + Looker Studio version it's based on, were built to close that gap without needing engineering time.

This version is a from-scratch rebuild on synthetic data (14 fictional tutoring-platform accounts, no real client names or numbers). The scoring formulas below — including the exact NPS failsafe logic — match the real model. The frontend is a new build: the original used Looker Studio wired to a Google Sheet; this one is a self-contained HTML/CSS/JS app so it can be cloned and opened with zero setup, and it adds a layer the original didn't have — an AI-generated summary per account.

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

`data.js` holds the raw synthetic inputs per account; `scoring.js` is the only place that implements the formulas above.

## The AI summary layer

Clicking "Generate AI Summary" on any account sends its score breakdown to Claude and asks for a short, plain-English explanation plus one concrete next action — the kind of write-up an AM would otherwise type by hand before a QBR or a risk review.

Accounts that drop into the red tier also show a **playbook trigger** banner ("schedule a save call within 3 business days"). That trigger is rule-based, fired off the tier alone — not AI-generated — simulating what a real implementation would hand off to an actual workflow tool (Slack alert, Salesforce task, etc).

**On the API key:** this is a static site with no backend, so there's no server-side place to hide a key. The page asks whoever's using it to paste in their own Anthropic API key, which is stored only in that browser's `localStorage` and sent directly to `api.anthropic.com` — never to any third party, never committed to this repo. This is a deliberate, disclosed simplification for a demo: a real product would proxy the call through a backend so the key never touches the browser. Worth being able to explain that tradeoff if asked, rather than presenting client-side key entry as production-ready practice.

## Known limitations

- **Category weights (30/30/30/10)** and the NPS failsafe formula match the real model. The specific per-account benchmarks used to normalize sessions and new-student counts (the "expected" values in `data.js`) are invented for this synthetic dataset, since real account-sizing data isn't something to reproduce here.
- **Playbook trigger is simulated**, not wired to any real messaging or task system — it demonstrates the concept, not a working integration.
- **No AI response caching** — every click makes a fresh API call, so repeated clicks on the same account cost tokens each time.
- **Client-side API key** — see above. Fine for a portfolio demo, not how you'd ship this for real users.

## Running it

No build step. Clone the repo and open `index.html`, or serve the folder locally:

```bash
python -m http.server 8000
```

Then visit `http://localhost:8000`. (Opening `index.html` directly via `file://` also works in a real browser — some sandboxed preview tools handle `file://` script loading inconsistently, which is a tool quirk, not an issue with the app.)

To use the AI summary layer, paste an Anthropic API key into the box at the top of the page.

## Built with

Vanilla HTML, CSS, and JavaScript. No framework, no build step. Uses the Anthropic Claude API directly from the browser.
