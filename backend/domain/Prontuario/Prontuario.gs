// backend/Prontuario.gs
/**
 * ============================================================
 * PRONTIO - Prontuario.gs
 * ============================================================
 * Fachada do Prontuário.
 * Api.gs envelopa {success,data,errors} => aqui retornamos "data puro".
 *
 * Actions:
 * - Prontuario.Ping
 *
 * ✅ Paciente (resumo do cadastro):
 * - Prontuario.Paciente.ObterResumo
 *
 * Receita (delegado):
 * - Prontuario.Receita.ListarPorPaciente
 * - Prontuario.Receita.ListarPorPacientePaged     ✅ paginação por cursor (ts)
 * - Prontuario.Receita.GerarPDF (alias)
 * - Prontuario.Receita.GerarPdf
 *
 * Evolução (delegado):
 * - Prontuario.Evolucao.ListarPorPaciente
 * - Prontuario.Evolucao.ListarPorPacientePaged    ✅ paginação por cursor (ts)
 * - Prontuario.Evolucao.Salvar
 *
 * Chat (delegado):
 * - Prontuario.Chat.ListByPaciente
 * - Prontuario.Chat.SendByPaciente
 *
 * Timeline unificada (Evolução + Receita + Chat):
 * - Prontuario.Timeline.ListarPorPaciente         ✅ paginação por cursor (ts)
 *
 * ✅ Documentos (retorna {html} pronto para imprimir):
 * - Prontuario.Atestado.GerarPdf
 * - Prontuario.Comparecimento.GerarPdf
 * - Prontuario.Laudo.GerarPdf
 * - Prontuario.Encaminhamento.GerarPdf
 *
 * ✅ Buscas (autocomplete):
 * - Prontuario.CID.Buscar
 * - Prontuario.Encaminhamento.Buscar
 */

function _prontuarioThrow_(code, message, details) {
  var err = new Error(String(message || "Erro."));
  err.code = String(code || "INTERNAL_ERROR");
  err.details = (details === undefined ? null : details);
  throw err;
}

function _prontuarioAssertRequired_(obj, fields) {
  obj = obj || {};
  fields = fields || [];
  var missing = [];

  for (var i = 0; i < fields.length; i++) {
    var k = fields[i];
    var v = obj[k];
    if (v === null || typeof v === "undefined" || String(v).trim() === "") missing.push(k);
  }

  if (missing.length) {
    _prontuarioThrow_(
      "PRONTUARIO_VALIDATION_ERROR",
      "Campos obrigatórios ausentes.",
      { missing: missing }
    );
  }
}

function _prontuarioParseDateMs_(raw) {
  if (!raw) return new Date(0).getTime();
  var d = new Date(raw);
  if (!isNaN(d.getTime())) return d.getTime();
  d = new Date(String(raw).replace(" ", "T"));
  return isNaN(d.getTime()) ? new Date(0).getTime() : d.getTime();
}

function _prontuarioResumo_(text, maxLen) {
  var s = String(text || "").replace(/\r/g, "").trim();
  if (!s) return "";
  if (!maxLen || maxLen < 10) maxLen = 240;
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen - 1) + "…";
}

// ============================================================
// Helpers: normalização / busca (accent-insensitive)
// ============================================================

function _prontuarioNorm_(s) {
  s = String(s || "").trim().toLowerCase();
  if (!s) return "";
  var map = {
    "á":"a","à":"a","â":"a","ã":"a","ä":"a",
    "é":"e","è":"e","ê":"e","ë":"e",
    "í":"i","ì":"i","î":"i","ï":"i",
    "ó":"o","ò":"o","ô":"o","õ":"o","ö":"o",
    "ú":"u","ù":"u","û":"u","ü":"u",
    "ç":"c"
  };
  return s.replace(/[áàâãäéèêëíìîïóòôõöúùûüç]/g, function (ch) { return map[ch] || ch; });
}

function _prontuarioLooksLikeCid_(q) {
  var s = String(q || "").trim().toUpperCase();
  if (!s) return false;
  return /^[A-Z]\d{2}(\.\d{1,2})?$/.test(s) || /^[A-Z]\d{1,2}(\.\d{1,2})?$/.test(s);
}

