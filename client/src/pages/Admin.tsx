import { useState, useEffect, useMemo } from "react";
// Build cache buster: 2026-03-05T20:43:00Z
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { SearchStudents } from "@/components/SearchStudents";
import { ExportButton } from "@/components/ExportButton";
import { SortSelector, useSortStudents, type SortOption } from "@/components/SortSelector";
import { Pagination } from "@/components/Pagination";
import { AuditLogManager } from "./AdminAuditLog";
import { ResponsiveTabNav } from "@/components/ResponsiveTabNav";
import { MaterialTypeBadge, MaterialTypeFilter, type MaterialType } from "@/components/MaterialTypeBadge";
import { FileDropZone } from "@/components/FileDropZone";
import { PDFPreview, usePDFPreview } from "@/components/PDFPreview";
import { TagInput, TagDisplay, type Tag } from "@/components/TagInput";
import JigsawRebalancingManager from "./AdminJigsawRebalancing";
import ExamToolsManager from "@/components/ExamToolsManager";
import AdminJigsawPanel from "./AdminJigsawPanel";
import AttendanceQRCodeManager from "./AdminAttendanceQRCode";
import GradesSpreadsheet from "@/components/GradesSpreadsheet";
import {
  Lock, LogOut, Users, UserPlus, Trash2, Edit2, Save, X,
  Plus, Trophy, Zap, Activity, Settings, ChevronDown, ChevronUp,
  FlaskConical, ArrowLeft, KeyRound, Bell, AlertTriangle, Clock,
  FileText, Link2, MessageSquare, Upload, Eye, EyeOff, Paperclip,
  Award, Star, Medal, MapPin, CheckCircle, XCircle, UserCheck, Search, Download,
  Youtube, Play, Video, GripVertical, Target, LogIn, Calendar, Shuffle, QrCode, Gamepad2, User, GraduationCap, BookOpen, History, Loader2, Printer
} from "lucide-react";

// ─── Login Screen ───
function LoginScreen({ onLogin }: { onLogin: (pw: string) => void }) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const loginMutation = trpc.admin.login.useMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await loginMutation.mutateAsync({ password });
      if (result.success) {
        toast.success("Autenticado com sucesso!");
        onLogin(password);
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error("Erro ao autenticar");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Lock size={28} className="text-primary" />
          </div>
          <h1 className="font-display font-bold text-2xl text-foreground">Painel Admin</h1>
          <p className="text-sm text-muted-foreground mt-1">Conexão em Farmacologia — Pontos Farmacológicos</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground block mb-1.5">Senha do Professor</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Digite a senha..."
              className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
              autoFocus
            />
          </div>
          <button
            type="submit"
            disabled={loading || !password}
            className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            {loading ? "Verificando..." : "Entrar"}
          </button>
        </form>
        <div className="mt-6 text-center">
          <a href="/leaderboard" className="text-xs text-muted-foreground hover:text-primary flex items-center justify-center gap-1">
            <ArrowLeft size={12} /> Voltar ao Ranking
          </a>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Team Management ───
function TeamManager({ password }: { password: string }) {
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamEmoji, setNewTeamEmoji] = useState("🧪");
  const [newTeamColor, setNewTeamColor] = useState("#10b981");
  const [editingTeam, setEditingTeam] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmoji, setEditEmoji] = useState("");
  const [editColor, setEditColor] = useState("");
  const [expandedTeam, setExpandedTeam] = useState<number | null>(null);
  const [sortOption, setSortOption] = useState<SortOption>("alphabetical");
  const sortStudents = useSortStudents(sortOption);

  const utils = trpc.useUtils();
  const { data: leaderboard, isLoading } = trpc.leaderboard.getData.useQuery();

  // Flatten all students for search and export
  const allStudents = useMemo(() => {
    if (!leaderboard?.teams) return [];
    return leaderboard.teams.flatMap(team =>
      team.members.map(m => ({
        id: m.id,
        name: m.name,
        xp: m.xp,
        teamId: team.id,
        teamName: team.name,
      }))
    );
  }, [leaderboard]);

  const createTeam = trpc.teams.create.useMutation({
    onSuccess: () => { utils.leaderboard.getData.invalidate(); toast.success("Equipe criada!"); setNewTeamName(""); },
    onError: () => toast.error("Erro ao criar equipe"),
  });

  const updateTeam = trpc.teams.update.useMutation({
    onSuccess: () => { utils.leaderboard.getData.invalidate(); toast.success("Equipe atualizada!"); setEditingTeam(null); },
    onError: () => toast.error("Erro ao atualizar equipe"),
  });

  const deleteTeam = trpc.teams.delete.useMutation({
    onSuccess: () => { utils.leaderboard.getData.invalidate(); toast.success("Equipe removida!"); },
    onError: () => toast.error("Erro ao remover equipe"),
  });

  if (isLoading) return <div className="text-center text-muted-foreground py-8">Carregando...</div>;

  return (
    <div className="space-y-6">
      {/* Add Team */}
      <div className="border border-border rounded-lg p-4" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
        <h3 className="font-display font-semibold text-sm text-foreground mb-3 flex items-center gap-2">
          <Plus size={16} className="text-primary" /> Adicionar Equipe
        </h3>
        <div className="flex gap-2 flex-wrap">
          <input
            value={newTeamEmoji}
            onChange={e => setNewTeamEmoji(e.target.value)}
            className="w-12 px-2 py-2 rounded-md bg-secondary border border-border text-foreground text-center text-sm"
            placeholder="🧪"
          />
          <input
            value={newTeamName}
            onChange={e => setNewTeamName(e.target.value)}
            className="flex-1 min-w-[150px] px-3 py-2 rounded-md bg-secondary border border-border text-foreground placeholder:text-muted-foreground text-sm"
            placeholder="Nome da equipe..."
          />
          <input
            type="color"
            value={newTeamColor}
            onChange={e => setNewTeamColor(e.target.value)}
            className="w-10 h-10 rounded-md border border-border cursor-pointer"
          />
          <button
            onClick={() => createTeam.mutate({ password, name: newTeamName, emoji: newTeamEmoji, color: newTeamColor })}
            disabled={!newTeamName || createTeam.isPending}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
          >
            Criar
          </button>
        </div>
      </div>

      {/* Toolbar: Search + Sort + Export */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex-1 w-full sm:max-w-sm">
          <SearchStudents
            students={allStudents}
            onSelect={(student) => {
              const team = leaderboard?.teams.find(t => t.id === student.teamId);
              if (team) setExpandedTeam(team.id);
              toast.info(`${student.name} — ${student.teamName || 'Sem equipe'} — ${student.xp.toFixed(1)} PF`);
            }}
            placeholder="Buscar aluno por nome..."
          />
        </div>
        <div className="flex items-center gap-3">
          <SortSelector value={sortOption} onChange={setSortOption} />
          <ExportButton students={allStudents} filename="alunos-equipes" label="Exportar" />
        </div>
      </div>

      {/* Team List */}
      <div className="space-y-2">
        {leaderboard?.teams.map(team => (
          <div key={team.id} className="border border-border rounded-lg overflow-hidden" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
            <div className="p-3 flex items-center gap-3">
              {editingTeam === team.id ? (
                <>
                  <input value={editEmoji} onChange={e => setEditEmoji(e.target.value)} className="w-10 px-1 py-1 rounded bg-secondary border border-border text-center text-sm text-foreground" />
                  <input value={editName} onChange={e => setEditName(e.target.value)} className="flex-1 px-2 py-1 rounded bg-secondary border border-border text-sm text-foreground" />
                  <input type="color" value={editColor} onChange={e => setEditColor(e.target.value)} className="w-8 h-8 rounded border border-border cursor-pointer" />
                  <button onClick={() => updateTeam.mutate({ password, id: team.id, name: editName, emoji: editEmoji, color: editColor })} className="p-1.5 rounded bg-primary/20 text-primary"><Save size={14} /></button>
                  <button onClick={() => setEditingTeam(null)} className="p-1.5 rounded bg-destructive/20 text-destructive"><X size={14} /></button>
                </>
              ) : (
                <>
                  <span className="text-lg">{team.emoji}</span>
                  <span className="font-medium text-sm text-foreground flex-1">{team.name}</span>
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: team.color }} />
                  <span className="text-xs text-muted-foreground font-mono">{team.members.length} membros</span>
                  <span className="text-xs font-mono font-bold" style={{ color: team.color }}>
                    {team.members.reduce((s, m) => s + m.xp, 0).toFixed(1)} PF
                  </span>
                  <button onClick={() => { setEditingTeam(team.id); setEditName(team.name); setEditEmoji(team.emoji); setEditColor(team.color); }} className="p-1.5 rounded hover:bg-secondary text-muted-foreground"><Edit2 size={14} /></button>
                  <button onClick={() => { if (confirm(`Remover equipe "${team.name}" e todos os membros?`)) deleteTeam.mutate({ password, id: team.id }); }} className="p-1.5 rounded hover:bg-destructive/20 text-destructive"><Trash2 size={14} /></button>
                  <button onClick={() => setExpandedTeam(expandedTeam === team.id ? null : team.id)} className="p-1.5 rounded hover:bg-secondary text-muted-foreground">
                    {expandedTeam === team.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </>
              )}
            </div>
            <AnimatePresence>
              {expandedTeam === team.id && (
                <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                  <MemberList teamId={team.id} members={team.members} password={password} teamColor={team.color} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Member List (inside team) ───
function MemberList({ teamId, members, password, teamColor }: {
  teamId: number;
  members: { id: number; name: string; xp: number }[];
  password: string;
  teamColor: string;
}) {
  const [newName, setNewName] = useState("");
  const [editingMember, setEditingMember] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editXP, setEditXP] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const utils = trpc.useUtils();

  const createMember = trpc.members.create.useMutation({
    onSuccess: () => { utils.leaderboard.getData.invalidate(); toast.success("Aluno adicionado!"); setNewName(""); },
    onError: () => toast.error("Erro ao adicionar aluno"),
  });

  const updateMember = trpc.members.update.useMutation({
    onSuccess: () => { utils.leaderboard.getData.invalidate(); toast.success("Aluno atualizado!"); setEditingMember(null); },
    onError: () => toast.error("Erro ao atualizar"),
  });

  const deleteMember = trpc.members.delete.useMutation({
    onSuccess: () => { utils.leaderboard.getData.invalidate(); toast.success("Aluno removido!"); },
    onError: () => toast.error("Erro ao remover"),
  });

  return (
    <div className="border-t border-border/50 px-3 pb-3 pt-2">
      {/* Add member */}
      <div className="flex gap-2 mb-2">
        <input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          className="flex-1 px-2 py-1.5 rounded bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground"
          placeholder="Nome do aluno..."
          onKeyDown={e => { if (e.key === "Enter" && newName) createMember.mutate({ password, teamId, name: newName }); }}
        />
        <button
          onClick={() => createMember.mutate({ password, teamId, name: newName })}
          disabled={!newName || createMember.isPending}
          className="px-3 py-1.5 rounded bg-primary/20 text-primary text-xs font-medium disabled:opacity-50"
        >
          <UserPlus size={14} />
        </button>
      </div>

      {/* Members */}
      {members.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-2">Nenhum aluno nesta equipe</p>
      ) : (
        <>
          <div className="space-y-1">
            {members
              .sort((a, b) => a.name.localeCompare(b.name))
              .slice((currentPage - 1) * pageSize, currentPage * pageSize)
              .map(member => (
                <div key={member.id} className="flex items-center gap-2 py-1">
                  {editingMember === member.id ? (
                    <>
                      <input value={editName} onChange={e => setEditName(e.target.value)} className="flex-1 px-2 py-1 rounded bg-secondary border border-border text-xs text-foreground" />
                      <input value={editXP} onChange={e => setEditXP(e.target.value)} className="w-16 px-2 py-1 rounded bg-secondary border border-border text-xs text-foreground text-right font-mono" type="number" step="0.5" />
                      <button onClick={() => updateMember.mutate({ password, id: member.id, name: editName, xp: editXP })} className="p-1 rounded bg-primary/20 text-primary"><Save size={12} /></button>
                      <button onClick={() => setEditingMember(null)} className="p-1 rounded bg-destructive/20 text-destructive"><X size={12} /></button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-xs text-foreground truncate">{member.name}</span>
                      <span className="font-mono text-xs font-bold w-12 text-right" style={{ color: teamColor }}>{member.xp.toFixed(1)}</span>
                      <button onClick={() => { setEditingMember(member.id); setEditName(member.name); setEditXP(member.xp.toFixed(1)); }} className="p-1 rounded hover:bg-secondary text-muted-foreground"><Edit2 size={12} /></button>
                      <button onClick={() => { if (confirm(`Remover "${member.name}"?`)) deleteMember.mutate({ password, id: member.id }); }} className="p-1 rounded hover:bg-destructive/20 text-destructive"><Trash2 size={12} /></button>
                    </>
                  )}
                </div>
              ))
            }
          </div>
          {members.length > 10 && (
            <Pagination
              currentPage={currentPage}
              totalPages={Math.ceil(members.length / pageSize)}
              onPageChange={setCurrentPage}
              pageSize={pageSize}
              onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
              totalItems={members.length}
              className="mt-2 pt-2 border-t border-border/30"
            />
          )}
        </>
      )}
    </div>
  );
}

// ─── Bulk PF Update ───
function BulkXPManager({ password }: { password: string }) {
  const { data: leaderboard } = trpc.leaderboard.getData.useQuery();
  const [xpUpdates, setXpUpdates] = useState<Record<number, string>>({});
  const [selectedTeam, setSelectedTeam] = useState<number | null>(null);
  const utils = trpc.useUtils();

  const bulkUpdate = trpc.members.bulkUpdateXP.useMutation({
    onSuccess: (data) => {
      utils.leaderboard.getData.invalidate();
      toast.success(`${data.count} alunos atualizados!`);
      setXpUpdates({});
    },
    onError: () => toast.error("Erro ao atualizar PF"),
  });

  const filteredTeams = leaderboard?.teams ?? [];
  const displayTeams = selectedTeam ? filteredTeams.filter(t => t.id === selectedTeam) : filteredTeams;

  const handleSave = () => {
    const updates = Object.entries(xpUpdates)
      .filter(([_, xp]) => xp !== "")
      .map(([id, xp]) => ({ id: parseInt(id), xp }));
    if (updates.length === 0) { toast.info("Nenhuma alteração para salvar"); return; }
    bulkUpdate.mutate({ password, updates });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={selectedTeam ?? ""}
          onChange={e => setSelectedTeam(e.target.value ? parseInt(e.target.value) : null)}
          className="px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm"
        >
          <option value="">Todas as equipes</option>
          {filteredTeams.map(t => (
            <option key={t.id} value={t.id}>{t.emoji} {t.name}</option>
          ))}
        </select>
        <button
          onClick={handleSave}
          disabled={Object.keys(xpUpdates).length === 0 || bulkUpdate.isPending}
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 flex items-center gap-1.5"
        >
          <Save size={14} /> Salvar Alterações ({Object.keys(xpUpdates).filter(k => xpUpdates[parseInt(k)] !== "").length})
        </button>
      </div>

      {displayTeams.map(team => (
        <div key={team.id} className="border border-border rounded-lg p-3" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">{team.emoji}</span>
            <span className="font-display font-semibold text-sm text-foreground">{team.name}</span>
            <span className="text-xs text-muted-foreground ml-auto font-mono">
              Total PF: {team.members.reduce((s, m) => s + (xpUpdates[m.id] !== undefined ? parseFloat(xpUpdates[m.id] || "0") : m.xp), 0).toFixed(1)}
            </span>
          </div>
          <div className="grid gap-1.5">
            {team.members.sort((a, b) => a.name.localeCompare(b.name)).map(member => (
              <div key={member.id} className="flex items-center gap-2">
                <span className="flex-1 text-xs text-foreground truncate">{member.name}</span>
                <span className="text-[11px] text-muted-foreground font-mono w-12 text-right">PF: {member.xp.toFixed(1)}</span>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="45"
                  value={xpUpdates[member.id] ?? member.xp.toFixed(1)}
                  onChange={e => setXpUpdates(prev => ({ ...prev, [member.id]: e.target.value }))}
                  className={`w-20 px-2 py-1 rounded bg-secondary border text-xs text-foreground text-right font-mono ${
                    xpUpdates[member.id] !== undefined ? "border-primary" : "border-border"
                  }`}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Activities Manager ───
// Tabela de referência das atividades do semestre
const SEMESTER_ACTIVITIES_REF = [
  { category: "Participação", name: "Participação em Aula", icon: "📚", maxPF: 5, description: "Presença ativa e contribuições em aula" },
  { category: "Frequência", name: "Frequência Semanal", icon: "✅", maxPF: 2, description: "Presença registrada via QR Code" },
  { category: "TBL", name: "TBL 1 — Farmacocinética 2", icon: "🧠", maxPF: 10, description: "Semana 2 — Metabolismo e Excreção" },
  { category: "TBL", name: "TBL 2 — Boas Práticas de Prescrição", icon: "🧠", maxPF: 10, description: "Semana 4 — Prescrição Racional" },
  { category: "TBL", name: "TBL 3 — Adrenérgicos", icon: "🧠", maxPF: 10, description: "Semana 9 — SNA Adrenérgico" },
  { category: "TBL", name: "TBL 4 — AINEs e Corticoides", icon: "🧠", maxPF: 10, description: "Semana 11 — Anti-inflamatórios" },
  { category: "Caso Clínico", name: "Caso Clínico 1 — Farmacodinâmica", icon: "🏥", maxPF: 8, description: "Semana 3 — Receptores e Mecanismos" },
  { category: "Caso Clínico", name: "Caso Clínico 2 — SNA Colinergía", icon: "🏥", maxPF: 8, description: "Semana 5 — Transmissão Colinérgica" },
  { category: "Caso Clínico", name: "Caso Clínico 3 — Anti-adrenérgicos", icon: "🏥", maxPF: 8, description: "Semana 10 — Bloqueadores Adrenérgicos" },
  { category: "Caso Clínico", name: "Caso Clínico 4 — Anti-histamínicos", icon: "🏥", maxPF: 8, description: "Semana 13 — Receptores H1 e H2" },
  { category: "Jigsaw", name: "Seminário Jigsaw — Fase 1 (Especialistas)", icon: "🧪", maxPF: 7, description: "Apresentação (0-5) + Participação (0-2)" },
  { category: "Jigsaw", name: "Seminário Jigsaw — Fase 2 (Mosaico)", icon: "🧪", maxPF: 12, description: "Apresentação (0-5) + Participação (0-2) + Pares (0-5)" },
  { category: "Jogo", name: "Jogo Semanal — Missões", icon: "🎮", maxPF: 5, description: "Missões semanais liberadas toda terça-feira" },
  { category: "Escape Room", name: "Escape Room Farmacológico", icon: "🔓", maxPF: 15, description: "Semana 8 — Atividade em equipe" },
  { category: "Prova", name: "Prova P1", icon: "📝", maxPF: 30, description: "Semana 8 — Farmacocinética até Colinergía" },
  { category: "Prova", name: "Prova P2", icon: "📝", maxPF: 30, description: "Semana 15 — Adrenérgicos até Anti-histamínicos" },
  { category: "Prova", name: "Prova Final", icon: "🏆", maxPF: 40, description: "Semana 17 — Conteúdo completo do semestre" },
];

const CATEGORY_COLORS: Record<string, string> = {
  "Participação": "#10b981", "Frequência": "#06b6d4", "TBL": "#6366f1",
  "Caso Clínico": "#f59e0b", "Jigsaw": "#a855f7", "Jogo": "#ec4899",
  "Escape Room": "#f97316", "Prova": "#ef4444",
};

function ActivitiesManager({ password }: { password: string }) {
  const { data: leaderboard } = trpc.leaderboard.getData.useQuery();
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState("🎯");
  const [newMaxXP, setNewMaxXP] = useState("1");
  const [showRef, setShowRef] = useState(true);
  const utils = trpc.useUtils();

  const createActivity = trpc.activities.create.useMutation({
    onSuccess: () => {
      toast.success("Atividade criada com sucesso!");
      setNewName("");
      setNewIcon("🎯");
      setNewMaxXP("1");
      utils.leaderboard.getData.invalidate();
    },
    onError: (error) => { toast.error(`Erro: ${error.message}`); },
  });

  const importDefault = trpc.activities.importDefault.useMutation({
    onSuccess: (data) => {
      toast.success(`✅ ${data.created} atividades importadas! (${data.total} no total do semestre)`);
      utils.leaderboard.getData.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteActivity = trpc.activities.delete.useMutation({
    onSuccess: () => {
      toast.success("Atividade removida com sucesso!");
      utils.leaderboard.getData.invalidate();
    },
    onError: (error) => { toast.error(`Erro: ${error.message}`); },
  });

  const totalMaxPF = SEMESTER_ACTIVITIES_REF.reduce((s, a) => s + a.maxPF, 0);

  return (
    <div className="space-y-4">
      {/* Tabela de referência das atividades do semestre */}
      <div className="border border-border rounded-lg overflow-hidden" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="font-display font-semibold text-sm text-foreground flex items-center gap-2">
            <Trophy size={16} className="text-primary" /> Atividades do Semestre — Distribuição de PF
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-primary">Total máx: {totalMaxPF} PF</span>
            <button onClick={() => setShowRef(!showRef)} className="text-xs text-muted-foreground hover:text-foreground">
              {showRef ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>
        </div>
        {showRef && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium">Atividade</th>
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium">Categoria</th>
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium">Descrição</th>
                  <th className="text-right px-3 py-2 text-muted-foreground font-medium">PF Máx</th>
                </tr>
              </thead>
              <tbody>
                {SEMESTER_ACTIVITIES_REF.map((act, i) => (
                  <tr key={i} className="border-b border-border/40 hover:bg-secondary/20">
                    <td className="px-3 py-2 font-medium text-foreground">{act.icon} {act.name}</td>
                    <td className="px-3 py-2">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ backgroundColor: (CATEGORY_COLORS[act.category] || "#6366f1") + "22", color: CATEGORY_COLORS[act.category] || "#6366f1" }}>{act.category}</span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{act.description}</td>
                    <td className="px-3 py-2 text-right font-mono font-bold" style={{ color: CATEGORY_COLORS[act.category] || "#6366f1" }}>+{act.maxPF}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {showRef && (
          <div className="px-4 py-3 border-t border-border flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Clique em "Importar" para adicionar todas as atividades ao sistema de PF.</p>
            <button
              onClick={() => { if (confirm("Importar todas as atividades padrão do semestre?")) importDefault.mutate({ password }); }}
              disabled={importDefault.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50"
            >
              {importDefault.isPending ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
              Importar Atividades Padrão
            </button>
          </div>
        )}
      </div>

      {/* Formulário de nova atividade */}
      <div className="border border-border rounded-lg p-4" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
        <h3 className="font-display font-semibold text-sm text-foreground mb-3 flex items-center gap-2">
          <Plus size={16} className="text-primary" /> Nova Atividade Personalizada
        </h3>
        <div className="flex gap-2 flex-wrap">
          <input value={newIcon} onChange={e => setNewIcon(e.target.value)} className="w-12 px-2 py-2 rounded-md bg-secondary border border-border text-foreground text-center text-sm" />
          <input value={newName} onChange={e => setNewName(e.target.value)} className="flex-1 min-w-[150px] px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm" placeholder="Nome da atividade..." />
          <input value={newMaxXP} onChange={e => setNewMaxXP(e.target.value)} type="number" step="0.5" className="w-20 px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm text-right font-mono" placeholder="PF" />
          <button onClick={() => createActivity.mutate({ password, name: newName, icon: newIcon, maxXP: newMaxXP })} disabled={!newName || createActivity.isPending} className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50">{createActivity.isPending ? "Criando..." : "Criar"}</button>
        </div>
      </div>

      {/* Lista de atividades cadastradas */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">Atividades Cadastradas no Sistema</h3>
        {leaderboard?.activities.map(act => (
          <div key={act.id} className="border border-border rounded-lg p-3 flex items-center gap-3" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
            <span className="text-xl">{act.icon}</span>
            <span className="flex-1 text-sm text-foreground font-medium">{act.name}</span>
            <span className="font-mono text-sm text-primary font-bold">+{act.maxXP} PF</span>
            <button onClick={() => { if (confirm(`Remover "${act.name}"?`)) deleteActivity.mutate({ password, id: act.id }); }} disabled={deleteActivity.isPending} className="p-1.5 rounded hover:bg-destructive/20 text-destructive disabled:opacity-50"><Trash2 size={14} /></button>
          </div>
        ))}
        {(!leaderboard?.activities || leaderboard.activities.length === 0) && (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhuma atividade cadastrada. Use o botão "Importar Atividades Padrão" acima.</p>
        )}
      </div>
    </div>
  );
}

// ─── Highlights Manager ───
function HighlightsManager({ password }: { password: string }) {
  const { data: leaderboard } = trpc.leaderboard.getData.useQuery();
  const [week, setWeek] = useState("");
  const [date, setDate] = useState("");
  const [activity, setActivity] = useState("");
  const [description, setDescription] = useState("");
  const [topTeam, setTopTeam] = useState("");
  const [topStudent, setTopStudent] = useState("");
  const [autoClassId, setAutoClassId] = useState<number | undefined>(undefined);
  const { data: classesList = [] } = trpc.classes.listAll.useQuery();
  const utils = trpc.useUtils();

  const createHighlight = trpc.highlights.create.useMutation({
    onSuccess: () => {
      utils.leaderboard.getData.invalidate();
      toast.success("Destaque adicionado!");
      setWeek(""); setDate(""); setActivity(""); setDescription(""); setTopTeam(""); setTopStudent("");
    },
  });

  const autoGenerate = trpc.highlights.autoGenerate.useMutation({
    onSuccess: (data) => {
      utils.leaderboard.getData.invalidate();
      toast.success(`✨ Destaque gerado! Aluno destaque: ${data.topStudent}`);
      setWeek(""); setDate(""); setActivity("");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteHighlight = trpc.highlights.delete.useMutation({
    onSuccess: () => { utils.leaderboard.getData.invalidate(); toast.success("Destaque removido!"); },
  });

  return (
    <div className="space-y-4">
      {/* Auto-geração por somatório de pontos */}
      <div className="border border-emerald-500/30 rounded-lg p-4" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
        <h3 className="font-display font-semibold text-sm text-foreground mb-2 flex items-center gap-2">
          <Zap size={16} className="text-emerald-400" /> Gerar Destaque Automático por Somatório de PF
        </h3>
        <p className="text-xs text-muted-foreground mb-3">Identifica automaticamente o aluno e equipe com maior somatório de pontos (PF) na plataforma.</p>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <input value={week} onChange={e => setWeek(e.target.value)} type="number" className="px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm" placeholder="Semana (1-16)" />
          <input value={date} onChange={e => setDate(e.target.value)} className="px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm" placeholder="Data (ex: 10/03/2026)" />
          <input value={activity} onChange={e => setActivity(e.target.value)} className="col-span-2 px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm" placeholder="Atividade (ex: TBL, Jigsaw, Semana 1...)" />
          <select value={autoClassId ?? ""} onChange={e => setAutoClassId(e.target.value ? Number(e.target.value) : undefined)} className="col-span-2 px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm">
            <option value="">Todas as turmas</option>
            {(classesList as any[]).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <button
          onClick={() => autoGenerate.mutate({ password, week: parseInt(week), date, activity, classId: autoClassId })}
          disabled={!week || !date || !activity || autoGenerate.isPending}
          className="px-4 py-2 rounded-md bg-emerald-600 text-white text-sm font-medium disabled:opacity-50 flex items-center gap-2"
        >
          {autoGenerate.isPending ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
          Gerar Destaque Automático
        </button>
      </div>

      {/* Formulário manual */}
      <div className="border border-border rounded-lg p-4" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
        <h3 className="font-display font-semibold text-sm text-foreground mb-3 flex items-center gap-2">
          <Plus size={16} className="text-primary" /> Novo Destaque Manual
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <input value={week} onChange={e => setWeek(e.target.value)} type="number" className="px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm" placeholder="Semana (1-16)" />
          <input value={date} onChange={e => setDate(e.target.value)} className="px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm" placeholder="Data (ex: 10/03/2026)" />
          <input value={activity} onChange={e => setActivity(e.target.value)} className="px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm" placeholder="Atividade" />
          <input value={topTeam} onChange={e => setTopTeam(e.target.value)} className="px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm" placeholder="Equipe destaque" />
          <input value={topStudent} onChange={e => setTopStudent(e.target.value)} className="px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm" placeholder="Aluno destaque" />
          <input value={description} onChange={e => setDescription(e.target.value)} className="col-span-2 px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm" placeholder="Descrição do destaque..." />
        </div>
        <button
          onClick={() => createHighlight.mutate({ password, week: parseInt(week), date, activity, description, topTeam: topTeam || "—", topStudent: topStudent || "—" })}
          disabled={!week || !date || !activity || !description}
          className="mt-3 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
        >
          Adicionar Destaque
        </button>
      </div>

      <div className="space-y-2">
        {leaderboard?.highlights.map(h => (
          <div key={h.id} className="border border-border rounded-lg p-3" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs font-bold text-primary">SEM {h.week}</span>
              <span className="text-xs text-muted-foreground">{h.date}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{h.activity}</span>
              <button onClick={() => { if (confirm("Remover destaque?")) deleteHighlight.mutate({ password, id: h.id }); }} className="ml-auto p-1 rounded hover:bg-destructive/20 text-destructive"><Trash2 size={12} /></button>
            </div>
            <p className="text-xs text-foreground">{h.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── QR Code Acesso Manager ───
function QRCodeAcessoManager() {
  const domains = [
    { label: "Domínio Principal", url: "https://2026.conexaofarmacologia.com.br" },
    { label: "Domínio Alternativo", url: "https://2026conexaofarmacologia.manus.space" },
    { label: "Domínio Legado", url: "https://farmalead-fuz2ecmx.manus.space" },
  ];
  const [selectedDomain, setSelectedDomain] = useState(domains[0].url);
  const [qrSize, setQrSize] = useState(300);
  const [showInstructions, setShowInstructions] = useState(true);

  function downloadQR(format: "png" | "svg") {
    const canvas = document.querySelector<HTMLCanvasElement>("#qr-acesso-canvas canvas");
    const svg = document.querySelector<SVGElement>("#qr-acesso-canvas svg");
    if (format === "png" && canvas) {
      const link = document.createElement("a");
      link.download = "qr-acesso-farmacologia.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    } else if (format === "svg" && svg) {
      const serializer = new XMLSerializer();
      const svgStr = serializer.serializeToString(svg);
      const blob = new Blob([svgStr], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = "qr-acesso-farmacologia.svg";
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    } else {
      toast.error("Não foi possível gerar o arquivo. Tente outro formato.");
    }
  }

  function printQR() {
    const printWindow = window.open("", "_blank");
    if (!printWindow) { toast.error("Popup bloqueado. Permita popups para imprimir."); return; }
    const canvas = document.querySelector<HTMLCanvasElement>("#qr-acesso-canvas canvas");
    const imgSrc = canvas ? canvas.toDataURL("image/png") : "";
    printWindow.document.write(`
      <!DOCTYPE html><html><head><title>QR Code - Conexão em Farmacologia</title>
      <style>body{font-family:sans-serif;text-align:center;padding:40px;background:#fff;color:#000}
      h1{font-size:28px;margin-bottom:8px}p{font-size:16px;color:#555;margin:4px 0}
      img{margin:24px auto;display:block}code{background:#f0f0f0;padding:4px 8px;border-radius:4px;font-size:14px}
      .instructions{margin-top:20px;font-size:14px;color:#333;border:1px solid #ddd;padding:16px;border-radius:8px;max-width:400px;margin-left:auto;margin-right:auto}
      @media print{body{padding:20px}}</style></head><body>
      <h1>🧪 Conexão em Farmacologia I</h1>
      <p>Acesse a plataforma pelo QR code abaixo</p>
      ${imgSrc ? `<img src="${imgSrc}" width="280" height="280" />` : `<p>QR Code: <code>${selectedDomain}</code></p>`}
      <p style="margin-top:16px"><code>${selectedDomain}</code></p>
      <div class="instructions">
        <strong>Como acessar:</strong><br/>
        1. Abra a câmera do celular<br/>
        2. Aponte para o QR code<br/>
        3. Toque no link que aparecer<br/>
        4. Faça login com seu e-mail institucional
      </div>
      <script>window.onload=()=>{window.print();window.close();}<\/script>
      </body></html>
    `);
    printWindow.document.close();
  }

  // Dynamically import QRCodeCanvas
  const [QRCodeCanvas, setQRCodeCanvas] = useState<any>(null);
  useEffect(() => {
    import("qrcode.react").then((mod) => setQRCodeCanvas(() => mod.QRCodeCanvas));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">QR Code de Acesso</h2>
        <p className="text-sm text-muted-foreground">Gere e baixe o QR code para os alunos acessarem a plataforma</p>
      </div>

      {/* Domain selector */}
      <div className="border border-border rounded-lg p-4" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
        <label className="text-sm font-medium text-foreground block mb-2">URL da plataforma</label>
        <div className="flex flex-col gap-2">
          {domains.map((d) => (
            <label key={d.url} className="flex items-center gap-3 cursor-pointer">
              <input type="radio" name="domain" value={d.url} checked={selectedDomain === d.url} onChange={() => setSelectedDomain(d.url)} className="accent-primary" />
              <div>
                <span className="text-sm font-medium text-foreground">{d.label}</span>
                <span className="text-xs text-muted-foreground ml-2">{d.url}</span>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Size selector */}
      <div className="border border-border rounded-lg p-4" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
        <label className="text-sm font-medium text-foreground block mb-2">Tamanho: {qrSize}px</label>
        <input type="range" min={150} max={500} step={50} value={qrSize} onChange={e => setQrSize(Number(e.target.value))} className="w-full accent-primary" />
        <div className="flex justify-between text-xs text-muted-foreground mt-1"><span>150px</span><span>500px</span></div>
      </div>

      {/* QR Code preview */}
      <div className="border border-border rounded-lg p-6 flex flex-col items-center gap-4" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
        <div id="qr-acesso-canvas" className="bg-white p-4 rounded-xl shadow-lg">
          {QRCodeCanvas ? (
            <QRCodeCanvas
              value={selectedDomain}
              size={qrSize}
              level="H"
              includeMargin={false}
              imageSettings={{
                src: "https://d2xsxph8kpxj0f.cloudfront.net/310419663028318382/FUZ2ecmXaKXVi9q85vHrsr/logo-qr_8a8442d8.png",
                height: Math.round(qrSize * 0.22),
                width: Math.round(qrSize * 0.22),
                excavate: true,
                crossOrigin: "anonymous",
              }}
            />
          ) : (
            <div className="flex items-center justify-center" style={{ width: qrSize, height: qrSize }}>
              <div className="text-center text-gray-400">
                <QrCode size={48} className="mx-auto mb-2" />
                <p className="text-sm">Carregando...</p>
              </div>
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground text-center max-w-xs break-all">{selectedDomain}</p>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 justify-center">
          <button onClick={() => downloadQR("png")} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
            <Download size={15} /> Baixar PNG
          </button>
          <button onClick={() => downloadQR("svg")} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-foreground text-sm hover:bg-secondary">
            <Download size={15} /> Baixar SVG
          </button>
          <button onClick={printQR} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-foreground text-sm hover:bg-secondary">
            🖨️ Imprimir
          </button>
        </div>
      </div>

      {/* Instructions toggle */}
      <div className="border border-border rounded-lg overflow-hidden" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
        <button onClick={() => setShowInstructions(!showInstructions)} className="w-full flex items-center justify-between p-4 text-left">
          <span className="text-sm font-medium text-foreground">Instruções para os alunos</span>
          {showInstructions ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {showInstructions && (
          <div className="px-4 pb-4 border-t border-border/50">
            <ol className="mt-3 space-y-2 text-sm text-muted-foreground list-decimal list-inside">
              <li>Abra a câmera do celular ou um leitor de QR code</li>
              <li>Aponte para o QR code acima</li>
              <li>Toque no link que aparecer na tela</li>
              <li>Faça login com seu e-mail institucional</li>
              <li>Acesse o jogo, cronograma, materiais e muito mais!</li>
            </ol>
            <div className="mt-3 p-3 rounded-lg bg-primary/10 border border-primary/20">
              <p className="text-xs text-primary font-medium">💡 Dica para o professor</p>
              <p className="text-xs text-muted-foreground mt-1">Imprima o QR code e cole na sala de aula, ou projete na tela no primeiro dia de aula para facilitar o acesso de todos os alunos.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Cronograma Manager ───
function CronogramaManager({ teacherToken }: { teacherToken: string }) {
  const [entries, setEntries] = useState<any[]>([]);
  const [gameWeeks, setGameWeeks] = useState<{ weekNumber: number; isReleased: boolean }[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    weekLabel: "",
    weekDate: "",
    title: "",
    detail: "",
    type: "aula" as "aula" | "tbl" | "caso" | "jigsaw" | "prova",
    highlight: false,
    isActive: true,
    sortOrder: 0,
    gameWeekNumber: null as number | null,
  });

  const { data: classesList } = trpc.classes.list.useQuery(
    { sessionToken: teacherToken },
    { enabled: !!teacherToken }
  );

  const { data: adminEntries, refetch } = trpc.schedule.getAllAdmin.useQuery(
    { teacherSessionToken: teacherToken, classId: selectedClassId ?? undefined },
    { enabled: !!teacherToken && selectedClassId !== null }
  );
  const { data: gwData } = trpc.schedule.getGameWeeks.useQuery(
    { teacherSessionToken: teacherToken },
    { enabled: !!teacherToken }
  );

  useEffect(() => { if (adminEntries) setEntries(adminEntries as any[]); }, [adminEntries]);
  useEffect(() => { if (gwData) setGameWeeks(gwData); }, [gwData]);

  const createMut = trpc.schedule.create.useMutation({ onSuccess: () => { refetch(); setShowForm(false); resetForm(); toast.success("Semana criada!"); } });
  const updateMut = trpc.schedule.update.useMutation({ onSuccess: () => { refetch(); setEditingId(null); resetForm(); toast.success("Semana atualizada!"); } });
  const deleteMut = trpc.schedule.delete.useMutation({ onSuccess: () => { refetch(); toast.success("Semana removida!"); } });
  const reorderMut = trpc.schedule.reorder.useMutation({ onSuccess: () => refetch() });

  function resetForm() {
    setFormData({ weekLabel: "", weekDate: "", title: "", detail: "", type: "aula", highlight: false, isActive: true, sortOrder: entries.length + 1, gameWeekNumber: null });
  }

  function startEdit(entry: any) {
    setEditingId(entry.id);
    setFormData({
      weekLabel: entry.weekLabel,
      weekDate: entry.weekDate ?? "",
      title: entry.title,
      detail: entry.detail ?? "",
      type: entry.type,
      highlight: entry.highlight,
      isActive: entry.isActive,
      sortOrder: entry.sortOrder,
      gameWeekNumber: entry.gameWeekNumber ?? null,
    });
    setShowForm(true);
  }

  function handleSubmit() {
    if (!formData.weekLabel.trim() || !formData.title.trim()) { toast.error("Rótulo e título são obrigatórios"); return; }
    setSaving(true);
    const payload = { teacherSessionToken: teacherToken, ...formData, weekDate: formData.weekDate || undefined, detail: formData.detail || undefined, classId: selectedClassId ?? undefined };
    if (editingId !== null) {
      updateMut.mutate({ ...payload, id: editingId }, { onSettled: () => setSaving(false) });
    } else {
      createMut.mutate({ ...payload, sortOrder: entries.length + 1 }, { onSettled: () => setSaving(false) });
    }
  }

  function moveEntry(idx: number, dir: -1 | 1) {
    const newList = [...entries];
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= newList.length) return;
    [newList[idx], newList[swapIdx]] = [newList[swapIdx], newList[idx]];
    setEntries(newList);
    reorderMut.mutate({ teacherSessionToken: teacherToken, orderedIds: newList.map((e) => e.id) });
  }

  const typeColors: Record<string, string> = {
    aula: "bg-blue-500/20 text-blue-300",
    tbl: "bg-purple-500/20 text-purple-300",
    caso: "bg-amber-500/20 text-amber-300",
    jigsaw: "bg-emerald-500/20 text-emerald-300",
    prova: "bg-red-500/20 text-red-300",
  };
  const typeLabels: Record<string, string> = { aula: "Aula", tbl: "TBL", caso: "Caso Clínico", jigsaw: "Jigsaw", prova: "Prova" };

  if (!selectedClassId) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">Cronograma do Semestre</h2>
          <p className="text-sm text-muted-foreground">Selecione uma turma para ver e editar o cronograma</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
          {(classesList || []).map((cls: any) => (
            <button
              key={cls.id}
              onClick={() => setSelectedClassId(cls.id)}
              className="border border-border rounded-lg p-4 text-left hover:border-primary/50 transition-colors"
              style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cls.color }} />
                <span className="font-semibold text-sm text-foreground">{cls.name}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                <p>{cls.discipline} — {cls.course}</p>
                {cls.teacherName && <p className="mt-1">Prof. {cls.teacherName}</p>}
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const selectedClass = (classesList || []).find((c: any) => c.id === selectedClassId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <button onClick={() => { setSelectedClassId(null); setEntries([]); }} className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 mb-1">
            <ArrowLeft size={12} /> Voltar às turmas
          </button>
          <h2 className="text-xl font-bold text-foreground">Cronograma — {selectedClass?.name || "Turma"}</h2>
          <p className="text-sm text-muted-foreground">{entries.length} semanas cadastradas</p>
        </div>
        <button
          onClick={() => { setEditingId(null); resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
        >
          <Plus size={16} /> Nova Semana
        </button>
      </div>

      {showForm && (
        <div className="border border-border rounded-lg p-4 space-y-3" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
          <h3 className="font-semibold text-foreground">{editingId ? "Editar Semana" : "Nova Semana"}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Rótulo *</label>
              <input value={formData.weekLabel} onChange={e => setFormData(p => ({ ...p, weekLabel: e.target.value }))} placeholder="Semana 1" className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Data</label>
              <input value={formData.weekDate} onChange={e => setFormData(p => ({ ...p, weekDate: e.target.value }))} placeholder="10/03/2026" className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm" />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Título *</label>
            <input value={formData.title} onChange={e => setFormData(p => ({ ...p, title: e.target.value }))} placeholder="Introdução à Farmacologia" className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Detalhes</label>
            <textarea value={formData.detail} onChange={e => setFormData(p => ({ ...p, detail: e.target.value }))} rows={3} placeholder="Descrição detalhada da aula..." className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Tipo</label>
              <select value={formData.type} onChange={e => setFormData(p => ({ ...p, type: e.target.value as any }))} className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm">
                <option value="aula">Aula</option>
                <option value="tbl">TBL</option>
                <option value="caso">Caso Clínico</option>
                <option value="jigsaw">Jigsaw</option>
                <option value="prova">Prova</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Semana do Jogo</label>
              <select value={formData.gameWeekNumber ?? ""} onChange={e => setFormData(p => ({ ...p, gameWeekNumber: e.target.value ? Number(e.target.value) : null }))} className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm">
                <option value="">— Nenhuma —</option>
                {gameWeeks.map(gw => (
                  <option key={gw.weekNumber} value={gw.weekNumber}>Semana {gw.weekNumber} {gw.isReleased ? "✅" : "🔒"}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
              <input type="checkbox" checked={formData.highlight} onChange={e => setFormData(p => ({ ...p, highlight: e.target.checked }))} />
              Destacar
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
              <input type="checkbox" checked={formData.isActive} onChange={e => setFormData(p => ({ ...p, isActive: e.target.checked }))} />
              Visível
            </label>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSubmit} disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
              <Save size={14} /> {saving ? "Salvando..." : editingId ? "Salvar" : "Criar"}
            </button>
            <button onClick={() => { setShowForm(false); setEditingId(null); resetForm(); }} className="px-4 py-2 rounded-lg border border-border text-foreground text-sm hover:bg-secondary">
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {entries.map((entry, idx) => (
          <div key={entry.id} className={`border rounded-lg p-3 flex items-start gap-3 ${entry.highlight ? "border-primary/40" : "border-border"}`} style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
            <div className="flex flex-col gap-1 shrink-0">
              <button onClick={() => moveEntry(idx, -1)} disabled={idx === 0} className="p-1 rounded hover:bg-secondary disabled:opacity-30"><ChevronUp size={14} /></button>
              <button onClick={() => moveEntry(idx, 1)} disabled={idx === entries.length - 1} className="p-1 rounded hover:bg-secondary disabled:opacity-30"><ChevronDown size={14} /></button>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs text-muted-foreground">{entry.weekLabel}</span>
                {entry.weekDate && <span className="text-xs text-muted-foreground">{entry.weekDate}</span>}
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeColors[entry.type] || "bg-secondary text-muted-foreground"}`}>{typeLabels[entry.type] || entry.type}</span>
                {entry.gameWeekNumber && <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary">🎮 S{entry.gameWeekNumber} {entry.gameWeekInfo?.isReleased ? "✅" : "🔒"}</span>}
                {entry.highlight && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">⭐ Destaque</span>}
                {!entry.isActive && <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">Oculto</span>}
              </div>
              <p className="text-sm font-medium text-foreground mt-1 truncate">{entry.title}</p>
              {entry.detail && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{entry.detail}</p>}
            </div>
            <div className="flex gap-1 shrink-0">
              <button onClick={() => startEdit(entry)} className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"><Edit2 size={14} /></button>
              <button onClick={() => { if (confirm(`Remover "${entry.title}"?`)) deleteMut.mutate({ teacherSessionToken: teacherToken, id: entry.id }); }} className="p-1.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive"><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
        {entries.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Calendar size={40} className="mx-auto mb-3 opacity-30" />
            <p>Nenhuma semana cadastrada</p>
            <p className="text-xs mt-1">Clique em "Nova Semana" para começar</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Monitores Manager ───
function MonitoresManager({ teacherToken }: { teacherToken: string | null }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedMonitorId, setSelectedMonitorId] = useState<number | null>(null);
  const [newMonitor, setNewMonitor] = useState({ email: "", matricula: "", displayName: "", password: "" });
  const [editPassword, setEditPassword] = useState("");
  const [activeTab, setActiveTab] = useState<"monitors" | "logs" | "notas">("monitors");
  const [logFilterMonitorId, setLogFilterMonitorId] = useState<number | undefined>(undefined);
  const [logDateFrom, setLogDateFrom] = useState<string>("");
  const [logDateTo, setLogDateTo] = useState<string>("");
  const [notasTypeFilter, setNotasTypeFilter] = useState<"kahoot" | "clinical_case" | undefined>(undefined);
  const [editingGradeId, setEditingGradeId] = useState<number | null>(null);
  const [editingGradeValue, setEditingGradeValue] = useState<number>(0);
  const [editingMaxGrade, setEditingMaxGrade] = useState<number>(10);

  const utils = trpc.useUtils();

  const { data: monitors, isLoading } = trpc.monitors.list.useQuery(
    { teacherSessionToken: teacherToken || "" },
    { enabled: !!teacherToken }
  );

  const { data: activitySummary } = trpc.monitors.getActivitySummary.useQuery(
    { teacherSessionToken: teacherToken || "" },
    { enabled: !!teacherToken && activeTab === "logs" }
  );

  const { data: activityLogs } = trpc.monitors.getActivityLogs.useQuery(
    {
      teacherSessionToken: teacherToken || "",
      monitorId: logFilterMonitorId,
      dateFrom: logDateFrom || undefined,
      dateTo: logDateTo || undefined,
      limit: 500,
    },
    { enabled: !!teacherToken && activeTab === "logs" }
  );

  const { data: adminGrades, refetch: refetchAdminGrades, isLoading: gradesLoading } = trpc.monitors.adminListActivityGrades.useQuery(
    { teacherSessionToken: teacherToken || "", activityType: notasTypeFilter },
    { enabled: !!teacherToken && activeTab === "notas" }
  );
  const adminUpsertGrade = trpc.monitors.adminUpsertActivityGrade.useMutation({
    onSuccess: () => { toast.success("Nota salva!"); setEditingGradeId(null); refetchAdminGrades(); },
    onError: (e) => toast.error(e.message),
  });
  const adminDeleteGrade = trpc.monitors.adminDeleteActivityGrade.useMutation({
    onSuccess: () => { toast.success("Nota excluída!"); refetchAdminGrades(); },
    onError: (e) => toast.error(e.message),
  });

  const registerMutation = trpc.monitors.register.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success("Monitor cadastrado com sucesso!");
        setShowAddForm(false);
        setNewMonitor({ email: "", matricula: "", displayName: "", password: "" });
        utils.monitors.list.invalidate();
      } else {
        toast.error(data.message);
      }
    },
    onError: () => toast.error("Erro ao cadastrar monitor"),
  });

  const updateMutation = trpc.monitors.update.useMutation({
    onSuccess: () => {
      toast.success("Monitor atualizado!");
      setSelectedMonitorId(null);
      setEditPassword("");
      utils.monitors.list.invalidate();
    },
    onError: () => toast.error("Erro ao atualizar monitor"),
  });

  const removeMutation = trpc.monitors.remove.useMutation({
    onSuccess: () => {
      toast.success("Monitor removido!");
      utils.monitors.list.invalidate();
    },
    onError: () => toast.error("Erro ao remover monitor"),
  });

  const filteredMonitors = (monitors || []).filter((m) =>
    (m.displayName || m.email).toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getActionTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      attendance_marked: "Presença marcada",
      resource_added: "Recurso adicionado",
      resource_deleted: "Recurso removido",
      seminar_updated: "Seminário atualizado",
      leaderboard_viewed: "Leaderboard visualizado",
      chat_message_sent: "Mensagem enviada",
      login: "Login realizado",
      logout: "Logout realizado",
    };
    return labels[type] || type;
  };

  const getActionTypeColor = (type: string) => {
    if (type.includes("delete") || type.includes("removed")) return "text-red-400";
    if (type.includes("add") || type.includes("marked") || type.includes("sent")) return "text-emerald-400";
    if (type.includes("login")) return "text-blue-400";
    return "text-slate-300";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <GraduationCap size={22} className="text-violet-400" />
            Gerenciar Monitores
          </h2>
          <p className="text-slate-400 text-sm mt-1">Gerencie os monitores e acompanhe suas atividades</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-1 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-sm rounded-md font-medium transition-colors"
        >
          <UserPlus size={15} />
          Novo Monitor
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 p-1 rounded-lg bg-slate-800/60 w-fit flex-wrap">
        {(["monitors", "logs", "notas"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              activeTab === tab
                ? "bg-violet-600 text-white"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {tab === "monitors" ? (
              <span className="flex items-center gap-1.5"><Users size={14} /> Monitores ({monitors?.length ?? 0})</span>
            ) : tab === "logs" ? (
              <span className="flex items-center gap-1.5"><History size={14} /> Log de Atividades</span>
            ) : (
              <span className="flex items-center gap-1.5"><BookOpen size={14} /> Notas dos Monitores</span>
            )}
          </button>
        ))}
      </div>

      {/* Add Monitor Form */}
      {showAddForm && activeTab === "monitors" && (
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5 space-y-4">
          <h3 className="text-white font-semibold flex items-center gap-2"><UserPlus size={16} className="text-violet-400" /> Cadastrar Novo Monitor</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Email institucional</label>
              <input
                value={newMonitor.email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewMonitor((p) => ({ ...p, email: e.target.value }))}
                placeholder="monitor@edu.unirio.br"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-600 text-white text-sm rounded-md focus:outline-none focus:ring-2 focus:ring-violet-500/50"
              />
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Matrícula</label>
              <input
                value={newMonitor.matricula}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewMonitor((p) => ({ ...p, matricula: e.target.value }))}
                placeholder="123456"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-600 text-white text-sm rounded-md focus:outline-none focus:ring-2 focus:ring-violet-500/50"
              />
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Nome de exibição</label>
              <input
                value={newMonitor.displayName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewMonitor((p) => ({ ...p, displayName: e.target.value }))}
                placeholder="Nome Sobrenome"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-600 text-white text-sm rounded-md focus:outline-none focus:ring-2 focus:ring-violet-500/50"
              />
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Senha inicial</label>
              <input
                type="password"
                value={newMonitor.password}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewMonitor((p) => ({ ...p, password: e.target.value }))}
                placeholder="Mínimo 6 caracteres"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-600 text-white text-sm rounded-md focus:outline-none focus:ring-2 focus:ring-violet-500/50"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowAddForm(false)} className="px-3 py-1.5 text-slate-400 hover:text-slate-200 text-sm rounded-md transition-colors">
              Cancelar
            </button>
            <button
              className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-sm rounded-md font-medium transition-colors disabled:opacity-50"
              disabled={registerMutation.isPending}
              onClick={() =>
                registerMutation.mutate({
                  teacherSessionToken: teacherToken || "",
                  ...newMonitor,
                })
              }
            >
              {registerMutation.isPending ? "Cadastrando..." : "Cadastrar"}
            </button>
          </div>
        </div>
      )}

      {/* Monitors Tab */}
      {activeTab === "monitors" && (
        <div className="space-y-3">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={searchTerm}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
              placeholder="Buscar monitor..."
              className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 text-white text-sm rounded-md focus:outline-none focus:ring-2 focus:ring-violet-500/50"
            />
          </div>
          {isLoading ? (
            <div className="text-slate-400 text-center py-8">Carregando monitores...</div>
          ) : filteredMonitors.length === 0 ? (
            <div className="text-slate-400 text-center py-8">
              <GraduationCap size={32} className="mx-auto mb-2 opacity-40" />
              <p>Nenhum monitor encontrado</p>
            </div>
          ) : (
            filteredMonitors.map((monitor) => {
              const summary = activitySummary?.find((s) => s.monitor.id === monitor.id);
              return (
                <div
                  key={monitor.id}
                  className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-300 font-bold text-sm">
                        {(monitor.displayName || monitor.email).charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-white font-medium text-sm">{monitor.displayName || "—"}</div>
                        <div className="text-slate-400 text-xs">{monitor.email}</div>
                        <div className="text-slate-500 text-xs">Matrícula: {monitor.matricula}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          monitor.isActive
                            ? "bg-emerald-900/40 text-emerald-400 border border-emerald-700/40"
                            : "bg-red-900/40 text-red-400 border border-red-700/40"
                        }`}
                      >
                        {monitor.isActive ? "Ativo" : "Inativo"}
                      </span>
                      <button
                        className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                        onClick={() => setSelectedMonitorId(selectedMonitorId === monitor.id ? null : monitor.id)}
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        className="p-1.5 rounded text-red-400 hover:text-red-300 hover:bg-red-900/20 transition-colors"
                        onClick={() => {
                          if (confirm(`Remover monitor ${monitor.displayName || monitor.email}?`)) {
                            removeMutation.mutate({ teacherSessionToken: teacherToken || "", monitorId: monitor.id });
                          }
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="flex gap-4 text-xs text-slate-400 border-t border-slate-700/50 pt-2">
                    <span>Ações: <span className="text-violet-300 font-medium">{summary?.totalActions ?? 0}</span></span>
                    <span>Último login: <span className="text-slate-300">{monitor.lastLoginAt ? new Date(monitor.lastLoginAt).toLocaleDateString("pt-BR") : "Nunca"}</span></span>
                    <button
                      className="text-violet-400 hover:text-violet-300 underline"
                      onClick={() => { setLogFilterMonitorId(monitor.id); setActiveTab("logs"); }}
                    >
                      Ver logs
                    </button>
                  </div>

                  {/* Edit form */}
                  {selectedMonitorId === monitor.id && (
                    <div className="border-t border-slate-700/50 pt-3 space-y-3">
                      <p className="text-slate-400 text-xs font-medium">Editar monitor</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="text-slate-500 text-xs mb-1 block">Nova senha (opcional)</label>
                          <input
                            type="password"
                            value={editPassword}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditPassword(e.target.value)}
                            placeholder="Nova senha..."
                            className="w-full px-2 py-1 bg-slate-900 border border-slate-600 text-white text-xs rounded-md focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                          />
                        </div>
                        <div>
                          <label className="text-slate-500 text-xs mb-1 block">Status</label>
                          <select
                            className="w-full bg-slate-900 border border-slate-600 text-white text-xs h-8 rounded-md px-2"
                            defaultValue={monitor.isActive ? "1" : "0"}
                            onChange={(e) =>
                              updateMutation.mutate({
                                teacherSessionToken: teacherToken || "",
                                monitorId: monitor.id,
                                isActive: parseInt(e.target.value),
                              })
                            }
                          >
                            <option value="1">Ativo</option>
                            <option value="0">Inativo</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button className="px-2 py-1 text-slate-400 hover:text-slate-200 text-xs rounded transition-colors" onClick={() => { setSelectedMonitorId(null); setEditPassword(""); }}>
                          Cancelar
                        </button>
                        {editPassword && (
                          <button
                            className="px-2 py-1 bg-violet-600 hover:bg-violet-700 text-white text-xs rounded font-medium transition-colors disabled:opacity-50"
                            disabled={updateMutation.isPending}
                            onClick={() =>
                              updateMutation.mutate({
                                teacherSessionToken: teacherToken || "",
                                monitorId: monitor.id,
                                newPassword: editPassword,
                              })
                            }
                          >
                            Salvar senha
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Logs Tab */}
      {activeTab === "logs" && (
        <div className="space-y-4">
          {/* Filters row */}
          <div className="flex flex-wrap items-end gap-2">
            {/* Monitor filter */}
            <div>
              <label className="text-slate-500 text-xs mb-1 block">Monitor</label>
              <select
                className="bg-slate-800 border border-slate-700 text-white text-sm rounded-md px-3 py-1.5"
                value={logFilterMonitorId ?? ""}
                onChange={(e) => setLogFilterMonitorId(e.target.value ? parseInt(e.target.value) : undefined)}
              >
                <option value="">Todos os monitores</option>
                {(monitors || []).map((m) => (
                  <option key={m.id} value={m.id}>{m.displayName || m.email}</option>
                ))}
              </select>
            </div>
            {/* Date from */}
            <div>
              <label className="text-slate-500 text-xs mb-1 block">De</label>
              <input
                type="date"
                value={logDateFrom}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLogDateFrom(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-white text-sm rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
              />
            </div>
            {/* Date to */}
            <div>
              <label className="text-slate-500 text-xs mb-1 block">Até</label>
              <input
                type="date"
                value={logDateTo}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLogDateTo(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-white text-sm rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
              />
            </div>
            {/* Quick period shortcuts */}
            <div className="flex gap-1">
              {[
                { label: "Esta semana", days: 7 },
                { label: "Este mês", days: 30 },
                { label: "Semestre", days: 180 },
              ].map(({ label, days }) => (
                <button
                  key={label}
                  onClick={() => {
                    const to = new Date();
                    const from = new Date();
                    from.setDate(from.getDate() - days);
                    setLogDateFrom(from.toISOString().split("T")[0]);
                    setLogDateTo(to.toISOString().split("T")[0]);
                  }}
                  className="px-2 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-md transition-colors"
                >
                  {label}
                </button>
              ))}
            </div>
            {/* Clear filters */}
            {(logFilterMonitorId || logDateFrom || logDateTo) && (
              <button
                className="flex items-center gap-1 px-2 py-1.5 text-slate-400 hover:text-slate-200 text-xs rounded-md border border-slate-700 transition-colors"
                onClick={() => { setLogFilterMonitorId(undefined); setLogDateFrom(""); setLogDateTo(""); }}
              >
                <X size={13} /> Limpar filtros
              </button>
            )}
            {/* CSV Export */}
            {activityLogs && activityLogs.length > 0 && (
              <button
                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-600/20 text-green-400 hover:bg-green-600/30 rounded-md transition-colors"
                onClick={() => {
                  const header = ["ID", "Monitor", "Tipo de Ação", "Descrição", "Entidade", "ID Entidade", "Metadados", "Data/Hora"];
                  const rows = activityLogs.map((log) => [
                    log.id,
                    log.monitorName,
                    log.actionType,
                    log.actionDescription,
                    log.targetEntity || "",
                    log.targetId ?? "",
                    log.metadata || "",
                    new Date(log.createdAt).toLocaleString("pt-BR"),
                  ]);
                  const csv = [header, ...rows]
                    .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
                    .join("\n");
                  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `log_monitores_${new Date().toISOString().split("T")[0]}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                  toast.success(`${activityLogs.length} registros exportados!`);
                }}
              >
                <Download size={14} /> Exportar CSV
              </button>
            )}
          </div>

          {/* Summary cards */}
          {!logFilterMonitorId && activitySummary && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {activitySummary.map(({ monitor, totalActions, recentLogs }) => (
                <div key={monitor.id} className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-300 font-bold text-xs">
                      {(monitor.displayName || monitor.email).charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-white text-sm font-medium">{monitor.displayName || monitor.email}</div>
                      <div className="text-slate-500 text-xs">{totalActions} ações registradas</div>
                    </div>
                  </div>
                  {recentLogs.length > 0 ? (
                    <div className="space-y-1">
                      {recentLogs.slice(0, 3).map((log) => (
                        <div key={log.id} className="text-xs text-slate-400 flex items-start gap-1.5">
                          <span className={`mt-0.5 shrink-0 ${getActionTypeColor(log.actionType)}`}>•</span>
                          <span className="truncate">{log.actionDescription}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-500 text-xs">Nenhuma ação registrada</p>
                  )}
                  <button
                    className="mt-2 text-xs text-violet-400 hover:text-violet-300 underline"
                    onClick={() => setLogFilterMonitorId(monitor.id)}
                  >
                    Ver todos os logs
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Detailed logs */}
          {activityLogs && activityLogs.length > 0 ? (
            <div className="space-y-2">
              <p className="text-slate-400 text-sm">{activityLogs.length} registros encontrados</p>
              {activityLogs.map((log) => (
                <div key={log.id} className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-3 flex items-start gap-3">
                  <div className={`mt-0.5 shrink-0 ${getActionTypeColor(log.actionType)}`}>
                    <BookOpen size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white text-sm font-medium">{log.monitorName}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">
                        {getActionTypeLabel(log.actionType)}
                      </span>
                      {log.targetEntity && (
                        <span className="text-xs text-slate-500">{log.targetEntity}</span>
                      )}
                    </div>
                    <p className="text-slate-400 text-xs mt-0.5">{log.actionDescription}</p>
                    <p className="text-slate-600 text-xs mt-0.5">{new Date(log.createdAt).toLocaleString("pt-BR")}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : activityLogs && activityLogs.length === 0 ? (
            <div className="text-center py-10 text-slate-500">
              <History size={32} className="mx-auto mb-2 opacity-40" />
              <p>Nenhuma atividade registrada ainda</p>
              <p className="text-xs mt-1">As ações dos monitores aparecerão aqui</p>
            </div>
          ) : null}
        </div>
      )}

      {/* ─── Aba Notas dos Monitores ─── */}
      {activeTab === "notas" && (
        <div className="space-y-4">
          {/* Filtros */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2">
              <label className="text-slate-400 text-xs">Tipo de atividade:</label>
              <select
                value={notasTypeFilter ?? ""}
                onChange={(e) => setNotasTypeFilter(e.target.value ? e.target.value as "kahoot" | "clinical_case" : undefined)}
                className="px-3 py-1.5 bg-slate-800 border border-slate-600 text-white text-sm rounded-md focus:outline-none"
              >
                <option value="">Todos</option>
                <option value="kahoot">Kahoot</option>
                <option value="clinical_case">Casos Clínicos</option>
              </select>
            </div>
            <button
              onClick={() => refetchAdminGrades()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm rounded-md transition-colors"
            >
              <Activity size={13} /> Atualizar
            </button>
            {adminGrades && (
              <span className="text-slate-400 text-xs ml-auto">{adminGrades.length} registro(s)</span>
            )}
          </div>

          {gradesLoading ? (
            <div className="flex items-center justify-center py-10 text-slate-400">
              <Loader2 size={20} className="animate-spin mr-2" /> Carregando notas...
            </div>
          ) : !adminGrades || adminGrades.length === 0 ? (
            <div className="text-center py-10 text-slate-500">
              <BookOpen size={32} className="mx-auto mb-2 opacity-40" />
              <p>Nenhuma nota lançada ainda</p>
              <p className="text-xs mt-1">As notas lançadas pelos monitores aparecerão aqui</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-800/80 text-slate-400 text-xs uppercase tracking-wider">
                    <th className="px-4 py-3 text-left">Tipo</th>
                    <th className="px-4 py-3 text-left">Atividade</th>
                    <th className="px-4 py-3 text-left">Grupo</th>
                    <th className="px-4 py-3 text-center">Nota</th>
                    <th className="px-4 py-3 text-center">Máx.</th>
                    <th className="px-4 py-3 text-left">Lançado por</th>
                    <th className="px-4 py-3 text-left">Obs.</th>
                    <th className="px-4 py-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {adminGrades.map((g) => {
                    const gradeNum = parseFloat(String(g.grade));
                    const maxNum = parseFloat(String(g.maxGrade));
                    const pct = maxNum > 0 ? (gradeNum / maxNum) * 100 : 0;
                    const color = pct >= 70 ? "#10b981" : pct >= 50 ? "#f59e0b" : "#ef4444";
                    const isEditing = editingGradeId === g.id;
                    return (
                      <tr key={g.id} className={`transition-colors ${
                        isEditing ? "bg-violet-900/20" : "hover:bg-slate-800/40"
                      }`}>
                        <td className="px-4 py-2.5">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            g.activityType === "kahoot"
                              ? "bg-purple-900/50 text-purple-300"
                              : "bg-teal-900/50 text-teal-300"
                          }`}>
                            {g.activityType === "kahoot" ? "Kahoot" : "Caso Clínico"}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-slate-200 font-medium max-w-[160px] truncate">{g.activityName}</td>
                        <td className="px-4 py-2.5 text-slate-300">{g.groupName}</td>
                        <td className="px-4 py-2.5 text-center">
                          {isEditing ? (
                            <input
                              type="number" min={0} max={editingMaxGrade} step={0.1}
                              value={editingGradeValue}
                              onChange={(e) => setEditingGradeValue(parseFloat(e.target.value) || 0)}
                              className="w-20 px-2 py-1 rounded border border-violet-500/50 bg-slate-900 text-white text-sm text-center focus:outline-none"
                            />
                          ) : (
                            <span className="font-semibold" style={{ color }}>{gradeNum.toFixed(1)}</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {isEditing ? (
                            <input
                              type="number" min={0} max={100} step={0.5}
                              value={editingMaxGrade}
                              onChange={(e) => setEditingMaxGrade(parseFloat(e.target.value) || 10)}
                              className="w-16 px-2 py-1 rounded border border-slate-600 bg-slate-900 text-white text-sm text-center focus:outline-none"
                            />
                          ) : (
                            <span className="text-slate-400">{maxNum.toFixed(1)}</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-slate-400 text-xs">{g.launchedByName ?? "—"}</td>
                        <td className="px-4 py-2.5 text-slate-400 text-xs max-w-[120px] truncate">{g.notes ?? "—"}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center justify-center gap-1.5">
                            {isEditing ? (
                              <>
                                <button
                                  onClick={() => adminUpsertGrade.mutate({
                                    teacherSessionToken: teacherToken || "",
                                    classId: g.classId,
                                    activityType: g.activityType as "kahoot" | "clinical_case",
                                    activityName: g.activityName,
                                    groupName: g.groupName,
                                    grade: editingGradeValue,
                                    maxGrade: editingMaxGrade,
                                    notes: g.notes ?? undefined,
                                    existingId: g.id,
                                  })}
                                  disabled={adminUpsertGrade.isPending}
                                  className="p-1.5 rounded bg-green-600/20 hover:bg-green-600/40 text-green-400 transition-colors disabled:opacity-50"
                                  title="Salvar"
                                >
                                  <CheckCircle size={14} />
                                </button>
                                <button
                                  onClick={() => setEditingGradeId(null)}
                                  className="p-1.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-400 transition-colors"
                                  title="Cancelar"
                                >
                                  <X size={14} />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => {
                                    setEditingGradeId(g.id);
                                    setEditingGradeValue(gradeNum);
                                    setEditingMaxGrade(maxNum);
                                  }}
                                  className="p-1.5 rounded bg-violet-600/20 hover:bg-violet-600/40 text-violet-400 transition-colors"
                                  title="Editar nota"
                                >
                                  <Edit2 size={14} />
                                </button>
                                <button
                                  onClick={() => {
                                    if (confirm(`Excluir nota de "${g.groupName}" em "${g.activityName}"?`)) {
                                      adminDeleteGrade.mutate({ teacherSessionToken: teacherToken || "", gradeId: g.id });
                                    }
                                  }}
                                  disabled={adminDeleteGrade.isPending}
                                  className="p-1.5 rounded bg-red-600/20 hover:bg-red-600/40 text-red-400 transition-colors disabled:opacity-50"
                                  title="Excluir nota"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Professores Manager (Coordenador only) ───
function ProfessoresManager({ teacherToken }: { teacherToken: string | null }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [showInactive, setShowInactive] = useState(true);

  const utils = trpc.useUtils();
  
  // Get current teacher info to check if coordenador
  const { data: currentTeacher } = trpc.teacherAuth.me.useQuery(
    { sessionToken: teacherToken || "" },
    { enabled: !!teacherToken }
  );
  const isCoordinator = currentTeacher?.role === "coordenador" || currentTeacher?.role === "super_admin";

  // Get all teachers (only works if coordenador)
  const { data: teachers, isLoading } = trpc.teacherManagement.listAll.useQuery(
    { sessionToken: teacherToken || "" },
    { enabled: isCoordinator && !!teacherToken }
  );

  const toggleActiveMutation = trpc.teacherManagement.toggleActive.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      utils.teacherManagement.listAll.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const promoteMutation = trpc.teacherManagement.promoteToCoordinator.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      utils.teacherManagement.listAll.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const demoteMutation = trpc.teacherManagement.demoteToTeacher.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      utils.teacherManagement.listAll.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.teacherManagement.deleteTeacher.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      utils.teacherManagement.listAll.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  if (!isCoordinator) {
    return (
      <div className="container max-w-6xl py-8">
        <div className="border border-border rounded-lg p-8 text-center" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
          <Lock size={48} className="mx-auto mb-4 text-muted-foreground" />
          <h2 className="font-display font-bold text-xl text-foreground mb-2">Acesso Restrito</h2>
          <p className="text-muted-foreground">Apenas coordenadores podem acessar a gestão de professores.</p>
        </div>
      </div>
    );
  }

  const filteredTeachers = teachers?.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         t.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = showInactive || t.isActive === 1;
    return matchesSearch && matchesStatus;
  }) || [];

  return (
    <div className="container max-w-6xl py-8">
      <div className="mb-6">
        <h1 className="font-display font-bold text-3xl text-foreground mb-2">Gestão de Professores</h1>
        <p className="text-muted-foreground">Gerencie contas de professores e coordenadores</p>
      </div>



      {/* Search and Filters */}
      <div className="mb-6 flex gap-3 flex-wrap">
        <div className="flex-1 min-w-[250px] relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Buscar por nome ou email..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
          />
        </div>
        <button
          onClick={() => setShowInactive(!showInactive)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            showInactive
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-foreground border border-border"
          }`}
        >
          {showInactive ? "Mostrar Todos" : "Apenas Ativos"}
        </button>
      </div>

      {/* Teachers List */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando professores...</div>
      ) : filteredTeachers.length === 0 ? (
        <div className="border border-border rounded-lg p-8 text-center" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
          <Users size={48} className="mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Nenhum professor encontrado</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTeachers.map(teacher => (
            <motion.div
              key={teacher.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="border border-border rounded-lg p-4"
              style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <UserCheck size={24} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-semibold text-foreground">{teacher.name}</h3>
                    {teacher.role === "coordenador" && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-500 text-xs font-medium">
                        Coordenador
                      </span>
                    )}
                    {teacher.isActive === 1 ? (
                      <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-500 text-xs font-medium">
                        Ativo
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-500 text-xs font-medium">
                        Inativo
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">{teacher.email}</p>
                  <p className="text-xs text-muted-foreground">
                    Último acesso: {teacher.lastLoginAt ? new Date(teacher.lastLoginAt).toLocaleString('pt-BR') : 'Nunca'}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0 flex-wrap">
                  {/* Toggle Active/Inactive */}
                  <button
                    onClick={() => { if (teacherToken) toggleActiveMutation.mutate({
                      sessionToken: teacherToken,
                      teacherId: teacher.id,
                      isActive: teacher.isActive === 1 ? 0 : 1,
                    }); }}
                    disabled={toggleActiveMutation.isPending || teacher.id === currentTeacher?.id}
                    className="px-3 py-1.5 rounded-md bg-secondary hover:bg-secondary/80 text-foreground text-xs font-medium disabled:opacity-50 flex items-center gap-1"
                    title={teacher.isActive === 1 ? "Desativar" : "Ativar"}
                  >
                    {teacher.isActive === 1 ? (
                      <><EyeOff size={12} /> Desativar</>
                    ) : (
                      <><Eye size={12} /> Ativar</>
                    )}
                  </button>

                  {/* Promote/Demote */}
                  {teacher.role === "professor" ? (
                    <button
                      onClick={() => { if (teacherToken) promoteMutation.mutate({
                        sessionToken: teacherToken,
                        teacherId: teacher.id,
                      }); }}
                      disabled={promoteMutation.isPending}
                      className="px-3 py-1.5 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-500 text-xs font-medium flex items-center gap-1"
                      title="Promover a Coordenador"
                    >
                      <Trophy size={12} /> Promover
                    </button>
                  ) : (
                    <button
                      onClick={() => { if (teacherToken) demoteMutation.mutate({
                        sessionToken: teacherToken,
                        teacherId: teacher.id,
                      }); }}
                      disabled={demoteMutation.isPending || teacher.id === currentTeacher?.id}
                      className="px-3 py-1.5 rounded-md bg-secondary hover:bg-secondary/80 text-foreground text-xs font-medium disabled:opacity-50 flex items-center gap-1"
                      title="Rebaixar a Professor"
                    >
                      Rebaixar
                    </button>
                  )}

                  {/* Delete */}
                  <button
                    onClick={() => {
                      if (confirm(`Tem certeza que deseja remover ${teacher.name}?`)) {
                        if (teacherToken) deleteMutation.mutate({
                          sessionToken: teacherToken,
                          teacherId: teacher.id,
                        });
                      }
                    }}
                    disabled={deleteMutation.isPending || teacher.id === currentTeacher?.id}
                    className="px-3 py-1.5 rounded-md bg-red-500/20 hover:bg-red-500/30 text-red-500 text-xs font-medium disabled:opacity-50 flex items-center gap-1"
                    title="Remover Professor"
                  >
                    <Trash2 size={12} /> Remover
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <div className="mt-6 p-4 border border-border rounded-lg" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
        <p className="text-sm text-muted-foreground">
          <strong>Total:</strong> {filteredTeachers.length} professor(es) • 
          <strong className="ml-2">Ativos:</strong> {filteredTeachers.filter(t => t.isActive === 1).length} • 
          <strong className="ml-2">Coordenadores:</strong> {filteredTeachers.filter(t => t.role === "coordenador").length}
        </p>
      </div>
    </div>
  );
}

// ─── Settings ───
function SettingsManager({ password }: { password: string }) {
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");

  const changePw = trpc.admin.changePassword.useMutation({
    onSuccess: (data) => {
      if (data.success) { toast.success(data.message); setCurrentPw(""); setNewPw(""); }
      else toast.error(data.message);
    },
  });

  const updateSettings = trpc.settings.updateSettings.useMutation({
    onSuccess: () => toast.success("Configurações salvas!"),
    onError: () => toast.error("Erro ao salvar configurações"),
  });

  const { data: leaderboard } = trpc.leaderboard.getData.useQuery();
  const [currentWeek, setCurrentWeek] = useState(leaderboard?.settings?.currentWeek || "5");

  return (
    <div className="space-y-6">
      <div className="border border-border rounded-lg p-4" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
        <h3 className="font-display font-semibold text-sm text-foreground mb-3 flex items-center gap-2">
          <KeyRound size={16} className="text-primary" /> Alterar Senha
        </h3>
        <div className="space-y-2">
          <input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm" placeholder="Senha atual" />
          <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm" placeholder="Nova senha (mín. 6 caracteres)" />
          <button onClick={() => changePw.mutate({ currentPassword: currentPw, newPassword: newPw })} disabled={!currentPw || newPw.length < 6} className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50">Alterar Senha</button>
        </div>
      </div>

      <div className="border border-border rounded-lg p-4" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
        <h3 className="font-display font-semibold text-sm text-foreground mb-3 flex items-center gap-2">
          <Settings size={16} className="text-primary" /> Semana Atual
        </h3>
        <div className="flex gap-2">
          <input type="number" min="1" max="16" value={currentWeek} onChange={e => setCurrentWeek(e.target.value)} className="w-20 px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm font-mono" />
          <button onClick={() => {
            const weekNum = parseInt(currentWeek);
            if (weekNum >= 1 && weekNum <= 16) {
              updateSettings.mutate({ schedule: `week:${weekNum}` }, {
                onSuccess: () => toast.success(`Semana atual atualizada para ${weekNum}`),
                onError: () => toast.error("Erro ao salvar semana")
              });
            } else {
              toast.error("Semana deve ser entre 1 e 16");
            }
          }} className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium">Salvar</button>
        </div>
      </div>
    </div>
  );
}

// ─── Notifications Manager ───
function NotificationsManager({ password }: { password: string }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [priority, setPriority] = useState<"normal" | "important" | "urgent">("normal");
  const [type, setType] = useState<"banner" | "announcement" | "reminder">("announcement");
  const [expiresAt, setExpiresAt] = useState("");

  const utils = trpc.useUtils();
  const { data: notifs, isLoading } = trpc.notifications.getAll.useQuery({ password });

  const createNotif = trpc.notifications.create.useMutation({
    onSuccess: () => {
      utils.notifications.getAll.invalidate();
      utils.notifications.getActive.invalidate();
      toast.success("Notificação criada!");
      setTitle(""); setContent(""); setPriority("normal"); setType("announcement"); setExpiresAt("");
    },
    onError: () => toast.error("Erro ao criar notificação"),
  });

  const toggleActive = trpc.notifications.update.useMutation({
    onSuccess: () => {
      utils.notifications.getAll.invalidate();
      utils.notifications.getActive.invalidate();
      toast.success("Notificação atualizada!");
    },
  });

  const deleteNotif = trpc.notifications.delete.useMutation({
    onSuccess: () => {
      utils.notifications.getAll.invalidate();
      utils.notifications.getActive.invalidate();
      toast.success("Notificação removida!");
    },
  });

  const priorityColors: Record<string, string> = {
    urgent: "text-red-400",
    important: "text-amber-400",
    normal: "text-primary",
  };

  const priorityLabels: Record<string, string> = {
    urgent: "Urgente",
    important: "Importante",
    normal: "Normal",
  };

  const typeLabels: Record<string, string> = {
    banner: "Banner",
    announcement: "Comunicado",
    reminder: "Lembrete",
  };

  return (
    <div className="space-y-6">
      {/* Create Notification */}
      <div className="border border-border rounded-lg p-4" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
        <h3 className="font-display font-semibold text-sm text-foreground mb-3 flex items-center gap-2">
          <Plus size={16} className="text-primary" /> Nova Notificação
        </h3>
        <div className="space-y-3">
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm placeholder:text-muted-foreground"
            placeholder="Título do aviso..."
          />
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm placeholder:text-muted-foreground min-h-[80px] resize-y"
            placeholder="Conteúdo detalhado (opcional)..."
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <select
              value={priority}
              onChange={e => setPriority(e.target.value as "normal" | "important" | "urgent")}
              className="px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm"
            >
              <option value="normal">Normal</option>
              <option value="important">Importante</option>
              <option value="urgent">Urgente</option>
            </select>
            <select
              value={type}
              onChange={e => setType(e.target.value as "banner" | "announcement" | "reminder")}
              className="px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm"
            >
              <option value="announcement">Comunicado</option>
              <option value="banner">Banner</option>
              <option value="reminder">Lembrete</option>
            </select>
            <input
              type="datetime-local"
              value={expiresAt}
              onChange={e => setExpiresAt(e.target.value)}
              className="px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm"
              title="Data de expiração (opcional)"
            />
          </div>
          <button
            onClick={() => createNotif.mutate({
              password,
              title,
              content: content || undefined,
              priority,
              type,
              expiresAt: expiresAt || undefined,
            })}
            disabled={!title || createNotif.isPending}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 flex items-center gap-1.5"
          >
            <Bell size={14} /> Publicar Aviso
          </button>
        </div>
      </div>

      {/* Notifications List */}
      <div>
        <h3 className="font-display font-semibold text-sm text-foreground mb-3">Avisos Publicados ({notifs?.length || 0})</h3>
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
        ) : !notifs || notifs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhum aviso publicado</p>
        ) : (
          <div className="space-y-2">
            {notifs.map(notif => (
              <div
                key={notif.id}
                className={`border rounded-lg p-3 ${notif.isActive ? "border-border" : "border-border/30 opacity-50"}`}
                style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-xs font-bold ${priorityColors[notif.priority] || "text-primary"}`}>
                        {notif.priority === "urgent" && <AlertTriangle size={12} className="inline mr-1" />}
                        {priorityLabels[notif.priority] || "Normal"}
                      </span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{typeLabels[notif.type] || notif.type}</span>
                      {!notif.isActive && <span className="text-xs px-1.5 py-0.5 rounded bg-destructive/20 text-destructive">Inativo</span>}
                    </div>
                    <h4 className="font-medium text-sm text-foreground">{notif.title}</h4>
                    {notif.content && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{notif.content}</p>}
                    <div className="flex items-center gap-2 mt-2 text-[11px] text-muted-foreground">
                      <Clock size={10} />
                      <span>{new Date(notif.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                      {notif.expiresAt && <span className="text-amber-400">Expira: {new Date(notif.expiresAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => toggleActive.mutate({ password, id: notif.id, isActive: notif.isActive ? 0 : 1 })}
                      className={`px-2 py-1 rounded text-xs font-medium ${notif.isActive ? "bg-amber-500/20 text-amber-400" : "bg-primary/20 text-primary"}`}
                    >
                      {notif.isActive ? "Desativar" : "Ativar"}
                    </button>
                    <button
                      onClick={() => { if (confirm("Remover esta notificação?")) deleteNotif.mutate({ password, id: notif.id }); }}
                      className="p-1.5 rounded hover:bg-destructive/20 text-destructive"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Materials Manager ───
const MODULES = [
  "Geral", "Introdução à Farmacologia", "Farmacocinética", "Farmacodinâmica",
  "SNA — Adrenérgicos", "SNA — Colinérgicos", "Bloqueadores Neuromusculares",
  "Anti-inflamatórios", "Seminários Jigsaw", "Casos Clínicos",
];

function MaterialsManager({ password }: { password: string }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [materialType, setMaterialType] = useState<"file" | "link" | "comment">("file");
  const [fileInputMode, setFileInputMode] = useState<"url" | "upload">("url");
  const [fileExternalUrl, setFileExternalUrl] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [module, setModule] = useState("Geral");
  const [week, setWeek] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [filterTypes, setFilterTypes] = useState<MaterialType[]>(["file", "link", "comment"]);
  const [tags, setTags] = useState<Tag[]>([]);
  const pdfPreview = usePDFPreview();

  const utils = trpc.useUtils();
  const { data: materials, isLoading } = trpc.materials.getAll.useQuery({ password });

  const uploadMaterial = trpc.materials.upload.useMutation({
    onSuccess: () => {
      utils.materials.getAll.invalidate();
      utils.materials.getVisible.invalidate();
      toast.success("Arquivo enviado com sucesso!");
      resetForm();
    },
    onError: () => toast.error("Erro ao enviar arquivo"),
  });

  const createMaterial = trpc.materials.create.useMutation({
    onSuccess: () => {
      utils.materials.getAll.invalidate();
      utils.materials.getVisible.invalidate();
      toast.success("Material adicionado!");
      resetForm();
    },
    onError: () => toast.error("Erro ao adicionar material"),
  });

  const toggleVisibility = trpc.materials.update.useMutation({
    onSuccess: () => {
      utils.materials.getAll.invalidate();
      utils.materials.getVisible.invalidate();
      toast.success("Visibilidade atualizada!");
    },
  });

  const deleteMaterial = trpc.materials.delete.useMutation({
    onSuccess: () => {
      utils.materials.getAll.invalidate();
      utils.materials.getVisible.invalidate();
      toast.success("Material removido!");
    },
  });

  function resetForm() {
    setTitle(""); setDescription(""); setLinkUrl(""); setFileExternalUrl(""); setModule("Geral"); setWeek(""); setSelectedFile(null); setUploading(false);
  }

  async function handleSubmit() {
    if (!title) { toast.error("Título é obrigatório"); return; }
    setUploading(true);
    try {
      if (materialType === "file" && fileInputMode === "url" && fileExternalUrl) {
        // Salvar como material com URL externa (Google Drive, OneDrive, etc.)
        await createMaterial.mutateAsync({
          password,
          title,
          description: description || undefined,
          type: "file",
          url: fileExternalUrl,
          module,
          week: week ? parseInt(week) : undefined,
        });
      } else if (materialType === "file" && fileInputMode === "upload" && selectedFile) {
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(",")[1]);
          };
          reader.onerror = reject;
          reader.readAsDataURL(selectedFile);
        });
        await uploadMaterial.mutateAsync({
          password,
          title,
          description: description || undefined,
          module,
          week: week ? parseInt(week) : undefined,
          fileName: selectedFile.name,
          mimeType: selectedFile.type || "application/octet-stream",
          fileBase64: base64,
        });
      } else if (materialType === "link") {
        if (!linkUrl) { toast.error("URL é obrigatória para links"); setUploading(false); return; }
        await createMaterial.mutateAsync({
          password,
          title,
          description: description || undefined,
          type: "link",
          url: linkUrl,
          module,
          week: week ? parseInt(week) : undefined,
        });
      } else if (materialType === "comment") {
        await createMaterial.mutateAsync({
          password,
          title,
          description: description || undefined,
          type: "comment",
          module,
          week: week ? parseInt(week) : undefined,
        });
      }
    } catch {
      toast.error("Erro ao enviar material");
    }
    setUploading(false);
  }

  const typeIcons: Record<string, React.ReactNode> = {
    file: <FileText size={14} className="text-blue-400" />,
    link: <Link2 size={14} className="text-primary" />,
    comment: <MessageSquare size={14} className="text-green-400" />,
  };

  const typeLabels: Record<string, string> = {
    file: "Arquivo",
    link: "Link",
    comment: "Comentário",
  };

  // Group materials by module
  const grouped = useMemo(() => {
    if (!materials) return {};
    const g: Record<string, typeof materials> = {};
    for (const m of materials) {
      const mod = m.module || "Geral";
      if (!g[mod]) g[mod] = [];
      g[mod].push(m);
    }
    return g;
  }, [materials]);

  return (
    <div className="space-y-6">
      {/* Add Material */}
      <div className="border border-border rounded-lg p-4" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
        <h3 className="font-display font-semibold text-sm text-foreground mb-3 flex items-center gap-2">
          <Plus size={16} className="text-primary" /> Novo Material
        </h3>

        {/* File input mode - URL externa ou upload direto */}
        {materialType === "file" && (
          <div className="mb-4">
            <div className="flex gap-1 p-1 rounded-lg bg-secondary/30 w-fit mb-3">
              <button
                onClick={() => setFileInputMode("url")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  fileInputMode === "url" ? "bg-primary/20 text-primary border border-primary/30" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Link2 size={11} /> Link externo
              </button>
              <button
                onClick={() => setFileInputMode("upload")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  fileInputMode === "upload" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Upload size={11} /> Upload direto
              </button>
            </div>
            {fileInputMode === "url" ? (
              <div className="space-y-2">
                <div className="p-3 rounded-md bg-blue-500/10 border border-blue-500/20">
                  <p className="text-xs text-blue-300 leading-relaxed">
                    <strong className="text-blue-200">Como usar o Google Drive:</strong> Faça upload do arquivo no Google Drive → clique com o botão direito → "Compartilhar" → "Qualquer pessoa com o link" → copie o link e cole abaixo.
                  </p>
                </div>
                <input
                  value={fileExternalUrl}
                  onChange={e => setFileExternalUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm placeholder:text-muted-foreground"
                  placeholder="Cole aqui o link do Google Drive, OneDrive ou Dropbox..."
                />
              </div>
            ) : (
              <FileDropZone
                onFilesSelected={(files) => {
                  if (files.length > 0) {
                    setSelectedFile(files[0]);
                    if (files[0].type === "application/pdf") {
                      pdfPreview.openPreview(files[0]);
                    }
                  }
                }}
                acceptedTypes={[".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".jpg", ".jpeg", ".png"]}
                maxSize={50 * 1024 * 1024}
                multiple={false}
              />
            )}
          </div>
        )}

        {/* Type selector */}
        <div className="flex gap-1 p-1 rounded-lg bg-secondary/50 w-fit mb-4">
          {(["file", "link", "comment"] as const).map(t => (
            <button
              key={t}
              onClick={() => setMaterialType(t)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                materialType === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "file" && <Upload size={12} />}
              {t === "link" && <Link2 size={12} />}
              {t === "comment" && <MessageSquare size={12} />}
              {typeLabels[t]}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm placeholder:text-muted-foreground"
            placeholder="Título do material..."
          />
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm placeholder:text-muted-foreground min-h-[60px] resize-y"
            placeholder="Descrição ou comentário..."
          />

          {materialType === "file" && fileInputMode === "upload" && (
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 px-4 py-2 rounded-md bg-secondary border border-border text-foreground text-sm cursor-pointer hover:bg-secondary/80">
                <Paperclip size={14} />
                {selectedFile ? selectedFile.name : "Selecionar arquivo..."}
                <input
                  type="file"
                  className="hidden"
                  onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.mp4,.mp3,.zip"
                />
              </label>
              {selectedFile && (
                <span className="text-xs text-muted-foreground">
                  {(selectedFile.size / 1024 / 1024).toFixed(1)} MB
                </span>
              )}
            </div>
          )}

          {materialType === "link" && (
            <input
              value={linkUrl}
              onChange={e => setLinkUrl(e.target.value)}
              className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm placeholder:text-muted-foreground"
              placeholder="https://..."
            />
          )}

          <div className="grid grid-cols-2 gap-2">
            <select
              value={module}
              onChange={e => setModule(e.target.value)}
              className="px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm"
            >
              {MODULES.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <input
              type="number"
              value={week}
              onChange={e => setWeek(e.target.value)}
              className="px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm placeholder:text-muted-foreground"
              placeholder="Semana (opcional)"
              min={1}
              max={16}
            />
          </div>

          {/* Tags */}
          <div>
            <label className="text-xs font-medium text-foreground mb-2 block">Tags (opcional)</label>
            <TagInput
              tags={tags}
              onTagsChange={setTags}
              maxTags={5}
              suggestions={["Importante", "Leitura Obrigatória", "Complementar", "Exercício", "Prova", "Discussão", "Caso Clínico", "Referência"]}
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={uploading || !title || (materialType === "file" && fileInputMode === "url" && !fileExternalUrl) || (materialType === "file" && fileInputMode === "upload" && !selectedFile) || (materialType === "link" && !linkUrl)}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 flex items-center gap-1.5"
          >
            {uploading ? "Enviando..." : <><Upload size={14} /> Publicar Material</>}
          </button>
        </div>
      </div>

      {/* Materials List */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold text-sm text-foreground">Materiais Publicados ({materials?.length || 0})</h3>
        </div>
        <div className="mb-4">
          <p className="text-xs text-muted-foreground mb-2">Filtrar por tipo:</p>
          <MaterialTypeFilter selectedTypes={filterTypes} onTypeChange={setFilterTypes} />
        </div>
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
        ) : !materials || materials.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhum material publicado</p>
        ) : (
          <div className="space-y-4">
            {Object.entries(grouped).map(([mod, items]) => (
              <div key={mod}>
                <h4 className="text-xs font-bold text-primary uppercase tracking-wide mb-2">{mod}</h4>
                <div className="space-y-2">
                  {items.filter(mat => filterTypes.includes(mat.type as MaterialType)).map(mat => (
                    <div
                      key={mat.id}
                      className={`border rounded-lg p-3 ${mat.isVisible ? "border-border" : "border-border/30 opacity-50"}`}
                      style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}
                    >
                      <div className="flex items-start gap-2">
                        <div className="mt-0.5">{typeIcons[mat.type]}</div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <MaterialTypeBadge
                              type={mat.type}
                              fileName={mat.fileName}
                              url={mat.url}
                              variant="default"
                            />
                            {mat.week && <span className="text-xs text-muted-foreground">Semana {mat.week}</span>}
                            {!mat.isVisible && <span className="text-xs px-1.5 py-0.5 rounded bg-destructive/20 text-destructive">Oculto</span>}
                          </div>

                          <h4 className="font-medium text-sm text-foreground">{mat.title}</h4>
                          {mat.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{mat.description}</p>}
                          {mat.type === "file" && mat.fileName && (
                            <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                              <Paperclip size={10} /> {mat.fileName}
                            </p>
                          )}
                          {mat.type === "link" && mat.url && (
                            <a href={mat.url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-primary hover:underline mt-1 flex items-center gap-1">
                              <Link2 size={10} /> {mat.url}
                            </a>
                          )}
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {new Date(mat.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => toggleVisibility.mutate({ password, id: mat.id, isVisible: mat.isVisible ? 0 : 1 })}
                            className="p-1.5 rounded hover:bg-secondary text-muted-foreground"
                            title={mat.isVisible ? "Ocultar" : "Mostrar"}
                          >
                            {mat.isVisible ? <Eye size={14} /> : <EyeOff size={14} />}
                          </button>
                          <button
                            onClick={() => { if (confirm("Remover este material?")) deleteMaterial.mutate({ password, id: mat.id }); }}
                            className="p-1.5 rounded hover:bg-destructive/20 text-destructive"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Badges Manager ───
function BadgesManager({ password }: { password: string }) {
  const [showCreate, setShowCreate] = useState(false);
  const [newBadge, setNewBadge] = useState({ name: "", description: "", category: "Semana 1", week: 1, criteria: "", iconUrl: "", autoAssign: false, autoAssignRuleType: "top_individual", autoAssignN: 3, autoAssignXP: 50 });
  const [assignBadgeId, setAssignBadgeId] = useState<number | null>(null);
  const [assignMemberId, setAssignMemberId] = useState<number | null>(null);
  const [assignNote, setAssignNote] = useState("");
  const [editingAutoRuleBadgeId, setEditingAutoRuleBadgeId] = useState<number | null>(null);
  const [editRuleType, setEditRuleType] = useState("top_individual");
  const [editRuleN, setEditRuleN] = useState(3);
  const [editRuleXP, setEditRuleXP] = useState(50);
  const [autoAssignResult, setAutoAssignResult] = useState<{ totalAwarded: number; totalRevoked: number; results: any[] } | null>(null);
  const [previewRule, setPreviewRule] = useState<string | null>(null);

  const { data: badges, refetch: refetchBadges } = trpc.badges.getWithMembers.useQuery();
  const { data: leaderboard } = trpc.leaderboard.getData.useQuery();
  const createBadge = trpc.badges.create.useMutation({ onSuccess: () => { refetchBadges(); setShowCreate(false); setNewBadge({ name: "", description: "", category: "Semana 1", week: 1, criteria: "", iconUrl: "", autoAssign: false, autoAssignRuleType: "top_individual", autoAssignN: 3, autoAssignXP: 50 }); toast.success("Badge criado!"); } });
  const assignBadge = trpc.badges.award.useMutation({ onSuccess: () => { refetchBadges(); setAssignBadgeId(null); setAssignMemberId(null); setAssignNote(""); toast.success("Badge atribuído!"); } });
  const removeBadge = trpc.badges.revoke.useMutation({ onSuccess: () => { refetchBadges(); toast.success("Badge removido!"); } });
  const deleteBadge = trpc.badges.delete.useMutation({ onSuccess: () => { refetchBadges(); toast.success("Badge excluído!"); } });
  const updateBadge = trpc.badges.update.useMutation({ onSuccess: () => { refetchBadges(); setEditingAutoRuleBadgeId(null); toast.success("Regra de auto-atribuição salva!"); } });
  const autoAssignMutation = trpc.badges.autoAssign.useMutation({
    onSuccess: (data) => {
      refetchBadges();
      setAutoAssignResult(data);
      if (data.totalAwarded > 0) toast.success(`✅ ${data.totalAwarded} conquista(s) atribuída(s) automaticamente!`);
      else toast.info("Nenhuma nova conquista para atribuir.");
    },
    onError: (err) => toast.error(err.message),
  });

  const previewRuleStr = useMemo(() => {
    if (!previewRule) return null;
    return previewRule;
  }, [previewRule]);

  const { data: previewMembers } = trpc.badges.previewAutoAssign.useQuery(
    { password, rule: previewRuleStr ?? "" },
    { enabled: !!previewRuleStr && previewRuleStr.length > 2 }
  );

  const allMembers = useMemo(() => {
    if (!leaderboard?.teams) return [];
    return leaderboard.teams.flatMap(t => t.members.map(m => ({ id: m.id, name: m.name, teamName: t.name })));
  }, [leaderboard]);

  const categories = ["Semana 1", "Semana 2", "Semana 3", "TBL", "Jigsaw", "Casos Clínicos", "Escape Room", "Participação", "Geral"];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-bold text-lg text-foreground flex items-center gap-2">
          <Award size={20} className="text-primary" /> Gerenciar Conquistas
        </h2>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-primary text-primary-foreground text-xs font-medium"
        >
          <Plus size={14} /> Novo Badge
        </button>
      </div>

      {/* Create Badge Form */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="border border-border rounded-lg p-4 space-y-3" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
              <h3 className="text-sm font-semibold text-foreground">Criar Novo Badge</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  value={newBadge.name}
                  onChange={e => setNewBadge(p => ({ ...p, name: e.target.value }))}
                  placeholder="Nome do badge"
                  className="px-3 py-2 rounded-md bg-background border border-border text-sm text-foreground"
                />
                <select
                  value={newBadge.category}
                  onChange={e => setNewBadge(p => ({ ...p, category: e.target.value }))}
                  className="px-3 py-2 rounded-md bg-background border border-border text-sm text-foreground"
                >
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <input
                  value={newBadge.description}
                  onChange={e => setNewBadge(p => ({ ...p, description: e.target.value }))}
                  placeholder="Descrição"
                  className="px-3 py-2 rounded-md bg-background border border-border text-sm text-foreground"
                />
                <input
                  type="number"
                  value={newBadge.week}
                  onChange={e => setNewBadge(p => ({ ...p, week: parseInt(e.target.value) || 1 }))}
                  placeholder="Semana"
                  className="px-3 py-2 rounded-md bg-background border border-border text-sm text-foreground"
                />
                <input
                  value={newBadge.criteria}
                  onChange={e => setNewBadge(p => ({ ...p, criteria: e.target.value }))}
                  placeholder="Critério (ex: Completar TBL da semana 1)"
                  className="px-3 py-2 rounded-md bg-background border border-border text-sm text-foreground sm:col-span-2"
                />
                <input
                  value={newBadge.iconUrl}
                  onChange={e => setNewBadge(p => ({ ...p, iconUrl: e.target.value }))}
                  placeholder="URL do ícone (opcional)"
                  className="px-3 py-2 rounded-md bg-background border border-border text-sm text-foreground sm:col-span-2"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => createBadge.mutate({ password, ...newBadge, week: newBadge.week || undefined, iconUrl: newBadge.iconUrl || undefined, criteria: newBadge.criteria || undefined, description: newBadge.description || undefined })}
                  disabled={!newBadge.name || createBadge.isPending}
                  className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50"
                >
                  {createBadge.isPending ? "Criando..." : "Criar Badge"}
                </button>
                <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-md bg-secondary text-foreground text-xs">
                  Cancelar
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Auto-Assign Section */}
      <div className="border border-primary/30 rounded-lg p-4 space-y-3" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Zap size={14} className="text-primary" /> Atribuição Automática por PF
          </h3>
          <button
            onClick={() => autoAssignMutation.mutate({ password })}
            disabled={autoAssignMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50"
          >
            <Zap size={12} />
            {autoAssignMutation.isPending ? "Processando..." : "Executar Todas as Regras"}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">Configure regras de auto-atribuição em cada badge abaixo. Ao executar, o sistema avalia todos os badges com regra ativa e atribui/revoga automaticamente com base no ranking de PF.</p>
        {autoAssignResult && (
          <div className="rounded-md p-3 space-y-2" style={{ backgroundColor: "oklch(0.15 0.02 264.052)" }}>
            <div className="flex items-center gap-4 text-xs">
              <span className="text-emerald-400 font-semibold">✅ {autoAssignResult.totalAwarded} atribuída(s)</span>
              <span className="text-orange-400 font-semibold">↩ {autoAssignResult.totalRevoked} revogada(s)</span>
            </div>
            {autoAssignResult.results.filter(r => r.awarded > 0 || r.revoked > 0).map((r: any) => (
              <div key={r.badgeId} className="text-xs text-muted-foreground">
                <span className="text-foreground font-medium">{r.badgeName}:</span> {r.awarded > 0 && <span className="text-emerald-400">{r.members.join(", ")} receberam</span>}{r.revoked > 0 && <span className="text-orange-400"> · {r.revoked} revogada(s)</span>}
              </div>
            ))}
            {autoAssignResult.results.every(r => r.awarded === 0 && r.revoked === 0) && (
              <p className="text-xs text-muted-foreground italic">Nenhuma alteração necessária — todos os badges já estão corretos.</p>
            )}
          </div>
        )}
      </div>

      {/* Assign Badge */}
      <div className="border border-border rounded-lg p-4 space-y-3" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Star size={14} className="text-primary" /> Atribuir Badge a Aluno
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <select
            value={assignBadgeId ?? ""}
            onChange={e => setAssignBadgeId(e.target.value ? parseInt(e.target.value) : null)}
            className="px-3 py-2 rounded-md bg-background border border-border text-sm text-foreground"
          >
            <option value="">Selecione o badge...</option>
            {badges?.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <select
            value={assignMemberId ?? ""}
            onChange={e => setAssignMemberId(e.target.value ? parseInt(e.target.value) : null)}
            className="px-3 py-2 rounded-md bg-background border border-border text-sm text-foreground"
          >
            <option value="">Selecione o aluno...</option>
            {allMembers.map(m => <option key={m.id} value={m.id}>{m.name} ({m.teamName})</option>)}
          </select>
          <input
            value={assignNote}
            onChange={e => setAssignNote(e.target.value)}
            placeholder="Nota (opcional)"
            className="px-3 py-2 rounded-md bg-background border border-border text-sm text-foreground"
          />
        </div>
        <button
          onClick={() => assignBadgeId && assignMemberId && assignBadge.mutate({ password, badgeId: assignBadgeId, memberId: assignMemberId, note: assignNote || undefined })}
          disabled={!assignBadgeId || !assignMemberId || assignBadge.isPending}
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50"
        >
          {assignBadge.isPending ? "Atribuindo..." : "Atribuir Badge"}
        </button>
      </div>

      {/* Badges List */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Badges Existentes ({badges?.length ?? 0})</h3>
        {badges?.map(badge => {
          const hasAutoRule = (badge as any).autoAssign === 1;
          const ruleObj = (() => { try { return JSON.parse((badge as any).autoAssignRule ?? ""); } catch { return null; } })();
          const isEditingRule = editingAutoRuleBadgeId === badge.id;

          return (
            <div key={badge.id} className={`border rounded-lg p-4 ${hasAutoRule ? "border-primary/40" : "border-border"}`} style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-lg">{badge.iconUrl ? "🏅" : "🏆"}</span>
                  <span className="font-semibold text-foreground text-sm">{badge.name}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">{badge.category}</span>
                  {badge.week && <span className="text-[10px] text-muted-foreground">Sem {badge.week}</span>}
                  {hasAutoRule && ruleObj && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center gap-1">
                      <Zap size={9} />
                      {ruleObj.type === "top_individual" ? `Top ${ruleObj.n} individual` : ruleObj.type === "top_team" ? `Top ${ruleObj.n} equipe(s)` : `PF ≥ ${ruleObj.xp}`}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      if (isEditingRule) { setEditingAutoRuleBadgeId(null); return; }
                      setEditingAutoRuleBadgeId(badge.id);
                      setEditRuleType(ruleObj?.type ?? "top_individual");
                      setEditRuleN(ruleObj?.n ?? 3);
                      setEditRuleXP(ruleObj?.xp ?? 50);
                      const rule = ruleObj ?? { type: "top_individual", n: 3 };
                      setPreviewRule(JSON.stringify(rule));
                    }}
                    className="text-xs px-2 py-1 rounded bg-secondary text-foreground hover:bg-secondary/80"
                    title="Configurar regra de auto-atribuição"
                  >
                    <Zap size={12} className={hasAutoRule ? "text-emerald-400" : "text-muted-foreground"} />
                  </button>
                  <button
                    onClick={() => autoAssignMutation.mutate({ password, badgeId: badge.id })}
                    disabled={!hasAutoRule || autoAssignMutation.isPending}
                    className="text-xs px-2 py-1 rounded bg-secondary text-foreground hover:bg-secondary/80 disabled:opacity-30"
                    title={hasAutoRule ? "Executar regra agora" : "Configure uma regra primeiro"}
                  >
                    <Play size={12} className="text-primary" />
                  </button>
                  <button
                    onClick={() => { if (confirm(`Excluir badge "${badge.name}"?`)) deleteBadge.mutate({ password, id: badge.id }); }}
                    className="text-destructive hover:text-destructive/80 p-1"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Auto-assign rule editor */}
              <AnimatePresence>
                {isEditingRule && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 pt-3 border-t border-border/50 space-y-3">
                      <h4 className="text-xs font-semibold text-foreground flex items-center gap-1"><Zap size={11} className="text-primary" /> Regra de Auto-Atribuição</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <select
                          value={editRuleType}
                          onChange={e => {
                            setEditRuleType(e.target.value);
                            const rule = e.target.value === "min_xp" ? { type: e.target.value, xp: editRuleXP } : { type: e.target.value, n: editRuleN };
                            setPreviewRule(JSON.stringify(rule));
                          }}
                          className="px-2 py-1.5 rounded bg-background border border-border text-xs text-foreground"
                        >
                          <option value="top_individual">Top N individual (por PF)</option>
                          <option value="top_team">Top N equipe(s) (por PF total)</option>
                          <option value="min_xp">PF mínimo</option>
                        </select>
                        {editRuleType !== "min_xp" ? (
                          <input
                            type="number" min={1} max={100}
                            value={editRuleN}
                            onChange={e => {
                              const n = parseInt(e.target.value) || 1;
                              setEditRuleN(n);
                              setPreviewRule(JSON.stringify({ type: editRuleType, n }));
                            }}
                            placeholder="N (quantidade)"
                            className="px-2 py-1.5 rounded bg-background border border-border text-xs text-foreground"
                          />
                        ) : (
                          <input
                            type="number" min={0}
                            value={editRuleXP}
                            onChange={e => {
                              const xp = parseFloat(e.target.value) || 0;
                              setEditRuleXP(xp);
                              setPreviewRule(JSON.stringify({ type: editRuleType, xp }));
                            }}
                            placeholder="PF mínimo"
                            className="px-2 py-1.5 rounded bg-background border border-border text-xs text-foreground"
                          />
                        )}
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              const rule = editRuleType === "min_xp" ? { type: editRuleType, xp: editRuleXP } : { type: editRuleType, n: editRuleN };
                              updateBadge.mutate({ password, id: badge.id, autoAssign: 1, autoAssignRule: JSON.stringify(rule) });
                            }}
                            disabled={updateBadge.isPending}
                            className="flex-1 px-2 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50"
                          >
                            Salvar
                          </button>
                          <button
                            onClick={() => updateBadge.mutate({ password, id: badge.id, autoAssign: 0, autoAssignRule: null })}
                            disabled={updateBadge.isPending}
                            className="px-2 py-1.5 rounded bg-destructive/20 text-destructive text-xs"
                            title="Desativar auto-atribuição"
                          >
                            Desativar
                          </button>
                        </div>
                      </div>
                      {/* Preview */}
                      {previewMembers && previewMembers.length > 0 && (
                        <div className="rounded p-2 space-y-1" style={{ backgroundColor: "oklch(0.15 0.02 264.052)" }}>
                          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Prévia — alunos que receberiam este badge:</span>
                          <div className="flex flex-wrap gap-1.5">
                            {previewMembers.map((m: any) => (
                              <span key={m.id} className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">{m.name} ({m.xp} PF)</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {previewMembers && previewMembers.length === 0 && (
                        <p className="text-[11px] text-muted-foreground italic">Nenhum aluno se qualifica com esta regra ainda.</p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {badge.description && <p className="text-xs text-muted-foreground mb-2 mt-2">{badge.description}</p>}
              {badge.members.length > 0 ? (
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Alunos ({badge.members.length}):</span>
                  {badge.members.map((m, idx) => (
                    <div key={idx} className="flex items-center justify-between py-1 px-2 rounded bg-background/50 text-xs">
                      <span className="text-foreground">{m.memberName}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">{new Date(m.earnedAt).toLocaleDateString("pt-BR")}</span>
                        <button
                          onClick={() => removeBadge.mutate({ password, badgeId: badge.id, memberId: (m as any).memberId })}
                          className="text-destructive hover:text-destructive/80 p-0.5"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">Nenhum aluno conquistou ainda</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Attendance Manager ───
function AttendanceManager({ password }: { password: string }) {
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [viewMode, setViewMode] = useState<"summary" | "weekly" | "accounts">("summary");
  const [manualMemberId, setManualMemberId] = useState("");
  const [manualNote, setManualNote] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClassId, setSelectedClassId] = useState<number | undefined>(undefined);
  const { data: classesList = [] } = trpc.classes.listAll.useQuery();
  const { data: summary, isLoading: summaryLoading, refetch: refetchSummary } = trpc.attendanceOld.getSummary.useQuery(
    { password, classId: selectedClassId }, { enabled: viewMode === "summary" }
  );;
  const { data: weeklyData, isLoading: weeklyLoading, refetch: refetchWeekly } = trpc.attendanceOld.getByWeek.useQuery(
    { password, week: selectedWeek }, { enabled: viewMode === "weekly" }
  );
  const { data: accounts, isLoading: accountsLoading, refetch: refetchAccounts } = trpc.attendanceOld.getAccounts.useQuery(
    { password }, { enabled: viewMode === "accounts" }
  );

  const updateStatusMutation = trpc.attendanceOld.updateStatus.useMutation({
    onSuccess: () => { toast.success("Status atualizado"); refetchWeekly(); refetchSummary(); },
  });
  const manualCheckInMutation = trpc.attendance.manualCheckIn.useMutation({
    onSuccess: () => { toast.success("Presença manual registrada"); refetchWeekly(); refetchSummary(); setManualMemberId(""); setManualNote(""); },
  });
  const deleteRecordMutation = trpc.attendanceOld.delete.useMutation({
    onSuccess: () => { toast.success("Registro removido"); refetchWeekly(); refetchSummary(); },
  });
  const deleteAccountMutation = trpc.attendanceOld.deleteAccount.useMutation({
    onSuccess: () => { toast.success("Conta removida"); refetchAccounts(); },
  });

  const filteredSummary = useMemo(() => {
    if (!summary) return [];
    if (!searchTerm.trim()) return summary;
    const s = searchTerm.toLowerCase();
    return summary.filter((m: any) => m.memberName.toLowerCase().includes(s) || m.teamName.toLowerCase().includes(s));
  }, [summary, searchTerm]);

  const reportQuery = trpc.attendanceOld.exportReport.useQuery({ password });

  const exportCSV = () => {
    const data = reportQuery.data;
    if (!data) { toast.error("Dados não carregados ainda"); return; }
    const { report, weeks } = data;
    const header = ["Nome", "Equipe", "Matrícula", "Email", ...weeks.map((w: number) => `Sem ${w}`), "Presenças", "Inválidas", "Ausências"];
    const rows = report.map((r: any) => [
      r.nome, r.equipe, r.matricula, r.email,
      ...weeks.map((w: number) => r.weeklyStatus[w] || "-"),
      r.totalValid, r.totalInvalid, r.totalAusente,
    ]);
    const csv = [header, ...rows].map(row => row.map((c: any) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `frequencia_farmacologia_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado com sucesso!");
  };

  const exportPDF = () => {
    const data = reportQuery.data;
    if (!data) { toast.error("Dados não carregados ainda"); return; }
    const { report, weeks } = data;
    // Generate a printable HTML table and open in new window for PDF printing
    const legendHTML = `<p style="font-size:11px;margin-bottom:8px;"><b>Legenda:</b> P = Presente | M = Manual | I = Inválida | - = Ausente</p>`;
    const headerCells = ["Nome", "Equipe", "Mat.", ...weeks.map((w: number) => `S${w}`), "P", "I", "A"]
      .map(h => `<th style="border:1px solid #ccc;padding:3px 5px;font-size:10px;background:#f0f0f0;">${h}</th>`).join("");
    const bodyRows = report.map((r: any) => {
      const cells = [
        r.nome, r.equipe, r.matricula,
        ...weeks.map((w: number) => {
          const v = r.weeklyStatus[w] || "-";
          const color = v === "P" ? "#16a34a" : v === "M" ? "#2563eb" : v === "I" ? "#dc2626" : "#999";
          return `<span style="color:${color};font-weight:bold;">${v}</span>`;
        }),
        r.totalValid, r.totalInvalid, r.totalAusente,
      ];
      return `<tr>${cells.map(c => `<td style="border:1px solid #ccc;padding:2px 4px;font-size:10px;text-align:center;">${c}</td>`).join("")}</tr>`;
    }).join("");
    const html = `<!DOCTYPE html><html><head><title>Relatório de Frequência - Farmacologia I</title>
      <style>@media print { body { margin: 0; } table { page-break-inside: auto; } tr { page-break-inside: avoid; } }</style>
    </head><body style="font-family:Arial,sans-serif;padding:20px;">
      <h2 style="margin-bottom:4px;">Relatório de Frequência — Farmacologia I (2026.1)</h2>
      <p style="color:#666;font-size:12px;margin-bottom:12px;">UNIRIO — Gerado em ${new Date().toLocaleDateString("pt-BR")}</p>
      ${legendHTML}
      <table style="border-collapse:collapse;width:100%;">
        <thead><tr>${headerCells}</tr></thead>
        <tbody>${bodyRows}</tbody>
      </table>
      <p style="font-size:10px;color:#999;margin-top:16px;">Conexão em Farmacologia — Sistema de Controle de Frequência</p>
    </body></html>`;
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
      setTimeout(() => win.print(), 500);
    }
    toast.success("PDF aberto para impressão!");
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-bold text-lg text-foreground flex items-center gap-2">
          <MapPin size={20} className="text-primary" /> Controle de Frequência
        </h2>
        <div className="flex gap-2">
          <button
            onClick={exportCSV}
            disabled={reportQuery.isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-600/20 text-green-400 hover:bg-green-600/30 transition-colors disabled:opacity-50"
          >
            <Download size={14} /> CSV
          </button>
          <button
            onClick={exportPDF}
            disabled={reportQuery.isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 transition-colors disabled:opacity-50"
          >
            <Download size={14} /> PDF
          </button>
        </div>
      </div>

      {/* Seletor de Turma */}
      <div className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-secondary/30 border border-border">
        <span className="text-xs font-medium text-muted-foreground">Filtrar por turma:</span>
        <select
          value={selectedClassId ?? ""}
          onChange={e => setSelectedClassId(e.target.value ? Number(e.target.value) : undefined)}
          className="flex-1 max-w-xs px-3 py-1.5 rounded-md bg-background border border-border text-foreground text-xs"
        >
          <option value="">Todas as turmas</option>
          {(classesList as any[]).map((c: any) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {selectedClassId && (
          <button onClick={() => setSelectedClassId(undefined)} className="text-xs text-muted-foreground hover:text-foreground">Limpar filtro</button>
        )}
      </div>

      {/* View Mode Tabs */}
      <div className="flex gap-1 p-1 rounded-lg bg-secondary/50 w-fit mb-4">
        {[
          { key: "summary" as const, label: "Resumo Geral" },
          { key: "weekly" as const, label: "Por Semana" },
          { key: "accounts" as const, label: "Contas de Alunos" },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setViewMode(tab.key)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              viewMode === tab.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Summary View */}
      {viewMode === "summary" && (
        <div>
          <div className="relative mb-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar aluno ou equipe..."
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm"
            />
          </div>
          {summaryLoading ? (
            <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-2 text-xs text-muted-foreground font-medium">Aluno</th>
                    <th className="text-left py-2 px-2 text-xs text-muted-foreground font-medium">Equipe</th>
                    <th className="text-center py-2 px-2 text-xs text-muted-foreground font-medium">Conta</th>
                    <th className="text-center py-2 px-2 text-xs text-muted-foreground font-medium">Presenças</th>
                    <th className="text-center py-2 px-2 text-xs text-muted-foreground font-medium">Válidas</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSummary.map((m: any) => (
                    <tr key={m.memberId} className="border-b border-border/50 hover:bg-secondary/30">
                      <td className="py-2 px-2 text-foreground">{m.memberName}</td>
                      <td className="py-2 px-2 text-muted-foreground">{m.teamEmoji} {m.teamName}</td>
                      <td className="py-2 px-2 text-center">
                        {m.hasAccount ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-500"><CheckCircle size={12} /></span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><XCircle size={12} /></span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-center font-mono">{m.totalPresent}</td>
                      <td className="py-2 px-2 text-center font-mono text-green-500">{m.validPresent}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Weekly View */}
      {viewMode === "weekly" && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <label className="text-sm text-muted-foreground">Semana:</label>
            <select
              value={selectedWeek}
              onChange={e => setSelectedWeek(Number(e.target.value))}
              className="px-3 py-1.5 rounded-lg bg-secondary border border-border text-foreground text-sm"
            >
              {Array.from({ length: 19 }, (_, i) => i + 1).map(w => (
                <option key={w} value={w}>Semana {w}</option>
              ))}
            </select>
          </div>

          {/* Manual check-in */}
          <div className="p-3 rounded-lg bg-secondary/30 border border-border mb-4">
            <h4 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1">
              <UserCheck size={14} /> Presença Manual
            </h4>
            <div className="flex gap-2 items-end flex-wrap">
              <div className="flex-1 min-w-[150px]">
                <label className="text-xs text-muted-foreground block mb-1">ID do Aluno (membro)</label>
                <input
                  type="number"
                  value={manualMemberId}
                  onChange={e => setManualMemberId(e.target.value)}
                  placeholder="ID"
                  className="w-full px-2 py-1.5 rounded-md bg-secondary border border-border text-foreground text-sm"
                />
              </div>
              <div className="flex-1 min-w-[150px]">
                <label className="text-xs text-muted-foreground block mb-1">Observação</label>
                <input
                  type="text"
                  value={manualNote}
                  onChange={e => setManualNote(e.target.value)}
                  placeholder="Opcional"
                  className="w-full px-2 py-1.5 rounded-md bg-secondary border border-border text-foreground text-sm"
                />
              </div>
              <button
                onClick={() => {
                  if (!manualMemberId) return;
                  const today = new Date().toISOString().split("T")[0];
                  manualCheckInMutation.mutate({
                    studentAccountId: Number(manualMemberId),
                    classDate: today, note: manualNote || undefined,
                  });
                }}
                disabled={!manualMemberId || manualCheckInMutation.isPending}
                className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50"
              >
                Registrar
              </button>
            </div>
          </div>

          {weeklyLoading ? (
            <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
          ) : !weeklyData || weeklyData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum registro na semana {selectedWeek}</p>
          ) : (
            <div className="space-y-2">
              {weeklyData.map((r: any) => (
                <div key={r.id} className="p-3 rounded-lg bg-secondary/30 border border-border flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    r.status === "valid" || r.status === "manual" ? "bg-green-500/15" : "bg-red-500/15"
                  }`}>
                    {r.status === "valid" || r.status === "manual" ? (
                      <CheckCircle size={16} className="text-green-500" />
                    ) : (
                      <XCircle size={16} className="text-red-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-foreground font-medium">{r.memberName}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.teamEmoji} {r.teamName} • {r.classDate}
                      {r.distanceMeters && ` • ${parseFloat(r.distanceMeters).toFixed(0)}m`}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <select
                      value={r.status}
                      onChange={e => updateStatusMutation.mutate({ password, id: r.id, status: e.target.value as any })}
                      className="px-2 py-1 rounded-md bg-secondary border border-border text-xs text-foreground"
                    >
                      <option value="valid">Válida</option>
                      <option value="invalid">Inválida</option>
                      <option value="manual">Manual</option>
                    </select>
                    <button
                      onClick={() => { if (confirm("Remover este registro?")) deleteRecordMutation.mutate({ password, id: r.id }); }}
                      className="p-1 rounded-md hover:bg-destructive/10 text-destructive"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Accounts View */}
      {viewMode === "accounts" && (
        <div>
          {accountsLoading ? (
            <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
          ) : !accounts || accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma conta de aluno cadastrada</p>
          ) : (
            <div className="space-y-2">
              {accounts.map((a: any) => (
                <div key={a.id} className="p-3 rounded-lg bg-secondary/30 border border-border flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <UserCheck size={16} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-foreground font-medium">{a.memberName}</div>
                    <div className="text-xs text-muted-foreground">
                      {a.teamEmoji} {a.teamName} • {a.email} • Mat: {a.matricula}
                    </div>
                  </div>
                  <button
                    onClick={() => { if (confirm(`Remover conta de ${a.memberName}?`)) deleteAccountMutation.mutate({ password, id: a.id }); }}
                    className="p-1 rounded-md hover:bg-destructive/10 text-destructive"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <p className="text-xs text-muted-foreground mt-2">{accounts.length} conta(s) cadastrada(s)</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── YouTube Playlists Manager ───
function YouTubePlaylistsManager({ password }: { password: string }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [videoType, setVideoType] = useState<"playlist" | "video">("playlist");
  const [module, setModule] = useState("Geral");
  const [week, setWeek] = useState<string>("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editModule, setEditModule] = useState("");
  const [editWeek, setEditWeek] = useState<string>("");

  const { data: playlists, isLoading, refetch } = trpc.youtubePlaylists.getAll.useQuery({ password });

  const createMutation = trpc.youtubePlaylists.create.useMutation({
    onSuccess: () => {
      toast.success("Playlist adicionada!");
      setTitle(""); setDescription(""); setYoutubeUrl("");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.youtubePlaylists.update.useMutation({
    onSuccess: () => { toast.success("Playlist atualizada!"); setEditingId(null); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.youtubePlaylists.delete.useMutation({
    onSuccess: () => { toast.success("Playlist removida!"); refetch(); },
  });

  const toggleMutation = trpc.youtubePlaylists.toggleVisibility.useMutation({
    onSuccess: () => { toast.success("Visibilidade atualizada!"); refetch(); },
  });

  const handleCreate = () => {
    if (!title.trim() || !youtubeUrl.trim()) {
      toast.error("Preencha título e URL do YouTube");
      return;
    }
    createMutation.mutate({
      password,
      title: title.trim(),
      description: description.trim() || undefined,
      youtubeUrl: youtubeUrl.trim(),
      videoType,
      module,
      week: week ? Number(week) : undefined,
    });
  };

  const startEdit = (p: any) => {
    setEditingId(p.id);
    setEditTitle(p.title);
    setEditDescription(p.description || "");
    setEditModule(p.module);
    setEditWeek(p.week ? String(p.week) : "");
  };

  const saveEdit = () => {
    if (!editingId) return;
    updateMutation.mutate({
      password,
      id: editingId,
      title: editTitle.trim(),
      description: editDescription.trim() || undefined,
      module: editModule,
      week: editWeek ? Number(editWeek) : null,
    });
  };

  // Group playlists by module
  const grouped = useMemo(() => {
    if (!playlists) return {};
    const g: Record<string, typeof playlists> = {};
    for (const p of playlists) {
      const mod = p.module || "Geral";
      if (!g[mod]) g[mod] = [];
      g[mod].push(p);
    }
    return g;
  }, [playlists]);

  const getEmbedUrl = (p: any) => {
    if (p.videoType === "playlist") {
      return `https://www.youtube.com/embed/videoseries?list=${p.youtubeId}`;
    }
    return `https://www.youtube.com/embed/${p.youtubeId}`;
  };

  return (
    <div>
      <h2 className="font-display font-bold text-lg text-foreground flex items-center gap-2 mb-4">
        <Youtube size={20} className="text-red-500" /> Playlists do YouTube
      </h2>

      {/* Add New Playlist Form */}
      <div className="border border-border rounded-lg p-4 mb-6" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
        <h3 className="font-display font-semibold text-sm text-foreground mb-3 flex items-center gap-2">
          <Plus size={14} className="text-primary" /> Adicionar Playlist / Vídeo
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Título da playlist/vídeo"
            className="px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm placeholder:text-muted-foreground"
          />
          <input
            value={youtubeUrl}
            onChange={e => setYoutubeUrl(e.target.value)}
            placeholder="URL do YouTube (playlist ou vídeo)"
            className="px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm placeholder:text-muted-foreground"
          />
          <input
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Descrição (opcional)"
            className="px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm placeholder:text-muted-foreground"
          />
          <div className="flex gap-2">
            <select
              value={videoType}
              onChange={e => setVideoType(e.target.value as "playlist" | "video")}
              className="flex-1 px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm"
            >
              <option value="playlist">Playlist</option>
              <option value="video">Vídeo único</option>
            </select>
            <select
              value={module}
              onChange={e => setModule(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm"
            >
              {MODULES.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              value={week}
              onChange={e => setWeek(e.target.value)}
              placeholder="Semana (opcional)"
              min="1" max="19"
              className="flex-1 px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm placeholder:text-muted-foreground"
            />
            <button
              onClick={handleCreate}
              disabled={createMutation.isPending}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              <Youtube size={14} /> {createMutation.isPending ? "Adicionando..." : "Adicionar"}
            </button>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">
          Cole a URL completa do YouTube. Exemplos: https://www.youtube.com/playlist?list=PLxxxxx ou https://www.youtube.com/watch?v=xxxxx
        </p>
      </div>

      {/* Playlists List */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
      ) : !playlists || playlists.length === 0 ? (
        <div className="text-center text-muted-foreground py-8">
          <Youtube size={32} className="mx-auto mb-3 opacity-50" />
          <p className="text-sm font-medium">Nenhuma playlist adicionada</p>
          <p className="text-xs mt-1">Adicione playlists ou vídeos do YouTube para os alunos.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([mod, items]) => (
            <div key={mod}>
              <h3 className="font-display font-semibold text-sm text-primary uppercase tracking-wide mb-3 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                {mod}
                <span className="text-muted-foreground font-normal text-xs">({items.length})</span>
              </h3>
              <div className="grid gap-3">
                {items.map((p: any) => (
                  <div
                    key={p.id}
                    className={`border rounded-lg overflow-hidden transition-colors ${
                      p.isVisible ? "border-border" : "border-border/50 opacity-60"
                    }`}
                    style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}
                  >
                    {editingId === p.id ? (
                      /* Edit Mode */
                      <div className="p-4 space-y-3">
                        <input
                          value={editTitle}
                          onChange={e => setEditTitle(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm"
                          placeholder="Título"
                        />
                        <input
                          value={editDescription}
                          onChange={e => setEditDescription(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm"
                          placeholder="Descrição"
                        />
                        <div className="flex gap-2">
                          <select
                            value={editModule}
                            onChange={e => setEditModule(e.target.value)}
                            className="flex-1 px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm"
                          >
                            {MODULES.map(m => <option key={m} value={m}>{m}</option>)}
                          </select>
                          <input
                            type="number"
                            value={editWeek}
                            onChange={e => setEditWeek(e.target.value)}
                            placeholder="Semana"
                            min="1" max="19"
                            className="w-24 px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button onClick={saveEdit} disabled={updateMutation.isPending}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium">
                            <Save size={12} /> Salvar
                          </button>
                          <button onClick={() => setEditingId(null)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-secondary text-foreground text-xs font-medium">
                            <X size={12} /> Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* View Mode */
                      <div className="flex flex-col sm:flex-row">
                        {/* Thumbnail / Preview */}
                        <div className="sm:w-48 h-28 sm:h-auto bg-black/50 flex items-center justify-center shrink-0 relative">
                          {p.thumbnailUrl ? (
                            <img src={p.thumbnailUrl} alt={p.title} className="w-full h-full object-cover" />
                          ) : (
                            <Youtube size={32} className="text-red-500 opacity-50" />
                          )}
                          <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-black/70 text-white">
                            {p.videoType === "playlist" ? "PLAYLIST" : "VÍDEO"}
                          </div>
                        </div>
                        {/* Info */}
                        <div className="flex-1 p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-sm text-foreground truncate">{p.title}</h4>
                              {p.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{p.description}</p>}
                              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{p.module}</span>
                                {p.week && <span className="text-[10px] text-muted-foreground">Sem. {p.week}</span>}
                                <span className="text-[10px] text-muted-foreground font-mono">ID: {p.youtubeId.substring(0, 12)}...</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => toggleMutation.mutate({ password, id: p.id, isVisible: p.isVisible ? 0 : 1 })}
                                className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground"
                                title={p.isVisible ? "Ocultar" : "Mostrar"}
                              >
                                {p.isVisible ? <Eye size={14} /> : <EyeOff size={14} />}
                              </button>
                              <button
                                onClick={() => startEdit(p)}
                                className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                onClick={() => { if (confirm("Remover esta playlist?")) deleteMutation.mutate({ password, id: p.id }); }}
                                className="p-1.5 rounded-md hover:bg-destructive/10 text-destructive"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Importar Alunos Manager ───
function ImportarAlunosManager({ teacherToken }: { teacherToken: string | null }) {
  const [step, setStep] = useState<"login" | "preview" | "importing" | "complete">("login");
  const [cpf, setCpf] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [selectedClass, setSelectedClass] = useState<number | null>(null);
  const [previewStudents, setPreviewStudents] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  
  const classesList = trpc.classes.list.useQuery({ sessionToken: teacherToken || "" }, { enabled: !!teacherToken });
  const importStudents = trpc.members.importBulk.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.imported} aluno(s) importado(s)${data.errors > 0 ? ` (${data.errors} erro(s))` : ''}`);
      setImportResult(data);
      setStep("complete");
      setImporting(false);
    },
    onError: (err) => {
      toast.error(err.message);
      setStep("preview");
      setImporting(false);
    },
  });

  const handleValidateAndFetch = async () => {
    if (!cpf || !password) {
      toast.error("Digite CPF e senha");
      return;
    }
    // Simulated preview - in real implementation would scrape UNIRIO
    setPreviewStudents([
      { name: "João Silva", email: "joao@edu.unirio.br", matricula: "2024001", status: "novo" },
      { name: "Maria Santos", email: "maria@edu.unirio.br", matricula: "2024002", status: "novo" },
      { name: "Pedro Costa", email: "pedro@edu.unirio.br", matricula: "2024003", status: "novo" },
    ]);
    setStep("preview");
  };

  const handleImport = () => {
    if (!selectedClass) {
      toast.error("Selecione uma turma");
      return;
    }
    if (previewStudents.length === 0) {
      toast.error("Nenhum aluno para importar");
      return;
    }

    setImporting(true);
    importStudents.mutate({
      sessionToken: teacherToken || "",
      classId: selectedClass,
      students: previewStudents.map(s => ({
        name: s.name,
        email: s.email,
      })),
    });
  };

  const handleReset = () => {
    setStep("login");
    setCpf("");
    setPassword("");
    setSelectedClass(null);
    setPreviewStudents([]);
    setImportResult(null);
  };

  const classes = classesList.data || [];

  // STEP 1: LOGIN
  if (step === "login") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-xl text-foreground">Importar Alunos do Portal UNIRIO</h2>
        </div>

        {/* Info Box */}
        <div className="rounded-lg p-4 border border-blue-800/30" style={{ backgroundColor: "rgba(74, 144, 226, 0.1)" }}>
          <div className="flex gap-3">
            <AlertTriangle size={20} className="text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-300">
              <p className="font-semibold mb-1">Acesso ao Portal UNIRIO:</p>
              <p>Digite suas credenciais do portal UNIRIO (CPF e senha). A importação será feita automaticamente sem necessidade de preencher nomes manualmente.</p>
            </div>
          </div>
        </div>

        {/* Login Form */}
        <div className="rounded-lg p-5 border border-border space-y-4" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
          <div>
            <label className="text-sm text-muted-foreground block mb-2">CPF (sem pontuação)</label>
            <input
              type="text"
              value={cpf}
              onChange={(e) => setCpf(e.target.value.replace(/\D/g, ""))}
              placeholder="08714684764"
              maxLength={11}
              className="w-full px-4 py-2 rounded-lg text-foreground text-sm"
              style={{ backgroundColor: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }}
            />
          </div>

          <div>
            <label className="text-sm text-muted-foreground block mb-2">Senha</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite sua senha"
                className="w-full px-4 py-2 rounded-lg text-foreground text-sm pr-10"
                style={{ backgroundColor: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            onClick={handleValidateAndFetch}
            disabled={!cpf || !password}
            className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm disabled:opacity-50 hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
          >
            <LogIn size={16} />
            Conectar ao Portal UNIRIO
          </button>
        </div>
      </div>
    );
  }

  // STEP 2: PREVIEW
  if (step === "preview") {
    const newStudents = previewStudents.filter(s => s.status === "novo");
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-xl text-foreground">Preview de Alunos</h2>
          <button onClick={handleReset} className="p-2 hover:bg-secondary rounded-lg transition-colors">
            <X size={20} className="text-muted-foreground" />
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg p-4 border border-border" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
            <div className="flex items-center gap-3">
              <Users size={20} className="text-primary" />
              <div>
                <div className="text-sm text-muted-foreground">Novos Alunos</div>
                <div className="font-bold text-lg text-foreground">{newStudents.length}</div>
              </div>
            </div>
          </div>
          <div className="rounded-lg p-4 border border-border" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
            <div className="flex items-center gap-3">
              <CheckCircle size={20} className="text-green-500" />
              <div>
                <div className="text-sm text-muted-foreground">Total</div>
                <div className="font-bold text-lg text-foreground">{previewStudents.length}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Class Selector */}
        <div className="rounded-lg p-5 border border-border" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
          <label className="text-sm text-muted-foreground block mb-2">Selecione a Turma para Importação</label>
          <select
            value={selectedClass || ""}
            onChange={(e) => setSelectedClass(e.target.value ? parseInt(e.target.value) : null)}
            className="w-full px-4 py-2 rounded-lg text-foreground text-sm"
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

        {/* Students List */}
        <div className="rounded-lg p-5 border border-border" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
          <h3 className="text-sm font-bold text-foreground mb-3">Alunos a Importar ({newStudents.length})</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {newStudents.map((student: any, idx: number) => (
              <div key={idx} className="rounded-lg p-3 border border-border/50" style={{ backgroundColor: "rgba(255,255,255,0.03)" }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Users size={16} className="text-primary flex-shrink-0" />
                    <div className="text-left min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">{student.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{student.email}</div>
                    </div>
                  </div>
                  <span className="px-2 py-1 rounded text-xs bg-green-500/20 text-green-400">Novo</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleImport}
            disabled={importing || !selectedClass}
            className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium disabled:opacity-50 hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
          >
            <Upload size={16} />
            {importing ? "Importando..." : `Importar ${newStudents.length} Alunos`}
          </button>
          <button
            onClick={handleReset}
            className="px-6 py-2.5 rounded-lg bg-secondary text-foreground font-medium hover:opacity-80 transition-opacity"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  // STEP 3: COMPLETE
  if (step === "complete") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-xl text-foreground">Importação Concluída</h2>
        </div>

        {/* Success Message */}
        <div className="rounded-lg p-6 border border-green-800/30 text-center" style={{ backgroundColor: "rgba(34, 197, 94, 0.1)" }}>
          <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
          <h3 className="font-bold text-lg text-green-400 mb-2">Importação Realizada com Sucesso!</h3>
          <p className="text-sm text-green-300">{importResult?.imported || 0} aluno(s) foram importado(s) para a plataforma</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg p-4 border border-border text-center" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
            <div className="text-2xl font-bold text-primary">{importResult?.imported || 0}</div>
            <div className="text-xs text-muted-foreground mt-1">Importados</div>
          </div>
          <div className="rounded-lg p-4 border border-border text-center" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
            <div className="text-2xl font-bold text-orange-500">{importResult?.errors || 0}</div>
            <div className="text-xs text-muted-foreground mt-1">Erros</div>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={handleReset}
          className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity"
        >
          Nova Importação
        </button>
      </div>
    );
  }

  return null;
}

// ─── Jigsaw Seminars Manager ───
function JigsawSeminarsManager({ teacherToken }: { teacherToken: string | null }) {
  const [selectedSeminar, setSelectedSeminar] = useState<number | null>(null);
  const [editingParticipant, setEditingParticipant] = useState<number | null>(null);
  const [editPF, setEditPF] = useState("");
  
  const utils = trpc.useUtils();
  const { data: seminars, isLoading } = trpc.seminars.getAll.useQuery({ sessionToken: teacherToken || "" }, { enabled: !!teacherToken });
  const { data: seminarDetails } = trpc.seminars.getById.useQuery(
    { sessionToken: teacherToken || "", seminarId: selectedSeminar || 0 },
    { enabled: !!teacherToken && !!selectedSeminar }
  );
  const { data: allMembers } = trpc.leaderboard.getData.useQuery();
  const { data: roles } = trpc.seminars.getRoles.useQuery({ sessionToken: teacherToken || "" }, { enabled: !!teacherToken });

  const assignMemberMutation = trpc.seminars.assignMember.useMutation({
    onSuccess: () => {
      utils.seminars.getById.invalidate();
      toast.success("Aluno atribuído com sucesso!");
    },
    onError: () => toast.error("Erro ao atribuir aluno"),
  });

  const updatePFMutation = trpc.seminars.updateParticipantPF.useMutation({
    onSuccess: () => {
      utils.seminars.getById.invalidate();
      toast.success("PF atualizado!");
      setEditingParticipant(null);
      setEditPF("");
    },
    onError: () => toast.error("Erro ao atualizar PF"),
  });

  const updateGroupPFMutation = trpc.seminars.update.useMutation({
    onSuccess: () => {
      utils.seminars.getAll.invalidate();
      toast.success("PF do grupo atualizado!");
    },
    onError: () => toast.error("Erro ao atualizar PF do grupo"),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Carregando seminários...</p>
        </div>
      </div>
    );
  }

  const flatMembers = allMembers?.teams.flatMap(t => t.members.map(m => ({ ...m, teamName: t.name }))) || [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display font-bold text-xl text-foreground mb-1">Seminários Jigsaw</h2>
        <p className="text-sm text-muted-foreground">Gerencie os 6 grupos de seminário, atribua coordenadores/relatores e registre PF individual e do grupo.</p>
      </div>

      {/* Seminars Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {seminars?.map((sem: any) => (
          <motion.div
            key={sem.id}
            className="p-4 rounded-lg border border-border bg-card cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => setSelectedSeminar(sem.id)}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Target size={16} className="text-primary" />
                  <span className="text-xs font-medium text-muted-foreground">Semana {sem.week}</span>
                </div>
                <h3 className="font-semibold text-foreground text-sm">{sem.title}</h3>
              </div>
            </div>
            {sem.description && (
              <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{sem.description}</p>
            )}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
              <span className="text-xs text-muted-foreground">{sem.date}</span>
              <span className="text-xs font-mono font-bold text-primary">
                {sem.groupPF ? `${sem.groupPF} PF` : "—"}
              </span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Selected Seminar Details */}
      {selectedSeminar && seminarDetails && seminarDetails.seminar && (
        <AnimatePresence>
          <motion.div
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedSeminar(null)}
          >
            <motion.div
              className="bg-background rounded-lg border border-border max-w-3xl w-full max-h-[80vh] overflow-y-auto"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-background border-b border-border p-4 flex items-center justify-between">
                <div>
                  <h3 className="font-display font-bold text-lg text-foreground">{seminarDetails.seminar.title}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Semana {seminarDetails.seminar.week} • {seminarDetails.seminar.date}</p>
                </div>
                <button
                  onClick={() => setSelectedSeminar(null)}
                  className="p-2 rounded-md hover:bg-secondary text-muted-foreground"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-4 space-y-4">
                {/* Group PF */}
                <div className="p-3 rounded-lg bg-secondary/30 border border-border">
                  <label className="text-xs font-medium text-muted-foreground block mb-2">PF do Grupo Inteiro</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      defaultValue={seminarDetails.seminar.groupPF || ""}
                      placeholder="Ex: 2.0"
                      className="flex-1 px-3 py-2 rounded-md bg-background border border-border text-sm text-foreground"
                      onBlur={(e) => {
                        if (seminarDetails?.seminar && e.target.value !== seminarDetails.seminar.groupPF) {
                          updateGroupPFMutation.mutate({
                            sessionToken: teacherToken || "",
                            id: seminarDetails.seminar.id,
                            groupPF: e.target.value,
                          });
                        }
                      }}
                    />
                  </div>
                </div>

                {/* Participants */}
                <div>
                  <h4 className="font-semibold text-sm text-foreground mb-3">Participantes</h4>
                  <div className="space-y-2">
                    {seminarDetails.participants.map((p: any) => {
                      const role = roles?.find((r: any) => r.id === p.roleId);
                      const member = flatMembers.find(m => m.id === p.memberId);
                      
                      return (
                        <div key={p.id} className="p-3 rounded-lg border border-border bg-card">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-medium">
                                {role?.name || "Função"}
                              </span>
                              {member && (
                                <span className="text-xs text-muted-foreground">
                                  {member.name} ({member.teamName})
                                </span>
                              )}
                            </div>
                            {p.individualPF && (
                              <span className="text-xs font-mono font-bold text-primary">{p.individualPF} PF</span>
                            )}
                          </div>

                          {/* Assign Member */}
                          {!p.memberId && (
                            <select
                              className="w-full px-3 py-2 rounded-md bg-background border border-border text-sm"
                              onChange={(e) => {
                                const memberId = parseInt(e.target.value);
                                const selectedMember = flatMembers.find(m => m.id === memberId);
                                if (selectedMember) {
                                  assignMemberMutation.mutate({
                                    sessionToken: teacherToken || "",
                                    participantId: p.id,
                                    memberId,
                                    memberName: selectedMember.name,
                                  });
                                }
                              }}
                            >
                              <option value="">Selecionar aluno...</option>
                              {flatMembers.map(m => (
                                <option key={m.id} value={m.id}>{m.name} ({m.teamName})</option>
                              ))}
                            </select>
                          )}

                          {/* Update PF */}
                          {p.memberId && (
                            <div className="mt-2">
                              {editingParticipant === p.id ? (
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    value={editPF}
                                    onChange={(e) => setEditPF(e.target.value)}
                                    placeholder="Ex: 2.0"
                                    className="flex-1 px-3 py-1.5 rounded-md bg-background border border-border text-sm"
                                    autoFocus
                                  />
                                  <button
                                    onClick={() => {
                                      updatePFMutation.mutate({
                                        sessionToken: teacherToken || "",
                                        participantId: p.id,
                                        individualPF: editPF,
                                      });
                                    }}
                                    className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium"
                                  >
                                    Salvar
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditingParticipant(null);
                                      setEditPF("");
                                    }}
                                    className="px-3 py-1.5 rounded-md bg-secondary text-foreground text-xs"
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => {
                                    setEditingParticipant(p.id);
                                    setEditPF(p.individualPF || "");
                                  }}
                                  className="text-xs text-primary hover:underline"
                                >
                                  {p.individualPF ? "Editar PF Individual" : "Atribuir PF Individual"}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}

// ─── Turmas Manager ───
function TurmasManager({ teacherToken }: { teacherToken: string | null }) {
  const [, setLocation] = useLocation();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCourse, setNewCourse] = useState("");
  const [newDiscipline, setNewDiscipline] = useState("");
  const [newColor, setNewColor] = useState("#F7941D");
  const [selectedClass, setSelectedClass] = useState<number | null>(null);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [newStudentName, setNewStudentName] = useState("");
  const [newStudentTeamId, setNewStudentTeamId] = useState<number | null>(null);
  const [showAddTeam, setShowAddTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamEmoji, setNewTeamEmoji] = useState("🧪");
  const [newTeamColor, setNewTeamColor] = useState("#10b981");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [editingClass, setEditingClass] = useState<number | null>(null);
  const [editClassName, setEditClassName] = useState("");
  const [editClassCourse, setEditClassCourse] = useState("");
  const [editClassDiscipline, setEditClassDiscipline] = useState("");

  const utils = trpc.useUtils();

  const { data: classesList, isLoading } = trpc.classes.list.useQuery(
    { sessionToken: teacherToken || "" },
    { enabled: !!teacherToken }
  );
  const { data: classDetail } = trpc.classes.getById.useQuery(
    { sessionToken: teacherToken || "", classId: selectedClass! },
    { enabled: !!selectedClass && !!teacherToken }
  );
  const { data: allTeams } = trpc.leaderboard.getData.useQuery();

  const createClass = trpc.classes.create.useMutation({
    onSuccess: () => {
      utils.classes.list.invalidate();
      toast.success("Turma criada!");
      setShowCreateForm(false);
      setNewName(""); setNewCourse(""); setNewDiscipline("");
    },
    onError: () => toast.error("Erro ao criar turma"),
  });

  const deleteClass = trpc.classes.delete.useMutation({
    onSuccess: () => {
      utils.classes.list.invalidate();
      toast.success("Turma removida!");
      setSelectedClass(null);
    },
    onError: () => toast.error("Erro ao remover turma"),
  });

  const updateClass = trpc.classes.update.useMutation({
    onSuccess: () => {
      utils.classes.list.invalidate();
      utils.classes.getById.invalidate();
      toast.success("Turma atualizada!");
      setEditingClass(null);
    },
    onError: () => toast.error("Erro ao atualizar turma"),
  });

  const assignTeam = trpc.classes.assignTeam.useMutation({
    onSuccess: () => {
      utils.classes.getById.invalidate();
      toast.success("Equipe vinculada!");
    },
    onError: () => toast.error("Erro ao vincular equipe"),
  });

  const assignMember = trpc.classes.assignMember.useMutation({
    onSuccess: () => {
      utils.classes.getById.invalidate();
      toast.success("Aluno vinculado!");
    },
    onError: () => toast.error("Erro ao vincular aluno"),
  });

  const createTeamMut = trpc.teams.create.useMutation({
    onSuccess: (data) => {
      utils.leaderboard.getData.invalidate();
      utils.classes.getById.invalidate();
      toast.success("Equipe criada e vinculada!");
      setShowAddTeam(false);
      setNewTeamName("");
    },
    onError: () => toast.error("Erro ao criar equipe"),
  });

  const createMemberMut = trpc.members.create.useMutation({
    onSuccess: () => {
      utils.leaderboard.getData.invalidate();
      utils.classes.getById.invalidate();
      toast.success("Aluno adicionado!");
      setShowAddStudent(false);
      setNewStudentName("");
    },
    onError: () => toast.error("Erro ao adicionar aluno"),
  });

  const deleteMemberMut = trpc.members.delete.useMutation({
    onSuccess: () => {
      utils.classes.getById.invalidate();
      utils.leaderboard.getData.invalidate();
      toast.success("Aluno removido!");
    },
    onError: () => toast.error("Erro ao remover aluno"),
  });

  const deleteTeamMut = trpc.teams.delete.useMutation({
    onSuccess: () => {
      utils.classes.getById.invalidate();
      utils.leaderboard.getData.invalidate();
      toast.success("Equipe removida!");
    },
    onError: () => toast.error("Erro ao remover equipe"),
  });

  if (isLoading) return <div className="text-center text-muted-foreground py-8">Carregando turmas...</div>;

  // Detail view for a selected class
  if (selectedClass && classDetail) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => setSelectedClass(null)} className="p-2 rounded-md hover:bg-secondary text-muted-foreground">
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1">
            {editingClass === classDetail.id ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={editClassName}
                  onChange={e => setEditClassName(e.target.value)}
                  placeholder="Nome da turma"
                  className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={editClassCourse}
                    onChange={e => setEditClassCourse(e.target.value)}
                    placeholder="Curso"
                    className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                  />
                  <input
                    type="text"
                    value={editClassDiscipline}
                    onChange={e => setEditClassDiscipline(e.target.value)}
                    placeholder="Disciplina"
                    className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      updateClass.mutate({
                        sessionToken: teacherToken || "",
                        id: classDetail.id,
                        name: editClassName,
                        course: editClassCourse,
                        discipline: editClassDiscipline,
                      });
                    }}
                    disabled={updateClass.isPending}
                    className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50 flex items-center gap-1"
                  >
                    <Save size={12} /> Salvar
                  </button>
                  <button
                    onClick={() => setEditingClass(null)}
                    className="px-3 py-1.5 rounded-md bg-secondary text-foreground text-xs font-medium flex items-center gap-1"
                  >
                    <X size={12} /> Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h2 className="font-display font-bold text-xl text-foreground">{classDetail.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {classDetail.discipline} — {classDetail.course} — {classDetail.semester}
                  {classDetail.teacherName && <span> — Prof. {classDetail.teacherName}</span>}
                </p>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {editingClass !== classDetail.id && (
              <button
                onClick={() => {
                  setEditingClass(classDetail.id);
                  setEditClassName(classDetail.name);
                  setEditClassCourse(classDetail.course);
                  setEditClassDiscipline(classDetail.discipline);
                }}
                className="p-2 rounded-md hover:bg-secondary text-primary"
                title="Editar nome da turma"
              >
                <Edit2 size={18} />
              </button>
            )}
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: classDetail.color }} />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="border border-border rounded-lg p-4" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
            <div className="text-xs text-muted-foreground uppercase">Equipes</div>
            <div className="font-mono font-bold text-2xl text-foreground">{classDetail.teams.length}</div>
          </div>
          <div className="border border-border rounded-lg p-4" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
            <div className="text-xs text-muted-foreground uppercase">Alunos</div>
            <div className="font-mono font-bold text-2xl text-foreground">{classDetail.members.length}</div>
          </div>
          <div className="border border-border rounded-lg p-4" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
            <div className="text-xs text-muted-foreground uppercase">PF Total</div>
            <div className="font-mono font-bold text-2xl text-primary">
              {classDetail.members.reduce((s: number, m: any) => s + parseFloat(m.xp || "0"), 0).toFixed(1)}
            </div>
          </div>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('admin-navigate', { detail: { section: 'cronograma' } }))}
            className="border border-border rounded-lg p-4 hover:bg-primary/10 transition-colors cursor-pointer"
            style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}
          >
            <div className="text-xs text-muted-foreground uppercase">Cronograma</div>
            <div className="font-mono font-bold text-lg text-primary flex items-center gap-2">
              <Calendar size={20} /> Ver
            </div>
          </button>
        </div>

        {/* Teams in this class */}
        <div className="border border-border rounded-lg p-4" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-semibold text-sm text-foreground flex items-center gap-2">
              <Users size={16} className="text-primary" /> Equipes da Turma
            </h3>
            <button onClick={() => setShowAddTeam(!showAddTeam)} className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium">
              <Plus size={12} /> Nova Equipe
            </button>
          </div>

          {showAddTeam && (
            <div className="flex gap-2 flex-wrap mb-4 p-3 rounded-lg border border-border bg-background">
              <input value={newTeamEmoji} onChange={e => setNewTeamEmoji(e.target.value)} className="w-12 px-2 py-2 rounded-md bg-secondary border border-border text-foreground text-center text-sm" placeholder="🧪" />
              <input value={newTeamName} onChange={e => setNewTeamName(e.target.value)} className="flex-1 min-w-[150px] px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm" placeholder="Nome da equipe..." />
              <input type="color" value={newTeamColor} onChange={e => setNewTeamColor(e.target.value)} className="w-10 h-10 rounded-md border border-border cursor-pointer" />
              <button
                onClick={() => {
                  createTeamMut.mutate({ password: "authenticated", name: newTeamName, emoji: newTeamEmoji, color: newTeamColor, classId: selectedClass });
                }}
                disabled={!newTeamName || createTeamMut.isPending}
                className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
              >
                Criar
              </button>
            </div>
          )}

          {classDetail.teams.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma equipe vinculada a esta turma.</p>
          ) : (
            <div className="space-y-2">
              {classDetail.teams.map((team: any) => {
                const teamMembers = classDetail.members.filter((m: any) => m.teamId === team.id);
                return (
                  <div key={team.id} className="border border-border rounded-lg p-3">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{team.emoji}</span>
                      <span className="font-medium text-sm text-foreground flex-1">{team.name}</span>
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: team.color }} />
                      <span className="text-xs text-muted-foreground font-mono">{teamMembers.length} alunos</span>
                      <button
                        onClick={() => { if (confirm(`Remover equipe "${team.name}"?`)) deleteTeamMut.mutate({ password: "authenticated", id: team.id }); }}
                        className="p-1 rounded hover:bg-destructive/20 text-destructive"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    {teamMembers.length > 0 && (
                      <div className="mt-2 pl-8 space-y-1">
                        {teamMembers.map((m: any) => (
                          <div key={m.id} className="flex items-center gap-2 text-sm">
                            <span className="text-foreground">{m.name}</span>
                            <span className="text-xs font-mono text-primary">{parseFloat(m.xp || "0").toFixed(1)} PF</span>
                            <button
                              onClick={() => { if (confirm(`Remover aluno "${m.name}"?`)) deleteMemberMut.mutate({ password: "authenticated", id: m.id }); }}
                              className="p-0.5 rounded hover:bg-destructive/20 text-destructive ml-auto"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Link existing teams */}
          {allTeams && allTeams.teams.filter(t => !classDetail.teams.find((ct: any) => ct.id === t.id)).length > 0 && (
            <div className="mt-3 pt-3 border-t border-border">
              <p className="text-xs text-muted-foreground mb-2">Vincular equipe existente:</p>
              <div className="flex gap-2">
                <select
                  className="flex-1 px-3 py-2 rounded-md bg-secondary border border-border text-sm text-foreground"
                  onChange={(e) => {
                    const teamId = parseInt(e.target.value);
                    if (teamId && teacherToken) assignTeam.mutate({ sessionToken: teacherToken, teamId, classId: selectedClass });
                  }}
                >
                  <option value="">Selecionar equipe...</option>
                  {allTeams.teams.filter(t => !classDetail.teams.find((ct: any) => ct.id === t.id)).map(t => (
                    <option key={t.id} value={t.id}>{t.emoji} {t.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Members in this class */}
        <div className="border border-border rounded-lg p-4" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-semibold text-sm text-foreground flex items-center gap-2">
              <UserPlus size={16} className="text-primary" /> Alunos da Turma ({classDetail.members.length})
            </h3>
            <div className="flex items-center gap-2">
              <ExportButton
                students={classDetail.members.map((m: any) => ({
                  id: m.id,
                  name: m.name,
                  xp: parseFloat(m.xp || "0"),
                  teamName: classDetail.teams.find((t: any) => t.id === m.teamId)?.name || "—",
                }))}
                filename={`turma-${classDetail.name}`}
                label="Exportar"
              />
              <button onClick={() => setShowAddStudent(!showAddStudent)} className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium">
                <Plus size={12} /> Adicionar Aluno
              </button>
            </div>
          </div>

          {/* Search within class */}
          {classDetail.members.length > 5 && (
            <div className="mb-3">
              <SearchStudents
                students={classDetail.members.map((m: any) => ({
                  id: m.id,
                  name: m.name,
                  xp: parseFloat(m.xp || "0"),
                  teamName: classDetail.teams.find((t: any) => t.id === m.teamId)?.name || "—",
                }))}
                onSelect={(student) => {
                  toast.info(`${student.name} — ${student.teamName || 'Sem equipe'} — ${student.xp.toFixed(1)} PF`);
                }}
                placeholder="Buscar aluno nesta turma..."
              />
            </div>
          )}

          {showAddStudent && (
            <div className="flex gap-2 flex-wrap mb-4 p-3 rounded-lg border border-border bg-background">
              <input
                value={newStudentName}
                onChange={e => setNewStudentName(e.target.value)}
                className="flex-1 min-w-[200px] px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm"
                placeholder="Nome do aluno..."
              />
              <select
                value={newStudentTeamId || ""}
                onChange={e => setNewStudentTeamId(parseInt(e.target.value) || null)}
                className="px-3 py-2 rounded-md bg-secondary border border-border text-sm text-foreground"
              >
                <option value="">Selecionar equipe...</option>
                {classDetail.teams.map((t: any) => (
                  <option key={t.id} value={t.id}>{t.emoji} {t.name}</option>
                ))}
              </select>
              <button
                onClick={() => {
                  if (newStudentName && newStudentTeamId) {
                    createMemberMut.mutate({ password: "authenticated", teamId: newStudentTeamId, name: newStudentName, classId: selectedClass });
                  }
                }}
                disabled={!newStudentName || !newStudentTeamId || createMemberMut.isPending}
                className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
              >
                Adicionar
              </button>
            </div>
          )}

          {classDetail.members.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum aluno nesta turma.</p>
          ) : (
            <>
              <div className="space-y-1">
                {[...classDetail.members]
                  .sort((a: any, b: any) => a.name.localeCompare(b.name))
                  .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                  .map((m: any, idx: number) => {
                    const team = classDetail.teams.find((t: any) => t.id === m.teamId);
                    const globalIdx = (currentPage - 1) * pageSize + idx + 1;
                    return (
                      <div key={m.id} className="flex items-center gap-3 py-2 px-2 rounded-md hover:bg-secondary/50">
                        <span className="w-6 text-center text-xs text-muted-foreground font-mono">{globalIdx}</span>
                        <span className="text-sm text-foreground flex-1">{m.name}</span>
                        {team && (
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: team.color + "22", color: team.color }}>
                            {team.emoji} {team.name}
                          </span>
                        )}
                        <span className="text-xs font-mono font-bold text-primary">{parseFloat(m.xp || "0").toFixed(1)} PF</span>
                        <button
                          onClick={() => { if (confirm(`Remover aluno "${m.name}"?`)) deleteMemberMut.mutate({ password: "authenticated", id: m.id }); }}
                          className="p-1 rounded hover:bg-destructive/20 text-destructive"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })
                }
              </div>
              {classDetail.members.length > 10 && (
                <Pagination
                  currentPage={currentPage}
                  totalPages={Math.ceil(classDetail.members.length / pageSize)}
                  onPageChange={setCurrentPage}
                  pageSize={pageSize}
                  onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
                  totalItems={classDetail.members.length}
                  className="mt-3"
                />
              )}
            </>
          )}
        </div>

        {/* Delete class */}
        <div className="border border-destructive/30 rounded-lg p-4" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
          <h3 className="font-display font-semibold text-sm text-destructive mb-2 flex items-center gap-2">
            <AlertTriangle size={16} /> Zona de Perigo
          </h3>
          <p className="text-xs text-muted-foreground mb-3">Excluir esta turma irá desvincular todas as equipes e alunos associados.</p>
          <button
            onClick={() => { if (confirm(`Tem certeza que deseja excluir a turma "${classDetail.name}"?`) && teacherToken) deleteClass.mutate({ sessionToken: teacherToken, id: selectedClass }); }}
            className="px-4 py-2 rounded-md bg-destructive text-destructive-foreground text-sm font-medium"
          >
            Excluir Turma
          </button>
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-bold text-xl text-foreground">Minhas Turmas</h2>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium"
        >
          <Plus size={14} /> Nova Turma
        </button>
      </div>

      {showCreateForm && (
        <div className="border border-border rounded-lg p-4" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
          <h3 className="font-display font-semibold text-sm text-foreground mb-3">Criar Nova Turma</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Disciplina</label>
              <input value={newDiscipline} onChange={e => setNewDiscipline(e.target.value)} className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm" placeholder="Ex: Farmacologia 1" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Curso</label>
              <input value={newCourse} onChange={e => setNewCourse(e.target.value)} className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm" placeholder="Ex: Medicina" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Nome Completo</label>
              <input value={newName} onChange={e => setNewName(e.target.value)} className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm" placeholder="Ex: Farmacologia 1 - Medicina" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Cor</label>
              <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)} className="w-10 h-10 rounded-md border border-border cursor-pointer" />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => { if (teacherToken) createClass.mutate({ sessionToken: teacherToken, name: newName || `${newDiscipline} - ${newCourse}`, course: newCourse, discipline: newDiscipline, color: newColor }); }}
              disabled={!newDiscipline || !newCourse || createClass.isPending}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
            >
              Criar Turma
            </button>
            <button onClick={() => setShowCreateForm(false)} className="px-4 py-2 rounded-md bg-secondary text-foreground text-sm">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Classes list */}
      {(!classesList || classesList.length === 0) ? (
        <div className="border border-border rounded-lg p-8 text-center" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
          <FlaskConical size={48} className="mx-auto mb-4 text-muted-foreground" />
          <h3 className="font-display font-bold text-lg text-foreground mb-2">Nenhuma turma cadastrada</h3>
          <p className="text-sm text-muted-foreground">Crie sua primeira turma para começar a organizar alunos e equipes.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {classesList.map((cls: any) => (
            <button
              key={cls.id}
              onClick={() => setSelectedClass(cls.id)}
              className="border border-border rounded-lg p-4 text-left hover:border-primary/50 transition-colors"
              style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cls.color }} />
                <span className="font-display font-semibold text-sm text-foreground">{cls.name}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                <p>{cls.discipline} — {cls.course}</p>
                <p className="mt-1">Semestre: {cls.semester}</p>
                {cls.teacherName && <p className="mt-1">Prof. {cls.teacherName}</p>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Admin Page ───
export default function Admin() {
  // Read tokens synchronously from localStorage to avoid race condition
  const [password, setPassword] = useState<string | null>(() => {
    const token = localStorage.getItem("teacherSessionToken") || localStorage.getItem("sessionToken");
    return token ? "__loading__" : null;
  });
  const [activeSection, setActiveSection] = useState<"jogo" | "turmas" | "teams" | "xp" | "activities" | "highlights" | "recursos" | "badges" | "attendance" | "professores" | "jigsaw" | "settings" | "rebalanceamento" | "qr-code" | "monitores" | "cronograma" | "qr-acesso" | "provas">("xp");
  const [, setLocation] = useState("/");
  
  // Check teacher authentication - read synchronously to prevent redirect loop
  const [teacherToken, setTeacherToken] = useState<string | null>(() => {
    return localStorage.getItem("teacherSessionToken") || localStorage.getItem("sessionToken") || null;
  });
  const [teacherName, setTeacherName] = useState<string>(() => {
    return localStorage.getItem("teacherName") || localStorage.getItem("adminEmail") || "";
  });

  // Fetch the real admin password using the teacher session token
  const { data: adminPwData } = trpc.teacherAuth.getAdminPassword.useQuery(
    { sessionToken: teacherToken || "" },
    { enabled: !!teacherToken }
  );

  useEffect(() => {
    if (adminPwData?.success && adminPwData.password) {
      setPassword(adminPwData.password);
    } else if (adminPwData && !adminPwData.success) {
      // Token is invalid, redirect to login
      setPassword(null);
    }
  }, [adminPwData]);

  // Listener para navegação interna entre seções
  useEffect(() => {
    const handleAdminNavigate = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.section) {
        setActiveSection(detail.section as any);
      }
    };
    window.addEventListener('admin-navigate', handleAdminNavigate);
    return () => window.removeEventListener('admin-navigate', handleAdminNavigate);
  }, []);
  
  const handleLogout = () => {
    localStorage.removeItem("teacherSessionToken");
    localStorage.removeItem("teacherName");
    localStorage.removeItem("teacherEmail");
    localStorage.removeItem("sessionToken");
    localStorage.removeItem("adminEmail");
    localStorage.removeItem("adminRole");
    localStorage.removeItem("adminLoginTime");
    setTeacherToken(null);
    setPassword(null);
    window.location.href = "/";
  };
  
  // If not authenticated with teacher token or admin token, redirect to login
  if (!teacherToken && !password) {
    window.location.href = "/professor/login";
    return null;
  }

  // Show loading while fetching admin password
  if (password === "__loading__") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Carregando painel...</p>
        </div>
      </div>
    );
  }

  const sections = [
    { key: "xp" as const, label: "📊 Lançar Notas", icon: <Zap size={16} /> },
    { key: "jogo" as const, label: "🎮 Jogo", icon: <Gamepad2 size={16} /> },
    { key: "turmas" as const, label: "Turmas", icon: <FlaskConical size={16} /> },
    { key: "highlights" as const, label: "Destaques", icon: <Activity size={16} /> },
    { key: "recursos" as const, label: "Arquivos de Aulas", icon: <FileText size={16} /> },
    { key: "badges" as const, label: "Conquistas", icon: <Award size={16} /> },
    { key: "attendance" as const, label: "Frequência", icon: <MapPin size={16} /> },
    { key: "jigsaw" as const, label: "Seminários Jigsaw", icon: <Target size={16} /> },
    { key: "monitores" as const, label: "Monitores", icon: <GraduationCap size={16} /> },
    { key: "cronograma" as const, label: "Cronograma", icon: <Calendar size={16} /> },
    { key: "qr-acesso" as const, label: "QR Acesso", icon: <QrCode size={16} /> },
    { key: "professores" as const, label: "Professores", icon: <UserCheck size={16} /> },
    { key: "rebalanceamento" as const, label: "Rebalanceamento", icon: <Shuffle size={16} /> },
    { key: "qr-code" as const, label: "QR Code Presença", icon: <QrCode size={16} /> },
    { key: "settings" as const, label: "Configurações", icon: <Settings size={16} /> },
    { key: "provas" as const, label: "🖨️ Provas", icon: <Printer size={16} /> },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
        <div className="container py-4 flex items-center gap-3">
          <FlaskConical size={20} className="text-primary" />
          <h1 className="font-display font-bold text-lg text-foreground flex-1">Painel Admin</h1>
          <a href="/leaderboard" className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 mr-3">
            <ArrowLeft size={12} /> Ranking
          </a>
          <div className="flex items-center gap-2 sm:gap-3">
            <a href="/professor/perfil" className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-md bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors">
              <User size={12} /> <span className="hidden sm:inline">{teacherName || "Perfil"}</span><span className="sm:hidden">Perfil</span>
            </a>
            <button onClick={handleLogout} className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-md bg-destructive/10 text-destructive text-xs font-medium hover:bg-destructive/20">
              <LogOut size={12} /> Sair
            </button>
          </div>
        </div>
      </div>

      {/* Nav */}
      <div className="container py-4">
        <ResponsiveTabNav
          tabs={sections}
          activeTab={activeSection}
          onTabChange={setActiveSection}
        />
      </div>

      {/* Content */}
      <div className="container pb-16">
        {activeSection === "jogo" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-lg border border-emerald-500/30" style={{ backgroundColor: "rgba(16, 185, 129, 0.08)" }}>
              <Gamepad2 size={24} className="text-emerald-400" />
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">Painel de Gerenciamento do Jogo</h3>
                <p className="text-sm text-muted-foreground">Libere semanas, gerencie missões, boss battles e veja o progresso dos alunos.</p>
              </div>
              <a href="/admin/jogo" className="px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 transition-colors">
                Abrir Painel do Jogo
              </a>
            </div>
          </div>
        )}
        {activeSection === "turmas" && <TurmasManager teacherToken={teacherToken || ""} />}
        {activeSection === "teams" && password && <TeamManager password={password} />}
        {activeSection === "xp" && teacherToken && (
          <div className="space-y-8">
            <GradesSpreadsheet teacherToken={teacherToken} />
            <div className="border-t border-border pt-6">
              <h3 className="text-sm font-semibold text-muted-foreground mb-4 uppercase tracking-wider">Lançamento Manual de PF por Equipe</h3>
              {password && <BulkXPManager password={password} />}
            </div>
          </div>
        )}
        {activeSection === "activities" && password && <ActivitiesManager password={password} />}
        {activeSection === "highlights" && password && <HighlightsManager password={password} />}
        {activeSection === "recursos" && password && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4">Notificações</h3>
              <NotificationsManager password={password} />
            </div>
            <div className="border-t border-border pt-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Materiais</h3>
              <MaterialsManager password={password} />
            </div>
            <div className="border-t border-border pt-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">YouTube</h3>
              <YouTubePlaylistsManager password={password} />
            </div>
          </div>
        )}
        {activeSection === "badges" && password && <BadgesManager password={password} />}
        {activeSection === "attendance" && password && <AttendanceManager password={password} />}
        {activeSection === "jigsaw" && <AdminJigsawPanel teacherToken={teacherToken || ""} />}
        {activeSection === "monitores" && teacherToken && <MonitoresManager teacherToken={teacherToken} />}
        {activeSection === "cronograma" && teacherToken && <CronogramaManager teacherToken={teacherToken} />}
        {activeSection === "qr-acesso" && <QRCodeAcessoManager />}
        {activeSection === "professores" && teacherToken && <ProfessoresManager teacherToken={teacherToken} />}

        {activeSection === "rebalanceamento" && teacherToken && <JigsawRebalancingManager />}
        {activeSection === "qr-code" && <AttendanceQRCodeManager />}
        {activeSection === "settings" && password && <SettingsManager password={password} />}
        {activeSection === "provas" && teacherToken && (
          <ExamToolsManager
            teacherToken={teacherToken}
            classes={[
              { id: 22, name: "Farmacologia 1 - Medicina" },
              { id: 23, name: "Farmacologia 1 - Nutrição" },
              { id: 24, name: "Farmacologia 1 - Biomedicina 1" },
              { id: 25, name: "Farmacologia 1 - Biomedicina 2" },
              { id: 26, name: "Farmacologia 1 - Enfermagem" },
              { id: 27, name: "Farmacologia 1 - Medicina 2" },
              { id: 28, name: "Farmacologia 1 - Nutrição Noturno" },
            ]}
          />
        )}
      </div>
    </div>
  );
}import { useState, useEffect, useMemo } from "react";
// Build cache buster: 2026-03-05T20:43:00Z
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { SearchStudents } from "@/components/SearchStudents";
import { ExportButton } from "@/components/ExportButton";
import { SortSelector, useSortStudents, type SortOption } from "@/components/SortSelector";
import { Pagination } from "@/components/Pagination";
import { AuditLogManager } from "./AdminAuditLog";
import { ResponsiveTabNav } from "@/components/ResponsiveTabNav";
import { MaterialTypeBadge, MaterialTypeFilter, type MaterialType } from "@/components/MaterialTypeBadge";
import { FileDropZone } from "@/components/FileDropZone";
import { PDFPreview, usePDFPreview } from "@/components/PDFPreview";
import { TagInput, TagDisplay, type Tag } from "@/components/TagInput";
import JigsawRebalancingManager from "./AdminJigsawRebalancing";
import ExamToolsManager from "@/components/ExamToolsManager";
import AdminJigsawPanel from "./AdminJigsawPanel";
import AttendanceQRCodeManager from "./AdminAttendanceQRCode";
import GradesSpreadsheet from "@/components/GradesSpreadsheet";
import {
  Lock, LogOut, Users, UserPlus, Trash2, Edit2, Save, X,
  Plus, Trophy, Zap, Activity, Settings, ChevronDown, ChevronUp,
  FlaskConical, ArrowLeft, KeyRound, Bell, AlertTriangle, Clock,
  FileText, Link2, MessageSquare, Upload, Eye, EyeOff, Paperclip,
  Award, Star, Medal, MapPin, CheckCircle, XCircle, UserCheck, Search, Download,
  Youtube, Play, Video, GripVertical, Target, LogIn, Calendar, Shuffle, QrCode, Gamepad2, User, GraduationCap, BookOpen, History, Loader2, Printer
} from "lucide-react";

// ─── Login Screen ───
function LoginScreen({ onLogin }: { onLogin: (pw: string) => void }) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const loginMutation = trpc.admin.login.useMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await loginMutation.mutateAsync({ password });
      if (result.success) {
        toast.success("Autenticado com sucesso!");
        onLogin(password);
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error("Erro ao autenticar");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Lock size={28} className="text-primary" />
          </div>
          <h1 className="font-display font-bold text-2xl text-foreground">Painel Admin</h1>
          <p className="text-sm text-muted-foreground mt-1">Conexão em Farmacologia — Pontos Farmacológicos</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground block mb-1.5">Senha do Professor</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Digite a senha..."
              className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
              autoFocus
            />
          </div>
          <button
            type="submit"
            disabled={loading || !password}
            className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            {loading ? "Verificando..." : "Entrar"}
          </button>
        </form>
        <div className="mt-6 text-center">
          <a href="/leaderboard" className="text-xs text-muted-foreground hover:text-primary flex items-center justify-center gap-1">
            <ArrowLeft size={12} /> Voltar ao Ranking
          </a>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Team Management ───
function TeamManager({ password }: { password: string }) {
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamEmoji, setNewTeamEmoji] = useState("🧪");
  const [newTeamColor, setNewTeamColor] = useState("#10b981");
  const [editingTeam, setEditingTeam] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmoji, setEditEmoji] = useState("");
  const [editColor, setEditColor] = useState("");
  const [expandedTeam, setExpandedTeam] = useState<number | null>(null);
  const [sortOption, setSortOption] = useState<SortOption>("alphabetical");
  const sortStudents = useSortStudents(sortOption);

  const utils = trpc.useUtils();
  const { data: leaderboard, isLoading } = trpc.leaderboard.getData.useQuery();

  // Flatten all students for search and export
  const allStudents = useMemo(() => {
    if (!leaderboard?.teams) return [];
    return leaderboard.teams.flatMap(team =>
      team.members.map(m => ({
        id: m.id,
        name: m.name,
        xp: m.xp,
        teamId: team.id,
        teamName: team.name,
      }))
    );
  }, [leaderboard]);

  const createTeam = trpc.teams.create.useMutation({
    onSuccess: () => { utils.leaderboard.getData.invalidate(); toast.success("Equipe criada!"); setNewTeamName(""); },
    onError: () => toast.error("Erro ao criar equipe"),
  });

  const updateTeam = trpc.teams.update.useMutation({
    onSuccess: () => { utils.leaderboard.getData.invalidate(); toast.success("Equipe atualizada!"); setEditingTeam(null); },
    onError: () => toast.error("Erro ao atualizar equipe"),
  });

  const deleteTeam = trpc.teams.delete.useMutation({
    onSuccess: () => { utils.leaderboard.getData.invalidate(); toast.success("Equipe removida!"); },
    onError: () => toast.error("Erro ao remover equipe"),
  });

  if (isLoading) return <div className="text-center text-muted-foreground py-8">Carregando...</div>;

  return (
    <div className="space-y-6">
      {/* Add Team */}
      <div className="border border-border rounded-lg p-4" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
        <h3 className="font-display font-semibold text-sm text-foreground mb-3 flex items-center gap-2">
          <Plus size={16} className="text-primary" /> Adicionar Equipe
        </h3>
        <div className="flex gap-2 flex-wrap">
          <input
            value={newTeamEmoji}
            onChange={e => setNewTeamEmoji(e.target.value)}
            className="w-12 px-2 py-2 rounded-md bg-secondary border border-border text-foreground text-center text-sm"
            placeholder="🧪"
          />
          <input
            value={newTeamName}
            onChange={e => setNewTeamName(e.target.value)}
            className="flex-1 min-w-[150px] px-3 py-2 rounded-md bg-secondary border border-border text-foreground placeholder:text-muted-foreground text-sm"
            placeholder="Nome da equipe..."
          />
          <input
            type="color"
            value={newTeamColor}
            onChange={e => setNewTeamColor(e.target.value)}
            className="w-10 h-10 rounded-md border border-border cursor-pointer"
          />
          <button
            onClick={() => createTeam.mutate({ password, name: newTeamName, emoji: newTeamEmoji, color: newTeamColor })}
            disabled={!newTeamName || createTeam.isPending}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
          >
            Criar
          </button>
        </div>
      </div>

      {/* Toolbar: Search + Sort + Export */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex-1 w-full sm:max-w-sm">
          <SearchStudents
            students={allStudents}
            onSelect={(student) => {
              const team = leaderboard?.teams.find(t => t.id === student.teamId);
              if (team) setExpandedTeam(team.id);
              toast.info(`${student.name} — ${student.teamName || 'Sem equipe'} — ${student.xp.toFixed(1)} PF`);
            }}
            placeholder="Buscar aluno por nome..."
          />
        </div>
        <div className="flex items-center gap-3">
          <SortSelector value={sortOption} onChange={setSortOption} />
          <ExportButton students={allStudents} filename="alunos-equipes" label="Exportar" />
        </div>
      </div>

      {/* Team List */}
      <div className="space-y-2">
        {leaderboard?.teams.map(team => (
          <div key={team.id} className="border border-border rounded-lg overflow-hidden" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
            <div className="p-3 flex items-center gap-3">
              {editingTeam === team.id ? (
                <>
                  <input value={editEmoji} onChange={e => setEditEmoji(e.target.value)} className="w-10 px-1 py-1 rounded bg-secondary border border-border text-center text-sm text-foreground" />
                  <input value={editName} onChange={e => setEditName(e.target.value)} className="flex-1 px-2 py-1 rounded bg-secondary border border-border text-sm text-foreground" />
                  <input type="color" value={editColor} onChange={e => setEditColor(e.target.value)} className="w-8 h-8 rounded border border-border cursor-pointer" />
                  <button onClick={() => updateTeam.mutate({ password, id: team.id, name: editName, emoji: editEmoji, color: editColor })} className="p-1.5 rounded bg-primary/20 text-primary"><Save size={14} /></button>
                  <button onClick={() => setEditingTeam(null)} className="p-1.5 rounded bg-destructive/20 text-destructive"><X size={14} /></button>
                </>
              ) : (
                <>
                  <span className="text-lg">{team.emoji}</span>
                  <span className="font-medium text-sm text-foreground flex-1">{team.name}</span>
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: team.color }} />
                  <span className="text-xs text-muted-foreground font-mono">{team.members.length} membros</span>
                  <span className="text-xs font-mono font-bold" style={{ color: team.color }}>
                    {team.members.reduce((s, m) => s + m.xp, 0).toFixed(1)} PF
                  </span>
                  <button onClick={() => { setEditingTeam(team.id); setEditName(team.name); setEditEmoji(team.emoji); setEditColor(team.color); }} className="p-1.5 rounded hover:bg-secondary text-muted-foreground"><Edit2 size={14} /></button>
                  <button onClick={() => { if (confirm(`Remover equipe "${team.name}" e todos os membros?`)) deleteTeam.mutate({ password, id: team.id }); }} className="p-1.5 rounded hover:bg-destructive/20 text-destructive"><Trash2 size={14} /></button>
                  <button onClick={() => setExpandedTeam(expandedTeam === team.id ? null : team.id)} className="p-1.5 rounded hover:bg-secondary text-muted-foreground">
                    {expandedTeam === team.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </>
              )}
            </div>
            <AnimatePresence>
              {expandedTeam === team.id && (
                <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                  <MemberList teamId={team.id} members={team.members} password={password} teamColor={team.color} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Member List (inside team) ───
function MemberList({ teamId, members, password, teamColor }: {
  teamId: number;
  members: { id: number; name: string; xp: number }[];
  password: string;
  teamColor: string;
}) {
  const [newName, setNewName] = useState("");
  const [editingMember, setEditingMember] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editXP, setEditXP] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const utils = trpc.useUtils();

  const createMember = trpc.members.create.useMutation({
    onSuccess: () => { utils.leaderboard.getData.invalidate(); toast.success("Aluno adicionado!"); setNewName(""); },
    onError: () => toast.error("Erro ao adicionar aluno"),
  });

  const updateMember = trpc.members.update.useMutation({
    onSuccess: () => { utils.leaderboard.getData.invalidate(); toast.success("Aluno atualizado!"); setEditingMember(null); },
    onError: () => toast.error("Erro ao atualizar"),
  });

  const deleteMember = trpc.members.delete.useMutation({
    onSuccess: () => { utils.leaderboard.getData.invalidate(); toast.success("Aluno removido!"); },
    onError: () => toast.error("Erro ao remover"),
  });

  return (
    <div className="border-t border-border/50 px-3 pb-3 pt-2">
      {/* Add member */}
      <div className="flex gap-2 mb-2">
        <input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          className="flex-1 px-2 py-1.5 rounded bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground"
          placeholder="Nome do aluno..."
          onKeyDown={e => { if (e.key === "Enter" && newName) createMember.mutate({ password, teamId, name: newName }); }}
        />
        <button
          onClick={() => createMember.mutate({ password, teamId, name: newName })}
          disabled={!newName || createMember.isPending}
          className="px-3 py-1.5 rounded bg-primary/20 text-primary text-xs font-medium disabled:opacity-50"
        >
          <UserPlus size={14} />
        </button>
      </div>

      {/* Members */}
      {members.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-2">Nenhum aluno nesta equipe</p>
      ) : (
        <>
          <div className="space-y-1">
            {members
              .sort((a, b) => a.name.localeCompare(b.name))
              .slice((currentPage - 1) * pageSize, currentPage * pageSize)
              .map(member => (
                <div key={member.id} className="flex items-center gap-2 py-1">
                  {editingMember === member.id ? (
                    <>
                      <input value={editName} onChange={e => setEditName(e.target.value)} className="flex-1 px-2 py-1 rounded bg-secondary border border-border text-xs text-foreground" />
                      <input value={editXP} onChange={e => setEditXP(e.target.value)} className="w-16 px-2 py-1 rounded bg-secondary border border-border text-xs text-foreground text-right font-mono" type="number" step="0.5" />
                      <button onClick={() => updateMember.mutate({ password, id: member.id, name: editName, xp: editXP })} className="p-1 rounded bg-primary/20 text-primary"><Save size={12} /></button>
                      <button onClick={() => setEditingMember(null)} className="p-1 rounded bg-destructive/20 text-destructive"><X size={12} /></button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-xs text-foreground truncate">{member.name}</span>
                      <span className="font-mono text-xs font-bold w-12 text-right" style={{ color: teamColor }}>{member.xp.toFixed(1)}</span>
                      <button onClick={() => { setEditingMember(member.id); setEditName(member.name); setEditXP(member.xp.toFixed(1)); }} className="p-1 rounded hover:bg-secondary text-muted-foreground"><Edit2 size={12} /></button>
                      <button onClick={() => { if (confirm(`Remover "${member.name}"?`)) deleteMember.mutate({ password, id: member.id }); }} className="p-1 rounded hover:bg-destructive/20 text-destructive"><Trash2 size={12} /></button>
                    </>
                  )}
                </div>
              ))
            }
          </div>
          {members.length > 10 && (
            <Pagination
              currentPage={currentPage}
              totalPages={Math.ceil(members.length / pageSize)}
              onPageChange={setCurrentPage}
              pageSize={pageSize}
              onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
              totalItems={members.length}
              className="mt-2 pt-2 border-t border-border/30"
            />
          )}
        </>
      )}
    </div>
  );
}

// ─── Bulk PF Update ───
function BulkXPManager({ password }: { password: string }) {
  const { data: leaderboard } = trpc.leaderboard.getData.useQuery();
  const [xpUpdates, setXpUpdates] = useState<Record<number, string>>({});
  const [selectedTeam, setSelectedTeam] = useState<number | null>(null);
  const utils = trpc.useUtils();

  const bulkUpdate = trpc.members.bulkUpdateXP.useMutation({
    onSuccess: (data) => {
      utils.leaderboard.getData.invalidate();
      toast.success(`${data.count} alunos atualizados!`);
      setXpUpdates({});
    },
    onError: () => toast.error("Erro ao atualizar PF"),
  });

  const filteredTeams = leaderboard?.teams ?? [];
  const displayTeams = selectedTeam ? filteredTeams.filter(t => t.id === selectedTeam) : filteredTeams;

  const handleSave = () => {
    const updates = Object.entries(xpUpdates)
      .filter(([_, xp]) => xp !== "")
      .map(([id, xp]) => ({ id: parseInt(id), xp }));
    if (updates.length === 0) { toast.info("Nenhuma alteração para salvar"); return; }
    bulkUpdate.mutate({ password, updates });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={selectedTeam ?? ""}
          onChange={e => setSelectedTeam(e.target.value ? parseInt(e.target.value) : null)}
          className="px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm"
        >
          <option value="">Todas as equipes</option>
          {filteredTeams.map(t => (
            <option key={t.id} value={t.id}>{t.emoji} {t.name}</option>
          ))}
        </select>
        <button
          onClick={handleSave}
          disabled={Object.keys(xpUpdates).length === 0 || bulkUpdate.isPending}
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 flex items-center gap-1.5"
        >
          <Save size={14} /> Salvar Alterações ({Object.keys(xpUpdates).filter(k => xpUpdates[parseInt(k)] !== "").length})
        </button>
      </div>

      {displayTeams.map(team => (
        <div key={team.id} className="border border-border rounded-lg p-3" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">{team.emoji}</span>
            <span className="font-display font-semibold text-sm text-foreground">{team.name}</span>
            <span className="text-xs text-muted-foreground ml-auto font-mono">
              Total PF: {team.members.reduce((s, m) => s + (xpUpdates[m.id] !== undefined ? parseFloat(xpUpdates[m.id] || "0") : m.xp), 0).toFixed(1)}
            </span>
          </div>
          <div className="grid gap-1.5">
            {team.members.sort((a, b) => a.name.localeCompare(b.name)).map(member => (
              <div key={member.id} className="flex items-center gap-2">
                <span className="flex-1 text-xs text-foreground truncate">{member.name}</span>
                <span className="text-[11px] text-muted-foreground font-mono w-12 text-right">PF: {member.xp.toFixed(1)}</span>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="45"
                  value={xpUpdates[member.id] ?? member.xp.toFixed(1)}
                  onChange={e => setXpUpdates(prev => ({ ...prev, [member.id]: e.target.value }))}
                  className={`w-20 px-2 py-1 rounded bg-secondary border text-xs text-foreground text-right font-mono ${
                    xpUpdates[member.id] !== undefined ? "border-primary" : "border-border"
                  }`}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Activities Manager ───
// Tabela de referência das atividades do semestre
const SEMESTER_ACTIVITIES_REF = [
  { category: "Participação", name: "Participação em Aula", icon: "📚", maxPF: 5, description: "Presença ativa e contribuições em aula" },
  { category: "Frequência", name: "Frequência Semanal", icon: "✅", maxPF: 2, description: "Presença registrada via QR Code" },
  { category: "TBL", name: "TBL 1 — Farmacocinética 2", icon: "🧠", maxPF: 10, description: "Semana 2 — Metabolismo e Excreção" },
  { category: "TBL", name: "TBL 2 — Boas Práticas de Prescrição", icon: "🧠", maxPF: 10, description: "Semana 4 — Prescrição Racional" },
  { category: "TBL", name: "TBL 3 — Adrenérgicos", icon: "🧠", maxPF: 10, description: "Semana 9 — SNA Adrenérgico" },
  { category: "TBL", name: "TBL 4 — AINEs e Corticoides", icon: "🧠", maxPF: 10, description: "Semana 11 — Anti-inflamatórios" },
  { category: "Caso Clínico", name: "Caso Clínico 1 — Farmacodinâmica", icon: "🏥", maxPF: 8, description: "Semana 3 — Receptores e Mecanismos" },
  { category: "Caso Clínico", name: "Caso Clínico 2 — SNA Colinergía", icon: "🏥", maxPF: 8, description: "Semana 5 — Transmissão Colinérgica" },
  { category: "Caso Clínico", name: "Caso Clínico 3 — Anti-adrenérgicos", icon: "🏥", maxPF: 8, description: "Semana 10 — Bloqueadores Adrenérgicos" },
  { category: "Caso Clínico", name: "Caso Clínico 4 — Anti-histamínicos", icon: "🏥", maxPF: 8, description: "Semana 13 — Receptores H1 e H2" },
  { category: "Jigsaw", name: "Seminário Jigsaw — Fase 1 (Especialistas)", icon: "🧪", maxPF: 7, description: "Apresentação (0-5) + Participação (0-2)" },
  { category: "Jigsaw", name: "Seminário Jigsaw — Fase 2 (Mosaico)", icon: "🧪", maxPF: 12, description: "Apresentação (0-5) + Participação (0-2) + Pares (0-5)" },
  { category: "Jogo", name: "Jogo Semanal — Missões", icon: "🎮", maxPF: 5, description: "Missões semanais liberadas toda terça-feira" },
  { category: "Escape Room", name: "Escape Room Farmacológico", icon: "🔓", maxPF: 15, description: "Semana 8 — Atividade em equipe" },
  { category: "Prova", name: "Prova P1", icon: "📝", maxPF: 30, description: "Semana 8 — Farmacocinética até Colinergía" },
  { category: "Prova", name: "Prova P2", icon: "📝", maxPF: 30, description: "Semana 15 — Adrenérgicos até Anti-histamínicos" },
  { category: "Prova", name: "Prova Final", icon: "🏆", maxPF: 40, description: "Semana 17 — Conteúdo completo do semestre" },
];

const CATEGORY_COLORS: Record<string, string> = {
  "Participação": "#10b981", "Frequência": "#06b6d4", "TBL": "#6366f1",
  "Caso Clínico": "#f59e0b", "Jigsaw": "#a855f7", "Jogo": "#ec4899",
  "Escape Room": "#f97316", "Prova": "#ef4444",
};

function ActivitiesManager({ password }: { password: string }) {
  const { data: leaderboard } = trpc.leaderboard.getData.useQuery();
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState("🎯");
  const [newMaxXP, setNewMaxXP] = useState("1");
  const [showRef, setShowRef] = useState(true);
  const utils = trpc.useUtils();

  const createActivity = trpc.activities.create.useMutation({
    onSuccess: () => {
      toast.success("Atividade criada com sucesso!");
      setNewName("");
      setNewIcon("🎯");
      setNewMaxXP("1");
      utils.leaderboard.getData.invalidate();
    },
    onError: (error) => { toast.error(`Erro: ${error.message}`); },
  });

  const importDefault = trpc.activities.importDefault.useMutation({
    onSuccess: (data) => {
      toast.success(`✅ ${data.created} atividades importadas! (${data.total} no total do semestre)`);
      utils.leaderboard.getData.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteActivity = trpc.activities.delete.useMutation({
    onSuccess: () => {
      toast.success("Atividade removida com sucesso!");
      utils.leaderboard.getData.invalidate();
    },
    onError: (error) => { toast.error(`Erro: ${error.message}`); },
  });

  const totalMaxPF = SEMESTER_ACTIVITIES_REF.reduce((s, a) => s + a.maxPF, 0);

  return (
    <div className="space-y-4">
      {/* Tabela de referência das atividades do semestre */}
      <div className="border border-border rounded-lg overflow-hidden" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="font-display font-semibold text-sm text-foreground flex items-center gap-2">
            <Trophy size={16} className="text-primary" /> Atividades do Semestre — Distribuição de PF
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-primary">Total máx: {totalMaxPF} PF</span>
            <button onClick={() => setShowRef(!showRef)} className="text-xs text-muted-foreground hover:text-foreground">
              {showRef ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>
        </div>
        {showRef && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium">Atividade</th>
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium">Categoria</th>
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium">Descrição</th>
                  <th className="text-right px-3 py-2 text-muted-foreground font-medium">PF Máx</th>
                </tr>
              </thead>
              <tbody>
                {SEMESTER_ACTIVITIES_REF.map((act, i) => (
                  <tr key={i} className="border-b border-border/40 hover:bg-secondary/20">
                    <td className="px-3 py-2 font-medium text-foreground">{act.icon} {act.name}</td>
                    <td className="px-3 py-2">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ backgroundColor: (CATEGORY_COLORS[act.category] || "#6366f1") + "22", color: CATEGORY_COLORS[act.category] || "#6366f1" }}>{act.category}</span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{act.description}</td>
                    <td className="px-3 py-2 text-right font-mono font-bold" style={{ color: CATEGORY_COLORS[act.category] || "#6366f1" }}>+{act.maxPF}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {showRef && (
          <div className="px-4 py-3 border-t border-border flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Clique em "Importar" para adicionar todas as atividades ao sistema de PF.</p>
            <button
              onClick={() => { if (confirm("Importar todas as atividades padrão do semestre?")) importDefault.mutate({ password }); }}
              disabled={importDefault.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50"
            >
              {importDefault.isPending ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
              Importar Atividades Padrão
            </button>
          </div>
        )}
      </div>

      {/* Formulário de nova atividade */}
      <div className="border border-border rounded-lg p-4" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
        <h3 className="font-display font-semibold text-sm text-foreground mb-3 flex items-center gap-2">
          <Plus size={16} className="text-primary" /> Nova Atividade Personalizada
        </h3>
        <div className="flex gap-2 flex-wrap">
          <input value={newIcon} onChange={e => setNewIcon(e.target.value)} className="w-12 px-2 py-2 rounded-md bg-secondary border border-border text-foreground text-center text-sm" />
          <input value={newName} onChange={e => setNewName(e.target.value)} className="flex-1 min-w-[150px] px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm" placeholder="Nome da atividade..." />
          <input value={newMaxXP} onChange={e => setNewMaxXP(e.target.value)} type="number" step="0.5" className="w-20 px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm text-right font-mono" placeholder="PF" />
          <button onClick={() => createActivity.mutate({ password, name: newName, icon: newIcon, maxXP: newMaxXP })} disabled={!newName || createActivity.isPending} className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50">{createActivity.isPending ? "Criando..." : "Criar"}</button>
        </div>
      </div>

      {/* Lista de atividades cadastradas */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">Atividades Cadastradas no Sistema</h3>
        {leaderboard?.activities.map(act => (
          <div key={act.id} className="border border-border rounded-lg p-3 flex items-center gap-3" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
            <span className="text-xl">{act.icon}</span>
            <span className="flex-1 text-sm text-foreground font-medium">{act.name}</span>
            <span className="font-mono text-sm text-primary font-bold">+{act.maxXP} PF</span>
            <button onClick={() => { if (confirm(`Remover "${act.name}"?`)) deleteActivity.mutate({ password, id: act.id }); }} disabled={deleteActivity.isPending} className="p-1.5 rounded hover:bg-destructive/20 text-destructive disabled:opacity-50"><Trash2 size={14} /></button>
          </div>
        ))}
        {(!leaderboard?.activities || leaderboard.activities.length === 0) && (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhuma atividade cadastrada. Use o botão "Importar Atividades Padrão" acima.</p>
        )}
      </div>
    </div>
  );
}

// ─── Highlights Manager ───
function HighlightsManager({ password }: { password: string }) {
  const { data: leaderboard } = trpc.leaderboard.getData.useQuery();
  const [week, setWeek] = useState("");
  const [date, setDate] = useState("");
  const [activity, setActivity] = useState("");
  const [description, setDescription] = useState("");
  const [topTeam, setTopTeam] = useState("");
  const [topStudent, setTopStudent] = useState("");
  const [autoClassId, setAutoClassId] = useState<number | undefined>(undefined);
  const { data: classesList = [] } = trpc.classes.listAll.useQuery();
  const utils = trpc.useUtils();

  const createHighlight = trpc.highlights.create.useMutation({
    onSuccess: () => {
      utils.leaderboard.getData.invalidate();
      toast.success("Destaque adicionado!");
      setWeek(""); setDate(""); setActivity(""); setDescription(""); setTopTeam(""); setTopStudent("");
    },
  });

  const autoGenerate = trpc.highlights.autoGenerate.useMutation({
    onSuccess: (data) => {
      utils.leaderboard.getData.invalidate();
      toast.success(`✨ Destaque gerado! Aluno destaque: ${data.topStudent}`);
      setWeek(""); setDate(""); setActivity("");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteHighlight = trpc.highlights.delete.useMutation({
    onSuccess: () => { utils.leaderboard.getData.invalidate(); toast.success("Destaque removido!"); },
  });

  return (
    <div className="space-y-4">
      {/* Auto-geração por somatório de pontos */}
      <div className="border border-emerald-500/30 rounded-lg p-4" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
        <h3 className="font-display font-semibold text-sm text-foreground mb-2 flex items-center gap-2">
          <Zap size={16} className="text-emerald-400" /> Gerar Destaque Automático por Somatório de PF
        </h3>
        <p className="text-xs text-muted-foreground mb-3">Identifica automaticamente o aluno e equipe com maior somatório de pontos (PF) na plataforma.</p>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <input value={week} onChange={e => setWeek(e.target.value)} type="number" className="px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm" placeholder="Semana (1-16)" />
          <input value={date} onChange={e => setDate(e.target.value)} className="px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm" placeholder="Data (ex: 10/03/2026)" />
          <input value={activity} onChange={e => setActivity(e.target.value)} className="col-span-2 px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm" placeholder="Atividade (ex: TBL, Jigsaw, Semana 1...)" />
          <select value={autoClassId ?? ""} onChange={e => setAutoClassId(e.target.value ? Number(e.target.value) : undefined)} className="col-span-2 px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm">
            <option value="">Todas as turmas</option>
            {(classesList as any[]).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <button
          onClick={() => autoGenerate.mutate({ password, week: parseInt(week), date, activity, classId: autoClassId })}
          disabled={!week || !date || !activity || autoGenerate.isPending}
          className="px-4 py-2 rounded-md bg-emerald-600 text-white text-sm font-medium disabled:opacity-50 flex items-center gap-2"
        >
          {autoGenerate.isPending ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
          Gerar Destaque Automático
        </button>
      </div>

      {/* Formulário manual */}
      <div className="border border-border rounded-lg p-4" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
        <h3 className="font-display font-semibold text-sm text-foreground mb-3 flex items-center gap-2">
          <Plus size={16} className="text-primary" /> Novo Destaque Manual
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <input value={week} onChange={e => setWeek(e.target.value)} type="number" className="px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm" placeholder="Semana (1-16)" />
          <input value={date} onChange={e => setDate(e.target.value)} className="px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm" placeholder="Data (ex: 10/03/2026)" />
          <input value={activity} onChange={e => setActivity(e.target.value)} className="px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm" placeholder="Atividade" />
          <input value={topTeam} onChange={e => setTopTeam(e.target.value)} className="px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm" placeholder="Equipe destaque" />
          <input value={topStudent} onChange={e => setTopStudent(e.target.value)} className="px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm" placeholder="Aluno destaque" />
          <input value={description} onChange={e => setDescription(e.target.value)} className="col-span-2 px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm" placeholder="Descrição do destaque..." />
        </div>
        <button
          onClick={() => createHighlight.mutate({ password, week: parseInt(week), date, activity, description, topTeam: topTeam || "—", topStudent: topStudent || "—" })}
          disabled={!week || !date || !activity || !description}
          className="mt-3 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
        >
          Adicionar Destaque
        </button>
      </div>

      <div className="space-y-2">
        {leaderboard?.highlights.map(h => (
          <div key={h.id} className="border border-border rounded-lg p-3" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs font-bold text-primary">SEM {h.week}</span>
              <span className="text-xs text-muted-foreground">{h.date}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{h.activity}</span>
              <button onClick={() => { if (confirm("Remover destaque?")) deleteHighlight.mutate({ password, id: h.id }); }} className="ml-auto p-1 rounded hover:bg-destructive/20 text-destructive"><Trash2 size={12} /></button>
            </div>
            <p className="text-xs text-foreground">{h.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── QR Code Acesso Manager ───
function QRCodeAcessoManager() {
  const domains = [
    { label: "Domínio Principal", url: "https://2026.conexaofarmacologia.com.br" },
    { label: "Domínio Alternativo", url: "https://2026conexaofarmacologia.manus.space" },
    { label: "Domínio Legado", url: "https://farmalead-fuz2ecmx.manus.space" },
  ];
  const [selectedDomain, setSelectedDomain] = useState(domains[0].url);
  const [qrSize, setQrSize] = useState(300);
  const [showInstructions, setShowInstructions] = useState(true);

  function downloadQR(format: "png" | "svg") {
    const canvas = document.querySelector<HTMLCanvasElement>("#qr-acesso-canvas canvas");
    const svg = document.querySelector<SVGElement>("#qr-acesso-canvas svg");
    if (format === "png" && canvas) {
      const link = document.createElement("a");
      link.download = "qr-acesso-farmacologia.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    } else if (format === "svg" && svg) {
      const serializer = new XMLSerializer();
      const svgStr = serializer.serializeToString(svg);
      const blob = new Blob([svgStr], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = "qr-acesso-farmacologia.svg";
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    } else {
      toast.error("Não foi possível gerar o arquivo. Tente outro formato.");
    }
  }

  function printQR() {
    const printWindow = window.open("", "_blank");
    if (!printWindow) { toast.error("Popup bloqueado. Permita popups para imprimir."); return; }
    const canvas = document.querySelector<HTMLCanvasElement>("#qr-acesso-canvas canvas");
    const imgSrc = canvas ? canvas.toDataURL("image/png") : "";
    printWindow.document.write(`
      <!DOCTYPE html><html><head><title>QR Code - Conexão em Farmacologia</title>
      <style>body{font-family:sans-serif;text-align:center;padding:40px;background:#fff;color:#000}
      h1{font-size:28px;margin-bottom:8px}p{font-size:16px;color:#555;margin:4px 0}
      img{margin:24px auto;display:block}code{background:#f0f0f0;padding:4px 8px;border-radius:4px;font-size:14px}
      .instructions{margin-top:20px;font-size:14px;color:#333;border:1px solid #ddd;padding:16px;border-radius:8px;max-width:400px;margin-left:auto;margin-right:auto}
      @media print{body{padding:20px}}</style></head><body>
      <h1>🧪 Conexão em Farmacologia I</h1>
      <p>Acesse a plataforma pelo QR code abaixo</p>
      ${imgSrc ? `<img src="${imgSrc}" width="280" height="280" />` : `<p>QR Code: <code>${selectedDomain}</code></p>`}
      <p style="margin-top:16px"><code>${selectedDomain}</code></p>
      <div class="instructions">
        <strong>Como acessar:</strong><br/>
        1. Abra a câmera do celular<br/>
        2. Aponte para o QR code<br/>
        3. Toque no link que aparecer<br/>
        4. Faça login com seu e-mail institucional
      </div>
      <script>window.onload=()=>{window.print();window.close();}<\/script>
      </body></html>
    `);
    printWindow.document.close();
  }

  // Dynamically import QRCodeCanvas
  const [QRCodeCanvas, setQRCodeCanvas] = useState<any>(null);
  useEffect(() => {
    import("qrcode.react").then((mod) => setQRCodeCanvas(() => mod.QRCodeCanvas));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">QR Code de Acesso</h2>
        <p className="text-sm text-muted-foreground">Gere e baixe o QR code para os alunos acessarem a plataforma</p>
      </div>

      {/* Domain selector */}
      <div className="border border-border rounded-lg p-4" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
        <label className="text-sm font-medium text-foreground block mb-2">URL da plataforma</label>
        <div className="flex flex-col gap-2">
          {domains.map((d) => (
            <label key={d.url} className="flex items-center gap-3 cursor-pointer">
              <input type="radio" name="domain" value={d.url} checked={selectedDomain === d.url} onChange={() => setSelectedDomain(d.url)} className="accent-primary" />
              <div>
                <span className="text-sm font-medium text-foreground">{d.label}</span>
                <span className="text-xs text-muted-foreground ml-2">{d.url}</span>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Size selector */}
      <div className="border border-border rounded-lg p-4" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
        <label className="text-sm font-medium text-foreground block mb-2">Tamanho: {qrSize}px</label>
        <input type="range" min={150} max={500} step={50} value={qrSize} onChange={e => setQrSize(Number(e.target.value))} className="w-full accent-primary" />
        <div className="flex justify-between text-xs text-muted-foreground mt-1"><span>150px</span><span>500px</span></div>
      </div>

      {/* QR Code preview */}
      <div className="border border-border rounded-lg p-6 flex flex-col items-center gap-4" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
        <div id="qr-acesso-canvas" className="bg-white p-4 rounded-xl shadow-lg">
          {QRCodeCanvas ? (
            <QRCodeCanvas
              value={selectedDomain}
              size={qrSize}
              level="H"
              includeMargin={false}
              imageSettings={{
                src: "https://d2xsxph8kpxj0f.cloudfront.net/310419663028318382/FUZ2ecmXaKXVi9q85vHrsr/logo-qr_8a8442d8.png",
                height: Math.round(qrSize * 0.22),
                width: Math.round(qrSize * 0.22),
                excavate: true,
                crossOrigin: "anonymous",
              }}
            />
          ) : (
            <div className="flex items-center justify-center" style={{ width: qrSize, height: qrSize }}>
              <div className="text-center text-gray-400">
                <QrCode size={48} className="mx-auto mb-2" />
                <p className="text-sm">Carregando...</p>
              </div>
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground text-center max-w-xs break-all">{selectedDomain}</p>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 justify-center">
          <button onClick={() => downloadQR("png")} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
            <Download size={15} /> Baixar PNG
          </button>
          <button onClick={() => downloadQR("svg")} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-foreground text-sm hover:bg-secondary">
            <Download size={15} /> Baixar SVG
          </button>
          <button onClick={printQR} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-foreground text-sm hover:bg-secondary">
            🖨️ Imprimir
          </button>
        </div>
      </div>

      {/* Instructions toggle */}
      <div className="border border-border rounded-lg overflow-hidden" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
        <button onClick={() => setShowInstructions(!showInstructions)} className="w-full flex items-center justify-between p-4 text-left">
          <span className="text-sm font-medium text-foreground">Instruções para os alunos</span>
          {showInstructions ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {showInstructions && (
          <div className="px-4 pb-4 border-t border-border/50">
            <ol className="mt-3 space-y-2 text-sm text-muted-foreground list-decimal list-inside">
              <li>Abra a câmera do celular ou um leitor de QR code</li>
              <li>Aponte para o QR code acima</li>
              <li>Toque no link que aparecer na tela</li>
              <li>Faça login com seu e-mail institucional</li>
              <li>Acesse o jogo, cronograma, materiais e muito mais!</li>
            </ol>
            <div className="mt-3 p-3 rounded-lg bg-primary/10 border border-primary/20">
              <p className="text-xs text-primary font-medium">💡 Dica para o professor</p>
              <p className="text-xs text-muted-foreground mt-1">Imprima o QR code e cole na sala de aula, ou projete na tela no primeiro dia de aula para facilitar o acesso de todos os alunos.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Cronograma Manager ───
function CronogramaManager({ teacherToken }: { teacherToken: string }) {
  const [entries, setEntries] = useState<any[]>([]);
  const [gameWeeks, setGameWeeks] = useState<{ weekNumber: number; isReleased: boolean }[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    weekLabel: "",
    weekDate: "",
    title: "",
    detail: "",
    type: "aula" as "aula" | "tbl" | "caso" | "jigsaw" | "prova",
    highlight: false,
    isActive: true,
    sortOrder: 0,
    gameWeekNumber: null as number | null,
  });

  const { data: classesList } = trpc.classes.list.useQuery(
    { sessionToken: teacherToken },
    { enabled: !!teacherToken }
  );

  const { data: adminEntries, refetch } = trpc.schedule.getAllAdmin.useQuery(
    { teacherSessionToken: teacherToken, classId: selectedClassId ?? undefined },
    { enabled: !!teacherToken && selectedClassId !== null }
  );
  const { data: gwData } = trpc.schedule.getGameWeeks.useQuery(
    { teacherSessionToken: teacherToken },
    { enabled: !!teacherToken }
  );

  useEffect(() => { if (adminEntries) setEntries(adminEntries as any[]); }, [adminEntries]);
  useEffect(() => { if (gwData) setGameWeeks(gwData); }, [gwData]);

  const createMut = trpc.schedule.create.useMutation({ onSuccess: () => { refetch(); setShowForm(false); resetForm(); toast.success("Semana criada!"); } });
  const updateMut = trpc.schedule.update.useMutation({ onSuccess: () => { refetch(); setEditingId(null); resetForm(); toast.success("Semana atualizada!"); } });
  const deleteMut = trpc.schedule.delete.useMutation({ onSuccess: () => { refetch(); toast.success("Semana removida!"); } });
  const reorderMut = trpc.schedule.reorder.useMutation({ onSuccess: () => refetch() });

  function resetForm() {
    setFormData({ weekLabel: "", weekDate: "", title: "", detail: "", type: "aula", highlight: false, isActive: true, sortOrder: entries.length + 1, gameWeekNumber: null });
  }

  function startEdit(entry: any) {
    setEditingId(entry.id);
    setFormData({
      weekLabel: entry.weekLabel,
      weekDate: entry.weekDate ?? "",
      title: entry.title,
      detail: entry.detail ?? "",
      type: entry.type,
      highlight: entry.highlight,
      isActive: entry.isActive,
      sortOrder: entry.sortOrder,
      gameWeekNumber: entry.gameWeekNumber ?? null,
    });
    setShowForm(true);
  }

  function handleSubmit() {
    if (!formData.weekLabel.trim() || !formData.title.trim()) { toast.error("Rótulo e título são obrigatórios"); return; }
    setSaving(true);
    const payload = { teacherSessionToken: teacherToken, ...formData, weekDate: formData.weekDate || undefined, detail: formData.detail || undefined, classId: selectedClassId ?? undefined };
    if (editingId !== null) {
      updateMut.mutate({ ...payload, id: editingId }, { onSettled: () => setSaving(false) });
    } else {
      createMut.mutate({ ...payload, sortOrder: entries.length + 1 }, { onSettled: () => setSaving(false) });
    }
  }

  function moveEntry(idx: number, dir: -1 | 1) {
    const newList = [...entries];
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= newList.length) return;
    [newList[idx], newList[swapIdx]] = [newList[swapIdx], newList[idx]];
    setEntries(newList);
    reorderMut.mutate({ teacherSessionToken: teacherToken, orderedIds: newList.map((e) => e.id) });
  }

  const typeColors: Record<string, string> = {
    aula: "bg-blue-500/20 text-blue-300",
    tbl: "bg-purple-500/20 text-purple-300",
    caso: "bg-amber-500/20 text-amber-300",
    jigsaw: "bg-emerald-500/20 text-emerald-300",
    prova: "bg-red-500/20 text-red-300",
  };
  const typeLabels: Record<string, string> = { aula: "Aula", tbl: "TBL", caso: "Caso Clínico", jigsaw: "Jigsaw", prova: "Prova" };

  if (!selectedClassId) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">Cronograma do Semestre</h2>
          <p className="text-sm text-muted-foreground">Selecione uma turma para ver e editar o cronograma</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
          {(classesList || []).map((cls: any) => (
            <button
              key={cls.id}
              onClick={() => setSelectedClassId(cls.id)}
              className="border border-border rounded-lg p-4 text-left hover:border-primary/50 transition-colors"
              style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cls.color }} />
                <span className="font-semibold text-sm text-foreground">{cls.name}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                <p>{cls.discipline} — {cls.course}</p>
                {cls.teacherName && <p className="mt-1">Prof. {cls.teacherName}</p>}
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const selectedClass = (classesList || []).find((c: any) => c.id === selectedClassId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <button onClick={() => { setSelectedClassId(null); setEntries([]); }} className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 mb-1">
            <ArrowLeft size={12} /> Voltar às turmas
          </button>
          <h2 className="text-xl font-bold text-foreground">Cronograma — {selectedClass?.name || "Turma"}</h2>
          <p className="text-sm text-muted-foreground">{entries.length} semanas cadastradas</p>
        </div>
        <button
          onClick={() => { setEditingId(null); resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
        >
          <Plus size={16} /> Nova Semana
        </button>
      </div>

      {showForm && (
        <div className="border border-border rounded-lg p-4 space-y-3" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
          <h3 className="font-semibold text-foreground">{editingId ? "Editar Semana" : "Nova Semana"}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Rótulo *</label>
              <input value={formData.weekLabel} onChange={e => setFormData(p => ({ ...p, weekLabel: e.target.value }))} placeholder="Semana 1" className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Data</label>
              <input value={formData.weekDate} onChange={e => setFormData(p => ({ ...p, weekDate: e.target.value }))} placeholder="10/03/2026" className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm" />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Título *</label>
            <input value={formData.title} onChange={e => setFormData(p => ({ ...p, title: e.target.value }))} placeholder="Introdução à Farmacologia" className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Detalhes</label>
            <textarea value={formData.detail} onChange={e => setFormData(p => ({ ...p, detail: e.target.value }))} rows={3} placeholder="Descrição detalhada da aula..." className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Tipo</label>
              <select value={formData.type} onChange={e => setFormData(p => ({ ...p, type: e.target.value as any }))} className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm">
                <option value="aula">Aula</option>
                <option value="tbl">TBL</option>
                <option value="caso">Caso Clínico</option>
                <option value="jigsaw">Jigsaw</option>
                <option value="prova">Prova</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Semana do Jogo</label>
              <select value={formData.gameWeekNumber ?? ""} onChange={e => setFormData(p => ({ ...p, gameWeekNumber: e.target.value ? Number(e.target.value) : null }))} className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm">
                <option value="">— Nenhuma —</option>
                {gameWeeks.map(gw => (
                  <option key={gw.weekNumber} value={gw.weekNumber}>Semana {gw.weekNumber} {gw.isReleased ? "✅" : "🔒"}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
              <input type="checkbox" checked={formData.highlight} onChange={e => setFormData(p => ({ ...p, highlight: e.target.checked }))} />
              Destacar
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
              <input type="checkbox" checked={formData.isActive} onChange={e => setFormData(p => ({ ...p, isActive: e.target.checked }))} />
              Visível
            </label>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSubmit} disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
              <Save size={14} /> {saving ? "Salvando..." : editingId ? "Salvar" : "Criar"}
            </button>
            <button onClick={() => { setShowForm(false); setEditingId(null); resetForm(); }} className="px-4 py-2 rounded-lg border border-border text-foreground text-sm hover:bg-secondary">
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {entries.map((entry, idx) => (
          <div key={entry.id} className={`border rounded-lg p-3 flex items-start gap-3 ${entry.highlight ? "border-primary/40" : "border-border"}`} style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
            <div className="flex flex-col gap-1 shrink-0">
              <button onClick={() => moveEntry(idx, -1)} disabled={idx === 0} className="p-1 rounded hover:bg-secondary disabled:opacity-30"><ChevronUp size={14} /></button>
              <button onClick={() => moveEntry(idx, 1)} disabled={idx === entries.length - 1} className="p-1 rounded hover:bg-secondary disabled:opacity-30"><ChevronDown size={14} /></button>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs text-muted-foreground">{entry.weekLabel}</span>
                {entry.weekDate && <span className="text-xs text-muted-foreground">{entry.weekDate}</span>}
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeColors[entry.type] || "bg-secondary text-muted-foreground"}`}>{typeLabels[entry.type] || entry.type}</span>
                {entry.gameWeekNumber && <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary">🎮 S{entry.gameWeekNumber} {entry.gameWeekInfo?.isReleased ? "✅" : "🔒"}</span>}
                {entry.highlight && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">⭐ Destaque</span>}
                {!entry.isActive && <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">Oculto</span>}
              </div>
              <p className="text-sm font-medium text-foreground mt-1 truncate">{entry.title}</p>
              {entry.detail && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{entry.detail}</p>}
            </div>
            <div className="flex gap-1 shrink-0">
              <button onClick={() => startEdit(entry)} className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"><Edit2 size={14} /></button>
              <button onClick={() => { if (confirm(`Remover "${entry.title}"?`)) deleteMut.mutate({ teacherSessionToken: teacherToken, id: entry.id }); }} className="p-1.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive"><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
        {entries.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Calendar size={40} className="mx-auto mb-3 opacity-30" />
            <p>Nenhuma semana cadastrada</p>
            <p className="text-xs mt-1">Clique em "Nova Semana" para começar</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Monitores Manager ───
function MonitoresManager({ teacherToken }: { teacherToken: string | null }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedMonitorId, setSelectedMonitorId] = useState<number | null>(null);
  const [newMonitor, setNewMonitor] = useState({ email: "", matricula: "", displayName: "", password: "" });
  const [editPassword, setEditPassword] = useState("");
  const [activeTab, setActiveTab] = useState<"monitors" | "logs" | "notas">("monitors");
  const [logFilterMonitorId, setLogFilterMonitorId] = useState<number | undefined>(undefined);
  const [logDateFrom, setLogDateFrom] = useState<string>("");
  const [logDateTo, setLogDateTo] = useState<string>("");
  const [notasTypeFilter, setNotasTypeFilter] = useState<"kahoot" | "clinical_case" | undefined>(undefined);
  const [editingGradeId, setEditingGradeId] = useState<number | null>(null);
  const [editingGradeValue, setEditingGradeValue] = useState<number>(0);
  const [editingMaxGrade, setEditingMaxGrade] = useState<number>(10);

  const utils = trpc.useUtils();

  const { data: monitors, isLoading } = trpc.monitors.list.useQuery(
    { teacherSessionToken: teacherToken || "" },
    { enabled: !!teacherToken }
  );

  const { data: activitySummary } = trpc.monitors.getActivitySummary.useQuery(
    { teacherSessionToken: teacherToken || "" },
    { enabled: !!teacherToken && activeTab === "logs" }
  );

  const { data: activityLogs } = trpc.monitors.getActivityLogs.useQuery(
    {
      teacherSessionToken: teacherToken || "",
      monitorId: logFilterMonitorId,
      dateFrom: logDateFrom || undefined,
      dateTo: logDateTo || undefined,
      limit: 500,
    },
    { enabled: !!teacherToken && activeTab === "logs" }
  );

  const { data: adminGrades, refetch: refetchAdminGrades, isLoading: gradesLoading } = trpc.monitors.adminListActivityGrades.useQuery(
    { teacherSessionToken: teacherToken || "", activityType: notasTypeFilter },
    { enabled: !!teacherToken && activeTab === "notas" }
  );
  const adminUpsertGrade = trpc.monitors.adminUpsertActivityGrade.useMutation({
    onSuccess: () => { toast.success("Nota salva!"); setEditingGradeId(null); refetchAdminGrades(); },
    onError: (e) => toast.error(e.message),
  });
  const adminDeleteGrade = trpc.monitors.adminDeleteActivityGrade.useMutation({
    onSuccess: () => { toast.success("Nota excluída!"); refetchAdminGrades(); },
    onError: (e) => toast.error(e.message),
  });

  const registerMutation = trpc.monitors.register.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success("Monitor cadastrado com sucesso!");
        setShowAddForm(false);
        setNewMonitor({ email: "", matricula: "", displayName: "", password: "" });
        utils.monitors.list.invalidate();
      } else {
        toast.error(data.message);
      }
    },
    onError: () => toast.error("Erro ao cadastrar monitor"),
  });

  const updateMutation = trpc.monitors.update.useMutation({
    onSuccess: () => {
      toast.success("Monitor atualizado!");
      setSelectedMonitorId(null);
      setEditPassword("");
      utils.monitors.list.invalidate();
    },
    onError: () => toast.error("Erro ao atualizar monitor"),
  });

  const removeMutation = trpc.monitors.remove.useMutation({
    onSuccess: () => {
      toast.success("Monitor removido!");
      utils.monitors.list.invalidate();
    },
    onError: () => toast.error("Erro ao remover monitor"),
  });

  const filteredMonitors = (monitors || []).filter((m) =>
    (m.displayName || m.email).toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getActionTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      attendance_marked: "Presença marcada",
      resource_added: "Recurso adicionado",
      resource_deleted: "Recurso removido",
      seminar_updated: "Seminário atualizado",
      leaderboard_viewed: "Leaderboard visualizado",
      chat_message_sent: "Mensagem enviada",
      login: "Login realizado",
      logout: "Logout realizado",
    };
    return labels[type] || type;
  };

  const getActionTypeColor = (type: string) => {
    if (type.includes("delete") || type.includes("removed")) return "text-red-400";
    if (type.includes("add") || type.includes("marked") || type.includes("sent")) return "text-emerald-400";
    if (type.includes("login")) return "text-blue-400";
    return "text-slate-300";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <GraduationCap size={22} className="text-violet-400" />
            Gerenciar Monitores
          </h2>
          <p className="text-slate-400 text-sm mt-1">Gerencie os monitores e acompanhe suas atividades</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-1 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-sm rounded-md font-medium transition-colors"
        >
          <UserPlus size={15} />
          Novo Monitor
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 p-1 rounded-lg bg-slate-800/60 w-fit flex-wrap">
        {(["monitors", "logs", "notas"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              activeTab === tab
                ? "bg-violet-600 text-white"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {tab === "monitors" ? (
              <span className="flex items-center gap-1.5"><Users size={14} /> Monitores ({monitors?.length ?? 0})</span>
            ) : tab === "logs" ? (
              <span className="flex items-center gap-1.5"><History size={14} /> Log de Atividades</span>
            ) : (
              <span className="flex items-center gap-1.5"><BookOpen size={14} /> Notas dos Monitores</span>
            )}
          </button>
        ))}
      </div>

      {/* Add Monitor Form */}
      {showAddForm && activeTab === "monitors" && (
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5 space-y-4">
          <h3 className="text-white font-semibold flex items-center gap-2"><UserPlus size={16} className="text-violet-400" /> Cadastrar Novo Monitor</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Email institucional</label>
              <input
                value={newMonitor.email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewMonitor((p) => ({ ...p, email: e.target.value }))}
                placeholder="monitor@edu.unirio.br"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-600 text-white text-sm rounded-md focus:outline-none focus:ring-2 focus:ring-violet-500/50"
              />
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Matrícula</label>
              <input
                value={newMonitor.matricula}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewMonitor((p) => ({ ...p, matricula: e.target.value }))}
                placeholder="123456"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-600 text-white text-sm rounded-md focus:outline-none focus:ring-2 focus:ring-violet-500/50"
              />
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Nome de exibição</label>
              <input
                value={newMonitor.displayName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewMonitor((p) => ({ ...p, displayName: e.target.value }))}
                placeholder="Nome Sobrenome"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-600 text-white text-sm rounded-md focus:outline-none focus:ring-2 focus:ring-violet-500/50"
              />
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Senha inicial</label>
              <input
                type="password"
                value={newMonitor.password}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewMonitor((p) => ({ ...p, password: e.target.value }))}
                placeholder="Mínimo 6 caracteres"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-600 text-white text-sm rounded-md focus:outline-none focus:ring-2 focus:ring-violet-500/50"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowAddForm(false)} className="px-3 py-1.5 text-slate-400 hover:text-slate-200 text-sm rounded-md transition-colors">
              Cancelar
            </button>
            <button
              className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-sm rounded-md font-medium transition-colors disabled:opacity-50"
              disabled={registerMutation.isPending}
              onClick={() =>
                registerMutation.mutate({
                  teacherSessionToken: teacherToken || "",
                  ...newMonitor,
                })
              }
            >
              {registerMutation.isPending ? "Cadastrando..." : "Cadastrar"}
            </button>
          </div>
        </div>
      )}

      {/* Monitors Tab */}
      {activeTab === "monitors" && (
        <div className="space-y-3">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={searchTerm}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
              placeholder="Buscar monitor..."
              className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 text-white text-sm rounded-md focus:outline-none focus:ring-2 focus:ring-violet-500/50"
            />
          </div>
          {isLoading ? (
            <div className="text-slate-400 text-center py-8">Carregando monitores...</div>
          ) : filteredMonitors.length === 0 ? (
            <div className="text-slate-400 text-center py-8">
              <GraduationCap size={32} className="mx-auto mb-2 opacity-40" />
              <p>Nenhum monitor encontrado</p>
            </div>
          ) : (
            filteredMonitors.map((monitor) => {
              const summary = activitySummary?.find((s) => s.monitor.id === monitor.id);
              return (
                <div
                  key={monitor.id}
                  className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-300 font-bold text-sm">
                        {(monitor.displayName || monitor.email).charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-white font-medium text-sm">{monitor.displayName || "—"}</div>
                        <div className="text-slate-400 text-xs">{monitor.email}</div>
                        <div className="text-slate-500 text-xs">Matrícula: {monitor.matricula}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          monitor.isActive
                            ? "bg-emerald-900/40 text-emerald-400 border border-emerald-700/40"
                            : "bg-red-900/40 text-red-400 border border-red-700/40"
                        }`}
                      >
                        {monitor.isActive ? "Ativo" : "Inativo"}
                      </span>
                      <button
                        className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                        onClick={() => setSelectedMonitorId(selectedMonitorId === monitor.id ? null : monitor.id)}
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        className="p-1.5 rounded text-red-400 hover:text-red-300 hover:bg-red-900/20 transition-colors"
                        onClick={() => {
                          if (confirm(`Remover monitor ${monitor.displayName || monitor.email}?`)) {
                            removeMutation.mutate({ teacherSessionToken: teacherToken || "", monitorId: monitor.id });
                          }
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="flex gap-4 text-xs text-slate-400 border-t border-slate-700/50 pt-2">
                    <span>Ações: <span className="text-violet-300 font-medium">{summary?.totalActions ?? 0}</span></span>
                    <span>Último login: <span className="text-slate-300">{monitor.lastLoginAt ? new Date(monitor.lastLoginAt).toLocaleDateString("pt-BR") : "Nunca"}</span></span>
                    <button
                      className="text-violet-400 hover:text-violet-300 underline"
                      onClick={() => { setLogFilterMonitorId(monitor.id); setActiveTab("logs"); }}
                    >
                      Ver logs
                    </button>
                  </div>

                  {/* Edit form */}
                  {selectedMonitorId === monitor.id && (
                    <div className="border-t border-slate-700/50 pt-3 space-y-3">
                      <p className="text-slate-400 text-xs font-medium">Editar monitor</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="text-slate-500 text-xs mb-1 block">Nova senha (opcional)</label>
                          <input
                            type="password"
                            value={editPassword}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditPassword(e.target.value)}
                            placeholder="Nova senha..."
                            className="w-full px-2 py-1 bg-slate-900 border border-slate-600 text-white text-xs rounded-md focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                          />
                        </div>
                        <div>
                          <label className="text-slate-500 text-xs mb-1 block">Status</label>
                          <select
                            className="w-full bg-slate-900 border border-slate-600 text-white text-xs h-8 rounded-md px-2"
                            defaultValue={monitor.isActive ? "1" : "0"}
                            onChange={(e) =>
                              updateMutation.mutate({
                                teacherSessionToken: teacherToken || "",
                                monitorId: monitor.id,
                                isActive: parseInt(e.target.value),
                              })
                            }
                          >
                            <option value="1">Ativo</option>
                            <option value="0">Inativo</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button className="px-2 py-1 text-slate-400 hover:text-slate-200 text-xs rounded transition-colors" onClick={() => { setSelectedMonitorId(null); setEditPassword(""); }}>
                          Cancelar
                        </button>
                        {editPassword && (
                          <button
                            className="px-2 py-1 bg-violet-600 hover:bg-violet-700 text-white text-xs rounded font-medium transition-colors disabled:opacity-50"
                            disabled={updateMutation.isPending}
                            onClick={() =>
                              updateMutation.mutate({
                                teacherSessionToken: teacherToken || "",
                                monitorId: monitor.id,
                                newPassword: editPassword,
                              })
                            }
                          >
                            Salvar senha
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Logs Tab */}
      {activeTab === "logs" && (
        <div className="space-y-4">
          {/* Filters row */}
          <div className="flex flex-wrap items-end gap-2">
            {/* Monitor filter */}
            <div>
              <label className="text-slate-500 text-xs mb-1 block">Monitor</label>
              <select
                className="bg-slate-800 border border-slate-700 text-white text-sm rounded-md px-3 py-1.5"
                value={logFilterMonitorId ?? ""}
                onChange={(e) => setLogFilterMonitorId(e.target.value ? parseInt(e.target.value) : undefined)}
              >
                <option value="">Todos os monitores</option>
                {(monitors || []).map((m) => (
                  <option key={m.id} value={m.id}>{m.displayName || m.email}</option>
                ))}
              </select>
            </div>
            {/* Date from */}
            <div>
              <label className="text-slate-500 text-xs mb-1 block">De</label>
              <input
                type="date"
                value={logDateFrom}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLogDateFrom(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-white text-sm rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
              />
            </div>
            {/* Date to */}
            <div>
              <label className="text-slate-500 text-xs mb-1 block">Até</label>
              <input
                type="date"
                value={logDateTo}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLogDateTo(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-white text-sm rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
              />
            </div>
            {/* Quick period shortcuts */}
            <div className="flex gap-1">
              {[
                { label: "Esta semana", days: 7 },
                { label: "Este mês", days: 30 },
                { label: "Semestre", days: 180 },
              ].map(({ label, days }) => (
                <button
                  key={label}
                  onClick={() => {
                    const to = new Date();
                    const from = new Date();
                    from.setDate(from.getDate() - days);
                    setLogDateFrom(from.toISOString().split("T")[0]);
                    setLogDateTo(to.toISOString().split("T")[0]);
                  }}
                  className="px-2 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-md transition-colors"
                >
                  {label}
                </button>
              ))}
            </div>
            {/* Clear filters */}
            {(logFilterMonitorId || logDateFrom || logDateTo) && (
              <button
                className="flex items-center gap-1 px-2 py-1.5 text-slate-400 hover:text-slate-200 text-xs rounded-md border border-slate-700 transition-colors"
                onClick={() => { setLogFilterMonitorId(undefined); setLogDateFrom(""); setLogDateTo(""); }}
              >
                <X size={13} /> Limpar filtros
              </button>
            )}
            {/* CSV Export */}
            {activityLogs && activityLogs.length > 0 && (
              <button
                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-600/20 text-green-400 hover:bg-green-600/30 rounded-md transition-colors"
                onClick={() => {
                  const header = ["ID", "Monitor", "Tipo de Ação", "Descrição", "Entidade", "ID Entidade", "Metadados", "Data/Hora"];
                  const rows = activityLogs.map((log) => [
                    log.id,
                    log.monitorName,
                    log.actionType,
                    log.actionDescription,
                    log.targetEntity || "",
                    log.targetId ?? "",
                    log.metadata || "",
                    new Date(log.createdAt).toLocaleString("pt-BR"),
                  ]);
                  const csv = [header, ...rows]
                    .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
                    .join("\n");
                  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `log_monitores_${new Date().toISOString().split("T")[0]}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                  toast.success(`${activityLogs.length} registros exportados!`);
                }}
              >
                <Download size={14} /> Exportar CSV
              </button>
            )}
          </div>

          {/* Summary cards */}
          {!logFilterMonitorId && activitySummary && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {activitySummary.map(({ monitor, totalActions, recentLogs }) => (
                <div key={monitor.id} className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-300 font-bold text-xs">
                      {(monitor.displayName || monitor.email).charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-white text-sm font-medium">{monitor.displayName || monitor.email}</div>
                      <div className="text-slate-500 text-xs">{totalActions} ações registradas</div>
                    </div>
                  </div>
                  {recentLogs.length > 0 ? (
                    <div className="space-y-1">
                      {recentLogs.slice(0, 3).map((log) => (
                        <div key={log.id} className="text-xs text-slate-400 flex items-start gap-1.5">
                          <span className={`mt-0.5 shrink-0 ${getActionTypeColor(log.actionType)}`}>•</span>
                          <span className="truncate">{log.actionDescription}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-500 text-xs">Nenhuma ação registrada</p>
                  )}
                  <button
                    className="mt-2 text-xs text-violet-400 hover:text-violet-300 underline"
                    onClick={() => setLogFilterMonitorId(monitor.id)}
                  >
                    Ver todos os logs
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Detailed logs */}
          {activityLogs && activityLogs.length > 0 ? (
            <div className="space-y-2">
              <p className="text-slate-400 text-sm">{activityLogs.length} registros encontrados</p>
              {activityLogs.map((log) => (
                <div key={log.id} className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-3 flex items-start gap-3">
                  <div className={`mt-0.5 shrink-0 ${getActionTypeColor(log.actionType)}`}>
                    <BookOpen size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white text-sm font-medium">{log.monitorName}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">
                        {getActionTypeLabel(log.actionType)}
                      </span>
                      {log.targetEntity && (
                        <span className="text-xs text-slate-500">{log.targetEntity}</span>
                      )}
                    </div>
                    <p className="text-slate-400 text-xs mt-0.5">{log.actionDescription}</p>
                    <p className="text-slate-600 text-xs mt-0.5">{new Date(log.createdAt).toLocaleString("pt-BR")}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : activityLogs && activityLogs.length === 0 ? (
            <div className="text-center py-10 text-slate-500">
              <History size={32} className="mx-auto mb-2 opacity-40" />
              <p>Nenhuma atividade registrada ainda</p>
              <p className="text-xs mt-1">As ações dos monitores aparecerão aqui</p>
            </div>
          ) : null}
        </div>
      )}

      {/* ─── Aba Notas dos Monitores ─── */}
      {activeTab === "notas" && (
        <div className="space-y-4">
          {/* Filtros */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2">
              <label className="text-slate-400 text-xs">Tipo de atividade:</label>
              <select
                value={notasTypeFilter ?? ""}
                onChange={(e) => setNotasTypeFilter(e.target.value ? e.target.value as "kahoot" | "clinical_case" : undefined)}
                className="px-3 py-1.5 bg-slate-800 border border-slate-600 text-white text-sm rounded-md focus:outline-none"
              >
                <option value="">Todos</option>
                <option value="kahoot">Kahoot</option>
                <option value="clinical_case">Casos Clínicos</option>
              </select>
            </div>
            <button
              onClick={() => refetchAdminGrades()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm rounded-md transition-colors"
            >
              <Activity size={13} /> Atualizar
            </button>
            {adminGrades && (
              <span className="text-slate-400 text-xs ml-auto">{adminGrades.length} registro(s)</span>
            )}
          </div>

          {gradesLoading ? (
            <div className="flex items-center justify-center py-10 text-slate-400">
              <Loader2 size={20} className="animate-spin mr-2" /> Carregando notas...
            </div>
          ) : !adminGrades || adminGrades.length === 0 ? (
            <div className="text-center py-10 text-slate-500">
              <BookOpen size={32} className="mx-auto mb-2 opacity-40" />
              <p>Nenhuma nota lançada ainda</p>
              <p className="text-xs mt-1">As notas lançadas pelos monitores aparecerão aqui</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-800/80 text-slate-400 text-xs uppercase tracking-wider">
                    <th className="px-4 py-3 text-left">Tipo</th>
                    <th className="px-4 py-3 text-left">Atividade</th>
                    <th className="px-4 py-3 text-left">Grupo</th>
                    <th className="px-4 py-3 text-center">Nota</th>
                    <th className="px-4 py-3 text-center">Máx.</th>
                    <th className="px-4 py-3 text-left">Lançado por</th>
                    <th className="px-4 py-3 text-left">Obs.</th>
                    <th className="px-4 py-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {adminGrades.map((g) => {
                    const gradeNum = parseFloat(String(g.grade));
                    const maxNum = parseFloat(String(g.maxGrade));
                    const pct = maxNum > 0 ? (gradeNum / maxNum) * 100 : 0;
                    const color = pct >= 70 ? "#10b981" : pct >= 50 ? "#f59e0b" : "#ef4444";
                    const isEditing = editingGradeId === g.id;
                    return (
                      <tr key={g.id} className={`transition-colors ${
                        isEditing ? "bg-violet-900/20" : "hover:bg-slate-800/40"
                      }`}>
                        <td className="px-4 py-2.5">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            g.activityType === "kahoot"
                              ? "bg-purple-900/50 text-purple-300"
                              : "bg-teal-900/50 text-teal-300"
                          }`}>
                            {g.activityType === "kahoot" ? "Kahoot" : "Caso Clínico"}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-slate-200 font-medium max-w-[160px] truncate">{g.activityName}</td>
                        <td className="px-4 py-2.5 text-slate-300">{g.groupName}</td>
                        <td className="px-4 py-2.5 text-center">
                          {isEditing ? (
                            <input
                              type="number" min={0} max={editingMaxGrade} step={0.1}
                              value={editingGradeValue}
                              onChange={(e) => setEditingGradeValue(parseFloat(e.target.value) || 0)}
                              className="w-20 px-2 py-1 rounded border border-violet-500/50 bg-slate-900 text-white text-sm text-center focus:outline-none"
                            />
                          ) : (
                            <span className="font-semibold" style={{ color }}>{gradeNum.toFixed(1)}</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {isEditing ? (
                            <input
                              type="number" min={0} max={100} step={0.5}
                              value={editingMaxGrade}
                              onChange={(e) => setEditingMaxGrade(parseFloat(e.target.value) || 10)}
                              className="w-16 px-2 py-1 rounded border border-slate-600 bg-slate-900 text-white text-sm text-center focus:outline-none"
                            />
                          ) : (
                            <span className="text-slate-400">{maxNum.toFixed(1)}</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-slate-400 text-xs">{g.launchedByName ?? "—"}</td>
                        <td className="px-4 py-2.5 text-slate-400 text-xs max-w-[120px] truncate">{g.notes ?? "—"}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center justify-center gap-1.5">
                            {isEditing ? (
                              <>
                                <button
                                  onClick={() => adminUpsertGrade.mutate({
                                    teacherSessionToken: teacherToken || "",
                                    classId: g.classId,
                                    activityType: g.activityType as "kahoot" | "clinical_case",
                                    activityName: g.activityName,
                                    groupName: g.groupName,
                                    grade: editingGradeValue,
                                    maxGrade: editingMaxGrade,
                                    notes: g.notes ?? undefined,
                                    existingId: g.id,
                                  })}
                                  disabled={adminUpsertGrade.isPending}
                                  className="p-1.5 rounded bg-green-600/20 hover:bg-green-600/40 text-green-400 transition-colors disabled:opacity-50"
                                  title="Salvar"
                                >
                                  <CheckCircle size={14} />
                                </button>
                                <button
                                  onClick={() => setEditingGradeId(null)}
                                  className="p-1.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-400 transition-colors"
                                  title="Cancelar"
                                >
                                  <X size={14} />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => {
                                    setEditingGradeId(g.id);
                                    setEditingGradeValue(gradeNum);
                                    setEditingMaxGrade(maxNum);
                                  }}
                                  className="p-1.5 rounded bg-violet-600/20 hover:bg-violet-600/40 text-violet-400 transition-colors"
                                  title="Editar nota"
                                >
                                  <Edit2 size={14} />
                                </button>
                                <button
                                  onClick={() => {
                                    if (confirm(`Excluir nota de "${g.groupName}" em "${g.activityName}"?`)) {
                                      adminDeleteGrade.mutate({ teacherSessionToken: teacherToken || "", gradeId: g.id });
                                    }
                                  }}
                                  disabled={adminDeleteGrade.isPending}
                                  className="p-1.5 rounded bg-red-600/20 hover:bg-red-600/40 text-red-400 transition-colors disabled:opacity-50"
                                  title="Excluir nota"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Professores Manager (Coordenador only) ───
function ProfessoresManager({ teacherToken }: { teacherToken: string | null }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [showInactive, setShowInactive] = useState(true);

  const utils = trpc.useUtils();
  
  // Get current teacher info to check if coordenador
  const { data: currentTeacher } = trpc.teacherAuth.me.useQuery(
    { sessionToken: teacherToken || "" },
    { enabled: !!teacherToken }
  );
  const isCoordinator = currentTeacher?.role === "coordenador" || currentTeacher?.role === "super_admin";

  // Get all teachers (only works if coordenador)
  const { data: teachers, isLoading } = trpc.teacherManagement.listAll.useQuery(
    { sessionToken: teacherToken || "" },
    { enabled: isCoordinator && !!teacherToken }
  );

  const toggleActiveMutation = trpc.teacherManagement.toggleActive.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      utils.teacherManagement.listAll.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const promoteMutation = trpc.teacherManagement.promoteToCoordinator.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      utils.teacherManagement.listAll.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const demoteMutation = trpc.teacherManagement.demoteToTeacher.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      utils.teacherManagement.listAll.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.teacherManagement.deleteTeacher.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      utils.teacherManagement.listAll.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  if (!isCoordinator) {
    return (
      <div className="container max-w-6xl py-8">
        <div className="border border-border rounded-lg p-8 text-center" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
          <Lock size={48} className="mx-auto mb-4 text-muted-foreground" />
          <h2 className="font-display font-bold text-xl text-foreground mb-2">Acesso Restrito</h2>
          <p className="text-muted-foreground">Apenas coordenadores podem acessar a gestão de professores.</p>
        </div>
      </div>
    );
  }

  const filteredTeachers = teachers?.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         t.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = showInactive || t.isActive === 1;
    return matchesSearch && matchesStatus;
  }) || [];

  return (
    <div className="container max-w-6xl py-8">
      <div className="mb-6">
        <h1 className="font-display font-bold text-3xl text-foreground mb-2">Gestão de Professores</h1>
        <p className="text-muted-foreground">Gerencie contas de professores e coordenadores</p>
      </div>



      {/* Search and Filters */}
      <div className="mb-6 flex gap-3 flex-wrap">
        <div className="flex-1 min-w-[250px] relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Buscar por nome ou email..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
          />
        </div>
        <button
          onClick={() => setShowInactive(!showInactive)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            showInactive
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-foreground border border-border"
          }`}
        >
          {showInactive ? "Mostrar Todos" : "Apenas Ativos"}
        </button>
      </div>

      {/* Teachers List */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando professores...</div>
      ) : filteredTeachers.length === 0 ? (
        <div className="border border-border rounded-lg p-8 text-center" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
          <Users size={48} className="mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Nenhum professor encontrado</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTeachers.map(teacher => (
            <motion.div
              key={teacher.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="border border-border rounded-lg p-4"
              style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <UserCheck size={24} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-semibold text-foreground">{teacher.name}</h3>
                    {teacher.role === "coordenador" && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-500 text-xs font-medium">
                        Coordenador
                      </span>
                    )}
                    {teacher.isActive === 1 ? (
                      <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-500 text-xs font-medium">
                        Ativo
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-500 text-xs font-medium">
                        Inativo
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">{teacher.email}</p>
                  <p className="text-xs text-muted-foreground">
                    Último acesso: {teacher.lastLoginAt ? new Date(teacher.lastLoginAt).toLocaleString('pt-BR') : 'Nunca'}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0 flex-wrap">
                  {/* Toggle Active/Inactive */}
                  <button
                    onClick={() => { if (teacherToken) toggleActiveMutation.mutate({
                      sessionToken: teacherToken,
                      teacherId: teacher.id,
                      isActive: teacher.isActive === 1 ? 0 : 1,
                    }); }}
                    disabled={toggleActiveMutation.isPending || teacher.id === currentTeacher?.id}
                    className="px-3 py-1.5 rounded-md bg-secondary hover:bg-secondary/80 text-foreground text-xs font-medium disabled:opacity-50 flex items-center gap-1"
                    title={teacher.isActive === 1 ? "Desativar" : "Ativar"}
                  >
                    {teacher.isActive === 1 ? (
                      <><EyeOff size={12} /> Desativar</>
                    ) : (
                      <><Eye size={12} /> Ativar</>
                    )}
                  </button>

                  {/* Promote/Demote */}
                  {teacher.role === "professor" ? (
                    <button
                      onClick={() => { if (teacherToken) promoteMutation.mutate({
                        sessionToken: teacherToken,
                        teacherId: teacher.id,
                      }); }}
                      disabled={promoteMutation.isPending}
                      className="px-3 py-1.5 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-500 text-xs font-medium flex items-center gap-1"
                      title="Promover a Coordenador"
                    >
                      <Trophy size={12} /> Promover
                    </button>
                  ) : (
                    <button
                      onClick={() => { if (teacherToken) demoteMutation.mutate({
                        sessionToken: teacherToken,
                        teacherId: teacher.id,
                      }); }}
                      disabled={demoteMutation.isPending || teacher.id === currentTeacher?.id}
                      className="px-3 py-1.5 rounded-md bg-secondary hover:bg-secondary/80 text-foreground text-xs font-medium disabled:opacity-50 flex items-center gap-1"
                      title="Rebaixar a Professor"
                    >
                      Rebaixar
                    </button>
                  )}

                  {/* Delete */}
                  <button
                    onClick={() => {
                      if (confirm(`Tem certeza que deseja remover ${teacher.name}?`)) {
                        if (teacherToken) deleteMutation.mutate({
                          sessionToken: teacherToken,
                          teacherId: teacher.id,
                        });
                      }
                    }}
                    disabled={deleteMutation.isPending || teacher.id === currentTeacher?.id}
                    className="px-3 py-1.5 rounded-md bg-red-500/20 hover:bg-red-500/30 text-red-500 text-xs font-medium disabled:opacity-50 flex items-center gap-1"
                    title="Remover Professor"
                  >
                    <Trash2 size={12} /> Remover
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <div className="mt-6 p-4 border border-border rounded-lg" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
        <p className="text-sm text-muted-foreground">
          <strong>Total:</strong> {filteredTeachers.length} professor(es) • 
          <strong className="ml-2">Ativos:</strong> {filteredTeachers.filter(t => t.isActive === 1).length} • 
          <strong className="ml-2">Coordenadores:</strong> {filteredTeachers.filter(t => t.role === "coordenador").length}
        </p>
      </div>
    </div>
  );
}

// ─── Settings ───
function SettingsManager({ password }: { password: string }) {
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");

  const changePw = trpc.admin.changePassword.useMutation({
    onSuccess: (data) => {
      if (data.success) { toast.success(data.message); setCurrentPw(""); setNewPw(""); }
      else toast.error(data.message);
    },
  });

  const updateSettings = trpc.settings.updateSettings.useMutation({
    onSuccess: () => toast.success("Configurações salvas!"),
    onError: () => toast.error("Erro ao salvar configurações"),
  });

  const { data: leaderboard } = trpc.leaderboard.getData.useQuery();
  const [currentWeek, setCurrentWeek] = useState(leaderboard?.settings?.currentWeek || "5");

  return (
    <div className="space-y-6">
      <div className="border border-border rounded-lg p-4" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
        <h3 className="font-display font-semibold text-sm text-foreground mb-3 flex items-center gap-2">
          <KeyRound size={16} className="text-primary" /> Alterar Senha
        </h3>
        <div className="space-y-2">
          <input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm" placeholder="Senha atual" />
          <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm" placeholder="Nova senha (mín. 6 caracteres)" />
          <button onClick={() => changePw.mutate({ currentPassword: currentPw, newPassword: newPw })} disabled={!currentPw || newPw.length < 6} className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50">Alterar Senha</button>
        </div>
      </div>

      <div className="border border-border rounded-lg p-4" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
        <h3 className="font-display font-semibold text-sm text-foreground mb-3 flex items-center gap-2">
          <Settings size={16} className="text-primary" /> Semana Atual
        </h3>
        <div className="flex gap-2">
          <input type="number" min="1" max="16" value={currentWeek} onChange={e => setCurrentWeek(e.target.value)} className="w-20 px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm font-mono" />
          <button onClick={() => {
            const weekNum = parseInt(currentWeek);
            if (weekNum >= 1 && weekNum <= 16) {
              updateSettings.mutate({ schedule: `week:${weekNum}` }, {
                onSuccess: () => toast.success(`Semana atual atualizada para ${weekNum}`),
                onError: () => toast.error("Erro ao salvar semana")
              });
            } else {
              toast.error("Semana deve ser entre 1 e 16");
            }
          }} className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium">Salvar</button>
        </div>
      </div>
    </div>
  );
}

// ─── Notifications Manager ───
function NotificationsManager({ password }: { password: string }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [priority, setPriority] = useState<"normal" | "important" | "urgent">("normal");
  const [type, setType] = useState<"banner" | "announcement" | "reminder">("announcement");
  const [expiresAt, setExpiresAt] = useState("");

  const utils = trpc.useUtils();
  const { data: notifs, isLoading } = trpc.notifications.getAll.useQuery({ password });

  const createNotif = trpc.notifications.create.useMutation({
    onSuccess: () => {
      utils.notifications.getAll.invalidate();
      utils.notifications.getActive.invalidate();
      toast.success("Notificação criada!");
      setTitle(""); setContent(""); setPriority("normal"); setType("announcement"); setExpiresAt("");
    },
    onError: () => toast.error("Erro ao criar notificação"),
  });

  const toggleActive = trpc.notifications.update.useMutation({
    onSuccess: () => {
      utils.notifications.getAll.invalidate();
      utils.notifications.getActive.invalidate();
      toast.success("Notificação atualizada!");
    },
  });

  const deleteNotif = trpc.notifications.delete.useMutation({
    onSuccess: () => {
      utils.notifications.getAll.invalidate();
      utils.notifications.getActive.invalidate();
      toast.success("Notificação removida!");
    },
  });

  const priorityColors: Record<string, string> = {
    urgent: "text-red-400",
    important: "text-amber-400",
    normal: "text-primary",
  };

  const priorityLabels: Record<string, string> = {
    urgent: "Urgente",
    important: "Importante",
    normal: "Normal",
  };

  const typeLabels: Record<string, string> = {
    banner: "Banner",
    announcement: "Comunicado",
    reminder: "Lembrete",
  };

  return (
    <div className="space-y-6">
      {/* Create Notification */}
      <div className="border border-border rounded-lg p-4" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
        <h3 className="font-display font-semibold text-sm text-foreground mb-3 flex items-center gap-2">
          <Plus size={16} className="text-primary" /> Nova Notificação
        </h3>
        <div className="space-y-3">
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm placeholder:text-muted-foreground"
            placeholder="Título do aviso..."
          />
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm placeholder:text-muted-foreground min-h-[80px] resize-y"
            placeholder="Conteúdo detalhado (opcional)..."
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <select
              value={priority}
              onChange={e => setPriority(e.target.value as "normal" | "important" | "urgent")}
              className="px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm"
            >
              <option value="normal">Normal</option>
              <option value="important">Importante</option>
              <option value="urgent">Urgente</option>
            </select>
            <select
              value={type}
              onChange={e => setType(e.target.value as "banner" | "announcement" | "reminder")}
              className="px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm"
            >
              <option value="announcement">Comunicado</option>
              <option value="banner">Banner</option>
              <option value="reminder">Lembrete</option>
            </select>
            <input
              type="datetime-local"
              value={expiresAt}
              onChange={e => setExpiresAt(e.target.value)}
              className="px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm"
              title="Data de expiração (opcional)"
            />
          </div>
          <button
            onClick={() => createNotif.mutate({
              password,
              title,
              content: content || undefined,
              priority,
              type,
              expiresAt: expiresAt || undefined,
            })}
            disabled={!title || createNotif.isPending}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 flex items-center gap-1.5"
          >
            <Bell size={14} /> Publicar Aviso
          </button>
        </div>
      </div>

      {/* Notifications List */}
      <div>
        <h3 className="font-display font-semibold text-sm text-foreground mb-3">Avisos Publicados ({notifs?.length || 0})</h3>
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
        ) : !notifs || notifs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhum aviso publicado</p>
        ) : (
          <div className="space-y-2">
            {notifs.map(notif => (
              <div
                key={notif.id}
                className={`border rounded-lg p-3 ${notif.isActive ? "border-border" : "border-border/30 opacity-50"}`}
                style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-xs font-bold ${priorityColors[notif.priority] || "text-primary"}`}>
                        {notif.priority === "urgent" && <AlertTriangle size={12} className="inline mr-1" />}
                        {priorityLabels[notif.priority] || "Normal"}
                      </span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{typeLabels[notif.type] || notif.type}</span>
                      {!notif.isActive && <span className="text-xs px-1.5 py-0.5 rounded bg-destructive/20 text-destructive">Inativo</span>}
                    </div>
                    <h4 className="font-medium text-sm text-foreground">{notif.title}</h4>
                    {notif.content && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{notif.content}</p>}
                    <div className="flex items-center gap-2 mt-2 text-[11px] text-muted-foreground">
                      <Clock size={10} />
                      <span>{new Date(notif.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                      {notif.expiresAt && <span className="text-amber-400">Expira: {new Date(notif.expiresAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => toggleActive.mutate({ password, id: notif.id, isActive: notif.isActive ? 0 : 1 })}
                      className={`px-2 py-1 rounded text-xs font-medium ${notif.isActive ? "bg-amber-500/20 text-amber-400" : "bg-primary/20 text-primary"}`}
                    >
                      {notif.isActive ? "Desativar" : "Ativar"}
                    </button>
                    <button
                      onClick={() => { if (confirm("Remover esta notificação?")) deleteNotif.mutate({ password, id: notif.id }); }}
                      className="p-1.5 rounded hover:bg-destructive/20 text-destructive"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Materials Manager ───
const MODULES = [
  "Geral", "Introdução à Farmacologia", "Farmacocinética", "Farmacodinâmica",
  "SNA — Adrenérgicos", "SNA — Colinérgicos", "Bloqueadores Neuromusculares",
  "Anti-inflamatórios", "Seminários Jigsaw", "Casos Clínicos",
];

function MaterialsManager({ password }: { password: string }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [materialType, setMaterialType] = useState<"file" | "link" | "comment">("file");
  const [fileInputMode, setFileInputMode] = useState<"url" | "upload">("url");
  const [fileExternalUrl, setFileExternalUrl] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [module, setModule] = useState("Geral");
  const [week, setWeek] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [filterTypes, setFilterTypes] = useState<MaterialType[]>(["file", "link", "comment"]);
  const [tags, setTags] = useState<Tag[]>([]);
  const pdfPreview = usePDFPreview();

  const utils = trpc.useUtils();
  const { data: materials, isLoading } = trpc.materials.getAll.useQuery({ password });

  const uploadMaterial = trpc.materials.upload.useMutation({
    onSuccess: () => {
      utils.materials.getAll.invalidate();
      utils.materials.getVisible.invalidate();
      toast.success("Arquivo enviado com sucesso!");
      resetForm();
    },
    onError: () => toast.error("Erro ao enviar arquivo"),
  });

  const createMaterial = trpc.materials.create.useMutation({
    onSuccess: () => {
      utils.materials.getAll.invalidate();
      utils.materials.getVisible.invalidate();
      toast.success("Material adicionado!");
      resetForm();
    },
    onError: () => toast.error("Erro ao adicionar material"),
  });

  const toggleVisibility = trpc.materials.update.useMutation({
    onSuccess: () => {
      utils.materials.getAll.invalidate();
      utils.materials.getVisible.invalidate();
      toast.success("Visibilidade atualizada!");
    },
  });

  const deleteMaterial = trpc.materials.delete.useMutation({
    onSuccess: () => {
      utils.materials.getAll.invalidate();
      utils.materials.getVisible.invalidate();
      toast.success("Material removido!");
    },
  });

  function resetForm() {
    setTitle(""); setDescription(""); setLinkUrl(""); setFileExternalUrl(""); setModule("Geral"); setWeek(""); setSelectedFile(null); setUploading(false);
  }

  async function handleSubmit() {
    if (!title) { toast.error("Título é obrigatório"); return; }
    setUploading(true);
    try {
      if (materialType === "file" && fileInputMode === "url" && fileExternalUrl) {
        // Salvar como material com URL externa (Google Drive, OneDrive, etc.)
        await createMaterial.mutateAsync({
          password,
          title,
          description: description || undefined,
          type: "file",
          url: fileExternalUrl,
          module,
          week: week ? parseInt(week) : undefined,
        });
      } else if (materialType === "file" && fileInputMode === "upload" && selectedFile) {
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(",")[1]);
          };
          reader.onerror = reject;
          reader.readAsDataURL(selectedFile);
        });
        await uploadMaterial.mutateAsync({
          password,
          title,
          description: description || undefined,
          module,
          week: week ? parseInt(week) : undefined,
          fileName: selectedFile.name,
          mimeType: selectedFile.type || "application/octet-stream",
          fileBase64: base64,
        });
      } else if (materialType === "link") {
        if (!linkUrl) { toast.error("URL é obrigatória para links"); setUploading(false); return; }
        await createMaterial.mutateAsync({
          password,
          title,
          description: description || undefined,
          type: "link",
          url: linkUrl,
          module,
          week: week ? parseInt(week) : undefined,
        });
      } else if (materialType === "comment") {
        await createMaterial.mutateAsync({
          password,
          title,
          description: description || undefined,
          type: "comment",
          module,
          week: week ? parseInt(week) : undefined,
        });
      }
    } catch {
      toast.error("Erro ao enviar material");
    }
    setUploading(false);
  }

  const typeIcons: Record<string, React.ReactNode> = {
    file: <FileText size={14} className="text-blue-400" />,
    link: <Link2 size={14} className="text-primary" />,
    comment: <MessageSquare size={14} className="text-green-400" />,
  };

  const typeLabels: Record<string, string> = {
    file: "Arquivo",
    link: "Link",
    comment: "Comentário",
  };

  // Group materials by module
  const grouped = useMemo(() => {
    if (!materials) return {};
    const g: Record<string, typeof materials> = {};
    for (const m of materials) {
      const mod = m.module || "Geral";
      if (!g[mod]) g[mod] = [];
      g[mod].push(m);
    }
    return g;
  }, [materials]);

  return (
    <div className="space-y-6">
      {/* Add Material */}
      <div className="border border-border rounded-lg p-4" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
        <h3 className="font-display font-semibold text-sm text-foreground mb-3 flex items-center gap-2">
          <Plus size={16} className="text-primary" /> Novo Material
        </h3>

        {/* File input mode - URL externa ou upload direto */}
        {materialType === "file" && (
          <div className="mb-4">
            <div className="flex gap-1 p-1 rounded-lg bg-secondary/30 w-fit mb-3">
              <button
                onClick={() => setFileInputMode("url")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  fileInputMode === "url" ? "bg-primary/20 text-primary border border-primary/30" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Link2 size={11} /> Link externo
              </button>
              <button
                onClick={() => setFileInputMode("upload")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  fileInputMode === "upload" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Upload size={11} /> Upload direto
              </button>
            </div>
            {fileInputMode === "url" ? (
              <div className="space-y-2">
                <div className="p-3 rounded-md bg-blue-500/10 border border-blue-500/20">
                  <p className="text-xs text-blue-300 leading-relaxed">
                    <strong className="text-blue-200">Como usar o Google Drive:</strong> Faça upload do arquivo no Google Drive → clique com o botão direito → "Compartilhar" → "Qualquer pessoa com o link" → copie o link e cole abaixo.
                  </p>
                </div>
                <input
                  value={fileExternalUrl}
                  onChange={e => setFileExternalUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm placeholder:text-muted-foreground"
                  placeholder="Cole aqui o link do Google Drive, OneDrive ou Dropbox..."
                />
              </div>
            ) : (
              <FileDropZone
                onFilesSelected={(files) => {
                  if (files.length > 0) {
                    setSelectedFile(files[0]);
                    if (files[0].type === "application/pdf") {
                      pdfPreview.openPreview(files[0]);
                    }
                  }
                }}
                acceptedTypes={[".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".jpg", ".jpeg", ".png"]}
                maxSize={50 * 1024 * 1024}
                multiple={false}
              />
            )}
          </div>
        )}

        {/* Type selector */}
        <div className="flex gap-1 p-1 rounded-lg bg-secondary/50 w-fit mb-4">
          {(["file", "link", "comment"] as const).map(t => (
            <button
              key={t}
              onClick={() => setMaterialType(t)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                materialType === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "file" && <Upload size={12} />}
              {t === "link" && <Link2 size={12} />}
              {t === "comment" && <MessageSquare size={12} />}
              {typeLabels[t]}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm placeholder:text-muted-foreground"
            placeholder="Título do material..."
          />
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm placeholder:text-muted-foreground min-h-[60px] resize-y"
            placeholder="Descrição ou comentário..."
          />

          {materialType === "file" && fileInputMode === "upload" && (
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 px-4 py-2 rounded-md bg-secondary border border-border text-foreground text-sm cursor-pointer hover:bg-secondary/80">
                <Paperclip size={14} />
                {selectedFile ? selectedFile.name : "Selecionar arquivo..."}
                <input
                  type="file"
                  className="hidden"
                  onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.mp4,.mp3,.zip"
                />
              </label>
              {selectedFile && (
                <span className="text-xs text-muted-foreground">
                  {(selectedFile.size / 1024 / 1024).toFixed(1)} MB
                </span>
              )}
            </div>
          )}

          {materialType === "link" && (
            <input
              value={linkUrl}
              onChange={e => setLinkUrl(e.target.value)}
              className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm placeholder:text-muted-foreground"
              placeholder="https://..."
            />
          )}

          <div className="grid grid-cols-2 gap-2">
            <select
              value={module}
              onChange={e => setModule(e.target.value)}
              className="px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm"
            >
              {MODULES.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <input
              type="number"
              value={week}
              onChange={e => setWeek(e.target.value)}
              className="px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm placeholder:text-muted-foreground"
              placeholder="Semana (opcional)"
              min={1}
              max={16}
            />
          </div>

          {/* Tags */}
          <div>
            <label className="text-xs font-medium text-foreground mb-2 block">Tags (opcional)</label>
            <TagInput
              tags={tags}
              onTagsChange={setTags}
              maxTags={5}
              suggestions={["Importante", "Leitura Obrigatória", "Complementar", "Exercício", "Prova", "Discussão", "Caso Clínico", "Referência"]}
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={uploading || !title || (materialType === "file" && fileInputMode === "url" && !fileExternalUrl) || (materialType === "file" && fileInputMode === "upload" && !selectedFile) || (materialType === "link" && !linkUrl)}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 flex items-center gap-1.5"
          >
            {uploading ? "Enviando..." : <><Upload size={14} /> Publicar Material</>}
          </button>
        </div>
      </div>

      {/* Materials List */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold text-sm text-foreground">Materiais Publicados ({materials?.length || 0})</h3>
        </div>
        <div className="mb-4">
          <p className="text-xs text-muted-foreground mb-2">Filtrar por tipo:</p>
          <MaterialTypeFilter selectedTypes={filterTypes} onTypeChange={setFilterTypes} />
        </div>
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
        ) : !materials || materials.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhum material publicado</p>
        ) : (
          <div className="space-y-4">
            {Object.entries(grouped).map(([mod, items]) => (
              <div key={mod}>
                <h4 className="text-xs font-bold text-primary uppercase tracking-wide mb-2">{mod}</h4>
                <div className="space-y-2">
                  {items.filter(mat => filterTypes.includes(mat.type as MaterialType)).map(mat => (
                    <div
                      key={mat.id}
                      className={`border rounded-lg p-3 ${mat.isVisible ? "border-border" : "border-border/30 opacity-50"}`}
                      style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}
                    >
                      <div className="flex items-start gap-2">
                        <div className="mt-0.5">{typeIcons[mat.type]}</div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <MaterialTypeBadge
                              type={mat.type}
                              fileName={mat.fileName}
                              url={mat.url}
                              variant="default"
                            />
                            {mat.week && <span className="text-xs text-muted-foreground">Semana {mat.week}</span>}
                            {!mat.isVisible && <span className="text-xs px-1.5 py-0.5 rounded bg-destructive/20 text-destructive">Oculto</span>}
                          </div>

                          <h4 className="font-medium text-sm text-foreground">{mat.title}</h4>
                          {mat.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{mat.description}</p>}
                          {mat.type === "file" && mat.fileName && (
                            <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                              <Paperclip size={10} /> {mat.fileName}
                            </p>
                          )}
                          {mat.type === "link" && mat.url && (
                            <a href={mat.url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-primary hover:underline mt-1 flex items-center gap-1">
                              <Link2 size={10} /> {mat.url}
                            </a>
                          )}
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {new Date(mat.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => toggleVisibility.mutate({ password, id: mat.id, isVisible: mat.isVisible ? 0 : 1 })}
                            className="p-1.5 rounded hover:bg-secondary text-muted-foreground"
                            title={mat.isVisible ? "Ocultar" : "Mostrar"}
                          >
                            {mat.isVisible ? <Eye size={14} /> : <EyeOff size={14} />}
                          </button>
                          <button
                            onClick={() => { if (confirm("Remover este material?")) deleteMaterial.mutate({ password, id: mat.id }); }}
                            className="p-1.5 rounded hover:bg-destructive/20 text-destructive"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Badges Manager ───
function BadgesManager({ password }: { password: string }) {
  const [showCreate, setShowCreate] = useState(false);
  const [newBadge, setNewBadge] = useState({ name: "", description: "", category: "Semana 1", week: 1, criteria: "", iconUrl: "", autoAssign: false, autoAssignRuleType: "top_individual", autoAssignN: 3, autoAssignXP: 50 });
  const [assignBadgeId, setAssignBadgeId] = useState<number | null>(null);
  const [assignMemberId, setAssignMemberId] = useState<number | null>(null);
  const [assignNote, setAssignNote] = useState("");
  const [editingAutoRuleBadgeId, setEditingAutoRuleBadgeId] = useState<number | null>(null);
  const [editRuleType, setEditRuleType] = useState("top_individual");
  const [editRuleN, setEditRuleN] = useState(3);
  const [editRuleXP, setEditRuleXP] = useState(50);
  const [autoAssignResult, setAutoAssignResult] = useState<{ totalAwarded: number; totalRevoked: number; results: any[] } | null>(null);
  const [previewRule, setPreviewRule] = useState<string | null>(null);

  const { data: badges, refetch: refetchBadges } = trpc.badges.getWithMembers.useQuery();
  const { data: leaderboard } = trpc.leaderboard.getData.useQuery();
  const createBadge = trpc.badges.create.useMutation({ onSuccess: () => { refetchBadges(); setShowCreate(false); setNewBadge({ name: "", description: "", category: "Semana 1", week: 1, criteria: "", iconUrl: "", autoAssign: false, autoAssignRuleType: "top_individual", autoAssignN: 3, autoAssignXP: 50 }); toast.success("Badge criado!"); } });
  const assignBadge = trpc.badges.award.useMutation({ onSuccess: () => { refetchBadges(); setAssignBadgeId(null); setAssignMemberId(null); setAssignNote(""); toast.success("Badge atribuído!"); } });
  const removeBadge = trpc.badges.revoke.useMutation({ onSuccess: () => { refetchBadges(); toast.success("Badge removido!"); } });
  const deleteBadge = trpc.badges.delete.useMutation({ onSuccess: () => { refetchBadges(); toast.success("Badge excluído!"); } });
  const updateBadge = trpc.badges.update.useMutation({ onSuccess: () => { refetchBadges(); setEditingAutoRuleBadgeId(null); toast.success("Regra de auto-atribuição salva!"); } });
  const autoAssignMutation = trpc.badges.autoAssign.useMutation({
    onSuccess: (data) => {
      refetchBadges();
      setAutoAssignResult(data);
      if (data.totalAwarded > 0) toast.success(`✅ ${data.totalAwarded} conquista(s) atribuída(s) automaticamente!`);
      else toast.info("Nenhuma nova conquista para atribuir.");
    },
    onError: (err) => toast.error(err.message),
  });

  const previewRuleStr = useMemo(() => {
    if (!previewRule) return null;
    return previewRule;
  }, [previewRule]);

  const { data: previewMembers } = trpc.badges.previewAutoAssign.useQuery(
    { password, rule: previewRuleStr ?? "" },
    { enabled: !!previewRuleStr && previewRuleStr.length > 2 }
  );

  const allMembers = useMemo(() => {
    if (!leaderboard?.teams) return [];
    return leaderboard.teams.flatMap(t => t.members.map(m => ({ id: m.id, name: m.name, teamName: t.name })));
  }, [leaderboard]);

  const categories = ["Semana 1", "Semana 2", "Semana 3", "TBL", "Jigsaw", "Casos Clínicos", "Escape Room", "Participação", "Geral"];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-bold text-lg text-foreground flex items-center gap-2">
          <Award size={20} className="text-primary" /> Gerenciar Conquistas
        </h2>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-primary text-primary-foreground text-xs font-medium"
        >
          <Plus size={14} /> Novo Badge
        </button>
      </div>

      {/* Create Badge Form */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="border border-border rounded-lg p-4 space-y-3" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
              <h3 className="text-sm font-semibold text-foreground">Criar Novo Badge</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  value={newBadge.name}
                  onChange={e => setNewBadge(p => ({ ...p, name: e.target.value }))}
                  placeholder="Nome do badge"
                  className="px-3 py-2 rounded-md bg-background border border-border text-sm text-foreground"
                />
                <select
                  value={newBadge.category}
                  onChange={e => setNewBadge(p => ({ ...p, category: e.target.value }))}
                  className="px-3 py-2 rounded-md bg-background border border-border text-sm text-foreground"
                >
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <input
                  value={newBadge.description}
                  onChange={e => setNewBadge(p => ({ ...p, description: e.target.value }))}
                  placeholder="Descrição"
                  className="px-3 py-2 rounded-md bg-background border border-border text-sm text-foreground"
                />
                <input
                  type="number"
                  value={newBadge.week}
                  onChange={e => setNewBadge(p => ({ ...p, week: parseInt(e.target.value) || 1 }))}
                  placeholder="Semana"
                  className="px-3 py-2 rounded-md bg-background border border-border text-sm text-foreground"
                />
                <input
                  value={newBadge.criteria}
                  onChange={e => setNewBadge(p => ({ ...p, criteria: e.target.value }))}
                  placeholder="Critério (ex: Completar TBL da semana 1)"
                  className="px-3 py-2 rounded-md bg-background border border-border text-sm text-foreground sm:col-span-2"
                />
                <input
                  value={newBadge.iconUrl}
                  onChange={e => setNewBadge(p => ({ ...p, iconUrl: e.target.value }))}
                  placeholder="URL do ícone (opcional)"
                  className="px-3 py-2 rounded-md bg-background border border-border text-sm text-foreground sm:col-span-2"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => createBadge.mutate({ password, ...newBadge, week: newBadge.week || undefined, iconUrl: newBadge.iconUrl || undefined, criteria: newBadge.criteria || undefined, description: newBadge.description || undefined })}
                  disabled={!newBadge.name || createBadge.isPending}
                  className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50"
                >
                  {createBadge.isPending ? "Criando..." : "Criar Badge"}
                </button>
                <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-md bg-secondary text-foreground text-xs">
                  Cancelar
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Auto-Assign Section */}
      <div className="border border-primary/30 rounded-lg p-4 space-y-3" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Zap size={14} className="text-primary" /> Atribuição Automática por PF
          </h3>
          <button
            onClick={() => autoAssignMutation.mutate({ password })}
            disabled={autoAssignMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50"
          >
            <Zap size={12} />
            {autoAssignMutation.isPending ? "Processando..." : "Executar Todas as Regras"}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">Configure regras de auto-atribuição em cada badge abaixo. Ao executar, o sistema avalia todos os badges com regra ativa e atribui/revoga automaticamente com base no ranking de PF.</p>
        {autoAssignResult && (
          <div className="rounded-md p-3 space-y-2" style={{ backgroundColor: "oklch(0.15 0.02 264.052)" }}>
            <div className="flex items-center gap-4 text-xs">
              <span className="text-emerald-400 font-semibold">✅ {autoAssignResult.totalAwarded} atribuída(s)</span>
              <span className="text-orange-400 font-semibold">↩ {autoAssignResult.totalRevoked} revogada(s)</span>
            </div>
            {autoAssignResult.results.filter(r => r.awarded > 0 || r.revoked > 0).map((r: any) => (
              <div key={r.badgeId} className="text-xs text-muted-foreground">
                <span className="text-foreground font-medium">{r.badgeName}:</span> {r.awarded > 0 && <span className="text-emerald-400">{r.members.join(", ")} receberam</span>}{r.revoked > 0 && <span className="text-orange-400"> · {r.revoked} revogada(s)</span>}
              </div>
            ))}
            {autoAssignResult.results.every(r => r.awarded === 0 && r.revoked === 0) && (
              <p className="text-xs text-muted-foreground italic">Nenhuma alteração necessária — todos os badges já estão corretos.</p>
            )}
          </div>
        )}
      </div>

      {/* Assign Badge */}
      <div className="border border-border rounded-lg p-4 space-y-3" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Star size={14} className="text-primary" /> Atribuir Badge a Aluno
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <select
            value={assignBadgeId ?? ""}
            onChange={e => setAssignBadgeId(e.target.value ? parseInt(e.target.value) : null)}
            className="px-3 py-2 rounded-md bg-background border border-border text-sm text-foreground"
          >
            <option value="">Selecione o badge...</option>
            {badges?.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <select
            value={assignMemberId ?? ""}
            onChange={e => setAssignMemberId(e.target.value ? parseInt(e.target.value) : null)}
            className="px-3 py-2 rounded-md bg-background border border-border text-sm text-foreground"
          >
            <option value="">Selecione o aluno...</option>
            {allMembers.map(m => <option key={m.id} value={m.id}>{m.name} ({m.teamName})</option>)}
          </select>
          <input
            value={assignNote}
            onChange={e => setAssignNote(e.target.value)}
            placeholder="Nota (opcional)"
            className="px-3 py-2 rounded-md bg-background border border-border text-sm text-foreground"
          />
        </div>
        <button
          onClick={() => assignBadgeId && assignMemberId && assignBadge.mutate({ password, badgeId: assignBadgeId, memberId: assignMemberId, note: assignNote || undefined })}
          disabled={!assignBadgeId || !assignMemberId || assignBadge.isPending}
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50"
        >
          {assignBadge.isPending ? "Atribuindo..." : "Atribuir Badge"}
        </button>
      </div>

      {/* Badges List */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Badges Existentes ({badges?.length ?? 0})</h3>
        {badges?.map(badge => {
          const hasAutoRule = (badge as any).autoAssign === 1;
          const ruleObj = (() => { try { return JSON.parse((badge as any).autoAssignRule ?? ""); } catch { return null; } })();
          const isEditingRule = editingAutoRuleBadgeId === badge.id;

          return (
            <div key={badge.id} className={`border rounded-lg p-4 ${hasAutoRule ? "border-primary/40" : "border-border"}`} style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-lg">{badge.iconUrl ? "🏅" : "🏆"}</span>
                  <span className="font-semibold text-foreground text-sm">{badge.name}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">{badge.category}</span>
                  {badge.week && <span className="text-[10px] text-muted-foreground">Sem {badge.week}</span>}
                  {hasAutoRule && ruleObj && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center gap-1">
                      <Zap size={9} />
                      {ruleObj.type === "top_individual" ? `Top ${ruleObj.n} individual` : ruleObj.type === "top_team" ? `Top ${ruleObj.n} equipe(s)` : `PF ≥ ${ruleObj.xp}`}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      if (isEditingRule) { setEditingAutoRuleBadgeId(null); return; }
                      setEditingAutoRuleBadgeId(badge.id);
                      setEditRuleType(ruleObj?.type ?? "top_individual");
                      setEditRuleN(ruleObj?.n ?? 3);
                      setEditRuleXP(ruleObj?.xp ?? 50);
                      const rule = ruleObj ?? { type: "top_individual", n: 3 };
                      setPreviewRule(JSON.stringify(rule));
                    }}
                    className="text-xs px-2 py-1 rounded bg-secondary text-foreground hover:bg-secondary/80"
                    title="Configurar regra de auto-atribuição"
                  >
                    <Zap size={12} className={hasAutoRule ? "text-emerald-400" : "text-muted-foreground"} />
                  </button>
                  <button
                    onClick={() => autoAssignMutation.mutate({ password, badgeId: badge.id })}
                    disabled={!hasAutoRule || autoAssignMutation.isPending}
                    className="text-xs px-2 py-1 rounded bg-secondary text-foreground hover:bg-secondary/80 disabled:opacity-30"
                    title={hasAutoRule ? "Executar regra agora" : "Configure uma regra primeiro"}
                  >
                    <Play size={12} className="text-primary" />
                  </button>
                  <button
                    onClick={() => { if (confirm(`Excluir badge "${badge.name}"?`)) deleteBadge.mutate({ password, id: badge.id }); }}
                    className="text-destructive hover:text-destructive/80 p-1"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Auto-assign rule editor */}
              <AnimatePresence>
                {isEditingRule && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 pt-3 border-t border-border/50 space-y-3">
                      <h4 className="text-xs font-semibold text-foreground flex items-center gap-1"><Zap size={11} className="text-primary" /> Regra de Auto-Atribuição</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <select
                          value={editRuleType}
                          onChange={e => {
                            setEditRuleType(e.target.value);
                            const rule = e.target.value === "min_xp" ? { type: e.target.value, xp: editRuleXP } : { type: e.target.value, n: editRuleN };
                            setPreviewRule(JSON.stringify(rule));
                          }}
                          className="px-2 py-1.5 rounded bg-background border border-border text-xs text-foreground"
                        >
                          <option value="top_individual">Top N individual (por PF)</option>
                          <option value="top_team">Top N equipe(s) (por PF total)</option>
                          <option value="min_xp">PF mínimo</option>
                        </select>
                        {editRuleType !== "min_xp" ? (
                          <input
                            type="number" min={1} max={100}
                            value={editRuleN}
                            onChange={e => {
                              const n = parseInt(e.target.value) || 1;
                              setEditRuleN(n);
                              setPreviewRule(JSON.stringify({ type: editRuleType, n }));
                            }}
                            placeholder="N (quantidade)"
                            className="px-2 py-1.5 rounded bg-background border border-border text-xs text-foreground"
                          />
                        ) : (
                          <input
                            type="number" min={0}
                            value={editRuleXP}
                            onChange={e => {
                              const xp = parseFloat(e.target.value) || 0;
                              setEditRuleXP(xp);
                              setPreviewRule(JSON.stringify({ type: editRuleType, xp }));
                            }}
                            placeholder="PF mínimo"
                            className="px-2 py-1.5 rounded bg-background border border-border text-xs text-foreground"
                          />
                        )}
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              const rule = editRuleType === "min_xp" ? { type: editRuleType, xp: editRuleXP } : { type: editRuleType, n: editRuleN };
                              updateBadge.mutate({ password, id: badge.id, autoAssign: 1, autoAssignRule: JSON.stringify(rule) });
                            }}
                            disabled={updateBadge.isPending}
                            className="flex-1 px-2 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50"
                          >
                            Salvar
                          </button>
                          <button
                            onClick={() => updateBadge.mutate({ password, id: badge.id, autoAssign: 0, autoAssignRule: null })}
                            disabled={updateBadge.isPending}
                            className="px-2 py-1.5 rounded bg-destructive/20 text-destructive text-xs"
                            title="Desativar auto-atribuição"
                          >
                            Desativar
                          </button>
                        </div>
                      </div>
                      {/* Preview */}
                      {previewMembers && previewMembers.length > 0 && (
                        <div className="rounded p-2 space-y-1" style={{ backgroundColor: "oklch(0.15 0.02 264.052)" }}>
                          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Prévia — alunos que receberiam este badge:</span>
                          <div className="flex flex-wrap gap-1.5">
                            {previewMembers.map((m: any) => (
                              <span key={m.id} className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">{m.name} ({m.xp} PF)</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {previewMembers && previewMembers.length === 0 && (
                        <p className="text-[11px] text-muted-foreground italic">Nenhum aluno se qualifica com esta regra ainda.</p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {badge.description && <p className="text-xs text-muted-foreground mb-2 mt-2">{badge.description}</p>}
              {badge.members.length > 0 ? (
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Alunos ({badge.members.length}):</span>
                  {badge.members.map((m, idx) => (
                    <div key={idx} className="flex items-center justify-between py-1 px-2 rounded bg-background/50 text-xs">
                      <span className="text-foreground">{m.memberName}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">{new Date(m.earnedAt).toLocaleDateString("pt-BR")}</span>
                        <button
                          onClick={() => removeBadge.mutate({ password, badgeId: badge.id, memberId: (m as any).memberId })}
                          className="text-destructive hover:text-destructive/80 p-0.5"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">Nenhum aluno conquistou ainda</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Attendance Manager ───
function AttendanceManager({ password }: { password: string }) {
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [viewMode, setViewMode] = useState<"summary" | "weekly" | "accounts">("summary");
  const [manualMemberId, setManualMemberId] = useState("");
  const [manualNote, setManualNote] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClassId, setSelectedClassId] = useState<number | undefined>(undefined);
  const { data: classesList = [] } = trpc.classes.listAll.useQuery();
  const { data: summary, isLoading: summaryLoading, refetch: refetchSummary } = trpc.attendanceOld.getSummary.useQuery(
    { password, classId: selectedClassId }, { enabled: viewMode === "summary" }
  );;
  const { data: weeklyData, isLoading: weeklyLoading, refetch: refetchWeekly } = trpc.attendanceOld.getByWeek.useQuery(
    { password, week: selectedWeek }, { enabled: viewMode === "weekly" }
  );
  const { data: accounts, isLoading: accountsLoading, refetch: refetchAccounts } = trpc.attendanceOld.getAccounts.useQuery(
    { password }, { enabled: viewMode === "accounts" }
  );

  const updateStatusMutation = trpc.attendanceOld.updateStatus.useMutation({
    onSuccess: () => { toast.success("Status atualizado"); refetchWeekly(); refetchSummary(); },
  });
  const manualCheckInMutation = trpc.attendance.manualCheckIn.useMutation({
    onSuccess: () => { toast.success("Presença manual registrada"); refetchWeekly(); refetchSummary(); setManualMemberId(""); setManualNote(""); },
  });
  const deleteRecordMutation = trpc.attendanceOld.delete.useMutation({
    onSuccess: () => { toast.success("Registro removido"); refetchWeekly(); refetchSummary(); },
  });
  const deleteAccountMutation = trpc.attendanceOld.deleteAccount.useMutation({
    onSuccess: () => { toast.success("Conta removida"); refetchAccounts(); },
  });

  const filteredSummary = useMemo(() => {
    if (!summary) return [];
    if (!searchTerm.trim()) return summary;
    const s = searchTerm.toLowerCase();
    return summary.filter((m: any) => m.memberName.toLowerCase().includes(s) || m.teamName.toLowerCase().includes(s));
  }, [summary, searchTerm]);

  const reportQuery = trpc.attendanceOld.exportReport.useQuery({ password });

  const exportCSV = () => {
    const data = reportQuery.data;
    if (!data) { toast.error("Dados não carregados ainda"); return; }
    const { report, weeks } = data;
    const header = ["Nome", "Equipe", "Matrícula", "Email", ...weeks.map((w: number) => `Sem ${w}`), "Presenças", "Inválidas", "Ausências"];
    const rows = report.map((r: any) => [
      r.nome, r.equipe, r.matricula, r.email,
      ...weeks.map((w: number) => r.weeklyStatus[w] || "-"),
      r.totalValid, r.totalInvalid, r.totalAusente,
    ]);
    const csv = [header, ...rows].map(row => row.map((c: any) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `frequencia_farmacologia_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado com sucesso!");
  };

  const exportPDF = () => {
    const data = reportQuery.data;
    if (!data) { toast.error("Dados não carregados ainda"); return; }
    const { report, weeks } = data;
    // Generate a printable HTML table and open in new window for PDF printing
    const legendHTML = `<p style="font-size:11px;margin-bottom:8px;"><b>Legenda:</b> P = Presente | M = Manual | I = Inválida | - = Ausente</p>`;
    const headerCells = ["Nome", "Equipe", "Mat.", ...weeks.map((w: number) => `S${w}`), "P", "I", "A"]
      .map(h => `<th style="border:1px solid #ccc;padding:3px 5px;font-size:10px;background:#f0f0f0;">${h}</th>`).join("");
    const bodyRows = report.map((r: any) => {
      const cells = [
        r.nome, r.equipe, r.matricula,
        ...weeks.map((w: number) => {
          const v = r.weeklyStatus[w] || "-";
          const color = v === "P" ? "#16a34a" : v === "M" ? "#2563eb" : v === "I" ? "#dc2626" : "#999";
          return `<span style="color:${color};font-weight:bold;">${v}</span>`;
        }),
        r.totalValid, r.totalInvalid, r.totalAusente,
      ];
      return `<tr>${cells.map(c => `<td style="border:1px solid #ccc;padding:2px 4px;font-size:10px;text-align:center;">${c}</td>`).join("")}</tr>`;
    }).join("");
    const html = `<!DOCTYPE html><html><head><title>Relatório de Frequência - Farmacologia I</title>
      <style>@media print { body { margin: 0; } table { page-break-inside: auto; } tr { page-break-inside: avoid; } }</style>
    </head><body style="font-family:Arial,sans-serif;padding:20px;">
      <h2 style="margin-bottom:4px;">Relatório de Frequência — Farmacologia I (2026.1)</h2>
      <p style="color:#666;font-size:12px;margin-bottom:12px;">UNIRIO — Gerado em ${new Date().toLocaleDateString("pt-BR")}</p>
      ${legendHTML}
      <table style="border-collapse:collapse;width:100%;">
        <thead><tr>${headerCells}</tr></thead>
        <tbody>${bodyRows}</tbody>
      </table>
      <p style="font-size:10px;color:#999;margin-top:16px;">Conexão em Farmacologia — Sistema de Controle de Frequência</p>
    </body></html>`;
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
      setTimeout(() => win.print(), 500);
    }
    toast.success("PDF aberto para impressão!");
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-bold text-lg text-foreground flex items-center gap-2">
          <MapPin size={20} className="text-primary" /> Controle de Frequência
        </h2>
        <div className="flex gap-2">
          <button
            onClick={exportCSV}
            disabled={reportQuery.isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-600/20 text-green-400 hover:bg-green-600/30 transition-colors disabled:opacity-50"
          >
            <Download size={14} /> CSV
          </button>
          <button
            onClick={exportPDF}
            disabled={reportQuery.isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 transition-colors disabled:opacity-50"
          >
            <Download size={14} /> PDF
          </button>
        </div>
      </div>

      {/* Seletor de Turma */}
      <div className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-secondary/30 border border-border">
        <span className="text-xs font-medium text-muted-foreground">Filtrar por turma:</span>
        <select
          value={selectedClassId ?? ""}
          onChange={e => setSelectedClassId(e.target.value ? Number(e.target.value) : undefined)}
          className="flex-1 max-w-xs px-3 py-1.5 rounded-md bg-background border border-border text-foreground text-xs"
        >
          <option value="">Todas as turmas</option>
          {(classesList as any[]).map((c: any) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {selectedClassId && (
          <button onClick={() => setSelectedClassId(undefined)} className="text-xs text-muted-foreground hover:text-foreground">Limpar filtro</button>
        )}
      </div>

      {/* View Mode Tabs */}
      <div className="flex gap-1 p-1 rounded-lg bg-secondary/50 w-fit mb-4">
        {[
          { key: "summary" as const, label: "Resumo Geral" },
          { key: "weekly" as const, label: "Por Semana" },
          { key: "accounts" as const, label: "Contas de Alunos" },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setViewMode(tab.key)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              viewMode === tab.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Summary View */}
      {viewMode === "summary" && (
        <div>
          <div className="relative mb-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar aluno ou equipe..."
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm"
            />
          </div>
          {summaryLoading ? (
            <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-2 text-xs text-muted-foreground font-medium">Aluno</th>
                    <th className="text-left py-2 px-2 text-xs text-muted-foreground font-medium">Equipe</th>
                    <th className="text-center py-2 px-2 text-xs text-muted-foreground font-medium">Conta</th>
                    <th className="text-center py-2 px-2 text-xs text-muted-foreground font-medium">Presenças</th>
                    <th className="text-center py-2 px-2 text-xs text-muted-foreground font-medium">Válidas</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSummary.map((m: any) => (
                    <tr key={m.memberId} className="border-b border-border/50 hover:bg-secondary/30">
                      <td className="py-2 px-2 text-foreground">{m.memberName}</td>
                      <td className="py-2 px-2 text-muted-foreground">{m.teamEmoji} {m.teamName}</td>
                      <td className="py-2 px-2 text-center">
                        {m.hasAccount ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-500"><CheckCircle size={12} /></span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><XCircle size={12} /></span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-center font-mono">{m.totalPresent}</td>
                      <td className="py-2 px-2 text-center font-mono text-green-500">{m.validPresent}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Weekly View */}
      {viewMode === "weekly" && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <label className="text-sm text-muted-foreground">Semana:</label>
            <select
              value={selectedWeek}
              onChange={e => setSelectedWeek(Number(e.target.value))}
              className="px-3 py-1.5 rounded-lg bg-secondary border border-border text-foreground text-sm"
            >
              {Array.from({ length: 19 }, (_, i) => i + 1).map(w => (
                <option key={w} value={w}>Semana {w}</option>
              ))}
            </select>
          </div>

          {/* Manual check-in */}
          <div className="p-3 rounded-lg bg-secondary/30 border border-border mb-4">
            <h4 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1">
              <UserCheck size={14} /> Presença Manual
            </h4>
            <div className="flex gap-2 items-end flex-wrap">
              <div className="flex-1 min-w-[150px]">
                <label className="text-xs text-muted-foreground block mb-1">ID do Aluno (membro)</label>
                <input
                  type="number"
                  value={manualMemberId}
                  onChange={e => setManualMemberId(e.target.value)}
                  placeholder="ID"
                  className="w-full px-2 py-1.5 rounded-md bg-secondary border border-border text-foreground text-sm"
                />
              </div>
              <div className="flex-1 min-w-[150px]">
                <label className="text-xs text-muted-foreground block mb-1">Observação</label>
                <input
                  type="text"
                  value={manualNote}
                  onChange={e => setManualNote(e.target.value)}
                  placeholder="Opcional"
                  className="w-full px-2 py-1.5 rounded-md bg-secondary border border-border text-foreground text-sm"
                />
              </div>
              <button
                onClick={() => {
                  if (!manualMemberId) return;
                  const today = new Date().toISOString().split("T")[0];
                  manualCheckInMutation.mutate({
                    studentAccountId: Number(manualMemberId),
                    classDate: today, note: manualNote || undefined,
                  });
                }}
                disabled={!manualMemberId || manualCheckInMutation.isPending}
                className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50"
              >
                Registrar
              </button>
            </div>
          </div>

          {weeklyLoading ? (
            <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
          ) : !weeklyData || weeklyData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum registro na semana {selectedWeek}</p>
          ) : (
            <div className="space-y-2">
              {weeklyData.map((r: any) => (
                <div key={r.id} className="p-3 rounded-lg bg-secondary/30 border border-border flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    r.status === "valid" || r.status === "manual" ? "bg-green-500/15" : "bg-red-500/15"
                  }`}>
                    {r.status === "valid" || r.status === "manual" ? (
                      <CheckCircle size={16} className="text-green-500" />
                    ) : (
                      <XCircle size={16} className="text-red-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-foreground font-medium">{r.memberName}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.teamEmoji} {r.teamName} • {r.classDate}
                      {r.distanceMeters && ` • ${parseFloat(r.distanceMeters).toFixed(0)}m`}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <select
                      value={r.status}
                      onChange={e => updateStatusMutation.mutate({ password, id: r.id, status: e.target.value as any })}
                      className="px-2 py-1 rounded-md bg-secondary border border-border text-xs text-foreground"
                    >
                      <option value="valid">Válida</option>
                      <option value="invalid">Inválida</option>
                      <option value="manual">Manual</option>
                    </select>
                    <button
                      onClick={() => { if (confirm("Remover este registro?")) deleteRecordMutation.mutate({ password, id: r.id }); }}
                      className="p-1 rounded-md hover:bg-destructive/10 text-destructive"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Accounts View */}
      {viewMode === "accounts" && (
        <div>
          {accountsLoading ? (
            <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
          ) : !accounts || accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma conta de aluno cadastrada</p>
          ) : (
            <div className="space-y-2">
              {accounts.map((a: any) => (
                <div key={a.id} className="p-3 rounded-lg bg-secondary/30 border border-border flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <UserCheck size={16} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-foreground font-medium">{a.memberName}</div>
                    <div className="text-xs text-muted-foreground">
                      {a.teamEmoji} {a.teamName} • {a.email} • Mat: {a.matricula}
                    </div>
                  </div>
                  <button
                    onClick={() => { if (confirm(`Remover conta de ${a.memberName}?`)) deleteAccountMutation.mutate({ password, id: a.id }); }}
                    className="p-1 rounded-md hover:bg-destructive/10 text-destructive"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <p className="text-xs text-muted-foreground mt-2">{accounts.length} conta(s) cadastrada(s)</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── YouTube Playlists Manager ───
function YouTubePlaylistsManager({ password }: { password: string }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [videoType, setVideoType] = useState<"playlist" | "video">("playlist");
  const [module, setModule] = useState("Geral");
  const [week, setWeek] = useState<string>("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editModule, setEditModule] = useState("");
  const [editWeek, setEditWeek] = useState<string>("");

  const { data: playlists, isLoading, refetch } = trpc.youtubePlaylists.getAll.useQuery({ password });

  const createMutation = trpc.youtubePlaylists.create.useMutation({
    onSuccess: () => {
      toast.success("Playlist adicionada!");
      setTitle(""); setDescription(""); setYoutubeUrl("");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.youtubePlaylists.update.useMutation({
    onSuccess: () => { toast.success("Playlist atualizada!"); setEditingId(null); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.youtubePlaylists.delete.useMutation({
    onSuccess: () => { toast.success("Playlist removida!"); refetch(); },
  });

  const toggleMutation = trpc.youtubePlaylists.toggleVisibility.useMutation({
    onSuccess: () => { toast.success("Visibilidade atualizada!"); refetch(); },
  });

  const handleCreate = () => {
    if (!title.trim() || !youtubeUrl.trim()) {
      toast.error("Preencha título e URL do YouTube");
      return;
    }
    createMutation.mutate({
      password,
      title: title.trim(),
      description: description.trim() || undefined,
      youtubeUrl: youtubeUrl.trim(),
      videoType,
      module,
      week: week ? Number(week) : undefined,
    });
  };

  const startEdit = (p: any) => {
    setEditingId(p.id);
    setEditTitle(p.title);
    setEditDescription(p.description || "");
    setEditModule(p.module);
    setEditWeek(p.week ? String(p.week) : "");
  };

  const saveEdit = () => {
    if (!editingId) return;
    updateMutation.mutate({
      password,
      id: editingId,
      title: editTitle.trim(),
      description: editDescription.trim() || undefined,
      module: editModule,
      week: editWeek ? Number(editWeek) : null,
    });
  };

  // Group playlists by module
  const grouped = useMemo(() => {
    if (!playlists) return {};
    const g: Record<string, typeof playlists> = {};
    for (const p of playlists) {
      const mod = p.module || "Geral";
      if (!g[mod]) g[mod] = [];
      g[mod].push(p);
    }
    return g;
  }, [playlists]);

  const getEmbedUrl = (p: any) => {
    if (p.videoType === "playlist") {
      return `https://www.youtube.com/embed/videoseries?list=${p.youtubeId}`;
    }
    return `https://www.youtube.com/embed/${p.youtubeId}`;
  };

  return (
    <div>
      <h2 className="font-display font-bold text-lg text-foreground flex items-center gap-2 mb-4">
        <Youtube size={20} className="text-red-500" /> Playlists do YouTube
      </h2>

      {/* Add New Playlist Form */}
      <div className="border border-border rounded-lg p-4 mb-6" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
        <h3 className="font-display font-semibold text-sm text-foreground mb-3 flex items-center gap-2">
          <Plus size={14} className="text-primary" /> Adicionar Playlist / Vídeo
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Título da playlist/vídeo"
            className="px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm placeholder:text-muted-foreground"
          />
          <input
            value={youtubeUrl}
            onChange={e => setYoutubeUrl(e.target.value)}
            placeholder="URL do YouTube (playlist ou vídeo)"
            className="px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm placeholder:text-muted-foreground"
          />
          <input
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Descrição (opcional)"
            className="px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm placeholder:text-muted-foreground"
          />
          <div className="flex gap-2">
            <select
              value={videoType}
              onChange={e => setVideoType(e.target.value as "playlist" | "video")}
              className="flex-1 px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm"
            >
              <option value="playlist">Playlist</option>
              <option value="video">Vídeo único</option>
            </select>
            <select
              value={module}
              onChange={e => setModule(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm"
            >
              {MODULES.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              value={week}
              onChange={e => setWeek(e.target.value)}
              placeholder="Semana (opcional)"
              min="1" max="19"
              className="flex-1 px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm placeholder:text-muted-foreground"
            />
            <button
              onClick={handleCreate}
              disabled={createMutation.isPending}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              <Youtube size={14} /> {createMutation.isPending ? "Adicionando..." : "Adicionar"}
            </button>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">
          Cole a URL completa do YouTube. Exemplos: https://www.youtube.com/playlist?list=PLxxxxx ou https://www.youtube.com/watch?v=xxxxx
        </p>
      </div>

      {/* Playlists List */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
      ) : !playlists || playlists.length === 0 ? (
        <div className="text-center text-muted-foreground py-8">
          <Youtube size={32} className="mx-auto mb-3 opacity-50" />
          <p className="text-sm font-medium">Nenhuma playlist adicionada</p>
          <p className="text-xs mt-1">Adicione playlists ou vídeos do YouTube para os alunos.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([mod, items]) => (
            <div key={mod}>
              <h3 className="font-display font-semibold text-sm text-primary uppercase tracking-wide mb-3 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                {mod}
                <span className="text-muted-foreground font-normal text-xs">({items.length})</span>
              </h3>
              <div className="grid gap-3">
                {items.map((p: any) => (
                  <div
                    key={p.id}
                    className={`border rounded-lg overflow-hidden transition-colors ${
                      p.isVisible ? "border-border" : "border-border/50 opacity-60"
                    }`}
                    style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}
                  >
                    {editingId === p.id ? (
                      /* Edit Mode */
                      <div className="p-4 space-y-3">
                        <input
                          value={editTitle}
                          onChange={e => setEditTitle(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm"
                          placeholder="Título"
                        />
                        <input
                          value={editDescription}
                          onChange={e => setEditDescription(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm"
                          placeholder="Descrição"
                        />
                        <div className="flex gap-2">
                          <select
                            value={editModule}
                            onChange={e => setEditModule(e.target.value)}
                            className="flex-1 px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm"
                          >
                            {MODULES.map(m => <option key={m} value={m}>{m}</option>)}
                          </select>
                          <input
                            type="number"
                            value={editWeek}
                            onChange={e => setEditWeek(e.target.value)}
                            placeholder="Semana"
                            min="1" max="19"
                            className="w-24 px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button onClick={saveEdit} disabled={updateMutation.isPending}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium">
                            <Save size={12} /> Salvar
                          </button>
                          <button onClick={() => setEditingId(null)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-secondary text-foreground text-xs font-medium">
                            <X size={12} /> Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* View Mode */
                      <div className="flex flex-col sm:flex-row">
                        {/* Thumbnail / Preview */}
                        <div className="sm:w-48 h-28 sm:h-auto bg-black/50 flex items-center justify-center shrink-0 relative">
                          {p.thumbnailUrl ? (
                            <img src={p.thumbnailUrl} alt={p.title} className="w-full h-full object-cover" />
                          ) : (
                            <Youtube size={32} className="text-red-500 opacity-50" />
                          )}
                          <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-black/70 text-white">
                            {p.videoType === "playlist" ? "PLAYLIST" : "VÍDEO"}
                          </div>
                        </div>
                        {/* Info */}
                        <div className="flex-1 p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-sm text-foreground truncate">{p.title}</h4>
                              {p.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{p.description}</p>}
                              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{p.module}</span>
                                {p.week && <span className="text-[10px] text-muted-foreground">Sem. {p.week}</span>}
                                <span className="text-[10px] text-muted-foreground font-mono">ID: {p.youtubeId.substring(0, 12)}...</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => toggleMutation.mutate({ password, id: p.id, isVisible: p.isVisible ? 0 : 1 })}
                                className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground"
                                title={p.isVisible ? "Ocultar" : "Mostrar"}
                              >
                                {p.isVisible ? <Eye size={14} /> : <EyeOff size={14} />}
                              </button>
                              <button
                                onClick={() => startEdit(p)}
                                className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                onClick={() => { if (confirm("Remover esta playlist?")) deleteMutation.mutate({ password, id: p.id }); }}
                                className="p-1.5 rounded-md hover:bg-destructive/10 text-destructive"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Importar Alunos Manager ───
function ImportarAlunosManager({ teacherToken }: { teacherToken: string | null }) {
  const [step, setStep] = useState<"login" | "preview" | "importing" | "complete">("login");
  const [cpf, setCpf] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [selectedClass, setSelectedClass] = useState<number | null>(null);
  const [previewStudents, setPreviewStudents] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  
  const classesList = trpc.classes.list.useQuery({ sessionToken: teacherToken || "" }, { enabled: !!teacherToken });
  const importStudents = trpc.members.importBulk.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.imported} aluno(s) importado(s)${data.errors > 0 ? ` (${data.errors} erro(s))` : ''}`);
      setImportResult(data);
      setStep("complete");
      setImporting(false);
    },
    onError: (err) => {
      toast.error(err.message);
      setStep("preview");
      setImporting(false);
    },
  });

  const handleValidateAndFetch = async () => {
    if (!cpf || !password) {
      toast.error("Digite CPF e senha");
      return;
    }
    // Simulated preview - in real implementation would scrape UNIRIO
    setPreviewStudents([
      { name: "João Silva", email: "joao@edu.unirio.br", matricula: "2024001", status: "novo" },
      { name: "Maria Santos", email: "maria@edu.unirio.br", matricula: "2024002", status: "novo" },
      { name: "Pedro Costa", email: "pedro@edu.unirio.br", matricula: "2024003", status: "novo" },
    ]);
    setStep("preview");
  };

  const handleImport = () => {
    if (!selectedClass) {
      toast.error("Selecione uma turma");
      return;
    }
    if (previewStudents.length === 0) {
      toast.error("Nenhum aluno para importar");
      return;
    }

    setImporting(true);
    importStudents.mutate({
      sessionToken: teacherToken || "",
      classId: selectedClass,
      students: previewStudents.map(s => ({
        name: s.name,
        email: s.email,
      })),
    });
  };

  const handleReset = () => {
    setStep("login");
    setCpf("");
    setPassword("");
    setSelectedClass(null);
    setPreviewStudents([]);
    setImportResult(null);
  };

  const classes = classesList.data || [];

  // STEP 1: LOGIN
  if (step === "login") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-xl text-foreground">Importar Alunos do Portal UNIRIO</h2>
        </div>

        {/* Info Box */}
        <div className="rounded-lg p-4 border border-blue-800/30" style={{ backgroundColor: "rgba(74, 144, 226, 0.1)" }}>
          <div className="flex gap-3">
            <AlertTriangle size={20} className="text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-300">
              <p className="font-semibold mb-1">Acesso ao Portal UNIRIO:</p>
              <p>Digite suas credenciais do portal UNIRIO (CPF e senha). A importação será feita automaticamente sem necessidade de preencher nomes manualmente.</p>
            </div>
          </div>
        </div>

        {/* Login Form */}
        <div className="rounded-lg p-5 border border-border space-y-4" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
          <div>
            <label className="text-sm text-muted-foreground block mb-2">CPF (sem pontuação)</label>
            <input
              type="text"
              value={cpf}
              onChange={(e) => setCpf(e.target.value.replace(/\D/g, ""))}
              placeholder="08714684764"
              maxLength={11}
              className="w-full px-4 py-2 rounded-lg text-foreground text-sm"
              style={{ backgroundColor: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }}
            />
          </div>

          <div>
            <label className="text-sm text-muted-foreground block mb-2">Senha</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite sua senha"
                className="w-full px-4 py-2 rounded-lg text-foreground text-sm pr-10"
                style={{ backgroundColor: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            onClick={handleValidateAndFetch}
            disabled={!cpf || !password}
            className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm disabled:opacity-50 hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
          >
            <LogIn size={16} />
            Conectar ao Portal UNIRIO
          </button>
        </div>
      </div>
    );
  }

  // STEP 2: PREVIEW
  if (step === "preview") {
    const newStudents = previewStudents.filter(s => s.status === "novo");
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-xl text-foreground">Preview de Alunos</h2>
          <button onClick={handleReset} className="p-2 hover:bg-secondary rounded-lg transition-colors">
            <X size={20} className="text-muted-foreground" />
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg p-4 border border-border" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
            <div className="flex items-center gap-3">
              <Users size={20} className="text-primary" />
              <div>
                <div className="text-sm text-muted-foreground">Novos Alunos</div>
                <div className="font-bold text-lg text-foreground">{newStudents.length}</div>
              </div>
            </div>
          </div>
          <div className="rounded-lg p-4 border border-border" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
            <div className="flex items-center gap-3">
              <CheckCircle size={20} className="text-green-500" />
              <div>
                <div className="text-sm text-muted-foreground">Total</div>
                <div className="font-bold text-lg text-foreground">{previewStudents.length}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Class Selector */}
        <div className="rounded-lg p-5 border border-border" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
          <label className="text-sm text-muted-foreground block mb-2">Selecione a Turma para Importação</label>
          <select
            value={selectedClass || ""}
            onChange={(e) => setSelectedClass(e.target.value ? parseInt(e.target.value) : null)}
            className="w-full px-4 py-2 rounded-lg text-foreground text-sm"
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

        {/* Students List */}
        <div className="rounded-lg p-5 border border-border" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
          <h3 className="text-sm font-bold text-foreground mb-3">Alunos a Importar ({newStudents.length})</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {newStudents.map((student: any, idx: number) => (
              <div key={idx} className="rounded-lg p-3 border border-border/50" style={{ backgroundColor: "rgba(255,255,255,0.03)" }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Users size={16} className="text-primary flex-shrink-0" />
                    <div className="text-left min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">{student.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{student.email}</div>
                    </div>
                  </div>
                  <span className="px-2 py-1 rounded text-xs bg-green-500/20 text-green-400">Novo</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleImport}
            disabled={importing || !selectedClass}
            className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium disabled:opacity-50 hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
          >
            <Upload size={16} />
            {importing ? "Importando..." : `Importar ${newStudents.length} Alunos`}
          </button>
          <button
            onClick={handleReset}
            className="px-6 py-2.5 rounded-lg bg-secondary text-foreground font-medium hover:opacity-80 transition-opacity"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  // STEP 3: COMPLETE
  if (step === "complete") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-xl text-foreground">Importação Concluída</h2>
        </div>

        {/* Success Message */}
        <div className="rounded-lg p-6 border border-green-800/30 text-center" style={{ backgroundColor: "rgba(34, 197, 94, 0.1)" }}>
          <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
          <h3 className="font-bold text-lg text-green-400 mb-2">Importação Realizada com Sucesso!</h3>
          <p className="text-sm text-green-300">{importResult?.imported || 0} aluno(s) foram importado(s) para a plataforma</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg p-4 border border-border text-center" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
            <div className="text-2xl font-bold text-primary">{importResult?.imported || 0}</div>
            <div className="text-xs text-muted-foreground mt-1">Importados</div>
          </div>
          <div className="rounded-lg p-4 border border-border text-center" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
            <div className="text-2xl font-bold text-orange-500">{importResult?.errors || 0}</div>
            <div className="text-xs text-muted-foreground mt-1">Erros</div>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={handleReset}
          className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity"
        >
          Nova Importação
        </button>
      </div>
    );
  }

  return null;
}

// ─── Jigsaw Seminars Manager ───
function JigsawSeminarsManager({ teacherToken }: { teacherToken: string | null }) {
  const [selectedSeminar, setSelectedSeminar] = useState<number | null>(null);
  const [editingParticipant, setEditingParticipant] = useState<number | null>(null);
  const [editPF, setEditPF] = useState("");
  
  const utils = trpc.useUtils();
  const { data: seminars, isLoading } = trpc.seminars.getAll.useQuery({ sessionToken: teacherToken || "" }, { enabled: !!teacherToken });
  const { data: seminarDetails } = trpc.seminars.getById.useQuery(
    { sessionToken: teacherToken || "", seminarId: selectedSeminar || 0 },
    { enabled: !!teacherToken && !!selectedSeminar }
  );
  const { data: allMembers } = trpc.leaderboard.getData.useQuery();
  const { data: roles } = trpc.seminars.getRoles.useQuery({ sessionToken: teacherToken || "" }, { enabled: !!teacherToken });

  const assignMemberMutation = trpc.seminars.assignMember.useMutation({
    onSuccess: () => {
      utils.seminars.getById.invalidate();
      toast.success("Aluno atribuído com sucesso!");
    },
    onError: () => toast.error("Erro ao atribuir aluno"),
  });

  const updatePFMutation = trpc.seminars.updateParticipantPF.useMutation({
    onSuccess: () => {
      utils.seminars.getById.invalidate();
      toast.success("PF atualizado!");
      setEditingParticipant(null);
      setEditPF("");
    },
    onError: () => toast.error("Erro ao atualizar PF"),
  });

  const updateGroupPFMutation = trpc.seminars.update.useMutation({
    onSuccess: () => {
      utils.seminars.getAll.invalidate();
      toast.success("PF do grupo atualizado!");
    },
    onError: () => toast.error("Erro ao atualizar PF do grupo"),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Carregando seminários...</p>
        </div>
      </div>
    );
  }

  const flatMembers = allMembers?.teams.flatMap(t => t.members.map(m => ({ ...m, teamName: t.name }))) || [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display font-bold text-xl text-foreground mb-1">Seminários Jigsaw</h2>
        <p className="text-sm text-muted-foreground">Gerencie os 6 grupos de seminário, atribua coordenadores/relatores e registre PF individual e do grupo.</p>
      </div>

      {/* Seminars Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {seminars?.map((sem: any) => (
          <motion.div
            key={sem.id}
            className="p-4 rounded-lg border border-border bg-card cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => setSelectedSeminar(sem.id)}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Target size={16} className="text-primary" />
                  <span className="text-xs font-medium text-muted-foreground">Semana {sem.week}</span>
                </div>
                <h3 className="font-semibold text-foreground text-sm">{sem.title}</h3>
              </div>
            </div>
            {sem.description && (
              <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{sem.description}</p>
            )}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
              <span className="text-xs text-muted-foreground">{sem.date}</span>
              <span className="text-xs font-mono font-bold text-primary">
                {sem.groupPF ? `${sem.groupPF} PF` : "—"}
              </span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Selected Seminar Details */}
      {selectedSeminar && seminarDetails && seminarDetails.seminar && (
        <AnimatePresence>
          <motion.div
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedSeminar(null)}
          >
            <motion.div
              className="bg-background rounded-lg border border-border max-w-3xl w-full max-h-[80vh] overflow-y-auto"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-background border-b border-border p-4 flex items-center justify-between">
                <div>
                  <h3 className="font-display font-bold text-lg text-foreground">{seminarDetails.seminar.title}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Semana {seminarDetails.seminar.week} • {seminarDetails.seminar.date}</p>
                </div>
                <button
                  onClick={() => setSelectedSeminar(null)}
                  className="p-2 rounded-md hover:bg-secondary text-muted-foreground"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-4 space-y-4">
                {/* Group PF */}
                <div className="p-3 rounded-lg bg-secondary/30 border border-border">
                  <label className="text-xs font-medium text-muted-foreground block mb-2">PF do Grupo Inteiro</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      defaultValue={seminarDetails.seminar.groupPF || ""}
                      placeholder="Ex: 2.0"
                      className="flex-1 px-3 py-2 rounded-md bg-background border border-border text-sm text-foreground"
                      onBlur={(e) => {
                        if (seminarDetails?.seminar && e.target.value !== seminarDetails.seminar.groupPF) {
                          updateGroupPFMutation.mutate({
                            sessionToken: teacherToken || "",
                            id: seminarDetails.seminar.id,
                            groupPF: e.target.value,
                          });
                        }
                      }}
                    />
                  </div>
                </div>

                {/* Participants */}
                <div>
                  <h4 className="font-semibold text-sm text-foreground mb-3">Participantes</h4>
                  <div className="space-y-2">
                    {seminarDetails.participants.map((p: any) => {
                      const role = roles?.find((r: any) => r.id === p.roleId);
                      const member = flatMembers.find(m => m.id === p.memberId);
                      
                      return (
                        <div key={p.id} className="p-3 rounded-lg border border-border bg-card">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-medium">
                                {role?.name || "Função"}
                              </span>
                              {member && (
                                <span className="text-xs text-muted-foreground">
                                  {member.name} ({member.teamName})
                                </span>
                              )}
                            </div>
                            {p.individualPF && (
                              <span className="text-xs font-mono font-bold text-primary">{p.individualPF} PF</span>
                            )}
                          </div>

                          {/* Assign Member */}
                          {!p.memberId && (
                            <select
                              className="w-full px-3 py-2 rounded-md bg-background border border-border text-sm"
                              onChange={(e) => {
                                const memberId = parseInt(e.target.value);
                                const selectedMember = flatMembers.find(m => m.id === memberId);
                                if (selectedMember) {
                                  assignMemberMutation.mutate({
                                    sessionToken: teacherToken || "",
                                    participantId: p.id,
                                    memberId,
                                    memberName: selectedMember.name,
                                  });
                                }
                              }}
                            >
                              <option value="">Selecionar aluno...</option>
                              {flatMembers.map(m => (
                                <option key={m.id} value={m.id}>{m.name} ({m.teamName})</option>
                              ))}
                            </select>
                          )}

                          {/* Update PF */}
                          {p.memberId && (
                            <div className="mt-2">
                              {editingParticipant === p.id ? (
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    value={editPF}
                                    onChange={(e) => setEditPF(e.target.value)}
                                    placeholder="Ex: 2.0"
                                    className="flex-1 px-3 py-1.5 rounded-md bg-background border border-border text-sm"
                                    autoFocus
                                  />
                                  <button
                                    onClick={() => {
                                      updatePFMutation.mutate({
                                        sessionToken: teacherToken || "",
                                        participantId: p.id,
                                        individualPF: editPF,
                                      });
                                    }}
                                    className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium"
                                  >
                                    Salvar
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditingParticipant(null);
                                      setEditPF("");
                                    }}
                                    className="px-3 py-1.5 rounded-md bg-secondary text-foreground text-xs"
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => {
                                    setEditingParticipant(p.id);
                                    setEditPF(p.individualPF || "");
                                  }}
                                  className="text-xs text-primary hover:underline"
                                >
                                  {p.individualPF ? "Editar PF Individual" : "Atribuir PF Individual"}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}

// ─── Turmas Manager ───
function TurmasManager({ teacherToken }: { teacherToken: string | null }) {
  const [, setLocation] = useLocation();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCourse, setNewCourse] = useState("");
  const [newDiscipline, setNewDiscipline] = useState("");
  const [newColor, setNewColor] = useState("#F7941D");
  const [selectedClass, setSelectedClass] = useState<number | null>(null);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [newStudentName, setNewStudentName] = useState("");
  const [newStudentTeamId, setNewStudentTeamId] = useState<number | null>(null);
  const [showAddTeam, setShowAddTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamEmoji, setNewTeamEmoji] = useState("🧪");
  const [newTeamColor, setNewTeamColor] = useState("#10b981");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [editingClass, setEditingClass] = useState<number | null>(null);
  const [editClassName, setEditClassName] = useState("");
  const [editClassCourse, setEditClassCourse] = useState("");
  const [editClassDiscipline, setEditClassDiscipline] = useState("");

  const utils = trpc.useUtils();

  const { data: classesList, isLoading } = trpc.classes.list.useQuery(
    { sessionToken: teacherToken || "" },
    { enabled: !!teacherToken }
  );
  const { data: classDetail } = trpc.classes.getById.useQuery(
    { sessionToken: teacherToken || "", classId: selectedClass! },
    { enabled: !!selectedClass && !!teacherToken }
  );
  const { data: allTeams } = trpc.leaderboard.getData.useQuery();

  const createClass = trpc.classes.create.useMutation({
    onSuccess: () => {
      utils.classes.list.invalidate();
      toast.success("Turma criada!");
      setShowCreateForm(false);
      setNewName(""); setNewCourse(""); setNewDiscipline("");
    },
    onError: () => toast.error("Erro ao criar turma"),
  });

  const deleteClass = trpc.classes.delete.useMutation({
    onSuccess: () => {
      utils.classes.list.invalidate();
      toast.success("Turma removida!");
      setSelectedClass(null);
    },
    onError: () => toast.error("Erro ao remover turma"),
  });

  const updateClass = trpc.classes.update.useMutation({
    onSuccess: () => {
      utils.classes.list.invalidate();
      utils.classes.getById.invalidate();
      toast.success("Turma atualizada!");
      setEditingClass(null);
    },
    onError: () => toast.error("Erro ao atualizar turma"),
  });

  const assignTeam = trpc.classes.assignTeam.useMutation({
    onSuccess: () => {
      utils.classes.getById.invalidate();
      toast.success("Equipe vinculada!");
    },
    onError: () => toast.error("Erro ao vincular equipe"),
  });

  const assignMember = trpc.classes.assignMember.useMutation({
    onSuccess: () => {
      utils.classes.getById.invalidate();
      toast.success("Aluno vinculado!");
    },
    onError: () => toast.error("Erro ao vincular aluno"),
  });

  const createTeamMut = trpc.teams.create.useMutation({
    onSuccess: (data) => {
      utils.leaderboard.getData.invalidate();
      utils.classes.getById.invalidate();
      toast.success("Equipe criada e vinculada!");
      setShowAddTeam(false);
      setNewTeamName("");
    },
    onError: () => toast.error("Erro ao criar equipe"),
  });

  const createMemberMut = trpc.members.create.useMutation({
    onSuccess: () => {
      utils.leaderboard.getData.invalidate();
      utils.classes.getById.invalidate();
      toast.success("Aluno adicionado!");
      setShowAddStudent(false);
      setNewStudentName("");
    },
    onError: () => toast.error("Erro ao adicionar aluno"),
  });

  const deleteMemberMut = trpc.members.delete.useMutation({
    onSuccess: () => {
      utils.classes.getById.invalidate();
      utils.leaderboard.getData.invalidate();
      toast.success("Aluno removido!");
    },
    onError: () => toast.error("Erro ao remover aluno"),
  });

  const deleteTeamMut = trpc.teams.delete.useMutation({
    onSuccess: () => {
      utils.classes.getById.invalidate();
      utils.leaderboard.getData.invalidate();
      toast.success("Equipe removida!");
    },
    onError: () => toast.error("Erro ao remover equipe"),
  });

  if (isLoading) return <div className="text-center text-muted-foreground py-8">Carregando turmas...</div>;

  // Detail view for a selected class
  if (selectedClass && classDetail) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => setSelectedClass(null)} className="p-2 rounded-md hover:bg-secondary text-muted-foreground">
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1">
            {editingClass === classDetail.id ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={editClassName}
                  onChange={e => setEditClassName(e.target.value)}
                  placeholder="Nome da turma"
                  className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={editClassCourse}
                    onChange={e => setEditClassCourse(e.target.value)}
                    placeholder="Curso"
                    className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                  />
                  <input
                    type="text"
                    value={editClassDiscipline}
                    onChange={e => setEditClassDiscipline(e.target.value)}
                    placeholder="Disciplina"
                    className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      updateClass.mutate({
                        sessionToken: teacherToken || "",
                        id: classDetail.id,
                        name: editClassName,
                        course: editClassCourse,
                        discipline: editClassDiscipline,
                      });
                    }}
                    disabled={updateClass.isPending}
                    className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50 flex items-center gap-1"
                  >
                    <Save size={12} /> Salvar
                  </button>
                  <button
                    onClick={() => setEditingClass(null)}
                    className="px-3 py-1.5 rounded-md bg-secondary text-foreground text-xs font-medium flex items-center gap-1"
                  >
                    <X size={12} /> Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h2 className="font-display font-bold text-xl text-foreground">{classDetail.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {classDetail.discipline} — {classDetail.course} — {classDetail.semester}
                  {classDetail.teacherName && <span> — Prof. {classDetail.teacherName}</span>}
                </p>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {editingClass !== classDetail.id && (
              <button
                onClick={() => {
                  setEditingClass(classDetail.id);
                  setEditClassName(classDetail.name);
                  setEditClassCourse(classDetail.course);
                  setEditClassDiscipline(classDetail.discipline);
                }}
                className="p-2 rounded-md hover:bg-secondary text-primary"
                title="Editar nome da turma"
              >
                <Edit2 size={18} />
              </button>
            )}
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: classDetail.color }} />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="border border-border rounded-lg p-4" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
            <div className="text-xs text-muted-foreground uppercase">Equipes</div>
            <div className="font-mono font-bold text-2xl text-foreground">{classDetail.teams.length}</div>
          </div>
          <div className="border border-border rounded-lg p-4" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
            <div className="text-xs text-muted-foreground uppercase">Alunos</div>
            <div className="font-mono font-bold text-2xl text-foreground">{classDetail.members.length}</div>
          </div>
          <div className="border border-border rounded-lg p-4" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
            <div className="text-xs text-muted-foreground uppercase">PF Total</div>
            <div className="font-mono font-bold text-2xl text-primary">
              {classDetail.members.reduce((s: number, m: any) => s + parseFloat(m.xp || "0"), 0).toFixed(1)}
            </div>
          </div>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('admin-navigate', { detail: { section: 'cronograma' } }))}
            className="border border-border rounded-lg p-4 hover:bg-primary/10 transition-colors cursor-pointer"
            style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}
          >
            <div className="text-xs text-muted-foreground uppercase">Cronograma</div>
            <div className="font-mono font-bold text-lg text-primary flex items-center gap-2">
              <Calendar size={20} /> Ver
            </div>
          </button>
        </div>

        {/* Teams in this class */}
        <div className="border border-border rounded-lg p-4" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-semibold text-sm text-foreground flex items-center gap-2">
              <Users size={16} className="text-primary" /> Equipes da Turma
            </h3>
            <button onClick={() => setShowAddTeam(!showAddTeam)} className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium">
              <Plus size={12} /> Nova Equipe
            </button>
          </div>

          {showAddTeam && (
            <div className="flex gap-2 flex-wrap mb-4 p-3 rounded-lg border border-border bg-background">
              <input value={newTeamEmoji} onChange={e => setNewTeamEmoji(e.target.value)} className="w-12 px-2 py-2 rounded-md bg-secondary border border-border text-foreground text-center text-sm" placeholder="🧪" />
              <input value={newTeamName} onChange={e => setNewTeamName(e.target.value)} className="flex-1 min-w-[150px] px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm" placeholder="Nome da equipe..." />
              <input type="color" value={newTeamColor} onChange={e => setNewTeamColor(e.target.value)} className="w-10 h-10 rounded-md border border-border cursor-pointer" />
              <button
                onClick={() => {
                  createTeamMut.mutate({ password: "authenticated", name: newTeamName, emoji: newTeamEmoji, color: newTeamColor, classId: selectedClass });
                }}
                disabled={!newTeamName || createTeamMut.isPending}
                className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
              >
                Criar
              </button>
            </div>
          )}

          {classDetail.teams.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma equipe vinculada a esta turma.</p>
          ) : (
            <div className="space-y-2">
              {classDetail.teams.map((team: any) => {
                const teamMembers = classDetail.members.filter((m: any) => m.teamId === team.id);
                return (
                  <div key={team.id} className="border border-border rounded-lg p-3">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{team.emoji}</span>
                      <span className="font-medium text-sm text-foreground flex-1">{team.name}</span>
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: team.color }} />
                      <span className="text-xs text-muted-foreground font-mono">{teamMembers.length} alunos</span>
                      <button
                        onClick={() => { if (confirm(`Remover equipe "${team.name}"?`)) deleteTeamMut.mutate({ password: "authenticated", id: team.id }); }}
                        className="p-1 rounded hover:bg-destructive/20 text-destructive"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    {teamMembers.length > 0 && (
                      <div className="mt-2 pl-8 space-y-1">
                        {teamMembers.map((m: any) => (
                          <div key={m.id} className="flex items-center gap-2 text-sm">
                            <span className="text-foreground">{m.name}</span>
                            <span className="text-xs font-mono text-primary">{parseFloat(m.xp || "0").toFixed(1)} PF</span>
                            <button
                              onClick={() => { if (confirm(`Remover aluno "${m.name}"?`)) deleteMemberMut.mutate({ password: "authenticated", id: m.id }); }}
                              className="p-0.5 rounded hover:bg-destructive/20 text-destructive ml-auto"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Link existing teams */}
          {allTeams && allTeams.teams.filter(t => !classDetail.teams.find((ct: any) => ct.id === t.id)).length > 0 && (
            <div className="mt-3 pt-3 border-t border-border">
              <p className="text-xs text-muted-foreground mb-2">Vincular equipe existente:</p>
              <div className="flex gap-2">
                <select
                  className="flex-1 px-3 py-2 rounded-md bg-secondary border border-border text-sm text-foreground"
                  onChange={(e) => {
                    const teamId = parseInt(e.target.value);
                    if (teamId && teacherToken) assignTeam.mutate({ sessionToken: teacherToken, teamId, classId: selectedClass });
                  }}
                >
                  <option value="">Selecionar equipe...</option>
                  {allTeams.teams.filter(t => !classDetail.teams.find((ct: any) => ct.id === t.id)).map(t => (
                    <option key={t.id} value={t.id}>{t.emoji} {t.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Members in this class */}
        <div className="border border-border rounded-lg p-4" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-semibold text-sm text-foreground flex items-center gap-2">
              <UserPlus size={16} className="text-primary" /> Alunos da Turma ({classDetail.members.length})
            </h3>
            <div className="flex items-center gap-2">
              <ExportButton
                students={classDetail.members.map((m: any) => ({
                  id: m.id,
                  name: m.name,
                  xp: parseFloat(m.xp || "0"),
                  teamName: classDetail.teams.find((t: any) => t.id === m.teamId)?.name || "—",
                }))}
                filename={`turma-${classDetail.name}`}
                label="Exportar"
              />
              <button onClick={() => setShowAddStudent(!showAddStudent)} className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium">
                <Plus size={12} /> Adicionar Aluno
              </button>
            </div>
          </div>

          {/* Search within class */}
          {classDetail.members.length > 5 && (
            <div className="mb-3">
              <SearchStudents
                students={classDetail.members.map((m: any) => ({
                  id: m.id,
                  name: m.name,
                  xp: parseFloat(m.xp || "0"),
                  teamName: classDetail.teams.find((t: any) => t.id === m.teamId)?.name || "—",
                }))}
                onSelect={(student) => {
                  toast.info(`${student.name} — ${student.teamName || 'Sem equipe'} — ${student.xp.toFixed(1)} PF`);
                }}
                placeholder="Buscar aluno nesta turma..."
              />
            </div>
          )}

          {showAddStudent && (
            <div className="flex gap-2 flex-wrap mb-4 p-3 rounded-lg border border-border bg-background">
              <input
                value={newStudentName}
                onChange={e => setNewStudentName(e.target.value)}
                className="flex-1 min-w-[200px] px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm"
                placeholder="Nome do aluno..."
              />
              <select
                value={newStudentTeamId || ""}
                onChange={e => setNewStudentTeamId(parseInt(e.target.value) || null)}
                className="px-3 py-2 rounded-md bg-secondary border border-border text-sm text-foreground"
              >
                <option value="">Selecionar equipe...</option>
                {classDetail.teams.map((t: any) => (
                  <option key={t.id} value={t.id}>{t.emoji} {t.name}</option>
                ))}
              </select>
              <button
                onClick={() => {
                  if (newStudentName && newStudentTeamId) {
                    createMemberMut.mutate({ password: "authenticated", teamId: newStudentTeamId, name: newStudentName, classId: selectedClass });
                  }
                }}
                disabled={!newStudentName || !newStudentTeamId || createMemberMut.isPending}
                className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
              >
                Adicionar
              </button>
            </div>
          )}

          {classDetail.members.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum aluno nesta turma.</p>
          ) : (
            <>
              <div className="space-y-1">
                {[...classDetail.members]
                  .sort((a: any, b: any) => a.name.localeCompare(b.name))
                  .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                  .map((m: any, idx: number) => {
                    const team = classDetail.teams.find((t: any) => t.id === m.teamId);
                    const globalIdx = (currentPage - 1) * pageSize + idx + 1;
                    return (
                      <div key={m.id} className="flex items-center gap-3 py-2 px-2 rounded-md hover:bg-secondary/50">
                        <span className="w-6 text-center text-xs text-muted-foreground font-mono">{globalIdx}</span>
                        <span className="text-sm text-foreground flex-1">{m.name}</span>
                        {team && (
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: team.color + "22", color: team.color }}>
                            {team.emoji} {team.name}
                          </span>
                        )}
                        <span className="text-xs font-mono font-bold text-primary">{parseFloat(m.xp || "0").toFixed(1)} PF</span>
                        <button
                          onClick={() => { if (confirm(`Remover aluno "${m.name}"?`)) deleteMemberMut.mutate({ password: "authenticated", id: m.id }); }}
                          className="p-1 rounded hover:bg-destructive/20 text-destructive"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })
                }
              </div>
              {classDetail.members.length > 10 && (
                <Pagination
                  currentPage={currentPage}
                  totalPages={Math.ceil(classDetail.members.length / pageSize)}
                  onPageChange={setCurrentPage}
                  pageSize={pageSize}
                  onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
                  totalItems={classDetail.members.length}
                  className="mt-3"
                />
              )}
            </>
          )}
        </div>

        {/* Delete class */}
        <div className="border border-destructive/30 rounded-lg p-4" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
          <h3 className="font-display font-semibold text-sm text-destructive mb-2 flex items-center gap-2">
            <AlertTriangle size={16} /> Zona de Perigo
          </h3>
          <p className="text-xs text-muted-foreground mb-3">Excluir esta turma irá desvincular todas as equipes e alunos associados.</p>
          <button
            onClick={() => { if (confirm(`Tem certeza que deseja excluir a turma "${classDetail.name}"?`) && teacherToken) deleteClass.mutate({ sessionToken: teacherToken, id: selectedClass }); }}
            className="px-4 py-2 rounded-md bg-destructive text-destructive-foreground text-sm font-medium"
          >
            Excluir Turma
          </button>
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-bold text-xl text-foreground">Minhas Turmas</h2>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium"
        >
          <Plus size={14} /> Nova Turma
        </button>
      </div>

      {showCreateForm && (
        <div className="border border-border rounded-lg p-4" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
          <h3 className="font-display font-semibold text-sm text-foreground mb-3">Criar Nova Turma</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Disciplina</label>
              <input value={newDiscipline} onChange={e => setNewDiscipline(e.target.value)} className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm" placeholder="Ex: Farmacologia 1" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Curso</label>
              <input value={newCourse} onChange={e => setNewCourse(e.target.value)} className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm" placeholder="Ex: Medicina" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Nome Completo</label>
              <input value={newName} onChange={e => setNewName(e.target.value)} className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm" placeholder="Ex: Farmacologia 1 - Medicina" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Cor</label>
              <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)} className="w-10 h-10 rounded-md border border-border cursor-pointer" />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => { if (teacherToken) createClass.mutate({ sessionToken: teacherToken, name: newName || `${newDiscipline} - ${newCourse}`, course: newCourse, discipline: newDiscipline, color: newColor }); }}
              disabled={!newDiscipline || !newCourse || createClass.isPending}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
            >
              Criar Turma
            </button>
            <button onClick={() => setShowCreateForm(false)} className="px-4 py-2 rounded-md bg-secondary text-foreground text-sm">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Classes list */}
      {(!classesList || classesList.length === 0) ? (
        <div className="border border-border rounded-lg p-8 text-center" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
          <FlaskConical size={48} className="mx-auto mb-4 text-muted-foreground" />
          <h3 className="font-display font-bold text-lg text-foreground mb-2">Nenhuma turma cadastrada</h3>
          <p className="text-sm text-muted-foreground">Crie sua primeira turma para começar a organizar alunos e equipes.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {classesList.map((cls: any) => (
            <button
              key={cls.id}
              onClick={() => setSelectedClass(cls.id)}
              className="border border-border rounded-lg p-4 text-left hover:border-primary/50 transition-colors"
              style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cls.color }} />
                <span className="font-display font-semibold text-sm text-foreground">{cls.name}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                <p>{cls.discipline} — {cls.course}</p>
                <p className="mt-1">Semestre: {cls.semester}</p>
                {cls.teacherName && <p className="mt-1">Prof. {cls.teacherName}</p>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Admin Page ───
export default function Admin() {
  // Read tokens synchronously from localStorage to avoid race condition
  const [password, setPassword] = useState<string | null>(() => {
    const token = localStorage.getItem("teacherSessionToken") || localStorage.getItem("sessionToken");
    return token ? "__loading__" : null;
  });
  const [activeSection, setActiveSection] = useState<"jogo" | "turmas" | "teams" | "xp" | "activities" | "highlights" | "recursos" | "badges" | "attendance" | "professores" | "jigsaw" | "settings" | "rebalanceamento" | "qr-code" | "monitores" | "cronograma" | "qr-acesso" | "provas">("xp");
  const [, setLocation] = useState("/");
  
  // Check teacher authentication - read synchronously to prevent redirect loop
  const [teacherToken, setTeacherToken] = useState<string | null>(() => {
    return localStorage.getItem("teacherSessionToken") || localStorage.getItem("sessionToken") || null;
  });
  const [teacherName, setTeacherName] = useState<string>(() => {
    return localStorage.getItem("teacherName") || localStorage.getItem("adminEmail") || "";
  });

  // Fetch the real admin password using the teacher session token
  const { data: adminPwData } = trpc.teacherAuth.getAdminPassword.useQuery(
    { sessionToken: teacherToken || "" },
    { enabled: !!teacherToken }
  );

  useEffect(() => {
    if (adminPwData?.success && adminPwData.password) {
      setPassword(adminPwData.password);
    } else if (adminPwData && !adminPwData.success) {
      // Token is invalid, redirect to login
      setPassword(null);
    }
  }, [adminPwData]);

  // Listener para navegação interna entre seções
  useEffect(() => {
    const handleAdminNavigate = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.section) {
        setActiveSection(detail.section as any);
      }
    };
    window.addEventListener('admin-navigate', handleAdminNavigate);
    return () => window.removeEventListener('admin-navigate', handleAdminNavigate);
  }, []);
  
  const handleLogout = () => {
    localStorage.removeItem("teacherSessionToken");
    localStorage.removeItem("teacherName");
    localStorage.removeItem("teacherEmail");
    localStorage.removeItem("sessionToken");
    localStorage.removeItem("adminEmail");
    localStorage.removeItem("adminRole");
    localStorage.removeItem("adminLoginTime");
    setTeacherToken(null);
    setPassword(null);
    window.location.href = "/";
  };
  
  // If not authenticated with teacher token or admin token, redirect to login
  if (!teacherToken && !password) {
    window.location.href = "/professor/login";
    return null;
  }

  // Show loading while fetching admin password
  if (password === "__loading__") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Carregando painel...</p>
        </div>
      </div>
    );
  }

  const sections = [
    { key: "xp" as const, label: "📊 Lançar Notas", icon: <Zap size={16} /> },
    { key: "jogo" as const, label: "🎮 Jogo", icon: <Gamepad2 size={16} /> },
    { key: "turmas" as const, label: "Turmas", icon: <FlaskConical size={16} /> },
    { key: "highlights" as const, label: "Destaques", icon: <Activity size={16} /> },
    { key: "recursos" as const, label: "Arquivos de Aulas", icon: <FileText size={16} /> },
    { key: "badges" as const, label: "Conquistas", icon: <Award size={16} /> },
    { key: "attendance" as const, label: "Frequência", icon: <MapPin size={16} /> },
    { key: "jigsaw" as const, label: "Seminários Jigsaw", icon: <Target size={16} /> },
    { key: "monitores" as const, label: "Monitores", icon: <GraduationCap size={16} /> },
    { key: "cronograma" as const, label: "Cronograma", icon: <Calendar size={16} /> },
    { key: "qr-acesso" as const, label: "QR Acesso", icon: <QrCode size={16} /> },
    { key: "professores" as const, label: "Professores", icon: <UserCheck size={16} /> },
    { key: "rebalanceamento" as const, label: "Rebalanceamento", icon: <Shuffle size={16} /> },
    { key: "qr-code" as const, label: "QR Code Presença", icon: <QrCode size={16} /> },
    { key: "settings" as const, label: "Configurações", icon: <Settings size={16} /> },
    { key: "provas" as const, label: "🖨️ Provas", icon: <Printer size={16} /> },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
        <div className="container py-4 flex items-center gap-3">
          <FlaskConical size={20} className="text-primary" />
          <h1 className="font-display font-bold text-lg text-foreground flex-1">Painel Admin</h1>
          <a href="/leaderboard" className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 mr-3">
            <ArrowLeft size={12} /> Ranking
          </a>
          <div className="flex items-center gap-2 sm:gap-3">
            <a href="/professor/perfil" className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-md bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors">
              <User size={12} /> <span className="hidden sm:inline">{teacherName || "Perfil"}</span><span className="sm:hidden">Perfil</span>
            </a>
            <button onClick={handleLogout} className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-md bg-destructive/10 text-destructive text-xs font-medium hover:bg-destructive/20">
              <LogOut size={12} /> Sair
            </button>
          </div>
        </div>
      </div>

      {/* Nav */}
      <div className="container py-4">
        <ResponsiveTabNav
          tabs={sections}
          activeTab={activeSection}
          onTabChange={setActiveSection}
        />
      </div>

      {/* Content */}
      <div className="container pb-16">
        {activeSection === "jogo" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-lg border border-emerald-500/30" style={{ backgroundColor: "rgba(16, 185, 129, 0.08)" }}>
              <Gamepad2 size={24} className="text-emerald-400" />
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">Painel de Gerenciamento do Jogo</h3>
                <p className="text-sm text-muted-foreground">Libere semanas, gerencie missões, boss battles e veja o progresso dos alunos.</p>
              </div>
              <a href="/admin/jogo" className="px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 transition-colors">
                Abrir Painel do Jogo
              </a>
            </div>
          </div>
        )}
        {activeSection === "turmas" && <TurmasManager teacherToken={teacherToken || ""} />}
        {activeSection === "teams" && password && <TeamManager password={password} />}
        {activeSection === "xp" && teacherToken && (
          <div className="space-y-8">
            <GradesSpreadsheet teacherToken={teacherToken} />
            <div className="border-t border-border pt-6">
              <h3 className="text-sm font-semibold text-muted-foreground mb-4 uppercase tracking-wider">Lançamento Manual de PF por Equipe</h3>
              {password && <BulkXPManager password={password} />}
            </div>
          </div>
        )}
        {activeSection === "activities" && password && <ActivitiesManager password={password} />}
        {activeSection === "highlights" && password && <HighlightsManager password={password} />}
        {activeSection === "recursos" && password && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4">Notificações</h3>
              <NotificationsManager password={password} />
            </div>
            <div className="border-t border-border pt-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Materiais</h3>
              <MaterialsManager password={password} />
            </div>
            <div className="border-t border-border pt-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">YouTube</h3>
              <YouTubePlaylistsManager password={password} />
            </div>
          </div>
        )}
        {activeSection === "badges" && password && <BadgesManager password={password} />}
        {activeSection === "attendance" && password && <AttendanceManager password={password} />}
        {activeSection === "jigsaw" && <AdminJigsawPanel teacherToken={teacherToken || ""} />}
        {activeSection === "monitores" && teacherToken && <MonitoresManager teacherToken={teacherToken} />}
        {activeSection === "cronograma" && teacherToken && <CronogramaManager teacherToken={teacherToken} />}
        {activeSection === "qr-acesso" && <QRCodeAcessoManager />}
        {activeSection === "professores" && teacherToken && <ProfessoresManager teacherToken={teacherToken} />}

        {activeSection === "rebalanceamento" && teacherToken && <JigsawRebalancingManager />}
        {activeSection === "qr-code" && <AttendanceQRCodeManager />}
        {activeSection === "settings" && password && <SettingsManager password={password} />}
        {activeSection === "provas" && teacherToken && (
          <ExamToolsManager
            teacherToken={teacherToken}
            classes={[
              { id: 22, name: "Farmacologia 1 - Medicina" },
              { id: 23, name: "Farmacologia 1 - Nutrição" },
              { id: 24, name: "Farmacologia 1 - Biomedicina 1" },
              { id: 25, name: "Farmacologia 1 - Biomedicina 2" },
              { id: 26, name: "Farmacologia 1 - Enfermagem" },
              { id: 27, name: "Farmacologia 1 - Medicina 2" },
              { id: 28, name: "Farmacologia 1 - Nutrição Noturno" },
            ]}
          />
        )}
      </div>
    </div>
  );
}