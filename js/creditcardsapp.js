// ── Column definitions ────────────────────────────────────────────────────────
// type: 'reward' = numeric % rate, used in spending calc
//       'text'   = free text notes
//       'bonus'  = welcome bonus text, not in spending calc

let columns = [
  { id: 'travel',      label: 'Travel',           type: 'reward' },
  { id: 'gas',         label: 'Gas',              type: 'reward' },
  { id: 'restaurants', label: 'Restaurants',      type: 'reward' },
  { id: 'supermarkets',label: 'Supermarkets',     type: 'reward' },
  { id: 'streaming',   label: 'Streaming',        type: 'reward' },
  { id: 'drugstore',   label: 'Drugstore',        type: 'reward' },
  { id: 'gym',         label: 'Gym',              type: 'reward' },
  { id: 'welcome',     label: 'Welcome Bonus',    type: 'bonus'  },
  { id: 'bonus',       label: 'Bonus / Other',    type: 'text'   },
  { id: 'partners',    label: 'Transfer Partners', type: 'text'  },
];

// ── Card data ─────────────────────────────────────────────────────────────────
// For 'reward' columns: store numeric % (e.g. 5 = 5%)
//   Special values: 'portal' = 5% via portal, 'rotating' = rotating category
// For 'text'/'bonus' columns: store a string

let cards = [
  {
    id: 0, name: 'Citi Strata',
    travel: 'portal', gas: 3, restaurants: 2, supermarkets: 3,
    streaming: 1, drugstore: 1, gym: 3,
    welcome: '$200 for $1,000 spent in 3 months',
    bonus: 'Streaming or gym 3%',
    partners: 'JetBlue, AA (no hotels)',
  },
  {
    id: 1, name: 'Amex BCE',
    travel: 1, gas: 3, restaurants: 1, supermarkets: 3,
    streaming: 1, drugstore: 1, gym: 1,
    welcome: '$200 for $2,000 spent in 6 months',
    bonus: 'Online Retail 3%',
    partners: 'JetBlue, Delta, Hilton, Marriott',
  },
  {
    id: 2, name: 'Chase Flex',
    travel: 'portal', gas: 'rotating', restaurants: 3, supermarkets: 'rotating',
    streaming: 'rotating', drugstore: 3, gym: 'rotating',
    welcome: '$200 for $500 spent in 3 months',
    bonus: null,
    partners: 'JetBlue, United, Southwest, Marriott, Hyatt',
  },
  {
    id: 3, name: 'Chase Unlimited',
    travel: 'portal', gas: 1.5, restaurants: 3, supermarkets: 1.5,
    streaming: 1.5, drugstore: 3, gym: 1.5,
    welcome: '$200 for $500 spent in 3 months',
    bonus: null,
    partners: 'JetBlue, United, Southwest, Marriott, Hyatt',
  },
  {
    id: 4, name: 'Cap1 Savor One',
    travel: 'portal', gas: 1, restaurants: 3, supermarkets: 3,
    streaming: 3, drugstore: 1, gym: 1,
    welcome: '$200 for $500 spent in 3 months',
    bonus: null,
    partners: 'JetBlue',
  },
  {
    id: 5, name: 'AAA Daily',
    travel: 1, gas: 3, restaurants: 1, supermarkets: 5,
    streaming: 3, drugstore: 3, gym: 1,
    welcome: null,
    bonus: 'Wholesale 3%',
    partners: null,
  },
  {
    id: 6, name: 'AAA Travel',
    travel: 3, gas: 5, restaurants: 3, supermarkets: 3,
    streaming: 1, drugstore: 1, gym: 1,
    welcome: null,
    bonus: null,
    partners: null,
  },
  {
    id: 7, name: 'WF Autograph',
    travel: 3, gas: 3, restaurants: 3, supermarkets: 1,
    streaming: 1, drugstore: 1, gym: 3,
    welcome: '$200 for $1,000 spent in 3 months',
    bonus: 'Phone plan 3%',
    partners: 'JetBlue, Wyndham',
  }
];

let nextCardId = 8;
let nextColId  = 0;