function _prontuarioClamp_(n, min, max, dflt) {
  n = (n === undefined || n === null) ? dflt : Number(n);
  if (isNaN(n)) n = dflt;
  if (n < min) n = min;
  if (n > max) n = max;
  return Math.floor(n);
}

// ============================================================
// Router do módulo
// ============================================================

function handleProntuarioAction(action, payload) {
  payload = payload || {};
  var act = String(action || "");

  switch (act) {
    case "Prontuario.Ping":
      return { ok: true, module: "Prontuario", ts: new Date().toISOString() };

    // ===================== PACIENTE (RESUMO) ===================
    case "Prontuario.Paciente.ObterResumo":
      _prontuarioAssertRequired_(payload, ["idPaciente"]);
      return _prontuarioPacienteObterResumo_(payload);

    // ===================== RECEITA ============================
    case "Prontuario.Receita.ListarPorPaciente":
      _prontuarioAssertRequired_(payload, ["idPaciente"]);
      return _prontuarioDelegarReceita_("Receita.ListarPorPaciente", payload);

    case "Prontuario.Receita.ListarPorPacientePaged":
      _prontuarioAssertRequired_(payload, ["idPaciente"]);
      return _prontuarioReceitaListarPorPacientePaged_(payload);

    case "Prontuario.Receita.GerarPDF":
      _prontuarioAssertRequired_(payload, ["idReceita"]);
      return _prontuarioDelegarReceita_("Receita.GerarPDF", payload);

    case "Prontuario.Receita.GerarPdf":
      _prontuarioAssertRequired_(payload, ["idReceita"]);
      return _prontuarioDelegarReceita_("Receita.GerarPdf", payload);

    // ===================== EVOLUÇÃO ===========================
    case "Prontuario.Evolucao.ListarPorPaciente":
      _prontuarioAssertRequired_(payload, ["idPaciente"]);
      return _prontuarioDelegarEvolucao_("Evolucao.ListarPorPaciente", payload);

    case "Prontuario.Evolucao.ListarPorPacientePaged":
      _prontuarioAssertRequired_(payload, ["idPaciente"]);
      return _prontuarioEvolucaoListarPorPacientePaged_(payload);

    case "Prontuario.Evolucao.Salvar":
      _prontuarioAssertRequired_(payload, ["idPaciente", "texto"]);
      return _prontuarioDelegarEvolucao_("Evolucao.Salvar", payload);

    // ===================== CHAT ===============================
    case "Prontuario.Chat.ListByPaciente":
      _prontuarioAssertRequired_(payload, ["idPaciente"]);
      return _prontuarioDelegarChat_("Chat.ListByPaciente", payload);

    case "Prontuario.Chat.SendByPaciente":
      _prontuarioAssertRequired_(payload, ["idPaciente", "message"]);
      return _prontuarioDelegarChat_("Chat.SendByPaciente", payload);

    // ===================== TIMELINE ===========================
    case "Prontuario.Timeline.ListarPorPaciente":
      _prontuarioAssertRequired_(payload, ["idPaciente"]);
      return _prontuarioTimelineListarPorPaciente_(payload);

    // ===================== DOCUMENTOS =========================
    case "Prontuario.Atestado.GerarPdf":
      _prontuarioAssertRequired_(payload, ["idPaciente"]);
      return _prontuarioDocAtestadoGerarPdf_(payload);

    case "Prontuario.Comparecimento.GerarPdf":
      _prontuarioAssertRequired_(payload, ["idPaciente"]);
      return _prontuarioDocComparecimentoGerarPdf_(payload);

    case "Prontuario.Laudo.GerarPdf":
      _prontuarioAssertRequired_(payload, ["idPaciente"]);
      return _prontuarioDocLaudoGerarPdf_(payload);

    case "Prontuario.Encaminhamento.GerarPdf":
      _prontuarioAssertRequired_(payload, ["idPaciente"]);
      return _prontuarioDocEncaminhamentoGerarPdf_(payload);

    // ===================== BUSCAS / AUTOCOMPLETE ==============
    case "Prontuario.CID.Buscar":
      return _prontuarioCidBuscar_(payload);

    case "Prontuario.Encaminhamento.Buscar":
      return _prontuarioEncaminhamentoBuscar_(payload);

    default:
      _prontuarioThrow_(
        "PRONTUARIO_UNKNOWN_ACTION",
        "Ação não reconhecida em Prontuario.gs: " + act,
        { action: act }
      );
  }
}

