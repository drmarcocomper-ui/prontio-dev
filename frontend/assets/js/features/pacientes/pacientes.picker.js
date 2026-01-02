// frontend/assets/js/features/pacientes/pacientes.picker.js
/**
 * PRONTIO — Pacientes Picker (reutilizável)
 * ------------------------------------------------------------
 * Módulo de UI + comportamento para "selecionar paciente" via modal.
 *
 * Objetivo (replicável):
 * - Qualquer feature pode reutilizar este picker (Agenda/Atendimento/Receita/etc.)
 * - Não conhece o domínio da tela chamadora.
 * - Não chama API diretamente: recebe searchFn injetada.
 *
 * Regras:
 * - Não depende de planilha/estrutura interna.
 * - Não depende de AgendaController.
 * - Usa view.openModal/view.closeModal quando fornecidos (senão fallback simples).
 */

(function (global) {
  "use strict";

  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO.features = PRONTIO.features || {};
  PRONTIO.features.pacientes = PRONTIO.features.pacientes || {};

  function createPacientesPicker(opts) {
    const document = (opts && opts.document) ? opts.document : global.document;

    const modalEl = opts && opts.modalEl;
    const inputTermoEl = opts && opts.inputTermoEl;
    const listEl = opts && opts.listEl;
    const msgEl = opts && opts.msgEl;
    const closeBtnEl = opts && opts.closeBtnEl;

    const view = opts && opts.view ? opts.view : null;

    const searchFn = (opts && typeof opts.searchFn === "function") ? opts.searchFn : async () => [];
    const onSelect = (opts && typeof opts.onSelect === "function") ? opts.onSelect : function () {};

    let ctx = { source: "unknown" };
    let debounceTimer = null;

    function _setMsg(text, kind) {
      if (!msgEl) return;
      msgEl.textContent = text || "";
      msgEl.className = "form-message" + (kind ? " " + kind : "");
    }

    function _clearList() {
      if (listEl) listEl.innerHTML = "";
    }

    function _open() {
      if (inputTermoEl) inputTermoEl.value = "";
      _clearList();
      _setMsg("Digite para buscar pacientes.", "info");

      if (view && typeof view.openModal === "function") {
        view.openModal(modalEl, inputTermoEl);
      } else if (modalEl) {
        modalEl.classList.remove("hidden");
        modalEl.classList.add("visible");
        modalEl.setAttribute("aria-hidden", "false");
        setTimeout(() => inputTermoEl && inputTermoEl.focus && inputTermoEl.focus(), 0);
      }
    }

    function _close() {
      if (view && typeof view.closeModal === "function") {
        view.closeModal(modalEl);
      } else if (modalEl) {
        modalEl.classList.remove("visible");
        modalEl.classList.add("hidden");
        modalEl.setAttribute("aria-hidden", "true");
      }

      if (inputTermoEl) inputTermoEl.value = "";
      _clearList();
      _setMsg("", "");
    }

    function open(context) {
      ctx = context && typeof context === "object" ? context : { source: String(context || "unknown") };
      _open();
    }

    function close() {
      _close();
    }

    function isOpen() {
      if (view && typeof view.isModalVisible === "function") return view.isModalVisible(modalEl);
      return !!modalEl && !modalEl.classList.contains("hidden");
    }

    function _renderList(pacientes) {
      if (!listEl) return;
      listEl.innerHTML = "";

      pacientes.forEach((p) => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "paciente-lista-item";

        const linha1 = document.createElement("div");
        linha1.className = "paciente-lista-nome";
        linha1.textContent = p.nome || "(sem nome)";

        const linha2 = document.createElement("div");
        linha2.className = "paciente-lista-detalhes";
        const parts = [];
        if (p.documento) parts.push(p.documento);
        if (p.telefone) parts.push(p.telefone);
        if (p.data_nascimento) parts.push("Nasc.: " + p.data_nascimento);
        linha2.textContent = parts.join(" • ");

        item.appendChild(linha1);
        if (linha2.textContent) item.appendChild(linha2);

        item.addEventListener("click", () => {
          try {
            onSelect(p, ctx);
          } finally {
            _close();
          }
        });

        listEl.appendChild(item);
      });
    }

    async function _doSearch(term) {
      const t = String(term || "").trim();
      if (t.length < 2) {
        _setMsg("Digite pelo menos 2 caracteres para buscar.", "info");
        _clearList();
        return;
      }

      _setMsg("Buscando pacientes...", "info");
      _clearList();

      try {
        const result = await searchFn(t, 30, ctx);
        const arr = Array.isArray(result) ? result : [];
        if (!arr.length) {
          _setMsg("Nenhum paciente encontrado.", "info");
          _clearList();
          return;
        }

        _setMsg("", "");
        _renderList(arr);
      } catch (err) {
        console.error("[PacientesPicker] erro ao buscar:", err);
        _setMsg("Erro ao buscar pacientes: " + (err && err.message ? err.message : String(err)), "erro");
        _clearList();
      }
    }

    function bind() {
      if (!modalEl) return;

      // Fechar botão
      closeBtnEl && closeBtnEl.addEventListener("click", () => close());

      // Clique fora fecha
      modalEl.addEventListener("click", (e) => {
        if (e.target === modalEl) close();
      });

      // Input debounce
      if (inputTermoEl) {
        inputTermoEl.addEventListener("input", () => {
          const termo = inputTermoEl.value;
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => _doSearch(termo), 300);
        });
      }
    }

    return {
      bind,
      open,
      close,
      isOpen
    };
  }

  PRONTIO.features.pacientes.picker = { createPacientesPicker };
})(window);
