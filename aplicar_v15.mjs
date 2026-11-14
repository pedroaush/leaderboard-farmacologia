#!/usr/bin/env node
/**
 * aplicar_v15.mjs — Destaques e Conquistas no Painel do Professor
 *
 *  • Toda ação que falhar passa a mostrar a mensagem de erro (antes falhava em silêncio).
 *  • Conquistas: seletor de turma. A atribuição automática (Top N, PF mínimo) e a
 *    prévia passam a valer SÓ para a turma escolhida — antes misturava Medicina,
 *    Nutrição etc. num ranking só, e ao rodar para uma turma revogava badges da outra.
 *  • Conquistas: lista de alunos para atribuir filtrada pela turma, em ordem alfabética
 *    e sem a matrícula colada no nome.
 *  • Destaques: nome do aluno destaque sem a matrícula colada.
 *
 *   Rodar na raiz do projeto:  node aplicar_v15.mjs
 *   Desfazer (antes do commit): git checkout -- client server
 */
import fs from "node:fs";

const rel = [];
const ok = (m) => rel.push("  ✔ " + m);
const pulo = (m) => rel.push("  • " + m);
const falha = (m) => rel.push("  ✘ " + m);

function editar(caminho, fn) {
  if (!fs.existsSync(caminho)) { falha(`${caminho}: não encontrado`); return; }
  const original = fs.readFileSync(caminho, "utf8");
  const crlf = original.includes("\r\n");
  const antes = original.replace(/\r\n/g, "\n");
  const depois = fn(antes);
  if (depois !== antes) fs.writeFileSync(caminho, crlf ? depois.replace(/\n/g, "\r\n") : depois);
}
/** Troca dentro de um trecho [ini, fim) do texto. */
function noTrecho(s, iniMarca, fimMarca, fn) {
  const i = s.indexOf(iniMarca);
  if (i < 0) return null;
  let f = fimMarca ? s.indexOf(fimMarca, i + iniMarca.length) : -1;
  if (f < 0) f = s.length;
  const novo = fn(s.slice(i, f));
  return novo == null ? null : s.slice(0, i) + novo + s.slice(f);
}

// ─────────────────────────── client/src/pages/Admin.tsx
rel.push("client/src/pages/Admin.tsx — Destaques");
editar("client/src/pages/Admin.tsx", (s) => {
  const r = noTrecho(s, "function HighlightsManager(", "\nfunction ", (t) => {
    let n = 0;
    t = t.replace(/(setTopTeam\(""\); setTopStudent\(""\);\n(\s*)\},\n)(\s*\}\);)/, (m, a, ind, b) => { n++; return `${a}${ind}onError: (e) => toast.error(e.message),\n${b}`; });
    t = t.replace(/(toast\.success\("Destaque removido!"\); \},\n)(\s*\}\);)/, (m, a, b) => { n++; return `${a}    onError: (e) => toast.error(e.message),\n${b}`; });
    if (t.includes("onError: (e) => toast.error(e.message),\n  });") && n === 0) { pulo("mensagens de erro já presentes"); return t; }
    n ? ok(`mensagens de erro em ${n} ação(ões)`) : falha("formato diferente — mensagens de erro não adicionadas");
    return t;
  });
  if (r == null) { falha("HighlightsManager não encontrado"); return s; }
  return r;
});

