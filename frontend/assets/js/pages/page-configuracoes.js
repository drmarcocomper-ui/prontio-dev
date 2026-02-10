// =====================================
// PRONTIO - pages/page-configuracoes.js
// Página de Configurações do PRONTIO
//
// ✅ Alinhado ao Registry.gs:
// - AgendaConfig: AgendaConfig.Obter / AgendaConfig.Salvar (com fallback underscore)
// - Clínica: Clinica_Get / Clinica_Update
//
// Observações de compat:
// - Se o usuário não tiver role admin, Clinica_Update pode retornar PERMISSION_DENIED.
//   Nesse caso, a página ainda salva AgendaConfig, e mostra aviso para Clínica.
// =====================================

(function (global, document) {
  const PRONTIO = (global.PRONTIO = global.PRONTIO || {});
  const api = PRONTIO.api || {};

  const callApiData =
    typeof api.callApiData === "function"
      ? api.callApiData
      : typeof global.callApiData === "function"
      ? global.callApiData
      : null;

  // Widgets de mensagem (toast) – se disponíveis
  const widgets = (PRONTIO.widgets = PRONTIO.widgets || {});
  const toastWidget = widgets.toast || null;
  const pageMessages =
    toastWidget && typeof toastWidget.createPageMessages === "function"
      ? toastWidget.createPageMessages("#mensagemConfig")
      : null;

  // -----------------------------------------
  // Helpers de mensagem
  // -----------------------------------------
  function mostrarMensagemConfig(texto, tipo) {
    if (pageMessages) {
      const opts =
        tipo === "sucesso"
          ? { autoHide: true, autoHideDelay: 3500 }
          : { autoHide: false };

      switch (tipo) {
        case "sucesso":
          pageMessages.sucesso(texto, opts);
          return;
        case "erro":
          pageMessages.erro(texto, opts);
          return;
        case "aviso":
          pageMessages.aviso(texto, opts);
          return;
        default:
          pageMessages.info(texto, opts);
          return;
      }
    }

    const div = document.getElementById("mensagemConfig");
    if (!div) return;

    if (!texto) {
      // ✅ P4: Usa classes ao invés de style inline
      div.classList.add("is-hidden");
      div.textContent = "";
      div.className = "mensagem is-hidden";
      return;
    }

    // ✅ P4: Usa classes ao invés de style inline
    div.classList.remove("is-hidden");
    div.textContent = texto;
    div.className = "mensagem";

    switch (tipo) {
      case "sucesso":
        div.classList.add("mensagem-sucesso");
        break;
      case "erro":
        div.classList.add("mensagem-erro");
        break;
      case "aviso":
        div.classList.add("mensagem-aviso");
        break;
      default:
        div.classList.add("mensagem-info");
        break;
    }
  }

  function limparMensagemConfig() {
    if (pageMessages) {
      pageMessages.clear();
      return;
    }
    const div = document.getElementById("mensagemConfig");
    if (!div) return;
    // ✅ P4: Usa classes ao invés de style inline
    div.classList.add("is-hidden");
    div.textContent = "";
    div.className = "mensagem is-hidden";
  }

  // ✅ P2: Helper para extrair mensagem de erro de forma segura
  function extractErrorMessage_(reason, fallback) {
    if (!reason) return fallback || "Erro desconhecido.";
    if (typeof reason === "string") return reason;
    if (reason.message && typeof reason.message === "string") {
      return reason.message;
    }
    return fallback || "Erro desconhecido.";
  }

  // -----------------------------------------
  // Helpers de formulário (dias da semana)
  // -----------------------------------------
  function obterDiasAtivosDoFormulario() {
    const chks = document.querySelectorAll(".chk-dia-ativo");
    const dias = [];
    chks.forEach((chk) => {
      if (chk.checked) dias.push(chk.value);
    });
    return dias;
  }

  function aplicarDiasAtivosNoFormulario(dias) {
    const chks = document.querySelectorAll(".chk-dia-ativo");
    const setDias = new Set(dias || []);
    chks.forEach((chk) => {
      chk.checked = setDias.has(chk.value);
    });
  }

  // -----------------------------------------
  // API helpers
  // -----------------------------------------
  async function callWithFallback_(actionDot, actionUnderscore, payload) {
    if (!callApiData) {
      const err = new Error("API não disponível no front (callApiData indefinido).");
      err.code = "CLIENT_NO_API";
      throw err;
    }

    try {
      return await callApiData({ action: actionDot, payload: payload || {} });
    } catch (e) {
      if (actionUnderscore) {
        return await callApiData({ action: actionUnderscore, payload: payload || {} });
      }
      throw e;
    }
  }

  async function callDirect_(action, payload) {
    if (!callApiData) {
      const err = new Error("API não disponível no front (callApiData indefinido).");
      err.code = "CLIENT_NO_API";
      throw err;
    }
    return await callApiData({ action: action, payload: payload || {} });
  }

  // -----------------------------------------
  // Mapeamento UI <-> Data
  // -----------------------------------------
  function readForm_() {
    const medicoNomeCompletoEl = document.getElementById("medicoNomeCompleto");
    const medicoCrmEl = document.getElementById("medicoCRM");
    const medicoEspEl = document.getElementById("medicoEspecialidade");

    const clinicaNomeEl = document.getElementById("clinicaNome");
    const clinicaEnderecoEl = document.getElementById("clinicaEndereco");
    const clinicaTelefoneEl = document.getElementById("clinicaTelefone");
    const clinicaEmailEl = document.getElementById("clinicaEmail");
    const clinicaLogoUrlEl = document.getElementById("clinicaLogoUrl");

    const horaIniEl = document.getElementById("agendaHoraInicioPadrao");
    const horaFimEl = document.getElementById("agendaHoraFimPadrao");
    const intervaloEl = document.getElementById("agendaIntervaloMinutos");

    const medicoNomeCompleto = (medicoNomeCompletoEl && medicoNomeCompletoEl.value ? medicoNomeCompletoEl.value : "").trim();
    const medicoCRM = (medicoCrmEl && medicoCrmEl.value ? medicoCrmEl.value : "").trim();
    const medicoEspecialidade = (medicoEspEl && medicoEspEl.value ? medicoEspEl.value : "").trim();

    const clinicaNome = (clinicaNomeEl && clinicaNomeEl.value ? clinicaNomeEl.value : "").trim();
    const clinicaEndereco = (clinicaEnderecoEl && clinicaEnderecoEl.value ? clinicaEnderecoEl.value : "").trim();
    const clinicaTelefone = (clinicaTelefoneEl && clinicaTelefoneEl.value ? clinicaTelefoneEl.value : "").trim();
    const clinicaEmail = (clinicaEmailEl && clinicaEmailEl.value ? clinicaEmailEl.value : "").trim();
    const logoUrl = (clinicaLogoUrlEl && clinicaLogoUrlEl.value ? clinicaLogoUrlEl.value : "").trim();

    const agendaHoraInicioPadrao = horaIniEl ? String(horaIniEl.value || "").trim() : "";
    const agendaHoraFimPadrao = horaFimEl ? String(horaFimEl.value || "").trim() : "";
    const agendaIntervaloMinutos = intervaloEl ? String(intervaloEl.value || "").trim() : "";

    const agendaDiasAtivos = obterDiasAtivosDoFormulario();

    return {
      medico: {
        medicoNomeCompleto,
        medicoCRM,
        medicoEspecialidade
      },
      clinica: {
        clinicaNome,
        clinicaEndereco,
        clinicaTelefone,
        clinicaEmail,
        logoUrl
      },
      agenda: {
        hora_inicio_padrao: agendaHoraInicioPadrao,
        hora_fim_padrao: agendaHoraFimPadrao,
        duracao_grade_minutos: Number(agendaIntervaloMinutos || 30),
        dias_ativos: agendaDiasAtivos
      }
    };
  }

  function applyAgendaConfigToForm_(configData) {
    const medicoNomeEl = document.getElementById("medicoNomeCompleto");
    const medicoCrmEl = document.getElementById("medicoCRM");
    const medicoEspEl = document.getElementById("medicoEspecialidade");

    if (medicoNomeEl) medicoNomeEl.value = configData.medicoNomeCompleto || "";
    if (medicoCrmEl) medicoCrmEl.value = configData.medicoCRM || "";
    if (medicoEspEl) medicoEspEl.value = configData.medicoEspecialidade || "";

    const horaIniEl = document.getElementById("agendaHoraInicioPadrao");
    const horaFimEl = document.getElementById("agendaHoraFimPadrao");
    const intervaloEl = document.getElementById("agendaIntervaloMinutos");

    if (horaIniEl) horaIniEl.value = configData.hora_inicio_padrao || "";
    if (horaFimEl) horaFimEl.value = configData.hora_fim_padrao || "";
    if (intervaloEl) {
      intervaloEl.value =
        configData.duracao_grade_minutos != null ? String(configData.duracao_grade_minutos) : "";
    }

    aplicarDiasAtivosNoFormulario(configData.dias_ativos || []);
  }

  function applyClinicaToForm_(clinicaData) {
    const clinicaNomeEl = document.getElementById("clinicaNome");
    const clinicaEnderecoEl = document.getElementById("clinicaEndereco");
    const clinicaTelefoneEl = document.getElementById("clinicaTelefone");
    const clinicaEmailEl = document.getElementById("clinicaEmail");
    const clinicaLogoUrlEl = document.getElementById("clinicaLogoUrl");

    if (clinicaNomeEl) clinicaNomeEl.value = clinicaData.clinicaNome || clinicaData.nome || "";
    if (clinicaEnderecoEl) clinicaEnderecoEl.value = clinicaData.clinicaEndereco || clinicaData.endereco || "";
    if (clinicaTelefoneEl) clinicaTelefoneEl.value = clinicaData.clinicaTelefone || clinicaData.telefone || "";
    if (clinicaEmailEl) clinicaEmailEl.value = clinicaData.clinicaEmail || clinicaData.email || "";

    const logoUrl = clinicaData.logoUrl || clinicaData.clinicaLogoUrl || clinicaData.logo || "";
    if (clinicaLogoUrlEl) clinicaLogoUrlEl.value = logoUrl || "";
  }

  // -----------------------------------------
  // Load (AgendaConfig + Clínica)
  // -----------------------------------------
  // ✅ P0: Adicionado try-catch para erros síncronos
  async function carregarConfiguracoes() {
    try {
      if (!callApiData) {
        mostrarMensagemConfig("Erro interno: API não disponível.", "erro");
        return;
      }

      limparMensagemConfig();
      mostrarMensagemConfig("Carregando configurações...", "info");

      // Carrega em paralelo (best-effort)
      const results = await Promise.allSettled([
        // AgendaConfig (dot + fallback underscore)
        callWithFallback_("AgendaConfig.Obter", "AgendaConfig_Obter", {}),
        // Clínica (actions do Registry)
        callDirect_("Clinica_Get", {})
      ]);

      const rAgenda = results[0];
      const rClinica = results[1];

      const okAgenda = rAgenda.status === "fulfilled";
      const okClinica = rClinica.status === "fulfilled";

      if (okAgenda) {
        const cfg = rAgenda.value || {};
        applyAgendaConfigToForm_(cfg);
      }

      if (okClinica) {
        const clin = rClinica.value || {};
        applyClinicaToForm_(clin);
      }

      // ✅ P1/P2: Mensagens de erro amigáveis usando helper
      if (okAgenda && okClinica) {
        mostrarMensagemConfig("Configurações carregadas com sucesso.", "sucesso");
        return;
      }

      if (okAgenda && !okClinica) {
        const msg = extractErrorMessage_(rClinica.reason, "Não foi possível carregar dados da clínica.");
        mostrarMensagemConfig("Agenda carregada. Clínica: " + msg, "aviso");
        return;
      }

      if (!okAgenda && okClinica) {
        const msg = extractErrorMessage_(rAgenda.reason, "Não foi possível carregar configuração da agenda.");
        mostrarMensagemConfig("Clínica carregada. Agenda: " + msg, "aviso");
        return;
      }

      // ambos falharam
      const msgA = extractErrorMessage_(rAgenda.reason, "Erro ao carregar agenda.");
      const msgC = extractErrorMessage_(rClinica.reason, "Erro ao carregar clínica.");
      mostrarMensagemConfig("Falha ao carregar configurações. Verifique sua conexão e tente novamente.", "erro");
      console.error("[Configuracoes] Erros:", msgA, "|", msgC);
    } catch (err) {
      // ✅ P0: Captura erros síncronos inesperados
      console.error("[Configuracoes] Erro inesperado ao carregar:", err);
      mostrarMensagemConfig("Erro inesperado ao carregar configurações.", "erro");
    }
  }

  // -----------------------------------------
  // Save (AgendaConfig + Clínica)
  // -----------------------------------------
  // ✅ P0: Adicionado try-catch para erros síncronos
  async function salvarConfiguracoes() {
    try {
      const formData = readForm_();

      // Validações mínimas (mantidas)
      if (!formData.medico.medicoNomeCompleto) {
        mostrarMensagemConfig("Informe o nome completo do médico.", "erro");
        return;
      }
      if (!formData.medico.medicoCRM) {
        mostrarMensagemConfig("Informe o CRM.", "erro");
        return;
      }

      mostrarMensagemConfig("Salvando configurações...", "info");

      // 1) Salva AgendaConfig (dot + fallback underscore)
      const payloadAgendaConfig = {
        medicoNomeCompleto: formData.medico.medicoNomeCompleto,
        medicoCRM: formData.medico.medicoCRM,
        medicoEspecialidade: formData.medico.medicoEspecialidade,
        hora_inicio_padrao: formData.agenda.hora_inicio_padrao,
        hora_fim_padrao: formData.agenda.hora_fim_padrao,
        duracao_grade_minutos: formData.agenda.duracao_grade_minutos,
        dias_ativos: formData.agenda.dias_ativos
      };

      // 2) Salva Clínica (Clinica_Update)
      // NOTE: Registry indica roles:["admin"] para Clinica_Update
      const payloadClinica = {
        clinicaNome: formData.clinica.clinicaNome,
        clinicaEndereco: formData.clinica.clinicaEndereco,
        clinicaTelefone: formData.clinica.clinicaTelefone,
        clinicaEmail: formData.clinica.clinicaEmail,
        logoUrl: formData.clinica.logoUrl
      };

      const results = await Promise.allSettled([
        callWithFallback_("AgendaConfig.Salvar", "AgendaConfig_Salvar", payloadAgendaConfig),
        callDirect_("Clinica_Update", payloadClinica)
      ]);

      const rAgenda = results[0];
      const rClinica = results[1];

      const okAgenda = rAgenda.status === "fulfilled";
      const okClinica = rClinica.status === "fulfilled";

      // ✅ P1/P2: Mensagens de erro amigáveis usando helper
      if (okAgenda && okClinica) {
        mostrarMensagemConfig("Configurações salvas com sucesso.", "sucesso");
        return;
      }

      if (okAgenda && !okClinica) {
        const reason = rClinica.reason;
        const code = reason && reason.code ? String(reason.code) : "";
        // Se não for admin, isso é esperado pelo contrato do Registry.
        if (code === "PERMISSION_DENIED") {
          mostrarMensagemConfig("Agenda salva. Dados da clínica requerem permissão de administrador.", "aviso");
        } else {
          const msg = extractErrorMessage_(reason, "Não foi possível salvar dados da clínica.");
          mostrarMensagemConfig("Agenda salva. Clínica: " + msg, "aviso");
        }
        return;
      }

      if (!okAgenda && okClinica) {
        const msg = extractErrorMessage_(rAgenda.reason, "Não foi possível salvar configuração da agenda.");
        mostrarMensagemConfig("Clínica salva. Agenda: " + msg, "aviso");
        return;
      }

      // ambos falharam
      const msgA = extractErrorMessage_(rAgenda.reason, "Erro ao salvar agenda.");
      const msgC = extractErrorMessage_(rClinica.reason, "Erro ao salvar clínica.");
      mostrarMensagemConfig("Falha ao salvar configurações. Verifique os dados e tente novamente.", "erro");
      console.error("[Configuracoes] Erros ao salvar:", msgA, "|", msgC);
    } catch (err) {
      // ✅ P0: Captura erros síncronos inesperados
      console.error("[Configuracoes] Erro inesperado ao salvar:", err);
      mostrarMensagemConfig("Erro inesperado ao salvar configurações.", "erro");
    }
  }

  // -----------------------------------------
  // Migração: Importar evoluções
  // -----------------------------------------
  function detectarDelimitadorEv(linha) {
    const tabs = (linha.match(/\t/g) || []).length;
    const virgulas = (linha.match(/,/g) || []).length;
    const pontoVirgulas = (linha.match(/;/g) || []).length;
    if (tabs >= virgulas && tabs >= pontoVirgulas) return "\t";
    if (pontoVirgulas >= virgulas) return ";";
    return ",";
  }

  function parseCsvLineEv(linha, delimitador) {
    const cols = [];
    let atual = "";
    let dentroAspas = false;

    for (let i = 0; i < linha.length; i++) {
      const ch = linha[i];
      if (ch === '"') {
        if (dentroAspas && linha[i + 1] === '"') {
          atual += '"';
          i++;
        } else {
          dentroAspas = !dentroAspas;
        }
      } else if (ch === delimitador && !dentroAspas) {
        cols.push(atual);
        atual = "";
      } else {
        atual += ch;
      }
    }
    cols.push(atual);
    return cols;
  }

  async function importarEvolucoes() {
    const textarea = document.getElementById("csvEvolucoes");
    const status = document.getElementById("statusImportEvolucoes");
    const btn = document.getElementById("btnImportarEvolucoes");
    const service = PRONTIO.services && PRONTIO.services.evolucoes;

    if (!service) {
      if (status) status.textContent = "Servico de evolucoes nao disponivel.";
      return;
    }

    const csv = (textarea ? textarea.value : "").trim();
    if (!csv) {
      if (status) status.textContent = "Cole os dados da planilha antes de importar.";
      return;
    }

    const linhas = csv.split(/\r?\n/);
    if (linhas.length < 2) {
      if (status) status.textContent = "Dados insuficientes. Verifique se copiou o cabecalho e as linhas.";
      return;
    }

    const delimitador = detectarDelimitadorEv(linhas[0]);
    const cabecalho = parseCsvLineEv(linhas[0], delimitador).map(c => c.trim());

    // Mapeia índices das colunas
    const iIdPaciente = cabecalho.findIndex(c => /^idPaciente$/i.test(c));
    const iData = cabecalho.findIndex(c => /^data$/i.test(c));
    const iTexto = cabecalho.findIndex(c => /^texto$/i.test(c));
    const iCriadoEm = cabecalho.findIndex(c => /^criadoEm$/i.test(c));
    const iAtualizadoEm = cabecalho.findIndex(c => /^atualizadoEm$/i.test(c));
    const iAtivo = cabecalho.findIndex(c => /^ativo$/i.test(c));

    if (iIdPaciente === -1 || iTexto === -1) {
      if (status) status.textContent = "Cabecalho invalido. Precisa ter pelo menos: idPaciente, texto";
      return;
    }

    // Monta lista de evoluções
    const evolucoes = [];
    for (let i = 1; i < linhas.length; i++) {
      const linha = linhas[i].trim();
      if (!linha) continue;

      const cols = parseCsvLineEv(linha, delimitador);
      const idPaciente = (cols[iIdPaciente] || "").trim();
      const texto = (cols[iTexto] || "").trim();

      if (!idPaciente || !texto) continue;

      const ev = { idPaciente, texto };
      if (iData !== -1) ev.data = (cols[iData] || "").trim();
      if (iCriadoEm !== -1) ev.criadoEm = (cols[iCriadoEm] || "").trim() || undefined;
      if (iAtualizadoEm !== -1) ev.atualizadoEm = (cols[iAtualizadoEm] || "").trim() || undefined;
      if (iAtivo !== -1) {
        const val = (cols[iAtivo] || "").trim().toLowerCase();
        ev.ativo = val !== "false" && val !== "0" && val !== "nao";
      }

      evolucoes.push(ev);
    }

    if (!evolucoes.length) {
      if (status) status.textContent = "Nenhuma evolucao valida encontrada nos dados.";
      return;
    }

    if (btn) btn.disabled = true;
    if (status) status.textContent = `Importando ${evolucoes.length} evolucoes...`;

    const result = await service.importarLote(evolucoes);

    if (btn) btn.disabled = false;

    if (result.success) {
      const msg = `${result.data.importados} evolucoes importadas.`;
      const errosMsg = result.data.erros > 0 ? ` (${result.data.erros} erros)` : "";
      if (status) status.textContent = msg + errosMsg;
      if (textarea) textarea.value = "";
    } else {
      if (status) status.textContent = "Erro: " + result.error;
    }
  }

  // -----------------------------------------
  // Inicializador da página
  // -----------------------------------------
  function initConfiguracoesPage() {
    const form = document.getElementById("formConfiguracoes");
    const btnRecarregar = document.getElementById("btnRecarregarConfig");

    if (!callApiData) {
      mostrarMensagemConfig("Erro interno: API não disponível.", "erro");
      return;
    }

    // ✅ P0: Event listeners com tratamento de erros para async functions
    if (form) {
      form.addEventListener("submit", async function (event) {
        event.preventDefault();
        try {
          await salvarConfiguracoes();
        } catch (err) {
          console.error("[Configuracoes] Erro não tratado ao salvar:", err);
          mostrarMensagemConfig("Erro inesperado ao salvar.", "erro");
        }
      });
    }

    if (btnRecarregar) {
      btnRecarregar.addEventListener("click", async function () {
        try {
          await carregarConfiguracoes();
        } catch (err) {
          console.error("[Configuracoes] Erro não tratado ao recarregar:", err);
          mostrarMensagemConfig("Erro inesperado ao recarregar.", "erro");
        }
      });
    }

    // Migração: botão importar evoluções
    const btnImportEv = document.getElementById("btnImportarEvolucoes");
    if (btnImportEv) {
      btnImportEv.addEventListener("click", async function () {
        try {
          await importarEvolucoes();
        } catch (err) {
          console.error("[Configuracoes] Erro ao importar evolucoes:", err);
          const st = document.getElementById("statusImportEvolucoes");
          if (st) st.textContent = "Erro inesperado: " + err.message;
        }
      });
    }

    // ✅ P0: Carregamento inicial com tratamento de erros
    carregarConfiguracoes().catch(function (err) {
      console.error("[Configuracoes] Erro não tratado no carregamento inicial:", err);
      mostrarMensagemConfig("Erro ao carregar configurações iniciais.", "erro");
    });
  }

  // -----------------------------------------
  // Registro no PRONTIO (para main.js)
  // -----------------------------------------
  PRONTIO.pages = PRONTIO.pages || {};
  PRONTIO.pages.configuracoes = PRONTIO.pages.configuracoes || {};
  PRONTIO.pages.configuracoes.init = initConfiguracoesPage;

})(window, document);
