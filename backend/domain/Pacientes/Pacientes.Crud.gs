// ---------------------------------------------------------------------------
// CRUD repo-first
// ---------------------------------------------------------------------------

function readAllPacientes_() {
  // garante schema (best-effort)
  try { Pacientes_EnsureSchema_({}); } catch (_) {}

  var rows = Pacientes_Repo_List_();
  var list = [];

  for (var i = 0; i < rows.length; i++) {
    var dto = pacienteRepoRowToObject_(rows[i]);
    if (!dto.idPaciente && !dto.nomeCompleto && !dto.nomeSocial) continue;
    list.push(dto);
  }

  return list;
}

function Pacientes_DebugInfo(payload) {
  // Repo-first: retorna diagnóstico do sheet + sample via repo
  var ss = null;
  try { ss = Pacientes_getDb_(); } catch (_) { ss = null; }

  var exists = false;
  var sh = null;
  var header = [];
  var lastRow = 0;
  var lastCol = 0;

  try {
    sh = ss ? ss.getSheetByName(PACIENTES_SHEET_NAME) : null;
    exists = !!sh;
    if (exists) {
      lastRow = sh.getLastRow();
      lastCol = sh.getLastColumn();
      if (lastCol > 0) {
        header = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (x) { return String(x || ""); });
      }
    }
  } catch (_) {}

  var sample = [];
  try {
    var list = Pacientes_Repo_List_().slice(0, 10);
    for (var i = 0; i < list.length; i++) {
      var p = pacienteRepoRowToObject_(list[i]);
      sample.push({
        idPaciente: p.idPaciente,
        nomeCompleto: p.nomeCompleto,
        status: p.status,
        cpf: p.cpf,
        telefonePrincipal: p.telefonePrincipal,
        planoSaude: p.planoSaude,
        profissao: p.profissao
      });
    }
  } catch (_) {}

  return {
    spreadsheetId: ss && ss.getId ? ss.getId() : "",
    spreadsheetName: ss && ss.getName ? ss.getName() : "",
    sheetName: PACIENTES_SHEET_NAME,
    sheetExists: exists,
    lastRow: lastRow,
    lastCol: lastCol,
    header: header,
    sample: sample
  };
}

function Pacientes_ListarSelecao(payload) {
  var todos = readAllPacientes_();
  var ativos = todos.filter(function (p) { return p.ativo; });

  var pacientes = ativos.map(function (p) {
    return {
      ID_Paciente: p.ID_Paciente,
      idPaciente: p.idPaciente,
      nomeCompleto: p.nomeCompleto,
      nomeSocial: p.nomeSocial,
      nomeExibicao: p.nomeExibicao,
      documento: p.cpf,
      telefone: p.telefonePrincipal || p.telefone1 || p.telefone || '',
      planoSaude: p.planoSaude || '',
      numeroCarteirinha: p.numeroCarteirinha || '',
      profissao: p.profissao || ''
    };
  });

  return { pacientes: pacientes };
}

function Pacientes_BuscarSimples(payload) {
  payload = payload || {};
  var termo = String(payload.termo || '').toLowerCase().trim();
  var limite = Number(payload.limite || 30);
  if (!limite || limite <= 0) limite = 30;

  if (!termo) return { pacientes: [] };

  var todos = readAllPacientes_();
  if (!todos.length) return { pacientes: [] };

  var resultados = [];
  for (var i = 0; i < todos.length; i++) {
    var p = todos[i];
    if (!p.ativo) continue;

    var haystack = [p.nomeExibicao || p.nomeCompleto || '', p.cpf || '', p.telefonePrincipal || p.telefone1 || p.telefone || '']
      .join(' ')
      .toLowerCase();

    if (haystack.indexOf(termo) !== -1) {
      resultados.push({
        ID_Paciente: p.ID_Paciente,
        idPaciente: p.idPaciente,
        nome: p.nomeExibicao || p.nomeCompleto,
        documento: p.cpf,
        telefone: p.telefonePrincipal || p.telefone1 || p.telefone || '',
        data_nascimento: p.dataNascimento
      });

      if (resultados.length >= limite) break;
    }
  }

  return { pacientes: resultados };
}

