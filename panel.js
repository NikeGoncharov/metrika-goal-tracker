// panel.js

function log(...args) {
  console.log('[MetrikaTracker][Panel]', ...args);
}

// STATE
let state = {
  counters: {},
  activeCounter: null,
  activeModule: 'reachGoal'
};

// DOM ELEMENTS
const select = document.getElementById('counterSelect');
const siteEl = document.getElementById('site');
const statusEl = document.getElementById('status');
const clearBtn = document.getElementById('clear');
const tbody = document.getElementById('table');
const moduleButtons = document.querySelectorAll('#modules button');

// ===== Индикатор порта =====
let portStatus = 'polling'; // 'connected' | 'polling'

function updateStatus() {
  if (!statusEl) return;

  if (portStatus === 'connected') {
    statusEl.textContent = ' ● порт активен';
    statusEl.style.color = '#2e7d32';
  } else {
    statusEl.textContent = ' ● порт неактивен';
    statusEl.style.color = '#ef6c00';
  }
}

// ===== CONNECT PORT =====
function connectPort() {
  try {
    const p = chrome.runtime.connect({ name: 'metrika-tracker-panel' });

    p.onMessage.addListener(() => {
      log('Сообщение от background');
      portStatus = 'connected';
      updateStatus();

      chrome.storage.local.get(['state'], r => {
        if (!r.state) return;
        state = r.state;
        render();
      });
    });

    p.onDisconnect.addListener(() => {
      console.warn('[MetrikaTracker][Panel] порт отключён');
      portStatus = 'polling';
      updateStatus();
    });

    log('Порт подключён');
    portStatus = 'connected';
    updateStatus();

    return p;
  } catch (e) {
    console.warn('[MetrikaTracker][Panel] ошибка подключения порта', e);
    portStatus = 'polling';
    updateStatus();
    return null;
  }
}

let port = connectPort();

// ===== Fallback polling (если порт уснул) =====
setInterval(() => {
  chrome.storage.local.get(['state'], r => {
    if (!r.state) return;
    state = r.state;
    render();
  });
}, 1000);

// ===== UI =====
clearBtn.onclick = () => {
  log('Очистка кэша');
  chrome.storage.local.set({
    state: { counters: {}, activeCounter: null, activeModule: 'reachGoal' }
  }, () => location.reload());
};

select.onchange = () => {
  state.activeCounter = select.value;
  chrome.storage.local.set({ state });
  render();
};

moduleButtons.forEach(btn => {
  btn.onclick = () => {
    moduleButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.activeModule = btn.dataset.module;
    chrome.storage.local.set({ state });
    renderTable();
  };
});

// ===== RENDER =====
function render() {
  renderCounters();
  renderInfo();
  renderTable();
}

function renderCounters() {
  select.innerHTML = '';
  Object.keys(state.counters).forEach(id => {
    const o = document.createElement('option');
    o.value = id;
    o.textContent = id;
    select.appendChild(o);
  });

  if (state.activeCounter) {
    select.value = state.activeCounter;
  }
}

function renderInfo() {
  if (!state.activeCounter) {
    siteEl.textContent = '';
    return;
  }

  const c = state.counters[state.activeCounter];
  if (!c) return;

  siteEl.textContent = c.site || '';
}

function renderTable() {
  tbody.innerHTML = '';

  const c = state.counters[state.activeCounter];
  if (!c || !c.events) return;

  const events = c.events[state.activeModule] || [];

  events.forEach(e => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${e.time}</td>
      <td>${e.goal || e.url}</td>
    `;
    tbody.appendChild(tr);
  });
}
