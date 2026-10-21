#!/usr/bin/env node
/**
 * aplicar_v10.mjs — corrige o download dos materiais enviados pelo R2
 * (arquivos grandes). A rota materials.getDownloadUrl mandava esses arquivos
 * para o proxy do Cloudinary, que não os conhece → "Não foi possível baixar".
 *   Rodar na raiz do projeto:  node aplicar_v10.mjs
 */
import fs from "node:fs";
const caminho = "server/routers.ts";
const original = fs.readFileSync(caminho, "utf8");
const crlf = original.includes("\r\n");
let s = original.replace(/\r\n/g, "\n");
if (s.includes("// R2: arquivos grandes")) { console.log("• já aplicado"); process.exit(0); }
const ini = s.indexOf("getDownloadUrl: publicProcedure");
if (ini < 0) { console.log("✘ getDownloadUrl não encontrado — nada alterado"); process.exit(1); }
const ancora = ".query(async ({ input }) => {\n";
const pos = s.indexOf(ancora, ini);
if (pos < 0 || pos - ini > 400) { console.log("✘ formato inesperado em getDownloadUrl — nada alterado"); process.exit(1); }
const ind = "        ";
const bloco =
  `${ind}// R2: arquivos grandes (fileKey "r2:...") não estão no Cloudinary\n` +
  `${ind}if (input.fileKey.startsWith("r2:")) {\n` +
  `${ind}  const chave = input.fileKey.slice(3);\n` +
  `${ind}  const mat: any = (await db.getAllMaterials()).find((m: any) => m.fileKey === input.fileKey);\n` +
  `${ind}  const nome = mat?.fileName ? \`&nome=\${encodeURIComponent(mat.fileName)}\` : "";\n` +
  `${ind}  return { url: \`/api/r2/arquivo?k=\${encodeURIComponent(chave)}\${nome}\` };\n` +
  `${ind}}\n`;
s = s.slice(0, pos + ancora.length) + bloco + s.slice(pos + ancora.length);
fs.writeFileSync(caminho, crlf ? s.replace(/\n/g, "\r\n") : s);
console.log("✔ download de arquivos do R2 corrigido em materials.getDownloadUrl");
