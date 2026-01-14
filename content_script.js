// content_script.js
// Отслеживание сетевых запросов Яндекс.Метрики через PerformanceObserver

(function () {
  const processedUrls = new Set();
  const loggedCounters = new Set();

  function log(...args) {
    console.log('[MetrikaTracker][CS]', ...args);
  }

  function warn(...args) {
    console.warn('[MetrikaTracker][CS]', ...args);
  }

  // INIT
  log('Инициализация контент-скрипта');
  log('Текущий сайт:', location.hostname);

  // MODULE DETECTION
  function detectModule(url) {
    const u = url.toLowerCase();

    if (u.includes('/webvisor/')) return 'webvisor';
    if (u.includes('/clmap/')) return 'clickmap';
    if (u.includes('page-url=goal://')) return 'reachGoal';
    if (u.includes('ecommerce')) return 'ecommerce';

    return 'other';
  }

  // MAIN ANALYZE
  function analyze(url) {
    if (!url?.includes('mc.yandex.ru')) return;
    if (processedUrls.has(url)) return;
    processedUrls.add(url);

    let decoded = url;
    try {
      decoded = decodeURIComponent(url);
    } catch (e) {
      warn('Не удалось декодировать URL', url);
    }

    // COUNTER ID
    const counterMatch =
      decoded.match(/\/watch\/(\d+)/) ||
      decoded.match(/\/webvisor\/(\d+)/) ||
      decoded.match(/\/clmap\/(\d+)/);

    const counterId = counterMatch ? counterMatch[1] : null;

    if (!counterId) {
      warn('Не удалось определить ID счётчика', decoded);
      return;
    }

    if (!loggedCounters.has(counterId)) {
      loggedCounters.add(counterId);
      log('Найден счётчик Метрики:', counterId);
    }

    // MODULE
    const module = detectModule(decoded);

    // GOAL (only reachGoal)
    let goal = null;
    if (module === 'reachGoal') {
      const m = decoded.match(/page-url=goal:\/\/([^&]+)/);
      if (m) {
        goal = m[1]
          .replace(/^https?:\/\//, '')
          .replace(/^[^/]+\//, '');
      }
    }

    // LOG FOUND EVENT
    log('Обнаружен запрос Метрики', {
      counterId,
      module,
      goal: goal || '—'
    });

    // SEND TO BACKGROUND
    try {
      chrome.runtime.sendMessage({
        type: 'METRIKA_EVENT',
        data: {
          counterId,
          site: location.hostname,
          module,
          goal,
          url: decoded,
          time: new Date().toLocaleTimeString()
        }
      });

      log('Событие отправлено в background', {
        counterId,
        module
      });
    } catch (e) {
      warn('Ошибка отправки события в background', e);
    }
  }

  // PERFORMANCE OBSERVER - единственный надёжный способ перехвата
  // (fetch/XHR переопределения не работают из-за isolated world)
  try {
    const observer = new PerformanceObserver(list => {
      list.getEntries().forEach(entry => {
        if (entry.name) analyze(entry.name);
      });
    });

    observer.observe({ entryTypes: ['resource'] });
    log('PerformanceObserver запущен');
  } catch (e) {
    warn('PerformanceObserver не поддерживается', e);
  }
})();
