-- AR Aging Analysis — relational schema
-- Accounts-receivable aging / collections ledger.
-- Target engine: SQLite (runs client-side via sql.js in the app).

-- Customers whose receivables are tracked and aged.
CREATE TABLE customers (
    customer_id    INTEGER PRIMARY KEY,
    customer_name  TEXT    NOT NULL,
    industry       TEXT,
    onboarded_date TEXT,             -- ISO date (YYYY-MM-DD)
    credit_rating  TEXT,             -- A / B / C / D
    credit_limit   INTEGER           -- max open exposure allowed, ILS
);

-- Core transaction ledger: one row per financed (or pending) invoice.
CREATE TABLE deals (
    deal_id         INTEGER PRIMARY KEY,
    invoice_number  TEXT    NOT NULL,
    customer_id     INTEGER NOT NULL REFERENCES customers(customer_id),
    bill_to         TEXT,
    invoice_amount  REAL,             -- normalised to ILS
    currency        TEXT,             -- original currency: ILS / USD / EUR
    issue_date      TEXT,
    due_date        TEXT,
    payment_terms   TEXT,             -- Net 30 / Net 60 / Net 90
    advance_rate    REAL,             -- share of invoice advanced (0.80-0.95)
    advance_amount  REAL,             -- cash advanced to the customer, ILS
    fee_amount      REAL,             -- financing fee charged
    deal_type       TEXT,             -- Reverse Factoring / Factoring
    status          TEXT,             -- Initiated / Under Review / Approved /
                                      -- Financed / Repaid / Overdue / Rejected
    financed_date   TEXT,
    repaid_date     TEXT,
    risk_score      INTEGER           -- 1-100, higher = riskier
);

-- Lifecycle audit trail: every status transition of an invoice.
CREATE TABLE deal_events (
    event_id    INTEGER PRIMARY KEY,
    deal_id     INTEGER NOT NULL REFERENCES deals(deal_id),
    event_type  TEXT,                 -- Created / Submitted / Reviewed /
                                      -- Approved / Financed / Repaid /
                                      -- Rejected / Flagged
    event_date  TEXT,
    actor       TEXT                  -- system or analyst name
);

-- Cash receipts from payers, matched against invoices in the reconciliation
-- module. deal_id is NULL when the remittance reference matches no invoice
-- (unapplied cash).
CREATE TABLE payments (
    payment_id    INTEGER PRIMARY KEY,
    deal_id       INTEGER REFERENCES deals(deal_id),  -- NULL = unapplied cash
    payer         TEXT,              -- paying party (buyer / bill_to)
    reference     TEXT,              -- invoice number as written on the remittance
    amount        REAL,              -- ILS
    received_date TEXT
);

CREATE INDEX idx_deals_customer ON deals(customer_id);
CREATE INDEX idx_deals_status   ON deals(status);
CREATE INDEX idx_events_deal    ON deal_events(deal_id);
CREATE INDEX idx_payments_deal  ON payments(deal_id);
