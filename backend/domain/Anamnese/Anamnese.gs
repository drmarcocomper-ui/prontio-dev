// backend/domain/Anamnese/Anamnese.gs
/**
 * PRONTIO - Anamnese.gs
 * Handler principal do dominio de Anamnese.
 *
 * Actions disponiveis:
 * - Anamnese.Template.Listar
 * - Anamnese.Template.Obter
 * - Anamnese.Template.Salvar
 * - Anamnese.Template.Excluir
 * - Anamnese.Salvar
 * - Anamnese.ListarPorPaciente
 * - Anamnese.ListarPorPacientePaged
 * - Anamnese.ObterPorId
 * - Anamnese.Reminder.Listar
 * - Anamnese.Reminder.MarcarCompleto
 */

var ANAMNESE_SHEET_NAME = "Anamnese";
var ANAMNESE_TEMPLATE_SHEET_NAME = "AnamneseTemplate";
var ANAMNESE_REMINDER_SHEET_NAME = "AnamneseReminder";

/**
 * Erro padrao para Anamnese
 */
function _anamneseThrow_(code, message, details) {
  var err = new Error(String(message || "Erro."));
  err.code = String(code || "INTERNAL_ERROR");
  err.details = (details === undefined ? null : details);
  throw err;
}

/**
 * Handler principal de actions de Anamnese
 */
function handleAnamneseAction(action, payload) {
  payload = payload || {};
  var act = String(action || "").trim();

  switch (act) {
    // ===================== TEMPLATES =====================
    case "Anamnese.Template.Listar":
      return _anamneseTemplateListar_(payload);

    case "Anamnese.Template.Obter":
      return _anamneseTemplateObter_(payload);

    case "Anamnese.Template.Salvar":
      return _anamneseTemplateSalvar_(payload);

    case "Anamnese.Template.Excluir":
      return _anamneseTemplateExcluir_(payload);

    // ===================== ANAMNESE =====================
    case "Anamnese.Salvar":
      return _anamneseSalvar_(payload);

    case "Anamnese.ListarPorPaciente":
      return _anamneseListarPorPaciente_(payload);

    case "Anamnese.ListarPorPacientePaged":
      return _anamneseListarPorPacientePaged_(payload);

    case "Anamnese.ObterPorId":
      return _anamneseObterPorId_(payload);

    // ===================== REMINDERS =====================
    case "Anamnese.Reminder.Listar":
      return _anamneseReminderListar_(payload);

    case "Anamnese.Reminder.MarcarCompleto":
      return _anamneseReminderMarcarCompleto_(payload);

    default:
      _anamneseThrow_(
        "ANAMNESE_UNKNOWN_ACTION",
        "Acao nao reconhecida em Anamnese.gs: " + act,
        { action: act }
      );
  }
}

// ============================================================
// SHEET HELPERS
// ============================================================

function _getAnamneseSheet_() {
  var ss = PRONTIO_getDb_();
  if (!ss) {
    _anamneseThrow_("ANAMNESE_DB_NULL", "PRONTIO_getDb_ retornou null/undefined.", null);
  }

  var sheet = ss.getSheetByName(ANAMNESE_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(ANAMNESE_SHEET_NAME);
    var header = [
      "ID_Anamnese",
      "ID_Paciente",
      "ID_Profissional",
      "ID_Template",
      "NomeTemplate",
      "Dados",
      "DataPreenchimento",
      "DataRetornoDevido",
      "Ativo",
      "CriadoEm",
      "AtualizadoEm"
    ];
    sheet.getRange(1, 1, 1, header.length).setValues([header]);
  }

  return sheet;
}

function _getAnamneseTemplateSheet_() {
  var ss = PRONTIO_getDb_();
  if (!ss) {
    _anamneseThrow_("ANAMNESE_DB_NULL", "PRONTIO_getDb_ retornou null/undefined.", null);
  }

  var sheet = ss.getSheetByName(ANAMNESE_TEMPLATE_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(ANAMNESE_TEMPLATE_SHEET_NAME);
    var header = [
      "ID_Template",
      "ID_Clinica",
      "Nome",
      "Descricao",
      "Secoes",
      "Versao",
      "Ativo",
      "CriadoEm",
      "AtualizadoEm"
    ];
    sheet.getRange(1, 1, 1, header.length).setValues([header]);

    // Insere template padrao
    _insertTemplatePadrao_(sheet);
  }

  return sheet;
}

