function Registry_RegisterAuth_(map) {
  // DIAGNÓSTICO (DEV)
  map["Registry_ListActions"] = {
    action: "Registry_ListActions",
    handler: Registry_ListActions,
    requiresAuth: false,
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  // AUTH
  map["Auth_Login"] = {
    action: "Auth_Login",
    handler: Auth_Login,
    requiresAuth: false,
    roles: [],
    validations: [],
    requiresLock: true,
    lockKey: "Auth_Login"
  };

  map["Auth_Me"] = {
    action: "Auth_Me",
    handler: Auth_Me,
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  map["Auth_Logout"] = {
    action: "Auth_Logout",
    handler: Auth_Logout,
    requiresAuth: true,
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  if (String(PRONTIO_ENV).toUpperCase() === "DEV" && typeof Auth_ResetSenhaDev === "function") {
    map["Auth_ResetSenhaDev"] = {
      action: "Auth_ResetSenhaDev",
      handler: Auth_ResetSenhaDev,
      requiresAuth: false,
      roles: [],
      validations: [],
      requiresLock: true,
      lockKey: "Auth_ResetSenhaDev"
    };
  }

  // AUTH RECOVERY (públicas)
  map["Auth_ForgotPassword_Request"] = {
    action: "Auth_ForgotPassword_Request",
    handler: Auth_ForgotPassword_Request,
    requiresAuth: false,
    roles: [],
    validations: [],
    requiresLock: true,
    lockKey: "Auth_ForgotPassword_Request"
  };

  map["Auth_ForgotPassword_ValidateToken"] = {
    action: "Auth_ForgotPassword_ValidateToken",
    handler: Auth_ForgotPassword_ValidateToken,
    requiresAuth: false,
    roles: [],
    validations: [],
    requiresLock: false,
    lockKey: null
  };

  map["Auth_ForgotPassword_Reset"] = {
    action: "Auth_ForgotPassword_Reset",
    handler: Auth_ForgotPassword_Reset,
    requiresAuth: false,
    roles: [],
    validations: [],
    requiresLock: true,
    lockKey: "Auth_ForgotPassword_Reset"
  };
}
