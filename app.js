/* ---------- seeded RNG ---------- */
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const rand=mulberry32(20260715);
const pick=a=>a[Math.floor(rand()*a.length)];
const ri=(min,max)=>Math.floor(rand()*(max-min+1))+min;
const rf=(min,max)=>rand()*(max-min)+min;
function pickW(items){const tot=items.reduce((s,i)=>s+i[1],0);let r=rand()*tot;for(const[v,w]of items){if(r<w)return v;r-=w;}return items[0][0];}
const DAY=86400000, TODAY=new Date(new Date().toISOString().slice(0,10)); // today (UTC midnight) — all synthetic dates are generated relative to it, so the demo never goes stale
let FX={ILS:1,USD:3.00,EUR:3.45}; // ILS conversion rates — fallback defaults (approx current), overwritten by live rates on boot
let FX_INFO={live:false,date:null,source:'fallback'};
const fmtDate=d=>d.toISOString().slice(0,10);
const addDays=(d,n)=>new Date(d.getTime()+n*DAY);

const geo=["Galil","Carmel","Negev","Sharon","Yarden","Ayalon","Tavor","Arava","Golan","Kinneret","Shomron","Emek","Ramon","Lachish","Bashan","Modiin","Yizrael"];
const suf=["Logistics","Steel","Foods","Textiles","Trading","Industries","Import","Agro","Systems","Packaging","Materials","Distribution","Print","Plastics","Motors","Electric","Marble"];
const industries=["Construction","Food & Beverage","Logistics","Manufacturing","Textiles","Agriculture","Import/Export","Retail","Electronics","Chemicals"];
const buyers=["MegaMart Retail Group","FreshLine Foods","BuildCorp Holdings","MetroGrid Utilities","PharmaPlus Distribution","TechNova Systems","UrbanBuild","GreenField Agro","PrimeLogistics","Coastal Distribution","Northgate Retail","Solaris Energy","BlueHarbor Trading","Vertex Manufacturing","CityLine Markets"];
const analysts=["system","R. Cohen","M. Levi","D. Azoulay","N. Friedman","T. Bar"];

const customers=[], deals=[], events=[];
function generateData(){
  const usedNames=new Set();
  for(let i=1;i<=30;i++){
  let name; do{name=`${pick(geo)} ${pick(suf)} Ltd`;}while(usedNames.has(name)); usedNames.add(name);
  const rating=pickW([["A",25],["B",40],["C",25],["D",10]]);
  const limitBase={A:2500000,B:1500000,C:800000,D:400000}[rating];
  customers.push({customer_id:i,customer_name:name,industry:pick(industries),onboarded_date:fmtDate(addDays(TODAY,ri(0,900)-1140)),credit_rating:rating,credit_limit:Math.round(limitBase*rf(0.7,1.3)/10000)*10000});
}

  let evId=1; const invSeen={};
  for(let i=1;i<=180;i++){
  const sup=pick(customers);
  let invAmt=Math.round(Math.exp(rf(9.6,13.4))/100)*100;
  const currency=pickW([["ILS",84],["USD",11],["EUR",5]]);
  invAmt=Math.round(invAmt*FX[currency]/100)*100; // normalise every invoice to ILS
  const issue=addDays(TODAY,ri(0,560)-560);
  const termsDays=pickW([[30,45],[60,40],[90,15]]);
  let due=addDays(issue,termsDays);
  const rate=pickW([[0.80,20],[0.85,30],[0.90,35],[0.95,15]]);
  let advance=Math.round(invAmt*rate);
  const feeRate=rf(0.010,0.032)*(termsDays/30);
  const fee=Math.round(advance*feeRate);
  const dealType=pickW([["Reverse Factoring",70],["Factoring",30]]);
  const riskBase={A:20,B:38,C:58,D:76}[sup.credit_rating];
  const risk=Math.max(1,Math.min(100,Math.round(riskBase+rf(-12,12))));
  const ageDays=(TODAY-issue)/DAY;
  let status,financed=null,repaid=null; const rejected=rand()<0.07;
  if(rejected){status="Rejected";}
  else if(ageDays<8){status=pickW([["Initiated",40],["Under Review",45],["Approved",15]]);}
  else if(ageDays<16){status=pickW([["Under Review",25],["Approved",35],["Financed",40]]);}
  else if(ageDays<75 && rand()<0.05){status=pickW([["Under Review",55],["Approved",45]]);}
  else{financed=addDays(issue,ri(2,6));
    if(due<TODAY){status=pickW([["Repaid",88],["Overdue",12]]);if(status==="Repaid")repaid=addDays(due,ri(-3,9));}
    else{status="Financed";}}
  let invNo=`INV-${issue.getFullYear()}-${String(i).padStart(4,'0')}`;
  if(i%47===0){invNo=Object.keys(invSeen)[0]||invNo;} invSeen[invNo]=true;
  if(i%37===0){advance=Math.round(invAmt*rate)+ri(3000,15000);}
  deals.push({deal_id:i,invoice_number:invNo,customer_id:sup.customer_id,bill_to:pick(buyers),invoice_amount:invAmt,currency,issue_date:fmtDate(issue),due_date:fmtDate(due),payment_terms:`Net ${termsDays}`,advance_rate:rate,advance_amount:advance,fee_amount:fee,deal_type:dealType,status,financed_date:financed?fmtDate(financed):null,repaid_date:repaid?fmtDate(repaid):null,risk_score:risk});
  const push=(type,d)=>events.push({event_id:evId++,deal_id:i,event_type:type,event_date:fmtDate(d),actor:pick(analysts)});
  push("Created",issue);
  if(status!=="Initiated")push("Submitted",addDays(issue,ri(1,2)));
  if(["Approved","Financed","Repaid","Overdue","Rejected"].includes(status))push("Reviewed",addDays(issue,ri(2,4)));
  if(status==="Rejected")push("Rejected",addDays(issue,ri(3,5)));
  if(["Approved","Financed","Repaid","Overdue"].includes(status))push("Approved",addDays(issue,ri(3,6)));
  if(financed)push("Financed",financed);
  if(repaid)push("Repaid",repaid);
  if(status==="Overdue")push("Flagged",addDays(due,ri(1,4)));
  }
}

