const WEEKS_PER_YEAR = 52;
const MONTHS_PER_YEAR = 12;
const TWO_YEAR_MONTHS = 24;
const STORAGE_KEY = 'movingBudgetPlanner.v1';
const CLOUD_COLLECTION = 'sharedBudget';
const CLOUD_DOC = 'main';
const SAVE_DEBOUNCE_MS = 800;

let householdSize = 1;
let nextExpenseIds = [8, 8];
let nextSurvivalId = 8;
let currentUser = null;
let saveDebounceTimer = null;

let people = [
  { id: 'Adam', label: 'Adam', salary: 46000, taxRate: 22 },
  { id: 'Alisha', label: 'Alisha', salary: 37440, taxRate: 20 }
];

function defaultExpenses() {
  return [
    { id: 0, name: 'Rent', amount: 1800, period: 'monthly' },
    { id: 1, name: 'Groceries', amount: 160, period: 'weekly' },
    { id: 2, name: 'Gas', amount: 45, period: 'weekly' },
    { id: 3, name: 'Car payment', amount: 350, period: 'monthly' },
    { id: 4, name: 'Car insurance', amount: 160, period: 'monthly' },
    { id: 5, name: 'Loans', amount: 400, period: 'monthly' },
    { id: 6, name: 'Utilities', amount: 220, period: 'monthly' },
    { id: 7, name: 'Phone / internet', amount: 150, period: 'monthly' }
  ];
}

let personExpenses = [
  defaultExpenses(),
  defaultExpenses().map(row => ({ ...row, amount: row.name === 'Rent' ? 0 : row.amount }))
];

let survivalExpenses = [
  { id: 0, name: 'Rent', amount: 1800, period: 'monthly' },
  { id: 1, name: 'Groceries', amount: 700, period: 'monthly' },
  { id: 2, name: 'Gas / transit', amount: 350, period: 'monthly' },
  { id: 3, name: 'Utilities', amount: 250, period: 'monthly' },
  { id: 4, name: 'Car costs', amount: 650, period: 'monthly' },
  { id: 5, name: 'Loans / debt', amount: 500, period: 'monthly' },
  { id: 6, name: 'Insurance / medical', amount: 300, period: 'monthly' },
  { id: 7, name: 'Buffer / misc.', amount: 400, period: 'monthly' }
];

function dollars(value) {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  });
}

function preciseDollars(value) {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function toAnnual(amount, period) {
  const n = parseFloat(amount) || 0;
  if (period === 'weekly') return n * WEEKS_PER_YEAR;
  if (period === 'monthly') return n * MONTHS_PER_YEAR;
  return n;
}

function fromAnnual(annual, period) {
  if (period === 'weekly') return annual / WEEKS_PER_YEAR;
  if (period === 'monthly') return annual / MONTHS_PER_YEAR;
  return annual;
}

/* ---------------- Persistence: local cache + Firestore sync ---------------- */

function firebaseReady() {
  return typeof auth !== 'undefined' && typeof db !== 'undefined';
}

// Firestore does not allow an array nested directly inside another array.
// personExpenses is [ [...], [...] ], so we store/read it as { "0": [...], "1": [...] } instead.
function personExpensesToStorable(pe) {
  return { 0: pe[0] || [], 1: pe[1] || [] };
}

function personExpensesFromStorable(stored) {
  if (Array.isArray(stored)) return stored; // legacy local-cache format
  if (stored && typeof stored === 'object') {
    return [stored['0'] || stored[0] || [], stored['1'] || stored[1] || []];
  }
  return personExpenses;
}

function buildStateObject() {
  const currentSavingsEl = document.getElementById('current-savings');
  const monthsUntilMoveEl = document.getElementById('months-until-move');

  return {
    householdSize,
    nextExpenseIds,
    nextSurvivalId,
    people,
    personExpenses: personExpensesToStorable(personExpenses),
    survivalExpenses,
    currentSavings: currentSavingsEl ? currentSavingsEl.value : '5000',
    monthsUntilMove: monthsUntilMoveEl ? monthsUntilMoveEl.value : '12',
    updatedAt: Date.now()
  };
}

function applyState(state) {
  if (!state || typeof state !== 'object') return;

  if (state.householdSize === 1 || state.householdSize === 2) {
    householdSize = state.householdSize;
  }
  if (Array.isArray(state.nextExpenseIds) && state.nextExpenseIds.length === 2) {
    nextExpenseIds = state.nextExpenseIds;
  }
  if (typeof state.nextSurvivalId === 'number') {
    nextSurvivalId = state.nextSurvivalId;
  }
  if (Array.isArray(state.people) && state.people.length === 2) {
    people = state.people;
  }
  if (state.personExpenses) {
    personExpenses = personExpensesFromStorable(state.personExpenses);
  }
  if (Array.isArray(state.survivalExpenses)) {
    survivalExpenses = state.survivalExpenses;
  }

  if (state.currentSavings !== undefined) {
    const el = document.getElementById('current-savings');
    if (el) el.value = state.currentSavings;
  }
  if (state.monthsUntilMove !== undefined) {
    const el = document.getElementById('months-until-move');
    if (el) el.value = state.monthsUntilMove;
  }
}

function loadFromLocalCache() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) applyState(JSON.parse(raw));
  } catch (err) {
    console.warn('Could not load local budget cache:', err);
  }
}

