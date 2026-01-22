function handleAgendaAction_(action, payload) {
  payload = payload || {};

  var ctx = {
    action: String(action || ""),
    user: null,
    env: (typeof PRONTIO_ENV !== "undefined" ? PRONTIO_ENV : "DEV"),
    apiVersion: (typeof PRONTIO_API_VERSION !== "undefined" ? PRONTIO_API_VERSION : "1.0.0-DEV")
  };

  var a = String(action || "").trim();

  // Actions NOVAS
  if (a === "Agenda.ListarPorPeriodo") return Agenda_Action_ListarPorPeriodo_(ctx, payload);
  if (a === "Agenda.Criar") return Agenda_Action_Criar_(ctx, payload);
  if (a === "Agenda.Atualizar") return Agenda_Action_Atualizar_(ctx, payload);
  if (a === "Agenda.Cancelar") return Agenda_Action_Cancelar_(ctx, payload);

  // ✅ validar conflito oficial
  if (a === "Agenda_ValidarConflito") return Agenda_Action_ValidarConflito_(ctx, payload);

  // Actions LEGACY
  if (a === "Agenda_ListarDia") return Agenda_Legacy_ListarDia_(ctx, payload);
  if (a === "Agenda_ListarSemana") return Agenda_Legacy_ListarSemana_(ctx, payload);
  if (a === "Agenda_Criar") return Agenda_Legacy_Criar_(ctx, payload);
  if (a === "Agenda_Atualizar") return Agenda_Legacy_Atualizar_(ctx, payload);
  if (a === "Agenda_BloquearHorario") return Agenda_Legacy_BloquearHorario_(ctx, payload);
  if (a === "Agenda_MudarStatus") return Agenda_Legacy_MudarStatus_(ctx, payload);
  if (a === "Agenda_RemoverBloqueio") return Agenda_Legacy_RemoverBloqueio_(ctx, payload);

  // Adapter antigo
  if (a === "Agenda_ListarEventosDiaParaValidacao") {
    var ds = payload && payload.data ? String(payload.data) : "";
    return { items: Agenda_ListarEventosDiaParaValidacao_(ds) };
  }

  _agendaThrow_("NOT_FOUND", "Action de Agenda não reconhecida.", { action: a });
}
