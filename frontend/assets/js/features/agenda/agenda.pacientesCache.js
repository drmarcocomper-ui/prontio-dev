// frontend/assets/js/features/agenda/agenda.pacientesCache.js
/**
 * PRONTIO — Agenda Pacientes Cache (Front)
 * ------------------------------------------------------------
 * Responsável por:
 * - Cache LOCAL de pacientes (nome e mini-dados)
 * - Resolver nomeCompleto a partir de idPaciente sem chamar API
 *
 * Regras:
 * - Não chama API
 * - Não acessa DOM
 */

(function (global) {
  "use strict";

  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO.features = PRONTIO.features || {};
  PRONTIO.features.agenda = PRONTIO.features.agenda || {};

  function createAgendaPacientesCache(state) {
    if (!state) throw new Error("[AgendaPacientesCache] state é obrigatório.");

    // garante chaves no state único
    state.pacienteNomeById = state.pacienteNomeById || {};
    state.pacienteMiniById = state.pacienteMiniById || {};

    function getPacienteId_(p) {
      if (!p) return "";
      return String(p.idPaciente || p.ID_Paciente || "").trim();
    }

    function getNomeCompleto_(p) {
      if (!p) return "";
      return String(p.nomeCompleto || p.nome || "").trim();
    }

    function cachePaciente(p) {
      const id = getPacienteId_(p);
      if (!id) return;

      const nome = getNomeCompleto_(p);
      if (nome) state.pacienteNomeById[id] = nome;

      state.pacienteMiniById[id] = {
        idPaciente: id,
        nomeCompleto: nome || "",
        telefone: String(
          p.telefone ||
          p.telefonePrincipal ||
          p.telefone_principal ||
          p.telefone_paciente ||
          ""
        ).trim(),
        documento: String(
          p.documento ||
          p.cpf ||
          p.documento_paciente ||
          ""
        ).trim()
      };
    }

    /**
     * Resolve nome para um UI agendamento:
     * - prioriza ag.nomeCompleto se existir
     * - senão busca no cache por ID_Paciente/idPaciente
     */
    function resolveNome(ag) {
      if (!ag) return "";

      const direct = String(ag.nomeCompleto || "").trim();
      if (direct) return direct;

      const id = String(ag.ID_Paciente || ag.idPaciente || "").trim();
      if (!id) return "";

      return String(state.pacienteNomeById[id] || "").trim();
    }

    /**
     * Preenche ag.nomeCompleto quando estiver vazio e houver cache.
     */
    function enrichNomeCompleto(list) {
      const arr = Array.isArray(list) ? list : [];
      for (let i = 0; i < arr.length; i++) {
        const ag = arr[i];
        if (!ag) continue;
        if (!String(ag.nomeCompleto || "").trim()) {
          const n = resolveNome(ag);
          if (n) ag.nomeCompleto = n;
        }
      }
      return arr;
    }

    function getMiniById(idPaciente) {
      const id = String(idPaciente || "").trim();
      if (!id) return null;
      return state.pacienteMiniById[id] || null;
    }

    return {
      cachePaciente,
      resolveNome,
      enrichNomeCompleto,
      getMiniById
    };
  }

  PRONTIO.features.agenda.pacientesCache = { createAgendaPacientesCache };

})(window);