function saveToLocalCache(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('Could not save local budget cache:', err);
  }
}

function setSyncStatus(text) {
  const el = document.getElementById('sync-status');
  if (el) el.textContent = text;
}

function saveState() {
  const state = buildStateObject();
  saveToLocalCache(state);

  if (!firebaseReady() || !currentUser) return;

  setSyncStatus('Saving…');
  clearTimeout(saveDebounceTimer);
  saveDebounceTimer = setTimeout(() => {
    db.collection(CLOUD_COLLECTION).doc(CLOUD_DOC).set(state)
      .then(() => setSyncStatus('Synced ✓'))
      .catch(err => {
        console.warn('Could not save to Firestore (will retry next change):', err);
        setSyncStatus('Offline — saved locally');
      });
  }, SAVE_DEBOUNCE_MS);
}

async function loadStateFromCloud() {
  if (!firebaseReady() || !currentUser) {
    loadFromLocalCache();
    return;
  }
  try {
    setSyncStatus('Loading…');
    const docSnap = await db.collection(CLOUD_COLLECTION).doc(CLOUD_DOC).get();
    if (docSnap.exists) {
      applyState(docSnap.data());
      setSyncStatus('Synced ✓');
    } else {
      loadFromLocalCache();
      setSyncStatus('No cloud data yet');
    }
  } catch (err) {
    console.warn('Could not load from Firestore, using local cache:', err);
    loadFromLocalCache();
    setSyncStatus('Offline — showing local copy');
  }
}

async function refreshFromCloud() {
  await loadStateFromCloud();
  renderAll();
}

/* ---------------- Auth ---------------- */

function showAuthError(msg) {
  const el = document.getElementById('auth-error');
  if (el) el.textContent = msg;
}

function clearAuthError() {
  const el = document.getElementById('auth-error');
  if (el) el.textContent = '';
}

function handleSignIn() {
  if (!firebaseReady()) return;
  clearAuthError();
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  auth.signInWithEmailAndPassword(email, password).catch(err => showAuthError(err.message));
}

function handleSignUp() {
  if (!firebaseReady()) return;
  clearAuthError();
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  auth.createUserWithEmailAndPassword(email, password).catch(err => showAuthError(err.message));
}

function handleSignOut() {
  if (!firebaseReady()) return;
  auth.signOut();
}

