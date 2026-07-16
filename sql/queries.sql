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
