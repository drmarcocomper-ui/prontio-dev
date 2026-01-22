/**
 * PRONTIO - Agenda.gs
 * Fachada/entry do módulo (compatibilidade com Api.gs)
 * Implementação modular em domain/Agenda/*.gs
 */
function handleAgendaAction(action, payload) {
  return handleAgendaAction_(action, payload);
}
