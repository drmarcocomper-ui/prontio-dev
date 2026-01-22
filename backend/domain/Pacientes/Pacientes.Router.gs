/**
 * Roteador de ações
 * Mantém aliases e compatibilidade (não quebra front antigo).
 */
function handlePacientesAction_(action, payload, ctx) {
  if (action === 'Pacientes.ListarSelecao') action = 'Pacientes_ListarSelecao';
  if (action === 'Pacientes.Criar') action = 'Pacientes_Criar';
  if (action === 'Pacientes.BuscarSimples') action = 'Pacientes_BuscarSimples';
  if (action === 'Pacientes.Listar' || action === 'Pacientes.ListarTodos') action = 'Pacientes_Listar';
  if (action === 'Pacientes.ObterPorId') action = 'Pacientes_ObterPorId';
  if (action === 'Pacientes.Atualizar') action = 'Pacientes_Atualizar';
  if (action === 'Pacientes.AlterarStatus' || action === 'Pacientes.AlterarStatusAtivo') action = 'Pacientes_AlterarStatus';

  switch (action) {
    case 'Pacientes_DebugInfo':
      return Pacientes_DebugInfo(payload);

    case 'Pacientes_ListarSelecao':
      return Pacientes_ListarSelecao(payload);

    case 'Pacientes_Criar':
      return Pacientes_Criar(payload, ctx);

    case 'Pacientes_BuscarSimples':
      return Pacientes_BuscarSimples(payload);

    case 'Pacientes_Listar':
      return Pacientes_Listar(payload);

    case 'Pacientes_ObterPorId':
      return Pacientes_ObterPorId(payload);

    case 'Pacientes_Atualizar':
      return Pacientes_Atualizar(payload, ctx);

    case 'Pacientes_AlterarStatus':
      return Pacientes_AlterarStatus(payload, ctx);

    default:
      _pacientesThrow_('PACIENTES_UNKNOWN_ACTION', 'Ação de Pacientes desconhecida: ' + action, null);
  }
}
