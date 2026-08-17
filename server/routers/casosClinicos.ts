import { router, publicProcedure } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and } from "drizzle-orm";
import { getDb, getTeacherAccountBySessionToken } from "../db";
import {
  jigsawGroups,
  jigsawMembers,
  casosClinicosDisputas,
  jigsawScores,
  members,
  studentAccounts,
} from "../../drizzle/schema";

/**
 * Autentica quem está chamando como professor OU monitor (o monitor precisa
 * estar vinculado à mesma turma, salvo se for o bypass de admin/professor,
 * que tem assignedClassId nulo = acesso a todas). Usado nas rotas que agora
 * o monitor também pode acessar (ver disputas, registrar resultado).
 */
async function autenticarProfessorOuMonitor(db: any, sessionToken: string, classId: number): Promise<{ id: number; name: string }> {
  const teacher = await getTeacherAccountBySessionToken(sessionToken);
  if (teacher) return { id: teacher.id, name: teacher.name };

  const monitorRows = await db.select().from(studentAccounts)
    .where(and(eq(studentAccounts.sessionToken, sessionToken), eq(studentAccounts.accountType, "monitor"), eq(studentAccounts.isActive, 1)))
    .limit(1);
  const monitor = monitorRows[0];
  if (!monitor) throw new TRPCError({ code: "FORBIDDEN", message: "Token inválido" });
  if (monitor.assignedClassId && monitor.assignedClassId !== classId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Você só pode acessar dados da sua turma." });
  }
  return { id: monitor.id, name: `${monitor.displayName || monitor.email} (monitor)` };
}

/**
 * ============================================================================
 * CASOS CLÍNICOS — PONTOS CORRIDOS (estilo campeonato de futebol)
 * ============================================================================
 * 10 grupos de 8 alunos (jigsawGroups, groupType='clinical_case'), 4 rodadas
 * ao longo do semestre (uma por dia de Caso Clínico: CS1-CS4), 5 disputas por
 * rodada (confrontos par a par, ninguém joga contra o mesmo grupo duas vezes).
 *
 * O "passa ou repassa" continua presencial — a plataforma não digitaliza o
 * jogo em si, só REGISTRA o resultado (quantas das 5 perguntas cada grupo
 * acertou) depois que a disputa acontece, calcula os pontos (3/1/0, como
 * futebol) e mantém a tabela de classificação atualizada.
 *
 * Ao final das 4 rodadas, a posição na tabela (1º ao 10º) vira a nota de
 * Casos Clínicos de todos os integrantes daquele grupo.
 * ============================================================================
 */
export const TOTAL_RODADAS = 4;
export const PERGUNTAS_POR_DISPUTA = 5;
export const PONTOS_VITORIA = 3;
export const PONTOS_EMPATE = 1;
export const PONTOS_DERROTA = 0;

/** Escala de nota por colocação final: 1º=10, cai 0,5 a cada posição. */
export function notaPorColocacao(posicao: number): number {
  return Math.max(0, 10 - 0.5 * (posicao - 1));
}

/**
 * Gera o calendário de confrontos (método do círculo) — cada grupo joga
 * exatamente 1 vez por rodada, contra um adversário diferente a cada rodada,
 * sem repetição de confronto ao longo de todo o campeonato.
 */
function gerarCalendario(gruposIds: number[], numRodadas: number): Array<Array<[number, number]>> {
  const n = gruposIds.length;
  if (n % 2 !== 0) throw new Error("O número de grupos precisa ser par para gerar o calendário");
  const fixo = gruposIds[0];
  let resto = gruposIds.slice(1);

  const rodadas: Array<Array<[number, number]>> = [];
  for (let r = 0; r < numRodadas; r++) {
    const roda = [fixo, ...resto];
    const pares: Array<[number, number]> = [];
    for (let i = 0; i < n / 2; i++) {
      pares.push([roda[i], roda[n - 1 - i]]);
    }
    rodadas.push(pares);
    resto = [resto[resto.length - 1], ...resto.slice(0, resto.length - 1)];
  }
  return rodadas;
}

