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
 * ✅ Patch CORS/Preflight (Apps Script WebApp):
 * - Envia POST como application/x-www-form-urlencoded:
 *   action=...&payload=JSON.stringify(...)
 * - NÃO define headers custom (evita preflight/OPTIONS)
 * - Seu Api.gs já suporta form-urlencoded.
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

  function safeJsonParse_(text) {
    try {
      return JSON.parse(text);
    } catch (e) {
      return null;
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
    // Preferência: PRONTIO.auth.getToken()
    try {
      if (PRONTIO.auth && typeof PRONTIO.auth.getToken === "function") {
        const t = PRONTIO.auth.getToken();
        if (t) return String(t);
      }
    } catch (e) {}

    // Fallback (compat)
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
      // ✅ Pilar I: grava motivo para o login mostrar aviso
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
  // Fetch helpers
  // ============================================================

  async function safeReadText_(resp) {
    try {
      return await resp.text();
    } catch (e) {
      return "";
    }
  }

  /**
   * ✅ Envia como form-urlencoded SEM headers custom para evitar CORS preflight.
   * Api.gs já suporta:
   * - form-urlencoded: action=...&payload={...}
   */
  async function fetchJson_(apiUrl, bodyObj) {
    let resp;

    // Monta body action=...&payload=...
    const action = String(bodyObj && bodyObj.action ? bodyObj.action : "");
    const payload = bodyObj && bodyObj.payload ? bodyObj.payload : {};
    const form = new URLSearchParams();
    form.set("action", action);
    form.set("payload", JSON.stringify(payload || {}));

    try {
      resp = await fetch(apiUrl, {
        method: "POST",
        // ✅ não setar headers aqui
        body: form.toString()
      });
    } catch (e) {
      throw new Error("Falha de rede ao chamar API: " + normalizeError_(e));
    }

    if (!resp.ok) {
      const txt = await safeReadText_(resp);
      const extra = txt ? "\n\n" + txt.slice(0, 600) : "";
      throw new Error(`Erro HTTP ${resp.status} ao chamar API.${extra}`);
    }

    // tenta json direto; se falhar, tenta parse de text
    try {
      return await resp.json();
    } catch (e) {
      const txt = await safeReadText_(resp);
      const parsed = safeJsonParse_(txt);
      if (parsed) return parsed;

      const extra = txt ? "\n\n" + txt.slice(0, 600) : "";
      throw new Error("API não retornou JSON válido: " + normalizeError_(e) + extra);
    }
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

    const json = await fetchJson_(apiUrl, { action, payload });
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