const SCHEMA={
  customers:[["customer_id","INTEGER","pk"],["customer_name","TEXT"],["industry","TEXT"],["onboarded_date","DATE"],["credit_rating","TEXT"],["credit_limit","INTEGER"]],
  deals:[["deal_id","INTEGER","pk"],["invoice_number","TEXT"],["customer_id","INTEGER","fk"],["bill_to","TEXT"],["invoice_amount","REAL"],["currency","TEXT"],["issue_date","DATE"],["due_date","DATE"],["payment_terms","TEXT"],["advance_rate","REAL"],["advance_amount","REAL"],["fee_amount","REAL"],["deal_type","TEXT"],["status","TEXT"],["financed_date","DATE"],["repaid_date","DATE"],["risk_score","INTEGER"]],
  deal_events:[["event_id","INTEGER","pk"],["deal_id","INTEGER","fk"],["event_type","TEXT"],["event_date","DATE"],["actor","TEXT"]]
};
const PRESETS=[
  ["Financing by status",`SELECT status, COUNT(*) AS deals, ROUND(SUM(advance_amount)) AS financed_ils\nFROM deals GROUP BY status ORDER BY financed_ils DESC;`],
  ["Overdue deals",`SELECT d.invoice_number, s.customer_name, d.due_date,\n       ROUND(d.advance_amount) AS advance_ils, d.risk_score\nFROM deals d JOIN customers s ON s.customer_id=d.customer_id\nWHERE d.status='Overdue' ORDER BY d.due_date;`],
  ["Top customers by volume",`SELECT s.customer_name, s.credit_rating, COUNT(*) AS deals,\n       ROUND(SUM(d.advance_amount)) AS financed_ils\nFROM deals d JOIN customers s ON s.customer_id=d.customer_id\nWHERE d.status IN ('Financed','Repaid','Overdue')\nGROUP BY s.customer_id ORDER BY financed_ils DESC LIMIT 10;`],
  ["Monthly trend",`SELECT substr(financed_date,1,7) AS month, COUNT(*) AS deals,\n       ROUND(SUM(advance_amount)) AS financed_ils\nFROM deals WHERE financed_date IS NOT NULL\nGROUP BY month ORDER BY month;`],
  ["Avg fee by type",`SELECT deal_type, COUNT(*) AS deals, ROUND(AVG(fee_amount)) AS avg_fee_ils,\n       ROUND(AVG(advance_rate),3) AS avg_advance_rate\nFROM deals GROUP BY deal_type;`],
  ["Risk buckets",`SELECT CASE WHEN risk_score<35 THEN 'Low' WHEN risk_score<65 THEN 'Medium' ELSE 'High' END AS band,\n       COUNT(*) AS deals, ROUND(SUM(advance_amount)) AS exposure_ils\nFROM deals GROUP BY band ORDER BY exposure_ils DESC;`]
];

/* ---------- boot ---------- */
let db; const $=id=>document.getElementById(id);
const money=n=>n==null?'':Number(n).toLocaleString('en-US');
const C={accent:'#0B7A5B',indigo:'#2B3E63',amber:'#C77A0A',danger:'#B42318',teal:'#2E9C8E',slate:'#8695AD',mint:'#66B79A',blue:'#3E5C99'};

async function fetchLiveRates(){
  try{
    const ctrl=new AbortController(); const t=setTimeout(()=>ctrl.abort(),4000);
    const res=await fetch('https://open.er-api.com/v6/latest/USD',{signal:ctrl.signal,cache:'no-store'});
    clearTimeout(t);
    if(!res.ok) throw new Error('HTTP '+res.status);
    const j=await res.json();
    const usdIls=j.rates&&j.rates.ILS, usdEur=j.rates&&j.rates.EUR;
    if(usdIls>0 && usdEur>0){ FX.USD=usdIls; FX.EUR=usdIls/usdEur; FX_INFO={live:true,date:j.time_last_update_utc||'',source:'open.er-api.com'}; }
  }catch(e){ FX_INFO={live:false,date:null,source:'fallback'}; }
}
function renderFxNote(){
  const el=$('fxNote'); if(!el) return;
  const u=Number(FX.USD).toFixed(2), e=Number(FX.EUR).toFixed(2);
  el.innerHTML=FX_INFO.live
    ? `Live rates · source ${FX_INFO.source} · ${FX_INFO.date} — <b>USD&#8594;ILS ${u}</b>, <b>EUR&#8594;ILS ${e}</b>.`
    : `Live rate service unavailable — using fallback: <b>USD&#8594;ILS ${u}</b>, <b>EUR&#8594;ILS ${e}</b>.`;
}
(async()=>{
  try{
    await fetchLiveRates();
    generateData();
    const SQL=await initSqlJs({locateFile:f=>`https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/${f}`});
    db=new SQL.Database(); buildTables();
    renderKpis(); renderCharts(); renderRecent();
    buildExceptions(); renderExceptions();
    setupAI();
    renderSchema(); renderChips(); runQuery($('editor').value);
    renderFxNote();
    const v=$('veil'); v.style.opacity='0'; setTimeout(()=>v.remove(),400);
  }catch(err){$('veil-msg').textContent='Could not load the SQL engine (network blocked). Open the downloaded file directly.';console.error(err);}
})();

