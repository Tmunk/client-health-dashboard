# Architecture: the original system, and what this rebuild changes

This document exists to keep two things straight: what was actually built at work, and what is different about this public rebuild. Both are worth understanding. The original solved a real problem under real constraints. The rebuild is an attempt to solve the same problem with better engineering practice, on synthetic data, without pretending the original was something it wasn't.

## The original system (built at a B2B SaaS EdTech company)

The scoring model and the data flow below are the real ones.

**Three separate Google Sheets fed the dashboard, each maintained by different people for different reasons:**

1. **Session and new-student data** — one sheet with a tab per client, holding platform session counts and new student counts for the period.
2. **NPS responses** — a separate sheet holding NPS scores reported by clients.
3. **AM sentiment and notes** — a separate sheet where Account Managers recorded their 1-5 relationship rating for each client, an estimated NPS when a client hadn't responded to the survey, and free-text notes about the account.

Scoring formulas lived **in the sheets themselves**, not in application code. The 100-point model, the NPS failsafe (`=IF(ISBLANK(H2), J2, H2*3)`), and the survey-vs-estimate status flag (`=IF(ISBLANK(H2), "⚠️ AM Estimate", "✅ Actual Survey")`) were all spreadsheet formulas.

**Looker Studio** read those sheets as data sources and rendered the dashboard: cross-filtering, conditional color thresholds (green ≥80, yellow 60-79, red <60), and horizontal bar fill-gauges. Because Looker Studio polls its Sheets connector on an interval rather than receiving pushed updates, an AM's note or rating change showed up on the dashboard within minutes of being typed — not instantly, but without anyone re-exporting or re-uploading anything.

**Why it was built this way.** Engineering at a small company was consistently overloaded with higher-priority product work. Building CS-facing reporting was not going to get engineering time. Google Sheets plus Looker Studio required zero deployment, zero engineering involvement, and had authentication and sharing already solved by Google Workspace. For the constraint it was built under, it was the right call — not a lesser version of a "real" system.

**What the original did not have**, stated plainly:

- No abstraction between the dashboard and its data sources. Looker Studio was pointed directly at specific sheets.
- No automated tests. Formula correctness was verified by eyeballing outputs.
- No systematic data validation or reconciliation. When a client name didn't match between sheets, a `VLOOKUP` silently returned the wrong row or no row, and the resulting score was quietly wrong until someone noticed.
- No version control or code review, because there was no code in the usual sense.

## What this rebuild keeps identical

- The **100-point scoring model**: AM Sentiment 30, Platform Sessions 30, NPS 30, New Students 10.
- The **NPS failsafe logic** and the survey-vs-estimate status flag, translated from spreadsheet formula to JavaScript but functionally the same decision.
- The **tier thresholds**: green ≥80, yellow 60-79, red <60.
- The **three-source structure**: sessions/new-students, NPS responses, and AM sentiment/notes remain three independently-maintained sources that get joined, rather than one pre-merged dataset.

## What this rebuild changes, and why

| Change | Reason |
|---|---|
| **Pluggable source adapters** — every source is fetched through one `fetch() → rows` contract, with a Google Sheets (published CSV) implementation and a static offline implementation | The original was hard-wired to specific sheets. Swapping a source to a REST API or database should mean writing one new adapter, not rebuilding the dashboard. This is the layer that makes "coordinating multiple sources" an architectural decision rather than a coincidence. |
| **Schema validation and type coercion** at ingestion | CSV and spreadsheet data arrives as untyped text. Validating and coercing at the boundary means the scoring engine can assume clean input. |
| **Reconciliation and orphan detection** | Directly targets the real failure mode of the original: records that exist in one sheet but not another, silently producing wrong scores. Every mismatch is surfaced in a data quality panel instead of being absorbed into a number nobody questions. |
| **Automated tests** (`tests.html`) covering the scoring formulas and validation rules | The original's formulas were verified by inspection. A silently-wrong health score destroys CS team trust in the tool, which is the one thing a health score cannot survive — that risk deserves tests. |
| **Vanilla HTML/CSS/JS frontend** instead of Looker Studio | Looker Studio can't be cloned from a repo or opened by someone without access to the underlying Google account. A self-contained static site can. |
| **AI insights layer** (single batched Claude API call producing a portfolio summary and per-account notes) | Did not exist in the original at all. This is new work, not a rebuild of anything. |

## Honest summary

The original was a pragmatic, constraint-driven system that worked and was used. This rebuild takes the same scoring logic and the same source structure and puts a properly engineered ingestion layer underneath it — adapters, validation, reconciliation, tests — plus an AI layer the original never had.

The improvements here are real, but they are improvements made with time, hindsight, and no production deadline. They are not a claim that the original should have been built this way under the constraints it actually faced.
