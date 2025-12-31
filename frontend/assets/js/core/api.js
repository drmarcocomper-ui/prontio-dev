/**
 * PRONTIO - Camada oficial de API (Front-end)
 * - Usa JSONP (Apps Script) com envelope padrão { success, data, errors }
 * - Injeta token automaticamente no payload quando ausente
 *
 * ✅ Padrão profissional mantido:
 * - NÃO existe logoff automático por inatividade aqui.
 * - Existe auto-redirecionamento SOMENTE quando o backend sinaliza
 *   erro de autenticação (token inválido/expirado/ausente).
 *
 * ✅ Ajuste de escalabilidade:
 * - Auto-logout em erro AUTH_* pode ser configurado via:
 *     PRONTIO.config.autoLogoutOnAuthError = true|false
 *   (default: true)
 *
 * ✅ FIX (SEM QUEBRAR):
 * - Não faz auto-logout por PERMISSION_DENIED (normalmente significa falta de role).
 * - Mantém compat: se vier PERMISSION_DENIED com details.reason === "AUTH_REQUIRED",
 *   então trata como auth e pode redirecionar.
 *
 * ✅ MELHORIA (SEM QUEBRAR - PASSO 1.3):
 * - Erro lançado preserva code/details + também anexa:
 *   - err.envelope (envelope completo quando disponível)
 *   - err.errors (array de errors do backend)
 * - Exporta PRONTIO.api.getPrimaryError para o front decidir por code sem duplicar lógica.
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
    const t =
      PRONTIO.config && typeof PRONTIO.config.apiTimeoutMs === "number"
        ? PRONTIO.config.apiTimeoutMs
        : null;
    return t && t > 0 ? t : 20000;
  }

  function normalizeError_(err) {
    if (!err) return "Erro desconhecido";
    if (typeof err === "string") return err;
    if (err.message) return err.message;
    try {
      return JSON.stringify(err);
    } catch (_) {
      return String(err);
    }
  }

  function ensureEnvelope_(json) {
    if (!json || typeof json !== "object")
      throw new Error("Resposta inválida da API (não é JSON objeto).");
    if (!("success" in json) || !("data" in json) || !("errors" in json)) {
      throw new Error("Resposta inválida da API (envelope fora do padrão PRONTIO).");
    }
    if (!Array.isArray(json.errors)) json.errors = [];
    return json;
  }

  function getPrimaryError_(envelope) {
    const errs = (envelope && envelope.errors) || [];
    if (!errs.length) {
      return {
        code: "UNKNOWN",
        message: "Falha na operação (success=false).",
        details: null
      };
    }
    const e0 = errs[0] || {};
    return {
      code: e0.code || "UNKNOWN",
      message: e0.message ? String(e0.message) : String(e0),
      details: typeof e0.details === "undefined" ? null : e0.details
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

  function isAuthErrorCode_(errCode) {
    const c = String(errCode || "").toUpperCase();
    return (
      c === "AUTH_REQUIRED" ||
      c === "AUTH_EXPIRED" ||
      c === "AUTH_TOKEN_EXPIRED" ||
      c === "AUTH_NO_TOKEN"
    );
  }

  /**
   * ✅ FIX (SEM QUEBRAR):
   * - PERMISSION_DENIED não deve derrubar sessão automaticamente.
   * - Porém, se o backend retornar PERMISSION_DENIED com details.reason === "AUTH_REQUIRED",
   *   tratamos como autenticação necessária (compat).
   */
  function shouldAutoLogout_(errCode, errDetails) {
    if (isAuthErrorCode_(errCode)) return true;

    const c = String(errCode || "").toUpperCase();
    if (c !== "PERMISSION_DENIED") return false;

    const reason =
      errDetails && typeof errDetails === "object"
        ? String(errDetails.reason || "").toUpperCase()
        : "";

    // compat: backends antigos podem usar PERMISSION_DENIED + reason AUTH_REQUIRED
    return reason === "AUTH_REQUIRED";
  }

  function isAutoLogoutEnabled_() {
    // default TRUE (mantém padrão profissional existente)
    try {
      if (PRONTIO.config && typeof PRONTIO.config.autoLogoutOnAuthError === "boolean") {
        return PRONTIO.config.autoLogoutOnAuthError;
      }
    } catch (_) {}
    return true;
  }

  function saveAuthReason_(code) {
    try {
      if (!global.localStorage) return;
      global.localStorage.setItem(UX_AUTH_KEYS.LAST_AUTH_REASON, String(code || "AUTH_REQUIRED"));
    } catch (_) {}
  }

  function tryAutoLogout_(reasonCode) {
    // ✅ mantém padrão: ao detectar erro de AUTH (ou compat), encerra sessão e redireciona
    // ✅ respeita flag de config
    if (!isAutoLogoutEnabled_()) return;

    try {
      saveAuthReason_(reasonCode);

      // ✅ Preferencial: centraliza na auth (garante limpeza completa + redirect /login.html)
      if (PRONTIO.auth && typeof PRONTIO.auth.forceLogoutLocal === "function") {
        PRONTIO.auth.forceLogoutLocal(reasonCode || "AUTH_REQUIRED", { redirect: true, clearChat: true });
        return;
      }

      // Fallback compat:
      if (PRONTIO.auth && typeof PRONTIO.auth.clearSession === "function") PRONTIO.auth.clearSession();
      if (PRONTIO.auth && typeof PRONTIO.auth.requireAuth === "function") {
        PRONTIO.auth.requireAuth({ redirect: true });
      }
    } catch (_) {}
  }

  function jsonp_(url, timeoutMs) {
    timeoutMs = typeof timeoutMs === "number" ? timeoutMs : getTimeoutMs_();

    return new Promise((resolve, reject) => {
      const cbName = "__prontio_jsonp_cb_" + Date.now() + "_" + Math.floor(Math.random() * 1e6);
      let done = false;

      let script = null;
      let timer = null;

      const cleanup = () => {
        try {
          delete global[cbName];
        } catch (_) {
          global[cbName] = undefined;
        }
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
      const err = new Error("Falha ao serializar payload (JSON.stringify).");
      err.code = "CLIENT_PAYLOAD_SERIALIZE_ERROR";
      err.details = { message: normalizeError_(e) };
      throw err;
    }
  }

  function withNoCacheParam_(url) {
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

    // ✅ Auto-logout somente em erros de AUTH (e compat PERMISSION_DENIED + reason AUTH_REQUIRED)
    if (shouldAutoLogout_(primary.code, primary.details)) {
      tryAutoLogout_(primary.code);
    }

    const msg =
      primary.code && primary.code !== "UNKNOWN"
        ? `[${primary.code}] ${primary.message}`
        : primary.message;

    const err = new Error(msg);
    err.code = primary.code;
    err.details = primary.details;

    // ✅ PASSO 1.3: preserva envelope e errors para a UI decidir por code
    try {
      err.envelope = envelope || null;
      err.errors = (envelope && Array.isArray(envelope.errors)) ? envelope.errors : [];
      err.requestId = envelope && (envelope.requestId || (envelope.meta && envelope.meta.request_id)) ? (envelope.requestId || envelope.meta.request_id) : null;
      err.action = envelope && envelope.meta && envelope.meta.action ? envelope.meta.action : null;
    } catch (_) {}

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
  PRONTIO.api.getPrimaryError = getPrimaryError_;

  // ✅ Globals (para debug e compat)
  global.callApi = callApiEnvelope;
  global.callApiEnvelope = callApiEnvelope; // alias
  global.callApiData = callApiData;

})(window);
