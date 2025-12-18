/**
 * PRONTIO - Helper de Cabeçalho para Documentos (Receita, Laudo, Atestado, etc.)
 *
 * Usa AgendaConfig.gs → agendaConfigObter_()
 */

/**
 * Retorna um objeto com os dados de cabeçalho para documentos.
 *
 * {
 *   medicoNome,
 *   medicoCRM,
 *   medicoEspecialidade,
 *   clinicaNome,
 *   clinicaEndereco,
 *   clinicaTelefone,
 *   clinicaEmail,
 *   logoUrl
 * }
 */
function getCabecalhoDocumento_() {
  var cfg = agendaConfigObter_();

  return {
    medicoNome: cfg.medicoNomeCompleto || '',
    medicoCRM: cfg.medicoCRM || '',
    medicoEspecialidade: cfg.medicoEspecialidade || '',
    clinicaNome: cfg.clinicaNome || '',
    clinicaEndereco: cfg.clinicaEndereco || '',
    clinicaTelefone: cfg.clinicaTelefone || '',
    clinicaEmail: cfg.clinicaEmail || '',
    logoUrl: cfg.logoUrl || ''
  };
}

/**
 * Monta um HTML de cabeçalho para ser usado em PDFs.
 */
function buildCabecalhoHtml_() {
  var c = getCabecalhoDocumento_();

  var logoHtml = '';
  if (c.logoUrl) {
    logoHtml =
      '<div style="flex:0 0 auto;margin-right:16px;">' +
      '<img src="' + c.logoUrl + '" style="max-height:70px;max-width:160px;object-fit:contain;" />' +
      '</div>';
  }

  var medicoLinha2 = [];
  if (c.medicoEspecialidade) medicoLinha2.push(c.medicoEspecialidade);
  if (c.medicoCRM) medicoLinha2.push(c.medicoCRM);

  var medicoHtml =
    '<div style="flex:1 1 auto;">' +
      '<div style="font-size:14px;font-weight:bold;">' + safeHtml_(c.medicoNome) + '</div>' +
      '<div style="font-size:11px;color:#555;margin-top:2px;">' +
        safeHtml_(medicoLinha2.join(" • ")) +
      '</div>' +
    '</div>';

  var clinicaHtml = '';
  if (c.clinicaNome || c.clinicaEndereco || c.clinicaTelefone || c.clinicaEmail) {
    var partes = [];
    if (c.clinicaEndereco) partes.push(safeHtml_(c.clinicaEndereco));
    if (c.clinicaTelefone) partes.push('Tel: ' + safeHtml_(c.clinicaTelefone));
    if (c.clinicaEmail) partes.push('E-mail: ' + safeHtml_(c.clinicaEmail));

    clinicaHtml =
      '<div style="margin-top:6px;font-size:10px;color:#555;">' +
        '<div style="font-weight:bold;">' + safeHtml_(c.clinicaNome || '') + '</div>' +
        '<div>' + partes.join(' • ') + '</div>' +
      '</div>';
  }

  var html =
    '<div style="width:100%;border-bottom:1px solid #ccc;padding:8px 0 6px 0;margin-bottom:10px;">' +
      '<div style="display:flex;align-items:center;">' +
        logoHtml +
        medicoHtml +
      '</div>' +
      clinicaHtml +
    '</div>';

  return html;
}

/**
 * Escape básico de HTML.
 */
function safeHtml_(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
