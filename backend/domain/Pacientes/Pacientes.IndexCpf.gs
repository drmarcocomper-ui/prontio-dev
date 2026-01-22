// ---------------------------------------------------------------------------
// Índice de CPF (cache) - otimização
// ---------------------------------------------------------------------------

var _PAC_CPF_INDEX_CACHE_KEY_ = "pacientes:cpfIndex:v1";
var _PAC_CPF_INDEX_TTL_SEC_ = 60 * 30; // 30 min

function _pacCacheGet_(key) {
  try {
    if (typeof Cache_getJson_ === "function") return Cache_getJson_(key);
  } catch (_) {}
  return null;
}

function _pacCacheSet_(key, obj, ttl) {
  try {
    if (typeof Cache_setJson_ === "function") Cache_setJson_(key, obj, ttl);
  } catch (_) {}
}

function _pacCacheRemove_(key) {
  try {
    if (typeof Cache_remove_ === "function") Cache_remove_(key);
  } catch (_) {}
}

/**
 * Invalida o índice de CPF (best-effort).
 * Chame após criar/atualizar cpf.
 */
function Pacientes_CpfIndex_Invalidate_() {
  _pacCacheRemove_(_PAC_CPF_INDEX_CACHE_KEY_);
}

/**
 * Constrói índice:
 * {
 *   "12345678901": [{idPaciente, nomeCompleto}, ... até 3],
 *   ...
 * }
 *
 * Usa repo-first: Pacientes_Repo_List_() e pacienteRepoRowToObject_()
 */
function Pacientes_CpfIndex_Build_() {
  var rows = Pacientes_Repo_List_();
  var idx = {};

  for (var i = 0; i < rows.length; i++) {
    var dto = pacienteRepoRowToObject_(rows[i]);
    var id = String(dto.idPaciente || dto.ID_Paciente || "").trim();
    if (!id) continue;

    var cpfDigits = _cpfDigits_(dto.cpf || "");
    if (cpfDigits.length !== 11) continue;

    if (!idx[cpfDigits]) idx[cpfDigits] = [];

    // guarda poucos para não explodir o cache
    if (idx[cpfDigits].length < 3) {
      idx[cpfDigits].push({
        idPaciente: id,
        nomeCompleto: dto.nomeCompleto || dto.nomeExibicao || ""
      });
    }
  }

  return idx;
}

/**
 * Retorna índice do cache (ou constrói).
 */
function Pacientes_CpfIndex_Get_() {
  var cached = _pacCacheGet_(_PAC_CPF_INDEX_CACHE_KEY_);
  if (cached && typeof cached === "object") return cached;

  var built = {};
  try {
    built = Pacientes_CpfIndex_Build_();
  } catch (_) {
    built = {};
  }

  _pacCacheSet_(_PAC_CPF_INDEX_CACHE_KEY_, built, _PAC_CPF_INDEX_TTL_SEC_);
  return built;
}

/**
 * Retorna matches por cpfDigits (até 3)
 */
function Pacientes_CpfIndex_Find_(cpfDigits) {
  cpfDigits = String(cpfDigits || "").trim();
  if (cpfDigits.length !== 11) return [];
  var idx = Pacientes_CpfIndex_Get_();
  var arr = idx && idx[cpfDigits] ? idx[cpfDigits] : [];
  return Array.isArray(arr) ? arr : [];
}