function buildTables(){
  db.run(`CREATE TABLE customers(customer_id INTEGER PRIMARY KEY,customer_name TEXT,industry TEXT,onboarded_date TEXT,credit_rating TEXT,credit_limit INTEGER);`);
  db.run(`CREATE TABLE deals(deal_id INTEGER PRIMARY KEY,invoice_number TEXT,customer_id INTEGER,bill_to TEXT,invoice_amount REAL,currency TEXT,issue_date TEXT,due_date TEXT,payment_terms TEXT,advance_rate REAL,advance_amount REAL,fee_amount REAL,deal_type TEXT,status TEXT,financed_date TEXT,repaid_date TEXT,risk_score INTEGER);`);
  db.run(`CREATE TABLE deal_events(event_id INTEGER PRIMARY KEY,deal_id INTEGER,event_type TEXT,event_date TEXT,actor TEXT);`);
  db.run("BEGIN");
  let s=db.prepare("INSERT INTO customers VALUES (?,?,?,?,?,?)");
  customers.forEach(x=>s.run([x.customer_id,x.customer_name,x.industry,x.onboarded_date,x.credit_rating,x.credit_limit])); s.free();
  let d=db.prepare("INSERT INTO deals VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
  deals.forEach(x=>d.run([x.deal_id,x.invoice_number,x.customer_id,x.bill_to,x.invoice_amount,x.currency,x.issue_date,x.due_date,x.payment_terms,x.advance_rate,x.advance_amount,x.fee_amount,x.deal_type,x.status,x.financed_date,x.repaid_date,x.risk_score])); d.free();
  let e=db.prepare("INSERT INTO deal_events VALUES (?,?,?,?,?)");
  events.forEach(x=>e.run([x.event_id,x.deal_id,x.event_type,x.event_date,x.actor])); e.free();
  db.run("COMMIT");
}

function rows(sql){const r=db.exec(sql);if(!r.length)return[];return r[0].values.map(v=>{const o={};r[0].columns.forEach((c,i)=>o[c]=v[i]);return o;});}
function one(sql){const r=db.exec(sql);return r.length?r[0].values[0][0]:null;}

/* ---------- KPIs ---------- */
function renderKpis(){
  const financed=one("SELECT ROUND(SUM(advance_amount)) FROM deals WHERE status IN ('Financed','Repaid','Overdue')");
  const openExp=one("SELECT ROUND(SUM(advance_amount)) FROM deals WHERE status IN ('Financed','Overdue')");
  const odAmt=one("SELECT ROUND(SUM(advance_amount)) FROM deals WHERE status='Overdue'")||0;
  const odCnt=one("SELECT COUNT(*) FROM deals WHERE status='Overdue'");
  const avgRate=one("SELECT ROUND(AVG(advance_rate)*100,1) FROM deals");
  const avgDays=one("SELECT ROUND(AVG(julianday(financed_date)-julianday(issue_date)),1) FROM deals WHERE financed_date IS NOT NULL");
  const dso=one(`SELECT ROUND(AVG(julianday(COALESCE(repaid_date,'${fmtDate(TODAY)}'))-julianday(issue_date))) FROM deals WHERE status IN ('Financed','Overdue','Repaid')`);
  const repaidCnt=one("SELECT COUNT(*) FROM deals WHERE status='Repaid'");
  const settled=repaidCnt+odCnt;
  const repayRate=settled?Math.round(repaidCnt/settled*100):0;
  const cards=[
    {label:'Financed volume',val:'₪'+money(financed),cls:''},
    {label:'Open exposure',val:'₪'+money(openExp),cls:''},
    {label:'Overdue',val:'₪'+money(odAmt),meta:odCnt+' invoices',cls:'alert'},
    {label:'Avg advance rate',val:avgRate+'<small>%</small>',cls:''},
    {label:'Avg days to finance',val:avgDays+'<small> d</small>',cls:''},
    {label:'DSO',val:dso+'<small> d</small>',cls:''},
    {label:'Repayment rate',val:repayRate+'<small>%</small>',cls:'good'},
  ];
  $('kpis').innerHTML=cards.map(c=>`<div class="kpi-card ${c.cls}"><div class="label">${c.label}</div><div class="val">${c.val}</div>${c.meta?`<div class="meta">${c.meta}</div>`:''}</div>`).join('');
}

/* ---------- charts ---------- */
let charts={};
Chart.defaults.font.family="'Inter',sans-serif";
Chart.defaults.font.size=11;
Chart.defaults.color='#667085';
function renderCharts(){
  // volume by month
  const vol=rows("SELECT substr(financed_date,1,7) AS m, ROUND(SUM(advance_amount)) AS v FROM deals WHERE financed_date IS NOT NULL GROUP BY m ORDER BY m");
  charts.vol=new Chart($('chVolume'),{type:'bar',data:{labels:vol.map(r=>r.m),datasets:[{data:vol.map(r=>r.v),backgroundColor:C.accent,borderRadius:4,maxBarThickness:26}]},options:baseOpts({money:true})});
  // status doughnut
  const st=rows("SELECT status, COUNT(*) c FROM deals GROUP BY status ORDER BY c DESC");
  const stColors={Financed:C.accent,Repaid:C.blue,Overdue:C.danger,Approved:C.mint,'Under Review':C.slate,Initiated:'#B4BECD',Rejected:'#C9A0A0'};
  charts.st=new Chart($('chStatus'),{type:'doughnut',data:{labels:st.map(r=>r.status),datasets:[{data:st.map(r=>r.c),backgroundColor:st.map(r=>stColors[r.status]||C.slate),borderWidth:2,borderColor:'#fff'}]},options:{responsive:true,maintainAspectRatio:false,cutout:'62%',plugins:{legend:{position:'right',labels:{boxWidth:10,padding:10,font:{size:11}}}}}});
  // top customers
  const sup=rows("SELECT s.customer_name n, ROUND(SUM(d.advance_amount)) v FROM deals d JOIN customers s ON s.customer_id=d.customer_id WHERE d.status IN ('Financed','Repaid','Overdue') GROUP BY s.customer_id ORDER BY v DESC LIMIT 8");
  charts.sup=new Chart($('chSuppliers'),{type:'bar',data:{labels:sup.map(r=>r.n),datasets:[{data:sup.map(r=>r.v),backgroundColor:C.indigo,borderRadius:4,maxBarThickness:18}]},options:baseOpts({money:true,horizontal:true})});
  // aging of open receivables
  const open=rows("SELECT due_date, advance_amount FROM deals WHERE status IN ('Financed','Overdue')");
  const buckets={'Not yet due':0,'1–30 overdue':0,'31–60 overdue':0,'60+ overdue':0};
  open.forEach(r=>{const days=(TODAY-new Date(r.due_date))/DAY;
    if(days<=0)buckets['Not yet due']+=r.advance_amount;
    else if(days<=30)buckets['1–30 overdue']+=r.advance_amount;
    else if(days<=60)buckets['31–60 overdue']+=r.advance_amount;
    else buckets['60+ overdue']+=r.advance_amount;});
  charts.age=new Chart($('chAging'),{type:'bar',data:{labels:Object.keys(buckets),datasets:[{data:Object.values(buckets).map(v=>Math.round(v)),backgroundColor:[C.accent,C.amber,'#D08A2E',C.danger],borderRadius:4,maxBarThickness:44}]},options:baseOpts({money:true})});
}
function baseOpts({money=false,horizontal=false}={}){
  return {responsive:true,maintainAspectRatio:false,indexAxis:horizontal?'y':'x',
    plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>(money?'₪':'')+Number(c.parsed[horizontal?'x':'y']).toLocaleString('en-US')}}},
    scales:{x:{grid:{display:horizontal},ticks:{callback:function(v){return horizontal?'₪'+(v/1000)+'K':this.getLabelForValue(v);}}},
            y:{grid:{color:'#EEF1F5'},ticks:{callback:v=>horizontal?undefined:(money?'₪'+(v/1000)+'K':v)}}}};
}

