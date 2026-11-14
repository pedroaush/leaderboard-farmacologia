/**
 * Envia por e-mail, a todos os alunos com conta cadastrada, cada aviso que o
 * professor publica no mural (Painel Admin → Avisos).
 *
 * Usa o mesmo SMTP já configurado na plataforma (server/email.ts: sendBulkEmail).
 * Roda em segundo plano: a publicação do aviso não espera os e-mails.
 */
import { getRawDb } from "./db";
import { isSmtpConfigured, sendBulkEmail } from "./email";

const SITE = process.env.SITE_URL || "https://2026.conexaofarmacologia.com.br";
const ORANGE = "#F7941D";

type Aviso = { title: string; content?: string | null; priority?: string | null };

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const limparNome = (n: string) => {
  const p = (n || "").split("\t");
  return (p.length >= 2 ? p[1] : n).trim();
};
const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** E-mails cadastrados dos alunos (contas de aluno), sem repetição. */
export async function destinatariosDosAvisos(): Promise<{ email: string; name: string }[]> {
  const raw: any = await getRawDb();
  if (!raw) return [];
  let linhas: any[] = [];
  try {
    const [r] = await raw.execute(
      "SELECT sa.email AS email, m.name AS name FROM `studentAccounts` sa LEFT JOIN `members` m ON m.id = sa.memberId WHERE sa.email IS NOT NULL AND sa.email <> ''"
    );
    linhas = r as any[];
  } catch {
    const [r] = await raw.execute("SELECT email FROM `studentAccounts` WHERE email IS NOT NULL AND email <> ''");
    linhas = r as any[];
  }
  const vistos = new Set<string>();
  const lista: { email: string; name: string }[] = [];
  for (const l of linhas) {
    const email = String(l.email || "").trim().toLowerCase();
    if (!EMAIL_OK.test(email) || vistos.has(email)) continue;
    vistos.add(email);
    lista.push({ email, name: limparNome(String(l.name || "")) || "Aluno(a)" });
  }
  return lista;
}

function montar(aviso: Aviso) {
  const urgente = aviso.priority === "urgent";
  const importante = aviso.priority === "important";
  const etiqueta = urgente ? "URGENTE" : importante ? "IMPORTANTE" : "AVISO";
  const corEtiqueta = urgente ? "#DC2626" : ORANGE;
  const texto = (aviso.content || "").trim();
  const assunto = `[Conexão Farmacologia] ${urgente ? "URGENTE: " : ""}${aviso.title}`.slice(0, 180);

  const html = `<!doctype html><html><body style="margin:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:10px;overflow:hidden">
<tr><td style="background:#0D1B2A;padding:18px 24px;color:#ffffff;font-size:18px;font-weight:bold">Conexão <span style="color:${ORANGE}">em Farmacologia</span></td></tr>
<tr><td style="padding:24px">
<span style="display:inline-block;background:${corEtiqueta};color:#fff;font-size:11px;font-weight:bold;letter-spacing:1px;padding:3px 8px;border-radius:4px">${etiqueta}</span>
<h1 style="font-size:20px;color:#111827;margin:12px 0 8px">${esc(aviso.title)}</h1>
${texto ? `<div style="font-size:15px;line-height:1.55;color:#374151">${esc(texto).replace(/\n/g, "<br>")}</div>` : ""}
<p style="margin:24px 0 0"><a href="${SITE}/avisos" style="background:${ORANGE};color:#ffffff;text-decoration:none;font-weight:bold;padding:10px 18px;border-radius:6px;display:inline-block">Ver na plataforma</a></p>
</td></tr>
<tr><td style="padding:14px 24px;background:#f9fafb;color:#6b7280;font-size:12px">Aviso do professor de Farmacologia I — UNIRIO. Você recebe este e-mail porque tem conta na plataforma Conexão em Farmacologia.</td></tr>
</table></td></tr></table></body></html>`;

  const txt = `${etiqueta}: ${aviso.title}\n\n${texto}\n\nVer na plataforma: ${SITE}/avisos\n\n— Conexão em Farmacologia (UNIRIO)`;
  return { assunto, html, txt };
}

/** Envia o aviso a todos os alunos cadastrados. Nunca lança erro. */
export async function enviarAvisoPorEmail(aviso: Aviso): Promise<{ enviados: number; falhas: number; total: number; motivo?: string }> {
  try {
    if (!isSmtpConfigured()) {
      console.warn("[Aviso e-mail] SMTP não configurado — aviso não enviado por e-mail.");
      return { enviados: 0, falhas: 0, total: 0, motivo: "SMTP não configurado" };
    }
    const destinatarios = await destinatariosDosAvisos();
    if (!destinatarios.length) return { enviados: 0, falhas: 0, total: 0, motivo: "nenhum aluno com e-mail cadastrado" };
    const { assunto, html, txt } = montar(aviso);
    const r: any = await sendBulkEmail({
      recipients: destinatarios,
      subject: assunto,
      htmlTemplate: html,
      textTemplate: txt,
      delayMs: 400,
    });
    const res = { enviados: Number(r?.sent) || 0, falhas: Number(r?.failed) || 0, total: destinatarios.length };
    console.log(`[Aviso e-mail] "${aviso.title}": ${res.enviados}/${res.total} enviados, ${res.falhas} falha(s).`);
    if (res.falhas && r?.errors) console.warn("[Aviso e-mail] erros:", JSON.stringify(r.errors).slice(0, 1500));
    return res;
  } catch (e: any) {
    console.error("[Aviso e-mail] erro:", e?.message || e);
    return { enviados: 0, falhas: 0, total: 0, motivo: e?.message || "erro" };
  }
}