function Pacientes_Listar(payload) {
  // mantém lógica atual (filtra/ordena/pagina) sobre readAllPacientes_
  payload = payload || {};
  var termo = String(payload.termo || '').toLowerCase().trim();
  var somenteAtivos = !!payload.somenteAtivos;
  var ordenacao = String(payload.ordenacao || 'dataCadastroDesc');

  var wantsPaging =
    Object.prototype.hasOwnProperty.call(payload, 'page') ||
    Object.prototype.hasOwnProperty.call(payload, 'pageSize');

  var page = wantsPaging ? parseInt(payload.page, 10) : null;
  var pageSize = wantsPaging ? parseInt(payload.pageSize, 10) : null;

  if (!wantsPaging) {
    page = null;
    pageSize = null;
  } else {
    if (!page || page < 1) page = 1;
    if (!pageSize || pageSize < 1) pageSize = 50;
    if (pageSize > 500) pageSize = 500;
  }

  var todos = readAllPacientes_();

  var filtrados = todos.filter(function (p) {
    if (somenteAtivos && !p.ativo) return false;

    if (!termo) return true;

    var texto = [p.nomeExibicao || p.nomeCompleto || '', p.cpf || '', (p.telefonePrincipal || p.telefone1 || p.telefone || ''), p.email || '']
      .join(' ')
      .toLowerCase();

    return texto.indexOf(termo) !== -1;
  });

  filtrados.sort(function (a, b) {
    if (ordenacao === 'nomeAsc' || ordenacao === 'nomeDesc') {
      var na = (a.nomeExibicao || a.nomeCompleto || '').toLowerCase();
      var nb = (b.nomeExibicao || b.nomeCompleto || '').toLowerCase();
      if (na < nb) return ordenacao === 'nomeAsc' ? -1 : 1;
      if (na > nb) return ordenacao === 'nomeAsc' ? 1 : -1;
      return 0;
    }

    var da = Date.parse(a.criadoEm || a.dataCadastro || '') || 0;
    var db = Date.parse(b.criadoEm || b.dataCadastro || '') || 0;

    if (da < db) return ordenacao === 'dataCadastroAsc' ? -1 : 1;
    if (da > db) return ordenacao === 'dataCadastroAsc' ? 1 : -1;
    return 0;
  });

  if (!wantsPaging) return { pacientes: filtrados };

  var total = filtrados.length;
  var start = (page - 1) * pageSize;
  var end = start + pageSize;

  var items = [];
  if (start < total) items = filtrados.slice(start, Math.min(end, total));

  var totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (page > totalPages) {
    page = totalPages;
    start = (page - 1) * pageSize;
    end = start + pageSize;
    items = filtrados.slice(start, Math.min(end, total));
  }

  return {
    pacientes: items,
    paging: {
      enabled: true,
      page: page,
      pageSize: pageSize,
      total: total,
      totalPages: totalPages,
      hasPrev: page > 1,
      hasNext: page < totalPages
    }
  };
}

function Pacientes_ObterPorId(payload) {
  var id = '';
  if (payload) {
    if (payload.ID_Paciente) id = String(payload.ID_Paciente).trim();
    else if (payload.idPaciente) id = String(payload.idPaciente).trim();
  }

  if (!id) _pacientesThrow_('PACIENTES_MISSING_ID', 'ID_Paciente é obrigatório em Pacientes_ObterPorId.', null);

  try { Pacientes_EnsureSchema_({}); } catch (_) {}

  var row = Pacientes_Repo_GetById_(id);
  if (!row) _pacientesThrow_('PACIENTES_NOT_FOUND', 'Paciente não encontrado para ID: ' + id, null);

  return { paciente: pacienteRepoRowToObject_(row) };
}

