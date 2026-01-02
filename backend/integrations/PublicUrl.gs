/**
 * ============================================================
 * PRONTIO - PublicUrl.gs
 * ============================================================
 * Pilar H: Base URL pública do FRONT-END
 *
 * Objetivo:
 * - Evitar hardcode de domínio (GitHub Pages é temporário)
 * - Permitir trocar DEV/STAGING/PROD com 1 linha
 *
 * Como usar:
 * - Defina PRONTIO_PUBLIC_BASE_URL aqui (sem barra no final)
 * - Ex.: "https://app.prontio.com.br"
 *
 * Observação:
 * - Mantido como arquivo separado para NÃO mexer no seu Config.gs existente.
 */

// ✅ NÃO coloque barra no final
// Exemplo temporário (dev/github pages):
// var PRONTIO_PUBLIC_BASE_URL = "https://drmarcocomper-ui.github.io/prontio-dev/frontend";

// Produção (futuro):
// var PRONTIO_PUBLIC_BASE_URL = "https://app.prontio.com.br";

// Default seguro: vazio => AuthRecovery usa link relativo (útil para DEV local)
var PRONTIO_PUBLIC_BASE_URL = (typeof PRONTIO_PUBLIC_BASE_URL !== "undefined")
  ? PRONTIO_PUBLIC_BASE_URL
  : "";
