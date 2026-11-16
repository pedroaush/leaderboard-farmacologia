import { router, publicProcedure } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as db from "../db";
import { gerarSemanaConcluida, iniciarAgendadorDestaques, situacao, garantirTabelas } from "../destaquesAuto";

async function autorizar(password: string) {
  const senhaSalva = await db.getSetting("admin_password");
  if (password === (senhaSalva || "farmaco2026")) return;
  const professor = await db.getTeacherAccountBySessionToken(password).catch(() => null);
  if (professor) return;
  throw new TRPCError({ code: "FORBIDDEN", message: "Não autorizado" });
}

export const destaquesAutoRouter = router({
  situacao: publicProcedure
    .input(z.object({ password: z.string() }))
    .query(async ({ input }) => { await autorizar(input.password); return situacao(); }),

  /** Lista dos destaques com a turma de cada um (painel do professor). */
  lista: publicProcedure
    .input(z.object({ password: z.string() }))
    .query(async ({ input }) => {
      await autorizar(input.password);
      await garantirTabelas();
      const raw: any = await (db as any).getRawDb();
      const [linhas] = await raw.execute("SELECT id, classId, week, date, activity, description, topTeam, topStudent FROM weeklyHighlights ORDER BY week DESC, id DESC");
      return linhas as any[];
    }),

  /** Gera agora a semana que terminou (ou refaz uma semana, com forcar). */
  gerar: publicProcedure
    .input(z.object({ password: z.string(), classId: z.number().optional(), semana: z.number().int().min(1).max(30).optional(), forcar: z.boolean().optional() }))
    .mutation(async ({ input }) => {
      await autorizar(input.password);
      return gerarSemanaConcluida({ classId: input.classId, semana: input.semana, forcar: input.forcar });
    }),
});

iniciarAgendadorDestaques();
