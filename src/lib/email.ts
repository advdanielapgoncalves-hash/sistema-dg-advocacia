import nodemailer from "nodemailer";

/**
 * Envio de e-mail via SMTP do Gmail/Google Workspace, usando uma "Senha de
 * app" — não a senha normal de login. Pedido da Daniela em 09/09: usar o
 * Gmail/Workspace do próprio escritório em vez de contratar um serviço de
 * envio transacional separado (ex: Resend).
 *
 * Pré-requisitos na conta do Google (isto aqui não configura nada sozinho):
 * 1. Verificação em duas etapas ativada na conta que vai enviar.
 * 2. Uma Senha de app gerada em https://myaccount.google.com/apppasswords
 *    — precisa da verificação em duas etapas ativa pra essa opção aparecer.
 * Sem os dois, o envio falha com erro de autenticação (535 ou parecido).
 *
 * Limite de envio (segundo a própria Google, não testado contra a conta
 * real da Daniela): em torno de 500 e-mails/dia numa conta Gmail pessoal, e
 * em torno de 2.000/dia numa conta Google Workspace — de sobra pro volume
 * de um relatório quinzenal por cliente de um escritório pequeno.
 */
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;

export type EnvioResultado = { ok: true } | { ok: false; erro: string };

export async function enviarEmail(params: {
  para: string;
  assunto: string;
  corpo: string;
}): Promise<EnvioResultado> {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    return {
      ok: false,
      erro: "Envio de e-mail não configurado (faltam as variáveis GMAIL_USER / GMAIL_APP_PASSWORD).",
    };
  }

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
  });

  try {
    await transporter.sendMail({
      from: `"Daniela Gonçalves Advocacia e Assessoria" <${GMAIL_USER}>`,
      to: params.para,
      subject: params.assunto,
      text: params.corpo,
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, erro: err instanceof Error ? err.message : String(err) };
  }
}
