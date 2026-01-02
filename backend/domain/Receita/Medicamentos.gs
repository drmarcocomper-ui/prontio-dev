/**
 * PRONTIO - Medicamentos.gs (Apps Script)
 *
 * PADRÃO PRONTIO:
 * - Este módulo retorna SOMENTE "data" (objeto puro).
 * - Em erro, lança Error com err.code/err.details.
 * - Quem envelopa { success, data, errors } é o Api.gs.
 *
 * Alias:
 * - Aceita Remedios.* e Medicamentos.* (mesmo módulo).
 *
 * Ajuste retrocompatível:
 * - Substitui "throw { ... }" por Error com err.code/err.details.
 */

function _medThrow_(code, message, details) {
  var err = new Error(String(message || "Erro."));
  err.code = String(code || "INTERNAL_ERROR");
  err.details = (details === undefined ? null : details);
  throw err;
}

function handleMedicamentosAction(action, payload) {
  payload = payload || {};
  var act = String(action || "");

  // ✅ Alias canônico Remedios.* -> Medicamentos.*
  if (act.indexOf("Remedios.") === 0) act = act.replace("Remedios.", "Medicamentos.");
  if (act.indexOf("Remedios_") === 0) act = act.replace("Remedios_", "Medicamentos_");

  switch (act) {
    case "Medicamentos.ListarAtivos":
    case "Medicamentos_ListarAtivos":
      return Medicamentos_ListarAtivos_(payload);

    case "Medicamentos.ListarTodos":
    case "Medicamentos_ListarTodos":
      return Medicamentos_ListarTodos_(payload);

    case "Medicamentos.Listar":
    case "Medicamentos_Listar":
      payload = payload || {};
      return (payload.somenteAtivos !== false) ? Medicamentos_ListarAtivos_(payload) : Medicamentos_ListarTodos_(payload);

    default:
      _medThrow_(
        "MEDICAMENTOS_UNKNOWN_ACTION",
        "Ação não reconhecida em Medicamentos.gs: " + act,
        { action: act }
      );
  }
}

function Medicamentos_ListarAtivos_(payload) {
  try {
    payload = payload || {};

    var sh = _medGetOrCreateMedicamentosSheet_();
    var rows = _medReadAll_(sh);

    var q = String(payload.q || payload.termo || "").trim().toLowerCase();
    var limit = Number(payload.limit || payload.limite || 200);
    if (!isFinite(limit) || limit <= 0) limit = 200;
    if (limit > 800) limit = 800;

    var ativos = rows.filter(function (r) {
      return _medToBool_(r.Ativo, true) === true;
    });

    if (q) {
      ativos = ativos.filter(function (r) {
        var nome = String(r.Nome_Medicacao || "").toLowerCase();
        return nome.indexOf(q) >= 0;
      });
    }

    ativos.sort(function (a, b) {
      var fa = _medToBool_(a.Favorito, false) ? 1 : 0;
      var fb = _medToBool_(b.Favorito, false) ? 1 : 0;
      if (fa !== fb) return fb - fa;
      return String(a.Nome_Medicacao || "").toLowerCase()
        .localeCompare(String(b.Nome_Medicacao || "").toLowerCase());
    });

    var total = ativos.length;
    var sliced = ativos.slice(0, limit);

    var medicamentos = sliced.map(function (r) {
      var nome = String(r.Nome_Medicacao || "").trim();
      return {
        ID_Medicamento: String(r.ID_Medicamento || ""),
        idMedicamento: String(r.ID_Medicamento || ""),
        Nome_Medicacao: nome,
        nome: nome,
        Posologia: String(r.Posologia || ""),
        Via_Administracao: String(r.Via_Administracao || ""),
        Quantidade: String(r.Quantidade || ""),
        Tipo_Receita: String(r.Tipo_Receita || ""),
        favorito: _medToBool_(r.Favorito, false),
        ativo: _medToBool_(r.Ativo, true)
      };
    });

    var remedios = medicamentos.map(function (m) {
      return {
        ID_Remedio: m.ID_Medicamento,
        idRemedio: m.idMedicamento,
        Nome_Remedio: m.Nome_Medicacao,
        nomeRemedio: m.nome,
        remedio: m.nome,
        Posologia: m.Posologia,
        Via_Administracao: m.Via_Administracao,
        Quantidade: m.Quantidade,
        Tipo_Receita: m.Tipo_Receita,
        favorito: m.favorito,
        ativo: m.ativo
      };
    });

    return {
      medicamentos: medicamentos,
      remedios: remedios,
      total: total,
      retornados: medicamentos.length
    };
  } catch (err) {
    _medThrow_(
      "MEDICAMENTOS_LISTAR_ATIVOS_ERROR",
      "Falha ao listar medicamentos ativos.",
      {
        err: String(err && err.message ? err.message : err),
        stack: (err && err.stack) ? String(err.stack) : null
      }
    );
  }
}

function Medicamentos_ListarTodos_(payload) {
  try {
    payload = payload || {};
    var sh = _medGetOrCreateMedicamentosSheet_();
    var rows = _medReadAll_(sh);
    return { medicamentos: rows, total: rows.length, retornados: rows.length };
  } catch (err) {
    _medThrow_(
      "MEDICAMENTOS_LISTAR_TODOS_ERROR",
      "Falha ao listar todos os medicamentos.",
      String(err && err.message ? err.message : err)
    );
  }
}

/* ============ Helpers internos ============ */

function _medGetOrCreateMedicamentosSheet_() {
  var ss;
  try {
    ss = PRONTIO_getDb_();
  } catch (e) {
    throw new Error("PRONTIO_getDb_ falhou: " + (e && e.message ? e.message : e));
  }

  if (!ss) throw new Error("PRONTIO_getDb_ retornou null/undefined.");

  var preferredName = "Medicamentos";
  var legacyName = "MEDICAMENTOS";

  var header = [
    "ID_Medicamento",
    "Nome_Medicacao",
    "Posologia",
    "Via_Administracao",
    "Quantidade",
    "Tipo_Receita",
    "Favorito",
    "Ativo",
    "CriadoEmISO",
    "AtualizadoEmISO"
  ];

  var sh = ss.getSheetByName(preferredName) || ss.getSheetByName(legacyName);
  if (!sh) {
    sh = ss.insertSheet(preferredName);
    sh.appendRow(header);
  }

  return sh;
}

function _medReadAll_(sh) {
  var lastRow = sh.getLastRow();
  var lastCol = sh.getLastColumn();
  if (lastRow < 2) return [];

  var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
  var values = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();

  return values.map(function (row) {
    var obj = {};
    headers.forEach(function (h, i) { obj[h] = row[i]; });
    return obj;
  });
}

function _medToBool_(v, defaultVal) {
  if (v === true || v === false) return v;
  if (v == null || v === "") return Boolean(defaultVal);

  var s = String(v).trim().toLowerCase();
  if (s === "true" || s === "t" || s === "1" || s === "sim" || s === "yes") return true;
  if (s === "false" || s === "f" || s === "0" || s === "não" || s === "nao" || s === "no") return false;

  return Boolean(defaultVal);
}
