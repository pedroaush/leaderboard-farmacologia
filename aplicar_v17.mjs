#!/usr/bin/env node
/**
 * aplicar_v17.mjs — Presença por QR Code
 *
 * Problema: o projetor reabria sempre a MESMA sessão (criada em agosto). Quem já
 * tinha presença nela via "Sua presença já foi confirmada nesta aula ✓" e
 * NADA era gravado. Desde 01/09 nenhuma presença entrou.
 *
 *  1. Projetor: não reabre sessão de outro dia; cria sozinho a sessão de hoje.
 *  2. Check-in: "já registrada" só vale para presença do MESMO dia.
 *  3. Semana da sessão calculada pela data (Semana 1 = 18/08/2026), não pela
 *     quantidade de sessões já criadas.
 *
 *   Rodar na raiz do projeto:  node aplicar_v17.mjs
 *   Desfazer (antes do commit): git checkout -- client server
 */
import fs from "node:fs";

const rel = [];
const ok = (m) => rel.push("  ✔ " + m);
const pulo = (m) => rel.push("  • " + m);
const falha = (m) => rel.push("  ✘ " + m);
function editar(caminho, fn) {
  if (!fs.existsSync(caminho)) { falha(`${caminho}: não encontrado`); return; }
  const original = fs.readFileSync(caminho, "utf8");
  const crlf = original.includes("\r\n");
  const antes = original.replace(/\r\n/g, "\n");
  const depois = fn(antes);
  if (depois !== antes) fs.writeFileSync(caminho, crlf ? depois.replace(/\n/g, "\r\n") : depois);
}

rel.push("server/routers/qrcode.ts");
editar("server/routers/qrcode.ts", (s) => {
  if (s.includes("registroDeHoje")) { pulo("já aplicado"); return s; }
  const semana = /(\s*)const existingSessions = await db\n\s*\.select\(\{ id: qrCodeSessions\.id \}\)\n\s*\.from\(qrCodeSessions\)\n\s*\.where\(eq\(qrCodeSessions\.classId, input\.classId\)\);\n\s*const nextWeekNumber = Math\.min\(existingSessions\.length \+ 1, 17\);/;
  if (semana.test(s)) {
    s = s.replace(semana, (m, ind) =>
      `${ind}// Semana do semestre pela DATA da aula (Semana 1 = SEMESTRE_INICIO, padrão 18/08/2026)` +
      `${ind}const inicioSemestre = Date.parse(\`\${process.env.SEMESTRE_INICIO || "2026-08-18"}T00:00:00-03:00\`);` +
      `${ind}const nextWeekNumber = Math.max(1, Math.min(30, Math.floor((Date.now() - inicioSemestre) / (7 * 86400000)) + 1));`);
    ok("createSession: semana calculada pela data");
  } else falha("createSession: cálculo da semana com formato diferente — mantido");

  const dup = "      if (existingRecord.length > 0) {\n        const checkedAt = existingRecord[0].checkedInAt;";
  if (s.includes(dup)) {
    s = s.replace(dup,
      "      // Só conta como \"já registrada\" se a presença for de HOJE (a mesma sessão pode ter sido reaberta em outra aula)\n" +
      "      const diaSP = (d: Date | string) => new Date(d).toLocaleDateString(\"pt-BR\", { timeZone: \"America/Sao_Paulo\" });\n" +
      "      const registroDeHoje = existingRecord.filter((r) => r.checkedInAt && diaSP(r.checkedInAt) === diaSP(new Date()));\n" +
      "      if (registroDeHoje.length > 0) {\n        const checkedAt = registroDeHoje[0].checkedInAt;");
    ok("checkIn: presença de aula anterior não bloqueia mais a de hoje");
  } else falha("checkIn: verificação de presença duplicada com formato diferente — mantida");
  return s;
});

rel.push("client/src/pages/QRCodeProjector.tsx");
editar("client/src/pages/QRCodeProjector.tsx", (s) => {
  if (s.includes("criandoSessaoDeHojeRef")) { pulo("já aplicado"); return s; }
  const sel = "      const active = sessions.find((s: QRSession) => s.isActive);\n      if (active && !activeSessionDbId) {";
  const fimEfeito = /(\n\s*\}\n\s*\}\n\s*\}, \[sessions, generateQRImage, startCountdown, activeSessionDbId\]\);)/;
  const ref = "  const alertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);\n";
  if (!s.includes(sel) || !fimEfeito.test(s) || !s.includes(ref)) { falha("trecho de seleção automática diferente — nada alterado"); return s; }
  s = s.replace(ref, ref + "  // Evita criar duas sessões ao abrir o projetor\n  const criandoSessaoDeHojeRef = useRef(false);\n");
  s = s.replace(sel,
    "      // Só reabre automaticamente a sessão criada HOJE; sessão de outra aula não é reaproveitada\n" +
    "      const hojeSP = new Date().toLocaleDateString(\"pt-BR\", { timeZone: \"America/Sao_Paulo\" });\n" +
    "      const deHoje = (x: any) => !!x.createdAt && new Date(x.createdAt).toLocaleDateString(\"pt-BR\", { timeZone: \"America/Sao_Paulo\" }) === hojeSP;\n" +
    "      const active = sessions.find((s: QRSession) => s.isActive && deHoje(s));\n" +
    "      if (!active && !activeSessionDbId && !criandoSessaoDeHojeRef.current && sessions.some((s: QRSession) => s.isActive)) {\n" +
    "        // Há uma sessão ativa de aula anterior: cria a de hoje (a antiga é desativada pelo servidor)\n" +
    "        criandoSessaoDeHojeRef.current = true;\n" +
    "        handleCreateSession();\n" +
    "      }\n" +
    "      if (active && !activeSessionDbId) {");
  ok("projetor: cria sozinho a sessão do dia em vez de reabrir a de agosto");
  return s;
});

console.log("\nResultado da v17:\n" + rel.join("\n") + "\n\nConfira: git diff --stat   (desfazer: git checkout -- client server)\n");
