import { router, publicProcedure } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, desc } from "drizzle-orm";
import { getDb, getTeacherAccountBySessionToken, getStudentAccountBySessionToken } from "../db";
import {
  simulacoesClinicas,
  simulacoesClinicasProgresso,
  members,
  classes,
} from "../../drizzle/schema";

/**
 * Casos Clínicos — Prática Simulada
 *
 * Simulações HTML interativas (tipo o caso GLP-1/gastroparesia) que o
 * professor sobe uma vez, e os alunos jogam sozinhos, com progresso
 * registrado via postMessage do iframe. Cada simulação tem 2 chaves
 * independentes que o professor liga/desliga: "conta como nota" e "conta
 * como frequência" — o registro sempre acontece, essas chaves só marcam a
 * INTENÇÃO de uso, pra aparecer nos relatórios certos.
 */

async function autenticarProfessor(sessionToken: string) {
  const teacher = await getTeacherAccountBySessionToken(sessionToken);
  if (!teacher) throw new TRPCError({ code: "FORBIDDEN", message: "Token inválido" });
  return teacher;
}

export const simulacoesClinicasRouter = router({
  // ─── PROFESSOR/ADMIN: criar uma nova simulação ───
  criar: publicProcedure
    .input(z.object({
      sessionToken: z.string(),
      titulo: z.string().min(1).max(300),
      descricao: z.string().optional(),
      htmlConteudo: z.string().min(1),
      classIds: z.array(z.number()).optional(), // vazio/omitido = todas as turmas
      contaComoNota: z.boolean().default(false),
      contaComoFrequencia: z.boolean().default(false),
      pontuacaoMaxima: z.number().default(5),
    }))
    .mutation(async ({ input }) => {
      const teacher = await autenticarProfessor(input.sessionToken);
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const res = await db.insert(simulacoesClinicas).values({
        titulo: input.titulo,
        descricao: input.descricao,
        htmlConteudo: input.htmlConteudo,
        classIds: input.classIds && input.classIds.length > 0 ? JSON.stringify(input.classIds) : null,
        contaComoNota: input.contaComoNota,
        contaComoFrequencia: input.contaComoFrequencia,
        pontuacaoMaxima: input.pontuacaoMaxima,
        createdBy: teacher.id,
        createdByName: teacher.name,
      });
      return { success: true };
    }),

  // ─── PROFESSOR/ADMIN: editar configurações (não o HTML, só metadados) ───
  atualizar: publicProcedure
    .input(z.object({
      sessionToken: z.string(),
      id: z.number(),
      titulo: z.string().min(1).max(300).optional(),
      descricao: z.string().optional(),
      classIds: z.array(z.number()).optional(),
      contaComoNota: z.boolean().optional(),
      contaComoFrequencia: z.boolean().optional(),
      pontuacaoMaxima: z.number().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      await autenticarProfessor(input.sessionToken);
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const { sessionToken, id, classIds, ...resto } = input;
      const updateData: any = { ...resto };
      if (classIds !== undefined) {
        updateData.classIds = classIds.length > 0 ? JSON.stringify(classIds) : null;
      }
      await db.update(simulacoesClinicas).set(updateData).where(eq(simulacoesClinicas.id, id));
      return { success: true };
    }),

  // ─── PROFESSOR/ADMIN: remover (soft-delete, isActive=false) ───
  remover: publicProcedure
    .input(z.object({ sessionToken: z.string(), id: z.number() }))
    .mutation(async ({ input }) => {
      await autenticarProfessor(input.sessionToken);
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.update(simulacoesClinicas).set({ isActive: false }).where(eq(simulacoesClinicas.id, input.id));
      return { success: true };
    }),

  // ─── PROFESSOR/ADMIN: listar todas (com contagem de progresso) ───
  listarTodas: publicProcedure
    .input(z.object({ sessionToken: z.string() }))
    .query(async ({ input }) => {
      await autenticarProfessor(input.sessionToken);
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const todas = await db.select({
        id: simulacoesClinicas.id,
        titulo: simulacoesClinicas.titulo,
        descricao: simulacoesClinicas.descricao,
        classIds: simulacoesClinicas.classIds,
        contaComoNota: simulacoesClinicas.contaComoNota,
        contaComoFrequencia: simulacoesClinicas.contaComoFrequencia,
        pontuacaoMaxima: simulacoesClinicas.pontuacaoMaxima,
        isActive: simulacoesClinicas.isActive,
        createdByName: simulacoesClinicas.createdByName,
        createdAt: simulacoesClinicas.createdAt,
      }).from(simulacoesClinicas).where(eq(simulacoesClinicas.isActive, true)).orderBy(desc(simulacoesClinicas.createdAt));

      return Promise.all(todas.map(async (s) => {
        const progressos = await db.select().from(simulacoesClinicasProgresso).where(eq(simulacoesClinicasProgresso.simulacaoId, s.id));
        return {
          ...s,
          classIds: s.classIds ? JSON.parse(s.classIds) : null,
          totalIniciaram: progressos.length,
          totalConcluiram: progressos.filter((p: any) => p.completed).length,
        };
      }));
    }),

  // ─── PROFESSOR: ver o progresso detalhado de uma simulação (pra nota/frequência) ───
  verProgressoDetalhado: publicProcedure
    .input(z.object({ sessionToken: z.string(), simulacaoId: z.number() }))
    .query(async ({ input }) => {
      await autenticarProfessor(input.sessionToken);
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const progressos = await db.select().from(simulacoesClinicasProgresso)
        .where(eq(simulacoesClinicasProgresso.simulacaoId, input.simulacaoId))
        .orderBy(desc(simulacoesClinicasProgresso.completedAt));

      return Promise.all(progressos.map(async (p: any) => {
        const memberRows = await db.select().from(members).where(eq(members.id, p.memberId)).limit(1);
        return { ...p, memberName: memberRows[0]?.name || `Aluno #${p.memberId}` };
      }));
    }),

  // ─── ALUNO: listar simulações disponíveis pra turma dele ───
  listarDisponiveis: publicProcedure
    .input(z.object({ sessionToken: z.string(), classId: z.number() }))
    .query(async ({ input }) => {
      const aluno = await getStudentAccountBySessionToken(input.sessionToken);
      if (!aluno) throw new TRPCError({ code: "FORBIDDEN", message: "Token inválido" });
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const todas = await db.select({
        id: simulacoesClinicas.id,
        titulo: simulacoesClinicas.titulo,
        descricao: simulacoesClinicas.descricao,
        classIds: simulacoesClinicas.classIds,
        pontuacaoMaxima: simulacoesClinicas.pontuacaoMaxima,
      }).from(simulacoesClinicas).where(eq(simulacoesClinicas.isActive, true)).orderBy(desc(simulacoesClinicas.createdAt));

      const paraTurma = todas.filter((s: any) => {
        if (!s.classIds) return true; // sem classIds = todas as turmas
        const ids: number[] = JSON.parse(s.classIds);
        return ids.includes(input.classId);
      });

      // Junta com o progresso do próprio aluno, se existir
      const member = aluno.memberId ? await db.select().from(members).where(eq(members.id, aluno.memberId)).limit(1) : [];
      const memberId = member[0]?.id;

      return Promise.all(paraTurma.map(async (s: any) => {
        let meuProgresso = null;
        if (memberId) {
          const rows = await db.select().from(simulacoesClinicasProgresso)
            .where(and(eq(simulacoesClinicasProgresso.simulacaoId, s.id), eq(simulacoesClinicasProgresso.memberId, memberId)))
            .limit(1);
          meuProgresso = rows[0] || null;
        }
        return {
          id: s.id, titulo: s.titulo, descricao: s.descricao, pontuacaoMaxima: s.pontuacaoMaxima,
          completado: meuProgresso?.completed || false,
          meuScore: meuProgresso?.score ?? null,
        };
      }));
    }),

  // ─── ALUNO: abrir uma simulação (busca o HTML pra embutir) ───
  abrir: publicProcedure
    .input(z.object({ sessionToken: z.string(), simulacaoId: z.number() }))
    .query(async ({ input }) => {
      const aluno = await getStudentAccountBySessionToken(input.sessionToken);
      const professor = aluno ? null : await getTeacherAccountBySessionToken(input.sessionToken);
      if (!aluno && !professor) throw new TRPCError({ code: "FORBIDDEN", message: "Token inválido" });
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const rows = await db.select().from(simulacoesClinicas)
        .where(and(eq(simulacoesClinicas.id, input.simulacaoId), eq(simulacoesClinicas.isActive, true))).limit(1);
      if (!rows.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Simulação não encontrada" });

      return { titulo: rows[0].titulo, htmlConteudo: rows[0].htmlConteudo };
    }),

  // ─── ALUNO: registrar progresso (chamado quando o iframe manda postMessage) ───
  registrarProgresso: publicProcedure
    .input(z.object({
      sessionToken: z.string(),
      simulacaoId: z.number(),
      classId: z.number(),
      currentStep: z.number(),
      completedSteps: z.number(),
      totalSteps: z.number(),
      score: z.number(),
      maxScore: z.number(),
      completed: z.boolean(),
    }))
    .mutation(async ({ input }) => {
      const aluno = await getStudentAccountBySessionToken(input.sessionToken);
      if (!aluno) throw new TRPCError({ code: "FORBIDDEN", message: "Token inválido" });
      if (!aluno.memberId) throw new TRPCError({ code: "BAD_REQUEST", message: "Conta sem aluno vinculado" });
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const existente = await db.select().from(simulacoesClinicasProgresso)
        .where(and(eq(simulacoesClinicasProgresso.simulacaoId, input.simulacaoId), eq(simulacoesClinicasProgresso.memberId, aluno.memberId)))
        .limit(1);

      const dados = {
        currentStep: input.currentStep,
        completedSteps: input.completedSteps,
        totalSteps: input.totalSteps,
        score: input.score,
        maxScore: input.maxScore,
        completed: input.completed,
        completedAt: input.completed ? new Date() : undefined,
      };

      if (existente.length > 0) {
        await db.update(simulacoesClinicasProgresso).set(dados).where(eq(simulacoesClinicasProgresso.id, existente[0].id));
      } else {
        await db.insert(simulacoesClinicasProgresso).values({
          simulacaoId: input.simulacaoId,
          memberId: aluno.memberId,
          classId: input.classId,
          ...dados,
        });
      }
      return { success: true };
    }),
});