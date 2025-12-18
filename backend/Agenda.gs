/**
 * PRONTIO - Módulo de Agenda
 *
 * Colunas esperadas na aba "Agenda" (linha 1):
 *
 * ID_Agenda | Data | Hora_Inicio | Hora_Fim | Duracao_Minutos | ID_Paciente | Nome_Paciente |
 * Documento_Paciente | Telefone_Paciente | Tipo | Motivo | Status | Origem | Canal |
 * ID_Sala | Profissional | Bloqueio | Descricao_Bloqueio | Permite_Encaixe | Created_At | Updated_At
 */

var AGENDA_SHEET_NAME = 'Agenda';

// Mapeamento de colunas (1-based index)
var AGENDA_COLS = {
  ID_Agenda: 1,
  Data: 2,
  Hora_Inicio: 3,
  Hora_Fim: 4,
  Duracao_Minutos: 5,
  ID_Paciente: 6,
  Nome_Paciente: 7,
  Documento_Paciente: 8,
  Telefone_Paciente: 9,
  Tipo: 10,
  Motivo: 11,
  Status: 12,
  Origem: 13,
  Canal: 14,
  ID_Sala: 15,
  Profissional: 16,
  Bloqueio: 17,
  Descricao_Bloqueio: 18,
  Permite_Encaixe: 19,
  Created_At: 20,
  Updated_At: 21
};

var AGENDA_EXPECTED_COLS_COUNT = 21;

/**
 * Normaliza e padroniza status (evita variações: "confirmada", "concluido", etc.)
 * Retorna sempre um status de um conjunto controlado.
 */
function normalizeAgendaStatus_(status, isBloqueio) {
  if (isBloqueio) return 'Bloqueado';

  var s = String(status || '').trim();
  if (!s) return 'Agendado';

  // remove acentos
  try {
    s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  } catch (e) {}

  var low = s.toLowerCase();

  if (low.indexOf('bloque') !== -1) return 'Bloqueado';
  if (low.indexOf('confirm') !== -1) return 'Confirmado';
  if (low.indexOf('atend') !== -1) return 'Em atendimento';
  if (low.indexOf('conclu') !== -1) return 'Concluído';
  if (low.indexOf('falt') !== -1) return 'Faltou';
  if (low.indexOf('cancel') !== -1) return 'Cancelado';
  if (low.indexOf('agend') !== -1) return 'Agendado';

  // fallback seguro
  return 'Agendado';
}

/**
 * Roteador interno da Agenda.
 *
 * Chamado a partir de Api.gs -> handleAgendaAction(action, payload)
 */
function handleAgendaAction(action, payload) {
  // Compatibilidade com formato "Agenda.AlgumaCoisa"
  if (action === 'Agenda.ListarAFuturo') {
    action = 'Agenda_ListarAFuturo';
  }

  switch (action) {
    case 'Agenda_ListarDia':
      return agendaListarDia_(payload);

    case 'Agenda_ListarSemana':
      return agendaListarSemana_(payload);

    case 'Agenda_ListarAFuturo':
      return agendaListarAFuturo_(payload);

    case 'Agenda_Criar':
      return agendaCriar_(payload);

    case 'Agenda_Atualizar':
      return agendaAtualizar_(payload);

    case 'Agenda_MudarStatus':
      return agendaMudarStatus_(payload);

    case 'Agenda_BloquearHorario':
      return agendaBloquearHorario_(payload);

    case 'Agenda_RemoverBloqueio':
      return agendaRemoverBloqueio_(payload);

    // ✅ útil pro front validar antes de salvar
    case 'Agenda_ValidarConflito':
      if (typeof Agenda_Action_ValidarConflito !== 'function') {
        throw {
          code: 'AGENDA_CONFLITOS_MODULE_MISSING',
          message: 'AgendaConflitos.gs não está disponível (Agenda_Action_ValidarConflito não encontrado).'
        };
      }
      return Agenda_Action_ValidarConflito(payload);

    default:
      throw {
        code: 'AGENDA_UNKNOWN_ACTION',
        message: 'Ação de agenda desconhecida: ' + action
      };
  }
}

/**
 * Obtém a planilha da Agenda.
 */
function getAgendaSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(AGENDA_SHEET_NAME);
  if (!sheet) {
    throw {
      code: 'AGENDA_SHEET_NOT_FOUND',
      message: 'Aba "Agenda" não encontrada na planilha.'
    };
  }
  return sheet;
}

/**
 * Garante que um array de linha tenha exatamente AGENDA_EXPECTED_COLS_COUNT colunas.
 */
function ensureRowWidth_(row) {
  var out = row ? row.slice() : [];
  for (var i = 0; i < AGENDA_EXPECTED_COLS_COUNT; i++) {
    if (typeof out[i] === 'undefined') out[i] = '';
  }
  if (out.length > AGENDA_EXPECTED_COLS_COUNT) out = out.slice(0, AGENDA_EXPECTED_COLS_COUNT);
  return out;
}

