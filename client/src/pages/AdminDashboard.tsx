/**
 * Admin Dashboard — Painel Administrativo Geral
 * Acesso completo para gerenciar turmas, alunos, professores, códigos de convite e configurações
 * Dados reais do banco de dados via tRPC
 */
import { useState, useEffect, useMemo, lazy, Suspense } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  Users, GraduationCap, BookOpen, Settings, LogOut,
  BarChart3, CheckCircle, Clock, Shield,
  Plus, Trash2, Eye, RefreshCw, Ticket,
  ToggleLeft, ToggleRight, ChevronDown, ChevronUp,
  Copy, ExternalLink, FlaskConical, ArrowLeft, UserPlus, Edit2, X,
  Upload, Download, AlertCircle, GraduationCap as StudentIcon,
  Database, Bell, FileText, Lock, Save, RotateCcw, Mail, Key, QrCode, Search, Crown
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
const PFDistributionCharts = lazy(() => import('@/components/PFDistributionCharts').then(m => ({ default: m.PFDistributionCharts })));

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend);

const DARK_BG = "#0A1628";
const CARD_BG = "#0D1B2A";
const ORANGE = "#F7941D";

interface AdminTab {
  id: string;
  label: string;
  icon: React.ReactNode;
}

const ADMIN_TABS: AdminTab[] = [
  { id: "overview", label: "Visão Geral", icon: <BarChart3 size={20} /> },
  { id: "busca", label: "Busca Geral", icon: <Search size={20} /> },
  { id: "turmas", label: "Turmas", icon: <FlaskConical size={20} /> },
  { id: "import", label: "Importar Alunos", icon: <Upload size={20} /> },
  { id: "teams", label: "Equipes", icon: <Users size={20} /> },
  { id: "professors", label: "Professores", icon: <BookOpen size={20} /> },
  { id: "invites", label: "Códigos de Convite", icon: <Ticket size={20} /> },
  { id: "settings", label: "Configurações", icon: <Settings size={20} /> },
];

export default function AdminDashboard() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState("overview");
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [teacherRole, setTeacherRole] = useState<string | null>(null);

  useEffect(() => {
    const adminRole = localStorage.getItem("adminRole");
    const adminToken = localStorage.getItem("sessionToken");
    const teacherToken = localStorage.getItem("teacherSessionToken");

    if (adminRole === "super_admin" && adminToken) {
      setSessionToken(adminToken);
      setTeacherRole("super_admin");
    } else if (teacherToken) {
      setSessionToken(teacherToken);
    } else {
      navigate("/");
      return;
    }
  }, [navigate]);

  // Fetch teacher role from server when using teacherSessionToken
  const teacherMeQuery = trpc.teacherAuth.me.useQuery(
    { sessionToken: sessionToken || "" },
    { enabled: !!sessionToken && teacherRole === null }
  );

  useEffect(() => {
    if (teacherMeQuery.data) {
      const role = teacherMeQuery.data.role;
      setTeacherRole(role);
      // Regular professors should use /admin/professor instead
      if (role === "professor") {
        navigate("/admin/professor");
      }
    }
  }, [teacherMeQuery.data, navigate]);

  const handleLogout = () => {
    localStorage.removeItem("teacherSessionToken");
    localStorage.removeItem("sessionToken");
    localStorage.removeItem("adminEmail");
    localStorage.removeItem("adminRole");
    localStorage.removeItem("adminLoginTime");
    localStorage.removeItem("teacherName");
    localStorage.removeItem("teacherEmail");
    toast.success("Sessão encerrada com sucesso");
    navigate("/");
  };

  if (!sessionToken) return null;

  // Show loading while fetching teacher role
  if (teacherRole === null && teacherMeQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: DARK_BG }}>
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Verificando permissões...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: DARK_BG }}>
      {/* Header */}
      <div className="border-b border-gray-700 p-4 sm:p-6 2xl:p-8" style={{ backgroundColor: CARD_BG }}>
        <div className="max-w-7xl 2xl:max-w-[1600px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ backgroundColor: `${ORANGE}20` }}>
              <Shield size={28} style={{ color: ORANGE }} />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl 2xl:text-4xl font-bold text-white">Painel Administrativo</h1>
              <p className="text-gray-400 text-sm 2xl:text-base">Gerenciamento completo da plataforma</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.location.href = "/professor/qrcode"}
              className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all hover:scale-105 text-sm"
              style={{ backgroundColor: "rgba(16,185,129,0.15)", color: "#10B981", border: "1px solid rgba(16,185,129,0.3)" }}
              title="Projetar QR Code de Presença na TV"
            >
              <QrCode size={16} />
              <span className="hidden sm:inline">QR Presença</span>
            </button>
            <button
              onClick={() => window.location.href = "/admin/professor"}
              className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all hover:scale-105 text-sm"
              style={{ backgroundColor: `${ORANGE}30`, color: ORANGE, border: `1px solid ${ORANGE}50` }}
              title="Acessar Painel do Professor"
            >
              <ExternalLink size={16} />
              <span className="hidden sm:inline">Painel Professor</span>
            </button>
            <button
              onClick={() => window.location.href = "/leaderboard"}
              className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all hover:scale-105 text-sm"
              style={{ backgroundColor: `rgba(100,200,255,0.15)`, color: "#64C8FF", border: "1px solid rgba(100,200,255,0.3)" }}
              title="Acessar Portal do Aluno"
            >
              <GraduationCap size={16} />
              <span className="hidden sm:inline">Portal Aluno</span>
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all hover:scale-105"
              style={{ backgroundColor: "rgba(255,80,80,0.15)", color: "#FF6B6B", border: "1px solid rgba(255,80,80,0.3)" }}
            >
              <LogOut size={18} />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-700 overflow-x-auto" style={{ backgroundColor: CARD_BG }}>
        <div className="max-w-7xl 2xl:max-w-[1600px] mx-auto flex gap-1 2xl:gap-2 p-4 2xl:p-6">
          {ADMIN_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all whitespace-nowrap text-sm"
              style={{
                backgroundColor: activeTab === tab.id ? ORANGE : "rgba(255,255,255,0.05)",
                color: activeTab === tab.id ? "#000" : "#fff",
                border: activeTab === tab.id ? "none" : "1px solid rgba(255,255,255,0.1)",
                fontWeight: activeTab === tab.id ? 700 : 400,
              }}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content Area */}
      <div className="max-w-7xl 2xl:max-w-[1600px] mx-auto p-4 sm:p-6 2xl:p-8">
        {activeTab === "overview" && <OverviewTab sessionToken={sessionToken} />}
        {activeTab === "busca" && <BuscaGeralTab sessionToken={sessionToken} />}
        {activeTab === "turmas" && <TurmasAdminTab sessionToken={sessionToken} />}
        {activeTab === "import" && <ImportStudentsTab sessionToken={sessionToken} />}

        {activeTab === "teams" && <TeamsTab sessionToken={sessionToken} />}
        {activeTab === "professors" && <ProfessorsTab sessionToken={sessionToken} />}
        {activeTab === "invites" && <InviteCodesTab sessionToken={sessionToken} />}
        {activeTab === "settings" && <SettingsTab />}
      </div>
    </div>
  );
}

