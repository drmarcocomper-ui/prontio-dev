// frontend/assets/js/core/app.js
// ============================================================
// PRONTIO - App bootstrap (Front-end)
// ============================================================
// Objetivos:
// - Inicializar widgets globais (Chat no topo)
// - Não quebrar páginas que ainda não tenham todos os módulos carregados
//
// ✅ Importante: este arquivo NÃO deve ficar dentro do api.js.
// ============================================================

(function (global, document) {
  "use strict";

  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO.core = PRONTIO.core || {};

  function log_(...args) {
    try { console.log("[PRONTIO.app]", ...args); } catch (_) {}
  }

  function warn_(...args) {
    try { console.warn("[PRONTIO.app]", ...args); } catch (_) {}
  }

  function ensureScript_(src) {
    return new Promise((resolve, reject) => {
      try {
        // já carregado?
        const existing = document.querySelector(`script[data-prontio-src="${src}"]`);
        if (existing) return resolve(true);

        const s = document.createElement("script");
        s.async = true;
        s.src = src;
        s.dataset.prontioSrc = src;

        s.onload = () => resolve(true);
        s.onerror = () => reject(new Error("Falha ao carregar script: " + src));

        document.head.appendChild(s);
      } catch (e) {
        reject(e);
      }
    });
  }

  async function initChatWidget_() {
    // Se o widget já estiver carregado, só inicializa
    if (PRONTIO.widgets && PRONTIO.widgets.chat && typeof PRONTIO.widgets.chat.init === "function") {
      PRONTIO.widgets.chat.init();
      return;
    }

    // Caso não esteja carregado, tenta carregar automaticamente.
    // Caminho padrão no PRONTIO:
    const src = "assets/js/widgets/widget-chat.js";

    try {
      await ensureScript_(src);
    } catch (e) {
      warn_("Widget chat não carregou:", e && e.message ? e.message : String(e));
      return;
    }

    if (PRONTIO.widgets && PRONTIO.widgets.chat && typeof PRONTIO.widgets.chat.init === "function") {
      PRONTIO.widgets.chat.init();
    } else {
      warn_("Widget chat carregou, mas PRONTIO.widgets.chat.init não encontrado.");
    }
  }

  async function init_() {
    // Widgets globais (não depende do router)
    await initChatWidget_();

    // Se existir router do PRONTIO, inicia
    try {
      if (PRONTIO.core && PRONTIO.core.router && typeof PRONTIO.core.router.start === "function") {
        PRONTIO.core.router.start();
      }
    } catch (e) {
      warn_("Falha ao iniciar router:", e && e.message ? e.message : String(e));
    }

    log_("init ok");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => { init_(); });
  } else {
    init_();
  }

})(window, document);