/**
 * Localiza a linha (rowIndex) na planilha pelo ID_Agenda e retorna { rowIndex, rowValues }.
 */
function findAgendaRowById_(sheet, idAgenda) {
  var id = String(idAgenda || '');
  if (!id) return null;

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  var idCol = AGENDA_COLS.ID_Agenda;
  var valuesIds = sheet.getRange(2, idCol, lastRow - 1, 1).getValues();

  for (var i = 0; i < valuesIds.length; i++) {
    var cellValue = String(valuesIds[i][0] || '');
    if (cellValue === id) {
      var rowIndex = i + 2;
      var rowValues = sheet.getRange(rowIndex, 1, 1, AGENDA_EXPECTED_COLS_COUNT).getValues()[0];
      return { rowIndex: rowIndex, rowValues: rowValues };
    }
  }

  return null;
}

/**
 * ✅ INTEGRAÇÃO COM AgendaConflitos.gs
 */
function Agenda_ListarEventosDiaParaValidacao_(dataStr) {
  dataStr = String(dataStr || '');
  if (!dataStr) return [];

  var sheet = getAgendaSheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  var values = sheet.getRange(2, 1, lastRow - 1, AGENDA_EXPECTED_COLS_COUNT).getValues();
  var eventos = [];

  for (var i = 0; i < values.length; i++) {
    var row = values[i];

    var dataCell = row[AGENDA_COLS.Data - 1];
    var dataCellStr =
      dataCell instanceof Date
        ? Utilities.formatDate(dataCell, Session.getScriptTimeZone(), 'yyyy-MM-dd')
        : String(dataCell || '');

    if (dataCellStr !== dataStr) continue;

    eventos.push({
      ID_Agenda: String(row[AGENDA_COLS.ID_Agenda - 1] || ''),
      data: dataCellStr,
      hora_inicio: formatTimeString_(row[AGENDA_COLS.Hora_Inicio - 1]),
      hora_fim: formatTimeString_(row[AGENDA_COLS.Hora_Fim - 1]),
      duracao_minutos: Number(row[AGENDA_COLS.Duracao_Minutos - 1] || 0),
      bloqueio: row[AGENDA_COLS.Bloqueio - 1] === true,
      status: String(row[AGENDA_COLS.Status - 1] || ''),
      permite_encaixe: row[AGENDA_COLS.Permite_Encaixe - 1] === true
    });
  }

  return eventos;
}

/**
 * Cria um novo agendamento (consulta normal).
 */