function Pacientes_Criar(payload, ctx) {
  payload = payload || {};
  ctx = ctx || { action: "Pacientes_Criar" };

  try { Pacientes_EnsureSchema_({}); } catch (_) {}

  var nomeCompleto = _toText_(payload.nomeCompleto);
  if (!nomeCompleto) {
    _pacientesAudit_(ctx, "Pacientes_Criar", "PACIENTE_CREATE", "ERROR", { reason: "MISSING_NOME" }, { id: "" });
    _pacientesThrow_('PACIENTES_MISSING_NOME', 'nomeCompleto é obrigatório para criar paciente.', null);
  }

  var idPaciente = gerarIdPaciente_();
  var agoraStr = _formatDateTime_(new Date());

  var cpfFmt = _cpfFormat_(payload.cpf || payload.documento || '');
  var tel1Fmt = _phoneFormat_(payload.telefonePrincipal || payload.telefone1 || payload.telefone || '');
  var tel2Fmt = _phoneFormat_(payload.telefoneSecundario || payload.telefone2 || '');
  var warnings = _warningsDuplicidadeCpf_(cpfFmt, '');

  var statusFinal = _ativoToStatus_(
    (typeof payload.ativo !== 'undefined') ? !!payload.ativo : undefined,
    _toText_(payload.status || '')
  );

  var dto = {
    idPaciente: idPaciente,
    status: statusFinal,

    nomeCompleto: nomeCompleto,
    nomeSocial: _toText_(payload.nomeSocial || ''),
    sexo: _toText_(payload.sexo || ''),
    dataNascimento: _toText_(payload.dataNascimento || payload.nascimento || ''),
    estadoCivil: _toText_(payload.estadoCivil || ''),

    cpf: cpfFmt,
    rg: _toText_(payload.rg || ''),
    rgOrgaoEmissor: _toText_(payload.rgOrgaoEmissor || ''),

    telefonePrincipal: tel1Fmt,
    telefoneSecundario: tel2Fmt,
    email: _toText_(payload.email || ''),

    planoSaude: _toText_(payload.planoSaude || ''),
    numeroCarteirinha: _toText_(payload.numeroCarteirinha || ''),

    profissao: _toText_(payload.profissao || payload.Profissao || ''),

    cep: _toText_(payload.cep || ''),
    logradouro: _toText_(payload.logradouro || payload.endereco || ''),
    numero: _toText_(payload.numero || ''),
    complemento: _toText_(payload.complemento || ''),
    bairro: _toText_(payload.bairro || payload.enderecoBairro || ''),
    cidade: _toText_(payload.cidade || payload.enderecoCidade || ''),
    estado: _toText_(payload.estado || payload.enderecoUf || ''),

    tipoSanguineo: _toText_(payload.tipoSanguineo || ''),
    alergias: _toText_(payload.alergias || ''),
    observacoesClinicas: _toText_(payload.observacoesClinicas || ''),
    observacoesAdministrativas: _toText_(payload.observacoesAdministrativas || payload.obsImportantes || payload.observacoes || ''),

    criadoEm: agoraStr,
    atualizadoEm: agoraStr
  };

  Pacientes_Repo_Insert_(dto);

  _pacientesAudit_(
    ctx,
    "Pacientes_Criar",
    "PACIENTE_CREATE",
    warnings.length ? "WARN" : "SUCCESS",
    { idPaciente: idPaciente, warningsCount: warnings.length },
    { id: idPaciente, login: "" }
  );

  return { ID_Paciente: idPaciente, idPaciente: idPaciente, warnings: warnings };
}

