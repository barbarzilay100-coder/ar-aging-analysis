-- Deal Flow — analytical queries & exception rules
-- These are the exact queries the app runs against the live SQLite database.
-- Split into (A) operational analytics and (B) the exception engine.

-- =====================================================================
-- A. OPERATIONAL ANALYTICS  (feed the dashboard)
-- =====================================================================

-- A1. Portfolio split by status, with financed volume.
SELECT status,
       COUNT(*)                  AS deals,
       ROUND(SUM(advance_amount)) AS financed_ils
FROM deals
GROUP BY status
ORDER BY financed_ils DESC;

-- A2. Monthly financing trend.
SELECT substr(financed_date, 1, 7) AS month,
       COUNT(*)                     AS deals,
       ROUND(SUM(advance_amount))   AS financed_ils
FROM deals
WHERE financed_date IS NOT NULL
GROUP BY month
ORDER BY month;

-- A3. Top suppliers by financed volume (JOIN).
SELECT s.supplier_name,
       s.credit_rating,
       COUNT(*)                      AS deals,
       ROUND(SUM(d.advance_amount))  AS financed_ils
FROM deals d
JOIN suppliers s ON s.supplier_id = d.supplier_id
WHERE d.status IN ('Financed', 'Repaid', 'Overdue')
GROUP BY s.supplier_id
ORDER BY financed_ils DESC
LIMIT 10;

-- A4. Average fee and advance rate by deal type.
SELECT deal_type,
       COUNT(*)                    AS deals,
       ROUND(AVG(fee_amount))      AS avg_fee_ils,
       ROUND(AVG(advance_rate), 3) AS avg_advance_rate
FROM deals
GROUP BY deal_type;

-- A5. Risk exposure buckets.
SELECT CASE WHEN risk_score < 35 THEN 'Low'
            WHEN risk_score < 65 THEN 'Medium'
            ELSE 'High' END        AS risk_band,
       COUNT(*)                    AS deals,
       ROUND(SUM(advance_amount))  AS exposure_ils
FROM deals
GROUP BY risk_band
ORDER BY exposure_ils DESC;

-- =====================================================================
-- B. EXCEPTION ENGINE  (each rule is one query; the app flags every hit)
-- =====================================================================

-- B1. HIGH — Duplicate invoice number (double-financing risk).
SELECT deal_id, invoice_number, supplier_id, advance_amount, issue_date
FROM deals
WHERE invoice_number IN (
    SELECT invoice_number FROM deals GROUP BY invoice_number HAVING COUNT(*) > 1
)
ORDER BY invoice_number;

-- B2. HIGH — Advance exceeds invoice value.
SELECT deal_id, invoice_number, supplier_id, invoice_amount, advance_amount
FROM deals
WHERE advance_amount > invoice_amount;

-- B3. HIGH — Supplier open exposure over its credit limit.
SELECT s.supplier_id, s.supplier_name, s.credit_limit,
       ROUND(SUM(d.advance_amount)) AS exposure
FROM deals d
JOIN suppliers s ON s.supplier_id = d.supplier_id
WHERE d.status IN ('Financed', 'Overdue')
GROUP BY s.supplier_id
HAVING exposure > s.credit_limit
ORDER BY exposure DESC;

-- B4. MEDIUM — Advance amount does not match invoice * advance_rate.
SELECT deal_id, invoice_number, supplier_id, advance_amount,
       ROUND(invoice_amount * advance_rate) AS expected
FROM deals
WHERE ABS(advance_amount - ROUND(invoice_amount * advance_rate)) > 1;

-- B5. MEDIUM — Overdue receivables (financed, past due, unpaid).
SELECT deal_id, invoice_number, supplier_id, advance_amount, due_date, risk_score
FROM deals
WHERE status = 'Overdue'
ORDER BY due_date;

-- B6. MEDIUM — High-risk deals that were financed anyway (score >= 75).
SELECT deal_id, invoice_number, supplier_id, advance_amount, risk_score
FROM deals
WHERE status IN ('Financed', 'Overdue') AND risk_score >= 75
ORDER BY risk_score DESC;

-- B7. LOW — Deals stuck in the pipeline for more than 10 days.
SELECT deal_id, invoice_number, supplier_id, advance_amount, issue_date, status
FROM deals
WHERE status IN ('Initiated', 'Under Review', 'Approved')
  AND julianday('now') - julianday(issue_date) > 10
ORDER BY issue_date;
