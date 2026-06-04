// ── Colors assigned to each loan ──────────────────────────────────────────────
const COLORS = ['#1a6b3c','#c00','#c47000','#1155aa','#7b3fa0','#b5006e','#00796b','#5d4037'];

// ── Loan data ─────────────────────────────────────────────────────────────────
let loans = [
  { id: 0, name: 'Loan A', balance: 7500.00, rate: 6.39, type: 'Unsubsidized', accrued: 246.63 },
  { id: 1, name: 'Loan B', balance: 7500.00, rate: 6.53, type: 'Unsubsidized', accrued: 738.03 },
  { id: 2, name: 'Loan C', balance: 6500.00, rate: 5.50, type: 'Unsubsidized', accrued: 892.56 },
  { id: 3, name: 'Loan D', balance: 3500.00, rate: 4.99, type: 'Subsidized',   accrued: 0      },
  { id: 4, name: 'Loan E', balance: 2000.00, rate: 4.99, type: 'Unsubsidized', accrued: 265.79 },
];
let nextId = 5;
let strategy = 'avalanche';
let chart = null;


// ── Formatting helpers ────────────────────────────────────────────────────────
function dollars(n) {
  return '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function dollarsRounded(n) {
  return '$' + Math.round(Math.abs(n)).toLocaleString('en-US');
}


// ── Grace period: months remaining from today ─────────────────────────────────
function graceMonthsRemaining() {
  const [year, month] = document.getElementById('grace-end').value.split('-').map(Number);
  const msPerMonth = 1000 * 60 * 60 * 24 * 30.44;
  const diff = (new Date(year, month - 1, 1) - new Date()) / msPerMonth;
  return Math.max(0, diff);
}


// ── Get current input values ──────────────────────────────────────────────────
function getBudget()   { return parseFloat(document.getElementById('budget-input').value) || 0; }
function getMonthly()  { return parseFloat(document.getElementById('monthly-input').value) || 0; }
function getExtra()    { return parseFloat(document.getElementById('extra-payment').value) || 0; }
function getPrepayments() {
  return loans.map(l => parseFloat(document.getElementById('pp-' + l.id)?.value) || 0);
}


// ── Loan CRUD ─────────────────────────────────────────────────────────────────
function addLoan() {
  loans.push({
    id: nextId++,
    name: 'Loan ' + String.fromCharCode(65 + loans.length),
    balance: 0, rate: 5.0, type: 'Unsubsidized', accrued: 0,
  });
  refresh();
}

function removeLoan(id) {
  loans = loans.filter(l => l.id !== id);
  refresh();
}

function toggleType(id) {
  const l = loans.find(l => l.id === id);
  if (l) l.type = l.type === 'Unsubsidized' ? 'Subsidized' : 'Unsubsidized';
  refresh();
}

function updateLoan(id, field, value) {
  const l = loans.find(l => l.id === id);
  if (!l) return;
  if (field === 'name')    l.name    = value;
  if (field === 'balance') l.balance = parseFloat(value) || 0;
  if (field === 'rate')    l.rate    = parseFloat(value) || 0;
  if (field === 'accrued') l.accrued = parseFloat(value) || 0;
  if (field !== 'name') refresh();
}

// Re-render sidebar loan list and prepay inputs, then recalculate
function refresh() {
  renderLoanList();
  renderPrepayList();
  calculate();
}


// ── Render sidebar loan cards ─────────────────────────────────────────────────
function renderLoanList() {
  document.getElementById('loan-list').innerHTML = loans.map((l, i) => `
    <div class="loan-card">
      <div class="loan-card-head">
        <div class="loan-dot" style="background:${COLORS[i % COLORS.length]}"></div>
        <input class="loan-name-input" value="${l.name}"
          oninput="updateLoan(${l.id},'name',this.value)">
        <button class="loan-tag ${l.type === 'Subsidized' ? 'tag-sub' : 'tag-unsub'}"
          onclick="toggleType(${l.id})" title="Click to toggle type">
          ${l.type === 'Subsidized' ? 'Sub' : 'Unsub'}
        </button>
        <button class="remove-btn" onclick="removeLoan(${l.id})">×</button>
      </div>
      <div class="loan-fields">
        <div class="field">
          <label>Balance ($)</label>
          <input type="number" value="${l.balance}" min="0" step="100"
            oninput="updateLoan(${l.id},'balance',this.value)">
        </div>
        <div class="field">
          <label>Rate (%)</label>
          <input type="number" value="${l.rate}" min="0" max="30" step="0.01"
            oninput="updateLoan(${l.id},'rate',this.value)">
        </div>
        <div class="field" style="grid-column:1/-1">
          <label>Already accrued interest ($)</label>
          <input type="number" value="${l.accrued}" min="0" step="10"
            oninput="updateLoan(${l.id},'accrued',this.value)"
            placeholder="Enter amount shown on servicer">
        </div>
      </div>
    </div>
  `).join('');
}


