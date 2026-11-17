#!/usr/bin/env node
/**
 * aplicar_v19.mjs — Presença por QR Code aparece na Frequência (definitivo)
 *
 *   Rodar na raiz do projeto:  node aplicar_v19.mjs
 *   Desfazer (antes do commit): git checkout -- server   e apague server/presencaUnificada.ts
 */
import fs from "node:fs";
const rel = [];
const ok = (m) => rel.push("  ✔ " + m), pulo = (m) => rel.push("  • " + m), falha = (m) => rel.push("  ✘ " + m);
function editar(caminho, fn) {
  if (!fs.existsSync(caminho)) { falha(`${caminho}: não encontrado`); return; }
  const original = fs.readFileSync(caminho, "utf8");
  const crlf = original.includes("\r\n");
  const antes = original.replace(/\r\n/g, "\n");
  const depois = fn(antes);
  if (depois !== antes) fs.writeFileSync(caminho, crlf ? depois.replace(/\n/g, "\r\n") : depois);
}

rel.push("server/presencaUnificada.ts");
fs.existsSync("server/presencaUnificada.ts") ? ok("presente") : falha("não encontrado — extraia o zip na raiz do projeto");

rel.push("server/routers/qrcode.ts");
editar("server/routers/qrcode.ts", (s) => {
  if (s.includes("sincronizarPresencas")) { pulo("já aplicado"); return s; }
  const imp = 'import crypto from "crypto";\n';
  const pos = "      // Atualizar resumo de presença\n      await updateAttendanceSummary(input.memberId, input.classId);\n";
  if (!s.includes(imp) || !s.includes(pos)) { falha("formato diferente — nada alterado"); return s; }
  s = s.replace(imp, imp + 'import { sincronizarPresencas, iniciarSincronizacaoPresencas } from "../presencaUnificada";\n\niniciarSincronizacaoPresencas();\n');
  s = s.replace(pos, pos + "\n      // Frequência do painel e \"Minha Presença\" (tabela attendance)\n      void sincronizarPresencas();\n");
  ok("check-in do QR Code passa a aparecer na Frequência na hora");
  ok("sincronização automática a cada 10 min (recupera também as já gravadas)");
  return s;
});

rel.push("server/routers.ts");
editar("server/routers.ts", (s) => {
  const velho = 'const semesterStart = new Date("2026-03-10"); // Adjust to actual semester start';
  if (!s.includes(velho)) { pulo("início do semestre já ajustado ou formato diferente"); return s; }
  s = s.replace(velho, 'const semesterStart = new Date(`${process.env.SEMESTRE_INICIO || "2026-08-18"}T00:00:00-03:00`); // Semana 1 do cronograma 2026.2');
  ok("presença por GPS: semana contada a partir de 18/08/2026 (antes 10/03)");
  return s;
});

console.log("\nResultado da v19:\n" + rel.join("\n") + "\n\nConfira: git diff --stat\n");