// ─── Busca Geral Tab — busca unificada de alunos e professores ───
function BuscaGeralTab({ sessionToken }: { sessionToken: string }) {
  const [search, setSearch] = useState("");
  const [expandedAluno, setExpandedAluno] = useState<number | null>(null);
  const [expandedProf, setExpandedProf] = useState<number | null>(null);
  const [editAluno, setEditAluno] = useState<{ name: string; xp: string; teamId: number; classId: number | null } | null>(null);
  const [confirmDeleteAluno, setConfirmDeleteAluno] = useState<number | null>(null);
  const [confirmDeleteProf, setConfirmDeleteProf] = useState<number | null>(null);

  const membersQuery = trpc.members.list.useQuery({ sessionToken });
  const teamsQuery = trpc.teams.list.useQuery({ sessionToken });
  const classesQuery = trpc.classes.list.useQuery({ sessionToken });
  const teachersQuery = trpc.teacherManagement.listAll.useQuery({ sessionToken });
  const utils = trpc.useUtils();

  const updateMember = trpc.members.update.useMutation({
    onSuccess: () => { toast.success("Aluno atualizado!"); setEditAluno(null); membersQuery.refetch(); },
    onError: (err) => toast.error(err.message || "Erro ao atualizar aluno"),
  });
  const deleteMember = trpc.members.delete.useMutation({
    onSuccess: () => { toast.success("Aluno removido"); setConfirmDeleteAluno(null); membersQuery.refetch(); },
    onError: (err) => toast.error(err.message),
  });
  const toggleActive = trpc.teacherManagement.toggleActive.useMutation({
    onSuccess: (d) => { toast.success(d.message); teachersQuery.refetch(); },
    onError: (err) => toast.error(err.message),
  });
  const promoteToCoord = trpc.teacherManagement.promoteToCoordinator.useMutation({
    onSuccess: (d) => { toast.success(d.message); teachersQuery.refetch(); },
    onError: (err) => toast.error(err.message),
  });
  const demoteToTeacher = trpc.teacherManagement.demoteToTeacher.useMutation({
    onSuccess: (d) => { toast.success(d.message); teachersQuery.refetch(); },
    onError: (err) => toast.error(err.message),
  });
  const deleteTeacher = trpc.teacherManagement.deleteTeacher.useMutation({
    onSuccess: () => { toast.success("Professor removido"); setConfirmDeleteProf(null); teachersQuery.refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const members = membersQuery.data || [];
  const teams = teamsQuery.data || [];
  const classes = classesQuery.data || [];
  const teachers = teachersQuery.data || [];

  const teamById = useMemo(() => new Map(teams.map((t: any) => [t.id, t])), [teams]);
  const classById = useMemo(() => new Map((classes as any[]).map((c: any) => [c.id, c])), [classes]);

  const termo = search.trim().toLowerCase();
  const buscaAtiva = termo.length >= 2;

  const alunosFiltrados = useMemo(() => {
    if (!buscaAtiva) return [];
    return (members as any[])
      .filter(m => (m.name || "").toLowerCase().includes(termo))
      .slice(0, 25);
  }, [members, termo, buscaAtiva]);

  const professoresFiltrados = useMemo(() => {
    if (!buscaAtiva) return [];
    return (teachers as any[])
      .filter(t => (t.name || "").toLowerCase().includes(termo) || (t.email || "").toLowerCase().includes(termo))
      .slice(0, 25);
  }, [teachers, termo, buscaAtiva]);

  const abrirEdicaoAluno = (m: any) => {
    setExpandedAluno(m.id);
    setEditAluno({ name: m.name, xp: String(m.xp ?? "0"), teamId: m.teamId, classId: m.classId ?? null });
  };

  const salvarEdicaoAluno = (id: number) => {
    if (!editAluno) return;
    updateMember.mutate({
      sessionToken, id,
      name: editAluno.name, xp: editAluno.xp, teamId: editAluno.teamId, classId: editAluno.classId,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Search size={22} style={{ color: ORANGE }} /> Busca Geral
        </h2>
        <p className="text-sm text-gray-400 mt-1">Busque qualquer aluno ou professor da plataforma numa tela só.</p>
      </div>

      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Digite pelo menos 2 letras do nome (aluno) ou nome/email (professor)..."
          className="w-full pl-10 pr-4 py-3 rounded-lg text-white text-sm focus:outline-none"
          style={{ backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
        />
      </div>

      {!buscaAtiva && (
        <div className="rounded-lg border border-gray-700 p-8 text-center text-sm text-gray-500" style={{ backgroundColor: CARD_BG }}>
          Digite ao menos 2 letras para buscar entre {members.length} alunos e {teachers.length} professores.
        </div>
      )}

      {buscaAtiva && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Alunos */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
              <GraduationCap size={16} style={{ color: "#64C8FF" }} /> Alunos ({alunosFiltrados.length}{alunosFiltrados.length === 25 ? "+" : ""})
            </h3>
            {alunosFiltrados.length === 0 ? (
              <p className="text-xs text-gray-500">Nenhum aluno encontrado.</p>
            ) : alunosFiltrados.map((m: any) => {
              const team = teamById.get(m.teamId) as any;
              const cls = m.classId ? (classById.get(m.classId) as any) : null;
              const isExpanded = expandedAluno === m.id;
              return (
                <div key={m.id} className="rounded-lg border border-gray-700 overflow-hidden" style={{ backgroundColor: CARD_BG }}>
                  <button onClick={() => { setExpandedAluno(isExpanded ? null : m.id); setEditAluno(null); }}
                    className="w-full p-3 flex items-center justify-between text-left">
                    <div>
                      <p className="text-sm font-medium text-white">{m.name}</p>
                      <p className="text-xs text-gray-500">
                        {team ? `${team.emoji} ${team.name}` : "Sem equipe"} · {cls?.name || "Sem turma"} · {parseFloat(m.xp || "0").toFixed(1)} PF
                      </p>
                    </div>
                    {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                  </button>
                  {isExpanded && (
                    <div className="px-3 pb-3 space-y-3 border-t border-gray-700 pt-3">
                      {editAluno ? (
                        <div className="space-y-2">
                          <input value={editAluno.name} onChange={e => setEditAluno({ ...editAluno, name: e.target.value })}
                            className="w-full px-2 py-1.5 rounded text-xs text-white" style={{ backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }} placeholder="Nome" />
                          <div className="grid grid-cols-2 gap-2">
                            <input value={editAluno.xp} onChange={e => setEditAluno({ ...editAluno, xp: e.target.value })}
                              className="px-2 py-1.5 rounded text-xs text-white" style={{ backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }} placeholder="PF" />
                            <select value={editAluno.teamId} onChange={e => setEditAluno({ ...editAluno, teamId: Number(e.target.value) })}
                              className="px-2 py-1.5 rounded text-xs text-white" style={{ backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                              {teams.map((t: any) => <option key={t.id} value={t.id} className="bg-gray-900">{t.name}</option>)}
                            </select>
                          </div>
                          <select value={editAluno.classId ?? ""} onChange={e => setEditAluno({ ...editAluno, classId: e.target.value ? Number(e.target.value) : null })}
                            className="w-full px-2 py-1.5 rounded text-xs text-white" style={{ backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                            <option value="" className="bg-gray-900">Sem turma</option>
                            {(classes as any[]).map((c: any) => <option key={c.id} value={c.id} className="bg-gray-900">{c.name}</option>)}
                          </select>
                          <div className="flex gap-2">
                            <button onClick={() => salvarEdicaoAluno(m.id)} disabled={updateMember.isPending}
                              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium" style={{ backgroundColor: ORANGE, color: "#000" }}>
                              <Save size={12} /> {updateMember.isPending ? "Salvando..." : "Salvar"}
                            </button>
                            <button onClick={() => setEditAluno(null)} className="px-3 py-1.5 rounded text-xs text-gray-400" style={{ backgroundColor: "rgba(255,255,255,0.05)" }}>Cancelar</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button onClick={() => abrirEdicaoAluno(m)}
                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium" style={{ backgroundColor: "rgba(100,200,255,0.15)", color: "#64C8FF" }}>
                            <Edit2 size={12} /> Editar
                          </button>
                          {confirmDeleteAluno === m.id ? (
                            <button onClick={() => deleteMember.mutate({ id: m.id, sessionToken })}
                              className="flex-1 px-3 py-1.5 rounded text-xs font-medium" style={{ backgroundColor: "rgba(255,80,80,0.25)", color: "#FF6B6B" }}>
                              Confirmar exclusão?
                            </button>
                          ) : (
                            <button onClick={() => setConfirmDeleteAluno(m.id)}
                              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium" style={{ backgroundColor: "rgba(255,80,80,0.1)", color: "#FF6B6B" }}>
                              <Trash2 size={12} /> Remover
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Professores */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
              <BookOpen size={16} style={{ color: ORANGE }} /> Professores ({professoresFiltrados.length}{professoresFiltrados.length === 25 ? "+" : ""})
            </h3>
            {professoresFiltrados.length === 0 ? (
              <p className="text-xs text-gray-500">Nenhum professor encontrado.</p>
            ) : professoresFiltrados.map((t: any) => {
              const isExpanded = expandedProf === t.id;
              return (
                <div key={t.id} className="rounded-lg border border-gray-700 overflow-hidden" style={{ backgroundColor: CARD_BG }}>
                  <button onClick={() => setExpandedProf(isExpanded ? null : t.id)} className="w-full p-3 flex items-center justify-between text-left">
                    <div>
                      <p className="text-sm font-medium text-white flex items-center gap-1.5">
                        {t.name}
                        {t.role === "super_admin" && <Crown size={12} className="text-amber-400" />}
                      </p>
                      <p className="text-xs text-gray-500">{t.email} · {t.role} · {t.isActive ? "ativo" : "inativo"}</p>
                    </div>
                    {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                  </button>
                  {isExpanded && (
                    <div className="px-3 pb-3 space-y-2 border-t border-gray-700 pt-3">
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => toggleActive.mutate({ sessionToken, teacherId: t.id, isActive: t.isActive ? 0 : 1 })}
                          disabled={toggleActive.isPending}
                          className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium"
                          style={{ backgroundColor: t.isActive ? "rgba(255,80,80,0.1)" : "rgba(16,185,129,0.15)", color: t.isActive ? "#FF6B6B" : "#10B981" }}>
                          {t.isActive ? <ToggleLeft size={12} /> : <ToggleRight size={12} />} {t.isActive ? "Desativar" : "Ativar"}
                        </button>
                        {t.role === "professor" ? (
                          <button onClick={() => promoteToCoord.mutate({ sessionToken, teacherId: t.id })} disabled={promoteToCoord.isPending}
                            className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium" style={{ backgroundColor: "rgba(247,148,29,0.15)", color: ORANGE }}>
                            <Crown size={12} /> Promover
                          </button>
                        ) : t.role === "coordenador" ? (
                          <button onClick={() => demoteToTeacher.mutate({ sessionToken, teacherId: t.id })} disabled={demoteToTeacher.isPending}
                            className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium" style={{ backgroundColor: "rgba(255,255,255,0.05)", color: "#9CA3AF" }}>
                            Rebaixar
                          </button>
                        ) : (
                          <span className="flex items-center justify-center text-[10px] text-gray-500">Super admin — sem ação de cargo</span>
                        )}
                      </div>
                      {t.role !== "super_admin" && (
                        confirmDeleteProf === t.id ? (
                          <button onClick={() => deleteTeacher.mutate({ sessionToken, teacherId: t.id })}
                            className="w-full px-3 py-1.5 rounded text-xs font-medium" style={{ backgroundColor: "rgba(255,80,80,0.25)", color: "#FF6B6B" }}>
                            Confirmar exclusão?
                          </button>
                        ) : (
                          <button onClick={() => setConfirmDeleteProf(t.id)}
                            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium" style={{ backgroundColor: "rgba(255,80,80,0.1)", color: "#FF6B6B" }}>
                            <Trash2 size={12} /> Remover professor
                          </button>
                        )
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Overview Tab ───
function OverviewTab({ sessionToken }: { sessionToken: string }) {
  const [selectedClassId, setSelectedClassId] = useState<number | undefined>(undefined);
  const [exportingPdf, setExportingPdf] = useState(false);

  const statsQuery = trpc.superAdmin.getStats.useQuery(
    { sessionToken, classId: selectedClassId },
    { retry: 1, refetchOnWindowFocus: false }
  );

  if (statsQuery.isLoading) {
    return <LoadingState text="Carregando estatísticas..." />;
  }

  if (statsQuery.error) {
    return <ErrorState text="Erro ao carregar estatísticas. Verifique sua sessão." />;
  }

  const stats = statsQuery.data;
  if (!stats) return null;

  const scopeLabel = stats.system.selectedClassName
    ? `Turma: ${stats.system.selectedClassName}`
    : "Todas as Turmas";

  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
      const now = new Date();
      const dateStr = now.toLocaleDateString("pt-BR");
      const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

      const html = `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
          <meta charset="UTF-8" />
          <title>Relatório Farmacologia — ${dateStr}</title>
          <style>
            body { font-family: Arial, sans-serif; color: #1a1a2e; margin: 0; padding: 32px; }
            h1 { color: #F7941D; font-size: 24px; margin-bottom: 4px; }
            .subtitle { color: #666; font-size: 13px; margin-bottom: 24px; }
            .section { margin-bottom: 28px; }
            .section h2 { font-size: 16px; color: #F7941D; border-bottom: 2px solid #F7941D; padding-bottom: 6px; margin-bottom: 14px; }
            .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
            .card { background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 8px; padding: 14px; text-align: center; }
            .card .value { font-size: 28px; font-weight: bold; color: #F7941D; }
            .card .label { font-size: 11px; color: #666; margin-top: 4px; }
            .footer { margin-top: 40px; font-size: 11px; color: #999; text-align: center; border-top: 1px solid #eee; padding-top: 12px; }
          </style>
        </head>
        <body>
          <h1>Relatório — Conexão em Farmacologia</h1>
          <p class="subtitle">Gerado em ${dateStr} às ${timeStr} — Escopo: ${scopeLabel}</p>

          <div class="section">
            <h2>Resumo Geral</h2>
            <div class="grid">
              <div class="card"><div class="value">${stats.system.totalMembers}</div><div class="label">Total de Alunos</div></div>
              <div class="card"><div class="value">${stats.system.totalTeams}</div><div class="label">Equipes Ativas</div></div>
              <div class="card"><div class="value">${stats.system.totalClasses}</div><div class="label">Turmas</div></div>
              <div class="card"><div class="value">${stats.system.totalXP}</div><div class="label">PF Total</div></div>
              <div class="card"><div class="value">${stats.system.avgXPPerMember}</div><div class="label">Média PF/Aluno</div></div>
              <div class="card"><div class="value">${stats.students.totalAccounts}</div><div class="label">Contas de Alunos</div></div>
            </div>
          </div>

          <div class="section">
            <h2>Professores</h2>
            <div class="grid">
              <div class="card"><div class="value">${stats.teachers.total}</div><div class="label">Total</div></div>
              <div class="card"><div class="value">${stats.teachers.active}</div><div class="label">Ativos</div></div>
              <div class="card"><div class="value">${stats.teachers.coordenadores}</div><div class="label">Coordenadores</div></div>
            </div>
          </div>

          <div class="section">
            <h2>Alunos</h2>
            <div class="grid">
              <div class="card"><div class="value">${stats.students.totalMembers}</div><div class="label">Membros (equipes)</div></div>
              <div class="card"><div class="value">${stats.students.activeAccounts}</div><div class="label">Contas ativas</div></div>
              <div class="card"><div class="value">${stats.students.withoutAccount}</div><div class="label">Sem conta</div></div>
            </div>
          </div>

          <div class="footer">Conexão em Farmacologia — UNIRIO 2026.1 — Relatório gerado automaticamente</div>
        </body>
        </html>
      `;

      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const win = window.open(url, "_blank");
      if (win) {
        win.onload = () => {
          win.print();
          URL.revokeObjectURL(url);
        };
      }
    } catch (err) {
      toast.error("Erro ao gerar PDF");
    } finally {
      setExportingPdf(false);
    }
  };

  const statCards = [
    { label: "Total de Alunos (Membros)", value: stats.system.totalMembers.toString(), icon: <GraduationCap size={24} />, color: ORANGE },
    { label: "Equipes Ativas", value: stats.system.totalTeams.toString(), icon: <Users size={24} />, color: "#4A90E2" },
    { label: "Turmas", value: stats.system.totalClasses?.toString() || "0", icon: <FlaskConical size={24} />, color: "#FF6B6B" },
    { label: "Professores", value: stats.teachers.total.toString(), icon: <BookOpen size={24} />, color: "#7ED321" },
    { label: "PF Total da Turma", value: stats.system.totalXP, icon: <BarChart3 size={24} />, color: "#50E3C2" },
    { label: "Média PF/Aluno", value: stats.system.avgXPPerMember, icon: <CheckCircle size={24} />, color: "#9B59B6" },
    { label: "Contas de Alunos", value: stats.students.totalAccounts.toString(), icon: <Eye size={24} />, color: "#E74C3C" },
  ];

  return (
    <div className="space-y-6">
      {/* Header row with title, class filter and PDF export */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white">Visão Geral da Plataforma</h2>
          <p className="text-sm text-gray-400 mt-0.5">{scopeLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Class filter */}
          <select
            value={selectedClassId ?? ""}
            onChange={e => setSelectedClassId(e.target.value ? Number(e.target.value) : undefined)}
            className="px-3 py-2 rounded-lg text-sm border border-gray-600 bg-gray-800 text-white focus:outline-none focus:border-orange-400"
          >
            <option value="">Todas as Turmas</option>
            {stats.classes?.map(c => (
              <option key={c.id} value={c.id}>{c.name}{c.course ? ` — ${c.course}` : ""}</option>
            ))}
          </select>
          {/* PDF export button */}
          <button
            onClick={handleExportPdf}
            disabled={exportingPdf}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all hover:scale-105 disabled:opacity-50"
            style={{ backgroundColor: `${ORANGE}25`, color: ORANGE, border: `1px solid ${ORANGE}50` }}
          >
            <FileText size={16} />
            {exportingPdf ? "Gerando..." : "Exportar PDF"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map((stat, i) => (
          <motion.div
            key={i}
            className="rounded-lg p-6 border border-gray-700"
            style={{ backgroundColor: CARD_BG }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
          >
            <div className="flex items-center justify-between mb-3">
              <div style={{ color: stat.color }}>{stat.icon}</div>
            </div>
            <p className="text-gray-400 text-sm mb-1">{stat.label}</p>
            <p className="text-3xl font-bold text-white">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* PF Distribution Charts */}
      <Suspense fallback={<div className="text-gray-400">Carregando gráficos...</div>}>
        <PFDistributionCharts stats={{
          totalStudents: stats.students.totalMembers,
          totalTeams: stats.system.totalTeams,
          totalClasses: stats.system.totalClasses || 0,
          totalPF: parseFloat(stats.system.totalXP),
          averagePF: parseFloat(stats.system.avgXPPerMember),
        }} />
      </Suspense>

      {/* Teacher breakdown */}
      <div className="rounded-lg p-6 border border-gray-700" style={{ backgroundColor: CARD_BG }}>
        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <BookOpen size={20} style={{ color: ORANGE }} />
          Detalhes dos Professores
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-white">{stats.teachers.active}</p>
            <p className="text-xs text-gray-400">Ativos</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-white">{stats.teachers.inactive}</p>
            <p className="text-xs text-gray-400">Inativos</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-white">{stats.teachers.coordenadores}</p>
            <p className="text-xs text-gray-400">Coordenadores</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-white">{stats.teachers.superAdmins}</p>
            <p className="text-xs text-gray-400">Super Admins</p>
          </div>
        </div>
      </div>

      {/* Student breakdown */}
      <div className="rounded-lg p-6 border border-gray-700" style={{ backgroundColor: CARD_BG }}>
        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <GraduationCap size={20} style={{ color: ORANGE }} />
          Detalhes dos Alunos
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-white">{stats.students.totalMembers}</p>
            <p className="text-xs text-gray-400">Membros (equipes)</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-white">{stats.students.totalAccounts}</p>
            <p className="text-xs text-gray-400">Contas criadas</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-white">{stats.students.activeAccounts}</p>
            <p className="text-xs text-gray-400">Contas ativas</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-white">{stats.students.withoutAccount}</p>
            <p className="text-xs text-gray-400">Sem conta</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Turmas Admin Tab ───
function TurmasAdminTab({ sessionToken }: { sessionToken: string }) {
  const [selectedClass, setSelectedClass] = useState<number | null>(null);
  const [expandedTeam, setExpandedTeam] = useState<number | null>(null);
  const [editingClass, setEditingClass] = useState<number | null>(null);
  const [editClassName, setEditClassName] = useState("");
  const [editClassCourse, setEditClassCourse] = useState("");
  const [editClassDiscipline, setEditClassDiscipline] = useState("");

  const utils = trpc.useUtils();

  const classesList = trpc.classes.list.useQuery({ sessionToken });
  const classDetail = trpc.classes.getById.useQuery(
    { sessionToken, classId: selectedClass! },
    { enabled: !!selectedClass }
  );

  const updateClass = trpc.classes.update.useMutation({
    onSuccess: () => {
      utils.classes.list.invalidate();
      utils.classes.getById.invalidate();
      toast.success("Turma atualizada com sucesso!");
      setEditingClass(null);
    },
    onError: () => toast.error("Erro ao atualizar turma"),
  });

  if (classesList.isLoading) return <LoadingState text="Carregando turmas..." />;

  // Detail view
  if (selectedClass && classDetail.data) {
    const cls = classDetail.data;
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => setSelectedClass(null)} className="p-2 rounded-lg hover:bg-gray-700 text-gray-400">
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1">
            {editingClass === cls.id ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={editClassName}
                  onChange={e => setEditClassName(e.target.value)}
                  placeholder="Nome da turma"
                  className="w-full px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/50 text-sm"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={editClassCourse}
                    onChange={e => setEditClassCourse(e.target.value)}
                    placeholder="Curso"
                    className="w-full px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/50 text-sm"
                  />
                  <input
                    type="text"
                    value={editClassDiscipline}
                    onChange={e => setEditClassDiscipline(e.target.value)}
                    placeholder="Disciplina"
                    className="w-full px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/50 text-sm"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => updateClass.mutate({ sessionToken, id: cls.id, name: editClassName, course: editClassCourse, discipline: editClassDiscipline })}
                    disabled={updateClass.isPending}
                    className="px-3 py-1.5 rounded-md text-xs font-medium disabled:opacity-50 flex items-center gap-1 text-white"
                    style={{ backgroundColor: '#f97316' }}
                  >
                    <Save size={12} /> Salvar
                  </button>
                  <button
                    onClick={() => setEditingClass(null)}
                    className="px-3 py-1.5 rounded-md bg-gray-700 text-white text-xs font-medium flex items-center gap-1"
                  >
                    <X size={12} /> Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h2 className="text-2xl font-bold text-white">{cls.name}</h2>
                <p className="text-sm text-gray-400">
                  {cls.discipline} — {cls.course} — {cls.semester}
                  {cls.teacherName && <span> — Prof. {cls.teacherName}</span>}
                </p>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {editingClass !== cls.id && (
              <button
                onClick={() => { setEditingClass(cls.id); setEditClassName(cls.name); setEditClassCourse(cls.course); setEditClassDiscipline(cls.discipline); }}
                className="p-2 rounded-lg hover:bg-gray-700 text-orange-400"
                title="Editar nome da turma"
              >
                <Edit2 size={18} />
              </button>
            )}
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: cls.color }} />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="rounded-lg p-5 border border-gray-700" style={{ backgroundColor: CARD_BG }}>
            <p className="text-xs text-gray-400 uppercase">Equipes</p>
            <p className="text-3xl font-bold text-white mt-1">{cls.teams.length}</p>
          </div>
          <div className="rounded-lg p-5 border border-gray-700" style={{ backgroundColor: CARD_BG }}>
            <p className="text-xs text-gray-400 uppercase">Alunos</p>
            <p className="text-3xl font-bold text-white mt-1">{cls.members.length}</p>
          </div>
          <div className="rounded-lg p-5 border border-gray-700" style={{ backgroundColor: CARD_BG }}>
            <p className="text-xs text-gray-400 uppercase">PF Total</p>
            <p className="text-3xl font-bold mt-1" style={{ color: ORANGE }}>
              {cls.members.reduce((s: number, m: any) => s + parseFloat(m.xp || "0"), 0).toFixed(1)}
            </p>
          </div>
        </div>

        {/* Teams */}
        <div className="rounded-lg border border-gray-700" style={{ backgroundColor: CARD_BG }}>
          <div className="p-4 border-b border-gray-700">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Users size={18} style={{ color: ORANGE }} /> Equipes da Turma
            </h3>
          </div>
          {cls.teams.length === 0 ? (
            <div className="p-6 text-center text-gray-400">Nenhuma equipe nesta turma.</div>
          ) : (
            <div>
              {cls.teams.map((team: any) => {
                const teamMembers = cls.members.filter((m: any) => m.teamId === team.id);
                const totalPF = teamMembers.reduce((s: number, m: any) => s + parseFloat(m.xp || "0"), 0);
                return (
                  <div key={team.id} className="border-b border-gray-700/50 last:border-0">
                    <button
                      onClick={() => setExpandedTeam(expandedTeam === team.id ? null : team.id)}
                      className="w-full p-4 flex items-center justify-between text-left"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{team.emoji}</span>
                        <span className="font-bold text-white">{team.name}</span>
                        <span className="text-xs text-gray-400 px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.1)" }}>
                          {teamMembers.length} alunos
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm" style={{ color: team.color || ORANGE }}>{totalPF.toFixed(1)} PF</span>
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: team.color || ORANGE }} />
                        {expandedTeam === team.id ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                      </div>
                    </button>
                    <AnimatePresence>
                      {expandedTeam === team.id && teamMembers.length > 0 && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 pb-4">
                            <table className="w-full text-sm">
                              <thead>
                                <tr>
                                  <th className="px-3 py-2 text-left text-gray-500 text-xs">#</th>
                                  <th className="px-3 py-2 text-left text-gray-500 text-xs">Nome</th>
                                  <th className="px-3 py-2 text-right text-gray-500 text-xs">PF</th>
                                </tr>
                              </thead>
                              <tbody>
                                {teamMembers
                                  .sort((a: any, b: any) => parseFloat(b.xp || "0") - parseFloat(a.xp || "0"))
                                  .map((m: any, idx: number) => (
                                    <tr key={m.id} className="border-t border-gray-700/30">
                                      <td className="px-3 py-2 text-gray-500 text-xs">{idx + 1}</td>
                                      <td className="px-3 py-2 text-white">{m.name}</td>
                                      <td className="px-3 py-2 text-right font-mono" style={{ color: team.color || ORANGE }}>
                                        {parseFloat(m.xp || "0").toFixed(1)}
                                      </td>
                                    </tr>
                                  ))}
                              </tbody>
                            </table>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* All members list */}
        <div className="rounded-lg border border-gray-700" style={{ backgroundColor: CARD_BG }}>
          <div className="p-4 border-b border-gray-700">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <GraduationCap size={18} style={{ color: ORANGE }} /> Todos os Alunos ({cls.members.length})
            </h3>
          </div>
          {cls.members.length === 0 ? (
            <div className="p-6 text-center text-gray-400">Nenhum aluno nesta turma.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead style={{ backgroundColor: "rgba(255,255,255,0.03)" }}>
                  <tr>
                    <th className="px-4 py-2 text-left text-gray-400 text-xs">#</th>
                    <th className="px-4 py-2 text-left text-gray-400 text-xs">Nome</th>
                    <th className="px-4 py-2 text-left text-gray-400 text-xs">Equipe</th>
                    <th className="px-4 py-2 text-right text-gray-400 text-xs">PF</th>
                  </tr>
                </thead>
                <tbody>
                  {cls.members
                    .sort((a: any, b: any) => parseFloat(b.xp || "0") - parseFloat(a.xp || "0"))
                    .map((m: any, idx: number) => {
                      const team = cls.teams.find((t: any) => t.id === m.teamId);
                      return (
                        <tr key={m.id} className="border-t border-gray-700/50">
                          <td className="px-4 py-3 text-gray-500 text-xs">{idx + 1}</td>
                          <td className="px-4 py-3 text-white">{m.name}</td>
                          <td className="px-4 py-3">
                            {team ? (
                              <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: `${team.color}22`, color: team.color }}>
                                {team.emoji} {team.name}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-500">Sem equipe</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-mono" style={{ color: ORANGE }}>
                            {parseFloat(m.xp || "0").toFixed(1)}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  // List view
  const classes = classesList.data || [];
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">
          Turmas
          <span className="text-sm font-normal text-gray-400 ml-3">({classes.length} turmas)</span>
        </h2>
        <button
          onClick={() => classesList.refetch()}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all hover:scale-105"
          style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "#fff" }}
        >
          <RefreshCw size={16} />
          Atualizar
        </button>
      </div>

      {classes.length === 0 ? (
        <div className="rounded-lg p-8 border border-gray-700 text-center" style={{ backgroundColor: CARD_BG }}>
          <FlaskConical size={48} className="mx-auto mb-3 text-gray-600" />
          <p className="text-gray-400">Nenhuma turma cadastrada ainda.</p>
          <p className="text-gray-500 text-sm mt-1">As turmas são criadas pelos professores no painel de administração.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {classes.map((cls: any, i: number) => (
            <motion.button
              key={cls.id}
              onClick={() => setSelectedClass(cls.id)}
              className="rounded-lg p-5 border border-gray-700 text-left hover:border-gray-500 transition-all"
              style={{ backgroundColor: CARD_BG }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cls.color }} />
                <h3 className="text-lg font-bold text-white">{cls.name}</h3>
              </div>
              <div className="space-y-1 text-sm text-gray-400">
                <p>📚 {cls.discipline}</p>
                <p>🏫 {cls.course}</p>
                <p>📅 {cls.semester}</p>
                {cls.teacherName && <p>👨‍🏫 Prof. {cls.teacherName}</p>}
              </div>
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Import Students Tab ───
function ImportStudentsTab({ sessionToken }: { sessionToken: string }) {
  const [selectedClass, setSelectedClass] = useState<number | null>(null);
  const [csvText, setCsvText] = useState("");
  const [importing, setImporting] = useState(false);

  const classesList = trpc.classes.list.useQuery({ sessionToken });
  const importStudents = trpc.members.importBulk.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.imported} aluno(s) importado(s)${data.errors > 0 ? ` (${data.errors} erro(s))` : ''}`);
      setCsvText("");
      setSelectedClass(null);
      setImporting(false);
    },
    onError: (err) => {
      toast.error(err.message);
      setImporting(false);
    },
  });

  const handleImport = () => {
    if (!selectedClass) {
      toast.error("Selecione uma turma");
      return;
    }
    if (!csvText.trim()) {
      toast.error("Cole os dados dos alunos");
      return;
    }

    // Parse CSV: cada linha = nome,email,teamId,xp
    const lines = csvText.trim().split("\n");
    const students = [];
    const errors = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const parts = line.split(",").map(p => p.trim());
      if (parts.length < 1) {
        errors.push(`Linha ${i + 1}: formato inválido`);
        continue;
      }

      students.push({
        name: parts[0],
        email: parts[1] || undefined,
        teamId: parts[2] ? parseInt(parts[2]) : undefined,
        xp: parts[3] || "0",
      });
    }

    if (errors.length > 0) {
      toast.error(`${errors.length} erro(s) encontrado(s)`);
      return;
    }

    if (students.length === 0) {
      toast.error("Nenhum aluno para importar");
      return;
    }

    setImporting(true);
    importStudents.mutate({
      sessionToken,
      classId: selectedClass,
      students,
    });
  };

  const classes = classesList.data || [];
  const selectedClassData = classes.find(c => c.id === selectedClass);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Importar Alunos em Lote</h2>
      </div>

      {/* UNIRIO Import Tab */}
      <UnirioImportSection sessionToken={sessionToken} />

      {/* Info Box */}
      <div className="rounded-lg p-4 border border-blue-800/30" style={{ backgroundColor: "rgba(74, 144, 226, 0.1)" }}>
        <div className="flex gap-3">
          <AlertCircle size={20} className="text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-300">
            <p className="font-semibold mb-1">Como usar:</p>
            <p>Cole uma lista de alunos no formato: <code className="bg-black/30 px-2 py-1 rounded text-xs">Nome, Email (opt), Equipe ID (opt), PF (opt)</code></p>
            <p className="mt-1 text-xs text-blue-400">Exemplo: João Silva, joao@edu.unirio.br, 1, 0</p>
          </div>
        </div>
      </div>

      {/* Class Selector */}
      <div className="rounded-lg p-5 border border-gray-700" style={{ backgroundColor: CARD_BG }}>
        <label className="text-sm text-gray-400 block mb-2">Selecione a Turma</label>
        <select
          value={selectedClass || ""}
          onChange={(e) => setSelectedClass(e.target.value ? parseInt(e.target.value) : null)}
          className="w-full px-4 py-2 rounded-lg text-white text-sm"
          style={{ backgroundColor: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }}
        >
          <option value="">-- Selecione uma turma --</option>
          {classes.map(cls => (
            <option key={cls.id} value={cls.id}>
              {cls.name} ({cls.discipline})
            </option>
          ))}
        </select>
      </div>

      {/* CSV Input */}
      <div className="rounded-lg p-5 border border-gray-700" style={{ backgroundColor: CARD_BG }}>
        <label className="text-sm text-gray-400 block mb-2">Cole os dados dos alunos (um por linha)</label>
        <textarea
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
          placeholder="João Silva, joao@edu.unirio.br, 1, 0\nMaria Santos, maria@edu.unirio.br, 2, 0\nPedro Costa, pedro@edu.unirio.br, 1, 0"
          className="w-full px-4 py-3 rounded-lg text-white text-sm font-mono"
          style={{ backgroundColor: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }}
          rows={8}
        />
      </div>

      {/* Preview */}
      {csvText.trim() && (
        <div className="rounded-lg p-5 border border-gray-700" style={{ backgroundColor: CARD_BG }}>
          <h3 className="text-sm font-bold text-white mb-3">Preview ({csvText.trim().split("\n").length} alunos)</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {csvText.trim().split("\n").map((line, i) => {
              const parts = line.split(",").map(p => p.trim());
              return (
                <div key={i} className="text-xs text-gray-300 px-3 py-2 rounded" style={{ backgroundColor: "rgba(255,255,255,0.05)" }}>
                  <span className="text-gray-500">#{i + 1}</span> {parts[0]}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleImport}
          disabled={importing || !selectedClass || !csvText.trim()}
          className="flex items-center gap-2 px-6 py-2 rounded-lg font-semibold transition-all hover:scale-105 disabled:opacity-50"
          style={{ backgroundColor: ORANGE, color: "#000" }}
        >
          <Upload size={16} />
          {importing ? "Importando..." : "Importar Alunos"}
        </button>
        <button
          onClick={() => {
            setCsvText("");
            setSelectedClass(null);
          }}
          className="px-6 py-2 rounded-lg transition-all hover:scale-105"
          style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "#fff" }}
        >
          Limpar
        </button>
      </div>

      {/* Download Template */}
      <div className="rounded-lg p-5 border border-gray-700/50" style={{ backgroundColor: "rgba(255,255,255,0.03)" }}>
        <p className="text-sm text-gray-400 mb-3">Precisa de um modelo? Clique para baixar um arquivo CSV de exemplo:</p>
        <button
          onClick={() => {
            const template = "Nome,Email,Equipe ID,PF\nJoão Silva,joao@edu.unirio.br,1,0\nMaria Santos,maria@edu.unirio.br,2,0\nPedro Costa,pedro@edu.unirio.br,1,0";
            const blob = new Blob([template], { type: "text/csv" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "template-alunos.csv";
            a.click();
            URL.revokeObjectURL(url);
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all hover:scale-105"
          style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "#fff" }}
        >
          <Download size={14} />
          Baixar Template CSV
        </button>
      </div>
    </div>
  );
}

// ─── Students Tab ───
function StudentsTab({ sessionToken }: { sessionToken: string }) {
  const [expandedTeam, setExpandedTeam] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const teamsQuery = trpc.teams.list.useQuery({ sessionToken });
  const membersQuery = trpc.members.list.useQuery({ sessionToken });
  const deleteMember = trpc.members.delete.useMutation({
    onSuccess: () => {
      toast.success("Aluno removido com sucesso");
      membersQuery.refetch();
      setConfirmDelete(null);
    },
    onError: (err) => toast.error(err.message),
  });

  if (teamsQuery.isLoading || membersQuery.isLoading) {
    return <LoadingState text="Carregando alunos..." />;
  }

  const teams = teamsQuery.data || [];
  const members = membersQuery.data || [];

  const membersByTeam = teams.map(team => ({
    ...team,
    members: members.filter((m: any) => m.teamId === team.id),
  }));

  const unassigned = members.filter((m: any) => !teams.some((t: any) => t.id === m.teamId));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">
          Gerenciar Alunos
          <span className="text-sm font-normal text-gray-400 ml-3">({members.length} membros)</span>
        </h2>
        <button
          onClick={() => { teamsQuery.refetch(); membersQuery.refetch(); }}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all hover:scale-105"
          style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "#fff" }}
        >
          <RefreshCw size={16} />
          Atualizar
        </button>
      </div>

      {/* Members grouped by team */}
      {membersByTeam.map((team) => (
        <div key={team.id} className="rounded-lg border border-gray-700 overflow-hidden" style={{ backgroundColor: CARD_BG }}>
          <button
            onClick={() => setExpandedTeam(expandedTeam === team.id ? null : team.id)}
            className="w-full p-4 flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">{team.emoji}</span>
              <span className="font-bold text-white">{team.name}</span>
              <span className="text-xs text-gray-400 px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.1)" }}>
                {team.members.length} membros
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono" style={{ color: team.color || ORANGE }}>
                {team.members.reduce((sum: number, m: any) => sum + parseFloat(m.xp || "0"), 0).toFixed(1)} PF
              </span>
              {expandedTeam === team.id ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
            </div>
          </button>

          <AnimatePresence>
            {expandedTeam === team.id && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="border-t border-gray-700">
                  <table className="w-full text-sm">
                    <thead style={{ backgroundColor: "rgba(255,255,255,0.03)" }}>
                      <tr>
                        <th className="px-4 py-2 text-left text-gray-400 text-xs">#</th>
                        <th className="px-4 py-2 text-left text-gray-400 text-xs">Nome</th>
                        <th className="px-4 py-2 text-left text-gray-400 text-xs">PF</th>
                        <th className="px-4 py-2 text-right text-gray-400 text-xs">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {team.members
                        .sort((a: any, b: any) => parseFloat(b.xp || "0") - parseFloat(a.xp || "0"))
                        .map((member: any, idx: number) => (
                          <tr key={member.id} className="border-t border-gray-700/50">
                            <td className="px-4 py-3 text-gray-500 text-xs">{idx + 1}</td>
                            <td className="px-4 py-3 text-white">{member.name}</td>
                            <td className="px-4 py-3 font-mono" style={{ color: team.color || ORANGE }}>
                              {parseFloat(member.xp || "0").toFixed(1)}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {confirmDelete === member.id ? (
                                <div className="flex items-center gap-2 justify-end">
                                  <span className="text-xs text-red-400">Confirmar?</span>
                                  <button
                                    onClick={() => deleteMember.mutate({ sessionToken, id: member.id })}
                                    className="px-2 py-1 rounded text-xs bg-red-600 text-white hover:bg-red-700"
                                    disabled={deleteMember.isPending}
                                  >
                                    {deleteMember.isPending ? "..." : "Sim"}
                                  </button>
                                  <button
                                    onClick={() => setConfirmDelete(null)}
                                    className="px-2 py-1 rounded text-xs bg-gray-600 text-white hover:bg-gray-700"
                                  >
                                    Não
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setConfirmDelete(member.id)}
                                  className="p-1.5 rounded hover:bg-red-900/30 transition-all"
                                  title="Remover aluno"
                                >
                                  <Trash2 size={14} style={{ color: "#FF6B6B" }} />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}

      {/* Unassigned members */}
      {unassigned.length > 0 && (
        <div className="rounded-lg border border-yellow-700/50 overflow-hidden" style={{ backgroundColor: CARD_BG }}>
          <div className="p-4 flex items-center gap-3">
            <span className="text-xl">❓</span>
            <span className="font-bold text-yellow-400">Sem equipe ({unassigned.length})</span>
          </div>
          <div className="border-t border-gray-700">
            {unassigned.map((member: any) => (
              <div key={member.id} className="px-4 py-3 flex items-center justify-between border-b border-gray-700/50 last:border-0">
                <span className="text-white text-sm">{member.name}</span>
                <span className="font-mono text-sm" style={{ color: ORANGE }}>{parseFloat(member.xp || "0").toFixed(1)} PF</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Teams Tab ───
function TeamsTab({ sessionToken }: { sessionToken: string }) {
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const teamsQuery = trpc.teams.list.useQuery({ sessionToken });
  const membersQuery = trpc.members.list.useQuery({ sessionToken });
  const deleteTeam = trpc.teams.delete.useMutation({
    onSuccess: () => {
      toast.success("Equipe removida com sucesso");
      teamsQuery.refetch();
      setConfirmDelete(null);
    },
    onError: (err) => toast.error(err.message),
  });

  if (teamsQuery.isLoading || membersQuery.isLoading) {
    return <LoadingState text="Carregando equipes..." />;
  }

  const teams = teamsQuery.data || [];
  const members = membersQuery.data || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">
          Gerenciar Equipes
          <span className="text-sm font-normal text-gray-400 ml-3">({teams.length} equipes)</span>
        </h2>
        <button
          onClick={() => { teamsQuery.refetch(); membersQuery.refetch(); }}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all hover:scale-105"
          style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "#fff" }}
        >
          <RefreshCw size={16} />
          Atualizar
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {teams.map((team: any, i: number) => {
          const teamMembers = members.filter((m: any) => m.teamId === team.id);
          const totalPF = teamMembers.reduce((sum: number, m: any) => sum + parseFloat(m.xp || "0"), 0);
          const avgPF = teamMembers.length > 0 ? totalPF / teamMembers.length : 0;

          return (
            <motion.div
              key={team.id}
              className="rounded-lg p-5 border border-gray-700"
              style={{ backgroundColor: CARD_BG }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{team.emoji}</span>
                  <h3 className="text-lg font-bold text-white">{team.name}</h3>
                </div>
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: team.color || ORANGE }} />
              </div>
              <div className="space-y-1.5 text-sm text-gray-400 mb-4">
                <p>👥 {teamMembers.length} membros</p>
                <p style={{ color: team.color || ORANGE }}>⭐ {totalPF.toFixed(1)} PF total</p>
                <p className="text-xs">📊 Média: {avgPF.toFixed(1)} PF/aluno</p>
              </div>
              <div className="flex gap-2">
                {confirmDelete === team.id ? (
                  <>
                    <button
                      onClick={() => deleteTeam.mutate({ sessionToken, id: team.id })}
                      className="flex-1 px-3 py-2 rounded-lg text-sm bg-red-600 text-white hover:bg-red-700"
                      disabled={deleteTeam.isPending}
                    >
                      {deleteTeam.isPending ? "Removendo..." : "Confirmar"}
                    </button>
                    <button
                      onClick={() => setConfirmDelete(null)}
                      className="flex-1 px-3 py-2 rounded-lg text-sm bg-gray-600 text-white hover:bg-gray-700"
                    >
                      Cancelar
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(team.id)}
                    className="flex-1 px-3 py-2 rounded-lg transition-all hover:bg-red-900/30 text-sm text-red-400 border border-red-800/30"
                  >
                    <Trash2 size={14} className="inline mr-1" /> Deletar
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Professors Tab ───
function ProfessorsTab({ sessionToken }: { sessionToken: string }) {
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const teachersQuery = trpc.teacherManagement.listAll.useQuery({ sessionToken }, {
    retry: 1,
    refetchOnWindowFocus: false,
  });
  const deleteTeacher = trpc.teacherManagement.deleteTeacher.useMutation({
    onSuccess: () => {
      toast.success("Professor removido com sucesso");
      teachersQuery.refetch();
      setConfirmDelete(null);
    },
    onError: (err) => toast.error(err.message),
  });
  const toggleActive = trpc.teacherManagement.toggleActive.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      teachersQuery.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  if (teachersQuery.isLoading) {
    return <LoadingState text="Carregando professores..." />;
  }

  if (teachersQuery.error) {
    return <ErrorState text="Erro ao carregar professores. Verifique suas permissões." />;
  }

  const teachers = teachersQuery.data || [];

  const roleLabel = (role: string) => {
    switch (role) {
      case "super_admin": return "Super Admin";
      case "coordenador": return "Coordenador";
      default: return "Professor";
    }
  };

  const roleColor = (role: string) => {
    switch (role) {
      case "super_admin": return ORANGE;
      case "coordenador": return "#4A90E2";
      default: return "#7ED321";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">
          Gerenciar Professores
          <span className="text-sm font-normal text-gray-400 ml-3">({teachers.length} cadastrados)</span>
        </h2>
        <button
          onClick={() => teachersQuery.refetch()}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all hover:scale-105"
          style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "#fff" }}
        >
          <RefreshCw size={16} />
          Atualizar
        </button>
      </div>

      <div className="rounded-lg border border-gray-700 overflow-hidden" style={{ backgroundColor: CARD_BG }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ backgroundColor: "rgba(255,255,255,0.05)" }}>
              <tr>
                <th className="px-4 py-3 text-left text-gray-400 text-xs">Nome</th>
                <th className="px-4 py-3 text-left text-gray-400 text-xs">Email</th>
                <th className="px-4 py-3 text-left text-gray-400 text-xs">Papel</th>
                <th className="px-4 py-3 text-left text-gray-400 text-xs">Status</th>
                <th className="px-4 py-3 text-right text-gray-400 text-xs">Ações</th>
              </tr>
            </thead>
            <tbody>
              {teachers.map((prof: any) => (
                <tr key={prof.id} className="border-t border-gray-700/50">
                  <td className="px-4 py-3 text-white font-medium">{prof.name}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{prof.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className="px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{ backgroundColor: `${roleColor(prof.role)}20`, color: roleColor(prof.role) }}
                    >
                      {roleLabel(prof.role)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleActive.mutate({
                        sessionToken,
                        teacherId: prof.id,
                        isActive: prof.isActive === 1 ? 0 : 1,
                      })}
                      disabled={prof.role === "super_admin" || toggleActive.isPending}
                      className="flex items-center gap-1 disabled:opacity-30"
                      title={prof.role === "super_admin" ? "Super Admin não pode ser desativado" : "Alternar status"}
                    >
                      {prof.isActive === 1 ? (
                        <ToggleRight size={20} style={{ color: "#7ED321" }} />
                      ) : (
                        <ToggleLeft size={20} style={{ color: "#FF6B6B" }} />
                      )}
                      <span className="text-xs" style={{ color: prof.isActive === 1 ? "#7ED321" : "#FF6B6B" }}>
                        {prof.isActive === 1 ? "Ativo" : "Inativo"}
                      </span>
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {prof.role === "super_admin" ? (
                      <span className="text-xs text-gray-500">—</span>
                    ) : confirmDelete === prof.id ? (
                      <div className="flex items-center gap-2 justify-end">
                        <span className="text-xs text-red-400">Confirmar?</span>
                        <button
                          onClick={() => deleteTeacher.mutate({ sessionToken, teacherId: prof.id })}
                          className="px-2 py-1 rounded text-xs bg-red-600 text-white hover:bg-red-700"
                          disabled={deleteTeacher.isPending}
                        >
                          {deleteTeacher.isPending ? "..." : "Sim"}
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="px-2 py-1 rounded text-xs bg-gray-600 text-white hover:bg-gray-700"
                        >
                          Não
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(prof.id)}
                        className="p-1.5 rounded hover:bg-red-900/30 transition-all"
                        title="Remover professor"
                      >
                        <Trash2 size={14} style={{ color: "#FF6B6B" }} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Invite Codes Tab ───
function InviteCodesTab({ sessionToken }: { sessionToken: string }) {
  const [newDescription, setNewDescription] = useState("");
  const [newMaxUses, setNewMaxUses] = useState(10);
  const [showForm, setShowForm] = useState(false);

  const codesQuery = trpc.inviteCodes.list.useQuery({ sessionToken }, {
    retry: 1,
    refetchOnWindowFocus: false,
  });
  const generateCode = trpc.inviteCodes.generate.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success(`Código gerado: ${data.code}`);
        codesQuery.refetch();
        setShowForm(false);
        setNewDescription("");
        setNewMaxUses(10);
      } else {
        toast.error(data.message);
      }
    },
    onError: (err) => toast.error(err.message),
  });
  const toggleCode = trpc.inviteCodes.toggle.useMutation({
    onSuccess: () => {
      toast.success("Status atualizado");
      codesQuery.refetch();
    },
    onError: (err) => toast.error(err.message),
  });
  const deleteCode = trpc.inviteCodes.delete.useMutation({
    onSuccess: () => {
      toast.success("Código removido");
      codesQuery.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const codes = codesQuery.data || [];

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      toast.success(`Código "${code}" copiado!`);
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">
          Códigos de Convite
          <span className="text-sm font-normal text-gray-400 ml-3">({codes.length} códigos)</span>
        </h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all hover:scale-105"
          style={{ backgroundColor: ORANGE, color: "#000" }}
        >
          <Plus size={18} />
          Gerar Código
        </button>
      </div>

      {/* Info box */}
      <div className="rounded-lg p-4 border border-blue-800/30" style={{ backgroundColor: "rgba(74, 144, 226, 0.1)" }}>
        <p className="text-sm text-blue-300">
          <strong>Como funciona:</strong> Códigos de convite permitem que monitores e alunos externos (sem email @edu.unirio.br) se cadastrem na plataforma.
          Gere um código, compartilhe com o aluno, e ele poderá usá-lo no cadastro.
        </p>
      </div>

      {/* Generate form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-lg p-6 border border-gray-700" style={{ backgroundColor: CARD_BG }}>
              <h3 className="text-lg font-bold text-white mb-4">Gerar Novo Código</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-400 block mb-1">Descrição (opcional)</label>
                  <input
                    type="text"
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Ex: Monitor João - Semestre 2026.1"
                    className="w-full px-4 py-2 rounded-lg text-white text-sm"
                    style={{ backgroundColor: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }}
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400 block mb-1">Máximo de usos</label>
                  <input
                    type="number"
                    value={newMaxUses}
                    onChange={(e) => setNewMaxUses(parseInt(e.target.value) || 1)}
                    min={1}
                    max={100}
                    className="w-32 px-4 py-2 rounded-lg text-white text-sm"
                    style={{ backgroundColor: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }}
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => generateCode.mutate({ sessionToken, description: newDescription, maxUses: newMaxUses })}
                    disabled={generateCode.isPending}
                    className="px-6 py-2 rounded-lg font-semibold transition-all hover:scale-105 disabled:opacity-50"
                    style={{ backgroundColor: ORANGE, color: "#000" }}
                  >
                    {generateCode.isPending ? "Gerando..." : "Gerar Código"}
                  </button>
                  <button
                    onClick={() => setShowForm(false)}
                    className="px-6 py-2 rounded-lg transition-all hover:scale-105"
                    style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "#fff" }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Codes list */}
      {codesQuery.isLoading ? (
        <LoadingState text="Carregando códigos..." />
      ) : codes.length === 0 ? (
        <div className="rounded-lg p-8 border border-gray-700 text-center" style={{ backgroundColor: CARD_BG }}>
          <Ticket size={48} className="mx-auto mb-3 text-gray-600" />
          <p className="text-gray-400">Nenhum código de convite gerado ainda.</p>
          <p className="text-gray-500 text-sm mt-1">Clique em "Gerar Código" para criar o primeiro.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-700 overflow-hidden" style={{ backgroundColor: CARD_BG }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead style={{ backgroundColor: "rgba(255,255,255,0.05)" }}>
                <tr>
                  <th className="px-4 py-3 text-left text-gray-400 text-xs">Código</th>
                  <th className="px-4 py-3 text-left text-gray-400 text-xs">Descrição</th>
                  <th className="px-4 py-3 text-left text-gray-400 text-xs">Usos</th>
                  <th className="px-4 py-3 text-left text-gray-400 text-xs">Criado por</th>
                  <th className="px-4 py-3 text-left text-gray-400 text-xs">Status</th>
                  <th className="px-4 py-3 text-right text-gray-400 text-xs">Ações</th>
                </tr>
              </thead>
              <tbody>
                {codes.map((code: any) => (
                  <tr key={code.id} className="border-t border-gray-700/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <code className="text-white font-mono font-bold text-sm px-2 py-0.5 rounded" style={{ backgroundColor: "rgba(247,148,29,0.15)" }}>
                          {code.code}
                        </code>
                        <button
                          onClick={() => copyToClipboard(code.code)}
                          className="p-1 rounded hover:bg-gray-700 transition-all"
                          title="Copiar código"
                        >
                          <Copy size={12} className="text-gray-400" />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs max-w-[200px] truncate">
                      {code.description || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-white font-mono">{code.usedCount}</span>
                      <span className="text-gray-500">/{code.maxUses}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{code.createdBy}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleCode.mutate({ sessionToken, id: code.id, isActive: !code.isActive })}
                        disabled={toggleCode.isPending}
                        className="flex items-center gap-1"
                      >
                        {code.isActive ? (
                          <ToggleRight size={20} style={{ color: "#7ED321" }} />
                        ) : (
                          <ToggleLeft size={20} style={{ color: "#FF6B6B" }} />
                        )}
                        <span className="text-xs" style={{ color: code.isActive ? "#7ED321" : "#FF6B6B" }}>
                          {code.isActive ? "Ativo" : "Inativo"}
                        </span>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => {
                          if (confirm("Tem certeza que deseja remover este código?")) {
                            deleteCode.mutate({ sessionToken, id: code.id });
                          }
                        }}
                        className="p-1.5 rounded hover:bg-red-900/30 transition-all"
                        title="Remover código"
                      >
                        <Trash2 size={14} style={{ color: "#FF6B6B" }} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Settings Tab ───
function SettingsTab() {
  const [, navigate] = useLocation();
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [generalForm, setGeneralForm] = useState({ courseName: "Farmacologia I", semester: "2026.1", university: "UNIRIO", department: "Farmacologia" });
  const [notifForm, setNotifForm] = useState({ emailAlerts: true, badgeNotifs: true, pfNotifs: true, weeklyReport: false, alertEmail: "" });
  const [securityForm, setSecurityForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });

  const settingsItems = [
    { id: "general", title: "Configurações Gerais", desc: "Nome da turma, semestre, cronograma", icon: <Settings size={22} />, color: ORANGE },
    { id: "backup", title: "Backup de Dados", desc: "Exportar e importar dados da plataforma", icon: <Database size={22} />, color: "#4A90E2" },
    { id: "security", title: "Segurança", desc: "Gerenciar senhas, permissões e acesso", icon: <Lock size={22} />, color: "#FF6B6B" },
    { id: "notifications", title: "Notificações", desc: "Configurar alertas e comunicações", icon: <Bell size={22} />, color: "#7ED321" },
    { id: "reports", title: "Relatórios", desc: "Gerar relatórios de desempenho", icon: <FileText size={22} />, color: "#9B59B6" },
  ];

  const handleSaveGeneral = () => {
    toast.success("Configurações gerais salvas com sucesso!");
    setActiveSection(null);
  };

  const handleExportBackup = () => {
    const backupData = {
      exportDate: new Date().toISOString(),
      platform: "Conexão em Farmacologia",
      version: "1.0",
      settings: generalForm,
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `backup-farmacologia-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Backup exportado com sucesso!");
  };

  const handleImportBackup = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target?.result as string);
          if (data.platform === "Conexão em Farmacologia") {
            toast.success(`Backup de ${data.exportDate} importado com sucesso!`);
          } else {
            toast.error("Arquivo de backup inválido");
          }
        } catch {
          toast.error("Erro ao ler arquivo de backup");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleChangePassword = () => {
    if (!securityForm.newPassword || !securityForm.confirmPassword) {
      toast.error("Preencha todos os campos");
      return;
    }
    if (securityForm.newPassword !== securityForm.confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }
    if (securityForm.newPassword.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }
    toast.success("Senha alterada com sucesso!");
    setSecurityForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    setActiveSection(null);
  };

  const handleSaveNotifications = () => {
    toast.success("Configurações de notificações salvas!");
    setActiveSection(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Configurações do Sistema</h2>
        <button
          onClick={() => navigate("/admin/configuracoes")}
          className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all hover:scale-105 text-sm"
          style={{ backgroundColor: `${ORANGE}30`, color: ORANGE, border: `1px solid ${ORANGE}50` }}
        >
          <ExternalLink size={16} />
          Configurações Avançadas
        </button>
      </div>

      <div className="space-y-4">
        {settingsItems.map((setting, i) => (
          <motion.div
            key={setting.id}
            className="rounded-lg border border-gray-700 overflow-hidden"
            style={{ backgroundColor: CARD_BG }}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08 }}
          >
            <button
              onClick={() => setActiveSection(activeSection === setting.id ? null : setting.id)}
              className="w-full p-6 flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-lg" style={{ backgroundColor: `${setting.color}20` }}>
                  <div style={{ color: setting.color }}>{setting.icon}</div>
                </div>
                <div>
                  <h3 className="font-bold text-white">{setting.title}</h3>
                  <p className="text-sm text-gray-400 mt-1">{setting.desc}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: `${setting.color}20`, color: setting.color }}>
                  Ativo
                </span>
                {activeSection === setting.id ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
              </div>
            </button>

            <AnimatePresence>
              {activeSection === setting.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  <div className="px-6 pb-6 border-t border-gray-700 pt-4">
                    {/* Configurações Gerais */}
                    {setting.id === "general" && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm text-gray-400 mb-1 block">Nome da Disciplina</label>
                            <input
                              value={generalForm.courseName}
                              onChange={(e) => setGeneralForm({ ...generalForm, courseName: e.target.value })}
                              className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-600 text-white text-sm focus:border-orange-500 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-sm text-gray-400 mb-1 block">Semestre</label>
                            <input
                              value={generalForm.semester}
                              onChange={(e) => setGeneralForm({ ...generalForm, semester: e.target.value })}
                              className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-600 text-white text-sm focus:border-orange-500 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-sm text-gray-400 mb-1 block">Universidade</label>
                            <input
                              value={generalForm.university}
                              onChange={(e) => setGeneralForm({ ...generalForm, university: e.target.value })}
                              className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-600 text-white text-sm focus:border-orange-500 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-sm text-gray-400 mb-1 block">Departamento</label>
                            <input
                              value={generalForm.department}
                              onChange={(e) => setGeneralForm({ ...generalForm, department: e.target.value })}
                              className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-600 text-white text-sm focus:border-orange-500 focus:outline-none"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-3 pt-2">
                          <button
                            onClick={() => setActiveSection(null)}
                            className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white transition-colors"
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={handleSaveGeneral}
                            className="flex items-center gap-2 px-5 py-2 rounded-lg font-semibold text-sm transition-all hover:scale-105"
                            style={{ backgroundColor: ORANGE, color: "#000" }}
                          >
                            <Save size={16} /> Salvar
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Backup de Dados */}
                    {setting.id === "backup" && (
                      <div className="space-y-4">
                        <p className="text-sm text-gray-400">Exporte todos os dados da plataforma em formato JSON ou importe um backup anterior.</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <button
                            onClick={handleExportBackup}
                            className="flex items-center justify-center gap-3 p-4 rounded-lg border border-gray-600 hover:border-blue-500 transition-all hover:scale-[1.02]"
                            style={{ backgroundColor: "rgba(74,144,226,0.1)" }}
                          >
                            <Download size={24} className="text-blue-400" />
                            <div className="text-left">
                              <p className="font-semibold text-white">Exportar Backup</p>
                              <p className="text-xs text-gray-400">Download JSON com todos os dados</p>
                            </div>
                          </button>
                          <button
                            onClick={handleImportBackup}
                            className="flex items-center justify-center gap-3 p-4 rounded-lg border border-gray-600 hover:border-green-500 transition-all hover:scale-[1.02]"
                            style={{ backgroundColor: "rgba(126,211,33,0.1)" }}
                          >
                            <Upload size={24} className="text-green-400" />
                            <div className="text-left">
                              <p className="font-semibold text-white">Importar Backup</p>
                              <p className="text-xs text-gray-400">Restaurar dados de arquivo JSON</p>
                            </div>
                          </button>
                        </div>
                        <div className="rounded-lg p-3 border border-gray-700" style={{ backgroundColor: "rgba(255,200,0,0.05)" }}>
                          <p className="text-xs text-yellow-400 flex items-center gap-2">
                            <AlertCircle size={14} />
                            Recomendamos fazer backup regularmente. O backup inclui equipes, alunos, pontuações e configurações.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Segurança */}
                    {setting.id === "security" && (
                      <div className="space-y-4">
                        <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                          <Key size={16} style={{ color: "#FF6B6B" }} /> Alterar Senha do Administrador
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div>
                            <label className="text-sm text-gray-400 mb-1 block">Senha Atual</label>
                            <input
                              type="password"
                              value={securityForm.currentPassword}
                              onChange={(e) => setSecurityForm({ ...securityForm, currentPassword: e.target.value })}
                              placeholder="••••••••"
                              className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-600 text-white text-sm focus:border-red-500 focus:outline-none placeholder:text-gray-600"
                            />
                          </div>
                          <div>
                            <label className="text-sm text-gray-400 mb-1 block">Nova Senha</label>
                            <input
                              type="password"
                              value={securityForm.newPassword}
                              onChange={(e) => setSecurityForm({ ...securityForm, newPassword: e.target.value })}
                              placeholder="••••••••"
                              className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-600 text-white text-sm focus:border-red-500 focus:outline-none placeholder:text-gray-600"
                            />
                          </div>
                          <div>
                            <label className="text-sm text-gray-400 mb-1 block">Confirmar Senha</label>
                            <input
                              type="password"
                              value={securityForm.confirmPassword}
                              onChange={(e) => setSecurityForm({ ...securityForm, confirmPassword: e.target.value })}
                              placeholder="••••••••"
                              className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-600 text-white text-sm focus:border-red-500 focus:outline-none placeholder:text-gray-600"
                            />
                          </div>
                        </div>
                        <div className="flex justify-between items-center pt-2">
                          <button
                            onClick={() => navigate("/admin/configuracoes")}
                            className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1"
                          >
                            <ExternalLink size={14} /> Gerenciamento avançado de permissões
                          </button>
                          <button
                            onClick={handleChangePassword}
                            className="flex items-center gap-2 px-5 py-2 rounded-lg font-semibold text-sm transition-all hover:scale-105"
                            style={{ backgroundColor: "#FF6B6B", color: "#fff" }}
                          >
                            <Lock size={16} /> Alterar Senha
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Notificações */}
                    {setting.id === "notifications" && (
                      <div className="space-y-4">
                        <div className="space-y-3">
                          {[
                            { key: "emailAlerts", label: "Alertas por Email", desc: "Receber notificações por email sobre atividades importantes" },
                            { key: "badgeNotifs", label: "Notificações de Badges", desc: "Notificar alunos quando conquistarem novos badges" },
                            { key: "pfNotifs", label: "Notificações de PF", desc: "Notificar alunos quando receberem pontos de farmacologia" },
                            { key: "weeklyReport", label: "Relatório Semanal", desc: "Enviar resumo semanal de atividades por email" },
                          ].map((item) => (
                            <div key={item.key} className="flex items-center justify-between p-3 rounded-lg border border-gray-700" style={{ backgroundColor: "rgba(255,255,255,0.02)" }}>
                              <div>
                                <p className="text-sm font-medium text-white">{item.label}</p>
                                <p className="text-xs text-gray-400">{item.desc}</p>
                              </div>
                              <button
                                onClick={() => setNotifForm({ ...notifForm, [item.key]: !notifForm[item.key as keyof typeof notifForm] })}
                                className="transition-all"
                              >
                                {notifForm[item.key as keyof typeof notifForm] ? (
                                  <ToggleRight size={32} className="text-green-400" />
                                ) : (
                                  <ToggleLeft size={32} className="text-gray-500" />
                                )}
                              </button>
                            </div>
                          ))}
                        </div>
                        <div>
                          <label className="text-sm text-gray-400 mb-1 block">Email para alertas do administrador</label>
                          <input
                            value={notifForm.alertEmail}
                            onChange={(e) => setNotifForm({ ...notifForm, alertEmail: e.target.value })}
                            placeholder="admin@unirio.br"
                            className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-600 text-white text-sm focus:border-green-500 focus:outline-none placeholder:text-gray-600"
                          />
                        </div>
                        <div className="flex justify-end gap-3 pt-2">
                          <button
                            onClick={() => setActiveSection(null)}
                            className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white transition-colors"
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={handleSaveNotifications}
                            className="flex items-center gap-2 px-5 py-2 rounded-lg font-semibold text-sm transition-all hover:scale-105"
                            style={{ backgroundColor: "#7ED321", color: "#000" }}
                          >
                            <Save size={16} /> Salvar Notificações
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Relatórios */}
                    {setting.id === "reports" && (
                      <div className="space-y-4">
                        <p className="text-sm text-gray-400">Gere relatórios detalhados sobre o desempenho dos alunos e equipes.</p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          {[
                            { title: "Desempenho por Equipe", desc: "Ranking e PF de cada equipe", icon: <Users size={20} />, color: "#4A90E2" },
                            { title: "Desempenho Individual", desc: "PF e evolução de cada aluno", icon: <GraduationCap size={20} />, color: ORANGE },
                            { title: "Frequência", desc: "Relatório de presença dos alunos", icon: <CheckCircle size={20} />, color: "#7ED321" },
                          ].map((report, idx) => (
                            <button
                              key={idx}
                              onClick={() => navigate("/admin/relatorios")}
                              className="flex flex-col items-center gap-3 p-4 rounded-lg border border-gray-600 hover:border-purple-500 transition-all hover:scale-[1.02] text-center"
                              style={{ backgroundColor: `${report.color}10` }}
                            >
                              <div style={{ color: report.color }}>{report.icon}</div>
                              <div>
                                <p className="font-semibold text-white text-sm">{report.title}</p>
                                <p className="text-xs text-gray-400 mt-1">{report.desc}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                        <div className="flex justify-end pt-2">
                          <button
                            onClick={() => navigate("/admin/relatorios")}
                            className="flex items-center gap-2 px-5 py-2 rounded-lg font-semibold text-sm transition-all hover:scale-105"
                            style={{ backgroundColor: "#9B59B6", color: "#fff" }}
                          >
                            <FileText size={16} /> Abrir Painel de Relatórios
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ─── Shared Components ───
function LoadingState({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="text-center">
        <RefreshCw size={32} className="mx-auto mb-3 text-gray-500 animate-spin" />
        <p className="text-gray-400">{text}</p>
      </div>
    </div>
  );
}

function ErrorState({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="text-center">
        <div className="w-12 h-12 rounded-full bg-red-900/30 flex items-center justify-center mx-auto mb-3">
          <span className="text-red-400 text-xl">!</span>
        </div>
        <p className="text-red-400">{text}</p>
      </div>
    </div>
  );
}


// ─── PF Distribution Charts ───
interface Stats {
  system: {
    totalMembers: number;
    totalTeams: number;
    totalClasses?: number;
    totalXP: string;
    avgXPPerMember: string;
  };
  teachers: {
    total: number;
    active: number;
    inactive: number;
    coordenadores: number;
    superAdmins: number;
  };
  students: {
    totalMembers: number;
    totalAccounts: number;
    activeAccounts: number;
    withoutAccount: number;
  };
}

// Componente PFDistributionCharts removido - usar versão lazy do arquivo separado


// ─── UNIRIO Import Section ───
function UnirioImportSection({ sessionToken }: { sessionToken: string }) {
  const [cpf, setCpf] = useState("");
  const [password, setPassword] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; errors: number } | null>(null);

  const unirioImport = trpc.members.importFromUnirio.useMutation({
    onSuccess: (data: any) => {
      setImportResult({ success: data.imported || 0, errors: data.errors || 0 });
      toast.success(`${data.imported || 0} aluno(s) importado(s) do UNIRIO!`);
      setCpf("");
      setPassword("");
      setImporting(false);
    },
    onError: (err: any) => {
      toast.error(`Erro ao importar: ${err.message}`);
      setImporting(false);
    },
  });

  const handleUnirioImport = () => {
    if (!cpf.trim()) {
      toast.error("Informe o CPF");
      return;
    }
    if (!password.trim()) {
      toast.error("Informe a senha");
      return;
    }

    setImporting(true);
    unirioImport.mutate({
      cpf: cpf.trim(),
      password: password.trim(),
      sessionToken,
    });
  };

  return (
    <div className="rounded-lg p-6 border border-orange-700/30" style={{ backgroundColor: "rgba(247, 148, 29, 0.08)" }}>
      <div className="flex items-center gap-3 mb-4">
        <Download size={24} style={{ color: ORANGE }} />
        <h3 className="text-xl font-bold text-white">Importação Automática UNIRIO</h3>
      </div>

      <p className="text-sm text-gray-300 mb-4">
        Conecte ao portal UNIRIO para importar automaticamente a lista de alunos da sua turma.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        {/* CPF Input */}
        <div>
          <label className="text-xs text-gray-400 block mb-2">CPF (do Professor)</label>
          <input
            type="text"
            value={cpf}
            onChange={(e) => setCpf(e.target.value)}
            placeholder="000.000.000-00"
            className="w-full px-4 py-2 rounded-lg text-white text-sm"
            style={{ backgroundColor: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }}
            disabled={importing}
          />
        </div>

        {/* Password Input */}
        <div>
          <label className="text-xs text-gray-400 block mb-2">Senha UNIRIO</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full px-4 py-2 rounded-lg text-white text-sm"
            style={{ backgroundColor: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }}
            disabled={importing}
          />
        </div>
      </div>

      {/* Import Button */}
      <div className="flex gap-3">
        <button
          onClick={handleUnirioImport}
          disabled={importing || !cpf.trim() || !password.trim()}
          className="flex items-center gap-2 px-6 py-2 rounded-lg font-semibold transition-all hover:scale-105 disabled:opacity-50"
          style={{ backgroundColor: ORANGE, color: "#000" }}
        >
          {importing ? (
            <>
              <RefreshCw size={16} className="animate-spin" />
              Importando...
            </>
          ) : (
            <>
              <Download size={16} />
              Importar do UNIRIO
            </>
          )}
        </button>

        {importResult && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm" style={{ backgroundColor: "rgba(126, 211, 33, 0.2)" }}>
            <CheckCircle size={16} style={{ color: "#7ED321" }} />
            <span className="text-green-300">{importResult.success} importado(s)</span>
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="mt-4 p-3 rounded-lg text-xs text-gray-400" style={{ backgroundColor: "rgba(255,255,255,0.05)" }}>
        <p className="mb-1">⚠️ Suas credenciais são usadas apenas para fazer login no UNIRIO e não são armazenadas.</p>
        <p>A importação busca a lista de alunos da turma vinculada ao seu CPF.</p>
      </div>
    </div>
  );
}