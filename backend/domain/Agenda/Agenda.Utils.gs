function _agendaParseDateRequired_(v, fieldName) {
  var d = _agendaParseDate_(v);
  if (!d) _agendaThrow_("VALIDATION_ERROR", "Data inválida: " + String(fieldName || ""), { field: fieldName, value: v });
  return d;
}

function _agendaParseDate_(v) {
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;

  if (typeof v === "number") {
    var dNum = new Date(v);
    return isNaN(dNum.getTime()) ? null : dNum;
  }

  if (typeof v === "string") {
    var dStr = new Date(v);
    if (!isNaN(dStr.getTime())) return dStr;

    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      var parts = v.split("-");
      var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 0, 0, 0, 0);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  }

  return null;
}

function _agendaBuildDateTime_(dateStr, hhmm) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr || ""))) {
    _agendaThrow_("VALIDATION_ERROR", "data inválida (esperado YYYY-MM-DD).", { value: dateStr });
  }
  if (!/^\d{2}:\d{2}$/.test(String(hhmm || ""))) {
    _agendaThrow_("VALIDATION_ERROR", "hora_inicio inválida (esperado HH:MM).", { value: hhmm });
  }

  var p = String(dateStr).split("-");
  var y = Number(p[0]);
  var m = Number(p[1]) - 1;
  var d = Number(p[2]);

  var t = String(hhmm).split(":");
  var H = Number(t[0]);
  var M = Number(t[1]);

  var dt = new Date(y, m, d, H, M, 0, 0);
  if (isNaN(dt.getTime())) _agendaThrow_("VALIDATION_ERROR", "data/hora inválida.", { dateStr: dateStr, hhmm: hhmm });
  return dt;
}

function _agendaFormatDate_(d) {
  var y = d.getFullYear();
  var m = ("0" + (d.getMonth() + 1)).slice(-2);
  var dd = ("0" + d.getDate()).slice(-2);
  return y + "-" + m + "-" + dd;
}

function _agendaFormatHHMM_(d) {
  var h = ("0" + d.getHours()).slice(-2);
  var m = ("0" + d.getMinutes()).slice(-2);
  return h + ":" + m;
}

function _agendaThrow_(code, message, details) {
  var err = new Error(String(message || "Erro."));
  err.code = String(code || "INTERNAL_ERROR");
  err.details = (details === undefined ? null : details);
  throw err;
}
