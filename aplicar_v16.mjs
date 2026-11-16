#!/usr/bin/env node
/**
 * aplicar_v16.mjs — Destaques 100% automáticos (toda segunda, 0h, por turma).
 *
 *   Rodar na raiz do projeto:  node aplicar_v16.mjs
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

rel.push("Arquivos novos");
for (const f of ["server/destaquesAuto.ts", "server/routers/destaquesAuto.ts", "client/src/components/DestaquesAutomaticos.tsx"])
  fs.existsSync(f) ? ok(f) : falha(`${f} não encontrado — extraia o zip na raiz do projeto`);

rel.push("server/routers.ts");
editar("server/routers.ts", (s) => {
  if (s.includes("destaquesAutoRouter")) { pulo("já aplicado"); return s; }
  const imp = /import \{ notificacoesRouter \} from "\.\/routers\/notificacoes";\n/;
  if (!imp.test(s)) { falha('import do notificacoesRouter não encontrado — nada alterado'); return s; }
  const reg = /(\n(\s*)notificacoes: notificacoesRouter,)/;
  if (!reg.test(s)) { falha("registro notificacoes: notificacoesRouter não encontrado — nada alterado"); return s; }
  s = s.replace(imp, (m) => m + 'import { destaquesAutoRouter } from "./routers/destaquesAuto";\n');
  s = s.replace(reg, (m, a, ind) => `${a}\n${ind}destaquesAuto: destaquesAutoRouter,`);
  ok("destaquesAuto registrado (o agendador liga junto com o servidor)");

  // Ranking por turma mostra só os destaques daquela turma
  const ini = s.indexOf("getDataByClass: publicProcedure");
  const alvo = "const highlightsData = await db.getAllHighlights();";
  const j = ini >= 0 ? s.indexOf(alvo, ini) : -1;
  if (j > 0 && j - ini < 1500) {
    s = s.slice(0, j) + 'const highlightsData = await (await import("./destaquesAuto")).destaquesDaTurma(input.classId, await db.getAllHighlights());' + s.slice(j + alvo.length);
    ok("leaderboard.getDataByClass: destaques filtrados pela turma");
  } else pulo("getDataByClass com formato diferente — destaques continuam iguais para todas as turmas");
  return s;
});

rel.push("client/src/pages/Admin.tsx");
editar("client/src/pages/Admin.tsx", (s) => {
  if (s.includes("<DestaquesAutomaticos")) { pulo("já aplicado"); return s; }
  const uso = /<HighlightsManager password=\{password\} \/>/;
  if (!uso.test(s)) { falha("<HighlightsManager password={password} /> não encontrado — nada alterado"); return s; }
  s = s.replace(uso, "<DestaquesAutomaticos password={password} />");
  const primeiraImport = s.indexOf("import ");
  s = s.slice(0, primeiraImport) + 'import DestaquesAutomaticos from "@/components/DestaquesAutomaticos";\n' + s.slice(primeiraImport);
  ok("aba Destaques agora é automática (formulários manuais removidos da tela)");
  return s;
});

console.log("\nResultado da v16:\n" + rel.join("\n") + "\n\nConfira: git diff --stat   (desfazer: git checkout -- client server)\n");