function _getAnamneseReminderSheet_() {
  var ss = PRONTIO_getDb_();
  if (!ss) {
    _anamneseThrow_("ANAMNESE_DB_NULL", "PRONTIO_getDb_ retornou null/undefined.", null);
  }

  var sheet = ss.getSheetByName(ANAMNESE_REMINDER_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(ANAMNESE_REMINDER_SHEET_NAME);
    var header = [
      "ID_Reminder",
      "ID_Paciente",
      "ID_Anamnese",
      "DataDevida",
      "Status",
      "DataNotificacao",
      "EmailEnviado",
      "Ativo",
      "CriadoEm"
    ];
    sheet.getRange(1, 1, 1, header.length).setValues([header]);
  }

  return sheet;
}

function _getSheetHeaderMap_(sheet) {
  var lastCol = sheet.getLastColumn();
  if (!lastCol || lastCol < 1) return {};

  var headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var map = {};
  headerRow.forEach(function (colName, index) {
    var nome = String(colName || "").trim();
    if (nome) map[nome] = index;
  });
  return map;
}

// ============================================================
// TEMPLATE PADRAO
// ============================================================

function _getTemplatePadraoSecoes_() {
  return {
    secoes: [
      {
        id: "queixa",
        titulo: "Queixa Principal",
        campos: [
          { id: "queixaPrincipal", tipo: "textarea", label: "Descreva a queixa", obrigatorio: true }
        ]
      },
      {
        id: "historia",
        titulo: "Historia da Doenca Atual",
        campos: [
          { id: "inicio", tipo: "text", label: "Inicio dos sintomas" },
          { id: "evolucao", tipo: "textarea", label: "Evolucao" },
          { id: "fatoresAgravantes", tipo: "textarea", label: "Fatores agravantes/atenuantes" }
        ]
      },
      {
        id: "antecedentes",
        titulo: "Antecedentes",
        campos: [
          { id: "pessoais", tipo: "checkboxList", label: "Antecedentes Pessoais", opcoes: ["Diabetes", "Hipertensao", "Cardiopatia", "Asma", "Outros"] },
          { id: "pessoaisOutros", tipo: "text", label: "Outros (especificar)" },
          { id: "familiares", tipo: "textarea", label: "Antecedentes Familiares" }
        ]
      },
      {
        id: "medicamentos",
        titulo: "Medicamentos em Uso",
        campos: [
          {
            id: "medicamentos",
            tipo: "repeater",
            label: "Medicamento",
            subcampos: [
              { id: "nome", tipo: "text", label: "Nome" },
              { id: "dose", tipo: "text", label: "Dose" },
              { id: "frequencia", tipo: "text", label: "Frequencia" }
            ]
          }
        ]
      },
      {
        id: "alergias",
        titulo: "Alergias",
        campos: [
          { id: "temAlergia", tipo: "radio", label: "Possui alergias?", opcoes: ["Sim", "Nao", "Nao sabe"] },
          { id: "alergias", tipo: "textarea", label: "Descreva as alergias" }
        ]
      },
      {
        id: "habitos",
        titulo: "Habitos de Vida",
        campos: [
          { id: "tabagismo", tipo: "radio", label: "Tabagismo", opcoes: ["Nunca fumou", "Ex-fumante", "Fumante"] },
          { id: "etilismo", tipo: "radio", label: "Etilismo", opcoes: ["Nao", "Social", "Frequente"] },
          { id: "atividadeFisica", tipo: "radio", label: "Atividade Fisica", opcoes: ["Sedentario", "Ocasional", "Regular"] }
        ]
      },
      {
        id: "exame",
        titulo: "Exame Fisico",
        campos: [
          { id: "pa", tipo: "text", label: "PA (mmHg)" },
          { id: "fc", tipo: "text", label: "FC (bpm)" },
          { id: "temperatura", tipo: "text", label: "Temperatura (C)" },
          { id: "peso", tipo: "text", label: "Peso (kg)" },
          { id: "altura", tipo: "text", label: "Altura (cm)" },
          { id: "observacoes", tipo: "textarea", label: "Observacoes do exame" }
        ]
      }
    ]
  };
}