export const casosClinicosRouter = router({
  /**
   * PROFESSOR: mostra a composição atual dos 10 grupos (quem está em cada
   * um) — para consultar antes de fazer qualquer ajuste manual.
   */
  getComposicaoGrupos: publicProcedure
    .input(z.object({ sessionToken: z.string(), classId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const teacher = await getTeacherAccountBySessionToken(input.sessionToken);
      if (!teacher) throw new TRPCError({ code: "FORBIDDEN", message: "Token inválido" });

      const grupos = await db.select().from(jigsawGroups)
        .where(and(eq(jigsawGroups.classId, input.classId), eq(jigsawGroups.groupType, "clinical_case"), eq(jigsawGroups.isActive, 1)));

      return Promise.all(grupos.map(async (g: any) => {
        const membrosDoGrupo = await db.select().from(jigsawMembers).where(eq(jigsawMembers.jigsawGroupId, g.id));
        return {
          grupoId: g.id, nome: g.name, capacidade: g.maxMembers,
          membros: membrosDoGrupo.map((m: any) => ({ memberId: m.memberId, nome: m.memberName })),
        };
      }));
    }),

  /**
   * PROFESSOR: ajuste manual — move um aluno para um grupo específico.
   * Cobre 3 situações: aluno novo entrando na turma (nunca esteve em nenhum
   * grupo), aluno trocando de grupo, ou correção de um erro de distribuição.
   * Se o aluno já estiver em outro grupo, ele é removido de lá primeiro.
   */
  moverAluno: publicProcedure
    .input(z.object({ sessionToken: z.string(), classId: z.number(), memberId: z.number(), novoGrupoId: z.number() }))
    .mutation(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const teacher = await getTeacherAccountBySessionToken(input.sessionToken);
        if (!teacher) throw new TRPCError({ code: "FORBIDDEN", message: "Token inválido" });

        const grupoDestino = await db.select().from(jigsawGroups)
          .where(and(eq(jigsawGroups.id, input.novoGrupoId), eq(jigsawGroups.groupType, "clinical_case"))).limit(1);
        if (!grupoDestino.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Grupo de destino não encontrado" });

        // Acha o grupo atual do aluno (se houver) dentro dos grupos de Caso
        // Clínico desta turma
        const gruposDaTurma = await db.select().from(jigsawGroups)
          .where(and(eq(jigsawGroups.classId, input.classId), eq(jigsawGroups.groupType, "clinical_case")));
        let membroAtual: any = null;
        let grupoAtualId: number | null = null;
        for (const g of gruposDaTurma) {
          const m = await db.select().from(jigsawMembers)
            .where(and(eq(jigsawMembers.jigsawGroupId, g.id), eq(jigsawMembers.memberId, input.memberId))).limit(1);
          if (m.length) { membroAtual = m[0]; grupoAtualId = g.id; break; }
        }

        if (grupoAtualId === input.novoGrupoId) {
          return { success: true, message: "Aluno já está neste grupo", moveuDe: grupoAtualId };
        }

        // Remove do grupo antigo, se havia
        if (grupoAtualId !== null && membroAtual) {
          await db.delete(jigsawMembers).where(eq(jigsawMembers.id, membroAtual.id));
          const antigo = gruposDaTurma.find((g: any) => g.id === grupoAtualId);
          await db.update(jigsawGroups)
            .set({ currentMembers: Math.max(0, (antigo?.currentMembers || 1) - 1) })
            .where(eq(jigsawGroups.id, grupoAtualId));
        }

        // Busca o nome do aluno (para gravar cacheado, como o resto do sistema já faz)
        const aluno = await db.select().from(members).where(eq(members.id, input.memberId)).limit(1);
        if (!aluno.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Aluno não encontrado" });

        await db.insert(jigsawMembers).values({
          jigsawGroupId: input.novoGrupoId, memberId: input.memberId, memberName: aluno[0].name, role: "member",
        });
        await db.update(jigsawGroups)
          .set({ currentMembers: (grupoDestino[0].currentMembers || 0) + 1 })
          .where(eq(jigsawGroups.id, input.novoGrupoId));

        return { success: true, moveuDe: grupoAtualId, moveuPara: input.novoGrupoId };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Erro ao mover aluno: ${error instanceof Error ? error.message : String(error)}` });
      }
    }),

  /**
   * PROFESSOR: ajuste manual — remove um aluno de qualquer grupo de Caso
   * Clínico (uso: aluno trancou a matrícula ou saiu da turma).
   */
  removerAlunoDoGrupo: publicProcedure
    .input(z.object({ sessionToken: z.string(), classId: z.number(), memberId: z.number() }))
    .mutation(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const teacher = await getTeacherAccountBySessionToken(input.sessionToken);
        if (!teacher) throw new TRPCError({ code: "FORBIDDEN", message: "Token inválido" });

        const gruposDaTurma = await db.select().from(jigsawGroups)
          .where(and(eq(jigsawGroups.classId, input.classId), eq(jigsawGroups.groupType, "clinical_case")));

        for (const g of gruposDaTurma) {
          const m = await db.select().from(jigsawMembers)
            .where(and(eq(jigsawMembers.jigsawGroupId, g.id), eq(jigsawMembers.memberId, input.memberId))).limit(1);
          if (m.length) {
            await db.delete(jigsawMembers).where(eq(jigsawMembers.id, m[0].id));
            await db.update(jigsawGroups)
              .set({ currentMembers: Math.max(0, (g.currentMembers || 1) - 1) })
              .where(eq(jigsawGroups.id, g.id));
            return { success: true, removidoDoGrupo: g.id, nomeDoGrupo: g.name };
          }
        }

        return { success: true, message: "Aluno não estava em nenhum grupo de Caso Clínico" };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Erro ao remover aluno: ${error instanceof Error ? error.message : String(error)}` });
      }
    }),


  /**
   * PROFESSOR: distribui aleatoriamente os alunos da turma nos 10 grupos de
   * Caso Clínico já criados (8 por grupo). Só considera alunos que ainda não
   * estão em nenhum grupo de Caso Clínico — rodar de novo não duplica.
   */
  distribuirAlunosNosGrupos: publicProcedure
    .input(z.object({
      sessionToken: z.string(),
      classId: z.number(),
      porGrupo: z.number().default(8),
    }))
    .mutation(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const teacher = await getTeacherAccountBySessionToken(input.sessionToken);
        if (!teacher) throw new TRPCError({ code: "FORBIDDEN", message: "Token inválido" });

        const grupos = await db.select().from(jigsawGroups)
          .where(and(eq(jigsawGroups.classId, input.classId), eq(jigsawGroups.groupType, "clinical_case"), eq(jigsawGroups.isActive, 1)));
        if (!grupos.length) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Nenhum grupo de Caso Clínico encontrado — crie os grupos primeiro" });
        }

        // Alunos da turma que ainda não estão em nenhum grupo de Caso Clínico
        const todosAlunos = await db.select().from(members).where(eq(members.classId, input.classId));
        const idsDosGrupos = grupos.map((g: any) => g.id);
        const jaDistribuidos = new Set<number>();
        for (const gId of idsDosGrupos) {
          const jaNoGrupo = await db.select().from(jigsawMembers).where(eq(jigsawMembers.jigsawGroupId, gId));
          jaNoGrupo.forEach((m: any) => jaDistribuidos.add(m.memberId));
        }
        const alunosDisponiveis = todosAlunos.filter((a: any) => !jaDistribuidos.has(a.id));

        const capacidadeTotal = grupos.length * input.porGrupo;
        if (alunosDisponiveis.length === 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Todos os alunos já estão distribuídos em algum grupo" });
        }
        if (alunosDisponiveis.length > capacidadeTotal) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `${alunosDisponiveis.length} alunos disponíveis, mas só há capacidade para ${capacidadeTotal} (${grupos.length} grupos × ${input.porGrupo})`,
          });
        }

        // Embaralha (Fisher-Yates) — testado antes de aplicar
        const embaralhados = [...alunosDisponiveis];
        for (let i = embaralhados.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [embaralhados[i], embaralhados[j]] = [embaralhados[j], embaralhados[i]];
        }

        const resultado: Array<{ grupo: string; alunos: string[] }> = [];
        let cursor = 0;
        for (const grupo of grupos) {
          const fatia = embaralhados.slice(cursor, cursor + input.porGrupo);
          cursor += input.porGrupo;

          for (const aluno of fatia) {
            await db.insert(jigsawMembers).values({
              jigsawGroupId: grupo.id, memberId: aluno.id, memberName: aluno.name, role: "member",
            });
          }
          await db.update(jigsawGroups)
            .set({ currentMembers: (grupo.currentMembers || 0) + fatia.length })
            .where(eq(jigsawGroups.id, grupo.id));

          resultado.push({ grupo: grupo.name, alunos: fatia.map((a: any) => a.name) });
        }

        return { success: true, totalDistribuidos: embaralhados.length, distribuicao: resultado };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Erro ao distribuir alunos: ${error instanceof Error ? error.message : String(error)}` });
      }
    }),


  /**
   * PROFESSOR: cria vários grupos de Caso Clínico de uma vez (uso único, no
   * início do semestre). Reaproveitável em semestres futuros.
   */
  criarGrupos: publicProcedure
    .input(z.object({
      sessionToken: z.string(),
      classId: z.number(),
      nomes: z.array(z.string()).min(2),
      maxMembers: z.number().default(8),
    }))
    .mutation(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const teacher = await getTeacherAccountBySessionToken(input.sessionToken);
        if (!teacher) throw new TRPCError({ code: "FORBIDDEN", message: "Token inválido" });

        const existentes = await db.select().from(jigsawGroups)
          .where(and(eq(jigsawGroups.classId, input.classId), eq(jigsawGroups.groupType, "clinical_case"), eq(jigsawGroups.isActive, 1)));
        if (existentes.length > 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `Já existem ${existentes.length} grupo(s) de Caso Clínico nesta turma — apague antes de recriar, se for o caso` });
        }

        const criados: string[] = [];
        for (const nome of input.nomes) {
          await db.insert(jigsawGroups).values({
            classId: input.classId, groupType: "clinical_case", name: nome,
            maxMembers: input.maxMembers, currentMembers: 0, isActive: 1,
          });
          criados.push(nome);
        }

        return { success: true, criados: criados.length, nomes: criados };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Erro ao criar grupos: ${error instanceof Error ? error.message : String(error)}` });
      }
    }),


  /**
   * PROFESSOR: gera o calendário completo das 4 rodadas (5 disputas cada) a
   * partir dos grupos de Caso Clínico já cadastrados na turma. Roda uma vez
   * só, no início do semestre.
   */
  gerarCalendarioDisputas: publicProcedure
    .input(z.object({ sessionToken: z.string(), classId: z.number() }))
    .mutation(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const teacher = await getTeacherAccountBySessionToken(input.sessionToken);
        if (!teacher) throw new TRPCError({ code: "FORBIDDEN", message: "Token inválido" });

        const grupos = await db.select().from(jigsawGroups)
          .where(and(eq(jigsawGroups.classId, input.classId), eq(jigsawGroups.groupType, "clinical_case"), eq(jigsawGroups.isActive, 1)));

        if (grupos.length < 2 || grupos.length % 2 !== 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `É preciso um número par de grupos (encontrados: ${grupos.length})` });
        }

        const existentes = await db.select().from(casosClinicosDisputas).where(eq(casosClinicosDisputas.classId, input.classId)).limit(1);
        if (existentes.length > 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "O calendário desta turma já foi gerado" });
        }

        const gruposIds = grupos.map((g: any) => g.id);
        const rodadas = gerarCalendario(gruposIds, TOTAL_RODADAS);

        let inseridas = 0;
        for (let r = 0; r < rodadas.length; r++) {
          for (const [grupoAId, grupoBId] of rodadas[r]) {
            await db.insert(casosClinicosDisputas).values({
              classId: input.classId, rodada: r + 1, grupoAId, grupoBId, status: "agendada",
            });
            inseridas++;
          }
        }

        return { success: true, rodadasGeradas: rodadas.length, disputasGeradas: inseridas };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Erro ao gerar calendário: ${error instanceof Error ? error.message : String(error)}` });
      }
    }),

  /**
   * PROFESSOR/MONITOR: lista as disputas de uma rodada (para saber quem
   * enfrenta quem naquele dia de Caso Clínico).
   */
  getDisputasDaRodada: publicProcedure
    .input(z.object({ sessionToken: z.string(), classId: z.number(), rodada: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await autenticarProfessorOuMonitor(db, input.sessionToken, input.classId);

      const disputas = await db.select().from(casosClinicosDisputas)
        .where(and(eq(casosClinicosDisputas.classId, input.classId), eq(casosClinicosDisputas.rodada, input.rodada)));

      return Promise.all(disputas.map(async (d: any) => {
        const grupoA = await db.select().from(jigsawGroups).where(eq(jigsawGroups.id, d.grupoAId)).limit(1);
        const grupoB = await db.select().from(jigsawGroups).where(eq(jigsawGroups.id, d.grupoBId)).limit(1);
        return { ...d, grupoANome: grupoA[0]?.name || "?", grupoBNome: grupoB[0]?.name || "?" };
      }));
    }),

  /**
   * PROFESSOR/MONITOR: registra o resultado de uma disputa depois que ela
   * acontece presencialmente (quantas das 5 perguntas cada grupo acertou).
   * Calcula os pontos (3/1/0) e atualiza a nota de Casos Clínicos de todos
   * os alunos dos grupos envolvidos.
   */
  registrarResultado: publicProcedure
    .input(z.object({
      sessionToken: z.string(),
      disputaId: z.number(),
      grupoAAcertos: z.number().min(0).max(PERGUNTAS_POR_DISPUTA),
      grupoBAcertos: z.number().min(0).max(PERGUNTAS_POR_DISPUTA),
    }))
    .mutation(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const disputa = await db.select().from(casosClinicosDisputas).where(eq(casosClinicosDisputas.id, input.disputaId)).limit(1);
        if (!disputa.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Disputa não encontrada" });
        const d = disputa[0];

        const quemRegistrou = await autenticarProfessorOuMonitor(db, input.sessionToken, d.classId);

        // Formato "melhor de 5, primeiro a 3": o placar sempre tem um lado
        // com exatamente 3 (quem venceu) e o outro com 0, 1 ou 2 — nunca
        // empate, e nunca os dois times somando mais que 5.
        const maior = Math.max(input.grupoAAcertos, input.grupoBAcertos);
        const menor = Math.min(input.grupoAAcertos, input.grupoBAcertos);
        if (maior !== 3 || menor > 2 || input.grupoAAcertos === input.grupoBAcertos) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Placar inválido — só são aceitos os formatos 3x0, 3x1 ou 3x2 (melhor de 5, primeiro a 3 pontos).",
          });
        }

        let pontosGrupoA: number, pontosGrupoB: number;
        if (input.grupoAAcertos > input.grupoBAcertos) { pontosGrupoA = PONTOS_VITORIA; pontosGrupoB = PONTOS_DERROTA; }
        else { pontosGrupoA = PONTOS_DERROTA; pontosGrupoB = PONTOS_VITORIA; }

        await db.update(casosClinicosDisputas).set({
          grupoAAcertos: input.grupoAAcertos, grupoBAcertos: input.grupoBAcertos,
          pontosGrupoA, pontosGrupoB, status: "concluida",
          registradoPor: quemRegistrou.id, registradoPorNome: quemRegistrou.name, registradoEm: new Date(),
        }).where(eq(casosClinicosDisputas.id, input.disputaId));

        await recalcularNotasCasosClinicos(db, d.classId);

        return { success: true, pontosGrupoA, pontosGrupoB };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Erro ao registrar resultado: ${error instanceof Error ? error.message : String(error)}` });
      }
    }),

  /**
   * Tabela de classificação atual (pode ser consultada a qualquer momento,
   * mesmo antes das 4 rodadas terminarem — mostra o campeonato "ao vivo").
   */
  getTabelaClassificacao: publicProcedure
    .input(z.object({ classId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      return calcularTabela(db, input.classId);
    }),
});