function toggleAppVisibility(isVisible) {
  const authScreen = document.getElementById('auth-screen');
  const appContent = document.getElementById('app-content');
  if (authScreen) authScreen.style.display = isVisible ? 'none' : 'flex';
  if (appContent) appContent.style.display = isVisible ? 'block' : 'none';
}

if (firebaseReady()) {
  auth.onAuthStateChanged(async (user) => {
    currentUser = user;
    if (user) {
      toggleAppVisibility(true);
      await loadStateFromCloud();
      renderAll();
    } else {
      toggleAppVisibility(false);
    }
  });
} else {
  // firebase-config.js hasn't been filled in yet - run in local-only mode
  toggleAppVisibility(true);
  loadFromLocalCache();
}

/* -------------------------------------------------------------- */

function setHouseholdSize(size) {
  householdSize = size;
  renderAll();
}

function activePeople() {
  return people.slice(0, householdSize);
}

function getIncomeTotals(personList = activePeople()) {
  const grossAnnual = personList.reduce((sum, person) => sum + (parseFloat(person.salary) || 0), 0);
  const taxAnnual = personList.reduce((sum, person) => {
    const salary = parseFloat(person.salary) || 0;
    const taxRate = parseFloat(person.taxRate) || 0;
    return sum + salary * (taxRate / 100);
  }, 0);
  const netAnnual = grossAnnual - taxAnnual;

  return {
    grossAnnual,
    taxAnnual,
    netAnnual,
    grossMonthly: grossAnnual / MONTHS_PER_YEAR,
    taxMonthly: taxAnnual / MONTHS_PER_YEAR,
    netMonthly: netAnnual / MONTHS_PER_YEAR,
    netWeekly: netAnnual / WEEKS_PER_YEAR
  };
}

function getExpenseTotals(rows) {
  const annual = rows.reduce((sum, row) => sum + toAnnual(row.amount, row.period), 0);
  return {
    weekly: annual / WEEKS_PER_YEAR,
    monthly: annual / MONTHS_PER_YEAR,
    annual
  };
}

function renderAll() {
  renderHouseholdToggle();
  renderBudgetSections();
  renderSurvivalTable();
  calculateBudget();
}

function renderHouseholdToggle() {
  document.getElementById('one-person-btn').classList.toggle('active', householdSize === 1);
  document.getElementById('two-person-btn').classList.toggle('active', householdSize === 2);
}

function renderBudgetSections() {
  const container = document.getElementById('budget-sections');
  container.className = householdSize === 2 ? 'budget-sections two-person' : 'budget-sections';
  container.innerHTML = activePeople().map((person, index) => renderPersonBudgetSection(person, index)).join('');
}

