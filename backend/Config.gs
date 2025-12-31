/**
 * ============================================================
 * PRONTIO - Config.gs (FASE 3)
 * ============================================================
 * Centraliza configurações do sistema.
 *
 * Armazenamento:
 * - PropertiesService (Script Properties)
 *
 * Objetivos:
 * - evitar "magic numbers" espalhados (ex.: duração padrão de consulta)
 * - preparar para evoluir (aba Config via Migrations, se quiser) sem quebrar o front
 *
 * Ajustes mínimos aplicados (fase 4 módulos):
 * - Suporte a "single clinic mode" com idClinica_default estável.
 * - Helpers para obter/garantir esse idClinica sem front conhecer nada.
 *
 * ✅ PASSO 1 (Agenda):
 * - Config_getAgendaParams_ agora delega para AgendaConfig_getAgendaParams_ quando disponível
 *   (fonte da verdade), mantendo fallback retrocompatível via PropertiesService.
 */

var CONFIG_PREFIX = "PRONTIO_CFG_";

/**
 * Defaults do sistema (podem ser sobrescritos via PropertiesService)
 */
function Config_defaults_() {
  return {
    // Identidade do consultório/médico (p/ PDFs e cabeçalhos no futuro)
    medico_nome: "Dr. Marco Antônio Comper",
    medico_crm: "",
    medico_uf: "",
    clinica_nome: "PRONTIO",
    clinica_endereco: "",
    clinica_telefone: "",
    clinica_email: "",

    /**
     * ✅ Single clinic mode:
     * - idClinica_default é o ID estável da clínica usada como escopo padrão.
     * - Se vazio, Config_ensureDefaultClinicId_() cria automaticamente.
     */
    idClinica_default: "",

    // Agenda (parâmetros de negócio) - fallback/compat
    agenda_duracao_padrao_min: 30,
    agenda_inicio_dia_hhmm: "08:00",
    agenda_fim_dia_hhmm: "18:00",
    agenda_slot_min: 10, // granularidade mínima recomendada
    agenda_permite_sobreposicao: false,

    // Sistema
    timezone: Session.getScriptTimeZone ? Session.getScriptTimeZone() : "America/Sao_Paulo",
    env: (typeof PRONTIO_ENV !== "undefined") ? PRONTIO_ENV : "DEV"
  };
}

/**
 * Lê um valor de config (string/number/bool/object)
 */
function Config_get_(key) {
  key = String(key || "").trim();
  if (!key) throw new Error("Config_get_: key obrigatória.");

  var props = PropertiesService.getScriptProperties();
  var fullKey = CONFIG_PREFIX + key;

  var raw = props.getProperty(fullKey);
  if (raw === null || raw === undefined) {
    var def = Config_defaults_();
    return (def.hasOwnProperty(key) ? def[key] : null);
  }

  return _configParse_(raw);
}

/**
 * Define um valor de config
 * - aceita primitives e objetos
 */
function Config_set_(key, value) {
  key = String(key || "").trim();
  if (!key) throw new Error("Config_set_: key obrigatória.");

  var props = PropertiesService.getScriptProperties();
  var fullKey = CONFIG_PREFIX + key;

  var raw = _configStringify_(value);
  props.setProperty(fullKey, raw);

  return { ok: true, key: key, value: value };
}

/**
 * Remove config (volta ao default)
 */
function Config_unset_(key) {
  key = String(key || "").trim();
  if (!key) throw new Error("Config_unset_: key obrigatória.");

  PropertiesService.getScriptProperties().deleteProperty(CONFIG_PREFIX + key);
  return { ok: true, key: key };
}

/**
 * Retorna todas configs (defaults + overrides)
 * Observação: útil para debug/admin (não expor ao front sem Auth/roles).
 */
function Config_getAll_() {
  var def = Config_defaults_();
  var props = PropertiesService.getScriptProperties().getProperties();

  // Aplica overrides
  for (var k in props) {
    if (!props.hasOwnProperty(k)) continue;
    if (k.indexOf(CONFIG_PREFIX) !== 0) continue;

    var shortKey = k.substring(CONFIG_PREFIX.length);
    def[shortKey] = _configParse_(props[k]);
  }

  return def;
}

/**
 * Helper: retorna um "perfil médico" estruturado (futuro PDF/header)
 */
