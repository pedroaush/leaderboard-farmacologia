import { router, publicProcedure } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and } from "drizzle-orm";
import { getDb, getTeacherAccountBySessionToken } from "../db";
import { examGabaritos, examStudentGrades, members, studentAccounts } from "../../drizzle/schema";

/**
 * ============================================================================
 * CORREÇÃO DE CARTÃO-RESPOSTA POR QR CODE
 * ============================================================================
 * Cada cartão impresso tem um QR com o endereço
 *   /correcao?p=P1&c=<classId>&k=<nº do cartão>&m=<memberId>
 * O professor ou monitor lê o QR, confere as marcações do cartão na tela e
 * salva. O servidor corrige com o gabarito da versão marcada e grava a nota
 * em examStudentGrades — a mesma tabela que a Planilha de Notas já lê (P1/P2).
 *
 * Nota = acertos × (10 ÷ número de questões). Com 20 questões, 0,5 por acerto.
 * ============================================================================
 */

const LETRA = z.enum(["A", "B", "C", "D", "E"]);
const PROVA = z.enum(["P1", "P2"]);

/** Professor (qualquer turma) ou monitor ativo (só a turma dele). */
async function autenticar(db: any, sessionToken: string, classId: number): Promise<{ id: number; name: string; tipo: "professor" | "monitor" }> {
  const teacher = await getTeacherAccountBySessionToken(sessionToken);
  if (teacher) return { id: teacher.id, name: teacher.name, tipo: "professor" };

  const rows = await db.select().from(studentAccounts)
    .where(and(eq(studentAccounts.sessionToken, sessionToken), eq(studentAccounts.accountType, "monitor"), eq(studentAccounts.isActive, 1)))
    .limit(1);
  const monitor = rows[0];
  if (!monitor) throw new TRPCError({ code: "FORBIDDEN", message: "Faça login como professor ou monitor para corrigir cartões." });
  if (monitor.assignedClassId && monitor.assignedClassId !== classId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Você só pode corrigir cartões da sua turma." });
  }
  return { id: monitor.id, name: `${monitor.displayName || monitor.email} (monitor)`, tipo: "monitor" };
}

function limparNome(n: string | null | undefined): string {
  if (!n) return "";
  const p = n.split("\t");
  return (p.length >= 2 ? p[1] : n).trim();
}

