// =====================================
// PRONTIO - core/ui-core.js
// Utilidades genéricas de UI
//
// Responsabilidades:
// - Mostrar/ocultar loading global
// - Atualizar nome do usuário na sidebar
// - Ajustar ano no rodapé
// - Pequenos helpers de interface reutilizáveis
//
// Não contém regras de negócio.
// =====================================

(function (global, document) {
  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  const core = (PRONTIO.core = PRONTIO.core || {});
  const uiCore = (core.uiCore = core.uiCore || {});
  const auth = PRONTIO.auth || {};
  const dom = (core.dom = core.dom || {});

  const qs =
    dom.qs ||
    function (selector, root) {
      return (root || document).querySelector(selector);
    };

  // -----------------------------------------
  // Loading global
  // -----------------------------------------

  function ensureLoadingElement_() {
    let el = document.getElementById("prontio-global-loading");
    if (!el) {
      el = document.createElement("div");
      el.id = "prontio-global-loading";
      el.className = "prontio-global-loading hidden";
      el.innerHTML = '<div class="spinner"></div><div class="label">Carregando...</div>';
      document.body.appendChild(el);
    }
    return el;
  }

  function showLoading(message) {
    const el = ensureLoadingElement_();
    const label = el.querySelector(".label");
    if (label && message) {
      label.textContent = message;
    }
    el.classList.remove("hidden");
  }

  function hideLoading() {
    const el = document.getElementById("prontio-global-loading");
    if (!el) return;
    el.classList.add("hidden");
  }

  // -----------------------------------------
  // Sidebar / nome do usuário / ano
  // -----------------------------------------

  function updateSidebarUserName() {
    const el = document.getElementById("sidebarUserName");
    if (!el) return;

    if (!auth || typeof auth.getUserName !== "function") {
      el.textContent = "Usuário";
      return;
    }

    const nome = auth.getUserName();
    el.textContent = nome || "Usuário";
  }

  function updateSidebarYear() {
    const el = document.getElementById("sidebarYear");
    if (!el) return;
    el.textContent = String(new Date().getFullYear());
  }

  // -----------------------------------------
  // Títulos de página (topbar)
// -----------------------------------------
  function setTopbarTitle(title, subtitle) {
    const titleEl = qs("#topbar-title-text") || qs(".topbar-title-main h1");
    const subtitleEl = qs("#topbar-subtitle") || qs(".topbar-subtitle");

    if (titleEl && title) {
      titleEl.textContent = title;
    }
    if (subtitleEl && typeof subtitle !== "undefined") {
      subtitleEl.textContent = subtitle || "";
    }
  }

  // -----------------------------------------
  // Inicialização leve de UI global
  // (chamada pelo main.js, se quiser)
// -----------------------------------------
  function initGlobalUI() {
    updateSidebarUserName();
    updateSidebarYear();
  }

  // -----------------------------------------
  // Exposição pública
  // -----------------------------------------
  uiCore.showLoading = showLoading;
  uiCore.hideLoading = hideLoading;
  uiCore.updateSidebarUserName = updateSidebarUserName;
  uiCore.updateSidebarYear = updateSidebarYear;
  uiCore.setTopbarTitle = setTopbarTitle;
  uiCore.initGlobalUI = initGlobalUI;
})(window, document);
