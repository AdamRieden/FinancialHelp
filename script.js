const COLORS = ['#4fffb0','#ff6b6b','#ffd166','#74b9ff','#a29bfe','#fd79a8','#55efc4','#fdcb6e'];

let loans = [
  {id:0,name:'Loan A',balance:7500.00,rate:6.39,type:'Unsubsidized',accrued:246.63},
  {id:1,name:'Loan B',balance:7500.00,rate:6.53,type:'Unsubsidized',accrued:738.03},
  {id:2,name:'Loan C',balance:6500.00,rate:5.50,type:'Unsubsidized',accrued:892.56},
  {id:3,name:'Loan D',balance:3500.00,rate:4.99,type:'Subsidized',accrued:0},
  {id:4,name:'Loan E',balance:2000.00,rate:4.99,type:'Unsubsidized',accrued:265.79},
];
let nextId = 5;
let strategy = 'avalanche';
let chartInstance = null;
let activeTab = 'chart';

function fmt(n){return '$'+Math.abs(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}
function fmtI(n){return '$'+Math.round(Math.abs(n)).toLocaleString('en-US')}

function gracePeriodMonths(){
  const el = document.getElementById('grace-end');
  const [y,m] = el.value.split('-').map(Number);
  const now = new Date();
  const end = new Date(y,m-1,1);
  const diff = (end - now)/(1000*60*60*24*30.44);
  return Math.max(0, diff);
}

function addLoan(){
  loans.push({id:nextId++,name:`Loan ${String.fromCharCode(65+loans.length)}`,balance:0,rate:5.0,type:'Unsubsidized',accrued:0});
  renderLoans();
  renderPrepay();
  calculate();
}

function removeLoan(id){
  loans = loans.filter(l=>l.id!==id);
  renderLoans();
  renderPrepay();
  calculate();
}

function toggleType(id){
  const l = loans.find(l=>l.id===id);
  if(!l) return;
  l.type = l.type==='Unsubsidized'?'Subsidized':'Unsubsidized';
  renderLoans();
  renderPrepay();
  calculate();
}

function loanVal(id,field,raw){
  const l = loans.find(l=>l.id===id);
  if(!l) return;
  if(field==='name') l.name = raw;
  else if(field==='balance') l.balance = parseFloat(raw)||0;
  else if(field==='rate') l.rate = parseFloat(raw)||0;
  else if(field==='accrued') l.accrued = parseFloat(raw)||0;
  if(field!=='name'){
    renderPrepay();
    calculate();
  }
}

function renderLoans(){
  const el = document.getElementById('loan-list');
  el.innerHTML = loans.map((l,i)=>`
    <div class="loan-card">
      <div class="loan-card-head">
        <div class="loan-dot" style="background:${COLORS[i%COLORS.length]}"></div>
        <input class="loan-name-input" value="${l.name}" oninput="loanVal(${l.id},'name',this.value)">
        <button class="loan-tag ${l.type==='Subsidized'?'tag-sub':'tag-unsub'}" onclick="toggleType(${l.id})" title="Click to toggle">${l.type==='Subsidized'?'Sub':'Unsub'}</button>
        <button class="remove-btn" onclick="removeLoan(${l.id})" title="Remove">×</button>
      </div>
      <div class="loan-fields">
        <div class="field"><label>Balance ($)</label><input type="number" value="${l.balance}" min="0" step="100" oninput="loanVal(${l.id},'balance',this.value)"></div>
        <div class="field"><label>Rate (%)</label><input type="number" value="${l.rate}" min="0" max="30" step="0.01" oninput="loanVal(${l.id},'rate',this.value)"></div>
        <div class="field" style="grid-column:1/-1"><label>Accrued interest already ($)</label><input type="number" value="${l.accrued}" min="0" step="10" oninput="loanVal(${l.id},'accrued',this.value)" placeholder="0 = not yet accrued"></div>
      </div>
    </div>
  `).join('');
}

function renderPrepay(){
  const el = document.getElementById('prepay-list');
  el.innerHTML = loans.map((l,i)=>`
    <div class="prepay-row">
      <div class="prepay-dot dot" style="background:${COLORS[i%COLORS.length]}"></div>
      <span class="prepay-name">${l.name}</span>
      <input class="prepay-input" type="number" id="pp-${l.id}" value="0" min="0" step="100" oninput="updatePrepay()">
    </div>
  `).join('');
  updatePrepay();
}

function getPrepay(){return loans.map(l=>parseFloat(document.getElementById('pp-'+l.id)?.value)||0)}
function getBudget(){return parseFloat(document.getElementById('budget-input').value)||0}

function updatePrepay(){
  const vals = getPrepay();
  const total = vals.reduce((a,b)=>a+b,0);
  const budget = getBudget();
  const pct = Math.min(100,total/budget*100)||0;
  const fill = document.getElementById('budget-fill');
  const warn = document.getElementById('budget-warn');
  fill.style.width = pct+'%';
  fill.classList.toggle('over', total > budget+0.01);
  warn.style.display = total > budget+0.01 ? 'block' : 'none';
  document.getElementById('budget-used').textContent = fmt(total)+' used';
  document.getElementById('budget-left').textContent = fmt(Math.max(0,budget-total))+' left';
  calculate();
}

function autoAlloc(mode){
  const budget = getBudget();
  const allocs = loans.map(()=>0);
  const gm = gracePeriodMonths();
  if(mode==='clear'){loans.forEach(l=>{const el=document.getElementById('pp-'+l.id);if(el)el.value=0});updatePrepay();return}
  let rem = budget;
  if(mode==='interest'){
    loans.forEach((l,i)=>{
      if(l.type==='Unsubsidized'&&rem>0){
        const int=(l.balance+l.accrued)*l.rate/100/365*gm*30.44;
        const pay=Math.min(int,rem);
        allocs[i]=Math.round(pay);rem-=pay;
      }
    });
  } else if(mode==='avalanche'){
    const order=[...loans].sort((a,b)=>b.rate-a.rate);
    for(const l of order){if(rem<=0)break;const i=loans.findIndex(x=>x.id===l.id);const pay=Math.min(l.balance+l.accrued,rem);allocs[i]=Math.round(pay);rem-=pay;}
  } else if(mode==='snowball'){
    const order=[...loans].sort((a,b)=>a.balance-b.balance);
    for(const l of order){if(rem<=0)break;const i=loans.findIndex(x=>x.id===l.id);const pay=Math.min(l.balance+l.accrued,rem);allocs[i]=Math.round(pay);rem-=pay;}
  } else if(mode==='one'){
    const top=[...loans].sort((a,b)=>b.rate-a.rate)[0];
    const i=loans.findIndex(x=>x.id===top.id);allocs[i]=Math.min(Math.round(top.balance+top.accrued),budget);
  }
  loans.forEach((l,i)=>{const el=document.getElementById('pp-'+l.id);if(el)el.value=allocs[i];});
  updatePrepay();
}

function setStrategy(s){
  strategy=s;
  ['avalanche','snowball','order'].forEach(x=>document.getElementById('sp-'+x).classList.toggle('active',x===s));
  calculate();
}

function syncMonthly(v){
  document.getElementById('monthly-display').textContent='$'+v;
  document.getElementById('monthly-input').value=v;
  calculate();
}
function syncMonthlyInput(v){
  const n=Math.max(0,Math.min(5000,parseFloat(v)||0));
  document.getElementById('monthly-slider').value=Math.min(2000,n);
  document.getElementById('monthly-display').textContent='$'+n;
  calculate();
}

function switchTab(t,btn){
  activeTab=t;
  ['chart','breakdown','schedule','grace'].forEach(x=>{
    document.getElementById('panel-'+x).style.display=x===t?'block':'none';
  });
  document.querySelectorAll('.tab').forEach(el=>el.classList.remove('active'));
  if(btn)btn.classList.add('active');
}

function getPayOrder(balances){
  const idx=loans.map((_,i)=>i).filter(i=>balances[i]>0.01);
  if(strategy==='avalanche')return idx.sort((a,b)=>loans[b].rate-loans[a].rate);
  if(strategy==='snowball')return idx.sort((a,b)=>balances[a]-balances[b]);
  return idx;
}

function calculate(){
  if(!loans.length) return;
  const pp = getPrepay();
  const totalPP = pp.reduce((a,b)=>a+b,0);
  const budget = getBudget();
  if(totalPP > budget+0.01) return;

  const monthly = parseFloat(document.getElementById('monthly-input').value)||0;
  const extra = parseFloat(document.getElementById('extra-payment').value)||0;
  const totalMonthly = monthly + extra;

  const gm = gracePeriodMonths();
  const el = document.getElementById('grace-end');
  const [gy,gmo] = el.value.split('-').map(Number);
  const graceDays = gm * 30.44;
  document.getElementById('grace-months-label').textContent = gm.toFixed(1)+'mo away';

  // grace interest per loan
  const graceInterest = loans.map(l=>
    l.type==='Unsubsidized' ? (l.balance + l.accrued) * l.rate/100/365 * graceDays : 0
  );

  // start balance after grace + prepay
  const startBal = loans.map((l,i)=>Math.max(0, l.balance + l.accrued + graceInterest[i] - pp[i]));

  let balances = [...startBal];
  const rates = loans.map(l=>l.rate/100/12);
  let totalInterest=0, months=0;
  const history=[];
  const perLoanInt=loans.map(()=>0);
  const paidOff=loans.map(()=>null);
  const perLoanPaid=loans.map(()=>0);
  const maxMonths=480;

  while(balances.some(b=>b>0.01)&&months<maxMonths){
    months++;
    const intThisMonth=balances.map((b,i)=>b>0?b*rates[i]:0);
    balances=balances.map((b,i)=>b>0?b+intThisMonth[i]:0);
    intThisMonth.forEach((v,i)=>{perLoanInt[i]+=v;});
    totalInterest+=intThisMonth.reduce((a,b)=>a+b,0);

    let rem=Math.min(totalMonthly,balances.reduce((a,b)=>a+b,0));
    const order=getPayOrder(balances);
    for(const idx of order){
      if(rem<=0)break;
      if(balances[idx]<=0)continue;
      const pay=Math.min(balances[idx],rem);
      perLoanPaid[idx]+=pay;
      balances[idx]=Math.max(0,balances[idx]-pay);
      rem-=pay;
      if(balances[idx]<0.01&&paidOff[idx]===null)paidOff[idx]=months;
    }
    history.push([...balances]);
  }

  const stuck=balances.some(b=>b>0.01);
  const yrs=Math.floor(months/12), mos=months%12;
  const timeStr=stuck?'30+ years':(yrs>0?yrs+'y ':'')+mos+'m';
  const totalStartBal=loans.reduce((a,l,i)=>a+l.balance+l.accrued,0);
  const allGrace=graceInterest.reduce((a,b)=>a+b,0);
  const totalPaid=totalPP+totalMonthly*months-(balances.reduce((a,b)=>a+b,0));

  // metrics
  document.getElementById('metrics').innerHTML=`
    <div class="metric"><div class="metric-label">Payoff time</div><div class="metric-val amber">${timeStr}</div><div class="metric-sub">from repayment start</div></div>
    <div class="metric"><div class="metric-label">Total interest</div><div class="metric-val red">${fmtI(totalInterest+allGrace)}</div><div class="metric-sub">grace + repayment</div></div>
    <div class="metric"><div class="metric-label">Total paid</div><div class="metric-val">${fmtI(totalPP+totalMonthly*months+allGrace)}</div><div class="metric-sub">all in</div></div>
    <div class="metric"><div class="metric-label">Grace interest</div><div class="metric-val red">${fmtI(allGrace)}</div><div class="metric-sub">accruing now</div></div>
    <div class="metric"><div class="metric-label">Monthly total</div><div class="metric-val green">${fmtI(totalMonthly)}</div><div class="metric-sub">per month</div></div>
  `;

  renderChart(history, months, startBal);
  renderBreakdown(startBal, perLoanInt, paidOff, graceInterest, pp, perLoanPaid);
  renderSchedule(history, months, totalMonthly, startBal);
  renderGrace(graceInterest, pp, gm, startBal);
}

function renderChart(history, months, startBal){
  const step = Math.max(1,Math.floor(months/80));
  const labels=['Now'];
  const datasets = loans.map((l,i)=>({
    label:l.name, data:[parseFloat(startBal[i].toFixed(0))],
    borderColor:COLORS[i%COLORS.length], backgroundColor:'transparent',
    borderWidth:2, pointRadius:0, tension:0.3
  }));
  for(let m=step;m<=months;m+=step){
    const row=history[Math.min(m-1,history.length-1)]||[];
    labels.push(m<12?m+'mo':Math.floor(m/12)+'y'+(m%12?m%12+'m':''));
    loans.forEach((_,i)=>datasets[i].data.push(parseFloat((Math.max(0,row[i]||0)).toFixed(0))));
  }
  const legend=document.getElementById('chart-legend');
  legend.innerHTML=loans.map((l,i)=>`<div class="legend-item"><div class="legend-dot" style="background:${COLORS[i%COLORS.length]}"></div>${l.name}</div>`).join('');
  if(chartInstance)chartInstance.destroy();
  chartInstance=new Chart(document.getElementById('mainChart'),{
    type:'line',data:{labels,datasets},
    options:{
      responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false}},
      scales:{
        y:{ticks:{callback:v=>'$'+Math.round(v).toLocaleString(),color:'#6b7080',font:{family:'DM Mono',size:10}},
           grid:{color:'rgba(255,255,255,0.04)'},border:{display:false}},
        x:{ticks:{maxTicksLimit:12,maxRotation:0,color:'#6b7080',font:{family:'DM Mono',size:10}},
           grid:{display:false},border:{display:false}}
      }
    }
  });
}