function Pacientes_Atualizar(payload, ctx) {
  payload = payload || {};
  ctx = ctx || { action: "Pacientes_Atualizar" };

  try { Pacientes_EnsureSchema_({}); } catch (_) {}

  var id = '';
  if (payload.ID_Paciente) id = String(payload.ID_Paciente).trim();
  else if (payload.idPaciente) id = String(payload.idPaciente).trim();

  if (!id) {
    _pacientesAudit_(ctx, "Pacientes_Atualizar", "PACIENTE_UPDATE", "ERROR", { reason: "MISSING_ID" }, { id: "" });
    _pacientesThrow_('PACIENTES_MISSING_ID', 'ID_Paciente é obrigatório em Pacientes_Atualizar.', null);
  }

  var existing = Pacientes_Repo_GetById_(id);
  if (!existing) _pacientesThrow_('PACIENTES_NOT_FOUND', 'Paciente não encontrado para ID: ' + id, null);

  var warnings = [];
  if (Object.prototype.hasOwnProperty.call(payload, "cpf") || Object.prototype.hasOwnProperty.call(payload, "documento")) {
    var cpfCandidate = payload.cpf || payload.documento || '';
    warnings = warnings.concat(_warningsDuplicidadeCpf_(cpfCandidate, id));
  }

  var changed = [];
  var patch = {};

  function setIfProvided(propNames, transformFn, colName, auditFieldName) {
    var has = false;
    for (var k = 0; k < propNames.length; k++) {
      if (Object.prototype.hasOwnProperty.call(payload, propNames[k])) { has = true; break; }
    }
    if (!has) return;

    var v = '';
    for (var j = 0; j < propNames.length; j++) {
      var pn = propNames[j];
      if (Object.prototype.hasOwnProperty.call(payload, pn)) { v = payload[pn]; break; }
    }
    if (transformFn) v = transformFn(v);

    patch[colName] = (v === undefined || v === null) ? '' : v;
    changed.push(auditFieldName || colName);
  }

  setIfProvided(['nomeCompleto'], function (v) { return _toText_(v); }, 'nomeCompleto', 'nomeCompleto');
  setIfProvided(['nomeSocial'], function (v) { return _toText_(v); }, 'nomeSocial', 'nomeSocial');

  setIfProvided(['cpf','documento'], function (v) { return _cpfFormat_(v); }, 'cpf', 'cpf');
  setIfProvided(['rg'], function (v) { return _toText_(v); }, 'rg', 'rg');
  setIfProvided(['rgOrgaoEmissor'], function (v) { return _toText_(v); }, 'rgOrgaoEmissor', 'rgOrgaoEmissor');

  setIfProvided(['sexo'], function (v) { return _toText_(v); }, 'sexo', 'sexo');
  setIfProvided(['dataNascimento'], function (v) { return _toText_(v); }, 'dataNascimento', 'dataNascimento');
  setIfProvided(['estadoCivil'], function (v) { return _toText_(v); }, 'estadoCivil', 'estadoCivil');

  setIfProvided(['telefonePrincipal','telefone1','telefone'], function (v) { return _phoneFormat_(v); }, 'telefonePrincipal', 'telefonePrincipal');
  setIfProvided(['telefoneSecundario','telefone2'], function (v) { return _phoneFormat_(v); }, 'telefoneSecundario', 'telefoneSecundario');

  setIfProvided(['email'], function (v) { return _toText_(v); }, 'email', 'email');

  setIfProvided(['planoSaude'], function (v) { return _toText_(v); }, 'planoSaude', 'planoSaude');
  setIfProvided(['numeroCarteirinha'], function (v) { return _toText_(v); }, 'numeroCarteirinha', 'numeroCarteirinha');

  setIfProvided(['profissao','Profissao'], function (v) { return _toText_(v); }, 'profissao', 'profissao');

  setIfProvided(['cep'], function (v) { return _toText_(v); }, 'cep', 'cep');
  setIfProvided(['logradouro','endereco'], function (v) { return _toText_(v); }, 'logradouro', 'logradouro');
  setIfProvided(['numero'], function (v) { return _toText_(v); }, 'numero', 'numero');
  setIfProvided(['complemento'], function (v) { return _toText_(v); }, 'complemento', 'complemento');
  setIfProvided(['bairro','enderecoBairro'], function (v) { return _toText_(v); }, 'bairro', 'bairro');
  setIfProvided(['cidade','enderecoCidade'], function (v) { return _toText_(v); }, 'cidade', 'cidade');
  setIfProvided(['estado','enderecoUf'], function (v) { return _toText_(v); }, 'estado', 'estado');

  setIfProvided(['tipoSanguineo'], function (v) { return _toText_(v); }, 'tipoSanguineo', 'tipoSanguineo');
  setIfProvided(['alergias'], function (v) { return _toText_(v); }, 'alergias', 'alergias');
  setIfProvided(['observacoesClinicas'], function (v) { return _toText_(v); }, 'observacoesClinicas', 'observacoesClinicas');
  setIfProvided(['observacoesAdministrativas','obsImportantes','observacoes'], function (v) { return _toText_(v); }, 'observacoesAdministrativas', 'observacoesAdministrativas');

  // status/ativo (se enviado)
  if (Object.prototype.hasOwnProperty.call(payload, 'status')) {
    patch.status = String(payload.status || '').trim().toUpperCase();
    changed.push("status");
  } else if (Object.prototype.hasOwnProperty.call(payload, 'ativo')) {
    patch.status = payload.ativo ? 'ATIVO' : 'INATIVO';
    changed.push("status");
  }

  patch.atualizadoEm = _formatDateTime_(new Date());

  var ok = Pacientes_Repo_UpdateById_(id, patch);
  if (!ok) _pacientesThrow_('PACIENTES_NOT_FOUND', 'Paciente não encontrado para ID: ' + id, null);

  var after = Pacientes_Repo_GetById_(id);
  var pacienteAtualizado = after ? pacienteRepoRowToObject_(after) : null;

  _pacientesAudit_(
    ctx,
    "Pacientes_Atualizar",
    "PACIENTE_UPDATE",
    warnings.length ? "WARN" : "SUCCESS",
    { idPaciente: id, changedFields: changed, warningsCount: warnings.length },
    { id: id, login: "" }
  );

  return { paciente: pacienteAtualizado, warnings: warnings };
}