function _insertTemplatePadrao_(sheet) {
  var headerMap = _getSheetHeaderMap_(sheet);
  var lastCol = sheet.getLastColumn();
  var linha = new Array(lastCol).fill("");

  function set(col, val) {
    var idx = headerMap[col];
    if (idx == null) return;
    linha[idx] = val;
  }

  var now = new Date().toISOString();
  set("ID_Template", Utilities.getUuid());
  set("ID_Clinica", "");
  set("Nome", "Anamnese Geral");
  set("Descricao", "Template padrao de anamnese medica completa");
  set("Secoes", JSON.stringify(_getTemplatePadraoSecoes_()));
  set("Versao", "1");
  set("Ativo", true);
  set("CriadoEm", now);
  set("AtualizadoEm", now);

  sheet.getRange(2, 1, 1, lastCol).setValues([linha]);
}

// ============================================================
// TEMPLATE CRUD
// ============================================================

function _buildTemplateFromRow_(row, headerMap) {
  function get(col) {
    var idx = headerMap[col];
    if (idx == null) return "";
    return row[idx];
  }

  var secoesJson = String(get("Secoes") || "").trim();
  var secoes = {};
  if (secoesJson) {
    try {
      secoes = JSON.parse(secoesJson);
    } catch (e) {
      secoes = {};
    }
  }

  return {
    idTemplate: String(get("ID_Template") || ""),
    idClinica: String(get("ID_Clinica") || ""),
    nome: String(get("Nome") || ""),
    descricao: String(get("Descricao") || ""),
    secoes: secoes,
    versao: String(get("Versao") || "1"),
    ativo: get("Ativo") === true || get("Ativo") === "true" || get("Ativo") === 1,
    criadoEm: String(get("CriadoEm") || ""),
    atualizadoEm: String(get("AtualizadoEm") || "")
  };
}

function _anamneseTemplateListar_(payload) {
  var sheet = _getAnamneseTemplateSheet_();
  var headerMap = _getSheetHeaderMap_(sheet);
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();

  if (lastRow < 2) return { templates: [] };

  var values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var idxAtivo = headerMap["Ativo"];

  var templates = [];
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var ativo = row[idxAtivo];
    if (ativo === true || ativo === "true" || ativo === 1) {
      templates.push(_buildTemplateFromRow_(row, headerMap));
    }
  }

  return { templates: templates };
}

function _anamneseTemplateObter_(payload) {
  var idTemplate = String(payload.idTemplate || payload.ID_Template || "").trim();
  if (!idTemplate) {
    _anamneseThrow_("ANAMNESE_MISSING_ID_TEMPLATE", "idTemplate e obrigatorio.", null);
  }

  var sheet = _getAnamneseTemplateSheet_();
  var headerMap = _getSheetHeaderMap_(sheet);
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();

  if (lastRow < 2) return { template: null };

  var values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var idxId = headerMap["ID_Template"];

  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    if (String(row[idxId]) === idTemplate) {
      return { template: _buildTemplateFromRow_(row, headerMap) };
    }
  }

  return { template: null };
}

