import { router, publicProcedure } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as db from "../db";
import { R2_PREFIXO, R2_TAMANHO_MAXIMO, r2Configurado, r2NovaChave, r2UrlDeEnvio } from "../storageR2";

/**
 * Upload de materiais grandes (até 250 MB) direto do navegador para o R2.
 *  1. pedirEnvio  -> o servidor devolve um endereço assinado (15 min)
 *  2. o navegador envia o arquivo direto para esse endereço (PUT)
 *  3. confirmar   -> o servidor cria o material, como os demais
 *
 * Autorização: a mesma do painel Admin (senha de administrador),
 * ou o token de sessão de professor.
 */
const TIPOS_PERMITIDOS = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/jpeg", "image/png",
  "video/mp4",
];

async function autorizar(password: string) {
  const senhaSalva = await db.getSetting("admin_password");
  const senhaCorreta = senhaSalva || "farmaco2026"; // mesma regra de verifyAdminPassword em routers.ts
  if (password === senhaCorreta) return;
  const professor = await db.getTeacherAccountBySessionToken(password).catch(() => null);
  if (professor) return;
  throw new TRPCError({ code: "FORBIDDEN", message: "Não autorizado" });
}

export const materiaisGrandesRouter = router({
  pedirEnvio: publicProcedure
    .input(z.object({
      password: z.string(),
      fileName: z.string().min(1).max(300),
      mimeType: z.string(),
      tamanho: z.number().int().positive(),
    }))
    .mutation(async ({ input }) => {
      await autorizar(input.password);
      if (!r2Configurado()) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Armazenamento R2 não configurado no servidor (variáveis R2_* no Railway)." });
      }
      if (input.tamanho > R2_TAMANHO_MAXIMO) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Arquivo com ${(input.tamanho / 1048576).toFixed(1)} MB; o limite é 250 MB.` });
      }
      if (!TIPOS_PERMITIDOS.includes(input.mimeType)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Tipo de arquivo não permitido (PDF, Word, Excel, PowerPoint, JPG, PNG ou MP4)." });
      }
      const chave = r2NovaChave("materiais", input.fileName);
      const uploadUrl = await r2UrlDeEnvio(chave, input.mimeType, input.tamanho);
      return { uploadUrl, fileKey: R2_PREFIXO + chave };
    }),

  confirmar: publicProcedure
    .input(z.object({
      password: z.string(),
      fileKey: z.string().startsWith(R2_PREFIXO + "materiais/"),
      fileName: z.string(),
      mimeType: z.string(),
      title: z.string().min(1),
      description: z.string().optional(),
      module: z.string().default("Geral"),
      week: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      await autorizar(input.password);
      const chave = input.fileKey.slice(R2_PREFIXO.length);
      const url = `/api/r2/arquivo?k=${encodeURIComponent(chave)}&nome=${encodeURIComponent(input.fileName)}`;
      const id = await db.createMaterial({
        title: input.title,
        description: input.description,
        type: "file",
        url,
        fileKey: input.fileKey,
        fileName: input.fileName,
        mimeType: input.mimeType,
        module: input.module,
        week: input.week,
      });
      return { id, url };
    }),
});