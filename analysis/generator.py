"""Python port of the seeded data generator in app.js.

An independent re-implementation of the exact same mulberry32 RNG and draw
sequence: given the same as-of date it must reproduce the JavaScript ledger
bit-for-bit (customers, deals, payments). The companion notebook asserts that
equality against a committed snapshot exported from the JS side — a
reconciliation of two independent implementations of one specification.

Amounts use the app's fallback FX rates (the live site fetches live rates on
load, which only scales non-ILS amounts; every date, status and count is
identical).
"""
from datetime import date, timedelta
from math import exp, floor

SEED = 20260715
FX = {"ILS": 1, "USD": 3.00, "EUR": 3.45}  # fallback rates, as in app.js

GEO = ["Galil", "Carmel", "Negev", "Sharon", "Yarden", "Ayalon", "Tavor", "Arava", "Golan",
       "Kinneret", "Shomron", "Emek", "Ramon", "Lachish", "Bashan", "Modiin", "Yizrael"]
SUF = ["Logistics", "Steel", "Foods", "Textiles", "Trading", "Industries", "Import", "Agro",
       "Systems", "Packaging", "Materials", "Distribution", "Print", "Plastics", "Motors",
       "Electric", "Marble"]
INDUSTRIES = ["Construction", "Food & Beverage", "Logistics", "Manufacturing", "Textiles",
              "Agriculture", "Import/Export", "Retail", "Electronics", "Chemicals"]
BUYERS = ["MegaMart Retail Group", "FreshLine Foods", "BuildCorp Holdings", "MetroGrid Utilities",
          "PharmaPlus Distribution", "TechNova Systems", "UrbanBuild", "GreenField Agro",
          "PrimeLogistics", "Coastal Distribution", "Northgate Retail", "Solaris Energy",
          "BlueHarbor Trading", "Vertex Manufacturing", "CityLine Markets"]
ANALYSTS = ["system", "R. Cohen", "M. Levi", "D. Azoulay", "N. Friedman", "T. Bar"]

M32 = 0xFFFFFFFF


def _imul(x, y):
    """JS Math.imul: 32-bit integer multiply."""
    return ((x & M32) * (y & M32)) & M32


def mulberry32(a):
    a &= M32

    def rand():
        nonlocal a
        a = (a + 0x6D2B79F5) & M32
        t = _imul(a ^ (a >> 15), a | 1)
        t = ((t + _imul(t ^ (t >> 7), t | 61)) & M32) ^ t
        return ((t ^ (t >> 14)) & M32) / 4294967296

    return rand


def js_round(x):
    """JS Math.round: half away from zero -> half toward +inf."""
    return floor(x + 0.5)


