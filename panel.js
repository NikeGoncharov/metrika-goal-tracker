// panel.js
// Панель в DevTools, полностью синхронизированная с background.js

const counterFilter = document.getElementById("counterFilter");
const tbody = document.querySelector("#goalsTable tbody");
const clearBtn = document.getElementById("clearCache");
const info = document.getElementById("info");

let state = { counters: {}, activeCounter: null };

// Соединяемся с background
const port = chrome.runtime.connect({ name: "metrika-tracker-panel" });
console.log('[MetrikaTracker][Panel] 🔗 Подключение к background');

port.onMessage.addListener((msg) => {
  // 🔥 ВСЕГДА пересчитываем состояние
  chrome.storage.local.get(["state"], (r) => {
    state = r.state || { counters: {}, activeCounter: null };
    render();
  });
});

port.onDisconnect.addListener(() => {
  console.log('[MetrikaTracker][Panel] 💔 Соединение с background потеряно');
});

// =======================================
// UI
// =======================================

function render() {
  updateCounterFilter();
  updateInfo();
  renderTable();
}

function updateCounterFilter() {
  const counters = Object.keys(state.counters);

  // Очистить и заново построить
  counterFilter.innerHTML = `<option value="all">Все счётчики</option>`;
  counters.forEach((id) => {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = id;
    counterFilter.appendChild(opt);
  });

  // Выбираем активный по умолчанию
  if (state.activeCounter) {
    counterFilter.value = state.activeCounter;
  }
}

function updateInfo() {
  const selected = counterFilter.value;

  if (selected === "all") {
    info.textContent = `Сайт: — | Активный счётчик: Все`;
    return;
  }

  const site = state.counters[selected]?.site || "-";
  info.textContent = `Сайт: ${site} | Активный счётчик: ${selected}`;
}

function renderTable() {
  tbody.innerHTML = "";

  const selected = counterFilter.value;

  let goals = [];
  if (selected === "all") {
    // все цели всех счётчиков
    for (const id in state.counters) {
      goals = goals.concat(state.counters[id].goals);
    }
  } else {
    goals = state.counters[selected]?.goals || [];
  }

  goals.forEach((g) => {
    const tr = document.createElement("tr");
    tr.classList.add("new-goal");
    tr.innerHTML = `
      <td>${g.time}</td>
      <td>${g.type}</td>
      <td>${g.goal}</td>
      <td>${g.counterId}</td>
    `;
    tbody.appendChild(tr);
  });
}


// =======================================
// Очистка кэша
// =======================================

clearBtn.addEventListener("click", () => {
  chrome.storage.local.set({ state: { counters: {}, activeCounter: null } }, () => {
    state = { counters: {}, activeCounter: null };
    render();
  });
});


// =======================================
// Смена счётчика
// =======================================

counterFilter.addEventListener("change", () => {
  const selected =
    counterFilter.value === "all" ? null : counterFilter.value;

  state.activeCounter = selected;

  chrome.storage.local.get(["state"], (r) => {
    const newState = r.state || { counters: {}, activeCounter: null };
    newState.activeCounter = selected;

    chrome.storage.local.set({ state: newState }, () => {
      render();
    });
  });
});