function agendaCriar_(payload) {
  if (!payload || !payload.data) {
    throw { code: 'AGENDA_MISSING_DATA', message: 'Campo "data" é obrigatório.' };
  }
  if (!payload.hora_inicio) {
    throw { code: 'AGENDA_MISSING_HORA_INICIO', message: 'Campo "hora_inicio" é obrigatório.' };
  }

  var duracaoMin = payload.duracao_minutos || 15;
  var horaFim = addMinutesToTime_(payload.hora_inicio, duracaoMin);
  var permiteEncaixe = payload.permite_encaixe === true;

  var sheet = getAgendaSheet_();

  // 🔒 lock para evitar colisão de ID em concorrência
  var lock = LockService.getDocumentLock();
  lock.waitLock(15000);

  try {
    if (typeof Agenda_AssertSemConflitos_ === 'function') {
      Agenda_AssertSemConflitosComPolitica_(
        {
          data: payload.data,
          inicio: payload.hora_inicio,
          duracaoMin: duracaoMin,
          ignoreIdAgenda: ''
        },
        {
          permitirEncaixe: permiteEncaixe
        }
      );
    } else {
      verificarConflitoBloqueio_(sheet, payload.data, payload.hora_inicio, horaFim, null);
      verificarConflitoConsulta_(sheet, payload.data, payload.hora_inicio, horaFim, permiteEncaixe, null);
    }

    var idAgenda = generateAgendaId_(payload.data, sheet);
    var now = new Date();

    var rowValues = [];
    rowValues[AGENDA_COLS.ID_Agenda - 1] = idAgenda;
    rowValues[AGENDA_COLS.Data - 1] = payload.data;
    rowValues[AGENDA_COLS.Hora_Inicio - 1] = payload.hora_inicio;
    rowValues[AGENDA_COLS.Hora_Fim - 1] = horaFim;
    rowValues[AGENDA_COLS.Duracao_Minutos - 1] = duracaoMin;
    rowValues[AGENDA_COLS.ID_Paciente - 1] = payload.ID_Paciente || '';
    rowValues[AGENDA_COLS.Nome_Paciente - 1] = payload.nome_paciente || '';
    rowValues[AGENDA_COLS.Documento_Paciente - 1] = payload.documento_paciente || '';
    rowValues[AGENDA_COLS.Telefone_Paciente - 1] = payload.telefone_paciente || '';
    rowValues[AGENDA_COLS.Tipo - 1] = payload.tipo || '';
    rowValues[AGENDA_COLS.Motivo - 1] = payload.motivo || '';

    // ✅ status normalizado
    rowValues[AGENDA_COLS.Status - 1] = normalizeAgendaStatus_(payload.status || 'Agendado', false);

    rowValues[AGENDA_COLS.Origem - 1] = payload.origem || '';
    rowValues[AGENDA_COLS.Canal - 1] = payload.canal || '';
    rowValues[AGENDA_COLS.ID_Sala - 1] = payload.ID_Sala || '';
    rowValues[AGENDA_COLS.Profissional - 1] = payload.profissional || '';
    rowValues[AGENDA_COLS.Bloqueio - 1] = false;
    rowValues[AGENDA_COLS.Descricao_Bloqueio - 1] = '';
    rowValues[AGENDA_COLS.Permite_Encaixe - 1] = permiteEncaixe;
    rowValues[AGENDA_COLS.Created_At - 1] = now;
    rowValues[AGENDA_COLS.Updated_At - 1] = now;

    rowValues = ensureRowWidth_(rowValues);

    var nextRow = sheet.getLastRow() + 1;
    sheet.getRange(nextRow, 1, 1, AGENDA_EXPECTED_COLS_COUNT).setValues([rowValues]);

    return agendaRowToObject_(rowValues);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Atualiza um agendamento existente.
 */
function agendaAtualizar_(payload) {
  var id = payload && payload.ID_Agenda ? String(payload.ID_Agenda) : '';
  if (!id) {
    throw {
      code: 'AGENDA_MISSING_ID_AGENDA',
      message: 'Campo "ID_Agenda" é obrigatório para atualizar agendamento.'
    };
  }

  var sheet = getAgendaSheet_();

  var found = findAgendaRowById_(sheet, id);
  if (!found) {
    throw { code: 'AGENDA_ID_NOT_FOUND', message: 'Agendamento não encontrado para ID_Agenda: ' + id };
  }

  var rowIndex = found.rowIndex;
  var row = ensureRowWidth_(found.rowValues);

  // Valores atuais
  var dataAtual = row[AGENDA_COLS.Data - 1];
  var horaInicioAtual = row[AGENDA_COLS.Hora_Inicio - 1];
  var duracaoAtual = Number(row[AGENDA_COLS.Duracao_Minutos - 1] || 0);
  var permiteEncaixeAtual = row[AGENDA_COLS.Permite_Encaixe - 1] === true;

  var dataStrAtual =
    dataAtual instanceof Date
      ? Utilities.formatDate(dataAtual, Session.getScriptTimeZone(), 'yyyy-MM-dd')
      : String(dataAtual || '');

  // Novos valores (usando o atual como padrão)
  var novaData = payload.data || dataStrAtual;
  var novaHoraInicio = payload.hora_inicio || formatTimeString_(horaInicioAtual || '00:00');
  var novaDuracao = payload.duracao_minutos ? Number(payload.duracao_minutos) : duracaoAtual || 15;
  var novaHoraFim = addMinutesToTime_(novaHoraInicio, novaDuracao);

  var novoPermiteEncaixe =
    typeof payload.permite_encaixe !== 'undefined'
      ? payload.permite_encaixe === true
      : permiteEncaixeAtual;

  // ✅ validação de conflito (ignora o próprio ID)
  if (typeof Agenda_AssertSemConflitos_ === 'function') {
    Agenda_AssertSemConflitosComPolitica_(
      {
        data: novaData,
        inicio: novaHoraInicio,
        duracaoMin: novaDuracao,
        ignoreIdAgenda: id
      },
      {
        permitirEncaixe: novoPermiteEncaixe
      }
    );
  } else {
    verificarConflitoBloqueio_(sheet, novaData, novaHoraInicio, novaHoraFim, id);
    verificarConflitoConsulta_(sheet, novaData, novaHoraInicio, novaHoraFim, novoPermiteEncaixe, id);
  }

  function set(colName, value) {
    row[AGENDA_COLS[colName] - 1] = value;
  }

  // Data / hora / duração
  set('Data', novaData);
  set('Hora_Inicio', novaHoraInicio);
  set('Hora_Fim', novaHoraFim);
  set('Duracao_Minutos', novaDuracao);

  // Atualização de paciente (opcional)
  if (typeof payload.ID_Paciente !== 'undefined') {
    set('ID_Paciente', payload.ID_Paciente || '');
    set('Nome_Paciente', payload.nome_paciente || '');
    set('Documento_Paciente', payload.documento_paciente || '');
    set('Telefone_Paciente', payload.telefone_paciente || '');
  }

  // Campos opcionais de edição simples
  if (typeof payload.tipo !== 'undefined') set('Tipo', payload.tipo || '');
  if (typeof payload.motivo !== 'undefined') set('Motivo', payload.motivo || '');
  if (typeof payload.origem !== 'undefined') set('Origem', payload.origem || '');
  if (typeof payload.canal !== 'undefined') set('Canal', payload.canal || '');
  if (typeof payload.ID_Sala !== 'undefined') set('ID_Sala', payload.ID_Sala || '');
  if (typeof payload.profissional !== 'undefined') set('Profissional', payload.profissional || '');
  if (typeof payload.permite_encaixe !== 'undefined') set('Permite_Encaixe', novoPermiteEncaixe);

  // ✅ status normalizado se vier no payload (opcional)
  if (typeof payload.status !== 'undefined') set('Status', normalizeAgendaStatus_(payload.status, false));

  set('Updated_At', new Date());

  sheet.getRange(rowIndex, 1, 1, AGENDA_EXPECTED_COLS_COUNT).setValues([ensureRowWidth_(row)]);
  return agendaRowToObject_(row);
}

/**
 * Cria um BLOQUEIO de horário.
 */
function agendaBloquearHorario_(payload) {
  if (!payload || !payload.data) {
    throw { code: 'AGENDA_BLOQ_MISSING_DATA', message: 'Campo "data" é obrigatório para bloquear horário.' };
  }
  if (!payload.hora_inicio) {
    throw { code: 'AGENDA_BLOQ_MISSING_HORA_INICIO', message: 'Campo "hora_inicio" é obrigatório para bloquear horário.' };
  }

  var duracaoMin = payload.duracao_minutos || 60;
  var horaFim = addMinutesToTime_(payload.hora_inicio, duracaoMin);

  var sheet = getAgendaSheet_();

  // 🔒 lock para evitar colisão de ID em concorrência
  var lock = LockService.getDocumentLock();
  lock.waitLock(15000);

  try {
    // ✅ bloqueio NUNCA pode sobrepor nada
    if (typeof Agenda_AssertSemConflitos_ === 'function') {
      Agenda_AssertSemConflitosComPolitica_(
        {
          data: payload.data,
          inicio: payload.hora_inicio,
          duracaoMin: duracaoMin,
          ignoreIdAgenda: ''
        },
        {
          modoBloqueio: true
        }
      );
    } else {
      verificarConflitoConsulta_(sheet, payload.data, payload.hora_inicio, horaFim, false, null);
      verificarConflitoBloqueio_(sheet, payload.data, payload.hora_inicio, horaFim, null);
    }

    var idAgenda = generateAgendaId_(payload.data, sheet);
    var now = new Date();

    var rowValues = [];
    rowValues[AGENDA_COLS.ID_Agenda - 1] = idAgenda;
    rowValues[AGENDA_COLS.Data - 1] = payload.data;
    rowValues[AGENDA_COLS.Hora_Inicio - 1] = payload.hora_inicio;
    rowValues[AGENDA_COLS.Hora_Fim - 1] = horaFim;
    rowValues[AGENDA_COLS.Duracao_Minutos - 1] = duracaoMin;
    rowValues[AGENDA_COLS.ID_Paciente - 1] = '';
    rowValues[AGENDA_COLS.Nome_Paciente - 1] = '';
    rowValues[AGENDA_COLS.Documento_Paciente - 1] = '';
    rowValues[AGENDA_COLS.Telefone_Paciente - 1] = '';
    rowValues[AGENDA_COLS.Tipo - 1] = '';
    rowValues[AGENDA_COLS.Motivo - 1] = '';

    // ✅ status normalizado (bloqueio)
    rowValues[AGENDA_COLS.Status - 1] = normalizeAgendaStatus_('Bloqueado', true);

    rowValues[AGENDA_COLS.Origem - 1] = '';
    rowValues[AGENDA_COLS.Canal - 1] = '';
    rowValues[AGENDA_COLS.ID_Sala - 1] = '';
    rowValues[AGENDA_COLS.Profissional - 1] = '';
    rowValues[AGENDA_COLS.Bloqueio - 1] = true;
    rowValues[AGENDA_COLS.Descricao_Bloqueio - 1] = payload.descricao_bloqueio || '';
    rowValues[AGENDA_COLS.Permite_Encaixe - 1] = false;
    rowValues[AGENDA_COLS.Created_At - 1] = now;
    rowValues[AGENDA_COLS.Updated_At - 1] = now;

    rowValues = ensureRowWidth_(rowValues);

    var nextRow = sheet.getLastRow() + 1;
    sheet.getRange(nextRow, 1, 1, AGENDA_EXPECTED_COLS_COUNT).setValues([rowValues]);

    return agendaRowToObject_(rowValues);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Remove um registro de BLOQUEIO (apaga a linha).
 */
function agendaRemoverBloqueio_(payload) {
  var id = payload && payload.ID_Agenda ? String(payload.ID_Agenda) : '';
  if (!id) {
    throw { code: 'AGENDA_REM_BLOQ_MISSING_ID', message: 'Campo "ID_Agenda" é obrigatório para remover bloqueio.' };
  }

  var sheet = getAgendaSheet_();

  var found = findAgendaRowById_(sheet, id);
  if (!found) {
    throw { code: 'AGENDA_ID_NOT_FOUND', message: 'Registro não encontrado para ID_Agenda: ' + id };
  }

  var rowIndex = found.rowIndex;

  var isBloqueio = sheet.getRange(rowIndex, AGENDA_COLS.Bloqueio).getValue() === true;
  if (!isBloqueio) {
    throw { code: 'AGENDA_NOT_BLOQUEIO', message: 'Registro com este ID não é um bloqueio de horário.' };
  }

  sheet.deleteRow(rowIndex);
  return { ID_Agenda: id, removed: true };
}

/**
 * Lista os agendamentos de um determinado dia.
 */
function agendaListarDia_(payload) {
  if (!payload || !payload.data) {
    throw { code: 'AGENDA_MISSING_DATA', message: 'Campo "data" é obrigatório para listar o dia.' };
  }

  var dataAlvo = String(payload.data);
  var sheet = getAgendaSheet_();
  var lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return {
      horarios: [],
      resumo: { total: 0, confirmados: 0, faltas: 0, cancelados: 0, concluidos: 0, em_atendimento: 0 }
    };
  }

  var values = sheet.getRange(2, 1, lastRow - 1, AGENDA_EXPECTED_COLS_COUNT).getValues();

  var horariosMap = {};
  var resumo = { total: 0, confirmados: 0, faltas: 0, cancelados: 0, concluidos: 0, em_atendimento: 0 };

  for (var i = 0; i < values.length; i++) {
    var row = ensureRowWidth_(values[i]);
    var rowData = agendaRowToObject_(row);

    if (rowData.data !== dataAlvo) continue;

    if (!rowData.bloqueio) {
      resumo.total++;

      var status = (rowData.status || '').toLowerCase();
      if (status === 'confirmado' || status === 'confirmada') resumo.confirmados++;
      else if (status === 'faltou' || status === 'falta') resumo.faltas++;
      else if (status === 'cancelado' || status === 'cancelada') resumo.cancelados++;
      else if (status.indexOf('conclu') !== -1) resumo.concluidos++;

      if (status.indexOf('atendimento') !== -1) resumo.em_atendimento++;
    }

    var hora = rowData.hora_inicio || '00:00';
    if (!horariosMap[hora]) horariosMap[hora] = [];
    horariosMap[hora].push(rowData);
  }

  var horas = Object.keys(horariosMap);
  horas.sort(compareTimeStrings_);

  var horariosArray = horas.map(function (hora) {
    return { hora: hora, agendamentos: horariosMap[hora] };
  });

  return { horarios: horariosArray, resumo: resumo };
}

/**
 * Lista a semana (segunda a sábado) contendo a data de referência.
 */
function agendaListarSemana_(payload) {
  var dataRef = payload && payload.data_referencia ? String(payload.data_referencia) : '';
  if (!dataRef) {
    throw { code: 'AGENDA_MISSING_DATA_REFERENCIA', message: 'Campo "data_referencia" é obrigatório para listar a semana.' };
  }

  var parts = dataRef.split('-');
  if (parts.length !== 3) {
    throw { code: 'AGENDA_DATA_REFERENCIA_INVALIDA', message: 'data_referencia inválida (use formato YYYY-MM-DD).' };
  }

  var ano = parseInt(parts[0], 10);
  var mes = parseInt(parts[1], 10) - 1;
  var dia = parseInt(parts[2], 10);
  var refDate = new Date(ano, mes, dia);

  // Semana de segunda (1) a sábado (6)
  var jsDay = refDate.getDay(); // 0=domingo, 1=segunda...
  var offset = (jsDay + 6) % 7; // transforma segunda em 0
  var monday = new Date(refDate);
  monday.setDate(refDate.getDate() - offset);

  var dias = [];

  // segunda a sábado = 6 dias (0..5)
  for (var i = 0; i < 6; i++) {
    var d = new Date(monday);
    d.setDate(monday.getDate() + i);

    var dStr = formatDateToInput_(d);
    var diaData = agendaListarDia_({ data: dStr });

    dias.push({
      data: dStr,
      horarios: diaData.horarios,
      resumo: diaData.resumo
    });
  }

  return { dias: dias };
}

/**
 * Lista todos os agendamentos (não bloqueio) do dia de hoje para frente.
 */
function agendaListarAFuturo_(payload) {
  var sheet = getAgendaSheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return { agendamentos: [] };

  var today = new Date();
  var todayStr = formatDateToInput_(today);

  var values = sheet.getRange(2, 1, lastRow - 1, AGENDA_EXPECTED_COLS_COUNT).getValues();
  var agendamentos = [];

  for (var i = 0; i < values.length; i++) {
    var row = ensureRowWidth_(values[i]);
    var obj = agendaRowToObject_(row);

    if (obj.bloqueio) continue;
    var dataStr = obj.data || '';
    if (!dataStr || dataStr < todayStr) continue;

    agendamentos.push({
      dataConsulta: obj.data,
      horaConsulta: obj.hora_inicio,
      nomePaciente: obj.nome_paciente,
      tipo: obj.tipo,
      status: obj.status
    });
  }

  agendamentos.sort(function (a, b) {
    var da = a.dataConsulta || '';
    var db = b.dataConsulta || '';
    if (da < db) return -1;
    if (da > db) return 1;
    return compareTimeStrings_(a.horaConsulta || '00:00', b.horaConsulta || '00:00');
  });

  return { agendamentos: agendamentos };
}

/**
 * Muda apenas o status de um agendamento.
 */
function agendaMudarStatus_(payload) {
  var id = payload && payload.ID_Agenda ? String(payload.ID_Agenda) : '';
  var novoStatus = payload && payload.novo_status ? String(payload.novo_status) : '';

  if (!id) throw { code: 'AGENDA_MISSING_ID_AGENDA', message: 'Campo "ID_Agenda" é obrigatório para mudar status.' };
  if (!novoStatus) throw { code: 'AGENDA_MISSING_NOVO_STATUS', message: 'Campo "novo_status" é obrigatório.' };

  var sheet = getAgendaSheet_();

  var found = findAgendaRowById_(sheet, id);
  if (!found) {
    throw { code: 'AGENDA_ID_NOT_FOUND', message: 'Agendamento não encontrado para ID_Agenda: ' + id };
  }

  var rowIndex = found.rowIndex;

  // se for bloqueio, força Bloqueado
  var isBloqueio = sheet.getRange(rowIndex, AGENDA_COLS.Bloqueio).getValue() === true;
  var statusFinal = normalizeAgendaStatus_(novoStatus, isBloqueio);

  var now = new Date();
  sheet.getRange(rowIndex, AGENDA_COLS.Status).setValue(statusFinal);
  sheet.getRange(rowIndex, AGENDA_COLS.Updated_At).setValue(now);

  var rowValues = sheet.getRange(rowIndex, 1, 1, AGENDA_EXPECTED_COLS_COUNT).getValues()[0];
  return agendaRowToObject_(ensureRowWidth_(rowValues));
}

/* ============================================================
 * Validação de conflitos COM POLÍTICA do seu sistema
 * ============================================================ */
function Agenda_AssertSemConflitosComPolitica_(args, opts) {
  opts = opts || {};
  var permitirEncaixe = opts.permitirEncaixe === true;
  var modoBloqueio = opts.modoBloqueio === true;

  if (typeof Agenda_ValidarConflitos_ !== 'function') {
    throw {
      code: 'AGENDA_CONFLITOS_MODULE_MISSING',
      message: 'AgendaConflitos.gs não está disponível (Agenda_ValidarConflitos_ não encontrado).'
    };
  }

  var r = Agenda_ValidarConflitos_(args);
  if (r.ok) return r;

  if (modoBloqueio) {
    throw {
      code: 'AGENDA_CONFLITO_BLOQUEIO',
      message: 'Não é possível bloquear: existe agendamento/bloqueio no intervalo.',
      details: { conflitos: r.conflitos, intervalo: r.intervalo }
    };
  }

  var data = String(args.data || '');
  var eventosDia = Agenda_ListarEventosDiaParaValidacao_(data);

  var meta = {};
  for (var i = 0; i < eventosDia.length; i++) {
    meta[String(eventosDia[i].ID_Agenda || '')] = {
      bloqueio: !!eventosDia[i].bloqueio,
      status: String(eventosDia[i].status || '').toLowerCase()
    };
  }

  for (var c = 0; c < r.conflitos.length; c++) {
    var idc = String(r.conflitos[c].ID_Agenda || '');
    var m = meta[idc];
    if (m && m.bloqueio) {
      throw {
        code: 'AGENDA_CONFLITO_BLOQUEIO',
        message: 'Horário bloqueado neste intervalo.',
        details: { conflitos: r.conflitos, intervalo: r.intervalo }
      };
    }
  }

  if (permitirEncaixe) return r;

  for (var c2 = 0; c2 < r.conflitos.length; c2++) {
    var idc2 = String(r.conflitos[c2].ID_Agenda || '');
    var m2 = meta[idc2];
    if (!m2) continue;
    if (m2.bloqueio) continue;

    if (
      m2.status === 'cancelado' ||
      m2.status === 'cancelada' ||
      m2.status === 'falta' ||
      m2.status === 'faltou'
    ) {
      continue;
    }

    throw {
      code: 'AGENDA_CONFLITO_CONSULTA',
      message: 'Já existe consulta marcada neste horário.',
      details: { conflitos: r.conflitos, intervalo: r.intervalo }
    };
  }

  return r;
}

/* ============================================================
 * Fallback antigo (mantido)
 * ============================================================ */

function verificarConflitoBloqueio_(sheet, dataStr, horaInicioStr, horaFimStr, ignoreId) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  var values = sheet.getRange(2, 1, lastRow - 1, AGENDA_EXPECTED_COLS_COUNT).getValues();

  var novoInicio = convertTimeToMinutes_(horaInicioStr);
  var novoFim = convertTimeToMinutes_(horaFimStr);

  for (var i = 0; i < values.length; i++) {
    var row = values[i];

    var idRow = String(row[AGENDA_COLS.ID_Agenda - 1] || '');
    if (ignoreId && idRow === ignoreId) continue;

    var dataCell = row[AGENDA_COLS.Data - 1];
    var bloqueioFlag = row[AGENDA_COLS.Bloqueio - 1] === true;
    if (!bloqueioFlag) continue;

    var dataCellStr =
      dataCell instanceof Date
        ? Utilities.formatDate(dataCell, Session.getScriptTimeZone(), 'yyyy-MM-dd')
        : String(dataCell || '');

    if (dataCellStr !== dataStr) continue;

    var horaInicioBloq = row[AGENDA_COLS.Hora_Inicio - 1];
    var horaFimBloq = row[AGENDA_COLS.Hora_Fim - 1];

    var bloqInicio = convertTimeToMinutes_(horaInicioBloq);
    var bloqFim = convertTimeToMinutes_(horaFimBloq);

    var sobrepoe = novoInicio < bloqFim && novoFim > bloqInicio;

    if (sobrepoe) {
      throw {
        code: 'AGENDA_CONFLITO_BLOQUEIO',
        message: 'Horário bloqueado neste intervalo.',
        details: {
          hora_inicio: formatTimeString_(horaInicioBloq),
          hora_fim: formatTimeString_(horaFimBloq)
        }
      };
    }
  }
}

function verificarConflitoConsulta_(sheet, dataStr, horaInicioStr, horaFimStr, permiteEncaixe, ignoreId) {
  if (permiteEncaixe) return;

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  var values = sheet.getRange(2, 1, lastRow - 1, AGENDA_EXPECTED_COLS_COUNT).getValues();

  var novoInicio = convertTimeToMinutes_(horaInicioStr);
  var novoFim = convertTimeToMinutes_(horaFimStr);

  for (var i = 0; i < values.length; i++) {
    var row = values[i];

    var idRow = String(row[AGENDA_COLS.ID_Agenda - 1] || '');
    if (ignoreId && idRow === ignoreId) continue;

    var dataCell = row[AGENDA_COLS.Data - 1];
    var bloqueioFlag = row[AGENDA_COLS.Bloqueio - 1] === true;
    if (bloqueioFlag) continue;

    var dataCellStr =
      dataCell instanceof Date
        ? Utilities.formatDate(dataCell, Session.getScriptTimeZone(), 'yyyy-MM-dd')
        : String(dataCell || '');

    if (dataCellStr !== dataStr) continue;

    var status = String(row[AGENDA_COLS.Status - 1] || '').toLowerCase();
    if (status === 'cancelado' || status === 'cancelada' || status === 'falta' || status === 'faltou') continue;

    var horaInicioConsult = row[AGENDA_COLS.Hora_Inicio - 1];
    var horaFimConsult = row[AGENDA_COLS.Hora_Fim - 1];

    var consultInicio = convertTimeToMinutes_(horaInicioConsult);
    var consultFim = convertTimeToMinutes_(horaFimConsult);

    var sobrepoe = novoInicio < consultFim && novoFim > consultInicio;

    if (sobrepoe) {
      var nomePac = row[AGENDA_COLS.Nome_Paciente - 1] || '';
      throw {
        code: 'AGENDA_CONFLITO_CONSULTA',
        message: 'Já existe consulta marcada neste horário.',
        details: {
          hora_inicio: formatTimeString_(horaInicioConsult),
          hora_fim: formatTimeString_(horaFimConsult),
          nome_paciente: nomePac,
          status: row[AGENDA_COLS.Status - 1] || ''
        }
      };
    }
  }
}

/**
 * Converte "HH:MM" ou Date em minutos desde 00:00.
 */
function convertTimeToMinutes_(timeValue) {
  if (timeValue instanceof Date) {
    var h = timeValue.getHours();
    var m = timeValue.getMinutes();
    return h * 60 + m;
  }

  var str = String(timeValue || '00:00');
  var parts = str.split(':');
  var hour = parseInt(parts[0], 10) || 0;
  var min = parseInt(parts[1], 10) || 0;
  return hour * 60 + min;
}

/**
 * Garante string "HH:MM" mesmo se vier Date ou número.
 */
function formatTimeString_(value) {
  if (value instanceof Date) {
    var h = value.getHours();
    var m = value.getMinutes();
    return ('0' + h).slice(-2) + ':' + ('0' + m).slice(-2);
  }

  var str = String(value || '00:00');
  var parts = str.split(':');
  var hour = ('0' + (parseInt(parts[0], 10) || 0)).slice(-2);
  var min = ('0' + (parseInt(parts[1], 10) || 0)).slice(-2);
  return hour + ':' + min;
}

/**
 * Formata Date -> "YYYY-MM-DD".
 */
function formatDateToInput_(date) {
  var y = date.getFullYear();
  var m = ('0' + (date.getMonth() + 1)).slice(-2);
  var d = ('0' + date.getDate()).slice(-2);
  return y + '-' + m + '-' + d;
}

/**
 * Soma minutos em "HH:MM" e retorna "HH:MM".
 */
function addMinutesToTime_(horaInicioStr, minutesToAdd) {
  var baseMin = convertTimeToMinutes_(horaInicioStr);
  var add = parseInt(minutesToAdd || 0, 10) || 0;
  var total = baseMin + add;

  total = ((total % 1440) + 1440) % 1440;

  var hh = ('0' + Math.floor(total / 60)).slice(-2);
  var mm = ('0' + (total % 60)).slice(-2);
  return hh + ':' + mm;
}

/**
 * Converte uma linha da aba Agenda em objeto JS.
 */
function agendaRowToObject_(row) {
  row = ensureRowWidth_(row);

  function getRaw(colName) {
    var idx = AGENDA_COLS[colName] - 1;
    return row[idx];
  }

  var dataCell = getRaw('Data');
  var dataStr =
    dataCell instanceof Date
      ? Utilities.formatDate(dataCell, Session.getScriptTimeZone(), 'yyyy-MM-dd')
      : String(dataCell || '');

  var horaInicioCell = getRaw('Hora_Inicio');
  var horaFimCell = getRaw('Hora_Fim');

  var createdAtCell = getRaw('Created_At');
  var updatedAtCell = getRaw('Updated_At');

  return {
    ID_Agenda: String(getRaw('ID_Agenda') || ''),
    data: dataStr,
    hora_inicio: formatTimeString_(horaInicioCell),
    hora_fim: formatTimeString_(horaFimCell),
    duracao_minutos: Number(getRaw('Duracao_Minutos') || 0),

    ID_Paciente: String(getRaw('ID_Paciente') || ''),
    nome_paciente: String(getRaw('Nome_Paciente') || ''),
    documento_paciente: String(getRaw('Documento_Paciente') || ''),
    telefone_paciente: String(getRaw('Telefone_Paciente') || ''),

    tipo: String(getRaw('Tipo') || ''),
    motivo: String(getRaw('Motivo') || ''),
    status: String(getRaw('Status') || ''),
    origem: String(getRaw('Origem') || ''),
    canal: String(getRaw('Canal') || ''),

    ID_Sala: String(getRaw('ID_Sala') || ''),
    profissional: String(getRaw('Profissional') || ''),

    bloqueio: getRaw('Bloqueio') === true,
    descricao_bloqueio: String(getRaw('Descricao_Bloqueio') || ''),
    permite_encaixe: getRaw('Permite_Encaixe') === true,

    created_at: createdAtCell || '',
    updated_at: updatedAtCell || ''
  };
}

/**
 * Gera um ID único de agenda, por data.
 * Formato: "AGYYYYMMDD-0001"
 */
function generateAgendaId_(dataStr, sheet) {
  var yyyymmdd = String(dataStr).replace(/-/g, '');

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return 'AG' + yyyymmdd + '-0001';
  }

  var values = sheet.getRange(2, AGENDA_COLS.Data, lastRow - 1, 1).getValues();

  var countForDate = 0;
  for (var i = 0; i < values.length; i++) {
    var dataCell = values[i][0];
    var dataCellStr =
      dataCell instanceof Date
        ? Utilities.formatDate(dataCell, Session.getScriptTimeZone(), 'yyyy-MM-dd')
        : String(dataCell || '');
    if (dataCellStr === dataStr) {
      countForDate++;
    }
  }

  var seq = countForDate + 1;
  var seqStr = ('000' + seq).slice(-4);

  return 'AG' + yyyymmdd + '-' + seqStr;
}

/**
 * Compara duas strings "HH:MM" para ordenação.
 */
function compareTimeStrings_(a, b) {
  var pa = String(a || '00:00').split(':');
  var pb = String(b || '00:00').split(':');

  var ma = (parseInt(pa[0], 10) || 0) * 60 + (parseInt(pa[1], 10) || 0);
  var mb = (parseInt(pb[0], 10) || 0) * 60 + (parseInt(pb[1], 10) || 0);

  if (ma < mb) return -1;
  if (ma > mb) return 1;
  return 0;
}
