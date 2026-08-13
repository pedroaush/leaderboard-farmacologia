import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  ArrowLeft, Gamepad2, Users, Trophy, Target, Zap, TrendingUp,
  Lock, Unlock, AlertTriangle, CheckCircle2, XCircle, Clock,
  MessageCircle, ChevronDown, ChevronUp, BarChart3, Star,
  Shield, Eye, Send, Skull, Swords, RotateCcw, Crown
} from "lucide-react";
import { BOSSES } from "@/components/game/BossBattle";
import type { BossData } from "@/components/game/BossBattle";

// Week titles (17 weeks)
const WEEK_TITLES: Record<number, string> = {
  1: "Farmacocinética (ADME)",
  2: "Farmacodinâmica (Receptores e Dose-Resposta)",
  3: "Agonistas e Antagonistas",
  4: "Sistema Nervoso Autônomo e Colinérgicos",
  5: "Adrenérgicos e Anestésicos Locais",
  6: "Analgésicos Opioides",
  7: "Anti-inflamatórios (AINEs e Corticoides)",
  8: "Antimicrobianos I (Beta-lactâmicos)",
  9: "Antimicrobianos II (Outros grupos)",
  10: "Cardiovasculares I (Anti-hipertensivos)",
  11: "Cardiovasculares II (Antiarrítmicos)",
  12: "Psicotrópicos I (Ansiolíticos e Hipnóticos)",
  13: "Psicotrópicos II (Antidepressivos)",
  14: "Psicotrópicos III (Antipsicóticos)",
  15: "Endocrinologia (Insulina e Hipoglicemiantes)",
  16: "Oncologia (Quimioterápicos)",
  17: "Revisão Geral — Boss Final",
};

type Tab = "overview" | "releases" | "students" | "reports" | "bosses";

