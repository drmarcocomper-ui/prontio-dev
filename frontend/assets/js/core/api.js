/**
 * PRONTIO - Camada oficial de API (Front-end)
 *
 * Contrato esperado do backend (Apps Script):
 *   { success: boolean, data: any, errors: any[] }
 *
 * Exporta:
 * - PRONTIO.api.callApiEnvelope({ action, payload }) -> envelope completo
 * - PRONTIO.api.callApiData({ action, payload })     -> somente data (throw se success=false)
 *
 * ✅ Patch CORS DEFINITIVO (GitHub Pages + Apps Script WebApp):
 * - NÃO usa fetch (evita CORS/preflight).
 * - Usa JSONP via <script> com querystring:
 *     ?action=...&payload=...&callback=...
 * - Backend já aceita e.parameter.action/e.parameter.payload (Api.gs).
 *
 * ✅ Pilar I (UX sessão):
 * - Ao detectar AUTH_REQUIRED/AUTH_EXPIRED/etc, grava motivo em localStorage
 *   para o login exibir mensagem amigável.
 */

(function (global) {
  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO.api = PRONTIO.api || {};

  // ============================================================
  // Config / URL
  // ============================================================

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

  // ============================================================
  // Helpers
  // ============================================================

  function normalizeError_(err) {
    if (!err) return "Erro desconhecido";
    if (typeof err === "string") return err;
    if (err.message) return err.message;
    try {
      return JSON.stringify(err);
    } catch (e) {
      return String(err);
    }
  }

  function ensureEnvelope_(json) {
    if (!json || typeof json !== "object") {
      throw new Error("Resposta inválida da API (não é JSON objeto).");
    }
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

  // ============================================================
  // ✅ NORMALIZAÇÃO DEFINITIVA (sem quebrar backend atual):
  // - Remedios.*  -> Medicamentos.*  (backend aceita)
  // - Medicamentos.* fica como está
  // ============================================================

  function normalizeAction_(action) {
    const a = String(action || "").trim();
    if (!a) return "";

    if (a.indexOf("Remedios.") === 0) return "Medicamentos." + a.substring("Remedios.".length);
    if (a.indexOf("Remedios_") === 0) return "Medicamentos_" + a.substring("Remedios_".length);

    return a;
  }

  // ============================================================
  // Token injection (mantém como está no seu padrão)
  // ============================================================

  function getAuthToken_() {
    try {
      if (PRONTIO.auth && typeof PRONTIO.auth.getToken === "function") {
        const t = PRONTIO.auth.getToken();
        if (t) return String(t);
      }
    } catch (e) {}

    try {
      const ls = global.localStorage;
      if (!ls) return "";
      const t1 = ls.getItem("prontio.auth.token");
      if (t1) return String(t1);
      const t2 = ls.getItem("prontio_auth_token");
      if (t2) return String(t2);
    } catch (e) {}

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

  // ============================================================
  // Auto-logout opcional + Pilar I (motivo de sessão)
  // ============================================================

  const UX_AUTH_KEYS = {
    LAST_AUTH_REASON: "prontio.auth.lastAuthReason"
  };

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
    } catch (e) {}
  }

  function tryAutoLogout_(reasonCode) {
    try {
      saveAuthReason_(reasonCode);

      if (PRONTIO.auth && typeof PRONTIO.auth.clearSession === "function") {
        PRONTIO.auth.clearSession();
      }
      if (PRONTIO.auth && typeof PRONTIO.auth.requireAuth === "function") {
        PRONTIO.auth.requireAuth({ redirect: true });
      }
    } catch (e) {}
  }

  // ============================================================
  // JSONP transport (CORS-free)
  // ============================================================

  function buildJsonpUrl_(apiUrl, action, payload, callbackName) {
    const u = new URL(apiUrl);

    // garante callback (Api.gs ignora campos desconhecidos; callback é para o wrapper abaixo)
    u.searchParams.set("callback", callbackName);

    u.searchParams.set("action", String(action || ""));
    u.searchParams.set("payload", JSON.stringify(payload || {}));

    return u.toString();
  }

  function jsonp_(url, timeoutMs) {
    timeoutMs = typeof timeoutMs === "number" ? timeoutMs : 15000;

    return new Promise((resolve, reject) => {
      const cbName = "__prontio_jsonp_cb_" + Date.now() + "_" + Math.floor(Math.random() * 1e6);
      let done = false;

      const cleanup = () => {
        try { delete global[cbName]; } catch (_) { global[cbName] = undefined; }
        if (script && script.parentNode) script.parentNode.removeChild(script);
        if (timer) clearTimeout(timer);
      };

      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        cleanup();
        reject(new Error("Timeout ao chamar API (JSONP)."));
      }, timeoutMs);

      // callback global
      global[cbName] = (data) => {
        if (done) return;
        done = true;
        cleanup();
        resolve(data);
      };

      const script = document.createElement("script");
      script.async = true;
      script.src = url.replace("callback=", "callback=" + encodeURIComponent(cbName)); // mantém compat

      script.onerror = () => {
        if (done) return;
        done = true;
        cleanup();
        reject(new Error("Falha de rede ao chamar API (JSONP)."));
      };

      document.head.appendChild(script);
    });
  }

  async function transport_(apiUrl, action, payload) {
    // Apps Script não suporta JSONP nativo; então usamos callback manual.
    const cbName = "__prontio_jsonp_cb_" + Date.now() + "_" + Math.floor(Math.random() * 1e6);
    const url = buildJsonpUrl_(apiUrl, action, payload, cbName);
    return await jsonp_(url, 20000);
  }

  // ============================================================
  // Public API
  // ============================================================

  async function callApiEnvelope(args) {
    const apiUrl = getApiUrl_();
    if (!apiUrl) throw new Error("URL da API não configurada (apiUrl).");

    const actionRaw = args && args.action ? String(args.action) : "";
    const action = normalizeAction_(actionRaw);
    if (!action) throw new Error("Parâmetro obrigatório ausente: action");

    const payloadRaw = (args && args.payload) || {};
    const payload = withAuthToken_(payloadRaw);

    let json;
    try {
      json = await transport_(apiUrl, action, payload);
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

  // Exports
  PRONTIO.api.callApiEnvelope = callApiEnvelope;
  PRONTIO.api.callApiData = callApiData;
  PRONTIO.api.assertSuccess = assertSuccess_;

  // Compat global
  global.callApi = callApiEnvelope;
  global.callApiData = callApiData;

})(window);
