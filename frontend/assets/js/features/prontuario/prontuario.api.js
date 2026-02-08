(function (global, document) {
  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO.features = PRONTIO.features || {};
  PRONTIO.features.prontuario = PRONTIO.features.prontuario || {};

  const callApiData =
    (PRONTIO.api && PRONTIO.api.callApiData) ||
    global.callApiData ||
    function () {
      return Promise.reject(
        new Error(
          "API não disponível (callApiData indefinido). Verifique se assets/js/core/api.js foi carregado antes."
        )
      );
    };

  // ✅ P4: AbortController para cancelamento de requisições
  let currentAbortController = null;

  /**
   * Cria um novo AbortController e retorna o signal
   * Use para cancelar requisições em andamento quando usuário navega
   */
  function createAbortSignal_() {
    // Cancela requisição anterior se existir
    if (currentAbortController) {
      try { currentAbortController.abort(); } catch (_) {}
    }
    currentAbortController = new AbortController();
    return currentAbortController.signal;
  }

  /**
   * Cancela todas as requisições em andamento
   */
  function cancelPendingRequests_() {
    if (currentAbortController) {
      try { currentAbortController.abort(); } catch (_) {}
      currentAbortController = null;
    }
  }

  // ✅ Timeout rápido para não bloquear a página
  const API_TIMEOUT_MS = 3000;

  function withTimeout_(promise, ms) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error("Timeout: API legada indisponível"));
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

  /**
   * Tenta chamar uma lista de actions até uma funcionar
   * @param {string|string[]} actions - Action ou lista de actions para tentar
   * @param {object} payload - Payload da requisição
   * @param {object} opts - Opções: { signal?: AbortSignal, timeout?: number }
   */
  async function callApiDataTry_(actions, payload, opts) {
    const list = Array.isArray(actions) ? actions : [actions];
    const signal = opts && opts.signal ? opts.signal : null;
    const timeout = opts && opts.timeout ? opts.timeout : API_TIMEOUT_MS;
    let lastErr = null;

    for (let i = 0; i < list.length; i++) {
      const action = list[i];

      // ✅ P4: Verifica se foi cancelado antes de cada tentativa
      if (signal && signal.aborted) {
        const err = new Error("Requisição cancelada");
        err.name = "AbortError";
        throw err;
      }

      try {
        // ✅ Adiciona timeout para não bloquear a página
        const data = await withTimeout_(
          callApiData({ action, payload: payload || {}, signal }),
          timeout
        );
        return data;
      } catch (e) {
        // ✅ P4: Se foi cancelado, propaga o erro imediatamente
        if (e && e.name === "AbortError") throw e;
        lastErr = e;
      }
    }

    throw lastErr || new Error("Falha ao chamar API (todas as actions falharam).");
  }

  PRONTIO.features.prontuario.api = {
    callApiData,
    callApiDataTry_,
    createAbortSignal_,
    cancelPendingRequests_,
  };
})(window, document);
