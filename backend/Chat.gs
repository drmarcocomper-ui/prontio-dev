/**
 * ============================================================
 * PRONTIO - Chat.gs
 * ============================================================
 * Contrato (front page-chat.js):
 * - chat.sendMessage         payload: { roomId, sender, message } -> retorna { messages: [...] }
 * - chat.listMessages        payload: { roomId } -> retorna { messages: [...] }
 * - chat.listMessagesSince   payload: { roomId, afterTimestamp } -> retorna { messages: [...] }
 * - chat.markAsRead          payload: { roomId, userId, lastTimestamp } -> retorna { ok:true }
 * - chat.getUnreadSummary    payload: { userId } -> retorna { rooms: [{roomId, unreadCount}] }
 *
 * Usado no prontuário:
 * - chat.listByPaciente      payload: { idPaciente } -> { messages:[...] }  (roomId = "paciente-"+idPaciente)
 * - chat.sendByPaciente      payload: { idPaciente, text } -> { messages:[...] }
 *
 * Storage:
 * - Aba "ChatMensagens": mensagens
 * - Aba "ChatLeituras": last read por sala/usuário (para unread badges)
 *
 * Retorna "data puro". Api.gs envelopa {success,data,errors}.
 */

var CHAT_SHEET_MESSAGES = "ChatMensagens";
var CHAT_SHEET_READS = "ChatLeituras";

function _chatThrow_(code, message, details) {
  var err = new Error(String(message || "Erro."));
  err.code = String(code || "INTERNAL_ERROR");
  err.details = (details === undefined ? null : details);
  throw err;
}

function _chatGetDb_() {
  if (typeof PRONTIO_getDb_ !== "function") {
    _chatThrow_("INTERNAL_ERROR", "PRONTIO_getDb_ não disponível.", null);
  }
  var ss = PRONTIO_getDb_();
  if (!ss) _chatThrow_("INTERNAL_ERROR", "PRONTIO_getDb_ retornou null/undefined.", null);
  return ss;
}

function _chatEnsureSheet_(name, header) {
  var ss = _chatGetDb_();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, header.length).setValues([header]);
    return sh;
  }

  // garante cabeçalho mínimo (não remove nada)
  var lastCol = sh.getLastColumn();
  if (lastCol < 1) {
    sh.getRange(1, 1, 1, header.length).setValues([header]);
    return sh;
  }

  var cur = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  var exists = {};
  for (var i = 0; i < cur.length; i++) {
    var k = String(cur[i] || "").trim();
    if (k) exists[k] = true;
  }

  var missing = [];
  for (var j = 0; j < header.length; j++) {
    if (!exists[header[j]]) missing.push(header[j]);
  }
  if (missing.length) {
    sh.getRange(1, lastCol + 1, 1, missing.length).setValues([missing]);
  }

  return sh;
}

function _chatHeaderMap_(sh) {
  var lastCol = sh.getLastColumn();
  var header = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  var map = {};
  for (var i = 0; i < header.length; i++) {
    var k = String(header[i] || "").trim();
    if (k) map[k] = i;
  }
  return map;
}

function _chatIsoNow_() {
  return new Date().toISOString();
}

function _chatParseIso_(s) {
  var ms = Date.parse(String(s || ""));
  return isFinite(ms) ? ms : 0;
}

function _chatMsgRowToObj_(row, hm) {
  function get(col) {
    var idx = hm[col];
    if (idx == null) return "";
    return row[idx];
  }

  return {
    id: String(get("ID_Mensagem") || ""),
    roomId: String(get("RoomId") || ""),
    sender: String(get("Sender") || ""),
    userId: String(get("UserId") || ""),
    message: String(get("Message") || ""),
    timestamp: String(get("TsISO") || "")
  };
}

function _chatListMessagesForRoom_(roomId) {
  roomId = String(roomId || "").trim() || "default";

  var sh = _chatEnsureSheet_(CHAT_SHEET_MESSAGES, [
    "ID_Mensagem",
    "RoomId",
    "TsISO",
    "Sender",
    "UserId",
    "Message"
  ]);
  var hm = _chatHeaderMap_(sh);

  var lastRow = sh.getLastRow();
  var lastCol = sh.getLastColumn();
  if (lastRow < 2) return [];

  var values = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var out = [];

  for (var i = 0; i < values.length; i++) {
    var msg = _chatMsgRowToObj_(values[i], hm);
    if (!msg.id) continue;
    if (String(msg.roomId || "") !== roomId) continue;
    out.push(msg);
  }

  out.sort(function (a, b) {
    return _chatParseIso_(a.timestamp) - _chatParseIso_(b.timestamp);
  });

  return out;
}

