// Exames.gs
// Backend do módulo EXAMES PRONTIO
// --------------------------------
//
// Aba "Exames" (catálogo):
//  A: ID_Exame       (UUID)
//  B: NomeExame      (string)
//  C: Grupo          (string, ex.: Laboratório, Imagem, Cardiologia)
//  D: Descricao      (string opcional)
//
// Aba "SADT" (modelo da guia oficial preenchida em planilha)
//
// Aba "SolicitacaoExames" (histórico):
//  A: ID_Solicitacao
//  B: ID_Paciente
//  C: DataHoraCriacao (ISO)
//  D: Tipo ("SADT" ou "PARTICULAR")
//  E: CID
//  F: Resumo
//  G: DadosJSON (payload completo)

var EXAMES_SHEET_NAME = "Exames";
var SADT_TEMPLATE_SHEET_NAME = "SADT";
var HIST_EXAMES_SHEET_NAME = "SolicitacaoExames";

// Campos na aba SADT (só os que você pediu)
var SADT_RANGE_NOME       = "Q5:AK5";   // Nome paciente
var SADT_RANGE_CID        = "K11:M11";  // CID
var SADT_RANGE_INDICACAO  = "N11:AT11"; // Indicação clínica
var SADT_RANGE_EXAMES = [
  "F13:AC13",
  "F14:AC14",
  "F15:AC15",
  "F16:AC16",
  "F17:AC17"
];

// ============================
// Roteador
// ============================
function handleExamesAction(action, payload) {
  if (action === "Exames.ListarCatalogo") {
    return examesListarCatalogo_();
  }

  if (action === "Exames.GerarSADT") {
    return examesGerarSadt_(payload);
  }

  if (action === "Exames.GerarParticular") {
    return examesGerarParticular_(payload);
  }

  if (action === "Exames.ListarHistoricoPorPaciente") {
    return examesListarHistoricoPorPaciente_(payload);
  }

  return {
    success: false,
    data: null,
    errors: ["Ação não reconhecida em Exames.gs: " + action],
  };
}

// ============================
// Catálogo de exames
// ============================
function getExamesSheet_() {
  var ss = SpreadsheetApp.getActive();
  var sheet = ss.getSheetByName(EXAMES_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(EXAMES_SHEET_NAME);
    sheet.getRange(1, 1, 1, 4).setValues([["ID_Exame", "NomeExame", "Grupo", "Descricao"]]);
  }
  return sheet;
}

function buildExameFromRow_(row) {
  return {
    idExame: row[0] || "",
    nomeExame: row[1] || "",
    grupo: row[2] || "",
    descricao: row[3] || "",
  };
}

function examesListarCatalogo_() {
  var sheet = getExamesSheet_();
  var values = sheet.getDataRange().getValues();
  var exames = [];

  if (values.length > 1) {
    values.slice(1).forEach(function (row) {
      if (row[0] || row[1]) exames.push(buildExameFromRow_(row));
    });
  }

  exames.sort(function (a, b) {
    var ga = (a.grupo || "") + (a.nomeExame || "");
    var gb = (b.grupo || "") + (b.nomeExame || "");
    if (ga > gb) return 1;
    if (ga < gb) return -1;
    return 0;
  });

  return { success: true, data: { exames: exames }, errors: [] };
}

// ============================
// Dados paciente & config
// ============================
function examesObterDadosPacientePorId_(idPaciente) {
  var out = { nomePaciente: "", cpfPaciente: "" };
  if (!idPaciente) return out;

  var ss = SpreadsheetApp.getActive();
  var sheet = ss.getSheetByName("Pacientes");
  if (!sheet) return out;

  var values = sheet.getDataRange().getValues();
  if (values.length <= 1) return out;

  var header = values[0];
  var idxId = header.indexOf("ID_Paciente");
  var idxNome = header.indexOf("NomeCompleto");
  var idxCpf = header.indexOf("CPF");

  if (idxId < 0) idxId = 0;
  if (idxNome < 0) idxNome = 1;

  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    if (String(row[idxId]) === String(idPaciente)) {
      out.nomePaciente = row[idxNome] || "";
      out.cpfPaciente = idxCpf >= 0 ? (row[idxCpf] || "") : "";
      break;
    }
  }
  return out;
}

