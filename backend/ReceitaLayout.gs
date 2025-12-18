/**
 * PRONTIO - ReceitaLayout.gs
 *
 * Responsável apenas pelo HTML da receita médica.
 *
 * Objetivo:
 * - Cabeçalho profissional com nome do médico, CRM, clínica e data
 * - Título central “RECEITA MÉDICA”
 * - Bloco de dados do paciente
 * - Bloco de prescrição com borda
 * - Rodapé com linha de assinatura / carimbo do médico
 *
 * Como usar dentro de Receita_GerarPdf (em Receita.gs):
 *
 *   var html = buildReceitaHtml_({
 *     config: agendaConfig,          // dados de AgendaConfig_Obter (médico, clínica, logo, etc.)
 *     paciente: pacienteObj,         // { nome, documento, dataNascimento, ... }
 *     receita: receitaObj            // { dataReceita, horaReceita, textoMedicamentos, observacoes }
 *   });
 *
 *   // Depois basta devolver esse HTML para o front:
 *   return {
 *     success: true,
 *     data: { html: html },
 *     errors: []
 *   };
 */

/**
 * Constrói o HTML completo da receita.
 *
 * @param {Object} ctx
 * @param {Object} ctx.config   - Configuração do médico/clínica (AgendaConfig_Obter)
 * @param {Object} ctx.paciente - Dados do paciente
 * @param {Object} ctx.receita  - Dados da receita
 * @returns {string} HTML
 */
