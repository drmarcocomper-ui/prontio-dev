/**
 * Router do módulo Prontuário
 * Api.gs chama handleProntuarioAction(action,payload).
 * Aqui usamos handleProntuarioAction_ para evitar colisão e permitir wrapper em Prontuario.gs.
 */
function handleProntuarioAction_(action, payload) {
  payload = payload || {};
  var act = String(action || "");

  switch (act) {
    case "Prontuario.Ping":
      return { ok: true, module: "Prontuario", ts: new Date().toISOString() };

    // ===================== PACIENTE (RESUMO) ===================
    case "Prontuario.Paciente.ObterResumo":
      _prontuarioAssertRequired_(payload, ["idPaciente"]);
      return _prontuarioPacienteObterResumo_(payload);

    // ===================== RECEITA ============================
    case "Prontuario.Receita.ListarPorPaciente":
      _prontuarioAssertRequired_(payload, ["idPaciente"]);
      return _prontuarioDelegarReceita_("Receita.ListarPorPaciente", payload);

    case "Prontuario.Receita.ListarPorPacientePaged":
      _prontuarioAssertRequired_(payload, ["idPaciente"]);
      return _prontuarioReceitaListarPorPacientePaged_(payload);

    case "Prontuario.Receita.GerarPDF":
      _prontuarioAssertRequired_(payload, ["idReceita"]);
      return _prontuarioDelegarReceita_("Receita.GerarPDF", payload);

    case "Prontuario.Receita.GerarPdf":
      _prontuarioAssertRequired_(payload, ["idReceita"]);
      return _prontuarioDelegarReceita_("Receita.GerarPdf", payload);

    // ===================== EVOLUÇÃO ===========================
    case "Prontuario.Evolucao.ListarPorPaciente":
      _prontuarioAssertRequired_(payload, ["idPaciente"]);
      return _prontuarioDelegarEvolucao_("Evolucao.ListarPorPaciente", payload);

    case "Prontuario.Evolucao.ListarPorPacientePaged":
      _prontuarioAssertRequired_(payload, ["idPaciente"]);
      return _prontuarioEvolucaoListarPorPacientePaged_(payload);

    case "Prontuario.Evolucao.Salvar":
      _prontuarioAssertRequired_(payload, ["idPaciente", "texto"]);
      return _prontuarioDelegarEvolucao_("Evolucao.Salvar", payload);

    // ===================== CHAT ===============================
    case "Prontuario.Chat.ListByPaciente":
      _prontuarioAssertRequired_(payload, ["idPaciente"]);
      return _prontuarioDelegarChat_("Chat.ListByPaciente", payload);

    case "Prontuario.Chat.SendByPaciente":
      _prontuarioAssertRequired_(payload, ["idPaciente", "message"]);
      return _prontuarioDelegarChat_("Chat.SendByPaciente", payload);

    // ===================== TIMELINE ===========================
    case "Prontuario.Timeline.ListarPorPaciente":
      _prontuarioAssertRequired_(payload, ["idPaciente"]);
      return _prontuarioTimelineListarPorPaciente_(payload);

    // ===================== DOCUMENTOS =========================
    case "Prontuario.Atestado.GerarPdf":
      _prontuarioAssertRequired_(payload, ["idPaciente"]);
      return _prontuarioDocAtestadoGerarPdf_(payload);

    case "Prontuario.Comparecimento.GerarPdf":
      _prontuarioAssertRequired_(payload, ["idPaciente"]);
      return _prontuarioDocComparecimentoGerarPdf_(payload);

    case "Prontuario.Laudo.GerarPdf":
      _prontuarioAssertRequired_(payload, ["idPaciente"]);
      return _prontuarioDocLaudoGerarPdf_(payload);

    case "Prontuario.Encaminhamento.GerarPdf":
      _prontuarioAssertRequired_(payload, ["idPaciente"]);
      return _prontuarioDocEncaminhamentoGerarPdf_(payload);

    // ===================== BUSCAS / AUTOCOMPLETE ==============
    case "Prontuario.CID.Buscar":
      return _prontuarioCidBuscar_(payload);

    case "Prontuario.Encaminhamento.Buscar":
      return _prontuarioEncaminhamentoBuscar_(payload);

    default:
      _prontuarioThrow_(
        "PRONTUARIO_UNKNOWN_ACTION",
        "Ação não reconhecida em Prontuário: " + act,
        { action: act }
      );
  }
}
