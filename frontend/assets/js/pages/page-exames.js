// assets/js/exames.js
// Tela de EXAMES PRONTIO (ES Module)
// - Usa paciente atual do state/localStorage
// - Abas: Plano (SADT) e Particular (lista de exames)
// - Ações de API:
//   - Exames.ListarCatalogo
//   - Exames.GerarSADT
//   - Exames.GerarParticular

import { callApi } from './core/api.js';
import { getPacienteAtual } from './core/state.js';
import { createPageMessages } from './ui/messages.js';

let examesCatalogoCache = [];

// Mensagens da página Exames
const msgs = createPageMessages('#mensagemExames');

// Wrapper para manter a API antiga (mostrarMensagemExames)
function mostrarMensagemExames(texto, tipo = 'info') {
  if (!texto) {
    msgs.clear();
    return;
  }

  switch (tipo) {
    case 'erro':
      msgs.erro(texto);
      break;
    case 'sucesso':
      msgs.sucesso(texto);
      break;
    default:
      msgs.info(texto);
      break;
  }
}

// -----------------------------------------------------
// EXPORT: ponto de entrada da página
// Chamado pelo main.js -> initExamesPage()
// -----------------------------------------------------
export function initExamesPage() {
  console.log('PRONTIO: initExamesPage');
  inicializarTelaExames();
}

// -----------------------------------------------------
// Inicialização da tela
// -----------------------------------------------------
async function inicializarTelaExames() {
  // 1) Tenta pegar paciente do state global
  const pacienteState = getPacienteAtual();
  let idPaciente = null;
  let nomePaciente = null;

  if (pacienteState && pacienteState.id) {
    idPaciente = pacienteState.id;
    nomePaciente = pacienteState.nome || '';
  } else {
    // 2) Fallback para localStorage (compatibilidade com fluxo antigo)
    idPaciente = localStorage.getItem('prontio_pacienteAtualId');
    nomePaciente = localStorage.getItem('prontio_pacienteAtualNome');
  }

  const spanId = document.getElementById('exPacienteId');
  const spanNome = document.getElementById('exPacienteNome');
  const topbarSubtitle = document.getElementById('topbar-subtitle');

  if (!idPaciente) {
    if (spanId) spanId.textContent = '-';
    if (spanNome) spanNome.textContent = '-';
    if (topbarSubtitle) topbarSubtitle.textContent = 'Nenhum paciente selecionado.';

    mostrarMensagemExames(
      'Nenhum paciente selecionado. Volte à lista de pacientes, selecione um e depois abra Exames.',
      'erro'
    );

    desabilitarFormulariosExames(true);
    return;
  }

  if (spanId) spanId.textContent = idPaciente;
  if (spanNome) spanNome.textContent = nomePaciente || '';
  if (topbarSubtitle) {
    topbarSubtitle.textContent = nomePaciente
      ? `Paciente: ${nomePaciente}`
      : `Paciente ID: ${idPaciente}`;
  }

  prepararAbasExames();
  prepararEventosSadt();
  prepararEventosParticular();

  mostrarMensagemExames('Carregando catálogo de exames...', 'info');
  await carregarCatalogoExames();
  mostrarMensagemExames('', 'info');
}

function desabilitarFormulariosExames(desabilitar) {
  const campos = document.querySelectorAll(
    '#abaSadt input, #abaSadt textarea, #abaParticular input, #abaParticular textarea, #abaParticular button, #abaSadt button'
  );
  campos.forEach((el) => {
    el.disabled = !!desabilitar;
  });
}

/* ===== Abas ===== */

function prepararAbasExames() {
  const tabSadt = document.getElementById('tabSadt');
  const tabPart = document.getElementById('tabParticular');
  const abaSadt = document.getElementById('abaSadt');
  const abaPart = document.getElementById('abaParticular');

  if (!tabSadt || !tabPart || !abaSadt || !abaPart) return;

  tabSadt.addEventListener('click', () => {
    tabSadt.classList.add('ativa');
    tabPart.classList.remove('ativa');
    abaSadt.classList.remove('hidden');
    abaPart.classList.add('hidden');
  });

  tabPart.addEventListener('click', () => {
    tabPart.classList.add('ativa');
    tabSadt.classList.remove('ativa');
    abaPart.classList.remove('hidden');
    abaSadt.classList.add('hidden');
  });
}

/* ===== SADT (Plano) ===== */

function prepararEventosSadt() {
  const btnGerarSadt = document.getElementById('btnGerarSadt');
  if (!btnGerarSadt) return;

  btnGerarSadt.addEventListener('click', async () => {
    await gerarSadt();
  });
}

