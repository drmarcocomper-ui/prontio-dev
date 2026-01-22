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
