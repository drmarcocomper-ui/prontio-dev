/**
 * ============================================================
 * PRONTIO - MigrationsAtendimento.gs
 * ============================================================
 * Adiciona a aba/entidade "Atendimento" ao MIGRATIONS_SHEETS
 * sem editar o Migrations.gs existente.
 *
 * Importante:
 * - Para criar a aba/headers, execute Meta_BootstrapDb (admin),
 *   que chama Migrations_bootstrap_().
 */

(function () {
  if (typeof MIGRATIONS_SHEETS === "undefined" || !MIGRATIONS_SHEETS) return;
  if (MIGRATIONS_SHEETS["Atendimento"]) return; // idempotente

  MIGRATIONS_SHEETS["Atendimento"] = [
    "idAtendimento",
    "idAgenda",
    "idProfissional",
    "idPaciente",
    "dataRef",
    "status",
    "ordem",
    "chegadaEm",
    "chamadoEm",
    "inicioAtendimentoEm",
    "concluidoEm",
    "sala",
    "observacoes",
    "criadoEm",
    "atualizadoEm",
    "ativo"
  ];
})();