// ============================================================
// Delegadores (handlers existentes)
// ============================================================

function _prontuarioDelegarReceita_(receitaAction, payload) {
  if (typeof handleReceitaAction !== "function") {
    _prontuarioThrow_(
      "PRONTUARIO_RECEITA_HANDLER_MISSING",
      "handleReceitaAction não encontrado. Verifique se Receita.gs está no projeto.",
      { wantedAction: receitaAction }
    );
  }
  return handleReceitaAction(receitaAction, payload || {});
}

function _prontuarioDelegarEvolucao_(evolucaoAction, payload) {
  if (typeof handleEvolucaoAction !== "function") {
    _prontuarioThrow_(
      "PRONTUARIO_EVOLUCAO_HANDLER_MISSING",
      "handleEvolucaoAction não encontrado. Verifique se Evolucao.gs está no projeto.",
      { wantedAction: evolucaoAction }
    );
  }
  return handleEvolucaoAction(evolucaoAction, payload || {});
}

function _prontuarioDelegarChat_(chatAction, payload) {
  if (typeof handleChatAction === "function") {
    return handleChatAction(chatAction, payload || {});
  }
  if (typeof handleChatCompatAction === "function") {
    return handleChatCompatAction(chatAction, payload || {});
  }
  _prontuarioThrow_(
    "PRONTUARIO_CHAT_HANDLER_MISSING",
    "Nenhum handler de Chat encontrado. Verifique se Chat.gs/ChatCompat.gs está no projeto.",
    { wantedAction: chatAction }
  );
}

function _prontuarioDelegarPacientes_(pacientesAction, payload) {
  if (typeof handlePacientesAction === "function") {
    try { return handlePacientesAction(pacientesAction, payload || {}, { action: pacientesAction }); } catch (_) {}
    return handlePacientesAction(pacientesAction, payload || {});
  }
  if (typeof handlePacienteAction === "function") {
    return handlePacienteAction(pacientesAction, payload || {});
  }
  _prontuarioThrow_(
    "PRONTUARIO_PACIENTES_HANDLER_MISSING",
    "Nenhum handler de Pacientes encontrado. Verifique se Pacientes.gs está no projeto.",
    { wantedAction: pacientesAction }
  );
}

// ============================================================
// Paciente: Obter Resumo
// ============================================================

function _prontuarioPacienteObterResumo_(payload) {
  var idPaciente = String(payload.idPaciente || "").trim();

  var raw = null;
  try {
    raw = _prontuarioDelegarPacientes_("Pacientes.ObterPorId", { idPaciente: idPaciente });
  } catch (e) {
    try {
      raw = _prontuarioDelegarPacientes_("Pacientes_ObterPorId", { idPaciente: idPaciente });
    } catch (e2) {
      _prontuarioThrow_(
        "PRONTUARIO_PACIENTE_NOT_FOUND",
        "Não foi possível obter o paciente no módulo Pacientes.",
        { idPaciente: idPaciente, error: String((e2 && e2.message) ? e2.message : e2) }
      );
    }
  }

  var p = (raw && raw.paciente) ? raw.paciente : raw;

    var nome = _prontuarioPickFirst_(p, [
    "nomeCompleto",
    "nomeExibicao",
    "nomeSocial",
    "nome",
    "Nome",
    "NOME"
    // ✅ removido: "nome_paciente", "Nome_Paciente", "nomePaciente"
  ]);

var dn = _prontuarioPickFirst_(p, [
  "dataNascimento",
  "DataNascimento",
  "data_nascimento",
  "nascimento",
  "Nascimento",
  "DATA_NASCIMENTO"
]);

var profissao = _prontuarioPickFirst_(p, [
  "profissao",
  "Profissao",
  "PROFISSAO"
]);

var planoSaude = _prontuarioPickFirst_(p, [
  "planoSaude",
  "PlanoSaude",
  "convenio",
  "Convenio",
  "plano",
  "Plano"
]);

var carteirinha = _prontuarioPickFirst_(p, [
  "numeroCarteirinha",
  "NumeroCarteirinha",
  "carteirinha",
  "Carteirinha",
  "NUMERO_CARTEIRINHA"
]);


  var idade = _prontuarioPickFirst_(p, ["idade", "Idade"]);
  if (!idade) {
    var idadeCalc = _prontuarioCalcIdadeFromAny_(dn);
    if (idadeCalc !== "" && idadeCalc !== null && idadeCalc !== undefined) idade = String(idadeCalc);
  }

  return {
    idPaciente: idPaciente,
    paciente: {
      idPaciente: idPaciente,
      nomeCompleto: nome ? String(nome) : "",
      dataNascimento: dn ? String(dn) : "",
      idade: idade ? String(idade) : "",
      profissao: profissao ? String(profissao) : "",
      planoSaude: planoSaude ? String(planoSaude) : "",
      carteirinha: carteirinha ? String(carteirinha) : ""
    }
  };
}

