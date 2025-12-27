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
 * ✅ MATURAÇÃO (sem quebrar):
 * - Remove SpreadsheetApp direto: usa o DB do Repository (Repo_getDb_ / PRONTIO_getDb_).
 * - Garante header ["Chave","Valor"] mesmo sem MIGRATIONS_SHEETS para AgendaConfig.
 * - Mantém contrato e comportamento existentes.
 */

var AGENDA_CONFIG_SHEET_NAME = "AgendaConfig";

// Header esperado (backend-only)
var AGENDA_CONFIG_HEADER = ["Chave", "Valor"];

/**
 * Roteador interno da AgendaConfig.
 * Chamado via Registry:
 * - AgendaConfig_Obter
 * - AgendaConfig_Salvar
 */
function handleAgendaConfigAction(action, payload) {
  switch (action) {
    case "AgendaConfig_Obter":
      return agendaConfigObter_();

    case "AgendaConfig_Salvar":
      return agendaConfigSalvar_(payload);

    default:
      var err = new Error("Ação de configuração de agenda desconhecida: " + action);
      err.code = "AGENDA_CONFIG_UNKNOWN_ACTION";
      err.details = { action: String(action || "") };
      throw err;
  }
}

/**
 * Retorna o Spreadsheet (DEV/PROD) pelo Repository.
 * (Centraliza a seleção do banco e evita SpreadsheetApp direto.)
 */
function _agendaConfigGetDb_() {
  if (typeof Repo_getDb_ !== "function") {
    var e = new Error("AgendaConfig: Repo_getDb_ não disponível (Repository.gs não carregado?).");
    e.code = "INTERNAL_ERROR";
    e.details = { missing: "Repo_getDb_" };
    throw e;
  }
  return Repo_getDb_();
}

/**
 * Obtém/cria a aba e garante header "Chave|Valor".
 * Não depende de MIGRATIONS_SHEETS para esta aba (config key/value).
 */
function _agendaConfigGetSheet_() {
  var db = _agendaConfigGetDb_();

  var sheet = db.getSheetByName(AGENDA_CONFIG_SHEET_NAME);
  if (!sheet) {
    sheet = db.insertSheet(AGENDA_CONFIG_SHEET_NAME);
  }

  _agendaConfigEnsureHeader_(sheet);
  return sheet;
}

function _agendaConfigEnsureHeader_(sheet) {
  // Garante 2 colunas com header. Se vazio, cria. Se diferente, corrige.
  var lastCol = Math.max(2, sheet.getLastColumn() || 0);

  // lê linha 1 (no mínimo 2 cols)
  var row1 = sheet.getRange(1, 1, 1, Math.max(2, lastCol)).getValues()[0] || [];
  var h1 = String(row1[0] || "").trim();
  var h2 = String(row1[1] || "").trim();

  var isBlank = (!h1 && !h2);

  if (isBlank) {
    sheet.getRange(1, 1, 1, 2).setValues([AGENDA_CONFIG_HEADER]);
    return;
  }

  // Se tiver algo mas estiver diferente, reescreve as 2 primeiras colunas do header.
  if (h1 !== AGENDA_CONFIG_HEADER[0] || h2 !== AGENDA_CONFIG_HEADER[1]) {
    sheet.getRange(1, 1, 1, 2).setValues([AGENDA_CONFIG_HEADER]);
  }
}

/**
 * Lê mapa {CHAVE: valor} da aba.
 */
function _agendaConfigReadMap_() {
  var sheet = _agendaConfigGetSheet_();
  var lastRow = sheet.getLastRow();
  if (!lastRow || lastRow < 2) return {};

  var values = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
  var map = {};

  for (var i = 0; i < values.length; i++) {
    var chave = String(values[i][0] || "").trim();
    var valor = values[i][1];
    if (!chave) continue;
    map[chave] = valor;
  }

  return map;
}

/**
 * Faz upsert de uma chave (CHAVE -> Valor) na aba.
 * Mantém compat: se linha existe, atualiza; senão, adiciona no final.
 */
function _agendaConfigUpsert_(sheet, rowByKey, key, value) {
  if (typeof value === "undefined") return;

  var k = String(key || "").trim();
  if (!k) return;

  var rowIndex = rowByKey[k];
  if (rowIndex) {
    sheet.getRange(rowIndex, 2).setValue(value);
  } else {
    var newRow = sheet.getLastRow() + 1;
    sheet.getRange(newRow, 1, 1, 2).setValues([[k, value]]);
    rowByKey[k] = newRow;
  }
}

