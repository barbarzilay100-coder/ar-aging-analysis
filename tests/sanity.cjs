/*
 * tests/sanity.cjs — sanity checks for the seeded data generator in assets/app.js.
 *
 * Evaluates the generator section of assets/app.js (everything above the
 * "boot" marker) in a clean scope, calls generateData(), and asserts the
 * invariants every later change must keep green.
 *
 * Run with Node (from anywhere):
 *   node tests/sanity.cjs
 * Or, on a machine without Node, with the macOS built-in JavaScriptCore
 * shell (from the repository root):
 *   /System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc tests/sanity.cjs
 */
'use strict';

var IS_NODE = typeof process !== 'undefined' && !!(process.versions && process.versions.node);
var log = typeof console !== 'undefined' && console.log ? console.log.bind(console) : print;

var BOOT_MARKER = '/* ---------- boot ---------- */';

function readAppSource() {
  if (IS_NODE) {
    var fs = require('fs'), path = require('path');
    return fs.readFileSync(path.join(__dirname, '..', 'assets', 'app.js'), 'utf8');
  }
  return readFile('assets/app.js'); // jsc: path is relative to the cwd
}

/* Evaluate the generator in a fresh scope and hand back its state. */
function buildDataset(src) {
  var cut = src.indexOf(BOOT_MARKER);
  if (cut < 0) throw new Error('boot marker not found in app.js — was it renamed?');
  var code = src.slice(0, cut) + '\ngenerateData();\n({customers: customers, deals: deals, events: events, payments: payments, TODAY: TODAY, DAY: DAY, fmtDate: fmtDate});';
  if (IS_NODE) return require('vm').runInNewContext(code, {});
  return (0, eval)(code);
}

var failures = [], passed = 0;
function check(name, cond, detail) {
  if (cond) { passed++; log('  ok   ' + name); }
  else { failures.push(name); log('  FAIL ' + name + (detail ? ' — ' + detail : '')); }
}

var src = readAppSource();
var env = buildDataset(src);
var customers = env.customers, deals = env.deals, events = env.events, payments = env.payments;
var DAY = env.DAY, today = env.fmtDate(env.TODAY);

/* ---- structure ---- */
check('30 customers', customers.length === 30, 'got ' + customers.length);
check('180 deals', deals.length === 180, 'got ' + deals.length);
check('customer ids unique', new Set(customers.map(function (c) { return c.customer_id; })).size === customers.length);
check('customer names unique', new Set(customers.map(function (c) { return c.customer_name; })).size === customers.length);
var custIds = new Set(customers.map(function (c) { return c.customer_id; }));
check('every deal references a known customer', deals.every(function (d) { return custIds.has(d.customer_id); }));
var dealIds = new Set(deals.map(function (d) { return d.deal_id; }));
check('every event references a known deal', events.every(function (e) { return dealIds.has(e.deal_id); }));

/* ---- date integrity ---- */
check('no future issue dates', deals.every(function (d) { return d.issue_date <= today; }));
check('due date = issue date + payment terms', deals.every(function (d) {
  var termDays = parseInt(d.payment_terms.replace('Net ', ''), 10);
  return (Date.parse(d.due_date) - Date.parse(d.issue_date)) / DAY === termDays;
}));
check('repaid_date never before issue_date', deals.every(function (d) {
  return d.repaid_date == null || d.repaid_date >= d.issue_date;
}));
check('no future repaid dates', deals.every(function (d) {
  return d.repaid_date == null || d.repaid_date <= today;
}));
check('Repaid only assigned to deals already due', deals.every(function (d) {
  return d.status !== 'Repaid' || d.due_date < today;
}));

/* ---- status consistency ---- */
var STATUSES = new Set(['Initiated', 'Under Review', 'Approved', 'Financed', 'Repaid', 'Overdue', 'Rejected']);
check('all statuses are known', deals.every(function (d) { return STATUSES.has(d.status); }));
check('repaid_date set exactly on Repaid deals', deals.every(function (d) {
  return (d.status === 'Repaid') === (d.repaid_date != null);
}));
check('every Financed/Repaid/Overdue deal has a financed_date', deals.every(function (d) {
  return ['Financed', 'Repaid', 'Overdue'].indexOf(d.status) < 0 || d.financed_date != null;
}));
check('financed_date sane (issue+2..6, never future)', deals.every(function (d) {
  if (d.financed_date == null) return true;
  var off = (Date.parse(d.financed_date) - Date.parse(d.issue_date)) / DAY;
  return off >= 2 && off <= 6 && d.financed_date <= today;
}));
check('every financed deal has a Financed event', deals.every(function (d) {
  return d.financed_date == null || events.some(function (e) {
    return e.deal_id === d.deal_id && e.event_type === 'Financed';
  });
}));