export default function AdminGamePanel() {
  // Esta tela é montada como rota própria (/admin/jogo), não como aba dentro do
  // Admin.tsx — por isso não recebe teacherToken via prop, igual o AdminJigsawPanel
  // recebe. Busca direto do localStorage, mesma chave usada no Admin.tsx.
  const [teacherToken, setTeacherToken] = useState<string>("");
  useEffect(() => {
    const t = localStorage.getItem("teacherSessionToken") || "";
    setTeacherToken(t);
  }, []);
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [expandedStudent, setExpandedStudent] = useState<number | null>(null);
  const [respondingReport, setRespondingReport] = useState<number | null>(null);
  const [responseText, setResponseText] = useState("");
  const [scheduleDates, setScheduleDates] = useState<Record<number, string>>({});
  const [classId, setClassId] = useState<number>(0); // Corrigido automaticamente assim que a lista real de turmas chega

  // Turmas reais (nunca mais hardcoded — mesma fonte que o AdminJigsawPanel usa)
  const { data: classesList = [] } = trpc.classes.list.useQuery(
    { sessionToken: teacherToken || "" },
    { enabled: !!teacherToken && teacherToken.length > 10, retry: false }
  );

  // Queries
  const { data: stats } = trpc.game.getClassStats.useQuery({ classId }, { enabled: classId > 0 });
  const { data: releases, refetch: refetchReleases } = trpc.game.getWeeklyReleases.useQuery({ classId }, { enabled: classId > 0 });
  const { data: allProgress, refetch: refetchProgress } = trpc.game.getAllProgress.useQuery({ classId }, { enabled: classId > 0 });
  const { data: reports, refetch: refetchReports } = trpc.game.getErrorReports.useQuery({ classId, status: "all" }, { enabled: classId > 0 });
  const { data: allQuests } = trpc.game.getAllQuests.useQuery();
  const { data: leaderboard } = trpc.game.getLeaderboard.useQuery({ classId, limit: 10 }, { enabled: classId > 0 });
  const { data: classMembers } = trpc.game.getMembersForClass.useQuery({ classId }, { enabled: classId > 0 });
  const { data: bossStats, refetch: refetchBossStats } = trpc.game.getAdminBossStats.useQuery({ classId }, { enabled: classId > 0 });
  const [selectedTestMemberId, setSelectedTestMemberId] = useState<number>(0);
  const [expandedBossWeek, setExpandedBossWeek] = useState<number | null>(null);
  const [previewBoss, setPreviewBoss] = useState<BossData | null>(null);
  const resetBossMutation = trpc.game.resetBossBattle.useMutation();

  // Mutations
  const releaseMutation = trpc.game.releaseWeek.useMutation();
  const lockMutation = trpc.game.lockWeek.useMutation();
  const respondMutation = trpc.game.respondToReport.useMutation();
  const scheduleMutation = trpc.game.scheduleWeekRelease.useMutation();
  const checkScheduledMutation = trpc.game.checkScheduledReleases.useMutation();

  // Assim que a lista real de turmas chega, escolhe a turma correta (Medicina I por
  // padrão, ou a primeira disponível). Substitui o antigo classId fixo (22) que ficava
  // desatualizado sempre que as turmas eram reimportadas/reconstruídas.
  useEffect(() => {
    if (classesList.length === 0) return;
    const stillValid = (classesList as any[]).some((c: any) => c.id === classId);
    if (classId > 0 && stillValid) return;
    const medicina1 = (classesList as any[]).find(
      (c: any) => /medicina/i.test(c.name || "") && /\bI\b/.test(c.name || "") && !/II/i.test(c.name || "")
    );
    setClassId((medicina1 || (classesList as any[])[0]).id);
  }, [classesList]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-check scheduled releases on mount (só depois que temos um classId válido)
  useEffect(() => {
    if (classId <= 0) return;
    checkScheduledMutation.mutateAsync({ classId }).then(result => {
      if (result.released.length > 0) {
        toast.success(`Semanas ${result.released.join(", ")} liberadas automaticamente!`);
        refetchReleases();
      }
    }).catch(() => {});
  }, [classId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Derived data
  const releasedWeeks = useMemo(() => {
    return new Set((releases || []).filter((r: any) => r.isReleased).map((r: any) => r.weekNumber));
  }, [releases]);

  const handleReleaseWeek = async (weekNumber: number) => {
    try {
      await releaseMutation.mutateAsync({ classId, weekNumber });
      toast.success(`Semana ${weekNumber} liberada!`);
      refetchReleases();
    } catch {
      toast.error("Erro ao liberar semana");
    }
  };

  const handleLockWeek = async (weekNumber: number) => {
    try {
      await lockMutation.mutateAsync({ classId, weekNumber });
      toast.success(`Semana ${weekNumber} bloqueada`);
      refetchReleases();
    } catch {
      toast.error("Erro ao bloquear semana");
    }
  };

  const handleScheduleWeek = async (weekNumber: number) => {
    const dateStr = scheduleDates[weekNumber];
    if (!dateStr) { toast.error("Selecione uma data primeiro"); return; }
    try {
      await scheduleMutation.mutateAsync({ classId, weekNumber, scheduledDate: new Date(dateStr).toISOString() });
      toast.success(`Semana ${weekNumber} agendada para ${new Date(dateStr).toLocaleDateString("pt-BR")}`);
      refetchReleases();
    } catch {
      toast.error("Erro ao agendar semana");
    }
  };

  const handleRespondReport = async (reportId: number, status: "reviewed" | "resolved" | "dismissed") => {
    try {
      await respondMutation.mutateAsync({
        reportId,
        status,
        teacherResponse: responseText || undefined,
      });
      toast.success("Resposta enviada!");
      setRespondingReport(null);
      setResponseText("");
      refetchReports();
    } catch {
      toast.error("Erro ao responder");
    }
  };

  const tabs = [
    { key: "overview" as const, label: "Visão Geral", icon: <BarChart3 size={16} /> },
    { key: "releases" as const, label: "Liberação Semanal", icon: <Unlock size={16} /> },
    { key: "students" as const, label: "Evolução Alunos", icon: <Users size={16} /> },
    { key: "reports" as const, label: "Relatórios", icon: <AlertTriangle size={16} /> },
    { key: "bosses" as const, label: "Boss Battles", icon: <Swords size={16} /> },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0e27] via-[#111638] to-[#0a0e27] text-white">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-[#0a0e27]/90 backdrop-blur-md border-b border-emerald-500/20 px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/admin/professor")}
              className="text-gray-400 hover:text-white"
            >
              <ArrowLeft size={18} />
            </Button>
            <div className="flex items-center gap-2">
              <Gamepad2 size={22} className="text-emerald-400" />
              <div>
                <h1 className="font-bold text-lg text-emerald-400">Painel do Jogo</h1>
                <p className="text-xs text-gray-400">Caverna do Dragão - Farmacologia I</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Seletor de Turma (dados reais, nunca mais lista fixa) */}
            <select
              value={classId}
              onChange={(e) => setClassId(Number(e.target.value))}
              className="px-3 py-1.5 rounded-lg bg-white/10 border border-emerald-500/30 text-white text-sm"
            >
              {classesList.length === 0 ? (
                <option value={0} className="bg-gray-900">Carregando turmas...</option>
              ) : (
                (classesList as any[]).map((c: any) => (
                  <option key={c.id} value={c.id} className="bg-gray-900">{c.name}</option>
                ))
              )}
            </select>

            {/* Botão Testar Jogo como Admin - com seletor de aluno real */}
            <div className="flex items-center gap-1">
              <select
                value={selectedTestMemberId}
                onChange={(e) => setSelectedTestMemberId(Number(e.target.value))}
                className="px-2 py-1.5 rounded-lg bg-white/10 border border-purple-500/30 text-white text-xs max-w-[140px]"
                title="Selecione um aluno para testar o jogo"
              >
                <option value={0} className="bg-gray-900">-- Selecionar aluno --</option>
                {(classMembers || []).map((m: any) => (
                  <option key={m.id} value={m.id} className="bg-gray-900">{m.name}</option>
                ))}
              </select>
              <a
                href={selectedTestMemberId > 0 ? `/game/avatar-select?adminView=true&memberId=${selectedTestMemberId}&classId=${classId}&memberName=${encodeURIComponent((classMembers || []).find((m: any) => m.id === selectedTestMemberId)?.name || 'Aluno')}` : '#'}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => { if (selectedTestMemberId === 0) { e.preventDefault(); alert('Selecione um aluno primeiro para testar o jogo.'); } }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-all hover:opacity-80"
                style={{ backgroundColor: selectedTestMemberId > 0 ? '#7c3aed' : '#4b5563' }}
                title={selectedTestMemberId > 0 ? 'Abrir jogo como este aluno' : 'Selecione um aluno primeiro'}
              >
                <Eye size={14} />
                <span className="hidden sm:inline">Testar</span>
              </a>
            </div>

            {/* Pending reports badge */}
            {(stats?.pendingReports || 0) > 0 && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-1.5">
                <AlertTriangle size={14} className="text-red-400" />
                <span className="text-xs font-medium text-red-400">{stats?.pendingReports} pendentes</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-6xl mx-auto px-4 pt-4">
        <div className="flex gap-1 p-1 rounded-xl bg-white/5 w-fit">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                ${activeTab === tab.key
                  ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
                }
              `}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* ═══ OVERVIEW TAB ═══ */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { icon: <Users size={20} />, label: "Jogadores", value: stats?.totalPlayers || 0, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
                { icon: <Star size={20} />, label: "Nível Médio", value: stats?.avgLevel || 0, color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20" },
                { icon: <Zap size={20} />, label: "PF Médio", value: stats?.avgPF || 0, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
                { icon: <Target size={20} />, label: "Missões Média", value: stats?.avgQuestsCompleted || 0, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
              ].map(stat => (
                <div key={stat.label} className={`${stat.bg} border rounded-xl p-4`}>
                  <div className={`${stat.color} mb-2`}>{stat.icon}</div>
                  <p className="text-2xl font-bold font-mono">{stat.value}</p>
                  <p className="text-xs text-gray-400 mt-1">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Additional Stats */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Trophy size={18} className="text-yellow-400" />
                  <span className="text-sm text-gray-400">Concluíram</span>
                </div>
                <p className="text-xl font-bold">{stats?.completedCount || 0} <span className="text-sm text-gray-400">alunos</span></p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Shield size={18} className="text-red-400" />
                  <span className="text-sm text-gray-400">Total Combates</span>
                </div>
                <p className="text-xl font-bold">{stats?.totalCombats || 0}</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp size={18} className="text-emerald-400" />
                  <span className="text-sm text-gray-400">Taxa de Acerto</span>
                </div>
                <p className="text-xl font-bold">{stats?.winRate || 0}%</p>
              </div>
            </div>

            {/* Top 10 Ranking */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <h3 className="text-lg font-bold text-emerald-400 mb-4 flex items-center gap-2">
                <Trophy size={20} /> Top 10 Jogadores
              </h3>
              <div className="space-y-2">
                {(leaderboard || []).map((entry: any, idx: number) => (
                  <div key={entry.memberId} className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
                    <span className={`
                      w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm
                      ${idx === 0 ? "bg-yellow-500 text-black" : idx === 1 ? "bg-gray-400 text-black" : idx === 2 ? "bg-amber-700 text-white" : "bg-white/10 text-gray-400"}
                    `}>
                      {idx + 1}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{entry.memberName}</p>
                      <p className="text-xs text-gray-400">
                        Nível {entry.level} • {entry.questsCompleted}/16 missões • {entry.combatsWon} vitórias
                      </p>
                    </div>
                    <span className="font-mono font-bold text-amber-400">{entry.farmacologiaPoints} PF</span>
                    {entry.isCompleted && <CheckCircle2 size={16} className="text-emerald-400" />}
                  </div>
                ))}
                {(!leaderboard || leaderboard.length === 0) && (
                  <p className="text-center text-gray-400 py-4">Nenhum jogador ainda</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══ RELEASES TAB ═══ */}
        {activeTab === "releases" && (
          <div className="space-y-4">
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-6">
              <p className="text-sm text-amber-400 flex items-center gap-2">
                <AlertTriangle size={16} />
                As fases são liberadas semanalmente. Clique no botão para liberar ou bloquear cada semana.
              </p>
            </div>

            <div className="space-y-3">
              {Array.from({ length: 17 }, (_, i) => i + 1).map(weekNum => {
                const isReleased = releasedWeeks.has(weekNum);
                const releaseEntry = (releases || []).find((r: any) => r.weekNumber === weekNum);
                const scheduledDate = releaseEntry?.scheduledReleaseDate
                  ? new Date(releaseEntry.scheduledReleaseDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
                  : null;
                const isBossWeek = weekNum === 17;

                return (
                  <div
                    key={weekNum}
                    className={`border rounded-xl p-4 transition-all ${
                      isReleased ? "bg-emerald-500/5 border-emerald-500/20"
                      : isBossWeek ? "bg-red-500/5 border-red-500/20"
                      : "bg-white/5 border-white/10"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                          isReleased ? "bg-emerald-500/20" : isBossWeek ? "bg-red-500/20" : "bg-gray-500/20"
                        }`}>
                          {isReleased ? (
                            <Unlock size={18} className="text-emerald-400" />
                          ) : isBossWeek ? (
                            <Shield size={18} className="text-red-400" />
                          ) : (
                            <Lock size={18} className="text-gray-400" />
                          )}
                        </div>
                        <div>
                          <p className="font-semibold">Semana {weekNum} {isBossWeek ? "👑" : ""}</p>
                          <p className="text-sm text-gray-400">{WEEK_TITLES[weekNum]}</p>
                          {scheduledDate && !isReleased && (
                            <p className="text-xs text-amber-400 mt-0.5 flex items-center gap-1">
                              <Clock size={11} /> Agendada: {scheduledDate}
                            </p>
                          )}
                          {isReleased && releaseEntry?.releasedAt && (
                            <p className="text-xs text-emerald-400 mt-0.5">
                              Liberada em {new Date(releaseEntry.releasedAt).toLocaleDateString("pt-BR")}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 ml-13">
                        {!isReleased && (
                          <div className="flex items-center gap-1">
                            <input
                              type="datetime-local"
                              value={scheduleDates[weekNum] || ""}
                              onChange={e => setScheduleDates(prev => ({ ...prev, [weekNum]: e.target.value }))}
                              className="text-xs bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-white"
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleScheduleWeek(weekNum)}
                              disabled={scheduleMutation.isPending || !scheduleDates[weekNum]}
                              className="text-amber-400 border-amber-500/30 hover:bg-amber-500/10 text-xs"
                            >
                              <Clock size={12} className="mr-1" /> Agendar
                            </Button>
                          </div>
                        )}
                        {isReleased ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleLockWeek(weekNum)}
                            disabled={lockMutation.isPending}
                            className="text-red-400 border-red-500/30 hover:bg-red-500/10"
                          >
                            <Lock size={14} className="mr-1" /> Bloquear
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handleReleaseWeek(weekNum)}
                            disabled={releaseMutation.isPending}
                            className="bg-emerald-600 hover:bg-emerald-700"
                          >
                            <Unlock size={14} className="mr-1" /> Liberar Agora
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══ STUDENTS TAB ═══ */}
        {activeTab === "students" && (
          <div className="space-y-3">
            {(allProgress || []).length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Users size={48} className="mx-auto mb-4 opacity-50" />
                <p>Nenhum aluno iniciou o jogo ainda</p>
              </div>
            ) : (
              (allProgress || []).map((student: any, idx: number) => {
                const isExpanded = expandedStudent === student.memberId;
                const achievements: string[] = JSON.parse(student.achievements || "[]");
                const progressPct = ((student.questsCompleted || 0) / 16) * 100;

                return (
                  <div
                    key={student.memberId}
                    className="border border-white/10 rounded-xl overflow-hidden bg-white/5"
                  >
                    <button
                      onClick={() => setExpandedStudent(isExpanded ? null : student.memberId)}
                      className="w-full p-4 flex items-center gap-4 text-left"
                    >
                      <span className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center font-mono font-bold text-sm text-gray-400">
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{student.memberName}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-purple-400">Nv.{student.level}</span>
                          <span className="text-xs text-amber-400">{student.farmacologiaPoints} PF</span>
                          <span className="text-xs text-emerald-400">{student.questsCompleted}/16</span>
                          {student.isCompleted && <CheckCircle2 size={12} className="text-emerald-400" />}
                        </div>
                        {/* Progress bar */}
                        <div className="w-full h-1.5 bg-white/10 rounded-full mt-2">
                          <div
                            className="h-full bg-emerald-500 rounded-full transition-all"
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </div>
                      {isExpanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-4 border-t border-white/5 pt-3">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                          <div className="bg-white/5 rounded-lg p-2 text-center">
                            <p className="text-xs text-gray-400">Combates</p>
                            <p className="font-mono font-bold">{student.totalCombats}</p>
                          </div>
                          <div className="bg-white/5 rounded-lg p-2 text-center">
                            <p className="text-xs text-gray-400">Vitórias</p>
                            <p className="font-mono font-bold text-emerald-400">{student.combatsWon}</p>
                          </div>
                          <div className="bg-white/5 rounded-lg p-2 text-center">
                            <p className="text-xs text-gray-400">Derrotas</p>
                            <p className="font-mono font-bold text-red-400">{student.combatsLost}</p>
                          </div>
                          <div className="bg-white/5 rounded-lg p-2 text-center">
                            <p className="text-xs text-gray-400">Taxa Acerto</p>
                            <p className="font-mono font-bold">
                              {student.totalCombats > 0
                                ? `${((student.combatsWon / student.totalCombats) * 100).toFixed(0)}%`
                                : "—"
                              }
                            </p>
                          </div>
                        </div>
                        {achievements.length > 0 && (
                          <div>
                            <p className="text-xs text-gray-400 mb-1">Conquistas:</p>
                            <div className="flex flex-wrap gap-1">
                              {achievements.map((achId: string) => (
                                <span key={achId} className="text-xs bg-yellow-500/10 text-yellow-400 px-2 py-0.5 rounded-full">
                                  {achId}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {student.lastPlayedAt && (
                          <p className="text-xs text-gray-500 mt-2">
                            Último acesso: {new Date(student.lastPlayedAt).toLocaleString("pt-BR")}
                          </p>
                        )}
                        {/* Botão admin: ver jogo como este aluno */}
                        <div className="mt-3 pt-3 border-t border-white/10">
                          <a
                            href={`/jogo/${classId}?adminView=true&memberId=${student.memberId}&memberName=${encodeURIComponent(student.memberName || 'Aluno')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-all hover:opacity-80"
                            style={{ backgroundColor: "#7c3aed" }}
                          >
                            <Eye size={12} />
                            Ver jogo como este aluno
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ═══ REPORTS TAB ═══ */}
        {activeTab === "reports" && (
          <div className="space-y-3">
            {(reports || []).length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <MessageCircle size={48} className="mx-auto mb-4 opacity-50" />
                <p>Nenhum relatório recebido</p>
              </div>
            ) : (
              (reports || []).map((report: any) => (
                <div
                  key={report.id}
                  className={`
                    border rounded-xl p-4
                    ${report.status === "pending"
                      ? "bg-amber-500/5 border-amber-500/20"
                      : report.status === "resolved"
                        ? "bg-emerald-500/5 border-emerald-500/20"
                        : "bg-white/5 border-white/10"
                    }
                  `}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`
                        px-2 py-0.5 rounded-full text-xs font-medium
                        ${report.reportType === "error" ? "bg-red-500/20 text-red-400" :
                          report.reportType === "doubt" ? "bg-blue-500/20 text-blue-400" :
                          "bg-purple-500/20 text-purple-400"}
                      `}>
                        {report.reportType === "error" ? "Erro" : report.reportType === "doubt" ? "Dúvida" : "Sugestão"}
                      </span>
                      <span className="text-sm font-medium">{report.memberName}</span>
                      {report.questId && (
                        <span className="text-xs text-gray-500">Missão #{report.questId}</span>
                      )}
                    </div>
                    <span className={`
                      px-2 py-0.5 rounded-full text-xs
                      ${report.status === "pending" ? "bg-amber-500/20 text-amber-400" :
                        report.status === "resolved" ? "bg-emerald-500/20 text-emerald-400" :
                        report.status === "reviewed" ? "bg-blue-500/20 text-blue-400" :
                        "bg-gray-500/20 text-gray-400"}
                    `}>
                      {report.status === "pending" ? "Pendente" :
                        report.status === "resolved" ? "Resolvido" :
                        report.status === "reviewed" ? "Revisado" : "Dispensado"}
                    </span>
                  </div>

                  <p className="text-sm text-gray-300 mb-3">{report.description}</p>

                  {report.teacherResponse && (
                    <div className="bg-white/5 rounded-lg p-3 mb-3">
                      <p className="text-xs text-gray-400 mb-1">Resposta do professor:</p>
                      <p className="text-sm">{report.teacherResponse}</p>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">
                      {new Date(report.createdAt).toLocaleString("pt-BR")}
                    </span>

                    {report.status === "pending" && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setRespondingReport(report.id)}
                          className="text-blue-400 text-xs"
                        >
                          <Send size={12} className="mr-1" /> Responder
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRespondReport(report.id, "resolved")}
                          className="text-emerald-400 text-xs"
                        >
                          <CheckCircle2 size={12} className="mr-1" /> Resolver
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRespondReport(report.id, "dismissed")}
                          className="text-gray-400 text-xs"
                        >
                          <XCircle size={12} className="mr-1" /> Dispensar
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}

            {/* Respond Dialog */}
            <Dialog open={respondingReport !== null} onOpenChange={() => setRespondingReport(null)}>
              <DialogContent className="bg-[#111638] border-emerald-500/20 text-white max-w-md">
                <DialogHeader>
                  <DialogTitle>Responder Relatório</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <textarea
                    value={responseText}
                    onChange={e => setResponseText(e.target.value)}
                    placeholder="Escreva sua resposta..."
                    className="w-full h-24 bg-white/5 border border-white/10 rounded-lg p-3 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:border-emerald-500/50"
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={() => respondingReport && handleRespondReport(respondingReport, "resolved")}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                    >
                      Resolver
                    </Button>
                    <Button
                      onClick={() => respondingReport && handleRespondReport(respondingReport, "reviewed")}
                      variant="outline"
                      className="flex-1"
                    >
                      Marcar Revisado
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}

        {/* ═══ BOSS BATTLES TAB ═══ */}
        {activeTab === "bosses" && (
          <div className="space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-gradient-to-br from-red-500/10 to-red-900/10 border border-red-500/20 rounded-xl p-4 text-center">
                <Skull size={24} className="mx-auto mb-2 text-red-400" />
                <p className="text-2xl font-bold text-red-400">
                  {(bossStats as any)?.weekStats?.reduce((sum: number, w: any) => sum + w.totalAttempts, 0) || 0}
                </p>
                <p className="text-xs text-gray-400">Total Tentativas</p>
              </div>
              <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-900/10 border border-emerald-500/20 rounded-xl p-4 text-center">
                <Trophy size={24} className="mx-auto mb-2 text-emerald-400" />
                <p className="text-2xl font-bold text-emerald-400">
                  {(bossStats as any)?.weekStats?.reduce((sum: number, w: any) => sum + w.totalVictories, 0) || 0}
                </p>
                <p className="text-xs text-gray-400">Total Vitórias</p>
              </div>
              <div className="bg-gradient-to-br from-purple-500/10 to-purple-900/10 border border-purple-500/20 rounded-xl p-4 text-center">
                <Users size={24} className="mx-auto mb-2 text-purple-400" />
                <p className="text-2xl font-bold text-purple-400">
                  {(bossStats as any)?.weekStats?.reduce((sum: number, w: any) => sum + w.uniqueVictors, 0) || 0}
                </p>
                <p className="text-xs text-gray-400">Alunos Vitoriosos</p>
              </div>
              <div className="bg-gradient-to-br from-amber-500/10 to-amber-900/10 border border-amber-500/20 rounded-xl p-4 text-center">
                <Swords size={24} className="mx-auto mb-2 text-amber-400" />
                <p className="text-2xl font-bold text-amber-400">
                  {(bossStats as any)?.weekStats?.filter((w: any) => w.totalVictories > 0).length || 0}/17
                </p>
                <p className="text-xs text-gray-400">Bosses Derrotados</p>
              </div>
            </div>

            {/* Boss List */}
            {BOSSES.map((boss) => {
              const weekStat = ((bossStats as any)?.weekStats || []).find((w: any) => w.weekNumber === boss.weekNumber);
              const isExpanded = expandedBossWeek === boss.weekNumber;
              const hasActivity = weekStat && weekStat.totalAttempts > 0;

              return (
                <div key={boss.id} className={`border rounded-xl overflow-hidden transition-all ${
                  hasActivity
                    ? weekStat.uniqueVictors > 0
                      ? "bg-emerald-500/5 border-emerald-500/20"
                      : "bg-amber-500/5 border-amber-500/20"
                    : "bg-white/5 border-white/10"
                }`}>
                  {/* Boss Header */}
                  <button
                    onClick={() => setExpandedBossWeek(isExpanded ? null : boss.weekNumber)}
                    className="w-full flex items-center gap-3 p-4 hover:bg-white/5 transition-colors"
                  >
                    <div className="text-3xl">{boss.emoji}</div>
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm">Sem. {boss.weekNumber}</span>
                        <span className="text-sm text-gray-300">{boss.name}</span>
                        {weekStat && weekStat.uniqueVictors > 0 && (
                          <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full text-xs">Derrotado</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">{boss.title}</p>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      <div className="text-center">
                        <p className="text-lg font-bold text-white">{weekStat?.totalAttempts || 0}</p>
                        <p>Tentativas</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold text-emerald-400">{weekStat?.totalVictories || 0}</p>
                        <p>Vitórias</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold text-red-400">{weekStat?.totalDefeats || 0}</p>
                        <p>Derrotas</p>
                      </div>
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </button>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="border-t border-white/10 p-4 space-y-4">
                      {/* Boss Info */}
                      <div className="flex items-center gap-4 bg-white/5 rounded-lg p-3">
                        {boss.imageUrl && (
                          <img src={boss.imageUrl} alt={boss.name} className="w-16 h-16 rounded-lg object-cover" />
                        )}
                        <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                          <div><span className="text-gray-400">HP Boss:</span> <span className="font-bold text-red-400">{boss.hp}</span></div>
                          <div><span className="text-gray-400">HP Jogador:</span> <span className="font-bold text-emerald-400">{boss.playerHp}</span></div>
                          <div><span className="text-gray-400">Recompensa PF:</span> <span className="font-bold text-amber-400">{boss.pfReward}</span></div>
                          <div><span className="text-gray-400">Recompensa XP:</span> <span className="font-bold text-purple-400">{boss.xpReward}</span></div>
                          <div><span className="text-gray-400">Fases:</span> <span className="font-bold">{boss.phases.length}</span></div>
                          <div><span className="text-gray-400">Perguntas:</span> <span className="font-bold">{boss.phases.reduce((sum, p) => sum + p.questions.length, 0)}</span></div>
                          <div><span className="text-gray-400">Tempo Médio:</span> <span className="font-bold">{weekStat?.avgTimeSpent ? `${weekStat.avgTimeSpent}s` : "--"}</span></div>
                          <div><span className="text-gray-400">Combo Médio:</span> <span className="font-bold">{weekStat?.avgCombo || "--"}</span></div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setPreviewBoss(boss)}
                          className="text-xs border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                        >
                          <Eye size={12} className="mr-1" /> Ver Perguntas
                        </Button>
                      </div>

                      {/* Player Attempts Table */}
                      {weekStat && weekStat.playerAttempts.length > 0 ? (
                        <div>
                          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                            <Users size={14} /> Tentativas dos Alunos ({weekStat.playerAttempts.length})
                          </h4>
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-gray-400 border-b border-white/10">
                                  <th className="text-left py-2 px-2">Aluno</th>
                                  <th className="text-center py-2 px-2">Status</th>
                                  <th className="text-center py-2 px-2">Tentativas</th>
                                  <th className="text-center py-2 px-2">Dano</th>
                                  <th className="text-center py-2 px-2">Combo</th>
                                  <th className="text-center py-2 px-2">Tempo</th>
                                  <th className="text-center py-2 px-2">PF</th>
                                  <th className="text-center py-2 px-2">Ações</th>
                                </tr>
                              </thead>
                              <tbody>
                                {weekStat.playerAttempts.map((pa: any) => (
                                  <tr key={pa.memberId} className="border-b border-white/5 hover:bg-white/5">
                                    <td className="py-2 px-2 font-medium">{pa.memberName}</td>
                                    <td className="py-2 px-2 text-center">
                                      {pa.won
                                        ? <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full">Venceu</span>
                                        : <span className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded-full">Derrotado</span>
                                      }
                                    </td>
                                    <td className="py-2 px-2 text-center">{pa.attempts}</td>
                                    <td className="py-2 px-2 text-center text-amber-400">{pa.bestDamage}</td>
                                    <td className="py-2 px-2 text-center text-purple-400">{pa.bestCombo}x</td>
                                    <td className="py-2 px-2 text-center">{pa.bestTime}s</td>
                                    <td className="py-2 px-2 text-center text-amber-400">+{pa.pfEarned}</td>
                                    <td className="py-2 px-2 text-center">
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={async () => {
                                          try {
                                            await resetBossMutation.mutateAsync({
                                              classId,
                                              memberId: pa.memberId,
                                              weekNumber: boss.weekNumber,
                                            });
                                            toast.success(`Boss resetado para ${pa.memberName}`);
                                            refetchBossStats();
                                          } catch {
                                            toast.error("Erro ao resetar boss");
                                          }
                                        }}
                                        className="text-xs text-amber-400 hover:text-amber-300"
                                      >
                                        <RotateCcw size={12} className="mr-1" /> Resetar
                                      </Button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-6 text-gray-500">
                          <Skull size={32} className="mx-auto mb-2 opacity-30" />
                          <p className="text-sm">Nenhum aluno enfrentou este boss ainda</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Boss Preview Dialog */}
            <Dialog open={previewBoss !== null} onOpenChange={() => setPreviewBoss(null)}>
              <DialogContent className="bg-[#111638] border-purple-500/20 text-white max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <span className="text-2xl">{previewBoss?.emoji}</span>
                    {previewBoss?.name} — {previewBoss?.title}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  {previewBoss?.phases.map((phase, pi) => (
                    <div key={pi} className="bg-white/5 rounded-lg p-4">
                      <h4 className="font-bold text-sm mb-3 flex items-center gap-2">
                        <Crown size={14} className="text-amber-400" />
                        Fase {pi + 1}: {phase.name}
                      </h4>
                      <div className="space-y-3">
                        {phase.questions.map((q, qi) => (
                          <div key={qi} className="bg-white/5 rounded-lg p-3">
                            <p className="text-sm font-medium mb-2">{qi + 1}. {q.question}</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                              {q.alternatives.map((alt) => (
                                <div
                                  key={alt.id}
                                  className={`text-xs px-2 py-1 rounded ${
                                    alt.id === q.correctAnswer
                                      ? "bg-emerald-500/20 text-emerald-400 font-bold"
                                      : "bg-white/5 text-gray-400"
                                  }`}
                                >
                                  {alt.id.toUpperCase()}) {alt.text}
                                </div>
                              ))}
                            </div>
                            {q.explanation && (
                              <p className="text-xs text-gray-500 mt-2 italic">{q.explanation}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>
    </div>
  );
}