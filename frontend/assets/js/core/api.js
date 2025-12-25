/**
 * PRONTIO - Camada oficial de API (Front-end)
 *
 * ✅ Transporte CORS-free (GitHub Pages + Apps Script):
 * - Usa JSONP via <script> com callback=
 * - Requer Api.gs suportando callback no doGet quando action estiver presente.
 *
 * Melhorias (retrocompatíveis):
 * - Anti-cache no JSONP (evita respostas cacheadas)
 * - Timeout configurável via PRONTIO.config.apiTimeoutMs
 * - Proteção se JSON.stringify(payload) falhar
 */

(function (global) {
  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO.api = PRONTIO.api || {};

  function getApiUrl_() {
    if (PRONTIO.config && PRONTIO.config.apiUrl) return PRONTIO.config.apiUrl;
    if (global.PRONTIO_API_URL) return global.PRONTIO_API_URL;

    const body = global.document && global.document.body;
    if (body && body.dataset && body.dataset.apiUrl) return body.dataset.apiUrl;

    const meta =
      global.document && global.document.querySelector
        ? global.document.querySelector('meta[name="prontio-api-url"]')
        : null;
    if (meta && meta.content) return meta.content;

    return "";
  }

  function getTimeoutMs_() {
    const t = PRONTIO.config && typeof PRONTIO.config.apiTimeoutMs === "number"
      ? PRONTIO.config.apiTimeoutMs
      : null;
    // default conservador (mantém o comportamento atual)
    return (t && t > 0) ? t : 20000;
  }

  function normalizeError_(err) {
    if (!err) return "Erro desconhecido";
    if (typeof err === "string") return err;
    if (err.message) return err.message;
    try { return JSON.stringify(err); } catch (_) { return String(err); }
  }

  function ensureEnvelope_(json) {
    if (!json || typeof json !== "object") throw new Error("Resposta inválida da API (não é JSON objeto).");
    if (!("success" in json) || !("data" in json) || !("errors" in json)) {
      throw new Error("Resposta inválida da API (envelope fora do padrão PRONTIO).");
    }
    if (!Array.isArray(json.errors)) json.errors = [];
    return json;
  }

  function getPrimaryError_(envelope) {
    const errs = (envelope && envelope.errors) || [];
    if (!errs.length) return { code: "UNKNOWN", message: "Falha na operação (success=false).", details: null };
    const e0 = errs[0] || {};
    return {
      code: e0.code || "UNKNOWN",
      message: e0.message ? String(e0.message) : String(e0),
      details: typeof e0.details === "undefined" ? null : e0.details,
    };
  }

  function normalizeAction_(action) {
    const a = String(action || "").trim();
    if (!a) return "";
    if (a.indexOf("Remedios.") === 0) return "Medicamentos." + a.substring("Remedios.".length);
    if (a.indexOf("Remedios_") === 0) return "Medicamentos_" + a.substring("Remedios_".length);
    return a;
  }

  function getAuthToken_() {
    try {
      if (PRONTIO.auth && typeof PRONTIO.auth.getToken === "function") {
        const t = PRONTIO.auth.getToken();
        if (t) return String(t);
      }
    } catch (_) {}

    try {
      const ls = global.localStorage;
      if (!ls) return "";
      const t1 = ls.getItem("prontio.auth.token");
      if (t1) return String(t1);
      const t2 = ls.getItem("prontio_auth_token");
      if (t2) return String(t2);
    } catch (_) {}

    return "";
  }

  function withAuthToken_(payload) {
    const p = payload && typeof payload === "object" ? { ...payload } : {};
    if (!p.token) {
      const token = getAuthToken_();
      if (token) p.token = token;
    }
    return p;
  }

  const UX_AUTH_KEYS = { LAST_AUTH_REASON: "prontio.auth.lastAuthReason" };

  function shouldAutoLogout_(errCode) {
    const c = String(errCode || "").toUpperCase();
    return (
      c === "AUTH_REQUIRED" ||
      c === "AUTH_EXPIRED" ||
      c === "AUTH_TOKEN_EXPIRED" ||
      c === "AUTH_NO_TOKEN" ||
      c === "PERMISSION_DENIED"
    );
  }

  function saveAuthReason_(code) {
    try {
      if (!global.localStorage) return;
      global.localStorage.setItem(UX_AUTH_KEYS.LAST_AUTH_REASON, String(code || "AUTH_REQUIRED"));
    } catch (_) {}
  }

  function tryAutoLogout_(reasonCode) {
    try {
      saveAuthReason_(reasonCode);
      if (PRONTIO.auth && typeof PRONTIO.auth.clearSession === "function") PRONTIO.auth.clearSession();
      if (PRONTIO.auth && typeof PRONTIO.auth.requireAuth === "function") PRONTIO.auth.requireAuth({ redirect: true });
    } catch (_) {}
  }

  // ✅ FIX: evita TDZ/ReferenceError se timeout ocorrer antes do <script> existir.
  function jsonp_(url, timeoutMs) {
    timeoutMs = typeof timeoutMs === "number" ? timeoutMs : getTimeoutMs_();

    return new Promise((resolve, reject) => {
      const cbName = "__prontio_jsonp_cb_" + Date.now() + "_" + Math.floor(Math.random() * 1e6);
      let done = false;

      let script = null;
      let timer = null;

      const cleanup = () => {
        try { delete global[cbName]; } catch (_) { global[cbName] = undefined; }
        if (script && script.parentNode) script.parentNode.removeChild(script);
        if (timer) clearTimeout(timer);
      };

      timer = setTimeout(() => {
        if (done) return;
        done = true;
        cleanup();
        reject(new Error("Timeout ao chamar API (JSONP)."));
      }, timeoutMs);

      global[cbName] = (data) => {
        if (done) return;
        done = true;
        cleanup();
        resolve(data);
      };

      script = document.createElement("script");
      script.async = true;
      script.src = url + (url.indexOf("?") >= 0 ? "&" : "?") + "callback=" + encodeURIComponent(cbName);

      script.onerror = () => {
        if (done) return;
        done = true;
        cleanup();
        reject(new Error("Falha de rede ao chamar API (JSONP)."));
      };

      document.head.appendChild(script);
    });
  }

  function safeStringify_(obj) {
    try {
      return JSON.stringify(obj || {});
    } catch (e) {
      // Mantém contrato: ainda chama API, mas com erro explícito do lado cliente
      const err = new Error("Falha ao serializar payload (JSON.stringify).");
      err.code = "CLIENT_PAYLOAD_SERIALIZE_ERROR";
      err.details = { message: normalizeError_(e) };
      throw err;
    }
  }

  function withNoCacheParam_(url) {
    // Evita cache de GET/JSONP em browsers/CDNs
    const nonce = Date.now().toString(36) + "_" + Math.floor(Math.random() * 1e9).toString(36);
    return url + (url.indexOf("?") >= 0 ? "&" : "?") + "_nc=" + encodeURIComponent(nonce);
  }

  async function callApiEnvelope(args) {
    const apiUrl = getApiUrl_();
    if (!apiUrl) throw new Error("URL da API não configurada (apiUrl).");

    const actionRaw = args && args.action ? String(args.action) : "";
    const action = normalizeAction_(actionRaw);
    if (!action) throw new Error("Parâmetro obrigatório ausente: action");

    const payloadRaw = (args && args.payload) || {};
    const payload = withAuthToken_(payloadRaw);

    const payloadStr = safeStringify_(payload || {});

    let url =
      apiUrl +
      (apiUrl.indexOf("?") >= 0 ? "&" : "?") +
      "action=" + encodeURIComponent(action) +
      "&payload=" + encodeURIComponent(payloadStr);

    url = withNoCacheParam_(url);

    let json;
    try {
      json = await jsonp_(url, getTimeoutMs_());
    } catch (e) {
      throw new Error("Falha de rede ao chamar API: " + normalizeError_(e));
    }

    return ensureEnvelope_(json);
  }

  function assertSuccess_(envelope) {
    if (envelope && envelope.success) return;

    const primary = getPrimaryError_(envelope);

    if (shouldAutoLogout_(primary.code)) {
      tryAutoLogout_(primary.code);
    }

    const msg = primary.code && primary.code !== "UNKNOWN"
      ? `[${primary.code}] ${primary.message}`
      : primary.message;

    const err = new Error(msg);
    err.code = primary.code;
    err.details = primary.details;
    throw err;
  }

  async function callApiData(args) {
    const envelope = await callApiEnvelope(args);
    assertSuccess_(envelope);
    return envelope.data;
  }

  PRONTIO.api.callApiEnvelope = callApiEnvelope;
  PRONTIO.api.callApiData = callApiData;
  PRONTIO.api.assertSuccess = assertSuccess_;

  global.callApi = callApiEnvelope;
  global.callApiData = callApiData;

})(window);