// ── Render prepayment inputs ──────────────────────────────────────────────────
function renderPrepayList() {
  document.getElementById('prepay-list').innerHTML = loans.map((l, i) => `
    <div class="prepay-row">
      <div class="loan-dot" style="background:${COLORS[i % COLORS.length]}"></div>
      <span class="prepay-name">${l.name}</span>
      <input class="prepay-input" type="number" id="pp-${l.id}"
        value="0" min="0" step="100" oninput="updateBudgetBar()">
    </div>
  `).join('');
  updateBudgetBar();
}

function updateBudgetBar() {
  const total  = getPrepayments().reduce((a, b) => a + b, 0);
  const budget = getBudget();
  const pct    = budget > 0 ? Math.min(100, total / budget * 100) : 0;
  const over   = total > budget + 0.01;

  const fill = document.getElementById('budget-fill');
  fill.style.width = pct + '%';
  fill.classList.toggle('over', over);

  document.getElementById('budget-warn').style.display = over ? 'block' : 'none';
  document.getElementById('budget-used').textContent = dollars(total) + ' used';
  document.getElementById('budget-left').textContent = dollars(Math.max(0, budget - total)) + ' left';

  calculate();
}


// ── Auto-allocate prepayment budget ──────────────────────────────────────────
function autoAlloc(mode) {
  const budget = getBudget();
  const allocs = loans.map(() => 0);
  const gm     = graceMonthsRemaining();

  if (mode === 'clear') {
    loans.forEach(l => { const el = document.getElementById('pp-' + l.id); if (el) el.value = 0; });
    updateBudgetBar();
    return;
  }

  let remaining = budget;
  let ordered;

  if (mode === 'avalanche') {
    ordered = [...loans].sort((a, b) => b.rate - a.rate);
  } else if (mode === 'snowball') {
    ordered = [...loans].sort((a, b) => a.balance - b.balance);
  } else if (mode === 'one') {
    ordered = [[...loans].sort((a, b) => b.rate - a.rate)[0]];
  }

  if (mode === 'interest') {
    // Only cover the interest that will accrue during grace period
    loans.forEach((l, i) => {
      if (l.type === 'Unsubsidized' && remaining > 0) {
        const graceInterest = (l.balance + l.accrued) * l.rate / 100 / 365 * gm * 30.44;
        const pay = Math.min(graceInterest, remaining);
        allocs[i] = Math.round(pay);
        remaining -= pay;
      }
    });
  } else {
    for (const l of ordered) {
      if (remaining <= 0) break;
      const i   = loans.findIndex(x => x.id === l.id);
      const pay = Math.min(l.balance + l.accrued, remaining);
      allocs[i] = Math.round(pay);
      remaining -= pay;
    }
  }

  loans.forEach((l, i) => {
    const el = document.getElementById('pp-' + l.id);
    if (el) el.value = allocs[i];
  });
  updateBudgetBar();
}


// ── Strategy & payment sync ───────────────────────────────────────────────────
function setStrategy(s) {
  strategy = s;
  ['avalanche', 'snowball', 'order'].forEach(id =>
    document.getElementById('sp-' + id).classList.toggle('active', id === s)
  );
  calculate();
}

function syncSlider(value) {
  document.getElementById('monthly-display').textContent = '$' + value;
  document.getElementById('monthly-input').value = value;
  calculate();
}

