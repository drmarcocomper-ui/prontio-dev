// frontend/assets/js/core/app.js
// ============================================================
// PRONTIO - App bootstrap (Front-end) [PROFISSIONALIZADO]
// ============================================================
// Objetivo:
// - Ser um módulo idempotente chamado pelo main.js (único bootstrap).
// - NÃO auto-inicializar (evita init duplicado e estados inconsistentes).
// - NÃO injetar scripts por conta própria (loader central é o main.js).
//
// ✅ PASSO 2 (padronização global):
// - Guard oficial aqui (antes do router):
//   PRONTIO.core.session.ensureAuthenticated({ redirect:true })
// - Exceções: login/forgot-password/reset-password (páginas públicas)
//
// ✅ PROFISSIONAL (robustez de deploy):
// - Health-check do backend ANTES do guard e do router, usando Registry_ListActions.
// - Se o backend estiver desatualizado (deploy errado), interrompe boot e exibe aviso claro.
// ============================================================

(function (global) {
  "use strict";

  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO.core = PRONTIO.core || {};
  PRONTIO.app = PRONTIO.app || {};

  function log_(...args) {
    try { console.log("[PRONTIO.app]", ...args); } catch (_) {}
  }

  function warn_(...args) {
    try { console.warn("[PRONTIO.app]", ...args); } catch (_) {}
  }

  function getPageId_() {
    try {
      const body = global.document && global.document.body;
      const pid =
        (body &&
          (body.getAttribute("data-page-id") ||
            (body.dataset && (body.dataset.pageId || body.dataset.page)))) ||
        "";
      return String(pid || "").toLowerCase().trim();
    } catch (_) {
      return "";
    }
  }

  function isPublicPage_(pageId) {
    const pid = String(pageId || "").toLowerCase().trim();

    // lista explícita de páginas públicas
    if (pid === "login") return true;
    if (pid === "forgot-password") return true;
    if (pid === "reset-password") return true;

    // fallback por path (caso pageId falhe)
    try {
      const path = (global.location && global.location.pathname) ? global.location.pathname.toLowerCase() : "";
      if (path.endsWith("/login.html") || path.endsWith("login.html")) return true;
      if (path.endsWith("/index.html") || path.endsWith("index.html")) return true; // seu index é login
      if (path.endsWith("/forgot-password.html") || path.endsWith("forgot-password.html")) return true;
      if (path.endsWith("/reset-password.html") || path.endsWith("reset-password.html")) return true;
    } catch (_) {}

    return false;
  }

  // ============================================================
  // Health-check do backend (profissional)
  // ============================================================

  function ensureOverlay_() {
    const doc = global.document;
    if (!doc) return null;

    let el = doc.getElementById("prontio-backend-error");
    if (el) return el;

    el = doc.createElement("div");
    el.id = "prontio-backend-error";
    el.style.position = "fixed";
    el.style.left = "0";
    el.style.top = "0";
    el.style.right = "0";
    el.style.bottom = "0";
    el.style.zIndex = "99999";
    el.style.display = "none";
    el.style.background = "rgba(0,0,0,0.60)";
    el.style.backdropFilter = "blur(2px)";
    el.style.padding = "24px";
    el.style.boxSizing = "border-box";

    const card = doc.createElement("div");
    card.style.maxWidth = "860px";
    card.style.margin = "0 auto";
    card.style.background = "#0f172a"; // slate-900
    card.style.color = "#e2e8f0"; // slate-200
    card.style.border = "1px solid rgba(148,163,184,0.25)";
    card.style.borderRadius = "16px";
    card.style.boxShadow = "0 12px 40px rgba(0,0,0,0.35)";
    card.style.padding = "18px 18px 14px 18px";

    const title = doc.createElement("div");
    title.style.fontSize = "18px";
    title.style.fontWeight = "700";
    title.style.marginBottom = "8px";
    title.textContent = "Problema de conexão com a API do PRONTIO";

    const body = doc.createElement("div");
    body.id = "prontio-backend-error-body";
    body.style.fontSize = "14px";
    body.style.lineHeight = "1.35";
    body.style.whiteSpace = "pre-wrap";
    body.style.marginBottom = "12px";

    const actions = doc.createElement("div");
    actions.style.display = "flex";
    actions.style.gap = "10px";
    actions.style.flexWrap = "wrap";

    const btnReload = doc.createElement("button");
    btnReload.type = "button";
    btnReload.textContent = "Recarregar";
    btnReload.style.padding = "10px 12px";
    btnReload.style.borderRadius = "10px";
    btnReload.style.border = "1px solid rgba(148,163,184,0.35)";
    btnReload.style.background = "#1e293b"; // slate-800
    btnReload.style.color = "#e2e8f0";
    btnReload.style.cursor = "pointer";
    btnReload.addEventListener("click", () => global.location.reload());

    const btnClose = doc.createElement("button");
    btnClose.type = "button";
    btnClose.textContent = "Fechar";
    btnClose.style.padding = "10px 12px";
    btnClose.style.borderRadius = "10px";
    btnClose.style.border = "1px solid rgba(148,163,184,0.35)";
    btnClose.style.background = "transparent";
    btnClose.style.color = "#e2e8f0";
    btnClose.style.cursor = "pointer";
    btnClose.addEventListener("click", () => {
      // Em páginas privadas, não recomendamos fechar, mas permitimos.
      el.style.display = "none";
    });

    actions.appendChild(btnReload);
    actions.appendChild(btnClose);

    card.appendChild(title);
    card.appendChild(body);
    card.appendChild(actions);

    el.appendChild(card);
    doc.body.appendChild(el);
    return el;
  }

  function showBackendError_(message) {
    const el = ensureOverlay_();
    if (!el) return;
    const body = global.document.getElementById("prontio-backend-error-body");
    if (body) body.textContent = String(message || "Erro ao acessar API.");
    el.style.display = "block";
  }

  async function ensureBackendHealthy_(opts) {
    opts = opts || {};
    const soft = opts.soft === true;

    // Se config.checkBackend existir, usamos.
    if (PRONTIO.config && typeof PRONTIO.config.checkBackend === "function") {
      try {
        await PRONTIO.config.checkBackend();
        return true;
      } catch (e) {
        const apiUrl = (PRONTIO.config && PRONTIO.config.apiUrl) ? String(PRONTIO.config.apiUrl) : "(desconhecida)";
        const msg =
          "A API configurada parece desatualizada (deploy errado) ou indisponível.\n\n" +
          "API atual:\n" + apiUrl + "\n\n" +
          "Detalhes:\n" + (e && (e.message || e.code) ? String(e.message || e.code) : String(e)) + "\n\n" +
          "Ação recomendada:\n" +
          "- Atualize o deploy do Apps Script (Web App) e/ou ajuste o apiUrl no config/meta.\n" +
          "- Depois clique em “Recarregar”.";
        warn_("Backend health-check falhou:", e);
        if (!soft) showBackendError_(msg);
        return false;
      }
    }

    // Fallback mínimo: tenta chamar Registry_ListActions se PRONTIO.api existir
    if (PRONTIO.api && typeof PRONTIO.api.callApiData === "function") {
      try {
        await PRONTIO.api.callApiData({ action: "Registry_ListActions", payload: {} });
        return true;
      } catch (e) {
        const apiUrl = (PRONTIO.config && PRONTIO.config.apiUrl) ? String(PRONTIO.config.apiUrl) : "(desconhecida)";
        const msg =
          "A API configurada não respondeu ao health-check (Registry_ListActions).\n\n" +
          "API atual:\n" + apiUrl + "\n\n" +
          "Detalhes:\n" + (e && (e.message || e.code) ? String(e.message || e.code) : String(e));
        warn_("Backend health-check fallback falhou:", e);
        if (!soft) showBackendError_(msg);
        return false;
      }
    }

    // Se nem PRONTIO.api estiver pronto, não bloqueia em dev
    if (!soft) {
      showBackendError_(
        "PRONTIO.api não está disponível no boot.\n\n" +
        "Verifique a ordem de carregamento dos scripts: config.js → api.js → auth/session → app.js"
      );
      return false;
    }
    return true;
  }

  // ============================================================
  // Guard (Auth)
  // ============================================================

  async function ensureAuthIfNeeded_() {
    const pageId = getPageId_();
    if (isPublicPage_(pageId)) return true;

    const session = PRONTIO.core && PRONTIO.core.session ? PRONTIO.core.session : null;
    if (!session || typeof session.ensureAuthenticated !== "function") {
      // fallback compat: usa auth.requireAuth se existir
      if (PRONTIO.auth && typeof PRONTIO.auth.requireAuth === "function") {
        return PRONTIO.auth.requireAuth({ redirect: true });
      }
      return true; // não bloqueia (modo dev/offline)
    }

    // ✅ Guard oficial (local + server-side)
    const ok = await session.ensureAuthenticated({ redirect: true });
    return !!ok;
  }

  async function init_() {
    // ✅ trava anti-duplo-init
    if (PRONTIO.app._inited === true) return true;
    PRONTIO.app._inited = true;

    const pageId = getPageId_();
    const isPublic = isPublicPage_(pageId);

    // ✅ PROFISSIONAL: health-check backend primeiro
    // - Em páginas públicas, rodar "soft" (não bloqueia login)
    // - Em páginas privadas, bloquear se backend estiver inválido
    try {
      const okBackend = await ensureBackendHealthy_({ soft: isPublic });
      if (!okBackend && !isPublic) return false;
    } catch (e) {
      // se algo muito inesperado acontecer, não deixa o app “meio inicializado”
      warn_("Falha inesperada no health-check:", e);
      if (!isPublic) {
        showBackendError_("Falha inesperada ao verificar API.\n\n" + (e && e.message ? e.message : String(e)));
        return false;
      }
    }

    // ✅ PASSO 2: autenticação antes de iniciar router/páginas
    try {
      const okAuth = await ensureAuthIfNeeded_();
      if (!okAuth) {
        // se redirecionou, não segue
        return false;
      }
    } catch (e) {
      // ✅ NÃO faz logout automático - só desloga ao clicar em "Sair"
      warn_("Falha no guard de autenticação (ignorado):", e && e.message ? e.message : String(e));
    }

    // Se existir router do PRONTIO, inicia (best-effort)
    try {
      if (PRONTIO.core && PRONTIO.core.router && typeof PRONTIO.core.router.start === "function") {
        PRONTIO.core.router.start();
      }
    } catch (e) {
      warn_("Falha ao iniciar router:", e && e.message ? e.message : String(e));
    }

    log_("init ok");
    return true;
  }

  // Exports
  PRONTIO.app.init = init_;

})(window);