/** Calcula a tabela de classificação a partir de todas as disputas concluídas. */
async function calcularTabela(db: any, classId: number) {
  const grupos = await db.select().from(jigsawGroups)
    .where(and(eq(jigsawGroups.classId, classId), eq(jigsawGroups.groupType, "clinical_case"), eq(jigsawGroups.isActive, 1)));

  const tabela: Record<number, { grupoId: number; nome: string; pontos: number; vitorias: number; empates: number; derrotas: number; jogos: number }> = {};
  for (const g of grupos) {
    tabela[g.id] = { grupoId: g.id, nome: g.name, pontos: 0, vitorias: 0, empates: 0, derrotas: 0, jogos: 0 };
  }

  const disputas = await db.select().from(casosClinicosDisputas)
    .where(and(eq(casosClinicosDisputas.classId, classId), eq(casosClinicosDisputas.status, "concluida")));

  for (const d of disputas) {
    if (!tabela[d.grupoAId] || !tabela[d.grupoBId]) continue;
    tabela[d.grupoAId].pontos += d.pontosGrupoA || 0;
    tabela[d.grupoBId].pontos += d.pontosGrupoB || 0;
    tabela[d.grupoAId].jogos++; tabela[d.grupoBId].jogos++;
    if (d.pontosGrupoA === PONTOS_VITORIA) { tabela[d.grupoAId].vitorias++; tabela[d.grupoBId].derrotas++; }
    else if (d.pontosGrupoB === PONTOS_VITORIA) { tabela[d.grupoBId].vitorias++; tabela[d.grupoAId].derrotas++; }
    else { tabela[d.grupoAId].empates++; tabela[d.grupoBId].empates++; }
  }

  return Object.values(tabela).sort((a, b) => b.pontos - a.pontos);
}

