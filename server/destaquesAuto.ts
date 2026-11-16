/**
 * Destaques automáticos da semana (sem preenchimento manual).
 *
 * Toda segunda-feira (00h, horário de Brasília), para cada turma:
 *   • aluno com MAIOR GANHO de PF na semana que terminou (empates: até 3 nomes)
 *   • equipe com maior ganho de PF somado na semana
 *   • líder no PF acumulado
 * O ganho é a diferença entre o PF de agora e o "retrato" (snapshot) da semana
 * anterior, que o próprio sistema guarda. Na primeira execução ainda não há
 * retrato anterior: o destaque usa o PF acumulado.
 *
 * Semana do semestre: conta a partir de SEMESTRE_INICIO (padrão 18/08/2026,
 * Semana 1 do cronograma). O título da semana vem do cronograma da turma.
 */
import * as db from "./db";

const DIA = 86_400_000;
const INICIO = Date.parse(`${process.env.SEMESTRE_INICIO || "2026-08-18"}T00:00:00-03:00`);

export const semanaConcluida = (agora = Date.now()) => Math.floor((agora - INICIO - 6 * DIA) / (7 * DIA)) + 1;
export const inicioDaSemana = (s: number) => new Date(INICIO + (s - 1) * 7 * DIA);
/** Segunda-feira 00h em que a próxima semana termina e o destaque é gerado. */
export const proximaGeracao = (agora = Date.now()) => inicioDaSemana(semanaConcluida(agora) + 1).getTime() + 6 * DIA;

const limparNome = (n: string) => {
  const p = String(n || "").split("\t");
  return (p.length >= 2 ? p[1] : n || "").trim();
};
const pf = (x: number) => (Math.round(x * 10) / 10).toLocaleString("pt-BR");
const dataBR = (d: Date) => d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

async function raw(): Promise<any> {
  const r = await (db as any).getRawDb();
  if (!r) throw new Error("Banco indisponível");
  return r;
}
async function sql(q: string, p: any[] = []): Promise<any[]> {
  const [linhas] = await (await raw()).execute(q, p);
  return linhas as any[];
}

let tabelasOk = false;
export async function garantirTabelas() {
  if (tabelasOk) return;
  await sql(`CREATE TABLE IF NOT EXISTS destaquesSnapshots (
    id INT AUTO_INCREMENT PRIMARY KEY, classId INT NOT NULL, semana INT NOT NULL,
    memberId INT NOT NULL, xp DECIMAL(10,2) NOT NULL DEFAULT 0,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX idx_turma_semana (classId, semana))`);
  await sql(`CREATE TABLE IF NOT EXISTS destaquesGerados (
    classId INT NOT NULL, semana INT NOT NULL, highlightId INT NULL, resumo VARCHAR(300) NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (classId, semana))`);
  const cols = await sql("SHOW COLUMNS FROM weeklyHighlights LIKE 'classId'");
  if (!cols.length) await sql("ALTER TABLE weeklyHighlights ADD COLUMN classId INT NULL");
  tabelasOk = true;
}

export async function turmas(): Promise<{ id: number; nome: string }[]> {
  let linhas: any[];
  try { linhas = await sql("SELECT id, name FROM classes WHERE isActive = 1 ORDER BY id"); }
  catch { linhas = await sql("SELECT id, name FROM classes ORDER BY id"); }
  return linhas.map((c) => ({ id: Number(c.id), nome: String(c.name) }));
}

async function tituloDaSemana(classId: number, semana: number): Promise<string> {
  try {
    const r = await sql("SELECT title FROM scheduleEntries WHERE classId = ? AND weekLabel = ? LIMIT 1", [classId, `Semana ${semana}`]);
    const t = String(r[0]?.title || "").split(" — ")[0].trim();
    return t.length > 70 ? t.slice(0, 67) + "…" : t;
  } catch { return ""; }
}

const nomes = (l: string[]) => (l.length <= 1 ? l[0] || "" : l.slice(0, -1).join(", ") + " e " + l[l.length - 1]);

export type ResultadoTurma = { classId: number; turma: string; semana: number; situacao: "gerado" | "ja_existia" | "sem_alunos" | "sem_pontos"; resumo?: string; highlightId?: number };