function syncInput(value) {
  const n = Math.max(0, Math.min(5000, parseFloat(value) || 0));
  document.getElementById('monthly-slider').value = Math.min(2000, n);
  document.getElementById('monthly-display').textContent = '$' + n;
  calculate();
}


// ── Tab switching ─────────────────────────────────────────────────────────────
function switchTab(name, btn) {
  ['chart', 'breakdown', 'schedule', 'grace'].forEach(t => {
    document.getElementById('panel-' + t).style.display = t === name ? 'block' : 'none';
  });
  document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
  if (btn) btn.classList.add('active');
}


// ── Core simulation ───────────────────────────────────────────────────────────

// Returns sorted loan indices for payment this month based on strategy
function paymentOrder(balances) {
  const active = loans.map((_, i) => i).filter(i => balances[i] > 0.01);
  if (strategy === 'avalanche') return active.sort((a, b) => loans[b].rate - loans[a].rate);
  if (strategy === 'snowball')  return active.sort((a, b) => balances[a] - balances[b]);
  return active; // in-order
}

function calculate() {
  if (!loans.length) return;

  const prepay      = getPrepayments();
  const totalPrepay = prepay.reduce((a, b) => a + b, 0);
  const budget      = getBudget();
  if (totalPrepay > budget + 0.01) return; // over budget, skip

  const monthlyPayment = getMonthly() + getExtra();
  const gm             = graceMonthsRemaining();
  const graceDays      = gm * 30.44;

  document.getElementById('grace-months-label').textContent = gm.toFixed(1) + ' mo away';

  // Interest accrued on unsubsidized loans during grace period
  // Subsidized loans: $0 during grace period (government covers it)
  const graceInterest = loans.map(l =>
    l.type === 'Unsubsidized'
      ? (l.balance + l.accrued) * l.rate / 100 / 365 * graceDays
      : 0
  );

  // Starting balance when repayment begins:
  // original balance + already-accrued interest + grace period interest - prepayment
  const startBalance = loans.map((l, i) =>
    Math.max(0, l.balance + l.accrued + graceInterest[i] - prepay[i])
  );

  // ── Run month-by-month simulation ──
  let balances      = [...startBalance];
  const monthlyRate = loans.map(l => l.rate / 100 / 12);
  let totalInterest = 0;
  let months        = 0;
  const history     = [];                    // balance snapshot each month
  const interestPerLoan = loans.map(() => 0);
  const paidOffMonth    = loans.map(() => null);
  const MAX_MONTHS  = 480; // 40 years cap

  while (balances.some(b => b > 0.01) && months < MAX_MONTHS) {
    months++;

    // Add monthly interest to each loan balance
    const interest = balances.map((b, i) => b > 0 ? b * monthlyRate[i] : 0);
    balances = balances.map((b, i) => b > 0 ? b + interest[i] : 0);
    interest.forEach((v, i) => { interestPerLoan[i] += v; });
    totalInterest += interest.reduce((a, b) => a + b, 0);

    // Apply payment, directing extra to target loan(s) per strategy
    let remaining = Math.min(monthlyPayment, balances.reduce((a, b) => a + b, 0));
    for (const i of paymentOrder(balances)) {
      if (remaining <= 0) break;
      const paid = Math.min(balances[i], remaining);
      balances[i] = Math.max(0, balances[i] - paid);
      remaining  -= paid;
      if (balances[i] < 0.01 && paidOffMonth[i] === null) paidOffMonth[i] = months;
    }

    history.push([...balances]);
  }

  // ── Summarize results ──
  const stuck        = balances.some(b => b > 0.01);
  const years        = Math.floor(months / 12);
  const remMonths    = months % 12;
  const timeLabel    = stuck ? '30+ years' : (years > 0 ? years + 'y ' : '') + remMonths + 'm';
  const totalGrace   = graceInterest.reduce((a, b) => a + b, 0);

  renderMetrics(timeLabel, totalInterest, totalGrace, totalPrepay, monthlyPayment, months);
  renderChart(history, months, startBalance);
  renderBreakdownTable(startBalance, interestPerLoan, paidOffMonth, graceInterest, prepay);
  renderScheduleTable(history, months, monthlyPayment, startBalance);
  renderGraceTable(graceInterest, prepay, gm, startBalance);
}


