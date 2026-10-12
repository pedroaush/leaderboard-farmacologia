/**
 * Parecer individual com IA (Claude, da Anthropic).
 *
 * Junta: desempenho na prova (por tema e por questão, inclusive brancos e as
 * alternativas marcadas), o gabarito comentado das questões erradas e o
 * desempenho no jogo (missões e chefes por semana, PF), e pede um parecer
 * dirigido ao aluno com um plano de melhoria. O texto volta como RASCUNHO para
 * o professor revisar antes de salvar ou mostrar ao aluno.
 *
 * Variáveis de ambiente (Railway → Variables):
 *   ANTHROPIC_API_KEY   (obrigatória)
 *   ANTHROPIC_MODEL     (opcional; padrão claude-sonnet-5-5)
 */
import { getRawDb } from "./db";
import { ALL_GAME_QUESTIONS } from "../shared/gameQuestions";

// Tema de cada semana do jogo de Farmacologia I (cronograma 2026.2)
const TEMA_SEMANA_JOGO: Record<number, string> = {
  1: "Absorção e vias de administração",
  2: "Distribuição, metabolismo e excreção",
  3: "Mecanismo de ação e interações",
  4: "Farmacodinâmica: dose-resposta, potência, eficácia",
  5: "Colinérgicos diretos e anticolinesterásicos",
  6: "Antimuscarínicos e bloqueadores neuromusculares",
  7: "Revisão (semanas 1–6)",
  8: "Adrenérgicos",
  9: "Bloqueadores adrenérgicos",
  10: "AINEs",
  11: "Glicocorticoides",
  12: "Anestésicos locais",
  13: "Revisão (semanas 8–12)",
  14: "Histamina e anti-histamínicos",
  15: "Revisão final",
};
const SEMANA_DA_MISSAO = new Map<number, number>(ALL_GAME_QUESTIONS.map((q) => [q.id, q.weekNumber]));

export function iaConfigurada() {
  return !!process.env.ANTHROPIC_API_KEY;
}

/** Desempenho do aluno no jogo, por semana. */
export async function dadosDoJogo(memberId: number, classId: number) {
  const raw = await getRawDb();
  if (!raw) return null;
  const [prog] = await raw.execute(
    "SELECT id, farmacologiaPoints, questsCompleted, combatsWon, combatsLost, lastPlayedAt FROM `gameProgress` WHERE memberId = ? AND classId = ? LIMIT 1",
    [memberId, classId]
  );
  const p: any = (prog as any[])[0];
  if (!p) return { jogou: false };
  const [comb] = await raw.execute("SELECT questId, isWon FROM `gameCombats` WHERE gameProgressId = ?", [p.id]);
  const porSemana = new Map<number, { tentativas: number; erros: number; missoesConcluidas: Set<number> }>();
  for (const c of comb as any[]) {
    const sem = SEMANA_DA_MISSAO.get(Number(c.questId));
    if (!sem) continue;
    const s = porSemana.get(sem) || { tentativas: 0, erros: 0, missoesConcluidas: new Set<number>() };
    s.tentativas++;
    if (c.isWon) s.missoesConcluidas.add(Number(c.questId)); else s.erros++;
    porSemana.set(sem, s);
  }
  const [bosses] = await raw.execute(
    "SELECT weekNumber, MAX(isVictory) AS venceu, COUNT(*) AS tentativas FROM `bossBattles` WHERE memberId = ? AND classId = ? GROUP BY weekNumber",
    [memberId, classId]
  );
  const chefes = new Map<number, { venceu: boolean; tentativas: number }>(
    (bosses as any[]).map((b) => [Number(b.weekNumber), { venceu: !!Number(b.venceu), tentativas: Number(b.tentativas) }])
  );
  const totalPorSemana = new Map<number, number>();
  for (const q of ALL_GAME_QUESTIONS) if (!q.isBossQuestion) totalPorSemana.set(q.weekNumber, (totalPorSemana.get(q.weekNumber) || 0) + 1);

  const semanas = [...new Set([...porSemana.keys(), ...chefes.keys()])].sort((a, b) => a - b).map((sem) => {
    const s = porSemana.get(sem);
    return {
      semana: sem,
      tema: TEMA_SEMANA_JOGO[sem] || `Semana ${sem}`,
      missoesConcluidas: s?.missoesConcluidas.size ?? 0,
      missoesNaSemana: totalPorSemana.get(sem) ?? 0,
      respostasErradas: s?.erros ?? 0,
      chefe: chefes.get(sem) ? (chefes.get(sem)!.venceu ? `derrotado (${chefes.get(sem)!.tentativas} tentativa(s))` : `não derrotado (${chefes.get(sem)!.tentativas} tentativa(s))`) : "não enfrentado",
    };
  });
  return {
    jogou: true,
    pfNoJogo: Number(p.farmacologiaPoints) || 0,
    missoesConcluidas: Number(p.questsCompleted) || 0,
    acertos: Number(p.combatsWon) || 0,
    erros: Number(p.combatsLost) || 0,
    ultimoAcesso: p.lastPlayedAt ? new Date(p.lastPlayedAt).toLocaleDateString("pt-BR") : null,
    semanas,
  };
}

const INSTRUCOES = `Você é um assistente pedagógico do professor de Farmacologia I (curso de Medicina/Biomedicina da UNIRIO).
Escreva um PARECER INDIVIDUAL dirigido ao aluno (segunda pessoa, "você"), em português do Brasil, tom respeitoso, honesto e encorajador.

Use SOMENTE os dados fornecidos. Não invente notas, questões, temas ou atividades. Se um dado não existir (ex.: o aluno não jogou), diga isso com naturalidade.
Não cite letras de alternativas (A–E): elas mudam entre as versões da prova. Refira-se às questões pelo número da versão do aluno e pelo tema.

Estrutura (sem títulos em markdown; use parágrafos curtos e, no plano, uma lista com hífens):
1. Desempenho geral — nota, comparação com a média da turma e posição.
2. Padrão de respostas — temas mais fortes e mais fracos (com %), questões em branco, erros concentrados em algum tema, e o que os erros sugerem sobre o raciocínio (use o gabarito comentado das questões erradas para apontar o conceito em jogo).
3. Relação com o jogo — compare o desempenho no jogo (missões concluídas, erros e chefes por semana/tema) com a prova: temas em que jogou pouco ou errou muito e também foi mal na prova, temas em que o jogo ajudou, ou ausência de uso do jogo.
4. Plano de melhoria — 3 a 5 ações concretas e verificáveis: revisar temas específicos pelo gabarito comentado, refazer as missões e o chefe de semanas específicas do jogo, monitoria, casos clínicos, prazos curtos (ex.: "até a próxima semana").

Entre 200 e 330 palavras. Sem saudação inicial longa e sem assinatura.`;

export async function gerarParecerComIA(dados: unknown): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("IA não configurada: adicione ANTHROPIC_API_KEY nas variáveis do Railway.");
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
      max_tokens: 1500,
      system: INSTRUCOES,
      messages: [{ role: "user", content: `Dados do aluno (JSON):\n${JSON.stringify(dados, null, 1)}\n\nEscreva o parecer.` }],
    }),
  });
  const json: any = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(`Erro da IA (${resp.status}): ${json?.error?.message || "falha na chamada"}`);
  const texto = (json.content || []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n").trim();
  if (!texto) throw new Error("A IA não retornou texto.");
  return texto;
}
