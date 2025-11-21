// devtools.js — создаёт панель DevTools
chrome.devtools.panels.create(
  "Metrika Tracker",
  "",
  "panel.html",
  function (panel) {
    console.log('[DEVTOOLS] Metrika Tracker panel created');
  }
);