// ── Render metrics bar ────────────────────────────────────────────────────────
function renderMetrics(timeLabel, totalInterest, totalGrace, totalPrepay, monthlyPayment, months) {
  document.getElementById('metrics').innerHTML = `
    <div class="metric">
      <div class="metric-label">Payoff time</div>
      <div class="metric-val amber">${timeLabel}</div>
      <div class="metric-sub">from repayment start</div>
    </div>
    <div class="metric">
      <div class="metric-label">Total interest</div>
      <div class="metric-val red">${dollarsRounded(totalInterest + totalGrace)}</div>
      <div class="metric-sub">grace + repayment</div>
    </div>
    <div class="metric">
      <div class="metric-label">Total paid</div>
      <div class="metric-val">${dollarsRounded(totalPrepay + monthlyPayment * months + totalGrace)}</div>
      <div class="metric-sub">all in</div>
    </div>
    <div class="metric">
      <div class="metric-label">Grace interest</div>
      <div class="metric-val red">${dollarsRounded(totalGrace)}</div>
      <div class="metric-sub">accruing now</div>
    </div>
    <div class="metric">
      <div class="metric-label">Monthly payment</div>
      <div class="metric-val green">${dollarsRounded(monthlyPayment)}</div>
      <div class="metric-sub">per month</div>
    </div>
  `;
}


// ── Render balance-over-time chart ────────────────────────────────────────────
function renderChart(history, months, startBalance) {
  const step   = Math.max(1, Math.floor(months / 80));
  const labels = ['Now'];
  const datasets = loans.map((l, i) => ({
    label: l.name,
    data: [Math.round(startBalance[i])],
    borderColor: COLORS[i % COLORS.length],
    backgroundColor: 'transparent',
    borderWidth: 2,
    pointRadius: 0,
    tension: 0.3,
  }));

  for (let m = step; m <= months; m += step) {
    const row = history[Math.min(m - 1, history.length - 1)] || [];
    labels.push(m < 12 ? m + 'mo' : Math.floor(m / 12) + 'y' + (m % 12 ? m % 12 + 'm' : ''));
    loans.forEach((_, i) => datasets[i].data.push(Math.max(0, Math.round(row[i] || 0))));
  }

  document.getElementById('chart-legend').innerHTML = loans.map((l, i) => `
    <div class="legend-item">
      <div class="legend-dot" style="background:${COLORS[i % COLORS.length]}"></div>
      ${l.name}
    </div>
  `).join('');

  if (chart) chart.destroy();
  chart = new Chart(document.getElementById('mainChart'), {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          ticks: { callback: v => '$' + Math.round(v).toLocaleString(), color: '#888', font: { size: 11 } },
          grid: { color: '#eee' },
          border: { display: false },
        },
        x: {
          ticks: { maxTicksLimit: 12, maxRotation: 0, color: '#888', font: { size: 11 } },
          grid: { display: false },
          border: { display: false },
        },
      },
    },
  });
}


// ── Render per-loan breakdown table ──────────────────────────────────────────
function renderBreakdownTable(startBalance, interestPerLoan, paidOffMonth, graceInterest, prepay) {
  const tbl = document.getElementById('breakdown-table');
  tbl.innerHTML = `<tr>
    <th>Loan</th><th>Type</th><th>Original</th><th>Accrued (entered)</th>
    <th>Grace interest</th><th>Balance at repayment</th><th>Interest paid</th><th>Paid off in</th>
  </tr>`;

  loans.forEach((l, i) => {
    const m  = paidOffMonth[i];
    const po = m === null ? 'Pending' : m < 12 ? m + 'mo' : Math.floor(m / 12) + 'y ' + m % 12 + 'm';
    const subBg    = l.type === 'Subsidized' ? '#fff8e1' : '#e8f5e9';
    const subColor = l.type === 'Subsidized' ? '#c47000' : '#1a6b3c';
    const subBorder= l.type === 'Subsidized' ? '#ffe082' : '#a5d6a7';

    tbl.innerHTML += `<tr>
      <td style="color:${COLORS[i % COLORS.length]};font-weight:bold">${l.name}</td>
      <td><span class="badge" style="background:${subBg};color:${subColor};border-color:${subBorder}">${l.type}</span></td>
      <td>${dollars(l.balance)}</td>
      <td style="color:#c00">${l.accrued > 0 ? '+' + dollars(l.accrued) : '—'}</td>
      <td style="color:#c00">${l.type === 'Unsubsidized' ? '+' + dollars(graceInterest[i]) : '—'}</td>
      <td>${dollars(startBalance[i])}</td>
      <td style="color:#c00">${dollars(interestPerLoan[i])}</td>
      <td>${po}</td>
    </tr>`;
  });
}