function _prontuarioPickFirst_(obj, keys) {
  obj = obj || {};
  keys = keys || [];
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    if (obj[k] !== null && typeof obj[k] !== "undefined") {
      var v = String(obj[k]).trim();
      if (v) return v;
    }
  }
  return "";
}

function _prontuarioCalcIdadeFromAny_(raw) {
  if (!raw) return "";

  var s = String(raw).trim();
  if (!s) return "";

  var d = new Date(s);
  if (isNaN(d.getTime())) {
    var m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) {
      d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    } else {
      var m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (m2) {
        d = new Date(Number(m2[1]), Number(m2[2]) - 1, Number(m2[3]));
      }
    }
  }

  if (isNaN(d.getTime())) return "";

  var hoje = new Date();
  var idade = hoje.getFullYear() - d.getFullYear();
  var mDiff = hoje.getMonth() - d.getMonth();
  if (mDiff < 0 || (mDiff === 0 && hoje.getDate() < d.getDate())) idade--;

  if (idade < 0 || idade > 130) return "";
  return idade;
}

// ============================================================
// BUSCAS / AUTOCOMPLETE
// ============================================================

function _prontuarioGetCachedList_(cacheKey, sheetName, ttlSeconds) {
  ttlSeconds = _prontuarioClamp_(ttlSeconds, 30, 60 * 60 * 6, 1800); // default 30min
  var cached = null;

  try {
    if (typeof Cache_getJson_ === "function") cached = Cache_getJson_(cacheKey);
  } catch (_) { cached = null; }

  if (cached && Array.isArray(cached)) return cached;

  if (typeof Repo_list_ !== "function") {
    _prontuarioThrow_(
      "PRONTUARIO_REPO_MISSING",
      "Repo_list_ não disponível (Repository.gs não carregado?).",
      { sheetName: sheetName }
    );
  }

  var list = [];
  try {
    list = Repo_list_(sheetName) || [];
  } catch (_) {
    list = [];
  }

  try {
    if (typeof Cache_setJson_ === "function") Cache_setJson_(cacheKey, list, ttlSeconds);
  } catch (_) {}

  return list;
}

function _prontuarioCidBuscar_(payload) {
  payload = payload || {};
  var q = String(payload.q || "").trim();
  var limit = _prontuarioClamp_(payload.limit, 1, 50, 12);

  if (!q) return { items: [] };

  var list = _prontuarioGetCachedList_("prontuario:cid:list:v1", "CID", 60 * 60 * 6); // 6h
  if (!list.length) return { items: [] };

  var qUp = q.toUpperCase().trim();
  var qNorm = _prontuarioNorm_(q);
  var isCid = _prontuarioLooksLikeCid_(qUp);

  var out = [];
  for (var i = 0; i < list.length; i++) {
    var row = list[i] || {};
    var cid = String(row.CID || row.cid || "").trim().toUpperCase();
    var desc = String(row.Descricao || row.descricao || row.Descrição || "").trim();
    var sinon = String(row.Sinonimos || row.sinonimos || "").trim();

    if (!cid && !desc) continue;

    var hit = false;

    if (isCid) {
      if (cid.indexOf(qUp) === 0) hit = true;
      else if (_prontuarioNorm_(desc).indexOf(qNorm) >= 0) hit = true;
    } else {
      if (_prontuarioNorm_(desc).indexOf(qNorm) >= 0) hit = true;
      else if (sinon && _prontuarioNorm_(sinon).indexOf(qNorm) >= 0) hit = true;
      else if (cid && cid.indexOf(qUp) === 0) hit = true;
    }

    if (!hit) continue;

    out.push({ cid: cid, descricao: desc });
    if (out.length >= limit) break;
  }

  return { items: out };
}