function renderBreakdown(startBal, perLoanInt, paidOff, graceInt, pp, perLoanPaid){
  const tbl=document.getElementById('breakdown-table');
  tbl.innerHTML=`<tr><th>Loan</th><th>Type</th><th>Original</th><th>Accrued (entered)</th><th>Grace interest</th><th>After prepay</th><th>Interest paid</th><th>Paid off in</th></tr>`;
  loans.forEach((l,i)=>{
    const mos=paidOff[i];
    const po=mos===null?'Pending':mos<12?mos+'mo':`${Math.floor(mos/12)}y ${mos%12}m`;
    tbl.innerHTML+=`<tr>
      <td style="color:${COLORS[i%COLORS.length]};font-weight:500">${l.name}</td>
      <td><span class="badge" style="background:${l.type==='Subsidized'?'rgba(255,209,102,0.15)':'rgba(79,255,176,0.1)'};color:${l.type==='Subsidized'?'#ffd166':'#4fffb0'}">${l.type}</span></td>
      <td>${fmt(l.balance)}</td>
      <td style="color:#ff6b6b">${l.accrued>0?'+'+fmt(l.accrued):'-'}</td>
      <td style="color:#ff6b6b">${l.type==='Unsubsidized'?'+'+fmt(graceInt[i]):'-'}</td>
      <td>${fmt(startBal[i])}</td>
      <td style="color:#ff6b6b">${fmt(perLoanInt[i])}</td>
      <td>${po}</td>
    </tr>`;
  });
}

