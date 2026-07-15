-- Deal Flow — relational schema
-- Invoice financing / reverse factoring operations ledger.
-- Target engine: SQLite (runs client-side via sql.js in the app).

-- Suppliers approved to finance invoices against.
CREATE TABLE suppliers (
    supplier_id    INTEGER PRIMARY KEY,
    supplier_name  TEXT    NOT NULL,
    industry       TEXT,
    onboarded_date TEXT,             -- ISO date (YYYY-MM-DD)
    credit_rating  TEXT,             -- A / B / C / D
    credit_limit   INTEGER           -- max open exposure allowed, ILS
);

-- Core transaction ledger: one row per financed (or pending) invoice.
CREATE TABLE deals (
    deal_id         INTEGER PRIMARY KEY,
    invoice_number  TEXT    NOT NULL,
    supplier_id     INTEGER NOT NULL REFERENCES suppliers(supplier_id),
    buyer_name      TEXT,
    invoice_amount  REAL,
    currency        TEXT,             -- ILS / USD / EUR
    issue_date      TEXT,
    due_date        TEXT,
    payment_terms   TEXT,             -- Net 30 / Net 60 / Net 90
    advance_rate    REAL,             -- share of invoice advanced (0.80–0.95)
    advance_amount  REAL,             -- cash advanced to the supplier
    fee_amount      REAL,             -- financing fee charged
    deal_type       TEXT,             -- Reverse Factoring / Factoring
    status          TEXT,             -- Initiated / Under Review / Approved /
                                      -- Financed / Repaid / Overdue / Rejected
    financed_date   TEXT,
    repaid_date     TEXT,
    risk_score      INTEGER           -- 1–100, higher = riskier
);

-- Lifecycle audit trail: every status transition of a deal.
CREATE TABLE deal_events (
    event_id    INTEGER PRIMARY KEY,
    deal_id     INTEGER NOT NULL REFERENCES deals(deal_id),
    event_type  TEXT,                 -- Created / Submitted / Reviewed /
                                      -- Approved / Financed / Repaid /
                                      -- Rejected / Flagged
    event_date  TEXT,
    actor       TEXT                  -- system or analyst name
);

CREATE INDEX idx_deals_supplier ON deals(supplier_id);
CREATE INDEX idx_deals_status   ON deals(status);
CREATE INDEX idx_events_deal    ON deal_events(deal_id);
