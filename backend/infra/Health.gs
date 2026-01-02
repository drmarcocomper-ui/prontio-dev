/**
 * ============================================================
 * PRONTIO - Health.gs (FASE 6+)
 * ============================================================
 * - Meta.HealthCheck (tempo, acesso ao sheets, versão do DB, latência aproximada)
 * - Health.Integration (teste ponta-a-ponta do contrato canônico: AgendaConfig/Agenda)
 * - NÃO expõe detalhes de abas/colunas ao front; apenas status.
 *
 * IMPORTANTE:
 * - Health.Integration cria e desfaz um bloqueio (por padrão).
 *   Use payload.dryRun=true para não escrever nada.
 */

var HEALTH_CACHE_KEY = "health:check";
var HEALTH_CACHE_TTL_SECONDS = 10;

// (opcional) cache separado para integration dry-run (não cacheia quando cria dados)
var HEALTH_INTEGRATION_CACHE_KEY = "health:integration:dryrun";
var HEALTH_INTEGRATION_CACHE_TTL_SECONDS = 10;

/**
 * Handler da action Meta.HealthCheck
 */
function Meta_HealthCheck_(ctx, payload) {
  payload = payload || {};
  var started = new Date();

  // Cache curto para evitar chamadas repetidas em alta frequência
  if (typeof Cache_getJson_ === "function" && typeof Cache_setJson_ === "function") {
    var cached = Cache_getJson_(HEALTH_CACHE_KEY);
    if (cached && cached.generatedAt && !payload.force) {
      // devolve cache + requestId atual
      cached.requestId = ctx.requestId;
      return cached;
    }
  }

  var now = new Date();
  var out = {
    ok: true,
    requestId: ctx.requestId,
    generatedAt: now.toISOString(),
    env: (typeof PRONTIO_ENV !== "undefined") ? PRONTIO_ENV : null,
    apiVersion: (typeof PRONTIO_API_VERSION !== "undefined") ? PRONTIO_API_VERSION : null,
    timezone: (typeof Config_get_ === "function")
      ? Config_get_("timezone")
      : (Session.getScriptTimeZone ? Session.getScriptTimeZone() : null),

    checks: {
      clock: { ok: true, serverTime: now.toISOString() },
      db: { ok: false },
      config: { ok: true }
    },

    timings: {
      totalMs: null
    }
  };

  // DB Status (depende de Migrations)
  try {
    if (typeof Migrations_getDbStatus_ === "function") {
      var status = Migrations_getDbStatus_();
      out.checks.db = {
        ok: !!status.ok,
        latestVersion: status.latestVersion,
        currentVersion: status.currentVersion,
        needsBootstrap: status.needsBootstrap,
        needsMigration: status.needsMigration
      };

      if (!status.ok) out.ok = false;
    } else {
      out.checks.db = { ok: false, reason: "Migrations_getDbStatus_ não disponível." };
      out.ok = false;
    }
  } catch (e) {
    out.checks.db = { ok: false, error: String(e) };
    out.ok = false;
  }

  // Config check mínimo
  try {
    if (typeof Config_getAgendaParams_ === "function") {
      var ap = Config_getAgendaParams_();
      out.checks.config = {
        ok: true,
        agenda: {
          duracaoPadraoMin: ap.duracaoPadraoMin,
          slotMin: ap.slotMin,
          permiteSobreposicao: ap.permiteSobreposicao
        }
      };
    } else if (typeof Config_getAll_ === "function") {
      out.checks.config = { ok: true, hasConfig: true };
    } else {
      out.checks.config = { ok: true, hasConfig: false, note: "Config.gs não disponível (ou incompleto)." };
    }
  } catch (e2) {
    out.checks.config = { ok: false, error: String(e2) };
    out.ok = false;
  }

  out.timings.totalMs = (new Date().getTime() - started.getTime());

  // Cache curto
  try {
    if (typeof Cache_setJson_ === "function") {
      Cache_setJson_(HEALTH_CACHE_KEY, out, HEALTH_CACHE_TTL_SECONDS);
    }
  } catch (_) {}

  return out;
}

