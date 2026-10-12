#!/usr/bin/env node
/**
 * aplicar_v3.mjs — aplica as edições da v3 nos arquivos que já existem no projeto.
 *
 *   Rodar na RAIZ do projeto (pasta leaderboard-farmacologia):
 *       node aplicar_v3.mjs
 *
 * O que faz (cada item é independente; o relatório final diz o que foi aplicado):
 *   1. server/routers/game.ts  → jogo por turma (banco da disciplina, chefes 1–15,
 *                                rotas getConfigTurma / listarDisciplinas / definirDisciplinaTurma)
 *   2. server/routers.ts       → registra notificacoes + aviso no celular ao publicar material
 *   3. client/src/pages/StudentArea.tsx → cartão "Receba avisos no celular", aba "Provas"
 *                                         e abertura direta na aba (?tab=materiais)
 *   4. client/src/App.tsx      → rota /correcao/painel (Painel da Prova, v2)
 *   5. client/index.html       → manifesto e ícones (necessário para notificações no iPhone)
 *
 * É seguro rodar de novo: o que já foi aplicado é pulado.
 * Para desfazer tudo: git checkout -- server client
 */
import fs from "node:fs";

const relatorio = [];
const ok = (m) => relatorio.push("  ✔ " + m);
const pulo = (m) => relatorio.push("  • " + m);
const falha = (m) => relatorio.push("  ✘ " + m);

function editar(caminho, fn) {
  if (!fs.existsSync(caminho)) { falha(`${caminho}: arquivo não encontrado`); return; }
  const original = fs.readFileSync(caminho, "utf8");
  const crlf = original.includes("\r\n");
  const antes = original.replace(/\r\n/g, "\n"); // Windows: trabalha com \n e devolve \r\n
  const depois = fn(antes);
  if (depois !== antes) fs.writeFileSync(caminho, crlf ? depois.replace(/\n/g, "\r\n") : depois);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1) server/routers/game.ts
