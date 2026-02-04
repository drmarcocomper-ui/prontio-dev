// backend/triggers/AnamneseReminderTrigger.gs
/**
 * PRONTIO - AnamneseReminderTrigger.gs
 * Trigger diario para verificar e enviar lembretes de retorno de anamnese.
 *
 * Para ativar o trigger, execute setupAnamneseReminderTrigger_() uma vez.
 */

/**
 * Configura o trigger diario para verificar lembretes.
 * Execute esta funcao uma vez para criar o trigger.
 */
function setupAnamneseReminderTrigger_() {
  // Remove triggers existentes
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "checkAnamneseReminders_") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  // Cria novo trigger diario as 6h da manha
  ScriptApp.newTrigger("checkAnamneseReminders_")
    .timeBased()
    .atHour(6)
    .everyDays(1)
    .create();

  Logger.log("Trigger de lembrete de anamnese configurado para executar diariamente as 6h.");
}

/**
 * Funcao principal do trigger.
 * Verifica lembretes pendentes e envia e-mails.
 */
function checkAnamneseReminders_() {
  try {
    var ss = PRONTIO_getDb_();
    if (!ss) {
      Logger.log("AnamneseReminder: PRONTIO_getDb_ retornou null.");
      return;
    }

    var reminderSheet = ss.getSheetByName("AnamneseReminder");
    if (!reminderSheet) {
      Logger.log("AnamneseReminder: Sheet AnamneseReminder nao encontrada.");
      return;
    }

    var pacienteSheet = ss.getSheetByName("Pacientes");
    if (!pacienteSheet) {
      Logger.log("AnamneseReminder: Sheet Pacientes nao encontrada.");
      return;
    }

    var hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    // Carrega pacientes em um mapa para lookup rapido
    var pacientesMap = _buildPacientesMap_(pacienteSheet);

    // Carrega lembretes
    var reminderHeaderMap = _getReminderHeaderMap_(reminderSheet);
    var lastRow = reminderSheet.getLastRow();
    var lastCol = reminderSheet.getLastColumn();

    if (lastRow < 2) {
      Logger.log("AnamneseReminder: Nenhum lembrete encontrado.");
      return;
    }

    var values = reminderSheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
    var idxStatus = reminderHeaderMap["Status"];
    var idxDataDevida = reminderHeaderMap["DataDevida"];
    var idxIdPaciente = reminderHeaderMap["ID_Paciente"];
    var idxAtivo = reminderHeaderMap["Ativo"];
    var idxIdReminder = reminderHeaderMap["ID_Reminder"];
    var idxDataNotificacao = reminderHeaderMap["DataNotificacao"];
    var idxEmailEnviado = reminderHeaderMap["EmailEnviado"];

    var enviados = 0;

    for (var i = 0; i < values.length; i++) {
      var row = values[i];
      var status = String(row[idxStatus] || "").toUpperCase();
      var ativo = row[idxAtivo];

      // Verifica se o lembrete esta pendente e ativo
      if (status !== "PENDENTE") continue;
      if (!(ativo === true || ativo === "true" || ativo === 1)) continue;

      // Verifica se a data devida ja passou
      var dataDevidaRaw = row[idxDataDevida];
      var dataDevida = _parseDate_(dataDevidaRaw);
      if (!dataDevida || dataDevida > hoje) continue;

      // Busca dados do paciente
      var idPaciente = String(row[idxIdPaciente] || "");
      var paciente = pacientesMap[idPaciente];

      if (!paciente) {
        Logger.log("AnamneseReminder: Paciente nao encontrado - ID: " + idPaciente);
        continue;
      }

      var email = String(paciente.email || "").trim();
      if (!email || !_isValidEmail_(email)) {
        Logger.log("AnamneseReminder: E-mail invalido ou ausente para paciente ID: " + idPaciente);
        continue;
      }

      // Envia e-mail
      var enviado = _enviarEmailLembrete_(paciente);

      if (enviado) {
        // Atualiza status do lembrete
        var rowNum = i + 2;
        row[idxStatus] = "NOTIFICADO";
        row[idxDataNotificacao] = new Date().toISOString();
        row[idxEmailEnviado] = true;
        reminderSheet.getRange(rowNum, 1, 1, lastCol).setValues([row]);
        enviados++;
        Logger.log("AnamneseReminder: E-mail enviado para " + email + " (Paciente: " + paciente.nomeCompleto + ")");
      }
    }

    Logger.log("AnamneseReminder: Total de e-mails enviados: " + enviados);

  } catch (err) {
    Logger.log("AnamneseReminder ERRO: " + (err.message || err));
  }
}

/**
 * Constroi mapa de pacientes por ID
 */
