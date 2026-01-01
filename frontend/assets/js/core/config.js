(function (global) {
  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO.config = PRONTIO.config || {};

  const LS_KEYS = {
    API_URL_OVERRIDE: "prontio.apiUrl.override"
  };

  function metaApiUrl_() {
    try {
      const doc = global.document;
      if (!doc || !doc.querySelector) return "";
      const meta = doc.querySelector('meta[name="prontio-api-url"]');
      const v = meta && meta.content ? String(meta.content).trim() : "";
      return v || "";
    } catch (e) {
      return "";
    }
  }

  function localOverrideApiUrl_() {
    try {
      const ls = global.localStorage;
      if (!ls) return "";
      const v = ls.getItem(LS_KEYS.API_URL_OVERRIDE);
      return v ? String(v).trim() : "";
    } catch (_) {
      return "";
    }
  }

  function detectEnv_() {
    const host = (global.location && global.location.hostname) || "";
    const path = (global.location && global.location.pathname) || "";

    if (host === "localhost" || host === "127.0.0.1") return "dev";

    if (host.endsWith("github.io")) {
      if (path.startsWith("/prontio-dev/")) return "dev";
      if (path.startsWith("/prontio-prod/")) return "prod";
      return "dev";
    }

    // Qualquer outro host assume produção
    return "prod";
  }

  const ENV = detectEnv_();

  /**
   * ✅ IMPORTANTE (profissional):
   * Mantenha essas URLs sempre apontando para DEPLOYS que contenham:
   * - Registry_ListActions
   * - Agenda_ListarDia / Agenda_ListarSemana
   * - AgendaConfig_Obter
   *
   * Se apontar para deploy antigo, o front quebra com NOT_FOUND / routeAction_ ausente.
   */
  const API_URLS = {
    dev: "https://script.google.com/macros/s/AKfycbzN7VcgQmUTiXyhZHlfGzSdPkUmBVFHIFSvvizndAkMJTMQ7aWU3rwALxJk9soUP2euBg/exec",
    prod: "https://script.google.com/macros/s/AKfycbwGwSrgphYjR374ftYwbMczqnJzWTZvQXyyfcDGhyHsCGfuxbjd7FfhBEkUHoKrKC6AWQ/exec"
  };

  // ENV normalizado
  PRONTIO.config.env = ENV === "prod" ? "prod" : "dev";

  // ✅ prioridade profissional:
  // 0) override via localStorage (rápido para hotfix, sem rebuild)
  // 1) <meta name="prontio-api-url">
  // 2) URL pelo ENV
  // 3) fallback DEV
  const overrideUrl = localOverrideApiUrl_();
  const metaUrl = metaApiUrl_();

  PRONTIO.config.apiUrl =
    overrideUrl ||
    metaUrl ||
    API_URLS[PRONTIO.config.env] ||
    API_URLS.dev;

  // Expõe para debug/controladoria
  PRONTIO.config.apiUrls = API_URLS;
  PRONTIO.config.metaApiUrl = metaUrl;
  PRONTIO.config.apiUrlOverride = overrideUrl;

  // =========================
  // TIMEOUT DA API
  // =========================
  PRONTIO.config.apiTimeoutMs = 20000;
  PRONTIO.config.apiTimeout = PRONTIO.config.apiTimeoutMs; // alias retrocompat

  // =========================
  // HEALTH CHECK (profissional)
  // =========================
  // Lista mínima do que sua UI da Agenda precisa para funcionar.
  PRONTIO.config.requiredActions = [
    "Registry_ListActions",
    "Agenda_ListarDia",
    "Agenda_ListarSemana",
    "Agenda_ValidarConflito",
    "AgendaConfig_Obter",
    "Pacientes_BuscarSimples"
  ];

  /**
   * ✅ Chame isso no boot (ex.: app.js) depois que PRONTIO.api estiver carregado.
   * - Se estiver apontando para deploy antigo, falha com mensagem clara.
   * - Evita “ficar quebrando” em tempo de uso.
   */
  PRONTIO.config.checkBackend = async function () {
    if (!PRONTIO.api || typeof PRONTIO.api.callApiData !== "function") {
      const e = new Error("PRONTIO.api.callApiData não disponível para health-check.");
      e.code = "CLIENT_API_NOT_READY";
      throw e;
    }

    // 1) Check Registry_ListActions
    let list;
    try {
      list = await PRONTIO.api.callApiData({ action: "Registry_ListActions", payload: {} });
    } catch (err) {
      const e = new Error(
        "Backend inválido/desatualizado: Registry_ListActions falhou. " +
          "Provável API URL apontando para deploy antigo. " +
          "API=" + PRONTIO.config.apiUrl
      );
      e.code = "BACKEND_HEALTHCHECK_FAILED";
      e.details = { apiUrl: PRONTIO.config.apiUrl, original: err && (err.code || err.message) };
      throw e;
    }

    const actions = (list && list.actions && Array.isArray(list.actions)) ? list.actions : [];
    const missing = [];

    for (let i = 0; i < PRONTIO.config.requiredActions.length; i++) {
      const a = PRONTIO.config.requiredActions[i];
      if (actions.indexOf(a) < 0) missing.push(a);
    }

    if (missing.length) {
      const e = new Error(
        "Backend desatualizado: faltam actions essenciais: " + missing.join(", ") +
          ". API=" + PRONTIO.config.apiUrl
      );
      e.code = "BACKEND_MISSING_ACTIONS";
      e.details = { missing, apiUrl: PRONTIO.config.apiUrl };
      throw e;
    }

    return { ok: true, apiUrl: PRONTIO.config.apiUrl, env: PRONTIO.config.env };
  };

  // Helper: permite trocar API URL rapidamente via console (sem rebuild)
  PRONTIO.config.setApiUrlOverride = function (url) {
    try {
      const v = String(url || "").trim();
      if (!v) {
        global.localStorage.removeItem(LS_KEYS.API_URL_OVERRIDE);
      } else {
        global.localStorage.setItem(LS_KEYS.API_URL_OVERRIDE, v);
      }
      return { ok: true, value: v || null };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  };

  if (global.console) {
    console.info(
      "[PRONTIO.config]",
      "ENV =", PRONTIO.config.env,
      "| API =", PRONTIO.config.apiUrl,
      "| override =", PRONTIO.config.apiUrlOverride ? "YES" : "no",
      "| meta =", PRONTIO.config.metaApiUrl ? "YES" : "no",
      "| TIMEOUT =", PRONTIO.config.apiTimeoutMs + "ms"
    );
  }
})(window);