// ─────────────────────────────────────────────────────────────────────────────
relatorio.push("server/routers/game.ts");
editar("server/routers/game.ts", (s) => {
  if (s.includes("questsDaTurma")) { pulo("já aplicado"); return s; }

  // import
  const imp = /import \{ ALL_GAME_QUESTIONS \} from "\.\.\/\.\.\/shared\/gameQuestions";\n/;
  if (!imp.test(s)) { falha("import de gameQuestions não encontrado — nada alterado neste arquivo"); return s; }
  s = s.replace(imp, (m) => m + 'import { TODAS_AS_QUESTOES, disciplinaPorNomeTurma, semanasDaDisciplina, NOMES_DISCIPLINA, type DisciplinaJogo } from "../../shared/gameBanks";\n');
  ok("import de shared/gameBanks");

  // BUILTIN_QUESTS a partir de todos os bancos, com a disciplina de cada questão
  const bq = "const BUILTIN_QUESTS = ALL_GAME_QUESTIONS.map(gq => ({";
  if (!s.includes(bq)) { falha("definição de BUILTIN_QUESTS não encontrada — revise à mão"); return s; }
  s = s.replace(bq, "const BUILTIN_QUESTS = TODAS_AS_QUESTOES.map(gq => ({\n  disciplina: gq.disciplina as DisciplinaJogo,");
  ok("BUILTIN_QUESTS com campo disciplina");

  // helpers
  const helpers = `
// ─── Jogo por turma: cada turma joga o banco da sua disciplina ───
const _cacheDisciplina = new Map<number, { d: DisciplinaJogo; ate: number }>();
async function disciplinaDaTurma(classId: number): Promise<DisciplinaJogo> {
  const c = _cacheDisciplina.get(classId);
  if (c && c.ate > Date.now()) return c.d;
  let d: DisciplinaJogo = "farmaco1";
  try {
    const { getSetting } = await import("../db");
    const fixada = await getSetting(\`jogo_disciplina_\${classId}\`);
    if (fixada === "farmaco1" || fixada === "farmaco2") {
      d = fixada;
    } else {
      const raw = await getRawDb();
      if (raw) {
        const [rows] = await raw.execute("SELECT * FROM \`classes\` WHERE id = ? LIMIT 1", [classId]);
        const t: any = (rows as any[])[0] || {};
        d = disciplinaPorNomeTurma([t.name, t.discipline, t.disciplina, t.course, t.curso]);
      }
    }
  } catch (e) {
    console.warn("[disciplinaDaTurma]", e);
  }
  _cacheDisciplina.set(classId, { d, ate: Date.now() + 5 * 60 * 1000 });
  return d;
}
async function questsDaTurma(classId: number) {
  const d = await disciplinaDaTurma(classId);
  return [...BUILTIN_QUESTS].filter(q => q.disciplina === d);
}

`;
  const ancora = "// ─── Achievement definitions ───";
  if (s.includes(ancora)) s = s.replace(ancora, helpers + ancora);
  else s = s.replace("export const gameRouter = router({", helpers + "export const gameRouter = router({");
  ok("funções disciplinaDaTurma / questsDaTurma");

  // revisão da semana: classId opcional
  const rev = /getWeekReviewQuestions: publicProcedure\s*\n\s*\.input\(z\.object\(\{ weekNumber: z\.number\(\) \}\)\)\s*\n\s*\.query\(\(\{ input \}\) => \{\s*\n(\s*)const weekQuests = BUILTIN_QUESTS\.filter\(/;
  if (rev.test(s)) {
    s = s.replace(rev, (_m, ind) =>
      `getWeekReviewQuestions: publicProcedure\n    .input(z.object({ weekNumber: z.number(), classId: z.number().optional() }))\n    .query(async ({ input }) => {\n${ind}const weekQuests = (input.classId ? await questsDaTurma(input.classId) : BUILTIN_QUESTS).__FILTRO_REVISAO__(`);
    ok("getWeekReviewQuestions aceita classId");
  } else pulo("getWeekReviewQuestions com formato diferente — mantido como está");

  // filtros por semana → banco da turma
  let n = 0;
  s = s.replace(/BUILTIN_QUESTS(\s*)\.filter\(/g, (_m, esp) => { n++; return `(await questsDaTurma(input.classId))${esp}.filter(`; });
  s = s.replace("__FILTRO_REVISAO__(", "filter(");
  ok(`${n} listas de missões agora filtradas pela turma`);

  // chefes: todas as semanas da disciplina (antes ia só até a 10)
  const laco = /for \(let week = 1; week <= \d+; week\+\+\) \{/;
  if (laco.test(s)) { s = s.replace(laco, "for (const week of semanasDaDisciplina(await disciplinaDaTurma(input.classId))) {"); ok("status dos chefes cobre todas as semanas (1–15)"); }
  else pulo("laço dos chefes não encontrado — verifique getAllBossStatuses");

  // rotas novas
  const rotas = `  /**
   * Configuração do jogo para a turma (disciplina e semanas disponíveis)
   */
  getConfigTurma: publicProcedure
    .input(z.object({ classId: z.number() }))
    .query(async ({ input }) => {
      const disciplina = await disciplinaDaTurma(input.classId);
      const semanas = semanasDaDisciplina(disciplina);
      return { disciplina, nomeDisciplina: NOMES_DISCIPLINA[disciplina], semanas, disponivel: semanas.length > 0 };
    }),

  /** Lista as turmas e a disciplina do jogo de cada uma (para conferência). */
  listarDisciplinas: publicProcedure.query(async () => {
    const raw = await getRawDb();
    if (!raw) return [];
    const [rows] = await raw.execute("SELECT id, name FROM \`classes\` ORDER BY id");
    const out = [];
    for (const r of rows as any[]) {
      const d = await disciplinaDaTurma(r.id);
      out.push({ classId: r.id, turma: r.name, disciplina: d, nome: NOMES_DISCIPLINA[d] });
    }
    return out;
  }),

  /** Professor fixa a disciplina do jogo de uma turma ("auto" volta a deduzir pelo nome). */
  definirDisciplinaTurma: publicProcedure
    .input(z.object({ sessionToken: z.string(), classId: z.number(), disciplina: z.enum(["farmaco1", "farmaco2", "auto"]) }))
    .mutation(async ({ input }) => {
      const { getTeacherAccountBySessionToken, upsertSetting } = await import("../db");
      const prof = await getTeacherAccountBySessionToken(input.sessionToken);
      if (!prof) throw new Error("Acesso negado");
      await upsertSetting(\`jogo_disciplina_\${input.classId}\`, input.disciplina === "auto" ? "" : input.disciplina);
      _cacheDisciplina.delete(input.classId);
      return { success: true, disciplina: await disciplinaDaTurma(input.classId) };
    }),

`;
  const iq = s.indexOf("getAllQuests: publicProcedure");
  if (iq >= 0) {
    const ic = s.lastIndexOf("/**", iq);
    const pos = ic >= 0 && iq - ic < 200 ? s.lastIndexOf("\n", ic) + 1 : s.lastIndexOf("\n", iq) + 1;
    s = s.slice(0, pos) + rotas + s.slice(pos);
    ok("rotas getConfigTurma, listarDisciplinas, definirDisciplinaTurma");
  } else falha("âncora getAllQuests não encontrada — rotas novas NÃO adicionadas");
  return s;
});

// ─────────────────────────────────────────────────────────────────────────────
// 2) server/routers.ts
// ─────────────────────────────────────────────────────────────────────────────
relatorio.push("server/routers.ts");
editar("server/routers.ts", (s) => {
  if (s.includes("notificacoesRouter")) { pulo("já aplicado"); return s; }
  const impAncora = /import \{ (materiaisGrandesRouter|correcaoProvaRouter) \} from "\.\/routers\/(materiaisGrandes|correcaoProva)";\n/;
  if (!impAncora.test(s)) { falha("import de materiaisGrandes/correcaoProva não encontrado"); return s; }
  s = s.replace(impAncora, (m) => m + 'import { notificacoesRouter } from "./routers/notificacoes";\nimport { avisarMaterialNovo } from "./push";\n');
  ok("imports");

  const reg = /(\n(\s*)(materiaisGrandes: materiaisGrandesRouter|correcaoProva: correcaoProvaRouter),)/;
  if (reg.test(s)) { s = s.replace(reg, (m, _a, ind) => m + `\n${ind}notificacoes: notificacoesRouter,`); ok("notificacoes registrado no appRouter"); }
  else falha("registro no appRouter não encontrado — adicione 'notificacoes: notificacoesRouter,' à mão");

  const create = /(const id = await db\.createMaterial\(data\);\n)(\s*)return \{ id \};/;
  if (create.test(s)) {
    s = s.replace(create, (_m, l1, ind) => `${l1}${ind}if (data.isVisible !== 0) avisarMaterialNovo({ title: data.title, type: data.type, module: data.module });\n${ind}return { id };`);
    ok("aviso no celular em materials.create (links, comentários, arquivos por link)");
  } else falha("materials.create não encontrado — aviso não adicionado nessa rota");

  const upload = /(\n(\s*)week: input\.week,\n\s*\}\);\n)(\s*)return \{ id, url \};/;
  if (upload.test(s)) {
    s = s.replace(upload, (_m, bloco, _i, ind) => `${bloco}${ind}avisarMaterialNovo({ title: input.title, type: "file", module: input.module });\n${ind}return { id, url };`);
    ok("aviso no celular em materials.upload (envio antigo)");
  } else pulo("materials.upload não encontrado (sem problema: o envio novo usa materiaisGrandes)");
  return s;
});

// ─────────────────────────────────────────────────────────────────────────────
// 3) client/src/pages/StudentArea.tsx
// ─────────────────────────────────────────────────────────────────────────────
relatorio.push("client/src/pages/StudentArea.tsx");
editar("client/src/pages/StudentArea.tsx", (s) => {
  const imp = 'import StudentNotificationBanner from "@/components/StudentNotificationBanner";\n';
  if (!s.includes("AtivarNotificacoes")) {
    if (s.includes(imp)) {
      s = s.replace(imp, imp + 'import AtivarNotificacoes from "@/components/AtivarNotificacoes";\n');
      const banner = /(\{memberId && \(\s*<StudentNotificationBanner[^>]*\/>\s*\)\})/;
      if (banner.test(s)) { s = s.replace(banner, (m) => m + "\n\n        <AtivarNotificacoes sessionToken={studentSessionToken} />"); ok("cartão de notificações"); }
      else falha("posição do cartão não encontrada — inclua <AtivarNotificacoes sessionToken={studentSessionToken} /> à mão");
    } else falha("import do StudentNotificationBanner não encontrado");
  } else pulo("cartão de notificações já aplicado");

  const tab = 'const [activeTab, setActiveTab] = useState("cronograma");';
  if (s.includes(tab)) {
    s = s.replace(tab, 'const [activeTab, setActiveTab] = useState(() => {\n    try { return new URLSearchParams(window.location.search).get("tab") || "cronograma"; } catch { return "cronograma"; }\n  });');
    ok("abre direto na aba indicada (?tab=materiais)");
  } else pulo("aba inicial já ajustada");

  if (!s.includes("MeuResultadoProva")) {
    const aba = /(\{ key: "media", label: "Média", icon: <BarChart3 size=\{14\} \/> \},)/;
    const render = '{activeTab === "materiais" && (';
    if (s.includes(imp) && aba.test(s) && s.includes(render)) {
      s = s.replace(imp, imp + 'import MeuResultadoProva from "@/components/MeuResultadoProva";\n');
      s = s.replace(aba, (m) => m + '\n              { key: "provas", label: "Provas", icon: <FileText size={14} /> },');
      s = s.replace(render, '{activeTab === "provas" && <MeuResultadoProva token={studentSessionToken} />}\n\n        ' + render);
      ok('aba "Provas" (resultado da prova para o aluno)');
    } else falha('aba "Provas": âncoras não encontradas — veja o roteiro');
  } else pulo('aba "Provas" já aplicada');
  return s;
});

// ─────────────────────────────────────────────────────────────────────────────
// 4) client/src/App.tsx
// ─────────────────────────────────────────────────────────────────────────────
relatorio.push("client/src/App.tsx");
editar("client/src/App.tsx", (s) => {
  if (s.includes("PainelProva")) { pulo("já aplicado"); return s; }
  const imp = /import CorrecaoCartao from (["'])([^"']*)CorrecaoCartao\1;\n/;
  const rota = /(\s*)<Route path="\/correcao" component=\{CorrecaoCartao\} \/>/;
  if (imp.test(s) && rota.test(s)) {
    s = s.replace(imp, (m, q, base) => m + `import PainelProva from ${q}${base}PainelProva${q};\n`);
    s = s.replace(rota, (m, ind) => `${ind}<Route path="/correcao/painel" component={PainelProva} />` + m);
    ok("rota /correcao/painel");
  } else falha("rota /correcao ou import do CorrecaoCartao não encontrados");
  return s;
});

// ─────────────────────────────────────────────────────────────────────────────
// 5) client/index.html
// ─────────────────────────────────────────────────────────────────────────────
relatorio.push("client/index.html");
editar("client/index.html", (s) => {
  if (s.includes("manifest.webmanifest")) { pulo("já aplicado"); return s; }
  if (!s.includes("</head>")) { falha("</head> não encontrado"); return s; }
  s = s.replace("</head>", '    <link rel="manifest" href="/manifest.webmanifest" />\n    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />\n    <meta name="theme-color" content="#0A1628" />\n    <meta name="apple-mobile-web-app-capable" content="yes" />\n  </head>');
  ok("manifesto, ícone e cor do app");
  return s;
});

console.log("\nResultado da aplicação da v3:\n" + relatorio.join("\n"));
console.log("\nConfira com: git diff --stat   (para desfazer: git checkout -- server client)\n");