async function gerarSadt() {
  // Usa sempre o state/localStorage atual
  const pacienteState = getPacienteAtual();
  let idPaciente = null;

  if (pacienteState && pacienteState.id) {
    idPaciente = pacienteState.id;
  } else {
    idPaciente = localStorage.getItem('prontio_pacienteAtualId');
  }

  if (!idPaciente) {
    mostrarMensagemExames(
      'Nenhum paciente selecionado. Não é possível gerar SADT.',
      'erro'
    );
    return;
  }

  const plano = document.getElementById('sadtPlano')?.value.trim() || '';
  const carteira = document.getElementById('sadtCarteira')?.value.trim() || '';
  const numeroGuia = document.getElementById('sadtNumeroGuia')?.value.trim() || '';
  const cid = document.getElementById('sadtCid')?.value.trim() || '';
  const indicacaoClinica =
    document.getElementById('sadtIndicaoClinica')?.value.trim() || '';
  const examesTexto =
    document.getElementById('sadtExamesTexto')?.value.trim() || '';
  const observacoes =
    document.getElementById('sadtObservacoes')?.value.trim() || '';

  if (!examesTexto) {
    mostrarMensagemExames(
      'Informe os exames no campo de texto da guia SADT.',
      'erro'
    );
    return;
  }

  mostrarMensagemExames('Gerando guia SADT...', 'info');

  const resposta = await callApi({
    action: 'Exames.GerarSADT',
    payload: {
      idPaciente,
      planoSaude: plano,
      numeroCarteira: carteira,
      numeroGuia,
      cidPrincipal: cid,
      indicacaoClinica,
      examesTexto,
      observacoes,
    },
  });

  if (!resposta || !resposta.success) {
    const erroTexto =
      (resposta && (resposta.errors || []).join(' | ')) ||
      'Erro ao gerar guia SADT.';
    mostrarMensagemExames(erroTexto, 'erro');
    console.error('Erro Exames.GerarSADT:', resposta);
    return;
  }

  // 1) Se o backend devolveu URL de PDF (modelo via planilha SADT):
  if (resposta.data && resposta.data.pdfUrl) {
    mostrarMensagemExames(
      'Guia SADT gerada com sucesso (PDF da planilha SADT).',
      'sucesso'
    );
    window.open(resposta.data.pdfUrl, '_blank');
    return;
  }

  // 2) Fallback: se algum dia voltar a ser HTML
  const html = resposta.data && resposta.data.html ? resposta.data.html : null;

  if (html) {
    mostrarMensagemExames(
      'Guia SADT gerada em HTML. Abrindo em nova aba...',
      'sucesso'
    );

    const win = window.open('', '_blank');
    if (!win) {
      alert(
        'Não foi possível abrir a nova aba. Verifique se o bloqueador de pop-up está ativo.'
      );
      return;
    }

    win.document.open();
    win.document.write(
      html + "<script>setTimeout(function(){window.print();},500);<\/script>"
    );
    win.document.close();
    return;
  }

  // 3) Se não veio nem PDF nem HTML:
  mostrarMensagemExames(
    'Guia SADT gerada, mas nenhum PDF ou HTML foi retornado.',
    'erro'
  );
}

/* ===== PARTICULAR ===== */

function prepararEventosParticular() {
  const filtro = document.getElementById('filtroExames');
  const btnRecarregar = document.getElementById('btnRecarregarExames');
  const btnGerarParticular = document.getElementById('btnGerarParticular');

  if (filtro) {
    filtro.addEventListener('input', () => {
      aplicarFiltroExamesLocal();
    });
  }

  if (btnRecarregar) {
    btnRecarregar.addEventListener('click', async () => {
      mostrarMensagemExames('Recarregando catálogo de exames...', 'info');
      await carregarCatalogoExames();
      mostrarMensagemExames('', 'info');
    });
  }

  if (btnGerarParticular) {
    btnGerarParticular.addEventListener('click', async () => {
      await gerarExamesParticular();
    });
  }
}

async function carregarCatalogoExames() {
  const tbody = document.getElementById('tabelaExamesBody');
  if (tbody) {
    tbody.innerHTML =
      '<tr><td colspan="4" style="text-align:center; font-size:12px; padding:6px;">Carregando exames...</td></tr>';
  }

  const resposta = await callApi({
    action: 'Exames.ListarCatalogo',
    payload: {},
  });

  if (!resposta || !resposta.success) {
    const erroTexto =
      (resposta && (resposta.errors || []).join(' | ')) ||
      'Erro ao carregar catálogo de exames.';
    console.error('Erro Exames.ListarCatalogo:', resposta);
    if (tbody) {
      tbody.innerHTML =
        '<tr><td colspan="4" style="text-align:center; font-size:12px; color:#c62828; padding:6px;">' +
        erroTexto +
        '</td></tr>';
    }
    return;
  }

  examesCatalogoCache =
    (resposta.data && resposta.data.exames) || [];

  aplicarFiltroExamesLocal();
}

