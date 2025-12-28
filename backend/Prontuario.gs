/**
 * ============================================================
 * PRONTIO - Prontuario.gs
 * ============================================================
 * Fachada do Prontuário.
 * Api.gs envelopa {success,data,errors} => aqui retornamos "data puro".
 *
 * Actions:
 * - Prontuario.Ping
 *
 * ✅ Paciente (resumo do cadastro):
 * - Prontuario.Paciente.ObterResumo
 *
 * Receita (delegado):
 * - Prontuario.Receita.ListarPorPaciente
 * - Prontuario.Receita.ListarPorPacientePaged     ✅ paginação por cursor (ts)
 * - Prontuario.Receita.GerarPDF (alias)
 * - Prontuario.Receita.GerarPdf
 *
 * Evolução (delegado):
 * - Prontuario.Evolucao.ListarPorPaciente
 * - Prontuario.Evolucao.ListarPorPacientePaged    ✅ paginação por cursor (ts)
 * - Prontuario.Evolucao.Salvar
 *
 * Chat (delegado):
 * - Prontuario.Chat.ListByPaciente
 * - Prontuario.Chat.SendByPaciente
 *
 * Timeline unificada (Evolução + Receita + Chat):
 * - Prontuario.Timeline.ListarPorPaciente         ✅ paginação por cursor (ts)
 */

function _prontuarioThrow_(code, message, details) {
  var err = new Error(String(message || "Erro."));
  err.code = String(code || "INTERNAL_ERROR");
  err.details = (details === undefined ? null : details);
  throw err;
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
    _prontuarioThrow_(
      "PRONTUARIO_VALIDATION_ERROR",
      "Campos obrigatórios ausentes.",
      { missing: missing }
    );
  }
}

function _prontuarioParseDateMs_(raw) {
  if (!raw) return new Date(0).getTime();
  var d = new Date(raw);
  if (!isNaN(d.getTime())) return d.getTime();
  d = new Date(String(raw).replace(" ", "T"));
  return isNaN(d.getTime()) ? new Date(0).getTime() : d.getTime();
}

function _prontuarioResumo_(text, maxLen) {
  var s = String(text || "").replace(/\r/g, "").trim();
  if (!s) return "";
  if (!maxLen || maxLen < 10) maxLen = 240;
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen - 1) + "…";
}

// ============================================================
// Router do módulo
// ============================================================

function handleProntuarioAction(action, payload) {
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

    default:
      _prontuarioThrow_(
        "PRONTUARIO_UNKNOWN_ACTION",
        "Ação não reconhecida em Prontuario.gs: " + act,
        { action: act }
      );
  }
}

// ============================================================
// Delegadores (handlers existentes)
// ============================================================

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

/**
 * Delegador para Pacientes.
 * Seu projeto usa handlePacientesAction(action,payload,ctx) e remapeia "Pacientes.ObterPorId" -> "Pacientes_ObterPorId".
 */
