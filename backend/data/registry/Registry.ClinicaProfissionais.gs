// backend/data/registry/Registry.ClinicaProfissionais.gs
/**
 * PRONTIO - Registry.ClinicaProfissionais.gs
 * Stub canônico (sem quebrar)
 *
 * Motivo:
 * - Registry.Core chama Registry_RegisterClinicaProfissionais_(map)
 * - Se este arquivo estiver vazio, o build do Registry quebra e derruba:
 *   - Registry_ListActions (health-check)
 *   - e qualquer action que force build
 *
 * Quando o módulo Clinica/Profissionais estiver pronto,
 * substitua este stub registrando as actions reais.
 */

function Registry_RegisterClinicaProfissionais_(map) {
  // Stub: não registra actions por enquanto.
  // Mantido propositalmente vazio para não quebrar o deploy.
  return;
}
