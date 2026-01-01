/**
 * PRONTIO - Agenda Patients Typeahead
 * - Seleção obrigatória: retorna objeto {ID_Paciente, nome, telefone, documento, data_nascimento}
 */
(function (global) {
  "use strict";

  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO.agenda = PRONTIO.agenda || {};

  const callApiData =
    (PRONTIO.api && PRONTIO.api.callApiData) ||
    global.callApiData;

  function normalizePatient_(p) {
    return {
      ID_Paciente: String(p.ID_Paciente || p.idPaciente || p.id || ""),
      nome: String(p.nome || p.nomeCompleto || p.nomeExibicao || ""),
      telefone: String(p.telefone || p.telefonePrincipal || ""),
      documento: String(p.documento || p.cpf || ""),
      data_nascimento: String(p.data_nascimento || p.dataNascimento || "")
    };
  }

  async function apiBuscar_(termo, limite) {
    const t = String(termo || "").trim();
    if (t.length < 2) return [];
    const data = await callApiData({
      action: "Pacientes_BuscarSimples",
      payload: { termo: t, limite: limite || 12 }
    });
    const arr = (data && data.pacientes) ? data.pacientes : [];
    return arr.map(normalizePatient_).filter((x) => x && x.ID_Paciente && x.nome);
  }

  function attach(inputEl, opts) {
    opts = opts || {};
    if (!inputEl) return;

    const onSelected = typeof opts.onSelected === "function" ? opts.onSelected : function () {};
    const onTyping = typeof opts.onTyping === "function" ? opts.onTyping : function () {};
    const limit = opts.limit || 12;

    const panel = document.createElement("div");
    panel.className = "typeahead-panel hidden";
    panel.setAttribute("role", "listbox");

    const parent = inputEl.parentElement || inputEl.parentNode;
    if (parent && parent.appendChild) {
      if (parent.style) parent.style.position = parent.style.position || "relative";
      parent.appendChild(panel);
    }

    let items = [];
    let activeIndex = -1;
    let debounceTimer = null;
    let lastQuery = "";

    function hide() {
      panel.classList.add("hidden");
      panel.innerHTML = "";
      items = [];
      activeIndex = -1;
    }

    function show() {
      panel.classList.remove("hidden");
    }

    function render() {
      panel.innerHTML = "";
      if (!items.length) return hide();

      items.forEach((p, idx) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "typeahead-item";
        btn.setAttribute("role", "option");
        if (idx === activeIndex) btn.classList.add("active");

        const l1 = document.createElement("div");
        l1.className = "typeahead-item-nome";
        l1.textContent = p.nome || "(sem nome)";

        const l2 = document.createElement("div");
        l2.className = "typeahead-item-detalhes";
        const parts = [];
        if (p.documento) parts.push(p.documento);
        if (p.telefone) parts.push(p.telefone);
        if (p.data_nascimento) parts.push("Nasc.: " + p.data_nascimento);
        l2.textContent = parts.join(" • ");

        btn.appendChild(l1);
        if (l2.textContent) btn.appendChild(l2);

        btn.addEventListener("mousedown", (e) => e.preventDefault());
        btn.addEventListener("click", () => {
          hide();
          inputEl.value = p.nome;
          onSelected(p);
        });

        panel.appendChild(btn);
      });

      show();
    }

    async function fetch(q) {
      const query = String(q || "").trim();
      if (query.length < 2) return hide();

      lastQuery = query;
      try {
        const results = await apiBuscar_(query, limit);
        if (String(inputEl.value || "").trim() !== lastQuery) return;
        items = results || [];
        activeIndex = items.length ? 0 : -1;
        render();
      } catch (e) {
        console.warn("[Agenda] typeahead buscar falhou:", e);
        hide();
      }
    }

    inputEl.addEventListener("input", () => {
      onTyping();
      const q = String(inputEl.value || "").trim();
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => fetch(q), 220);
    });

    inputEl.addEventListener("focus", () => {
      const q = String(inputEl.value || "").trim();
      if (q.length >= 2) fetch(q);
    });

    inputEl.addEventListener("blur", () => setTimeout(() => hide(), 180));

    inputEl.addEventListener("keydown", (e) => {
      if (panel.classList.contains("hidden")) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        activeIndex = Math.min(activeIndex + 1, items.length - 1);
        render();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        activeIndex = Math.max(activeIndex - 1, 0);
        render();
      } else if (e.key === "Enter") {
        if (activeIndex >= 0 && items[activeIndex]) {
          e.preventDefault();
          const p = items[activeIndex];
          hide();
          inputEl.value = p.nome;
          onSelected(p);
        }
      } else if (e.key === "Escape") {
        hide();
      }
    });
  }

  PRONTIO.agenda.patientsTypeahead = { attach };
})(window);
