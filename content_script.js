// content_script.js
// Отслеживает все счётчики Яндекс.Метрики и цели на сайте.
// Добавлен подробный лог.

(function () {
  function log(...args) {
    console.log('[MetrikaTracker]', ...args);
  }

  const processedUrls = new Set();

  function send(type, data) {
    try {
      chrome.runtime.sendMessage({ type, data });
    } catch (e) {
      console.warn('[MetrikaTracker] sendMessage error', e);
    }
  }

  log('Контент-скрипт запущен на странице:', window.location.hostname);

  function analyzeMetrikaUrl(url) {
    if (!url || processedUrls.has(url)) return;
    if (!/mc\.yandex\.ru\/watch/i.test(url)) return;
    processedUrls.add(url);

    const decoded = decodeURIComponent(url);
    const counterMatch = decoded.match(/watch\/(\d+)/);
    const counterId = counterMatch ? counterMatch[1] : null;
    if (!counterId) return;

    log(`→ Найден запрос Метрики (watch/${counterId})`);

    let goalName = null;
    const goalMatch = decoded.match(/page-url=goal:\/\/([^&]+)/);
    if (goalMatch) {
      goalName = goalMatch[1].replace(/^https?:\/\//, '').replace(/^[^/]+\//, '');
    }

    send('METRIKA_COUNTER', { counterId, site: window.location.hostname });

    if (goalName) {
      const eventData = {
        counterId,
        site: window.location.hostname,
        time: new Date().toLocaleTimeString(),
        type: 'Событие JavaScript',
        goal: goalName
      };
      log(`✔ Обнаружена цель "${goalName}" для счётчика ${counterId}`);
      send('REACH_GOAL_SIMPLE', eventData);
    }
  }

  // Перехватываем все fetch / XHR / PerformanceObserver
  const origFetch = window.fetch;
  window.fetch = async function (...args) {
    if (args[0] && typeof args[0] === 'string') analyzeMetrikaUrl(args[0]);
    return origFetch.apply(this, args);
  };

  const origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (...args) {
    if (args[1] && typeof args[1] === 'string') analyzeMetrikaUrl(args[1]);
    return origOpen.apply(this, args);
  };

  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name && /mc\.yandex\.ru\/watch/i.test(entry.name)) {
          analyzeMetrikaUrl(entry.name);
        }
      }
    });
    observer.observe({ entryTypes: ['resource'] });
  } catch (e) {
    console.warn('[MetrikaTracker] PerformanceObserver error', e);
  }
})();
