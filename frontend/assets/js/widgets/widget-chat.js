// frontend/assets/js/widgets/widget-chat.js
// ============================================================
// PRONTIO - Widget de Chat Global (Topbar)
// ============================================================
// Usa as actions do backend (Registry):
// - chat.sendMessage
// - chat.listMessages
// - chat.listMessagesSince
// - chat.markAsRead
// - chat.getUnreadSummary
// - chat.listByPaciente
// - chat.sendByPaciente
// Compat (para chat.html / widget):
// - usuarios.listAll (stub ok)
// - agenda.peekNextPatient / agenda.nextPatient (stub ok)
// ============================================================

(function (global, document) {
  "use strict";

  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO.widgets = PRONTIO.widgets || {};

  const callApiData =
    (PRONTIO.api && PRONTIO.api.callApiData) ||
    global.callApiData ||
    function () {
      return Promise.reject(new Error("API não disponível (callApiData indefinido)."));
    };

  const LS_USER_KEY = "medpronto_user_info";
  const CHAT_DEFAULT_ROOMS = [
    { roomId: "default", name: "Chat principal", desc: "Canal geral da clínica." },
    { roomId: "secretaria", name: "Secretaria", desc: "Recados internos da recepção." },
    { roomId: "financeiro", name: "Financeiro", desc: "Pendências e cobranças." }
  ];

  const STATE = {
    open: false,
    roomId: "default",
    roomName: "Chat principal",
    roomDesc: "Canal geral da clínica.",
    lastTsByRoom: {},
    unreadByRoom: {},
    userId: null,
    userName: null,
    userType: null,
    pollTimer: null,
    pollMs: 6000
  };

  // Elements
  let btnTop;
  let badgeTop;
  let panel;
  let overlay;
  let btnClose;
  let btnRefresh;

  let searchInput;
  let roomListEl;

  let convTitleEl;
  let convDescEl;
  let messagesEl;
  let formEl;
  let inputEl;

  let btnChangeUser;

  function safeJsonParse_(s) {
    try { return JSON.parse(s); } catch (_) { return null; }
  }

  function loadUserFromLocalStorage_() {
    try {
      const raw = global.localStorage.getItem(LS_USER_KEY);
      if (!raw) return false;
      const info = safeJsonParse_(raw);
      if (!info || !info.idUsuario || !info.nome) return false;

      STATE.userId = String(info.idUsuario);
      STATE.userName = String(info.nome);
      STATE.userType = info.tipo ? String(info.tipo) : "";
      return true;
    } catch (_) {
      return false;
    }
  }

  function saveUserToLocalStorage_(user) {
    const info = {
      idUsuario: user.idUsuario,
      nome: user.nome,
      tipo: user.tipo || ""
    };
    global.localStorage.setItem(LS_USER_KEY, JSON.stringify(info));
    STATE.userId = String(info.idUsuario);
    STATE.userName = String(info.nome);
    STATE.userType = String(info.tipo || "");
  }

  async function fetchUsersFromBackend_() {
    const res = await callApiData({ action: "usuarios.listAll", payload: {} });
    return (res && res.users) ? res.users : [];
  }

  async function chooseUserInteractive_() {
    const users = await fetchUsersFromBackend_();

    if (!users || users.length === 0) {
      // ✅ Usa usuário da sessão em vez de prompt
      const sessionUser = (PRONTIO.core && PRONTIO.core.session) ? PRONTIO.core.session.getUser() : null;
      const nome = sessionUser?.nomeCompleto || sessionUser?.nome || "Usuário";
      return {
        idUsuario: sessionUser?.idUsuario || "LOCAL-" + Date.now(),
        nome: nome,
        tipo: sessionUser?.perfil || "LOCAL"
      };
    }

    let msg = "Escolha seu usuário:\n\n";
    users.forEach((u, idx) => {
      const n = idx + 1;
      const tipo = u.tipo ? ` (${u.tipo})` : "";
      msg += `${n} - ${u.nome}${tipo}\n`;
    });
    msg += "\nDigite o número correspondente:";

    while (true) {
      const input = global.prompt(msg);
      if (input === null) return null;
      const n = parseInt(input, 10);
      if (!isNaN(n) && n >= 1 && n <= users.length) return users[n - 1];
      global.alert("Opção inválida, tente novamente.");
    }
  }

  async function ensureUser_() {
    if (STATE.userId && STATE.userName) return;
    const ok = loadUserFromLocalStorage_();
    if (ok) return;

    const u = await chooseUserInteractive_();
    if (u) saveUserToLocalStorage_(u);
    else {
      STATE.userId = "ANON-" + Date.now();
      STATE.userName = "Usuário";
      STATE.userType = "";
    }
  }

  function setOpen_(open) {
    STATE.open = !!open;

    if (!panel || !overlay) return;

    if (STATE.open) {
      panel.classList.add("is-open");
      overlay.classList.add("is-open");
      panel.setAttribute("aria-hidden", "false");
      overlay.setAttribute("aria-hidden", "false");
      panel.removeAttribute("inert");
    } else {
      // ✅ Move foco para botão que abriu o chat antes de ocultar (evita warning aria-hidden)
      if (document.activeElement && panel.contains(document.activeElement)) {
        if (btnTop) {
          btnTop.focus();
        } else {
          document.activeElement.blur();
        }
      }
      panel.setAttribute("inert", ""); // ✅ Previne foco ANTES de aria-hidden
      panel.classList.remove("is-open");
      overlay.classList.remove("is-open");
      panel.setAttribute("aria-hidden", "true");
      overlay.setAttribute("aria-hidden", "true");
    }
  }

  function toggleOpen_() {
    setOpen_(!STATE.open);
  }

  function formatTime_(iso) {
    if (!iso) return "";
    try {
      const d = new Date(iso);
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      return `${hh}:${mm}`;
    } catch (_) {
      return "";
    }
  }

  function renderRoomList_(filterText) {
    if (!roomListEl) return;

    const q = String(filterText || "").trim().toLowerCase();

    // rooms = defaults + rooms vistas (unreadByRoom / lastTsByRoom)
    const roomMap = {};
    CHAT_DEFAULT_ROOMS.forEach(r => { roomMap[r.roomId] = { ...r }; });

    Object.keys(STATE.unreadByRoom || {}).forEach((rid) => {
      if (!roomMap[rid]) {
        roomMap[rid] = { roomId: rid, name: rid, desc: "Conversa" };
      }
    });

    Object.keys(STATE.lastTsByRoom || {}).forEach((rid) => {
      if (!roomMap[rid]) roomMap[rid] = { roomId: rid, name: rid, desc: "Conversa" };
    });

    const rooms = Object.values(roomMap)
      .filter(r => {
        if (!q) return true;
        const hay = (r.name + " " + r.roomId + " " + (r.desc || "")).toLowerCase();
        return hay.indexOf(q) >= 0;
      })
      .sort((a, b) => {
        // unread first
        const ua = STATE.unreadByRoom[a.roomId] || 0;
        const ub = STATE.unreadByRoom[b.roomId] || 0;
        if (ua !== ub) return ub - ua;

        // then most recent timestamp
        const ta = Date.parse(STATE.lastTsByRoom[a.roomId] || "") || 0;
        const tb = Date.parse(STATE.lastTsByRoom[b.roomId] || "") || 0;
        return tb - ta;
      });

    roomListEl.innerHTML = "";

    rooms.forEach((r) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "prontio-chat-room" + (r.roomId === STATE.roomId ? " is-active" : "");
      btn.dataset.roomId = r.roomId;

      const left = document.createElement("div");
      left.className = "prontio-chat-room__left";

      const name = document.createElement("div");
      name.className = "prontio-chat-room__name";
      name.textContent = r.name || r.roomId;

      const desc = document.createElement("div");
      desc.className = "prontio-chat-room__desc";
      desc.textContent = r.desc || "Conversa";

      left.appendChild(name);
      left.appendChild(desc);

      const unread = STATE.unreadByRoom[r.roomId] || 0;
      let badge = null;
      if (unread > 0) {
        badge = document.createElement("span");
        badge.className = "prontio-chat-room__badge";
        badge.textContent = unread > 9 ? "9+" : String(unread);
      }

      btn.appendChild(left);
      if (badge) btn.appendChild(badge);

      btn.addEventListener("click", () => {
        setRoom_(r.roomId, r.name, r.desc);
      });

      roomListEl.appendChild(btn);
    });
  }

  function setRoom_(roomId, name, desc) {
    STATE.roomId = String(roomId || "default");
    STATE.roomName = String(name || STATE.roomId);
    STATE.roomDesc = String(desc || "Conversa");

    if (convTitleEl) convTitleEl.textContent = STATE.roomName;
    if (convDescEl) convDescEl.textContent = STATE.roomDesc;

    renderRoomList_(searchInput ? searchInput.value : "");
    loadMessages_(true);
  }

  function renderMessages_(messages) {
    if (!messagesEl) return;

    messagesEl.innerHTML = "";

    if (!messages || messages.length === 0) {
      const empty = document.createElement("div");
      empty.className = "prontio-chat-empty";
      empty.textContent = "Nenhuma mensagem ainda. Comece a conversa!";
      messagesEl.appendChild(empty);
      delete STATE.lastTsByRoom[STATE.roomId];
      return;
    }

    let lastTs = null;

    messages.forEach((m) => {
      const wrap = document.createElement("div");
      const isMe = (m.sender && STATE.userName) ? (String(m.sender) === String(STATE.userName)) : false;
      wrap.className = "prontio-chat-msg" + (isMe ? " is-me" : "");

      const meta = document.createElement("div");
      meta.className = "prontio-chat-msg__meta";

      const sender = document.createElement("span");
      sender.className = "prontio-chat-msg__sender";
      sender.textContent = m.sender || "Anônimo";

      const time = document.createElement("span");
      time.className = "prontio-chat-msg__time";
      time.textContent = formatTime_(m.timestamp);

      meta.appendChild(sender);
      meta.appendChild(time);

      const bubble = document.createElement("div");
      bubble.className = "prontio-chat-msg__bubble";
      bubble.textContent = m.message || "";

      wrap.appendChild(meta);
      wrap.appendChild(bubble);

      messagesEl.appendChild(wrap);

      if (m.timestamp) lastTs = m.timestamp;
    });

    if (lastTs) STATE.lastTsByRoom[STATE.roomId] = lastTs;
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function appendMessages_(messages) {
    if (!messagesEl || !messages || messages.length === 0) return;

    let lastTs = STATE.lastTsByRoom[STATE.roomId] || null;

    messages.forEach((m) => {
      const wrap = document.createElement("div");
      const isMe = (m.sender && STATE.userName) ? (String(m.sender) === String(STATE.userName)) : false;
      wrap.className = "prontio-chat-msg" + (isMe ? " is-me" : "");

      const meta = document.createElement("div");
      meta.className = "prontio-chat-msg__meta";

      const sender = document.createElement("span");
      sender.className = "prontio-chat-msg__sender";
      sender.textContent = m.sender || "Anônimo";

      const time = document.createElement("span");
      time.className = "prontio-chat-msg__time";
      time.textContent = formatTime_(m.timestamp);

      meta.appendChild(sender);
      meta.appendChild(time);

      const bubble = document.createElement("div");
      bubble.className = "prontio-chat-msg__bubble";
      bubble.textContent = m.message || "";

      wrap.appendChild(meta);
      wrap.appendChild(bubble);

      messagesEl.appendChild(wrap);

      if (m.timestamp) lastTs = m.timestamp;
    });

    if (lastTs) STATE.lastTsByRoom[STATE.roomId] = lastTs;
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  async function markAsRead_() {
    if (!STATE.userId) return;
    const lastTs = STATE.lastTsByRoom[STATE.roomId];
    if (!lastTs) return;

    try {
      await callApiData({
        action: "chat.markAsRead",
        payload: { roomId: STATE.roomId, userId: STATE.userId, lastTimestamp: lastTs }
      });
    } catch (_) {}
  }

  function updateTopBadge_(total) {
    if (!badgeTop) return;
    const n = Number(total || 0);
    if (n > 0) {
      badgeTop.textContent = n > 99 ? "99+" : String(n);
      badgeTop.style.display = "inline-block";
    } else {
      badgeTop.style.display = "none";
    }
  }

  async function updateUnreadSummary_() {
    if (!STATE.userId) return;

    try {
      const res = await callApiData({
        action: "chat.getUnreadSummary",
        payload: { userId: STATE.userId }
      });

      const rooms = (res && res.rooms) ? res.rooms : [];
      const map = {};
      let total = 0;

      rooms.forEach((r) => {
        const rid = String(r.roomId || "default");
        const c = Number(r.unreadCount || 0) || 0;
        map[rid] = c;
        total += c;
      });

      STATE.unreadByRoom = map;
      updateTopBadge_(total);
      renderRoomList_(searchInput ? searchInput.value : "");
    } catch (_) {}
  }

  // ✅ P1: Helper para mostrar erros no chat sem alert()
  function showChatError_(msg) {
    if (messagesEl) {
      const errDiv = document.createElement("div");
      errDiv.className = "prontio-chat-error";
      errDiv.textContent = msg || "Erro desconhecido";
      messagesEl.appendChild(errDiv);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    } else {
      console.error("[widget-chat]", msg);
    }
  }

  async function loadMessages_(showErrors) {
    try {
      const res = await callApiData({
        action: "chat.listMessages",
        payload: { roomId: STATE.roomId }
      });
      const messages = (res && res.messages) ? res.messages : [];
      renderMessages_(messages);
      await markAsRead_();
      await updateUnreadSummary_();
    } catch (e) {
      if (showErrors) {
        // ✅ P1: Usa feedback visual em vez de alert()
        showChatError_("Erro ao carregar mensagens: " + (e && e.message ? e.message : String(e)));
      }
    }
  }

  async function refreshIncremental_() {
    const lastTs = STATE.lastTsByRoom[STATE.roomId];
    if (!lastTs) return loadMessages_(false);

    try {
      const res = await callApiData({
        action: "chat.listMessagesSince",
        payload: { roomId: STATE.roomId, afterTimestamp: lastTs }
      });
      const messages = (res && res.messages) ? res.messages : [];
      appendMessages_(messages);
      await markAsRead_();
      await updateUnreadSummary_();
    } catch (_) {}
  }

  async function sendMessage_(text) {
    const trimmed = String(text || "").trim();
    if (!trimmed) return;

    try {
      const res = await callApiData({
        action: "chat.sendMessage",
        payload: { roomId: STATE.roomId, sender: STATE.userName || "Usuário", userId: STATE.userId || "", message: trimmed }
      });

      const messages = (res && res.messages) ? res.messages : [];
      renderMessages_(messages);

      if (inputEl) {
        inputEl.value = "";
        inputEl.focus();
      }

      await markAsRead_();
      await updateUnreadSummary_();
    } catch (e) {
      // ✅ P1: Usa feedback visual em vez de alert()
      showChatError_("Erro ao enviar mensagem: " + (e && e.message ? e.message : String(e)));
    }
  }

  function startPolling_() {
    stopPolling_();
    STATE.pollTimer = global.setInterval(() => {
      if (!STATE.open) {
        // mesmo fechado, atualiza badge de vez em quando
        updateUnreadSummary_();
        return;
      }
      refreshIncremental_();
    }, STATE.pollMs);
  }

  function stopPolling_() {
    if (STATE.pollTimer) {
      clearInterval(STATE.pollTimer);
      STATE.pollTimer = null;
    }
  }

  function bindUi_() {
    btnTop = document.getElementById("prontio-chat-topbtn");
    badgeTop = document.getElementById("prontio-chat-badge");
    panel = document.getElementById("prontio-chat-panel");
    overlay = document.getElementById("prontio-chat-overlay");
    btnClose = document.getElementById("prontio-chat-btn-close");
    btnRefresh = document.getElementById("prontio-chat-btn-refresh");

    searchInput = document.getElementById("prontio-chat-search-input");
    roomListEl = document.getElementById("prontio-chat-roomlist");

    convTitleEl = document.getElementById("prontio-chat-conv-title");
    convDescEl = document.getElementById("prontio-chat-conv-desc");
    messagesEl = document.getElementById("prontio-chat-messages");

    formEl = document.getElementById("prontio-chat-form");
    inputEl = document.getElementById("prontio-chat-input");

    btnChangeUser = document.getElementById("prontio-chat-btn-change-user");

    if (!btnTop || !panel || !overlay) return false;

    btnTop.addEventListener("click", () => toggleOpen_());
    overlay.addEventListener("click", () => setOpen_(false));
    if (btnClose) btnClose.addEventListener("click", () => setOpen_(false));
    if (btnRefresh) btnRefresh.addEventListener("click", () => loadMessages_(true));

    if (searchInput) {
      searchInput.addEventListener("input", () => renderRoomList_(searchInput.value));
    }

    if (btnChangeUser) {
      btnChangeUser.addEventListener("click", async () => {
        const u = await chooseUserInteractive_();
        if (u) {
          saveUserToLocalStorage_(u);
          await updateUnreadSummary_();
          await loadMessages_(true);
        }
      });
    }

    if (formEl) {
      formEl.addEventListener("submit", (ev) => {
        ev.preventDefault();
        if (!inputEl) return;
        sendMessage_(inputEl.value);
      });
    }

    if (inputEl) {
      inputEl.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" && !ev.shiftKey) {
          ev.preventDefault();
          sendMessage_(inputEl.value);
        }
      });
    }

    // ESC fecha
    global.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape" && STATE.open) setOpen_(false);
    });

    return true;
  }

  async function init() {
    // só inicializa se a topbar/painel existirem
    const ok = bindUi_();
    if (!ok) return;

    await ensureUser_();
    setRoom_(STATE.roomId, STATE.roomName, STATE.roomDesc);
    await updateUnreadSummary_();
    startPolling_();
  }

  PRONTIO.widgets.chat = {
    init,
    open: () => setOpen_(true),
    close: () => setOpen_(false),
    toggle: toggleOpen_,
    setRoom: (roomId, name, desc) => setRoom_(roomId, name, desc),
    state: STATE
  };

})(window, document);
