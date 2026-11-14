#!/usr/bin/env node
/**
 * trazer_logos.mjs — traz para dentro do site as imagens que hoje vêm de
 * servidores externos (CDN antigo do Manus: *.cloudfront.net / manuscdn),
 * como os logotipos dos parceiros acadêmicos da página inicial.
 *
 * Para cada imagem externa encontrada em client/:
 *   1. baixa para client/public/logos/
 *   2. troca o endereço no código por /logos/<arquivo>
 * Se o download falhar (link expirado), o endereço NÃO é trocado e o relatório
 * diz qual arquivo você precisa colocar manualmente em client/public/logos/.
 *
 *   Rodar na raiz do projeto:  node trazer_logos.mjs
 *   Só listar, sem mudar nada: node trazer_logos.mjs --ver
 */
import fs from "node:fs";
import path from "node:path";

const SO_VER = process.argv.includes("--ver");
const HOSTS = /(cloudfront\.net|manuscdn\.com|manus\.(im|space|computer)|manus-[\w-]+\.)/i;
const RE_URL = /https?:\/\/[^\s"'`)<>]+?\.(?:png|jpe?g|webp|svg|gif)(?:\?[^\s"'`)<>]*)?(?=["'`)\s<>])/gi;
const DESTINO = "client/public/logos";

function varrer(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", "dist", "public"].includes(e.name) || e.name.startsWith(".")) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) varrer(p, out);
    else if (/\.(tsx?|jsx?|html|css)$/.test(e.name)) out.push(p);
  }
  return out;
}

const arquivos = varrer("client");
const usos = new Map(); // url -> [arquivos]
for (const p of arquivos) {
  const s = fs.readFileSync(p, "utf8");
  for (const u of s.match(RE_URL) || []) {
    if (!HOSTS.test(u)) continue;
    if (!usos.has(u)) usos.set(u, new Set());
    usos.get(u).add(p);
  }
}

if (!usos.size) {
  console.log("\nNenhuma imagem em CDN externo encontrada em client/. Mande o print do Console (F12) com os erros das imagens.\n");
  process.exit(0);
}

console.log(`\n${usos.size} imagem(ns) externa(s) encontrada(s):\n`);
const nomesUsados = new Set();
function nomeLocal(u) {
  let base = decodeURIComponent(u.split("?")[0].split("/").pop() || "imagem.png")
    .normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "_");
  let n = base, i = 2;
  while (nomesUsados.has(n.toLowerCase())) n = base.replace(/(\.\w+)$/, `-${i++}$1`);
  nomesUsados.add(n.toLowerCase());
  return n;
}

const trocas = new Map();
const faltam = [];
if (!SO_VER) fs.mkdirSync(DESTINO, { recursive: true });
for (const [u, onde] of usos) {
  const nome = nomeLocal(u);
  const lista = [...onde].map((p) => p.replace(/\\/g, "/")).join(", ");
  if (SO_VER) { console.log(`  • ${nome}\n      ${u}\n      usado em: ${lista}`); continue; }
  try {
    const r = await fetch(u, { signal: AbortSignal.timeout(20000) });
    const tipo = r.headers.get("content-type") || "";
    if (!r.ok || !/image|octet-stream/.test(tipo)) throw new Error(`HTTP ${r.status} ${tipo}`);
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < 100) throw new Error("arquivo vazio");
    fs.writeFileSync(path.join(DESTINO, nome), buf);
    trocas.set(u, `/logos/${nome}`);
    console.log(`  ✔ ${nome} (${Math.round(buf.length / 1024)} KB) — usado em: ${lista}`);
  } catch (e) {
    faltam.push({ nome, u, lista, erro: e.message });
    console.log(`  ✘ ${nome} — NÃO baixou (${e.message})\n      ${u}\n      usado em: ${lista}`);
  }
}

if (!SO_VER && trocas.size) {
  for (const p of arquivos) {
    const original = fs.readFileSync(p, "utf8");
    let s = original;
    for (const [u, local] of trocas) s = s.split(u).join(local);
    if (s !== original) { fs.writeFileSync(p, s); console.log(`  ✎ ${p.replace(/\\/g, "/")}: endereços trocados para /logos/`); }
  }
}

if (faltam.length) {
  console.log(`\n⚠ ${faltam.length} imagem(ns) com link expirado. Coloque o logotipo correto em ${DESTINO}/ com o nome indicado`);
  console.log(`  e troque no código o endereço antigo por /logos/<nome>. Arquivos:`);
  for (const f of faltam) console.log(`    - ${f.nome}   (em ${f.lista})`);
}
console.log("\nConfira: git status   (desfazer: git checkout -- client  e apague client/public/logos)\n");
