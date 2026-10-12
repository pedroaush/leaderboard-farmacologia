import { router, publicProcedure } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and } from "drizzle-orm";
import { gerarParecerComIA, dadosDoJogo, iaConfigurada } from "../parecerIA";
import { getDb, getRawDb, getTeacherAccountBySessionToken, getStudentAccountBySessionToken, getSetting, upsertSetting } from "../db";
import { examGabaritos, examStudentGrades, members, studentAccounts } from "../../drizzle/schema";

/**
 * ============================================================================
 * CORREÇÃO DE CARTÃO-RESPOSTA POR QR CODE — v2
 * ============================================================================
 * Novidades da v2:
 *  - Versões A a J (A–E para a 1ª chamada, F–J para a 2ª chamada da mesma
 *    prova, sem misturar gabaritos).
 *  - MAPA da prova: para cada versão, qual questão original está em cada
 *    posição e como as alternativas foram embaralhadas. Guardado no campo
 *    `difficulties` de examGabaritos (que este fluxo não usa para peso).
 *    Com o mapa, a estatística é feita por QUESTÃO ORIGINAL, juntando todas
 *    as versões.
 *  - ANULAÇÃO: uma questão anulada vale ponto para todos, em todas as
 *    versões. Marcada com "*" no gabarito de cada versão.
 *  - Painel: resumo, distribuição de notas, % de acerto e discriminação por
 *    questão, alternativas marcadas e lista de ausentes.
 *  - Resultado do aluno: nota, respostas e gabarito da própria versão, só
 *    depois que o professor liberar.
 *
 * Nota = acertos × (10 ÷ número de questões).
 * ============================================================================
 */

const LETRA = z.enum(["A", "B", "C", "D", "E"]);
const VERSAO = z.enum(["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"]);
const PROVA = z.enum(["P1", "P2"]);
const ANULADA = "*";

const mapaItem = z.object({
  q: z.number(),                    // nº da questão original (igual em todas as versões)
  tema: z.string().optional(),
  posA: z.number().optional(),      // posição dessa questão na versão A (para o professor achar no papel)
  alt: z.record(z.string(), LETRA), // letra nesta versão -> letra canônica (a da versão A)
});
type MapaItem = z.infer<typeof mapaItem>;

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

async function exigirProfessor(sessionToken: string) {
  const teacher = await getTeacherAccountBySessionToken(sessionToken);
  if (!teacher) throw new TRPCError({ code: "FORBIDDEN", message: "Somente o professor pode fazer isso." });
  return teacher;
}

function limparNome(n: string | null | undefined): string {
  if (!n) return "";
  const p = n.split("\t");
  return (p.length >= 2 ? p[1] : n).trim();
}

function lerMapa(raw: string | null | undefined): MapaItem[] | null {
  try {
    const v = JSON.parse(raw || "null");
    if (Array.isArray(v) && v.length && typeof v[0] === "object" && v[0] && "q" in v[0]) return v as MapaItem[];
  } catch { /* sem mapa */ }
  return null;
}

/** Corrige um conjunto de respostas com um gabarito (posições "*" = anuladas, valem para todos). */
function corrigir(respostas: (string | null)[], gabarito: string[]) {
  const acertos = respostas.reduce((n, r, i) => n + ((gabarito[i] === ANULADA || (r !== null && r === gabarito[i])) ? 1 : 0), 0);
  const nota = Math.round(acertos * (10 / gabarito.length) * 100) / 100;
  return { acertos, nota };
}

const chaveLiberacao = (classId: number, provaType: string) => `resultado_liberado_${classId}_${provaType}`;
const chaveAnuladas = (classId: number, provaType: string) => `questoes_anuladas_${classId}_${provaType}`;

async function carregarGabaritos(db: any, classId: number, provaType: string) {
  const gabs = await db.select().from(examGabaritos)
    .where(and(eq(examGabaritos.classId, classId), eq(examGabaritos.provaType, provaType)));
  return gabs.map((g: any) => ({
    id: g.id,
    versao: g.examVersion as string,
    gabarito: JSON.parse(g.answers) as string[],
    mapa: lerMapa(g.difficulties),
  }));
}