export async function gerarSemana(classId: number, nomeTurma: string, semana: number, forcar = false): Promise<ResultadoTurma> {
  await garantirTabelas();
  const base = { classId, turma: nomeTurma, semana };
  const feito = await sql("SELECT highlightId FROM destaquesGerados WHERE classId = ? AND semana = ?", [classId, semana]);
  if (feito.length && !forcar) return { ...base, situacao: "ja_existia" };
  if (feito.length && forcar) {
    if (feito[0].highlightId) await (db as any).deleteHighlight(Number(feito[0].highlightId)).catch(() => {});
    await sql("DELETE FROM destaquesGerados WHERE classId = ? AND semana = ?", [classId, semana]);
    await sql("DELETE FROM destaquesSnapshots WHERE classId = ? AND semana = ?", [classId, semana]);
  }

  const membros = (await sql("SELECT id, name, teamId, xp FROM members WHERE classId = ?", [classId]))
    .map((m) => ({ id: Number(m.id), nome: limparNome(m.name), teamId: m.teamId == null ? null : Number(m.teamId), xp: Number(m.xp) || 0 }));
  if (!membros.length) return { ...base, situacao: "sem_alunos" };
  const equipes = new Map<number, string>(
    (await sql("SELECT id, name, emoji FROM teams WHERE classId = ?", [classId])).map((t) => [Number(t.id), `${t.emoji ? t.emoji + " " : ""}${t.name}`])
  );

  const anterior = await sql(
    "SELECT memberId, xp FROM destaquesSnapshots WHERE classId = ? AND semana = (SELECT MAX(semana) FROM destaquesSnapshots WHERE classId = ? AND semana < ?)",
    [classId, classId, semana]
  );
  const temBase = anterior.length > 0;
  const xpAntes = new Map<number, number>(anterior.map((a) => [Number(a.memberId), Number(a.xp) || 0]));
  const ganho = (m: { id: number; xp: number }) => (temBase ? m.xp - (xpAntes.get(m.id) ?? m.xp) : m.xp);

  // retrato desta semana (base da próxima)
  const valores = membros.map((m) => [classId, semana, m.id, m.xp]);
  for (let i = 0; i < valores.length; i += 200) {
    const lote = valores.slice(i, i + 200);
    await sql(`INSERT INTO destaquesSnapshots (classId, semana, memberId, xp) VALUES ${lote.map(() => "(?,?,?,?)").join(",")}`, lote.flat());
  }

  const ganhos = membros.map((m) => ({ ...m, g: ganho(m) })).sort((a, b) => b.g - a.g);
  const melhor = ganhos[0]?.g ?? 0;
  if (melhor <= 0) {
    await sql("INSERT INTO destaquesGerados (classId, semana, highlightId, resumo) VALUES (?,?,NULL,?)", [classId, semana, "Sem ganho de PF na semana"]);
    return { ...base, situacao: "sem_pontos", resumo: "Sem ganho de PF na semana" };
  }
  const destaques = ganhos.filter((m) => Math.abs(m.g - melhor) < 0.05).slice(0, 3);

  const porEquipe = new Map<number, number>();
  for (const m of ganhos) if (m.teamId != null && equipes.has(m.teamId)) porEquipe.set(m.teamId, (porEquipe.get(m.teamId) || 0) + m.g);
  const equipeTop = [...porEquipe.entries()].sort((a, b) => b[1] - a[1])[0];
  const lider = [...membros].sort((a, b) => b.xp - a.xp)[0];

  const titulo = await tituloDaSemana(classId, semana);
  const ini = inicioDaSemana(semana);
  const fim = new Date(ini.getTime() + 6 * DIA);
  const nomeAluno = nomes(destaques.map((d) => d.nome));
  const nomeEquipe = equipeTop && equipeTop[1] > 0 ? equipes.get(equipeTop[0])! : "—";

  const descricao = temBase
    ? `${nomeTurma}: ${destaques.length > 1 ? "maiores evoluções" : "maior evolução"} da semana — ${nomeAluno} (+${pf(melhor)} PF).` +
      (nomeEquipe !== "—" ? ` Equipe que mais pontuou: ${nomeEquipe} (+${pf(equipeTop![1])} PF).` : "") +
      ` Líder no acumulado: ${lider.nome} (${pf(lider.xp)} PF).`
    : `${nomeTurma}: líder no PF acumulado até a semana ${semana} — ${nomeAluno} (${pf(melhor)} PF).` +
      (nomeEquipe !== "—" ? ` Equipe líder: ${nomeEquipe} (${pf(equipeTop![1])} PF).` : "") +
      ` A partir da próxima semana, o destaque considera o PF ganho na semana.`;

  const id = await (db as any).createHighlight({
    week: semana,
    date: `${dataBR(ini).slice(0, 5)} a ${dataBR(fim)}`,
    activity: `Semana ${semana}${titulo ? " · " + titulo : ""}`,
    description: descricao,
    topTeam: nomeEquipe,
    topStudent: nomeAluno,
  });
  let hid = Number((id as any)?.id ?? id) || null;
  if (!hid) {
    const r = await sql("SELECT id FROM weeklyHighlights WHERE week = ? AND activity = ? ORDER BY id DESC LIMIT 1", [semana, `Semana ${semana}${titulo ? " · " + titulo : ""}`]);
    hid = r[0]?.id ? Number(r[0].id) : null;
  }
  if (hid) await sql("UPDATE weeklyHighlights SET classId = ? WHERE id = ?", [classId, hid]);
  const resumo = `${nomeAluno} (+${pf(melhor)} PF)${nomeEquipe !== "—" ? " · " + nomeEquipe : ""}`.slice(0, 300);
  await sql("INSERT INTO destaquesGerados (classId, semana, highlightId, resumo) VALUES (?,?,?,?)", [classId, semana, hid, resumo]);
  console.log(`[Destaques] ${nomeTurma} — semana ${semana}: ${resumo}`);
  return { ...base, situacao: "gerado", resumo, highlightId: hid ?? undefined };
}

