// assets/js/core/helpers.js
// Funções auxiliares genéricas para o front-end do PRONTIO.
//
// Regras importantes:
// - Não colocar regras de negócio aqui (ex.: lógica de agenda, prontuário, etc.).
// - Apenas utilidades de interface, formatação e manipulação de formulários.
// - Tudo fica no namespace PRONTIO.core.helpers.
//
// ✅ PASSO 3 (Consolidação de estado):
// - Helpers de contexto delegam para PRONTIO.core.state (quando existir),
//   evitando uso de localStorage solto por módulos.
// - Helpers de data/hora local (YYYY-MM-DD / HH:MM) para alinhar com contrato da Agenda.

(function (global) {
  "use strict";

  const PRONTIO = global.PRONTIO = global.PRONTIO || {};
  PRONTIO.core = PRONTIO.core || {};

  function getState_() {
    return PRONTIO.core && PRONTIO.core.state ? PRONTIO.core.state : null;
  }

  const Helpers = {
    /**
     * Função vazia (útil como callback padrão).
     */
    noop() {},

    /**
     * Retorna uma Promise que resolve após X ms.
     * @param {number} ms
     * @returns {Promise<void>}
     */
    delay(ms) {
      return new Promise(resolve => setTimeout(resolve, ms || 0));
    },

    /**
     * Verifica se um valor é "vazio" para fins de UI.
     * @param {*} value
     * @returns {boolean}
     */
    isEmpty(value) {
      if (value === null || value === undefined) return true;
      if (typeof value === "string" && value.trim() === "") return true;
      if (Array.isArray(value) && value.length === 0) return true;
      if (typeof value === "object" && Object.keys(value).length === 0) return true;
      return false;
    },

    /**
     * Remove acentos e coloca em minúsculas para comparações.
     * @param {string} str
     * @returns {string}
     */
    normalizeString(str) {
      if (!str) return "";
      return String(str)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
    },

    // ==========================
    // DATAS (LOCAL - contrato Agenda)
    // ==========================

    /**
     * Valida "YYYY-MM-DD" (sem regra de calendário).
     */
    isYmd(dateStr) {
      return /^\d{4}-\d{2}-\d{2}$/.test(String(dateStr || "").trim());
    },

    /**
     * Valida "HH:MM".
     */
    isHHMM(hhmm) {
      return /^\d{2}:\d{2}$/.test(String(hhmm || "").trim());
    },

    /**
     * Converte data ISO (YYYY-MM-DD) para BR (DD/MM/AAAA).
     * @param {string} isoDate
     * @returns {string}
     */
    formatDateISOToBR(isoDate) {
      if (!isoDate || typeof isoDate !== "string") return "";
      const parts = isoDate.split("-");
      if (parts.length !== 3) return isoDate;
      const [y, m, d] = parts;
      if (!y || !m || !d) return isoDate;
      return `${("0" + d).slice(-2)}/${("0" + m).slice(-2)}/${y}`;
    },

    /**
     * Converte data BR (DD/MM/AAAA) para ISO (YYYY-MM-DD).
     * (sem validação de calendário, regra de negócio fica no backend)
     * @param {string} brDate
     * @returns {string}
     */
    formatDateBRToISO(brDate) {
      if (!brDate || typeof brDate !== "string") return "";
      const clean = brDate.replace(/\s/g, "");
      const parts = clean.split("/");
      if (parts.length !== 3) return brDate;
      const [d, m, y] = parts;
      if (!y || !m || !d) return brDate;
      return `${y.padStart(4, "0")}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    },

    /**
     * Formata data/hora (Objeto Date) para "DD/MM/AAAA HH:MM".
     * @param {Date|string|number} dateLike
     * @returns {string}
     */
    formatDateTime(dateLike) {
      if (!dateLike) return "";
      const d = dateLike instanceof Date ? dateLike : new Date(dateLike);
      if (Number.isNaN(d.getTime())) return "";

      const dd = ("0" + d.getDate()).slice(-2);
      const mm = ("0" + (d.getMonth() + 1)).slice(-2);
      const yyyy = d.getFullYear();
      const hh = ("0" + d.getHours()).slice(-2);
      const mi = ("0" + d.getMinutes()).slice(-2);

      return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
    },

    // ==========================
    // FORMATAÇÃO DE CAMPOS (UI)
    // ==========================

    formatCPF(value) {
      if (!value) return "";
      const digits = String(value).replace(/\D/g, "").slice(0, 11);
      if (digits.length <= 3) return digits;
      if (digits.length <= 6) {
        return `${digits.slice(0, 3)}.${digits.slice(3)}`;
      }
      if (digits.length <= 9) {
        return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
      }
      return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
    },

    formatPhoneBR(value) {
      if (!value) return "";
      const digits = String(value).replace(/\D/g, "").slice(0, 11);

      if (digits.length <= 2) {
        return digits;
      }
      if (digits.length <= 6) {
        return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
      }
      if (digits.length === 10) {
        return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
      }
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    },

    onlyDigits(value) {
      if (!value) return "";
      return String(value).replace(/\D/g, "");
    },

    // ==========================
    // CONTEXTO (PASSO 3) - delega para PRONTIO.core.state
    // ==========================

    getPacienteAtual() {
      const s = getState_();
      if (s && typeof s.getPacienteAtual === "function") return s.getPacienteAtual();
      return null;
    },

    setPacienteAtual(paciente) {
      const s = getState_();
      if (s && typeof s.setPacienteAtual === "function") return s.setPacienteAtual(paciente);
      return null;
    },

    clearPacienteAtual() {
      const s = getState_();
      if (s && typeof s.clearPacienteAtual === "function") return s.clearPacienteAtual();
      return null;
    },

    getAgendaAtualId() {
      const s = getState_();
      if (s && typeof s.getAgendaAtual === "function") return s.getAgendaAtual();
      return null;
    },

    setAgendaAtualId(idAgenda) {
      const s = getState_();
      if (s && typeof s.setAgendaAtual === "function") return s.setAgendaAtual(idAgenda);
      return null;
    },

    clearAgendaAtualId() {
      const s = getState_();
      if (s && typeof s.clearAgendaAtual === "function") return s.clearAgendaAtual();
      return null;
    },

    // ==========================
    // FORMULÁRIOS
    // ==========================

    serializeForm(formEl) {
      if (!formEl) {
        console.warn("[Helpers] serializeForm recebeu formEl nulo");
        return {};
      }
      const formData = new FormData(formEl);
      const obj = {};

      formData.forEach((value, key) => {
        if (typeof value === "string") {
          value = value.trim();
        }

        if (key.endsWith("[]")) {
          const realKey = key.slice(0, -2);
          if (!Array.isArray(obj[realKey])) {
            obj[realKey] = [];
          }
          obj[realKey].push(value);
          return;
        }

        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          if (!Array.isArray(obj[key])) {
            obj[key] = [obj[key]];
          }
          obj[key].push(value);
        } else {
          obj[key] = value;
        }
      });

      return obj;
    },

    fillForm(formEl, data) {
      if (!formEl || !data) return;

      const elements = formEl.elements;
      for (let i = 0; i < elements.length; i++) {
        const field = elements[i];
        const name = field.name;
        if (!name) continue;

        let value;

        if (name.endsWith("[]")) {
          const base = name.slice(0, -2);
          value = data[base];
        } else {
          value = data[name];
        }

        if (value === undefined) continue;

        if (field.type === "checkbox") {
          if (Array.isArray(value)) {
            field.checked = value.includes(field.value);
          } else {
            field.checked = Boolean(value);
          }
        } else if (field.type === "radio") {
          field.checked = (field.value === String(value));
        } else if (field.tagName === "SELECT" && field.multiple && Array.isArray(value)) {
          Array.from(field.options).forEach(opt => {
            opt.selected = value.includes(opt.value);
          });
        } else {
          field.value = value;
        }
      }
    },

    resetForm(formEl) {
      if (!formEl) return;
      formEl.reset();
    },

    // ==========================
    // DOM / CSS SIMPLES
    // ==========================

    toggleClass(elOrList, className, enabled) {
      if (!elOrList) return;

      const list = (NodeList.prototype.isPrototypeOf(elOrList) || Array.isArray(elOrList))
        ? elOrList
        : [elOrList];

      list.forEach(el => {
        if (!el || !el.classList) return;
        if (enabled) {
          el.classList.add(className);
        } else {
          el.classList.remove(className);
        }
      });
    },

    setButtonLoading(buttonEl, isLoading) {
      if (!buttonEl) return;

      if (isLoading) {
        buttonEl.dataset.originalText = buttonEl.textContent;
        buttonEl.textContent = "Aguarde...";
        buttonEl.disabled = true;
        buttonEl.classList.add("is-loading");
      } else {
        if (buttonEl.dataset.originalText) {
          buttonEl.textContent = buttonEl.dataset.originalText;
          delete buttonEl.dataset.originalText;
        }
        buttonEl.disabled = false;
        buttonEl.classList.remove("is-loading");
      }
    }
  };

  PRONTIO.core.helpers = Helpers;

})(window);
