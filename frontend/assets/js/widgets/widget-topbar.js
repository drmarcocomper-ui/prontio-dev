/**
 * PRONTIO - widget-topbar.js
 *
 * RESPONSABILIDADES:
 * 1) Montar o partial da topbar dentro de #topbarMount
 * 2) Preencher textos da topbar a partir do <body>
 * 3) Se data-has-chat="true", injetar o botão do chat no #topbar-chat-slot e inicializar ChatUI
 * 4) ✅ Rebind do tema (dark mode) após a topbar existir no DOM
 *
 * Caminho real confirmado:
 * - /partials/topbar.html
 */

(function (global, document) {
  "use strict";

  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO.widgets = PRONTIO.widgets || {};
  PRONTIO.widgets.topbar = PRONTIO.widgets.topbar || {};

  const CHAT_CSS_HREF = "assets/css/components/chat-topbar.css";
  const PARTIAL_TOPBAR_PATH = `${location.origin}/partials/topbar.html`;

  function hasChatEnabled_() {
    return document.body?.getAttribute("data-has-chat") === "true";
  }

  function getContext_() {
    return (
      document.body?.getAttribute("data-context") ||
      document.body?.getAttribute("data-page-id") ||
      "app"
    );
  }

  function getPatientIdIfAny_() {
    const el = document.getElementById("prontuario-paciente-id");
    if (!el) return null;
    const txt = String(el.textContent || "").trim();
    if (!txt || txt === "—") return null;
    return txt;
  }

  async function fetchPartial_(path) {
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok) throw new Error("Falha ao carregar partial: " + path + " (HTTP " + res.status + ")");
    return await res.text();
  }

  function fillTopbarTexts_() {
    const title = document.body?.getAttribute("data-tag") || document.body?.getAttribute("data-page-id") || "PRONTIO";
    const subtitle = document.body?.getAttribute("data-subtitle") || "";
    const context = document.body?.getAttribute("data-context") || "";

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

  /**
   * ✅ Rebind do tema:
   * O theme toggle estava sendo inicializado antes do partial existir.
   * Chamamos novamente o init do tema (deve ser idempotente no seu projeto).
   */
  function rebindThemeToggle_() {
    try {
      if (PRONTIO.theme && typeof PRONTIO.theme.init === "function") {
        PRONTIO.theme.init();
        return;
      }
      // fallback para implementações antigas
      if (PRONTIO.ui && typeof PRONTIO.ui.initTheme === "function") {
        PRONTIO.ui.initTheme();
        return;
      }
      // fallback global (se existir)
      if (typeof global.initTheme === "function") {
        global.initTheme();
      }
    } catch (e) {
      console.error("[PRONTIO.topbar] Erro ao rebind do tema:", e);
    }
  }

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

  async function initChatIfEnabled_() {
    if (!hasChatEnabled_()) return;

    ensureChatCss_();

    const ok = injectChatMarkup_();
    if (!ok) return;

    if (!global.ChatUI || typeof global.ChatUI.init !== "function") {
      console.warn("[PRONTIO.topbar] ChatUI não encontrado. Verifique se ui/chat-ui.js está no main.js.");
      return;
    }

    global.ChatUI.init({
      context: getContext_(),
      patientId: getPatientIdIfAny_(),
      currentUserId: localStorage.getItem("PRONTIO_CURRENT_USER_ID") || null
    });

    if ((document.body?.getAttribute("data-page-id") || "").toLowerCase() === "prontuario") {
      let tries = 0;
      const maxTries = 60;
      const timer = setInterval(() => {
        tries += 1;
        const pid = getPatientIdIfAny_();
        if (pid && global.ChatUI && typeof global.ChatUI.setContext === "function") {
          global.ChatUI.setContext({ patientId: pid, context: getContext_() });
          clearInterval(timer);
        }
        if (tries >= maxTries) clearInterval(timer);
      }, 250);
    }
  }

  // ========= PUBLIC INIT =========
  PRONTIO.widgets.topbar.init = async function initTopbar(opts) {
    try {
      const mount = document.getElementById("topbarMount");
      if (!mount) {
        console.warn("[PRONTIO.topbar] #topbarMount não encontrado. Topbar não será montada.");
        return;
      }

      if (mount.getAttribute("data-mounted") !== "1") {
        const html = await fetchPartial_(PARTIAL_TOPBAR_PATH);
        mount.innerHTML = html;
        mount.setAttribute("data-mounted", "1");
        mount.setAttribute("data-mounted-from", PARTIAL_TOPBAR_PATH);
      }

      fillTopbarTexts_();

      // ✅ agora que o botão do tema existe, rebind do tema
      rebindThemeToggle_();

      // Chat
      await initChatIfEnabled_();

    } catch (err) {
      console.error("[PRONTIO.topbar] Erro ao inicializar topbar:", err);
    }
  };

})(window, document);
