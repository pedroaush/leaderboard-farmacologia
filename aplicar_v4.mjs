#!/usr/bin/env node
/**
 * aplicar_v4.mjs — troca a aba "Provas" do Painel Admin pela central nova
 * (correção por QR). A tela antiga continua acessível, recolhida no fim.
 *
 *   Rodar na raiz do projeto:  node aplicar_v4.mjs
 *   Desfazer (antes do commit): git checkout -- client/src/pages/Admin.tsx
 */
import fs from "node:fs";

const caminho = "client/src/pages/Admin.tsx";
if (!fs.existsSync(caminho)) { console.log("✘ " + caminho + " não encontrado — rode na raiz do projeto"); process.exit(1); }
const original = fs.readFileSync(caminho, "utf8");
const crlf = original.includes("\r\n");
let s = original.replace(/\r\n/g, "\n");

if (s.includes("<ProvasHub")) { console.log("• já aplicado"); process.exit(0); }

const imp = 'import ExamToolsManager from "@/components/ExamToolsManager";\n';
if (!s.includes(imp)) { console.log("✘ import do ExamToolsManager não encontrado — nada alterado"); process.exit(1); }
s = s.replace(imp, imp + 'import ProvasHub from "@/components/ProvasHub";\n');

const bloco = /\{activeSection === "provas" && teacherToken && \(\n(\s*)<ExamToolsManager([\s\S]*?)\/>\n(\s*)\)\}/;
const m = s.match(bloco);
if (!m) { console.log("✘ bloco da aba Provas não encontrado — nada alterado"); process.exit(1); }
const [inteiro, ind, props, indFim] = m;
const novo =
  `{activeSection === "provas" && teacherToken && (\n` +
  `${ind}<ProvasHub\n${ind}  teacherToken={teacherToken}\n${ind}  legado={\n` +
  `${ind}    <ExamToolsManager${props.replace(/\n/g, "\n    ")}/>\n` +
  `${ind}  }\n${ind}/>\n${indFim})}`;
s = s.replace(inteiro, novo);

fs.writeFileSync(caminho, crlf ? s.replace(/\n/g, "\r\n") : s);
console.log("✔ Aba Provas trocada pela central de correção por QR (tela antiga recolhida no fim da página)");
