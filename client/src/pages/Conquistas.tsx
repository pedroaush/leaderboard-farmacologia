/**
 * Conquistas — Badges/Achievements page for students
 * Padronizado: Laranja (#F7941D) + Cinza (#4A4A4A) + Branco
 */
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy, Award, Star, ChevronDown, ChevronUp,
  ArrowLeft, Medal, Sparkles, Users, Lock
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";

const LOGO_URL = "/logos/TYglakFwBNwpBXzT.png";
const ORANGE = "#F7941D";
const DARK_BG = "#0A1628";
const CARD_BG = "#0D1B2A";

// Default badge icons by category
const CATEGORY_ICONS: Record<string, string> = {
  "Semana 1": "🏁",
  "Semana 2": "📚",
  "Semana 3": "🧪",
  "TBL": "🎯",
  "Jigsaw": "🧩",
  "Casos Clínicos": "🏥",
  "Escape Room": "🔓",
  "Participação": "⭐",
  "Geral": "🏆",
};

function BadgeCard({ badge, expanded, onToggle }: {
  badge: {
    id: number;
    name: string;
    description: string | null;
    iconUrl: string | null;
    category: string;
    week: number | null;
    criteria: string | null;
    members: { memberName: string; earnedAt: Date; note: string | null }[];
  };
  expanded: boolean;
  onToggle: () => void;
}) {
  const earnedCount = badge.members.length;
  const icon = badge.iconUrl || CATEGORY_ICONS[badge.category] || "🏆";

  return (
    <motion.div
      layout
      className="border border-white/10 rounded-lg overflow-hidden transition-colors hover:border-orange-400/30"
      style={{ backgroundColor: CARD_BG }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-center gap-4 text-left"
      >
        {/* Badge Icon */}
        <div
          className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl shrink-0 shadow-lg"
          style={{
            background: earnedCount > 0
              ? `linear-gradient(135deg, ${ORANGE}22, ${ORANGE}44)`
              : "rgba(255,255,255,0.05)",
            border: earnedCount > 0
              ? `2px solid ${ORANGE}66`
              : "2px solid rgba(255,255,255,0.1)",
          }}
        >
          {badge.iconUrl ? (
            <img src={badge.iconUrl} alt={badge.name} className="w-10 h-10 object-contain rounded-lg" />
          ) : (
            <span>{icon}</span>
          )}
        </div>

        {/* Badge Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white truncate" style={{ fontFamily: "'Outfit', sans-serif" }}>
              {badge.name}
            </span>
            {badge.week && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-medium"
                style={{ backgroundColor: `${ORANGE}22`, color: ORANGE }}>
                Sem {badge.week}
              </span>
            )}
          </div>
          {badge.description && (
            <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{badge.description}</p>
          )}
          {badge.criteria && (
            <p className="text-[11px] text-gray-500 mt-0.5 italic">Critério: {badge.criteria}</p>
          )}
        </div>

        {/* Earned Count */}
        <div className="text-right shrink-0 ml-2">
          <div className="flex items-center gap-1.5">
            <Users size={14} className="text-gray-400" />
            <span className="font-mono font-bold text-lg" style={{ color: earnedCount > 0 ? ORANGE : "rgba(255,255,255,0.3)" }}>
              {earnedCount}
            </span>
          </div>
          <div className="text-[10px] text-gray-500">
            {earnedCount === 1 ? "aluno" : "alunos"}
          </div>
        </div>

        {/* Expand Arrow */}
        <div className="shrink-0 text-gray-500">
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-0 border-t border-white/5">
              {earnedCount === 0 ? (
                <div className="flex items-center gap-3 py-4 justify-center text-gray-500">
                  <Lock size={16} />
                  <span className="text-sm">Nenhum aluno conquistou este badge ainda</span>
                </div>
              ) : (
                <div className="grid gap-2 mt-3">
                  {badge.members.map((member, idx) => (
                    <div key={`${member.memberName}-${idx}`} className="flex items-center gap-3 py-1.5">
                      <span className="w-5 text-center text-xs text-gray-500 font-mono">{idx + 1}</span>
                      <Medal size={14} style={{ color: ORANGE }} />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-white truncate block">{member.memberName}</span>
                        {member.note && (
                          <span className="text-[10px] text-gray-500 italic">{member.note}</span>
                        )}
                      </div>
                      <span className="text-[11px] text-gray-500 font-mono">
                        {new Date(member.earnedAt).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function Conquistas() {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const { data: badgesData, isLoading } = trpc.badges.getWithMembers.useQuery();

  const badges = useMemo(() => badgesData ?? [], [badgesData]);

  // Group by category
  const categories = useMemo(() => {
    const map = new Map<string, typeof badges>();
    for (const b of badges) {
      const cat = b.category || "Geral";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(b);
    }
    return Array.from(map.entries());
  }, [badges]);

  const totalBadges = badges.length;
  const totalEarned = badges.reduce((sum, b) => sum + b.members.length, 0);

  return (
    <div className="min-h-screen" style={{ backgroundColor: DARK_BG, color: "white" }}>
      {/* Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-orange-900/10 to-transparent" />
        <div className="relative container pt-6 pb-8 sm:pt-8 sm:pb-10">
          {/* Nav */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Link href="/" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{ color: "rgba(255,255,255,0.5)", backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <ArrowLeft size={14} />
                Início
              </Link>
              <Link href="/leaderboard" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{ color: "rgba(255,255,255,0.5)", backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <Trophy size={14} />
                Quadro Geral
              </Link>
            </div>
            <img src={LOGO_URL} alt="Conexão em Farmacologia" className="w-12 h-12 sm:w-16 sm:h-16 object-contain" />
          </div>

          {/* Title */}
          <div className="flex items-center gap-3 mb-2">
            <Sparkles size={20} style={{ color: ORANGE }} />
            <span className="text-sm font-medium tracking-wide uppercase" style={{ color: ORANGE, fontFamily: "'Outfit', sans-serif" }}>
              Farmacologia I — UNIRIO — 2026.1
            </span>
          </div>
          <h1 className="font-extrabold text-3xl sm:text-4xl leading-tight" style={{ fontFamily: "'Outfit', sans-serif" }}>
            Conquistas
            <span style={{ color: ORANGE }}> & Badges</span>
          </h1>
          <p className="mt-2 text-gray-400 text-sm sm:text-base max-w-xl" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            Acompanhe as conquistas desbloqueadas ao longo do semestre. Complete atividades para ganhar badges exclusivos!
          </p>

          {/* Stats */}
          <div className="mt-6 flex gap-4">
            <motion.div
              className="border border-white/10 rounded-lg p-3 sm:p-4"
              style={{ backgroundColor: `${CARD_BG}cc` }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <div className="flex items-center gap-2 mb-1" style={{ color: ORANGE }}>
                <Award size={16} />
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Badges Disponíveis</span>
              </div>
              <div className="font-mono font-bold text-2xl text-white">{totalBadges}</div>
            </motion.div>

            <motion.div
              className="border border-white/10 rounded-lg p-3 sm:p-4"
              style={{ backgroundColor: `${CARD_BG}cc` }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              <div className="flex items-center gap-2 mb-1" style={{ color: ORANGE }}>
                <Star size={16} />
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Total Conquistados</span>
              </div>
              <div className="font-mono font-bold text-2xl text-white">{totalEarned}</div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Badges List */}
      <div className="container pb-12">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : badges.length === 0 ? (
          <motion.div
            className="text-center py-16"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <Trophy size={48} className="mx-auto mb-4 text-gray-600" />
            <h3 className="text-lg font-semibold text-gray-400" style={{ fontFamily: "'Outfit', sans-serif" }}>
              Nenhuma conquista disponível ainda
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              As conquistas serão adicionadas conforme o semestre avançar.
            </p>
          </motion.div>
        ) : (
          <div className="space-y-8">
            {categories.map(([category, categoryBadges]) => (
              <div key={category}>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-lg">{CATEGORY_ICONS[category] || "🏆"}</span>
                  <h2 className="text-lg font-bold text-white" style={{ fontFamily: "'Outfit', sans-serif" }}>
                    {category}
                  </h2>
                  <span className="text-xs text-gray-500 font-mono">
                    ({categoryBadges.length} {categoryBadges.length === 1 ? "badge" : "badges"})
                  </span>
                </div>
                <div className="grid gap-3">
                  {categoryBadges.map(badge => (
                    <BadgeCard
                      key={badge.id}
                      badge={badge}
                      expanded={expandedId === badge.id}
                      onToggle={() => setExpandedId(expandedId === badge.id ? null : badge.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-white/5 py-6">
        <div className="container text-center text-xs text-gray-600">
          Conexão em Farmacologia — UNIRIO — Prof. Pedro Braga — 2026.1
        </div>
      </footer>
    </div>
  );
}