rel.push("client/src/pages/Admin.tsx — Conquistas");
editar("client/src/pages/Admin.tsx", (s) => {
  const r = noTrecho(s, "function BadgesManager(", "\nfunction ", (t) => {
    if (t.includes("turmaConquistas")) { pulo("já aplicado"); return t; }
    // 1) erros visíveis
    let n = 0;
    for (const msg of ["Badge criado!", "Badge atribuído!", "Badge removido!", "Badge excluído!", "Regra de auto-atribuição salva!"]) {
      const de = `toast.success("${msg}"); } });`;
      if (t.includes(de)) { t = t.replace(de, `toast.success("${msg}"); }, onError: (e) => toast.error(e.message) });`); n++; }
    }
    n ? ok(`mensagens de erro em ${n} ação(ões)`) : falha("mensagens de erro: formato diferente");

    // 2) estado da turma
    const ganchoEstado = "const [previewRule, setPreviewRule] = useState<string | null>(null);";
    if (!t.includes(ganchoEstado)) { falha("estado previewRule não encontrado — seletor de turma não adicionado"); return t; }
    t = t.replace(ganchoEstado, ganchoEstado +
      "\n  const [turmaConquistas, setTurmaConquistas] = useState<number | undefined>(1);" +
      "\n  const { data: turmasConquistas = [] } = trpc.classes.listAll.useQuery();");

    // 3) chamadas com a turma
    const antes = t;
    t = t.replace(/autoAssignMutation\.mutate\(\{ password \}\)/g, "autoAssignMutation.mutate({ password, classId: turmaConquistas })");
    t = t.replace(/autoAssignMutation\.mutate\(\{ password, badgeId: badge\.id \}\)/g, "autoAssignMutation.mutate({ password, badgeId: badge.id, classId: turmaConquistas })");
    t = t.replace(/\{ password, rule: previewRuleStr \?\? "" \}/, '{ password, rule: previewRuleStr ?? "", classId: turmaConquistas }');
    t !== antes ? ok("atribuição automática e prévia usam a turma escolhida") : falha("chamadas de auto-atribuição não encontradas");

    // 4) lista de alunos para atribuir
    const lista = /return leaderboard\.teams\.flatMap\(t => t\.members\.map\(m => \(\{ id: m\.id, name: m\.name, teamName: t\.name \}\)\)\);\n(\s*)\}, \[leaderboard\]\);/;
    if (lista.test(t)) {
      t = t.replace(lista, (m, ind) =>
        "return leaderboard.teams\n" +
        "      .filter((t: any) => !turmaConquistas || t.classId === turmaConquistas)\n" +
        "      .flatMap(t => t.members.map(m => { const p = (m.name || \"\").split(\"\\t\"); return { id: m.id, name: (p.length >= 2 ? p[1] : m.name).trim(), teamName: t.name }; }))\n" +
        "      .sort((a, b) => a.name.localeCompare(b.name, \"pt-BR\"));\n" +
        `${ind}}, [leaderboard, turmaConquistas]);`);
      ok("lista de alunos filtrada pela turma, em ordem alfabética");
    } else pulo("lista de alunos com formato diferente — mantida");

    // 5) seletor na tela (antes do botão "Executar Todas as Regras")
    const botao = /(\n(\s*)<button\n\s*onClick=\{\(\) => autoAssignMutation\.mutate\(\{ password, classId: turmaConquistas \}\)\})/;
    if (botao.test(t)) {
      t = t.replace(botao, (m, tudo, ind) =>
        `\n${ind}<div className="flex items-center gap-2">` +
        `\n${ind}<select value={turmaConquistas ?? ""} onChange={e => { setTurmaConquistas(e.target.value ? Number(e.target.value) : undefined); setAutoAssignResult(null); }}` +
        `\n${ind}  className="px-2 py-1.5 rounded-md bg-background border border-border text-xs text-foreground" title="Turma em que as regras serão aplicadas">` +
        `\n${ind}  <option value="">Todas as turmas (ranking único)</option>` +
        `\n${ind}  {(turmasConquistas as any[]).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}` +
        `\n${ind}</select>` + tudo);
      // fecha a div depois do </button> desse botão
      const iBtn = t.indexOf("autoAssignMutation.mutate({ password, classId: turmaConquistas })");
      const iFim = t.indexOf("</button>", iBtn);
      t = t.slice(0, iFim + 9) + "\n          </div>" + t.slice(iFim + 9);
      ok('seletor de turma ao lado de "Executar Todas as Regras" (padrão: Medicina)');
    } else falha("botão Executar Todas as Regras não encontrado — seletor não adicionado");
    return t;
  });
  if (r == null) { falha("BadgesManager não encontrado"); return s; }
  return r;
});

