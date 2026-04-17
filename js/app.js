/* ===========================
   Expense & Budget Visualizer
   Vanilla JS — No frameworks
   =========================== */

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_CATEGORIES = ['Food', 'Transport', 'Fun'];

const CATEGORY_META = {
  Food:      { icon: '🍔', color: '#f59e0b' },
  Transport: { icon: '🚌', color: '#3b82f6' },
  Fun:       { icon: '🎉', color: '#ec4899' },
};

const PALETTE = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444', '#3b82f6',
  '#ec4899', '#8b5cf6', '#14b8a6', '#f97316', '#84cc16',
];

// ─── State ────────────────────────────────────────────────────────────────────

let transactions     = [];
let customCategories = [];
let spendingLimit    = 0;
let isDark           = false;
let currentMonth     = new Date();
let chart            = null;

// ─── Persistence ─────────────────────────────────────────────────────────────

function save() {
  localStorage.setItem('bt_transactions', JSON.stringify(transactions));
  localStorage.setItem('bt_customCats',   JSON.stringify(customCategories));
  localStorage.setItem('bt_limit',        spendingLimit);
  localStorage.setItem('bt_dark',         isDark);
}

function load() {
  transactions     = JSON.parse(localStorage.getItem('bt_transactions') || '[]');
  customCategories = JSON.parse(localStorage.getItem('bt_customCats')   || '[]');
  spendingLimit    = parseFloat(localStorage.getItem('bt_limit')        || '0');
  isDark           = localStorage.getItem('bt_dark') === 'true';
}

// ─── Category Helpers ─────────────────────────────────────────────────────────

function allCategories() {
  return [...DEFAULT_CATEGORIES, ...customCategories];
}

function getCatMeta(cat) {
  if (CATEGORY_META[cat]) return CATEGORY_META[cat];
  const idx = customCategories.indexOf(cat);
  return {
    icon:  '🏷️',
    color: PALETTE[(idx + 3) % PALETTE.length],
  };
}

// ─── DOM References ───────────────────────────────────────────────────────────

const totalBalanceEl  = document.getElementById('totalBalance');
const totalIncomeEl   = document.getElementById('totalIncome');
const totalExpenseEl  = document.getElementById('totalExpense');
const limitWarningEl  = document.getElementById('limitWarning');
const spendingLimitEl = document.getElementById('spendingLimit');
const transactionList = document.getElementById('transactionList');
const formError       = document.getElementById('formError');
const categorySelect  = document.getElementById('category');
const filterCatSelect = document.getElementById('filterCategory');
const sortBySelect    = document.getElementById('sortBy');
const customCatGroup  = document.getElementById('customCategoryGroup');
const customCatInput  = document.getElementById('customCategory');
const chartCanvas     = document.getElementById('spendingChart');
const chartEmpty      = document.getElementById('chartEmpty');
const monthlyList     = document.getElementById('monthlyList');
const monthTitle      = document.getElementById('monthTitle');
const monthIncomeEl   = document.getElementById('monthIncome');
const monthExpenseEl  = document.getElementById('monthExpense');
const monthNetEl      = document.getElementById('monthNet');

// ─── Formatting ───────────────────────────────────────────────────────────────

function fmt(n) {
  return '$' + Math.abs(n).toFixed(2);
}

function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function monthKey(date) {
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
}

