// frontend/assets/js/pages/page-exames.js
// =====================================
// PRONTIO - Página de EXAMES (script padrão, SEM ES Modules)
// - Usa paciente atual do PRONTIO.core.state (com fallback legacy)
// - Abas: Plano (SADT) e Particular (lista de exames)
// - Ações de API (tentativas por compat):
//   - Exames.ListarCatalogo / Exames_ListarCatalogo
//   - Exames.GerarSADT      / Exames_GerarSADT
//   - Exames.GerarParticular/ Exames_GerarParticular
//
// ✅ Padrão main.js:
// - PRONTIO.pages.exames.init = init
// - Fallback DOMContentLoaded só se main.js não rodar
// =====================================

(function (global, document) {
  "use strict";

  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  PRONTIO.pages = PRONTIO.pages || {};
  PRONTIO.pages.exames = PRONTIO.pages.exames || {};
  PRONTIO._pageInited = PRONTIO._pageInited || {};

  // Guard: só roda na página exames
  try {
    const body = document && document.body;
    const pageId = body && body.dataset ? String(body.dataset.pageId || body.getAttribute("data-page-id") || "") : "";
    if (pageId && pageId !== "exames") return;
  } catch (_) {}

  // API (data direto)
  const callApiData =
    (PRONTIO.api && typeof PRONTIO.api.callApiData === "function")
      ? PRONTIO.api.callApiData
      : (typeof global.callApiData === "function")
      ? global.callApiData
      : null;

  // Estado (core/state.js)
  function getPacienteAtual_() {
    try {
      if (PRONTIO.core && PRONTIO.core.state && typeof PRONTIO.core.state.getPacienteAtual === "function") {
        return PRONTIO.core.state.getPacienteAtual();
      }
    } catch (_) {}
    return null;
  }

  // -----------------------------
  // Page Messages (simples / compat)
  // -----------------------------
  function createPageMessages_(selector) {
    const el = document.querySelector(selector);
    function set(text, cls) {
      if (!el) return;
      el.style.display = text ? "" : "none";
      el.textContent = text || "";
      el.className = "mensagem " + (cls ? ("mensagem-" + cls) : "");
    }
    return {
      info: (t) => set(t, "info"),
      erro: (t) => set(t, "erro"),
      sucesso: (t) => set(t, "sucesso"),
      clear: () => set("", "")
    };
  }

  const msgs = createPageMessages_("#mensagemExames");

  function mostrarMensagemExames(texto, tipo) {
    if (!texto) {
      msgs.clear();
      return;
    }
    const t = String(tipo || "info");
    if (t === "erro") msgs.erro(texto);
    else if (t === "sucesso") msgs.sucesso(texto);
    else msgs.info(texto);
  }

  // -----------------------------
  // Helpers
  // -----------------------------
  let examesCatalogoCache = [];

  async function callApiDataTry_(actions, payload) {
    if (!callApiData) {
      const err = new Error("API não disponível (callApiData indefinido).");
      err.code = "CLIENT_NO_API";
      throw err;
    }

    const list = Array.isArray(actions) ? actions : [actions];
    let lastErr = null;

    for (let i = 0; i < list.length; i++) {
      const action = String(list[i] || "").trim();
      if (!action) continue;
      try {
        return await callApiData({ action, payload: payload || {} });
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error("Falha ao chamar API (todas as actions falharam).");
  }

  function getPacienteContexto_() {
    // 1) core.state
    const st = getPacienteAtual_();
    if (st && st.id) {
      return { idPaciente: String(st.id), nomePaciente: String(st.nome || "") };
    }

    // 2) legacy storage
    let idPaciente = "";
    let nomePaciente = "";
    try { idPaciente = localStorage.getItem("prontio_pacienteAtualId") || ""; } catch (_) {}
    try { nomePaciente = localStorage.getItem("prontio_pacienteAtualNome") || ""; } catch (_) {}

    return { idPaciente: String(idPaciente || ""), nomePaciente: String(nomePaciente || "") };
  }

  function desabilitarFormulariosExames(desabilitar) {
    const campos = document.querySelectorAll(
      "#abaSadt input, #abaSadt textarea, #abaParticular input, #abaParticular textarea, #abaParticular button, #abaSadt button"
    );
    campos.forEach((el) => { el.disabled = !!desabilitar; });
  }

  // -----------------------------
  // Abas
  // -----------------------------
  function prepararAbasExames() {
    const tabSadt = document.getElementById("tabSadt");
    const tabPart = document.getElementById("tabParticular");
    const abaSadt = document.getElementById("abaSadt");
    const abaPart = document.getElementById("abaParticular");

    if (!tabSadt || !tabPart || !abaSadt || !abaPart) return;

    tabSadt.addEventListener("click", () => {
      tabSadt.classList.add("ativa");
      tabPart.classList.remove("ativa");
      abaSadt.classList.remove("hidden");
      abaPart.classList.add("hidden");
    });

    tabPart.addEventListener("click", () => {
      tabPart.classList.add("ativa");
      tabSadt.classList.remove("ativa");
      abaPart.classList.remove("hidden");
      abaSadt.classList.add("hidden");
    });
  }

  // -----------------------------
  // SADT
  // -----------------------------
  function prepararEventosSadt() {
    const btnGerarSadt = document.getElementById("btnGerarSadt");
    if (!btnGerarSadt) return;

    btnGerarSadt.addEventListener("click", async () => {
      await gerarSadt();
    });
  }

  async function gerarSadt() {
    const ctx = getPacienteContexto_();
    const idPaciente = ctx.idPaciente;

    if (!idPaciente) {
      mostrarMensagemExames("Nenhum paciente selecionado. Não é possível gerar SADT.", "erro");
      return;
    }

    const plano = (document.getElementById("sadtPlano")?.value || "").trim();
    const carteira = (document.getElementById("sadtCarteira")?.value || "").trim();
    const numeroGuia = (document.getElementById("sadtNumeroGuia")?.value || "").trim();
    const cid = (document.getElementById("sadtCid")?.value || "").trim();
    const indicacaoClinica = (document.getElementById("sadtIndicaoClinica")?.value || "").trim();
    const examesTexto = (document.getElementById("sadtExamesTexto")?.value || "").trim();
    const observacoes = (document.getElementById("sadtObservacoes")?.value || "").trim();

    if (!examesTexto) {
      mostrarMensagemExames("Informe os exames no campo de texto da guia SADT.", "erro");
      return;
    }

    mostrarMensagemExames("Gerando guia SADT...", "info");

    try {
      const data = await callApiDataTry_(
        ["Exames.GerarSADT", "Exames_GerarSADT"],
        {
          idPaciente,
          planoSaude: plano,
          numeroCarteira: carteira,
          numeroGuia,
          cidPrincipal: cid,
          indicacaoClinica,
          examesTexto,
          observacoes
        }
      );

      // 1) Se o backend devolveu URL de PDF
      if (data && data.pdfUrl) {
        mostrarMensagemExames("Guia SADT gerada com sucesso (PDF).", "sucesso");
        global.open(data.pdfUrl, "_blank");
        return;
      }

      // 2) Fallback: HTML
      const html = data && data.html ? data.html : null;
      if (html) {
        mostrarMensagemExames("Guia SADT gerada em HTML. Abrindo em nova aba...", "sucesso");
        const win = global.open("", "_blank");
        if (!win) {
          alert("Não foi possível abrir a nova aba. Verifique se o bloqueador de pop-up está ativo.");
          return;
        }
        win.document.open();
        win.document.write(html + "<script>setTimeout(function(){window.print();},500);<\/script>");
        win.document.close();
        return;
      }

      mostrarMensagemExames("Guia SADT gerada, mas nenhum PDF ou HTML foi retornado.", "erro");
    } catch (e) {
      mostrarMensagemExames((e && e.message) ? e.message : "Erro ao gerar guia SADT.", "erro");
    }
  }

  // -----------------------------
  // Particular
  // -----------------------------
  function prepararEventosParticular() {
    const filtro = document.getElementById("filtroExames");
    const btnRecarregar = document.getElementById("btnRecarregarExames");
    const btnGerarParticular = document.getElementById("btnGerarParticular");

    if (filtro) {
      filtro.addEventListener("input", () => {
        aplicarFiltroExamesLocal();
      });
    }

    if (btnRecarregar) {
      btnRecarregar.addEventListener("click", async () => {
        mostrarMensagemExames("Recarregando catálogo de exames...", "info");
        await carregarCatalogoExames();
        mostrarMensagemExames("", "info");
      });
    }

    if (btnGerarParticular) {
      btnGerarParticular.addEventListener("click", async () => {
        await gerarExamesParticular();
      });
    }
  }

  async function carregarCatalogoExames() {
    const tbody = document.getElementById("tabelaExamesBody");
    if (tbody) {
      tbody.innerHTML =
        '<tr><td colspan="4" style="text-align:center; font-size:12px; padding:6px;">Carregando exames...</td></tr>';
    }

    try {
      const data = await callApiDataTry_(["Exames.ListarCatalogo", "Exames_ListarCatalogo"], {});
      examesCatalogoCache = (data && (data.exames || data.items || data.lista)) ? (data.exames || data.items || data.lista) : [];
      if (!Array.isArray(examesCatalogoCache)) examesCatalogoCache = [];
      aplicarFiltroExamesLocal();
    } catch (e) {
      const erroTexto = (e && e.message) ? e.message : "Erro ao carregar catálogo de exames.";
      console.error("Erro Exames.ListarCatalogo:", e);
      if (tbody) {
        tbody.innerHTML =
          '<tr><td colspan="4" style="text-align:center; font-size:12px; color:#c62828; padding:6px;">' +
          String(erroTexto) +
          "</td></tr>";
      }
    }
  }

  function aplicarFiltroExamesLocal() {
    const termo = (document.getElementById("filtroExames")?.value || "").trim().toLowerCase();

    let lista = examesCatalogoCache.slice();

    if (termo) {
      lista = lista.filter((ex) => {
        const comp =
          (ex.nomeExame || "") + " " +
          (ex.grupo || "") + " " +
          (ex.descricao || "");
        return String(comp).toLowerCase().includes(termo);
      });
    }

    renderizarTabelaExames(lista);
  }

  function renderizarTabelaExames(lista) {
    const tbody = document.getElementById("tabelaExamesBody");
    if (!tbody) return;

    tbody.innerHTML = "";

    if (!lista || !lista.length) {
      tbody.innerHTML =
        '<tr><td colspan="4" style="text-align:center; font-size:12px; color:#777; padding:6px;">Nenhum exame encontrado no catálogo.</td></tr>';
      return;
    }

    lista.forEach((ex) => {
      const tr = document.createElement("tr");

      const tdCheck = document.createElement("td");
      tdCheck.className = "col-exame-check";
      const chk = document.createElement("input");
      chk.type = "checkbox";
      // dataset.idExame => atributo data-id-exame (ok)
      chk.dataset.idExame = ex.idExame || "";
      tdCheck.appendChild(chk);
      tr.appendChild(tdCheck);

      const tdNome = document.createElement("td");
      tdNome.textContent = ex.nomeExame || "";
      tr.appendChild(tdNome);

      const tdGrupo = document.createElement("td");
      tdGrupo.className = "col-exame-grupo";
      tdGrupo.textContent = ex.grupo || "";
      tr.appendChild(tdGrupo);

      const tdDesc = document.createElement("td");
      tdDesc.textContent = ex.descricao || "";
      tr.appendChild(tdDesc);

      tbody.appendChild(tr);
    });
  }

  async function gerarExamesParticular() {
    const ctx = getPacienteContexto_();
    const idPaciente = ctx.idPaciente;

    if (!idPaciente) {
      mostrarMensagemExames("Nenhum paciente selecionado. Não é possível gerar pedido particular.", "erro");
      return;
    }

    const tbody = document.getElementById("tabelaExamesBody");
    if (!tbody) return;

    const checks = tbody.querySelectorAll('input[type="checkbox"][data-id-exame]');
    const selecionados = [];
    checks.forEach((chk) => {
      if (chk.checked) {
        const idExame = chk.dataset.idExame;
        if (idExame) selecionados.push(idExame);
      }
    });

    const textoLivre = (document.getElementById("partExamesTextoLivre")?.value || "").trim();
    const observacoes = (document.getElementById("partObservacoes")?.value || "").trim();

    if (!selecionados.length && !textoLivre) {
      mostrarMensagemExames("Selecione pelo menos um exame ou preencha o campo de exames adicionais.", "erro");
      return;
    }

    mostrarMensagemExames("Gerando pedido particular de exames...", "info");

    try {
      const data = await callApiDataTry_(
        ["Exames.GerarParticular", "Exames_GerarParticular"],
        {
          idPaciente,
          examesSelecionadosIds: selecionados,
          examesTextoLivre: textoLivre,
          observacoes
        }
      );

      const html = data && data.html ? data.html : null;
      if (!html) {
        mostrarMensagemExames("Pedido particular gerado, mas o HTML não foi retornado.", "erro");
        return;
      }

      mostrarMensagemExames("Pedido particular gerado com sucesso. Abrindo em nova aba...", "sucesso");

      const win = global.open("", "_blank");
      if (!win) {
        alert("Não foi possível abrir a nova aba. Verifique se o bloqueador de pop-up está ativo.");
        return;
      }

      win.document.open();
      win.document.write(html + "<script>setTimeout(function(){window.print();},500);<\/script>");
      win.document.close();
    } catch (e) {
      mostrarMensagemExames((e && e.message) ? e.message : "Erro ao gerar pedido particular de exames.", "erro");
      console.error("Erro Exames.GerarParticular:", e);
    }
  }

  // -----------------------------
  // Init
  // -----------------------------
  async function inicializarTelaExames() {
    // paciente do state/localStorage
    const ctx = getPacienteContexto_();
    const idPaciente = ctx.idPaciente;
    const nomePaciente = ctx.nomePaciente;

    const spanId = document.getElementById("exPacienteId");
    const spanNome = document.getElementById("exPacienteNome");
    const topbarSubtitle = document.getElementById("topbar-subtitle");

    if (!idPaciente) {
      if (spanId) spanId.textContent = "-";
      if (spanNome) spanNome.textContent = "-";
      if (topbarSubtitle) topbarSubtitle.textContent = "Nenhum paciente selecionado.";

      mostrarMensagemExames(
        "Nenhum paciente selecionado. Volte à lista de pacientes, selecione um e depois abra Exames.",
        "erro"
      );

      desabilitarFormulariosExames(true);
      return;
    }

    if (spanId) spanId.textContent = idPaciente;
    if (spanNome) spanNome.textContent = nomePaciente || "";
    if (topbarSubtitle) {
      topbarSubtitle.textContent = nomePaciente
        ? `Paciente: ${nomePaciente}`
        : `Paciente ID: ${idPaciente}`;
    }

    prepararAbasExames();
    prepararEventosSadt();
    prepararEventosParticular();

    mostrarMensagemExames("Carregando catálogo de exames...", "info");
    await carregarCatalogoExames();
    mostrarMensagemExames("", "info");
  }

  function init() {
    if (PRONTIO._pageInited.exames === true) return;
    PRONTIO._pageInited.exames = true;

    inicializarTelaExames().catch((e) => {
      console.error("[PRONTIO.exames] erro:", e);
      mostrarMensagemExames("Erro ao inicializar Exames.", "erro");
    });
  }

  // ✅ padrão main.js
  PRONTIO.pages.exames.init = init;

  // ✅ fallback: só se main.js não rodar
  if (!PRONTIO._mainBootstrapped) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();
  }

})(window, document);
