// =====================================
// PRONTIO - pages/page-login.js
// Página de Login (FRONT-END)
// =====================================
//
// Responsabilidades:
// - Capturar usuário e senha do formulário
// - Chamar Auth_Login via PRONTIO.auth.login (centralizado)
// - Redirecionar (prioridade: destino salvo; fallback: HOME do sistema)
// =====================================

(function (global, document) {
  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});

  // ✅ Defina aqui a "home" pós-login (módulo principal)
  // Sugestão: "agenda.html" (ou "atendimento.html", conforme sua decisão)
  const DEFAULT_HOME = "atendimento.html";

  function qs(id) {
    return document.getElementById(id);
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

  async function handleSubmit(ev) {
    ev.preventDefault();
    hideMessage();

    const usuario = (qs("loginUsuario")?.value || "").trim();
    const senha = qs("loginSenha")?.value || "";

    if (!usuario || !senha) {
      showMessage("Informe usuário e senha.", "error");
      return;
    }

    // ✅ exige que o helper exista (padrão profissional do PRONTIO)
    if (!PRONTIO.auth || typeof PRONTIO.auth.login !== "function") {
      showMessage("Módulo de autenticação não disponível.", "error");
      return;
    }

    const btn = document.querySelector("#formLogin button[type='submit']");
    if (btn) btn.disabled = true;

    try {
      // ✅ centraliza regra: auth.login chama Auth_Login e já salva sessão (token/user/expiresIn)
      await PRONTIO.auth.login({ login: usuario, senha });

      global.location.href = resolvePostLoginUrl_();
    } catch (err) {
      showMessage(err && err.message ? err.message : "Falha no login.", "error");
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function init() {
    setYear();

    // ✅ Se já estiver logado, não fica preso no login: manda para HOME
    try {
      if (PRONTIO.auth && typeof PRONTIO.auth.isAuthenticated === "function" && PRONTIO.auth.isAuthenticated()) {
        global.location.href = DEFAULT_HOME;
        return;
      }
    } catch (e) {}

    const form = qs("formLogin");
    if (!form) return;

    form.addEventListener("submit", handleSubmit);
  }

  document.addEventListener("DOMContentLoaded", init);
})(window, document);