// ── Render year-by-year schedule table ───────────────────────────────────────
function renderScheduleTable(history, months, monthlyPayment, startBalance) {
  const tbl        = document.getElementById('schedule-table');
  const totalStart = startBalance.reduce((a, b) => a + b, 0);

  tbl.innerHTML = `<tr>
    <th>Year</th><th>Remaining balance</th><th>Interest paid</th><th>Principal paid</th><th>Progress</th>
  </tr>`;

  let prevBalance = totalStart;
  for (let y = 1; y <= Math.min(Math.ceil(months / 12), 40); y++) {
    const row     = history[Math.min(y * 12 - 1, history.length - 1)] || [];
    const balance = row.reduce((a, b) => a + b, 0);
    const paid    = monthlyPayment * 12;
    const principal = Math.max(0, prevBalance - balance);
    const interest  = Math.max(0, paid - principal);
    const pct       = Math.round((1 - balance / (totalStart || 1)) * 100);

    tbl.innerHTML += `<tr>
      <td>Year ${y}</td>
      <td>${dollarsRounded(balance)}</td>
      <td style="color:#c00">${dollarsRounded(interest)}</td>
      <td style="color:#2e7d32">${dollarsRounded(principal)}</td>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <div style="width:80px;height:4px;background:#eee;border-radius:2px">
            <div style="width:${pct}%;height:100%;border-radius:2px;background:#2e7d32"></div>
          </div>
          <span style="font-size:11px;color:#888">${pct}%</span>
        </div>
      </td>
    </tr>`;

    prevBalance = balance;
    if (balance < 1) break;
  }
}


// ── Render grace period detail table ─────────────────────────────────────────
function renderGraceTable(graceInterest, prepay, graceMonths, startBalance) {
  const tbl = document.getElementById('grace-table');
  tbl.innerHTML = `<tr>
    <th>Loan</th><th>Type</th><th>Principal</th><th>Accrued (already)</th>
    <th>Grace months</th><th>Grace interest</th><th>Prepayment</th><th>Balance at repayment</th>
  </tr>`;

  loans.forEach((l, i) => {
    const sub      = l.type === 'Subsidized';
    const subBg    = sub ? '#fff8e1' : '#e8f5e9';
    const subColor = sub ? '#c47000' : '#1a6b3c';
    const subBorder= sub ? '#ffe082' : '#a5d6a7';

    tbl.innerHTML += `<tr>
      <td style="color:${COLORS[i % COLORS.length]};font-weight:bold">${l.name}</td>
      <td><span class="badge" style="background:${subBg};color:${subColor};border-color:${subBorder}">${l.type}</span></td>
      <td>${dollars(l.balance)}</td>
      <td style="color:${l.accrued > 0 ? '#c00' : '#888'}">${l.accrued > 0 ? '+' + dollars(l.accrued) : '—'}</td>
      <td>${sub ? 'N/A' : graceMonths.toFixed(1) + ' mo'}</td>
      <td style="color:${sub ? '#888' : '#c00'}">${sub ? '—' : '+' + dollars(graceInterest[i])}</td>
      <td style="color:${prepay[i] > 0 ? '#2e7d32' : '#888'}">${prepay[i] > 0 ? '−' + dollars(prepay[i]) : '—'}</td>
      <td style="font-weight:bold">${dollars(startBalance[i])}</td>
    </tr>`;
  });
}


// ── Init on page load ─────────────────────────────────────────────────────────
renderLoanList();
renderPrepayList();
calculate();
