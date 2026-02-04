(function (global, document) {
  "use strict";

  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO.features = PRONTIO.features || {};
  PRONTIO.features.prontuario = PRONTIO.features.prontuario || {};

  const { qs, qsa, setBtnMais_, escapeHtml_, formatDataHoraCompleta_, createPagingState_, showToast_, extractErrorMessage_, trapFocusInPanel_ } =
    PRONTIO.features.prontuario.utils;
  const { callApiData, callApiDataTry_ } = PRONTIO.features.prontuario.api;

  // Estado do panel
  let anamnesePanel = null;
  let anamnesePanelAside = null;
  let anamnesePanelLastFocus = null;
  let templateAtual = null;
  let templatesCache = [];
  let anamnesePaging = createPagingState_();

  // ============================================================
  // PANEL OPEN/CLOSE
  // ============================================================

  function fecharAnamnesePanel_() {
    if (!anamnesePanel) return;

    anamnesePanel.setAttribute("aria-hidden", "true");
    anamnesePanel.setAttribute("inert", "");
    anamnesePanel.style.display = "none";

    try {
      if (anamnesePanelLastFocus && typeof anamnesePanelLastFocus.focus === "function") {
        anamnesePanelLastFocus.focus();
      }
    } catch (_) {}

    anamnesePanelLastFocus = null;
  }

  function abrirAnamnesePanel_(ctx) {
    anamnesePanel = anamnesePanel || qs("#anamnesePanel");
    if (!anamnesePanel) {
      showToast_("Painel de anamnese nao encontrado no HTML.", "error");
      return;
    }

    anamnesePanelAside = anamnesePanelAside || anamnesePanel.querySelector(".slide-panel");
    anamnesePanelLastFocus = document.activeElement;

    anamnesePanel.style.display = "flex";
    anamnesePanel.setAttribute("aria-hidden", "false");
    anamnesePanel.removeAttribute("inert");

    // Carrega templates e historico
    carregarTemplates_(ctx);
    carregarHistoricoAnamneses_(ctx);

    // Foco no primeiro elemento
    const focusTarget = qs("#selectAnamneseTemplate") ||
      (anamnesePanelAside ? anamnesePanelAside.querySelector("input, textarea, button, select") : null);

    if (focusTarget && typeof focusTarget.focus === "function") {
      setTimeout(() => focusTarget.focus(), 0);
    }
  }

  function setupAnamnesePanelEvents_(ctx) {
    anamnesePanel = qs("#anamnesePanel");
    if (!anamnesePanel) return;

    anamnesePanelAside = anamnesePanel.querySelector(".slide-panel");

    // Botoes de fechar
    qsa("[data-close-anamnese]").forEach((btn) => {
      btn.addEventListener("click", () => fecharAnamnesePanel_());
    });

    // Clique no backdrop fecha
    anamnesePanel.addEventListener("click", (ev) => {
      if (!anamnesePanelAside) return;
      if (ev.target === anamnesePanel) fecharAnamnesePanel_();
    });

    // Selecao de template
    const selectTemplate = qs("#selectAnamneseTemplate");
    if (selectTemplate) {
      selectTemplate.addEventListener("change", (ev) => {
        const idTemplate = ev.target.value;
        const template = templatesCache.find(t => t.idTemplate === idTemplate);
        if (template) {
          selecionarTemplate_(template, ctx);
        }
      });
    }

    // Submit do formulario
    const formAnamnese = qs("#formAnamnese");
    if (formAnamnese) {
      formAnamnese.addEventListener("submit", (ev) => onSubmitAnamnese_(ev, ctx));
    }

    // Botao carregar mais
    const btnMais = qs("#btnMaisAnamneses");
    if (btnMais) {
      anamnesePaging.btnMais = btnMais;
      btnMais.addEventListener("click", () => carregarHistoricoAnamnesesPaged_(ctx, { append: true }));
    }
  }

  // ============================================================
  // TEMPLATES
  // ============================================================

  async function carregarTemplates_(ctx) {
    const selectEl = qs("#selectAnamneseTemplate");
    if (!selectEl) return;

    selectEl.innerHTML = '<option value="">Carregando templates...</option>';
    selectEl.disabled = true;

    try {
      const data = await callApiDataTry_(
        ["Anamnese.Template.Listar"],
        {}
      );

      templatesCache = data && data.templates ? data.templates : [];

      if (!templatesCache.length) {
        selectEl.innerHTML = '<option value="">Nenhum template disponivel</option>';
        return;
      }

      selectEl.innerHTML = '<option value="">Selecione um modelo...</option>';
      templatesCache.forEach((t) => {
        const opt = document.createElement("option");
        opt.value = t.idTemplate;
        opt.textContent = t.nome || "Template sem nome";
        selectEl.appendChild(opt);
      });

      selectEl.disabled = false;

      // Seleciona primeiro template automaticamente se houver apenas um
      if (templatesCache.length === 1) {
        selectEl.value = templatesCache[0].idTemplate;
        selecionarTemplate_(templatesCache[0], ctx);
      }

    } catch (err) {
      console.error("[PRONTIO] Erro ao carregar templates:", err);
      selectEl.innerHTML = '<option value="">Erro ao carregar templates</option>';
      showToast_("Erro ao carregar templates de anamnese.", "error");
    }
  }

  function selecionarTemplate_(template, ctx) {
    templateAtual = template;
    const container = qs("#anamnese-campos");
    if (!container) return;

    container.innerHTML = "";

    if (!template || !template.secoes || !template.secoes.secoes) {
      container.innerHTML = '<p class="texto-suave">Selecione um modelo para iniciar.</p>';
      return;
    }

    const secoes = template.secoes.secoes;
    secoes.forEach((secao) => {
      const secaoEl = renderizarSecao_(secao);
      container.appendChild(secaoEl);
    });
  }

  // ============================================================
  // RENDERIZACAO DE FORMULARIO
  // ============================================================

  function renderizarSecao_(secao) {
    const div = document.createElement("div");
    div.className = "anamnese-secao";
    div.dataset.secaoId = secao.id;

    const titulo = document.createElement("h4");
    titulo.className = "anamnese-secao__titulo";
    titulo.textContent = secao.titulo || "Secao";
    div.appendChild(titulo);

    const campos = secao.campos || [];
    campos.forEach((campo) => {
      const campoEl = renderizarCampo_(campo);
      if (campoEl) div.appendChild(campoEl);
    });

    return div;
  }

  function renderizarCampo_(campo) {
    const wrapper = document.createElement("div");
    wrapper.className = "form-group" + (campo.obrigatorio ? " campo-obrigatorio" : "");
    wrapper.dataset.campoId = campo.id;

    const label = document.createElement("label");
    label.textContent = campo.label || campo.id;
    label.setAttribute("for", "anamnese-campo-" + campo.id);
    wrapper.appendChild(label);

    let input = null;

    switch (campo.tipo) {
      case "text":
        input = renderText_(campo);
        break;
      case "textarea":
        input = renderTextarea_(campo);
        break;
      case "radio":
        input = renderRadio_(campo);
        break;
      case "checkboxList":
        input = renderCheckboxList_(campo);
        break;
      case "repeater":
        input = renderRepeater_(campo);
        break;
      default:
        input = renderText_(campo);
    }

    if (input) wrapper.appendChild(input);

    return wrapper;
  }

  function renderText_(campo) {
    const input = document.createElement("input");
    input.type = "text";
    input.id = "anamnese-campo-" + campo.id;
    input.name = campo.id;
    input.className = "form-control";
    input.placeholder = campo.placeholder || "";
    if (campo.obrigatorio) input.required = true;
    return input;
  }

  function renderTextarea_(campo) {
    const textarea = document.createElement("textarea");
    textarea.id = "anamnese-campo-" + campo.id;
    textarea.name = campo.id;
    textarea.className = "form-control";
    textarea.rows = campo.rows || 3;
    textarea.placeholder = campo.placeholder || "";
    if (campo.obrigatorio) textarea.required = true;
    return textarea;
  }

  function renderRadio_(campo) {
    const div = document.createElement("div");
    div.className = "anamnese-radio-group";

    const opcoes = campo.opcoes || [];
    opcoes.forEach((opcao, idx) => {
      const radioId = "anamnese-campo-" + campo.id + "-" + idx;

      const radioWrapper = document.createElement("label");
      radioWrapper.className = "anamnese-radio-label";

      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = campo.id;
      radio.id = radioId;
      radio.value = opcao;

      const span = document.createElement("span");
      span.textContent = opcao;

      radioWrapper.appendChild(radio);
      radioWrapper.appendChild(span);
      div.appendChild(radioWrapper);
    });

    return div;
  }

  function renderCheckboxList_(campo) {
    const div = document.createElement("div");
    div.className = "anamnese-checkbox-group";

    const opcoes = campo.opcoes || [];
    opcoes.forEach((opcao, idx) => {
      const cbId = "anamnese-campo-" + campo.id + "-" + idx;

      const cbWrapper = document.createElement("label");
      cbWrapper.className = "anamnese-checkbox-label";

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.name = campo.id;
      cb.id = cbId;
      cb.value = opcao;

      const span = document.createElement("span");
      span.textContent = opcao;

      cbWrapper.appendChild(cb);
      cbWrapper.appendChild(span);
      div.appendChild(cbWrapper);
    });

    return div;
  }

  function renderRepeater_(campo) {
    const div = document.createElement("div");
    div.className = "anamnese-repeater";
    div.dataset.repeaterId = campo.id;

    const itemsContainer = document.createElement("div");
    itemsContainer.className = "anamnese-repeater__items";
    div.appendChild(itemsContainer);

    const btnAdd = document.createElement("button");
    btnAdd.type = "button";
    btnAdd.className = "btn btn-secondary btn-sm anamnese-repeater__add";
    btnAdd.textContent = "+ Adicionar " + (campo.label || "item");
    btnAdd.addEventListener("click", () => addRepeaterItem_(itemsContainer, campo));
    div.appendChild(btnAdd);

    // Adiciona primeiro item
    addRepeaterItem_(itemsContainer, campo);

    return div;
  }

  function addRepeaterItem_(container, campo) {
    const item = document.createElement("div");
    item.className = "anamnese-repeater__item";

    const subcampos = campo.subcampos || [];
    subcampos.forEach((sub) => {
      const input = document.createElement("input");
      input.type = "text";
      input.className = "form-control form-control-sm";
      input.name = campo.id + "[]" + sub.id;
      input.placeholder = sub.label || sub.id;
      item.appendChild(input);
    });

    const btnRemove = document.createElement("button");
    btnRemove.type = "button";
    btnRemove.className = "btn btn-danger btn-sm anamnese-repeater__remove";
    btnRemove.textContent = "X";
    btnRemove.addEventListener("click", () => {
      if (container.children.length > 1) {
        item.remove();
      }
    });
    item.appendChild(btnRemove);

    container.appendChild(item);
  }

  // ============================================================
  // COLETA E SUBMIT
  // ============================================================

  function coletarDadosFormulario_() {
    const container = qs("#anamnese-campos");
    if (!container) return {};

    const dados = {};

    // Coleta campos simples (text, textarea)
    container.querySelectorAll("input[type='text'], textarea").forEach((el) => {
      const name = el.name;
      if (!name) return;

      // Repeater fields
      if (name.includes("[]")) {
        const parts = name.split("[]");
        const baseId = parts[0];
        const subId = parts[1];

        if (!dados[baseId]) dados[baseId] = [];

        // Encontra ou cria o item atual
        const item = el.closest(".anamnese-repeater__item");
        if (!item) return;

        const itemIdx = Array.from(item.parentNode.children).indexOf(item);
        if (!dados[baseId][itemIdx]) dados[baseId][itemIdx] = {};
        dados[baseId][itemIdx][subId] = el.value;
      } else {
        dados[name] = el.value;
      }
    });

    // Coleta radios
    container.querySelectorAll("input[type='radio']:checked").forEach((el) => {
      dados[el.name] = el.value;
    });

    // Coleta checkboxes
    const checkboxGroups = {};
    container.querySelectorAll("input[type='checkbox']:checked").forEach((el) => {
      if (!checkboxGroups[el.name]) checkboxGroups[el.name] = [];
      checkboxGroups[el.name].push(el.value);
    });
    Object.assign(dados, checkboxGroups);

    // Limpa repeaters vazios
    Object.keys(dados).forEach((key) => {
      if (Array.isArray(dados[key])) {
        dados[key] = dados[key].filter((item) => {
          if (!item || typeof item !== "object") return false;
          return Object.values(item).some((v) => v && String(v).trim());
        });
      }
    });

    return dados;
  }

  async function onSubmitAnamnese_(ev, ctx) {
    ev.preventDefault();

    const idPaciente = String(ctx.idPaciente || ctx.ID_Paciente || "").trim();
    if (!idPaciente) {
      showToast_("Paciente nao identificado.", "error");
      return;
    }

    if (!templateAtual) {
      showToast_("Selecione um modelo de anamnese.", "error");
      return;
    }

    const dados = coletarDadosFormulario_();

    // Valida campo obrigatorio
    const camposObrigatorios = [];
    if (templateAtual.secoes && templateAtual.secoes.secoes) {
      templateAtual.secoes.secoes.forEach((secao) => {
        (secao.campos || []).forEach((campo) => {
          if (campo.obrigatorio) camposObrigatorios.push(campo.id);
        });
      });
    }

    for (const campoId of camposObrigatorios) {
      const valor = dados[campoId];
      if (!valor || (typeof valor === "string" && !valor.trim())) {
        showToast_("Preencha todos os campos obrigatorios.", "error");
        return;
      }
    }

    const payload = {
      idPaciente: idPaciente,
      idProfissional: ctx.idProfissional || "",
      idTemplate: templateAtual.idTemplate,
      nomeTemplate: templateAtual.nome,
      dados: dados
    };

    const btnSubmit = ev.submitter || qs("#formAnamnese button[type='submit']");
    if (btnSubmit) btnSubmit.disabled = true;

    try {
      const resp = await callApiData({ action: "Anamnese.Salvar", payload: payload });

      showToast_("Anamnese salva com sucesso!", "success");

      // Limpa formulario
      const form = qs("#formAnamnese");
      if (form) form.reset();
      const container = qs("#anamnese-campos");
      if (container) container.innerHTML = '<p class="texto-suave">Selecione um modelo para iniciar nova anamnese.</p>';
      templateAtual = null;

      const selectEl = qs("#selectAnamneseTemplate");
      if (selectEl) selectEl.value = "";

      // Recarrega historico
      carregarHistoricoAnamneses_(ctx);

    } catch (err) {
      console.error("[PRONTIO] Erro ao salvar anamnese:", err);
      showToast_("Erro ao salvar anamnese: " + extractErrorMessage_(err), "error");
    } finally {
      if (btnSubmit) btnSubmit.disabled = false;
    }
  }

  // ============================================================
  // HISTORICO DE ANAMNESES
  // ============================================================

  async function carregarHistoricoAnamneses_(ctx) {
    return carregarHistoricoAnamnesesPaged_(ctx, { append: false, limit: 5 });
  }

  async function carregarHistoricoAnamnesesPaged_(ctx, opts) {
    const append = !!(opts && opts.append);
    const limit = opts && opts.limit ? Number(opts.limit) : 10;

    const lista = qs("#anamnese-lista");
    const vazio = qs("#anamnese-historico-vazio");

    if (!lista) return;

    if (anamnesePaging.loading) return;
    anamnesePaging.loading = true;
    setBtnMais_(anamnesePaging.btnMais, anamnesePaging.hasMore, true);

    const idPaciente = String(ctx.idPaciente || ctx.ID_Paciente || "").trim();
    if (!idPaciente) {
      if (vazio) {
        vazio.textContent = "Nenhum paciente selecionado.";
        vazio.classList.remove("is-hidden");
      }
      lista.innerHTML = "";
      anamnesePaging.loading = false;
      anamnesePaging.hasMore = false;
      setBtnMais_(anamnesePaging.btnMais, false, false);
      return;
    }

    if (!append) {
      if (vazio) {
        vazio.textContent = "Carregando historico...";
        vazio.classList.remove("is-hidden");
      }
      lista.innerHTML = "";
      anamnesePaging.lista = [];
      anamnesePaging.cursor = null;
      anamnesePaging.hasMore = false;
    }

    try {
      const payload = { idPaciente: idPaciente, limit: limit };
      if (append && anamnesePaging.cursor) payload.cursor = anamnesePaging.cursor;

      const data = await callApiDataTry_(
        ["Anamnese.ListarPorPacientePaged", "Anamnese.ListarPorPaciente"],
        payload
      );

      const items = data && (data.items || data.anamneses || []);
      const hasMore = !!(data && data.hasMore);
      const nextCursor = data && data.nextCursor ? data.nextCursor : null;

      if (!append) anamnesePaging.lista = items.slice();
      else anamnesePaging.lista = anamnesePaging.lista.concat(items);

      renderListaAnamneses_(anamnesePaging.lista, lista, vazio);

      anamnesePaging.cursor = nextCursor;
      anamnesePaging.hasMore = hasMore && !!nextCursor;

    } catch (err) {
      console.error("[PRONTIO] Erro ao carregar historico de anamneses:", err);
      if (vazio) {
        vazio.textContent = "Erro ao carregar historico.";
        vazio.classList.remove("is-hidden");
      }
      anamnesePaging.hasMore = false;
    } finally {
      anamnesePaging.loading = false;
      setBtnMais_(anamnesePaging.btnMais, anamnesePaging.hasMore, false);
    }
  }

  function renderListaAnamneses_(lista, ul, vazio) {
    ul.innerHTML = "";

    if (!lista || !lista.length) {
      if (vazio) {
        vazio.textContent = "Nenhuma anamnese registrada para este paciente.";
        vazio.classList.remove("is-hidden");
      }
      return;
    }

    if (vazio) vazio.classList.add("is-hidden");

    lista.forEach((anamnese) => {
      const item = document.createElement("div");
      item.className = "anamnese-historico-item";
      item.dataset.idAnamnese = anamnese.idAnamnese;

      const dataFmt = formatDataHoraCompleta_(anamnese.dataPreenchimento);
      const templateNome = anamnese.nomeTemplate || "Anamnese";

      // Monta resumo dos dados
      let resumo = "";
      if (anamnese.dados) {
        const dados = anamnese.dados;
        if (dados.queixaPrincipal) {
          resumo = String(dados.queixaPrincipal).substring(0, 100);
          if (dados.queixaPrincipal.length > 100) resumo += "...";
        }
      }

      item.innerHTML = `
        <div class="anamnese-historico-item__header">
          <span class="anamnese-historico-item__data">${escapeHtml_(dataFmt || "—")}</span>
          <span class="anamnese-historico-item__template badge">${escapeHtml_(templateNome)}</span>
        </div>
        ${resumo ? `<div class="anamnese-historico-item__resumo texto-menor">${escapeHtml_(resumo)}</div>` : ""}
        <div class="anamnese-historico-item__actions">
          <button type="button" class="btn btn-secondary btn-sm js-anamnese-ver">Ver detalhes</button>
        </div>
      `;

      const btnVer = item.querySelector(".js-anamnese-ver");
      if (btnVer) {
        btnVer.addEventListener("click", (ev) => {
          ev.preventDefault();
          abrirDetalheAnamnese_(anamnese);
        });
      }

      ul.appendChild(item);
    });
  }

  function abrirDetalheAnamnese_(anamnese) {
    // Abre modal ou expande para mostrar todos os dados
    const modal = document.createElement("div");
    modal.className = "modal-backdrop anamnese-detalhe-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");

    const templateNome = anamnese.nomeTemplate || "Anamnese";
    const dataFmt = formatDataHoraCompleta_(anamnese.dataPreenchimento);

    let dadosHtml = "";
    if (anamnese.dados && typeof anamnese.dados === "object") {
      dadosHtml = renderDadosAnamnese_(anamnese.dados);
    }

    modal.innerHTML = `
      <div class="modal modal--lg">
        <div class="modal-header">
          <h2 class="modal-title">${escapeHtml_(templateNome)} - ${escapeHtml_(dataFmt)}</h2>
          <div class="modal-header-actions">
            <button type="button" class="modal-close" aria-label="Fechar">X</button>
          </div>
        </div>
        <div class="modal-body">
          ${dadosHtml}
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary js-fechar-modal">Fechar</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Eventos de fechar
    modal.querySelector(".modal-close")?.addEventListener("click", () => modal.remove());
    modal.querySelector(".js-fechar-modal")?.addEventListener("click", () => modal.remove());
    modal.addEventListener("click", (ev) => {
      if (ev.target === modal) modal.remove();
    });

    // ESC fecha
    const handleEsc = (ev) => {
      if (ev.key === "Escape") {
        modal.remove();
        document.removeEventListener("keydown", handleEsc);
      }
    };
    document.addEventListener("keydown", handleEsc);
  }

  function renderDadosAnamnese_(dados) {
    if (!dados || typeof dados !== "object") return "<p>Sem dados registrados.</p>";

    const labels = {
      queixaPrincipal: "Queixa Principal",
      inicio: "Inicio dos Sintomas",
      evolucao: "Evolucao",
      fatoresAgravantes: "Fatores Agravantes/Atenuantes",
      pessoais: "Antecedentes Pessoais",
      pessoaisOutros: "Outros Antecedentes",
      familiares: "Antecedentes Familiares",
      medicamentos: "Medicamentos em Uso",
      temAlergia: "Possui Alergias",
      alergias: "Alergias",
      tabagismo: "Tabagismo",
      etilismo: "Etilismo",
      atividadeFisica: "Atividade Fisica",
      pa: "Pressao Arterial",
      fc: "Frequencia Cardiaca",
      temperatura: "Temperatura",
      peso: "Peso",
      altura: "Altura",
      observacoes: "Observacoes"
    };

    let html = '<dl class="anamnese-dados-lista">';

    Object.keys(dados).forEach((key) => {
      const valor = dados[key];
      const label = labels[key] || key;

      if (!valor || (typeof valor === "string" && !valor.trim())) return;
      if (Array.isArray(valor) && !valor.length) return;

      html += `<dt>${escapeHtml_(label)}</dt>`;

      if (Array.isArray(valor)) {
        // Repeater ou checkbox list
        if (typeof valor[0] === "object") {
          // Repeater (medicamentos)
          html += "<dd><ul>";
          valor.forEach((item) => {
            const parts = Object.values(item).filter(v => v && String(v).trim());
            html += `<li>${escapeHtml_(parts.join(" - "))}</li>`;
          });
          html += "</ul></dd>";
        } else {
          // Checkbox list
          html += `<dd>${escapeHtml_(valor.join(", "))}</dd>`;
        }
      } else {
        html += `<dd>${escapeHtml_(String(valor))}</dd>`;
      }
    });

    html += "</dl>";
    return html;
  }

  // ============================================================
  // EXPORTS
  // ============================================================

  PRONTIO.features.prontuario.anamnese = {
    setupAnamnesePanelEvents_,
    abrirAnamnesePanel_: abrirAnamnesePanel_,
    fecharAnamnesePanel_,
    carregarTemplates_,
    carregarHistoricoAnamneses_,
    getPanelRefs: () => ({ panel: anamnesePanel, aside: anamnesePanelAside }),
    getAnamnesePaging: () => anamnesePaging,
    setBtnMaisRef: (btn) => (anamnesePaging.btnMais = btn)
  };

})(window, document);
