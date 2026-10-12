#!/usr/bin/env node
/**
 * aplicar_v8.mjs — página inicial (ranking lateral + botão Provas e Notas),
 * página de Avisos (mural do professor + avisos individuais) e aviso no
 * celular quando o professor publica um aviso.
 *
 *   Rodar na raiz do projeto:  node aplicar_v8.mjs
 *   Desfazer (antes do commit): git checkout -- client server
 */
import fs from "node:fs";
import path from "node:path";

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

// ── 1) Home.tsx: ranking lateral, sem o botão "Equipes", com "Provas e Notas"
rel.push("client/src/pages/Home.tsx");
editar("client/src/pages/Home.tsx", (s) => {
  if (s.includes("<RankingLateral")) { pulo("já aplicado"); return s; }

  const imp = 'import { useStudentAuth } from "@/pages/StudentLogin";\n';
  if (!s.includes(imp)) { falha("import do useStudentAuth não encontrado — nada alterado"); return s; }

  const grade = '            {/* Primary action cards - large on desktop, compact on mobile */}\n            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3">';
  const fim = '              </a>\n            </div>\n          </div>\n        </div>\n      </div>\n\n      {/* Latest Highlight Banner */}';
  const equipes = /              \{\/\* Equipes \*\/\}\n              <button onClick=\{\(\) => handleTabChange\("teams"\)\} className="text-left">[\s\S]*?<\/button>\n\n/;
  const ganchoHook = "  // Use real-time notifications hook";
  if (!s.includes(grade) || !s.includes(fim) || !equipes.test(s) || !s.includes(ganchoHook)) {
    falha("estrutura da página diferente do esperado — nada alterado (mande o Home.tsx atual)");
    return s;
  }
  s = s.replace(imp, imp + 'import RankingLateral, { CardProvas } from "@/components/RankingLateral";\n');
  s = s.replace(grade,
    '            <div className="flex flex-col lg:flex-row gap-4 items-start">\n' +
    '            <div className="flex-1 min-w-0 w-full">\n' +
    '            {/* Primary action cards - large on desktop, compact on mobile */}\n' +
    '            <div className="grid grid-cols-3 sm:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3">');
  s = s.replace(fim,
    '              </a>\n            </div>\n            </div>\n\n' +
    '            {/* Ranking lateral: melhores alunos e equipes */}\n' +
    '            <RankingLateral teams={rankingTeams} memberId={(studentData as any)?.memberId ?? null} />\n' +
    '            </div>\n          </div>\n        </div>\n      </div>\n\n      {/* Latest Highlight Banner */}');
  s = s.replace(equipes,
    '              {/* Provas e Notas (resultado, gabarito comentado e parecer) */}\n' +
    '              <CardProvas classId={(studentData as any)?.classId ?? null} />\n\n');
  s = s.replace(ganchoHook,
    '  // Ranking lateral: turma do aluno logado (ou a turma filtrada)\n' +
    '  const rankingTeams: TeamData[] = useMemo(() => {\n' +
    '    const cid = (studentData as any)?.classId ?? selectedClassId;\n' +
    '    const todas = (leaderboard?.teams ?? []) as TeamData[];\n' +
    '    return cid ? todas.filter((t: any) => t.classId === cid) : todas;\n' +
    '  }, [leaderboard, studentData, selectedClassId]);\n\n' + ganchoHook);
  ok("coluna lateral com melhores alunos e equipes");
  ok('botão "Equipes" (ranking) substituído por "Provas e Notas"');
  return s;
});

// ── 2) Página de Avisos: substitui o arquivo que serve /avisos
rel.push("Página de Avisos");
(function () {
  const novo = "client/src/pages/StudentNotifications.tsx";
  const achados = [];
  (function varrer(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) varrer(p);
      else if (/\.tsx$/.test(e.name)) {
        const t = fs.readFileSync(p, "utf8");
        if (t.includes("Student Notifications Page (/avisos)") && !t.includes("Junta as duas fontes de aviso")) achados.push(p);
      }
    }
  })("client/src");
  if (!achados.length) {
    pulo("página de Avisos já é a versão nova (o zip substituiu o arquivo)");
    return;
  }
  if (!fs.existsSync(novo)) { falha(novo + " não encontrado — extraia o zip na raiz do projeto"); return; }
  const conteudoNovo = fs.readFileSync(novo, "utf8");
  for (const p of achados) {
    const crlf = fs.readFileSync(p, "utf8").includes("\r\n");
    fs.writeFileSync(p, crlf ? conteudoNovo.replace(/\r?\n/g, "\r\n") : conteudoNovo);
    ok(`${p.replace(/\\/g, "/")} agora mostra o mural do professor + avisos individuais`);
  }
  const alvo = path.normalize(novo);
  if (!achados.map((p) => path.normalize(p)).includes(alvo)) {
    fs.unlinkSync(novo); // o arquivo do zip tinha outro nome; o conteúdo já foi para o lugar certo
  }
})();

// ── 3) routers.ts: aviso no celular quando o professor publica um aviso
rel.push("server/routers.ts");
editar("server/routers.ts", (s) => {
  if (s.includes("tag: \"aviso-mural\"")) { pulo("já aplicado"); return s; }
  const ini = s.indexOf("notifications: router({");
  if (ini < 0) { falha("router de notifications não encontrado"); return s; }
  const alvo = /(const id = await db\.createNotification\(\{\n\s*\.\.\.data,\n\s*expiresAt: expiresAt \? new Date\(expiresAt\) : null,\n\s*\}\);\n)(\s*)return \{ id \};/;
  const trecho = s.slice(ini);
  if (!alvo.test(trecho)) { falha("notifications.create com formato diferente — push de avisos não adicionado"); return s; }
  const novoTrecho = trecho.replace(alvo, (_m, bloco, ind) =>
    `${bloco}${ind}import("./push").then(({ enviarPush }) => enviarPush({ title: "📢 " + data.title, body: data.content || "Novo aviso do professor", url: "/avisos", tag: "aviso-mural" })).catch(() => {});\n${ind}return { id };`);
  ok("aviso no celular ao publicar aviso no mural");
  return s.slice(0, ini) + novoTrecho;
});

console.log("\nResultado da v8:\n" + rel.join("\n") + "\n\nConfira: git diff --stat   (desfazer: git checkout -- client server)\n");
