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
