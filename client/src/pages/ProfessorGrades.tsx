/**
 * ProfessorGrades — Tabela de notas do Professor Pedro
 * Farmacologia 1 · Medicina · UNIRIO
 *
 * Fórmula da nota final:
 *   Nota_Atividades = média(Kahoot1..4, CasoClin1..4, Jigsaw) × 0,25
 *   Nota_Provas = média(P1_final, P2_final) × 0,75
 *   Nota_Final = Nota_Atividades + Nota_Provas
 *
 *   P1_final = P1 + 0,2 (se elegível para bônus)
 *   P2_final = P2 + 0,2 (se elegível para bônus)
 *
 * Critério de bônus:
 *   - Completar metade do jogo até P1 / jogo completo até P2
 *   - ≥ 64 PFs de Kahoot + Casos Clínicos
 */
import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Save, RefreshCw, Download, FlaskConical, Trophy, CheckCircle2,
  Info, ArrowLeft, Eye, EyeOff, AlertTriangle, BookOpen, Gamepad2,
  Star, ChevronDown, ChevronUp, Calendar, Mail, FileText,
  Award, Users, Plus, Trash2, Edit3, X, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";

// ─── Helper importado localmente ────────────────────────────────────────────
function gradeToPF(grade: number): number {
  if (grade >= 2.5) return 10;
  if (grade >= 2.0) return 8;
  if (grade >= 1.5) return 6;
  if (grade > 0) return Math.round((grade / 2.5) * 6 * 10) / 10;
  return 0;
}

// ─── Constantes ────────────────────────────────────────────────────────────────
const BASE_URL = "https://2026.conexaofarmacologia.com.br/api/trpc";
const TEACHER_TOKEN_KEY = "prof_grades_teacher_token";
const CLASS_ID = 22; // Farmacologia 1 - Medicina
const BONUS_PF_THRESHOLD = 64;
const BONUS_VALUE = 0.2;

const TEAMS = [
  { id: 46, name: "Paracetamol" },
  { id: 47, name: "Varfarina" },
  { id: 48, name: "Pilocarpina" },
  { id: 49, name: "Neostigmina" },
  { id: 50, name: "Atropina" },
  { id: 51, name: "Morfina" },
  { id: 52, name: "Amoxicilina" },
  { id: 53, name: "Captopril" },
  { id: 54, name: "Metformina" },
  { id: 55, name: "Atorvastatina" },
  { id: 56, name: "Omeprazol" },
  { id: 57, name: "Fluoxetina" },
  { id: 58, name: "Propranolol" },
  { id: 59, name: "Dexametasona" },
  { id: 60, name: "Azitromicina" },
  { id: 61, name: "Dipirona" },
];

const KAHOOTS = ["Kahoot 1", "Kahoot 2", "Kahoot 3", "Kahoot 4"];
const CASOS = ["Caso Clínico 1", "Caso Clínico 2", "Caso Clínico 3", "Caso Clínico 4"];

// ─── API helpers ──────────────────────────────────────────────────────────────
async function trpcQuery(path: string, input: object) {
  const p = encodeURIComponent(JSON.stringify({ json: input }));
  const r = await fetch(`${BASE_URL}/${path}?input=${p}`);
  const data = await r.json();
  if (data.error) throw new Error(data.error.json?.message || "Erro desconhecido");
  return data.result.data.json;
}