// ── Rotating category config ──────────────────────────────────────────────────
// Keyed by card id. Each entry:
//   categories: array of column ids that participate in rotation (in order)
//   activeIndex: which index is currently earning 5%
//   fallbackRate: the rate (%) for non-active rotating categories
//
// Chase Flex (id: 2) has gas + supermarkets as rotating, fallback 1%
let rotatingConfig = {
  2: {
    categories: ['gas', 'supermarkets', 'streaming', 'gym'],
    activeIndex: 0,
    fallbackRate: 1,
  }
};

// ── Cards already owned ───────────────────────────────────────────────────────
// Used as an optional "best card in wallet" overlay in the rewards math.
let ownedCards = [
  {
    id: 'discover_it',
    name: 'Discover it',
    rates: {
      travel: 'rotating', gas: 'rotating', restaurants: 'rotating',
      supermarkets: 'rotating', streaming: 1, drugstore: 1,
      gym: 1, default: 1
    },
    benefits: '5% rotating categories when activated, 1% other purchases, no annual fee'
  },
  {
    id: 'fidelity',
    name: 'Fidelity Rewards Visa Signature',
    rates: { default: 2 },
    benefits: '2% cash back when redeemed into an eligible Fidelity account, no annual fee'
  },
    {
    id: 'USBAConnect',
    name: 'US Bank Altitude Connect',
    rates: {
      travel: 4, gas: 4, restaurants: 2,
      supermarkets: 2, streaming: 2, drugstore: 1,
      gym: 1, default: 1
    },
    benefits: 'Airport lounge access x4/year and travel protections, no annual fee'
  }
];

let ownedRotatingConfig = {
  discover_it: {
    categories: ['gas', 'restaurants', 'travel', 'supermarkets'],
    activeIndex: 0,
    activeRate: 5,
    fallbackRate: 1,
    capLabel: 'up to quarterly max'
  }
};

// ── Spending amounts (monthly, by column id) ──────────────────────────────────
let spending = {
  travel: 200, gas: 80, restaurants: 100, supermarkets: 80,
  streaming: 15, drugstore: 5, gym: 50
};

// Travel portal estimates: round trip covered, one way covered, no flight covered
const portalTravelRates = [5, 2.5, 0];
let portalTravelRateIndex = 0;
let useOwnedCardMix = false;
let nextOwnedCardId = 0;

// ── Modal state ───────────────────────────────────────────────────────────────
let editingCardId = null;
let editingColId  = null;


// ── Entry point: render everything ───────────────────────────────────────────
function renderAll() {
  renderSpendingInputs();
  renderPortalTravelButton();
  renderTable();
  renderOwnedCards();
  renderRewards();
}

function getPortalTravelRate() {
  return portalTravelRates[portalTravelRateIndex];
}

function cyclePortalTravelRate() {
  portalTravelRateIndex = (portalTravelRateIndex + 1) % portalTravelRates.length;
  renderAll();
}

function renderPortalTravelButton() {
  const btn = document.getElementById('portal-rate-btn');
  if (!btn) return;

  const rate = getPortalTravelRate();
  const label = rate === 5 ? 'round trip' : rate === 2.5 ? 'one way' : 'no flights';
  btn.textContent = `Portal travel: ${rate}% (${label})`;
}

function setOwnedCardMix(checked) {
  useOwnedCardMix = checked;
  renderRewards();
}

function cycleOwnedRotating(cardId) {
  const rot = ownedRotatingConfig[cardId];
  if (!rot) return;
  rot.activeIndex = (rot.activeIndex + 1) % rot.categories.length;
  renderAll();
}

