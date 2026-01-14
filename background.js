// background.js
// Центральное хранилище + синхронизация с панелью
// Состояние хранится отдельно для каждой вкладки (tabId)

console.log('[MetrikaTracker][BG] Service worker запущен');

// Map: tabId -> port
const tabPorts = new Map();

chrome.runtime.onConnect.addListener(port => {
  if (port.name !== 'metrika-tracker-panel') return;

  // Ожидаем сообщение с tabId от панели
  port.onMessage.addListener(msg => {
    if (msg.type === 'REGISTER_TAB') {
      const tabId = msg.tabId;
      tabPorts.set(tabId, port);
      console.log('[MetrikaTracker][BG] Панель подключена для tab:', tabId);

      // Отправляем начальное состояние
      chrome.storage.local.get(['tabs'], r => {
        const tabs = r.tabs || {};
        if (tabs[tabId]) {
          port.postMessage({ type: 'INIT_STATE', state: tabs[tabId] });
        }
      });
    }
  });

  port.onDisconnect.addListener(() => {
    // Удаляем порт из Map
    for (const [tabId, p] of tabPorts) {
      if (p === port) {
        tabPorts.delete(tabId);
        console.log('[MetrikaTracker][BG] Панель отключена для tab:', tabId);
        break;
      }
    }
  });
});

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type !== 'METRIKA_EVENT') return;

  // Получаем tabId из sender
  const tabId = sender.tab?.id;
  if (!tabId) {
    console.warn('[MetrikaTracker][BG] Нет tabId в sender');
    return;
  }

  chrome.storage.local.get(['tabs'], r => {
    const tabs = r.tabs || {};

    // Инициализируем состояние для вкладки
    if (!tabs[tabId]) {
      tabs[tabId] = {
        counters: {},
        activeCounter: null,
        activeModule: 'reachGoal'
      };
    }

    const state = tabs[tabId];
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

    chrome.storage.local.set({ tabs }, () => {
      // Уведомляем только порт нужной вкладки
      const port = tabPorts.get(tabId);
      if (port) {
        try {
          port.postMessage({ type: 'STATE_UPDATED', state });
        } catch (e) {
          console.warn('[MetrikaTracker][BG] port error', e);
          tabPorts.delete(tabId);
        }
      }
    });
  });
});

// Очистка данных при закрытии вкладки
chrome.tabs.onRemoved.addListener(tabId => {
  chrome.storage.local.get(['tabs'], r => {
    const tabs = r.tabs || {};
    if (tabs[tabId]) {
      delete tabs[tabId];
      chrome.storage.local.set({ tabs });
      console.log('[MetrikaTracker][BG] Данные очищены для tab:', tabId);
    }
  });
  tabPorts.delete(tabId);
});
