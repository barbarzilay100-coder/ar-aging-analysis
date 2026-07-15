# Deal Flow — Invoice Financing Operations Console

A browser-based operations console for an invoice-financing / reverse-factoring
desk. It runs a **real SQLite database in the browser** (via WebAssembly), drives
every dashboard number from **live SQL**, flags operational risks with a
**rule-based exception engine**, and uses an **LLM to read invoices** and
cross-check them against the ledger.

Built as a portfolio project to demonstrate SQL, data modelling, BI dashboards,
exception handling, and applied AI on a realistic fintech operations problem.

> **Live demo:** _add your GitHub Pages URL here after deploying (see below)._

---

## What it does

| Module | What it demonstrates |
|---|---|
| **Dashboard** | KPIs (financed volume, open exposure, overdue, repayment rate), monthly trend, status split, top suppliers, receivables aging — each one a live SQL query. |
| **Exception engine** | 7 SQL rules that scan the ledger and flag duplicates, credit-limit breaches, advance mismatches, overdue receivables, high-risk exposure and stuck deals — with severity and value-at-risk. |
| **AI Extract** | Paste an invoice → an LLM extracts structured fields → the app cross-checks them against the database (duplicate invoice, known/new supplier, remaining credit room, amount sanity, date integrity) and returns a risk summary. |
| **SQL Console** | A query editor over the live database with a schema browser and preset queries — the SQL behind the dashboard is fully inspectable. |

## Architecture

```
Browser (single static page, no backend)
 ├─ sql.js (SQLite compiled to WebAssembly) ....... the data layer
 │    schema.sql  →  suppliers / deals / deal_events
 ├─ Chart.js ...................................... dashboard visuals
 ├─ Exception engine .............................. queries.sql, section B
 └─ Anthropic Messages API ........................ invoice field extraction
```

Everything is client-side: no server, no build step. The database is generated
deterministically on load (fixed seed), so the numbers are stable across reloads.

## Project structure

```
deal-flow/
├─ index.html        markup + external asset links
├─ styles.css        all styling
├─ app.js            data layer, dashboard, exception engine, AI, SQL console
├─ sql/
│  ├─ schema.sql     relational schema
│  └─ queries.sql    analytics queries + exception rules
├─ docs/             screenshots
├─ README.md
└─ LICENSE
```

## Data model

Three related tables (`sql/schema.sql`):

- **suppliers** — approved counterparties, credit rating and limit.
- **deals** — the core ledger: one row per invoice, its advance, fee, status and risk.
- **deal_events** — lifecycle audit trail (created → submitted → reviewed → financed → repaid).

## Exception rules

All rules live in `sql/queries.sql` (section B). Summary:

| # | Rule | Severity |
|---|---|---|
| B1 | Duplicate invoice number | High |
| B2 | Advance exceeds invoice value | High |
| B3 | Supplier exposure over credit limit | High |
| B4 | Advance ≠ invoice × advance rate | Medium |
| B5 | Overdue receivable | Medium |
| B6 | High-risk deal financed (score ≥ 75) | Medium |
| B7 | Deal stuck in pipeline > 10 days | Low |

## Run locally

It's a single static page — just open it:

```bash
# any static server works; for example:
python3 -m http.server 8000
# then visit http://localhost:8000
```

Or open `index.html` directly in a browser.

## Deploy (GitHub Pages)

```bash
git init
git add .
git commit -m "Deal Flow — invoice financing operations console"
git branch -M main
git remote add origin https://github.com/<you>/deal-flow.git
git push -u origin main
```

Then in the repo: **Settings → Pages → Source: `main` / root**. The live URL
appears within a minute — paste it at the top of this README.

## AI extraction setup

- **Inside the Claude runtime**, the extraction call is handled for you — no key needed.
- **Self-hosted** (GitHub Pages), paste your own Anthropic API key into the field on
  the AI Extract tab. It's held in memory only — never stored, never committed.
- With no key and outside Claude, the app falls back to a local heuristic parser so
  the cross-check still demonstrates.

> Security note: a client-side page can't hide an API key. The key field is for
> local/demo use with your own key. For production you'd proxy the call through a
> small backend so the key stays server-side.

## Tech stack

`sql.js` (SQLite/WASM) · `Chart.js` · vanilla JS/HTML/CSS · Anthropic Messages API

## Notes on the data

The dataset is **synthetic** — 30 suppliers and 180 deals generated from a fixed
seed to model a realistic invoice-financing book (including deliberate data-quality
issues for the exception engine to catch). No real customer data is used.

## License

MIT — see `LICENSE`.
