function TestMail_Send() {
  MailApp.sendEmail({
    to: "marcocomper@yahoo.com.br",
    subject: "PRONTIO - Teste de envio de e-mail",
    body: "Este é um teste manual de envio de e-mail pelo Apps Script.\n\nSe você recebeu este e-mail, o MailApp está funcionando corretamente."
  });

  Logger.log("E-mail de teste enviado.");
}
