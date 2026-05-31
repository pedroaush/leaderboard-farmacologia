import { useState, useEffect, useMemo } from "react";
import { useParams, useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useStudentAuth } from "@/pages/StudentLogin";
import { Eye } from "lucide-react";
import {
  Pause, Play, RotateCcw, LogOut, Zap, Sword, Target, TrendingUp,
  Map, Trophy, ArrowLeft, Clock, Shield, Star, AlertTriangle,
  CheckCircle2, XCircle, ChevronRight, MessageCircle, Skull, Flame
} from "lucide-react";
import { toast } from "sonner";
import BossBattle, { BOSSES } from "@/components/game/BossBattle";
import { BossVictoryAnimation } from "@/components/game/BossVictoryAnimation";
import { playCorrectSound, playWrongSound, playVictorySound, playDefeatSound, playWeekCompleteSound } from "@/lib/gameSounds";
import { WeekReview } from "@/components/game/WeekReview";

// Character images
const CHARACTER_IMAGES: Record<string, string> = {
  hank: "https://files.manuscdn.com/user_upload_by_module/session_file/310419663028318382/Oe7dYzwqJdkuFxFz.png",
  eric: "https://files.manuscdn.com/user_upload_by_module/session_file/310419663028318382/BxlQZJNGVgXfRqKS.png",
  diana: "https://files.manuscdn.com/user_upload_by_module/session_file/310419663028318382/bwPTtxWJMdFJjRGy.png",
  presto: "https://files.manuscdn.com/user_upload_by_module/session_file/310419663028318382/HdJKKcUJlYCxVdSp.png",
  sheila: "https://files.manuscdn.com/user_upload_by_module/session_file/310419663028318382/fHkVTuSmLcECPtYo.png",
  bobby: "https://files.manuscdn.com/user_upload_by_module/session_file/310419663028318382/kkCZvfJJCqGLqXqe.png",
  uni: "https://files.manuscdn.com/user_upload_by_module/session_file/310419663028318382/kkCZvfJJCqGLqXqe.png",
};

const MAP_IMAGE = "https://files.manuscdn.com/user_upload_by_module/session_file/310419663028318382/BxRpnDQgavBgFKVD.png";

// Quest positions on map (relative %) — 85 quests across 17 weeks
const QUEST_POSITIONS: Record<number, { x: number; y: number }> = {
  // Week 1
  1: { x: 8, y: 88 }, 2: { x: 14, y: 82 }, 3: { x: 10, y: 76 }, 4: { x: 16, y: 70 },
  // Week 2
  5: { x: 24, y: 84 }, 6: { x: 28, y: 78 }, 7: { x: 22, y: 72 }, 8: { x: 30, y: 66 },
  // Week 3
  9: { x: 38, y: 82 }, 10: { x: 42, y: 76 }, 11: { x: 36, y: 70 }, 12: { x: 44, y: 64 },
  // Week 4
  13: { x: 52, y: 84 }, 14: { x: 56, y: 78 }, 15: { x: 50, y: 72 }, 16: { x: 58, y: 66 },
  // Week 5
  17: { x: 66, y: 82 }, 18: { x: 70, y: 76 }, 19: { x: 64, y: 70 }, 20: { x: 72, y: 64 },
  // Week 6
  21: { x: 8, y: 60 }, 22: { x: 14, y: 54 }, 23: { x: 10, y: 48 }, 24: { x: 16, y: 42 },
  // Week 7
  25: { x: 24, y: 58 }, 26: { x: 28, y: 52 }, 27: { x: 22, y: 46 }, 28: { x: 30, y: 40 },
  // Week 8
  29: { x: 38, y: 56 }, 30: { x: 42, y: 50 }, 31: { x: 36, y: 44 }, 32: { x: 44, y: 38 },
  // Week 9
  33: { x: 52, y: 58 }, 34: { x: 56, y: 52 }, 35: { x: 50, y: 46 }, 36: { x: 58, y: 40 },
  // Week 10
  37: { x: 66, y: 56 }, 38: { x: 70, y: 50 }, 39: { x: 64, y: 44 }, 40: { x: 72, y: 38 },
  // Week 11
  41: { x: 8, y: 32 }, 42: { x: 14, y: 26 }, 43: { x: 10, y: 20 }, 44: { x: 16, y: 14 },
  // Week 12
  45: { x: 24, y: 30 }, 46: { x: 28, y: 24 }, 47: { x: 22, y: 18 }, 48: { x: 30, y: 12 },
  // Week 13
  49: { x: 38, y: 28 }, 50: { x: 42, y: 22 }, 51: { x: 36, y: 16 }, 52: { x: 44, y: 10 },
  // Week 14
  53: { x: 52, y: 30 }, 54: { x: 56, y: 24 }, 55: { x: 50, y: 18 }, 56: { x: 58, y: 12 },
  // Week 15
  57: { x: 66, y: 28 }, 58: { x: 70, y: 22 }, 59: { x: 64, y: 16 }, 60: { x: 72, y: 10 },
  // Week 16
  61: { x: 78, y: 30 }, 62: { x: 82, y: 24 }, 63: { x: 76, y: 18 }, 64: { x: 84, y: 12 },
  // Week 17
  65: { x: 88, y: 28 }, 66: { x: 92, y: 22 }, 67: { x: 86, y: 16 }, 68: { x: 94, y: 10 },
  // Extra positions for quests 69-85 (boss quests per week)
  69: { x: 20, y: 90 }, 70: { x: 34, y: 90 }, 71: { x: 48, y: 90 }, 72: { x: 62, y: 90 }, 73: { x: 76, y: 90 },
  74: { x: 20, y: 36 }, 75: { x: 34, y: 36 }, 76: { x: 48, y: 36 }, 77: { x: 62, y: 36 }, 78: { x: 76, y: 36 },
  79: { x: 20, y: 8 }, 80: { x: 34, y: 8 }, 81: { x: 48, y: 8 }, 82: { x: 62, y: 8 }, 83: { x: 76, y: 8 },
  84: { x: 88, y: 8 }, 85: { x: 94, y: 4 },
};