function _chatSetLastRead_(roomId, userId, lastTimestampIso) {
  roomId = String(roomId || "").trim() || "default";
  userId = String(userId || "").trim();
  lastTimestampIso = String(lastTimestampIso || "").trim();

  if (!userId) _chatThrow_("VALIDATION_ERROR", "userId é obrigatório.", { field: "userId" });
  if (!lastTimestampIso) _chatThrow_("VALIDATION_ERROR", "lastTimestamp é obrigatório.", { field: "lastTimestamp" });

  var sh = _chatEnsureSheet_(CHAT_SHEET_READS, ["RoomId", "UserId", "LastReadISO"]);
  var hm = _chatHeaderMap_(sh);

  var idxRoom = hm["RoomId"];
  var idxUser = hm["UserId"];
  var idxLast = hm["LastReadISO"];
  if (idxRoom == null || idxUser == null || idxLast == null) {
    _chatThrow_("INTERNAL_ERROR", "Cabeçalho inválido em ChatLeituras.", null);
  }

  var lastRow = sh.getLastRow();
  var lastCol = sh.getLastColumn();

  if (lastRow < 2) {
    var row = new Array(lastCol).fill("");
    row[idxRoom] = roomId;
    row[idxUser] = userId;
    row[idxLast] = lastTimestampIso;
    sh.getRange(2, 1, 1, lastCol).setValues([row]);
    return true;
  }

  var values = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][idxRoom] || "") === roomId && String(values[i][idxUser] || "") === userId) {
      // update
      sh.getRange(i + 2, idxLast + 1, 1, 1).setValue(lastTimestampIso);
      return true;
    }
  }

  // insert
  var row2 = new Array(lastCol).fill("");
  row2[idxRoom] = roomId;
  row2[idxUser] = userId;
  row2[idxLast] = lastTimestampIso;
  sh.getRange(lastRow + 1, 1, 1, lastCol).setValues([row2]);
  return true;
}

function _chatGetLastReadMapForUser_(userId) {
  userId = String(userId || "").trim();
  if (!userId) return {};

  var sh = _chatEnsureSheet_(CHAT_SHEET_READS, ["RoomId", "UserId", "LastReadISO"]);
  var hm = _chatHeaderMap_(sh);

  var idxRoom = hm["RoomId"];
  var idxUser = hm["UserId"];
  var idxLast = hm["LastReadISO"];
  if (idxRoom == null || idxUser == null || idxLast == null) return {};

  var lastRow = sh.getLastRow();
  var lastCol = sh.getLastColumn();
  if (lastRow < 2) return {};

  var values = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var out = {};
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][idxUser] || "") !== userId) continue;
    var roomId = String(values[i][idxRoom] || "").trim();
    if (!roomId) continue;
    out[roomId] = String(values[i][idxLast] || "");
  }
  return out;
}

/**
 * ============================================================
 * ACTIONS expostas no Registry
 * ============================================================
 */

function Chat_Action_SendMessage_(ctx, payload) {
  payload = payload || {};
  var roomId = String(payload.roomId || "").trim() || "default";
  var sender = String(payload.sender || "").trim() || "Usuário";
  var message = String(payload.message || "").trim();
  var userId = String(payload.userId || "").trim(); // opcional no front do chat.html

  if (!message) _chatThrow_("VALIDATION_ERROR", "Mensagem vazia.", { field: "message" });

  var sh = _chatEnsureSheet_(CHAT_SHEET_MESSAGES, [
    "ID_Mensagem",
    "RoomId",
    "TsISO",
    "Sender",
    "UserId",
    "Message"
  ]);
  var hm = _chatHeaderMap_(sh);
  var lastCol = sh.getLastColumn();

  var idMsg = "MSG-" + Utilities.getUuid();
  var ts = _chatIsoNow_();

  var row = new Array(lastCol).fill("");
  function set(col, val) {
    var idx = hm[col];
    if (idx == null) return;
    row[idx] = (val === undefined || val === null) ? "" : val;
  }

  set("ID_Mensagem", idMsg);
  set("RoomId", roomId);
  set("TsISO", ts);
  set("Sender", sender);
  set("UserId", userId);
  set("Message", message);

  sh.getRange(sh.getLastRow() + 1, 1, 1, lastCol).setValues([row]);

  // Front espera: { messages: [...] }
  var messages = _chatListMessagesForRoom_(roomId);
  return { messages: messages };
}

