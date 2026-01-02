/**
 * ============================================================
 * PRONTIO - ChatCompat.gs
 * ============================================================
 * Stubs para NÃO quebrar o chat.html enquanto:
 * - usuarios.listAll ainda não existe de verdade no backend
 * - agenda.peekNextPatient / agenda.nextPatient ainda não existem
 *
 * Estratégia:
 * - usuarios.listAll -> retorna { users: [] } (front cai no prompt)
 * - agenda.peekNextPatient -> { hasPatient:false }
 * - agenda.nextPatient -> { hasPatient:false }
 *
 * Depois, quando você implementar isso nos módulos reais (Usuarios/Agenda/Atendimento),
 * basta trocar no Registry para apontar para os handlers reais.
 */

function ChatCompat_Usuarios_ListAll_(ctx, payload) {
  return { users: [] };
}

function ChatCompat_Agenda_PeekNextPatient_(ctx, payload) {
  return { hasPatient: false, patient: null };
}

function ChatCompat_Agenda_NextPatient_(ctx, payload) {
  return { hasPatient: false, patient: null };
}
