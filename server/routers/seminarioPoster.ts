import { router, publicProcedure } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and } from "drizzle-orm";
import { getDb, getTeacherAccountBySessionToken } from "../db";
import {
  jigsawHomeGroups,
  jigsawHomeMembers,
  jigsawIntegrationQuestions,
  jigsawIntegrationAnswers,
  seminarioApresentacoes,
  jigsawScores,
  studentAccounts,
  members,
} from "../../drizzle/schema";

/**
 * ============================================================================
 * SEMINÁRIO PÔSTER + QUIZ — fluxo completo com controle de vazamento
 * ============================================================================
 * 1. Grupo escreve 5 perguntas com gabarito -> pending_review
 * 2. Professor revisa (pode AJUSTAR texto/alternativas), aprova -> approved
 *    (ainda invisível para os alunos)
 * 3. Professor libera SÓ DEPOIS que o grupo termina de apresentar
 *    (define a duração da janela de resposta)
 * 4. Durante a janela: alunos respondem; alternativas embaralhadas de forma
 *    DIFERENTE para cada aluno; gabarito nunca revelado durante a janela
 * 5. Ao expirar: todos passam a ver as perguntas com gabarito (estudo)
 * 6. Professor lança nota do grupo por checklist (pôster + perguntas)
 * 7. Nota final de Seminário = combinação da nota do grupo + desempenho
 *    individual — gravada em jigsawScores.totalJigsawPF
 *
 * MODO CONFERÊNCIA: as rotas do aluno também aceitam o token de professor
 * (ou de monitor). Nesse modo, quem está conferindo vê exatamente o que o
 * aluno veria, mas NADA é gravado — nem resposta, nem nota, nem pergunta
 * submetida. Serve para testar o botão Seminário do portal do aluno.
 * ============================================================================
 */
export const PESO_NOTA_GRUPO = 0.5;
export const PESO_NOTA_INDIVIDUAL = 0.5;
export const DURACAO_PADRAO_JANELA_MINUTOS = 5;

export const CRITERIOS_CHECKLIST_PADRAO = [
  "posterClaro",
  "achadoCorreto",
  "relevanciaClinica",
  "perguntasBemFormuladas",
  "gabaritoCorreto",
];

type QuemAcessa =
  | { modo: "aluno"; memberId: number }
  | { modo: "conferencia"; viewerId: number; viewerName: string };

/**
 * Aceita token de aluno (modo normal) OU token de professor/monitor (modo
 * conferência, somente leitura).
 */
async function resolverAlunoOuConferencia(db: any, token: string): Promise<QuemAcessa> {
  const acc = await db.select().from(studentAccounts)
    .where(and(eq(studentAccounts.sessionToken, token), eq(studentAccounts.isActive, 1)))
    .limit(1);

  if (acc.length && acc[0].memberId) {
    return { modo: "aluno", memberId: acc[0].memberId };
  }
  if (acc.length && acc[0].accountType === "monitor") {
    return { modo: "conferencia", viewerId: acc[0].id, viewerName: `${acc[0].displayName || acc[0].email} (monitor)` };
  }

  const teacher = await getTeacherAccountBySessionToken(token);
  if (teacher) {
    return { modo: "conferencia", viewerId: 1_000_000 + teacher.id, viewerName: teacher.name };
  }

  throw new TRPCError({ code: "UNAUTHORIZED", message: "Token inválido" });
}

/**
 * Embaralhamento determinístico: a mesma pessoa vê sempre a mesma ordem para
 * a mesma pergunta (não "pula" a cada atualização da tela), mas pessoas
 * diferentes veem ordens diferentes — continua valendo o controle contra
 * "a resposta é a C".
 */
