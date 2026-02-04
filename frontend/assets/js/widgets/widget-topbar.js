/**
 * PRONTIO - widget-topbar.js
 * - versiona SOMENTE o HTML do partial (fetch)
 * - Exibe iniciais do usuário no avatar
 * - Menu dropdown do usuário (perfil, logout)
 * - Padronização de chaves localStorage
 */

(function (global, document) {
  "use strict";

  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO.widgets = PRONTIO.widgets || {};
  PRONTIO.widgets.topbar = PRONTIO.widgets.topbar || {};

  const CHAT_CSS_HREF = "assets/css/components/chat-topbar.css";

  // Bump quando mudar o HTML do partial da topbar
  const PARTIAL_VERSION = "1.3.0";
  const PARTIAL_TOPBAR_PATH = "partials/topbar.html?v=" + encodeURIComponent(PARTIAL_VERSION);

  // ✅ Chaves localStorage PADRONIZADAS (única fonte de verdade)
  const LS_KEYS = {
    USER_NAME: "PRONTIO_CURRENT_USER_NAME",
    USER_ROLE: "PRONTIO_CURRENT_USER_ROLE",
    USER_ID: "PRONTIO_CURRENT_USER_ID"
  };

  // ✅ usa a action já registrada no Registry.gs
  const ACTION_GET_ME = "Auth_Me";

  // ============================================================
  // Helpers
  // ============================================================

  function safeGet_(k) {
    try { return localStorage.getItem(k) || ""; } catch (_) { return ""; }
  }

  function safeSet_(k, v) {
    try { localStorage.setItem(k, String(v || "")); } catch (_) {}
  }

  /**
   * Gera iniciais a partir do nome completo
   * Ex: "João Silva" -> "JS", "Maria" -> "M", "Ana Paula Costa" -> "AC"
   */
  function getInitials_(fullName) {
    if (!fullName || typeof fullName !== "string") return "?";
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    // Primeira e última inicial
    const first = parts[0].charAt(0).toUpperCase();
    const last = parts[parts.length - 1].charAt(0).toUpperCase();
    return first + last;
  }

  /**
   * Gera cor de fundo baseada no nome (determinística)
   */
  function getAvatarColor_(name) {
    const colors = [
      "#4F46E5", // indigo
      "#7C3AED", // violet
      "#2563EB", // blue
      "#0891B2", // cyan
      "#059669", // emerald
      "#D97706", // amber
      "#DC2626", // red
      "#DB2777", // pink
      "#7C3AED", // purple
      "#0D9488"  // teal
    ];
    if (!name) return colors[0];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  }

  // ============================================================
  // Partial fetch
  // ============================================================

  async function fetchPartial_(path) {
    let res = await fetch(path, { cache: "default" });
    if (!res.ok) res = await fetch(path, { cache: "no-store" });
    if (!res.ok) throw new Error("Falha ao carregar partial: " + path + " (HTTP " + res.status + ")");
    return await res.text();
  }

  // ============================================================
  // Fill topbar texts
  // ============================================================

  function fillTopbarTexts_() {
    const title =
      (document.body && (document.body.getAttribute("data-tag") || document.body.getAttribute("data-page-id"))) ||
      "PRONTIO";
    const subtitle = (document.body && document.body.getAttribute("data-subtitle")) || "";
    const context = (document.body && document.body.getAttribute("data-context")) || "";

    const titleEl = document.getElementById("topbar-title-text");
    const tagEl = document.getElementById("topbar-tag");
    const subtitleEl = document.getElementById("topbar-subtitle");
    const ctxEl = document.getElementById("topbar-meta-context");
    const dateEl = document.getElementById("topbar-meta-date");

    if (titleEl) titleEl.textContent = String(title);
    if (tagEl) tagEl.textContent = String(title);
    if (subtitleEl) subtitleEl.textContent = String(subtitle);
    if (ctxEl) ctxEl.textContent = String(context);

    if (dateEl) {
      const now = new Date();
      const dd = String(now.getDate()).padStart(2, "0");
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const yyyy = String(now.getFullYear());
      dateEl.textContent = dd + "/" + mm + "/" + yyyy;
    }
  }

  // ============================================================
  // Theme toggle
  // ============================================================

  function rebindThemeToggle_() {
    try {
      if (PRONTIO.theme && typeof PRONTIO.theme.init === "function") return PRONTIO.theme.init();
      if (PRONTIO.ui && typeof PRONTIO.ui.initTheme === "function") return PRONTIO.ui.initTheme();
      if (typeof global.initTheme === "function") return global.initTheme();
    } catch (e) {
      console.error("[PRONTIO.topbar] Erro ao rebind do tema:", e);
    }
  }

  // ============================================================
  // Chat integration
  // ============================================================

  function ensureChatCss_() {
    const id = "prontio-chat-css";
    if (document.getElementById(id)) return;

    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = CHAT_CSS_HREF;
    document.head.appendChild(link);
  }

  function getChatSlot_() {
    return document.getElementById("topbar-chat-slot");
  }

  function injectChatMarkup_() {
    const slot = getChatSlot_();
    if (!slot) return false;
    if (slot.getAttribute("data-chat-injected") === "1") return true;

    slot.innerHTML = `
      <div class="chat-topbar">
        <button id="chatTopBtn" class="chat-topbar-btn" type="button"
          aria-haspopup="true" aria-expanded="false" title="Chat">
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="currentColor" d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2ZM6 9h12v2H6V9Zm8 5H6v-2h8v2Zm4-6H6V6h12v2Z"></path>
          </svg>
          <span class="chat-topbar-badge" id="chatUnreadBadge" hidden>0</span>
        </button>

        <div id="chatDropdown" class="chat-dropdown" hidden>
          <div class="chat-dropdown-header">
            <div class="chat-dropdown-title">Minhas Conversas</div>
            <button id="chatCreateGroupBtn" class="chat-dropdown-action" type="button">Criar grupo</button>
          </div>

          <div class="chat-dropdown-search">
            <input id="chatSearchInput" type="text" placeholder="Buscar contato" autocomplete="off"/>
          </div>

          <div class="chat-dropdown-section">
            <div class="chat-dropdown-section-title">Conversas iniciadas</div>
            <div id="chatConversationList" class="chat-conversation-list"></div>
          </div>
        </div>
      </div>
    `;

    slot.setAttribute("data-chat-injected", "1");
    return true;
  }

  function hasChatEnabled_() {
    try { return (document.body && document.body.getAttribute("data-has-chat")) === "true"; }
    catch (e) { return false; }
  }

  function getContext_() {
    try {
      return (
        (document.body && document.body.getAttribute("data-context")) ||
        (document.body && document.body.getAttribute("data-page-id")) ||
        "app"
      );
    } catch (e) {
      return "app";
    }
  }

  function getPatientIdIfAny_() {
    const el = document.getElementById("prontuario-paciente-id");
    if (!el) return null;
    const txt = String(el.textContent || "").trim();
    if (!txt || txt === "—") return null;
    return txt;
  }

  async function initChatIfEnabled_() {
    if (!hasChatEnabled_()) return;

    ensureChatCss_();
    if (!injectChatMarkup_()) return;

    if (!global.ChatUI || typeof global.ChatUI.init !== "function") {
      console.warn("[PRONTIO.topbar] ChatUI não encontrado. Verifique se ui/chat-ui.js está no main.js.");
      return;
    }

    global.ChatUI.init({
      context: getContext_(),
      patientId: getPatientIdIfAny_(),
      currentUserId: safeGet_(LS_KEYS.USER_ID) || null
    });
  }

  // ============================================================
  // User info + Avatar + Dropdown
  // ============================================================

  function updateUserDisplay_(nome, perfil) {
    const nameEl = document.getElementById("topbar-user-name");
    const roleEl = document.getElementById("topbar-user-role");
    const avatarEl = document.getElementById("topbar-user-avatar");

    if (nameEl && nome) nameEl.textContent = String(nome);
    if (roleEl && perfil) roleEl.textContent = String(perfil);

    // Atualiza avatar com iniciais
    if (avatarEl && nome) {
      const initials = getInitials_(nome);
      const bgColor = getAvatarColor_(nome);
      avatarEl.textContent = initials;
      avatarEl.style.backgroundColor = bgColor;
      avatarEl.style.color = "#fff";
      avatarEl.setAttribute("title", nome);
    }
  }

  async function loadLoggedUser_() {
    const nameEl = document.getElementById("topbar-user-name");
    const roleEl = document.getElementById("topbar-user-role");
    if (!nameEl || !roleEl) return;

    let nome = "";
    let perfil = "";

    // 1) tenta via PRONTIO.auth.getCurrentUser (se existir)
    try {
      if (PRONTIO.auth && typeof PRONTIO.auth.getCurrentUser === "function") {
        const u0 = PRONTIO.auth.getCurrentUser();
        nome = u0 && (u0.nomeCompleto || u0.NomeCompleto || u0.nome || u0.Nome) || "";
        perfil = u0 && (u0.perfil || u0.Perfil || u0.role) || "";
        if (nome || perfil) {
          updateUserDisplay_(nome, perfil);
          return;
        }
      }
    } catch (e) {}

    // 2) tenta via localStorage (chave padronizada)
    try {
      nome = safeGet_(LS_KEYS.USER_NAME);
      perfil = safeGet_(LS_KEYS.USER_ROLE);

      if (nome || perfil) {
        updateUserDisplay_(nome, perfil);
        return;
      }
    } catch (e) {}

    // 3) fonte de verdade: Auth_Me (precisa token)
    try {
      if (!PRONTIO.api || typeof PRONTIO.api.callApiData !== "function") return;

      const token = (PRONTIO.auth && typeof PRONTIO.auth.getToken === "function")
        ? PRONTIO.auth.getToken()
        : null;

      if (!token) return;

      const data = await PRONTIO.api.callApiData({
        action: ACTION_GET_ME,
        payload: { token: token }
      });

      const u = (data && (data.user || data.usuario)) ? (data.user || data.usuario) : null;
      if (!u) return;

      nome = u.nomeCompleto || u.NomeCompleto || u.nome || u.Nome || "";
      perfil = u.perfil || u.Perfil || u.role || "";

      updateUserDisplay_(nome, perfil);

      // Cache para próxima vez
      if (nome) safeSet_(LS_KEYS.USER_NAME, nome);
      if (perfil) safeSet_(LS_KEYS.USER_ROLE, perfil);
      if (u.id || u.idUsuario || u.ID_Usuario) {
        safeSet_(LS_KEYS.USER_ID, u.id || u.idUsuario || u.ID_Usuario);
      }
    } catch (e) {
      // silencioso: não quebra a UI
    }
  }

  // ============================================================
  // User Menu Dropdown
  // ============================================================

  let _userMenuBound = false;

  function bindUserMenu_() {
    if (_userMenuBound) return;

    const userArea = document.querySelector(".topbar-user");
    const dropdown = document.getElementById("topbar-user-dropdown");

    if (!userArea || !dropdown) return;

    _userMenuBound = true;

    // Toggle dropdown on click
    userArea.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const isOpen = dropdown.getAttribute("aria-hidden") !== "true";
      if (isOpen) {
        closeUserMenu_();
      } else {
        openUserMenu_();
      }
    });

    // Close on click outside
    document.addEventListener("click", (ev) => {
      if (!userArea.contains(ev.target) && !dropdown.contains(ev.target)) {
        closeUserMenu_();
      }
    });

    // Close on Escape
    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") {
        closeUserMenu_();
      }
    });

    // Bind menu actions
    const logoutBtn = dropdown.querySelector("[data-user-action='logout']");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", async (ev) => {
        ev.preventDefault();
        closeUserMenu_();
        if (PRONTIO.auth && typeof PRONTIO.auth.logout === "function") {
          const ok = global.confirm("Tem certeza que deseja sair?");
          if (ok) {
            await PRONTIO.auth.logout({ redirect: true, clearChat: true });
          }
        }
      });
    }

    const configBtn = dropdown.querySelector("[data-user-action='config']");
    if (configBtn) {
      configBtn.addEventListener("click", (ev) => {
        ev.preventDefault();
        closeUserMenu_();
        global.location.href = "configuracoes.html";
      });
    }

    const changePassBtn = dropdown.querySelector("[data-user-action='change-password']");
    if (changePassBtn) {
      changePassBtn.addEventListener("click", (ev) => {
        ev.preventDefault();
        closeUserMenu_();
        global.location.href = "alterar-senha.html";
      });
    }
  }

  function openUserMenu_() {
    const dropdown = document.getElementById("topbar-user-dropdown");
    const userArea = document.querySelector(".topbar-user");
    if (dropdown) {
      dropdown.setAttribute("aria-hidden", "false");
      dropdown.style.display = "block";
    }
    if (userArea) {
      userArea.setAttribute("aria-expanded", "true");
    }
  }

  function closeUserMenu_() {
    const dropdown = document.getElementById("topbar-user-dropdown");
    const userArea = document.querySelector(".topbar-user");
    if (dropdown) {
      dropdown.setAttribute("aria-hidden", "true");
      dropdown.style.display = "none";
    }
    if (userArea) {
      userArea.setAttribute("aria-expanded", "false");
    }
  }

  // ============================================================
  // Init
  // ============================================================

  PRONTIO.widgets.topbar.init = async function initTopbar() {
    try {
      const mount = document.getElementById("topbarMount");
      if (!mount) return;

      // já montado
      if (mount.getAttribute("data-mounted") === "1") {
        fillTopbarTexts_();
        rebindThemeToggle_();
        await loadLoggedUser_();
        bindUserMenu_();
        await initChatIfEnabled_();
        return;
      }

      const html = await fetchPartial_(PARTIAL_TOPBAR_PATH);
      mount.innerHTML = html;
      mount.setAttribute("data-mounted", "1");
      mount.setAttribute("data-mounted-from", PARTIAL_TOPBAR_PATH);

      fillTopbarTexts_();
      rebindThemeToggle_();
      await loadLoggedUser_();
      bindUserMenu_();
      await initChatIfEnabled_();
    } catch (err) {
      console.error("[PRONTIO.topbar] Erro ao inicializar topbar:", err);
    }
  };

  // ============================================================
  // Exports para uso externo
  // ============================================================

  PRONTIO.widgets.topbar.updateUserDisplay = updateUserDisplay_;
  PRONTIO.widgets.topbar.getInitials = getInitials_;

})(window, document);
