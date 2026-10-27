#!/usr/bin/env node
/**
 * aplicar_v12.mjs — aumenta o limite do arquivo dos casos clínicos (portal dos monitores).
 * Antes: ~2 MB (fileBase64 <= 2.800.000 caracteres).  Depois: até ~25 MB
 * (ou ~11 MB se a coluna do banco for MEDIUMTEXT).
 *
 *   Rodar na raiz do projeto:  node aplicar_v12.mjs
 */
import fs from "node:fs";
import path from "node:path";

const rel = [];
const ok = (m) => rel.push("  ✔ " + m);
const pulo = (m) => rel.push("  • " + m);
const falha = (m) => rel.push("  ✘ " + m);

function ler(p) { const o = fs.readFileSync(p, "utf8"); return { crlf: o.includes("\r\n"), s: o.replace(/\r\n/g, "\n") }; }
function gravar(p, crlf, s) { fs.writeFileSync(p, crlf ? s.replace(/\n/g, "\r\n") : s); }
function varrer(dir, filtro, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name.startsWith(".")) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) varrer(p, filtro, out); else if (filtro(p)) out.push(p);
  }
  return out;
}

// ── 1) Tipo da coluna no banco → define o limite seguro
rel.push("Banco (coluna fileBase64 dos casos)");
let maxChars = 16_000_000, mbArquivo = 11;
const esquemas = varrer("drizzle", (p) => p.endsWith(".ts")).concat(varrer("server", (p) => /schema/i.test(p) && p.endsWith(".ts")));
let tipo = null;
for (const p of esquemas) {
  const { s } = ler(p);
  const i = s.indexOf("casosClinicosArquivos");
  if (i < 0) continue;
  const bloco = s.slice(i, i + 2500);
  const m = bloco.match(/fileBase64\s*:\s*(\w+)\(/);
  if (m) { tipo = m[1].toLowerCase(); pulo(`${p.replace(/\\/g, "/")}: fileBase64 é ${m[1]}`); break; }
}
if (tipo === "longtext") { maxChars = 34_000_000; mbArquivo = 25; ok("LONGTEXT → limite de ~25 MB por arquivo"); }
else if (tipo === "mediumtext") ok("MEDIUMTEXT → limite de ~11 MB por arquivo");
else if (tipo === "text") { maxChars = 2_800_000; falha("coluna é TEXT (64 KB) — não dá para aumentar sem migração; mande o schema"); }
else pulo("tipo da coluna não identificado — usando limite seguro de ~11 MB");

// ── 2) Validação do servidor (zod)
rel.push("server/routers/casosClinicos.ts");
const rota = varrer("server", (p) => p.endsWith(".ts") && fs.readFileSync(p, "utf8").includes("publicarArquivo"))[0];
if (!rota) falha("rota publicarArquivo não encontrada");
else {
  const { crlf, s } = ler(rota);
  const re = /(fileBase64\s*:\s*z\.string\(\)\.min\(1\)\.max\()([\d_]+)(\))[^\n]*/;
  const m = s.match(re);
  if (!m) falha("validação do fileBase64 com formato diferente");
  else if (Number(m[2].replace(/_/g, "")) >= maxChars) pulo(`limite já é ${m[2]}`);
  else {
    const novo = s.replace(re, `$1${maxChars.toLocaleString("en").replace(/,/g, "_")}$3, // ~${mbArquivo} MB de arquivo real`);
    gravar(rota, crlf, novo);
    ok(`${rota.replace(/\\/g, "/")}: limite ${m[2]} → ${maxChars} caracteres (~${mbArquivo} MB)`);
  }
}

// ── 3) Limite do corpo da requisição no Express
rel.push("Express (tamanho máximo da requisição)");
const idx = ["server/_core/index.ts", "server/index.ts"].find((p) => fs.existsSync(p));
if (!idx) falha("server/_core/index.ts não encontrado");
else {
  let { crlf, s } = ler(idx);
  let mudou = false;
  s = s.replace(/express\.(json|urlencoded)\(\s*\{([^}]*)\}\s*\)/g, (m, f, dentro) => {
    const lim = dentro.match(/limit\s*:\s*["'](\d+)\s*mb["']/i);
    if (lim && Number(lim[1]) >= 50) return m;
    mudou = true;
    if (lim) return m.replace(/limit\s*:\s*["'][^"']*["']/, 'limit: "50mb"');
    return `express.${f}({${dentro.trim() ? " " + dentro.trim() + "," : ""} limit: "50mb" })`;
  });
  s = s.replace(/express\.json\(\s*\)/g, () => { mudou = true; return 'express.json({ limit: "50mb" })'; });
  if (mudou) { gravar(idx, crlf, s); ok(`${idx}: limite do corpo → 50mb`); }
  else pulo("limite do corpo já é 50mb ou maior");
}

// ── 4) Telas que ainda avisam "2 MB"
rel.push("Portal dos monitores (cliente)");
const telas = varrer("client/src", (p) => /\.tsx?$/.test(p) && fs.readFileSync(p, "utf8").includes("publicarArquivo"));
if (!telas.length) pulo("nenhuma tela com publicarArquivo encontrada");
for (const p of telas) {
  let { crlf, s } = ler(p);
  const antes = s;
  s = s.replace(/\b2\s*\*\s*1024\s*\*\s*1024\b/g, `${mbArquivo} * 1024 * 1024`)
       .replace(/\b2_?097_?152\b/g, `${mbArquivo} * 1024 * 1024`)
       .replace(/(m[áa]x(?:imo)?\.?\s*:?\s*)2\s*MB/gi, `$1${mbArquivo} MB`)
       .replace(/(at[ée]\s+)2\s*MB/gi, `$1${mbArquivo} MB`);
  if (s !== antes) { gravar(p, crlf, s); ok(`${p.replace(/\\/g, "/")}: aviso/limite de 2 MB → ${mbArquivo} MB`); }
  else pulo(`${p.replace(/\\/g, "/")}: sem limite de 2 MB no cliente`);
}

console.log("\nResultado da v12:\n" + rel.join("\n") + "\n\nConfira: git diff --stat   (desfazer: git checkout -- client server)\n");