export const correcaoProvaRouter = router({
  /**
   * PROFESSOR: grava os gabaritos de todas as versões de uma prova
   * (uma linha por versão em examGabaritos). Pode ser rodado de novo para
   * corrigir um gabarito — os cartões já lançados podem ser recorrigidos com
   * recorrigirTodos.
   */
  salvarGabaritos: publicProcedure
    .input(z.object({
      sessionToken: z.string(),
      classId: z.number(),
      provaType: PROVA,
      gabaritos: z.record(z.string(), z.array(LETRA).min(1).max(60)),
      examDate: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const teacher = await getTeacherAccountBySessionToken(input.sessionToken);
      if (!teacher) throw new TRPCError({ code: "FORBIDDEN", message: "Só o professor pode cadastrar gabaritos" });

      const versoes = Object.keys(input.gabaritos);
      const tamanhos = new Set(versoes.map(v => input.gabaritos[v].length));
      if (tamanhos.size !== 1) throw new TRPCError({ code: "BAD_REQUEST", message: "Todas as versões precisam ter o mesmo número de questões" });

      for (const versao of versoes) {
        if (!/^[A-E]$/.test(versao)) throw new TRPCError({ code: "BAD_REQUEST", message: `Versão inválida: ${versao}` });
        const respostas = input.gabaritos[versao];
        const dados = {
          answers: JSON.stringify(respostas),
          difficulties: JSON.stringify(respostas.map(() => "intermediario")),
          examDate: input.examDate,
          createdByName: teacher.name,
        };
        const existe = await db.select().from(examGabaritos)
          .where(and(eq(examGabaritos.classId, input.classId), eq(examGabaritos.provaType, input.provaType), eq(examGabaritos.examVersion, versao)))
          .limit(1);
        if (existe.length) {
          await db.update(examGabaritos).set(dados).where(eq(examGabaritos.id, existe[0].id));
        } else {
          await db.insert(examGabaritos).values({ classId: input.classId, provaType: input.provaType, examVersion: versao, ...dados });
        }
      }
      return { success: true, versoes, questoes: [...tamanhos][0] };
    }),

  /**
   * PROFESSOR/MONITOR: tudo o que a tela de correção precisa para um cartão —
   * aluno (se o QR trouxer o memberId), lista da turma (para cartões sem
   * nome), versões cadastradas e a correção já lançada, se houver.
   */
  getContexto: publicProcedure
    .input(z.object({ sessionToken: z.string(), classId: z.number(), provaType: PROVA, memberId: z.number().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const quem = await autenticar(db, input.sessionToken, input.classId);

      const gabs = await db.select().from(examGabaritos)
        .where(and(eq(examGabaritos.classId, input.classId), eq(examGabaritos.provaType, input.provaType)));
      const versoes = gabs.map((g: any) => g.examVersion).filter(Boolean).sort();
      const numQuestoes = gabs.length ? (JSON.parse(gabs[0].answers) as string[]).length : 0;

      const alunosRaw = await db.select().from(members).where(eq(members.classId, input.classId));
      const alunos = alunosRaw
        .map((m: any) => ({ id: m.id, nome: limparNome(m.name) }))
        .sort((a: any, b: any) => a.nome.localeCompare(b.nome));

      let lancamento: null | { versao: string; respostas: (string | null)[]; nota: number; acertos: number } = null;
      if (input.memberId) {
        const g = await db.select().from(examStudentGrades)
          .where(and(eq(examStudentGrades.memberId, input.memberId), eq(examStudentGrades.provaType, input.provaType)))
          .limit(1);
        if (g.length) {
          lancamento = {
            versao: g[0].examVersion || "A",
            respostas: JSON.parse(g[0].answers || "[]"),
            nota: Number(g[0].score),
            acertos: g[0].correctCount,
          };
        }
      }

      return {
        corretor: quem.name,
        versoes,
        numQuestoes,
        aluno: input.memberId ? alunos.find((a: any) => a.id === input.memberId) || null : null,
        alunos,
        lancamento,
      };
    }),

  /**
   * PROFESSOR/MONITOR: corrige um cartão e grava a nota na planilha.
   * O gabarito nunca sai do servidor — a tela só recebe a nota.
   */
  lancarCartao: publicProcedure
    .input(z.object({
      sessionToken: z.string(),
      classId: z.number(),
      provaType: PROVA,
      memberId: z.number(),
      versao: LETRA,
      respostas: z.array(LETRA.nullable()).min(1).max(60),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const quem = await autenticar(db, input.sessionToken, input.classId);

      const gab = await db.select().from(examGabaritos)
        .where(and(eq(examGabaritos.classId, input.classId), eq(examGabaritos.provaType, input.provaType), eq(examGabaritos.examVersion, input.versao)))
        .limit(1);
      if (!gab.length) throw new TRPCError({ code: "BAD_REQUEST", message: `Gabarito da versão ${input.versao} não cadastrado` });
      const gabarito = JSON.parse(gab[0].answers) as string[];
      if (gabarito.length !== input.respostas.length) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `A prova tem ${gabarito.length} questões; foram enviadas ${input.respostas.length}` });
      }

      const aluno = await db.select().from(members).where(eq(members.id, input.memberId)).limit(1);
      if (!aluno.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Aluno não encontrado" });
      if (aluno[0].classId !== input.classId) throw new TRPCError({ code: "BAD_REQUEST", message: "Este aluno não é desta turma" });

      const acertos = input.respostas.reduce((n, r, i) => n + (r !== null && r === gabarito[i] ? 1 : 0), 0);
      const nota = Math.round(acertos * (10 / gabarito.length) * 100) / 100;

      const dados = {
        classId: input.classId,
        memberName: limparNome(aluno[0].name),
        examVersion: input.versao,
        answers: JSON.stringify(input.respostas),
        score: nota.toFixed(2),
        correctCount: acertos,
      };
      const existe = await db.select().from(examStudentGrades)
        .where(and(eq(examStudentGrades.memberId, input.memberId), eq(examStudentGrades.provaType, input.provaType)))
        .limit(1);
      if (existe.length) {
        await db.update(examStudentGrades).set(dados).where(eq(examStudentGrades.id, existe[0].id));
      } else {
        await db.insert(examStudentGrades).values({ memberId: input.memberId, provaType: input.provaType, ...dados });
      }

      return { success: true, aluno: dados.memberName, acertos, total: gabarito.length, nota, corrigidoPor: quem.name, jaExistia: existe.length > 0 };
    }),

  /**
   * PROFESSOR: recorrige todos os cartões já lançados com os gabaritos
   * atuais (útil se uma questão for anulada ou um gabarito for corrigido).
   */
  recorrigirTodos: publicProcedure
    .input(z.object({ sessionToken: z.string(), classId: z.number(), provaType: PROVA }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const teacher = await getTeacherAccountBySessionToken(input.sessionToken);
      if (!teacher) throw new TRPCError({ code: "FORBIDDEN", message: "Só o professor pode recorrigir" });

      const gabs = await db.select().from(examGabaritos)
        .where(and(eq(examGabaritos.classId, input.classId), eq(examGabaritos.provaType, input.provaType)));
      const porVersao = new Map<string, string[]>(gabs.map((g: any) => [g.examVersion, JSON.parse(g.answers)]));

      const notas = await db.select().from(examStudentGrades)
        .where(and(eq(examStudentGrades.classId, input.classId), eq(examStudentGrades.provaType, input.provaType)));
      let recorrigidos = 0;
      for (const n of notas) {
        const gabarito = porVersao.get(n.examVersion || "A");
        if (!gabarito) continue;
        const respostas = JSON.parse(n.answers || "[]") as (string | null)[];
        if (respostas.length !== gabarito.length) continue;
        const acertos = respostas.reduce((s, r, i) => s + (r !== null && r === gabarito[i] ? 1 : 0), 0);
        const nota = Math.round(acertos * (10 / gabarito.length) * 100) / 100;
        await db.update(examStudentGrades).set({ score: nota.toFixed(2), correctCount: acertos }).where(eq(examStudentGrades.id, n.id));
        recorrigidos++;
      }
      return { success: true, recorrigidos };
    }),
});
