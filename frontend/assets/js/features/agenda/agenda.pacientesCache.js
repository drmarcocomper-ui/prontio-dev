// frontend/assets/js/features/agenda/agenda.pacientesCache.js
/**
 * Cache local (front) para resolver nomeCompleto a partir de idPaciente.
 * - Agenda (backend) NÃO faz join com Pacientes.
 * - Front resolve exibição via cache persistido.
 *
 * ✅ v2: Adicionado fetch automático de nomes não resolvidos via API
 */

(function (global) {
  "use strict";

  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO.features = PRONTIO.features || {};
  PRONTIO.features.agenda = PRONTIO.features.agenda || {};

  const STORAGE_KEY = "prontio.agenda.pacientesCache.v2";
  const FETCH_DEBOUNCE_MS = 300; // Debounce para agrupar múltiplas requisições
  const MAX_IDS_PER_REQUEST = 20; // Máximo de IDs por requisição

  function safeJsonParse(raw, fallback) {
    try {
      if (!raw) return fallback;
      const obj = JSON.parse(raw);
      return obj && typeof obj === "object" ? obj : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function createPacientesCache(storage, state) {
    storage = storage || global.localStorage;

    // maps em memória
    const nomeById = {};
    const miniById = {};

    // ✅ Controle de fetch automático
    let pendingIds = new Set();
    let fetchTimeout = null;
    let isFetching = false;
    let onNamesResolvedCallback = null;

    function load() {
      const raw = storage ? storage.getItem(STORAGE_KEY) : null;
      const data = safeJsonParse(raw, null);
      if (!data) return;

      if (data.nomeById && typeof data.nomeById === "object") {
        Object.keys(data.nomeById).forEach((k) => (nomeById[k] = data.nomeById[k]));
      }
      if (data.miniById && typeof data.miniById === "object") {
        Object.keys(data.miniById).forEach((k) => (miniById[k] = data.miniById[k]));
      }
    }

    function save() {
      if (!storage) return;
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify({ nomeById, miniById }));
      } catch (_) {}
    }

    // ✅ Fetch automático de nomes não resolvidos
    function scheduleFetch_() {
      if (fetchTimeout) clearTimeout(fetchTimeout);
      fetchTimeout = setTimeout(() => {
        fetchTimeout = null;
        executeFetch_();
      }, FETCH_DEBOUNCE_MS);
    }

    async function executeFetch_() {
      if (isFetching || pendingIds.size === 0) return;

      // Pega até MAX_IDS_PER_REQUEST IDs
      const idsToFetch = Array.from(pendingIds).slice(0, MAX_IDS_PER_REQUEST);
      idsToFetch.forEach((id) => pendingIds.delete(id));

      // Obtém API de pacientes
      const pacientesApi = PRONTIO.features?.pacientes?.api?.createPacientesApi
        ? PRONTIO.features.pacientes.api.createPacientesApi(PRONTIO)
        : null;

      if (!pacientesApi || typeof pacientesApi.buscarPorIds !== "function") {
        // Fallback: busca individual via buscarSimples (menos eficiente)
        if (pacientesApi && typeof pacientesApi.buscarSimples === "function") {
          await fetchIndividual_(pacientesApi, idsToFetch);
        }
        return;
      }

      isFetching = true;
      try {
        const result = await pacientesApi.buscarPorIds(idsToFetch);
        const pacientes = (result && Array.isArray(result.pacientes)) ? result.pacientes : [];

        pacientes.forEach((p) => {
          cachePaciente(p);
        });

        // Notifica que nomes foram resolvidos (para re-render)
        if (onNamesResolvedCallback && pacientes.length > 0) {
          onNamesResolvedCallback();
        }
      } catch (e) {
        console.warn("[PacientesCache] Erro ao buscar nomes:", e);
      } finally {
        isFetching = false;

        // Se ainda há IDs pendentes, agenda outro fetch
        if (pendingIds.size > 0) {
          scheduleFetch_();
        }
      }
    }

    async function fetchIndividual_(api, ids) {
      isFetching = true;
      let resolved = 0;

      for (const id of ids) {
        try {
          // Busca pelo ID (pode não funcionar em todas as APIs)
          const result = await api.buscarSimples(id, 1);
          const pacientes = (result && Array.isArray(result.pacientes)) ? result.pacientes : [];
          if (pacientes.length > 0) {
            cachePaciente(pacientes[0]);
            resolved++;
          }
        } catch (_) {
          // Ignora erros individuais
        }
      }

      if (onNamesResolvedCallback && resolved > 0) {
        onNamesResolvedCallback();
      }

      isFetching = false;

      if (pendingIds.size > 0) {
        scheduleFetch_();
      }
    }

    function queueForFetch_(idPaciente) {
      const id = String(idPaciente || "").trim();
      if (!id) return;
      if (nomeById[id]) return; // Já temos o nome
      if (pendingIds.has(id)) return; // Já está na fila

      pendingIds.add(id);
      scheduleFetch_();
    }

    function setOnNamesResolved(callback) {
      onNamesResolvedCallback = typeof callback === "function" ? callback : null;
    }

    function getPacienteId(p) {
      if (!p) return "";
      return String(p.idPaciente || p.ID_Paciente || "").trim();
    }

    function getNome(p) {
      if (!p) return "";
      return String(p.nomeCompleto || p.nome || "").trim();
    }

    function cachePaciente(p) {
      const id = getPacienteId(p);
      if (!id) return;

      const nome = getNome(p);
      if (nome) nomeById[id] = nome;

      miniById[id] = {
        idPaciente: id,
        nomeCompleto: nome || "",
        telefone: String(p.telefone || p.telefonePrincipal || "").trim(),
        documento: String(p.documento || p.cpf || "").trim()
      };

      save();
    }

    function resolveNomeFromId(idPaciente) {
      const id = String(idPaciente || "").trim();
      if (!id) return "";
      return String(nomeById[id] || "").trim();
    }

    function getMiniById(idPaciente) {
      const id = String(idPaciente || "").trim();
      return id ? (miniById[id] || null) : null;
    }

    function enrichUiList(uiList) {
      const list = Array.isArray(uiList) ? uiList : [];
      const unresolvedIds = [];

      for (let i = 0; i < list.length; i++) {
        const ag = list[i];
        if (!ag) continue;

        // id do paciente pode vir em ID_Paciente ou idPaciente
        const id = String(ag.ID_Paciente || ag.idPaciente || "").trim();

        // se já tem nome, ok
        const already = String(ag.nomeCompleto || "").trim();
        if (already) continue;

        // bloqueio
        if (ag.bloqueio === true || String(ag.tipo || "").toUpperCase() === "BLOQUEIO") {
          ag.nomeCompleto = "Bloqueio";
          continue;
        }

        const nome = resolveNomeFromId(id);
        if (nome) {
          ag.nomeCompleto = nome;
        } else if (id) {
          // ✅ Adiciona à fila para fetch automático
          unresolvedIds.push(id);
        }
      }

      // ✅ Agenda fetch para IDs não resolvidos
      unresolvedIds.forEach((id) => queueForFetch_(id));

      return list;
    }

    // inicializa
    load();

    // expõe também no state (opcional)
    if (state) {
      state.pacientesCache_nomeById = nomeById;
      state.pacientesCache_miniById = miniById;
    }

    return {
      cachePaciente,
      resolveNomeFromId,
      getMiniById,
      enrichUiList,
      setOnNamesResolved // ✅ Callback para re-render quando nomes são resolvidos
    };
  }

  PRONTIO.features.agenda.pacientesCache = { createPacientesCache };
})(window);
