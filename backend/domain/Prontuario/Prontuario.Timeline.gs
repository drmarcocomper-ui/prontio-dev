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
