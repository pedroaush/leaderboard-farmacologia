import { router, publicProcedure } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as db from "../db";
import {
  chavePublicaPush, pushConfigurado, salvarInscricao, removerInscricao, enviarPush, contarInscritos,
} from "../push";

async function exigirProfessor(password: string) {
  const senhaSalva = await db.getSetting("admin_password");
  if (password === (senhaSalva || "farmaco2026")) return;
  const professor = await db.getTeacherAccountBySessionToken(password).catch(() => null);
  if (professor) return;
  throw new TRPCError({ code: "FORBIDDEN", message: "Não autorizado" });
}

export const notificacoesRouter = router({
  /** Chave pública usada pelo navegador para criar a inscrição. */
  chavePublica: publicProcedure.query(() => ({
    chave: chavePublicaPush(),
    ativo: pushConfigurado(),
  })),

  /** Aluno ativa as notificações neste aparelho. */
  inscrever: publicProcedure
    .input(z.object({
      sessionToken: z.string(),
      endpoint: z.string().url().max(700),
      p256dh: z.string().max(255),
      auth: z.string().max(255),
      userAgent: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const conta = await db.getStudentAccountBySessionToken(input.sessionToken);
      if (!conta) throw new TRPCError({ code: "UNAUTHORIZED", message: "Faça login novamente." });
      const raw = await db.getRawDb();
      const [rows] = await raw!.execute(`SELECT classId FROM \`members\` WHERE id = ? LIMIT 1`, [conta.memberId]);
      const classId = (rows as any[])[0]?.classId ?? null;
      await salvarInscricao({
        memberId: conta.memberId,
        classId,
        endpoint: input.endpoint,
        p256dh: input.p256dh,
        auth: input.auth,
        userAgent: input.userAgent,
      });
      // Confirmação imediata: o aluno vê que funcionou
      enviarPush(
        { title: "Notificações ativadas ✅", body: "Você será avisado quando houver material novo.", url: "/aluno/{classId}?tab=materiais", tag: "boas-vindas" },
        { memberId: conta.memberId }
      ).catch(() => {});
      return { success: true };
    }),

  desinscrever: publicProcedure
    .input(z.object({ endpoint: z.string() }))
    .mutation(async ({ input }) => {
      await removerInscricao(input.endpoint);
      return { success: true };
    }),

  /** Professor: quantos aparelhos inscritos por turma. */
  resumo: publicProcedure
    .input(z.object({ password: z.string() }))
    .query(async ({ input }) => {
      await exigirProfessor(input.password);
      return { ativo: pushConfigurado(), porTurma: await contarInscritos() };
    }),

  /** Professor: aviso manual (ex.: "Prova adiada"). */
  enviarAviso: publicProcedure
    .input(z.object({
      password: z.string(),
      title: z.string().min(1).max(80),
      body: z.string().min(1).max(200),
      classId: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      await exigirProfessor(input.password);
      if (!pushConfigurado()) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Notificações não configuradas (VAPID_* no Railway)." });
      return enviarPush({ title: input.title, body: input.body, url: "/aluno/{classId}", tag: "aviso" }, input.classId ? { classId: input.classId } : undefined);
    }),
});
