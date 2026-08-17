/**
 * Leaderboard — Conexão em Farmacologia
 * Padronizado: Laranja (#F7941D) + Cinza (#4A4A4A) + Branco
 * Typography: Outfit (display), JetBrains Mono (data), DM Sans (body)
 */
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy, Users, Zap, TrendingUp, ChevronDown, ChevronUp,
  Award, Target, Star, FlaskConical, Activity, Settings, Youtube, Bell,
  ArrowLeft, BookOpen, ClipboardList, LogOut, MapPin, BarChart3,
  Calendar, QrCode, Gamepad2, Calculator, Medal, Music, VolumeX
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { useNotifications } from "@/hooks/useNotifications";
import { useStudentAuth } from "@/pages/StudentLogin";
import { useAudioContext } from "@/contexts/AudioContext";

import { toast } from "sonner";

const LOGO_URL = "https://files.manuscdn.com/user_upload_by_module/session_file/310419663028318382/TYglakFwBNwpBXzT.png";
const YOUTUBE_URL = "https://www.youtube.com/@Conex%C3%A3oemCi%C3%AAncia-Farmacol%C3%B3gica";

// Brand colors
const ORANGE = "#F7941D";
const GRAY = "#4A4A4A";
const DARK_BG = "#0A1628";
const CARD_BG = "#0D1B2A";

const MAX_PF_SEMESTER = 45;

interface TeamMember { id: number; name: string; xp: number; teamId: number; }
interface TeamData { id: number; name: string; emoji: string; color: string; members: TeamMember[]; }

function getTeamPF(team: TeamData) { return team.members.reduce((sum, m) => sum + m.xp, 0); }
function getTeamAvg(team: TeamData) { return team.members.length > 0 ? getTeamPF(team) / team.members.length : 0; }

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <div className="w-9 h-9 rounded-full flex items-center justify-center font-mono font-bold text-sm text-white shadow-lg" style={{ background: "linear-gradient(135deg, #F7941D, #FFD700)" }}>1</div>;
  if (rank === 2) return <div className="w-9 h-9 rounded-full flex items-center justify-center font-mono font-bold text-sm text-white shadow-lg" style={{ background: "linear-gradient(135deg, #999, #ccc)" }}>2</div>;
  if (rank === 3) return <div className="w-9 h-9 rounded-full flex items-center justify-center font-mono font-bold text-sm text-white shadow-lg" style={{ background: "linear-gradient(135deg, #8B6914, #B8860B)" }}>3</div>;
  return <div className="w-9 h-9 rounded-full flex items-center justify-center font-mono font-bold text-sm" style={{ backgroundColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }}>{rank}</div>;
}

function PFBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="w-full h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
      <motion.div className="h-full rounded-full" style={{ backgroundColor: color }} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1.2, ease: "easeOut" }} />
    </div>
  );
}

function CircularGauge({ value, max, color, size = 120 }: { value: number; max: number; color: string; size?: number }) {
  const pct = Math.min((value / max) * 100, 100);
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (pct / 100) * circumference;
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
          <motion.circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" strokeDasharray={circumference} initial={{ strokeDashoffset: circumference }} animate={{ strokeDashoffset }} transition={{ duration: 1.5, ease: "easeOut" }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono font-bold text-lg" style={{ color }}>{value.toFixed(1)}</span>
          <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>/ {max}</span>
        </div>
      </div>
    </div>
  );
}