function monthLabel(date) {
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function escHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Balance ──────────────────────────────────────────────────────────────────

function updateBalance() {
  const income  = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const expense = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const balance = income - expense;

  totalBalanceEl.textContent = (balance < 0 ? '-' : '') + fmt(balance);
  totalIncomeEl.textContent  = fmt(income);
  totalExpenseEl.textContent = fmt(expense);

  if (spendingLimit > 0 && expense > spendingLimit) {
    limitWarningEl.classList.remove('hidden');
  } else {
    limitWarningEl.classList.add('hidden');
  }
}

// ─── Category Selects ─────────────────────────────────────────────────────────

function rebuildCategorySelects() {
  const cats    = allCategories();
  const prevCat = categorySelect.value;

  // Rebuild form category select
  categorySelect.innerHTML = '';
  cats.forEach(function(cat) {
    var meta = getCatMeta(cat);
    var opt  = document.createElement('option');
    opt.value       = cat;
    opt.textContent = meta.icon + ' ' + cat;
    categorySelect.appendChild(opt);
  });

  // "Add Custom..." option
  var customOpt       = document.createElement('option');
  customOpt.value       = '__custom__';
  customOpt.textContent = '➕ Add Custom...';
  categorySelect.appendChild(customOpt);

  if (cats.includes(prevCat)) {
    categorySelect.value = prevCat;
  }

  // Rebuild filter select
  var prevFilter = filterCatSelect.value;
  filterCatSelect.innerHTML = '<option value="all">All Categories</option>';
  cats.forEach(function(cat) {
    var meta = getCatMeta(cat);
    var opt  = document.createElement('option');
    opt.value       = cat;
    opt.textContent = meta.icon + ' ' + cat;
    filterCatSelect.appendChild(opt);
  });

  if (prevFilter === 'all' || cats.includes(prevFilter)) {
    filterCatSelect.value = prevFilter;
  }
}

// ─── Custom Category Management ───────────────────────────────────────────────

function renderCustomCatList() {
  var ul = document.getElementById('customCatList');
  ul.innerHTML = '';

  if (customCategories.length === 0) {
    ul.innerHTML = '<li style="color:var(--text-muted);font-size:0.82rem;padding:4px 0;">No custom categories yet.</li>';
    return;
  }

  customCategories.forEach(function(cat, i) {
    var li  = document.createElement('li');
    var btn = document.createElement('button');
    btn.textContent = '✕';
    btn.title       = 'Remove';
    btn.addEventListener('click', function() {
      customCategories.splice(i, 1);
      save();
      rebuildCategorySelects();
      renderCustomCatList();
      renderTransactions();
      updateChart();
    });
    li.textContent = cat + ' ';
    li.appendChild(btn);
    ul.appendChild(li);
  });
}

document.getElementById('toggleManageCats').addEventListener('click', function() {
  var panel = document.getElementById('manageCats');
  panel.classList.toggle('hidden');
  renderCustomCatList();
});

document.getElementById('addCatBtn').addEventListener('click', function() {
  var input = document.getElementById('newCatInput');
  var name  = input.value.trim();
  if (!name) return;

  var existing = allCategories().map(function(c) { return c.toLowerCase(); });
  if (existing.includes(name.toLowerCase())) {
    alert('Category already exists.');
    return;
  }

  customCategories.push(name);
  save();
  rebuildCategorySelects();
  renderCustomCatList();
  input.value = '';
});

document.getElementById('newCatInput').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') document.getElementById('addCatBtn').click();
});

// Show/hide inline custom category input
categorySelect.addEventListener('change', function() {
  if (categorySelect.value === '__custom__') {
    customCatGroup.style.display = 'block';
    customCatInput.focus();
  } else {
    customCatGroup.style.display = 'none';
  }
});

// ─── Add Transaction ──────────────────────────────────────────────────────────

document.getElementById('transactionForm').addEventListener('submit', function(e) {
  e.preventDefault();

  var name   = document.getElementById('itemName').value.trim();
  var amount = parseFloat(document.getElementById('amount').value);
  var type   = document.getElementById('type').value;
  var cat    = categorySelect.value;

  // Handle inline custom category
  if (cat === '__custom__') {
    var customName = customCatInput.value.trim();
    if (!customName) {
      showError('Please enter a custom category name.');
      return;
    }
    var existing = allCategories().map(function(c) { return c.toLowerCase(); });
    if (!existing.includes(customName.toLowerCase())) {
      customCategories.push(customName);
      rebuildCategorySelects();
      renderCustomCatList();
    }
    cat = customName;
    customCatInput.value        = '';
    customCatGroup.style.display = 'none';
  }

  if (!name || isNaN(amount) || amount <= 0 || !cat) {
    showError('Please fill in all fields with valid values.');
    return;
  }

  hideError();

  var transaction = {
    id:       Date.now().toString(),
    name:     name,
    amount:   amount,
    type:     type,
    category: cat,
    date:     new Date().toISOString(),
  };

  transactions.unshift(transaction);
  save();
  updateBalance();
  renderTransactions();
  updateChart();
  renderMonthly();

  // Reset form fields
  document.getElementById('itemName').value = '';
  document.getElementById('amount').value   = '';
  categorySelect.value = allCategories()[0] || '';
});

function showError(msg) {
  formError.textContent = msg;
  formError.classList.remove('hidden');
}

function hideError() {
  formError.classList.add('hidden');
}

// ─── Render Transactions ──────────────────────────────────────────────────────

