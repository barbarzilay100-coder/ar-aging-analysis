-- AR Aging Analysis — analytical queries & collection rules
-- These are the exact queries the app runs against the live SQLite database.
-- Split into (A) operational analytics and (B) the collections watchlist engine.

-- =====================================================================
-- A. OPERATIONAL ANALYTICS  (feed the dashboard)
-- =====================================================================

-- A1. Portfolio split by status, with financed volume.
SELECT status,
       COUNT(*)                   AS invoices,
       ROUND(SUM(advance_amount)) AS financed_ils
FROM deals
GROUP BY status
ORDER BY financed_ils DESC;

-- A2. Monthly financing trend.
SELECT substr(financed_date, 1, 7) AS month,
       COUNT(*)                     AS invoices,
       ROUND(SUM(advance_amount))   AS financed_ils
FROM deals
WHERE financed_date IS NOT NULL
GROUP BY month
ORDER BY month;

-- A3. Top customers by financed volume (JOIN).
SELECT c.customer_name,
       c.credit_rating,
       COUNT(*)                      AS invoices,
       ROUND(SUM(d.advance_amount))  AS financed_ils
FROM deals d
JOIN customers c ON c.customer_id = d.customer_id
WHERE d.status IN ('Financed', 'Repaid', 'Overdue')
GROUP BY c.customer_id
ORDER BY financed_ils DESC
LIMIT 10;

-- A4. Average fee and advance rate by deal type.
SELECT deal_type,
       COUNT(*)                    AS invoices,
       ROUND(AVG(fee_amount))      AS avg_fee_ils,
       ROUND(AVG(advance_rate), 3) AS avg_advance_rate
FROM deals
GROUP BY deal_type;

-- A5. Average days to collect (per-invoice: issue -> repayment, or today if open).
SELECT ROUND(AVG(julianday(COALESCE(repaid_date, date('now'))) - julianday(issue_date))) AS avg_days_to_collect
FROM deals
WHERE status IN ('Financed', 'Overdue', 'Repaid');

-- A6. DSO, standard simple-period formula:
--     gross open receivables / invoiced volume of the trailing 90 days * 90.
SELECT ROUND(
         (SELECT SUM(invoice_amount) FROM deals WHERE status IN ('Financed', 'Overdue'))
         * 90.0
         / NULLIF((SELECT SUM(invoice_amount) FROM deals
                   WHERE issue_date >= date('now', '-90 day')), 0)
       ) AS dso_90d;

-- A7. Risk exposure buckets.
SELECT CASE WHEN risk_score < 35 THEN 'Low'
            WHEN risk_score < 65 THEN 'Medium'
            ELSE 'High' END        AS risk_band,
       COUNT(*)                    AS invoices,
       ROUND(SUM(advance_amount))  AS exposure_ils
FROM deals
GROUP BY risk_band
ORDER BY exposure_ils DESC;

-- A8. Running exposure per customer (window function): each financed invoice
--     with the customer's cumulative outstanding advance up to that point.
SELECT c.customer_name,
       d.issue_date,
       ROUND(d.advance_amount) AS advance_ils,
       ROUND(SUM(d.advance_amount) OVER (PARTITION BY d.customer_id
             ORDER BY d.issue_date, d.deal_id)) AS running_exposure_ils
FROM deals d
JOIN customers c ON c.customer_id = d.customer_id
WHERE d.status IN ('Financed', 'Overdue')
ORDER BY c.customer_name, d.issue_date;

-- A9. Overdue receivables ranked by outstanding advance (window function).
SELECT RANK() OVER (ORDER BY d.advance_amount DESC) AS rank,
       d.invoice_number,
       c.customer_name,
       d.due_date,
       CAST(julianday('now') - julianday(d.due_date) AS INT) AS days_overdue,
       ROUND(d.advance_amount) AS advance_ils
FROM deals d
JOIN customers c ON c.customer_id = d.customer_id
WHERE d.status = 'Overdue'
ORDER BY rank;