async function recorrigirTurma(db: any, classId: number, provaType: string) {
  const gabs = await carregarGabaritos(db, classId, provaType);
  const porVersao = new Map<string, string[]>(gabs.map((g: any) => [g.versao, g.gabarito]));
  const notas = await db.select().from(examStudentGrades)
    .where(and(eq(examStudentGrades.classId, classId), eq(examStudentGrades.provaType, provaType)));
  let recorrigidos = 0;
  for (const n of notas) {
    const gabarito = porVersao.get(n.examVersion || "A");
    if (!gabarito) continue;
    const respostas = JSON.parse(n.answers || "[]") as (string | null)[];
    if (respostas.length !== gabarito.length) continue;
    const { acertos, nota } = corrigir(respostas, gabarito);
    await db.update(examStudentGrades).set({ score: nota.toFixed(2), correctCount: acertos }).where(eq(examStudentGrades.id, n.id));
    recorrigidos++;
  }
  return recorrigidos;
}


// ─── Gabarito comentado ───
// Um comentário por questão. Chave: nº da questão ORIGINAL ("q" do mapa, = numeração
// da versão A), que vale para todas as versões embaralhadas; ou "F:3" para a questão 3
// de uma versão sem mapa (ex.: 2ª chamada com questões próprias).
let tabelaComentariosPronta = false;
async function rawComentarios() {
  const raw = await getRawDb();
  if (!raw) throw new Error("Database not available");
  if (!tabelaComentariosPronta) {
    await raw.execute(`CREATE TABLE IF NOT EXISTS \`examComentarios\` (
      \`id\` int AUTO_INCREMENT PRIMARY KEY,
      \`classId\` int NOT NULL,
      \`provaType\` varchar(10) NOT NULL,
      \`chave\` varchar(20) NOT NULL,
      \`texto\` text NOT NULL,
      \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY \`uq_coment\` (\`classId\`, \`provaType\`, \`chave\`)
    )`);
    tabelaComentariosPronta = true;
  }
  return raw;
}
async function lerComentarios(classId: number, provaType: string): Promise<Record<string, string>> {
  const raw = await rawComentarios();
  const [rows] = await raw.execute("SELECT chave, texto FROM `examComentarios` WHERE classId = ? AND provaType = ?", [classId, provaType]);
  const out: Record<string, string> = {};
  for (const r of rows as any[]) out[r.chave] = r.texto;
  return out;
}
/** Comentário da questão na posição i (0-based) de uma versão. */
function comentarioDaPosicao(coment: Record<string, string>, versao: string, i: number, mapa: MapaItem[] | null): string | null {
  const proprio = coment[`${versao}:${i + 1}`];
  if (proprio) return proprio;
  if (mapa?.[i]) return coment[String(mapa[i].q)] ?? null;          // versão embaralhada: segue a questão original
  if (versao === "A") return coment[String(i + 1)] ?? null;         // versão A sem mapa: numeração própria
  return null;                                                       // outra versão sem mapa: só comentários "V:n"
}


// ─── Parecer individual ───
let tabelaPareceresPronta = false;
async function rawPareceres() {
  const raw = await getRawDb();
  if (!raw) throw new Error("Database not available");
  if (!tabelaPareceresPronta) {
    await raw.execute(`CREATE TABLE IF NOT EXISTS \`examPareceres\` (
      \`id\` int AUTO_INCREMENT PRIMARY KEY,
      \`classId\` int NOT NULL,
      \`provaType\` varchar(10) NOT NULL,
      \`memberId\` int NOT NULL,
      \`texto\` text NOT NULL,
      \`visivelAluno\` tinyint NOT NULL DEFAULT 0,
      \`autor\` varchar(255) NULL,
      \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY \`uq_parecer\` (\`classId\`, \`provaType\`, \`memberId\`)
    )`);
    tabelaPareceresPronta = true;
  }
  return raw;
}

