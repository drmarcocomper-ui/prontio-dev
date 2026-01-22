/**
 * PRONTIO - Registry.gs (ENTRY)
 * Registry central de actions para Api.gs.
 *
 * Implementação modular em: backend/data/registry/*.gs
 */

var REGISTRY_ACTIONS = null;

function Registry_getAction_(action) {
  action = String(action || "").trim();
  if (!action) return null;

  if (!REGISTRY_ACTIONS) {
    REGISTRY_ACTIONS = _Registry_build_();
  }

  return REGISTRY_ACTIONS[action] || null;
}