function _prontuarioDelegarPacientes_(pacientesAction, payload) {
  if (typeof handlePacientesAction === "function") {
    // handlePacientesAction aceita (action,payload,ctx) mas ctx é opcional.
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

// ============================================================
// ✅ Paciente: Obter Resumo (para topo do prontuário)
// ============================================================

function _prontuarioPacienteObterResumo_(payload) {
  var idPaciente = String(payload.idPaciente || "").trim();

  // Seu Pacientes.gs garante: "Pacientes.ObterPorId" -> "Pacientes_ObterPorId"
  var raw = null;
  try {
    raw = _prontuarioDelegarPacientes_("Pacientes.ObterPorId", { idPaciente: idPaciente });
  } catch (e) {
    // fallback para o nome interno (se alguém chamar direto)
    try {
      raw = _prontuarioDelegarPacientes_("Pacientes_ObterPorId", { idPaciente: idPaciente });
    } catch (e2) {
      _prontuarioThrow_(
        "PRONTUARIO_PACIENTE_NOT_FOUND",
        "Não foi possível obter o paciente no módulo Pacientes.",
        { idPaciente: idPaciente, error: String((e2 && e2.message) ? e2.message : e2) }
      );
    }
  }

  var p = (raw && raw.paciente) ? raw.paciente : raw;

  // Campos alinhados ao seu schema v2:
  // nomeCompleto, dataNascimento, planoSaude, numeroCarteirinha
  var nome = _prontuarioPickFirst_(p, ["nomeCompleto", "nomeExibicao", "nomeSocial", "nome"]);
  var dn = _prontuarioPickFirst_(p, ["dataNascimento", "DataNascimento", "data_nascimento", "nascimento"]);
  var profissao = _prontuarioPickFirst_(p, ["profissao", "Profissao"]); // se existir na sua aba/legado
  var planoSaude = _prontuarioPickFirst_(p, ["planoSaude", "PlanoSaude", "convenio", "Convenio", "plano"]);
  var carteirinha = _prontuarioPickFirst_(p, [
    "numeroCarteirinha", "NumeroCarteirinha",
    "carteirinha", "Carteirinha"
  ]);

  // idade: calcula do dataNascimento se idade não vier pronta
  var idade = _prontuarioPickFirst_(p, ["idade", "Idade"]);
  if (!idade) {
    var idadeCalc = _prontuarioCalcIdadeFromAny_(dn);
    if (idadeCalc !== "" && idadeCalc !== null && idadeCalc !== undefined) idade = String(idadeCalc);
  }

  return {
    idPaciente: idPaciente,
    paciente: {
      idPaciente: idPaciente,
      nomeCompleto: nome ? String(nome) : "",
      dataNascimento: dn ? String(dn) : "",
      idade: idade ? String(idade) : "",
      profissao: profissao ? String(profissao) : "",
      planoSaude: planoSaude ? String(planoSaude) : "",
      carteirinha: carteirinha ? String(carteirinha) : ""
    }
  };
}

function _prontuarioPickFirst_(obj, keys) {
  obj = obj || {};
  keys = keys || [];
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    if (obj[k] !== null && typeof obj[k] !== "undefined") {
      var v = String(obj[k]).trim();
      if (v) return v;
    }
  }
  return "";
}

function _prontuarioCalcIdadeFromAny_(raw) {
  if (!raw) return "";

  var s = String(raw).trim();
  if (!s) return "";

  var d = new Date(s);
  if (isNaN(d.getTime())) {
    var m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) {
      d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    } else {
      var m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (m2) {
        d = new Date(Number(m2[1]), Number(m2[2]) - 1, Number(m2[3]));
      }
    }
  }

  if (isNaN(d.getTime())) return "";

  var hoje = new Date();
  var idade = hoje.getFullYear() - d.getFullYear();
  var mDiff = hoje.getMonth() - d.getMonth();
  if (mDiff < 0 || (mDiff === 0 && hoje.getDate() < d.getDate())) idade--;

  if (idade < 0 || idade > 130) return "";
  return idade;
}

// ============================================================
// Paginação: EVOLUÇÕES (cursor por timestamp)
// ============================================================

function _prontuarioEvolucaoListarPorPacientePaged_(payload) {
  var idPaciente = String(payload.idPaciente || "").trim();

  var limit = payload && payload.limit ? Number(payload.limit) : 40;
  if (!limit || isNaN(limit) || limit < 1) limit = 40;
  if (limit > 200) limit = 200;

  var cursorRaw = payload && payload.cursor ? String(payload.cursor) : "";
  cursorRaw = cursorRaw ? cursorRaw.trim() : "";
  var cursorMs = cursorRaw ? _prontuarioParseDateMs_(cursorRaw) : null;

  var resp = _prontuarioDelegarEvolucao_("Evolucao.ListarPorPaciente", { idPaciente: idPaciente }) || {};
  var lista =
    (resp && (resp.evolucoes || resp.lista)) ||
    (Array.isArray(resp) ? resp : []) ||
    [];

  lista = (lista || []).slice().sort(function (a, b) {
    var ta = (a && (a.dataHoraRegistro || a.dataHora || a.data || a.criadoEm)) || "";
    var tb = (b && (b.dataHoraRegistro || b.dataHora || b.data || b.criadoEm)) || "";
    return _prontuarioParseDateMs_(tb) - _prontuarioParseDateMs_(ta);
  });

  if (cursorMs !== null && !isNaN(cursorMs)) {
    var filtered = [];
    for (var i = 0; i < lista.length; i++) {
      var ts = (lista[i] && (lista[i].dataHoraRegistro || lista[i].dataHora || lista[i].data || lista[i].criadoEm)) || "";
      var ms = _prontuarioParseDateMs_(ts);
      if (ms < cursorMs) filtered.push(lista[i]);
    }
    lista = filtered;
  }

  var items = lista.slice(0, limit);
  var hasMore = lista.length > limit;

  var nextCursor = null;
  if (items.length) {
    var last = items[items.length - 1];
    nextCursor = String((last && (last.dataHoraRegistro || last.dataHora || last.data || last.criadoEm)) || "").trim() || null;
  }

  return {
    idPaciente: idPaciente,
    limit: limit,
    cursor: cursorRaw || null,
    nextCursor: nextCursor,
    hasMore: !!(hasMore && nextCursor),
    items: items
  };
}

