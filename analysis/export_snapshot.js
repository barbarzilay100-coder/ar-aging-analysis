// Export the JS-generated ledger as a dated JSON snapshot for the pandas
// cross-check notebook. Run from the repo root with the macOS JavaScriptCore
// shell (no Node needed):
//
//   /System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc \
//     analysis/export_snapshot.js > analysis/data/ledger-snapshot.json
//
// Evaluates the data-generator section of assets/app.js (everything above the
// boot marker), calls generateData(), and prints {as_of, customers, deals, payments}.
// Amounts use the fallback FX rates, so the snapshot is fully deterministic.
var src = readFile('assets/app.js');
var cut = src.indexOf('/* ---------- boot ---------- */');
if (cut < 0) throw new Error('boot marker not found in app.js');
var code = src.slice(0, cut) +
  '\ngenerateData();({customers:customers,deals:deals,payments:payments,fmtDate:fmtDate,TODAY:TODAY});';
var env = (0, eval)(code);
print(JSON.stringify({
  as_of: env.fmtDate(env.TODAY),
  customers: env.customers,
  deals: env.deals,
  payments: env.payments
}));
