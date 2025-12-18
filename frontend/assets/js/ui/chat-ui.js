/* global callApi */
/**
 * PRONTIO - ChatUI (Opção 1: conversa fixa "Secretaria")
 *
 * IMPORTANTE:
 * - core/api.js expõe callApi({action,payload}) e retorna APENAS `data` em sucesso.
 * - Em erro, callApi lança Error(message).
 * - Portanto aqui NÃO usamos resp.success/resp.data — usamos try/catch.
 */

(function (global, document) {
  "use strict";

  function ensureChatWindow_() {
    let w = document.getElementById("chatWindow");
    if (w) return w;

    w = document.createElement("div");
    w.id = "chatWindow";
    w.className = "chat-window";
    w.hidden = true;
    w.setAttribute("aria-hidden", "true");
    document.body.appendChild(w);
    return w;
  }

  function escapeText_(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  async function apiCall_(action, payload) {
    // callApi retorna data em sucesso; lança Error em falha
    return await callApi({ action, payload });
  }

  const ChatUI = {
    state: {
      context: "app",
      patientId: null,
      currentUserId: null,

      conversations: [],
      activeConversationId: null,
      activeConversationTitle: "Conversa",

      pollTimer: null,
      pollingMs: 8000,

      isWindowOpen: false,
      lastLoadAt: 0
    },

    els: {},

    init({ context, patientId, currentUserId }) {
      this.state.context = context || this.state.context;
      this.state.patientId = patientId || null;
      this.state.currentUserId = currentUserId || null;

      // elementos do topo (injetados pelo widget-topbar)
      this.els.chatTopBtn = document.getElementById("chatTopBtn");
      this.els.chatUnreadBadge = document.getElementById("chatUnreadBadge");
      this.els.chatDropdown = document.getElementById("chatDropdown");
      this.els.chatSearchInput = document.getElementById("chatSearchInput");
      this.els.chatConversationList = document.getElementById("chatConversationList");
      this.els.chatCreateGroupBtn = document.getElementById("chatCreateGroupBtn");

      if (!this.els.chatTopBtn || !this.els.chatDropdown || !this.els.chatConversationList) {
        console.warn("[ChatUI] Elementos do topo não encontrados. Chat não inicializado.");
        return;
      }

      this.els.chatWindow = ensureChatWindow_();

      this._bindTopbarEventsOnce();
      this._ensureWindowShellOnce();

      this.refreshConversations();
      this._startPolling();
    },

    setContext({ patientId, context }) {
      if (typeof context === "string" && context.trim()) this.state.context = context.trim();
      if (patientId) this.state.patientId = patientId;
    },

    /* =========================
       Eventos - Topbar
    ========================= */

    _bindTopbarEventsOnce() {
      if (this.els.chatTopBtn && this.els.chatTopBtn.getAttribute("data-chat-bound") !== "1") {
        this.els.chatTopBtn.addEventListener("click", (e) => {
          e.preventDefault();
          this.toggleDropdown();
        });
        this.els.chatTopBtn.setAttribute("data-chat-bound", "1");
      }

      if (!document.body.getAttribute("data-chat-global-click")) {
        document.addEventListener("click", (e) => {
          if (!this.els.chatDropdown || this.els.chatDropdown.hidden) return;
          const wrap = e.target.closest(".chat-topbar");
          if (!wrap) this.closeDropdown();
        });
        document.body.setAttribute("data-chat-global-click", "1");
      }

      if (this.els.chatSearchInput && this.els.chatSearchInput.getAttribute("data-chat-bound") !== "1") {
        this.els.chatSearchInput.addEventListener("input", () => this._renderConversationList());
        this.els.chatSearchInput.setAttribute("data-chat-bound", "1");
      }

      if (this.els.chatCreateGroupBtn && this.els.chatCreateGroupBtn.getAttribute("data-chat-bound") !== "1") {
        this.els.chatCreateGroupBtn.addEventListener("click", async () => {
          try {
            const data = await apiCall_("Chat_CreateGroupDraft", {
              context: this.state.context,
              patientId: this.state.patientId
            });

            if (data && data.conversationId) {
              this.openConversation(data.conversationId, data.title || "Nova conversa");
            }
          } catch (err) {
            console.error("[ChatUI] Erro ao criar conversa:", err);
          }
        });
        this.els.chatCreateGroupBtn.setAttribute("data-chat-bound", "1");
      }
    },

    toggleDropdown() {
      if (!this.els.chatDropdown) return;

      const isOpen = !this.els.chatDropdown.hidden;
      if (isOpen) return this.closeDropdown();

      this.els.chatDropdown.hidden = false;
      this.els.chatTopBtn?.setAttribute("aria-expanded", "true");

      this.refreshConversations();
      this.els.chatSearchInput?.focus();
    },

    closeDropdown() {
      if (!this.els.chatDropdown) return;
      this.els.chatDropdown.hidden = true;
      this.els.chatTopBtn?.setAttribute("aria-expanded", "false");
    },

    /* =========================
       Conversas (dropdown)
    ========================= */

    async refreshConversations() {
      // feedback mínimo
      if (this.els.chatConversationList && !this.state.conversations.length) {
        this.els.chatConversationList.innerHTML = `<div class="chat-empty">Carregando...</div>`;
      }

      try {
        const data = await apiCall_("Chat_ListConversations", {
          context: this.state.context,
          patientId: this.state.patientId
        });

        this.state.conversations = Array.isArray(data?.conversations) ? data.conversations : [];
        this._renderConversationList();

        const unread = Number(data?.unreadTotal || 0);
        this._setUnreadBadge(unread);
      } catch (err) {
        console.error("[ChatUI] Erro ao listar conversas:", err);
        if (this.els.chatConversationList) {
          this.els.chatConversationList.innerHTML =
            `<div class="chat-empty">Erro ao carregar conversas.</div>`;
        }
      }
    },

    _setUnreadBadge(n) {
      if (!this.els.chatUnreadBadge) return;
      if (n > 0) {
        this.els.chatUnreadBadge.hidden = false;
        this.els.chatUnreadBadge.textContent = String(n);
      } else {
        this.els.chatUnreadBadge.hidden = true;
        this.els.chatUnreadBadge.textContent = "0";
      }
    },

    _renderConversationList() {
      if (!this.els.chatConversationList) return;

      const q = (this.els.chatSearchInput?.value || "").trim().toLowerCase();
      const list = this.state.conversations.filter((c) => {
        if (!q) return true;
        const t = String(c.title || "").toLowerCase();
        const s = String(c.lastMessagePreview || "").toLowerCase();
        return t.includes(q) || s.includes(q);
      });

      this.els.chatConversationList.innerHTML = "";

      if (!list.length) {
        const empty = document.createElement("div");
        empty.className = "chat-empty";
        empty.textContent = "Nenhuma conversa encontrada.";
        this.els.chatConversationList.appendChild(empty);
        return;
      }

      list.forEach((c) => {
        const item = document.createElement("div");
        item.className = "chat-conversation-item";
        item.setAttribute("data-id", c.conversationId);

        const left = document.createElement("div");
        left.className = "chat-conv-main";

        const title = document.createElement("div");
        title.className = "chat-conv-title";
        title.textContent = c.title || "Conversa";

        const snippet = document.createElement("div");
        snippet.className = "chat-conv-snippet";
        snippet.textContent = c.lastMessagePreview || "";

        left.appendChild(title);
        left.appendChild(snippet);

        const meta = document.createElement("div");
        meta.className = "chat-conv-meta";

        const time = document.createElement("div");
        time.className = "chat-conv-time";
        time.textContent = c.lastMessageTimeLabel || "";

        meta.appendChild(time);

        item.appendChild(left);
        item.appendChild(meta);

        item.addEventListener("click", () => this.openConversation(c.conversationId, c.title || "Conversa"));
        this.els.chatConversationList.appendChild(item);
      });
    },

    /* =========================
       Janela flutuante
    ========================= */

    _ensureWindowShellOnce() {
      const w = this.els.chatWindow;
      if (!w) return;
      if (w.getAttribute("data-chat-shell") === "1") return;

      w.innerHTML = `
        <div class="chat-win-header">
          <div class="chat-win-title" id="chatWinTitle">Conversa</div>
          <div class="chat-win-actions">
            <button class="chat-icon-btn" id="chatWinMinBtn" type="button" title="Minimizar" aria-label="Minimizar">—</button>
            <button class="chat-icon-btn" id="chatWinCloseBtn" type="button" title="Fechar" aria-label="Fechar">✕</button>
          </div>
        </div>

        <div class="chat-win-body" id="chatWinBody"></div>

        <div class="chat-win-footer">
          <input class="chat-input" id="chatMsgInput" type="text" placeholder="Enviar mensagem..." />
          <button class="chat-send-btn" id="chatSendBtn" type="button">Enviar</button>
        </div>
      `;

      w.setAttribute("data-chat-shell", "1");

      document.getElementById("chatWinCloseBtn")?.addEventListener("click", () => this.closeWindow());
      document.getElementById("chatWinMinBtn")?.addEventListener("click", () => this.minimizeWindow());
      document.getElementById("chatSendBtn")?.addEventListener("click", () => this._sendCurrentMessage());

      document.getElementById("chatMsgInput")?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") this._sendCurrentMessage();
      });
    },

    _setWindowVisible(visible) {
      const w = this.els.chatWindow;
      if (!w) return;

      if (visible) {
        w.hidden = false;
        w.setAttribute("aria-hidden", "false");
        this.state.isWindowOpen = true;
      } else {
        w.hidden = true;
        w.setAttribute("aria-hidden", "true");
        this.state.isWindowOpen = false;
      }
    },

    closeWindow() {
      this._setWindowVisible(false);
      this.state.activeConversationId = null;
      this.state.activeConversationTitle = "Conversa";

      const titleEl = document.getElementById("chatWinTitle");
      if (titleEl) titleEl.textContent = "Conversa";

      const body = document.getElementById("chatWinBody");
      if (body) body.innerHTML = "";
    },

    minimizeWindow() {
      this._setWindowVisible(false);
    },

    async openConversation(conversationId, title) {
      if (!conversationId) return;

      this.closeDropdown();

      this.state.activeConversationId = conversationId;
      this.state.activeConversationTitle = title || "Conversa";

      const titleEl = document.getElementById("chatWinTitle");
      if (titleEl) titleEl.textContent = this.state.activeConversationTitle;

      this._setWindowVisible(true);

      await this._loadMessages(conversationId);

      try {
        await apiCall_("Chat_MarkAsRead", { conversationId });
      } catch (e) {
        // não bloqueia
      }

      await this.refreshConversations();
      document.getElementById("chatMsgInput")?.focus();
    },

    async _loadMessages(conversationId) {
      const body = document.getElementById("chatWinBody");
      if (body) body.textContent = "Carregando mensagens...";

      try {
        const data = await apiCall_("Chat_GetMessages", {
          conversationId,
          limit: 80
        });

        const convTitle = data?.conversation?.title || this.state.activeConversationTitle || "Conversa";
        const titleEl = document.getElementById("chatWinTitle");
        if (titleEl) titleEl.textContent = convTitle;

        const messages = Array.isArray(data?.messages) ? data.messages : [];

        if (!body) return;
        body.innerHTML = "";

        if (!messages.length) {
          const empty = document.createElement("div");
          empty.className = "chat-empty";
          empty.textContent = "Nenhuma mensagem ainda.";
          body.appendChild(empty);
          return;
        }

        messages.forEach((m) => {
          const isMine = Boolean(m.isMine);
          const text = escapeText_(m.text);
          const time = escapeText_(m.timeLabel || "");

          const row = document.createElement("div");
          row.className = "chat-msg-row" + (isMine ? " me" : "");

          const bubble = document.createElement("div");
          bubble.className = "chat-msg-bubble";
          bubble.innerHTML = `
            <div class="chat-msg-text">${text}</div>
            <div class="chat-msg-meta">${time}</div>
          `;

          row.appendChild(bubble);
          body.appendChild(row);
        });

        body.scrollTop = body.scrollHeight;
      } catch (err) {
        console.error("[ChatUI] Erro ao carregar mensagens:", err);
        if (body) body.textContent = "Falha ao carregar mensagens.";
      }
    },

    async _sendCurrentMessage() {
      const input = document.getElementById("chatMsgInput");
      if (!input) return;

      const text = String(input.value || "").trim();
      if (!text) return;

      const conversationId = this.state.activeConversationId;
      if (!conversationId) return;

      input.value = "";
      input.focus();

      try {
        await apiCall_("Chat_SendMessage", { conversationId, text });
      } catch (err) {
        console.error("[ChatUI] Erro ao enviar mensagem:", err);
        // tenta recarregar mesmo assim
      }

      await this._loadMessages(conversationId);
      await this.refreshConversations();
    },

    /* =========================
       Polling
    ========================= */

    _startPolling() {
      this._stopPolling();

      this.state.pollTimer = setInterval(async () => {
        await this.refreshConversations();

        if (this.state.activeConversationId && this.state.isWindowOpen) {
          await this._loadMessages(this.state.activeConversationId);
        }
      }, this.state.pollingMs);
    },

    _stopPolling() {
      if (this.state.pollTimer) {
        clearInterval(this.state.pollTimer);
        this.state.pollTimer = null;
      }
    }
  };

  global.ChatUI = ChatUI;
})(window, document);