-- A10. Repayment-rate cohorts by issue month (CTE): of the invoices that have
--      reached an outcome (Repaid or Overdue), what share was repaid?
WITH settled AS (
    SELECT substr(issue_date, 1, 7) AS issue_month,
           CASE WHEN status = 'Repaid' THEN 1 ELSE 0 END AS repaid
    FROM deals
    WHERE status IN ('Repaid', 'Overdue')
)
SELECT issue_month,
       COUNT(*)                 AS settled_invoices,
       SUM(repaid)              AS repaid_invoices,
       ROUND(AVG(repaid) * 100) AS repayment_rate_pct
FROM settled
GROUP BY issue_month
ORDER BY issue_month;

-- A11. AR aging pivot — the classic aging report: one row per customer, open
--      exposure split into Current / 1-30 / 31-60 / 61-90 / 90+ days overdue,
--      built as a conditional-aggregation (SUM CASE) pivot.
SELECT c.customer_name,
       ROUND(SUM(CASE WHEN julianday(date('now')) - julianday(d.due_date) <= 0
                      THEN d.advance_amount ELSE 0 END)) AS current_ils,
       ROUND(SUM(CASE WHEN julianday(date('now')) - julianday(d.due_date) BETWEEN 1 AND 30
                      THEN d.advance_amount ELSE 0 END)) AS overdue_1_30,
       ROUND(SUM(CASE WHEN julianday(date('now')) - julianday(d.due_date) BETWEEN 31 AND 60
                      THEN d.advance_amount ELSE 0 END)) AS overdue_31_60,
       ROUND(SUM(CASE WHEN julianday(date('now')) - julianday(d.due_date) BETWEEN 61 AND 90
                      THEN d.advance_amount ELSE 0 END)) AS overdue_61_90,
       ROUND(SUM(CASE WHEN julianday(date('now')) - julianday(d.due_date) > 90
                      THEN d.advance_amount ELSE 0 END)) AS overdue_90_plus,
       ROUND(SUM(d.advance_amount)) AS total_ils
FROM deals d
JOIN customers c ON c.customer_id = d.customer_id
WHERE d.status IN ('Financed', 'Overdue')
GROUP BY d.customer_id
ORDER BY total_ils DESC;

-- A12. Open exposure by buyer (bill_to). In reverse factoring the payer is the
--      buyer, so payment risk concentrates on bill_to; limits in this demo still
--      track the supplier because the book is modelled as recourse (supplier
--      risk retained). This view shows the payer-side concentration.
SELECT bill_to AS buyer,
       COUNT(*) AS invoices,
       ROUND(SUM(advance_amount)) AS open_exposure_ils,
       ROUND(SUM(CASE WHEN deal_type = 'Reverse Factoring'
                      THEN advance_amount ELSE 0 END)) AS reverse_factoring_ils
FROM deals
WHERE status IN ('Financed', 'Overdue')
GROUP BY bill_to
ORDER BY open_exposure_ils DESC;

-- =====================================================================
-- B. COLLECTIONS WATCHLIST  (each rule is one query; the app flags every hit)
-- =====================================================================

-- B1. HIGH — Duplicate invoice number for the same customer (double-financing risk).
--     Scoped to (customer_id, invoice_number): invoice numbers are only unique per
--     supplier, so two suppliers can both legitimately issue INV-2026-0001.
SELECT d.deal_id, d.invoice_number, d.customer_id, d.advance_amount, d.issue_date
FROM deals d
WHERE EXISTS (
    SELECT 1 FROM deals e
    WHERE e.customer_id = d.customer_id
      AND e.invoice_number = d.invoice_number
      AND e.deal_id <> d.deal_id
)
ORDER BY d.invoice_number;

-- B2. HIGH — Advance exceeds invoice value.
SELECT deal_id, invoice_number, customer_id, invoice_amount, advance_amount
FROM deals
WHERE advance_amount > invoice_amount;

-- B3. HIGH — Customer open exposure over its credit limit.
SELECT c.customer_id, c.customer_name, c.credit_limit,
       ROUND(SUM(d.advance_amount)) AS exposure
FROM deals d
JOIN customers c ON c.customer_id = d.customer_id
WHERE d.status IN ('Financed', 'Overdue')
GROUP BY c.customer_id
HAVING exposure > c.credit_limit
ORDER BY exposure DESC;