function _anamneseTemplateSalvar_(payload) {
  var idTemplate = String(payload.idTemplate || payload.ID_Template || "").trim();
  var nome = String(payload.nome || payload.Nome || "").trim();
  var descricao = String(payload.descricao || payload.Descricao || "").trim();
  var secoes = payload.secoes || payload.Secoes || {};
  var versao = String(payload.versao || payload.Versao || "1").trim();

  if (!nome) {
    _anamneseThrow_("ANAMNESE_TEMPLATE_NOME_OBRIGATORIO", "Nome do template e obrigatorio.", null);
  }

  var sheet = _getAnamneseTemplateSheet_();
  var headerMap = _getSheetHeaderMap_(sheet);
  var lastCol = sheet.getLastColumn();
  var now = new Date().toISOString();

  if (idTemplate) {
    // Update existente
    var lastRow = sheet.getLastRow();
    if (lastRow >= 2) {
      var values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
      var idxId = headerMap["ID_Template"];

      for (var i = 0; i < values.length; i++) {
        if (String(values[i][idxId]) === idTemplate) {
          var rowNum = i + 2;
          var row = values[i];

          if (headerMap["Nome"] != null) row[headerMap["Nome"]] = nome;
          if (headerMap["Descricao"] != null) row[headerMap["Descricao"]] = descricao;
          if (headerMap["Secoes"] != null) row[headerMap["Secoes"]] = JSON.stringify(secoes);
          if (headerMap["Versao"] != null) row[headerMap["Versao"]] = versao;
          if (headerMap["AtualizadoEm"] != null) row[headerMap["AtualizadoEm"]] = now;

          sheet.getRange(rowNum, 1, 1, lastCol).setValues([row]);

          return { idTemplate: idTemplate, success: true };
        }
      }
    }
    _anamneseThrow_("ANAMNESE_TEMPLATE_NOT_FOUND", "Template nao encontrado.", { idTemplate: idTemplate });
  } else {
    // Criar novo
    var newId = Utilities.getUuid();
    var linha = new Array(lastCol).fill("");

    function set(col, val) {
      var idx = headerMap[col];
      if (idx == null) return;
      linha[idx] = val;
    }

    set("ID_Template", newId);
    set("ID_Clinica", "");
    set("Nome", nome);
    set("Descricao", descricao);
    set("Secoes", JSON.stringify(secoes));
    set("Versao", versao);
    set("Ativo", true);
    set("CriadoEm", now);
    set("AtualizadoEm", now);

    var nextRow = sheet.getLastRow() + 1;
    sheet.getRange(nextRow, 1, 1, lastCol).setValues([linha]);

    return { idTemplate: newId, success: true };
  }
}

function _anamneseTemplateExcluir_(payload) {
  var idTemplate = String(payload.idTemplate || payload.ID_Template || "").trim();
  if (!idTemplate) {
    _anamneseThrow_("ANAMNESE_MISSING_ID_TEMPLATE", "idTemplate e obrigatorio.", null);
  }

  var sheet = _getAnamneseTemplateSheet_();
  var headerMap = _getSheetHeaderMap_(sheet);
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();

  if (lastRow < 2) {
    _anamneseThrow_("ANAMNESE_TEMPLATE_NOT_FOUND", "Template nao encontrado.", { idTemplate: idTemplate });
  }

  var values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var idxId = headerMap["ID_Template"];
  var idxAtivo = headerMap["Ativo"];

  for (var i = 0; i < values.length; i++) {
    if (String(values[i][idxId]) === idTemplate) {
      var rowNum = i + 2;
      values[i][idxAtivo] = false;
      if (headerMap["AtualizadoEm"] != null) {
        values[i][headerMap["AtualizadoEm"]] = new Date().toISOString();
      }
      sheet.getRange(rowNum, 1, 1, lastCol).setValues([values[i]]);
      return { success: true };
    }
  }

  _anamneseThrow_("ANAMNESE_TEMPLATE_NOT_FOUND", "Template nao encontrado.", { idTemplate: idTemplate });
}

// ============================================================
// ANAMNESE CRUD
// ============================================================

function _buildAnamneseFromRow_(row, headerMap) {
  function get(col) {
    var idx = headerMap[col];
    if (idx == null) return "";
    return row[idx];
  }

  var dadosJson = String(get("Dados") || "").trim();
  var dados = {};
  if (dadosJson) {
    try {
      dados = JSON.parse(dadosJson);
    } catch (e) {
      dados = {};
    }
  }

  return {
    idAnamnese: String(get("ID_Anamnese") || ""),
    idPaciente: String(get("ID_Paciente") || ""),
    idProfissional: String(get("ID_Profissional") || ""),
    idTemplate: String(get("ID_Template") || ""),
    nomeTemplate: String(get("NomeTemplate") || ""),
    dados: dados,
    dataPreenchimento: String(get("DataPreenchimento") || ""),
    dataRetornoDevido: String(get("DataRetornoDevido") || ""),
    ativo: get("Ativo") === true || get("Ativo") === "true" || get("Ativo") === 1,
    criadoEm: String(get("CriadoEm") || ""),
    atualizadoEm: String(get("AtualizadoEm") || "")
  };
}

