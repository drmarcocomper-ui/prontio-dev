// backend/Receita.gs
// Receita.gs (PRONTIO) — compatível com o front atual (page-receita.js)
// - Actions: Receita.SalvarRascunho | Receita.SalvarFinal | Receita.ListarPorPaciente | Receita.GerarPdf
// - Recebe payload.itens[] (com remedio/posologia/via/quantidade/observacao/idRemedio)
// - Salva na aba "Receitas"
// - Retorna DATA PURO (Api.gs envelopa success/data/errors)
//
// Ajuste retrocompatível:
// - Substitui "throw { ... }" por Error com err.code/err.details.

var RECEITA_SHEET_NAME = "Receitas";

function _receitaThrow_(code, message, details) {
  var err = new Error(String(message || "Erro."));
  err.code = String(code || "INTERNAL_ERROR");
  err.details = (details === undefined ? null : details);
  throw err;
}

function handleReceitaAction(action, payload) {
  payload = payload || {};
  var act = String(action || "");

  // aliases
  if (act === "Receita.GerarPDF") act = "Receita.GerarPdf";
  if (act === "Receita_ListarPorPaciente") act = "Receita.ListarPorPaciente";
  if (act === "Receita_SalvarRascunho") act = "Receita.SalvarRascunho";
  if (act === "Receita_SalvarFinal") act = "Receita.SalvarFinal";

  switch (act) {
    case "Receita.SalvarRascunho":
      return receitaSalvar_(payload, "RASCUNHO");

    case "Receita.SalvarFinal":
      return receitaSalvar_(payload, "FINAL");

    case "Receita.ListarPorPaciente":
      return receitaListarPorPaciente_(payload);

    case "Receita.GerarPdf":
      return receitaGerarPdf_(payload);

    default:
      _receitaThrow_(
        "RECEITA_UNKNOWN_ACTION",
        "Ação não reconhecida em Receita.gs: " + act,
        { action: act }
      );
  }
}

function getReceitaSheet_() {
  var ss = PRONTIO_getDb_(); // ✅ usa openById via Utils.gs
  if (!ss) {
    _receitaThrow_("RECEITA_DB_NULL", "PRONTIO_getDb_ retornou null/undefined.", null);
  }

  var sheet = ss.getSheetByName(RECEITA_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(RECEITA_SHEET_NAME);
    var header = [
      "ID_Receita",
      "ID_Paciente",
      "DataHoraCriacao",
      "DataReceita",
      "TextoMedicamentos",
      "Observacoes",
      "TipoReceita",
      "Status",
      "ItensJson"
    ];
    sheet.getRange(1, 1, 1, header.length).setValues([header]);
  }

  // garante colunas mínimas
  var lastCol = sheet.getLastColumn();
  var headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

  var expectedCols = [
    "ID_Receita",
    "ID_Paciente",
    "DataHoraCriacao",
    "DataReceita",
    "TextoMedicamentos",
    "Observacoes",
    "TipoReceita",
    "Status",
    "ItensJson"
  ];

  var existentes = {};
  for (var i = 0; i < headerRow.length; i++) {
    var nome = String(headerRow[i] || "").trim();
    if (nome) existentes[nome] = true;
  }

  var novos = [];
  expectedCols.forEach(function (nome) {
    if (!existentes[nome]) novos.push(nome);
  });

  if (novos.length) {
    sheet.getRange(1, headerRow.length + 1, 1, novos.length).setValues([novos]);
  }

  return sheet;
}

function getReceitaHeaderMap_() {
  var sheet = getReceitaSheet_();
  var lastCol = sheet.getLastColumn();
  var headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

  var map = {};
  headerRow.forEach(function (colName, index) {
    var nome = String(colName || "").trim();
    if (nome) map[nome] = index;
  });
  return map;
}

