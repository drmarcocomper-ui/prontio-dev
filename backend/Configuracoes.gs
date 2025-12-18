/**
 * Configuracoes.gs
 * -----------------
 * Módulo de configurações gerais do PRONTIO (backend).
 *
 * ARQUITETURA:
 * - Este módulo NÃO conhece nada do front; só recebe/entrega JSON.
 * - Front chama:
 *      action: "Configuracoes.Obter"  -> handleConfiguracoesAction(...)
 *      action: "Configuracoes.Salvar" -> handleConfiguracoesAction(...)
 *
 * PLANILHA:
 * - Usamos uma aba chamada "CONFIG_GERAL".
 * - Estrutura:
 *      Col A: Chave   (string)
 *      Col B: Valor   (string / JSON)
 *
 * - Exemplo de linhas:
 *      medicoNomeCompleto     | "Dr. Fulano de Tal"
 *      medicoCRM              | "CRM 000000 / UF"
 *      medicoEspecialidade    | "Ortopedia"
 *      clinicaNome            | "Clínica Exemplo"
 *      clinicaLogoUrl         | "https://.../logo.png"
 *      agendaDiasAtivos       | '["SEG","TER","QUA","QUI","SEX"]'
 */

/** Nome da aba de configurações gerais. */
var ABA_CONFIG_GERAL = "CONFIG_GERAL";

/**
 * Roteador de ações do módulo Configurações.
 *
 * @param {string} action Ex: "Configuracoes.Obter", "Configuracoes.Salvar"
 * @param {Object} payload Dados enviados pelo front
 * @returns {Object} { success, data, errors }
 */
function handleConfiguracoesAction(action, payload) {
  try {
    if (action === "Configuracoes.Obter") {
      // Mantemos a função existente que já retorna { success, data, errors }
      return obterConfiguracoes_();
    }

    if (action === "Configuracoes.Salvar") {
      return salvarConfiguracoes_(payload);
    }

    // Erro padronizado usando createApiResponse_, igual outros módulos
    return createApiResponse_(false, null, [
      "Ação de Configurações não reconhecida: " + action
    ]);

  } catch (erro) {
    return createApiResponse_(false, null, [
      "Erro em Configuracoes: " + erro
    ]);
  }
}

/**
 * Obtém a planilha de configurações gerais.
 * Cria a aba, se necessário, com cabeçalho [Chave, Valor].
 */
function getConfigSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(ABA_CONFIG_GERAL);
  if (!sheet) {
    sheet = ss.insertSheet(ABA_CONFIG_GERAL);
    sheet.getRange(1, 1).setValue("Chave");
    sheet.getRange(1, 2).setValue("Valor");
  }
  return sheet;
}

/**
 * Lê todas as chaves/valores da aba CONFIG_GERAL e devolve um objeto de configurações.
 * @returns {Object} { success, data: { configuracoes: {...} }, errors: [] }
 */
function obterConfiguracoes_() {
  var sheet = getConfigSheet_();
  var lastRow = sheet.getLastRow();
  var config = {};

  if (lastRow > 1) {
    var range = sheet.getRange(2, 1, lastRow - 1, 2);
    var values = range.getValues();
    values.forEach(function (linha) {
      var chave = linha[0];
      var valor = linha[1];
      if (!chave) return;

      // Desserialização especial para campos em JSON
      if (chave === "agendaDiasAtivos") {
        try {
          config[chave] = valor ? JSON.parse(valor) : [];
        } catch (e) {
          config[chave] = [];
        }
      } else {
        config[chave] = valor;
      }
    });
  }

  // Garante campos esperados com defaults
  if (typeof config.medicoNomeCompleto === "undefined") {
    config.medicoNomeCompleto = "";
  }
  if (typeof config.medicoCRM === "undefined") {
    config.medicoCRM = "";
  }
  if (typeof config.medicoEspecialidade === "undefined") {
    config.medicoEspecialidade = "";
  }
  if (typeof config.clinicaNome === "undefined") {
    config.clinicaNome = "";
  }
  if (typeof config.clinicaEndereco === "undefined") {
    config.clinicaEndereco = "";
  }
  if (typeof config.clinicaTelefone === "undefined") {
    config.clinicaTelefone = "";
  }
  if (typeof config.clinicaEmail === "undefined") {
    config.clinicaEmail = "";
  }
  if (typeof config.agendaHoraInicioPadrao === "undefined") {
    config.agendaHoraInicioPadrao = "";
  }
  if (typeof config.agendaHoraFimPadrao === "undefined") {
    config.agendaHoraFimPadrao = "";
  }
  if (typeof config.agendaIntervaloMinutos === "undefined") {
    config.agendaIntervaloMinutos = "";
  }
  if (!config.agendaDiasAtivos) {
    config.agendaDiasAtivos = [];
  }

  // NOVO: garante campo de logo da clínica (usado em Receita.GerarPdf)
  if (typeof config.clinicaLogoUrl === "undefined") {
    config.clinicaLogoUrl = "";
  }

  return {
    success: true,
    data: {
      configuracoes: config
    },
    errors: []
  };
}

/**
 * Salva as configurações recebidas do front na aba CONFIG_GERAL.
 * @param {Object} payload Espera { configuracoes: {...} }
 * @returns {Object} { success, data: { configuracoes }, errors }
 */
function salvarConfiguracoes_(payload) {
  if (!payload || !payload.configuracoes) {
    return {
      success: false,
      data: null,
      errors: ["Payload de configurações não informado."]
    };
  }

  var cfg = payload.configuracoes;

  // Regras de negócio mínimas no backend
  if (!cfg.medicoNomeCompleto) {
    return {
      success: false,
      data: null,
      errors: ["Nome completo do médico é obrigatório."]
    };
  }
  if (!cfg.medicoCRM) {
    return {
      success: false,
      data: null,
      errors: ["CRM é obrigatório."]
    };
  }

  var sheet = getConfigSheet_();
  var lastRow = sheet.getLastRow();
  var mapLinhas = {};

  // Mapeia chave -> linha existente
  if (lastRow > 1) {
    var range = sheet.getRange(2, 1, lastRow - 1, 2);
    var values = range.getValues();
    for (var i = 0; i < values.length; i++) {
      var chaveExistente = values[i][0];
      if (chaveExistente) {
        mapLinhas[chaveExistente] = i + 2; // linha na planilha
      }
    }
  }

  // Lista de chaves que vamos persistir
  var chaves = [
    "medicoNomeCompleto",
    "medicoCRM",
    "medicoEspecialidade",
    "clinicaNome",
    "clinicaEndereco",
    "clinicaTelefone",
    "clinicaEmail",
    "clinicaLogoUrl",         // NOVO: logo para PDFs
    "agendaHoraInicioPadrao",
    "agendaHoraFimPadrao",
    "agendaIntervaloMinutos",
    "agendaDiasAtivos"        // salvo como JSON
  ];

  chaves.forEach(function (chave) {
    var valor = cfg[chave];

    // Serialização especial para arrays/objetos
    if (chave === "agendaDiasAtivos") {
      valor = JSON.stringify(valor || []);
    }

    if (mapLinhas[chave]) {
      // Atualiza linha existente
      var linha = mapLinhas[chave];
      sheet.getRange(linha, 2).setValue(valor);
    } else {
      // Adiciona nova linha ao final
      var novaLinha = sheet.getLastRow() + 1;
      sheet.getRange(novaLinha, 1).setValue(chave);
      sheet.getRange(novaLinha, 2).setValue(valor);
    }
  });

  // Retorna as configurações já normalizadas (como antes)
  return obterConfiguracoes_();
}