function Pacientes_AlterarStatus(payload, ctx) {
  payload = payload || {};
  ctx = ctx || { action: "Pacientes_AlterarStatus" };

  try { Pacientes_EnsureSchema_({}); } catch (_) {}

  var id = '';
  if (payload.ID_Paciente) id = String(payload.ID_Paciente).trim();
  else if (payload.idPaciente) id = String(payload.idPaciente).trim();

  if (!id) {
    _pacientesAudit_(ctx, "Pacientes_AlterarStatus", "PACIENTE_STATUS", "ERROR", { reason: "MISSING_ID" }, { id: "" });
    _pacientesThrow_('PACIENTES_MISSING_ID', 'ID_Paciente é obrigatório em Pacientes_AlterarStatus.', null);
  }

  var existing = Pacientes_Repo_GetById_(id);
  if (!existing) _pacientesThrow_('PACIENTES_NOT_FOUND', 'Paciente não encontrado para ID: ' + id, null);

  var status = null;
  if (Object.prototype.hasOwnProperty.call(payload, 'status')) {
    status = String(payload.status || '').trim().toUpperCase();
    if (!status) _pacientesThrow_('PACIENTES_MISSING_STATUS', 'Campo "status" não pode ser vazio.', null);
    if (['ATIVO','INATIVO','OBITO'].indexOf(status) === -1) {
      _pacientesThrow_('PACIENTES_INVALID_STATUS', 'status inválido. Use ATIVO | INATIVO | OBITO', { status: status });
    }
  }

  var ativoBool = null;
  if (Object.prototype.hasOwnProperty.call(payload, 'ativo')) {
    ativoBool = !!payload.ativo;
  }

  if (status === null && ativoBool === null) {
    _pacientesAudit_(ctx, "Pacientes_AlterarStatus", "PACIENTE_STATUS", "ERROR", { reason: "MISSING_ATIVO_STATUS" }, { id: id });
    _pacientesThrow_('PACIENTES_MISSING_ATIVO_STATUS', 'Informe "ativo" (true/false) ou "status".', null);
  }

  var statusFinal = status ? status : (ativoBool ? 'ATIVO' : 'INATIVO');

  var ok = Pacientes_Repo_UpdateById_(id, {
    status: statusFinal,
    atualizadoEm: _formatDateTime_(new Date())
  });

  if (!ok) _pacientesThrow_('PACIENTES_NOT_FOUND', 'Paciente não encontrado para ID: ' + id, null);

  _pacientesAudit_(
    ctx,
    "Pacientes_AlterarStatus",
    "PACIENTE_STATUS",
    "SUCCESS",
    { idPaciente: id, status: statusFinal },
    { id: id, login: "" }
  );

  return { ID_Paciente: id, idPaciente: id, status: statusFinal, ativo: (statusFinal === 'ATIVO') };
}