/* ---- planted anomalies (the exception engine must find these) ---- */
var pairCount = {};
deals.forEach(function (d) { var k = d.customer_id + '|' + d.invoice_number; pairCount[k] = (pairCount[k] || 0) + 1; });
check('duplicate invoice planted (same customer + number)', Object.keys(pairCount).some(function (k) { return pairCount[k] > 1; }));
check('advance mismatches planted', deals.some(function (d) {
  return Math.abs(d.advance_amount - Math.round(d.invoice_amount * d.advance_rate)) > 1;
}));
check('overdue deals planted', deals.some(function (d) { return d.status === 'Overdue'; }));

/* ---- payments & reconciliation ---- */
var dealById = {};
deals.forEach(function (d) { dealById[d.deal_id] = d; });
check('payments generated', payments.length > 0, 'got ' + payments.length);
check('payment ids unique', new Set(payments.map(function (p) { return p.payment_id; })).size === payments.length);
check('every applied payment references a known deal', payments.every(function (p) {
  return p.deal_id == null || dealById[p.deal_id] != null;
}));
check('no future payment dates', payments.every(function (p) { return p.received_date <= today; }));
check('no payment before its deal issue date', payments.every(function (p) {
  return p.deal_id == null || p.received_date >= dealById[p.deal_id].issue_date;
}));
var paidByDeal = {};
payments.forEach(function (p) { if (p.deal_id != null) paidByDeal[p.deal_id] = (paidByDeal[p.deal_id] || 0) + p.amount; });
check('every Repaid deal fully paid (or deliberately over)', deals.every(function (d) {
  return d.status !== 'Repaid' || (paidByDeal[d.deal_id] || 0) >= d.invoice_amount - 1;
}));
check('planted: split payment', deals.some(function (d) {
  return d.status === 'Repaid' && payments.filter(function (p) { return p.deal_id === d.deal_id; }).length >= 2;
}));
check('planted: overpayment', deals.some(function (d) {
  return (paidByDeal[d.deal_id] || 0) > d.invoice_amount + 1;
}));
check('planted: short-paid overdue', deals.some(function (d) {
  return d.status === 'Overdue' && (paidByDeal[d.deal_id] || 0) > 0 && paidByDeal[d.deal_id] < d.invoice_amount - 1;
}));
check('planted: unapplied cash', payments.some(function (p) { return p.deal_id == null; }));

/* ---- aging pivot: every open deal lands in exactly one bucket ---- */
var openDeals = deals.filter(function (d) { return d.status === 'Financed' || d.status === 'Overdue'; });
var bucketTotals = [0, 0, 0, 0, 0], openTotal = 0;
openDeals.forEach(function (d) {
  var days = (env.TODAY.getTime() - Date.parse(d.due_date)) / DAY;
  var idx = days <= 0 ? 0 : days <= 30 ? 1 : days <= 60 ? 2 : days <= 90 ? 3 : 4;
  bucketTotals[idx] += d.advance_amount;
  openTotal += d.advance_amount;
});
check('aging buckets are exhaustive and sum to open exposure',
  openDeals.length > 0 && Math.abs(bucketTotals.reduce(function (a, b) { return a + b; }, 0) - openTotal) < 0.01);

/* ---- determinism (fixed seed → identical dataset on every run) ---- */
var env2 = buildDataset(src);
check('generator is deterministic', JSON.stringify(env.deals) === JSON.stringify(env2.deals) &&
  JSON.stringify(env.customers) === JSON.stringify(env2.customers) &&
  JSON.stringify(env.payments) === JSON.stringify(env2.payments));

log('');
if (failures.length) {
  log(failures.length + ' check(s) FAILED, ' + passed + ' passed.');
  if (IS_NODE) process.exit(1);
  throw new Error('sanity checks failed');
}
log('All ' + passed + ' sanity checks passed.');