function getSortedFiltered() {
  var filterCat = filterCatSelect.value;
  var sortBy    = sortBySelect.value;
  var list      = transactions.slice();

  if (filterCat !== 'all') {
    list = list.filter(function(t) { return t.category === filterCat; });
  }

  switch (sortBy) {
    case 'date-desc':
      list.sort(function(a, b) { return new Date(b.date) - new Date(a.date); });
      break;
    case 'date-asc':
      list.sort(function(a, b) { return new Date(a.date) - new Date(b.date); });
      break;
    case 'amount-desc':
      list.sort(function(a, b) { return b.amount - a.amount; });
      break;
    case 'amount-asc':
      list.sort(function(a, b) { return a.amount - b.amount; });
      break;
    case 'category-asc':
      list.sort(function(a, b) { return a.category.localeCompare(b.category); });
      break;
  }

  return list;
}

function renderTransactions() {
  var list = getSortedFiltered();
  transactionList.innerHTML = '';

  if (list.length === 0) {
    transactionList.innerHTML = '<li class="empty-state">No transactions found.</li>';
    return;
  }

  var totalExpense = transactions
    .filter(function(t) { return t.type === 'expense'; })
    .reduce(function(sum, t) { return sum + t.amount; }, 0);

  list.forEach(function(t) {
    var meta        = getCatMeta(t.category);
    var isOverLimit = spendingLimit > 0 && t.type === 'expense' && totalExpense > spendingLimit;

    var li = document.createElement('li');
    li.className  = 'transaction-item' + (isOverLimit ? ' over-limit' : '');
    li.dataset.id = t.id;

    li.innerHTML =
      '<div class="cat-icon" style="background:' + meta.color + '22; color:' + meta.color + '">' +
        meta.icon +
      '</div>' +
      '<div class="transaction-info">' +
        '<div class="transaction-name">'  + escHtml(t.name)     + '</div>' +
        '<div class="transaction-meta">'  + escHtml(t.category) + ' · ' + fmtDate(t.date) + '</div>' +
      '</div>' +
      '<span class="transaction-amount ' + t.type + '">' +
        (t.type === 'income' ? '+' : '-') + fmt(t.amount) +
      '</span>' +
      '<button class="delete-btn" title="Delete transaction">🗑</button>';

    li.querySelector('.delete-btn').addEventListener('click', function() {
      deleteTransaction(t.id);
    });

    transactionList.appendChild(li);
  });
}

function deleteTransaction(id) {
  transactions = transactions.filter(function(t) { return t.id !== id; });
  save();
  updateBalance();
  renderTransactions();
  updateChart();
  renderMonthly();
}

filterCatSelect.addEventListener('change', renderTransactions);
sortBySelect.addEventListener('change', renderTransactions);

// ─── Spending Limit ───────────────────────────────────────────────────────────

document.getElementById('setLimitBtn').addEventListener('click', function() {
  var val = parseFloat(spendingLimitEl.value);
  spendingLimit = (isNaN(val) || val < 0) ? 0 : val;
  save();
  updateBalance();
  renderTransactions();
});

spendingLimitEl.addEventListener('keydown', function(e) {
  if (e.key === 'Enter') document.getElementById('setLimitBtn').click();
});

// ─── Chart ────────────────────────────────────────────────────────────────────

function updateChart() {
  var expenses = transactions.filter(function(t) { return t.type === 'expense'; });

  if (expenses.length === 0) {
    chartEmpty.classList.remove('hidden');
    chartCanvas.classList.add('hidden');
    if (chart) {
      chart.destroy();
      chart = null;
    }
    return;
  }

  chartEmpty.classList.add('hidden');
  chartCanvas.classList.remove('hidden');

  // Aggregate totals by category
  var totals = {};
  expenses.forEach(function(t) {
    totals[t.category] = (totals[t.category] || 0) + t.amount;
  });

  var labels = Object.keys(totals);
  var data   = Object.values(totals);
  var colors = labels.map(function(l) { return getCatMeta(l).color; });

  var textColor    = getComputedStyle(document.body).getPropertyValue('--text').trim()    || '#000';
  var surfaceColor = getComputedStyle(document.body).getPropertyValue('--surface').trim() || '#fff';

  if (chart) {
    chart.data.labels                      = labels;
    chart.data.datasets[0].data            = data;
    chart.data.datasets[0].backgroundColor = colors;
    chart.data.datasets[0].borderColor     = surfaceColor;
    chart.options.plugins.legend.labels.color = textColor;
    chart.update();
  } else {
    chart = new Chart(chartCanvas, {
      type: 'pie',
      data: {
        labels: labels,
        datasets: [{
          data:            data,
          backgroundColor: colors,
          borderWidth:     2,
          borderColor:     surfaceColor,
        }],
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color:   textColor,
              padding: 14,
              font:    { size: 12 },
            },
          },
          tooltip: {
            callbacks: {
              label: function(ctx) {
                return ' ' + ctx.label + ': $' + ctx.parsed.toFixed(2);
              },
            },
          },
        },
      },
    });
  }
}

