// frontend/assets/js/core/session.js
// Controle da sessão do usuário no front-end.
// - guarda usuário logado
// - guarda últimos IDs acessados (ex.: último paciente)
// - controla timeout de inatividade (somente no front)
//
// Observação: regras de negócio de sessão e autenticação REAL
// continuam no backend (Apps Script). Aqui é apenas estado de interface.
//
// ✅ Opção 2 (produto): mantém controle de inatividade, SEM logoff automático.
// ✅ PASSO 2 (padronização global - front):
// - Adiciona ensureAuthenticated(): bloqueio local + validação server-side via PRONTIO.auth.me()
// - Dispara eventos "prontio:session-changed" quando user muda/limpa.
//
// ✅ DEV fallback (2026-01):
// - Quando PRONTIO_ENV === "dev" (ou host github.io) e user==null OU user sem idProfissional,
//   injeta um usuário DEV com idProfissional/idClinica para destravar Agenda/Atendimento.
// - NÃO afeta PROD (só roda em dev).

(function (global) {
  "use strict";

  const PRONTIO = global.PRONTIO = global.PRONTIO || {};
  PRONTIO.core = PRONTIO.core || {};

  const STORAGE_KEY = "prontio.session.v1";
  const DEV_USER_STORAGE_KEY = "prontio.dev.user.v1";

  let memoryState = {
    user: null,
    lastPatientId: null,
    lastAgendaDate: null,
    lastActivityAt: Date.now()
  };

  let idleTimer = null;

  function isDevEnv_() {
    try {
      if (typeof global.PRONTIO_ENV !== "undefined" && String(global.PRONTIO_ENV).toLowerCase() === "dev") return true;
    } catch (_) {}

    try {
      const h = String(global.location && global.location.hostname ? global.location.hostname : "").toLowerCase();
      if (h.endsWith("github.io")) return true;
      if (h.includes("localhost") || h === "127.0.0.1") return true;
    } catch (_) {}

    return false;
  }

  function safeJsonParse_(raw, fallback) {
    try {
      if (!raw) return fallback;
      const obj = JSON.parse(raw);
      return obj && typeof obj === "object" ? obj : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function getDevUser_() {
    // permite override via localStorage
    try {
      const raw = global.localStorage.getItem(DEV_USER_STORAGE_KEY);
      const obj = safeJsonParse_(raw, null);
      if (obj && obj.idProfissional) return obj;
    } catch (_) {}

    // default DEV
    return {
      idUsuario: "DEV_USER",
      login: "dev",
      nomeCompleto: "DEV - Dr. Marco Antônio",
      perfil: "admin",

      // ✅ obrigatório para Agenda
      idProfissional: "PROF_0001",

      // opcional (mas útil)
      idClinica: "CLINICA_0001",

      ativo: true
    };
  }

  function hasIdProfissional_(user) {
    try {
      return !!(user && user.idProfissional && String(user.idProfissional).trim());
    } catch (_) {
      return false;
    }
  }

  function loadFromStorage() {
    try {
      const raw = global.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      memoryState = Object.assign(memoryState, parsed);
    } catch (err) {
      console.warn("[Session] Erro ao ler localStorage", err);
    }
  }

  function saveToStorage() {
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryState));
    } catch (err) {
      console.warn("[Session] Erro ao gravar localStorage", err);
    }
  }

  function touchActivity() {
    memoryState.lastActivityAt = Date.now();
    saveToStorage();
  }

  function dispatchIdleTimeoutEvent_(payload) {
    try {
      const detail = payload || {};
      const ev = new CustomEvent("prontio:idle-timeout", { detail });
      global.dispatchEvent(ev);
    } catch (e) {
      try {
        const ev = document.createEvent("Event");
        ev.initEvent("prontio:idle-timeout", true, true);
        ev.detail = payload || {};
        global.dispatchEvent(ev);
      } catch (_) {}
    }
  }

  function dispatchSessionChanged_(payload) {
    try {
      const detail = payload || {};
      const ev = new CustomEvent("prontio:session-changed", { detail });
      global.dispatchEvent(ev);
    } catch (e) {
      try {
        const ev = document.createEvent("Event");
        ev.initEvent("prontio:session-changed", true, true);
        ev.detail = payload || {};
        global.dispatchEvent(ev);
      } catch (_) {}
    }
  }

  function getAuth_() {
    return PRONTIO.auth || null;
  }

  const Session = {
    /**
     * Inicializa sessão (chamar em main.js, assim que possível)
     */
    init() {
      loadFromStorage();
      this._setupActivityListeners();

      // ✅ DEV: se user não existe OU user sem idProfissional, injeta devUser
      try {
        if (isDevEnv_()) {
          const u = memoryState.user;
          if (!hasIdProfissional_(u)) {
            memoryState.user = getDevUser_();
            saveToStorage();
            dispatchSessionChanged_({ type: "setUser(dev)", user: memoryState.user });
          }
        }
      } catch (_) {}
    },

    /**
     * Define usuário logado
     * @param {Object|null} user
     */
    setUser(user) {
      memoryState.user = user || null;
      touchActivity();
      dispatchSessionChanged_({ type: "setUser", user: memoryState.user });
    },

    /**
     * Retorna usuário logado (objeto ou null)
     * ✅ DEV fallback: retorna usuário DEV se user estiver null OU sem idProfissional
     */
    getUser() {
      const u = memoryState.user;

      if (isDevEnv_()) {
        if (!hasIdProfissional_(u)) {
          const devUser = getDevUser_();
          memoryState.user = devUser;
          saveToStorage();
          return devUser;
        }
        return u;
      }

      return u || null;
    },

    /**
     * Remove dados de sessão (ex.: logout)
     */
    clear() {
      memoryState = {
        user: null,
        lastPatientId: null,
        lastAgendaDate: null,
        lastActivityAt: Date.now()
      };
      saveToStorage();
      dispatchSessionChanged_({ type: "clear", user: null });
    },

    setLastPatientId(id) {
      memoryState.lastPatientId = id || null;
      touchActivity();
      dispatchSessionChanged_({ type: "setLastPatientId", lastPatientId: memoryState.lastPatientId });
    },

    getLastPatientId() {
      return memoryState.lastPatientId;
    },

    setLastAgendaDate(dateStr) {
      memoryState.lastAgendaDate = dateStr || null;
      touchActivity();
      dispatchSessionChanged_({ type: "setLastAgendaDate", lastAgendaDate: memoryState.lastAgendaDate });
    },

    getLastAgendaDate() {
      return memoryState.lastAgendaDate;
    },

    /**
     * Guard oficial (UI-first) para garantir sessão válida
     */
    async ensureAuthenticated(opts) {
      opts = opts || {};
      const redirect = opts.redirect !== false;

      const auth = getAuth_();
      if (!auth || typeof auth.requireAuth !== "function") {
        console.warn("[Session] ensureAuthenticated: PRONTIO.auth.requireAuth não disponível.");
        return true;
      }

      const okLocal = auth.requireAuth({ redirect: redirect });
      if (!okLocal) return false;

      if (typeof auth.me === "function") {
        try {
          const res = await auth.me();
          if (res && res.user) this.setUser(res.user);
          return true;
        } catch (e) {
          // ✅ NÃO faz logout automático - só desloga ao clicar em "Sair"
          console.warn("[Session] Erro ao validar sessão (ignorado):", e && e.code ? e.code : e);
          return true; // Continua mesmo com erro
        }
      }

      return true;
    },

    startIdleTimer(options) {
      const timeoutMs = (options && options.timeoutMs) || 30 * 60 * 1000;
      const onTimeout = (options && options.onTimeout) || function () {};
      const allowOnTimeout = !!(options && options.allowOnTimeout === true);

      if (idleTimer) {
        clearInterval(idleTimer);
      }

      idleTimer = global.setInterval(() => {
        const now = Date.now();
        const diff = now - (memoryState.lastActivityAt || now);

        if (diff >= timeoutMs) {
          clearInterval(idleTimer);
          idleTimer = null;

          dispatchIdleTimeoutEvent_({
            timeoutMs,
            inactiveForMs: diff,
            lastActivityAt: memoryState.lastActivityAt || null,
            userPresent: !!memoryState.user
          });

          if (allowOnTimeout) {
            try {
              onTimeout();
            } catch (e) {
              console.warn("[Session] Erro no onTimeout (allowOnTimeout=true).", e);
            }
          } else {
            console.warn("[Session] Timeout de inatividade atingido (sem logoff automático).");
          }
        }
      }, 60 * 1000);
    },

    stopIdleTimer() {
      if (idleTimer) {
        clearInterval(idleTimer);
        idleTimer = null;
      }
    },

    _setupActivityListeners() {
      const events = ["click", "keydown", "mousemove", "scroll", "touchstart"];
      events.forEach((ev) => {
        global.addEventListener(ev, touchActivity, { passive: true });
      });
    }
  };

  PRONTIO.core.session = Session;

})(window);