function examesObterConfig_() {
  try {
    var r = obterConfiguracoes_(); // de Configuracoes.gs
    return (r && r.success && r.data) ? r.data.configuracoes : {};
  } catch (e) {
    return {};
  }
}

// ============================
// Histórico (SolicitacaoExames)
// ============================
function getHistExamesSheet_() {
  var ss = SpreadsheetApp.getActive();
  var sheet = ss.getSheetByName(HIST_EXAMES_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(HIST_EXAMES_SHEET_NAME);
    sheet
      .getRange(1, 1, 1, 7)
      .setValues([
        [
          "ID_Solicitacao",
          "ID_Paciente",
          "DataHoraCriacao",
          "Tipo",
          "CID",
          "Resumo",
          "DadosJSON",
        ],
      ]);
  }
  return sheet;
}

function registrarSolicitacaoExame_(tipo, idPaciente, cid, resumo, payload) {
  var sheet = getHistExamesSheet_();
  var idSolicitacao = Utilities.getUuid();
  var dataHora = new Date().toISOString();
  var linha = [
    idSolicitacao,
    idPaciente,
    dataHora,
    tipo,
    cid || "",
    resumo || "",
    JSON.stringify(payload || {}),
  ];
  sheet.appendRow(linha);
  return idSolicitacao;
}

function examesListarHistoricoPorPaciente_(payload) {
  var idPaciente = payload && payload.idPaciente ? String(payload.idPaciente) : "";
  if (!idPaciente) {
    return {
      success: false,
      data: null,
      errors: ["idPaciente é obrigatório para Exames.ListarHistoricoPorPaciente."],
    };
  }

  var sheet = getHistExamesSheet_();
  var values = sheet.getDataRange().getValues();
  var historico = [];

  if (values.length > 1) {
    values.slice(1).forEach(function (row) {
      if (String(row[1]) === idPaciente) {
        historico.push({
          idSolicitacao: row[0],
          idPaciente: row[1],
          dataHoraCriacao: row[2],
          tipo: row[3],
          cid: row[4],
          resumo: row[5],
        });
      }
    });
  }

  // mais recente primeiro
  historico.sort(function (a, b) {
    var da = a.dataHoraCriacao || "";
    var db = b.dataHoraCriacao || "";
    if (da > db) return -1;
    if (da < db) return 1;
    return 0;
  });

  return {
    success: true,
    data: { historico: historico },
    errors: [],
  };
}

// ============================
// SADT usando aba SADT (PDF)
// ============================
function examesGerarSadt_(payload) {
  if (!payload || !payload.idPaciente) {
    return {
      success: false,
      data: null,
      errors: ["idPaciente é obrigatório para Exames.GerarSADT."],
    };
  }
  if (!payload.examesTexto) {
    return {
      success: false,
      data: null,
      errors: ["examesTexto é obrigatório para Exames.GerarSADT."],
    };
  }

  var idPaciente = String(payload.idPaciente);
  var pac = examesObterDadosPacientePorId_(idPaciente);
  var ss = SpreadsheetApp.getActive();
  var sheet = ss.getSheetByName(SADT_TEMPLATE_SHEET_NAME);

  if (!sheet) {
    return {
      success: false,
      data: null,
      errors: ['Aba "' + SADT_TEMPLATE_SHEET_NAME + '" não encontrada.'],
    };
  }

  var cid = payload.cidPrincipal || "";
  var indicacaoClinica = payload.indicacaoClinica || "";
  var examesTexto = payload.examesTexto || "";

  // preenche as regiões informadas
  sheet.getRange(SADT_RANGE_NOME).setValue(pac.nomePaciente || "");
  sheet.getRange(SADT_RANGE_CID).setValue(cid || "");
  sheet.getRange(SADT_RANGE_INDICACAO).setValue(indicacaoClinica || "");

  var linhas = examesTexto.split("\n");
  for (var i = 0; i < SADT_RANGE_EXAMES.length; i++) {
    var textoLinha = linhas[i] || "";
    sheet.getRange(SADT_RANGE_EXAMES[i]).setValue(textoLinha);
  }

  // registra no histórico
  var resumoSadt = (examesTexto || "").split("\n")[0] || "";
  resumoSadt = resumoSadt.substring(0, 120);
  var payloadHist = {
    tipo: "SADT",
    cidPrincipal: cid,
    indicacaoClinica: indicacaoClinica,
    examesTexto: examesTexto,
    observacoes: payload.observacoes || "",
  };
  var idSolicitacao = registrarSolicitacaoExame_(
    "SADT",
    idPaciente,
    cid,
    resumoSadt,
    payloadHist
  );

  // gera URL do PDF dessa aba
  var exportUrl =
    "https://docs.google.com/spreadsheets/d/" +
    ss.getId() +
    "/export?format=pdf&gid=" +
    sheet.getSheetId() +
    "&size=A4&portrait=false&fitw=true" +
    "&sheetnames=false&printtitle=false&pagenumbers=false&gridlines=false&fzr=false" +
    "&top_margin=0.25&bottom_margin=0.25&left_margin=0.25&right_margin=0.25";

  return {
    success: true,
    data: {
      pdfUrl: exportUrl,
      idSolicitacao: idSolicitacao,
    },
    errors: [],
  };
}

