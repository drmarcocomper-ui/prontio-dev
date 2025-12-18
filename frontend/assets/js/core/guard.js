// =====================================
// PRONTIO - core/guard.js
// Caminho: frontend/assets/js/core/guard.js
// =====================================

(function (global) {
  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});

  function isLoginPage_() {
    try {
      const body = global.document && global.document.body;
      const pageId = (body && body.dataset && (body.dataset.pageId || body.dataset.page)) || "";
      if (String(pageId).toLowerCase() === "login") return true;
    } catch (e) {}

    const path = (global.location && global.location.pathname)
      ? global.location.pathname.toLowerCase()
      : "";

    return (
      path.endsWith("/index.html") ||
      path.endsWith("index.html") ||
      path.endsWith("/login.html") ||
      path.endsWith("login.html")
    );
  }

  async function boot_() {
    // Não roda no login
    if (isLoginPage_()) return;

    if (!PRONTIO.auth || typeof PRONTIO.auth.requireAuth !== "function") {
      console.warn("[PRONTIO.guard] PRONTIO.auth.requireAuth não encontrado.");
      return;
    }

    // 1) Bloqueio básico
    const ok = PRONTIO.auth.requireAuth({ redirect: true });
    if (!ok) return;

    // 2) Validação no servidor (mais profissional)
    try {
      if (typeof PRONTIO.auth.validateSession === "function") {
        const result = await PRONTIO.auth.validateSession();
        if (!result || result.ok === false) {
          PRONTIO.auth.clearSession && PRONTIO.auth.clearSession();
          PRONTIO.auth.requireAuth({ redirect: true });
          return;
        }
      }
    } catch (e) {}

    // 3) Helpers de UI
    try {
      if (typeof PRONTIO.auth.bindLogoutButtons === "function") {
        PRONTIO.auth.bindLogoutButtons();
      }
      if (typeof PRONTIO.auth.renderUserLabel === "function") {
        PRONTIO.auth.renderUserLabel();
      }
    } catch (e) {}
  }

  global.document?.addEventListener("DOMContentLoaded", boot_);
})(window);