/**
 * ============================================================
 * Health.Integration (ponta-a-ponta)
 * ============================================================
 * Sugestão de registro no Registry:
 * - action: "Health.Integration"
 * - handler: Health_Integration_
 * - requiresAuth: true
 * - roles: []
 * - requiresLock: true  (cria/cancela bloqueio)
 *
 * Payload:
 * {
 *   dryRun?: boolean,   // se true, não cria/cancela bloqueio
 *   data?: "YYYY-MM-DD",// opcional (default: hoje no TZ do script)
 *   force?: boolean     // ignora cache no dryRun
 * }
 */
function Health_Integration_(ctx, payload) {
  payload = payload || {};
  var started = new Date();

  var dryRun = payload.dryRun === true;

  // Cache curto apenas para dryRun (sem escrita)
  if (dryRun && typeof Cache_getJson_ === "function" && typeof Cache_setJson_ === "function") {
    try {
      var cached = Cache_getJson_(HEALTH_INTEGRATION_CACHE_KEY);
      if (cached && cached.generatedAt && !payload.force) {
        cached.requestId = ctx.requestId;
        return cached;
      }
    } catch (_) {}
  }

  var now = new Date();
  var out = {
    ok: true,
    requestId: ctx.requestId,
    generatedAt: now.toISOString(),
    env: (typeof PRONTIO_ENV !== "undefined") ? PRONTIO_ENV : null,
    apiVersion: (typeof PRONTIO_API_VERSION !== "undefined") ? PRONTIO_API_VERSION : null,
    timezone: (Session.getScriptTimeZone ? Session.getScriptTimeZone() : null),
    dryRun: dryRun,

    checks: {
      registry: { ok: true },
      agendaConfigObter: { ok: false },
      agendaListar: { ok: false },
      agendaValidarConflito: { ok: false },
      agendaBloquear: { ok: false, skipped: dryRun },
      agendaDesbloquear: { ok: false, skipped: dryRun }
    },

    artifacts: {
      bloqueioIdAgenda: null
    },

    timings: {
      totalMs: null
    }
  };

  // Helpers
  function _ymd_(d) {
    var y = d.getFullYear();
    var m = ("0" + (d.getMonth() + 1)).slice(-2);
    var dd = ("0" + d.getDate()).slice(-2);
    return y + "-" + m + "-" + dd;
  }

  function _isYmd_(s) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(s || "").trim());
  }

  var dataStr = _isYmd_(payload.data) ? String(payload.data) : _ymd_(now);

  // Executa action pelo Registry quando possível (testa wiring real)
  function _callRegistry_(actionName, pl) {
    if (typeof Registry_getAction_ !== "function") {
      var e = new Error("Registry_getAction_ não disponível.");
      e.code = "INTERNAL_ERROR";
      throw e;
    }

    var entry = Registry_getAction_(actionName);
    if (!entry || typeof entry.handler !== "function") {
      var e2 = new Error("Action não registrada no Registry: " + actionName);
      e2.code = "NOT_FOUND";
      e2.details = { action: actionName };
      throw e2;
    }

    return entry.handler(ctx, pl || {});
  }

  // ===== 1) AgendaConfig.Obter =====
  try {
    _callRegistry_("AgendaConfig.Obter", {});
    out.checks.agendaConfigObter.ok = true;
  } catch (eCfg) {
    out.checks.agendaConfigObter.ok = false;
    out.checks.agendaConfigObter.error = String(eCfg && eCfg.message ? eCfg.message : eCfg);
    out.ok = false;
  }

  // ===== 2) Agenda.Listar (hoje) =====
  try {
    var listRes = _callRegistry_("Agenda.Listar", {
      periodo: { inicio: dataStr, fim: dataStr },
      filtros: { incluirCancelados: true }
    });

    // só valida shape mínimo
    var items = listRes && listRes.items ? listRes.items : [];
    out.checks.agendaListar.ok = true;
    out.checks.agendaListar.count = (items && items.length) ? items.length : 0;
  } catch (eList) {
    out.checks.agendaListar.ok = false;
    out.checks.agendaListar.error = String(eList && eList.message ? eList.message : eList);
    out.ok = false;
  }

  // ===== 3) Agenda.ValidarConflito (um slot "seguro") =====
  try {
    // Validar conflito com um horário padrão (10:00, 10 min) e permitirEncaixe=false
    var vRes = _callRegistry_("Agenda.ValidarConflito", {
      data: dataStr,
      hora_inicio: "10:00",
      duracao_minutos: 10,
      permitirEncaixe: false
    });

    // aceita retorno legado {ok:true} ou exceção (CONFLICT)
    if (vRes && vRes.ok === false) {
      // não falha health por conflito em si; mas marca ok e registra code
      out.checks.agendaValidarConflito.ok = true;
      out.checks.agendaValidarConflito.note = "validou com retorno ok=false (legado), code=" + String(vRes.code || "");
    } else {
      out.checks.agendaValidarConflito.ok = true;
    }
  } catch (eVal) {
    // Conflito é um resultado válido do sistema; só falha se for erro interno
    var code = eVal && eVal.code ? String(eVal.code) : "";
    if (code === "CONFLICT") {
      out.checks.agendaValidarConflito.ok = true;
      out.checks.agendaValidarConflito.note = "CONFLICT (esperado dependendo do dia).";
    } else {
      out.checks.agendaValidarConflito.ok = false;
      out.checks.agendaValidarConflito.error = String(eVal && eVal.message ? eVal.message : eVal);
      out.ok = false;
    }
  }

  // ===== 4) Bloquear / Desbloquear (com cleanup) =====
  var createdId = null;

  if (!dryRun) {
    try {
      // tenta criar um bloqueio curto em 11:50 por 5 min
      var bRes = _callRegistry_("Agenda.BloquearHorario", {
        data: dataStr,
        hora_inicio: "11:50",
        duracao_minutos: 5,
        titulo: "HEALTH_CHECK_BLOQUEIO",
        origem: "SISTEMA"
      });

      // tenta extrair idAgenda do retorno: {item:{idAgenda}} ou {item:{ID_Agenda}} ou direto
      createdId =
        (bRes && bRes.item && (bRes.item.idAgenda || bRes.item.ID_Agenda)) ? String(bRes.item.idAgenda || bRes.item.ID_Agenda) :
        (bRes && bRes.idAgenda) ? String(bRes.idAgenda) :
        null;

      out.artifacts.bloqueioIdAgenda = createdId || null;
      out.checks.agendaBloquear.ok = true;
    } catch (eB) {
      var codeB = eB && eB.code ? String(eB.code) : "";
      // Conflito também pode acontecer (já existe algo no intervalo) — não é falha do sistema.
      if (codeB === "CONFLICT") {
        out.checks.agendaBloquear.ok = true;
        out.checks.agendaBloquear.note = "CONFLICT ao bloquear (intervalo ocupado) — esperado.";
      } else {
        out.checks.agendaBloquear.ok = false;
        out.checks.agendaBloquear.error = String(eB && eB.message ? eB.message : eB);
        out.ok = false;
      }
    } finally {
      // tenta desfazer somente se criou id
      if (createdId) {
        try {
          _callRegistry_("Agenda.DesbloquearHorario", { idAgenda: createdId, motivo: "Health cleanup" });
          out.checks.agendaDesbloquear.ok = true;
        } catch (eD) {
          out.checks.agendaDesbloquear.ok = false;
          out.checks.agendaDesbloquear.error = String(eD && eD.message ? eD.message : eD);
          out.ok = false;
        }
      } else {
        // se não criou id, desbloquear não é aplicável
        out.checks.agendaDesbloquear.skipped = true;
      }
    }
  }

  out.timings.totalMs = (new Date().getTime() - started.getTime());

  // cache curto apenas no dryRun
  if (dryRun) {
    try {
      if (typeof Cache_setJson_ === "function") {
        Cache_setJson_(HEALTH_INTEGRATION_CACHE_KEY, out, HEALTH_INTEGRATION_CACHE_TTL_SECONDS);
      }
    } catch (_) {}
  }

  return out;
}

/**
 * Alias compatível (se você preferir registrar como Meta.HealthIntegration)
 */
function Meta_HealthIntegration_(ctx, payload) {
  return Health_Integration_(ctx, payload);
}