function buildReceitaFromRow_(row, headerMap) {
  function get(col) {
    var idx = headerMap[col];
    if (idx == null) return "";
    return row[idx];
  }

  var itensJson = String(get("ItensJson") || "").trim();
  var itens = [];
  if (itensJson) {
    try {
      var parsed = JSON.parse(itensJson);
      if (Array.isArray(parsed)) itens = parsed;
    } catch (e) {
      itens = [];
    }
  }

  return {
    idReceita: String(get("ID_Receita") || ""),
    ID_Receita: String(get("ID_Receita") || ""),
    idPaciente: String(get("ID_Paciente") || ""),
    ID_Paciente: String(get("ID_Paciente") || ""),
    dataHoraCriacao: String(get("DataHoraCriacao") || ""),
    dataReceita: String(get("DataReceita") || ""),
    textoMedicamentos: String(get("TextoMedicamentos") || ""),
    observacoes: String(get("Observacoes") || ""),
    tipoReceita: String(get("TipoReceita") || ""),
    status: String(get("Status") || ""),
    itens: itens
  };
}

// Normaliza item do front para formato canônico interno
function normalizarItemRemedio_(it) {
  if (!it) return null;

  function pick(v) { return v == null ? "" : String(v); }

  var nome = pick(it.remedio || it.nomeRemedio || it.Nome_Remedio || it.medicamento || it.Nome_Medicacao || it.nome || "");
  var idRemedio = pick(it.idRemedio || it.ID_Remedio || it.idMedicamento || it.ID_Medicamento || "");

  return {
    idRemedio: String(idRemedio || "").trim(),
    nomeRemedio: String(nome || "").trim(),
    posologia: String(pick(it.posologia || it.Posologia)).trim(),
    viaAdministracao: String(pick(it.via || it.Via_Administracao || it.viaAdministracao || it.Via)).trim(),
    quantidade: String(pick(it.quantidade || it.Quantidade)).trim(),
    observacao: String(pick(it.observacao || it.Observacao)).trim(),
    ativo: it.ativo !== false
  };
}

function montarTextoMedicamentos_(itensCanonicos) {
  if (!Array.isArray(itensCanonicos) || !itensCanonicos.length) return "";

  var linhas = itensCanonicos
    .filter(function (it) { return it && it.ativo && (it.nomeRemedio || it.posologia); })
    .map(function (it, index) {
      var nome = String(it.nomeRemedio || "").trim();
      var pos = String(it.posologia || "").trim();

      var extras = [];
      if (it.quantidade) extras.push("Qtde: " + String(it.quantidade).trim());
      if (it.viaAdministracao) extras.push("Via: " + String(it.viaAdministracao).trim());
      if (it.observacao) extras.push("Obs: " + String(it.observacao).trim());

      var linha = (index + 1) + ") " + nome;
      if (pos) linha += " — " + pos;
      if (extras.length) linha += " | " + extras.join(" | ");
      return linha;
    });

  return linhas.join("\n\n");
}

function receitaSalvar_(payload, status) {
  try {
    payload = payload || {};
    status = String(status || "FINAL").toUpperCase();

    var idPaciente = String(payload.idPaciente || payload.ID_Paciente || "").trim();
    var dataReceita = String(payload.dataReceita || payload.DataReceita || "").trim();
    var observacoes = String(payload.observacoes || payload.Observacoes || "").trim();

    var itensRaw = Array.isArray(payload.itens) ? payload.itens : (Array.isArray(payload.Itens) ? payload.Itens : []);
    if (!idPaciente) _receitaThrow_("RECEITA_MISSING_ID_PACIENTE", "idPaciente é obrigatório.", null);
    if (!itensRaw.length) _receitaThrow_("RECEITA_MISSING_ITENS", "Informe ao menos 1 item.", null);

    var itensCanonicos = itensRaw.map(normalizarItemRemedio_).filter(function (x) {
      return x && x.ativo && (x.nomeRemedio || x.posologia);
    });
    if (!itensCanonicos.length) _receitaThrow_("RECEITA_ITENS_INVALIDOS", "Itens inválidos/sem nome.", null);

    var texto = montarTextoMedicamentos_(itensCanonicos);
    if (!texto) _receitaThrow_("RECEITA_TEXTO_VAZIO", "Texto de medicamentos vazio.", null);

    var sheet = getReceitaSheet_();
    var headerMap = getReceitaHeaderMap_();
    var lastCol = sheet.getLastColumn();
    var nextRow = sheet.getLastRow() + 1;

    var idReceita = Utilities.getUuid();
    var criadoEm = new Date().toISOString();

    var linha = new Array(lastCol).fill("");

    function set(col, val) {
      var idx = headerMap[col];
      if (idx == null) return;
      linha[idx] = val;
    }

    set("ID_Receita", idReceita);
    set("ID_Paciente", idPaciente);
    set("DataHoraCriacao", criadoEm);
    set("DataReceita", dataReceita);
    set("TextoMedicamentos", texto);
    set("Observacoes", observacoes);
    set("TipoReceita", "Comum"); // (front aceita COMUM/Comum)
    set("Status", status);
    set("ItensJson", JSON.stringify(itensCanonicos));

    sheet.getRange(nextRow, 1, 1, lastCol).setValues([linha]);

    var receitaObj = buildReceitaFromRow_(linha, headerMap);
    return { idReceita: idReceita, receita: receitaObj };
  } catch (err) {
    if (err && err.code) throw err;
    _receitaThrow_(
      "RECEITA_SAVE_ERROR",
      "Falha ao salvar receita.",
      String(err && err.message ? err.message : err)
    );
  }
}

