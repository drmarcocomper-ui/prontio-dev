// =====================================
// PRONTIO - widgets/widget-modais.js
// Wrapper para helpers de modais (PRONTIO.ui.modals)
//
// Responsabilidades:
// - Inicializar binds automáticos de data-modal-open/close
// - Expor operações básicas em PRONTIO.widgets.modais
//
// Requer que ui/modals.js já tenha sido carregado antes.
// =====================================

(function (global, document) {
  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO.widgets = PRONTIO.widgets || {};
  PRONTIO.ui = PRONTIO.ui || {};

  function init() {
    const modals = PRONTIO.ui && PRONTIO.ui.modals;
    if (!modals || typeof modals.bindTriggers !== "function") {
      console.warn(
        "[PRONTIO.widget-modais] PRONTIO.ui.modals não encontrado ou incompleto."
      );
      return;
    }

    // Faz o bind automático em todo o documento
    modals.bindTriggers(document);
  }

  // Expor como widget dentro de PRONTIO.widgets
  PRONTIO.widgets.modais = {
    init: init,
    open: function (target) {
      if (
        PRONTIO.ui &&
        PRONTIO.ui.modals &&
        typeof PRONTIO.ui.modals.open === "function"
      ) {
        PRONTIO.ui.modals.open(target);
      }
    },
    close: function (target) {
      if (
        PRONTIO.ui &&
        PRONTIO.ui.modals &&
        typeof PRONTIO.ui.modals.close === "function"
      ) {
        PRONTIO.ui.modals.close(target);
      }
    },
  };

  // Auto-init simples (opcional; não atrapalha o main.js)
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(window, document);
