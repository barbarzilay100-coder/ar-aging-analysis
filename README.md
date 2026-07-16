# AR Aging Analysis — Accounts Receivable Aging & Collections Console

A browser-based accounts-receivable aging and collections console. It runs a
**real SQLite database in the browser** (via WebAssembly), drives every dashboard
number from **live SQL**, flags collection risks with a **rule-based watchlist
engine**, and uses an **LLM to read invoices** and cross-check them against the
ledger.

Built as a portfolio project to demonstrate SQL, data modelling, BI dashboards,
exception handling, and applied AI on a realistic fintech operations problem.

> **Live demo:** https://barbarzilay100-coder.github.io/ar-aging-analysis/

**Author:** Bar Barzilay — finance student (Israel) ·
[LinkedIn](https://www.linkedin.com/in/bar-barzilay-ba932235b) ·
[GitHub](https://github.com/barbarzilay100-coder) ·
[barbarzilay100@gmail.com](mailto:barbarzilay100@gmail.com)

![Dashboard — live SQL KPIs, trends and receivables aging](docs/dashboard.jpg)

![Collections Watchlist — rule-based risk flags with severity and exposure](docs/watchlist.jpg)

---

## What it does

| Module | What it demonstrates |
|---|---|
| **Dashboard** | KPIs (financed volume, open exposure, overdue, period DSO, avg days to collect, avg advance rate, repayment rate), monthly trend, status split, top customers, exposure by buyer, receivables aging, and the classic **AR aging pivot** — customer × bucket (Current / 1–30 / 31–60 / 61–90 / 90+), sortable, with drill-down to invoices. Each one a live SQL query. |
| **Collections Watchlist** | 7 SQL rules that scan the ledger and flag duplicates, credit-limit breaches, advance mismatches, overdue receivables, high-risk exposure and stuck invoices — with severity and at-risk exposure. |
| **Reconciliation** | Cash receipts matched to invoices in a single SQL LEFT JOIN — every settled invoice classified Matched / Short-paid / Overpaid / Unpaid with its variance, plus an aged view of unapplied cash. The generator plants split remittances, a duplicate payment, short-pays and unknown references for the module to catch. |
| **AI Extract** | Paste an invoice → an LLM extracts structured fields → the app cross-checks them against the database (duplicate invoice, known/new customer, remaining credit room, amount sanity, date integrity) and returns a risk summary. |
| **SQL Console** | A query editor over the live database with a schema browser and preset queries — the SQL behind the dashboard is fully inspectable. |

## Skills demonstrated

| Skill | Where it shows up |
|---|---|
| **Excel** | Formula-driven aging workbook ([`docs/ar-aging-report.xlsx`](docs/ar-aging-report.xlsx)): `SUMIFS` pivot, named ranges, conditional formatting, tie-out check. |
| **Python / pandas** | Independent port of the data generator plus an executed notebook that reproduces every dashboard number and asserts bit-for-bit equality with the JS ledger ([`analysis/`](analysis/)). |
| **SQL** | Every dashboard number is a live SQLite query; the 7 watchlist rules and console presets are documented in [`sql/queries.sql`](sql/queries.sql). |
| **Data modelling** | Relational 3-table ledger (`customers` / `deals` / `deal_events`) with a lifecycle audit trail. |
| **BI dashboards** | KPI cards and trend / status / aging charts, all driven from the database — no hard-coded figures. |
| **Exception handling & reconciliation** | A rule engine flags duplicate invoices, credit-limit breaches, advance mismatches and overdue receivables; the Reconciliation tab matches cash receipts to invoices and ages unapplied cash; AI-extracted fields are reconciled against the ledger. |
| **Accuracy & attention to detail** | Deterministic seeded dataset, headless sanity-test harness ([`tests/sanity.cjs`](tests/sanity.cjs)), escaping of all untrusted text before rendering. |
| **Applied AI** | LLM invoice extraction with ledger cross-check and a graceful offline fallback. |

## Architecture

```
Browser (single static page, no backend)
 ├─ sql.js (SQLite compiled to WebAssembly) ....... the data layer
 │    schema.sql  →  customers / deals / deal_events / payments
 ├─ Chart.js ...................................... dashboard visuals
 ├─ Collections watchlist ......................... queries.sql, section B
 ├─ Payment reconciliation ........................ queries.sql, section C
 ├─ Live FX (open.er-api.com) ..................... USD/EUR → ILS on load
 └─ Anthropic Messages API ........................ invoice field extraction
```

Everything is client-side: no server, no build step. The ledger is generated
deterministically on load (fixed seed); non-ILS invoices are converted to ILS
using the latest published exchange rate, fetched live when the page loads (with a
fixed fallback if the rate service is unavailable).

## Project structure

```
ar-aging-analysis/
├─ index.html        markup + external asset links
├─ assets/
│  ├─ styles.css     all styling
│  └─ app.js         data layer, dashboard, watchlist engine, AI, SQL console
├─ sql/
│  ├─ schema.sql     relational schema
│  └─ queries.sql    analytics queries + collection rules
├─ tests/
│  └─ sanity.cjs     data-generator sanity checks
├─ analysis/
│  ├─ generator.py             Python port of the seeded generator
│  ├─ ar_aging_analysis.ipynb  JS ↔ pandas cross-check notebook
│  ├─ export_snapshot.js       exports the dated ledger snapshot
│  └─ data/                    ledger-snapshot.json
├─ docs/             screenshots + Excel aging report
├─ README.md
└─ LICENSE
```

## Data model

Four related tables (`sql/schema.sql`):

- **customers** — tracked counterparties, credit rating and limit.
- **deals** — the core ledger: one row per invoice, its advance, fee, status and risk (amounts normalised to ILS).
- **deal_events** — lifecycle audit trail (created → submitted → reviewed → financed → repaid).
- **payments** — cash receipts from payers, matched against invoices in the Reconciliation tab (`deal_id IS NULL` = unapplied cash).

**Credit-risk model.** About 70% of the book is reverse factoring, where the party
that ultimately pays is the **buyer** (`bill_to`). Credit limits and exposure are
still tracked against the **supplier** because the portfolio is modelled as a
**recourse** book — if the buyer fails to pay, the advance is recoverable from the
supplier, so supplier risk is retained. The dashboard's "Open exposure by buyer"
chart shows the payer-side concentration that a non-recourse factor would manage
instead.

## Collections rules

All rules live in `sql/queries.sql` (section B). Summary:

| # | Rule | Severity |
|---|---|---|
| B1 | Duplicate invoice number, same customer | High |
| B2 | Advance exceeds invoice value | High |
| B3 | Customer exposure over credit limit | High |
| B4 | Advance ≠ invoice × advance rate | Medium |
| B5 | Overdue receivable | Medium |
| B6 | High-risk invoice financed (score ≥ 75) | Medium |
| B7 | Invoice stuck in pipeline > 10 days | Low |

## Run locally

It's a single static page — just open it:

```bash
# any static server works; for example:
python3 -m http.server 8000
# then visit http://localhost:8000
```

Or open `index.html` directly in a browser.

## Tests

`tests/sanity.cjs` evaluates the data generator headlessly and asserts the
invariants of the synthetic ledger — row counts, referential integrity, date
consistency, the deliberately planted data-quality issues, and determinism:

```bash
node tests/sanity.cjs
```

(No Node? On macOS the same file runs under the built-in JavaScriptCore shell —
see the header of the file.)

## Excel deliverable

[`docs/ar-aging-report.xlsx`](docs/ar-aging-report.xlsx) — the customer × bucket
aging pivot as a formula-driven Excel workbook: an invoice-level data sheet plus a
report sheet where every cell is a live `SUMIFS`, an editable `AsOfDate` named cell
that re-ages the whole book, conditional formatting on the overdue buckets, and a
tie-out check against the invoice sheet. It is a dated snapshot by design — the
app's ledger regenerates relative to today, and an aging report is a point-in-time
cut.

## Python / pandas cross-check

[`analysis/ar_aging_analysis.ipynb`](analysis/ar_aging_analysis.ipynb) reconciles the
JavaScript ledger against an **independent Python implementation**:
[`analysis/generator.py`](analysis/generator.py) re-implements the seeded generator from
scratch (same mulberry32 seed and draw order, JS rounding semantics), and the executed
notebook asserts it reproduces the exported snapshot
([`analysis/data/ledger-snapshot.json`](analysis/data/ledger-snapshot.json))
**bit-for-bit** — then rebuilds every dashboard KPI, the aging pivot and the
payment-reconciliation summary in pandas. Two implementations, one book: the
cross-check is itself a reconciliation exercise.

## Deploy (GitHub Pages)

```bash
git init
git add .
git commit -m "AR Aging Analysis — accounts receivable aging console"
git branch -M main
git remote add origin https://github.com/<you>/ar-aging-analysis.git
git push -u origin main
```

Then in the repo: **Settings → Pages → Source: `main` / root**. The live URL
appears within a minute.

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

`sql.js` (SQLite/WASM) · `Chart.js` · vanilla JS/HTML/CSS · live FX (open.er-api.com) · Anthropic Messages API

## Notes on the data

The dataset is **synthetic** — 30 customers and 180 invoices generated from a fixed
seed to model a realistic receivables book (including deliberate data-quality issues
for the watchlist to catch). All dates are generated **relative to today**, so the
ledger always looks current. The structure of the book is deterministic (same seed,
same customers/invoices/statuses); ILS amounts of non-ILS invoices are converted at
the latest published FX rate, so those figures move slightly with the market. No real
customer data is used.

## License

MIT — see `LICENSE`.