function renderPersonBudgetSection(person, index) {
  const title = householdSize === 1 ? 'Your Budget' : `${person.label || `Person ${index + 1}`} Budget`;

  return `
    <section class="person-budget">
      <div class="person-budget-title">
        <h2 id="person-budget-title-${index}">${title}</h2>
      </div>

      <section class="panel income-panel">
        <div class="panel-head">
          <div>
            <h2>Income</h2>
            <p>Annual salary and estimated tax withholding.</p>
          </div>
        </div>
        ${renderPersonInputs(person, index)}
      </section>

      <section class="metrics" id="summary-metrics-${index}"></section>

      <section class="panel">
        <div class="panel-head">
          <div>
            <h2>Current Expense Plan</h2>
            <p id="person-expense-note-${index}">${householdSize === 1 ? 'Your expenses' : `${person.label || `Person ${index + 1}`}'s expenses`} with weekly, monthly, or annual timing.</p>
          </div>
          <button class="btn btn-sm" onclick="addExpense(${index})">+ Add expense</button>
        </div>
        <div class="table-wrap">
          <table class="data-table" id="expenses-table-${index}">${renderExpensesTable(index)}</table>
        </div>
      </section>

      <section class="panel chart-panel">
        <div class="panel-head">
          <div>
            <h2>Expense Charts</h2>
            <p>Same expenses converted into weekly, monthly, and annual views.</p>
          </div>
        </div>
        <div id="expense-charts-${index}" class="chart-grid"></div>
      </section>
    </section>
  `;
}

function renderPersonInputs(person, index) {
  return `
    <div class="person-card">
      <div class="person-title">${householdSize === 1 ? 'Your income' : `Person ${index + 1}`}</div>
      <label>
        Name
        <input type="text" value="${person.label}" oninput="updatePerson(${index}, 'label', this.value)">
      </label>
      <label>
        Annual salary
        <input type="number" min="0" step="1000" value="${person.salary}" oninput="updatePerson(${index}, 'salary', this.value)">
      </label>
      <label>
        Estimated tax %
        <input type="number" min="0" max="60" step="0.5" value="${person.taxRate}" oninput="updatePerson(${index}, 'taxRate', this.value)">
      </label>
    </div>
  `;
}

function updatePerson(index, key, value) {
  const person = people[index];
  if (!person) return;
  person[key] = key === 'label' ? value : parseFloat(value) || 0;
  if (key === 'label') updatePersonLabels(index);
  calculateBudget();
}

function updatePersonLabels(index) {
  const title = document.getElementById(`person-budget-title-${index}`);
  const note = document.getElementById(`person-expense-note-${index}`);
  const label = people[index].label || `Person ${index + 1}`;

  if (title) title.textContent = householdSize === 1 ? 'Your Budget' : `${label} Budget`;
  if (note) note.textContent = householdSize === 1 ? 'Your expenses with weekly, monthly, or annual timing.' : `${label}'s expenses with weekly, monthly, or annual timing.`;
}

function renderExpensesTable(personIndex) {
  return `
    <thead>
      <tr>
        <th>Expense</th>
        <th>Amount</th>
        <th>Pay cycle</th>
        <th>Weekly</th>
        <th>Monthly</th>
        <th>Annual</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      ${personExpenses[personIndex].map(row => renderExpenseRow(row, 'expense', personIndex)).join('')}
    </tbody>
  `;
}

function renderSurvivalTable() {
  document.getElementById('survival-table').innerHTML = `
    <thead>
      <tr>
        <th>Average cost</th>
        <th>Amount</th>
        <th>Pay cycle</th>
        <th>Monthly</th>
        <th>2 years</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      ${survivalExpenses.map(row => renderExpenseRow(row, 'survival', null)).join('')}
    </tbody>
  `;
}

function renderExpenseRow(row, type, personIndex) {
  const annual = toAnnual(row.amount, row.period);
  const isSurvival = type === 'survival';
  const rowKey = isSurvival ? `survival-${row.id}` : `expense-${personIndex}-${row.id}`;
  const handlerPrefix = isSurvival ? `'survival', null` : `'expense', ${personIndex}`;
  return `
    <tr>
      <td>
        <input class="table-input name-input" type="text" value="${row.name}"
          oninput="updateExpense(${handlerPrefix}, ${row.id}, 'name', this.value)">
      </td>
      <td>
        <input class="table-input amount-input" type="number" min="0" step="10" value="${row.amount}"
          oninput="updateExpense(${handlerPrefix}, ${row.id}, 'amount', this.value)">
      </td>
      <td>
        <div class="period-toggle" data-period-row="${rowKey}" aria-label="Pay cycle">
          <button class="${row.period === 'weekly' ? 'active' : ''}" data-period="weekly" onclick="updateExpense(${handlerPrefix}, ${row.id}, 'period', 'weekly')" title="Weekly">W</button>
          <button class="${row.period === 'monthly' ? 'active' : ''}" data-period="monthly" onclick="updateExpense(${handlerPrefix}, ${row.id}, 'period', 'monthly')" title="Monthly">M</button>
          <button class="${row.period === 'annual' ? 'active' : ''}" data-period="annual" onclick="updateExpense(${handlerPrefix}, ${row.id}, 'period', 'annual')" title="Annual">A</button>
        </div>
      </td>
      ${isSurvival ? `
        <td id="survival-monthly-${row.id}">${preciseDollars(annual / MONTHS_PER_YEAR)}</td>
        <td id="survival-two-year-${row.id}">${dollars((annual / MONTHS_PER_YEAR) * TWO_YEAR_MONTHS)}</td>
      ` : `
        <td id="expense-weekly-${personIndex}-${row.id}">${preciseDollars(annual / WEEKS_PER_YEAR)}</td>
        <td id="expense-monthly-${personIndex}-${row.id}">${preciseDollars(annual / MONTHS_PER_YEAR)}</td>
        <td id="expense-annual-${personIndex}-${row.id}">${dollars(annual)}</td>
      `}
      <td>
        <button class="row-delete" onclick="deleteExpense(${handlerPrefix}, ${row.id})" title="Delete row">×</button>
      </td>
    </tr>
  `;
}