/* ---------- recent table ---------- */
function renderRecent(){
  const r=rows("SELECT d.invoice_number iv, s.customer_name sup, d.bill_to buy, d.invoice_amount amt, d.currency cur, d.issue_date iss, d.status st FROM deals d JOIN customers s ON s.customer_id=d.customer_id ORDER BY d.issue_date DESC LIMIT 10");
  let h='<thead><tr><th>Invoice</th><th>Customer</th><th>Bill-to</th><th>Amount</th><th>Issued</th><th>Status</th></tr></thead><tbody>';
  r.forEach(x=>{h+=`<tr><td class="mono">${x.iv}</td><td>${x.sup}</td><td>${x.buy}</td><td class="num">₪${money(x.amt)}${x.cur!=='ILS'?` <span class="ccy">${x.cur}</span>`:''}</td><td class="mono">${x.iss}</td><td><span class="pill p-${x.st.replace(/\s/g,'')}">${x.st}</span></td></tr>`;});
  $('recentTbl').innerHTML=h+'</tbody>';
}

/* ---------- console ---------- */
function renderSchema(){
  const host=$('schema'); host.innerHTML='';
  Object.entries(SCHEMA).forEach(([tbl,cols])=>{
    const wrap=document.createElement('div'); wrap.className='tblx';
    const cnt=one(`SELECT COUNT(*) FROM ${tbl}`);
    const head=document.createElement('div'); head.className='tbl-name';
    head.innerHTML=`<span class="dot"></span>${tbl}<span class="cnt">${cnt} rows</span>`;
    const box=document.createElement('div'); box.className='cols';
    cols.forEach(c=>{const el=document.createElement('div');el.className='col';
      const key=c[2]==='pk'?'<span class="pk"> PK</span>':c[2]==='fk'?'<span class="pk"> FK</span>':'';
      el.innerHTML=`<span>${c[0]}${key}</span><span class="type">${c[1]}</span>`;
      el.onclick=e=>{e.stopPropagation();insertText(c[0]);}; box.appendChild(el);});
    head.onclick=()=>{box.classList.toggle('open');const q=`SELECT * FROM ${tbl} LIMIT 20;`;setEditor(q);runQuery(q);};
    wrap.appendChild(head); wrap.appendChild(box); host.appendChild(wrap);
  });
  host.querySelector('.cols').classList.add('open');
}
function renderChips(){const host=$('chips');host.innerHTML='';PRESETS.forEach(([label,sql])=>{const c=document.createElement('div');c.className='chip';c.textContent=label;c.onclick=()=>{setEditor(sql);runQuery(sql);};host.appendChild(c);});}
function setEditor(v){$('editor').value=v;}
function insertText(t){const e=$('editor'),s=e.selectionStart,en=e.selectionEnd;e.value=e.value.slice(0,s)+t+e.value.slice(en);e.focus();e.selectionStart=e.selectionEnd=s+t.length;}
const NUMERIC=/amount|ils|volume|fee|limit|deals|count|rate|score|exposure|financed|advance|risk/i;
function renderQueryResults(res){
  const host=$('results');
  if(!res.length){host.innerHTML='<div class="empty-state">Query ran successfully — no rows returned.</div>';$('rowcount').textContent='0 rows';return;}
  const {columns,values}=res[0];
  let html='<table class="grid-tbl"><thead><tr>';columns.forEach(c=>html+=`<th>${c}</th>`);html+='</tr></thead><tbody>';
  values.forEach(row=>{html+='<tr>';row.forEach((cell,idx)=>{const col=columns[idx];
    if(col==='status'&&cell!=null){html+=`<td><span class="pill p-${String(cell).replace(/\s/g,'')}">${cell}</span></td>`;}
    else if(typeof cell==='number'&&NUMERIC.test(col)){html+=`<td class="num">${col.includes('rate')?cell:money(cell)}</td>`;}
    else{html+=`<td>${cell==null?'<span style="color:#B9C0CC">null</span>':cell}</td>`;}});html+='</tr>';});
  html+='</tbody></table>';host.innerHTML=html;
  $('rowcount').textContent=`${values.length} row${values.length!==1?'s':''}`;
}
function runQuery(sql){if(!db)return;const t0=performance.now();try{const res=db.exec(sql);const ms=(performance.now()-t0).toFixed(1);renderQueryResults(res);$('status').textContent=`ok · ${ms} ms`;$('status').classList.remove('err');}catch(err){$('results').innerHTML=`<div class="empty-state" style="color:var(--danger)">SQL error: ${err.message}</div>`;$('status').textContent='error';$('status').classList.add('err');$('rowcount').textContent='—';}}
$('run').onclick=()=>runQuery($('editor').value);
$('editor').addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();runQuery($('editor').value);}});