/**
 * Recalcula a nota de Casos Clínicos de TODOS os alunos da turma a partir da
 * posição atual na tabela. Chamada sempre que um resultado é registrado —
 * a posição de vários grupos pode mudar de uma vez.
 *
 * A nota fica em jigsawScores.fase3PF (0-10 aqui, campo reaproveitado como
 * "container" da nota de Casos Clínicos — ver observação no arquivo de
 * aplicação sobre como isso se conecta à fórmula de Nota de Trabalhos).
 */
async function recalcularNotasCasosClinicos(db: any, classId: number) {
  const classificacao = await calcularTabela(db, classId);

  for (let i = 0; i < classificacao.length; i++) {
    const posicao = i + 1;
    const nota = notaPorColocacao(posicao);

    const membrosDoGrupo = await db.select().from(jigsawMembers).where(eq(jigsawMembers.jigsawGroupId, classificacao[i].grupoId));
    for (const m of membrosDoGrupo) {
      const existing = await db.select().from(jigsawScores).where(eq(jigsawScores.memberId, m.memberId)).limit(1);
      if (existing.length > 0) {
        await db.update(jigsawScores).set({ fase3PF: String(nota.toFixed(2)) }).where(eq(jigsawScores.memberId, m.memberId));
      } else {
        await db.insert(jigsawScores).values({
          classId, memberId: m.memberId, totalPresentationScore: "0", totalParticipationScore: "0", totalPeerRating: "0",
          fase1PF: "0", fase2PF: "0", fase3PF: String(nota.toFixed(2)), totalJigsawPF: "0",
        });
      }
    }
  }
}