// ============================================================
// Paginação: RECEITAS (cursor por timestamp)
// ============================================================

function _prontuarioReceitaListarPorPacientePaged_(payload) {
  var idPaciente = String(payload.idPaciente || "").trim();

  var limit = payload && payload.limit ? Number(payload.limit) : 25;
  if (!limit || isNaN(limit) || limit < 1) limit = 25;
  if (limit > 150) limit = 150;

  var cursorRaw = payload && payload.cursor ? String(payload.cursor) : "";
  cursorRaw = cursorRaw ? cursorRaw.trim() : "";
  var cursorMs = cursorRaw ? _prontuarioParseDateMs_(cursorRaw) : null;

  var resp = _prontuarioDelegarReceita_("Receita.ListarPorPaciente", { idPaciente: idPaciente }) || {};
  var lista =
    (resp && (resp.receitas || resp.lista)) ||
    (Array.isArray(resp) ? resp : []) ||
    [];

  lista = (lista || []).slice().sort(function (a, b) {
    var ta = (a && (a.dataHoraCriacao || a.dataHora || a.data || a.criadoEm)) || "";
    var tb = (b && (b.dataHoraCriacao || b.dataHora || b.data || b.criadoEm)) || "";
    return _prontuarioParseDateMs_(tb) - _prontuarioParseDateMs_(ta);
  });

  if (cursorMs !== null && !isNaN(cursorMs)) {
    var filtered = [];
    for (var i = 0; i < lista.length; i++) {
      var ts = (lista[i] && (lista[i].dataHoraCriacao || lista[i].dataHora || lista[i].data || lista[i].criadoEm)) || "";
      var ms = _prontuarioParseDateMs_(ts);
      if (ms < cursorMs) filtered.push(lista[i]);
    }
    lista = filtered;
  }

  var items = lista.slice(0, limit);
  var hasMore = lista.length > limit;

  var nextCursor = null;
  if (items.length) {
    var last = items[items.length - 1];
    nextCursor = String((last && (last.dataHoraCriacao || last.dataHora || last.data || last.criadoEm)) || "").trim() || null;
  }

  return {
    idPaciente: idPaciente,
    limit: limit,
    cursor: cursorRaw || null,
    nextCursor: nextCursor,
    hasMore: !!(hasMore && nextCursor),
    items: items
  };
}

// ============================================================
// Timeline unificada (paginada por cursor)
// ============================================================