def generate(as_of: date):
    """Replicates generateData() from app.js for the given TODAY."""
    rand = mulberry32(SEED)
    pick = lambda a: a[floor(rand() * len(a))]
    ri = lambda lo, hi: floor(rand() * (hi - lo + 1)) + lo
    rf = lambda lo, hi: rand() * (hi - lo) + lo

    def pick_w(items):
        tot = sum(w for _, w in items)
        r = rand() * tot
        for v, w in items:
            if r < w:
                return v
            r -= w
        return items[0][0]

    fmt = lambda d: d.isoformat()
    add = lambda d, n: d + timedelta(days=n)

    customers, deals, events, payments = [], [], [], []

    used = set()
    for i in range(1, 31):
        while True:
            name = f"{pick(GEO)} {pick(SUF)} Ltd"
            if name not in used:
                break
        used.add(name)
        rating = pick_w([("A", 25), ("B", 40), ("C", 25), ("D", 10)])
        limit_base = {"A": 2500000, "B": 1500000, "C": 800000, "D": 400000}[rating]
        customers.append({
            "customer_id": i, "customer_name": name, "industry": pick(INDUSTRIES),
            "onboarded_date": fmt(add(as_of, ri(0, 900) - 1140)), "credit_rating": rating,
            "credit_limit": js_round(limit_base * rf(0.7, 1.3) / 10000) * 10000,
        })

    ev_id = 1
    for i in range(1, 181):
        sup = pick(customers)
        dup_of = None
        if i % 47 == 0 and deals:
            dup_of = deals[0]
            sup = next(c for c in customers if c["customer_id"] == dup_of["customer_id"])
        inv_amt = js_round(exp(rf(9.6, 13.4)) / 100) * 100
        currency = pick_w([("ILS", 84), ("USD", 11), ("EUR", 5)])
        inv_amt = js_round(inv_amt * FX[currency] / 100) * 100
        issue = add(as_of, ri(0, 560) - 560)
        terms = pick_w([(30, 45), (60, 40), (90, 15)])
        due = add(issue, terms)
        rate = pick_w([(0.80, 20), (0.85, 30), (0.90, 35), (0.95, 15)])
        advance = js_round(inv_amt * rate)
        fee = js_round(advance * (rf(0.010, 0.032) * (terms / 30)))
        deal_type = pick_w([("Reverse Factoring", 70), ("Factoring", 30)])
        risk_base = {"A": 20, "B": 38, "C": 58, "D": 76}[sup["credit_rating"]]
        risk = max(1, min(100, js_round(risk_base + rf(-12, 12))))
        age_days = (as_of - issue).days
        status, financed, repaid = None, None, None
        rejected = rand() < 0.07
        if rejected:
            status = "Rejected"
        elif age_days < 8:
            status = pick_w([("Initiated", 40), ("Under Review", 45), ("Approved", 15)])
        elif age_days < 16:
            status = pick_w([("Under Review", 25), ("Approved", 35), ("Financed", 40)])
            if status == "Financed":  # derived, not drawn — keeps the RNG stream intact
                financed = add(issue, 2 + risk % 5)
        elif age_days < 75 and rand() < 0.05:
            status = pick_w([("Under Review", 55), ("Approved", 45)])
        else:
            financed = add(issue, ri(2, 6))
            if due < as_of:
                status = pick_w([("Repaid", 88), ("Overdue", 12)])
                if status == "Repaid":
                    repaid = add(due, ri(-3, 9))
                    if repaid > as_of:
                        repaid = as_of
            else:
                status = "Financed"
        inv_no = dup_of["invoice_number"] if dup_of else f"INV-{issue.year}-{i:04d}"
        if i % 37 == 0:
            advance = js_round(inv_amt * rate) + ri(3000, 15000)
        deals.append({
            "deal_id": i, "invoice_number": inv_no, "customer_id": sup["customer_id"],
            "bill_to": pick(BUYERS), "invoice_amount": inv_amt, "currency": currency,
            "issue_date": fmt(issue), "due_date": fmt(due), "payment_terms": f"Net {terms}",
            "advance_rate": rate, "advance_amount": advance, "fee_amount": fee,
            "deal_type": deal_type, "status": status,
            "financed_date": fmt(financed) if financed else None,
            "repaid_date": fmt(repaid) if repaid else None, "risk_score": risk,
        })

        def push(ev_type, d):
            nonlocal ev_id
            events.append({"event_id": ev_id, "deal_id": i, "event_type": ev_type,
                           "event_date": fmt(d), "actor": pick(ANALYSTS)})
            ev_id += 1

        push("Created", issue)
        if status != "Initiated":
            push("Submitted", add(issue, ri(1, 2)))
        if status in ("Approved", "Financed", "Repaid", "Overdue", "Rejected"):
            push("Reviewed", add(issue, ri(2, 4)))
        if status == "Rejected":
            push("Rejected", add(issue, ri(3, 5)))
        if status in ("Approved", "Financed", "Repaid", "Overdue"):
            push("Approved", add(issue, ri(3, 6)))
        if financed:
            if age_days < 16:  # system-posted, no RNG draw (mirrors app.js)
                events.append({"event_id": ev_id, "deal_id": i, "event_type": "Financed",
                               "event_date": fmt(financed), "actor": "system"})
                ev_id += 1
            else:
                push("Financed", financed)
        if repaid:
            push("Repaid", repaid)
        if status == "Overdue":
            push("Flagged", add(due, ri(1, 4)))

    # payments — same append-only section as app.js
    pay_id = 1
    clamp = lambda d: as_of if d > as_of else d

    def add_pay(deal, amount, when, ref="__deal__", payer=None):
        nonlocal pay_id
        payments.append({
            "payment_id": pay_id, "deal_id": deal["deal_id"] if deal else None,
            "payer": payer or (deal["bill_to"] if deal else pick(BUYERS)),
            "reference": (deal["invoice_number"] if deal else None) if ref == "__deal__" else ref,
            "amount": js_round(amount), "received_date": fmt(when),
        })
        pay_id += 1

    for d in deals:
        if d["status"] == "Repaid":
            repaid = date.fromisoformat(d["repaid_date"])
            r = rand()
            if r < 0.72:
                add_pay(d, d["invoice_amount"], repaid)
            elif r < 0.90:
                share = rf(0.40, 0.65)
                add_pay(d, d["invoice_amount"] * share, add(repaid, -ri(4, 15)))
                add_pay(d, d["invoice_amount"] * (1 - share), repaid)
            elif r < 0.96:
                add_pay(d, d["invoice_amount"] * rf(1.008, 1.03), repaid)
            else:
                add_pay(d, d["invoice_amount"], repaid)
                add_pay(d, d["invoice_amount"], clamp(add(repaid, ri(1, 6))))
        elif d["status"] == "Overdue" and rand() < 0.30:
            add_pay(d, d["invoice_amount"] * rf(0.30, 0.70),
                    clamp(add(date.fromisoformat(d["due_date"]), ri(2, 20))))
    for _ in range(4):
        amt = js_round(exp(rf(9.8, 12.0)) / 100) * 100
        when = add(as_of, -ri(3, 120))
        ref = f"INV-{as_of.year}-{ri(9000, 9899)}"
        add_pay(None, amt, when, ref)

    return {"customers": customers, "deals": deals, "events": events, "payments": payments}