function _prontuarioEncaminhamentoBuscar_(payload) {
  payload = payload || {};
  var q = String(payload.q || "").trim();
  var limit = _prontuarioClamp_(payload.limit, 1, 50, 12);

  if (!q) return { items: [] };

  var list = _prontuarioGetCachedList_("prontuario:encaminhamento:list:v1", "Encaminhamento", 60 * 60); // 1h
  if (!list.length) return { items: [] };

  var qNorm = _prontuarioNorm_(q);

  var out = [];
  for (var i = 0; i < list.length; i++) {
    var row = list[i] || {};

    // Headers exatamente como na aba "Encaminhamento" criada:
    var enc = String(row["Encaminhamento"] || "").trim();
    var nome = String(row["NomeDoProfissional"] || "").trim();
    var aval = String(row["Avaliação"] || "").trim();
    var tel = String(row["Telefone"] || "").trim();

    if (!enc && !nome && !aval && !tel) continue;

    var hay = _prontuarioNorm_(enc + " " + nome + " " + aval + " " + tel);
    if (hay.indexOf(qNorm) < 0) continue;

    out.push({
      encaminhamento: enc,
      nomeProfissional: nome,
      avaliacao: aval,
      telefone: tel
    });

    if (out.length >= limit) break;
  }

  return { items: out };
}

// ============================================================
// Documentos — helpers HTML + geradores
// ============================================================

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
    // ✅ padrão: nomeCompleto
    var nome = p.nomeCompleto || p.nomeExibicao || p.nomeSocial || p.nome || "";
    return String(nome || "").trim() || "—";
  } catch (_) {
    return "—";
  }
}

/**
 * ✅ Se DocsCabecalho.gs estiver presente, usa buildCabecalhoHtml_() no topo.
 * (fallback silencioso se não existir)
 */
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

