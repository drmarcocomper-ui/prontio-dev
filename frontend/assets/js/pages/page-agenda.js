// frontend/assets/js/pages/page-agenda.js
(function (global, document) {
  "use strict";

  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO.pages = PRONTIO.pages || {};
  PRONTIO._pageInited = PRONTIO._pageInited || {};

  function getEntryInit_() {
    return PRONTIO.features &&
      PRONTIO.features.agenda &&
      PRONTIO.features.agenda.entry &&
      typeof PRONTIO.features.agenda.entry.init === "function"
      ? PRONTIO.features.agenda.entry.init
      : null;
  }

  function initAgendaPage() {
    if (PRONTIO._pageInited.agenda === true) return;
    PRONTIO._pageInited.agenda = true;

    let attempt = 0;
    const maxAttempts = 25; // ~2.5s

    function tick() {
      attempt += 1;
      const initFn = getEntryInit_();

      if (initFn) {
        try {
          initFn({ document: document, window: global });
        } catch (e) {
          console.error("[PRONTIO][Agenda] Erro ao inicializar agenda.entry:", e);
        }
        return;
      }

      if (attempt >= maxAttempts) {
        console.error("[PRONTIO][Agenda] agenda.entry.init não encontrado. Scripts carregados:", (PRONTIO._debug && PRONTIO._debug.loaded) || []);
        console.error("[PRONTIO][Agenda] Scripts que falharam:", (PRONTIO._debug && PRONTIO._debug.failed) || []);
        return;
      }

      setTimeout(tick, 100);
    }

    tick();
  }

  PRONTIO.pages.agenda = PRONTIO.pages.agenda || {};
  PRONTIO.pages.agenda.init = initAgendaPage;

  try {
    if (typeof PRONTIO.registerPage === "function") {
      PRONTIO.registerPage("agenda", initAgendaPage);
    }
  } catch (_) {}

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAgendaPage);
  } else {
    initAgendaPage();
  }
})(window, document);