/* ---------- exception engine (SQL rule scans) ---------- */
let EXC=[], excFilter='All', flaggedDeals=new Set();
const RULES=[
  {id:'DUP_INV', name:'Duplicate invoice', sev:'High',
   sql:`SELECT deal_id, invoice_number, customer_id, advance_amount AS amt, issue_date AS dt
        FROM deals WHERE invoice_number IN
        (SELECT invoice_number FROM deals GROUP BY invoice_number HAVING COUNT(*)>1)
        ORDER BY invoice_number`,
   detail:r=>`Invoice ${r.invoice_number} is attached to more than one deal — double-financing risk.`,
   risk:r=>r.amt},
  {id:'ADV_GT_INV', name:'Advance exceeds invoice', sev:'High',
   sql:`SELECT deal_id, invoice_number, customer_id, invoice_amount, advance_amount AS amt, issue_date AS dt
        FROM deals WHERE advance_amount > invoice_amount`,
   detail:r=>`Advance ₪${money(r.amt)} is larger than the invoice ₪${money(r.invoice_amount)}.`,
   risk:r=>r.amt-r.invoice_amount},
  {id:'LIMIT_BREACH', name:'Credit limit breach', sev:'High',
   sql:`SELECT s.customer_id, s.customer_name, s.credit_limit,
               ROUND(SUM(d.advance_amount)) AS exposure
        FROM deals d JOIN customers s ON s.customer_id=d.customer_id
        WHERE d.status IN ('Financed','Overdue')
        GROUP BY s.customer_id HAVING exposure > s.credit_limit ORDER BY exposure DESC`,
   detail:r=>`Open exposure ₪${money(r.exposure)} exceeds credit limit ₪${money(r.credit_limit)}.`,
   risk:r=>r.exposure-r.credit_limit, customerLevel:true},
  {id:'ADV_MISMATCH', name:'Advance amount mismatch', sev:'Medium',
   sql:`SELECT deal_id, invoice_number, customer_id, advance_amount AS amt,
               ROUND(invoice_amount*advance_rate) AS expected, issue_date AS dt
        FROM deals WHERE ABS(advance_amount - ROUND(invoice_amount*advance_rate)) > 1`,
   detail:r=>`Advance ₪${money(r.amt)} ≠ expected ₪${money(r.expected)} (invoice × rate).`,
   risk:r=>Math.abs(r.amt-r.expected)},
  {id:'OVERDUE', name:'Overdue receivable', sev:'Medium',
   sql:`SELECT deal_id, invoice_number, customer_id, advance_amount AS amt, due_date AS dt, risk_score
        FROM deals WHERE status='Overdue' ORDER BY due_date`,
   detail:r=>`Financed but unpaid — due ${r.dt}, ${Math.round((TODAY-new Date(r.dt))/DAY)} days overdue.`,
   risk:r=>r.amt},
  {id:'HIGH_RISK', name:'High-risk exposure', sev:'Medium',
   sql:`SELECT deal_id, invoice_number, customer_id, advance_amount AS amt, risk_score, financed_date AS dt
        FROM deals WHERE status IN ('Financed','Overdue') AND risk_score>=75 ORDER BY risk_score DESC`,
   detail:r=>`Financed with risk score ${r.risk_score}/100 — above the 75 threshold.`,
   risk:r=>r.amt},
  {id:'STALE', name:'Stale in pipeline', sev:'Low',
   sql:`SELECT deal_id, invoice_number, customer_id, advance_amount AS amt, issue_date AS dt, status
        FROM deals
        WHERE status IN ('Initiated','Under Review','Approved')
          AND julianday('now')-julianday(issue_date) > 10 ORDER BY issue_date`,
   detail:r=>`Still "${r.status}" ${Math.round((TODAY-new Date(r.dt))/DAY)} days after issue — pipeline is stuck.`,
   risk:r=>0}
];
function buildExceptions(){
  const custName={}; rows("SELECT customer_id,customer_name FROM customers").forEach(s=>custName[s.customer_id]=s.customer_name);
  EXC=[]; flaggedDeals=new Set();
  RULES.forEach(rule=>{
    rows(rule.sql).forEach(r=>{
      if(r.deal_id!=null) flaggedDeals.add(r.deal_id);
      EXC.push({
        sev:rule.sev, rule:rule.name, ruleId:rule.id,
        ref:rule.customerLevel?('CUS-'+String(r.customer_id).padStart(3,'0')):(r.invoice_number||('#'+r.deal_id)),
        customer:rule.customerLevel?r.customer_name:custName[r.customer_id],
        detail:rule.detail(r), amount:Math.round(rule.risk(r)||0), date:r.dt||''
      });
    });
  });
  const order={High:0,Medium:1,Low:2};
  EXC.sort((a,b)=>order[a.sev]-order[b.sev]||b.amount-a.amount);
}
function renderExceptions(){
  const high=EXC.filter(e=>e.sev==='High').length, med=EXC.filter(e=>e.sev==='Medium').length, low=EXC.filter(e=>e.sev==='Low').length;
  const atRiskExp=flaggedDeals.size?(one("SELECT ROUND(SUM(advance_amount)) FROM deals WHERE status IN ('Financed','Overdue') AND deal_id IN ("+[...flaggedDeals].join(',')+")")||0):0;
  $('excSummary').innerHTML=[
    {label:'Open exceptions',val:EXC.length,cls:''},
    {label:'High severity',val:high,cls:'alert'},
    {label:'Medium severity',val:med,cls:''},
    {label:'At-risk exposure',val:'₪'+money(atRiskExp),cls:''}
  ].map(c=>`<div class="kpi-card ${c.cls}"><div class="label">${c.label}</div><div class="val">${c.val}</div></div>`).join('');

  const rulesCount={}; EXC.forEach(e=>rulesCount[e.rule]=(rulesCount[e.rule]||0)+1);
  const filters=['All','High','Medium','Low'];
  $('excFilters').innerHTML=filters.map(f=>{
    const n=f==='All'?EXC.length:EXC.filter(e=>e.sev===f).length;
    return `<div class="fchip ${excFilter===f?'active':''}" data-f="${f}">${f}<span class="n">${n}</span></div>`;
  }).join('');
  $('excFilters').querySelectorAll('.fchip').forEach(c=>c.onclick=()=>{excFilter=c.dataset.f;renderExceptions();});

  const list=excFilter==='All'?EXC:EXC.filter(e=>e.sev===excFilter);
  let h='<thead><tr><th>Severity</th><th>Rule</th><th>Reference</th><th>Customer</th><th>Detail</th><th>Rule impact</th></tr></thead><tbody>';
  list.forEach(e=>{h+=`<tr><td><span class="sev sev-${e.sev}">${e.sev}</span></td><td>${e.rule}</td><td class="mono">${e.ref}</td><td>${e.customer||''}</td><td class="detail">${e.detail}</td><td class="num">${e.amount?'₪'+money(e.amount):'—'}</td></tr>`;});
  if(!list.length)h+='<tr><td colspan="6" style="padding:30px;text-align:center;color:var(--faint)">No exceptions in this view.</td></tr>';
  $('excTbl').innerHTML=h+'</tbody>';

  $('rulesNote').innerHTML=`<b>How the engine works</b>Each rule is a SQL query run against the live ledger — no manual review. Rules in force: `+
    RULES.map(r=>`<code>${r.name}</code>`).join(' ')+`. Re-running against new data re-flags everything automatically. The "Rule impact" column is per-rule and can overlap across rules; the "At-risk exposure" tile above counts each flagged invoice's outstanding advance only once.`;
}

