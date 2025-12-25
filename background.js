// background.js
// Устойчивый к "засыпанию" service worker, полностью синхронизирует состояние с панелью.

const ports = new Set();

// При появлении панели DevTools
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "metrika-tracker-panel") {
    console.log(
      `[MetrikaTracker][BG] 🔌 Панель подключена (порт открыт). Активных портов: ${ports.size + 1}`
    );

    ports.add(port);

    // Отправляем состояние сразу при подключении
    chrome.storage.local.get(["state"], (r) => {
      if (r.state) {
        port.postMessage({ type: "INIT_STATE", data: r.state });
      }
    });

    port.onDisconnect.addListener(() => {
      ports.delete(port);
      console.log(
        `[MetrikaTracker][BG] ❌ Панель отключена (порт закрыт). Активных портов: ${ports.size}`
      );
    });
  }
});

// Любые входящие события от content_script.js
chrome.runtime.onMessage.addListener((msg) => {
  console.log(
    `[MetrikaTracker][BG] 📥 Получено сообщение: ${msg.type}`
  );
  
  chrome.storage.local.get(["state"], (r) => {
    const state = r.state || { counters: {}, activeCounter: null };

    // События счётчика
    if (msg.type === "METRIKA_COUNTER") {
      const { counterId, site } = msg.data;
      if (!state.counters[counterId]) state.counters[counterId] = { goals: [], site };
      if (!state.activeCounter) state.activeCounter = counterId;
    }

    // События цели
    if (msg.type === "REACH_GOAL_SIMPLE") {
      const { counterId } = msg.data;
      if (!state.counters[counterId]) state.counters[counterId] = { goals: [] };
      state.counters[counterId].goals.unshift(msg.data);
      if (state.counters[counterId].goals.length > 300) {
        state.counters[counterId].goals.length = 300;
      }
    }

    chrome.storage.local.set({ state }, () => {
      for (const port of ports) {
        try {
          port.postMessage(msg);
        } catch (e) {}
      }
    });
  });

  return false;
});


// PING каждые 15 секунд — чтобы не уснул SW
setInterval(() => {
  for (const port of ports) {
    try {
      port.postMessage({ type: "PING" });
    } catch {}
  }
}, 15000);
