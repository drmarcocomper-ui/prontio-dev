function _agendaNormalizeStatus_(status) {
  var s = String(status || "").trim().toUpperCase();
  if (!s) return AGENDA_STATUS.MARCADO;

  if (s === "AGENDADO") return AGENDA_STATUS.MARCADO;
  if (s === "CHEGOU") return AGENDA_STATUS.AGUARDANDO;
  if (s === "CHAMADO") return AGENDA_STATUS.AGUARDANDO;
  if (s === "CONCLUIDO") return AGENDA_STATUS.ATENDIDO;

  if (s === "EM ATENDIMENTO" || s === "EM-ATENDIMENTO") s = "EM_ATENDIMENTO";

  if (s.indexOf("REMARC") >= 0) return AGENDA_STATUS.REMARCADO;
  if (s.indexOf("CANCEL") >= 0) return AGENDA_STATUS.CANCELADO;
  if (s.indexOf("FALT") >= 0) return AGENDA_STATUS.FALTOU;

  if (s.indexOf("ATENDID") >= 0) return AGENDA_STATUS.ATENDIDO;
  if (s.indexOf("EM_ATEND") >= 0) return AGENDA_STATUS.EM_ATENDIMENTO;

  if (s.indexOf("AGUARD") >= 0) return AGENDA_STATUS.AGUARDANDO;
  if (s.indexOf("CONFIRM") >= 0) return AGENDA_STATUS.CONFIRMADO;
  if (s.indexOf("MARC") >= 0) return AGENDA_STATUS.MARCADO;

  return AGENDA_STATUS.MARCADO;
}

function _agendaNormalizeTipo_(tipo) {
  var t = String(tipo || "").trim().toUpperCase();
  if (!t) return AGENDA_TIPO.CONSULTA;

  if (t.indexOf("BLOQ") >= 0) return AGENDA_TIPO.BLOQUEIO;
  if (t.indexOf("RET") >= 0) return AGENDA_TIPO.RETORNO;
  if (t.indexOf("PROC") >= 0) return AGENDA_TIPO.PROCEDIMENTO;
  if (t.indexOf("CONS") >= 0) return AGENDA_TIPO.CONSULTA;

  if (
    t === AGENDA_TIPO.CONSULTA ||
    t === AGENDA_TIPO.RETORNO ||
    t === AGENDA_TIPO.PROCEDIMENTO ||
    t === AGENDA_TIPO.BLOQUEIO ||
    t === AGENDA_TIPO.OUTRO
  ) return t;

  return AGENDA_TIPO.OUTRO;
}

function _agendaNormalizeOrigem_(origem) {
  var o = String(origem || "").trim().toUpperCase();
  if (!o) return AGENDA_ORIGEM.RECEPCAO;
  if (o.indexOf("RECEP") >= 0) return AGENDA_ORIGEM.RECEPCAO;
  if (o.indexOf("MED") >= 0) return AGENDA_ORIGEM.MEDICO;
  if (o.indexOf("SIS") >= 0) return AGENDA_ORIGEM.SISTEMA;
  if (o === AGENDA_ORIGEM.RECEPCAO || o === AGENDA_ORIGEM.MEDICO || o === AGENDA_ORIGEM.SISTEMA) return o;
  return AGENDA_ORIGEM.RECEPCAO;
}

function _agendaNormalizeRowToDto_(rowObj) {
  rowObj = rowObj || {};
  return {
    idAgenda: rowObj.idAgenda || rowObj.ID_Agenda || "",
    idPaciente: rowObj.idPaciente || rowObj.ID_Paciente || "",
    inicio: rowObj.inicio || "",
    fim: rowObj.fim || "",
    titulo: rowObj.titulo || "",
    notas: rowObj.notas || "",
    tipo: rowObj.tipo || AGENDA_TIPO.CONSULTA,
    status: rowObj.status || AGENDA_STATUS.MARCADO,
    origem: rowObj.origem || AGENDA_ORIGEM.RECEPCAO,
    criadoEm: rowObj.criadoEm || "",
    atualizadoEm: rowObj.atualizadoEm || "",
    canceladoEm: rowObj.canceladoEm || "",
    canceladoMotivo: rowObj.canceladoMotivo || "",
    // ✅ garante que o campo exista (mesmo que vazio) para o front novo
    nomeCompleto: rowObj.nomeCompleto || ""
  };
}