async function trpcMutation(path: string, input: object) {
  const r = await fetch(`${BASE_URL}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ json: input }),
  });
  const data = await r.json();
  if (data.error) throw new Error(data.error.json?.message || "Erro desconhecido");
  return data.result.data.json;
}

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface StudentRow {
  memberId: number;
  name: string;
  teamId: number;
  teamName: string;
  // Notas de atividades (por equipe, vindas dos monitores)
  kahoot1: number; kahoot2: number; kahoot3: number; kahoot4: number;
  caso1: number; caso2: number; caso3: number; caso4: number;
  // Jigsaw (automático da plataforma)
  jigsawPF: number;
  // Provas (lançadas pelo professor)
  p1: number;
  p2: number;
  // Progresso do jogo
  questsCompleted: number;
  questsTotal: number;
  gameCompleted: boolean;
  gamePF: number;
  // Calculados
  totalActivityPF: number;
  eligible: boolean;
  p1Final: number;
  p2Final: number;
  mediaAtividades: number;
  mediaProvas: number;
  notaFinal: number;
}

// ─── Cálculos ─────────────────────────────────────────────────────────────────
function calcStudent(s: Omit<StudentRow, "totalActivityPF" | "eligible" | "p1Final" | "p2Final" | "mediaAtividades" | "mediaProvas" | "notaFinal">): StudentRow {
  const kahootPF = gradeToPF(s.kahoot1) + gradeToPF(s.kahoot2) + gradeToPF(s.kahoot3) + gradeToPF(s.kahoot4);
  const casoPF = gradeToPF(s.caso1) + gradeToPF(s.caso2) + gradeToPF(s.caso3) + gradeToPF(s.caso4);
  const totalActivityPF = kahootPF + casoPF;
  const eligible = totalActivityPF >= BONUS_PF_THRESHOLD && s.gameCompleted;
  const p1Final = Math.min(10, s.p1 + (eligible ? BONUS_VALUE : 0));
  const p2Final = Math.min(10, s.p2 + (eligible ? BONUS_VALUE : 0));

  // Converter PFs de atividades para nota 0-10
  // Kahoot: max 40 PF → 0-10 | Caso: max 40 PF → 0-10 | Jigsaw: 0-10 PF → 0-10
  const kahootNota = (kahootPF / 40) * 10;
  const casoNota = (casoPF / 40) * 10;
  const jigsawNota = Math.min(10, s.jigsawPF);

  const mediaAtividades = (kahootNota + casoNota + jigsawNota) / 3;
  const mediaProvas = (p1Final + p2Final) / 2;
  const notaFinal = mediaAtividades * 0.25 + mediaProvas * 0.75;

  return { ...s, totalActivityPF, eligible, p1Final, p2Final, mediaAtividades, mediaProvas, notaFinal };
}

// ─── Grade Input ──────────────────────────────────────────────────────────────
function ProvaInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const color = value >= 7 ? "#10b981" : value >= 5 ? "#f59e0b" : value > 0 ? "#ef4444" : "#475569";
  return (
    <input
      type="number"
      min={0}
      max={10}
      step={0.1}
      value={value === 0 ? "" : value}
      onChange={e => {
        const v = parseFloat(e.target.value);
        if (!isNaN(v) && v >= 0 && v <= 10) onChange(Math.round(v * 10) / 10);
        else if (e.target.value === "") onChange(0);
      }}
      className="w-16 text-center bg-[#1a2744] border border-[#1e3a5f] rounded px-1 py-1 text-sm font-mono text-white focus:outline-none focus:border-blue-400"
      style={{ color: value > 0 ? color : undefined }}
    />
  );
}

// ─── Login ────────────────────────────────────────────────────────────────────
function LoginForm({ onLogin }: { onLogin: (token: string, name: string) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) { toast.error("Preencha email e senha"); return; }
    setLoading(true);
    try {
      const res = await trpcMutation("teacherAuth.login", { email, password });
      if (res?.success && res?.sessionToken) {
        onLogin(res.sessionToken, res.teacher?.name || email);
        return;
      }
      // Tentar superAdmin
      const res2 = await trpcMutation("teacherAuth.superAdminLogin", { email, password });
      if (res2?.sessionToken) {
        onLogin(res2.sessionToken, "Super Admin");
        return;
      }
      toast.error("Acesso negado. Apenas professores podem acessar esta página.");
    } catch (e: any) {
      toast.error(e.message || "Erro ao fazer login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <Card className="bg-[#111827] border-[#1e3a5f] p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-8 h-8 text-purple-400" />
            </div>
            <h1 className="text-2xl font-bold text-white">Tabela do Professor</h1>
            <p className="text-slate-400 mt-1 text-sm">Farmacologia 1 — Medicina · UNIRIO</p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Email institucional</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()}
                placeholder="professor@unirio.br"
                className="w-full bg-[#1a2744] border border-[#1e3a5f] rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors" />
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Senha</label>
              <div className="relative">
                <input type={showPwd ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()}
                  placeholder="••••••••"
                  className="w-full bg-[#1a2744] border border-[#1e3a5f] rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors pr-10" />
                <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <Button onClick={handleLogin} disabled={loading} className="w-full bg-purple-600 hover:bg-purple-700 text-white">
              {loading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
              Entrar como Professor
            </Button>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}

// ─── Export CSV ───────────────────────────────────────────────────────────────
function exportCSV(students: StudentRow[]) {
  const headers = [
    "Nome", "Equipe",
    "Kahoot 1", "Kahoot 2", "Kahoot 3", "Kahoot 4",
    "Caso Clínico 1", "Caso Clínico 2", "Caso Clínico 3", "Caso Clínico 4",
    "Jigsaw (PF)", "PF Atividades Total",
    "Jogo Completo", "Elegível Bônus",
    "P1", "P2", "P1 Final (+bônus)", "P2 Final (+bônus)",
    "Média Atividades (×0,25)", "Média Provas (×0,75)", "Nota Final",
  ];
  const rows = students.map(s => [
    s.name, s.teamName,
    s.kahoot1, s.kahoot2, s.kahoot3, s.kahoot4,
    s.caso1, s.caso2, s.caso3, s.caso4,
    s.jigsawPF.toFixed(2), s.totalActivityPF.toFixed(0),
    s.gameCompleted ? "Sim" : "Não", s.eligible ? "Sim" : "Não",
    s.p1, s.p2, s.p1Final.toFixed(1), s.p2Final.toFixed(1),
    (s.mediaAtividades * 0.25).toFixed(2), (s.mediaProvas * 0.75).toFixed(2), s.notaFinal.toFixed(2),
  ]);
  const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(";")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `notas_farmacologia1_medicina_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ProfessorGrades() {
  const [sessionToken, setSessionToken] = useState<string>(
    () => localStorage.getItem(TEACHER_TOKEN_KEY) || ""
  );
  const [userName, setUserName] = useState<string>(() => localStorage.getItem("prof_grades_user_name") || "");
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [provaGrades, setProvaGrades] = useState<Record<number, { p1: number; p2: number }>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  // Ref para provaGrades para evitar loop infinito no useCallback
  const provaGradesRef = useRef<Record<number, { p1: number; p2: number }>>({});
  const [sortCol, setSortCol] = useState<string>("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [filterTeam, setFilterTeam] = useState<number | "all">("all");
  const [showFormula, setShowFormula] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  // ─── Aba ativa ───────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"grades" | "teacher_grades" | "certificates">("grades");
  // ─── Teacher Grades ───────────────────────────────────────────────────────
  const [teacherGrades, setTeacherGrades] = useState<any[]>([]);
  const [tgLoading, setTgLoading] = useState(false);
  const [tgImporting, setTgImporting] = useState(false);
  const [tgEditId, setTgEditId] = useState<number | null>(null);
  const [tgEditGrade, setTgEditGrade] = useState("");
  const [tgEditNotes, setTgEditNotes] = useState("");
  const [tgNewForm, setTgNewForm] = useState(false);
  const [tgNewData, setTgNewData] = useState({ activityType: "kahoot", activityName: "", memberName: "", groupName: "", grade: "", maxGrade: "10", notes: "" });
  // ─── Certificates ─────────────────────────────────────────────────────────
  const [monitors, setMonitors] = useState<any[]>([]);
  const [certificates, setCertificates] = useState<any[]>([]);
  const [certLoading, setCertLoading] = useState(false);
  const [certIssuing, setCertIssuing] = useState(false);
  const [certForm, setCertForm] = useState({ monitorAccountId: "", periodStart: "", periodEnd: "", workloadHours: "60", professorTitle: "Prof. Dr.", department: "Departamento de Farmácia e Administração Farmacêutica" });

  const handleSendEmail = useCallback(async () => {
    if (!sessionToken || students.length === 0) return;
    setSendingEmail(true);
    try {
      // Gerar CSV
      const headers = [
        "Nome", "Equipe",
        "Kahoot 1", "Kahoot 2", "Kahoot 3", "Kahoot 4",
        "Caso Clínico 1", "Caso Clínico 2", "Caso Clínico 3", "Caso Clínico 4",
        "Jigsaw (PF)", "PF Atividades Total",
        "Jogo Completo", "Elegível Bônus",
        "P1", "P2", "P1 Final (+bônus)", "P2 Final (+bônus)",
        "Média Atividades (×0,25)", "Média Provas (×0,75)", "Nota Final",
      ];
      const rows = students.map(s => [
        s.name, s.teamName,
        s.kahoot1, s.kahoot2, s.kahoot3, s.kahoot4,
        s.caso1, s.caso2, s.caso3, s.caso4,
        s.jigsawPF.toFixed(2), s.totalActivityPF.toFixed(0),
        s.gameCompleted ? "Sim" : "Não", s.eligible ? "Sim" : "Não",
        s.p1, s.p2, s.p1Final.toFixed(1), s.p2Final.toFixed(1),
        (s.mediaAtividades * 0.25).toFixed(2), (s.mediaProvas * 0.75).toFixed(2), s.notaFinal.toFixed(2),
      ]);
      const csvContent = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(";")).join("\n");

      const res = await trpcMutation("teacherAuth.sendGradesReport", {
        sessionToken,
        csvContent,
        className: "Farmacologia I - Medicina",
        totalStudents: students.length,
      });

      if (res?.success) {
        toast.success(res.message || "Relatório enviado por email!");
      } else {
        toast.error(res?.message || "Erro ao enviar email");
      }
    } catch (err: any) {
      toast.error("Erro ao enviar email: " + (err.message || "desconhecido"));
    } finally {
      setSendingEmail(false);
    }
  }, [sessionToken, students]);

  const loadData = useCallback(async (token?: string) => {
    const t = token || sessionToken;
    if (!t) return;
    setLoading(true);
    try {
      // Buscar dados em paralelo — erros parciais não bloqueiam o carregamento
      const [membersData, activityGrades, jigsawScores, gameProgress, provaGradesAPI] = await Promise.all([
        trpcQuery("members.list", { sessionToken: t }).catch(() => []),
        trpcQuery("monitors.adminListActivityGrades", { teacherSessionToken: t, classId: CLASS_ID }).catch(() => []),
        trpcQuery("jigsawComplete.scores.getByClass", { classId: CLASS_ID, sessionToken: t }).catch(() => []),
        trpcQuery("game.getAllProgress", { classId: CLASS_ID }).catch(() => []),
        trpcQuery("monitors.adminListActivityGrades", { teacherSessionToken: t, classId: CLASS_ID, activityType: "prova" }).catch(() => []),
      ]);

      // Todos os membros retornados são da Farm I Medicina (members.list retorna apenas os 87)
      const farm1Members = (membersData as any[]);

      // Mapear notas de atividades por equipe
      const actMap: Record<string, Record<string, number>> = {};
      for (const row of (activityGrades as any[])) {
        const key = String(row.homeGroupId || row.groupName);
        if (!actMap[key]) actMap[key] = {};
        actMap[key][row.activityName] = parseFloat(row.grade) || 0;
      }

      // Mapear Jigsaw por memberId
      const jigsawMap: Record<number, number> = {};
      for (const score of (jigsawScores as any[])) {
        jigsawMap[score.memberId] = parseFloat(score.totalJigsawPF) || 0;
      }
      // Mapear notas de prova da API (lançadas pelo módulo de correção) por memberId
      const provaAPIMap: Record<number, { p1: number; p2: number }> = {};
      for (const row of (provaGradesAPI as any[])) {
        if (!row.memberId) continue;
        const mid = Number(row.memberId);
        if (!provaAPIMap[mid]) provaAPIMap[mid] = { p1: 0, p2: 0 };
        const actName = (row.activityName || "").toLowerCase();
        if (actName === "p1") provaAPIMap[mid].p1 = parseFloat(row.grade) || 0;
        if (actName === "p2") provaAPIMap[mid].p2 = parseFloat(row.grade) || 0;
      }

      // Mapear progresso do jogo por memberId
      const gameMap: Record<number, { questsCompleted: number; questsTotal: number; isCompleted: boolean; farmacologiaPoints: number }> = {};
      for (const prog of (gameProgress as any[])) {
        gameMap[prog.memberId] = prog;
      }

      // Construir linhas
      const rows: StudentRow[] = farm1Members.map(m => {
        const teamId = m.teamId;
        const team = TEAMS.find(t => t.id === teamId);
        const teamKey = String(teamId);
        const act = actMap[teamKey] || {};
        const jigsaw = jigsawMap[m.id] || 0;
        const game = gameMap[m.id];
        const savedProva = { p1: provaAPIMap[m.id]?.p1 || provaGradesRef.current[m.id]?.p1 || 0, p2: provaAPIMap[m.id]?.p2 || provaGradesRef.current[m.id]?.p2 || 0 };

        const raw: Omit<StudentRow, "totalActivityPF" | "eligible" | "p1Final" | "p2Final" | "mediaAtividades" | "mediaProvas" | "notaFinal"> = {
          memberId: m.id,
          name: (() => { const n = m.name || ""; const p = n.split("\t"); return p.length >= 2 ? p[1].trim() : n.trim(); })(),
          teamId: teamId || 0,
          teamName: team?.name || "Sem Equipe",
          kahoot1: act["Kahoot 1"] || 0,
          kahoot2: act["Kahoot 2"] || 0,
          kahoot3: act["Kahoot 3"] || 0,
          kahoot4: act["Kahoot 4"] || 0,
          caso1: act["Caso Clínico 1"] || 0,
          caso2: act["Caso Clínico 2"] || 0,
          caso3: act["Caso Clínico 3"] || 0,
          caso4: act["Caso Clínico 4"] || 0,
          jigsawPF: jigsaw,
          p1: savedProva.p1,
          p2: savedProva.p2,
          questsCompleted: game?.questsCompleted || 0,
          questsTotal: game?.questsTotal || 0,
          gameCompleted: game?.isCompleted || false,
          gamePF: game?.farmacologiaPoints || 0,
        };
        return calcStudent(raw);
      });

      setStudents(rows);
      // Inicializar provaGrades apenas para alunos que ainda não têm nota salva
      setProvaGrades(prev => {
        const pg: Record<number, { p1: number; p2: number }> = { ...prev };
        for (const r of rows) {
          if (!pg[r.memberId]) pg[r.memberId] = { p1: 0, p2: 0 };
        }
        provaGradesRef.current = pg;
        return pg;
      });
      toast.success(`${rows.length} alunos carregados`);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionToken]);

   // ─── Teacher Grades helpers ───────────────────────────────────────────────────────────
  const loadTeacherGrades = useCallback(async (token?: string) => {
    const t = token || sessionToken;
    if (!t) return;
    setTgLoading(true);
    try {
      const data = await trpcQuery("monitors.listTeacherGrades", { teacherSessionToken: t, classId: CLASS_ID });
      setTeacherGrades(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast.error("Erro ao carregar notas do professor: " + (err.message || "desconhecido"));
    } finally {
      setTgLoading(false);
    }
  }, [sessionToken]);

  const handleImportFromMonitor = useCallback(async () => {
    if (!sessionToken) return;
    const actName = prompt("Nome da atividade para importar (ex: Kahoot 1):");
    if (!actName) return;
    const actType = prompt("Tipo (kahoot / clinical_case / prova / seminario / participacao / outro):") || "kahoot";
    setTgImporting(true);
    try {
      const res = await trpcMutation("monitors.importMonitorGradesToTeacher", {
        teacherSessionToken: sessionToken,
        classId: CLASS_ID,
        activityType: actType as any,
        activityName: actName,
      });
      toast.success(res?.message || "Notas importadas!");
      loadTeacherGrades();
    } catch (err: any) {
      toast.error("Erro ao importar: " + (err.message || "desconhecido"));
    } finally {
      setTgImporting(false);
    }
  }, [sessionToken, loadTeacherGrades]);

  const handleSaveTeacherGrade = useCallback(async (id: number) => {
    if (!sessionToken) return;
    const row = teacherGrades.find(g => g.id === id);
    if (!row) return;
    const gradeVal = parseFloat(tgEditGrade.replace(",", "."));
    if (isNaN(gradeVal)) { toast.error("Nota inválida"); return; }
    try {
      await trpcMutation("monitors.upsertTeacherGrade", {
        teacherSessionToken: sessionToken,
        id,
        classId: CLASS_ID,
        activityType: row.activityType,
        activityName: row.activityName,
        memberName: row.memberName,
        groupName: row.groupName || undefined,
        grade: gradeVal,
        maxGrade: parseFloat(row.maxGrade) || 10,
        notes: tgEditNotes || undefined,
      });
      toast.success("Nota atualizada!");
      setTgEditId(null);
      loadTeacherGrades();
    } catch (err: any) {
      toast.error("Erro ao salvar: " + (err.message || "desconhecido"));
    }
  }, [sessionToken, teacherGrades, tgEditGrade, tgEditNotes, loadTeacherGrades]);

  const handleDeleteTeacherGrade = useCallback(async (id: number) => {
    if (!sessionToken) return;
    if (!confirm("Excluir esta nota?")) return;
    try {
      await trpcMutation("monitors.deleteTeacherGrade", { teacherSessionToken: sessionToken, gradeId: id });
      toast.success("Nota excluída!");
      loadTeacherGrades();
    } catch (err: any) {
      toast.error("Erro ao excluir: " + (err.message || "desconhecido"));
    }
  }, [sessionToken, loadTeacherGrades]);

  const handleAddTeacherGrade = useCallback(async () => {
    if (!sessionToken) return;
    const gradeVal = parseFloat(tgNewData.grade.replace(",", "."));
    const maxVal = parseFloat(tgNewData.maxGrade.replace(",", "."));
    if (!tgNewData.activityName || !tgNewData.memberName || isNaN(gradeVal)) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    try {
      await trpcMutation("monitors.upsertTeacherGrade", {
        teacherSessionToken: sessionToken,
        classId: CLASS_ID,
        activityType: tgNewData.activityType as any,
        activityName: tgNewData.activityName,
        memberName: tgNewData.memberName,
        groupName: tgNewData.groupName || undefined,
        grade: gradeVal,
        maxGrade: isNaN(maxVal) ? 10 : maxVal,
        notes: tgNewData.notes || undefined,
      });
      toast.success("Nota adicionada!");
      setTgNewForm(false);
      setTgNewData({ activityType: "kahoot", activityName: "", memberName: "", groupName: "", grade: "", maxGrade: "10", notes: "" });
      loadTeacherGrades();
    } catch (err: any) {
      toast.error("Erro ao adicionar: " + (err.message || "desconhecido"));
    }
  }, [sessionToken, tgNewData, loadTeacherGrades]);

  // ─── Certificates helpers ───────────────────────────────────────────────────────────
  const loadMonitorsAndCerts = useCallback(async (token?: string) => {
    const t = token || sessionToken;
    if (!t) return;
    setCertLoading(true);
    try {
      const [monData, certData] = await Promise.all([
        trpcQuery("monitors.list", { teacherSessionToken: t }).catch(() => []),
        trpcQuery("monitors.listCertificates", { teacherSessionToken: t }).catch(() => []),
      ]);
      setMonitors(Array.isArray(monData) ? monData : []);
      setCertificates(Array.isArray(certData) ? certData : []);
    } catch (err: any) {
      toast.error("Erro ao carregar monitores: " + (err.message || "desconhecido"));
    } finally {
      setCertLoading(false);
    }
  }, [sessionToken]);

  const handleIssueCertificate = useCallback(async () => {
    if (!sessionToken) return;
    const monId = parseInt(certForm.monitorAccountId);
    const wh = parseInt(certForm.workloadHours);
    if (!monId || !certForm.periodStart || !certForm.periodEnd || isNaN(wh)) {
      toast.error("Preencha todos os campos do certificado");
      return;
    }
    setCertIssuing(true);
    try {
      const res = await trpcMutation("monitors.issueCertificate", {
        teacherSessionToken: sessionToken,
        monitorAccountId: monId,
        periodStart: certForm.periodStart,
        periodEnd: certForm.periodEnd,
        workloadHours: wh,
        professorTitle: certForm.professorTitle,
        department: certForm.department,
      });
      toast.success(res?.message || "Certificado emitido! Código: " + res?.certificateCode);
      setCertForm({ monitorAccountId: "", periodStart: "", periodEnd: "", workloadHours: "60", professorTitle: "Prof. Dr.", department: "Departamento de Farmácia e Administração Farmacêutica" });
      loadMonitorsAndCerts();
    } catch (err: any) {
      toast.error("Erro ao emitir certificado: " + (err.message || "desconhecido"));
    } finally {
      setCertIssuing(false);
    }
  }, [sessionToken, certForm, loadMonitorsAndCerts]);

  const handleRevokeCertificate = useCallback(async (certId: number) => {
    if (!sessionToken) return;
    if (!confirm("Revogar este certificado? Esta ação não pode ser desfeita.")) return;
    try {
      await trpcMutation("monitors.revokeCertificate", { teacherSessionToken: sessionToken, certificateId: certId });
      toast.success("Certificado revogado");
      loadMonitorsAndCerts();
    } catch (err: any) {
      toast.error("Erro ao revogar: " + (err.message || "desconhecido"));
    }
  }, [sessionToken, loadMonitorsAndCerts]);

  const handleLogin = useCallback((token: string, name: string) => {
    setSessionToken(token);
    setUserName(name);
    localStorage.setItem(TEACHER_TOKEN_KEY, token);
    localStorage.setItem("prof_grades_user_name", name);
    toast.success(`Bem-vindo(a), ${name}!`);
    loadData(token);
  }, [loadData]);
  // Carregar dados ao montar o componente ou quando o token muda
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (sessionToken) loadData(sessionToken);
  }, [sessionToken]);
  // Carregar teacherGrades e certificados quando a aba mudar
  useEffect(() => {
    if (!sessionToken) return;
    if (activeTab === "teacher_grades") loadTeacherGrades();
    if (activeTab === "certificates") loadMonitorsAndCerts();
  }, [activeTab, sessionToken]);

  // Atualizar cálculos quando provaGrades muda
  const computedStudents = useMemo(() => {
    return students.map(s => {
      const pg = provaGrades[s.memberId] || { p1: 0, p2: 0 };
      return calcStudent({ ...s, p1: pg.p1, p2: pg.p2 });
    });
  }, [students, provaGrades]);

  const filteredStudents = useMemo(() => {
    let list = filterTeam === "all" ? computedStudents : computedStudents.filter(s => s.teamId === filterTeam);
    list = [...list].sort((a, b) => {
      let av: any = (a as any)[sortCol] ?? 0;
      let bv: any = (b as any)[sortCol] ?? 0;
      if (typeof av === "string") av = av.toLowerCase();
      if (typeof bv === "string") bv = bv.toLowerCase();
      return sortAsc ? (av < bv ? -1 : av > bv ? 1 : 0) : (av > bv ? -1 : av < bv ? 1 : 0);
    });
    return list;
  }, [computedStudents, sortCol, sortAsc, filterTeam]);

  const handleSort = (col: string) => {
    if (sortCol === col) setSortAsc(!sortAsc);
    else { setSortCol(col); setSortAsc(true); }
  };

  const SortIcon = ({ col }: { col: string }) => {
    if (sortCol !== col) return <ChevronDown className="w-3 h-3 opacity-20" />;
    return sortAsc ? <ChevronUp className="w-3 h-3 text-blue-400" /> : <ChevronDown className="w-3 h-3 text-blue-400" />;
  };

  const logout = () => {
    localStorage.removeItem(TEACHER_TOKEN_KEY);
    localStorage.removeItem("prof_grades_user_name");
    setSessionToken("");
    setUserName("");
    setStudents([]);
  };

  // Estatísticas
  const stats = useMemo(() => {
    if (!computedStudents.length) return null;
    const eligible = computedStudents.filter(s => s.eligible).length;
    const withP1 = computedStudents.filter(s => s.p1 > 0).length;
    const withP2 = computedStudents.filter(s => s.p2 > 0).length;
    const avgFinal = computedStudents.filter(s => s.notaFinal > 0).reduce((s, r) => s + r.notaFinal, 0) / (computedStudents.filter(s => s.notaFinal > 0).length || 1);
    return { eligible, withP1, withP2, avgFinal, total: computedStudents.length };
  }, [computedStudents]);

  if (!sessionToken) return <LoginForm onLogin={handleLogin} />;

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-white">
      {/* Header */}
      <header className="border-b border-[#1e3a5f] bg-[#0d1424] sticky top-0 z-10">
        <div className="max-w-[1600px] mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/monitor-grades">
              <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white shrink-0">
                <ArrowLeft className="w-4 h-4 mr-1" /> Monitores
              </Button>
            </Link>
            <div className="h-5 w-px bg-[#1e3a5f] shrink-0" />
            <BookOpen className="w-5 h-5 text-purple-400 shrink-0" />
            <div className="min-w-0">
              <h1 className="font-bold text-white text-sm truncate">Tabela do Professor — Farmacologia 1</h1>
              <p className="text-xs text-slate-400 truncate">Medicina · UNIRIO · {userName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="ghost" size="sm" onClick={() => loadData()} disabled={loading} className="text-slate-400 hover:text-white">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <Link href="/cronograma">
              <Button variant="ghost" size="sm" className="text-slate-400 hover:text-blue-400 hidden sm:flex">
                <Calendar className="w-4 h-4 mr-1.5" /> Cronograma
              </Button>
            </Link>
            <Link href="/professor/ferramentas-prova">
              <Button variant="ghost" size="sm" className="text-slate-400 hover:text-orange-400 hidden sm:flex">
                <FileText className="w-4 h-4 mr-1.5" /> Ferramentas de Prova
              </Button>
            </Link>
            <Button
              size="sm"
              onClick={() => exportCSV(filteredStudents)}
              className="bg-green-600 hover:bg-green-700 text-white hidden sm:flex"
            >
              <Download className="w-4 h-4 mr-1.5" /> Exportar CSV
            </Button>
            <Button
              size="sm"
              onClick={handleSendEmail}
              disabled={sendingEmail || students.length === 0}
              className="bg-blue-600 hover:bg-blue-700 text-white hidden sm:flex"
            >
              <Mail className="w-4 h-4 mr-1.5" /> {sendingEmail ? "Enviando..." : "Enviar por Email"}
            </Button>
            <Button variant="ghost" size="sm" onClick={logout} className="text-slate-400 hover:text-white text-xs">
              Sair
            </Button>
          </div>
        </div>
      </header>

      {/* Abas de navegação */}
      <div className="border-b border-[#1e3a5f] bg-[#0d1424]">
        <div className="max-w-[1600px] mx-auto px-4 flex gap-1">
          <button
            onClick={() => setActiveTab("grades")}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "grades"
                ? "border-purple-400 text-purple-300"
                : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            <BookOpen className="w-4 h-4 inline mr-1.5" /> Notas da Turma
          </button>
          <button
            onClick={() => setActiveTab("teacher_grades")}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "teacher_grades"
                ? "border-blue-400 text-blue-300"
                : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            <Edit3 className="w-4 h-4 inline mr-1.5" /> Notas Editáveis
          </button>
          <button
            onClick={() => setActiveTab("certificates")}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "certificates"
                ? "border-yellow-400 text-yellow-300"
                : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            <Award className="w-4 h-4 inline mr-1.5" /> Certificados
          </button>
        </div>
      </div>
      <div className="max-w-[1600px] mx-auto px-4 py-6 space-y-6">
        {/* ========= ABA: NOTAS DA TURMA ========= */}
        {activeTab !== "grades" && null}
        {activeTab === "grades" && <>
        {/* Stats cards */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="bg-[#111827] border-[#1e3a5f] p-4 text-center">
              <p className="text-xs text-slate-400">Total de Alunos</p>
              <p className="text-2xl font-bold text-white mt-1">{stats.total}</p>
            </Card>
            <Card className="bg-[#111827] border-green-500/20 p-4 text-center">
              <p className="text-xs text-slate-400">Elegíveis para Bônus</p>
              <p className="text-2xl font-bold text-green-400 mt-1">{stats.eligible}</p>
              <p className="text-xs text-slate-500">{((stats.eligible / stats.total) * 100).toFixed(0)}% da turma</p>
            </Card>
            <Card className="bg-[#111827] border-blue-500/20 p-4 text-center">
              <p className="text-xs text-slate-400">Com P1 lançada</p>
              <p className="text-2xl font-bold text-blue-400 mt-1">{stats.withP1}</p>
            </Card>
            <Card className="bg-[#111827] border-purple-500/20 p-4 text-center">
              <p className="text-xs text-slate-400">Média Final (turma)</p>
              <p className="text-2xl font-bold text-purple-400 mt-1">
                {stats.withP1 > 0 ? stats.avgFinal.toFixed(2) : "—"}
              </p>
            </Card>
          </div>
        )}

        {/* Fórmula */}
        <Card className="bg-[#111827] border-[#1e3a5f] overflow-hidden">
          <button
            onClick={() => setShowFormula(!showFormula)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#1a2744]/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-semibold text-white">Fórmula de Cálculo da Nota Final</span>
            </div>
            {showFormula ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>
          {showFormula && (
            <div className="px-4 pb-4 space-y-3 border-t border-[#1e3a5f]">
              <div className="grid sm:grid-cols-2 gap-4 mt-3">
                <div className="bg-[#1a2744] rounded-lg p-3 space-y-2">
                  <p className="text-xs font-semibold text-blue-300">Componente de Atividades (25%)</p>
                  <code className="text-xs text-slate-300 block">
                    Nota_Ativ = média(Kahoot_nota, Caso_nota, Jigsaw_nota) × 0,25
                  </code>
                  <p className="text-[10px] text-slate-500">Kahoot_nota = (PF_kahoots / 40) × 10 | Caso_nota = (PF_casos / 40) × 10 | Jigsaw_nota = PF_jigsaw (0–10)</p>
                </div>
                <div className="bg-[#1a2744] rounded-lg p-3 space-y-2">
                  <p className="text-xs font-semibold text-purple-300">Componente de Provas (75%)</p>
                  <code className="text-xs text-slate-300 block">
                    Nota_Provas = média(P1_final, P2_final) × 0,75
                  </code>
                  <p className="text-[10px] text-slate-500">P1_final = P1 + 0,2 (se elegível) | P2_final = P2 + 0,2 (se elegível)</p>
                </div>
              </div>
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                <p className="text-xs text-green-300">
                  <strong>Critério de elegibilidade para bônus (+0,2):</strong> O aluno deve ter ≥ 64 PFs de Kahoot + Casos Clínicos <em>e</em> ter completado o jogo (isCompleted = true).
                </p>
              </div>
              <div className="bg-[#1a2744] rounded-lg p-3">
                <p className="text-xs font-semibold text-white mb-1">Nota Final</p>
                <code className="text-xs text-yellow-300">Nota_Final = Nota_Ativ + Nota_Provas</code>
              </div>
            </div>
          )}
        </Card>

        {/* Gabaritos das Provas */}
        <Card className="bg-[#111827] border-[#1e3a5f] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#1e3a5f] flex items-center gap-2">
            <FileText className="w-4 h-4 text-orange-400" />
            <span className="text-sm font-semibold text-white">Provas P1 — Gabaritos e Downloads</span>
            <span className="ml-auto text-xs text-slate-500">1º Semestre 2026 · Farmacologia I</span>
          </div>
          <div className="p-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
            {([
              { versao: 'A', cor: '#1a3a5c', corTexto: '#60a5fa', url: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663038327412/OxQHVQtiUVRYRQWa.pdf' },
              { versao: 'B', cor: '#1a5c2e', corTexto: '#4ade80', url: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663038327412/YKHYuOjhgIKPIgiz.pdf' },
              { versao: 'C', cor: '#5c1a1a', corTexto: '#f87171', url: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663038327412/kGekZNgQLzZqQtsl.pdf' },
              { versao: 'D', cor: '#3d1a5c', corTexto: '#c084fc', url: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663038327412/NmmQsXcvYrxJnrBe.pdf' },
            ] as const).map(({ versao, cor, corTexto, url }) => (
              <a
                key={versao}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-lg border p-3 hover:opacity-90 transition-opacity cursor-pointer"
                style={{ backgroundColor: cor + '33', borderColor: cor + '88' }}
              >
                <div className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg shrink-0" style={{ backgroundColor: cor, color: corTexto }}>
                  {versao}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">Versão {versao}</p>
                  <p className="text-xs text-slate-400">25 questões · PDF</p>
                </div>
                <Download className="w-4 h-4 ml-auto shrink-0" style={{ color: corTexto }} />
              </a>
            ))}
          </div>
          <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <a
              href="https://files.manuscdn.com/user_upload_by_module/session_file/310519663038327412/dTzzaKFuvhAFTqdo.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 hover:bg-yellow-500/20 transition-colors cursor-pointer"
            >
              <div className="w-10 h-10 rounded-lg bg-yellow-600 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-yellow-300">Gabarito Consolidado A/B/C/D</p>
                <p className="text-xs text-slate-400">Tabela comparativa das 4 versões · PDF</p>
              </div>
              <Download className="w-4 h-4 ml-auto text-yellow-400 shrink-0" />
            </a>
            <a
              href="https://files.manuscdn.com/user_upload_by_module/session_file/310519663038327412/YuhRnCWeEMLOQYka.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-lg border border-green-500/30 bg-green-500/10 p-3 hover:bg-green-500/20 transition-colors cursor-pointer"
            >
              <div className="w-10 h-10 rounded-lg bg-green-700 flex items-center justify-center shrink-0">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-green-300">Gabarito Comentado</p>
                <p className="text-xs text-slate-400">Com justificativas farmacológicas · PDF</p>
              </div>
              <Download className="w-4 h-4 ml-auto text-green-400 shrink-0" />
            </a>
          </div>
        </Card>
        {/* Filtros */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400">Filtrar equipe:</label>
            <select
              value={filterTeam}
              onChange={e => setFilterTeam(e.target.value === "all" ? "all" : parseInt(e.target.value))}
              className="bg-[#1a2744] border border-[#1e3a5f] rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-400"
            >
              <option value="all">Todas as equipes</option>
              {TEAMS.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <Badge variant="outline" className="text-xs border-slate-500/40 text-slate-400">
            {filteredStudents.length} alunos
          </Badge>
          <Button size="sm" onClick={() => exportCSV(filteredStudents)} className="bg-green-600 hover:bg-green-700 text-white sm:hidden">
            <Download className="w-4 h-4 mr-1" /> CSV
          </Button>
        </div>

        {/* Tabela principal */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-400" />
            <span className="ml-3 text-slate-400">Carregando dados...</span>
          </div>
        ) : filteredStudents.length === 0 && students.length === 0 ? (
          <Card className="bg-[#111827] border-[#1e3a5f] p-12 text-center">
            <BookOpen className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-300 mb-2">Nenhum aluno carregado</h3>
            <p className="text-sm text-slate-500 mb-4">Clique no botão de atualizar para carregar os dados dos 87 alunos da Farmacologia 1.</p>
            <Button onClick={() => loadData()} disabled={loading} className="bg-blue-600 hover:bg-blue-700">
              <RefreshCw className="w-4 h-4 mr-2" /> Carregar Alunos
            </Button>
          </Card>
        ) : (
          <Card className="bg-[#111827] border-[#1e3a5f] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#1e3a5f] bg-[#0d1424]">
                    {/* Identificação */}
                    <th className="text-left px-3 py-3 text-slate-400 font-medium sticky left-0 bg-[#0d1424] min-w-[180px]">
                      <button onClick={() => handleSort("name")} className="flex items-center gap-1 hover:text-white transition-colors">
                        Nome <SortIcon col="name" />
                      </button>
                    </th>
                    <th className="text-left px-3 py-3 text-slate-400 font-medium min-w-[100px]">
                      <button onClick={() => handleSort("teamName")} className="flex items-center gap-1 hover:text-white transition-colors">
                        Equipe <SortIcon col="teamName" />
                      </button>
                    </th>
                    {/* Kahoots */}
                    <th colSpan={4} className="text-center px-3 py-2 text-blue-400 font-medium border-l border-[#1e3a5f]">
                      <div className="flex items-center justify-center gap-1">
                        <Gamepad2 className="w-3 h-3" /> Kahoots
                      </div>
                      <div className="text-[9px] text-slate-500 font-normal">máx 2,5 cada</div>
                    </th>
                    {/* Casos */}
                    <th colSpan={4} className="text-center px-3 py-2 text-purple-400 font-medium border-l border-[#1e3a5f]">
                      <div className="flex items-center justify-center gap-1">
                        <FlaskConical className="w-3 h-3" /> Casos Clínicos
                      </div>
                      <div className="text-[9px] text-slate-500 font-normal">máx 2,5 cada</div>
                    </th>
                    {/* Jigsaw */}
                    <th className="text-center px-3 py-2 text-yellow-400 font-medium border-l border-[#1e3a5f] min-w-[70px]">
                      Jigsaw
                      <div className="text-[9px] text-slate-500 font-normal">PF (0–10)</div>
                    </th>
                    {/* PF total */}
                    <th className="text-center px-3 py-2 text-slate-400 font-medium border-l border-[#1e3a5f] min-w-[70px]">
                      <button onClick={() => handleSort("totalActivityPF")} className="flex items-center gap-1 hover:text-white transition-colors mx-auto">
                        PF Ativ. <SortIcon col="totalActivityPF" />
                      </button>
                    </th>
                    {/* Jogo */}
                    <th className="text-center px-3 py-2 text-slate-400 font-medium border-l border-[#1e3a5f] min-w-[70px]">
                      Jogo
                    </th>
                    {/* Bônus */}
                    <th className="text-center px-3 py-2 text-green-400 font-medium border-l border-[#1e3a5f] min-w-[60px]">
                      Bônus
                    </th>
                    {/* Provas */}
                    <th className="text-center px-3 py-2 text-orange-400 font-medium border-l border-[#1e3a5f] min-w-[70px]">
                      P1
                    </th>
                    <th className="text-center px-3 py-2 text-orange-400 font-medium min-w-[70px]">
                      P2
                    </th>
                    <th className="text-center px-3 py-2 text-slate-400 font-medium min-w-[70px]">
                      P1 Final
                    </th>
                    <th className="text-center px-3 py-2 text-slate-400 font-medium min-w-[70px]">
                      P2 Final
                    </th>
                    {/* Médias */}
                    <th className="text-center px-3 py-2 text-blue-300 font-medium border-l border-[#1e3a5f] min-w-[80px]">
                      Ativ×0,25
                    </th>
                    <th className="text-center px-3 py-2 text-orange-300 font-medium min-w-[80px]">
                      Provas×0,75
                    </th>
                    {/* Nota Final */}
                    <th className="text-center px-3 py-2 text-white font-semibold border-l border-[#1e3a5f] min-w-[80px] bg-[#1a2744]">
                      <button onClick={() => handleSort("notaFinal")} className="flex items-center gap-1 hover:text-yellow-300 transition-colors mx-auto">
                        <Star className="w-3 h-3" /> Final <SortIcon col="notaFinal" />
                      </button>
                    </th>
                  </tr>
                  {/* Sub-headers para Kahoots e Casos */}
                  <tr className="border-b border-[#1e3a5f]/50 bg-[#0d1424]">
                    <th colSpan={2} className="sticky left-0 bg-[#0d1424]" />
                    {KAHOOTS.map((k, i) => (
                      <th key={k} className={`text-center px-2 py-1 text-[9px] text-blue-300/70 font-normal ${i === 0 ? "border-l border-[#1e3a5f]" : ""}`}>K{i + 1}</th>
                    ))}
                    {CASOS.map((c, i) => (
                      <th key={c} className={`text-center px-2 py-1 text-[9px] text-purple-300/70 font-normal ${i === 0 ? "border-l border-[#1e3a5f]" : ""}`}>CC{i + 1}</th>
                    ))}
                    <th colSpan={10} />
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((s, idx) => {
                    const rowBg = idx % 2 === 0 ? "bg-[#0d1424]" : "bg-[#111827]";
                    const finalColor = s.notaFinal >= 7 ? "#10b981" : s.notaFinal >= 5 ? "#f59e0b" : s.notaFinal > 0 ? "#ef4444" : "#475569";
                    return (
                      <tr key={s.memberId} className={`border-b border-[#1e3a5f]/30 hover:bg-[#1a2744]/50 transition-colors ${rowBg}`}>
                        <td className={`px-3 py-2 sticky left-0 ${rowBg} font-medium text-white truncate max-w-[180px]`}>{s.name}</td>
                        <td className="px-3 py-2 text-slate-400 truncate max-w-[100px]">{s.teamName}</td>
                        {/* Kahoots */}
                        {[s.kahoot1, s.kahoot2, s.kahoot3, s.kahoot4].map((v, i) => (
                          <td key={i} className={`px-2 py-2 text-center ${i === 0 ? "border-l border-[#1e3a5f]/30" : ""}`}>
                            <span className="font-mono" style={{ color: v > 0 ? (v >= 2.5 ? "#10b981" : v >= 2 ? "#3b82f6" : v >= 1.5 ? "#f59e0b" : "#ef4444") : "#475569" }}>
                              {v > 0 ? v.toFixed(1) : "—"}
                            </span>
                          </td>
                        ))}
                        {/* Casos */}
                        {[s.caso1, s.caso2, s.caso3, s.caso4].map((v, i) => (
                          <td key={i} className={`px-2 py-2 text-center ${i === 0 ? "border-l border-[#1e3a5f]/30" : ""}`}>
                            <span className="font-mono" style={{ color: v > 0 ? (v >= 2.5 ? "#10b981" : v >= 2 ? "#3b82f6" : v >= 1.5 ? "#f59e0b" : "#ef4444") : "#475569" }}>
                              {v > 0 ? v.toFixed(1) : "—"}
                            </span>
                          </td>
                        ))}
                        {/* Jigsaw */}
                        <td className="px-2 py-2 text-center border-l border-[#1e3a5f]/30">
                          <span className="font-mono text-yellow-300">{s.jigsawPF > 0 ? s.jigsawPF.toFixed(1) : "—"}</span>
                        </td>
                        {/* PF total */}
                        <td className="px-2 py-2 text-center border-l border-[#1e3a5f]/30">
                          <span className="font-bold" style={{ color: s.totalActivityPF >= 64 ? "#10b981" : s.totalActivityPF > 0 ? "#f59e0b" : "#475569" }}>
                            {s.totalActivityPF > 0 ? s.totalActivityPF.toFixed(0) : "—"}
                          </span>
                        </td>
                        {/* Jogo */}
                        <td className="px-2 py-2 text-center border-l border-[#1e3a5f]/30">
                          {s.gameCompleted ? (
                            <CheckCircle2 className="w-4 h-4 text-green-400 mx-auto" />
                          ) : s.questsCompleted > 0 ? (
                            <span className="text-yellow-400">{s.questsCompleted}/{s.questsTotal}</span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                        {/* Bônus */}
                        <td className="px-2 py-2 text-center border-l border-[#1e3a5f]/30">
                          {s.eligible ? (
                            <Badge className="bg-green-500/20 text-green-300 border-green-500/30 text-[9px]">+0,2</Badge>
                          ) : (
                            <span className="text-slate-600 text-[10px]">—</span>
                          )}
                        </td>
                        {/* P1 */}
                        <td className="px-2 py-2 text-center border-l border-[#1e3a5f]/30">
                          <ProvaInput
                            value={provaGrades[s.memberId]?.p1 ?? 0}
                            onChange={v => setProvaGrades(prev => { const next = { ...prev, [s.memberId]: { ...prev[s.memberId], p1: v } }; provaGradesRef.current = next; return next; })}
                          />
                        </td>
                        {/* P2 */}
                        <td className="px-2 py-2 text-center">
                          <ProvaInput
                            value={provaGrades[s.memberId]?.p2 ?? 0}
                            onChange={v => setProvaGrades(prev => { const next = { ...prev, [s.memberId]: { ...prev[s.memberId], p2: v } }; provaGradesRef.current = next; return next; })}
                          />
                        </td>
                        {/* P1 Final */}
                        <td className="px-2 py-2 text-center">
                          <span className="font-mono text-xs" style={{ color: s.p1Final > 0 ? (s.p1Final >= 7 ? "#10b981" : s.p1Final >= 5 ? "#f59e0b" : "#ef4444") : "#475569" }}>
                            {s.p1Final > 0 ? s.p1Final.toFixed(1) : "—"}
                          </span>
                          {s.eligible && s.p1 > 0 && <span className="text-[9px] text-green-400 block">+0,2</span>}
                        </td>
                        {/* P2 Final */}
                        <td className="px-2 py-2 text-center">
                          <span className="font-mono text-xs" style={{ color: s.p2Final > 0 ? (s.p2Final >= 7 ? "#10b981" : s.p2Final >= 5 ? "#f59e0b" : "#ef4444") : "#475569" }}>
                            {s.p2Final > 0 ? s.p2Final.toFixed(1) : "—"}
                          </span>
                          {s.eligible && s.p2 > 0 && <span className="text-[9px] text-green-400 block">+0,2</span>}
                        </td>
                        {/* Ativ × 0,25 */}
                        <td className="px-2 py-2 text-center border-l border-[#1e3a5f]/30">
                          <span className="font-mono text-blue-300 text-xs">
                            {s.totalActivityPF > 0 || s.jigsawPF > 0 ? (s.mediaAtividades * 0.25).toFixed(2) : "—"}
                          </span>
                        </td>
                        {/* Provas × 0,75 */}
                        <td className="px-2 py-2 text-center">
                          <span className="font-mono text-orange-300 text-xs">
                            {s.p1 > 0 || s.p2 > 0 ? (s.mediaProvas * 0.75).toFixed(2) : "—"}
                          </span>
                        </td>
                        {/* Nota Final */}
                        <td className="px-2 py-2 text-center border-l border-[#1e3a5f]/30 bg-[#1a2744]/50">
                          <span className="text-sm font-bold" style={{ color: finalColor }}>
                            {s.notaFinal > 0 ? s.notaFinal.toFixed(2) : "—"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Aviso sobre email */}
        <Card className="bg-[#111827] border-yellow-500/20 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-yellow-300">Aviso sobre o Bônus</h3>
              <p className="text-xs text-slate-400 mt-1">
                Os alunos serão notificados sobre o critério de bônus por email. Para enviar o aviso, acesse a página de configurações do sistema. O bônus é calculado automaticamente com base no progresso do jogo e nas notas de Kahoot e Casos Clínicos lançadas pelos monitores.
              </p>
            </div>
          </div>
        </Card>
        </> /* fim aba grades */}

        {/* ========= ABA: NOTAS EDITÁVEIS DO PROFESSOR ========= */}
        {activeTab === "teacher_grades" && (
          <div className="space-y-4">
            {/* Header da aba */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-blue-400" /> Notas Editáveis do Professor
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">Notas lançadas ou importadas pelo professor — editadas livremente</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button
                  size="sm"
                  onClick={handleImportFromMonitor}
                  disabled={tgImporting}
                  variant="outline"
                  className="border-blue-500/40 text-blue-300 hover:bg-blue-500/10"
                >
                  {tgImporting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Download className="w-4 h-4 mr-1" />}
                  Importar do Monitor
                </Button>
                <Button
                  size="sm"
                  onClick={() => setTgNewForm(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Plus className="w-4 h-4 mr-1" /> Nova Nota
                </Button>
                <Button
                  size="sm"
                  onClick={() => loadTeacherGrades()}
                  disabled={tgLoading}
                  variant="ghost"
                  className="text-slate-400 hover:text-white"
                >
                  <RefreshCw className={`w-4 h-4 ${tgLoading ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </div>

            {/* Formulário nova nota */}
            {tgNewForm && (
              <Card className="bg-[#111827] border-blue-500/30 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-blue-300">Nova Nota</h3>
                  <button onClick={() => setTgNewForm(false)} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
                </div>
                <div className="grid sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Tipo</label>
                    <select value={tgNewData.activityType} onChange={e => setTgNewData(d => ({ ...d, activityType: e.target.value }))}
                      className="w-full bg-[#1a2744] border border-[#1e3a5f] rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-400">
                      <option value="kahoot">Kahoot</option>
                      <option value="clinical_case">Caso Clínico</option>
                      <option value="prova">Prova</option>
                      <option value="seminario">Seminário</option>
                      <option value="participacao">Participação</option>
                      <option value="outro">Outro</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Nome da Atividade *</label>
                    <input value={tgNewData.activityName} onChange={e => setTgNewData(d => ({ ...d, activityName: e.target.value }))}
                      placeholder="ex: Kahoot 1" className="w-full bg-[#1a2744] border border-[#1e3a5f] rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-400" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Nome do Aluno/Grupo *</label>
                    <input value={tgNewData.memberName} onChange={e => setTgNewData(d => ({ ...d, memberName: e.target.value }))}
                      placeholder="ex: João Silva" className="w-full bg-[#1a2744] border border-[#1e3a5f] rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-400" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Grupo (opcional)</label>
                    <input value={tgNewData.groupName} onChange={e => setTgNewData(d => ({ ...d, groupName: e.target.value }))}
                      placeholder="ex: Paracetamol" className="w-full bg-[#1a2744] border border-[#1e3a5f] rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-400" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Nota *</label>
                    <input value={tgNewData.grade} onChange={e => setTgNewData(d => ({ ...d, grade: e.target.value }))}
                      inputMode="decimal" placeholder="0,0" className="w-full bg-[#1a2744] border border-[#1e3a5f] rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-400" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Nota Máxima</label>
                    <input value={tgNewData.maxGrade} onChange={e => setTgNewData(d => ({ ...d, maxGrade: e.target.value }))}
                      inputMode="decimal" placeholder="10" className="w-full bg-[#1a2744] border border-[#1e3a5f] rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-400" />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="text-xs text-slate-400 mb-1 block">Observações</label>
                    <input value={tgNewData.notes} onChange={e => setTgNewData(d => ({ ...d, notes: e.target.value }))}
                      placeholder="Opcional" className="w-full bg-[#1a2744] border border-[#1e3a5f] rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-400" />
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <Button size="sm" onClick={handleAddTeacherGrade} className="bg-blue-600 hover:bg-blue-700 text-white">
                    <Save className="w-4 h-4 mr-1" /> Salvar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setTgNewForm(false)} className="text-slate-400">
                    Cancelar
                  </Button>
                </div>
              </Card>
            )}

            {/* Tabela de notas */}
            {tgLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
              </div>
            ) : teacherGrades.length === 0 ? (
              <Card className="bg-[#111827] border-[#1e3a5f] p-8 text-center">
                <Edit3 className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400 text-sm">Nenhuma nota lançada ainda.</p>
                <p className="text-slate-500 text-xs mt-1">Use o botão "Importar do Monitor" ou "Nova Nota" para adicionar.</p>
              </Card>
            ) : (
              <Card className="bg-[#111827] border-[#1e3a5f] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-[#1e3a5f] bg-[#0d1424]">
                        <th className="px-3 py-2 text-left text-slate-400">Atividade</th>
                        <th className="px-3 py-2 text-left text-slate-400">Tipo</th>
                        <th className="px-3 py-2 text-left text-slate-400">Aluno/Grupo</th>
                        <th className="px-3 py-2 text-center text-slate-400">Nota</th>
                        <th className="px-3 py-2 text-center text-slate-400">Máx</th>
                        <th className="px-3 py-2 text-left text-slate-400">Obs</th>
                        <th className="px-3 py-2 text-center text-slate-400">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teacherGrades.map(g => (
                        <tr key={g.id} className="border-b border-[#1e3a5f]/40 hover:bg-[#1a2744]/30">
                          <td className="px-3 py-2 text-white font-medium">{g.activityName}</td>
                          <td className="px-3 py-2">
                            <Badge variant="outline" className="text-[10px] border-blue-500/30 text-blue-300">{g.activityType}</Badge>
                          </td>
                          <td className="px-3 py-2 text-slate-300">
                            {g.memberName}
                            {g.groupName && <span className="text-slate-500 ml-1">({g.groupName})</span>}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {tgEditId === g.id ? (
                              <input
                                value={tgEditGrade}
                                onChange={e => setTgEditGrade(e.target.value)}
                                inputMode="decimal"
                                className="w-16 text-center bg-[#1a2744] border border-blue-400 rounded px-1 py-0.5 text-white focus:outline-none"
                                autoFocus
                              />
                            ) : (
                              <span className={`font-mono font-bold ${
                                parseFloat(g.grade) >= 7 ? "text-green-400" :
                                parseFloat(g.grade) >= 5 ? "text-yellow-400" : "text-red-400"
                              }`}>{parseFloat(g.grade).toFixed(1)}</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center text-slate-400">{parseFloat(g.maxGrade).toFixed(0)}</td>
                          <td className="px-3 py-2">
                            {tgEditId === g.id ? (
                              <input
                                value={tgEditNotes}
                                onChange={e => setTgEditNotes(e.target.value)}
                                placeholder="Obs..."
                                className="w-32 bg-[#1a2744] border border-blue-400 rounded px-1 py-0.5 text-xs text-white focus:outline-none"
                              />
                            ) : (
                              <span className="text-slate-500">{g.notes || "—"}</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center justify-center gap-1">
                              {tgEditId === g.id ? (
                                <>
                                  <button onClick={() => handleSaveTeacherGrade(g.id)} className="p-1 rounded hover:bg-green-500/20 text-green-400">
                                    <Save className="w-3.5 h-3.5" />
                                  </button>
                                  <button onClick={() => setTgEditId(null)} className="p-1 rounded hover:bg-slate-500/20 text-slate-400">
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button onClick={() => { setTgEditId(g.id); setTgEditGrade(String(parseFloat(g.grade))); setTgEditNotes(g.notes || ""); }}
                                    className="p-1 rounded hover:bg-blue-500/20 text-blue-400">
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button onClick={() => handleDeleteTeacherGrade(g.id)} className="p-1 rounded hover:bg-red-500/20 text-red-400">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-3 py-2 border-t border-[#1e3a5f]/40 text-xs text-slate-500">
                  {teacherGrades.length} registros
                </div>
              </Card>
            )}
          </div>
        )}

        {/* ========= ABA: CERTIFICADOS ========= */}
        {activeTab === "certificates" && (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Award className="w-5 h-5 text-yellow-400" /> Certificados de Monitoria
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">Emita certificados para os monitores da disciplina</p>
              </div>
              <Button size="sm" onClick={() => loadMonitorsAndCerts()} disabled={certLoading} variant="ghost" className="text-slate-400 hover:text-white">
                <RefreshCw className={`w-4 h-4 ${certLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>

            {/* Formulário de emissão */}
            <Card className="bg-[#111827] border-yellow-500/20 p-4">
              <h3 className="text-sm font-semibold text-yellow-300 mb-3 flex items-center gap-2">
                <Plus className="w-4 h-4" /> Emitir Novo Certificado
              </h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Monitor *</label>
                  <select
                    value={certForm.monitorAccountId}
                    onChange={e => setCertForm(f => ({ ...f, monitorAccountId: e.target.value }))}
                    className="w-full bg-[#1a2744] border border-[#1e3a5f] rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-yellow-400"
                  >
                    <option value="">Selecione o monitor...</option>
                    {monitors.map(m => (
                      <option key={m.id} value={m.id}>{m.displayName || m.email}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Período Início *</label>
                  <input
                    type="date"
                    value={certForm.periodStart}
                    onChange={e => setCertForm(f => ({ ...f, periodStart: e.target.value }))}
                    className="w-full bg-[#1a2744] border border-[#1e3a5f] rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-yellow-400"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Período Fim *</label>
                  <input
                    type="date"
                    value={certForm.periodEnd}
                    onChange={e => setCertForm(f => ({ ...f, periodEnd: e.target.value }))}
                    className="w-full bg-[#1a2744] border border-[#1e3a5f] rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-yellow-400"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Carga Horária (h) *</label>
                  <input
                    type="number"
                    value={certForm.workloadHours}
                    onChange={e => setCertForm(f => ({ ...f, workloadHours: e.target.value }))}
                    min={1}
                    className="w-full bg-[#1a2744] border border-[#1e3a5f] rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-yellow-400"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Título do Professor</label>
                  <input
                    value={certForm.professorTitle}
                    onChange={e => setCertForm(f => ({ ...f, professorTitle: e.target.value }))}
                    placeholder="Prof. Dr."
                    className="w-full bg-[#1a2744] border border-[#1e3a5f] rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-yellow-400"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Departamento</label>
                  <input
                    value={certForm.department}
                    onChange={e => setCertForm(f => ({ ...f, department: e.target.value }))}
                    className="w-full bg-[#1a2744] border border-[#1e3a5f] rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-yellow-400"
                  />
                </div>
              </div>
              <Button
                onClick={handleIssueCertificate}
                disabled={certIssuing}
                className="mt-4 bg-yellow-600 hover:bg-yellow-700 text-white"
              >
                {certIssuing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Award className="w-4 h-4 mr-2" />}
                Emitir Certificado
              </Button>
            </Card>

            {/* Lista de certificados emitidos */}
            {certLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-yellow-400 animate-spin" />
              </div>
            ) : certificates.length === 0 ? (
              <Card className="bg-[#111827] border-[#1e3a5f] p-8 text-center">
                <Award className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400 text-sm">Nenhum certificado emitido ainda.</p>
              </Card>
            ) : (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-300">{certificates.length} certificado{certificates.length !== 1 ? "s" : ""} emitido{certificates.length !== 1 ? "s" : ""}</h3>
                {certificates.map(cert => (
                  <Card key={cert.id} className="bg-[#111827] border-[#1e3a5f] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-full bg-yellow-600/20 border border-yellow-500/30 flex items-center justify-center shrink-0">
                          <Award className="w-4 h-4 text-yellow-400" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white">{cert.monitorName}</p>
                          <p className="text-xs text-slate-400">{cert.monitorEmail}</p>
                          <p className="text-xs text-slate-500 mt-1">
                            {cert.periodStart} a {cert.periodEnd} · {cert.workloadHours}h · Cód: <span className="font-mono text-yellow-300/70">{cert.certificateCode}</span>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className={cert.status === "active" ? "border-green-500/40 text-green-400 text-xs" : "border-red-500/40 text-red-400 text-xs"}>
                          {cert.status === "active" ? "Ativo" : "Revogado"}
                        </Badge>
                        {cert.status === "active" && (
                          <Button size="sm" variant="ghost" onClick={() => handleRevokeCertificate(cert.id)} className="text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs">
                            <Trash2 className="w-3.5 h-3.5 mr-1" /> Revogar
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
