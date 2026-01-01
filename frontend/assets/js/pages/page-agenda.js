/**
 * PRONTIO - Page bootstrap: Agenda
 * - Mantém este arquivo pequeno: apenas delega para PRONTIO.agenda.init()
 */
(function (global) {
  "use strict";

  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO.pages = PRONTIO.pages || {};

  function initAgendaPage() {
    const body = global.document && global.document.body;
    const pageId =
      (body &&
        (body.getAttribute("data-page-id") ||
          (body.dataset && (body.dataset.pageId || body.dataset.page)))) ||
      "";

    if (String(pageId).toLowerCase().trim() !== "agenda") return;

    if (PRONTIO.agenda && typeof PRONTIO.agenda.init === "function") {
      PRONTIO.agenda.init();
    } else {
      console.warn("[PRONTIO.agenda] PRONTIO.agenda.init não encontrado. Verifique ordem dos scripts.");
    }
  }

  if (typeof PRONTIO.registerPage === "function") {
    PRONTIO.registerPage("agenda", initAgendaPage);
  } else {
    PRONTIO.pages.agenda = { init: initAgendaPage };
  }
})(window);
