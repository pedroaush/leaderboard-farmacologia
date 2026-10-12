import { useMemo } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { ClipboardCheck, Crown, Medal, Trophy, Users } from "lucide-react";

/**
 * Coluna lateral da página inicial: melhores alunos e melhores equipes (PF).
 * Substitui o botão "Equipes"/ranking da grade de navegação.
 */
const ORANGE = "#F7941D";
const CARD_BG = "#0D1B2A";

type Membro = { id: number; name: string; xp: number; teamId: number };
type Equipe = { id: number; name: string; emoji: string; color: string; members: Membro[] };

const limparNome = (n: string) => {
  const p = (n || "").split("\t");
  return (p.length >= 2 ? p[1] : n).trim();
};
const pf = (x: number) => (Number.isInteger(x) ? String(x) : x.toFixed(1).replace(".", ","));
const medalha = (i: number) => (i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}º`);

export default function RankingLateral({ teams, memberId, qtdAlunos = 10, qtdEquipes = 5 }: { teams: Equipe[]; memberId?: number | null; qtdAlunos?: number; qtdEquipes?: number }) {
  const alunos = useMemo(() => {
    const todos = teams.flatMap((t) => t.members.map((m) => ({ ...m, nome: limparNome(m.name), equipe: t })));
    return todos.sort((a, b) => b.xp - a.xp);
  }, [teams]);
  const topAlunos = alunos.slice(0, qtdAlunos);
  const minhaPosicao = memberId ? alunos.findIndex((a) => a.id === memberId) : -1;
  const eu = minhaPosicao >= 0 ? alunos[minhaPosicao] : null;

  const equipes = useMemo(
    () => [...teams].map((t) => ({ ...t, total: t.members.reduce((s, m) => s + m.xp, 0) })).sort((a, b) => b.total - a.total).slice(0, qtdEquipes),
    [teams, qtdEquipes]
  );

  return (
    <aside className="w-full lg:w-72 xl:w-80 flex-shrink-0 space-y-3">
      {/* Melhores alunos */}
      <div className="rounded-xl p-3" style={{ backgroundColor: CARD_BG, border: `1px solid ${ORANGE}30` }}>
        <div className="flex items-center gap-2 mb-2">
          <Trophy size={16} style={{ color: ORANGE }} />
          <h3 className="text-sm font-bold text-white">Melhores alunos</h3>
          <span className="ml-auto text-[10px] text-white/40">PF</span>
        </div>
        {topAlunos.length === 0 ? (
          <p className="text-xs text-white/40 py-2">Sem pontuação ainda.</p>
        ) : (
          <ol className="space-y-1">
            {topAlunos.map((a, i) => (
              <motion.li key={a.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs"
                style={{ backgroundColor: a.id === memberId ? ORANGE + "25" : i < 3 ? "rgba(255,255,255,0.04)" : "transparent" }}>
                <span className="w-6 text-center font-bold" style={{ color: i < 3 ? undefined : "rgba(255,255,255,0.45)" }}>{medalha(i)}</span>
                <span className="flex-1 min-w-0 truncate text-white" title={a.nome}>{a.nome}</span>
                <span className="text-[10px]" title={a.equipe.name}>{a.equipe.emoji}</span>
                <span className="font-mono font-semibold" style={{ color: ORANGE }}>{pf(a.xp)}</span>
              </motion.li>
            ))}
          </ol>
        )}
        {eu && minhaPosicao >= qtdAlunos && (
          <div className="mt-2 pt-2 border-t border-white/10 flex items-center gap-2 px-2 text-xs">
            <span className="w-6 text-center font-bold text-white/60">{minhaPosicao + 1}º</span>
            <span className="flex-1 truncate text-white">Você</span>
            <span className="font-mono font-semibold" style={{ color: ORANGE }}>{pf(eu.xp)}</span>
          </div>
        )}
      </div>

      {/* Melhores equipes */}
      <div className="rounded-xl p-3" style={{ backgroundColor: CARD_BG, border: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="flex items-center gap-2 mb-2">
          <Users size={16} style={{ color: ORANGE }} />
          <h3 className="text-sm font-bold text-white">Melhores equipes</h3>
          <span className="ml-auto text-[10px] text-white/40">PF</span>
        </div>
        {equipes.length === 0 ? (
          <p className="text-xs text-white/40 py-2">Sem equipes ainda.</p>
        ) : (
          <ol className="space-y-1.5">
            {equipes.map((t, i) => {
              const max = equipes[0].total || 1;
              return (
                <li key={t.id} className="text-xs">
                  <div className="flex items-center gap-2 px-1">
                    <span className="w-6 text-center font-bold">{i === 0 ? <Crown size={14} className="inline text-yellow-400" /> : i < 3 ? <Medal size={13} className="inline text-white/60" /> : <span className="text-white/45">{i + 1}º</span>}</span>
                    <span className="flex-1 min-w-0 truncate text-white">{t.emoji} {t.name}</span>
                    <span className="font-mono font-semibold" style={{ color: ORANGE }}>{pf(t.total)}</span>
                  </div>
                  <div className="ml-8 mt-1 h-1 rounded bg-white/10">
                    <div className="h-1 rounded" style={{ width: `${(t.total / max) * 100}%`, backgroundColor: t.color || ORANGE }} />
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </aside>
  );
}

/** Botão "Provas" da grade de navegação: resultado, gabarito comentado e parecer. */
export function CardProvas({ classId }: { classId?: number | null }) {
  const destino = classId ? `/aluno/${classId}?tab=provas` : "/";
  return (
    <Link href={destino}>
      <motion.div
        className="flex flex-col items-center gap-1.5 p-3 sm:p-4 rounded-xl cursor-pointer"
        style={{ backgroundColor: ORANGE + "15", color: ORANGE, border: `1px solid ${ORANGE}35` }}
        whileHover={{ scale: 1.06, y: -3, backgroundColor: ORANGE + "25", boxShadow: `0 6px 20px ${ORANGE}30` }}
        whileTap={{ scale: 0.97 }}
        transition={{ type: "spring", stiffness: 400, damping: 20 }}
        title="Notas das provas, gabarito comentado e parecer do professor"
      >
        <ClipboardCheck className="w-6 h-6 sm:w-7 sm:h-7" />
        <span className="text-[10px] sm:text-xs font-semibold text-center leading-tight">Provas e Notas</span>
      </motion.div>
    </Link>
  );
}
