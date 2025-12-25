/**
 * PRONTIO - Módulo de Configuração da Agenda / Sistema
 *
 * Aba esperada: "AgendaConfig"
 *
 * Colunas (linha 1):
 *  Chave | Valor
 *
 * Chaves utilizadas na planilha:
 *  - MEDICO_NOME_COMPLETO
 *  - MEDICO_CRM
 *  - MEDICO_ESPECIALIDADE
 *
 *  - CLINICA_NOME
 *  - CLINICA_ENDERECO
 *  - CLINICA_TELEFONE
 *  - CLINICA_EMAIL
 *
 *  - LOGO_URL
 *
 *  - HORA_INICIO_PADRAO      (ex.: "08:00")
 *  - HORA_FIM_PADRAO         (ex.: "18:00")
 *  - DURACAO_GRADE_MINUTOS   (ex.: "15")
 *  - DIAS_ATIVOS             (ex.: "SEG,TER,QUA,QUI,SEX")
 *
 * IMPORTANTE (contrato com o FRONT):
 *
 *  O FRONT trabalha com JSON assim:
 *
 *  AgendaConfig_Obter → retorna:
 *  {
 *    medicoNomeCompleto: "...",
 *    medicoCRM: "...",
 *    medicoEspecialidade: "...",
 *    clinicaNome: "...",
 *    clinicaEndereco: "...",
 *    clinicaTelefone: "...",
 *    clinicaEmail: "...",
 *    logoUrl: "...",
 *    hora_inicio_padrao: "08:00",
 *    hora_fim_padrao: "18:00",
 *    duracao_grade_minutos: 15,
 *    dias_ativos: ["SEG","TER","QUA","QUI","SEX"]
 *  }
 *
 *  AgendaConfig_Salvar ← recebe payload:
 *  {
 *    medicoNomeCompleto,
 *    medicoCRM,
 *    medicoEspecialidade,
 *    clinicaNome,
 *    clinicaEndereco,
 *    clinicaTelefone,
 *    clinicaEmail,
 *    logoUrl,
 *    hora_inicio_padrao,
 *    hora_fim_padrao,
 *    duracao_grade_minutos,
 *    dias_ativos: ["SEG","TER",...]
 *  }
 *
 *  Ou seja:
 *   - Planilha usa CHAVES em MAIÚSCULAS
 *   - JSON para o front usa nomes camelCase
 *   - dias_ativos é SEMPRE ARRAY no JSON
 *
 * Ajuste retrocompatível:
 * - Substitui "throw { ... }" por Error com err.code/err.details.
 */

var AGENDA_CONFIG_SHEET_NAME = 'AgendaConfig';

/**
 * Roteador interno da AgendaConfig.
 * Chamado via Registry:
 * - AgendaConfig_Obter
 * - AgendaConfig_Salvar
 */
function handleAgendaConfigAction(action, payload) {
  switch (action) {
    case 'AgendaConfig_Obter':
      return agendaConfigObter_();

    case 'AgendaConfig_Salvar':
      return agendaConfigSalvar_(payload);

    default:
      var err = new Error('Ação de configuração de agenda desconhecida: ' + action);
      err.code = 'AGENDA_CONFIG_UNKNOWN_ACTION';
      err.details = { action: String(action || '') };
      throw err;
  }
}