function renderOwnedCards() {
  const section = document.getElementById('owned-cards-section');
  if (!section) return;

  section.innerHTML = `
    <div class="section-head">
      <div>
        <h3>Cards I already have</h3>
        <p>Edit cash-back rates here. These can be mixed into the estimate when they beat the card being compared.</p>
      </div>
      <button class="btn btn-outline btn-sm" onclick="addOwnedCard()">+ Add owned card</button>
    </div>
    <div class="owned-table-wrap">
      <table class="owned-table">
        <thead>
          <tr>
            <th>Card</th>
            <th>Default %</th>
            ${columns.filter(c => c.type === 'reward').map(col => `<th>${col.label}</th>`).join('')}
            <th>Benefits / Notes</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${ownedCards.map(card => renderOwnedCardRow(card)).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderOwnedCardRow(card) {
  const rot = ownedRotatingConfig[card.id];
  const activeColId = rot ? rot.categories[rot.activeIndex] : null;
  const activeLabel = activeColId ? getColumnLabel(activeColId) : '';
  const nextLabel = rot ? getColumnLabel(rot.categories[(rot.activeIndex + 1) % rot.categories.length]) : '';
  const rewardCols = columns.filter(c => c.type === 'reward');

  return `
    <tr>
      <td>
        <input class="owned-input owned-name-input" type="text" value="${card.name}"
          oninput="updateOwnedCardName('${card.id}', this.value)">
        ${rot ? `
          <button class="rotating-cycle-btn" onclick="cycleOwnedRotating('${card.id}')" title="Change Discover 5% category to ${nextLabel}">
            5%: ${activeLabel}
          </button>
        ` : ''}
      </td>
      <td>
        <input class="owned-input owned-rate-input" type="text" value="${card.rates.default ?? ''}"
          oninput="updateOwnedCardRate('${card.id}', 'default', this.value)">
      </td>
      ${rewardCols.map(col => `
        <td>
          <input class="owned-input owned-rate-input" type="text" value="${card.rates[col.id] ?? ''}"
            placeholder="${card.rates.default ?? 0}"
            oninput="updateOwnedCardRate('${card.id}', '${col.id}', this.value)">
        </td>
      `).join('')}
      <td>
        <textarea class="owned-input owned-benefits-input"
          oninput="updateOwnedCardBenefits('${card.id}', this.value)">${card.benefits || ''}</textarea>
      </td>
      <td>
        <button class="th-edit" onclick="deleteOwnedCard('${card.id}')" title="Delete owned card">×</button>
      </td>
    </tr>
  `;
}

function getColumnLabel(colId) {
  return (columns.find(c => c.id === colId) || {}).label || colId;
}

function updateOwnedCardName(cardId, value) {
  const card = ownedCards.find(c => c.id === cardId);
  if (!card) return;
  card.name = value.trim() || 'Owned card';
  renderRewards();
}

function updateOwnedCardBenefits(cardId, value) {
  const card = ownedCards.find(c => c.id === cardId);
  if (!card) return;
  card.benefits = value;
}

function parseOwnedRateInput(value) {
  const raw = value.trim().toLowerCase();
  if (!raw) return null;
  if (raw === 'rotating') return 'rotating';
  const parsed = parseFloat(raw);
  return isNaN(parsed) ? null : parsed;
}

function updateOwnedCardRate(cardId, rateKey, value) {
  const card = ownedCards.find(c => c.id === cardId);
  if (!card) return;

  const parsed = parseOwnedRateInput(value);
  if (parsed === null) delete card.rates[rateKey];
  else card.rates[rateKey] = parsed;

  renderRewards();
}

function addOwnedCard() {
  const rewardRates = {};
  columns.filter(c => c.type === 'reward').forEach(col => {
    rewardRates[col.id] = '';
  });

  ownedCards.push({
    id: `owned_${nextOwnedCardId++}`,
    name: 'New owned card',
    rates: { default: 1, ...rewardRates },
    benefits: ''
  });

  renderAll();
}

function deleteOwnedCard(cardId) {
  if (!confirm('Remove this owned card?')) return;
  ownedCards = ownedCards.filter(c => c.id !== cardId);
  delete ownedRotatingConfig[cardId];
  renderAll();
}


// ── Spending inputs ───────────────────────────────────────────────────────────
function renderSpendingInputs() {
  const rewardCols = columns.filter(c => c.type === 'reward');
  document.getElementById('spending-inputs').innerHTML = rewardCols.map(c => `
    <div class="spending-field">
      <label>${c.label} ($/mo)</label>
      <input type="number" value="${spending[c.id] || 0}" min="0" step="10"
        oninput="spending['${c.id}'] = parseFloat(this.value)||0; renderRewards()">
    </div>
  `).join('');
}

function toggleSpendingPanel() {
  const el = document.getElementById('spending-panel');
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
}


// ── Table rendering ───────────────────────────────────────────────────────────
function renderTable() {
  renderTableHead();
  renderTableBody();
}

function renderTableHead() {
  const head = document.getElementById('table-head');
  head.innerHTML = `<tr>
    <th><div class="th-inner">Card</div></th>
    ${columns.map(c => `
      <th>
        <div class="th-inner">
          ${c.label}
          <button class="th-edit" onclick="openColumnModal('${c.id}')" title="Edit column">✎</button>
        </div>
      </th>
    `).join('')}
  </tr>`;
}

function renderTableBody() {
  const body = document.getElementById('table-body');
  body.innerHTML = cards.map(card => `
    <tr>
      <td>
        <div class="card-name-cell">
          ${card.name}
          <button class="edit-card-btn" onclick="openCardModal(${card.id})" title="Edit card">✎</button>
        </div>
      </td>
      ${columns.map(col => `<td>${formatCell(card, col)}</td>`).join('')}
    </tr>
  `).join('');
}

// Format a single table cell based on column type and value
function formatCell(card, col) {
  const val = card[col.id];

  if (col.type === 'text' || col.type === 'bonus') {
    return val ? `<span>${val}</span>` : `<span class="rate-none">—</span>`;
  }

  // reward column — check if this card has a rotating config and this col is part of it
  const rot = rotatingConfig[card.id];
  if (rot && rot.categories.includes(col.id)) {
    return formatRotatingCell(card, col, rot);
  }

  if (val === null || val === undefined) return `<span class="rate-none">—</span>`;
  if (val === 'portal') {
    const rate = col.id === 'travel' ? getPortalTravelRate() : 5;
    const rateClass = rate >= 5 ? 'rate-portal' : rate > 0 ? 'rate-low' : 'rate-none';
    const display = rate > 0 ? `${rate}% (portal)` : `0% (portal)`;
    return `<span class="${rateClass}">${display}</span>`;
  }
  if (val === 'rotating') {
    // Legacy fallback for cards without rotatingConfig defined yet
    return `<span class="rate-mid">5% rotating</span>`;
  }
  if (val === 'bonus') return `<span class="rate-mid">Bonus cat.</span>`;

  const n = parseFloat(val);
  if (isNaN(n)) return `<span class="rate-low">${val}</span>`;
  if (n >= 5)   return `<span class="rate-high">${n}%</span>`;
  if (n >= 3)   return `<span class="rate-mid">${n}%</span>`;
  if (n > 0)    return `<span class="rate-low">${n}%</span>`;
  return `<span class="rate-none">—</span>`;
}

// Render a rotating category cell with highlighted active quarter
function formatRotatingCell(card, col, rot) {
  const isActive   = rot.categories[rot.activeIndex] === col.id;
  const activeColId = rot.categories[rot.activeIndex];
  const activeLabel = (columns.find(c => c.id === activeColId) || {}).label || activeColId;

  if (isActive) {
    // Show the active 5% category — highlighted
    const catIndex = rot.categories.indexOf(col.id);
    const nextIndex = (rot.activeIndex + 1) % rot.categories.length;
    const nextColLabel = (columns.find(c => c.id === rot.categories[nextIndex]) || {}).label || rot.categories[nextIndex];
    return `
      <div class="rotating-active">
        <span class="rotating-badge active">5% this quarter</span>
        <button class="rotating-cycle-btn" onclick="cycleRotating(${card.id})" title="Advance to next quarter (${nextColLabel})">
          Next quarter →
        </button>
      </div>`;
  } else {
    // Non-active rotating category — show fallback rate
    const fallback = rot.fallbackRate;
    const rateClass = fallback >= 3 ? 'rate-mid' : fallback > 0 ? 'rate-low' : 'rate-none';
    return `
      <div class="rotating-inactive">
        <span class="${rateClass}">${fallback > 0 ? fallback + '%' : '—'}</span>
        <span class="rotating-hint">(not this quarter)</span>
      </div>`;
  }
}

// Advance the active rotating quarter for a card
function cycleRotating(cardId) {
  const rot = rotatingConfig[cardId];
  if (!rot) return;
  rot.activeIndex = (rot.activeIndex + 1) % rot.categories.length;
  renderAll();
}


// ── Rewards calculation ───────────────────────────────────────────────────────
function getCardRewardRate(card, col) {
  const val = card[col.id];
  const rot = rotatingConfig[card.id];

  if (rot && rot.categories.includes(col.id)) {
    const isActive = rot.categories[rot.activeIndex] === col.id;
    return isActive ? 5 : (rot.fallbackRate || 0);
  }

  if (val == 'rotating') return 5;
  if (val == 'portal') return col.id === 'travel' ? getPortalTravelRate() : 5;
  if (val === 'bonus') return 3;

  return parseFloat(val) || 0;
}

function getOwnedCardRewardRate(card, col) {
  const categoryRate = card.rates[col.id];
  const rawRate = categoryRate === undefined || categoryRate === null || categoryRate === ''
    ? card.rates.default ?? 0
    : categoryRate;
  const rot = ownedRotatingConfig[card.id];

  if (rawRate === 'rotating' && rot) {
    return rot.categories[rot.activeIndex] === col.id ? rot.activeRate : rot.fallbackRate;
  }

  return parseFloat(rawRate) || 0;
}

function getBestOwnedCardForColumn(col) {
  return ownedCards.reduce((best, card) => {
    const rate = getOwnedCardRewardRate(card, col);
    if (!best || rate > best.rate) return { card, rate };
    return best;
  }, null);
}

function calcRewards(card) {
  const multiplier  = document.getElementById('two-month-toggle').checked ? 2 : 1;
  const rewardCols  = columns.filter(c => c.type === 'reward');
  let total         = 0;
  const breakdown   = [];

  for (const col of rewardCols) {
    const spend = (spending[col.id] || 0) * multiplier;
    if (!spend) continue;

    const cardRate = getCardRewardRate(card, col);
    const ownedBest = getBestOwnedCardForColumn(col);
    const shouldUseOwned = useOwnedCardMix && ownedBest && ownedBest.rate > cardRate;
    const rate = shouldUseOwned ? ownedBest.rate : cardRate;

    if (rate > 0) {
      const earned = spend * (rate / 100);
      total += earned;
      breakdown.push({
        label: col.label,
        spend,
        rate,
        earned,
        sourceName: shouldUseOwned ? ownedBest.card.name : card.name,
        originalRate: cardRate,
        swapped: shouldUseOwned
      });
    }
  }

  return { total, breakdown };
}

function renderRewards() {
  const multiplier = document.getElementById('two-month-toggle').checked ? 2 : 1;
  const label      = multiplier === 2 ? '2-month' : 'monthly';
  const section    = document.getElementById('rewards-section');

  const hasSpending = Object.values(spending).some(v => v > 0);
  if (!hasSpending) {
    section.innerHTML = `<p style="color:#888;font-size:13px">Set spending amounts above to see estimated rewards.</p>`;
    return;
  }

  const ranked = cards
    .map(card => ({ card, ...calcRewards(card) }))
    .sort((a, b) => b.total - a.total);

  const modeText = useOwnedCardMix
    ? 'Best mix: candidate card plus your existing cards when they earn more'
    : 'Single-card mode: candidate card used for every purchase';

  section.innerHTML = `
    <div class="rewards-head">
      <div>
        <h3>Estimated ${label} rewards — by card</h3>
        <p>${modeText}</p>
      </div>
      <label class="toggle-line">
        <input type="checkbox" ${useOwnedCardMix ? 'checked' : ''} onchange="setOwnedCardMix(this.checked)">
        Use my owned cards when they earn more
      </label>
    </div>
    <div class="rewards-grid">
      ${ranked.map((r, i) => `
        <div class="reward-card" style="${i === 0 ? 'border-color:#1a6b3c;' : ''}">
          <div class="reward-card-name">${i === 0 ? 'Best: ' : ''}${r.card.name}</div>
          <div class="reward-card-amount">$${r.total.toFixed(2)}</div>
          <div class="reward-card-sub">${label} cashback / rewards</div>
          ${r.breakdown.length ? `
            <div class="reward-card-breakdown">
              ${r.breakdown.map(b => `
                <div class="${b.swapped ? 'owned-swap' : ''}">
                  <span>
                    ${b.label} (${b.rate}%)
                    ${b.swapped ? `<small>${b.sourceName} beats ${r.card.name} ${b.originalRate}%</small>` : ''}
                  </span>
                  <span>$${b.earned.toFixed(2)}</span>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
      `).join('')}
    </div>
  `;
}


// ── Card modal ────────────────────────────────────────────────────────────────
function openCardModal(cardId) {
  editingCardId = cardId !== undefined ? cardId : null;
  const card    = editingCardId !== null ? cards.find(c => c.id === editingCardId) : null;
  const rot     = editingCardId !== null ? (rotatingConfig[editingCardId] || null) : null;

  document.getElementById('card-modal-title').textContent = card ? 'Edit card' : 'Add card';
  document.getElementById('delete-card-btn').style.display = card ? 'block' : 'none';

  const rotCatsVal     = rot ? rot.categories.join(', ') : '';
  const rotFallbackVal = rot ? rot.fallbackRate : 1;

  document.getElementById('card-modal-fields').innerHTML = `
    <div class="field">
      <label>Card name</label>
      <input type="text" id="modal-card-name" value="${card ? card.name : ''}" placeholder="e.g. Chase Sapphire">
    </div>
    ${columns.map(col => {
      const val = card ? (card[col.id] ?? '') : '';
      if (col.type === 'reward') {
        return `
          <div class="field">
            <label>${col.label} — reward rate</label>
            <input type="text" id="modal-col-${col.id}" value="${val}"
              placeholder="e.g. 3  or  portal  or  rotating  or leave blank">
            <small style="font-size:11px;color:#888">
              Enter a number (%), or: portal, rotating, bonus — or leave blank for none
            </small>
          </div>`;
      }
      return `
        <div class="field">
          <label>${col.label}</label>
          <textarea id="modal-col-${col.id}">${val}</textarea>
        </div>`;
    }).join('')}
    <div class="field" style="border-top:1px solid #eee;padding-top:0.75rem;margin-top:0.25rem">
      <label>Rotating categories (comma-separated column IDs)</label>
      <input type="text" id="modal-rot-cats" value="${rotCatsVal}"
        placeholder="e.g. gas, supermarkets">
      <small style="font-size:11px;color:#888">
        Leave blank if this card has no rotating 5% categories.
        Column IDs: ${columns.filter(c=>c.type==='reward').map(c=>`<strong>${c.id}</strong>`).join(', ')}
      </small>
    </div>
    <div class="field">
      <label>Rotating fallback rate (%)</label>
      <input type="number" id="modal-rot-fallback" value="${rotFallbackVal}" min="0" max="10" step="0.5"
        placeholder="e.g. 1">
      <small style="font-size:11px;color:#888">
        Rate earned on rotating categories when they're NOT the active quarter (typically 1%).
      </small>
    </div>
  `;

  document.getElementById('card-modal').style.display = 'flex';
  document.getElementById('modal-card-name').focus();
}

function closeCardModal(event) {
  if (event && event.target !== document.getElementById('card-modal')) return;
  document.getElementById('card-modal').style.display = 'none';
  editingCardId = null;
}

function saveCard() {
  const name = document.getElementById('modal-card-name').value.trim();
  if (!name) { alert('Please enter a card name.'); return; }

  const data = { name };
  columns.forEach(col => {
    const raw = document.getElementById('modal-col-' + col.id).value.trim();
    if (col.type === 'reward') {
      const keywords = ['portal', 'rotating', 'bonus'];
      if (!raw) data[col.id] = null;
      else if (keywords.includes(raw.toLowerCase())) data[col.id] = raw.toLowerCase();
      else data[col.id] = parseFloat(raw) || null;
    } else {
      data[col.id] = raw || null;
    }
  });

  // Save rotating config
  const rotCatsRaw  = document.getElementById('modal-rot-cats').value.trim();
  const rotFallback = parseFloat(document.getElementById('modal-rot-fallback').value) || 1;
  const rotCats     = rotCatsRaw
    ? rotCatsRaw.split(',').map(s => s.trim()).filter(s => columns.find(c => c.id === s))
    : [];

  const targetId = editingCardId !== null ? editingCardId : nextCardId;

  if (rotCats.length > 0) {
    const existing = rotatingConfig[targetId];
    rotatingConfig[targetId] = {
      categories:  rotCats,
      activeIndex: existing ? Math.min(existing.activeIndex, rotCats.length - 1) : 0,
      fallbackRate: rotFallback,
    };
  } else {
    delete rotatingConfig[targetId];
  }

  if (editingCardId !== null) {
    const idx = cards.findIndex(c => c.id === editingCardId);
    cards[idx] = { ...cards[idx], ...data };
  } else {
    cards.push({ id: nextCardId++, ...data });
  }

  document.getElementById('card-modal').style.display = 'none';
  editingCardId = null;
  renderAll();
}

function deleteCard() {
  if (!confirm('Remove this card?')) return;
  delete rotatingConfig[editingCardId];
  cards = cards.filter(c => c.id !== editingCardId);
  document.getElementById('card-modal').style.display = 'none';
  editingCardId = null;
  renderAll();
}


// ── Column modal ──────────────────────────────────────────────────────────────
function openColumnModal(colId) {
  editingColId = colId !== undefined ? colId : null;
  const col    = editingColId ? columns.find(c => c.id === editingColId) : null;

  document.getElementById('col-modal-title').textContent = col ? 'Edit column' : 'Add column';
  document.getElementById('delete-col-btn').style.display = col ? 'block' : 'none';
  document.getElementById('col-name-input').value = col ? col.label : '';
  document.getElementById('col-type-input').value = col ? col.type  : 'reward';

  document.getElementById('col-modal').style.display = 'flex';
  document.getElementById('col-name-input').focus();
}

function closeColumnModal(event) {
  if (event && event.target !== document.getElementById('col-modal')) return;
  document.getElementById('col-modal').style.display = 'none';
  editingColId = null;
}

function saveColumn() {
  const label = document.getElementById('col-name-input').value.trim();
  if (!label) { alert('Please enter a column name.'); return; }
  const type = document.getElementById('col-type-input').value;

  if (editingColId) {
    const col = columns.find(c => c.id === editingColId);
    col.label = label;
    col.type  = type;
  } else {
    const id = 'col_' + label.toLowerCase().replace(/\s+/g, '_') + '_' + (nextColId++);
    columns.push({ id, label, type });
    cards.forEach(card => { card[id] = null; });
    if (type === 'reward') spending[id] = 0;
  }

  document.getElementById('col-modal').style.display = 'none';
  editingColId = null;
  renderAll();
}

function deleteColumn() {
  if (!confirm('Remove this column? Data for all cards in this column will be lost.')) return;
  // Remove from any rotating configs
  for (const cardId in rotatingConfig) {
    const rot = rotatingConfig[cardId];
    rot.categories = rot.categories.filter(c => c !== editingColId);
    if (rot.categories.length === 0) {
      delete rotatingConfig[cardId];
    } else {
      rot.activeIndex = Math.min(rot.activeIndex, rot.categories.length - 1);
    }
  }
  columns = columns.filter(c => c.id !== editingColId);
  delete spending[editingColId];
  document.getElementById('col-modal').style.display = 'none';
  editingColId = null;
  renderAll();
}


// ── Close modals on Escape key ────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.getElementById('card-modal').style.display = 'none';
    document.getElementById('col-modal').style.display  = 'none';
  }
});


// ── Init ──────────────────────────────────────────────────────────────────────
renderAll();