function renderSchedule(history, months, totalMonthly, startBal){
  const tbl=document.getElementById('schedule-table');
  tbl.innerHTML=`<tr><th>Year</th><th>Total balance</th><th>Interest paid</th><th>Principal paid</th><th>Progress</th></tr>`;
  let prevBal=startBal.reduce((a,b)=>a+b,0);
  for(let y=1;y<=Math.min(Math.ceil(months/12),40);y++){
    const mIdx=y*12-1;
    const row=history[Math.min(mIdx,history.length-1)]||[];
    const bal=row.reduce((a,b)=>a+b,0);
    const pmt=totalMonthly*12;
    const drop=Math.max(0,prevBal-bal);
    const int=Math.max(0,pmt-drop);
    const pct=Math.round((1-bal/(startBal.reduce((a,b)=>a+b,0)||1))*100);
    tbl.innerHTML+=`<tr>
      <td>Year ${y}</td>
      <td>${fmtI(bal)}</td>
      <td style="color:#ff6b6b">${fmtI(int)}</td>
      <td style="color:#4fffb0">${fmtI(drop)}</td>
      <td><div style="display:flex;align-items:center;gap:8px"><div style="width:80px;height:4px;background:rgba(255,255,255,0.1);border-radius:2px"><div style="width:${pct}%;height:100%;border-radius:2px;background:#4fffb0"></div></div><span style="font-size:11px;color:#6b7080">${pct}%</span></div></td>
    </tr>`;
    prevBal=bal;
    if(bal<1)break;
  }
}