function buildReceitaHtml_(ctx) {
  ctx = ctx || {};
  var cfg = ctx.config || {};
  var pac = ctx.paciente || {};
  var rec = ctx.receita || {};

  // Dados do médico / clínica vindos da aba AgendaConfig
  var medicoNome = cfg.medicoNomeCompleto || "Dr(a). ______________________";
  var medicoCRM = cfg.medicoCRM || "CRM: ____________";
  var medicoEsp = cfg.medicoEspecialidade || "";
  var clinicaNome = cfg.clinicaNome || "";
  var clinicaEnd = cfg.clinicaEndereco || "";
  var clinicaTel = cfg.clinicaTelefone || "";
  var clinicaEmail = cfg.clinicaEmail || "";
  var logoUrl = cfg.logoUrl || "";

  // Dados do paciente
  var nomePaciente = pac.nome || pac.nome_paciente || "";
  var docPaciente = pac.documento || pac.documento_paciente || "";
  var dataNasc = pac.dataNascimento || pac.data_nascimento || "";

  // Dados da receita
  var hoje = rec.dataReceita || Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    "dd/MM/yyyy"
  );
  var hora = rec.horaReceita || Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    "HH:mm"
  );

  var textoPrescricao = rec.textoMedicamentos || rec.texto || "";
  var observacoes = rec.observacoes || "";

  // HTML inline para impressão em A4
  var html = ''
    + '<!DOCTYPE html>'
    + '<html lang="pt-BR">'
    + '<head>'
    + '  <meta charset="UTF-8" />'
    + '  <title>Receita Médica</title>'
    + '  <style>'
    + '    @page { size: A4; margin: 20mm; }'
    + '    * { box-sizing: border-box; }'
    + '    body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #111827; margin: 0; padding: 0; }'
    + '    .receita-container { width: 100%; max-width: 700px; margin: 0 auto; }'
    + '    .header { display: flex; align-items: center; border-bottom: 1px solid #ddd; padding-bottom: 8px; margin-bottom: 12px; }'
    + '    .header-logo { width: 80px; height: 80px; margin-right: 12px; }'
    + '    .header-logo img { max-width: 100%; max-height: 100%; object-fit: contain; }'
    + '    .header-info { flex: 1; }'
    + '    .header-info h1 { font-size: 16px; margin: 0 0 2px; }'
    + '    .header-info h2 { font-size: 13px; margin: 0 0 2px; font-weight: normal; }'
    + '    .header-info p { margin: 0; font-size: 11px; }'
    + '    .header-meta { text-align: right; font-size: 11px; }'
    + '    .header-meta div { margin-bottom: 2px; }'
    + ''
    + '    .titulo-receita { text-align: center; font-weight: bold; font-size: 14px; margin: 12px 0 8px; }'
    + ''
    + '    .bloco { border: 1px solid #e5e7eb; border-radius: 4px; padding: 8px 10px; margin-bottom: 10px; }'
    + '    .bloco-titulo { font-weight: bold; margin-bottom: 4px; font-size: 12px; text-transform: uppercase; }'
    + ''
    + '    .paciente-linha { margin-bottom: 2px; }'
    + '    .paciente-linha span.label { font-weight: bold; }'
    + ''
    + '    .prescricao-area { min-height: 160px; white-space: pre-wrap; line-height: 1.4; }'
    + '    .obs-area { min-height: 40px; white-space: pre-wrap; line-height: 1.4; font-size: 11px; }'
    + ''
    + '    .rodape { margin-top: 40px; text-align: center; }'
    + '    .linha-assinatura { margin: 40px auto 4px; width: 260px; border-top: 1px solid #000; }'
    + '    .rodape-medico { font-size: 11px; }'
    + ''
    + '    .num-pagina { position: fixed; bottom: 8mm; right: 20mm; font-size: 10px; color: #6b7280; }'
    + '  </style>'
    + '</head>'
    + '<body>'
    + '  <div class="receita-container">'
    + '    <div class="header">'
    + '      <div class="header-logo">';

  if (logoUrl) {
    html += '<img src="' + logoUrl + '" alt="Logo" />';
  }

  html += ''
    + '      </div>'
    + '      <div class="header-info">'
    + '        <h1>' + (clinicaNome || medicoNome) + '</h1>'
    + '        <h2>' + medicoNome + '</h2>'
    + '        <p>' + medicoCRM + (medicoEsp ? ' • ' + medicoEsp : '') + '</p>';

  if (clinicaEnd) {
    html += '<p>' + clinicaEnd + '</p>';
  }
  if (clinicaTel || clinicaEmail) {
    var contato = [];
    if (clinicaTel) contato.push("Tel: " + clinicaTel);
    if (clinicaEmail) contato.push("Email: " + clinicaEmail);
    html += '<p>' + contato.join(" • ") + '</p>';
  }

  html += ''
    + '      </div>'
    + '      <div class="header-meta">'
    + '        <div>' + hoje + '</div>'
    + '        <div>' + hora + '</div>'
    + '        <div>Receita Médica</div>'
    + '      </div>'
    + '    </div>' // header
    + ''
    + '    <div class="titulo-receita">RECEITA MÉDICA</div>'
    + ''
    + '    <div class="bloco">'
    + '      <div class="bloco-titulo">Paciente</div>'
    + '      <div class="paciente-linha"><span class="label">Nome:</span> ' + (nomePaciente || "__________________________") + '</div>'
    + '      <div class="paciente-linha"><span class="label">Documento:</span> ' + (docPaciente || "__________________________") + '</div>'
    + '      <div class="paciente-linha"><span class="label">Data de nascimento:</span> ' + (dataNasc || "____/____/________") + '</div>'
    + '    </div>'
    + ''
    + '    <div class="bloco">'
    + '      <div class="bloco-titulo">Prescrição</div>'
    + '      <div class="prescricao-area">'
    +          (textoPrescricao ? textoPrescricao.replace(/</g, "&lt;") : "_______________________________________________\n\n_______________________________________________\n\n_______________________________________________")
    + '      </div>'
    + '    </div>';

  if (observacoes) {
    html += ''
      + '    <div class="bloco">'
      + '      <div class="bloco-titulo">Observações</div>'
      + '      <div class="obs-area">'
      +          observacoes.replace(/</g, "&lt;")
      + '      </div>'
      + '    </div>';
  }

  html += ''
    + '    <div class="rodape">'
    + '      <div class="linha-assinatura"></div>'
    + '      <div class="rodape-medico">'
    +          medicoNome + '<br>' + medicoCRM
    +          (medicoEsp ? '<br>' + medicoEsp : '')
    + '      </div>'
    + '    </div>'
    + '  </div>' // container
    + '  <div class="num-pagina">1/1</div>'
    + '</body>'
    + '</html>';

  return html;
}