function _anamneseSalvar_(payload) {
  var idPaciente = String(payload.idPaciente || payload.ID_Paciente || "").trim();
  var idProfissional = String(payload.idProfissional || payload.ID_Profissional || "").trim();
  var idTemplate = String(payload.idTemplate || payload.ID_Template || "").trim();
  var nomeTemplate = String(payload.nomeTemplate || payload.NomeTemplate || "").trim();
  var dados = payload.dados || payload.Dados || {};

  if (!idPaciente) {
    _anamneseThrow_("ANAMNESE_MISSING_ID_PACIENTE", "idPaciente e obrigatorio.", null);
  }

  var sheet = _getAnamneseSheet_();
  var headerMap = _getSheetHeaderMap_(sheet);
  var lastCol = sheet.getLastColumn();

  var newId = Utilities.getUuid();
  var now = new Date();
  var nowIso = now.toISOString();

  // Calcula data de retorno (1 ano depois)
  var dataRetorno = new Date(now);
  dataRetorno.setFullYear(dataRetorno.getFullYear() + 1);
  var dataRetornoIso = dataRetorno.toISOString();

  var linha = new Array(lastCol).fill("");

  function set(col, val) {
    var idx = headerMap[col];
    if (idx == null) return;
    linha[idx] = val;
  }

  set("ID_Anamnese", newId);
  set("ID_Paciente", idPaciente);
  set("ID_Profissional", idProfissional);
  set("ID_Template", idTemplate);
  set("NomeTemplate", nomeTemplate);
  set("Dados", JSON.stringify(dados));
  set("DataPreenchimento", nowIso);
  set("DataRetornoDevido", dataRetornoIso);
  set("Ativo", true);
  set("CriadoEm", nowIso);
  set("AtualizadoEm", nowIso);

  var nextRow = sheet.getLastRow() + 1;
  sheet.getRange(nextRow, 1, 1, lastCol).setValues([linha]);

  // Cria reminder para 1 ano
  _criarAnamneseReminder_(newId, idPaciente, dataRetornoIso);

  return {
    idAnamnese: newId,
    dataRetornoDevido: dataRetornoIso,
    success: true
  };
}

function _anamneseListarPorPaciente_(payload) {
  var idPaciente = String(payload.idPaciente || payload.ID_Paciente || "").trim();
  if (!idPaciente) {
    _anamneseThrow_("ANAMNESE_MISSING_ID_PACIENTE", "idPaciente e obrigatorio.", null);
  }

  var sheet = _getAnamneseSheet_();
  var headerMap = _getSheetHeaderMap_(sheet);
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();

  if (lastRow < 2) return { anamneses: [] };

  var values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var idxIdPac = headerMap["ID_Paciente"];
  var idxAtivo = headerMap["Ativo"];

  var anamneses = [];
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var ativo = row[idxAtivo];
    if (String(row[idxIdPac]) === idPaciente && (ativo === true || ativo === "true" || ativo === 1)) {
      anamneses.push(_buildAnamneseFromRow_(row, headerMap));
    }
  }

  // Ordena por data de preenchimento (mais recente primeiro)
  anamneses.sort(function (a, b) {
    var da = Date.parse(a.dataPreenchimento || "") || 0;
    var db = Date.parse(b.dataPreenchimento || "") || 0;
    return db - da;
  });

  return { anamneses: anamneses };
}

function _anamneseListarPorPacientePaged_(payload) {
  var idPaciente = String(payload.idPaciente || payload.ID_Paciente || "").trim();
  var limit = Number(payload.limit) || 10;
  var cursor = payload.cursor || null;

  if (!idPaciente) {
    _anamneseThrow_("ANAMNESE_MISSING_ID_PACIENTE", "idPaciente e obrigatorio.", null);
  }

  var result = _anamneseListarPorPaciente_({ idPaciente: idPaciente });
  var all = result.anamneses || [];

  var startIdx = 0;
  if (cursor) {
    for (var i = 0; i < all.length; i++) {
      if (all[i].idAnamnese === cursor) {
        startIdx = i + 1;
        break;
      }
    }
  }

  var items = all.slice(startIdx, startIdx + limit);
  var hasMore = (startIdx + limit) < all.length;
  var nextCursor = hasMore && items.length > 0 ? items[items.length - 1].idAnamnese : null;

  return {
    items: items,
    hasMore: hasMore,
    nextCursor: nextCursor
  };
}