-- B4. MEDIUM — Advance amount does not match invoice * advance_rate.
SELECT deal_id, invoice_number, customer_id, advance_amount,
       ROUND(invoice_amount * advance_rate) AS expected
FROM deals
WHERE ABS(advance_amount - ROUND(invoice_amount * advance_rate)) > 1;

-- B5. MEDIUM — Overdue receivables (financed, past due, unpaid).
SELECT deal_id, invoice_number, customer_id, advance_amount, due_date, risk_score
FROM deals
WHERE status = 'Overdue'
ORDER BY due_date;

-- B6. MEDIUM — High-risk invoices that were financed anyway (score >= 75).
SELECT deal_id, invoice_number, customer_id, advance_amount, risk_score
FROM deals
WHERE status IN ('Financed', 'Overdue') AND risk_score >= 75
ORDER BY risk_score DESC;

-- B7. LOW — Invoices stuck in the pipeline for more than 10 days.
SELECT deal_id, invoice_number, customer_id, advance_amount, issue_date, status
FROM deals
WHERE status IN ('Initiated', 'Under Review', 'Approved')
  AND julianday('now') - julianday(issue_date) > 10
ORDER BY issue_date;

-- =====================================================================
-- C. PAYMENT RECONCILIATION  (cash receipts matched against invoices)
-- =====================================================================

-- C1. Match status per settled invoice (Repaid & Overdue book): one LEFT JOIN
--     groups every receipt against its invoice. Matched = payments sum to the
--     invoice amount (+-1 ILS rounding); Short-paid below; Overpaid above
--     (includes duplicate remittances); Unpaid = overdue with no cash.
SELECT d.deal_id,
       d.invoice_number,
       d.status,
       ROUND(d.invoice_amount)                            AS invoice_ils,
       ROUND(COALESCE(SUM(p.amount), 0))                  AS paid_ils,
       ROUND(COALESCE(SUM(p.amount), 0) - d.invoice_amount) AS variance_ils,
       COUNT(p.payment_id)                                AS payments,
       CASE WHEN COUNT(p.payment_id) = 0                          THEN 'Unpaid'
            WHEN ABS(SUM(p.amount) - d.invoice_amount) <= 1       THEN 'Matched'
            WHEN SUM(p.amount) < d.invoice_amount                 THEN 'Short-paid'
            ELSE 'Overpaid' END                            AS match_status
FROM deals d
LEFT JOIN payments p ON p.deal_id = d.deal_id
WHERE d.status IN ('Repaid', 'Overdue')
GROUP BY d.deal_id
ORDER BY (match_status = 'Matched'),
         ABS(COALESCE(SUM(p.amount), 0) - d.invoice_amount) DESC;

-- C2. Unapplied cash, aged from receipt date — remittances whose reference
--     matches no invoice in the ledger.
SELECT payment_id,
       reference,
       payer,
       ROUND(amount)                                              AS amount_ils,
       received_date,
       CAST(julianday(date('now')) - julianday(received_date) AS INT) AS days_unapplied,
       CASE WHEN julianday(date('now')) - julianday(received_date) <= 30 THEN '0-30'
            WHEN julianday(date('now')) - julianday(received_date) <= 60 THEN '31-60'
            WHEN julianday(date('now')) - julianday(received_date) <= 90 THEN '61-90'
            ELSE '90+' END                                         AS age_bucket
FROM payments
WHERE deal_id IS NULL
ORDER BY days_unapplied DESC;

-- C3. Exceptions only — invoices whose cash does not tie to the invoice amount.
SELECT d.invoice_number,
       d.status,
       ROUND(d.invoice_amount)                              AS invoice_ils,
       ROUND(SUM(p.amount))                                 AS paid_ils,
       ROUND(SUM(p.amount) - d.invoice_amount)              AS variance_ils
FROM deals d
JOIN payments p ON p.deal_id = d.deal_id
GROUP BY d.deal_id
HAVING ABS(SUM(p.amount) - d.invoice_amount) > 1
ORDER BY ABS(SUM(p.amount) - d.invoice_amount) DESC;