function Config_getDoctorProfile_() {
  return {
    nome: Config_get_("medico_nome"),
    crm: Config_get_("medico_crm"),
    uf: Config_get_("medico_uf"),
    clinicaNome: Config_get_("clinica_nome"),
    clinicaEndereco: Config_get_("clinica_endereco"),
    clinicaTelefone: Config_get_("clinica_telefone"),
    clinicaEmail: Config_get_("clinica_email")
  };
}

/**
 * Helper: retorna parâmetros da Agenda
 *
 * ✅ PASSO 1:
 * - Fonte da verdade: AgendaConfig_getAgendaParams_() (planilha AgendaConfig).
 * - Fallback: PropertiesService/Defaults (retrocompat).
 *
 * Shape retornado (compat com Agenda.gs):
 * {
 *   duracaoPadraoMin: number,
 *   slotMin: number,
 *   permiteSobreposicao: boolean
 * }
 *
 * Observação:
 * - inicioDiaHHMM/fimDiaHHMM continuam disponíveis via AgendaConfig_Obter (front) e/or Config_get_ legacy.
 * - Para regras de conflito e criação, Agenda.gs usa duracaoPadraoMin/slotMin/permiteSobreposicao.
 */
function Config_getAgendaParams_() {
  // 1) Fonte da verdade (novo)
  try {
    if (typeof AgendaConfig_getAgendaParams_ === "function") {
      var p = AgendaConfig_getAgendaParams_();
      if (p && typeof p === "object") {
        return {
          duracaoPadraoMin: (typeof p.duracaoPadraoMin === "number" && isFinite(p.duracaoPadraoMin) && p.duracaoPadraoMin > 0) ? p.duracaoPadraoMin : 30,
          slotMin: (typeof p.slotMin === "number" && isFinite(p.slotMin) && p.slotMin > 0) ? p.slotMin : 10,
          permiteSobreposicao: p.permiteSobreposicao === true
        };
      }
    }
  } catch (_) {}

  // 2) Fallback retrocompat (Properties/Defaults)
  return {
    duracaoPadraoMin: Number(Config_get_("agenda_duracao_padrao_min")),
    // Mantemos as chaves abaixo para compat (caso algum módulo antigo use)
    inicioDiaHHMM: String(Config_get_("agenda_inicio_dia_hhmm")),
    fimDiaHHMM: String(Config_get_("agenda_fim_dia_hhmm")),
    slotMin: Number(Config_get_("agenda_slot_min")),
    permiteSobreposicao: Boolean(Config_get_("agenda_permite_sobreposicao"))
  };
}

/**
 * ============================================================
 * Single Clinic Mode helpers
 * ============================================================
 */

/**
 * Retorna o idClinica padrão.
 * - Se não existir, cria e persiste automaticamente.
 */
function Config_getClinicId_() {
  var id = String(Config_get_("idClinica_default") || "").trim();
  if (id) return id;
  return Config_ensureDefaultClinicId_();
}

/**
 * Garante que exista idClinica_default persistido.
 * Usa Ids_nextId_("CLINICA") se Ids.gs estiver disponível;
 * senão usa UUID com prefixo.
 */
function Config_ensureDefaultClinicId_() {
  var cur = String(Config_get_("idClinica_default") || "").trim();
  if (cur) return cur;

  var newId;
  if (typeof Ids_nextId_ === "function") {
    // mantém padrão: ID_CLINICA_000001
    newId = Ids_nextId_("CLINICA");
  } else {
    newId = "ID_CLINICA_" + Utilities.getUuid().split("-")[0].toUpperCase();
  }

  Config_set_("idClinica_default", newId);
  return newId;
}

// ======================
// Internals
// ======================

function _configStringify_(value) {
  // Guardamos tudo como JSON quando não for string simples
  if (value === null || value === undefined) return JSON.stringify(null);

  var t = typeof value;
  if (t === "string") return JSON.stringify({ __t: "string", v: value });
  if (t === "number") return JSON.stringify({ __t: "number", v: value });
  if (t === "boolean") return JSON.stringify({ __t: "boolean", v: value });

  // object/array
  return JSON.stringify({ __t: "json", v: value });
}

function _configParse_(raw) {
  // Compat: se alguém tiver salvo raw antigo como string pura
  try {
    var o = JSON.parse(raw);
    if (o && typeof o === "object" && o.__t) {
      return o.v;
    }
    // se for JSON direto (sem envelope)
    return o;
  } catch (_) {
    // raw literal
    return raw;
  }
}
