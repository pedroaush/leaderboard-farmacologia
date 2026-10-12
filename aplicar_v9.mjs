#!/usr/bin/env node
/**
 * aplicar_v9.mjs — registra a página /minhas-provas (botão "Provas e Notas").
 *   Rodar na raiz do projeto:  node aplicar_v9.mjs
 */
import fs from "node:fs";
const caminho = "client/src/App.tsx";
if (!fs.existsSync(caminho)) { console.log("✘ " + caminho + " não encontrado"); process.exit(1); }
const original = fs.readFileSync(caminho, "utf8");
const crlf = original.includes("\r\n");
let s = original.replace(/\r\n/g, "\n");
if (s.includes("MinhasProvas")) { console.log("• já aplicado"); process.exit(0); }

const imp = /import CorrecaoCartao from (["'])([^"']*)CorrecaoCartao\1;\n/;
if (!imp.test(s)) { console.log("✘ import do CorrecaoCartao não encontrado — nada alterado"); process.exit(1); }
s = s.replace(imp, (m, q, base) => m + `import MinhasProvas from ${q}${base}MinhasProvas${q};\n`);

const rota = /\n(\s*)<Route path="\/(avisos|leaderboard|correcao)"/;
const m = s.match(rota);
if (!m) { console.log("✘ lista de rotas não encontrada — nada alterado"); process.exit(1); }
s = s.replace(rota, `\n${m[1]}<Route path="/minhas-provas" component={MinhasProvas} />` + m[0]);

fs.writeFileSync(caminho, crlf ? s.replace(/\n/g, "\r\n") : s);
console.log('✔ rota /minhas-provas registrada (botão "Provas e Notas")');