function receitaListarPorPaciente_(payload) {
  payload = payload || {};
  var idPaciente = String(payload.idPaciente || payload.ID_Paciente || "").trim();
  if (!idPaciente) _receitaThrow_("RECEITA_MISSING_ID_PACIENTE", "idPaciente é obrigatório.", null);

  var sheet = getReceitaSheet_();
  var headerMap = getReceitaHeaderMap_();
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2) return { receitas: [] };

  var values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var idxIdPac = headerMap["ID_Paciente"];
  if (idxIdPac == null) return { receitas: [] };

  var receitas = [];
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    if (String(row[idxIdPac]) === String(idPaciente)) {
      receitas.push(buildReceitaFromRow_(row, headerMap));
    }
  }

  receitas.sort(function (a, b) {
    var da = Date.parse(a.dataHoraCriacao || "") || 0;
    var db = Date.parse(b.dataHoraCriacao || "") || 0;
    return db - da;
  });

  return { receitas: receitas };
}

/* ============================================================
 * PDF/HTML (Impressão)
 * ============================================================ */

function receitaGerarPdf_(payload) {
  payload = payload || {};
  var idReceita = String(payload.idReceita || payload.ID_Receita || "").trim();
  if (!idReceita) {
    _receitaThrow_("RECEITA_MISSING_ID_RECEITA", "idReceita é obrigatório.", null);
  }

  // busca receita
  var receita = receitaBuscarPorId_(idReceita);
  if (!receita || !receita.idReceita) {
    _receitaThrow_("RECEITA_NOT_FOUND", "Receita não encontrada: " + idReceita, { idReceita: idReceita });
  }

  // dados “opcionais”
  var pacienteNome = "";
  try {
    if (typeof PRONTIO_getPacienteNomeById_ === "function") {
      pacienteNome = String(PRONTIO_getPacienteNomeById_(receita.idPaciente) || "");
    }
  } catch (e) {
    pacienteNome = "";
  }

  // cabeçalho médico
  var cab = receitaObterCabecalhoMedico_();

  // data (preferir DataReceita; fallback criadoEm)
  var dataRef = String(receita.dataReceita || "").trim();
  var dataFmt = receitaFormatarDataBR_(dataRef);
  if (!dataFmt) dataFmt = receitaFormatarDataBR_(String(receita.dataHoraCriacao || ""));

  var html = receitaRenderHtml_(receita, {
    pacienteNome: pacienteNome,
    dataFmt: dataFmt,
    cabecalho: cab
  });

  return { html: html };
}

function receitaBuscarPorId_(idReceita) {
  var sheet = getReceitaSheet_();
  var headerMap = getReceitaHeaderMap_();
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2) return null;

  var values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var idxId = headerMap["ID_Receita"];
  if (idxId == null) return null;

  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    if (String(row[idxId]) === String(idReceita)) {
      return buildReceitaFromRow_(row, headerMap);
    }
  }
  return null;
}