function _agendaNormalizeCreateInput_(payload, params) {
  params = params || {};
  payload = payload || {};

  var idPaciente = payload.idPaciente ? String(payload.idPaciente) : (payload.ID_Paciente ? String(payload.ID_Paciente) : "");

  var titulo = payload.titulo || payload.motivo || "";
  var notas = payload.notas || "";
  var tipo = payload.tipo ? String(payload.tipo) : (payload.Bloqueio === true ? AGENDA_TIPO.BLOQUEIO : AGENDA_TIPO.CONSULTA);
  var origem = payload.origem ? String(payload.origem) : AGENDA_ORIGEM.RECEPCAO;

  var status = payload.status ? String(payload.status) : AGENDA_STATUS.MARCADO;
  status = _agendaNormalizeStatus_(status);

  var permitirEncaixe = payload.permitirEncaixe === true || payload.permite_encaixe === true;

  if (payload.inicio && payload.fim) {
    var ini = _agendaParseDateRequired_(payload.inicio, "inicio");
    var fim = _agendaParseDateRequired_(payload.fim, "fim");
    return {
      idPaciente: idPaciente,
      inicio: ini,
      fim: fim,
      titulo: String(titulo || ""),
      notas: String(notas || ""),
      tipo: _agendaNormalizeTipo_(tipo),
      status: status,
      origem: _agendaNormalizeOrigem_(origem),
      permitirEncaixe: permitirEncaixe
    };
  }

  var dataStr = payload.data ? String(payload.data) : null;
  var horaInicio = payload.hora_inicio ? String(payload.hora_inicio) : null;
  if (!dataStr) _agendaThrow_("VALIDATION_ERROR", 'Campo "data" é obrigatório.', { field: "data" });
  if (!horaInicio) _agendaThrow_("VALIDATION_ERROR", 'Campo "hora_inicio" é obrigatório.', { field: "hora_inicio" });

  var duracao = (payload.duracao_minutos !== undefined) ? Number(payload.duracao_minutos) : Number(params.duracaoPadraoMin || 30);
  if (isNaN(duracao) || duracao <= 0) duracao = Number(params.duracaoPadraoMin || 30);

  var ini2 = _agendaBuildDateTime_(dataStr, horaInicio);
  var fim2 = new Date(ini2.getTime() + duracao * 60000);

  return {
    idPaciente: idPaciente,
    inicio: ini2,
    fim: fim2,
    titulo: String(titulo || ""),
    notas: String(notas || ""),
    tipo: _agendaNormalizeTipo_(tipo),
    status: status,
    origem: _agendaNormalizeOrigem_(origem),
    permitirEncaixe: permitirEncaixe
  };
}

function _agendaBuildUpdatePatch_(existing, patch, topCompat, params) {
  patch = patch || {};
  topCompat = topCompat || {};
  params = params || {};

  var out = {};

  var fields = ["idPaciente", "titulo", "notas", "tipo", "status", "origem", "canceladoMotivo"];
  for (var i = 0; i < fields.length; i++) {
    var f = fields[i];
    if (patch[f] !== undefined) out[f] = patch[f];
  }

  if (topCompat.ID_Paciente !== undefined) out.idPaciente = topCompat.ID_Paciente;

  if (out.tipo !== undefined) out.tipo = _agendaNormalizeTipo_(out.tipo);
  if (out.status !== undefined) out.status = _agendaNormalizeStatus_(out.status);
  if (out.origem !== undefined) out.origem = _agendaNormalizeOrigem_(out.origem);

  var hasNewDates = (patch.inicio !== undefined) || (patch.fim !== undefined);
  if (hasNewDates) {
    if (patch.inicio !== undefined) out.inicio = _agendaParseDateRequired_(patch.inicio, "inicio").toISOString();
    if (patch.fim !== undefined) out.fim = _agendaParseDateRequired_(patch.fim, "fim").toISOString();
  } else {
    var dataStr = (topCompat.data !== undefined) ? String(topCompat.data) : null;
    var horaInicio = (topCompat.hora_inicio !== undefined) ? String(topCompat.hora_inicio) : null;
    var duracao = (topCompat.duracao_minutos !== undefined) ? Number(topCompat.duracao_minutos) : null;

    if (dataStr || horaInicio || duracao !== null) {
      var exIni = _agendaParseDate_(existing.inicio);
      var exFim = _agendaParseDate_(existing.fim);

      var baseData = dataStr || (exIni ? _agendaFormatDate_(exIni) : null);
      var baseHora = horaInicio || (exIni ? _agendaFormatHHMM_(exIni) : null);

      if (!baseData || !baseHora) _agendaThrow_("VALIDATION_ERROR", "Não foi possível determinar data/hora para atualização legado.", {});

      var durMin;
      if (duracao !== null && !isNaN(duracao) && duracao > 0) durMin = duracao;
      else {
        if (exIni && exFim) durMin = Math.max(1, Math.round((exFim.getTime() - exIni.getTime()) / 60000));
        else durMin = Number(params.duracaoPadraoMin || 30);
      }

      var ini = _agendaBuildDateTime_(baseData, baseHora);
      var fim = new Date(ini.getTime() + durMin * 60000);

      out.inicio = ini.toISOString();
      out.fim = fim.toISOString();
    }
  }

  return out;
}
