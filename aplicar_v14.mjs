#!/usr/bin/env node
/**
 * aplicar_v14.mjs — cada aviso publicado no mural do professor também vai por
 * e-mail para todos os alunos com conta cadastrada.
 *
 *   Rodar na raiz do projeto:  node aplicar_v14.mjs
 *   Desfazer (antes do commit): git checkout -- server   e apague server/avisoEmail.ts
 */
import fs from "node:fs";

const rel = [];
const ok = (m) => rel.push("  ✔ " + m);
const pulo = (m) => rel.push("  • " + m);
const falha = (m) => rel.push("  ✘ " + m);

rel.push("server/avisoEmail.ts");
if (fs.existsSync("server/avisoEmail.ts")) ok("presente"); else falha("não encontrado — extraia o zip na raiz do projeto");
if (!fs.existsSync("server/email.ts")) falha("server/email.ts não existe — o envio de e-mails da plataforma não está neste projeto");

rel.push("server/routers.ts");
(function () {
  const p = "server/routers.ts";
  if (!fs.existsSync(p)) return falha("não encontrado");
  const original = fs.readFileSync(p, "utf8");
  const crlf = original.includes("\r\n");
  const s = original.replace(/\r\n/g, "\n");
  if (s.includes("enviarAvisoPorEmail")) return pulo("já aplicado");
  const ini = s.indexOf("notifications: router({");
  if (ini < 0) return falha("router de notifications não encontrado");
  const alvo = /(const id = await db\.createNotification\(\{\n\s*\.\.\.data,\n\s*expiresAt: expiresAt \? new Date\(expiresAt\) : null,\n(\s*)\}\);\n)/;
  const trecho = s.slice(ini);
  const m = trecho.match(alvo);
  if (!m) return falha("notifications.create com formato diferente — nada alterado (mande o routers.ts)");
  const ind = m[2];
  const novo = trecho.replace(alvo, (bloco) =>
    bloco +
    `${ind}// Aviso também por e-mail para os alunos cadastrados (em segundo plano)\n` +
    `${ind}import("./avisoEmail").then(({ enviarAvisoPorEmail }) => enviarAvisoPorEmail({ title: data.title, content: data.content, priority: data.priority }))\n` +
    `${ind}  .then((r) => sendNotificationAsync("📧 Aviso enviado por e-mail", \`"\${data.title}": \${r.enviados}/\${r.total} e-mails enviados\${r.falhas ? \`, \${r.falhas} falha(s)\` : ""}\${r.motivo ? \` — \${r.motivo}\` : ""}\`))\n` +
    `${ind}  .catch((e) => console.error("[Aviso e-mail]", e));\n`);
  const final = s.slice(0, ini) + novo;
  fs.writeFileSync(p, crlf ? final.replace(/\n/g, "\r\n") : final);
  ok("notifications.create: aviso publicado → e-mail para os alunos");
  if (!/function sendNotificationAsync/.test(s)) falha("sendNotificationAsync não existe no arquivo — avise o Claude");
})();

console.log("\nResultado da v14:\n" + rel.join("\n") + "\n\nConfira: git diff --stat\n");
