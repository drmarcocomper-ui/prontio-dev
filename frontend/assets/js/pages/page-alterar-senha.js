(function (global, document) {
  const PRONTIO = global.PRONTIO || {};

  function qs(id) {
    return document.getElementById(id);
  }

  function showMessage(msg, type) {
    const el = qs("mensagemSenha");
    if (!el) return;
    el.textContent = msg;
    el.classList.remove("is-hidden");
    el.className = "mensagem mensagem-" + (type || "info");
  }

  async function handleSubmit(ev) {
    ev.preventDefault();

    const senhaAtual = qs("senhaAtual").value || "";
    const novaSenha = qs("novaSenha").value || "";
    const novaSenha2 = qs("novaSenha2").value || "";

    if (!senhaAtual || !novaSenha) {
      showMessage("Informe a senha atual e a nova senha.", "erro");
      return;
    }
    if (novaSenha !== novaSenha2) {
      showMessage("As novas senhas não coincidem.", "erro");
      return;
    }

    try {
      await PRONTIO.api.callApiData({
        action: "Usuarios_AlterarMinhaSenha",
        payload: { senhaAtual, novaSenha }
      });

      showMessage("Senha alterada com sucesso.", "sucesso");

      // opcional: logout após troca de senha
      setTimeout(() => {
        PRONTIO.auth.logout({ redirect: true });
      }, 1500);

    } catch (err) {
      const msg = err?.message || "Erro ao alterar senha.";
      showMessage(msg, "erro");
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    const form = qs("formAlterarSenha");
    if (form) form.addEventListener("submit", handleSubmit);
  });

})(window, document);