function _anamneseObterPorId_(payload) {
  var idAnamnese = String(payload.idAnamnese || payload.ID_Anamnese || "").trim();
  if (!idAnamnese) {
    _anamneseThrow_("ANAMNESE_MISSING_ID_ANAMNESE", "idAnamnese e obrigatorio.", null);
  }

  var sheet = _getAnamneseSheet_();
  var headerMap = _getSheetHeaderMap_(sheet);
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();

  if (lastRow < 2) return { anamnese: null };

  var values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var idxId = headerMap["ID_Anamnese"];

  for (var i = 0; i < values.length; i++) {
    if (String(values[i][idxId]) === idAnamnese) {
      return { anamnese: _buildAnamneseFromRow_(values[i], headerMap) };
    }
  }

  return { anamnese: null };
}

// ============================================================
// REMINDER CRUD
// ============================================================

function _criarAnamneseReminder_(idAnamnese, idPaciente, dataDevida) {
  var sheet = _getAnamneseReminderSheet_();
  var headerMap = _getSheetHeaderMap_(sheet);
  var lastCol = sheet.getLastColumn();

  var newId = Utilities.getUuid();
  var now = new Date().toISOString();

  var linha = new Array(lastCol).fill("");

  function set(col, val) {
    var idx = headerMap[col];
    if (idx == null) return;
    linha[idx] = val;
  }

  set("ID_Reminder", newId);
  set("ID_Paciente", idPaciente);
  set("ID_Anamnese", idAnamnese);
  set("DataDevida", dataDevida);
  set("Status", "PENDENTE");
  set("DataNotificacao", "");
  set("EmailEnviado", false);
  set("Ativo", true);
  set("CriadoEm", now);

  var nextRow = sheet.getLastRow() + 1;
  sheet.getRange(nextRow, 1, 1, lastCol).setValues([linha]);

  return newId;
}

function _buildReminderFromRow_(row, headerMap) {
  function get(col) {
    var idx = headerMap[col];
    if (idx == null) return "";
    return row[idx];
  }

  return {
    idReminder: String(get("ID_Reminder") || ""),
    idPaciente: String(get("ID_Paciente") || ""),
    idAnamnese: String(get("ID_Anamnese") || ""),
    dataDevida: String(get("DataDevida") || ""),
    status: String(get("Status") || ""),
    dataNotificacao: String(get("DataNotificacao") || ""),
    emailEnviado: get("EmailEnviado") === true || get("EmailEnviado") === "true" || get("EmailEnviado") === 1,
    ativo: get("Ativo") === true || get("Ativo") === "true" || get("Ativo") === 1,
    criadoEm: String(get("CriadoEm") || "")
  };
}

function _anamneseReminderListar_(payload) {
  var status = String(payload.status || "").trim().toUpperCase();

  var sheet = _getAnamneseReminderSheet_();
  var headerMap = _getSheetHeaderMap_(sheet);
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();

  if (lastRow < 2) return { reminders: [] };

  var values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var idxStatus = headerMap["Status"];
  var idxAtivo = headerMap["Ativo"];

  var reminders = [];
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var ativo = row[idxAtivo];
    var rowStatus = String(row[idxStatus] || "").toUpperCase();

    if (ativo === true || ativo === "true" || ativo === 1) {
      if (!status || rowStatus === status) {
        reminders.push(_buildReminderFromRow_(row, headerMap));
      }
    }
  }

  return { reminders: reminders };
}

function _anamneseReminderMarcarCompleto_(payload) {
  var idReminder = String(payload.idReminder || payload.ID_Reminder || "").trim();
  if (!idReminder) {
    _anamneseThrow_("ANAMNESE_MISSING_ID_REMINDER", "idReminder e obrigatorio.", null);
  }

  var sheet = _getAnamneseReminderSheet_();
  var headerMap = _getSheetHeaderMap_(sheet);
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();

  if (lastRow < 2) {
    _anamneseThrow_("ANAMNESE_REMINDER_NOT_FOUND", "Reminder nao encontrado.", { idReminder: idReminder });
  }

  var values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var idxId = headerMap["ID_Reminder"];
  var idxStatus = headerMap["Status"];

  for (var i = 0; i < values.length; i++) {
    if (String(values[i][idxId]) === idReminder) {
      var rowNum = i + 2;
      values[i][idxStatus] = "COMPLETO";
      sheet.getRange(rowNum, 1, 1, lastCol).setValues([values[i]]);
      return { success: true };
    }
  }

  _anamneseThrow_("ANAMNESE_REMINDER_NOT_FOUND", "Reminder nao encontrado.", { idReminder: idReminder });
}