function Chat_Action_ListMessages_(ctx, payload) {
  payload = payload || {};
  var roomId = String(payload.roomId || "").trim() || "default";
  var messages = _chatListMessagesForRoom_(roomId);
  return { messages: messages };
}

function Chat_Action_ListMessagesSince_(ctx, payload) {
  payload = payload || {};
  var roomId = String(payload.roomId || "").trim() || "default";
  var afterTs = String(payload.afterTimestamp || "").trim();
  if (!afterTs) _chatThrow_("VALIDATION_ERROR", "afterTimestamp é obrigatório.", { field: "afterTimestamp" });

  var afterMs = _chatParseIso_(afterTs);
  if (!afterMs) _chatThrow_("VALIDATION_ERROR", "afterTimestamp inválido.", { afterTimestamp: afterTs });

  var all = _chatListMessagesForRoom_(roomId);
  var out = all.filter(function (m) {
    return _chatParseIso_(m.timestamp) > afterMs;
  });

  return { messages: out };
}

function Chat_Action_MarkAsRead_(ctx, payload) {
  payload = payload || {};
  var roomId = String(payload.roomId || "").trim() || "default";
  var userId = String(payload.userId || "").trim();
  var lastTs = String(payload.lastTimestamp || "").trim();
  _chatSetLastRead_(roomId, userId, lastTs);
  return { ok: true };
}

function Chat_Action_GetUnreadSummary_(ctx, payload) {
  payload = payload || {};
  var userId = String(payload.userId || "").trim();
  if (!userId) _chatThrow_("VALIDATION_ERROR", "userId é obrigatório.", { field: "userId" });

  var readMap = _chatGetLastReadMapForUser_(userId);

  // Vamos contar apenas por roomId existentes em mensagens
  var sh = _chatEnsureSheet_(CHAT_SHEET_MESSAGES, [
    "ID_Mensagem",
    "RoomId",
    "TsISO",
    "Sender",
    "UserId",
    "Message"
  ]);
  var hm = _chatHeaderMap_(sh);
  var lastRow = sh.getLastRow();
  var lastCol = sh.getLastColumn();
  if (lastRow < 2) return { rooms: [] };

  var values = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();

  var idxRoom = hm["RoomId"];
  var idxTs = hm["TsISO"];
  if (idxRoom == null || idxTs == null) _chatThrow_("INTERNAL_ERROR", "Cabeçalho inválido em ChatMensagens.", null);

  var counts = {}; // roomId -> unreadCount

  for (var i = 0; i < values.length; i++) {
    var roomId = String(values[i][idxRoom] || "").trim() || "default";
    var ts = String(values[i][idxTs] || "");
    var tsMs = _chatParseIso_(ts);

    var lastReadIso = readMap[roomId] || "";
    var lastReadMs = lastReadIso ? _chatParseIso_(lastReadIso) : 0;

    if (tsMs > lastReadMs) {
      counts[roomId] = (counts[roomId] || 0) + 1;
    }
  }

  var rooms = Object.keys(counts).sort().map(function (rid) {
    return { roomId: rid, unreadCount: counts[rid] };
  });

  return { rooms: rooms };
}

// Conveniências usadas no prontuário
function Chat_Action_ListByPaciente_(ctx, payload) {
  payload = payload || {};
  var idPaciente = String(payload.idPaciente || payload.ID_Paciente || "").trim();
  if (!idPaciente) _chatThrow_("VALIDATION_ERROR", "idPaciente é obrigatório.", { field: "idPaciente" });
  var roomId = "paciente-" + idPaciente;
  return Chat_Action_ListMessages_(ctx, { roomId: roomId });
}

function Chat_Action_SendByPaciente_(ctx, payload) {
  payload = payload || {};
  var idPaciente = String(payload.idPaciente || payload.ID_Paciente || "").trim();
  if (!idPaciente) _chatThrow_("VALIDATION_ERROR", "idPaciente é obrigatório.", { field: "idPaciente" });

  var text = String(payload.text || payload.message || payload.mensagem || "").trim();
  if (!text) _chatThrow_("VALIDATION_ERROR", "Mensagem vazia.", { field: "text" });

  var roomId = "paciente-" + idPaciente;

  // tenta aproveitar sender se vier; senão usa "Usuário"
  var sender = String(payload.sender || "").trim() || "Usuário";
  var userId = String(payload.userId || "").trim();

  return Chat_Action_SendMessage_(ctx, {
    roomId: roomId,
    sender: sender,
    userId: userId,
    message: text
  });
}