function TeamCard({ team, rank }: { team: TeamData; rank: number }) {
  const [expanded, setExpanded] = useState(false);
  const totalPF = getTeamPF(team);
  const avgPF = getTeamAvg(team);
  const maxMemberPF = Math.max(...team.members.map(m => m.xp), 0);
  return (
    <motion.div
      layout
      className="rounded-lg overflow-hidden transition-all"
      style={{
        backgroundColor: CARD_BG,
        border: `1px solid rgba(247,148,29,0.12)`,
      }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: rank * 0.05 }}
    >
      <button onClick={() => setExpanded(!expanded)} className="w-full p-4 sm:p-5 2xl:p-6 flex items-center gap-2 sm:gap-3 md:gap-4 lg:gap-6 2xl:gap-8 text-left hover:bg-white/[0.02] transition-colors min-h-[72px] 2xl:min-h-[88px]">
        <RankBadge rank={rank} />
        <div className="w-10 h-10 2xl:w-12 2xl:h-12 rounded-lg flex items-center justify-center text-xl 2xl:text-2xl shrink-0" style={{ backgroundColor: ORANGE + "15", border: `1px solid ${ORANGE}33` }}>{team.emoji}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-display font-semibold 2xl:text-lg text-white truncate">{team.name}</span>
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>#{team.id}</span>
          </div>
          <div className="mt-1.5"><PFBar value={totalPF} max={MAX_PF_SEMESTER * team.members.length} color={ORANGE} /></div>
        </div>
        <div className="text-right shrink-0 ml-2">
          <div className="font-mono font-bold text-lg 2xl:text-xl" style={{ color: ORANGE }}>{totalPF.toFixed(1)}</div>
          <div className="text-[11px]" style={{ color: "rgba(255,255,255,0.4)" }}>PF total</div>
        </div>
        <div className="text-right shrink-0 ml-2 hidden sm:block">
          <div className="font-mono font-semibold text-sm text-white">{avgPF.toFixed(1)}</div>
          <div className="text-[11px]" style={{ color: "rgba(255,255,255,0.4)" }}>média</div>
        </div>
        <div className="shrink-0" style={{ color: "rgba(255,255,255,0.4)" }}>{expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</div>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden">
            <div className="px-4 2xl:px-6 pb-4 2xl:pb-6 pt-0" style={{ borderTop: "1px solid rgba(247,148,29,0.08)" }}>
              <div className="grid gap-2 mt-3">
                {[...team.members].sort((a, b) => a.name.localeCompare(b.name)).map((member, idx) => (
                  <div key={member.id} className="flex items-center gap-3 py-1.5">
                    <span className="w-5 text-center text-xs font-mono" style={{ color: "rgba(255,255,255,0.4)" }}>{idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-white truncate block">
                        {member.name}
                        {member.xp === maxMemberPF && <Star size={12} className="inline ml-1" style={{ color: ORANGE }} />}
                      </span>
                    </div>
                    <div className="w-24 sm:w-32 2xl:w-40"><PFBar value={member.xp} max={MAX_PF_SEMESTER} color={ORANGE} /></div>
                    <span className="font-mono text-sm font-medium w-12 text-right" style={{ color: ORANGE }}>{member.xp.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Grade Calculator Component ───
function GradeCalculator() {
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [sem, setSem] = useState("");
  const [cs, setCs] = useState("");
  const [kahoot, setKahoot] = useState("");

  const p1Val = parseFloat(p1) || 0;
  const p2Val = parseFloat(p2) || 0;
  const semVal = parseFloat(sem) || 0;
  const csVal = parseFloat(cs) || 0;
  const kahootVal = parseFloat(kahoot) || 0;

  const nt = (semVal + csVal + kahootVal) / 3;
  const mf = ((p1Val + p2Val) / 2) * 0.75 + nt * 0.25;
  const isApproved = mf >= 5.0;

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="font-display font-bold text-xl text-white mb-2 flex items-center gap-2">
        <BarChart3 size={22} style={{ color: ORANGE }} />
        Calculadora de Média Final
      </h2>
      <p className="text-sm mb-6" style={{ color: "rgba(255,255,255,0.5)" }}>
        Simule sua Média Final (MF) com base nas notas das provas e atividades.
      </p>

      {/* Formula Explanation */}
      <div className="p-4 rounded-lg mb-6" style={{ backgroundColor: CARD_BG, border: `1px solid ${ORANGE}25` }}>
        <h3 className="font-semibold text-sm text-white mb-2">Fórmula da Média Final</h3>
        <div className="font-mono text-xs sm:text-sm mb-3 p-3 rounded" style={{ backgroundColor: "rgba(255,255,255,0.05)", color: ORANGE }}>
          MF = (P1 + P2) / 2 × 0,75 + NT × 0,25
        </div>
        <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
          Onde <strong style={{ color: ORANGE }}>NT</strong> (Nota de Trabalho) = (SEM + CS + Kahoot) / 3
        </p>
        <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>
          <strong style={{ color: ORANGE }}>SEM</strong>: Seminários Jigsaw | <strong style={{ color: ORANGE }}>CS</strong>: Casos Clínicos | <strong style={{ color: ORANGE }}>Kahoot</strong>: Atividades Kahoot
        </p>
      </div>

      {/* Input Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div>
          <label className="text-xs font-medium text-white block mb-1.5">Prova 1 (P1)</label>
          <input
            type="number"
            step="0.1"
            min="0"
            max="10"
            value={p1}
            onChange={(e) => setP1(e.target.value)}
            placeholder="0.0"
            className="w-full px-3 py-2.5 rounded-lg text-sm font-mono text-white"
            style={{ backgroundColor: "rgba(255,255,255,0.08)", border: `1px solid rgba(255,255,255,0.1)` }}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-white block mb-1.5">Prova 2 (P2)</label>
          <input
            type="number"
            step="0.1"
            min="0"
            max="10"
            value={p2}
            onChange={(e) => setP2(e.target.value)}
            placeholder="0.0"
            className="w-full px-3 py-2.5 rounded-lg text-sm font-mono text-white"
            style={{ backgroundColor: "rgba(255,255,255,0.08)", border: `1px solid rgba(255,255,255,0.1)` }}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-white block mb-1.5">Seminários (SEM)</label>
          <input
            type="number"
            step="0.1"
            min="0"
            max="10"
            value={sem}
            onChange={(e) => setSem(e.target.value)}
            placeholder="0.0"
            className="w-full px-3 py-2.5 rounded-lg text-sm font-mono text-white"
            style={{ backgroundColor: "rgba(255,255,255,0.08)", border: `1px solid rgba(255,255,255,0.1)` }}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-white block mb-1.5">Casos Clínicos (CS)</label>
          <input
            type="number"
            step="0.1"
            min="0"
            max="10"
            value={cs}
            onChange={(e) => setCs(e.target.value)}
            placeholder="0.0"
            className="w-full px-3 py-2.5 rounded-lg text-sm font-mono text-white"
            style={{ backgroundColor: "rgba(255,255,255,0.08)", border: `1px solid rgba(255,255,255,0.1)` }}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-white block mb-1.5">Kahoot</label>
          <input
            type="number"
            step="0.1"
            min="0"
            max="10"
            value={kahoot}
            onChange={(e) => setKahoot(e.target.value)}
            placeholder="0.0"
            className="w-full px-3 py-2.5 rounded-lg text-sm font-mono text-white"
            style={{ backgroundColor: "rgba(255,255,255,0.08)", border: `1px solid rgba(255,255,255,0.1)` }}
          />
        </div>
      </div>

      {/* Results */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-4 rounded-lg" style={{ backgroundColor: CARD_BG, border: `1px solid rgba(255,255,255,0.1)` }}>
          <p className="text-xs font-medium mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>Nota de Trabalho (NT)</p>
          <p className="text-3xl font-mono font-bold" style={{ color: ORANGE }}>{nt.toFixed(2)}</p>
          <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>(SEM + CS + Kahoot) / 3</p>
        </div>
        <div className="p-4 rounded-lg" style={{ backgroundColor: isApproved ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", border: `1px solid ${isApproved ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}` }}>
          <p className="text-xs font-medium mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>Média Final (MF)</p>
          <p className="text-3xl font-mono font-bold" style={{ color: isApproved ? "#22c55e" : "#ef4444" }}>{mf.toFixed(2)}</p>
          <p className="text-xs mt-1 font-medium" style={{ color: isApproved ? "#22c55e" : "#ef4444" }}>
            {isApproved ? "✓ Aprovado" : "✗ Reprovado"} (mínimo 5.0)
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<"teams" | "individual" | "activities" | "calculator" | "rules" | "conquistas">("teams");
  const [currentPage, setCurrentPage] = useState(1);
  const TEAMS_PER_PAGE = 5;
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [showIntro, setShowIntro] = useState(true);
  const [vinhetaVolume, setVinhetaVolume] = useState(0.7);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"xp" | "name" | "week">("xp");
  const vinhetaAudioRef = useRef<HTMLAudioElement>(null);
  const { data: leaderboard, isLoading } = trpc.leaderboard.getData.useQuery();
  const { data: classes } = trpc.classes.list.useQuery({ sessionToken: "" });
  const { logout, user } = useAuth();
  const { student: studentData, sessionToken: studentSessionToken } = useStudentAuth();
  const [, setLocation] = useLocation();
  const { isMuted, toggleMuted, registerPlayer, unregisterPlayer } = useAudioContext();
  // Verificar se há quiz ao vivo ativo
  const { data: activeLiveQuiz } = trpc.studentAuth.getActiveLiveQuiz.useQuery(
    { sessionToken: studentSessionToken || "" },
    { enabled: !!studentSessionToken, refetchInterval: 15000 }
  );
  // Badge ranking query
  const { data: badgeRanking, isLoading: badgeRankingLoading } = trpc.badges.getRanking.useQuery();

  // Check if there's an active QR code session for the Presença badge (with polling every 30s)
  const { data: activeSessionData } = trpc.qrcode.hasActiveSession.useQuery(undefined, {
    refetchInterval: 30000, // Poll every 30 seconds
  });
  const hasActiveQRSession = activeSessionData?.hasActive ?? false;

  // Get count of new materials from last week
  const { data: newMaterialsData } = trpc.materials.getNewCount.useQuery(undefined, {
    refetchInterval: 60000, // Poll every 60 seconds
  });
  const newMaterialsCount = newMaterialsData?.count ?? 0;

  // Scroll to content section smoothly
  const scrollToContent = useCallback(() => {
    setTimeout(() => {
      document.getElementById("content-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }, []);

  // Tab labels for toast
  const tabLabels: Record<string, string> = {
    teams: "Ranking de Equipes",
    individual: "Top 10 Individual",
    activities: "Atividades PF",
    calculator: "Calculadora de Média",
    rules: "Regras do Jogo",
    conquistas: "Ranking de Conquistas",
  };

  // Tab change with smooth scroll and toast
  const handleTabChange = useCallback((tab: typeof activeTab) => {
    setActiveTab(tab);
    scrollToContent();
    const label = tabLabels[tab];
    if (label) {
      toast(label, {
        duration: 1500,
        style: {
          background: "#0D1B2A",
          color: "#fff",
          border: `1px solid ${ORANGE}40`,
          fontSize: "13px",
        },
        icon: "\u{1F4CB}",
      });
    }
  }, [scrollToContent]);

  useEffect(() => {
    const hasSeenVinheta = localStorage.getItem("hasSeenVinheta");
    const audio = vinhetaAudioRef.current;
    if (audio) {
      registerPlayer("vinheta-abertura", audio);
      audio.volume = vinhetaVolume;
    }

    if (hasSeenVinheta) {
      setShowIntro(false);
      // Já viu antes: NÃO toca de novo sozinho. Fica silenciosa até o aluno
      // clicar no botão de música do cabeçalho, se quiser ouvir.
      return () => { if (audio) unregisterPlayer("vinheta-abertura"); };
    }

    const timer = setTimeout(() => {
      localStorage.setItem("hasSeenVinheta", "true");
      setShowIntro(false);
      // Ao fechar a intro, a vinheta para — ela é só a abertura, não uma
      // trilha sonora contínua. Antes disso, ela ficava tocando escondida
      // mesmo depois da tela de intro sumir.
      if (audio) audio.pause();
    }, 4000);

    // Só toca automaticamente se a música não estiver desligada globalmente.
    if (audio && !isMuted) {
      audio.play().catch(() => {});
    }

    return () => {
      clearTimeout(timer);
      if (audio) unregisterPlayer("vinheta-abertura");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // roda só uma vez, na montagem — volume é ajustado à parte, via ref

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVinhetaVolume(newVolume);
    if (vinhetaAudioRef.current) {
      vinhetaAudioRef.current.volume = newVolume;
    }
  };

  const handleLogout = useCallback(async () => {
    await logout();
    window.location.href = "/";
  }, [logout]);

  const teamsData: TeamData[] = useMemo(() => {
    let teams = leaderboard?.teams ?? [];
    if (selectedClassId) {
      teams = teams.filter(t => (t as any).classId === selectedClassId);
    }
    return teams;
  }, [leaderboard, selectedClassId]);
  const rankedTeams = useMemo(() => {
    let sorted = [...teamsData];
    
    // Apply sorting
    if (sortBy === "xp") {
      sorted.sort((a, b) => getTeamPF(b) - getTeamPF(a));
    } else if (sortBy === "name") {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    }
    
    // Apply search filter
    if (searchQuery.trim()) {
      sorted = sorted.filter(t => 
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.members.some(m => m.name.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }
    
    return sorted;
  }, [teamsData, sortBy, searchQuery]);
  const totalPages = Math.ceil(Math.max(1, rankedTeams.length / TEAMS_PER_PAGE));
  const paginatedTeams = useMemo(() => {
    const start = (currentPage - 1) * TEAMS_PER_PAGE;
    return rankedTeams.slice(start, start + TEAMS_PER_PAGE);
  }, [rankedTeams, currentPage]);

  const topStudents = useMemo(() => {
    const all = teamsData.flatMap(t => t.members.map(m => ({ ...m, teamName: t.name, teamColor: t.color, teamEmoji: t.emoji })));
    return all.sort((a, b) => b.xp - a.xp).slice(0, 10);
  }, [teamsData]);

  const totalStudents = teamsData.reduce((s, t) => s + t.members.length, 0);
  const totalPFEarned = useMemo(() => teamsData.reduce((s, t) => s + getTeamPF(t), 0), [teamsData]);
  const avgPFPerStudent = totalStudents > 0 ? totalPFEarned / totalStudents : 0;
  const topTeam = rankedTeams[0];
  const topTeamPF = topTeam ? getTeamPF(topTeam) : 0;

  const currentWeek = parseInt(leaderboard?.settings?.currentWeek || "1");
  const highlights = leaderboard?.highlights ?? [];
  const latestHighlight = highlights[highlights.length - 1];
  const activities = leaderboard?.activities ?? [];

  const universityName = leaderboard?.settings?.universityName || "UNIRIO";
  const courseName = leaderboard?.settings?.courseName || "Farmacologia I";
  const semester = leaderboard?.settings?.semester || "2026.1";

  // Use real-time notifications hook
  const { unreadCount: notificationCount } = useNotifications(user?.id);
  
  // Fallback to tRPC for initial notifications
  const { data: notifications } = trpc.notifications.getActive.useQuery();
  const initialNotificationCount = (notifications ?? []).length;
  const displayNotificationCount = notificationCount > 0 ? notificationCount : initialNotificationCount;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: DARK_BG }}>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
          <FlaskConical size={40} className="mx-auto mb-4 animate-pulse" style={{ color: ORANGE }} />
          <p className="font-display" style={{ color: "rgba(255,255,255,0.5)" }}>Carregando Conexão em Farmacologia...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: DARK_BG }}>

      <audio
        ref={vinhetaAudioRef}
        src="https://files.manuscdn.com/user_upload_by_module/session_file/310419663028318382/dyTXKdfarsaUsmEI.mp3"
        preload="auto"
      />
      {showIntro && (
        <motion.div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8"
          style={{ backgroundColor: DARK_BG }}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
        >
          <motion.div
            initial={{ scale: 0, rotate: -180, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 20, duration: 0.8 }}
          >
            <img
              src={LOGO_URL}
              alt="Conexao em Farmacologia"
              className="w-28 h-28 sm:w-40 sm:h-40 object-contain"
            />
          </motion.div>
          <div className="flex items-center gap-3 sm:gap-4 px-4 sm:px-8">
            <span className="text-white text-sm font-medium">Volume:</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={vinhetaVolume}
              onChange={handleVolumeChange}
              className="w-32 cursor-pointer"
              style={{
                accentColor: "#F7941D",
              }}
            />
            <span className="text-white text-sm font-medium w-8 text-right">{Math.round(vinhetaVolume * 100)}%</span>
            <button
              onClick={() => {
                if (vinhetaAudioRef.current) {
                  if (vinhetaAudioRef.current.paused) {
                    vinhetaAudioRef.current.play();
                  } else {
                    vinhetaAudioRef.current.pause();
                  }
                }
              }}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all hover:scale-105"
              style={{ backgroundColor: ORANGE, color: "#fff" }}
            >
              Pausar
            </button>
          </div>
        </motion.div>
      )}

      {/* Notification Banners */}
      {notifications && notifications.length > 0 && (
        <div className="w-full">
          {notifications.map((notif) => (
            <div
              key={notif.id}
              className="px-4 py-2.5 text-center text-sm font-medium flex items-center justify-center gap-2"
              style={{
                backgroundColor: notif.priority === "urgent" ? "rgba(239,68,68,0.9)" : notif.priority === "important" ? "rgba(247,148,29,0.9)" : "rgba(247,148,29,0.15)",
                color: notif.priority === "urgent" || notif.priority === "important" ? "#fff" : ORANGE,
              }}
            >
              <Bell size={14} />
              <span className="font-display font-semibold">{notif.title}</span>
              {notif.content && <span className="hidden sm:inline">— {notif.content}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Hero Section */}
      <div className="relative overflow-hidden" style={{ backgroundColor: CARD_BG }}>
        {/* Orange accent line at top */}
        <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${ORANGE}, transparent 50%, ${ORANGE})` }} />

        <div className="relative container pt-6 pb-10 sm:pt-10 sm:pb-14 landscape-compact-y">
          {/* Top Nav */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <img src={LOGO_URL} alt="Logo" className="w-10 h-10 object-contain" />
              <div>
                <span className="text-sm font-display font-semibold text-white block">Conexão em Farmacologia</span>
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{universityName} — {courseName} — {semester}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={toggleMuted}
                title={isMuted ? "Ligar música" : "Desligar música"}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{ color: isMuted ? "rgba(255,255,255,0.5)" : ORANGE, backgroundColor: isMuted ? "rgba(255,255,255,0.05)" : ORANGE + "12", border: `1px solid ${isMuted ? "rgba(255,255,255,0.1)" : ORANGE + "25"}` }}
              >
                {isMuted ? <VolumeX size={14} /> : <Music size={14} />}
                <span className="hidden sm:inline">{isMuted ? "Música desligada" : "Música ligada"}</span>
              </button>
              <Link href="/">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors" style={{ color: ORANGE, backgroundColor: ORANGE + "12", border: `1px solid ${ORANGE}25` }}>
                  <ArrowLeft size={14} />
                  Início
                </span>
              </Link>
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{ color: "rgba(255,255,255,0.5)", backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                <LogOut size={14} />
                Sair
              </button>
            </div>
          </div>

          {/* Title + Student Avatar */}
          <div className="flex items-start gap-4 sm:gap-6">
            <div className="flex-1">
              {/* Student greeting with avatar */}
              {studentData && (
                <motion.div
                  className="flex items-center gap-3 mb-4 p-3 rounded-xl"
                  style={{ backgroundColor: "rgba(247,148,29,0.08)", border: `1px solid rgba(247,148,29,0.18)` }}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                >
                  {/* Avatar circle with initials */}
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold shrink-0 shadow-lg"
                    style={{
                      background: `linear-gradient(135deg, ${ORANGE}, #FFD700)`,
                      color: "#fff",
                      boxShadow: `0 0 16px ${ORANGE}55`,
                    }}
                  >
                    {studentData.memberName
                      ? studentData.memberName.split(" ").slice(0, 2).map((n: string) => n[0]).join("").toUpperCase()
                      : "?"}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.45)" }}>Bem-vindo(a) de volta,</p>
                    <p className="text-sm font-display font-bold text-white truncate">
                      {studentData.memberName?.split(" ")[0] ?? "Aluno"}
                      {studentData.teamEmoji && <span className="ml-1.5">{studentData.teamEmoji}</span>}
                    </p>
                    {studentData.teamName && (
                      <p className="text-[11px]" style={{ color: ORANGE }}>Equipe: {studentData.teamName}</p>
                    )}
                  </div>
                </motion.div>
              )}
              <h1 className="font-display font-extrabold text-2xl sm:text-5xl 2xl:text-6xl text-white leading-tight">
                Quadro Geral de<span className="text-gradient-orange"> Pontuação</span>
              </h1>
              <p className="mt-2 text-sm sm:text-base 2xl:text-lg max-w-xl 2xl:max-w-2xl font-body" style={{ color: "rgba(255,255,255,0.5)" }}>
                Acompanhe os Pontos Farmacológicos (PF) das equipes e dos alunos em tempo real. Semana {currentWeek} de 16 do semestre.
              </p>
            </div>
            <img src={LOGO_URL} alt="Conexão em Farmacologia" className="w-40 h-40 sm:w-52 sm:h-52 2xl:w-64 2xl:h-64 object-contain shrink-0 drop-shadow-lg hidden sm:block" />
          </div>

          {/* Stats Row */}
          <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3 md:gap-4 lg:gap-6 2xl:gap-8">
            {[
              { icon: <Users size={18} />, label: "Equipes", value: teamsData.length.toString(), sub: `${totalStudents} alunos` },
              { icon: <Zap size={18} />, label: "PF Total Turma", value: totalPFEarned.toFixed(0), sub: `de ${MAX_PF_SEMESTER * totalStudents}` },
              { icon: <TrendingUp size={18} />, label: "Média por Aluno", value: avgPFPerStudent.toFixed(1), sub: `de ${MAX_PF_SEMESTER} possíveis` },
              { icon: <Trophy size={18} />, label: "Líder", value: topTeamPF > 0 ? (topTeam?.name ?? "—") : "—", sub: topTeamPF > 0 ? `${topTeamPF.toFixed(1)} PF` : "Sem pontuação" },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                className="rounded-lg p-3 sm:p-4 2xl:p-5"
                style={{ backgroundColor: "rgba(247,148,29,0.05)", border: `1px solid rgba(247,148,29,0.12)` }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 + i * 0.1 }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span style={{ color: ORANGE }}>{stat.icon}</span>
                  <span className="text-xs font-medium uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.4)" }}>{stat.label}</span>
                </div>
                <div className="font-mono font-bold text-lg sm:text-xl 2xl:text-2xl text-white truncate">{stat.value}</div>
                <div className="text-[11px] 2xl:text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>{stat.sub}</div>
              </motion.div>
            ))}
          </div>

          {/* Navigation Cards — Dynamic grid below stats */}
          <div className="mt-6">
            {/* Section label */}
            <div className="mb-3 flex items-center gap-2">
              <div className="h-px flex-1" style={{ background: `linear-gradient(90deg, ${ORANGE}40, transparent)` }} />
              <span className="text-[10px] uppercase tracking-widest font-semibold px-2" style={{ color: ORANGE + "90" }}>Navegação Rápida</span>
              <div className="h-px flex-1" style={{ background: `linear-gradient(270deg, ${ORANGE}40, transparent)` }} />
            </div>

            {/* Primary action cards - large on desktop, compact on mobile */}
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3">
              {/* Cronograma */}
              <Link href={studentData?.classId ? `/cronograma?classId=${studentData.classId}` : "/cronograma"}>
                <motion.div
                  className="flex flex-col items-center gap-1.5 p-3 sm:p-4 rounded-xl cursor-pointer"
                  style={{ backgroundColor: ORANGE, color: "#fff", boxShadow: `0 4px 20px ${ORANGE}40` }}
                  whileHover={{ scale: 1.06, y: -3, boxShadow: `0 8px 28px ${ORANGE}60` }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                >
                  <Calendar className="w-6 h-6 sm:w-7 sm:h-7" />
                  <span className="text-[10px] sm:text-xs font-semibold text-center leading-tight">Cronograma</span>
                </motion.div>
              </Link>

              {/* Materiais */}
              <Link href="/materiais">
                <motion.div
                  className="flex flex-col items-center gap-1.5 p-3 sm:p-4 rounded-xl cursor-pointer"
                  style={{ backgroundColor: ORANGE + "15", color: ORANGE, border: `1px solid ${ORANGE}35` }}
                  whileHover={{ scale: 1.06, y: -3, backgroundColor: ORANGE + "25", boxShadow: `0 6px 20px ${ORANGE}30` }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                >
                  <BookOpen className="w-6 h-6 sm:w-7 sm:h-7" />
                  <span className="text-[10px] sm:text-xs font-semibold text-center leading-tight">Materiais</span>
                </motion.div>
              </Link>

              {/* Arquivos de Casos Clínicos */}
              <Link href="/casos-clinicos/arquivos">
                <motion.div
                  className="flex flex-col items-center gap-1.5 p-3 sm:p-4 rounded-xl cursor-pointer"
                  style={{ backgroundColor: "rgba(52,211,153,0.15)", color: "#34d399", border: "1px solid rgba(52,211,153,0.35)" }}
                  whileHover={{ scale: 1.06, y: -3, backgroundColor: "rgba(52,211,153,0.25)", boxShadow: "0 6px 20px rgba(52,211,153,0.3)" }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                >
                  <FlaskConical className="w-6 h-6 sm:w-7 sm:h-7" />
                  <span className="text-[10px] sm:text-xs font-semibold text-center leading-tight">Casos Clínicos</span>
                </motion.div>
              </Link>

              {/* Presença */}
              <Link href="/attendance/check-in" className="relative">
                <motion.div
                  className="flex flex-col items-center gap-1.5 p-3 sm:p-4 rounded-xl cursor-pointer"
                  style={{ backgroundColor: ORANGE + "15", color: ORANGE, border: `1px solid ${ORANGE}35` }}
                  whileHover={{ scale: 1.06, y: -3, backgroundColor: ORANGE + "25", boxShadow: `0 6px 20px ${ORANGE}30` }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                >
                  <QrCode className="w-6 h-6 sm:w-7 sm:h-7" />
                  <span className="text-[10px] sm:text-xs font-semibold text-center leading-tight">Presença</span>
                </motion.div>
                {hasActiveQRSession && (
                  <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-red-500 border border-[#0A1628] animate-pulse" />
                )}
              </Link>

              {/* Média */}
              <button onClick={() => handleTabChange("calculator")} className="text-left">
                <motion.div
                  className="flex flex-col items-center gap-1.5 p-3 sm:p-4 rounded-xl cursor-pointer"
                  style={{
                    backgroundColor: activeTab === "calculator" ? ORANGE : ORANGE + "15",
                    color: activeTab === "calculator" ? "#fff" : ORANGE,
                    border: `1px solid ${activeTab === "calculator" ? ORANGE : ORANGE + "35"}`,
                    boxShadow: activeTab === "calculator" ? `0 4px 20px ${ORANGE}40` : "none",
                  }}
                  whileHover={{ scale: 1.06, y: -3 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                >
                  <Calculator className="w-6 h-6 sm:w-7 sm:h-7" />
                  <span className="text-[10px] sm:text-xs font-semibold text-center leading-tight">Média</span>
                </motion.div>
              </button>

              {/* Jogo */}
              <Link href="/game/avatar-select">
                <motion.div
                  className="flex flex-col items-center gap-1.5 p-3 sm:p-4 rounded-xl cursor-pointer relative overflow-hidden"
                  style={{ backgroundColor: "rgba(16,185,129,0.15)", color: "#34d399", border: "1px solid rgba(52,211,153,0.35)" }}
                  whileHover={{ scale: 1.06, y: -3, backgroundColor: "rgba(16,185,129,0.25)", boxShadow: "0 6px 20px rgba(52,211,153,0.25)" }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                >
                  <Gamepad2 className="w-6 h-6 sm:w-7 sm:h-7" />
                  <span className="text-[10px] sm:text-xs font-semibold text-center leading-tight">Jogo</span>
                  <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                </motion.div>
              </Link>

              {/* Atividades */}
              <button onClick={() => handleTabChange("activities")} className="text-left">
                <motion.div
                  className="flex flex-col items-center gap-1.5 p-3 sm:p-4 rounded-xl cursor-pointer"
                  style={{
                    backgroundColor: activeTab === "activities" ? ORANGE : ORANGE + "15",
                    color: activeTab === "activities" ? "#fff" : ORANGE,
                    border: `1px solid ${activeTab === "activities" ? ORANGE : ORANGE + "35"}`,
                    boxShadow: activeTab === "activities" ? `0 4px 20px ${ORANGE}40` : "none",
                  }}
                  whileHover={{ scale: 1.06, y: -3 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                >
                  <Target className="w-6 h-6 sm:w-7 sm:h-7" />
                  <span className="text-[10px] sm:text-xs font-semibold text-center leading-tight">Atividades</span>
                </motion.div>
              </button>

              {/* Equipes */}
              <button onClick={() => handleTabChange("teams")} className="text-left">
                <motion.div
                  className="flex flex-col items-center gap-1.5 p-3 sm:p-4 rounded-xl cursor-pointer"
                  style={{
                    backgroundColor: activeTab === "teams" ? ORANGE : ORANGE + "15",
                    color: activeTab === "teams" ? "#fff" : ORANGE,
                    border: `1px solid ${activeTab === "teams" ? ORANGE : ORANGE + "35"}`,
                    boxShadow: activeTab === "teams" ? `0 4px 20px ${ORANGE}40` : "none",
                  }}
                  whileHover={{ scale: 1.06, y: -3 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                >
                  <Users className="w-6 h-6 sm:w-7 sm:h-7" />
                  <span className="text-[10px] sm:text-xs font-semibold text-center leading-tight">Equipes</span>
                </motion.div>
              </button>

              {/* Progresso */}
              <Link href="/meu-progresso">
                <motion.div
                  className="flex flex-col items-center gap-1.5 p-3 sm:p-4 rounded-xl cursor-pointer"
                  style={{ backgroundColor: ORANGE + "15", color: ORANGE, border: `1px solid ${ORANGE}35` }}
                  whileHover={{ scale: 1.06, y: -3, backgroundColor: ORANGE + "25", boxShadow: `0 6px 20px ${ORANGE}30` }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                >
                  <TrendingUp className="w-6 h-6 sm:w-7 sm:h-7" />
                  <span className="text-[10px] sm:text-xs font-semibold text-center leading-tight">Progresso</span>
                </motion.div>
              </Link>

              {/* Avisos */}
              <Link href="/avisos" className="relative">
                <motion.div
                  className="flex flex-col items-center gap-1.5 p-3 sm:p-4 rounded-xl cursor-pointer"
                  style={{ backgroundColor: ORANGE + "15", color: ORANGE, border: `1px solid ${ORANGE}35` }}
                  whileHover={{ scale: 1.06, y: -3, backgroundColor: ORANGE + "25", boxShadow: `0 6px 20px ${ORANGE}30` }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                >
                  <Bell className="w-6 h-6 sm:w-7 sm:h-7" />
                  <span className="text-[10px] sm:text-xs font-semibold text-center leading-tight">Avisos</span>
                </motion.div>
                {displayNotificationCount > 0 && (
                  <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center border-2 border-[#0A1628]">
                    {displayNotificationCount > 9 ? "9+" : displayNotificationCount}
                  </span>
                )}
              </Link>

              {/* Dashboard */}
              <Link href="/dashboard">
                <motion.div
                  className="flex flex-col items-center gap-1.5 p-3 sm:p-4 rounded-xl cursor-pointer"
                  style={{ backgroundColor: ORANGE + "15", color: ORANGE, border: `1px solid ${ORANGE}35` }}
                  whileHover={{ scale: 1.06, y: -3, backgroundColor: ORANGE + "25", boxShadow: `0 6px 20px ${ORANGE}30` }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                >
                  <BarChart3 className="w-6 h-6 sm:w-7 sm:h-7" />
                  <span className="text-[10px] sm:text-xs font-semibold text-center leading-tight">Dashboard</span>
                </motion.div>
              </Link>

              {/* Regras */}
              <button onClick={() => handleTabChange("rules")} className="text-left">
                <motion.div
                  className="flex flex-col items-center gap-1.5 p-3 sm:p-4 rounded-xl cursor-pointer"
                  style={{
                    backgroundColor: activeTab === "rules" ? ORANGE : ORANGE + "15",
                    color: activeTab === "rules" ? "#fff" : ORANGE,
                    border: `1px solid ${activeTab === "rules" ? ORANGE : ORANGE + "35"}`,
                    boxShadow: activeTab === "rules" ? `0 4px 20px ${ORANGE}40` : "none",
                  }}
                  whileHover={{ scale: 1.06, y: -3 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                >
                  <ClipboardList className="w-6 h-6 sm:w-7 sm:h-7" />
                  <span className="text-[10px] sm:text-xs font-semibold text-center leading-tight">Regras</span>
                </motion.div>
              </button>

              {/* Conquistas */}
              <button onClick={() => handleTabChange("conquistas")} className="text-left">
                <motion.div
                  className="flex flex-col items-center gap-1.5 p-3 sm:p-4 rounded-xl cursor-pointer"
                  style={{
                    backgroundColor: activeTab === "conquistas" ? ORANGE : ORANGE + "15",
                    color: activeTab === "conquistas" ? "#fff" : ORANGE,
                    border: `1px solid ${activeTab === "conquistas" ? ORANGE : ORANGE + "35"}`,
                    boxShadow: activeTab === "conquistas" ? `0 4px 20px ${ORANGE}40` : "none",
                  }}
                  whileHover={{ scale: 1.06, y: -3 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                >
                  <Medal className="w-6 h-6 sm:w-7 sm:h-7" />
                  <span className="text-[10px] sm:text-xs font-semibold text-center leading-tight">Conquistas</span>
                </motion.div>
              </button>

              {/* YouTube */}
              <a href={YOUTUBE_URL} target="_blank" rel="noopener noreferrer">
                <motion.div
                  className="flex flex-col items-center gap-1.5 p-3 sm:p-4 rounded-xl cursor-pointer"
                  style={{ backgroundColor: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.1)" }}
                  whileHover={{ scale: 1.06, y: -3, backgroundColor: "rgba(255,0,0,0.12)", color: "#ff4444", borderColor: "rgba(255,68,68,0.3)" }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                >
                  <Youtube className="w-6 h-6 sm:w-7 sm:h-7" />
                  <span className="text-[10px] sm:text-xs font-semibold text-center leading-tight">YouTube</span>
                </motion.div>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Latest Highlight Banner */}
      {latestHighlight && totalPFEarned > 0 && (
        <div className="container -mt-2 mb-6">
          <motion.div
            className="rounded-lg p-3 sm:p-4 flex items-start gap-2.5 sm:gap-3"
            style={{ backgroundColor: ORANGE + "0A", border: `1px solid ${ORANGE}25` }}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.6 }}
          >
            <Activity size={20} className="mt-0.5 shrink-0" style={{ color: ORANGE }} />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono font-medium" style={{ color: ORANGE }}>SEMANA {latestHighlight.week}</span>
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{latestHighlight.date}</span>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: ORANGE + "15", color: ORANGE }}>{latestHighlight.activity}</span>
              </div>
              <p className="text-sm text-white mt-1">{latestHighlight.description}</p>
              <div className="flex flex-col sm:flex-row gap-1 sm:gap-4 mt-1.5 text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                <span>Equipe destaque: <strong className="text-white">{latestHighlight.topTeam}</strong></span>
                <span>Aluno(a) destaque: <strong className="text-white">{latestHighlight.topStudent}</strong></span>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Class Filter */}
      {classes && classes.length > 1 && (
        <div className="container mb-4">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-white">Filtrar por Turma:</label>
            <select
              value={selectedClassId || ""}
              onChange={(e) => setSelectedClassId(e.target.value ? parseInt(e.target.value) : null)}
              className="px-3 py-2 rounded-lg text-sm text-white"
              style={{ backgroundColor: "rgba(255,255,255,0.1)", border: `1px solid ${ORANGE}33` }}
            >
              <option value="">Todas as Turmas</option>
              {classes.map(cls => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}



      {/* Content */}
      <div id="content-section" className="container pb-16 2xl:pb-24">
        <AnimatePresence mode="wait">
          {/* Teams tab with search and sort */}
          {activeTab === "teams" && (
            <motion.div key="teams" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }}>
              {/* Search and Sort Controls */}
              <div className="mb-6 flex flex-col sm:flex-row gap-3 sm:gap-4">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="Buscar equipe ou aluno..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full px-4 py-2 rounded-lg text-sm text-white placeholder-white/40"
                    style={{ backgroundColor: "rgba(255,255,255,0.05)", border: `1px solid ${ORANGE}33` }}
                  />
                </div>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-4 py-2 rounded-lg text-sm text-white"
                  style={{ backgroundColor: "rgba(255,255,255,0.05)", border: `1px solid ${ORANGE}33` }}
                >
                  <option value="xp">Ordenar por PF</option>
                  <option value="name">Ordenar por Nome</option>
                </select>
              </div>

              {/* Teams List — dividido por dinâmica (Casos Clínicos / Seminário) */}
              {(() => {
                const casosClinicos = rankedTeams.filter((t: any) => t.tipo === "casos_clinicos");
                const seminario = rankedTeams.filter((t: any) => t.tipo === "seminario");
                const outros = rankedTeams.filter((t: any) => t.tipo !== "casos_clinicos" && t.tipo !== "seminario");

                // Se não há tipo (ex.: equipes "de verdade" cadastradas manualmente,
                // não os grupos virtuais), mostra tudo junto como antes.
                if (casosClinicos.length === 0 && seminario.length === 0) {
                  return (
                    <div className="space-y-3 mb-6">
                      {rankedTeams.map((team, idx) => (
                        <TeamCard key={team.id} team={team} rank={idx + 1} />
                      ))}
                    </div>
                  );
                }

                return (
                  <div className="space-y-8 mb-6">
                    {casosClinicos.length > 0 && (
                      <div>
                        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                          <span>⚕️</span> Casos Clínicos ({casosClinicos.length})
                        </h3>
                        <div className="space-y-3">
                          {casosClinicos.map((team, idx) => (
                            <TeamCard key={team.id} team={team} rank={idx + 1} />
                          ))}
                        </div>
                      </div>
                    )}
                    {seminario.length > 0 && (
                      <div>
                        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                          <span>📋</span> Seminário ({seminario.length})
                        </h3>
                        <div className="space-y-3">
                          {seminario.map((team, idx) => (
                            <TeamCard key={team.id} team={team} rank={idx + 1} />
                          ))}
                        </div>
                      </div>
                    )}
                    {outros.length > 0 && (
                      <div>
                        <h3 className="text-sm font-bold text-white mb-3">Outras equipes ({outros.length})</h3>
                        <div className="space-y-3">
                          {outros.map((team, idx) => (
                            <TeamCard key={team.id} team={team} rank={idx + 1} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </motion.div>
          )}

          {activeTab === "activities" && (
            <motion.div key="activities" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }}>
              <h2 className="font-display font-bold text-lg text-white mb-4 flex items-center gap-2">
                <Target size={20} style={{ color: ORANGE }} />
                Atividades que Geram PF
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:gap-5 mb-10">
                {activities.map((act, idx) => (
                  <motion.div
                    key={act.id}
                    className="rounded-lg p-3 sm:p-4 2xl:p-5 flex items-center gap-3 sm:gap-4 2xl:gap-5"
                    style={{ backgroundColor: CARD_BG, border: `1px solid rgba(247,148,29,0.12)` }}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: idx * 0.06 }}
                  >
                    <div className="text-2xl">{act.icon}</div>
                    <div className="flex-1">
                      <div className="font-display font-semibold text-sm text-white">{act.name}</div>
                      <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>Até {act.maxXP} PF por sessão</div>
                    </div>
                    <div className="font-mono font-bold text-base sm:text-lg" style={{ color: ORANGE }}>+{act.maxXP}</div>
                  </motion.div>
                ))}
              </div>
              <h2 className="font-display font-bold text-lg text-white mb-4 flex items-center gap-2">
                <Activity size={20} style={{ color: ORANGE }} />
                Histórico Semanal
              </h2>
              <div className="relative">
                <div className="absolute left-4 top-0 bottom-0 w-px" style={{ backgroundColor: ORANGE + "25" }} />
                <div className="grid gap-4">
                  {highlights.map((highlight, idx) => (
                    <motion.div key={highlight.id} className="relative pl-8 sm:pl-10" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3, delay: idx * 0.08 }}>
                      <div
                        className="absolute left-2 sm:left-2.5 top-3 w-3 h-3 rounded-full"
                        style={{
                          backgroundColor: idx === highlights.length - 1 ? ORANGE : "rgba(255,255,255,0.1)",
                          border: `2px solid ${idx === highlights.length - 1 ? ORANGE : "rgba(255,255,255,0.15)"}`,
                        }}
                      />
                      <div className="rounded-lg p-3 sm:p-4" style={{ backgroundColor: CARD_BG, border: `1px solid rgba(247,148,29,0.12)` }}>
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-mono text-xs font-bold" style={{ color: ORANGE }}>SEM {highlight.week}</span>
                          <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{highlight.date}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: ORANGE + "15", color: ORANGE }}>{highlight.activity}</span>
                        </div>
                        <p className="text-sm text-white">{highlight.description}</p>
                        {highlight.topTeam !== "—" && (
                          <div className="flex flex-col sm:flex-row gap-1 sm:gap-4 mt-2 text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                            <span>🏆 {highlight.topTeam}</span>
                            <span>⭐ {highlight.topStudent}</span>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
          {activeTab === "calculator" && (
            <motion.div key="calculator" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }}>
              <GradeCalculator />
            </motion.div>
          )}
          {activeTab === "conquistas" && (
            <motion.div key="conquistas" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }}>
              <h2 className="font-display font-bold text-lg text-white mb-6 flex items-center gap-2">
                <Medal size={20} style={{ color: ORANGE }} />
                Ranking de Conquistas
              </h2>
              {badgeRankingLoading ? (
                <div className="flex justify-center py-16">
                  <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: ORANGE, borderTopColor: "transparent" }} />
                </div>
              ) : !badgeRanking || badgeRanking.length === 0 ? (
                <div className="text-center py-16">
                  <Medal size={48} className="mx-auto mb-4 opacity-20" style={{ color: ORANGE }} />
                  <p className="text-white/40 text-sm">Nenhuma conquista registrada ainda.</p>
                  <p className="text-white/25 text-xs mt-1">As conquistas aparecerão aqui conforme forem atribuídas.</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {badgeRanking.map((entry, idx) => {
                    const medalColors = ["#FFD700", "#C0C0C0", "#CD7F32"];
                    const medalLabels = ["🥇", "🥈", "🥉"];
                    const isTop3 = idx < 3;
                    return (
                      <motion.div
                        key={entry.memberId}
                        className="rounded-lg p-4 flex items-center gap-4"
                        style={{
                          backgroundColor: isTop3 ? CARD_BG : "rgba(255,255,255,0.02)",
                          border: isTop3 ? `1px solid ${medalColors[idx]}40` : `1px solid rgba(255,255,255,0.06)`,
                          boxShadow: isTop3 ? `0 2px 12px ${medalColors[idx]}20` : "none",
                        }}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: idx * 0.04 }}
                      >
                        {/* Rank */}
                        <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-mono font-bold text-sm"
                          style={{
                            backgroundColor: isTop3 ? medalColors[idx] + "22" : "rgba(255,255,255,0.05)",
                            border: `1px solid ${isTop3 ? medalColors[idx] + "60" : "rgba(255,255,255,0.1)"}`,
                            color: isTop3 ? medalColors[idx] : "rgba(255,255,255,0.4)",
                          }}
                        >
                          {isTop3 ? medalLabels[idx] : entry.rank}
                        </div>

                        {/* Name + Team */}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-white truncate">{entry.memberName}</p>
                          <p className="text-xs truncate" style={{ color: entry.teamColor + "cc" }}>{entry.teamName}</p>
                        </div>

                        {/* Badge count */}
                        <div className="text-right shrink-0">
                          <div className="font-mono font-bold text-xl" style={{ color: isTop3 ? medalColors[idx] : ORANGE }}>
                            {entry.badgeCount}
                          </div>
                          <div className="text-[10px] text-white/30">{entry.badgeCount === 1 ? "conquista" : "conquistas"}</div>
                        </div>

                        {/* Badge thumbnails */}
                        {entry.badges.length > 0 && (
                          <div className="flex gap-1 shrink-0 ml-1">
                            {entry.badges.slice(0, 4).map((b, bi) => (
                              b.iconUrl ? (
                                <img key={bi} src={b.iconUrl} alt={b.name} title={b.name} className="w-7 h-7 rounded-full object-cover" style={{ border: `1px solid ${ORANGE}40` }} />
                              ) : (
                                <div key={bi} className="w-7 h-7 rounded-full flex items-center justify-center text-xs" style={{ backgroundColor: ORANGE + "20", border: `1px solid ${ORANGE}30` }} title={b.name}>🏅</div>
                              )
                            ))}
                            {entry.badges.length > 4 && (
                              <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-mono" style={{ backgroundColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)" }}>+{entry.badges.length - 4}</div>
                            )}
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === "rules" && (
            <motion.div key="rules" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }}>
              <h2 className="font-display font-bold text-lg text-white mb-6 flex items-center gap-2">
                <ClipboardList size={20} style={{ color: ORANGE }} />
                Regras das Atividades
              </h2>
              <div className="grid gap-4">
                {[
                  {
                    title: "Casos Clínicos — Liga de Pontos Corridos",
                    icon: "🏥",
                    rules: [
                      "10 grupos disputam 4 rodadas (CS1 a CS4) — todo mundo joga até o fim, sem eliminação",
                      "Cada confronto: vitória = 3 pontos, empate = 1 ponto, derrota = 0",
                      "Ao final das 4 rodadas, a posição na classificação geral vira a nota de todos do grupo",
                      "1º lugar = nota 10; a nota cai 0,5 a cada posição (2º = 9,5, 3º = 9,0...)",
                    ],
                    pf: "Nota 0–10 por posição final",
                  },
                  {
                    title: "Seminário — Pôster + Quiz",
                    icon: "🧩",
                    rules: [
                      "Fase 1: o grupo apresenta um artigo em pôster e elabora 5 perguntas com gabarito",
                      "O professor revisa e aprova as perguntas antes de liberar para a turma",
                      "Fase 2: turma inteira responde individualmente, numa janela de tempo, com alternativas embaralhadas por aluno",
                      "Nota final = 50% nota do pôster (do grupo) + 50% desempenho individual respondendo",
                    ],
                    pf: "Nota 0–10, metade grupo + metade individual",
                  },
                ].map((rule, idx) => (
                  <motion.div
                    key={rule.title}
                    className="rounded-lg p-5"
                    style={{ backgroundColor: CARD_BG, border: `1px solid rgba(247,148,29,0.12)` }}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: idx * 0.06 }}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-2xl">{rule.icon}</span>
                      <div className="flex-1">
                        <h3 className="font-display font-bold text-base text-white">{rule.title}</h3>
                      </div>
                      <span className="font-mono font-bold text-sm px-3 py-1 rounded-full" style={{ backgroundColor: ORANGE + "15", color: ORANGE }}>{rule.pf}</span>
                    </div>
                    <ul className="space-y-1.5 ml-10">
                      {rule.rules.map((r, i) => (
                        <li key={i} className="text-sm flex items-start gap-2" style={{ color: "rgba(255,255,255,0.6)" }}>
                          <span style={{ color: ORANGE }} className="mt-1.5 shrink-0">•</span>
                          {r}
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                ))}
              </div>
              <motion.div
                className="mt-6 rounded-lg p-5 text-center"
                style={{ backgroundColor: ORANGE + "08", border: `1px solid ${ORANGE}20` }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
                  <strong className="text-white">PF Máximo por Aluno no Semestre:</strong> {MAX_PF_SEMESTER} PF
                </p>
                <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>
                  A pontuação é acumulativa. Cada atividade contribui para o total individual e da equipe.
                </p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Botão flutuante Quiz ao Vivo - aparece quando há sessão ativa */}
      {activeLiveQuiz?.found && (
        <Link href="/quiz-ao-vivo">
          <motion.div
            className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl font-bold text-sm text-white shadow-2xl cursor-pointer"
            style={{ backgroundColor: ORANGE, boxShadow: `0 0 24px ${ORANGE}80` }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.97 }}
          >
            <Zap size={18} />
            <span>Quiz ao Vivo</span>
          </motion.div>
        </Link>
      )}
      {/* Footer */}
      <footer className="py-6 2xl:py-10 px-4 2xl:px-8" style={{ borderTop: `1px solid rgba(247,148,29,0.1)`, backgroundColor: CARD_BG }}>
        <div className="container text-center">
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <img src={LOGO_URL} alt="Logo" className="w-6 h-6 object-contain" />
              <span className="text-xs text-white/60">Conexão em Farmacologia</span>
            </div>
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>•</span>
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>{universityName} — {courseName} — {semester}</span>
            <a href={YOUTUBE_URL} target="_blank" rel="noopener noreferrer" className="text-xs flex items-center gap-1 transition-colors" style={{ color: "rgba(255,255,255,0.3)" }}>
              <Youtube size={10} /> YouTube
            </a>

          </div>
          <p className="text-[11px] mt-1" style={{ color: "rgba(255,255,255,0.2)" }}>
            Conexão em Farmacologia • Semana {currentWeek} • Prof. Pedro Braga • Sistema de Gamificação
          </p>
        </div>
      </footer>
    </div>
  );
}