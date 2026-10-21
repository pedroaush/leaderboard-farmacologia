import type { Express, Request, Response, NextFunction } from "express";
import { Readable } from "node:stream";
import { r2Configurado, r2Obter } from "./storageR2";

/**
 * Downloads dos materiais guardados no R2 (arquivos grandes).
 *
 * O servidor REPASSA o arquivo ao navegador (mesmo endereço do site), em vez de
 * redirecionar para o Cloudflare. Assim o download funciona em qualquer botão da
 * plataforma — inclusive os que baixam via JavaScript, que falhavam ao seguir
 * o redirecionamento para outro domínio.
 *
 *   GET /api/r2/arquivo?k=materiais/...&nome=Aula.pptx[&abrir=1]
 *   GET /api/materials/download?fileKey=r2:materiais/...   (rota antiga da página Materiais)
 *
 * Registrar em server/_core/index.ts:  registrarRotaR2(app);
 */
const TIPOS: Record<string, string> = {
  pdf: "application/pdf",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", mp4: "video/mp4",
};

async function enviarArquivo(chave: string, nome: string | undefined, abrir: boolean, req: Request, res: Response) {
  if (!r2Configurado()) return res.status(503).send("Armazenamento não configurado");
  if (!chave.startsWith("materiais/") || chave.includes("..")) return res.status(400).send("Arquivo inválido");
  const nomeFinal = (nome || chave.split("/").pop() || "arquivo").replace(/["\r\n]/g, "");
  const ext = nomeFinal.split(".").pop()?.toLowerCase() || "";
  try {
    const faixa = typeof req.headers.range === "string" ? req.headers.range : undefined;
    const obj: any = await r2Obter(chave, faixa);
    res.status(faixa && obj.ContentRange ? 206 : 200);
    res.setHeader("Content-Type", obj.ContentType && obj.ContentType !== "application/octet-stream" ? obj.ContentType : (TIPOS[ext] || "application/octet-stream"));
    if (obj.ContentLength != null) res.setHeader("Content-Length", String(obj.ContentLength));
    if (obj.ContentRange) res.setHeader("Content-Range", obj.ContentRange);
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", "private, max-age=3600");
    const ascii = nomeFinal.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\x20-\x7E]/g, "_");
    res.setHeader("Content-Disposition", `${abrir ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nomeFinal)}`);
    const corpo: any = obj.Body;
    const fluxo: Readable = typeof corpo?.pipe === "function" ? corpo : Readable.fromWeb(corpo);
    fluxo.on("error", (e) => { console.error("[R2] erro no envio:", e); res.destroy(e); });
    req.on("close", () => fluxo.destroy());
    fluxo.pipe(res);
  } catch (e: any) {
    console.error("[R2] erro ao ler arquivo:", e?.name, e?.message);
    if (!res.headersSent) res.status(e?.name === "NoSuchKey" ? 404 : 500).send(e?.name === "NoSuchKey" ? "Arquivo não encontrado" : "Erro ao baixar o arquivo");
  }
}

/**
 * Move as rotas recém-registradas para antes da PRIMEIRA rota do app (mas depois
 * dos middlewares gerais: query, helmet, compressão...), para que tenham
 * prioridade sobre a rota antiga /api/materials/download.
 */
function priorizar(app: Express, quantas: number) {
  const pilha: any[] | undefined = (app as any)._router?.stack;
  if (!pilha) return;
  const novas = pilha.splice(pilha.length - quantas, quantas);
  const pos = pilha.findIndex((l) => !!l.route);
  pilha.splice(pos < 0 ? pilha.length : pos, 0, ...novas);
}

export function registrarRotaR2(app: Express) {
  app.get("/api/r2/arquivo", (req, res) => {
    void enviarArquivo(String(req.query.k || ""), req.query.nome ? String(req.query.nome) : undefined, req.query.abrir === "1", req, res);
  });
  // Rota antiga usada pela página "Materiais": arquivos do R2 não estão no Cloudinary
  app.get("/api/materials/download", (req: Request, res: Response, next: NextFunction) => {
    const fileKey = String(req.query.fileKey || "");
    if (!fileKey.startsWith("r2:")) return next();
    void enviarArquivo(fileKey.slice(3), req.query.nome ? String(req.query.nome) : undefined, false, req, res);
  });
  priorizar(app, 2);
}
