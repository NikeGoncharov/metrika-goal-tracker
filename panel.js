// panel.js

function log(...args) {
  console.log('[MetrikaTracker][Panel]', ...args);
}

// TabId текущей инспектируемой вкладки
const tabId = chrome.devtools.inspectedWindow.tabId;
log('Панель открыта для tab:', tabId);

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

    // Регистрируем tabId в background
    p.postMessage({ type: 'REGISTER_TAB', tabId });

    p.onMessage.addListener(msg => {
      log('Сообщение от background:', msg.type);
      portStatus = 'connected';
      updateStatus();

      if (msg.state) {
        state = msg.state;
        render();
      }
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
  chrome.storage.local.get(['tabs'], r => {
    const tabs = r.tabs || {};
    if (!tabs[tabId]) return;
    state = tabs[tabId];
    render();
  });
}, 1000);

// ===== UI =====
clearBtn.onclick = () => {
  log('Очистка кэша для tab:', tabId);
  chrome.storage.local.get(['tabs'], r => {
    const tabs = r.tabs || {};
    tabs[tabId] = { counters: {}, activeCounter: null, activeModule: 'reachGoal' };
    chrome.storage.local.set({ tabs }, () => location.reload());
  });
};

select.onchange = () => {
  state.activeCounter = select.value;
  chrome.storage.local.get(['tabs'], r => {
    const tabs = r.tabs || {};
    tabs[tabId] = state;
    chrome.storage.local.set({ tabs });
  });
  render();
};

moduleButtons.forEach(btn => {
  btn.onclick = () => {
    moduleButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.activeModule = btn.dataset.module;
    chrome.storage.local.get(['tabs'], r => {
      const tabs = r.tabs || {};
      tabs[tabId] = state;
      chrome.storage.local.set({ tabs });
    });
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

    const tdTime = document.createElement('td');
    tdTime.textContent = e.time;

    const tdEvent = document.createElement('td');
    tdEvent.textContent = e.goal || e.url;

    tr.appendChild(tdTime);
    tr.appendChild(tdEvent);
    tbody.appendChild(tr);
  });
}