function _buildPacientesMap_(pacienteSheet) {
  var map = {};
  var lastRow = pacienteSheet.getLastRow();
  var lastCol = pacienteSheet.getLastColumn();

  if (lastRow < 2) return map;

  var headerRow = pacienteSheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var headerMap = {};
  headerRow.forEach(function (col, idx) {
    var nome = String(col || "").trim();
    if (nome) headerMap[nome] = idx;
  });

  var values = pacienteSheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  var idxId = headerMap["idPaciente"] != null ? headerMap["idPaciente"] : headerMap["ID_Paciente"];
  var idxNome = headerMap["nomeCompleto"] != null ? headerMap["nomeCompleto"] : headerMap["Nome_Completo"];
  var idxEmail = headerMap["email"] != null ? headerMap["email"] : headerMap["Email"];
  var idxTelefone = headerMap["telefone"] != null ? headerMap["telefone"] : headerMap["Telefone"];

  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var id = String(row[idxId] || "");
    if (!id) continue;

    map[id] = {
      idPaciente: id,
      nomeCompleto: String(row[idxNome] || ""),
      email: String(row[idxEmail] || ""),
      telefone: String(row[idxTelefone] || "")
    };
  }

  return map;
}

/**
 * Obtem mapa de headers da sheet de reminders
 */
function _getReminderHeaderMap_(sheet) {
  var lastCol = sheet.getLastColumn();
  if (!lastCol || lastCol < 1) return {};

  var headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var map = {};
  headerRow.forEach(function (col, idx) {
    var nome = String(col || "").trim();
    if (nome) map[nome] = idx;
  });
  return map;
}

/**
 * Parse de data (suporta ISO string e Date)
 */
function _parseDate_(value) {
  if (!value) return null;
  if (value instanceof Date) return value;

  try {
    var d = new Date(value);
    if (!isNaN(d.getTime())) return d;
  } catch (e) {}

  return null;
}

/**
 * Valida formato basico de e-mail
 */
function _isValidEmail_(email) {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Envia e-mail de lembrete para o paciente
 */
function _enviarEmailLembrete_(paciente) {
  try {
    var html = _buildReminderEmailHtml_(paciente);

    MailApp.sendEmail({
      to: paciente.email,
      subject: "Lembrete: Retorno para consulta - PRONTIO",
      htmlBody: html
    });

    return true;
  } catch (err) {
    Logger.log("Erro ao enviar e-mail para " + paciente.email + ": " + (err.message || err));
    return false;
  }
}

/**
 * Monta HTML do e-mail de lembrete
 */
function _buildReminderEmailHtml_(paciente) {
  var nome = String(paciente.nomeCompleto || "Paciente").trim();

  // Tenta obter dados da clinica
  var clinicaTelefone = "[TELEFONE_CLINICA]";
  var clinicaWhatsApp = "[WHATSAPP_CLINICA]";

  try {
    if (typeof PRONTIO_getClinica_ === "function") {
      var clinica = PRONTIO_getClinica_();
      if (clinica) {
        clinicaTelefone = clinica.telefone || clinicaTelefone;
        clinicaWhatsApp = clinica.whatsapp || clinica.telefone || clinicaWhatsApp;
      }
    }
  } catch (e) {}

  return [
    '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">',
    '  <div style="background: linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%); padding: 20px; border-radius: 12px 12px 0 0;">',
    '    <h2 style="color: #ffffff; margin: 0; font-size: 24px;">PRONTIO</h2>',
    '    <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0; font-size: 14px;">Lembrete de Retorno</p>',
    '  </div>',
    '  <div style="background: #ffffff; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">',
    '    <p style="color: #111827; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">',
    '      Ola, <strong>' + _escapeHtml_(nome) + '</strong>!',
    '    </p>',
    '    <p style="color: #4b5563; font-size: 14px; line-height: 1.6; margin: 0 0 16px;">',
    '      Faz aproximadamente <strong>1 ano</strong> desde sua ultima consulta/anamnese.',
    '    </p>',
    '    <p style="color: #4b5563; font-size: 14px; line-height: 1.6; margin: 0 0 20px;">',
    '      Recomendamos que voce agende uma consulta de retorno para acompanhamento de sua saude.',
    '    </p>',
    '    <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin-bottom: 20px;">',
    '      <p style="color: #111827; font-size: 14px; font-weight: 600; margin: 0 0 8px;">Entre em contato conosco:</p>',
    '      <ul style="color: #4b5563; font-size: 14px; margin: 0; padding-left: 20px;">',
    '        <li style="margin-bottom: 4px;">Telefone: ' + _escapeHtml_(clinicaTelefone) + '</li>',
    '        <li>WhatsApp: ' + _escapeHtml_(clinicaWhatsApp) + '</li>',
    '      </ul>',
    '    </div>',
    '    <p style="color: #9ca3af; font-size: 12px; line-height: 1.5; margin: 0; border-top: 1px solid #e5e7eb; padding-top: 16px;">',
    '      Este e um e-mail automatico enviado pelo sistema PRONTIO.<br>',
    '      Caso ja tenha retornado, por favor desconsidere esta mensagem.',
    '    </p>',
    '  </div>',
    '</div>'
  ].join('\n');
}

/**
 * Escapa HTML para evitar XSS
 */
function _escapeHtml_(str) {
  str = String(str == null ? "" : str);
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Funcao para teste manual do trigger
 */
function testAnamneseReminderTrigger_() {
  Logger.log("Iniciando teste do trigger de lembrete de anamnese...");
  checkAnamneseReminders_();
  Logger.log("Teste concluido. Verifique os logs acima.");
}
