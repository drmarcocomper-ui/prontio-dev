/**
 * PRONTIO - Usuarios.gs (ENTRY)
 * Mantém compatibilidade: handleUsuariosAction(action,payload,ctx)
 *
 * Implementação modular em domain/Usuarios/*.gs
 */
function handleUsuariosAction(action, payload, ctx) {
  return handleUsuariosAction_(action, payload, ctx);
}