/* ---------- AI extraction layer ---------- */
// HTML-escape anything that came from the pasted document or the model —
// extracted fields are untrusted input and must never reach innerHTML raw.
const esc=s=>s==null?s:String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function qAll(sql,params){const st=db.prepare(sql);if(params)st.bind(params);const out=[];while(st.step())out.push(st.getAsObject());st.free();return out;}
function q1(sql,params){const r=qAll(sql,params);return r.length?r[0]:null;}

let SAMPLES={};
function buildSamples(){
  const d=q1("SELECT d.invoice_number iv,s.customer_name sup,d.bill_to buy,d.invoice_amount amt,d.currency cur,d.issue_date iss,d.due_date due,d.payment_terms terms FROM deals d JOIN customers s ON s.customer_id=d.customer_id WHERE d.deal_id=1");
  SAMPLES.dup=
`TAX INVOICE

From:    ${d.sup}
Bill to: ${d.buy}

Invoice no.:   ${d.iv}
Issue date:    ${d.iss}
Due date:      ${d.due}
Payment terms: ${d.terms}

Description                     Amount
------------------------------  ----------
Goods supplied per PO #4471     ${d.cur} ${Number(d.amt).toLocaleString('en-US')}
------------------------------  ----------
Total due:                      ${d.cur} ${Number(d.amt).toLocaleString('en-US')}

Please remit to account ending 8842.
Financing requested against this invoice.`;
  const cIss=addDays(TODAY,-7), cDue=addDays(cIss,60);
  SAMPLES.clean=
`INVOICE

Supplier:  Tabor Freight Solutions Ltd
Customer:  Northgate Retail
Invoice #: INV-${cIss.getFullYear()}-9042
Issued:    ${fmtDate(cIss)}
Due:       ${fmtDate(cDue)}  (Net 60)

Line items:
  1. Container haulage, Ashdod → Modiin      ILS 84,000
  2. Cold-chain surcharge                     ILS 12,500
  3. Customs handling                          ILS  6,200
                                     Total:   ILS 102,700

Early-payment financing requested (90% advance).`;
}

