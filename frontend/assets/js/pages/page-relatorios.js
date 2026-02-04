// =====================================
// PRONTIO - pages/page-relatorios.js
// Stub mínimo - Módulo em desenvolvimento
// =====================================

(function (global, document) {
  "use strict";

  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO.pages = PRONTIO.pages || {};
  PRONTIO.pages.relatorios = PRONTIO.pages.relatorios || {};

  // ✅ Estado para evitar inicialização duplicada
  let initialized = false;

  /**
   * Inicializa a página de Relatórios
   * Stub para evitar erros de carregamento
   */
  function initRelatoriosPage() {
    if (initialized) return;
    initialized = true;

    // Placeholder - módulo em desenvolvimento
    console.info("[Relatorios] Módulo em desenvolvimento.");

    // Mostra mensagem se elemento existir
    const msgEl = document.getElementById("relatoriosMsg");
    if (msgEl) {
      msgEl.textContent = "Módulo de Relatórios em desenvolvimento.";
      msgEl.classList.remove("is-hidden");
    }
  }

  // ✅ Registro no PRONTIO (para main.js)
  PRONTIO.pages.relatorios.init = initRelatoriosPage;

})(window, document);
