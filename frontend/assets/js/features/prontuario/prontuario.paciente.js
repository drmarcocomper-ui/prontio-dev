(function (global, document) {
  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO.features = PRONTIO.features || {};
  PRONTIO.features.prontuario = PRONTIO.features.prontuario || {};

  const { qs } = PRONTIO.features.prontuario.utils;
  const { callApiDataTry_ } = PRONTIO.features.prontuario.api;

  function setTextOrDash_(selector, value) {
    const el = qs(selector);
    if (!el) return;
    const s = value === null || value === undefined ? "" : String(value).trim();
    el.textContent = s ? s : "—";
  }

  async function carregarResumoPaciente_(ctx) {
    console.log("[Paciente] carregarResumoPaciente_ ctx.idPaciente:", ctx.idPaciente);
    setTextOrDash_("#prontuario-paciente-nome", ctx.nomeCompleto || "—");

    if (!ctx.idPaciente) {
      console.log("[Paciente] Sem idPaciente, abortando");
      setTextOrDash_("#prontuario-paciente-idade", "—");
      setTextOrDash_("#prontuario-paciente-profissao", "—");
      setTextOrDash_("#prontuario-paciente-plano", "—");
      setTextOrDash_("#prontuario-paciente-carteirinha", "—");
      return;
    }

    try {
      const data = await callApiDataTry_(
        ["Prontuario.Paciente.ObterResumo", "Pacientes.ObterPorId", "Pacientes_ObterPorId"],
        { idPaciente: ctx.idPaciente }
      );

      console.log("[Paciente] API retornou:", data);

      const pac = data && data.paciente ? data.paciente : data;
      console.log("[Paciente] pac object:", pac);
      console.log("[Paciente] pac.telefonePrincipal:", pac?.telefonePrincipal);
      console.log("[Paciente] pac.telefone:", pac?.telefone);
      console.log("[Paciente] pac.telefone1:", pac?.telefone1);

      const nome =
        (pac && (pac.nomeCompleto || pac.nomeExibicao || pac.nomeSocial || pac.nome || pac.Nome)) ||
        ctx.nomeCompleto ||
        "—";
      const idade = pac && (pac.idade || pac.Idade);
      const profissao = pac && (pac.profissao || pac.Profissao);
      const plano = pac && (pac.planoSaude || pac.convenio || pac.PlanoSaude || pac.Convenio || pac.plano);
      const carteirinha = pac && (pac.carteirinha || pac.numeroCarteirinha || pac.NumeroCarteirinha || pac.Carteirinha);

      // Telefone para WhatsApp (telefonePrincipal é o campo oficial do backend)
      const telefone = pac && (pac.telefonePrincipal || pac.telefone1 || pac.telefone || pac.Telefone1 || pac.Telefone || pac.celular || pac.Celular);
      ctx.telefone = telefone ? String(telefone).trim() : "";

      ctx.nomeCompleto = String(nome || "").trim() || ctx.nomeCompleto || "—";
      ctx.nome = ctx.nomeCompleto;

      setTextOrDash_("#prontuario-paciente-nome", ctx.nomeCompleto);
      setTextOrDash_("#prontuario-paciente-idade", idade);
      setTextOrDash_("#prontuario-paciente-profissao", profissao);
      setTextOrDash_("#prontuario-paciente-plano", plano);
      setTextOrDash_("#prontuario-paciente-carteirinha", carteirinha);

      // Sempre mostrar botão WhatsApp (mensagem de erro se não tiver telefone)
      const btnWa = qs("#btnWhatsAppPaciente");
      if (btnWa) {
        btnWa.style.display = "inline-flex";
      }
    } catch (e) {
      setTextOrDash_("#prontuario-paciente-idade", "—");
      setTextOrDash_("#prontuario-paciente-profissao", "—");
      setTextOrDash_("#prontuario-paciente-plano", "—");
      setTextOrDash_("#prontuario-paciente-carteirinha", "—");
    }
  }

  PRONTIO.features.prontuario.paciente = {
    carregarResumoPaciente_,
  };
})(window, document);
