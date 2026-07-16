/*
 * tests/sanity.cjs — sanity checks for the seeded data generator in app.js.
 *
 * Evaluates the generator section of app.js (everything above the
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
    return fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  }
  return readFile('app.js'); // jsc: path is relative to the cwd
}

/* Evaluate the generator in a fresh scope and hand back its state. */
function buildDataset(src) {
  var cut = src.indexOf(BOOT_MARKER);
  if (cut < 0) throw new Error('boot marker not found in app.js — was it renamed?');
  var code = src.slice(0, cut) + '\ngenerateData();\n({customers: customers, deals: deals, events: events, TODAY: TODAY, DAY: DAY, fmtDate: fmtDate});';
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
var customers = env.customers, deals = env.deals, events = env.events;
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

/* ---- planted anomalies (the exception engine must find these) ---- */
var invCount = {};
deals.forEach(function (d) { invCount[d.invoice_number] = (invCount[d.invoice_number] || 0) + 1; });
check('duplicate invoice planted', Object.keys(invCount).some(function (k) { return invCount[k] > 1; }));
check('advance mismatches planted', deals.some(function (d) {
  return Math.abs(d.advance_amount - Math.round(d.invoice_amount * d.advance_rate)) > 1;
}));
check('overdue deals planted', deals.some(function (d) { return d.status === 'Overdue'; }));

/* ---- determinism (fixed seed → identical dataset on every run) ---- */
var env2 = buildDataset(src);
check('generator is deterministic', JSON.stringify(env.deals) === JSON.stringify(env2.deals) &&
  JSON.stringify(env.customers) === JSON.stringify(env2.customers));

log('');
if (failures.length) {
  log(failures.length + ' check(s) FAILED, ' + passed + ' passed.');
  if (IS_NODE) process.exit(1);
  throw new Error('sanity checks failed');
}
log('All ' + passed + ' sanity checks passed.');