function updateExpense(type, personIndex, id, key, value) {
  const rows = type === 'survival' ? survivalExpenses : personExpenses[personIndex];
  const row = rows.find(item => item.id === id);
  if (!row) return;

  row[key] = key === 'amount' ? parseFloat(value) || 0 : value;
  updateConvertedCells(type, personIndex, row);
  if (key === 'period') {
    updatePeriodToggle(type, personIndex, row);
  }
  calculateBudget();
}

function updatePeriodToggle(type, personIndex, row) {
  const rowKey = type === 'survival' ? `survival-${row.id}` : `expense-${personIndex}-${row.id}`;
  const buttons = document.querySelectorAll(`[data-period-row="${rowKey}"] button`);
  buttons.forEach(btn => btn.classList.toggle('active', btn.dataset.period === row.period));
}

function updateConvertedCells(type, personIndex, row) {
  const annual = toAnnual(row.amount, row.period);

  if (type === 'survival') {
    const monthlyCell = document.getElementById(`survival-monthly-${row.id}`);
    const twoYearCell = document.getElementById(`survival-two-year-${row.id}`);
    if (monthlyCell) monthlyCell.textContent = preciseDollars(annual / MONTHS_PER_YEAR);
    if (twoYearCell) twoYearCell.textContent = dollars((annual / MONTHS_PER_YEAR) * TWO_YEAR_MONTHS);
    return;
  }

  const weeklyCell = document.getElementById(`expense-weekly-${personIndex}-${row.id}`);
  const monthlyCell = document.getElementById(`expense-monthly-${personIndex}-${row.id}`);
  const annualCell = document.getElementById(`expense-annual-${personIndex}-${row.id}`);
  if (weeklyCell) weeklyCell.textContent = preciseDollars(annual / WEEKS_PER_YEAR);
  if (monthlyCell) monthlyCell.textContent = preciseDollars(annual / MONTHS_PER_YEAR);
  if (annualCell) annualCell.textContent = dollars(annual);
}

function addExpense(personIndex) {
  personExpenses[personIndex].push({ id: nextExpenseIds[personIndex]++, name: 'New expense', amount: 0, period: 'monthly' });
  document.getElementById(`expenses-table-${personIndex}`).innerHTML = renderExpensesTable(personIndex);
  calculateBudget();
}

function addSurvivalExpense() {
  survivalExpenses.push({ id: nextSurvivalId++, name: 'New cost', amount: 0, period: 'monthly' });
  renderSurvivalTable();
  calculateBudget();
}

function deleteExpense(type, personIndex, id) {
  if (type === 'survival') {
    survivalExpenses = survivalExpenses.filter(item => item.id !== id);
    renderSurvivalTable();
  } else {
    personExpenses[personIndex] = personExpenses[personIndex].filter(item => item.id !== id);
    document.getElementById(`expenses-table-${personIndex}`).innerHTML = renderExpensesTable(personIndex);
  }
  calculateBudget();
}

