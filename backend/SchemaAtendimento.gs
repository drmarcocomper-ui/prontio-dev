/**
 * ============================================================
 * PRONTIO - SchemaAtendimento.gs
 * ============================================================
 * Adiciona schema da entidade Atendimento sem editar Schema.gs.
 * Patch em Schema_all_ retornando schema original + Atendimento.
 *
 * Fonte de verdade do MODELO DE DADOS do Atendimento.
 * Estados clínicos padronizados e coerentes com o backend.
 * ============================================================
 */

(function () {
  if (typeof Schema_all_ !== "function") return;
  if (Schema_all_._atdPatched) return;

  var _orig = Schema_all_;

  Schema_all_ = function () {
    var all = _orig() || {};

    if (!all.Atendimento) {
      all.Atendimento = {
        entity: "Atendimento",
        idField: "idAtendimento",

        // Exclusão lógica (não apaga histórico clínico)
        softDelete: {
          field: "ativo",
          inactiveValue: false
        },

        fields: {
          /* ============================
             Identificação
             ============================ */
          idAtendimento: { type: "string", required: true },
          idAgenda: { type: "string", required: true },
          idPaciente: { type: "string", required: false },

          /* ============================
             Referência temporal
             ============================ */
          dataRef: { type: "string", required: true, maxLength: 10 }, // YYYY-MM-DD
          ordem: { type: "string", required: false },

          /* ============================
             STATUS CLÍNICO (ENUM CANÔNICO)
             ============================
             Fluxo:
             MARCADO → CONFIRMADO → AGUARDANDO → EM_ATENDIMENTO → ATENDIDO
                                  ↘ FALTOU
             Qualquer estado → CANCELADO / REMARCADO
          */
          status: {
            type: "string",
            required: true,
            enum: [
              "MARCADO",
              "CONFIRMADO",
              "AGUARDANDO",
              "EM_ATENDIMENTO",
              "ATENDIDO",
              "FALTOU",
              "CANCELADO",
              "REMARCADO"
            ]
          },

          /* ============================
             Marcos temporais do atendimento
             (preenchidos conforme status)
             ============================ */
          confirmadoEm: { type: "date", required: false },          // CONFIRMADO
          chegadaEm: { type: "date", required: false },             // AGUARDANDO
          inicioAtendimentoEm: { type: "date", required: false },   // EM_ATENDIMENTO
          atendidoEm: { type: "date", required: false },            // ATENDIDO
          faltouEm: { type: "date", required: false },              // FALTOU
          canceladoEm: { type: "date", required: false },           // CANCELADO
          remarcadoEm: { type: "date", required: false },           // REMARCADO

          /* ============================
             Dados complementares
             ============================ */
          sala: { type: "string", required: false, maxLength: 60 },
          observacoes: { type: "string", required: false, maxLength: 2000 },

          /* ============================
             Auditoria básica
             ============================ */
          criadoEm: { type: "date", required: true },
          atualizadoEm: { type: "date", required: true },
          ativo: { type: "boolean", required: true }
        }
      };
    }

    return all;
  };

  // Flag de patch aplicado
  Schema_all_._atdPatched = true;
})();