// ============================
// Exames Particular (HTML)
// ============================
function examesGerarParticular_(payload) {
  if (!payload || !payload.idPaciente) {
    return {
      success: false,
      data: null,
      errors: ["idPaciente é obrigatório para Exames.GerarParticular."],
    };
  }

  var idPaciente = String(payload.idPaciente);
  var selecionadosIds = payload.examesSelecionadosIds || [];
  var textoLivre = (payload.examesTextoLivre || "").toString().trim();
  var observacoes = (payload.observacoes || "").toString().trim();

  var cfg = examesObterConfig_();
  var medicoNomeCompleto = cfg.medicoNomeCompleto || "";
  var medicoCRM = cfg.medicoCRM || "";
  var medicoEspecialidade = cfg.medicoEspecialidade || "";
  var clinicaNome = cfg.clinicaNome || "";
  var clinicaEndereco = cfg.clinicaEndereco || "";
  var clinicaTelefone = cfg.clinicaTelefone || "";
  var clinicaEmail = cfg.clinicaEmail || "";
  var clinicaLogoUrl = cfg.clinicaLogoUrl || "";

  var pac = examesObterDadosPacientePorId_(idPaciente);
  var nomePaciente = pac.nomePaciente;
  var cpfPaciente = pac.cpfPaciente;

  var hoje = new Date();
  var dd = ("0" + hoje.getDate()).slice(-2);
  var mm = ("0" + (hoje.getMonth() + 1)).slice(-2);
  var yy = hoje.getFullYear();
  var dataBR = dd + "/" + mm + "/" + yy;

  // Monta resumo para histórico
  var resumoParticular = "";
  if (textoLivre) {
    resumoParticular = textoLivre.split("\n")[0];
  } else if (selecionadosIds.length) {
    resumoParticular = "(" + selecionadosIds.length + " exame(s) do catálogo)";
  }
  resumoParticular = resumoParticular.substring(0, 120);

  var payloadHist = {
    tipo: "PARTICULAR",
    examesSelecionadosIds: selecionadosIds,
    examesTextoLivre: textoLivre,
    observacoes: observacoes,
  };
  var idSolic = registrarSolicitacaoExame_(
    "PARTICULAR",
    idPaciente,
    "", // sem CID obrigatório aqui
    resumoParticular,
    payloadHist
  );

  // Monta HTML do pedido particular (modelo neutro)
  var html = "";
  html += "<!DOCTYPE html>";
  html += '<html lang="pt-BR">';
  html += "<head>";
  html += '<meta charset="UTF-8">';
  html += "<title>Solicitação de Exames - Particular</title>";
  html += "<style>";
  html += "body { font-family: Arial, sans-serif; font-size: 12px; margin: 20px; color:#111; }";
  html += ".cabecalho { text-align:center; margin-bottom:16px; }";
  html += ".cabecalho-logo img { max-height:60px; margin-bottom:6px; }";
  html += ".cabecalho-clinica { font-size:14px; font-weight:bold; }";
  html += ".cabecalho-contato { font-size:11px; color:#555; margin-top:4px; }";
  html += ".titulo { text-align:center; font-weight:bold; font-size:15px; margin:10px 0 12px 0; }";
  html += ".bloco-info { margin-bottom:8px; }";
  html += ".rotulo { font-weight:bold; }";
  html += ".lista-exames { margin:6px 0 0 0; padding-left:16px; }";
  html += ".lista-exames li { margin-bottom:2px; }";
  html += ".texto-box { white-space:pre-wrap; border:1px solid #ccc; padding:6px; border-radius:4px; font-size:11px; min-height:50px; }";
  html += ".rodape-assinatura { margin-top:28px; text-align:center; }";
  html += ".linha-assinatura { border-top:1px solid #000; width:220px; margin:0 auto 4px auto; }";
  html += ".rodape-assinatura small { display:block; font-size:11px; color:#333; }";
  html += "@page { margin: 15mm; }";
  html += "</style>";
  html += "</head>";
  html += "<body>";

  html += '<div class="cabecalho">';
  if (clinicaLogoUrl) {
    html += '<div class="cabecalho-logo"><img src="' + clinicaLogoUrl + '" alt="Logo"></div>';
  }
  if (clinicaNome) {
    html += '<div class="cabecalho-clinica">' + escapeHtml_(clinicaNome) + "</div>";
  }
  if (clinicaEndereco) {
    html += '<div class="cabecalho-contato">' + escapeHtml_(clinicaEndereco) + "</div>";
  }
  var contatoLinha = [];
  if (clinicaTelefone) contatoLinha.push("Tel/WhatsApp: " + clinicaTelefone);
  if (clinicaEmail) contatoLinha.push("E-mail: " + clinicaEmail);
  if (contatoLinha.length) {
    html += '<div class="cabecalho-contato">' + escapeHtml_(contatoLinha.join(" • ")) + "</div>";
  }
  if (medicoNomeCompleto || medicoCRM || medicoEspecialidade) {
    var medLinha = medicoNomeCompleto;
    if (medicoCRM) medLinha += (medLinha ? " - " : "") + "CRM: " + medicoCRM;
    if (medicoEspecialidade) medLinha += (medLinha ? " - " : "") + medicoEspecialidade;
    html += '<div class="cabecalho-contato">' + escapeHtml_(medLinha) + "</div>";
  }
  html += "</div>";

  html += '<div class="titulo">SOLICITAÇÃO DE EXAMES (PARTICULAR)</div>';

  html += '<div class="bloco-info">';
  html += '<span class="rotulo">Data: </span>' + escapeHtml_(dataBR) + "<br>";
  if (nomePaciente) {
    html += '<span class="rotulo">Paciente: </span>' + escapeHtml_(nomePaciente) + "<br>";
  }
  if (cpfPaciente) {
    html += '<span class="rotulo">CPF: </span>' + escapeHtml_(cpfPaciente) + "<br>";
  }
  html += "</div>";

  // Exames do catálogo selecionados – aqui só mostramos contagem
  if (selecionadosIds.length) {
    html += '<div class="bloco-info">';
    html += '<div class="rotulo">Exames do catálogo selecionados:</div>';
    html += "<ul class=\"lista-exames\">";
    selecionadosIds.forEach(function (id) {
      html += "<li>ID: " + escapeHtml_(id) + "</li>";
    });
    html += "</ul>";
    html += "</div>";
  }

  // Exames adicionais texto livre
  if (textoLivre) {
    html += '<div class="bloco-info">';
    html += '<div class="rotulo">Exames (texto livre):</div>';
    html += '<div class="texto-box">' + escapeHtml_(textoLivre) + "</div>";
    html += "</div>";
  }

  // Observações
  if (observacoes) {
    html += '<div class="bloco-info">';
    html += '<div class="rotulo">Observações / orientações:</div>';
    html += '<div class="texto-box">' + escapeHtml_(observacoes) + "</div>";
    html += "</div>";
  }

  // Assinatura
  html += '<div class="rodape-assinatura">';
  html += '<div class="linha-assinatura"></div>';
  if (medicoNomeCompleto) {
    html += "<small>" + escapeHtml_(medicoNomeCompleto) + "</small>";
  }
  if (medicoCRM) {
    html += "<small>CRM: " + escapeHtml_(medicoCRM) + "</small>";
  }
  if (medicoEspecialidade) {
    html += "<small>" + escapeHtml_(medicoEspecialidade) + "</small>";
  }
  html += "</div>";

  html += "</body></html>";

  return {
    success: true,
    data: {
      html: html,
      idSolicitacao: idSolic,
    },
    errors: [],
  };
}

// ============================
// Helper
// ============================
function escapeHtml_(texto) {
  if (!texto && texto !== 0) return "";
  return String(texto)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
