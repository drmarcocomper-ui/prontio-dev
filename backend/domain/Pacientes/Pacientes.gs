// Pacientes.gs (ENTRY/FACHADA)
// Mantém compatibilidade: Api/Registry chamam handlePacientesAction(action,payload,ctx)

function handlePacientesAction(action, payload, ctx) {
  return handlePacientesAction_(action, payload, ctx);
}
