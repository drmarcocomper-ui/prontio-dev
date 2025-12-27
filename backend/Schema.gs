/**
 * ============================================================
 * PRONTIO - Schema.gs (FASE 2)
 * ============================================================
 * Schema oficial das entidades (contrato interno backend).
 * - Serve para consistência e base de validação.
 * - O front NÃO conhece abas/colunas; isso é só para o backend.
 *
 * Este Schema é sobre o "modelo de dados" (DTO).
 * O mapeamento para planilha ficará no Repository/Migrations (Fase 4).
 */

function Schema_get_(entityName) {
  var schemas = Schema_all_();
  return schemas[entityName] || null;
}

function Schema_all_() {
  return {
    // =========================
    // NOVOS (estratégia oficial)
    // =========================

    Clinica: {
      entity: "Clinica",
      idField: "idClinica",
      softDelete: { field: "ativo", inactiveValue: false },
      fields: {
        idClinica: { type: "string", required: true },
        nome: { type: "string", required: true, maxLength: 200 },
        endereco: { type: "string", required: false, maxLength: 500 },
        telefone: { type: "string", required: false, maxLength: 50 },
        email: { type: "string", required: false, maxLength: 120 },
        logoUrl: { type: "string", required: false, maxLength: 500 },
        timezone: { type: "string", required: false, maxLength: 60 },
        templatesDocumentos: { type: "object", required: false },
        parametrosGlobais: { type: "object", required: false },
        criadoEm: { type: "date", required: true },
        atualizadoEm: { type: "date", required: true },
        ativo: { type: "boolean", required: true }
      }
    },

    Profissional: {
      entity: "Profissional",
      idField: "idProfissional",
      softDelete: { field: "ativo", inactiveValue: false },
      fields: {
        idProfissional: { type: "string", required: true },
        idClinica: { type: "string", required: true },
        tipoProfissional: { type: "string", required: true, enum: ["MEDICO", "NUTRICIONISTA", "OUTRO"] },
        nomeCompleto: { type: "string", required: true, maxLength: 200 },
        documentoRegistro: { type: "string", required: false, maxLength: 40 },
        especialidade: { type: "string", required: false, maxLength: 120 },
        assinaturaDigitalBase64: { type: "string", required: false, maxLength: 100000 },
        corInterface: { type: "string", required: false, maxLength: 30 },
        ativo: { type: "boolean", required: true },
        criadoEm: { type: "date", required: true },
        atualizadoEm: { type: "date", required: true }
      }
    },

    Usuario: {
      entity: "Usuario",
      idField: "idUsuario",
      softDelete: { field: "ativo", inactiveValue: false },
      fields: {
        idUsuario: { type: "string", required: true },
        idClinica: { type: "string", required: true },
        nomeCompleto: { type: "string", required: true, maxLength: 200 },
        login: { type: "string", required: true, maxLength: 120 },
        email: { type: "string", required: false, maxLength: 120 },
        perfil: { type: "string", required: true, enum: ["admin", "profissional", "secretaria"] },
        idProfissional: { type: "string", required: false },
        permissoesCustomizadas: { type: "object", required: false },
        ativo: { type: "boolean", required: true },
        ultimoLoginEm: { type: "date", required: false },
        criadoEm: { type: "date", required: true },
        atualizadoEm: { type: "date", required: true }
      }
    },

    AgendaDisponibilidade: {
      entity: "AgendaDisponibilidade",
      idField: "idDisponibilidade",
      softDelete: { field: "ativo", inactiveValue: false },
      fields: {
        idDisponibilidade: { type: "string", required: true },
        idClinica: { type: "string", required: true },
        idProfissional: { type: "string", required: true },
        diaSemana: { type: "string", required: true, enum: ["SEG", "TER", "QUA", "QUI", "SEX", "SAB", "DOM"] },
        horaInicio: { type: "string", required: true, maxLength: 5 },
        horaFim: { type: "string", required: true, maxLength: 5 },
        intervaloMinutos: { type: "string", required: true },
        localSala: { type: "string", required: false, maxLength: 120 },
        ativo: { type: "boolean", required: true },
        criadoEm: { type: "date", required: true },
        atualizadoEm: { type: "date", required: true }
      }
    },

    AgendaExcecao: {
      entity: "AgendaExcecao",
      idField: "idExcecao",
      softDelete: { field: "ativo", inactiveValue: false },
      fields: {
        idExcecao: { type: "string", required: true },
        idClinica: { type: "string", required: true },
        idProfissional: { type: "string", required: true },
        dataInicio: { type: "date", required: true },
        dataFim: { type: "date", required: true },
        tipo: { type: "string", required: true, enum: ["BLOQUEIO_TOTAL", "HORARIO_ESPECIAL"] },
        blocosEspeciais: { type: "object", required: false },
        motivo: { type: "string", required: false, maxLength: 500 },
        criadoEm: { type: "date", required: true },
        atualizadoEm: { type: "date", required: true },
        ativo: { type: "boolean", required: true }
      }
    },

    AgendaEvento: {
      entity: "AgendaEvento",
      idField: "idEvento",
      softDelete: { field: "ativo", inactiveValue: false },
      fields: {
        idEvento: { type: "string", required: true },
        idClinica: { type: "string", required: true },
        idProfissional: { type: "string", required: true },
        idPaciente: { type: "string", required: false },
        inicioDateTime: { type: "date", required: true },
        fimDateTime: { type: "date", required: true },
        tipo: { type: "string", required: true, enum: ["CONSULTA", "RETORNO", "PROCEDIMENTO", "BLOQUEIO"] },
        status: { type: "string", required: true, enum: ["MARCADO", "CONFIRMADO", "ATENDIDO", "CANCELADO", "FALTOU"] },
        titulo: { type: "string", required: false, maxLength: 200 },
        notas: { type: "string", required: false, maxLength: 2000 },
        permiteEncaixe: { type: "boolean", required: false },
        canceladoEm: { type: "date", required: false },
        canceladoMotivo: { type: "string", required: false, maxLength: 500 },
        criadoEm: { type: "date", required: true },
        atualizadoEm: { type: "date", required: true },
        ativo: { type: "boolean", required: true }
      }
    },

    AcessoAgenda: {
      entity: "AcessoAgenda",
      idField: "idAcesso",
      softDelete: { field: "ativo", inactiveValue: false },
      fields: {
        idAcesso: { type: "string", required: true },
        idClinica: { type: "string", required: true },
        idUsuario: { type: "string", required: true },
        idProfissional: { type: "string", required: true },
        permissoes: { type: "object", required: true }, // {ver:true, criar:true...} ou lista
        ativo: { type: "boolean", required: true },
        criadoEm: { type: "date", required: true },
        atualizadoEm: { type: "date", required: true }
      }
    },

    // =========================
    // LEGADO (mantido)
    // =========================

    Paciente: {
      entity: "Paciente",
      idField: "idPaciente",
      softDelete: { field: "ativo", inactiveValue: false },
      fields: {
        idPaciente: { type: "string", required: true, description: "ID estável gerado no backend." },
        ativo: { type: "boolean", required: true },

        nome: { type: "string", required: true, maxLength: 120 },
        nascimento: { type: "date", required: false },
        sexo: { type: "string", required: false, enum: ["M", "F", "O", "NI"] },

        cpf: { type: "string", required: false, maxLength: 14 },
        telefone: { type: "string", required: false, maxLength: 30 },
        email: { type: "string", required: false, maxLength: 120 },

        endereco: { type: "object", required: false },
        observacoes: { type: "string", required: false, maxLength: 2000 },

        criadoEm: { type: "date", required: true },
        atualizadoEm: { type: "date", required: true }
      }
    },

    // Mantida como "Agenda" legado (se ainda existir uso no sistema)
    Agenda: {
      entity: "Agenda",
      idField: "idAgenda",
      softDelete: { field: "status", inactiveValue: "CANCELADO" },
      fields: {
        idAgenda: { type: "string", required: true },
        idPaciente: { type: "string", required: false },
        inicio: { type: "date", required: true },
        fim: { type: "date", required: true },
        titulo: { type: "string", required: false, maxLength: 120 },
        notas: { type: "string", required: false, maxLength: 2000 },
        tipo: { type: "string", required: false, enum: ["CONSULTA", "RETORNO", "PROCEDIMENTO", "BLOQUEIO", "OUTRO"] },

        /**
         * ✅ Atualizado:
         * Agora aceita status oficiais adicionais para o módulo Agenda:
         * - CONFIRMADO
         * - EM_ATENDIMENTO
         */
        status: {
          type: "string",
          required: true,
          enum: ["AGENDADO", "CONFIRMADO", "EM_ATENDIMENTO", "CANCELADO", "CONCLUIDO", "FALTOU"]
        },

        origem: { type: "string", required: false, enum: ["RECEPCAO", "MEDICO", "SISTEMA"] },
        criadoEm: { type: "date", required: true },
        atualizadoEm: { type: "date", required: true },
        canceladoEm: { type: "date", required: false },
        canceladoMotivo: { type: "string", required: false, maxLength: 500 }
      }
    },

    Evolucao: {
      entity: "Evolucao",
      idField: "idEvolucao",
      softDelete: { field: "ativo", inactiveValue: false },
      fields: {
        idEvolucao: { type: "string", required: true },
        idPaciente: { type: "string", required: true },
        data: { type: "date", required: true },
        texto: { type: "string", required: true, maxLength: 20000 },
        criadoEm: { type: "date", required: true },
        atualizadoEm: { type: "date", required: true },
        ativo: { type: "boolean", required: true }
      }
    }
  };
}

/**
 * Gera uma lista de validações (Validators spec) a partir do schema.
 * Útil para ações Create/Update.
 *
 * mode:
 * - "create": aplica required=true
 * - "update": não aplica required (exceto id, se indicado externamente)
 */
function Schema_buildValidations_(entityName, mode) {
  var s = Schema_get_(entityName);
  if (!s) return [];

  mode = mode || "create";
  var fields = s.fields || {};
  var validations = [];

  for (var f in fields) {
    if (!fields.hasOwnProperty(f)) continue;
    var def = fields[f];

    if (mode === "create" && def.required) {
      validations.push({ field: f, rule: "required" });
    }

    if (def.type) {
      if (def.type === "date") validations.push({ field: f, rule: "date" });
      else if (def.type === "object") validations.push({ field: f, rule: "object" });
      else if (def.type === "array") validations.push({ field: f, rule: "array" });
      else validations.push({ field: f, rule: "type", value: def.type });
    }

    if (def.maxLength) validations.push({ field: f, rule: "maxLength", value: def.maxLength });
    if (def.enum) validations.push({ field: f, rule: "enum", values: def.enum });
  }

  return validations;
}