// ─────────────────────────── server/routers.ts
rel.push("server/routers.ts");
editar("server/routers.ts", (s) => {
  if (s.includes("idsDaTurmaConquista")) { pulo("já aplicado"); return s; }
  let t = s;

  // autoAssign
  const inAuto = /(autoAssign: publicProcedure\n\s*\.input\(z\.object\(\{\n\s*password: z\.string\(\),\n(\s*)badgeId: z\.number\(\)\.optional\(\),\n)/;
  const corpoAuto = /const \[allBadges, allMembers, allTeams, allMemberBadges\] = await Promise\.all\(\[\n(\s*)db\.getAllBadges\(\),\n\s*db\.getAllMembers\(\),\n\s*db\.getAllTeams\(\),\n\s*db\.getAllMemberBadges\(\),\n\s*\]\);\n/;
  const ganhadores = "const currentEarnerIds = allMemberBadges.filter(mb => mb.badgeId === badge.id).map(mb => mb.memberId);";
  if (inAuto.test(t) && corpoAuto.test(t) && t.includes(ganhadores)) {
    t = t.replace(inAuto, (m, a, ind) => `${a}${ind}classId: z.number().optional(),\n`);
    t = t.replace(corpoAuto, (m, ind) => {
      const i8 = ind.slice(2);
      return `const [allBadges, todosMembros, allTeams, allMemberBadges] = await Promise.all([\n${ind}db.getAllBadges(),\n${ind}db.getAllMembers(),\n${ind}db.getAllTeams(),\n${ind}db.getAllMemberBadges(),\n${i8}]);\n` +
        `${i8}// Só a turma escolhida (ranking e revogação não misturam turmas)\n` +
        `${i8}const allMembers = input.classId ? ((await db.getMembersByClass(input.classId)) as unknown as typeof todosMembros) : todosMembros;\n` +
        `${i8}const idsDaTurmaConquista = new Set(allMembers.map(m => m.id));\n`;
    });
    t = t.replace(ganhadores, "const currentEarnerIds = allMemberBadges.filter(mb => mb.badgeId === badge.id && (!input.classId || idsDaTurmaConquista.has(mb.memberId))).map(mb => mb.memberId);");
    ok("badges.autoAssign: aceita turma (classId)");
  } else falha("badges.autoAssign com formato diferente — não alterado");

  // previewAutoAssign
  const inPrev = /(previewAutoAssign: publicProcedure\n\s*\.input\(z\.object\(\{\n\s*password: z\.string\(\),\n(\s*)rule: z\.string\(\),\n)/;
  const corpoPrev = "const [allMembers, allTeams] = await Promise.all([db.getAllMembers(), db.getAllTeams()]);";
  const iPrev = t.indexOf("previewAutoAssign: publicProcedure");
  const iCorpo = iPrev >= 0 ? t.indexOf(corpoPrev, iPrev) : -1;
  if (inPrev.test(t) && iCorpo > 0) {
    t = t.replace(inPrev, (m, a, ind) => `${a}${ind}classId: z.number().optional(),\n`);
    const j = t.indexOf(corpoPrev, t.indexOf("previewAutoAssign: publicProcedure"));
    t = t.slice(0, j) +
      "const [todosMembros, allTeams] = await Promise.all([db.getAllMembers(), db.getAllTeams()]);\n" +
      "        const allMembers = input.classId ? ((await db.getMembersByClass(input.classId)) as unknown as typeof todosMembros) : todosMembros;" +
      t.slice(j + corpoPrev.length);
    ok("badges.previewAutoAssign: aceita turma (classId)");
  } else falha("badges.previewAutoAssign com formato diferente — não alterado");

  // highlights.autoGenerate — nome sem matrícula
  const nome = 'const topStudentName = topMember ? topMember.name : "—";';
  if (t.includes(nome)) {
    t = t.replace(nome, 'const topStudentName = topMember ? ((p: string[]) => (p.length >= 2 ? p[1] : topMember.name).trim())(String(topMember.name || "").split("\\t")) : "—";');
    ok("highlights.autoGenerate: nome do aluno sem a matrícula");
  } else pulo("highlights.autoGenerate: nome já tratado ou formato diferente");
  return t;
});

console.log("\nResultado da v15:\n" + rel.join("\n") + "\n\nConfira: git diff --stat   (desfazer: git checkout -- client server)\n");