// ─── Monthly Summary ──────────────────────────────────────────────────────────

function renderMonthly() {
  var key = monthKey(currentMonth);
  monthTitle.textContent = monthLabel(currentMonth);

  var monthTxns = transactions.filter(function(t) {
    return t.date.startsWith(key);
  });

  var income  = monthTxns.filter(function(t) { return t.type === 'income';  }).reduce(function(s, t) { return s + t.amount; }, 0);
  var expense = monthTxns.filter(function(t) { return t.type === 'expense'; }).reduce(function(s, t) { return s + t.amount; }, 0);
  var net     = income - expense;

  monthIncomeEl.textContent  = fmt(income);
  monthExpenseEl.textContent = fmt(expense);
  monthNetEl.textContent     = (net < 0 ? '-' : '') + fmt(net);
  monthNetEl.className       = 'stat-value ' + (net >= 0 ? 'income' : 'expense');

  monthlyList.innerHTML = '';

  if (monthTxns.length === 0) {
    monthlyList.innerHTML = '<li class="empty-state">No transactions this month.</li>';
    return;
  }

  var sorted = monthTxns.slice().sort(function(a, b) {
    return new Date(b.date) - new Date(a.date);
  });

  sorted.forEach(function(t) {
    var meta = getCatMeta(t.category);
    var li   = document.createElement('li');
    li.className = 'transaction-item';

    li.innerHTML =
      '<div class="cat-icon" style="background:' + meta.color + '22; color:' + meta.color + '">' +
        meta.icon +
      '</div>' +
      '<div class="transaction-info">' +
        '<div class="transaction-name">'  + escHtml(t.name)     + '</div>' +
        '<div class="transaction-meta">'  + escHtml(t.category) + ' · ' + fmtDate(t.date) + '</div>' +
      '</div>' +
      '<span class="transaction-amount ' + t.type + '">' +
        (t.type === 'income' ? '+' : '-') + fmt(t.amount) +
      '</span>' +
      '<button class="delete-btn" title="Delete transaction">🗑</button>';

    li.querySelector('.delete-btn').addEventListener('click', function() {
      deleteTransaction(t.id);
    });

    monthlyList.appendChild(li);
  });
}

document.getElementById('prevMonth').addEventListener('click', function() {
  currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
  renderMonthly();
});

document.getElementById('nextMonth').addEventListener('click', function() {
  currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
  renderMonthly();
});

// ─── View Toggle ──────────────────────────────────────────────────────────────

document.querySelectorAll('.view-btn').forEach(function(btn) {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.view-btn').forEach(function(b) {
      b.classList.remove('active');
    });
    btn.classList.add('active');

    var target = btn.dataset.view;
    document.querySelectorAll('.view').forEach(function(v) {
      var matches = v.id.endsWith(target);
      v.classList.toggle('hidden', !matches);
      v.classList.toggle('active',  matches);
    });

    if (target === 'monthly') renderMonthly();
  });
});

// ─── Dark / Light Mode ────────────────────────────────────────────────────────

function applyTheme() {
  document.body.classList.toggle('dark',  isDark);
  document.body.classList.toggle('light', !isDark);
  document.getElementById('themeToggle').textContent = isDark ? '☀️' : '🌙';

  if (chart) {
    var textColor    = getComputedStyle(document.body).getPropertyValue('--text').trim()    || '#000';
    var surfaceColor = getComputedStyle(document.body).getPropertyValue('--surface').trim() || '#fff';
    chart.options.plugins.legend.labels.color  = textColor;
    chart.data.datasets[0].borderColor         = surfaceColor;
    chart.update();
  }
}

document.getElementById('themeToggle').addEventListener('click', function() {
  isDark = !isDark;
  save();
  applyTheme();
});

// ─── Init ─────────────────────────────────────────────────────────────────────

function init() {
  load();
  applyTheme();

  if (spendingLimit > 0) {
    spendingLimitEl.value = spendingLimit;
  }

  rebuildCategorySelects();
  updateBalance();
  renderTransactions();
  updateChart();
  renderMonthly();
}

init();
