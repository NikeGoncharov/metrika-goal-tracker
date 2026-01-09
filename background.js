// background.js
// Центральное хранилище + синхронизация с панелью

console.log('[MetrikaTracker][BG] Service worker запущен');

const ports = new Set();

chrome.runtime.onConnect.addListener(port => {
  if (port.name !== 'metrika-tracker-panel') return;

  ports.add(port);
  console.log('[MetrikaTracker][BG] Панель подключена');

  chrome.storage.local.get(['state'], r => {
    if (r.state) {
      port.postMessage({ type: 'INIT_STATE' });
    }
  });

  port.onDisconnect.addListener(() => {
    ports.delete(port);
    console.log('[MetrikaTracker][BG] Панель отключена');
  });
});

chrome.runtime.onMessage.addListener(msg => {
  if (msg.type !== 'METRIKA_EVENT') return;

  chrome.storage.local.get(['state'], r => {
    const state = r.state || {
      counters: {},
      activeCounter: null,
      activeModule: 'reachGoal'
    };

    const { counterId, site, module } = msg.data;

    if (!state.counters[counterId]) {
      state.counters[counterId] = {
        site,
        events: {
          reachGoal: [],
          webvisor: [],
          clickmap: [],
          ecommerce: [],
          other: []
        }
      };
      if (!state.activeCounter) state.activeCounter = counterId;
    }

    // ecommerce — оставляем только тело
    if (module === 'ecommerce') {
      const idx = msg.data.url.indexOf('site-info=');
      if (idx !== -1) {
        msg.data.url = msg.data.url.slice(idx);
      }
    }

    state.counters[counterId].events[module].unshift(msg.data);

    chrome.storage.local.set({ state }, () => {
      for (const port of ports) {
        try {
          port.postMessage({ type: 'STATE_UPDATED' });
        } catch (e) {
          console.warn('[MetrikaTracker][BG] port error', e);
        }
      }
    });
  });
});