function agendaConfigObter_() {
  var defaults = {
    medicoNomeCompleto: '',
    medicoCRM: '',
    medicoEspecialidade: '',
    clinicaNome: '',
    clinicaEndereco: '',
    clinicaTelefone: '',
    clinicaEmail: '',
    logoUrl: '',
    hora_inicio_padrao: '08:00',
    hora_fim_padrao: '18:00',
    duracao_grade_minutos: 15,
    dias_ativos: ['SEG', 'TER', 'QUA', 'QUI', 'SEX']
  };

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(AGENDA_CONFIG_SHEET_NAME);
  if (!sheet) {
    return defaults;
  }

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return defaults;
  }

  var range = sheet.getRange(2, 1, lastRow - 1, 2); // Chave/Valor
  var values = range.getValues();

  var map = {};
  for (var i = 0; i < values.length; i++) {
    var chave = String(values[i][0] || '').trim();
    var valor = values[i][1];
    if (!chave) continue;
    map[chave] = valor;
  }

  // DIAS_ATIVOS na planilha é string: "SEG,TER,QUA,QUI,SEX"
  var diasAtivosRaw = String(map.DIAS_ATIVOS || '').trim();
  var diasAtivosArr;
  if (diasAtivosRaw) {
    diasAtivosArr = diasAtivosRaw
      .split(',')
      .map(function (s) { return String(s || '').trim(); })
      .filter(function (s) { return s; });
  } else {
    diasAtivosArr = defaults.dias_ativos.slice();
  }

  var duracao = parseInt(
    map.DURACAO_GRADE_MINUTOS || defaults.duracao_grade_minutos,
    10
  );
  if (isNaN(duracao) || duracao <= 0) {
    duracao = defaults.duracao_grade_minutos;
  }

  var cfg = {
    medicoNomeCompleto: String(map.MEDICO_NOME_COMPLETO || defaults.medicoNomeCompleto),
    medicoCRM: String(map.MEDICO_CRM || defaults.medicoCRM),
    medicoEspecialidade: String(map.MEDICO_ESPECIALIDADE || defaults.medicoEspecialidade),

    clinicaNome: String(map.CLINICA_NOME || defaults.clinicaNome),
    clinicaEndereco: String(map.CLINICA_ENDERECO || defaults.clinicaEndereco),
    clinicaTelefone: String(map.CLINICA_TELEFONE || defaults.clinicaTelefone),
    clinicaEmail: String(map.CLINICA_EMAIL || defaults.clinicaEmail),

    logoUrl: String(map.LOGO_URL || defaults.logoUrl),

    hora_inicio_padrao: String(map.HORA_INICIO_PADRAO || defaults.hora_inicio_padrao),
    hora_fim_padrao: String(map.HORA_FIM_PADRAO || defaults.hora_fim_padrao),
    duracao_grade_minutos: duracao,
    dias_ativos: diasAtivosArr
  };

  return cfg;
}

function agendaConfigSalvar_(payload) {
  payload = payload || {};

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(AGENDA_CONFIG_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(AGENDA_CONFIG_SHEET_NAME);
    sheet.getRange(1, 1, 1, 2).setValues([['Chave', 'Valor']]);
  }

  var lastRow = sheet.getLastRow();
  if (lastRow < 1) {
    sheet.getRange(1, 1, 1, 2).setValues([['Chave', 'Valor']]);
    lastRow = 1;
  }

  var dataRange = sheet.getRange(2, 1, Math.max(lastRow - 1, 1), 2);
  var values = dataRange.getValues();

  // Mapa de chave -> linha
  var rowByKey = {};
  for (var i = 0; i < values.length; i++) {
    var chave = String(values[i][0] || '').trim();
    if (!chave) continue;
    rowByKey[chave] = i + 2; // linha real
  }

  function upsert(key, value) {
    if (typeof value === 'undefined') return;

    var rowIndex = rowByKey[key];
    if (rowIndex) {
      sheet.getRange(rowIndex, 2).setValue(value);
    } else {
      var newRow = sheet.getLastRow() + 1;
      sheet.getRange(newRow, 1, 1, 2).setValues([[key, value]]);
      rowByKey[key] = newRow;
    }
  }

  // Mapeia JSON camelCase → chaves da planilha
  upsert('MEDICO_NOME_COMPLETO', payload.medicoNomeCompleto);
  upsert('MEDICO_CRM', payload.medicoCRM);
  upsert('MEDICO_ESPECIALIDADE', payload.medicoEspecialidade);

  upsert('CLINICA_NOME', payload.clinicaNome);
  upsert('CLINICA_ENDERECO', payload.clinicaEndereco);
  upsert('CLINICA_TELEFONE', payload.clinicaTelefone);
  upsert('CLINICA_EMAIL', payload.clinicaEmail);

  upsert('LOGO_URL', payload.logoUrl);

  upsert('HORA_INICIO_PADRAO', payload.hora_inicio_padrao);
  upsert('HORA_FIM_PADRAO', payload.hora_fim_padrao);
  upsert('DURACAO_GRADE_MINUTOS', payload.duracao_grade_minutos);

  // dias_ativos: no JSON é array; na planilha é string "SEG,TER,QUA,..."
  var diasAtivosValue = '';
  if (Array.isArray(payload.dias_ativos)) {
    diasAtivosValue = payload.dias_ativos.join(',');
  } else if (typeof payload.dias_ativos === 'string') {
    diasAtivosValue = payload.dias_ativos;
  }
  upsert('DIAS_ATIVOS', diasAtivosValue);

  // Retorna novamente a configuração consolidada (já normalizada)
  var cfg = agendaConfigObter_();
  return cfg;
}