/** Gera a semana que terminou para todas as turmas (pula o que já foi feito). */
export async function gerarSemanaConcluida(opts: { classId?: number; semana?: number; forcar?: boolean } = {}) {
  const semana = opts.semana ?? semanaConcluida();
  if (semana < 1) return [];
  const lista = (await turmas()).filter((t) => !opts.classId || t.id === opts.classId);
  const out: ResultadoTurma[] = [];
  for (const t of lista) out.push(await gerarSemana(t.id, t.nome, semana, !!opts.forcar));
  return out;
}

/** Destaques visíveis para uma turma: os dela + os antigos sem turma. */
export async function destaquesDaTurma<T extends { id: number }>(classId: number, todos: T[]): Promise<T[]> {
  try {
    await garantirTabelas();
    const marcados = new Map<number, number | null>(
      (await sql("SELECT id, classId FROM weeklyHighlights")).map((h) => [Number(h.id), h.classId == null ? null : Number(h.classId)])
    );
    return todos.filter((h) => { const c = marcados.get(h.id); return c == null || c === classId; });
  } catch { return todos; }
}

export async function situacao() {
  await garantirTabelas();
  const ts = await turmas();
  const gerados = await sql("SELECT classId, semana, highlightId, resumo, createdAt FROM destaquesGerados ORDER BY semana DESC");
  return {
    inicioSemestre: new Date(INICIO).toISOString(),
    semanaConcluida: semanaConcluida(),
    proximaGeracao: new Date(proximaGeracao()).toISOString(),
    turmas: ts.map((t) => ({ ...t, historico: gerados.filter((g) => Number(g.classId) === t.id).slice(0, 20) })),
  };
}

// ─── Agendador: confere a cada 30 min; gera assim que a semana termina ───
let rodando = false;
export function iniciarAgendadorDestaques() {
  const g = globalThis as any;
  if (g.__agendadorDestaques) return;
  g.__agendadorDestaques = true;
  const tick = async () => {
    if (rodando || process.env.DESTAQUES_AUTO === "0") return;
    rodando = true;
    try { await gerarSemanaConcluida(); }
    catch (e: any) { console.error("[Destaques] erro:", e?.message || e); }
    finally { rodando = false; }
  };
  setTimeout(tick, 60_000);
  setInterval(tick, 30 * 60_000);
  console.log(`[Destaques] automáticos ligados — semana concluída: ${semanaConcluida()}`);
}