function embaralharComSemente<T>(arr: T[], semente: number): T[] {
  const copia = [...arr];
  let s = (semente >>> 0) || 1;
  const rand = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

export const seminarioPosterRouter = router({
  submeterPerguntas: publicProcedure
    .input(z.object({
      studentSessionToken: z.string(),
      classId: z.number(),
      groupId: z.number(),
      perguntas: z.array(z.object({
        topico: z.string(),
        enunciado: z.string(),
        alternativas: z.array(z.object({ id: z.string(), texto: z.string(), correta: z.boolean() })).min(2),
        explicacao: z.string().optional(),
      })).min(1),
    }))
    .mutation(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const quem = await resolverAlunoOuConferencia(db, input.studentSessionToken);

        for (const p of input.perguntas) {
          const numCorretas = p.alternativas.filter(a => a.correta).length;
          if (numCorretas !== 1) {
            throw new TRPCError({ code: "BAD_REQUEST", message: `Pergunta "${p.enunciado.slice(0, 40)}..." precisa ter exatamente 1 alternativa correta` });
          }
        }

        // Conferência: valida tudo, mas não grava
        if (quem.modo === "conferencia") {
          return { success: true, quantidade: input.perguntas.length, conferencia: true, message: "Modo conferência — perguntas válidas, mas NÃO foram gravadas" };
        }

        const pertence = await db.select().from(jigsawHomeMembers)
          .where(and(eq(jigsawHomeMembers.homeGroupId, input.groupId), eq(jigsawHomeMembers.memberId, quem.memberId)))
          .limit(1);
        if (!pertence.length) throw new TRPCError({ code: "FORBIDDEN", message: "Você não pertence a este grupo" });

        for (const p of input.perguntas) {
          await db.insert(jigsawIntegrationQuestions).values({
            classId: input.classId, authorGroupId: input.groupId,
            topico: p.topico, enunciado: p.enunciado, alternativas: p.alternativas,
            explicacao: p.explicacao, status: "pending_review",
          });
        }

        return { success: true, quantidade: input.perguntas.length, conferencia: false, message: "Perguntas enviadas para revisão" };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Erro ao enviar perguntas: ${error instanceof Error ? error.message : String(error)}` });
      }
    }),

  getPerguntasPendentes: publicProcedure
    .input(z.object({ sessionToken: z.string(), classId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const teacher = await getTeacherAccountBySessionToken(input.sessionToken);
      if (!teacher) throw new TRPCError({ code: "FORBIDDEN", message: "Token inválido" });

      return db.select().from(jigsawIntegrationQuestions)
        .where(and(eq(jigsawIntegrationQuestions.classId, input.classId), eq(jigsawIntegrationQuestions.status, "pending_review")));
    }),

  // ─── Todas as perguntas da turma, em qualquer status (pending_review, ───
  // ─── approved, rejected) — usado pelo painel do admin para mostrar, por ───
  // ─── grupo, quantas perguntas estão pendentes/aprovadas/liberadas. ───
  getTodasPerguntas: publicProcedure
    .input(z.object({ sessionToken: z.string(), classId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const teacher = await getTeacherAccountBySessionToken(input.sessionToken);
      if (!teacher) throw new TRPCError({ code: "FORBIDDEN", message: "Token inválido" });

      return db.select().from(jigsawIntegrationQuestions)
        .where(eq(jigsawIntegrationQuestions.classId, input.classId));
    }),

  revisarPergunta: publicProcedure
    .input(z.object({
      sessionToken: z.string(),
      questionId: z.number(),
      decisao: z.enum(["approved", "rejected"]),
      enunciadoAjustado: z.string().optional(),
      alternativasAjustadas: z.array(z.object({ id: z.string(), texto: z.string(), correta: z.boolean() })).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const teacher = await getTeacherAccountBySessionToken(input.sessionToken);
      if (!teacher) throw new TRPCError({ code: "FORBIDDEN", message: "Token inválido" });

      const updates: any = {
        status: input.decisao, reviewedBy: teacher.id, reviewedByName: teacher.name, reviewedAt: new Date(),
      };
      if (input.enunciadoAjustado) updates.enunciado = input.enunciadoAjustado;
      if (input.alternativasAjustadas) {
        const numCorretas = input.alternativasAjustadas.filter(a => a.correta).length;
        if (numCorretas !== 1) throw new TRPCError({ code: "BAD_REQUEST", message: "Precisa ter exatamente 1 alternativa correta" });
        updates.alternativas = input.alternativasAjustadas;
      }

      await db.update(jigsawIntegrationQuestions).set(updates).where(eq(jigsawIntegrationQuestions.id, input.questionId));
      return { success: true };
    }),

  liberarPerguntasDoGrupo: publicProcedure
    .input(z.object({
      sessionToken: z.string(),
      classId: z.number(),
      groupId: z.number(),
      duracaoMinutos: z.number().min(1).max(60).default(DURACAO_PADRAO_JANELA_MINUTOS),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const teacher = await getTeacherAccountBySessionToken(input.sessionToken);
      if (!teacher) throw new TRPCError({ code: "FORBIDDEN", message: "Token inválido" });

      const agora = new Date();
      const expira = new Date(agora.getTime() + input.duracaoMinutos * 60 * 1000);

      const perguntas = await db.select().from(jigsawIntegrationQuestions)
        .where(and(
          eq(jigsawIntegrationQuestions.classId, input.classId),
          eq(jigsawIntegrationQuestions.authorGroupId, input.groupId),
          eq(jigsawIntegrationQuestions.status, "approved")
        ));

      if (!perguntas.length) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Este grupo não tem perguntas aprovadas para liberar" });
      }

      await db.update(jigsawIntegrationQuestions)
        .set({ releasedAt: agora, expiresAt: expira })
        .where(and(
          eq(jigsawIntegrationQuestions.classId, input.classId),
          eq(jigsawIntegrationQuestions.authorGroupId, input.groupId),
          eq(jigsawIntegrationQuestions.status, "approved")
        ));

      return { success: true, liberadas: perguntas.length, expiraEm: expira };
    }),

  /**
   * ALUNO (ou conferência): perguntas com janela de resposta aberta agora.
   * Em conferência, com incluirNaoLiberadas=true, também mostra as aprovadas
   * que ainda não foram liberadas — para conferir o texto antes da aula.
   */
  getQuizDisponivel: publicProcedure
    .input(z.object({
      studentSessionToken: z.string(),
      classId: z.number(),
      incluirNaoLiberadas: z.boolean().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const quem = await resolverAlunoOuConferencia(db, input.studentSessionToken);

      let meuGroupId: number | null = null;
      if (quem.modo === "aluno") {
        const meuGrupo = await db.select().from(jigsawHomeMembers).where(eq(jigsawHomeMembers.memberId, quem.memberId)).limit(1);
        meuGroupId = meuGrupo[0]?.homeGroupId ?? null;
      }
      const semente = quem.modo === "aluno" ? quem.memberId : quem.viewerId;

      const agora = new Date();
      const perguntas = await db.select().from(jigsawIntegrationQuestions)
        .where(and(eq(jigsawIntegrationQuestions.classId, input.classId), eq(jigsawIntegrationQuestions.status, "approved")));

      const janelaAberta = (p: any) =>
        !!p.releasedAt && new Date(p.releasedAt) <= agora && !!p.expiresAt && agora < new Date(p.expiresAt);
      const mostrarNaoLiberadas = quem.modo === "conferencia" && !!input.incluirNaoLiberadas;

      return perguntas
        .filter((p: any) => quem.modo === "conferencia" || p.authorGroupId === null || p.authorGroupId !== meuGroupId)
        .filter((p: any) => janelaAberta(p) || (mostrarNaoLiberadas && !p.releasedAt))
        .map((p: any) => ({
          id: p.id,
          topico: p.topico,
          enunciado: p.enunciado,
          alternativas: embaralharComSemente(
            (p.alternativas as any[]).map(a => ({ id: a.id, texto: a.texto })),
            semente * 100003 + p.id
          ),
          expiraEm: p.expiresAt,
          authorGroupId: p.authorGroupId,
          situacao: janelaAberta(p) ? ("aberta" as const) : ("nao_liberada" as const),
        }));
    }),

  responderPergunta: publicProcedure
    .input(z.object({ studentSessionToken: z.string(), questionId: z.number(), respostaEscolhida: z.string() }))
    .mutation(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const quem = await resolverAlunoOuConferencia(db, input.studentSessionToken);

        const question = await db.select().from(jigsawIntegrationQuestions).where(eq(jigsawIntegrationQuestions.id, input.questionId)).limit(1);
        if (!question.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Pergunta não encontrada" });
        const q = question[0];
        if (q.status !== "approved") throw new TRPCError({ code: "BAD_REQUEST", message: "Esta pergunta ainda não foi aprovada" });

        const alternativas = q.alternativas as any[];
        const correta = alternativas.find(a => a.correta);
        const isCorrect = input.respostaEscolhida === correta?.id;

        // Conferência: corrige para quem está testando, mas não grava nada
        // e não exige janela aberta (dá pra testar antes de liberar).
        if (quem.modo === "conferencia") {
          return {
            success: true,
            conferencia: true,
            acertou: isCorrect,
            message: `Modo conferência — resposta NÃO gravada (${isCorrect ? "acertaria" : "erraria"})`,
          };
        }

        if (!q.releasedAt || !q.expiresAt) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Esta pergunta ainda não foi liberada" });
        }
        const agora = new Date();
        if (agora < new Date(q.releasedAt)) throw new TRPCError({ code: "BAD_REQUEST", message: "Esta pergunta ainda não foi liberada" });
        if (agora >= new Date(q.expiresAt)) throw new TRPCError({ code: "BAD_REQUEST", message: "O tempo para responder esta pergunta já encerrou" });

        if (q.authorGroupId !== null) {
          const souDoGrupoAutor = await db.select().from(jigsawHomeMembers)
            .where(and(eq(jigsawHomeMembers.homeGroupId, q.authorGroupId), eq(jigsawHomeMembers.memberId, quem.memberId)))
            .limit(1);
          if (souDoGrupoAutor.length > 0) {
            throw new TRPCError({ code: "FORBIDDEN", message: "Você não pode responder uma pergunta do seu próprio grupo" });
          }
        }

        const existing = await db.select().from(jigsawIntegrationAnswers)
          .where(and(eq(jigsawIntegrationAnswers.questionId, input.questionId), eq(jigsawIntegrationAnswers.memberId, quem.memberId)))
          .limit(1);

        if (existing.length > 0) {
          await db.update(jigsawIntegrationAnswers).set({ respostaEscolhida: input.respostaEscolhida, isCorrect: isCorrect ? 1 : 0 })
            .where(eq(jigsawIntegrationAnswers.id, existing[0].id));
        } else {
          await db.insert(jigsawIntegrationAnswers).values({
            questionId: input.questionId, memberId: quem.memberId, respostaEscolhida: input.respostaEscolhida, isCorrect: isCorrect ? 1 : 0,
          });
        }

        return { success: true, conferencia: false, acertou: undefined as boolean | undefined, message: "Resposta registrada" };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Erro ao responder: ${error instanceof Error ? error.message : String(error)}` });
      }
    }),

  getPerguntasEncerradas: publicProcedure
    .input(z.object({ studentSessionToken: z.string(), classId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await resolverAlunoOuConferencia(db, input.studentSessionToken);

      const agora = new Date();
      const perguntas = await db.select().from(jigsawIntegrationQuestions)
        .where(and(eq(jigsawIntegrationQuestions.classId, input.classId), eq(jigsawIntegrationQuestions.status, "approved")));

      return perguntas
        .filter((p: any) => p.expiresAt && agora >= new Date(p.expiresAt))
        .map((p: any) => ({
          id: p.id, topico: p.topico, enunciado: p.enunciado,
          alternativas: p.alternativas,
          explicacao: p.explicacao,
        }));
    }),

  lancarNotaPoster: publicProcedure
    .input(z.object({
      sessionToken: z.string(),
      classId: z.number(),
      groupId: z.number(),
      checklist: z.record(z.string(), z.boolean()),
      observacoes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const teacher = await getTeacherAccountBySessionToken(input.sessionToken);
      if (!teacher) throw new TRPCError({ code: "FORBIDDEN", message: "Token inválido" });

      const valores = Object.values(input.checklist);
      if (!valores.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Checklist vazio" });
      const positivos = valores.filter(Boolean).length;
      const notaPoster = Math.round((positivos / valores.length) * 10 * 10) / 10;

      const existing = await db.select().from(seminarioApresentacoes)
        .where(and(eq(seminarioApresentacoes.classId, input.classId), eq(seminarioApresentacoes.groupId, input.groupId)))
        .limit(1);

      if (existing.length > 0) {
        await db.update(seminarioApresentacoes).set({
          checklist: input.checklist, notaPoster: String(notaPoster),
          gradedBy: teacher.id, gradedByName: teacher.name, gradedAt: new Date(), observacoes: input.observacoes,
        }).where(eq(seminarioApresentacoes.id, existing[0].id));
      } else {
        await db.insert(seminarioApresentacoes).values({
          classId: input.classId, groupId: input.groupId, checklist: input.checklist,
          notaPoster: String(notaPoster), gradedBy: teacher.id, gradedByName: teacher.name, observacoes: input.observacoes,
        });
      }

      const membrosDoGrupo = await db.select().from(jigsawHomeMembers).where(eq(jigsawHomeMembers.homeGroupId, input.groupId));
      for (const m of membrosDoGrupo) {
        await recalcularNotaSeminario(db, m.memberId, input.classId);
      }

      return { success: true, notaPoster };
    }),

  /**
   * PROFESSOR: notas de pôster já lançadas na turma (checklist marcado, nota,
   * quem lançou e quando) — para o painel mostrar as caixas como foram salvas
   * em vez de reabrir tudo desmarcado.
   */
  getApresentacoes: publicProcedure
    .input(z.object({ sessionToken: z.string(), classId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const teacher = await getTeacherAccountBySessionToken(input.sessionToken);
      if (!teacher) throw new TRPCError({ code: "FORBIDDEN", message: "Token inválido" });

      const rows = await db.select().from(seminarioApresentacoes)
        .where(eq(seminarioApresentacoes.classId, input.classId));
      return rows.map((r: any) => ({
        groupId: r.groupId,
        checklist: (r.checklist || {}) as Record<string, boolean>,
        notaPoster: Number(r.notaPoster),
        observacoes: r.observacoes as string | null,
        gradedByName: r.gradedByName as string | null,
        gradedAt: r.gradedAt,
      }));
    }),

  getNotaSeminario: publicProcedure
    .input(z.object({ studentSessionToken: z.string(), classId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const quem = await resolverAlunoOuConferencia(db, input.studentSessionToken);

      // Conferência: não chama o recálculo (ele grava em jigsawScores)
      if (quem.modo === "conferencia") {
        return { notaPosterGrupo: 0, notaIndividual: 0, totalRespondidas: 0, acertos: 0, notaSeminario: 0, conferencia: true };
      }
      const nota = await recalcularNotaSeminario(db, quem.memberId, input.classId);
      return { ...nota, conferencia: false };
    }),
});

async function recalcularNotaSeminario(db: any, memberId: number, classId: number) {
  const meuGrupo = await db.select().from(jigsawHomeMembers).where(eq(jigsawHomeMembers.memberId, memberId)).limit(1);
  let notaPosterGrupo = 0;
  if (meuGrupo.length > 0) {
    const apresentacao = await db.select().from(seminarioApresentacoes).where(eq(seminarioApresentacoes.groupId, meuGrupo[0].homeGroupId)).limit(1);
    notaPosterGrupo = apresentacao.length > 0 ? Number(apresentacao[0].notaPoster) : 0;
  }

  const questoesDaTurma = await db.select().from(jigsawIntegrationQuestions).where(eq(jigsawIntegrationQuestions.classId, classId));
  const idsDaTurma = new Set(questoesDaTurma.map((q: any) => q.id));
  const respostas = await db.select().from(jigsawIntegrationAnswers).where(eq(jigsawIntegrationAnswers.memberId, memberId));
  const minhasRespostas = respostas.filter((r: any) => idsDaTurma.has(r.questionId));

  const totalRespondidas = minhasRespostas.length;
  const acertos = minhasRespostas.filter((r: any) => r.isCorrect === 1).length;
  const notaIndividual = totalRespondidas > 0 ? (acertos / totalRespondidas) * 10 : 0;
  const notaSeminario = Math.round(((notaPosterGrupo * PESO_NOTA_GRUPO) + (notaIndividual * PESO_NOTA_INDIVIDUAL)) * 10) / 10;

  const existing = await db.select().from(jigsawScores).where(eq(jigsawScores.memberId, memberId)).limit(1);
  if (existing.length > 0) {
    await db.update(jigsawScores).set({ totalJigsawPF: String(notaSeminario.toFixed(2)) }).where(eq(jigsawScores.memberId, memberId));
  } else {
    await db.insert(jigsawScores).values({
      classId, memberId, totalPresentationScore: "0", totalParticipationScore: "0", totalPeerRating: "0",
      fase1PF: "0", fase2PF: "0", fase3PF: "0", totalJigsawPF: String(notaSeminario.toFixed(2)),
    });
  }

  return { notaPosterGrupo, notaIndividual: Math.round(notaIndividual * 10) / 10, totalRespondidas, acertos, notaSeminario };
}