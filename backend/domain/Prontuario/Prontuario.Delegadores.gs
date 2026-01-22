function _prontuarioDelegarReceita_(receitaAction, payload) {
  if (typeof handleReceitaAction !== "function") {
    _prontuarioThrow_(
      "PRONTUARIO_RECEITA_HANDLER_MISSING",
      "handleReceitaAction não encontrado. Verifique se Receita.gs está no projeto.",
      { wantedAction: receitaAction }
    );
  }
  return handleReceitaAction(receitaAction, payload || {});
}

function _prontuarioDelegarEvolucao_(evolucaoAction, payload) {
  if (typeof handleEvolucaoAction !== "function") {
    _prontuarioThrow_(
      "PRONTUARIO_EVOLUCAO_HANDLER_MISSING",
      "handleEvolucaoAction não encontrado. Verifique se Evolucao.gs está no projeto.",
      { wantedAction: evolucaoAction }
    );
  }
  return handleEvolucaoAction(evolucaoAction, payload || {});
}

function _prontuarioDelegarChat_(chatAction, payload) {
  if (typeof handleChatAction === "function") {
    return handleChatAction(chatAction, payload || {});
  }
  if (typeof handleChatCompatAction === "function") {
    return handleChatCompatAction(chatAction, payload || {});
  }
  _prontuarioThrow_(
    "PRONTUARIO_CHAT_HANDLER_MISSING",
    "Nenhum handler de Chat encontrado. Verifique se Chat.gs/ChatCompat.gs está no projeto.",
    { wantedAction: chatAction }
  );
}

function _prontuarioDelegarPacientes_(pacientesAction, payload) {
  if (typeof handlePacientesAction === "function") {
    try { return handlePacientesAction(pacientesAction, payload || {}, { action: pacientesAction }); } catch (_) {}
    return handlePacientesAction(pacientesAction, payload || {});
  }
  if (typeof handlePacienteAction === "function") {
    return handlePacienteAction(pacientesAction, payload || {});
  }
  _prontuarioThrow_(
    "PRONTUARIO_PACIENTES_HANDLER_MISSING",
    "Nenhum handler de Pacientes encontrado. Verifique se Pacientes.gs está no projeto.",
    { wantedAction: pacientesAction }
  );
}
