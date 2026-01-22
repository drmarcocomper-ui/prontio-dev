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

  async function callApiDataTry_(actions, payload) {
    const list = Array.isArray(actions) ? actions : [actions];
    let lastErr = null;

    for (let i = 0; i < list.length; i++) {
      const action = list[i];
      try {
        const data = await callApiData({ action, payload: payload || {} });
        return data;
      } catch (e) {
        lastErr = e;
      }
    }

    throw lastErr || new Error("Falha ao chamar API (todas as actions falharam).");
  }

  PRONTIO.features.prontuario.api = {
    callApiData,
    callApiDataTry_,
  };
})(window, document);
