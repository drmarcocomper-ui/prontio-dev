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
  const FETCH_TIMEOUT_MS = 10000; // ✅ Timeout de 10 segundos para fetch
  const MAX_RETRIES = 2; // ✅ Máximo de tentativas

  // ✅ Helper para adicionar timeout a uma Promise
  function withTimeout_(promise, ms, errorMsg) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(errorMsg || "Timeout"));
      }, ms);

      promise
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }

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
    let failedIds = new Map(); // ✅ IDs que falharam com contador de retries
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
      } catch (err) {
        // ✅ P2: Tratamento de quota exceeded
        const isQuotaError = err && (
          err.name === "QuotaExceededError" ||
          err.code === 22 ||
          err.code === 1014 || // Firefox
          (err.name === "NS_ERROR_DOM_QUOTA_REACHED")
        );

        if (isQuotaError) {
          console.warn("[PacientesCache] localStorage cheio, limpando entradas antigas...");
          // Limpa metade das entradas mais antigas
          try {
            const nomeKeys = Object.keys(nomeById);
            const miniKeys = Object.keys(miniById);
            const halfNome = Math.floor(nomeKeys.length / 2);
            const halfMini = Math.floor(miniKeys.length / 2);

            nomeKeys.slice(0, halfNome).forEach((k) => delete nomeById[k]);
            miniKeys.slice(0, halfMini).forEach((k) => delete miniById[k]);

            // Tenta salvar novamente
            storage.setItem(STORAGE_KEY, JSON.stringify({ nomeById, miniById }));
            console.log("[PacientesCache] Cache reduzido e salvo com sucesso.");
          } catch (_) {
            console.warn("[PacientesCache] Não foi possível salvar no cache após limpeza.");
          }
        }
      }
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
        // ✅ Adiciona timeout de 10 segundos
        const result = await withTimeout_(
          pacientesApi.buscarPorIds(idsToFetch),
          FETCH_TIMEOUT_MS,
          "Timeout ao buscar nomes de pacientes"
        );
        const pacientes = (result && Array.isArray(result.pacientes)) ? result.pacientes : [];

        // ✅ Marca IDs resolvidos (remove de failedIds)
        const resolvedIds = new Set(pacientes.map(p => String(p.idPaciente || p.ID_Paciente || "")));
        resolvedIds.forEach(id => failedIds.delete(id));

        pacientes.forEach((p) => {
          cachePaciente(p);
        });

        // ✅ IDs não retornados são considerados falha
        idsToFetch.forEach(id => {
          if (!resolvedIds.has(id)) {
            handleFailedId_(id);
          }
        });

        // Notifica que nomes foram resolvidos (para re-render)
        if (onNamesResolvedCallback && pacientes.length > 0) {
          onNamesResolvedCallback();
        }
      } catch (e) {
        console.warn("[PacientesCache] Erro ao buscar nomes:", e.message || e);
        // ✅ Todos os IDs falharam - agenda retry se permitido
        idsToFetch.forEach(id => handleFailedId_(id));
      } finally {
        isFetching = false;

        // Se ainda há IDs pendentes, agenda outro fetch
        if (pendingIds.size > 0) {
          scheduleFetch_();
        }
      }
    }

    // ✅ Gerencia IDs que falharam com retry limitado
    function handleFailedId_(id) {
      const retries = failedIds.get(id) || 0;
      if (retries < MAX_RETRIES) {
        failedIds.set(id, retries + 1);
        pendingIds.add(id); // Re-adiciona para retry
      } else {
        // Máximo de retries atingido - não tenta mais
        failedIds.delete(id);
        console.warn("[PacientesCache] Desistindo de buscar nome para ID:", id);
      }
    }

    async function fetchIndividual_(api, ids) {
      isFetching = true;
      let resolved = 0;

      for (const id of ids) {
        try {
          // ✅ Busca com timeout individual
          const result = await withTimeout_(
            api.buscarSimples(id, 1),
            FETCH_TIMEOUT_MS,
            "Timeout ao buscar paciente individual"
          );
          const pacientes = (result && Array.isArray(result.pacientes)) ? result.pacientes : [];
          if (pacientes.length > 0) {
            cachePaciente(pacientes[0]);
            failedIds.delete(id); // ✅ Remove de falhas se sucesso
            resolved++;
          } else {
            handleFailedId_(id); // ✅ Trata como falha para retry
          }
        } catch (_) {
          handleFailedId_(id); // ✅ Agenda retry se permitido
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
