import type { Express } from "express";
import { r2Configurado, r2UrlDeLeitura } from "./storageR2";

/**
 * GET /api/r2/arquivo?k=materiais/...&nome=Aula.pdf&abrir=1
 * Redireciona para um endereço temporário (1 h) do arquivo no R2.
 * Assim o campo "url" do material funciona como um link comum (abrir/baixar),
 * sem expor endereços permanentes do bucket.
 *
 * Registrar em server/_core/index.ts, antes do tRPC:
 *   import { registrarRotaR2 } from "../rotaR2";
 *   registrarRotaR2(app);
 */
export function registrarRotaR2(app: Express) {
  app.get("/api/r2/arquivo", async (req, res) => {
    try {
      const chave = String(req.query.k || "");
      if (!r2Configurado()) return res.status(503).send("Armazenamento não configurado");
      if (!chave.startsWith("materiais/") || chave.includes("..")) return res.status(400).send("Arquivo inválido");
      const nome = req.query.nome ? String(req.query.nome) : undefined;
      const url = await r2UrlDeLeitura(chave, nome, req.query.abrir === "1");
      res.redirect(302, url);
    } catch (e) {
      console.error("[R2] erro ao gerar link:", e);
      res.status(500).send("Erro ao abrir o arquivo");
    }
  });
}