function aplicarFiltroExamesLocal() {
  const termo =
    document.getElementById('filtroExames')?.value.trim().toLowerCase() || '';

  let lista = examesCatalogoCache.slice();

  if (termo) {
    lista = lista.filter((ex) => {
      const comp =
        (ex.nomeExame || '') +
        ' ' +
        (ex.grupo || '') +
        ' ' +
        (ex.descricao || '');
      return comp.toLowerCase().includes(termo);
    });
  }

  renderizarTabelaExames(lista);
}

function renderizarTabelaExames(lista) {
  const tbody = document.getElementById('tabelaExamesBody');
  if (!tbody) return;

  tbody.innerHTML = '';

  if (!lista || !lista.length) {
    tbody.innerHTML =
      '<tr><td colspan="4" style="text-align:center; font-size:12px; color:#777; padding:6px;">Nenhum exame encontrado no catálogo.</td></tr>';
    return;
  }

  lista.forEach((ex) => {
    const tr = document.createElement('tr');

    const tdCheck = document.createElement('td');
    tdCheck.className = 'col-exame-check';
    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.dataset.idExame = ex.idExame || '';
    tdCheck.appendChild(chk);
    tr.appendChild(tdCheck);

    const tdNome = document.createElement('td');
    tdNome.textContent = ex.nomeExame || '';
    tr.appendChild(tdNome);

    const tdGrupo = document.createElement('td');
    tdGrupo.className = 'col-exame-grupo';
    tdGrupo.textContent = ex.grupo || '';
    tr.appendChild(tdGrupo);

    const tdDesc = document.createElement('td');
    tdDesc.textContent = ex.descricao || '';
    tr.appendChild(tdDesc);

    tbody.appendChild(tr);
  });
}

async function gerarExamesParticular() {
  // Usa sempre o state/localStorage atual
  const pacienteState = getPacienteAtual();
  let idPaciente = null;

  if (pacienteState && pacienteState.id) {
    idPaciente = pacienteState.id;
  } else {
    idPaciente = localStorage.getItem('prontio_pacienteAtualId');
  }

  if (!idPaciente) {
    mostrarMensagemExames(
      'Nenhum paciente selecionado. Não é possível gerar pedido particular.',
      'erro'
    );
    return;
  }

  const tbody = document.getElementById('tabelaExamesBody');
  if (!tbody) return;

  const checks = tbody.querySelectorAll(
    'input[type="checkbox"][data-id-exame]'
  );
  const selecionados = [];
  checks.forEach((chk) => {
    if (chk.checked) {
      const idExame = chk.dataset.idExame;
      if (idExame) selecionados.push(idExame);
    }
  });

  const textoLivre =
    document.getElementById('partExamesTextoLivre')?.value.trim() || '';
  const observacoes =
    document.getElementById('partObservacoes')?.value.trim() || '';

  if (!selecionados.length && !textoLivre) {
    mostrarMensagemExames(
      'Selecione pelo menos um exame ou preencha o campo de exames adicionais.',
      'erro'
    );
    return;
  }

  mostrarMensagemExames('Gerando pedido particular de exames...', 'info');

  const resposta = await callApi({
    action: 'Exames.GerarParticular',
    payload: {
      idPaciente,
      examesSelecionadosIds: selecionados,
      examesTextoLivre: textoLivre,
      observacoes,
    },
  });

  if (!resposta || !resposta.success) {
    const erroTexto =
      (resposta && (resposta.errors || []).join(' | ')) ||
      'Erro ao gerar pedido particular de exames.';
    mostrarMensagemExames(erroTexto, 'erro');
    console.error('Erro Exames.GerarParticular:', resposta);
    return;
  }

  const html = resposta.data && resposta.data.html ? resposta.data.html : null;

  if (!html) {
    mostrarMensagemExames(
      'Pedido particular gerado, mas o HTML não foi retornado.',
      'erro'
    );
    return;
  }

  mostrarMensagemExames(
    'Pedido particular gerado com sucesso. Abrindo em nova aba...',
    'sucesso'
  );

  const win = window.open('', '_blank');
  if (!win) {
    alert(
      'Não foi possível abrir a nova aba. Verifique se o bloqueador de pop-up está ativo.'
    );
    return;
  }

  win.document.open();
  win.document.write(
    html + "<script>setTimeout(function(){window.print();},500);<\/script>"
  );
  win.document.close();
}

// -----------------------------------------------------
// Retrocompatibilidade com window.PRONTIO
// -----------------------------------------------------
try {
  const prontio = (window.PRONTIO = window.PRONTIO || {});
  prontio.pages = prontio.pages || {};
  prontio.pages.exames = {
    init: initExamesPage,
  };
} catch (e) {
  // ambiente sem window, ignora
}