function renderGrace(graceInterest, pp, gm, startBal){
  const tbl=document.getElementById('grace-table');
  tbl.innerHTML=`<tr><th>Loan</th><th>Type</th><th>Principal</th><th>Accrued (already)</th><th>Grace months</th><th>Grace interest</th><th>Prepayment</th><th>Balance at repayment</th></tr>`;
  loans.forEach((l,i)=>{
    const sub=l.type==='Subsidized';
    tbl.innerHTML+=`<tr>
      <td style="color:${COLORS[i%COLORS.length]}">${l.name}</td>
      <td><span class="badge" style="background:${sub?'rgba(255,209,102,0.15)':'rgba(79,255,176,0.1)'};color:${sub?'#ffd166':'#4fffb0'}">${l.type}</span></td>
      <td>${fmt(l.balance)}</td>
      <td style="color:${l.accrued>0?'#ff6b6b':'#6b7080'}">${l.accrued>0?'+'+fmt(l.accrued):'—'}</td>
      <td style="color:#6b7080">${sub?'N/A':gm.toFixed(1)+' mo'}</td>
      <td style="color:${sub?'#6b7080':'#ff6b6b'}">${sub?'—':'+'+fmt(graceInterest[i])}</td>
      <td style="color:${pp[i]>0?'#4fffb0':'#6b7080'}">${pp[i]>0?'-'+fmt(pp[i]):'—'}</td>
      <td style="font-weight:500">${fmt(startBal[i])}</td>
    </tr>`;
  });
}

// init
renderLoans();
renderPrepay();
calculate();