function receitaObterCabecalhoMedico_() {
  var out = {
    nomeMedico: "Dr. Marco Antônio Comper",
    crm: "CRM —",
    rqe: "",
    especialidade: "",
    telefone: "",
    email: "",
    enderecoLinha1: "",
    enderecoLinha2: "",
    logoDataUrl: ""
  };

  try {
    if (typeof PRONTIO_getDocsCabecalhoAtivo_ === "function") {
      var cab = PRONTIO_getDocsCabecalhoAtivo_();
      if (cab && typeof cab === "object") {
        out.nomeMedico = cab.nomeMedico || out.nomeMedico;
        out.crm = cab.crm || out.crm;
        out.rqe = cab.rqe || out.rqe;
        out.especialidade = cab.especialidade || out.especialidade;
        out.telefone = cab.telefone || out.telefone;
        out.email = cab.email || out.email;
        out.enderecoLinha1 = cab.enderecoLinha1 || out.enderecoLinha1;
        out.enderecoLinha2 = cab.enderecoLinha2 || out.enderecoLinha2;
        out.logoDataUrl = cab.logoDataUrl || out.logoDataUrl;
      }
    }
  } catch (e) {}

  return out;
}

function receitaRenderHtml_(receita, opts) {
  opts = opts || {};
  var cab = opts.cabecalho || {};
  var pacienteNome = String(opts.pacienteNome || "");
  var dataFmt = String(opts.dataFmt || "");

  var titulo = "Receita";
  var tipo = String(receita.tipoReceita || "").trim();
  if (tipo) titulo = "Receita (" + tipo + ")";

  var meds = String(receita.textoMedicamentos || "").trim();
  var obs = String(receita.observacoes || "").trim();

  var pacienteLinha = "";
  if (pacienteNome) pacienteLinha = "Paciente: " + receitaEscapeHtml_(pacienteNome) + " ";
  pacienteLinha += "(ID: " + receitaEscapeHtml_(String(receita.idPaciente || "")) + ")";

  var logoHtml = "";
  if (cab.logoDataUrl) {
    logoHtml = '<img class="logo" src="' + receitaEscapeAttr_(cab.logoDataUrl) + '" alt="Logo" />';
  }

  var cabLinha2 = [];
  if (cab.especialidade) cabLinha2.push(receitaEscapeHtml_(cab.especialidade));
  if (cab.crm) cabLinha2.push(receitaEscapeHtml_(cab.crm));
  if (cab.rqe) cabLinha2.push("RQE: " + receitaEscapeHtml_(cab.rqe));

  var contato = [];
  if (cab.telefone) contato.push(receitaEscapeHtml_(cab.telefone));
  if (cab.email) contato.push(receitaEscapeHtml_(cab.email));

  var end = [];
  if (cab.enderecoLinha1) end.push(receitaEscapeHtml_(cab.enderecoLinha1));
  if (cab.enderecoLinha2) end.push(receitaEscapeHtml_(cab.enderecoLinha2));

  var html =
'<!doctype html>' +
'<html lang="pt-BR">' +
'<head>' +
'  <meta charset="utf-8" />' +
'  <meta name="viewport" content="width=device-width, initial-scale=1" />' +
'  <title>' + receitaEscapeHtml_(titulo) + '</title>' +
'  <style>' +
'    @page { size: A4; margin: 16mm; }' +
'    * { box-sizing: border-box; }' +
'    body { font-family: Arial, Helvetica, sans-serif; color: #111; }' +
'    .wrap { max-width: 820px; margin: 0 auto; }' +
'    .cab { display: flex; gap: 12px; align-items: flex-start; border-bottom: 2px solid #111; padding-bottom: 10px; }' +
'    .logo { width: 72px; height: 72px; object-fit: contain; }' +
'    .cab-txt { flex: 1; }' +
'    .cab-nome { font-size: 18px; font-weight: 700; line-height: 1.2; }' +
'    .cab-sub { font-size: 12px; margin-top: 2px; }' +
'    .cab-sub2 { font-size: 11px; color: #333; margin-top: 3px; }' +
'    .top-meta { display: flex; justify-content: space-between; margin-top: 12px; font-size: 12px; }' +
'    .titulo { text-align: center; font-size: 18px; font-weight: 800; margin: 18px 0 10px; }' +
'    .box { border: 1px solid #222; border-radius: 8px; padding: 12px; min-height: 360px; white-space: pre-wrap; }' +
'    .obs { margin-top: 10px; font-size: 12px; white-space: pre-wrap; }' +
'    .rodape { margin-top: 22px; display: flex; justify-content: space-between; align-items: flex-end; }' +
'    .assin { width: 55%; border-top: 1px solid #111; padding-top: 6px; font-size: 12px; }' +
'    .assin small { color: #333; }' +
'    .id { font-size: 10px; color: #666; }' +
'    .no-print { margin-top: 14px; font-size: 12px; color: #555; }' +
'    @media print { .no-print { display: none; } }' +
'  </style>' +
'</head>' +
'<body>' +
'  <div class="wrap">' +
'    <div class="cab">' +
'      ' + (logoHtml || '') +
'      <div class="cab-txt">' +
'        <div class="cab-nome">' + receitaEscapeHtml_(cab.nomeMedico || "Médico") + '</div>' +
'        <div class="cab-sub">' + (cabLinha2.length ? cabLinha2.join(" · ") : '') + '</div>' +
'        <div class="cab-sub2">' + (contato.length ? contato.join(" · ") : '') + '</div>' +
'        <div class="cab-sub2">' + (end.length ? end.join(" · ") : '') + '</div>' +
'      </div>' +
'    </div>' +
'    <div class="top-meta">' +
'      <div>' + receitaEscapeHtml_(pacienteLinha) + '</div>' +
'      <div>Data: <strong>' + receitaEscapeHtml_(dataFmt || "—") + '</strong></div>' +
'    </div>' +
'    <div class="titulo">' + receitaEscapeHtml_(titulo) + '</div>' +
'    <div class="box">' + receitaEscapeHtml_(meds || "") + '</div>' +
'    ' + (obs ? '<div class="obs"><strong>Observações:</strong>\n' + receitaEscapeHtml_(obs) + '</div>' : '') +
'    <div class="rodape">' +
'      <div class="assin">' +
'        Assinatura e carimbo<br />' +
'        <small>' + receitaEscapeHtml_(cab.nomeMedico || "") + (cab.crm ? " · " + receitaEscapeHtml_(cab.crm) : "") + '</small>' +
'      </div>' +
'      <div class="id">ID Receita: ' + receitaEscapeHtml_(String(receita.idReceita || "")) + '</div>' +
'    </div>' +
'    <div class="no-print">' +
'      Dica: use Ctrl+P (ou Cmd+P) para imprimir / salvar em PDF.' +
'    </div>' +
'  </div>' +
'  <script>' +
'    // auto-focus; não força auto-print (evita atrapalhar), mas você pode habilitar se quiser:' +
'    // setTimeout(function(){ try{ window.print(); }catch(e){} }, 400);' +
'  </script>' +
'</body>' +
'</html>';

  return html;
}

function receitaFormatarDataBR_(value) {
  if (!value) return "";
  try {
    var s = String(value);
    if (s.indexOf("T") === -1 && s.indexOf("-") > -1 && s.length >= 10) {
      var parts = s.split("T")[0].split("-");
      if (parts.length === 3) return parts[2] + "/" + parts[1] + "/" + parts[0];
    }
  } catch (e) {}

  var d = null;
  try {
    d = new Date(value);
    if (isNaN(d.getTime())) d = null;
  } catch (e) { d = null; }

  if (!d) return "";

  var dd = ("0" + d.getDate()).slice(-2);
  var mm = ("0" + (d.getMonth() + 1)).slice(-2);
  var yy = d.getFullYear();
  return dd + "/" + mm + "/" + yy;
}

function receitaEscapeHtml_(s) {
  s = String(s == null ? "" : s);
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function receitaEscapeAttr_(s) {
  return receitaEscapeHtml_(s).replace(/`/g, "&#096;");
}