function renderSummary(targetId, income, expenseTotals) {
  const leftoverAnnual = income.netAnnual - expenseTotals.annual;
  const leftoverMonthly = leftoverAnnual / MONTHS_PER_YEAR;
  const leftoverWeekly = leftoverAnnual / WEEKS_PER_YEAR;
  const leftoverClass = leftoverAnnual >= 0 ? 'positive' : 'negative';

  document.getElementById(targetId).innerHTML = `
    <div class="metric-card">
      <span>Gross income</span>
      <strong>${dollars(income.grossAnnual)}</strong>
      <small>${preciseDollars(income.grossMonthly)} / mo</small>
    </div>
    <div class="metric-card">
      <span>Estimated taxes</span>
      <strong>${dollars(income.taxAnnual)}</strong>
      <small>${preciseDollars(income.taxMonthly)} / mo</small>
    </div>
    <div class="metric-card">
      <span>Take-home pay</span>
      <strong>${dollars(income.netAnnual)}</strong>
      <small>${preciseDollars(income.netMonthly)} / mo</small>
    </div>
    <div class="metric-card">
      <span>Total expenses</span>
      <strong>${dollars(expenseTotals.annual)}</strong>
      <small>${preciseDollars(expenseTotals.monthly)} / mo</small>
    </div>
    <div class="metric-card ${leftoverClass}">
      <span>Leftover</span>
      <strong>${dollars(leftoverAnnual)}</strong>
      <small>${preciseDollars(leftoverMonthly)} / mo · ${preciseDollars(leftoverWeekly)} / wk</small>
    </div>
  `;
}

function renderExpenseCharts(targetId, expenseTotals) {
  const views = [
    { label: 'Weekly', value: expenseTotals.weekly },
    { label: 'Monthly', value: expenseTotals.monthly },
    { label: 'Annual', value: expenseTotals.annual }
  ];
  const max = Math.max(...views.map(item => item.value), 1);

  document.getElementById(targetId).innerHTML = views.map(item => `
    <div class="bar-card">
      <div class="bar-card-head">
        <span>${item.label}</span>
        <strong>${preciseDollars(item.value)}</strong>
      </div>
      <div class="bar-track">
        <div class="bar-fill" style="width:${Math.max(5, (item.value / max) * 100)}%"></div>
      </div>
    </div>
  `).join('');
}

function renderHouseholdSummary(personSummaries) {
  const section = document.getElementById('household-summary-section');
  if (householdSize < 2) {
    section.style.display = 'none';
    section.innerHTML = '';
    return;
  }

  const combinedIncome = {
    grossAnnual: personSummaries.reduce((sum, item) => sum + item.income.grossAnnual, 0),
    taxAnnual: personSummaries.reduce((sum, item) => sum + item.income.taxAnnual, 0),
    netAnnual: personSummaries.reduce((sum, item) => sum + item.income.netAnnual, 0)
  };
  combinedIncome.grossMonthly = combinedIncome.grossAnnual / MONTHS_PER_YEAR;
  combinedIncome.taxMonthly = combinedIncome.taxAnnual / MONTHS_PER_YEAR;
  combinedIncome.netMonthly = combinedIncome.netAnnual / MONTHS_PER_YEAR;
  combinedIncome.netWeekly = combinedIncome.netAnnual / WEEKS_PER_YEAR;

  const combinedAnnualExpenses = personSummaries.reduce((sum, item) => sum + item.expenses.annual, 0);
  const combinedExpenses = {
    annual: combinedAnnualExpenses,
    monthly: combinedAnnualExpenses / MONTHS_PER_YEAR,
    weekly: combinedAnnualExpenses / WEEKS_PER_YEAR
  };

  section.style.display = 'block';
  section.innerHTML = `
    <div class="panel-head">
      <div>
        <h2>Combined Household Totals</h2>
        <p>Both people together before the two-year survival target.</p>
      </div>
    </div>
    <section class="metrics combined-metrics" id="combined-summary-metrics"></section>
    <div id="combined-expense-charts" class="chart-grid combined-chart-grid"></div>
  `;

  renderSummary('combined-summary-metrics', combinedIncome, combinedExpenses);
  renderExpenseCharts('combined-expense-charts', combinedExpenses);
}

