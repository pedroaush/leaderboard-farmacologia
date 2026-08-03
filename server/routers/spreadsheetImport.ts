import { router, publicProcedure } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and } from "drizzle-orm";
import { getDb, getTeacherAccountBySessionToken } from "../db";
import { members, studentAccounts, classes } from "../../drizzle/schema";

/**
 * ============================================================================
 * IMPORTAÇÃO DE ALUNOS VIA PLANILHA (Relatório de Classe / Folha de Chamada)
 * ============================================================================
 * A UNIRIO exporta, por turma, um "Relatório de Classe" em .xls com as
 * colunas: Seq., Curso, Matrícula, Nome, Email, Deficiências. O parsing do
 * arquivo acontece num script Python (importar_planilha_unirio.py), que lê o
 * .xls localmente e envia aqui só os dados já limpos, em JSON — este endpoint
 * nunca lida com o arquivo em si.
 *
 * DECISÕES DE DESIGN (documentadas para revisão):
 *  - E-mail NÃO precisa ser @edu.unirio.br para o aluno ser importado. Muitos
 *    alunos reais aparecem no relatório oficial da UNIRIO com e-mail pessoal
 *    (Gmail, Hotmail, etc.). Excluí-los do sistema seria pior do que aceitar
 *    o e-mail que a própria universidade tem cadastrado. O relatório de
 *    importação sinaliza quais e-mails não são institucionais, para revisão
 *    posterior — mas não bloqueia o cadastro.
 *  - O campo "Deficiências" da planilha NÃO é armazenado na plataforma. É
 *    dado sensível (LGPD). Fica só no relatório local que o script Python
 *    gera na máquina do professor, nunca no banco de dados.
 * ============================================================================
 */

const alunoInputSchema = z.object({
  matricula: z.string().min(1),
  nome: z.string().min(1),
  email: z.string().email(),
});

export const spreadsheetImportRouter = router({
  /**
   * PRÉ-VISUALIZAÇÃO: mostra o que seria importado, sem gravar nada.
   */
  previewSpreadsheetImport: publicProcedure
    .input(z.object({
      sessionToken: z.string(),
      classId: z.number(),
      alunos: z.array(alunoInputSchema),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const teacher = await getTeacherAccountBySessionToken(input.sessionToken);
      if (!teacher) throw new TRPCError({ code: "FORBIDDEN", message: "Token inválido" });

      const turma = await db.select().from(classes).where(eq(classes.id, input.classId)).limit(1);
      if (!turma.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Turma não encontrada" });

      const preview = await Promise.all(
        input.alunos.map(async (aluno) => {
          const existentePorEmail = await db.select().from(studentAccounts).where(eq(studentAccounts.email, aluno.email)).limit(1);
          const existentePorMatricula = await db.select().from(studentAccounts).where(eq(studentAccounts.matricula, aluno.matricula)).limit(1);
          const institucional = aluno.email.toLowerCase().endsWith("@edu.unirio.br");

          let status: "novo" | "ja_cadastrado" | "conflito" = "novo";
          if (existentePorEmail.length && existentePorMatricula.length && existentePorEmail[0].id === existentePorMatricula[0].id) {
            status = "ja_cadastrado";
          } else if (existentePorEmail.length || existentePorMatricula.length) {
            status = "conflito"; // matrícula e email já existem mas em contas DIFERENTES — precisa de atenção manual
          }

          return {
            matricula: aluno.matricula,
            nome: aluno.nome,
            email: aluno.email,
            emailInstitucional: institucional,
            status,
          };
        })
      );

      return {
        turmaNome: turma[0].name,
        totalNaPlanilha: input.alunos.length,
        novos: preview.filter(p => p.status === "novo").length,
        jaCadastrados: preview.filter(p => p.status === "ja_cadastrado").length,
        conflitos: preview.filter(p => p.status === "conflito").length,
        naoInstitucionais: preview.filter(p => !p.emailInstitucional).length,
        preview,
      };
    }),

  /**
   * IMPORTAÇÃO DE FATO: cria member + studentAccount para cada aluno novo.
   * Alunos já cadastrados (mesmo email E matrícula) são pulados sem erro.
   * Conflitos (email OU matrícula já usados por OUTRA conta) são reportados,
   * não sobrescritos automaticamente — decisão manual do professor.
   */
  importFromSpreadsheet: publicProcedure
    .input(z.object({
      sessionToken: z.string(),
      classId: z.number(),
      teamId: z.number().default(0),
      alunos: z.array(alunoInputSchema),
    }))
    .mutation(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const teacher = await getTeacherAccountBySessionToken(input.sessionToken);
        if (!teacher) throw new TRPCError({ code: "FORBIDDEN", message: "Token inválido" });

        const turma = await db.select().from(classes).where(eq(classes.id, input.classId)).limit(1);
        if (!turma.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Turma não encontrada" });

        let importados = 0;
        let jaCadastrados = 0;
        const conflitos: string[] = [];
        const naoInstitucionais: string[] = [];

        for (const aluno of input.alunos) {
          const porEmail = await db.select().from(studentAccounts).where(eq(studentAccounts.email, aluno.email)).limit(1);
          const porMatricula = await db.select().from(studentAccounts).where(eq(studentAccounts.matricula, aluno.matricula)).limit(1);

          if (porEmail.length && porMatricula.length && porEmail[0].id === porMatricula[0].id) {
            jaCadastrados++;
            continue;
          }
          if (porEmail.length || porMatricula.length) {
            conflitos.push(`${aluno.nome} (${aluno.matricula} / ${aluno.email}): email ou matrícula já usado por outra conta`);
            continue;
          }

          if (!aluno.email.toLowerCase().endsWith("@edu.unirio.br")) {
            naoInstitucionais.push(`${aluno.nome} (${aluno.email})`);
            // não bloqueia — só sinaliza
          }

          const memberResult = await db.insert(members).values({
            teamId: input.teamId,
            classId: input.classId,
            name: aluno.nome,
            xp: "0",
          });
          const memberId = (memberResult as any)[0]?.insertId ?? (memberResult as any).insertId;

          await db.insert(studentAccounts).values({
            memberId,
            email: aluno.email,
            matricula: aluno.matricula,
            passwordHash: "", // aluno define a senha no primeiro acesso
            accountType: "student",
            isActive: 1,
          });

          importados++;
        }

        return {
          success: true,
          turmaNome: turma[0].name,
          importados,
          jaCadastrados,
          conflitos,
          naoInstitucionais,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Erro ao importar alunos: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }),
});
