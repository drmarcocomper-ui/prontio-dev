// assets/js/pages/page-chat.js
// ============================================
// PRONTIO - Página de Chat
//
// Padrão PRONTIO (assets/js/api.js):
// - callApi     => retorna ENVELOPE { success, data, errors }
// - callApiData => retorna DIRETO o "data" e lança erro se success=false
//
// Ações usadas no backend:
// - chat.sendMessage
// - chat.listMessages
// - chat.listMessagesSince
// - chat.markAsRead
// - chat.getUnreadSummary
// - chat.listByAgenda / chat.listByPaciente (via params)
// - agenda.peekNextPatient / agenda.nextPatient
// - usuarios.listAll
// ============================================

(function (global, document) {
  "use strict";

  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});

  // ✅ padrão novo
  const callApiData =
    (PRONTIO.api && PRONTIO.api.callApiData) ||
    global.callApiData ||
    function () {
      console.warn("[PRONTIO.chat] callApiData não definido.");
      return Promise.reject(
        new Error("API não disponível nesta página (callApiData indefinido).")
      );
    };

  // ------------------------------------------
  // CONFIGURAÇÕES BÁSICAS DO CHAT
  // ------------------------------------------

  let currentRoomId = "default";

  const LOCALSTORAGE_USER_INFO_KEY = "medpronto_user_info";

  const CHAT_INTERVAL_ACTIVE = 3000;
  const CHAT_INTERVAL_BACKGROUND = 15000;
  const CHAT_INTERVAL_IDLE = 30000;

  const USER_IDLE_MS = 2 * 60 * 1000;

  let currentUserId = null;
  let currentUserName = null;
  let currentUserType = null;

  let autoRefreshTimer = null;
  let currentRefreshInterval = CHAT_INTERVAL_ACTIVE;
  let lastUserActivityTs = Date.now();

  let lastTimestampByRoom = {};

  // ------------------------------------------
  // HELPERS GERAIS
  // ------------------------------------------

  function getQueryParams() {
    const params = {};
    const search = global.location.search || "";
    const pairs = search.replace(/^\?/, "").split("&").filter(Boolean);

    pairs.forEach((p) => {
      const [key, value] = p.split("=");
      if (!key) return;
      params[decodeURIComponent(key)] = decodeURIComponent(value || "");
    });

    return params;
  }

  function formatTime(timestampIso) {
    if (!timestampIso) return "";

    try {
      const d = new Date(timestampIso);
      const hours = String(d.getHours()).padStart(2, "0");
      const minutes = String(d.getMinutes()).padStart(2, "0");
      return `${hours}:${minutes}`;
    } catch (e) {
      return "";
    }
  }

  // ------------------------------------------
  // ELEMENTOS DE UI
  // ------------------------------------------

  let messagesContainer;
  let chatForm;
  let chatInput;
  let reloadButton;
  let currentUserLabel;
  let changeUserButton;

  let roomTitleEl;
  let roomSubtitleEl;
  let patientRoomsContainer;

  let navAgendaLink;
  let navProntuarioLink;

  let nextPatientSummaryEl;
  let nextPatientDetailsEl;
  let nextPatientStatusPillEl;
  let btnNextPatient;
  let btnRefreshNextPatient;

  // ------------------------------------------
  // SALAS
  // ------------------------------------------

  function getRoomButtons() {
    return document.querySelectorAll(".chat-room");
  }

  function attachRoomButtonEvents(btn) {
    btn.addEventListener("click", () => {
      const roomId = btn.dataset.roomId || "default";
      const label = btn.dataset.roomLabel || btn.textContent.trim();
      const description = btn.dataset.roomDescription || "";
      setCurrentRoom(roomId, label, description);
    });
  }

  function createDynamicRoom(roomId, label, description) {
    if (!patientRoomsContainer) return null;

    let btn = document.querySelector(`.chat-room[data-room-id="${roomId}"]`);
    if (btn) {
      if (label) btn.dataset.roomLabel = label;
      if (description) btn.dataset.roomDescription = description;
      return btn;
    }

    btn = document.createElement("button");
    btn.className = "chat-room";
    btn.dataset.roomId = roomId;
    if (label) btn.dataset.roomLabel = label;
    if (description) btn.dataset.roomDescription = description;
    btn.textContent = `💬 ${label || roomId}`;

    patientRoomsContainer.appendChild(btn);
    attachRoomButtonEvents(btn);
    return btn;
  }

  // ------------------------------------------
  // UI: MENSAGEM
  // ------------------------------------------

  function createMessageElement(msg) {
    const isMe = msg.sender === currentUserName;

    const wrapper = document.createElement("div");
    wrapper.className =
      "chat-message " + (isMe ? "chat-message--me" : "chat-message--other");

    const meta = document.createElement("div");
    meta.className = "chat-message__meta";

    const senderSpan = document.createElement("span");
    senderSpan.className = "chat-message__sender";
    senderSpan.textContent = msg.sender || "Anônimo";

    const timeSpan = document.createElement("span");
    timeSpan.className = "chat-message__time";
    timeSpan.textContent = formatTime(msg.timestamp);

    meta.appendChild(senderSpan);
    meta.appendChild(timeSpan);

    const textDiv = document.createElement("div");
    textDiv.className = "chat-message__text";
    textDiv.textContent = msg.message;

    wrapper.appendChild(meta);
    wrapper.appendChild(textDiv);

    return wrapper;
  }

  function renderMessages(messages) {
    if (!messagesContainer) return;

    messagesContainer.innerHTML = "";

    if (!messages || messages.length === 0) {
      const empty = document.createElement("div");
      empty.className = "chat-empty";
      empty.textContent = "Nenhuma mensagem ainda. Comece a conversa!";
      messagesContainer.appendChild(empty);

      delete lastTimestampByRoom[currentRoomId];
      return;
    }

    let lastTimestamp = null;

    messages.forEach((msg) => {
      const el = createMessageElement(msg);
      messagesContainer.appendChild(el);
      if (msg.timestamp) lastTimestamp = msg.timestamp;
    });

    if (lastTimestamp) lastTimestampByRoom[currentRoomId] = lastTimestamp;

    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  function appendMessages(messages) {
    if (!messagesContainer || !messages || messages.length === 0) return;

    let lastTimestamp = lastTimestampByRoom[currentRoomId] || null;

    messages.forEach((msg) => {
      const el = createMessageElement(msg);
      messagesContainer.appendChild(el);
      if (msg.timestamp) lastTimestamp = msg.timestamp;
    });

    if (lastTimestamp) lastTimestampByRoom[currentRoomId] = lastTimestamp;

    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // ------------------------------------------
  // LEITURA / NÃO LIDAS
  // ------------------------------------------

  async function markRoomAsRead() {
    if (!currentUserId) return;
    const lastTs = lastTimestampByRoom[currentRoomId];
    if (!lastTs) return;

    try {
      await callApiData({
        action: "chat.markAsRead",
        payload: {
          roomId: currentRoomId,
          userId: currentUserId,
          lastTimestamp: lastTs,
        },
      });
    } catch (error) {
      console.warn(
        "[PRONTIO.chat] Erro ao marcar mensagens como lidas:",
        error && error.message ? error.message : String(error)
      );
    }
  }

  async function updateUnreadSummary() {
    if (!currentUserId) return;

    try {
      const result = await callApiData({
        action: "chat.getUnreadSummary",
        payload: { userId: currentUserId },
      });

      const rooms = (result && result.rooms) || [];
      const map = {};
      rooms.forEach((r) => {
        map[r.roomId] = r.unreadCount || 0;
      });

      applyUnreadBadges(map);
    } catch (error) {
      console.warn(
        "[PRONTIO.chat] Erro ao atualizar resumo de não lidas:",
        error && error.message ? error.message : String(error)
      );
    }
  }

  function applyUnreadBadges(unreadMap) {
    const buttons = getRoomButtons();
    if (!buttons.length) return;

    buttons.forEach((btn) => {
      const roomId = btn.dataset.roomId || "default";
      const count = unreadMap[roomId] || 0;

      let badge = btn.querySelector(".chat-room__badge");

      if (count > 0) {
        if (!badge) {
          badge = document.createElement("span");
          badge.className = "chat-room__badge";
          btn.appendChild(badge);
        }
        badge.textContent = count > 9 ? "9+" : String(count);
        badge.style.display = "inline-flex";
      } else if (badge) {
        badge.style.display = "none";
      }
    });
  }

  // ------------------------------------------
  // CARREGAR MENSAGENS
  // ------------------------------------------

  async function loadMessages(showErrors = false) {
    try {
      const result = await callApiData({
        action: "chat.listMessages",
        payload: { roomId: currentRoomId },
      });

      const messages = (result && result.messages) || [];
      renderMessages(messages);

      await markRoomAsRead();
      await updateUnreadSummary();
    } catch (error) {
      if (showErrors) {
        global.alert("Erro ao carregar mensagens: " + (error && error.message ? error.message : String(error)));
      }
    }
  }

  async function refreshMessagesIncremental(showErrors = false) {
    const lastTs = lastTimestampByRoom[currentRoomId];

    if (!lastTs) {
      return loadMessages(showErrors);
    }

    try {
      const result = await callApiData({
        action: "chat.listMessagesSince",
        payload: {
          roomId: currentRoomId,
          afterTimestamp: lastTs,
        },
      });

      const newMessages = (result && result.messages) || [];
      appendMessages(newMessages);

      await markRoomAsRead();
      await updateUnreadSummary();
    } catch (error) {
      if (showErrors) {
        global.alert("Erro ao atualizar mensagens: " + (error && error.message ? error.message : String(error)));
      }
    }
  }

  // ------------------------------------------
  // ENVIAR MENSAGEM
  // ------------------------------------------

  async function sendMessage(text) {
    const trimmed = text.trim();
    if (!trimmed) return;

    try {
      const result = await callApiData({
        action: "chat.sendMessage",
        payload: {
          roomId: currentRoomId,
          sender: currentUserName,
          message: trimmed,
        },
      });

      const messages = (result && result.messages) ? result.messages : [];
      renderMessages(messages);

      await markRoomAsRead();
      await updateUnreadSummary();

      if (chatInput) {
        chatInput.value = "";
        chatInput.focus();
      }
    } catch (error) {
      global.alert("Erro ao enviar mensagem: " + (error && error.message ? error.message : String(error)));
    }
  }

  async function sendSystemMessageToRoom(roomId, text) {
    try {
      await callApiData({
        action: "chat.sendMessage",
        payload: {
          roomId: roomId,
          sender: "Sistema",
          message: text,
        },
      });

      if (roomId === currentRoomId) {
        await loadMessages(false);
      } else {
        await updateUnreadSummary();
      }
    } catch (error) {
      console.warn(
        "[PRONTIO.chat] Falha ao enviar mensagem de sistema:",
        error && error.message ? error.message : String(error)
      );
    }
  }

  // ------------------------------------------
  // USUÁRIO DO CHAT
  // ------------------------------------------

  function updateUserLabel() {
    if (!currentUserLabel) return;

    if (currentUserName && currentUserType) {
      currentUserLabel.textContent = `Você: ${currentUserName} (${currentUserType})`;
    } else if (currentUserName) {
      currentUserLabel.textContent = `Você: ${currentUserName}`;
    } else {
      currentUserLabel.textContent = "Usuário não definido";
    }
  }

  function loadUserFromLocalStorage() {
    try {
      const raw = global.localStorage.getItem(LOCALSTORAGE_USER_INFO_KEY);
      if (!raw) return false;

      const info = JSON.parse(raw);
      if (!info || !info.idUsuario || !info.nome) return false;

      currentUserId = info.idUsuario;
      currentUserName = info.nome;
      currentUserType = info.tipo || "";
      updateUserLabel();
      return true;
    } catch (e) {
      console.warn("[PRONTIO.chat] Falha ao ler usuário do localStorage:", e);
      return false;
    }
  }

  function saveUserToLocalStorage(user) {
    const info = {
      idUsuario: user.idUsuario,
      nome: user.nome,
      tipo: user.tipo || "",
    };
    global.localStorage.setItem(LOCALSTORAGE_USER_INFO_KEY, JSON.stringify(info));

    currentUserId = info.idUsuario;
    currentUserName = info.nome;
    currentUserType = info.tipo || "";
    updateUserLabel();
  }

  async function fetchUsersFromBackend() {
    const result = await callApiData({
      action: "usuarios.listAll",
      payload: {},
    });

    const users = (result && result.users) || [];
    return users;
  }

  async function chooseUserInteractive() {
    const users = await fetchUsersFromBackend();

    if (!users || users.length === 0) {
      const nome = global.prompt(
        "Nenhum usuário cadastrado. Informe um nome para usar no chat:"
      );
      const fakeUser = {
        idUsuario: "FAKE-" + Date.now(),
        nome: nome || "Usuário",
        tipo: "LOCAL",
      };
      return fakeUser;
    }

    let msg = "Escolha seu usuário:\n\n";
    users.forEach((u, idx) => {
      const n = idx + 1;
      const tipo = u.tipo ? ` (${u.tipo})` : "";
      msg += `${n} - ${u.nome}${tipo}\n`;
    });
    msg += "\nDigite o número correspondente:";

    let chosenIndex = null;

    while (chosenIndex === null) {
      const input = global.prompt(msg);
      if (input === null) return null;

      const n = parseInt(input, 10);
      if (!isNaN(n) && n >= 1 && n <= users.length) {
        chosenIndex = n - 1;
      } else {
        global.alert("Opção inválida, tente novamente.");
      }
    }

    return users[chosenIndex];
  }

  async function ensureCurrentUser() {
    const ok = loadUserFromLocalStorage();
    if (ok) return;

    const user = await chooseUserInteractive();
    if (user) {
      saveUserToLocalStorage(user);
    } else {
      currentUserId = "ANON-" + Date.now();
      currentUserName = "Usuário";
      currentUserType = "";
      updateUserLabel();
    }
  }

  async function changeUser() {
    const user = await chooseUserInteractive();
    if (user) {
      saveUserToLocalStorage(user);
      await loadMessages(true);
      await updateUnreadSummary();
    }
  }

  // ------------------------------------------
  // GERENCIAMENTO DE SALAS
  // ------------------------------------------

  function setCurrentRoom(roomId, label, description) {
    currentRoomId = roomId || "default";

    const buttons = getRoomButtons();
    buttons.forEach((btn) => {
      const thisRoomId = btn.dataset.roomId || "default";
      if (thisRoomId === currentRoomId) btn.classList.add("chat-room--active");
      else btn.classList.remove("chat-room--active");
    });

    if (roomTitleEl) roomTitleEl.textContent = label || "Chat principal";
    if (roomSubtitleEl) roomSubtitleEl.textContent = description || "Canal interno de comunicação.";

    loadMessages(true);
  }

  function setupRoomSwitching() {
    const buttons = getRoomButtons();
    if (!buttons.length) return;

    buttons.forEach((btn) => attachRoomButtonEvents(btn));

    const active = document.querySelector(".chat-room.chat-room--active");
    if (active) {
      const roomId = active.dataset.roomId || "default";
      const label = active.dataset.roomLabel || active.textContent.trim();
      const description = active.dataset.roomDescription || "";
      setCurrentRoom(roomId, label, description);
    } else {
      const first = buttons[0];
      if (first) {
        const roomId = first.dataset.roomId || "default";
        const label = first.dataset.roomLabel || first.textContent.trim();
        const description = first.dataset.roomDescription || "";
        setCurrentRoom(roomId, label, description);
      }
    }
  }

  function openPatientRoom(patient) {
    if (!patientRoomsContainer) return;

    const idPaciente = patient.idPaciente || "";
    const idAgenda = patient.idAgenda || "";
    const baseId = idPaciente || idAgenda || "sem-id";
    const roomId = "paciente-" + baseId;

    const label =
      patient.nomePaciente ? `Paciente: ${patient.nomePaciente}` : "Sala do paciente";

    const dataTexto = patient.dataBr || patient.data || "";
    const horaTexto = patient.horario || "";
    const descBase = `${dataTexto} ${horaTexto}`.trim();
    const description = descBase
      ? `Sala de anotações internas (${descBase})`
      : "Sala de anotações internas do paciente";

    const btn = createDynamicRoom(roomId, label, description);
    if (!btn) return;

    btn.classList.add("chat-room--active");
    setCurrentRoom(roomId, label, description);
  }

  // ------------------------------------------
  // NAV LINKS (AGENDA / PRONTUÁRIO)
  // ------------------------------------------

  function setupNavLinks(params) {
    const agendaId = params.agendaId || params.idAgenda || "";
    const pacienteId = params.pacienteId || params.idPaciente || "";
    const pacienteNome = params.pacienteNome || params.nome || "";
    const data = params.data || "";
    const horario = params.horario || "";
    const nascimento = params.nascimento || "";

    if (agendaId && navAgendaLink) {
      const url = new URL("agenda.html", global.location.origin);
      url.searchParams.set("agendaId", agendaId);
      if (pacienteId) url.searchParams.set("pacienteId", pacienteId);
      if (pacienteNome) url.searchParams.set("pacienteNome", pacienteNome);
      if (data) url.searchParams.set("data", data);
      if (horario) url.searchParams.set("horario", horario);

      navAgendaLink.href = url.toString();
      navAgendaLink.style.display = "inline-flex";
    }

    if (pacienteId && navProntuarioLink) {
      const url = new URL("prontuario.html", global.location.origin);
      url.searchParams.set("pacienteId", pacienteId);
      if (pacienteNome) url.searchParams.set("pacienteNome", pacienteNome);
      if (nascimento) url.searchParams.set("nascimento", nascimento);
      if (agendaId) url.searchParams.set("agendaId", agendaId);
      if (data) url.searchParams.set("data", data);
      if (horario) url.searchParams.set("horario", horario);

      navProntuarioLink.href = url.toString();
      navProntuarioLink.style.display = "inline-flex";
    }
  }

  function applyInitialRoomFromParams(params) {
    const agendaId = params.agendaId || params.idAgenda || "";
    const pacienteId = params.pacienteId || params.idPaciente || "";
    const pacienteNome = params.pacienteNome || params.nome || "";
    const data = params.data || "";
    const horario = params.horario || "";

    let initialRoomId = null;
    let initialLabel = null;
    let initialDesc = null;

    if (agendaId) {
      const roomId = "agenda-" + agendaId;
      const label = pacienteNome
        ? `Consulta: ${pacienteNome}`
        : `Consulta ${agendaId}`;
      const descBase = `${data} ${horario}`.trim();
      const description = descBase
        ? `Chat da consulta (${descBase})`
        : "Chat desta consulta";

      const btn = createDynamicRoom(roomId, label, description);
      if (btn) {
        btn.classList.add("chat-room--active");
        initialRoomId = roomId;
        initialLabel = label;
        initialDesc = description;
      }
    } else if (pacienteId) {
      const roomId = "paciente-" + pacienteId;
      const label = pacienteNome
        ? `Paciente: ${pacienteNome}`
        : `Paciente ${pacienteId}`;
      const description = "Chat crônico do paciente";

      const btn = createDynamicRoom(roomId, label, description);
      if (btn) {
        btn.classList.add("chat-room--active");
        initialRoomId = roomId;
        initialLabel = label;
        initialDesc = description;
      }
    }

    if (initialRoomId) {
      const defaultBtn = document.querySelector('.chat-room[data-room-id="default"]');
      if (defaultBtn) defaultBtn.classList.remove("chat-room--active");
      setCurrentRoom(initialRoomId, initialLabel, initialDesc);
    }
  }

  // ------------------------------------------
  // PRÓXIMO PACIENTE
  // ------------------------------------------

  function setNextPatientStatusPill(mode, text) {
    if (!nextPatientStatusPillEl) return;

    nextPatientStatusPillEl.className =
      "next-patient__status-pill next-patient__status-pill--" + mode;
    nextPatientStatusPillEl.textContent = text;
  }

  function updateNextPatientPanel(patient, options = {}) {
    const { isCalled } = options;

    if (!nextPatientSummaryEl || !nextPatientDetailsEl) return;

    if (!patient) {
      nextPatientSummaryEl.textContent = "Nenhum paciente na fila neste momento.";
      nextPatientDetailsEl.textContent = "";
      setNextPatientStatusPill("empty", "Fila vazia");
      return;
    }

    const nome = patient.nomePaciente || "Paciente sem nome";
    const horario = patient.horario || "--:--";
    const dataBr = patient.dataBr || patient.data || "";

    if (isCalled) {
      nextPatientSummaryEl.textContent = `${nome}`;
      nextPatientDetailsEl.textContent = `Em atendimento agora • ${dataBr} às ${horario}`;
      setNextPatientStatusPill("in-progress", "Em atendimento");
    } else {
      nextPatientSummaryEl.textContent = `${nome}`;
      nextPatientDetailsEl.textContent = `Agendado para ${dataBr} às ${horario}`;
      setNextPatientStatusPill("waiting", "Aguardando");
    }
  }

  async function loadNextPatient(showErrors = false) {
    if (!nextPatientSummaryEl) return;

    try {
      const result = await callApiData({
        action: "agenda.peekNextPatient",
        payload: {},
      });

      const data = result || {};
      const hasPatient = !!data.hasPatient;
      const patient = data.patient || null;

      if (!hasPatient) updateNextPatientPanel(null);
      else updateNextPatientPanel(patient, { isCalled: false });
    } catch (error) {
      if (showErrors) {
        global.alert("Erro ao carregar próximo paciente: " + (error && error.message ? error.message : String(error)));
      }
      setNextPatientStatusPill("error", "Erro");
    }
  }

  async function callNextPatient() {
    if (!nextPatientSummaryEl) return;

    try {
      const result = await callApiData({
        action: "agenda.nextPatient",
        payload: {},
      });

      const data = result || {};
      const hasPatient = !!data.hasPatient;
      const patient = data.patient || null;

      if (!hasPatient || !patient) {
        updateNextPatientPanel(null);
        global.alert("Não há pacientes na fila agora.");
        return;
      }

      updateNextPatientPanel(patient, { isCalled: true });
      openPatientRoom(patient);

      const nome = patient.nomePaciente || "Paciente";
      const horario = patient.horario || "--:--";
      const dataBr = patient.dataBr || patient.data || "";

      const msg = `Próximo paciente chamado: ${nome} (${dataBr} às ${horario}).`;
      await sendSystemMessageToRoom("default", msg);
    } catch (error) {
      global.alert("Erro ao chamar próximo paciente: " + (error && error.message ? error.message : String(error)));
      setNextPatientStatusPill("error", "Erro");
    }
  }

  function setupNextPatientPanel() {
    if (btnRefreshNextPatient) {
      btnRefreshNextPatient.addEventListener("click", () => loadNextPatient(true));
    }

    if (btnNextPatient) {
      btnNextPatient.addEventListener("click", () => callNextPatient());
    }

    loadNextPatient(false);
  }

  // ------------------------------------------
  // POLLING INTELIGENTE
  // ------------------------------------------

  function updateLastUserActivity() {
    lastUserActivityTs = Date.now();
  }

  function scheduleAutoRefresh(newInterval) {
    if (newInterval === currentRefreshInterval && autoRefreshTimer !== null) return;

    currentRefreshInterval = newInterval;

    if (autoRefreshTimer) clearInterval(autoRefreshTimer);

    autoRefreshTimer = global.setInterval(async () => {
      const now = Date.now();
      const idleTime = now - lastUserActivityTs;
      const pageHidden = document.hidden || !document.hasFocus();

      let targetInterval = CHAT_INTERVAL_ACTIVE;

      if (pageHidden) targetInterval = CHAT_INTERVAL_BACKGROUND;
      else if (idleTime > USER_IDLE_MS) targetInterval = CHAT_INTERVAL_IDLE;
      else targetInterval = CHAT_INTERVAL_ACTIVE;

      if (targetInterval !== currentRefreshInterval) {
        scheduleAutoRefresh(targetInterval);
        return;
      }

      await refreshMessagesIncremental(false);
    }, currentRefreshInterval);
  }

  function setupActivityTracking() {
    const activityEvents = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"];
    activityEvents.forEach((ev) => {
      global.addEventListener(ev, updateLastUserActivity, { passive: true });
    });

    global.addEventListener("focus", () => {
      updateLastUserActivity();
      scheduleAutoRefresh(CHAT_INTERVAL_ACTIVE);
    });

    global.addEventListener("blur", () => {
      scheduleAutoRefresh(CHAT_INTERVAL_BACKGROUND);
    });

    document.addEventListener("visibilitychange", () => {
      updateLastUserActivity();
      if (document.hidden) scheduleAutoRefresh(CHAT_INTERVAL_BACKGROUND);
      else scheduleAutoRefresh(CHAT_INTERVAL_ACTIVE);
    });
  }

  // ------------------------------------------
  // EVENTOS DE UI
  // ------------------------------------------

  function setupEventHandlers() {
    if (chatForm) {
      chatForm.addEventListener("submit", function (event) {
        event.preventDefault();
        if (!chatInput) return;
        sendMessage(chatInput.value);
      });
    }

    if (chatInput) {
      chatInput.addEventListener("keydown", function (event) {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          sendMessage(chatInput.value);
        }
      });
    }

    if (reloadButton) {
      reloadButton.addEventListener("click", function () {
        loadMessages(true);
      });
    }

    if (changeUserButton) {
      changeUserButton.addEventListener("click", function () {
        changeUser();
      });
    }

    setupRoomSwitching();
    setupNextPatientPanel();
    setupActivityTracking();
  }

  // ------------------------------------------
  // INIT PAGE
  // ------------------------------------------

  async function initChatPage() {
    console.log("[PRONTIO.chat] initChatPage");

    messagesContainer = document.getElementById("chat-messages");
    chatForm = document.getElementById("chat-form");
    chatInput = document.getElementById("chat-input");
    reloadButton = document.getElementById("reload-button");
    currentUserLabel = document.getElementById("current-user-label");
    changeUserButton = document.getElementById("change-user-button");

    roomTitleEl = document.getElementById("chat-room-title");
    roomSubtitleEl = document.getElementById("chat-room-subtitle");
    patientRoomsContainer = document.getElementById("patient-rooms");

    navAgendaLink = document.getElementById("chat-nav-agenda");
    navProntuarioLink = document.getElementById("chat-nav-prontuario");

    nextPatientSummaryEl = document.getElementById("next-patient-summary");
    nextPatientDetailsEl = document.getElementById("next-patient-details");
    nextPatientStatusPillEl = document.getElementById("next-patient-status-pill");
    btnNextPatient = document.getElementById("btn-next-patient");
    btnRefreshNextPatient = document.getElementById("btn-refresh-next-patient");

    await ensureCurrentUser();

    const params = getQueryParams();

    applyInitialRoomFromParams(params);
    setupNavLinks(params);

    setupEventHandlers();
    await updateUnreadSummary();

    scheduleAutoRefresh(CHAT_INTERVAL_ACTIVE);
  }

  if (typeof PRONTIO.registerPage === "function") {
    PRONTIO.registerPage("chat", initChatPage);
  } else {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        initChatPage().catch((err) => {
          console.error("[PRONTIO.chat] Erro ao iniciar o chat:", err);
          global.alert("Erro ao iniciar o chat. Verifique a conexão com a API.");
        });
      });
    } else {
      initChatPage().catch((err) => {
        console.error("[PRONTIO.chat] Erro ao iniciar o chat:", err);
        global.alert("Erro ao iniciar o chat. Verifique a conexão com a API.");
      });
    }
  }
})(window, document);
