// =====================================
// PRONTIO - core/auth.js
// Compatível com Auth.gs atual:
// - Login:   Auth_Login
// - Me:      Auth_Me
// - Logout:  Auth_Logout
// =====================================

(function (global) {
  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  const authNS = (PRONTIO.auth = PRONTIO.auth || {});

  const STORAGE_KEYS = {
    TOKEN: "prontio.auth.token",
    USER: "prontio.auth.user",
    EXPIRES_IN: "prontio.auth.expiresIn"
  };

  let currentToken = null;
  let currentUser = null;
  let currentExpiresIn = null;

  function lsGet(key) {
    try { return global.localStorage ? global.localStorage.getItem(key) : null; }
    catch (e) { return null; }
  }

  function lsSet(key, value) {
    try {
      if (!global.localStorage) return;
      if (value === null || value === undefined || value === "") global.localStorage.removeItem(key);
      else global.localStorage.setItem(key, value);
    } catch (e) {}
  }

  function initFromStorage() {
    currentToken = lsGet(STORAGE_KEYS.TOKEN) || null;
    const userJson = lsGet(STORAGE_KEYS.USER);
    currentExpiresIn = lsGet(STORAGE_KEYS.EXPIRES_IN) || null;

    if (userJson) {
      try { currentUser = JSON.parse(userJson); }
      catch (e) { currentUser = null; }
    } else {
      currentUser = null;
    }
  }

  initFromStorage();

  function setSession(session) {
    // Auth_Login retorna { token, user, expiresIn }
    // Auth_Me retorna { user }
    if (session && session.token) currentToken = String(session.token);
    if (session && session.user) currentUser = session.user;

    // ✅ melhoria: se expiresIn vier, grava; se NÃO vier, não deixa valor antigo “fantasma”
    if (session && session.expiresIn !== undefined && session.expiresIn !== null) {
      currentExpiresIn = String(session.expiresIn);
    } else if (session && Object.prototype.hasOwnProperty.call(session, "expiresIn")) {
      currentExpiresIn = null;
    }

    lsSet(STORAGE_KEYS.TOKEN, currentToken);
    lsSet(STORAGE_KEYS.EXPIRES_IN, currentExpiresIn);

    if (currentUser) {
      try { lsSet(STORAGE_KEYS.USER, JSON.stringify(currentUser)); }
      catch (e) { lsSet(STORAGE_KEYS.USER, null); }
    } else {
      lsSet(STORAGE_KEYS.USER, null);
    }
  }

  function clearSession() {
    currentToken = null;
    currentUser = null;
    currentExpiresIn = null;

    lsSet(STORAGE_KEYS.TOKEN, null);
    lsSet(STORAGE_KEYS.USER, null);
    lsSet(STORAGE_KEYS.EXPIRES_IN, null);
  }

  function getToken() { return currentToken || null; }
  function getUser() { return currentUser ? { ...currentUser } : null; }

  function resolveLoginUrl(explicitUrl) {
    if (explicitUrl) return explicitUrl;
    if (typeof global.PRONTIO_LOGIN_URL === "string") return global.PRONTIO_LOGIN_URL;

    // ✅ melhoria: relativo explícito evita surpresa dependendo do path atual
    // (ex.: se abrir /frontend/pacientes.html -> index.html pode virar /frontend/index.html ok,
    // mas se em subpasta, ./index.html garante relativo à página atual)
    return "./index.html";
  }

  function isLoginPage_() {
    try {
      const body = global.document && global.document.body;
      const pid = (body && body.dataset && (body.dataset.pageId || body.dataset.page)) || "";
      if (String(pid).toLowerCase() === "login") return true;
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

  function isAuthenticated() {
    return !!(currentToken || currentUser);
  }

  function requireAuth(options) {
    const opts = options || {};
    const redirect = typeof opts.redirect === "boolean" ? opts.redirect : true;

    if (isLoginPage_()) return true;
    if (isAuthenticated()) return true;

    if (redirect) {
      const loginUrl = resolveLoginUrl(opts.loginUrl);
      try { global.location.href = loginUrl; } catch (e) {}
    }
    return false;
  }

  // ✅ helpers “profissionais”: centralizam as actions
  async function login(payload) {
    if (!PRONTIO.api || typeof PRONTIO.api.callApiData !== "function") {
      throw new Error("PRONTIO.api.callApiData não está disponível.");
    }
    const data = await PRONTIO.api.callApiData({ action: "Auth_Login", payload: payload || {} });
    // Login retorna { token, user, expiresIn }
    setSession(data || {});
    return data;
  }

  async function me() {
    if (!PRONTIO.api || typeof PRONTIO.api.callApiData !== "function") {
      throw new Error("PRONTIO.api.callApiData não está disponível.");
    }
    const token = getToken();
    if (!token) throw new Error("Sem token.");
    const data = await PRONTIO.api.callApiData({ action: "Auth_Me", payload: { token } });
    if (data && data.user) setSession({ user: data.user });
    return data;
  }

  // ✅ guard server-side (sua realidade): Auth_Me
  async function ensureSession(options) {
    const opts = options || {};
    const redirect = typeof opts.redirect === "boolean" ? opts.redirect : true;

    if (isLoginPage_()) return true;

    const token = getToken();
    if (!token) {
      if (redirect) requireAuth({ redirect: true, loginUrl: opts.loginUrl });
      return false;
    }

    if (!PRONTIO.api || typeof PRONTIO.api.callApiData !== "function") {
      return true;
    }

    try {
      await me();
      return true;
    } catch (e) {
      clearSession();
      if (redirect) {
        const loginUrl = resolveLoginUrl(opts.loginUrl);
        try { global.location.href = loginUrl; } catch (err) {}
      }
      return false;
    }
  }

  async function logout(options) {
    const opts = options || {};
    const redirect = typeof opts.redirect === "boolean" ? opts.redirect : true;

    const token = getToken();

    try {
      if (token && PRONTIO.api && typeof PRONTIO.api.callApiData === "function") {
        await PRONTIO.api.callApiData({ action: "Auth_Logout", payload: { token } });
      }
    } catch (e) {}

    clearSession();

    if (redirect) {
      const loginUrl = resolveLoginUrl(opts.loginUrl);
      try { global.location.href = loginUrl; } catch (e) {}
    }
  }

  function bindLogoutButtons(selector) {
    const sel = selector || '[data-nav-action="logout"]';
    try {
      const els = global.document ? Array.from(global.document.querySelectorAll(sel)) : [];
      els.forEach((el) => {
        el.addEventListener("click", (ev) => {
          ev.preventDefault();
          logout({ redirect: true });
        });
      });
    } catch (e) {}
  }

  function renderUserLabel() {
    try {
      const el = global.document && global.document.getElementById("sidebarUser");
      if (!el) return;

      const u = getUser();
      if (!u) { el.textContent = ""; return; }

      const nome = u.nome || u.name || "Usuário";
      const perfil = u.perfil ? ` (${u.perfil})` : "";
      el.textContent = nome + perfil;
    } catch (e) {}
  }

  // Exports
  authNS.setSession = setSession;
  authNS.clearSession = clearSession;
  authNS.getToken = getToken;
  authNS.getUser = getUser;
  authNS.isAuthenticated = isAuthenticated;

  authNS.requireAuth = requireAuth;
  authNS.ensureSession = ensureSession;

  // ✅ novos helpers
  authNS.login = login;
  authNS.me = me;

  authNS.logout = logout;
  authNS.bindLogoutButtons = bindLogoutButtons;
  authNS.renderUserLabel = renderUserLabel;

})(window);