function renderSavingsSummary(survivalTotals) {
  const currentSavings = parseFloat(document.getElementById('current-savings').value) || 0;
  const monthsUntilMove = Math.max(parseFloat(document.getElementById('months-until-move').value) || 1, 1);
  const target = survivalTotals.monthly * TWO_YEAR_MONTHS;
  const remaining = Math.max(target - currentSavings, 0);
  const monthlyNeeded = remaining / monthsUntilMove;
  const weeklyNeeded = remaining / (monthsUntilMove * (WEEKS_PER_YEAR / MONTHS_PER_YEAR));
  const progress = target > 0 ? Math.min((currentSavings / target) * 100, 100) : 100;

  document.getElementById('savings-summary').innerHTML = `
    <div class="savings-metrics">
      <div>
        <span>Monthly survival cost</span>
        <strong>${preciseDollars(survivalTotals.monthly)}</strong>
      </div>
      <div>
        <span>Two-year target</span>
        <strong>${dollars(target)}</strong>
      </div>
      <div>
        <span>Left to save</span>
        <strong>${dollars(remaining)}</strong>
      </div>
      <div>
        <span>Needed until move</span>
        <strong>${preciseDollars(monthlyNeeded)} / mo</strong>
        <small>${preciseDollars(weeklyNeeded)} / wk</small>
      </div>
    </div>
    <div class="progress-track">
      <div class="progress-fill" style="width:${progress}%"></div>
    </div>
    <div class="progress-label">${Math.round(progress)}% funded</div>
  `;
}

function calculateBudget() {
  const personSummaries = activePeople().map((person, index) => {
    const income = getIncomeTotals([person]);
    const expenseTotals = getExpenseTotals(personExpenses[index]);
    renderSummary(`summary-metrics-${index}`, income, expenseTotals);
    renderExpenseCharts(`expense-charts-${index}`, expenseTotals);
    return { person, income, expenses: expenseTotals };
  });
  const survivalTotals = getExpenseTotals(survivalExpenses);

  renderHouseholdSummary(personSummaries);
  renderSavingsSummary(survivalTotals);

  saveState();
}

function resetBudget() {
  if (!confirm('Reset the budget planner to its starting values? This will overwrite the shared cloud copy too.')) return;

  householdSize = 1;
  nextExpenseIds = [8, 8];
  nextSurvivalId = 8;
  people = [
    { id: 'person1', label: 'Person 1', salary: 60000, taxRate: 22 },
    { id: 'person2', label: 'Person 2', salary: 52000, taxRate: 20 }
  ];
  personExpenses = [
    defaultExpenses(),
    defaultExpenses().map(row => ({ ...row, amount: row.name === 'Rent' ? 0 : row.amount }))
  ];
  survivalExpenses = [
    { id: 0, name: 'Rent', amount: 1800, period: 'monthly' },
    { id: 1, name: 'Groceries', amount: 700, period: 'monthly' },
    { id: 2, name: 'Gas / transit', amount: 350, period: 'monthly' },
    { id: 3, name: 'Utilities', amount: 250, period: 'monthly' },
    { id: 4, name: 'Car costs', amount: 650, period: 'monthly' },
    { id: 5, name: 'Loans / debt', amount: 500, period: 'monthly' },
    { id: 6, name: 'Insurance / medical', amount: 300, period: 'monthly' },
    { id: 7, name: 'Buffer / misc.', amount: 400, period: 'monthly' }
  ];
  document.getElementById('current-savings').value = 5000;
  document.getElementById('months-until-move').value = 12;
  renderAll();
}
