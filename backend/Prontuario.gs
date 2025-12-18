/**
 * ============================================================
 * PRONTIO - Prontuario.gs
 * ============================================================
 * - Módulo oficial do Prontuário (fachada).
 * - Neste momento: foco em Receita.
 * - Api.gs envelopa {success,data,errors} => aqui retornamos "data puro".
 *
 * Actions:
 * - Prontuario.Ping
 * - Prontuario.Receita.ListarPorPaciente
 * - Prontuario.Receita.GerarPDF (alias)
 * - Prontuario.Receita.GerarPdf
 */

function handleProntuarioAction(action, payload) {
  payload = payload || {};
  var act = String(action || "");

  switch (act) {
    case "Prontuario.Ping":
      return { ok: true, module: "Prontuario", ts: new Date().toISOString() };

    case "Prontuario.Receita.ListarPorPaciente":
      _prontuarioAssertRequired_(payload, ["idPaciente"]);
      return _prontuarioDelegarReceita_("Receita.ListarPorPaciente", payload);

    case "Prontuario.Receita.GerarPDF":
      // Receita.gs já converte Receita.GerarPDF => Receita.GerarPdf internamente
      _prontuarioAssertRequired_(payload, ["idReceita"]);
      return _prontuarioDelegarReceita_("Receita.GerarPDF", payload);

    case "Prontuario.Receita.GerarPdf":
      _prontuarioAssertRequired_(payload, ["idReceita"]);
      return _prontuarioDelegarReceita_("Receita.GerarPdf", payload);

    default:
      throw {
        code: "PRONTUARIO_UNKNOWN_ACTION",
        message: "Ação não reconhecida em Prontuario.gs: " + act,
        details: { action: act }
      };
  }
}

function _prontuarioDelegarReceita_(receitaAction, payload) {
  if (typeof handleReceitaAction !== "function") {
    throw {
      code: "PRONTUARIO_RECEITA_HANDLER_MISSING",
      message: "handleReceitaAction não encontrado. Verifique se Receita.gs está no projeto.",
      details: { wantedAction: receitaAction }
    };
  }
  return handleReceitaAction(receitaAction, payload || {});
}

function _prontuarioAssertRequired_(obj, fields) {
  obj = obj || {};
  fields = fields || [];
  var missing = [];

  for (var i = 0; i < fields.length; i++) {
    var k = fields[i];
    var v = obj[k];
    if (v === null || typeof v === "undefined" || String(v).trim() === "") missing.push(k);
  }

  if (missing.length) {
    throw {
      code: "PRONTUARIO_VALIDATION_ERROR",
      message: "Campos obrigatórios ausentes.",
      details: { missing: missing }
    };
  }
}
