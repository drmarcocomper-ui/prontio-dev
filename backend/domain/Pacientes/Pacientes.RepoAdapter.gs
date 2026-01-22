// ---------------------------------------------------------------------------
// Adapter repo-first para Pacientes (Repository.gs)
// ---------------------------------------------------------------------------

function Pacientes_Repo_List_() {
  if (typeof Repo_list_ !== "function") {
    _pacientesThrow_("INTERNAL_ERROR", "Repo_list_ não disponível (Repository.gs não carregado?).", { missing: "Repo_list_" });
  }
  return Repo_list_(PACIENTES_ENTITY) || [];
}

function Pacientes_Repo_GetById_(idPaciente) {
  if (typeof Repo_getById_ !== "function") {
    _pacientesThrow_("INTERNAL_ERROR", "Repo_getById_ não disponível.", { missing: "Repo_getById_" });
  }
  var id = String(idPaciente || "").trim();
  if (!id) return null;

  var r1 = Repo_getById_(PACIENTES_ENTITY, "idPaciente", id);
  if (r1) return r1;

  // compat
  var r2 = Repo_getById_(PACIENTES_ENTITY, "ID_Paciente", id);
  if (r2) return r2;

  return null;
}

function Pacientes_Repo_Insert_(dto) {
  if (typeof Repo_insert_ !== "function") {
    _pacientesThrow_("INTERNAL_ERROR", "Repo_insert_ não disponível.", { missing: "Repo_insert_" });
  }
  return Repo_insert_(PACIENTES_ENTITY, dto);
}

function Pacientes_Repo_UpdateById_(idPaciente, patch) {
  if (typeof Repo_update_ !== "function") {
    _pacientesThrow_("INTERNAL_ERROR", "Repo_update_ não disponível.", { missing: "Repo_update_" });
  }
  var id = String(idPaciente || "").trim();
  if (!id) return false;

  var ok = Repo_update_(PACIENTES_ENTITY, "idPaciente", id, patch);
  if (ok) return true;

  // fallback compat
  ok = Repo_update_(PACIENTES_ENTITY, "ID_Paciente", id, patch);
  return !!ok;
}

function _pacPick_(obj, keys) {
  obj = obj || {};
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    if (obj[k] !== undefined && obj[k] !== null) {
      var s = String(obj[k]).trim();
      if (s) return obj[k];
    }
  }
  return "";
}
