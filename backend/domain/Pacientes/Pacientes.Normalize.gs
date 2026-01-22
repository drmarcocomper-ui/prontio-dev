// ---------------------------------------------------------------------------
// Normalizações, sanitizações, datas, formatadores e helpers do Pacientes
// ---------------------------------------------------------------------------

/** Helpers de data/hora */
function _tz_() {
  return Session.getScriptTimeZone() || 'America/Sao_Paulo';
}

function _formatDateYMD_(date) {
  if (!(date instanceof Date) || isNaN(date.getTime())) return '';
  return Utilities.formatDate(date, _tz_(), 'yyyy-MM-dd');
}

function _formatDateTime_(date) {
  if (!(date instanceof Date) || isNaN(date.getTime())) return '';
  return Utilities.formatDate(date, _tz_(), 'yyyy-MM-dd HH:mm:ss');
}

/**
 * ✅ Sanitização:
 * - Evita vazar valores de erro do Sheets para o front (#ERROR!, #N/A, etc.)
 */
function _toText_(v) {
  if (v === null || v === undefined) return '';
  var s = String(v).trim();
  if (s === '#ERROR!' || s === '#N/A' || s === '#REF!' || s === '#VALUE!' || s === '#DIV/0!') return '';
  return s;
}

function _onlyDigits_(s) {
  return String(s || '').replace(/\D+/g, '');
}

/** CPF: retorna só dígitos (se tiver), sem forçar tamanho */
function _cpfDigits_(cpf) {
  return _onlyDigits_(_toText_(cpf));
}

/** CPF: formata ###.###.###-## se tiver 11 dígitos, senão retorna texto limpo */
function _cpfFormat_(cpf) {
  var d = _cpfDigits_(cpf);
  if (d.length !== 11) return _toText_(cpf);
  return d.substring(0, 3) + '.' + d.substring(3, 6) + '.' + d.substring(6, 9) + '-' + d.substring(9, 11);
}

/**
 * Telefone BR (best-effort):
 * - Se 10 dígitos -> (DD) NNNN-NNNN
 * - Se 11 dígitos -> (DD) NNNNN-NNNN
 * - Caso contrário, retorna texto limpo como veio
 */
function _phoneFormat_(tel) {
  var raw = _toText_(tel);
  var d = _onlyDigits_(raw);
  if (d.length === 10) {
    return '(' + d.substring(0, 2) + ') ' + d.substring(2, 6) + '-' + d.substring(6, 10);
  }
  if (d.length === 11) {
    return '(' + d.substring(0, 2) + ') ' + d.substring(2, 7) + '-' + d.substring(7, 11);
  }
  return raw;
}

/**
 * Detecta possíveis duplicidades por CPF (não bloqueia)
 * ✅ Otimizado: usa índice cacheado em vez de varrer todos sempre.
 *
 * Requer:
 * - Pacientes_CpfIndex_Find_(cpfDigits) (em Pacientes.IndexCpf.gs)
 * - readAllPacientes_() (fallback)
 */
function _warningsDuplicidadeCpf_(cpfInput, excludeId) {
  var cpfDigits = _cpfDigits_(cpfInput);
  if (cpfDigits.length !== 11) return [];

  excludeId = excludeId ? String(excludeId) : '';

  var matches = [];
  try {
    var indexed = Pacientes_CpfIndex_Find_(cpfDigits) || [];
    for (var i = 0; i < indexed.length; i++) {
      var m = indexed[i] || {};
      var pid = String(m.idPaciente || "").trim();
      if (!pid) continue;
      if (excludeId && pid === excludeId) continue;
      matches.push({ idPaciente: pid, nomeCompleto: m.nomeCompleto || "" });
      if (matches.length >= 3) break;
    }
  } catch (_) {
    // fallback seguro: se cache/index falhar, volta ao método antigo (varre tudo)
    var todos = readAllPacientes_();
    for (var j = 0; j < todos.length; j++) {
      var p = todos[j];
      var pid2 = String(p.idPaciente || p.ID_Paciente || '');
      if (!pid2) continue;
      if (excludeId && pid2 === excludeId) continue;

      var pd = _cpfDigits_(p.cpf || '');
      if (pd.length === 11 && pd === cpfDigits) {
        matches.push({ idPaciente: pid2, nomeCompleto: p.nomeCompleto || p.nomeExibicao || '' });
        if (matches.length >= 3) break;
      }
    }
  }

  if (!matches.length) return [];

  return [{
    code: "POSSIVEL_DUPLICIDADE_CPF",
    message: "CPF já existe cadastrado para outro paciente (verifique possível duplicidade).",
    details: {
      cpf: _cpfFormat_(cpfDigits),
      matches: matches
    }
  }];
}

/**
 * Gera um ID_Paciente único e estável.
 * "PAC-<timestamp>-<random>"
 */
function gerarIdPaciente_() {
  var prefix = 'PAC-';
  var now = new Date().getTime();
  var rand = Math.floor(Math.random() * 1000); // 0–999
  var randStr = ('000' + rand).slice(-3);
  return prefix + now + '-' + randStr;
}

/** Converte célula data -> yyyy-MM-dd se possível */
function _readDateYMD_(cell) {
  if (cell instanceof Date) return _formatDateYMD_(cell);
  var s = _toText_(cell);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  var m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return m[3] + '-' + m[2] + '-' + m[1];
  return s;
}

/** Converte célula data/hora -> yyyy-MM-dd HH:mm:ss se possível */
function _readDateTime_(cell) {
  if (cell instanceof Date) return _formatDateTime_(cell);
  return _toText_(cell);
}

/** status -> ativo(boolean) */
function _statusToAtivo_(status) {
  var st = String(status || '').trim().toUpperCase();
  if (!st) return true;
  return !(st === 'INATIVO' || st === 'OBITO');
}

/** ativo/status -> status final */
function _ativoToStatus_(ativo, currentStatus) {
  if (currentStatus) return String(currentStatus).trim().toUpperCase();
  if (ativo === undefined || ativo === null) return 'ATIVO';
  return (!!ativo) ? 'ATIVO' : 'INATIVO';
}