function _prontuarioTimelineListarPorPaciente_(payload) {
  var idPaciente = String(payload.idPaciente || "").trim();

  var limit = payload && payload.limit ? Number(payload.limit) : 80;
  if (!limit || isNaN(limit) || limit < 1) limit = 80;
  if (limit > 300) limit = 300;

  var cursorRaw = payload && payload.cursor ? String(payload.cursor) : "";
  cursorRaw = cursorRaw ? cursorRaw.trim() : "";
  var cursorMs = cursorRaw ? _prontuarioParseDateMs_(cursorRaw) : null;

  var evolucoesResp = _prontuarioDelegarEvolucao_("Evolucao.ListarPorPaciente", { idPaciente: idPaciente }) || {};
  var receitasResp = _prontuarioDelegarReceita_("Receita.ListarPorPaciente", { idPaciente: idPaciente }) || {};
  var chatResp = _prontuarioDelegarChat_("Chat.ListByPaciente", { idPaciente: idPaciente }) || {};

  var evolucoes =
    (evolucoesResp && (evolucoesResp.evolucoes || evolucoesResp.lista)) ||
    (Array.isArray(evolucoesResp) ? evolucoesResp : []) ||
    [];

  var receitas =
    (receitasResp && (receitasResp.receitas || receitasResp.lista)) ||
    (Array.isArray(receitasResp) ? receitasResp : []) ||
    [];

  var mensagens =
    (chatResp && (chatResp.messages || chatResp.mensagens)) ||
    (Array.isArray(chatResp) ? chatResp : []) ||
    [];

  var events = [];

  for (var i = 0; i < evolucoes.length; i++) {
    var ev = evolucoes[i] || {};
    var idE = ev.idEvolucao || ev.ID_Evolucao || ev.id || "";
    var tsE = ev.dataHoraRegistro || ev.dataHora || ev.data || ev.criadoEm || "";
    var textoE = String(ev.texto || "").trim();
    var autorE = ev.autor || ev.profissional || "";
    var origemE = ev.origem || "";

    events.push({
      type: "EVOLUCAO",
      id: String(idE || ""),
      ts: String(tsE || ""),
      title: autorE ? String(autorE) : (origemE ? String(origemE) : ""),
      summary: _prontuarioResumo_(textoE, 320),
      raw: ev
    });
  }

  for (var j = 0; j < receitas.length; j++) {
    var rec = receitas[j] || {};
    var idR = rec.idReceita || rec.ID_Receita || rec.id || "";
    var tsR = rec.dataHoraCriacao || rec.dataHora || rec.data || rec.criadoEm || "";

    var tipoReceita = rec.tipoReceita || rec.TipoReceita || "";
    var status = rec.status || rec.Status || "";
    var dataReceita = rec.dataReceita || rec.DataReceita || "";

    var textoMed = String(rec.textoMedicamentos || rec.TextoMedicamentos || "").trim();
    if (!textoMed && rec.itens && rec.itens.length) {
      textoMed = "Itens: " + rec.itens.length;
    }

    var titleParts = [];
    if (tipoReceita) titleParts.push(String(tipoReceita));
    if (status) titleParts.push(String(status));
    if (dataReceita) titleParts.push("Data: " + String(dataReceita));
    var titleR = titleParts.join(" · ");

    events.push({
      type: "RECEITA",
      id: String(idR || ""),
      ts: String(tsR || ""),
      title: titleR,
      summary: _prontuarioResumo_(textoMed, 260),
      raw: rec
    });
  }

  for (var k = 0; k < mensagens.length; k++) {
    var msg = mensagens[k] || {};
    var idC = msg.id || msg.ID || msg.idMensagem || msg.ID_Mensagem || "";
    var tsC = msg.timestamp || msg.dataHora || msg.criadoEm || "";
    var sender = msg.sender || msg.autor || "";
    var message = String(msg.message || msg.texto || "").trim();

    events.push({
      type: "CHAT",
      id: String(idC || ""),
      ts: String(tsC || ""),
      title: sender ? String(sender) : "",
      summary: _prontuarioResumo_(message, 240),
      raw: msg
    });
  }

  // ✅ Ordenação correta
  events.sort(function (a, b) {
    return _prontuarioParseDateMs_(b && b.ts) - _prontuarioParseDateMs_(a && a.ts);
  });

  if (cursorMs !== null && !isNaN(cursorMs)) {
    var filteredEvents = [];
    for (var m = 0; m < events.length; m++) {
      var ms = _prontuarioParseDateMs_(events[m] && events[m].ts);
      if (ms < cursorMs) filteredEvents.push(events[m]);
    }
    events = filteredEvents;
  }

  var pageEvents = events.slice(0, limit);
  var hasMore = events.length > limit;

  var nextCursor = null;
  if (pageEvents.length) {
    nextCursor = String(pageEvents[pageEvents.length - 1].ts || "").trim() || null;
  }

  return {
    idPaciente: idPaciente,
    limit: limit,
    cursor: cursorRaw || null,
    nextCursor: nextCursor,
    hasMore: !!(hasMore && nextCursor),
    events: pageEvents
  };
}
