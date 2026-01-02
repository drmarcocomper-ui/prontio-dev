// frontend/assets/js/pages/page-agenda.js
/**
 * PRONTIO — Page bootstrap: Agenda
 * --------------------------------
 * ✅ Arquitetura atual:
 * - NÃO usa PRONTIO.Agenda.initPage (legacy)
 * - Usa o entry do módulo novo: PRONTIO.features.agenda.entry
 * - main.js é quem carrega os scripts; este arquivo só dispara init.
 */

(function (global, document) {
  "use strict";

  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO.pages = PRONTIO.pages || {};
  PRONTIO._pageInited = PRONTIO._pageInited || {};

  function initAgendaPage() {
    if (PRONTIO._pageInited.agenda === true) return;
    PRONTIO._pageInited.agenda = true;

    const entry =
      PRONTIO.features &&
      PRONTIO.features.agenda &&
      PRONTIO.features.agenda.entry
        ? PRONTIO.features.agenda.entry
        : null;

    if (!entry) {
      console.error("[PRONTIO][Agenda] agenda.entry não encontrado. Verifique se assets/js/features/agenda/agenda.entry.js foi carregado via main.js.");
      return;
    }

    // Tentativas de inicialização (mantém compat com nomes possíveis)
    try {
      if (typeof entry.init === "function") return entry.init({ document: document });
      if (typeof entry.initPage === "function") return entry.initPage({ document: document });
      if (typeof entry.bootstrap === "function") return entry.bootstrap({ document: document });
    } catch (e) {
      console.error("[PRONTIO][Agenda] Erro ao inicializar agenda.entry:", e);
      return;
    }

    console.error("[PRONTIO][Agenda] agenda.entry carregado, mas sem método init/initPage/bootstrap.");
  }

  PRONTIO.pages.agenda = PRONTIO.pages.agenda || {};
  PRONTIO.pages.agenda.init = initAgendaPage;

  // router (se existir)
  try {
    if (PRONTIO.core && PRONTIO.core.router && typeof PRONTIO.core.router.register === "function") {
      PRONTIO.core.router.register("agenda", initAgendaPage);
    }
  } catch (_) {}

  // registerPage (se existir)
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