async function extractWithAI(text){
  const prompt=`Extract the following fields from this invoice / deal document. Return ONLY a JSON object, no markdown, no commentary.

Fields:
- invoice_number (string or null)
- customer_name (string or null)
- bill_to (string or null)
- invoice_amount (number or null, no currency symbol or separators)
- currency (string like "ILS"/"USD"/"EUR" or null)
- issue_date (YYYY-MM-DD or null)
- due_date (YYYY-MM-DD or null)
- payment_terms (string or null)
- line_item_count (integer or null)
- notes (array of short strings: anything missing, inconsistent, or worth an analyst's attention)
- risk_summary (one or two sentences)

Document:
"""
${text}
"""`;
  const key=(document.getElementById('apiKey')?.value||'').trim();
  const headers={"Content-Type":"application/json"};
  if(key){headers["x-api-key"]=key;headers["anthropic-version"]="2023-06-01";headers["anthropic-dangerous-direct-browser-access"]="true";}
  const res=await fetch("https://api.anthropic.com/v1/messages",{
    method:"POST",headers,
    body:JSON.stringify({model:"claude-sonnet-5",max_tokens:1000,
      system:"You are a precise financial document extraction engine. Output only valid JSON.",
      messages:[{role:"user",content:prompt}]})
  });
  if(!res.ok) throw new Error("HTTP "+res.status);
  const data=await res.json();
  const t=data.content.filter(i=>i.type==='text').map(i=>i.text).join('');
  return parseJSON(t);
}
function parseJSON(text){
  let t=text.replace(/```json/gi,'').replace(/```/g,'').trim();
  const a=t.indexOf('{'),b=t.lastIndexOf('}');
  if(a>=0&&b>a)t=t.slice(a,b+1);
  return JSON.parse(t);
}
/* offline heuristic fallback (parses the structured samples) */
function extractHeuristic(text){
  const g=(re)=>{const m=text.match(re);return m?m[1].trim():null;};
  const numOf=s=>s?Number(String(s).replace(/[^\d.]/g,'')):null;
  const amt=g(/Total(?:\s*due)?:?\s*[A-Z]{0,3}\s*([\d,\.]+)/i);
  const cur=g(/\b(ILS|USD|EUR)\b/);
  return {
    invoice_number:g(/Invoice\s*(?:no\.?|#)\s*:?\s*([A-Z0-9\-]+)/i),
    customer_name:g(/(?:From|Supplier)\s*:?\s*(.+)/i),
    bill_to:g(/(?:Bill to|Customer)\s*:?\s*(.+)/i),
    invoice_amount:numOf(amt),
    currency:cur,
    issue_date:g(/(?:Issue date|Issued)\s*:?\s*(\d{4}-\d{2}-\d{2})/i),
    due_date:g(/(?:Due date|Due)\s*:?\s*(\d{4}-\d{2}-\d{2})/i),
    payment_terms:g(/(Net\s*\d+)/i),
    line_item_count:null,
    notes:["Offline heuristic extraction — AI service was unreachable."],
    risk_summary:"Extracted with fallback parser; connect to the AI service for full document reasoning."
  };
}

function crossCheck(x){
  const checks=[];
  const money=n=>Number(n).toLocaleString('en-US');
  // duplicate invoice
  if(x.invoice_number){
    const dup=q1("SELECT COUNT(*) c FROM deals WHERE invoice_number=?",[x.invoice_number]);
    if(dup&&dup.c>0) checks.push({s:'flag',t:'Duplicate invoice number',d:`${esc(x.invoice_number)} already exists on ${dup.c} deal(s) in the ledger — possible double-financing.`});
    else checks.push({s:'ok',t:'Invoice number is new',d:`${esc(x.invoice_number)} not found in the ledger.`});
  } else checks.push({s:'warn',t:'No invoice number',d:'Could not read an invoice number from the document.'});
  // supplier match
  if(x.customer_name){
    const sup=q1("SELECT customer_id,credit_rating,credit_limit FROM customers WHERE lower(customer_name)=lower(?)",[x.customer_name]);
    if(sup){
      const exp=q1("SELECT COALESCE(ROUND(SUM(advance_amount)),0) e FROM deals WHERE customer_id=? AND status IN ('Financed','Overdue')",[sup.customer_id]);
      const room=sup.credit_limit-exp.e;
      const adv=x.invoice_amount?Math.round(x.invoice_amount*0.9):null;
      checks.push({s:'ok',t:'Known customer',d:`Rating ${sup.credit_rating}. Limit ₪${money(sup.credit_limit)}, used ₪${money(exp.e)}, remaining ₪${money(room)}.`});
      if(adv!=null){
        if(adv>room) checks.push({s:'flag',t:'Would breach credit limit',d:`A 90% advance (₪${money(adv)}) exceeds remaining room (₪${money(room)}).`});
        else checks.push({s:'ok',t:'Within credit limit',d:`90% advance ≈ ₪${money(adv)}; remaining room ₪${money(room)}.`});
      }
    } else checks.push({s:'warn',t:'New customer',d:`"${esc(x.customer_name)}" is not onboarded — KYC / credit setup required before financing.`});
  }
  // amount sanity
  if(x.invoice_amount){
    const st=q1("SELECT ROUND(AVG(invoice_amount)) a, ROUND(MAX(invoice_amount)) mx FROM deals");
    if(x.invoice_amount>st.mx) checks.push({s:'warn',t:'Amount above portfolio max',d:`₪${money(x.invoice_amount)} is larger than any deal on the book (max ₪${money(st.mx)}).`});
    else checks.push({s:'ok',t:'Amount in normal range',d:`₪${money(x.invoice_amount)} vs portfolio average ₪${money(st.a)}.`});
  }
  // date integrity
  if(x.issue_date&&x.due_date){
    if(x.due_date<x.issue_date) checks.push({s:'flag',t:'Date inconsistency',d:`Due date ${x.due_date} is before issue date ${x.issue_date}.`});
    else checks.push({s:'ok',t:'Dates consistent',d:`Issued ${x.issue_date}, due ${x.due_date}.`});
  }
  return checks;
}

function renderExtraction(x,mode){
  const money=n=>Number(n).toLocaleString('en-US');
  const F=(k,v,fmt)=>`<div class="field"><div class="fk">${k}</div><div class="fv ${v==null?'null':''}">${v==null?'—':(fmt?fmt(v):esc(v))}</div></div>`;
  const fields=`<div class="ex-section-title">Extracted fields</div><div class="field-grid">`+
    F('Invoice #',x.invoice_number)+
    F('Customer',x.customer_name)+
    F('Bill-to',x.bill_to)+
    F('Amount',x.invoice_amount,v=>(x.currency?esc(x.currency)+' ':'₪')+money(v))+
    F('Currency',x.currency)+
    F('Payment terms',x.payment_terms)+
    F('Issue date',x.issue_date)+
    F('Due date',x.due_date)+
    `</div>`;
  const checks=crossCheck(x);
  const checksHtml=`<div class="ex-section-title">Ledger cross-check</div>`+
    checks.map(c=>`<div class="check ${c.s}"><span class="ico">${c.s==='ok'?'✓':c.s==='warn'?'!':'✕'}</span><span class="ctext"><b>${c.t}</b><span>${c.d}</span></span></div>`).join('');
  const notes=(x.notes&&x.notes.length)?`<div class="ex-section-title">Analyst notes (AI)</div>`+x.notes.map(n=>`<div class="check warn"><span class="ico">!</span><span class="ctext"><span>${esc(n)}</span></span></div>`).join(''):'';
  const risk=x.risk_summary?`<div class="risk-box"><div class="rl">AI risk summary</div>${esc(x.risk_summary)}</div>`:'';
  $('aiResult').innerHTML=fields+checksHtml+notes+risk;
  $('aiMode').textContent=mode;
}

function setupAI(){
  buildSamples();
  document.querySelectorAll('[data-sample]').forEach(b=>b.onclick=()=>{$('doc').value=SAMPLES[b.dataset.sample]||'';});
  $('extract').onclick=async()=>{
    const text=$('doc').value.trim();
    if(!text){$('aiStatus').textContent='Paste a document or load a sample first.';return;}
    $('aiStatus').className='ai-status';
    $('aiStatus').innerHTML='<span class="ai-spin"></span>Extracting with Claude…';
    $('extract').disabled=true;
    try{
      const x=await extractWithAI(text);
      renderExtraction(x,'extracted by Claude');
      $('aiStatus').textContent='';
    }catch(err){
      const x=extractHeuristic(text);
      renderExtraction(x,'offline heuristic');
      const hasKey=!!($('apiKey')?.value||'').trim();
      $('aiStatus').className='ai-status'+(hasKey?' err':'');
      $('aiStatus').textContent=hasKey
        ?'AI service unreachable — showing offline heuristic extraction. Check the API key and try again.'
        :'No API key — showing offline heuristic extraction. Paste an Anthropic API key above for full AI extraction (inside the Claude runtime it works without one).';
    }finally{$('extract').disabled=false;}
  };
}

/* ---------- tabs ---------- */
document.querySelectorAll('nav.tabs button').forEach(b=>{
  b.onclick=()=>{
    document.querySelectorAll('nav.tabs button').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    const v=b.dataset.view;
    document.querySelectorAll('section.view').forEach(sec=>sec.hidden=(sec.id!=='view-'+v));
  };
});
