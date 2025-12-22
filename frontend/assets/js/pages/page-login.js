// =====================================
// PRONTIO - pages/page-login.js
// Página de Login (FRONT-END)
// Pilar D: UX do Login (login ou e-mail)
// =====================================
//
// Responsabilidades:
// - Capturar usuário e senha do formulário
// - Normalizar identificador (trim + lower) para reduzir erro humano
// - Chamar Auth_Login via PRONTIO.auth.login (centralizado)
// - Redirecionar (prioridade: destino salvo; fallback: HOME do sistema)
// - Melhorias UX (não exigem mudar HTML):
//   - Placeholder: "Login ou e-mail" (se estiver vazio)
//   - Autocomplete correto
//   - Lembrar último login digitado (localStorage)

(function (global, document) {
  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});

  // ✅ Defina aqui a "home" pós-login (módulo principal)
  const DEFAULT_HOME = "atendimento.html";

  // UX: lembrar último identificador
  const UX_KEYS = {
    LAST_IDENTIFIER: "prontio.login.lastIdentifier"
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

    if (btn) {
      btn.disabled = !!busy;
      btn.setAttribute("aria-busy", busy ? "true" : "false");
    }
    if (inpUser) inpUser.disabled = !!busy;
    if (inpPass) inpPass.disabled = !!busy;
  }

  function cleanLoginErrorMessage_(msg) {
    // Opcional: remove prefixo "[CODE]" se vier do api.js
    const s = String(msg || "").trim();
    const m = s.match(/^\[[A-Z0-9_\-]+\]\s+(.*)$/);
    return m ? m[1] : s;
  }

  function normalizeIdentifier_(raw) {
    // Pilar D: reduz confusão (maiúsculas, espaços, e-mail etc.)
    return String(raw || "").trim().toLowerCase();
  }

  function applyUxHints_() {
    const inpUser = qs("loginUsuario");
    const inpPass = qs("loginSenha");

    // Placeholders e autocomplete (só aplica se estiver vazio)
    if (inpUser) {
      if (!inpUser.getAttribute("placeholder")) inpUser.setAttribute("placeholder", "Login ou e-mail");
      if (!inpUser.getAttribute("autocomplete")) inpUser.setAttribute("autocomplete", "username");
      // inputmode ajuda no mobile (teclado com @)
      inpUser.setAttribute("inputmode", "email");

      // Preenche com último identificador usado
      const last = lsGet(UX_KEYS.LAST_IDENTIFIER);
      if (!inpUser.value && last) inpUser.value = last;
    }

    if (inpPass) {
      if (!inpPass.getAttribute("placeholder")) inpPass.setAttribute("placeholder", "Senha");
      if (!inpPass.getAttribute("autocomplete")) inpPass.setAttribute("autocomplete", "current-password");
    }
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

    // UX: salva para preencher na próxima vez
    lsSet(UX_KEYS.LAST_IDENTIFIER, identifier);

    setFormBusy_(true);

    try {
      await PRONTIO.auth.login({ login: identifier, senha: senha });
      global.location.href = resolvePostLoginUrl_();
    } catch (err) {
      // log técnico opcional
      try { console.warn("[PRONTIO.login] erro:", err); } catch (e) {}

      const msgRaw = err && err.message ? err.message : "Falha no login.";
      const msg = cleanLoginErrorMessage_(msgRaw);

      // Mensagem amigável padrão
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
    setYear();
    applyUxHints_();

    // ✅ Se já estiver logado (token), não fica preso no login
    try {
      if (PRONTIO.auth && typeof PRONTIO.auth.isAuthenticated === "function" && PRONTIO.auth.isAuthenticated()) {
        global.location.href = resolvePostLoginUrl_();
        return;
      }
    } catch (e) {}

    const form = qs("formLogin");
    if (!form) return;

    form.addEventListener("submit", handleSubmit);
  }

  document.addEventListener("DOMContentLoaded", init);
})(window, document);