// Boss positions on map (between week quest clusters)
const BOSS_POSITIONS: Record<number, { x: number; y: number }> = {
  1: { x: 20, y: 74 },   // After week 1 quests
  2: { x: 32, y: 74 },   // After week 2 quests
  3: { x: 46, y: 74 },   // After week 3 quests
  4: { x: 60, y: 74 },   // After week 4 quests
  5: { x: 74, y: 74 },   // After week 5 quests
  6: { x: 20, y: 46 },   // After week 6 quests
  7: { x: 32, y: 46 },   // After week 7 quests
  8: { x: 46, y: 46 },   // After week 8 quests
  9: { x: 60, y: 46 },   // After week 9 quests
  10: { x: 74, y: 46 },  // After week 10 quests
  11: { x: 20, y: 18 },  // After week 11 quests
  12: { x: 32, y: 18 },  // After week 12 quests
  13: { x: 46, y: 18 },  // After week 13 quests
  14: { x: 60, y: 18 },  // After week 14 quests
  15: { x: 74, y: 18 },  // After week 15 quests
  16: { x: 84, y: 18 },  // After week 16 quests
  17: { x: 94, y: 14 },  // Final boss week 17
};

type GameView = "map" | "quest" | "result" | "report" | "boss";

export default function GamePortal() {
  const { classId } = useParams<{ classId: string }>();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const classIdNum = parseInt(classId || "1");

  // State
  const [view, setView] = useState<GameView>("map");
  const [selectedQuest, setSelectedQuest] = useState<any>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(60);
  const [timerActive, setTimerActive] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [resultData, setResultData] = useState<any>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportText, setReportText] = useState("");
  const [reportType, setReportType] = useState<"error" | "doubt" | "suggestion">("doubt");
  const [activeBossWeek, setActiveBossWeek] = useState<number | null>(null);
  const [activeQuestion, setActiveQuestion] = useState<{ description: string; alternatives: any[]; explanation: string; questionIndex: number; totalQuestions: number } | null>(null);
  const [showBossAnimation, setShowBossAnimation] = useState(false);
  const [bossAnimData, setBossAnimData] = useState<{ isVictory: boolean; bossEmoji: string; bossName: string; pfEarned: number; pfPenalty: number } | null>(null);
  const [reviewWeek, setReviewWeek] = useState<{ weekNumber: number; weekTitle: string } | null>(null);
  const [pendingBossWeek, setPendingBossWeek] = useState<number | null>(null);

  // Admin view mode: detect ?adminView=true&memberId=X&memberName=Y in URL
  const searchParams = new URLSearchParams(window.location.search);
  const isAdminView = searchParams.get("adminView") === "true";
  const adminViewMemberId = parseInt(searchParams.get("memberId") || "0");
  const adminViewMemberName = decodeURIComponent(searchParams.get("memberName") || "Aluno");

  // Get real memberId from student auth session (or admin override)
  const { student: studentData } = useStudentAuth();
  const memberId = isAdminView ? adminViewMemberId : (studentData?.memberId || 0);
  const utils = trpc.useUtils();

  // Queries (only run when memberId is valid)
  const { data: progress, refetch: refetchProgress } = trpc.game.getProgress.useQuery(
    { classId: classIdNum, memberId },
    { enabled: memberId > 0 }
  );
  const { data: availableQuests } = trpc.game.getAvailableQuests.useQuery({
    classId: classIdNum,
  });
  const { data: completedQuestIds } = trpc.game.getCompletedQuests.useQuery(
    { classId: classIdNum, memberId },
    { enabled: memberId > 0 }
  );
  const { data: leaderboard } = trpc.game.getLeaderboard.useQuery({
    classId: classIdNum,
    limit: 5,
  });
  const { data: bossStatuses, refetch: refetchBossStatuses } = trpc.game.getAllBossStatuses.useQuery(
    { classId: classIdNum, memberId },
    { enabled: memberId > 0 }
  );

  // Count earned achievements for badge
  const earnedAchievementCount = useMemo(() => {
    if (!progress?.achievements) return 0;
    try { return JSON.parse(progress.achievements).length; } catch { return 0; }
  }, [progress]);

  // Mutations
  const submitMutation = trpc.game.submitAnswer.useMutation();
  const initMutation = trpc.game.initializeProgress.useMutation();
  const reportMutation = trpc.game.reportError.useMutation();
  const completeBossMutation = trpc.game.completeBossBattle.useMutation();

  // Initialize progress if needed (only when memberId is valid)
  useEffect(() => {
    if (progress === null && memberId > 0) {
      initMutation.mutate({
        classId: classIdNum,
        memberId,
      }, {
        onSuccess: () => refetchProgress(),
      });
    }
  }, [progress, memberId]);

  // Auto-launch Boss Battle after completing the last regular quest (questionInWeek === 4)
  useEffect(() => {
    if (pendingBossWeek === null) return;
    const timer = setTimeout(() => {
      // Transition: close quest result and open Boss Battle
      setView("map");
      setSelectedQuest(null);
      setShowResult(false);
      setResultData(null);
      setActiveBossWeek(pendingBossWeek);
      setView("boss");
      setPendingBossWeek(null);
    }, 3000);
    return () => clearTimeout(timer);
  }, [pendingBossWeek]);

  // Timer
  useEffect(() => {
    if (!timerActive || timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setTimerActive(false);
          handleTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timerActive, timeLeft]);

  const handleTimeUp = () => {
    if (selectedQuest && !showResult) {
      handleSubmit("timeout");
    }
  };

  const handleQuestClick = async (quest: any) => {
    if (completedQuestIds?.includes(quest.id)) {
      // Open review mode for the week this quest belongs to
      const weekNumber = quest.weekNumber || Math.ceil(quest.id / 5);
      const boss = BOSSES.find(b => b.weekNumber === weekNumber);
      setReviewWeek({ weekNumber, weekTitle: boss?.name || `Semana ${weekNumber}` });
      return;
    }
    // Sequential unlock check: block access if previous quest not completed
    if (!isQuestUnlocked.has(quest.id)) {
      const qInWeek = quest.questionInWeek || 1;
      const prevQuest = (availableQuests || []).find(
        (q: any) => q.weekNumber === quest.weekNumber && q.questionInWeek === qInWeek - 1
      );
      toast.error(`🔒 Complete "${prevQuest?.title || 'a missão anterior'}" primeiro!`);
      return;
    }
    setSelectedQuest(quest);
    setSelectedAnswer(null);
    setTimeLeft(60);
    setShowResult(false);
    setResultData(null);
    setActiveQuestion(null);
    setView("quest");
    // Fetch a random question from the pool
    try {
      const q = await utils.game.getQuestQuestion.fetch({ questId: quest.id });
      setActiveQuestion(q);
      setTimerActive(true);
    } catch {
      // Fallback to original quest question
      setActiveQuestion({
        description: quest.description,
        alternatives: quest.alternatives,
        explanation: quest.explanation,
        questionIndex: 0,
        totalQuestions: 1,
      });
      setTimerActive(true);
    }
  };

  const handleSubmit = async (answer: string) => {
    if (!selectedQuest) return;
    setTimerActive(false);

    try {
      const result = await submitMutation.mutateAsync({
        questId: selectedQuest.id,
        classId: classIdNum,
        memberId,
        answer: answer === "timeout" ? "" : answer,
        timeSpent: 60 - timeLeft,
        questionIndex: activeQuestion?.questionIndex ?? 0,
      });

      setResultData(result);
      setShowResult(true);
      refetchProgress();

      // Play sound based on result
      if (result.isBossQuestion) {
        // Boss question: play victory or defeat fanfare
        if (result.isCorrect) {
          playVictorySound();
        } else {
          playDefeatSound();
        }
        const boss = BOSSES.find((b: any) => b.weekNumber === selectedQuest?.weekNumber);
        setBossAnimData({
          isVictory: result.isCorrect,
          bossEmoji: boss?.emoji || "🐉",
          bossName: selectedQuest?.npcName || "Chefe",
          pfEarned: result.pfEarned,
          pfPenalty: result.pfPenalty || 0,
        });
        setShowBossAnimation(true);
      } else {
        // Regular question: short chime or buzz
        if (result.isCorrect) {
          playCorrectSound();
          // If this was the last regular quest (questionInWeek === 4), trigger Boss Battle automatically
          const isLastRegularQuest = selectedQuest?.questionInWeek === 4;
          if (isLastRegularQuest) {
            playWeekCompleteSound();
            // Store the week number — the result screen will show a countdown and then launch the boss
            setPendingBossWeek(selectedQuest?.weekNumber ?? null);
          }
        } else {
          playWrongSound();
        }
      }
    } catch (error) {
      toast.error("Erro ao enviar resposta");
    }
  };

  const handleReport = async () => {
    try {
      await reportMutation.mutateAsync({
        memberId,
        classId: classIdNum,
        questId: selectedQuest?.id,
        reportType,
        description: reportText,
      });
      toast.success("Relatório enviado!");
      setShowReport(false);
      setReportText("");
    } catch {
      toast.error("Erro ao enviar relatório");
    }
  };

  const handleBossClick = (weekNumber: number) => {
    const status = bossStatuses?.find(s => s.weekNumber === weekNumber);
    if (!status?.available) {
      toast.info("Complete todas as missões da semana para desbloquear o boss! 🔒");
      return;
    }
    setActiveBossWeek(weekNumber);
    setView("boss");
  };

  const handleBossComplete = async (result: {
    isVictory: boolean;
    bossName: string;
    totalDamageDealt: number;
    playerHpRemaining: number;
    phasesCompleted: number;
    totalPhases: number;
    comboMax: number;
    pfEarned: number;
    xpEarned: number;
    totalTimeSpent: number;
  }) => {
    try {
      const serverResult = await completeBossMutation.mutateAsync({
        classId: classIdNum,
        memberId,
        weekNumber: activeBossWeek!,
        ...result,
      });

      if (serverResult.isFirstVictory) {
        toast.success(serverResult.message);
      } else if (result.isVictory) {
        toast.info(serverResult.message);
      }

      refetchProgress();
      refetchBossStatuses();
    } catch (error) {
      toast.error("Erro ao salvar resultado do boss");
    }

    setView("map");
    setActiveBossWeek(null);
  };

  const completedSet = useMemo(() => new Set(completedQuestIds || []), [completedQuestIds]);

  // Sequential unlock: quest N is unlocked only if quest N-1 (same week) is completed
  // First quest of each week (questionInWeek === 1) is always available if the week is released
  const isQuestUnlocked = useMemo(() => {
    const unlocked = new Set<number>();
    (availableQuests || []).forEach((quest: any) => {
      if (completedSet.has(quest.id)) {
        // Completed quests are always accessible (for review)
        unlocked.add(quest.id);
        return;
      }
      const qInWeek = quest.questionInWeek || 1;
      if (qInWeek === 1) {
        // First quest of the week: always unlocked if week is released
        unlocked.add(quest.id);
      } else {
        // Quest N: unlocked only if quest N-1 (previous in same week) is completed
        const prevQuest = (availableQuests || []).find(
          (q: any) => q.weekNumber === quest.weekNumber && q.questionInWeek === qInWeek - 1
        );
        if (prevQuest && completedSet.has(prevQuest.id)) {
          unlocked.add(quest.id);
        }
      }
    });
    return unlocked;
  }, [availableQuests, completedSet]);

  // Build boss status map
  const bossStatusMap = useMemo(() => {
    const map: Record<number, { available: boolean; defeated: boolean; attempts: number }> = {};
    (bossStatuses || []).forEach(s => {
      map[s.weekNumber] = { available: s.available, defeated: s.defeated, attempts: s.attempts };
    });
    return map;
  }, [bossStatuses]);

  // Count defeated bosses
  const defeatedBossCount = useMemo(() => {
    return Object.values(bossStatusMap).filter(s => s.defeated).length;
  }, [bossStatusMap]);

  // ═══════════════════════════════════════
  // RENDER: BOSS BATTLE VIEW
  // ═══════════════════════════════════════
  if (view === "boss" && activeBossWeek) {
    return (
      <BossBattle
        weekNumber={activeBossWeek}
        gender={["diana", "sheila"].includes((progress?.characterId || "").toLowerCase()) ? "female" : "male"}
        onComplete={handleBossComplete}
        onBack={() => {
          setView("map");
          setActiveBossWeek(null);
        }}
      />
    );
  }

  // ═══════════════════════════════════════
  // RENDER: MAP VIEW
  // ═══════════════════════════════════════
  if (view === "map") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0a0e27] via-[#111638] to-[#0a0e27] text-white">
        {/* Admin View Banner */}
        {isAdminView && (
          <div className="sticky top-0 z-[60] flex items-center justify-between gap-3 px-4 py-2 text-sm font-medium" style={{ backgroundColor: "#7c3aed", borderBottom: "2px solid #a855f7" }}>
            <div className="flex items-center gap-2">
              <Eye size={14} />
              <span>Modo Admin — Visualizando como: <strong>{adminViewMemberName}</strong> (ID: {adminViewMemberId})</span>
            </div>
            <button
              onClick={() => window.close()}
              className="px-3 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-xs transition-all"
            >
              Fechar
            </button>
          </div>
        )}
        {/* Top HUD */}
        <div className="sticky z-50 bg-[#0a0e27]/90 backdrop-blur-md border-b border-emerald-500/20 px-4 2xl:px-8 py-3 2xl:py-4" style={{ top: isAdminView ? '40px' : '0' }}>
          <div className="max-w-6xl 2xl:max-w-[1600px] mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation(`/aluno/${classIdNum}`)}
                className="text-gray-400 hover:text-white"
              >
                <ArrowLeft size={18} />
              </Button>
              <div>
                <h1 className="font-bold text-lg 2xl:text-xl text-emerald-400">⚔️ Caverna do Dragão</h1>
                <p className="text-xs 2xl:text-sm text-gray-400">Farmacologia I</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Stats */}
              <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/30 rounded-lg px-3 py-1.5">
                <Zap size={14} className="text-blue-400" />
                <span className="font-mono text-sm font-bold text-blue-400">{progress?.farmacologiaPoints || 0}</span>
                <span className="text-xs text-gray-400">PF</span>
              </div>
              <div className="flex items-center gap-2 bg-purple-500/10 border border-purple-500/30 rounded-lg px-3 py-1.5">
                <Star size={14} className="text-purple-400" />
                <span className="font-mono text-sm font-bold text-purple-400">Nv.{progress?.level || 1}</span>
              </div>
              <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-1.5">
                <Target size={14} className="text-emerald-400" />
                <span className="font-mono text-sm font-bold text-emerald-400">{progress?.questsCompleted || 0}/16</span>
              </div>
              {/* Boss counter */}
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-1.5">
                <Skull size={14} className="text-red-400" />
                <span className="font-mono text-sm font-bold text-red-400">{defeatedBossCount}/10</span>
                <span className="text-xs text-gray-400">Boss</span>
              </div>
              <Link href="/jogo/conquistas">
                <Button variant="ghost" size="sm" className="text-amber-400 hover:text-amber-300 relative">
                  <Trophy size={18} />
                  {earnedAchievementCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-[10px] font-bold text-black rounded-full flex items-center justify-center">
                      {earnedAchievementCount}
                    </span>
                  )}
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Map */}
        <div className="max-w-6xl 2xl:max-w-[1600px] mx-auto p-4 2xl:p-8">
          <div className="relative w-full aspect-[16/9] rounded-2xl 2xl:rounded-3xl overflow-hidden border-2 border-emerald-500/20 shadow-2xl shadow-emerald-500/5">
            <img
              src={MAP_IMAGE}
              alt="Mapa do Jogo"
              className="w-full h-full object-cover"
            />

            {/* Quest markers */}
            {(availableQuests || []).map((quest: any) => {
              const pos = QUEST_POSITIONS[quest.id] || { x: 50, y: 50 };
              const isCompleted = completedSet.has(quest.id);
              const isBoss = quest.npcType === "boss";
              const isUnlocked = isQuestUnlocked.has(quest.id);
              const isLocked = !isUnlocked && !isCompleted;

              return (
                <button
                  key={quest.id}
                  onClick={() => handleQuestClick(quest)}
                  className="absolute transform -translate-x-1/2 -translate-y-1/2 group"
                  style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                >
                  <div className={`
                    relative w-10 h-10 2xl:w-14 2xl:h-14 rounded-full flex items-center justify-center
                    transition-all duration-300 hover:scale-125
                    ${isCompleted
                      ? "bg-emerald-500 shadow-lg shadow-emerald-500/50"
                      : isLocked
                        ? "bg-gray-700 shadow-lg shadow-gray-700/50 opacity-60"
                        : isBoss
                          ? "bg-red-500 shadow-lg shadow-red-500/50 animate-pulse"
                          : "bg-amber-500 shadow-lg shadow-amber-500/50"
                    }
                  `}>
                    {isCompleted ? (
                      <CheckCircle2 size={20} className="text-white" />
                    ) : isLocked ? (
                      <span className="text-white text-base">🔒</span>
                    ) : isBoss ? (
                      <Shield size={20} className="text-white" />
                    ) : (
                      <span className="font-bold text-sm text-white">{quest.id}</span>
                    )}
                  </div>

                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <div className="bg-black/90 rounded-lg px-3 py-2 whitespace-nowrap text-center">
                      <p className="text-xs font-bold text-white">{quest.title}</p>
                      <p className="text-[10px] text-gray-400">{quest.npcName} • +{quest.farmacologiaPointsReward} PF</p>
                      {isCompleted && (
                        <p className="text-[10px] text-blue-400 mt-0.5">📖 Clique para revisar</p>
                      )}
                      {isLocked && (
                        <p className="text-[10px] text-gray-500 mt-0.5">🔒 Complete a missão anterior primeiro</p>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}

            {/* Boss markers on map */}
            {BOSSES.map((boss) => {
              const pos = BOSS_POSITIONS[boss.weekNumber];
              if (!pos) return null;
              const status = bossStatusMap[boss.weekNumber];
              const isAvailable = status?.available || false;
              const isDefeated = status?.defeated || false;

              return (
                <button
                  key={`boss-${boss.weekNumber}`}
                  onClick={() => handleBossClick(boss.weekNumber)}
                  className="absolute transform -translate-x-1/2 -translate-y-1/2 group"
                  style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                >
                  <div className={`
                    relative w-12 h-12 2xl:w-16 2xl:h-16 rounded-lg flex items-center justify-center text-xl 2xl:text-2xl
                    transition-all duration-300 hover:scale-125 border-2
                    ${isDefeated
                      ? "bg-emerald-900/80 border-emerald-500/50 shadow-lg shadow-emerald-500/30"
                      : isAvailable
                        ? "bg-red-900/80 border-red-500/60 shadow-lg shadow-red-500/50 animate-pulse"
                        : "bg-gray-800/80 border-gray-600/40 opacity-50"
                    }
                  `}>
                    {isDefeated ? "💀" : boss.imageUrl ? (
                      <img src={boss.imageUrl} alt={boss.name} className="w-10 h-10 object-contain rounded" />
                    ) : boss.emoji}
                    {/* Glow ring for available bosses */}
                    {isAvailable && !isDefeated && (
                      <div className="absolute inset-0 rounded-lg border-2 border-red-400 animate-ping opacity-30" />
                    )}
                  </div>

                  {/* Boss tooltip */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    <div className="bg-black/95 rounded-lg px-3 py-2 whitespace-nowrap text-center border border-red-500/30">
                      <p className="text-xs font-bold" style={{ color: boss.color }}>
                        {boss.imageUrl ? (
                          <img src={boss.imageUrl} alt={boss.name} className="w-4 h-4 object-contain inline mr-1" />
                        ) : boss.emoji} {boss.name}
                      </p>
                      <p className="text-[10px] text-gray-400">{boss.title}</p>
                      <p className="text-[10px] mt-1">
                        {isDefeated ? (
                          <span className="text-emerald-400">✅ Derrotado</span>
                        ) : isAvailable ? (
                          <span className="text-red-400">⚔️ Disponível! +{boss.pfReward} PF</span>
                        ) : (
                          <span className="text-gray-500">🔒 Complete as missões da semana {boss.weekNumber}</span>
                        )}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Boss section below map */}
          <div className="mt-6 mb-4">
            <h2 className="text-lg font-bold text-red-400 flex items-center gap-2 mb-3">
              <Skull size={20} /> Chefes da Semana
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 2xl:gap-4">
              {BOSSES.map((boss) => {
                const status = bossStatusMap[boss.weekNumber];
                const isAvailable = status?.available || false;
                const isDefeated = status?.defeated || false;

                return (
                  <button
                    key={`boss-list-${boss.weekNumber}`}
                    onClick={() => handleBossClick(boss.weekNumber)}
                    className={`
                      p-3 rounded-xl border text-center transition-all
                      ${isDefeated
                        ? "bg-emerald-500/5 border-emerald-500/20"
                        : isAvailable
                          ? "bg-red-500/10 border-red-500/30 hover:border-red-500/60 hover:bg-red-500/20"
                          : "bg-white/5 border-white/10 opacity-50 cursor-not-allowed"
                      }
                    `}
                  >
                    <div className="text-2xl mb-1">
                      {isDefeated ? "💀" : boss.imageUrl ? (
                        <img src={boss.imageUrl} alt={boss.name} className="w-10 h-10 object-contain mx-auto" />
                      ) : boss.emoji}
                    </div>
                    <p className="text-xs font-bold text-white truncate">{boss.name}</p>
                    <p className="text-[10px] text-gray-400">Sem. {boss.weekNumber}</p>
                    {isDefeated && (
                      <>
                        <p className="text-[10px] text-emerald-400 mt-1">Derrotado</p>
                        <button
                          onClick={(e) => { e.stopPropagation(); setReviewWeek({ weekNumber: boss.weekNumber, weekTitle: boss.name }); }}
                          className="mt-1.5 text-[10px] text-blue-400 hover:text-blue-300 underline"
                        >
                          📖 Revisar
                        </button>
                      </>
                    )}
                    {isAvailable && !isDefeated && (
                      <p className="text-[10px] text-red-400 mt-1 animate-pulse">Disponível!</p>
                    )}
                    {!isAvailable && !isDefeated && (
                      <p className="text-[10px] text-gray-500 mt-1">🔒</p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quest list below map */}
          <div className="mt-4">
            <h2 className="text-lg font-bold text-amber-400 flex items-center gap-2 mb-3">
              <Sword size={20} /> Missões
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(availableQuests || []).map((quest: any) => {
                const isCompleted = completedSet.has(quest.id);
                const isUnlocked = isQuestUnlocked.has(quest.id);
                const isLocked = !isUnlocked && !isCompleted;
                return (
                  <button
                    key={quest.id}
                    onClick={() => handleQuestClick(quest)}
                    className={`
                      flex items-center gap-3 p-3 rounded-xl border transition-all text-left
                      ${isCompleted
                        ? "bg-emerald-500/5 border-emerald-500/20 opacity-70"
                        : isLocked
                          ? "bg-gray-800/50 border-gray-700/30 opacity-50 cursor-not-allowed"
                          : "bg-white/5 border-white/10 hover:border-amber-500/40 hover:bg-amber-500/5"
                      }
                    `}
                  >
                    <div className={`
                      w-10 h-10 rounded-full flex items-center justify-center shrink-0
                      ${isCompleted ? "bg-emerald-500/20" : isLocked ? "bg-gray-700/40" : "bg-amber-500/20"}
                    `}>
                      {isCompleted ? (
                        <CheckCircle2 size={18} className="text-emerald-400" />
                      ) : isLocked ? (
                        <span className="text-gray-500 text-base">🔒</span>
                      ) : (
                        <Sword size={18} className="text-amber-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold truncate ${isLocked ? "text-gray-500" : "text-white"}`}>{quest.title}</p>
                      <p className="text-xs text-gray-500">{quest.npcName} • Nível {quest.level} • {quest.difficulty}</p>
                      {isLocked && (
                        <p className="text-[10px] text-gray-600 mt-0.5">🔒 Complete a missão anterior para desbloquear</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-mono font-bold ${isLocked ? "text-gray-600" : "text-amber-400"}`}>+{quest.farmacologiaPointsReward} PF</p>
                    </div>
                    {!isLocked && <ChevronRight size={16} className="text-gray-500 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Leaderboard Dialog */}
        <Dialog open={showMenu} onOpenChange={setShowMenu}>
          <DialogContent className="bg-[#111638] border-emerald-500/20 text-white max-w-md">
            <DialogHeader>
              <DialogTitle className="text-emerald-400 flex items-center gap-2">
                <Trophy size={20} /> Ranking do Jogo
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-2 mt-2">
              {(leaderboard || []).map((entry: any, idx: number) => (
                <div key={entry.memberId} className="flex items-center gap-3 p-2 rounded-lg bg-white/5">
                  <span className={`
                    w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm
                    ${idx === 0 ? "bg-yellow-500 text-black" : idx === 1 ? "bg-gray-400 text-black" : idx === 2 ? "bg-amber-700 text-white" : "bg-white/10 text-gray-400"}
                  `}>
                    {idx + 1}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{entry.memberName}</p>
                    <p className="text-xs text-gray-400">Nível {entry.level} • {entry.questsCompleted} missões</p>
                  </div>
                  <span className="font-mono font-bold text-amber-400">{entry.farmacologiaPoints} PF</span>
                </div>
              ))}
              {(!leaderboard || leaderboard.length === 0) && (
                <p className="text-center text-gray-400 py-4">Nenhum jogador ainda</p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ═══════════════════════════════════════
  // RENDER: QUEST VIEW (Combat/Quiz)
  // ═══════════════════════════════════════
  if (view === "quest" && selectedQuest) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0a0e27] via-[#1a1040] to-[#0a0e27] text-white flex flex-col">
        {/* Admin View Banner */}
        {isAdminView && (
          <div className="flex items-center justify-between gap-3 px-4 py-2 text-sm font-medium" style={{ backgroundColor: "#7c3aed", borderBottom: "2px solid #a855f7" }}>
            <div className="flex items-center gap-2">
              <Eye size={14} />
              <span>Modo Admin — <strong>{adminViewMemberName}</strong></span>
            </div>
            <button onClick={() => window.close()} className="px-3 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-xs transition-all">Fechar</button>
          </div>
        )}
        {/* Quest Header */}
        <div className="bg-[#0a0e27]/90 backdrop-blur-md border-b border-purple-500/20 px-4 py-3">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => setView("map")} className="text-gray-400">
              <ArrowLeft size={18} className="mr-1" /> Mapa
            </Button>
            <div className="text-center">
              <p className="text-xs text-purple-400 font-medium">Missão {selectedQuest.id}</p>
              <p className="text-sm font-bold">{selectedQuest.title}</p>
            </div>
            <div className="flex items-center gap-2">
              {/* Timer */}
              <div className={`
                flex items-center gap-1 px-3 py-1.5 rounded-lg font-mono font-bold text-sm
                ${timeLeft <= 10 ? "bg-red-500/20 text-red-400 animate-pulse" : "bg-white/10 text-white"}
              `}>
                <Clock size={14} />
                {timeLeft}s
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowReport(true)}
                className="text-gray-400"
              >
                <AlertTriangle size={16} />
              </Button>
            </div>
          </div>
        </div>

        {/* Quest Content */}
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <div className="max-w-2xl w-full space-y-6">
            {/* NPC */}
            <div className="text-center">
              <div className="w-20 h-20 rounded-full bg-purple-500/20 border-2 border-purple-500/40 mx-auto flex items-center justify-center mb-3">
                <span className="text-3xl">
                  {selectedQuest.npcType === "boss" ? "🐉" : selectedQuest.npcType === "mage" ? "🧙" : "⚔️"}
                </span>
              </div>
              <p className="text-sm text-purple-400 font-medium">{selectedQuest.npcName}</p>
            </div>

            {/* Question */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              {activeQuestion ? (
                <>
                  <p className="text-lg font-medium text-center leading-relaxed">{activeQuestion.description}</p>
                  {activeQuestion.totalQuestions > 1 && (
                    <p className="text-xs text-purple-400 text-center mt-2">Pergunta variante ({activeQuestion.totalQuestions} possíveis)</p>
                  )}
                </>
              ) : (
                <div className="flex items-center justify-center py-4">
                  <div className="w-6 h-6 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                  <span className="ml-2 text-sm text-gray-400">Carregando pergunta...</span>
                </div>
              )}
            </div>

            {/* Alternatives */}
            {!showResult && activeQuestion ? (
              <div className="space-y-3">
                {activeQuestion.alternatives.map((alt: any) => (
                  <button
                    key={alt.id}
                    onClick={() => {
                      setSelectedAnswer(alt.id);
                      handleSubmit(alt.id);
                    }}
                    disabled={submitMutation.isPending}
                    className={`
                      w-full p-4 rounded-xl border text-left transition-all
                      ${selectedAnswer === alt.id
                        ? "bg-amber-500/20 border-amber-500/50"
                        : "bg-white/5 border-white/10 hover:border-amber-500/30 hover:bg-amber-500/5"
                      }
                      ${submitMutation.isPending ? "opacity-50 cursor-not-allowed" : ""}
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center font-bold text-sm uppercase">
                        {alt.id}
                      </span>
                      <span className="text-sm">{alt.text}</span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              /* Result */
              <div className="space-y-4">
                <div className={`
                  p-6 rounded-2xl border text-center
                  ${resultData?.isCorrect
                    ? "bg-emerald-500/10 border-emerald-500/30"
                    : "bg-red-500/10 border-red-500/30"
                  }
                `}>
                  {resultData?.isCorrect ? (
                    <>
                      <CheckCircle2 size={48} className="text-emerald-400 mx-auto mb-3" />
                      <h3 className="text-xl font-bold text-emerald-400">Correto! 🎉</h3>
                      <p className="text-sm text-gray-300 mt-2">+{resultData.pfEarned} PF • +{resultData.xpEarned} PF</p>
                    </>
                  ) : (
                    <>
                      <XCircle size={48} className="text-red-400 mx-auto mb-3" />
                      <h3 className="text-xl font-bold text-red-400">Incorreto 😔</h3>
                      <p className="text-sm text-gray-300 mt-2">
                        Resposta correta: <strong className="text-emerald-400">{resultData?.correctAnswerText}</strong>
                      </p>
                      {resultData?.isBossQuestion && resultData?.pfPenalty > 0 && (
                        <p className="text-red-400 font-bold mt-2">-{resultData.pfPenalty} PF (penalidade do chefe)</p>
                      )}
                      {!resultData?.isBossQuestion && (
                        <p className="text-amber-400 text-sm mt-2">Tente novamente para avançar!</p>
                      )}
                    </>
                  )}
                  {resultData?.explanation && (
                    <p className="text-sm text-gray-400 mt-3 bg-white/5 rounded-lg p-3">
                      💡 {resultData.explanation}
                    </p>
                  )}
                </div>

                {/* New achievements */}
                {resultData?.newAchievements?.length > 0 && (
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
                    <p className="text-sm font-bold text-yellow-400 mb-2">🏆 Nova Conquista!</p>
                    {resultData.newAchievements.map((ach: any) => (
                      <div key={ach.id} className="flex items-center gap-2">
                        <span className="text-xl">{ach.icon}</span>
                        <div>
                          <p className="text-sm font-medium text-white">{ach.title}</p>
                          <p className="text-xs text-gray-400">{ach.description} (+{ach.bonus} PF)</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Auto Boss Battle banner */}
                {pendingBossWeek !== null && (
                  <div className="bg-red-900/40 border border-red-500/50 rounded-xl p-4 text-center animate-pulse">
                    <p className="text-red-300 font-bold text-sm">⚔️ Semana completa! O Chefe está chegando...</p>
                    <p className="text-red-400/70 text-xs mt-1">A batalha começa em instantes!</p>
                  </div>
                )}

                {resultData?.isCorrect ? (
                  <Button
                    onClick={() => {
                      if (pendingBossWeek !== null) {
                        // Launch boss immediately on click
                        const week = pendingBossWeek;
                        setPendingBossWeek(null);
                        setView("map");
                        setSelectedQuest(null);
                        setShowResult(false);
                        setResultData(null);
                        setActiveBossWeek(week);
                        setView("boss");
                      } else {
                        setView("map");
                        setSelectedQuest(null);
                        setShowResult(false);
                      }
                    }}
                    className={`w-full ${pendingBossWeek !== null ? "bg-red-600 hover:bg-red-700 animate-pulse" : "bg-emerald-600 hover:bg-emerald-700"}`}
                  >
                    {pendingBossWeek !== null ? (
                      <><Skull size={16} className="mr-2" /> Enfrentar o Chefe!</>
                    ) : (
                      <><Map size={16} className="mr-2" /> Voltar ao Mapa</>
                    )}
                  </Button>
                ) : (
                  <Button
                    onClick={() => {
                      setShowResult(false);
                      setResultData(null);
                      setSelectedAnswer(null);
                      setTimeLeft(60);
                      setTimerActive(true);
                    }}
                    className="w-full bg-amber-600 hover:bg-amber-700"
                  >
                    <RotateCcw size={16} className="mr-2" /> Tentar Novamente
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Boss Victory/Defeat Animation Overlay */}
        {showBossAnimation && bossAnimData && (
          <BossVictoryAnimation
            isVictory={bossAnimData.isVictory}
            characterEmoji="🧙"
            bossEmoji={bossAnimData.bossEmoji}
            bossName={bossAnimData.bossName}
            pfEarned={bossAnimData.pfEarned}
            pfPenalty={bossAnimData.pfPenalty}
            onAnimationEnd={() => {
              setShowBossAnimation(false);
              setBossAnimData(null);
            }}
          />
        )}

        {/* Week Review Modal */}
        {reviewWeek && (
          <WeekReview
            weekNumber={reviewWeek.weekNumber}
            weekTitle={reviewWeek.weekTitle}
            onClose={() => setReviewWeek(null)}
          />
        )}
        {/* Report Dialog */}
        <Dialog open={showReport} onOpenChange={setShowReport}>
          <DialogContent className="bg-[#111638] border-purple-500/20 text-white max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageCircle size={18} /> Reportar Problema
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex gap-2">
                {(["doubt", "error", "suggestion"] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => setReportType(type)}
                    className={`
                      px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                      ${reportType === type ? "bg-purple-500 text-white" : "bg-white/10 text-gray-400"}
                    `}
                  >
                    {type === "doubt" ? "Dúvida" : type === "error" ? "Erro" : "Sugestão"}
                  </button>
                ))}
              </div>
              <textarea
                value={reportText}
                onChange={e => setReportText(e.target.value)}
                placeholder="Descreva o problema ou dúvida..."
                className="w-full h-24 bg-white/5 border border-white/10 rounded-lg p-3 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:border-purple-500/50"
              />
              <Button
                onClick={handleReport}
                disabled={!reportText.trim() || reportMutation.isPending}
                className="w-full bg-purple-600 hover:bg-purple-700"
              >
                Enviar Relatório
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Fallback: show loading or auth error
  if (!isAdminView && memberId === 0) {
    return (
      <div className="min-h-screen bg-[#0a0e27] flex items-center justify-center">
        <div className="text-center text-white max-w-sm mx-auto px-4">
          <div className="text-5xl mb-4">🔒</div>
          <h2 className="text-xl font-bold text-emerald-400 mb-2">Acesso Restrito</h2>
          <p className="text-gray-400 mb-6">Para jogar, acesse o jogo pelo portal do aluno com o seu login.</p>
          <a
            href="/login-aluno"
            className="inline-block px-6 py-2.5 rounded-lg font-bold text-white transition-all hover:scale-105"
            style={{ backgroundColor: "#F7941D" }}
          >
            Fazer Login
          </a>
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-[#0a0e27] flex items-center justify-center">
      <div className="text-center text-white">
        <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-gray-400">Carregando jogo...</p>
      </div>
    </div>
  );
}
