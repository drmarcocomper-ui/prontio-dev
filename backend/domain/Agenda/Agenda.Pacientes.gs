// ✅ NomeCompleto (resolução por idPaciente) — usado pelas actions NOVAS e LEGACY
var _agendaPacienteCache_ = null;

function _agendaTryGetPacienteById_(idPaciente) {
  var id = String(idPaciente || "").trim();
  if (!id) return null;

  if (!_agendaPacienteCache_) _agendaPacienteCache_ = {};
  if (Object.prototype.hasOwnProperty.call(_agendaPacienteCache_, id)) return _agendaPacienteCache_[id];

  var p = null;
  try {
    p = Repo_getById_("Pacientes", "idPaciente", id);
  } catch (_) {
    p = null;
  }

  _agendaPacienteCache_[id] = p;
  return p;
}

function _agendaGetNomeCompletoOficial_(pacienteObj) {
  if (!pacienteObj || typeof pacienteObj !== "object") return "";
  return String(pacienteObj.nomeCompleto || "").trim();
}

/**
 * Anexa nomeCompleto ao DTO de agenda (não persiste; só resposta).
 * - Se BLOQUEIO: nomeCompleto="Bloqueio"
 * - Se não: resolve por idPaciente em Pacientes.nomeCompleto
 */
function _agendaAttachNomeCompleto_(dto) {
  dto = _agendaNormalizeRowToDto_(dto || {});
  var tipo = _agendaNormalizeTipo_(dto.tipo);
  var isBloqueio = (tipo === AGENDA_TIPO.BLOQUEIO);

  if (isBloqueio) {
    dto.nomeCompleto = "Bloqueio";
    return dto;
  }

  var nome = "";
  if (dto.idPaciente) {
    var p = _agendaTryGetPacienteById_(dto.idPaciente);
    nome = _agendaGetNomeCompletoOficial_(p);
  }
  dto.nomeCompleto = nome || "(sem nome)";
  return dto;
}