function agendaConfigObter_() {
  var defaults = {
    medicoNomeCompleto: "",
    medicoCRM: "",
    medicoEspecialidade: "",
    clinicaNome: "",
    clinicaEndereco: "",
    clinicaTelefone: "",
    clinicaEmail: "",
    logoUrl: "",
    hora_inicio_padrao: "08:00",
    hora_fim_padrao: "18:00",
    duracao_grade_minutos: 15,
    dias_ativos: ["SEG", "TER", "QUA", "QUI", "SEX"]
  };

  var map = {};
  try {
    map = _agendaConfigReadMap_();
  } catch (e) {
    // Se houver falha de acesso ao DB, devolve defaults sem quebrar o front.
    return defaults;
  }

  // DIAS_ATIVOS na planilha é string: "SEG,TER,QUA,QUI,SEX"
  var diasAtivosRaw = String(map.DIAS_ATIVOS || "").trim();
  var diasAtivosArr;
  if (diasAtivosRaw) {
    diasAtivosArr = diasAtivosRaw
      .split(",")
      .map(function (s) { return String(s || "").trim(); })
      .filter(function (s) { return s; });
  } else {
    diasAtivosArr = defaults.dias_ativos.slice();
  }

  var duracao = parseInt(map.DURACAO_GRADE_MINUTOS || defaults.duracao_grade_minutos, 10);
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

  var sheet = _agendaConfigGetSheet_();

  var lastRow = sheet.getLastRow();
  if (!lastRow || lastRow < 1) {
    // defensivo: garante header
    sheet.getRange(1, 1, 1, 2).setValues([AGENDA_CONFIG_HEADER]);
    lastRow = 1;
  }

  // Lê as chaves existentes (linha 2..lastRow)
  var values = [];
  if (lastRow >= 2) {
    values = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
  }

  // Mapa de chave -> linha
  var rowByKey = {};
  for (var i = 0; i < values.length; i++) {
    var chave = String(values[i][0] || "").trim();
    if (!chave) continue;
    rowByKey[chave] = i + 2; // linha real
  }

  // Mapeia JSON camelCase → chaves da planilha
  _agendaConfigUpsert_(sheet, rowByKey, "MEDICO_NOME_COMPLETO", payload.medicoNomeCompleto);
  _agendaConfigUpsert_(sheet, rowByKey, "MEDICO_CRM", payload.medicoCRM);
  _agendaConfigUpsert_(sheet, rowByKey, "MEDICO_ESPECIALIDADE", payload.medicoEspecialidade);

  _agendaConfigUpsert_(sheet, rowByKey, "CLINICA_NOME", payload.clinicaNome);
  _agendaConfigUpsert_(sheet, rowByKey, "CLINICA_ENDERECO", payload.clinicaEndereco);
  _agendaConfigUpsert_(sheet, rowByKey, "CLINICA_TELEFONE", payload.clinicaTelefone);
  _agendaConfigUpsert_(sheet, rowByKey, "CLINICA_EMAIL", payload.clinicaEmail);

  _agendaConfigUpsert_(sheet, rowByKey, "LOGO_URL", payload.logoUrl);

  _agendaConfigUpsert_(sheet, rowByKey, "HORA_INICIO_PADRAO", payload.hora_inicio_padrao);
  _agendaConfigUpsert_(sheet, rowByKey, "HORA_FIM_PADRAO", payload.hora_fim_padrao);
  _agendaConfigUpsert_(sheet, rowByKey, "DURACAO_GRADE_MINUTOS", payload.duracao_grade_minutos);

  // dias_ativos: no JSON é array; na planilha é string "SEG,TER,QUA,..."
  // ✅ maturação: só grava se vier explicitamente; senão mantém o valor atual
  if (typeof payload.dias_ativos !== "undefined") {
    var diasAtivosValue = "";
    if (Array.isArray(payload.dias_ativos)) {
      diasAtivosValue = payload.dias_ativos.join(",");
    } else if (typeof payload.dias_ativos === "string") {
      diasAtivosValue = payload.dias_ativos;
    }
    _agendaConfigUpsert_(sheet, rowByKey, "DIAS_ATIVOS", diasAtivosValue);
  }

  // Retorna novamente a configuração consolidada (já normalizada)
  return agendaConfigObter_();
}
