// =====================================
// PRONTIO - core/guard.js
// Caminho: frontend/assets/js/core/guard.js
// =====================================
//
// ✅ Melhor prática adotada:
// - Guard oficial fica no main.js (carrega infra + evita flash).
// - Este arquivo fica como fallback/compat.
// - Se main.js já rodou, este guard não interfere.
//
// ✅ PASSO 2 (padronização):
// - Usa PRONTIO.auth.requireAuth (local) + PRONTIO.auth.me() (server-side)
// - me() já trata AUTH_* e aplica logout/redirect de forma consistente.
// =====================================

(function (global) {
  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});

  // evita rodar duas vezes em casos de includes duplicados
  let _ran = false;

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
    if (_ran) return;
    _ran = true;

    // Não roda no login
    if (isLoginPage_()) return;

    // ✅ Se main.js já rodou, não faz nada
    if (PRONTIO._mainBootstrapped) return;

    if (!PRONTIO.auth || typeof PRONTIO.auth.requireAuth !== "function") {
      console.warn("[PRONTIO.guard] PRONTIO.auth.requireAuth não encontrado.");
      return;
    }

    // 1) Bloqueio local imediato (sem flash)
    const ok = PRONTIO.auth.requireAuth({ redirect: true });
    if (!ok) return;

    // 2) Validação server-side canônica
    // - usa PRONTIO.auth.me() (não ensureSession), pois me() já padroniza AUTH_* e pode redirecionar.
    try {
      if (PRONTIO.auth && typeof PRONTIO.auth.me === "function") {
        await PRONTIO.auth.me();
      }
    } catch (e) {
      // ✅ NÃO faz logout automático - só desloga ao clicar em "Sair"
      // Apenas loga o erro mas continua a sessão
      console.warn("[Guard] Erro ao validar sessão (ignorado):", e && e.code ? e.code : e);
    }
  }

  try {
    if (global.document && global.document.readyState !== "loading") {
      boot_();
    } else {
      global.document && global.document.addEventListener("DOMContentLoaded", boot_);
    }
  } catch (_) {}

})(window);