// --------- ATESTADO (texto oficial + CID estruturado + compat) ---------
function _prontuarioDocAtestadoGerarPdf_(payload) {
  var idPaciente = String(payload.idPaciente || "").trim();
  var dataIso = String(payload.data || "").trim();

  var dias = Number(payload.dias || 0) || 0;

  // compat antigo
  var cidStr = String(payload.cid || "").trim();
  var textoLivre = String(payload.texto || "").trim();

  // novo
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

  // Texto oficial automático se texto livre vier vazio
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

// --------- COMPARECIMENTO (mantido) ---------
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

// --------- LAUDO (mantido) ---------
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

// --------- ENCAMINHAMENTO (estruturado + compat) ---------
function _prontuarioDocEncaminhamentoGerarPdf_(payload) {
  var idPaciente = String(payload.idPaciente || "").trim();
  var dataIso = String(payload.data || "").trim();

  // compat antigo
  var destino = String(payload.destino || "").trim();
  var prioridade = String(payload.prioridade || "").trim();
  var texto = String(payload.texto || "").trim();

  // novo
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

// ============================================================
// Paginação: EVOLUÇÕES (cursor por timestamp)
// (mantido igual ao seu arquivo atual)
// ============================================================

function _prontuarioEvolucaoListarPorPacientePaged_(payload) {
  var idPaciente = String(payload.idPaciente || "").trim();

  var limit = payload && payload.limit ? Number(payload.limit) : 40;
  if (!limit || isNaN(limit) || limit < 1) limit = 40;
  if (limit > 200) limit = 200;

  var cursorRaw = payload && payload.cursor ? String(payload.cursor) : "";
  cursorRaw = cursorRaw ? cursorRaw.trim() : "";
  var cursorMs = cursorRaw ? _prontuarioParseDateMs_(cursorRaw) : null;

  var resp = _prontuarioDelegarEvolucao_("Evolucao.ListarPorPaciente", { idPaciente: idPaciente }) || {};
  var lista =
    (resp && (resp.evolucoes || resp.lista)) ||
    (Array.isArray(resp) ? resp : []) ||
    [];

  lista = (lista || []).slice().sort(function (a, b) {
    var ta = (a && (a.dataHoraRegistro || a.dataHora || a.data || a.criadoEm)) || "";
    var tb = (b && (b.dataHoraRegistro || b.dataHora || b.data || b.criadoEm)) || "";
    return _prontuarioParseDateMs_(tb) - _prontuarioParseDateMs_(ta);
  });

  if (cursorMs !== null && !isNaN(cursorMs)) {
    var filtered = [];
    for (var i = 0; i < lista.length; i++) {
      var ts = (lista[i] && (lista[i].dataHoraRegistro || lista[i].dataHora || lista[i].data || lista[i].criadoEm)) || "";
      var ms = _prontuarioParseDateMs_(ts);
      if (ms < cursorMs) filtered.push(lista[i]);
    }
    lista = filtered;
  }

  var items = lista.slice(0, limit);
  var hasMore = lista.length > limit;

  var nextCursor = null;
  if (items.length) {
    var last = items[items.length - 1];
    nextCursor = String((last && (last.dataHoraRegistro || last.dataHora || last.data || last.criadoEm)) || "").trim() || null;
  }

  return {
    idPaciente: idPaciente,
    limit: limit,
    cursor: cursorRaw || null,
    nextCursor: nextCursor,
    hasMore: !!(hasMore && nextCursor),
    items: items
  };
}

// ============================================================
// Paginação: RECEITAS (cursor por timestamp)
// (mantido igual ao seu arquivo atual)
// ============================================================

function _prontuarioReceitaListarPorPacientePaged_(payload) {
  var idPaciente = String(payload.idPaciente || "").trim();

  var limit = payload && payload.limit ? Number(payload.limit) : 25;
  if (!limit || isNaN(limit) || limit < 1) limit = 25;
  if (limit > 150) limit = 150;

  var cursorRaw = payload && payload.cursor ? String(payload.cursor) : "";
  cursorRaw = cursorRaw ? cursorRaw.trim() : "";
  var cursorMs = cursorRaw ? _prontuarioParseDateMs_(cursorRaw) : null;

  var resp = _prontuarioDelegarReceita_("Receita.ListarPorPaciente", { idPaciente: idPaciente }) || {};
  var lista =
    (resp && (resp.receitas || resp.lista)) ||
    (Array.isArray(resp) ? resp : []) ||
    [];

  lista = (lista || []).slice().sort(function (a, b) {
    var ta = (a && (a.dataHoraCriacao || a.dataHora || a.data || a.criadoEm)) || "";
    var tb = (b && (b.dataHoraCriacao || b.dataHora || b.data || b.criadoEm)) || "";
    return _prontuarioParseDateMs_(tb) - _prontuarioParseDateMs_(ta);
  });

  if (cursorMs !== null && !isNaN(cursorMs)) {
    var filtered = [];
    for (var i = 0; i < lista.length; i++) {
      var ts = (lista[i] && (lista[i].dataHoraCriacao || lista[i].dataHora || lista[i].data || lista[i].criadoEm)) || "";
      var ms = _prontuarioParseDateMs_(ts);
      if (ms < cursorMs) filtered.push(lista[i]);
    }
    lista = filtered;
  }

  var items = lista.slice(0, limit);
  var hasMore = lista.length > limit;

  var nextCursor = null;
  if (items.length) {
    var last = items[items.length - 1];
    nextCursor = String((last && (last.dataHoraCriacao || last.dataHora || last.data || last.criadoEm)) || "").trim() || null;
  }

  return {
    idPaciente: idPaciente,
    limit: limit,
    cursor: cursorRaw || null,
    nextCursor: nextCursor,
    hasMore: !!(hasMore && nextCursor),
    items: items
  };
}

// ============================================================
// Timeline unificada (paginada por cursor)
// (mantido igual ao seu arquivo atual)
// ============================================================

function _prontuarioTimelineListarPorPaciente_(payload) {
  var idPaciente = String(payload.idPaciente || "").trim();

  var limit = payload && payload.limit ? Number(payload.limit) : 80;
  if (!limit || isNaN(limit) || limit < 1) limit = 80;
  if (limit > 300) limit = 300;

  var cursorRaw = payload && payload.cursor ? String(payload.cursor) : "";
  cursorRaw = cursorRaw ? cursorRaw.trim() : "";
  var cursorMs = cursorRaw ? _prontuarioParseDateMs_(cursorRaw) : null;

  var evolucoesResp = _prontuarioDelegarEvolucao_("Evolucao.ListarPorPaciente", { idPaciente: idPaciente }) || {};
  var receitasResp = _prontuarioDelegarReceita_("Receita.ListarPorPaciente", { idPaciente: idPaciente }) || {};
  var chatResp = _prontuarioDelegarChat_("Chat.ListByPaciente", { idPaciente: idPaciente }) || {};

  var evolucoes =
    (evolucoesResp && (evolucoesResp.evolucoes || evolucoesResp.lista)) ||
    (Array.isArray(evolucoesResp) ? evolucoesResp : []) ||
    [];

  var receitas =
    (receitasResp && (receitasResp.receitas || receitasResp.lista)) ||
    (Array.isArray(receitasResp) ? receitasResp : []) ||
    [];

  var mensagens =
    (chatResp && (chatResp.messages || chatResp.mensagens)) ||
    (Array.isArray(chatResp) ? chatResp : []) ||
    [];

  var events = [];

  for (var i = 0; i < evolucoes.length; i++) {
    var ev = evolucoes[i] || {};
    var idE = ev.idEvolucao || ev.ID_Evolucao || ev.id || "";
    var tsE = ev.dataHoraRegistro || ev.dataHora || ev.data || ev.criadoEm || "";
    var textoE = String(ev.texto || "").trim();
    var autorE = ev.autor || ev.profissional || "";
    var origemE = ev.origem || "";

    events.push({
      type: "EVOLUCAO",
      id: String(idE || ""),
      ts: String(tsE || ""),
      title: autorE ? String(autorE) : (origemE ? String(origemE) : ""),
      summary: _prontuarioResumo_(textoE, 320),
      raw: ev
    });
  }

  for (var j = 0; j < receitas.length; j++) {
    var rec = receitas[j] || {};
    var idR = rec.idReceita || rec.ID_Receita || rec.id || "";
    var tsR = rec.dataHoraCriacao || rec.dataHora || rec.data || rec.criadoEm || "";

    var tipoReceita = rec.tipoReceita || rec.TipoReceita || "";
    var status = rec.status || rec.Status || "";
    var dataReceita = rec.dataReceita || rec.DataReceita || "";

    var textoMed = String(rec.textoMedicamentos || rec.TextoMedicamentos || "").trim();
    if (!textoMed && rec.itens && rec.itens.length) {
      textoMed = "Itens: " + rec.itens.length;
    }

    var titleParts = [];
    if (tipoReceita) titleParts.push(String(tipoReceita));
    if (status) titleParts.push(String(status));
    if (dataReceita) titleParts.push("Data: " + String(dataReceita));
    var titleR = titleParts.join(" · ");

    events.push({
      type: "RECEITA",
      id: String(idR || ""),
      ts: String(tsR || ""),
      title: titleR,
      summary: _prontuarioResumo_(textoMed, 260),
      raw: rec
    });
  }

  for (var k = 0; k < mensagens.length; k++) {
    var msg = mensagens[k] || {};
    var idC = msg.id || msg.ID || msg.idMensagem || msg.ID_Mensagem || "";
    var tsC = msg.timestamp || msg.dataHora || msg.criadoEm || "";
    var sender = msg.sender || msg.autor || "";
    var message = String(msg.message || msg.texto || "").trim();

    events.push({
      type: "CHAT",
      id: String(idC || ""),
      ts: String(tsC || ""),
      title: sender ? String(sender) : "",
      summary: _prontuarioResumo_(message, 240),
      raw: msg
    });
  }

  events.sort(function (a, b) {
    return _prontuarioParseDateMs_(b && b.ts) - _prontuarioParseDateMs_(a && a.ts);
  });

  if (cursorMs !== null && !isNaN(cursorMs)) {
    var filteredEvents = [];
    for (var m = 0; m < events.length; m++) {
      var ms = _prontuarioParseDateMs_(events[m] && events[m].ts);
      if (ms < cursorMs) filteredEvents.push(events[m]);
    }
    events = filteredEvents;
  }

  var pageEvents = events.slice(0, limit);
  var hasMore = events.length > limit;

  var nextCursor = null;
  if (pageEvents.length) {
    nextCursor = String(pageEvents[pageEvents.length - 1].ts || "").trim() || null;
  }

  return {
    idPaciente: idPaciente,
    limit: limit,
    cursor: cursorRaw || null,
    nextCursor: nextCursor,
    hasMore: !!(hasMore && nextCursor),
    events: pageEvents
  };
}
