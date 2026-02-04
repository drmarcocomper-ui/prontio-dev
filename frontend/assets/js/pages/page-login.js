// =====================================
// PRONTIO - pages/page-login.js
// Página de Login (FRONT-END)
// Pilar D: UX do Login (login ou e-mail)
// + Pilar I: mensagem amigável em sessão expirada
// + Segurança: remove credenciais da URL (NUNCA aceitar senha em querystring)
// =====================================

(function (global, document) {
  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO.pages = PRONTIO.pages || {};
  PRONTIO.pages.login = PRONTIO.pages.login || {};

  const DEFAULT_HOME = "agenda.html";

  const UX_KEYS = {
    LAST_IDENTIFIER: "prontio.login.lastIdentifier",
    LAST_AUTH_REASON: "prontio.auth.lastAuthReason"
  };

  function qs(id) {
    return document.getElementById(id);
  }

  function lsGet(key) {
    try { return global.localStorage ? global.localStorage.getItem(key) : null; }
    catch (_) { return null; }
  }

  function lsSet(key, value) {
    try {
      if (!global.localStorage) return;
      if (value === null || value === undefined || value === "") global.localStorage.removeItem(key);
      else global.localStorage.setItem(key, String(value));
    } catch (_) {}
  }

  function setMessageClass_(el, type) {
    if (!el) return;
    el.classList.remove("mensagem-sucesso", "mensagem-erro", "mensagem-aviso", "mensagem-info");
    switch (type) {
      case "success": el.classList.add("mensagem-sucesso"); break;
      case "warning": el.classList.add("mensagem-aviso"); break;
      case "error": el.classList.add("mensagem-erro"); break;
      default: el.classList.add("mensagem-info"); break;
    }
  }

  function showMessage(msg, type) {
    const el = qs("mensagemLogin");
    if (!el) return;
    el.textContent = msg || "";
    el.classList.remove("is-hidden");
    setMessageClass_(el, type || "info");
  }

  function hideMessage() {
    const el = qs("mensagemLogin");
    if (!el) return;
    el.textContent = "";
    el.classList.add("is-hidden");
    setMessageClass_(el, "info");
  }

  function setYear() {
    const el = qs("login-year");
    if (el) el.textContent = new Date().getFullYear();
  }

  function resolvePostLoginUrl_() {
    try {
      if (PRONTIO.auth && typeof PRONTIO.auth.popPostLoginRedirect === "function") {
        const u = PRONTIO.auth.popPostLoginRedirect();
        if (u) return u;
      }
    } catch (e) {}
    return DEFAULT_HOME;
  }

  function setFormBusy_(busy) {
    const form = qs("formLogin");
    if (!form) return;

    const btn = form.querySelector('button[type="submit"]');
    const inpUser = qs("loginUsuario");
    const inpPass = qs("loginSenha");
    const btnToggle = qs("toggleSenha");

    if (btn) {
      btn.disabled = !!busy;
      btn.setAttribute("aria-busy", busy ? "true" : "false");
    }
    if (inpUser) inpUser.disabled = !!busy;
    if (inpPass) inpPass.disabled = !!busy;
    if (btnToggle) btnToggle.disabled = !!busy;
  }

  function cleanLoginErrorMessage_(msg) {
    const s = String(msg || "").trim();
    const m = s.match(/^\[[A-Z0-9_\-]+\]\s+(.*)$/);
    return m ? m[1] : s;
  }

  function normalizeIdentifier_(raw) {
    return String(raw || "").trim().toLowerCase();
  }

  function applyUxHints_() {
    const inpUser = qs("loginUsuario");
    const inpPass = qs("loginSenha");

    if (inpUser) {
      if (!inpUser.getAttribute("placeholder")) inpUser.setAttribute("placeholder", "Login ou e-mail");
      if (!inpUser.getAttribute("autocomplete")) inpUser.setAttribute("autocomplete", "username");
      inpUser.setAttribute("inputmode", "email");

      const last = lsGet(UX_KEYS.LAST_IDENTIFIER);
      if (!inpUser.value && last) inpUser.value = last;
    }

    if (inpPass) {
      if (!inpPass.getAttribute("placeholder")) inpPass.setAttribute("placeholder", "Senha");
      if (!inpPass.getAttribute("autocomplete")) inpPass.setAttribute("autocomplete", "current-password");
    }
  }

  function bindCapsLockDetector_() {
    const input = qs("loginSenha");
    const hint = qs("loginCapsLockHint");
    if (!input || !hint) return;

    if (hint.dataset.boundCaps === "1") return;
    hint.dataset.boundCaps = "1";

    hint.classList.add("is-hidden");

    function updateFromKeyEvent(ev) {
      try {
        const caps = !!(ev && typeof ev.getModifierState === "function" && ev.getModifierState("CapsLock"));
        hint.classList.toggle("is-hidden", !caps);
      } catch (_) {
        hint.classList.add("is-hidden");
      }
    }

    input.addEventListener("keydown", updateFromKeyEvent);
    input.addEventListener("keyup", updateFromKeyEvent);
    input.addEventListener("focus", () => hint.classList.add("is-hidden"));
    input.addEventListener("blur", () => hint.classList.add("is-hidden"));
  }

  function bindTogglePassword_() {
    const input = qs("loginSenha");
    const btn = qs("toggleSenha");
    if (!input || !btn) return;

    if (btn.dataset.boundToggle === "1") return;
    btn.dataset.boundToggle = "1";

    function syncLabel_() {
      const visible = input.type === "text";
      btn.textContent = visible ? "Ocultar" : "Mostrar";
      btn.setAttribute("aria-pressed", visible ? "true" : "false");
    }

    syncLabel_();

    btn.addEventListener("click", function (ev) {
      ev.preventDefault();
      input.type = (input.type === "password") ? "text" : "password";
      syncLabel_();
      try { input.focus(); } catch (_) {}
    });
  }

  // ✅ Segurança: remove credenciais da URL (não permite usuario/senha via querystring)
  function scrubSensitiveQueryParams_() {
    try {
      const url = new URL(global.location.href);

      const hasUser = url.searchParams.has("usuario") || url.searchParams.has("user");
      const hasPass = url.searchParams.has("senha") || url.searchParams.has("password");

      if (!hasUser && !hasPass) return;

      // Remover parâmetros sensíveis
      url.searchParams.delete("usuario");
      url.searchParams.delete("user");
      url.searchParams.delete("senha");
      url.searchParams.delete("password");

      // Atualizar URL sem recarregar
      global.history.replaceState({}, document.title, url.toString());

      // Aviso (sem expor valores)
      showMessage("⚠️ Removemos credenciais da URL por segurança. Use o formulário de login.", "warning");
    } catch (_) {}
  }

  // ✅ Pilar I: mensagem amigável quando veio de sessão expirada/inválida
  function showAuthReasonIfAny_() {
    const reason = String(lsGet(UX_KEYS.LAST_AUTH_REASON) || "").trim();
    if (!reason) return;

    // one-shot
    lsSet(UX_KEYS.LAST_AUTH_REASON, "");

    showMessage("Sua sessão expirou. Faça login novamente.", "warning");
  }

  async function handleSubmit(ev) {
    ev.preventDefault();
    hideMessage();

    const rawIdentifier = (qs("loginUsuario")?.value || "");
    const senha = qs("loginSenha")?.value || "";

    const identifier = normalizeIdentifier_(rawIdentifier);

    if (!identifier || !senha) {
      showMessage("Informe login (ou e-mail) e senha.", "error");
      return;
    }

    if (!PRONTIO.auth || typeof PRONTIO.auth.login !== "function") {
      showMessage("Módulo de autenticação não disponível.", "error");
      return;
    }

    lsSet(UX_KEYS.LAST_IDENTIFIER, identifier);

    setFormBusy_(true);

    try {
      await PRONTIO.auth.login({ login: identifier, senha: senha });
      global.location.href = resolvePostLoginUrl_();
    } catch (err) {
      try { console.warn("[PRONTIO.login] erro:", err); } catch (_) {}

      const msgRaw = err && err.message ? err.message : "Falha no login.";
      const msg = cleanLoginErrorMessage_(msgRaw);

      if (/usu[aá]rio|senha inv[aá]lid/i.test(msg)) {
        showMessage("Login (ou e-mail) ou senha inválidos.", "error");
      } else {
        showMessage(msg || "Falha no login.", "error");
      }
    } finally {
      setFormBusy_(false);
    }
  }

  function init() {
    // ✅ trava idempotente (page.init pode ser chamado mais de uma vez)
    if (PRONTIO.pages && PRONTIO.pages.login && PRONTIO.pages.login._inited === true) return;
    PRONTIO.pages.login._inited = true;

    // ✅ Segurança: remove credenciais da URL
    scrubSensitiveQueryParams_();

    setYear();
    applyUxHints_();
    bindCapsLockDetector_();
    bindTogglePassword_();

    // ✅ Pilar I
    showAuthReasonIfAny_();

    try {
      if (PRONTIO.auth && typeof PRONTIO.auth.isAuthenticated === "function" && PRONTIO.auth.isAuthenticated()) {
        global.location.href = resolvePostLoginUrl_();
        return;
      }
    } catch (e) {}

    const form = qs("formLogin");
    if (!form) return;

    if (form.dataset.boundSubmit === "1") return;
    form.dataset.boundSubmit = "1";

    form.addEventListener("submit", handleSubmit);
  }

  // ✅ padrão profissional: main.js chama page.init()
  PRONTIO.pages.login.init = init;

  // ✅ fallback retrocompat: se por algum motivo main.js não rodar, inicializa sozinho
  if (!PRONTIO._mainBootstrapped) {
    document.addEventListener("DOMContentLoaded", init);
  }

})(window, document);
