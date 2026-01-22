function _prontuarioHtmlEscape_(s) {
  s = String(s === null || s === undefined ? "" : s);
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function _prontuarioFmtDataBr_(iso) {
  var s = String(iso || "").trim();
  if (!s) return "";
  var parts = s.split("-");
  if (parts.length !== 3) return s;
  return parts[2] + "/" + parts[1] + "/" + parts[0];
}

function _prontuarioDocGetPacienteNome_(idPaciente) {
  try {
    var resp = _prontuarioPacienteObterResumo_({ idPaciente: idPaciente });
    var p = resp && resp.paciente ? resp.paciente : {};
    var nome = p.nomeCompleto || p.nomeExibicao || p.nomeSocial || p.nome || "";
    return String(nome || "").trim() || "—";
  } catch (_) {
    return "—";
  }
}

function _prontuarioDocBaseHtml_(titulo, pacienteNome, corpoHtml, dataIso) {
  var dataBr = _prontuarioFmtDataBr_(dataIso) || _prontuarioFmtDataBr_(new Date().toISOString().slice(0, 10));
  var nome = _prontuarioHtmlEscape_(pacienteNome || "—");
  var tit = _prontuarioHtmlEscape_(titulo || "Documento");

  var cabecalho = "";
  try {
    if (typeof buildCabecalhoHtml_ === "function") cabecalho = String(buildCabecalhoHtml_() || "");
  } catch (_) {
    cabecalho = "";
  }

  return (
    "<!doctype html><html><head><meta charset='utf-8'>" +
    "<meta name='viewport' content='width=device-width, initial-scale=1.0'>" +
    "<title>" + tit + "</title>" +
    "<style>" +
    "body{font-family:Arial,Helvetica,sans-serif;color:#111827;margin:24px;}" +
    ".wrap{max-width:820px;margin:0 auto;}" +
    ".top{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:1px solid #e5e7eb;padding-bottom:10px;margin-bottom:14px;}" +
    ".title{font-size:18px;font-weight:700;}" +
    ".meta{font-size:12px;color:#6b7280;}" +
    ".box{border:1px solid #e5e7eb;border-radius:10px;padding:14px;}" +
    ".label{font-size:12px;color:#6b7280;margin-bottom:6px;}" +
    ".value{font-size:14px;font-weight:600;margin-bottom:10px;}" +
    ".content{white-space:pre-wrap;font-size:14px;line-height:1.55;color:#111827;}" +
    ".sign{margin-top:22px;display:flex;justify-content:flex-end;}" +
    ".sign .line{width:260px;border-top:1px solid #111827;margin-top:40px;text-align:center;padding-top:6px;font-size:12px;color:#111827;}" +
    "@media print{body{margin:0;} .wrap{max-width:none;margin:0;padding:18px;} }" +
    "</style></head><body><div class='wrap'>" +
    (cabecalho ? cabecalho : "") +
    "<div class='top'><div class='title'>" + tit + "</div>" +
    "<div class='meta'>Data: " + _prontuarioHtmlEscape_(dataBr) + "</div></div>" +
    "<div class='box'>" +
    "<div class='label'>Paciente</div><div class='value'>" + nome + "</div>" +
    corpoHtml +
    "</div>" +
    "<div class='sign'><div class='line'>Assinatura / Carimbo</div></div>" +
    "</div></body></html>"
  );
}

function _prontuarioDocAtestadoGerarPdf_(payload) {
  var idPaciente = String(payload.idPaciente || "").trim();
  var dataIso = String(payload.data || "").trim();

  var dias = Number(payload.dias || 0) || 0;

  var cidStr = String(payload.cid || "").trim();
  var textoLivre = String(payload.texto || "").trim();

  var cidObj = payload && payload.cidObj ? payload.cidObj : null;
  var exibirCid = (payload && payload.exibirCid !== undefined) ? !!payload.exibirCid : true;
  var observacoes = String(payload.observacoes || "").trim();

  var cidCodigo = "";
  var cidDesc = "";
  if (cidObj && typeof cidObj === "object") {
    cidCodigo = String(cidObj.codigo || cidObj.CID || cidObj.cid || "").trim();
    cidDesc = String(cidObj.descricao || cidObj.Descricao || cidObj.descrição || "").trim();
  }

  var pacienteNome = _prontuarioDocGetPacienteNome_(idPaciente);

  var texto = "";
  if (textoLivre) {
    texto = textoLivre;
  } else {
    if (dias > 0) {
      texto =
        "Atesto, para os devidos fins, que o(a) paciente acima identificado(a) esteve sob atendimento médico nesta data, " +
        "necessitando de afastamento de suas atividades por " + String(dias) + " dia(s).";
    } else {
      texto =
        "Atesto, para os devidos fins, que o(a) paciente acima identificado(a) esteve sob atendimento médico nesta data.";
    }
  }

  var corpo = "";
  if (dias > 0) {
    corpo += "<div class='label'>Afastamento</div><div class='content'>" +
      _prontuarioHtmlEscape_(String(dias)) + " dia(s)</div><br>";
  }

  var cidToPrint = "";
  if (exibirCid) {
    if (cidCodigo || cidDesc) {
      cidToPrint = cidCodigo ? cidCodigo : "";
      if (cidDesc) cidToPrint = cidToPrint ? (cidToPrint + " - " + cidDesc) : cidDesc;
    } else if (cidStr) {
      cidToPrint = cidStr;
    }
  }

  if (cidToPrint) {
    corpo += "<div class='label'>CID</div><div class='content'>" + _prontuarioHtmlEscape_(cidToPrint) + "</div><br>";
  }

  corpo += "<div class='label'>Declaração</div><div class='content'>" + _prontuarioHtmlEscape_(texto) + "</div>";

  if (observacoes) {
    corpo += "<br><br><div class='label'>Observações</div><div class='content'>" + _prontuarioHtmlEscape_(observacoes) + "</div>";
  }

  return { html: _prontuarioDocBaseHtml_("Atestado médico", pacienteNome, corpo, dataIso) };
}

function _prontuarioDocComparecimentoGerarPdf_(payload) {
  var idPaciente = String(payload.idPaciente || "").trim();
  var dataIso = String(payload.data || "").trim();

  var entrada = String(payload.entrada || "").trim();
  var saida = String(payload.saida || "").trim();
  var horarioLegacy = String(payload.horario || "").trim();

  var texto = String(payload.texto || "").trim();
  var pacienteNome = _prontuarioDocGetPacienteNome_(idPaciente);

  if (!texto) {
    texto = "Declaro, para os devidos fins, que o(a) paciente acima compareceu a esta unidade para atendimento médico.";
  }

  var corpo = "";

  if (entrada || saida) {
    corpo += "<div class='label'>Horário</div><div class='content'>" +
      _prontuarioHtmlEscape_("Entrada: " + (entrada || "—") + " · Saída: " + (saida || "—")) +
      "</div><br>";
  } else if (horarioLegacy) {
    corpo += "<div class='label'>Horário</div><div class='content'>" +
      _prontuarioHtmlEscape_(horarioLegacy) +
      "</div><br>";
  }

  corpo += "<div class='label'>Declaração</div><div class='content'>" + _prontuarioHtmlEscape_(texto) + "</div>";

  return { html: _prontuarioDocBaseHtml_("Declaração de comparecimento", pacienteNome, corpo, dataIso) };
}

function _prontuarioDocLaudoGerarPdf_(payload) {
  var idPaciente = String(payload.idPaciente || "").trim();
  var dataIso = String(payload.data || "").trim();
  var titulo = String(payload.titulo || "").trim() || "Laudo";
  var texto = String(payload.texto || "").trim();

  var pacienteNome = _prontuarioDocGetPacienteNome_(idPaciente);

  if (!texto) texto = "Descreva o laudo clínico.";

  var corpo =
    "<div class='label'>Título</div><div class='content'>" + _prontuarioHtmlEscape_(titulo) + "</div><br>" +
    "<div class='label'>Conteúdo</div><div class='content'>" + _prontuarioHtmlEscape_(texto) + "</div>";

  return { html: _prontuarioDocBaseHtml_("Laudo", pacienteNome, corpo, dataIso) };
}

function _prontuarioDocEncaminhamentoGerarPdf_(payload) {
  var idPaciente = String(payload.idPaciente || "").trim();
  var dataIso = String(payload.data || "").trim();

  var destino = String(payload.destino || "").trim();
  var prioridade = String(payload.prioridade || "").trim();
  var texto = String(payload.texto || "").trim();

  var encaminhamento = String(payload.encaminhamento || "").trim();
  var nomeProfissional = String(payload.nomeProfissional || "").trim();
  var telefone = String(payload.telefone || "").trim();
  var avaliacao = String(payload.avaliacao || "").trim();
  var observacoes = String(payload.observacoes || "").trim();

  var pacienteNome = _prontuarioDocGetPacienteNome_(idPaciente);

  if (!avaliacao && !texto) {
    texto = "Encaminho o(a) paciente acima para avaliação / seguimento.";
  }

  var servico = encaminhamento || destino;
  var corpoTexto = avaliacao || texto;

  var corpo = "";
  if (servico) {
    corpo += "<div class='label'>Encaminhamento</div><div class='content'>" + _prontuarioHtmlEscape_(servico) + "</div><br>";
  }
  if (nomeProfissional) {
    corpo += "<div class='label'>Profissional</div><div class='content'>" + _prontuarioHtmlEscape_(nomeProfissional) + "</div><br>";
  }
  if (telefone) {
    corpo += "<div class='label'>Telefone</div><div class='content'>" + _prontuarioHtmlEscape_(telefone) + "</div><br>";
  }
  if (prioridade) {
    corpo += "<div class='label'>Prioridade</div><div class='content'>" + _prontuarioHtmlEscape_(prioridade) + "</div><br>";
  }

  corpo += "<div class='label'>Avaliação / Motivo</div><div class='content'>" + _prontuarioHtmlEscape_(corpoTexto) + "</div>";

  if (observacoes) {
    corpo += "<br><br><div class='label'>Observações</div><div class='content'>" + _prontuarioHtmlEscape_(observacoes) + "</div>";
  }

  return { html: _prontuarioDocBaseHtml_("Encaminhamento", pacienteNome, corpo, dataIso) };
}
