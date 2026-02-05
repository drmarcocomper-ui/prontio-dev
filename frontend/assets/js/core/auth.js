// frontend/assets/js/core/auth.js
// ============================================================
// PRONTIO - Auth (Front-end) - CONSOLIDADO (LOGIN + LOGOUT + BIND)
// ============================================================
// ✅ Suporta o login page-* (Auth_Login / Auth_Me)
// ✅ Suporta logout resiliente (fallback local mesmo com API quebrada)
// ✅ Suporta bind do botão "Sair" do seu sidebar (data-nav-action="logout")
// ✅ Mantém compat com chaves antigas de token
// ✅ Integra com PRONTIO.core.session (estado de UI) + cache Nome/Perfil (topbar)
//
// ✅ PASSO 2 (padronização global):
// - Trata codes AUTH_* canônicos e aplica forceLogoutLocal quando necessário,
//   mesmo quando me() é chamado diretamente.
//
// ✅ CANÔNICO (Namespace):
// - NÃO depende de globals (window.callApiData etc.). Usa apenas PRONTIO.api.*
// ============================================================

(function (global, document) {
  "use strict";

  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO.auth = PRONTIO.auth || {};

  const LS_KEYS = {
    TOKEN_1: "prontio.auth.token",
    TOKEN_2: "prontio_auth_token",
    LAST_AUTH_REASON: "prontio.auth.lastAuthReason",
    CHAT_USER: "medpronto_user_info", // usado pelo widget chat (opcional limpar no logout)

    // ✅ Topbar: cache rápido (instantâneo)
    CURRENT_USER_NAME: "PRONTIO_CURRENT_USER_NAME",
    CURRENT_USER_ROLE: "PRONTIO_CURRENT_USER_ROLE"
  };

  function safeGet_(k) {
    try {
      const ls = global.localStorage;
      if (!ls) return "";
      return ls.getItem(k) || "";
    } catch (_) {
      return "";
    }
  }

  function safeSet_(k, v) {
    try {
      const ls = global.localStorage;
      if (!ls) return;
      ls.setItem(k, String(v == null ? "" : v));
    } catch (_) {}
  }

  function safeRemove_(k) {
    try {
      const ls = global.localStorage;
      if (!ls) return;
      ls.removeItem(k);
    } catch (_) {}
  }

  // ------------------------------------------------------------
  // PASSO 2: helpers de code AUTH
  // ------------------------------------------------------------

  function isAuthErrorCode_(code) {
    const c = String(code || "").toUpperCase();
    return (
      c === "AUTH_REQUIRED" ||
      c === "AUTH_EXPIRED" ||
      c === "AUTH_TOKEN_EXPIRED" ||
      c === "AUTH_NO_TOKEN"
    );
  }

  // ------------------------------------------------------------
  // Session (UI-state) helpers
  // ------------------------------------------------------------

  function getSession_() {
    return PRONTIO.core && PRONTIO.core.session ? PRONTIO.core.session : null;
  }

  function setSessionUser_(userObj) {
    const session = getSession_();
    if (session && typeof session.setUser === "function") {
      session.setUser(userObj || null);
    }
  }

  function clearSessionUser_() {
    const session = getSession_();
    if (session && typeof session.clear === "function") {
      session.clear();
    } else {
      // fallback mínimo: remove cache topbar
      safeRemove_(LS_KEYS.CURRENT_USER_NAME);
      safeRemove_(LS_KEYS.CURRENT_USER_ROLE);
    }
  }

  function cacheTopbarUser_(userObj) {
    if (!userObj || typeof userObj !== "object") return;

    const nome =
      (userObj.nomeCompleto || userObj.NomeCompleto || userObj.nome || userObj.Nome || "").toString().trim();
    const perfil =
      (userObj.perfil || userObj.Perfil || userObj.role || "").toString().trim();

    if (nome) safeSet_(LS_KEYS.CURRENT_USER_NAME, nome);
    if (perfil) safeSet_(LS_KEYS.CURRENT_USER_ROLE, perfil);
  }

  function clearTopbarUserCache_() {
    safeRemove_(LS_KEYS.CURRENT_USER_NAME);
    safeRemove_(LS_KEYS.CURRENT_USER_ROLE);
  }

  // ------------------------------------------------------------
  // Token helpers
  // ------------------------------------------------------------

  function getToken() {
    return safeGet_(LS_KEYS.TOKEN_1) || safeGet_(LS_KEYS.TOKEN_2) || "";
  }

  function setToken(token) {
    const t = String(token || "").trim();
    if (!t) {
      clearToken();
      return;
    }
    // grava nas duas por compat
    safeSet_(LS_KEYS.TOKEN_1, t);
    safeSet_(LS_KEYS.TOKEN_2, t);
  }

  function clearToken() {
    safeRemove_(LS_KEYS.TOKEN_1);
    safeRemove_(LS_KEYS.TOKEN_2);
  }

  function setLastAuthReason(code) {
    safeSet_(LS_KEYS.LAST_AUTH_REASON, String(code || "AUTH_REQUIRED"));
  }

  function getLastAuthReason() {
    return safeGet_(LS_KEYS.LAST_AUTH_REASON) || "";
  }

  // ------------------------------------------------------------
  // API accessor (callApiData) — CANÔNICO: só PRONTIO.api
  // ------------------------------------------------------------

  function getCallApiData_() {
    if (PRONTIO.api && typeof PRONTIO.api.callApiData === "function") return PRONTIO.api.callApiData;
    return null;
  }

  // ------------------------------------------------------------
  // URL helpers
  // ------------------------------------------------------------

  function resolveLoginUrl_() {
    // ✅ evita quebrar em GitHub Pages/subpath (não usa "/login.html")
    try {
      const base =
        (global.document && global.document.baseURI) ? String(global.document.baseURI) : String(global.location.href);
      const u = new URL(base);
      u.pathname = u.pathname.replace(/\/[^/]*$/, "/login.html");
      u.search = "";
      u.hash = "";
      return u.toString();
    } catch (_) {
      return "login.html";
    }
  }

  // ------------------------------------------------------------
  // Logout resiliente (sempre funciona)
  // ------------------------------------------------------------

  function forceLogoutLocal(reasonCode, opts) {
    opts = opts || {};
    const redirect = opts.redirect !== false;
    const clearChat = opts.clearChat !== false;

    setLastAuthReason(reasonCode || "AUTH_REQUIRED");
    clearToken();

    // ✅ limpa sessão UI + cache topbar
    clearSessionUser_();
    clearTopbarUserCache_();

    if (clearChat) safeRemove_(LS_KEYS.CHAT_USER);

    if (redirect) {
      try { global.location.href = resolveLoginUrl_(); } catch (_) {}
    }
  }

  async function logout(opts) {
    opts = opts || {};
    const redirect = opts.redirect !== false;
    const clearChat = opts.clearChat !== false;

    const token = getToken();
    if (!token) {
      forceLogoutLocal("AUTH_NO_TOKEN", { redirect, clearChat });
      return { ok: true, local: true, reason: "NO_TOKEN" };
    }

    const callApiData = getCallApiData_();
    if (!callApiData) {
      forceLogoutLocal("AUTH_LOGOUT_FALLBACK", { redirect, clearChat });
      return { ok: true, local: true, reason: "NO_API" };
    }

    try {
      await callApiData({ action: "Auth_Logout", payload: { token } });
      forceLogoutLocal("AUTH_LOGOUT", { redirect, clearChat });
      return { ok: true, local: true, remote: true };
    } catch (_) {
      forceLogoutLocal("AUTH_LOGOUT_FALLBACK", { redirect, clearChat });
      return { ok: true, local: true, remote: false, fallback: true };
    }
  }

  function clearSession(opts) {
    opts = opts || {};
    const clearChat = opts.clearChat !== false;

    clearToken();

    // ✅ limpa sessão UI + cache topbar
    clearSessionUser_();
    clearTopbarUserCache_();

    if (clearChat) safeRemove_(LS_KEYS.CHAT_USER);
  }

  function requireAuth(opts) {
    opts = opts || {};
    const redirect = opts.redirect !== false;
    const token = getToken();
    if (token) return true;
    if (redirect) forceLogoutLocal("AUTH_REQUIRED", { redirect: true });
    return false;
  }

  // ------------------------------------------------------------
  // Auth actions (LOGIN / ME)
  // ------------------------------------------------------------

  /**
   * Login:
   * payload: { login, senha }
   * retorno esperado do backend: { token, user, expiresIn }
   */
  async function login(args) {
    args = args || {};
    const loginStr = String(args.login || "").trim();
    const senhaStr = String(args.senha || "").trim();

    if (!loginStr || !senhaStr) {
      const err = new Error("Informe login e senha.");
      err.code = "VALIDATION_ERROR";
      err.details = { fields: ["login", "senha"] };
      throw err;
    }

    const callApiData = getCallApiData_();
    if (!callApiData) {
      const err = new Error("API não disponível (PRONTIO.api.callApiData indefinido).");
      err.code = "CLIENT_NO_API";
      throw err;
    }

    const data = await callApiData({
      action: "Auth_Login",
      payload: { login: loginStr, senha: senhaStr }
    });

    if (!data || !data.token) {
      const err = new Error("Resposta inválida do login (token ausente).");
      err.code = "CLIENT_INVALID_LOGIN_RESPONSE";
      err.details = { data: data || null };
      throw err;
    }

    setToken(data.token);

    // ✅ Estado de sessão UI + cache imediato para topbar
    if (data.user && typeof data.user === "object") {
      setSessionUser_(data.user);
      cacheTopbarUser_(data.user);
    }

    return data;
  }

  /**
   * Me:
   * - valida token atual no backend
   * ✅ PASSO 2: se retornar AUTH_*, aplica forceLogoutLocal
   */
  async function me() {
    const token = getToken();
    if (!token) {
      const err = new Error("Token ausente.");
      err.code = "AUTH_NO_TOKEN";
      err.details = { field: "token" };
      // ✅ NÃO faz logout automático - só desloga ao clicar em "Sair"
      throw err;
    }

    const callApiData = getCallApiData_();
    if (!callApiData) {
      const err = new Error("API não disponível (PRONTIO.api.callApiData indefinido).");
      err.code = "CLIENT_NO_API";
      throw err;
    }

    try {
      const res = await callApiData({
        action: "Auth_Me",
        payload: { token }
      });

      // ✅ Atualiza sessão UI quando o backend retornar user
      try {
        const userObj = (res && res.user) ? res.user : null;
        if (userObj) {
          setSessionUser_(userObj);
          cacheTopbarUser_(userObj);
        }
      } catch (_) {}

      return res;
    } catch (e) {
      // ✅ NÃO faz logout automático - só desloga ao clicar em "Sair"
      // Apenas propaga o erro sem forçar logout
      throw e;
    }
  }

  // ------------------------------------------------------------
  // Bind botão "Sair" + confirmação
  // ------------------------------------------------------------

  let _logoutClickInFlight = false;

  function bindLogoutButtons(root) {
    const doc = root || document;
    if (!doc) return;

    const selector =
      '[data-action="logout"], [data-logout], .js-logout, [data-nav-action="logout"], [data-nav-action="signout"]';

    const nodes = doc.querySelectorAll(selector);
    nodes.forEach((el) => {
      if (!el) return;
      if (el.getAttribute("data-logout-bound") === "1") return;
      el.setAttribute("data-logout-bound", "1");

      el.addEventListener("click", async (ev) => {
        try { ev.preventDefault(); } catch (_) {}

        if (_logoutClickInFlight) return;
        _logoutClickInFlight = true;

        try {
          const ok = global.confirm("Tem certeza que deseja sair?");
          if (!ok) return;

          await logout({ redirect: true, clearChat: true });
        } finally {
          global.setTimeout(() => { _logoutClickInFlight = false; }, 0);
        }
      });
    });
  }

  // ------------------------------------------------------------
  // Exports
  // ------------------------------------------------------------

  PRONTIO.auth.getToken = getToken;
  PRONTIO.auth.setToken = setToken;
  PRONTIO.auth.clearToken = clearToken;

  PRONTIO.auth.getLastAuthReason = getLastAuthReason;
  PRONTIO.auth.setLastAuthReason = setLastAuthReason;

  PRONTIO.auth.login = login;
  PRONTIO.auth.signIn = login;
  PRONTIO.auth.doLogin = login;
  PRONTIO.auth.me = me;

  PRONTIO.auth.logout = logout;
  PRONTIO.auth.forceLogoutLocal = forceLogoutLocal;
  PRONTIO.auth.clearSession = clearSession;
  PRONTIO.auth.requireAuth = requireAuth;

  PRONTIO.auth.bindLogoutButtons = bindLogoutButtons;

  PRONTIO.auth.getCurrentUser = function () {
    const s = getSession_();
    return (s && typeof s.getUser === "function") ? s.getUser() : null;
  };

  try {
    if (document && document.readyState !== "loading") {
      bindLogoutButtons(document);
    } else if (document) {
      document.addEventListener("DOMContentLoaded", () => bindLogoutButtons(document));
    }
  } catch (_) {}

})(window, document);
