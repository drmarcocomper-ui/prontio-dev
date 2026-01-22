function Registry_RegisterChat_(map) {
  map["chat.sendMessage"] = {
    action: "chat.sendMessage",
    handler: (typeof Chat_Action_SendMessage_ === "function")
      ? Chat_Action_SendMessage_
      : _Registry_missingHandler_("Chat_Action_SendMessage_"),
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: true,
    lockKey: "CHAT"
  };

  map["chat.listMessages"] = {
    action: "chat.listMessages",
    handler: (typeof Chat_Action_ListMessages_ === "function")
      ? Chat_Action_ListMessages_
      : _Registry_missingHandler_("Chat_Action_ListMessages_"),
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  map["chat.listMessagesSince"] = {
    action: "chat.listMessagesSince",
    handler: (typeof Chat_Action_ListMessagesSince_ === "function")
      ? Chat_Action_ListMessagesSince_
      : _Registry_missingHandler_("Chat_Action_ListMessagesSince_"),
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  map["chat.markAsRead"] = {
    action: "chat.markAsRead",
    handler: (typeof Chat_Action_MarkAsRead_ === "function")
      ? Chat_Action_MarkAsRead_
      : _Registry_missingHandler_("Chat_Action_MarkAsRead_"),
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: true,
    lockKey: "CHAT"
  };

  map["chat.getUnreadSummary"] = {
    action: "chat.getUnreadSummary",
    handler: (typeof Chat_Action_GetUnreadSummary_ === "function")
      ? Chat_Action_GetUnreadSummary_
      : _Registry_missingHandler_("Chat_Action_GetUnreadSummary_"),
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  map["chat.listByPaciente"] = {
    action: "chat.listByPaciente",
    handler: (typeof Chat_Action_ListByPaciente_ === "function")
      ? Chat_Action_ListByPaciente_
      : _Registry_missingHandler_("Chat_Action_ListByPaciente_"),
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  map["chat.sendByPaciente"] = {
    action: "chat.sendByPaciente",
    handler: (typeof Chat_Action_SendByPaciente_ === "function")
      ? Chat_Action_SendByPaciente_
      : _Registry_missingHandler_("Chat_Action_SendByPaciente_"),
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: true,
    lockKey: "CHAT"
  };

  // COMPAT DO CHAT
  map["usuarios.listAll"] = {
    action: "usuarios.listAll",
    handler: (typeof ChatCompat_Usuarios_ListAll_ === "function")
      ? ChatCompat_Usuarios_ListAll_
      : _Registry_missingHandler_("ChatCompat_Usuarios_ListAll_"),
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  map["agenda.peekNextPatient"] = {
    action: "agenda.peekNextPatient",
    handler: (typeof ChatCompat_Agenda_PeekNextPatient_ === "function")
      ? ChatCompat_Agenda_PeekNextPatient_
      : _Registry_missingHandler_("ChatCompat_Agenda_PeekNextPatient_"),
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  map["agenda.nextPatient"] = {
    action: "agenda.nextPatient",
    handler: (typeof ChatCompat_Agenda_NextPatient_ === "function")
      ? ChatCompat_Agenda_NextPatient_
      : _Registry_missingHandler_("ChatCompat_Agenda_NextPatient_"),
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: true,
    lockKey: "ATENDIMENTO"
  };
}