async function montarRelatorio(input: { classId: number; provaType: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const gabs = await carregarGabaritos(db, input.classId, input.provaType);
  const gabPorVersao = new Map<string, any>(gabs.map((g: any) => [g.versao, g]));
  const n = gabs.length ? gabs[0].gabarito.length : 0;
  const temMapa = gabs.length > 0 && gabs.every((g: any) => !!g.mapa);

  const notas = await db.select().from(examStudentGrades)
    .where(and(eq(examStudentGrades.classId, input.classId), eq(examStudentGrades.provaType, input.provaType)));
  const membros = await db.select().from(members).where(eq(members.classId, input.classId));
  const nomePorId = new Map<number, string>(membros.map((m: any) => [m.id, limparNome(m.name)]));

  const corrigidos = notas
    .map((x: any) => ({ ...x, respostas: JSON.parse(x.answers || "[]") as (string | null)[], nota: Number(x.score) }))
    .filter((x: any) => x.respostas.length === n && gabPorVersao.has(x.examVersion || "A"));
  const idsCorrigidos = new Set(corrigidos.map((x: any) => x.memberId));
  const notasManuais = notas
    .filter((x: any) => !idsCorrigidos.has(x.memberId))
    .map((x: any) => ({ memberId: x.memberId, nome: nomePorId.get(x.memberId) || x.memberName || "", nota: Number(x.score) }));
  const comNota = new Set(notas.map((x: any) => x.memberId));
  const ausentes = membros.filter((m: any) => !comNota.has(m.id)).map((m: any) => ({ memberId: m.id, nome: limparNome(m.name) }))
    .sort((a: any, b: any) => a.nome.localeCompare(b.nome));

  const ordenados = [...corrigidos].sort((a: any, b: any) => b.nota - a.nota);
  const posicao = new Map<number, number>();
  ordenados.forEach((x: any, i: number) => {
    const anterior = i > 0 ? ordenados[i - 1] : null;
    posicao.set(x.memberId, anterior && anterior.nota === x.nota ? posicao.get(anterior.memberId)! : i + 1);
  });

  const temaTurma = new Map<string, { ac: number; tot: number }>();
  const alunos = corrigidos.map((x: any) => {
    const versao = x.examVersion || "A";
    const g = gabPorVersao.get(versao);
    const porTema = new Map<string, { ac: number; tot: number }>();
    const porQuestao = x.respostas.map((r: string | null, i: number) => {
      const m = temMapa ? g.mapa[i] : null;
      const tema = m?.tema || "Geral";
      const anulada = g.gabarito[i] === ANULADA;
      const correta = anulada ? ((m as any)?.c ?? null) : g.gabarito[i];
      const acertou = anulada || (r !== null && r === correta);
      if (!anulada) {
        const t = porTema.get(tema) || { ac: 0, tot: 0 }; t.tot++; if (acertou) t.ac++; porTema.set(tema, t);
        const tt = temaTurma.get(tema) || { ac: 0, tot: 0 }; tt.tot++; if (acertou) tt.ac++; temaTurma.set(tema, tt);
      }
      return { chave: m ? m.q : i + 1, posicao: i + 1, tema, marcada: r, correta, acertou, anulada };
    });
    return {
      memberId: x.memberId,
      nome: nomePorId.get(x.memberId) || x.memberName || "",
      versao,
      nota: x.nota,
      acertos: x.correctCount,
      total: n,
      posicao: posicao.get(x.memberId) ?? null,
      porQuestao,
      porTema: [...porTema.entries()].map(([tema, v]) => ({ tema, acertos: v.ac, total: v.tot })),
    };
  }).sort((a: any, b: any) => a.nome.localeCompare(b.nome));

  const valores = corrigidos.map((x: any) => x.nota);
  const media = valores.length ? valores.reduce((s: number, v: number) => s + v, 0) / valores.length : 0;

  const raw = await rawPareceres();
  const [linhas] = await raw.execute(
    "SELECT memberId, texto, visivelAluno, autor, updatedAt FROM `examPareceres` WHERE classId = ? AND provaType = ?",
    [input.classId, input.provaType]
  );
  const pareceres: Record<number, { texto: string; visivel: boolean; autor: string | null; atualizado: string }> = {};
  for (const l of linhas as any[]) pareceres[l.memberId] = { texto: l.texto, visivel: !!l.visivelAluno, autor: l.autor, atualizado: new Date(l.updatedAt).toISOString() };

  return {
    provaType: input.provaType,
    totalAlunos: membros.length,
    corrigidos: corrigidos.length,
    media: Math.round(media * 100) / 100,
    temMapa,
    temasTurma: [...temaTurma.entries()].map(([tema, v]) => ({ tema, pct: v.tot ? Math.round((v.ac / v.tot) * 1000) / 10 : 0, questoes: temMapa ? gabs[0].mapa.filter((m: any) => (m.tema || "Geral") === tema).length : n })),
    alunos,
    notasManuais,
    ausentes,
    pareceres,
  };
}

export const correcaoProvaRouter = router({
  /**
   * PROFESSOR: grava os gabaritos de todas as versões (e, opcionalmente, o
   * mapa de cada versão). Questões já anuladas continuam anuladas.
   */
  salvarGabaritos: publicProcedure
    .input(z.object({
      sessionToken: z.string(),
      classId: z.number(),
      provaType: PROVA,
      gabaritos: z.record(z.string(), z.array(LETRA).min(1).max(60)),
      mapas: z.record(z.string(), z.array(mapaItem)).optional(),
      examDate: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const teacher = await exigirProfessor(input.sessionToken);

      const versoes = Object.keys(input.gabaritos);
      const tamanhos = new Set(versoes.map(v => input.gabaritos[v].length));
      if (tamanhos.size !== 1) throw new TRPCError({ code: "BAD_REQUEST", message: "Todas as versões precisam ter o mesmo número de questões" });

      const anuladasRaw = await getSetting(chaveAnuladas(input.classId, input.provaType));
      const anuladas: number[] = anuladasRaw ? JSON.parse(anuladasRaw) : [];

      for (const versao of versoes) {
        if (!VERSAO.safeParse(versao).success) throw new TRPCError({ code: "BAD_REQUEST", message: `Versão inválida: ${versao} (use A a J)` });
        const mapa = input.mapas?.[versao];
        if (mapa && mapa.length !== input.gabaritos[versao].length) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `O mapa da versão ${versao} não tem o mesmo número de questões do gabarito` });
        }
        const gabarito: string[] = [...input.gabaritos[versao]];
        // Questões já anuladas continuam anuladas; a letra correta fica guardada no mapa ("c") para poder desfazer
        if (mapa) mapa.forEach((m, i) => { if (anuladas.includes(m.q)) { (m as any).c = gabarito[i]; gabarito[i] = ANULADA; } });

        const existe = await db.select().from(examGabaritos)
          .where(and(eq(examGabaritos.classId, input.classId), eq(examGabaritos.provaType, input.provaType), eq(examGabaritos.examVersion, versao)))
          .limit(1);
        const dados: any = {
          answers: JSON.stringify(gabarito),
          examDate: input.examDate,
          createdByName: teacher.name,
        };
        // Mantém o mapa já salvo se este envio não trouxer um novo
        if (mapa) dados.difficulties = JSON.stringify(mapa);
        else if (!existe.length) dados.difficulties = JSON.stringify(gabarito.map(() => "intermediario"));

        if (existe.length) await db.update(examGabaritos).set(dados).where(eq(examGabaritos.id, existe[0].id));
        else await db.insert(examGabaritos).values({ classId: input.classId, provaType: input.provaType, examVersion: versao, ...dados });
      }
      return { success: true, versoes, questoes: [...tamanhos][0], comMapa: !!input.mapas };
    }),

  /** PROFESSOR/MONITOR: dados da tela de correção de um cartão. */
  getContexto: publicProcedure
    .input(z.object({ sessionToken: z.string(), classId: z.number(), provaType: PROVA, memberId: z.number().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const quem = await autenticar(db, input.sessionToken, input.classId);

      const gabs = await carregarGabaritos(db, input.classId, input.provaType);
      const versoes = gabs.map((g: any) => g.versao).filter(Boolean).sort();
      const numQuestoes = gabs.length ? gabs[0].gabarito.length : 0;

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
          lancamento = { versao: g[0].examVersion || "A", respostas: JSON.parse(g[0].answers || "[]"), nota: Number(g[0].score), acertos: g[0].correctCount };
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

  /** PROFESSOR/MONITOR: corrige um cartão e grava a nota na planilha. */
  lancarCartao: publicProcedure
    .input(z.object({
      sessionToken: z.string(),
      classId: z.number(),
      provaType: PROVA,
      memberId: z.number(),
      versao: VERSAO,
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

      const { acertos, nota } = corrigir(input.respostas, gabarito);

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
      if (existe.length) await db.update(examStudentGrades).set(dados).where(eq(examStudentGrades.id, existe[0].id));
      else await db.insert(examStudentGrades).values({ memberId: input.memberId, provaType: input.provaType, ...dados });

      return { success: true, aluno: dados.memberName, acertos, total: gabarito.length, nota, corrigidoPor: quem.name, jaExistia: existe.length > 0 };
    }),

  /** PROFESSOR: recorrige todos os cartões já lançados com os gabaritos atuais. */
  recorrigirTodos: publicProcedure
    .input(z.object({ sessionToken: z.string(), classId: z.number(), provaType: PROVA }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await exigirProfessor(input.sessionToken);
      const recorrigidos = await recorrigirTurma(db, input.classId, input.provaType);
      return { success: true, recorrigidos };
    }),

  /**
   * PROFESSOR: anula (ou desanula) uma questão ORIGINAL em todas as versões
   * e recorrige a turma inteira na hora. Exige que o mapa tenha sido salvo.
   */
  anularQuestao: publicProcedure
    .input(z.object({ sessionToken: z.string(), classId: z.number(), provaType: PROVA, questaoOriginal: z.number(), anular: z.boolean() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await exigirProfessor(input.sessionToken);

      const gabs = await carregarGabaritos(db, input.classId, input.provaType);
      if (!gabs.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Nenhum gabarito cadastrado" });
      if (gabs.some((g: any) => !g.mapa)) throw new TRPCError({ code: "BAD_REQUEST", message: "Falta o mapa da prova em alguma versão — cadastre os gabaritos com o mapa antes de anular." });

      const chave = chaveAnuladas(input.classId, input.provaType);
      const anuladas: number[] = JSON.parse((await getSetting(chave)) || "[]");
      const novas = input.anular ? Array.from(new Set([...anuladas, input.questaoOriginal])) : anuladas.filter(q => q !== input.questaoOriginal);

      // Para desanular, precisamos do gabarito original: ele fica guardado no próprio mapa (campo "c").
      for (const g of gabs) {
        const pos = g.mapa.findIndex((m: any) => m.q === input.questaoOriginal);
        if (pos < 0) continue;
        const gabarito = [...g.gabarito];
        if (input.anular) {
          if (gabarito[pos] !== ANULADA) {
            g.mapa[pos] = { ...g.mapa[pos], c: gabarito[pos] }; // guarda a letra correta para poder desfazer
            gabarito[pos] = ANULADA;
          }
        } else {
          const original = (g.mapa[pos] as any).c;
          if (gabarito[pos] === ANULADA && original) gabarito[pos] = original;
        }
        await db.update(examGabaritos)
          .set({ answers: JSON.stringify(gabarito), difficulties: JSON.stringify(g.mapa) })
          .where(eq(examGabaritos.id, g.id));
      }
      await upsertSetting(chave, JSON.stringify(novas));
      const recorrigidos = await recorrigirTurma(db, input.classId, input.provaType);
      return { success: true, anuladas: novas, recorrigidos };
    }),

  /**
   * PROFESSOR: painel da prova — resumo, distribuição das notas, estatística
   * por questão (juntando as versões pelo mapa) e lista de ausentes.
   */
  getPainel: publicProcedure
    .input(z.object({ sessionToken: z.string(), classId: z.number(), provaType: PROVA }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await exigirProfessor(input.sessionToken);

      const gabs = await carregarGabaritos(db, input.classId, input.provaType);
      const gabPorVersao = new Map<string, any>(gabs.map((g: any) => [g.versao, g]));
      const n = gabs.length ? gabs[0].gabarito.length : 0;
      const temMapa = gabs.length > 0 && gabs.every((g: any) => !!g.mapa);

      const notas = await db.select().from(examStudentGrades)
        .where(and(eq(examStudentGrades.classId, input.classId), eq(examStudentGrades.provaType, input.provaType)));
      const alunos = await db.select().from(members).where(eq(members.classId, input.classId));

      // Só conta como "corrigido" quem tem respostas de cartão (não nota digitada à mão na planilha)
      const corrigidos = notas
        .map((x: any) => ({ ...x, respostas: JSON.parse(x.answers || "[]") as (string | null)[], nota: Number(x.score) }))
        .filter((x: any) => x.respostas.length === n && gabPorVersao.has(x.examVersion || "A"));

      const comNota = new Set(notas.map((x: any) => x.memberId));
      const ausentes = alunos
        .filter((a: any) => !comNota.has(a.id))
        .map((a: any) => ({ id: a.id, nome: limparNome(a.name) }))
        .sort((a: any, b: any) => a.nome.localeCompare(b.nome));

      const valores = corrigidos.map((x: any) => x.nota).sort((a: number, b: number) => a - b);
      const media = valores.length ? valores.reduce((s: number, v: number) => s + v, 0) / valores.length : 0;
      const mediana = valores.length ? (valores.length % 2 ? valores[(valores.length - 1) / 2] : (valores[valores.length / 2 - 1] + valores[valores.length / 2]) / 2) : 0;
      const faixas = [0, 2, 4, 5, 6, 7, 8, 9, 10];
      const distribuicao = faixas.slice(0, -1).map((ini, i) => {
        const fim = faixas[i + 1];
        return { faixa: `${ini}–${fim}`, alunos: valores.filter((v: number) => v >= ini && (i === faixas.length - 2 ? v <= fim : v < fim)).length };
      });

      // Grupos superior e inferior (27%) para o índice de discriminação
      const ordenados = [...corrigidos].sort((a: any, b: any) => b.nota - a.nota);
      const k = Math.max(1, Math.round(ordenados.length * 0.27));
      const superior = new Set(ordenados.slice(0, k).map((x: any) => x.id));
      const inferior = new Set(ordenados.slice(-k).map((x: any) => x.id));

      const anuladas: number[] = JSON.parse((await getSetting(chaveAnuladas(input.classId, input.provaType))) || "[]");

      // Estatística: por questão original (com mapa) ou por posição (sem mapa)
      type Est = { chave: number; tema?: string; posA?: number; corretaCanonica?: string; respondentes: number; acertos: number; brancos: number; marcadas: Record<string, number>; supAc: number; supN: number; infAc: number; infN: number };
      const est = new Map<number, Est>();
      for (const x of corrigidos) {
        const g = gabPorVersao.get(x.examVersion || "A");
        x.respostas.forEach((r: string | null, i: number) => {
          const m = temMapa ? g.mapa[i] : null;
          const chave = m ? m.q : i + 1;
          if (!est.has(chave)) est.set(chave, { chave, tema: m?.tema, posA: m?.posA ?? (temMapa ? undefined : i + 1), respondentes: 0, acertos: 0, brancos: 0, marcadas: {}, supAc: 0, supN: 0, infAc: 0, infN: 0 });
          const e = est.get(chave)!;
          const correta = g.gabarito[i] === ANULADA ? (m as any)?.c : g.gabarito[i];
          if (m && correta) e.corretaCanonica = m.alt[correta] || correta;
          else if (!m && correta) e.corretaCanonica = correta;
          e.respondentes++;
          const acertou = r !== null && r === correta;
          if (acertou) e.acertos++;
          if (r === null) e.brancos++;
          else {
            const canon = m ? (m.alt[r] || r) : r;
            e.marcadas[canon] = (e.marcadas[canon] || 0) + 1;
          }
          if (superior.has(x.id)) { e.supN++; if (acertou) e.supAc++; }
          if (inferior.has(x.id)) { e.infN++; if (acertou) e.infAc++; }
        });
      }
      const questoes = [...est.values()]
        .map(e => {
          const pct = e.respondentes ? e.acertos / e.respondentes : 0;
          const disc = (e.supN ? e.supAc / e.supN : 0) - (e.infN ? e.infAc / e.infN : 0);
          let alerta: string | null = null;
          if (e.respondentes >= 10) {
            if (pct < 0.3) alerta = "Muito difícil — revisar enunciado e gabarito";
            else if (disc < 0) alerta = "Discriminação negativa — os melhores alunos erraram mais; conferir gabarito";
            else if (disc < 0.1 && pct < 0.9) alerta = "Discrimina pouco";
          }
          return {
            questaoOriginal: temMapa ? e.chave : null,
            posicao: temMapa ? null : e.chave,
            posA: e.posA ?? null,
            tema: e.tema ?? null,
            correta: e.corretaCanonica ?? null,
            pctAcerto: Math.round(pct * 1000) / 10,
            discriminacao: Math.round(disc * 100) / 100,
            marcadas: e.marcadas,
            brancos: e.brancos,
            anulada: temMapa ? anuladas.includes(e.chave) : false,
            alerta,
          };
        })
        .sort((a, b) => (a.posA ?? a.posicao ?? 0) - (b.posA ?? b.posicao ?? 0));

      const liberado = (await getSetting(chaveLiberacao(input.classId, input.provaType))) === "1";

      return {
        totalAlunos: alunos.length,
        corrigidos: corrigidos.length,
        notasManuais: notas.length - corrigidos.length,
        ausentes,
        media: Math.round(media * 100) / 100,
        mediana: Math.round(mediana * 100) / 100,
        aprovados6: valores.filter((v: number) => v >= 6).length,
        distribuicao,
        porVersao: gabs.map((g: any) => ({ versao: g.versao, alunos: corrigidos.filter((x: any) => (x.examVersion || "A") === g.versao).length })),
        temMapa,
        questoes,
        anuladas,
        liberado,
      };
    }),

  /** PROFESSOR: comentários do gabarito + estrutura das versões (para o editor). */
  getComentarios: publicProcedure
    .input(z.object({ sessionToken: z.string(), classId: z.number(), provaType: PROVA }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await exigirProfessor(input.sessionToken);
      const gabs = await carregarGabaritos(db, input.classId, input.provaType);
      const comentarios = await lerComentarios(input.classId, input.provaType);
      const versoes = gabs
        .map((g: any) => ({
          versao: g.versao,
          temMapa: !!g.mapa,
          questoes: g.gabarito.map((letra: string, i: number) => ({
            posicao: i + 1,
            q: g.mapa?.[i]?.q ?? null,
            tema: g.mapa?.[i]?.tema ?? null,
            gabarito: letra === ANULADA ? (g.mapa?.[i] as any)?.c ?? "anulada" : letra,
          })),
        }))
        .sort((a: any, b: any) => a.versao.localeCompare(b.versao));
      return { versoes, comentarios };
    }),

  /** PROFESSOR: grava comentários (texto vazio apaga). */
  salvarComentarios: publicProcedure
    .input(z.object({
      sessionToken: z.string(),
      classId: z.number(),
      provaType: PROVA,
      comentarios: z.record(z.string().regex(/^([A-J]:)?\d{1,3}$/), z.string().max(5000)),
    }))
    .mutation(async ({ input }) => {
      await exigirProfessor(input.sessionToken);
      const raw = await rawComentarios();
      let gravados = 0, apagados = 0;
      for (const [chave, texto] of Object.entries(input.comentarios)) {
        if (texto.trim()) {
          await raw.execute(
            "INSERT INTO `examComentarios` (classId, provaType, chave, texto) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE texto = VALUES(texto)",
            [input.classId, input.provaType, chave, texto.trim()]
          );
          gravados++;
        } else {
          await raw.execute("DELETE FROM `examComentarios` WHERE classId = ? AND provaType = ? AND chave = ?", [input.classId, input.provaType, chave]);
          apagados++;
        }
      }
      return { success: true, gravados, apagados };
    }),

  /**
   * PROFESSOR: desempenho detalhado de cada aluno (por questão e por tema),
   * médias da turma por tema e pareceres — base da exportação e dos pareceres.
   */
  getRelatorio: publicProcedure
    .input(z.object({ sessionToken: z.string(), classId: z.number(), provaType: PROVA }))
    .query(async ({ input }) => {
      await exigirProfessor(input.sessionToken);
      return montarRelatorio(input);
    }),

  /** PROFESSOR: há IA configurada no servidor? */
  iaDisponivel: publicProcedure.query(() => ({ disponivel: iaConfigurada() })),

  /**
   * PROFESSOR: gera um RASCUNHO de parecer com IA (prova + padrão de respostas
   * + gabarito comentado + jogo). Não salva — o professor revisa e salva.
   */
  gerarParecerIA: publicProcedure
    .input(z.object({ sessionToken: z.string(), classId: z.number(), provaType: PROVA, memberId: z.number() }))
    .mutation(async ({ input }) => {
      await exigirProfessor(input.sessionToken);
      const rel: any = await montarRelatorio(input);
      const a = rel.alunos.find((x: any) => x.memberId === input.memberId);
      if (!a) throw new TRPCError({ code: "NOT_FOUND", message: "Aluno sem cartão corrigido nesta prova." });
      const comentarios = await lerComentarios(input.classId, input.provaType);
      const db = await getDb();
      const gabs = db ? await carregarGabaritos(db, input.classId, input.provaType) : [];
      const mapa = gabs.find((g: any) => g.versao === a.versao)?.mapa ?? null;
      const temaTurma = new Map<string, number>(rel.temasTurma.map((t: any) => [t.tema, t.pct]));
      const pctQuestaoTurma = new Map<number, { ac: number; tot: number }>();
      for (const al of rel.alunos) for (const q of al.porQuestao) {
        const e = pctQuestaoTurma.get(q.chave) || { ac: 0, tot: 0 }; e.tot++; if (q.acertou) e.ac++; pctQuestaoTurma.set(q.chave, e);
      }
      const dados = {
        prova: input.provaType,
        aluno: { versao: a.versao }, // sem nome: só dados de desempenho vão para a IA
        nota: a.nota, acertos: a.acertos, totalQuestoes: a.total,
        mediaTurma: rel.media, posicao: a.posicao, alunosCorrigidos: rel.corrigidos,
        porTema: a.porTema.map((t: any) => ({ tema: t.tema, acertos: t.acertos, total: t.total, pctAluno: Math.round((t.acertos / Math.max(1, t.total)) * 100), pctTurma: Math.round(temaTurma.get(t.tema) ?? 0) })),
        questoes: a.porQuestao.map((q: any, i: number) => {
          const t = pctQuestaoTurma.get(q.chave);
          return {
            numeroNaVersaoDoAluno: q.posicao,
            tema: q.tema,
            resultado: q.anulada ? "anulada" : q.marcada === null ? "em branco" : q.acertou ? "acertou" : "errou",
            pctAcertoTurma: t ? Math.round((t.ac / t.tot) * 100) : null,
            gabaritoComentado: !q.acertou && !q.anulada ? comentarioDaPosicao(comentarios, a.versao, i, mapa) : undefined,
          };
        }),
        jogo: await dadosDoJogo(input.memberId, input.classId),
      };
      const texto = await gerarParecerComIA(dados);
      return { texto };
    }),

  /** PROFESSOR: grava o parecer individual (texto vazio apaga). */
  salvarParecer: publicProcedure
    .input(z.object({ sessionToken: z.string(), classId: z.number(), provaType: PROVA, memberId: z.number(), texto: z.string().max(10000), visivelAluno: z.boolean() }))
    .mutation(async ({ input }) => {
      const prof = await exigirProfessor(input.sessionToken);
      const raw = await rawPareceres();
      if (!input.texto.trim()) {
        await raw.execute("DELETE FROM `examPareceres` WHERE classId = ? AND provaType = ? AND memberId = ?", [input.classId, input.provaType, input.memberId]);
        return { success: true, apagado: true };
      }
      await raw.execute(
        `INSERT INTO \`examPareceres\` (classId, provaType, memberId, texto, visivelAluno, autor) VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE texto = VALUES(texto), visivelAluno = VALUES(visivelAluno), autor = VALUES(autor)`,
        [input.classId, input.provaType, input.memberId, input.texto.trim(), input.visivelAluno ? 1 : 0, (prof as any).name || null]
      );
      return { success: true, apagado: false };
    }),

  /** PROFESSOR: libera (ou recolhe) a visualização do resultado para os alunos. */
  liberarResultado: publicProcedure
    .input(z.object({ sessionToken: z.string(), classId: z.number(), provaType: PROVA, liberar: z.boolean() }))
    .mutation(async ({ input }) => {
      await exigirProfessor(input.sessionToken);
      await upsertSetting(chaveLiberacao(input.classId, input.provaType), input.liberar ? "1" : "0");
      return { success: true, liberado: input.liberar };
    }),

  /**
   * ALUNO: o próprio resultado (nota, respostas e gabarito da sua versão),
   * só depois da liberação pelo professor.
   */
  getMeuResultado: publicProcedure
    .input(z.object({ sessionToken: z.string(), provaType: PROVA }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const conta = await getStudentAccountBySessionToken(input.sessionToken);
      if (!conta?.memberId) throw new TRPCError({ code: "FORBIDDEN", message: "Faça login como aluno" });

      const membro = await db.select().from(members).where(eq(members.id, conta.memberId)).limit(1);
      const classId = membro[0]?.classId;
      if (!classId) return { liberado: false as const };

      const liberado = (await getSetting(chaveLiberacao(classId, input.provaType))) === "1";
      if (!liberado) return { liberado: false as const };

      const g = await db.select().from(examStudentGrades)
        .where(and(eq(examStudentGrades.memberId, conta.memberId), eq(examStudentGrades.provaType, input.provaType)))
        .limit(1);
      if (!g.length) return { liberado: true as const, fezProva: false as const };

      const versao = g[0].examVersion || "A";
      const gab = await db.select().from(examGabaritos)
        .where(and(eq(examGabaritos.classId, classId), eq(examGabaritos.provaType, input.provaType), eq(examGabaritos.examVersion, versao)))
        .limit(1);
      const gabarito: string[] = gab.length ? JSON.parse(gab[0].answers) : [];
      const respostas: (string | null)[] = JSON.parse(g[0].answers || "[]");
      const mapa = gab.length ? lerMapa(gab[0].difficulties) : null;
      const comentarios = await lerComentarios(classId, input.provaType);

      const rawP = await rawPareceres();
      const [lp] = await rawP.execute(
        "SELECT texto FROM `examPareceres` WHERE classId = ? AND provaType = ? AND memberId = ? AND visivelAluno = 1 LIMIT 1",
        [classId, input.provaType, conta.memberId]
      );
      const parecer: string | null = (lp as any[])[0]?.texto ?? null;

      return {
        liberado: true as const,
        fezProva: true as const,
        parecer,
        versao,
        nota: Number(g[0].score),
        acertos: g[0].correctCount,
        total: gabarito.length || respostas.length,
        questoes: respostas.map((r, i) => ({
          numero: i + 1,
          marcada: r,
          correta: gabarito[i] === ANULADA ? null : (gabarito[i] ?? null),
          anulada: gabarito[i] === ANULADA,
          acertou: gabarito[i] === ANULADA || (r !== null && r === gabarito[i]),
          tema: mapa?.[i]?.tema ?? null,
          comentario: comentarioDaPosicao(comentarios, versao, i, mapa),
        })),
      };
    }),
});
