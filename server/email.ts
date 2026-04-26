import nodemailer from "nodemailer";

// SMTP configuration from environment variables
const SMTP_HOST = process.env.SMTP_HOST || "";
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587", 10);
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER;
const SMTP_SECURE = process.env.SMTP_SECURE === "true"; // true for 465, false for other ports

// Check if SMTP is configured
export function isSmtpConfigured(): boolean {
  return !!(SMTP_HOST && SMTP_USER && SMTP_PASS);
}

// Create reusable transporter
function createTransporter() {
  if (!isSmtpConfigured()) {
    return null;
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: false, // Allow self-signed certificates
    },
  });
}

// Send email
export async function sendEmail(options: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const transporter = createTransporter();

  if (!transporter) {
    console.warn("[Email] SMTP not configured, skipping email send");
    return { success: false, error: "SMTP não configurado" };
  }

  try {
    const info = await transporter.sendMail({
      from: `"Conexão em Farmacologia" <${SMTP_FROM}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });

    console.log(`[Email] Sent to ${options.to}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err: any) {
    console.error("[Email] Failed to send:", err.message);
    return { success: false, error: err.message };
  }
}

// Send password reset email
export async function sendPasswordResetEmail(options: {
  to: string;
  teacherName: string;
  resetLink: string;
  expiresInMinutes?: number;
}): Promise<{ success: boolean; error?: string }> {
  const expiresIn = options.expiresInMinutes || 60;

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #0A1628; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0A1628; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%;">
          <!-- Header -->
          <tr>
            <td align="center" style="padding-bottom: 32px;">
              <img src="https://files.manuscdn.com/user_upload_by_module/session_file/310419663028318382/TYglakFwBNwpBXzT.png" 
                   alt="Logo" width="64" height="64" style="display: block; margin-bottom: 16px;" />
              <h1 style="color: #ffffff; font-size: 24px; margin: 0; font-weight: 700;">Conexão em Farmacologia</h1>
              <p style="color: rgba(255,255,255,0.5); font-size: 14px; margin: 8px 0 0;">UNIRIO</p>
            </td>
          </tr>

          <!-- Content Card -->
          <tr>
            <td style="background-color: #0D1B2A; border-radius: 12px; padding: 40px 32px; border: 1px solid rgba(255,255,255,0.1);">
              <h2 style="color: #ffffff; font-size: 22px; margin: 0 0 8px; font-weight: 700;">
                🔑 Redefinição de Senha
              </h2>
              <p style="color: rgba(255,255,255,0.6); font-size: 14px; margin: 0 0 24px; line-height: 1.6;">
                Olá, <strong style="color: #ffffff;">${options.teacherName}</strong>!
              </p>
              <p style="color: rgba(255,255,255,0.6); font-size: 14px; margin: 0 0 24px; line-height: 1.6;">
                Recebemos uma solicitação para redefinir a senha da sua conta na plataforma 
                <strong style="color: #F7941D;">Conexão em Farmacologia</strong>. 
                Clique no botão abaixo para criar uma nova senha:
              </p>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                <tr>
                  <td align="center">
                    <a href="${options.resetLink}" 
                       style="display: inline-block; background-color: #F7941D; color: #ffffff; 
                              font-size: 16px; font-weight: 600; text-decoration: none; 
                              padding: 14px 32px; border-radius: 8px; letter-spacing: 0.5px;">
                      Redefinir Minha Senha
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Expiration Warning -->
              <div style="background-color: rgba(247,148,29,0.1); border: 1px solid rgba(247,148,29,0.2); 
                          border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                <p style="color: #F7941D; font-size: 13px; margin: 0; line-height: 1.5;">
                  ⏰ <strong>Este link expira em ${expiresIn} minutos.</strong><br>
                  Após esse período, será necessário solicitar um novo link de redefinição.
                </p>
              </div>

              <!-- Alternative Link -->
              <p style="color: rgba(255,255,255,0.4); font-size: 12px; margin: 0 0 8px; line-height: 1.5;">
                Se o botão não funcionar, copie e cole o link abaixo no seu navegador:
              </p>
              <p style="color: #F7941D; font-size: 11px; margin: 0; word-break: break-all; line-height: 1.5;">
                ${options.resetLink}
              </p>

              <!-- Divider -->
              <hr style="border: none; border-top: 1px solid rgba(255,255,255,0.1); margin: 24px 0;" />

              <!-- Security Note -->
              <p style="color: rgba(255,255,255,0.4); font-size: 12px; margin: 0; line-height: 1.5;">
                🔒 Se você não solicitou esta redefinição, ignore este email. Sua senha permanecerá inalterada.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top: 24px;">
              <p style="color: rgba(255,255,255,0.3); font-size: 11px; margin: 0; line-height: 1.5;">
                Conexão em Farmacologia — UNIRIO<br>
                Este é um email automático, não responda.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `Olá, ${options.teacherName}!

Recebemos uma solicitação para redefinir a senha da sua conta na plataforma Conexão em Farmacologia.

Acesse o link abaixo para criar uma nova senha:
${options.resetLink}

⏰ Este link expira em ${expiresIn} minutos.

Se você não solicitou esta redefinição, ignore este email.

---
Conexão em Farmacologia — UNIRIO`;

  return sendEmail({
    to: options.to,
    subject: "🔑 Redefinição de Senha — Conexão em Farmacologia",
    html,
    text,
  });
}


// Send grades report email to professor with CSV attachment
export async function sendGradesReportEmail(options: {
  to: string;
  professorName: string;
  className: string;
  csvContent: string;
  totalStudents: number;
  timestamp: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background-color:#0A1628;font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0A1628;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0">
        <tr><td align="center" style="padding-bottom:32px;">
          <img src="https://files.manuscdn.com/user_upload_by_module/session_file/310419663028318382/TYglakFwBNwpBXzT.png" alt="Logo" width="64" height="64" style="display:block;margin-bottom:16px;" />
          <h1 style="color:#ffffff;font-size:24px;margin:0;">Conexao em Farmacologia</h1>
          <p style="color:rgba(255,255,255,0.5);font-size:14px;margin:8px 0 0;">UNIRIO</p>
        </td></tr>
        <tr><td style="background-color:#0D1B2A;border-radius:12px;padding:40px 32px;border:1px solid rgba(255,255,255,0.1);">
          <h2 style="color:#ffffff;font-size:22px;margin:0 0 8px;">Relatorio de Notas</h2>
          <p style="color:rgba(255,255,255,0.6);font-size:14px;margin:0 0 24px;line-height:1.6;">
            Ola, <strong style="color:#ffffff;">${options.professorName}</strong>!
          </p>
          <p style="color:rgba(255,255,255,0.6);font-size:14px;margin:0 0 24px;line-height:1.6;">
            Segue em anexo o relatorio de notas da turma <strong style="color:#F7941D;">${options.className}</strong>.
          </p>
          <div style="background-color:rgba(247,148,29,0.1);border:1px solid rgba(247,148,29,0.2);border-radius:8px;padding:16px;margin-bottom:24px;">
            <p style="color:#F7941D;font-size:13px;margin:0;line-height:1.5;">
              Turma: ${options.className}<br>
              Total de alunos: ${options.totalStudents}<br>
              Data de geracao: ${options.timestamp}
            </p>
          </div>
          <p style="color:rgba(255,255,255,0.4);font-size:12px;margin:0;">
            O arquivo CSV esta anexado. Abra com Excel ou Google Sheets.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = `Relatorio de notas da turma ${options.className}. Total: ${options.totalStudents} alunos. Data: ${options.timestamp}`;

  const transporter = createTransporter();
  if (!transporter) {
    console.warn("[Email] SMTP not configured, skipping grades report email");
    return { success: false, error: "SMTP nao configurado" };
  }

  try {
    const safeClass = options.className.replace(/\s+/g, "_");
    const safeDate = options.timestamp.replace(/[/:]/g, "-");
    const info = await transporter.sendMail({
      from: `"Conexao em Farmacologia" <${SMTP_FROM}>`,
      to: options.to,
      subject: `Relatorio de Notas - ${options.className} - ${options.timestamp}`,
      html,
      text,
      attachments: [
        {
          filename: `notas_${safeClass}_${safeDate}.csv`,
          content: options.csvContent,
          contentType: "text/csv; charset=utf-8",
        },
      ],
    });
    console.log(`[Email] Grades report sent to ${options.to}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err: any) {
    console.error("[Email] Failed to send grades report:", err.message);
    return { success: false, error: err.message };
  }
}

// Send bulk email to multiple recipients
export async function sendBulkEmail(options: {
  recipients: Array<{ email: string; name: string }>;
  subject: string;
  htmlTemplate: string; // Use {{name}} as placeholder for recipient name
  textTemplate: string;
  delayMs?: number;
}): Promise<{ sent: number; failed: number; errors: string[] }> {
  const transporter = createTransporter();
  if (!transporter) {
    console.warn("[Email] SMTP not configured, skipping bulk email");
    return { sent: 0, failed: options.recipients.length, errors: ["SMTP não configurado"] };
  }
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];
  const delay = options.delayMs ?? 300;
  for (const recipient of options.recipients) {
    try {
      const html = options.htmlTemplate.replace(/\{\{name\}\}/g, recipient.name);
      const text = options.textTemplate.replace(/\{\{name\}\}/g, recipient.name);
      const info = await transporter.sendMail({
        from: `"Conexão em Farmacologia" <${SMTP_FROM}>`,
        to: recipient.email,
        subject: options.subject,
        html,
        text,
      });
      console.log(`[BulkEmail] Sent to ${recipient.email}: ${info.messageId}`);
      sent++;
    } catch (err: any) {
      console.error(`[BulkEmail] Failed to send to ${recipient.email}: ${err.message}`);
      failed++;
      errors.push(`${recipient.email}: ${err.message}`);
    }
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  return { sent, failed, errors };
}
