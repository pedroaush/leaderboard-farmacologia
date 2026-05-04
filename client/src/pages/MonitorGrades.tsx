/**
 * Monitor Grades - Planilha de lançamento de notas para monitores
 * Permite lançar notas de Kahoot (grupos da fase 2 do Jigsaw) e Casos Clínicos por turma
 */
import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  ArrowLeft, BookOpen, Gamepad2, Users, Plus, Save, Trash2,
  ChevronDown, ChevronUp, Edit2, Check, X, Loader2, Filter,
  ClipboardList, GraduationCap, RefreshCw, Download
} from "lucide-react";
import { Link } from "wouter";

const MONITOR_SESSION_KEY = "monitor_session_token";

type ActivityType = "kahoot" | "clinical_case";

interface GradeRow {
  id?: number;
  homeGroupId?: number;
  groupName: string;
  activityName: string;
  grade: number;
  maxGrade: number;
  notes?: string;
  launchedByName?: string;
  isEditing?: boolean;
  isNew?: boolean;
}

/** Converte string com ponto ou vírgula para número */
function parseGrade(raw: string): number {
  const normalized = raw.replace(",", ".").trim();
  const n = parseFloat(normalized);
  return isNaN(n) ? 0 : n;
}

function GradeCell({
  value,
  maxGrade,
  isEditing,
  onChange,
}: {
  value: number;
  maxGrade: number;
  isEditing: boolean;
  onChange: (v: number) => void;
}) {
  const [rawInput, setRawInput] = useState(String(value));

  // Sync rawInput when value changes from outside (e.g. on row open)
  useEffect(() => {
    if (!isEditing) setRawInput(String(value));
  }, [value, isEditing]);

  const pct = maxGrade > 0 ? (value / maxGrade) * 100 : 0;
  const color = pct >= 70 ? "#10b981" : pct >= 50 ? "#f59e0b" : "#ef4444";

  if (isEditing) {
    return (
      <input
        type="text"
        inputMode="decimal"
        value={rawInput}
        onChange={(e) => {
          const raw = e.target.value;
          // Allow typing: digits, comma, period, minus
          if (/^[0-9]*[.,]?[0-9]*$/.test(raw) || raw === "") {
            setRawInput(raw);
            onChange(parseGrade(raw));
          }
        }}
        onBlur={() => {
          // Normalize on blur: replace comma with period
          const n = parseGrade(rawInput);
          setRawInput(String(n));
          onChange(n);
        }}
        placeholder="0,0"
        className="w-20 px-2 py-1 rounded border border-primary/50 bg-background text-foreground text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/50"
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="font-semibold text-sm" style={{ color }}>
        {value.toFixed(1)}
      </span>
      <span className="text-xs text-muted-foreground">/ {maxGrade}</span>
      <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export default function MonitorGrades() {
  const [sessionToken, setSessionToken] = useState<string>(() => localStorage.getItem(MONITOR_SESSION_KEY) || "");

  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<ActivityType>("kahoot");
  const [activityFilter, setActivityFilter] = useState<string>("all");
  const [editingRows, setEditingRows] = useState<Record<string, GradeRow>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [newActivity, setNewActivity] = useState<{
    activityName: string;
    homeGroupId: number | undefined;
    groupName: string;
    grade: number;
    gradeRaw?: string;
    maxGrade: number;
    maxGradeRaw?: string;
    notes: string;
  }>({
    activityName: "",
    homeGroupId: undefined,
    groupName: "",
    grade: 0,
    gradeRaw: "0",
    maxGrade: 10,
    maxGradeRaw: "10",
    notes: "",
  });
  const [isSaving, setIsSaving] = useState(false);

  // Validate session token on mount
  const { data: monitorMe, isError: isSessionError } = trpc.monitors.me.useQuery(
    { sessionToken: sessionToken },
    { enabled: !!sessionToken, retry: false }
  );

  // If session is invalid, clear token and redirect to login
  useEffect(() => {
    if (sessionToken && isSessionError) {
      localStorage.removeItem(MONITOR_SESSION_KEY);
      setSessionToken("");
      toast.error("Sessão expirada. Por favor, faça login novamente.");
    }
    if (sessionToken && monitorMe === null) {
      localStorage.removeItem(MONITOR_SESSION_KEY);
      setSessionToken("");
      toast.error("Sessão inválida. Por favor, faça login novamente.");
    }
  }, [monitorMe, isSessionError, sessionToken]);

  // Queries
  const { data: classesList, isLoading: loadingClasses, isError: isClassesError } = trpc.monitors.listClasses.useQuery(
    { monitorSessionToken: sessionToken },
    { enabled: !!sessionToken && monitorMe !== undefined && monitorMe !== null, retry: false }
  );

  // Handle classes error (session might have expired)
  useEffect(() => {
    if (isClassesError && sessionToken) {
      localStorage.removeItem(MONITOR_SESSION_KEY);
      setSessionToken("");
      toast.error("Sessão expirada. Por favor, faça login novamente.");
    }
  }, [isClassesError, sessionToken]);

  const { data: homeGroups, isLoading: loadingGroups } = trpc.monitors.listHomeGroups.useQuery(
    { monitorSessionToken: sessionToken, classId: selectedClassId! },
    { enabled: !!sessionToken && !!selectedClassId }
  );

  const { data: grades, isLoading: loadingGrades, refetch: refetchGrades } = trpc.monitors.listActivityGrades.useQuery(
    { monitorSessionToken: sessionToken, classId: selectedClassId!, activityType: activeTab },
    { enabled: !!sessionToken && !!selectedClassId }
  );

  const { data: activityNames } = trpc.monitors.listActivityNames.useQuery(
    { monitorSessionToken: sessionToken, classId: selectedClassId!, activityType: activeTab },
    { enabled: !!sessionToken && !!selectedClassId }
  );

  // Mutations
  const upsertMutation = trpc.monitors.upsertActivityGrade.useMutation({
    onSuccess: () => {
      refetchGrades();
      toast.success("Nota salva com sucesso!");
      setIsSaving(false);
    },
    onError: (err) => {
      toast.error("Erro ao salvar nota: " + err.message);
      setIsSaving(false);
    },
  });

  const deleteMutation = trpc.monitors.deleteActivityGrade.useMutation({
    onSuccess: () => {
      refetchGrades();
      toast.success("Nota removida!");
    },
    onError: (err) => toast.error("Erro ao remover: " + err.message),
  });

  // Auto-select class from URL param or first class
  useEffect(() => {
    if (classesList?.length && !selectedClassId) {
      const params = new URLSearchParams(window.location.search);
      const urlClassId = params.get("classId");
      if (urlClassId) {
        const found = classesList.find((c) => c.id === parseInt(urlClassId));
        if (found) {
          setSelectedClassId(found.id);
          return;
        }
      }
      setSelectedClassId(classesList[0].id);
    }
  }, [classesList]);

  // Unique activity names from current grades
  const uniqueActivities = useMemo(() => {
    if (!grades) return [];
    const names = Array.from(new Set(grades.map((g) => g.activityName))).sort();
    return names;
  }, [grades]);

  // Filtered grades
  const filteredGrades = useMemo(() => {
    if (!grades) return [];
    if (activityFilter === "all") return grades;
    return grades.filter((g) => g.activityName === activityFilter);
  }, [grades, activityFilter]);

  // Group grades by activityName for display
  const gradesByActivity = useMemo(() => {
    const map: Record<string, typeof filteredGrades> = {};
    filteredGrades.forEach((g) => {
      if (!map[g.activityName]) map[g.activityName] = [];
      map[g.activityName].push(g);
    });
    return map;
  }, [filteredGrades]);

  const handleSaveEdit = async (grade: typeof grades extends (infer T)[] | undefined ? T : never) => {
    const editing = editingRows[String(grade.id)];
    if (!editing) return;
    setIsSaving(true);
    upsertMutation.mutate({
      monitorSessionToken: sessionToken,
      classId: selectedClassId!,
      activityType: activeTab,
      activityName: grade.activityName,
      homeGroupId: grade.homeGroupId ?? undefined,
      groupName: grade.groupName,
      grade: editing.grade,
      maxGrade: editing.maxGrade,
      notes: editing.notes,
      existingId: grade.id,
    });
    setEditingRows((prev) => {
      const next = { ...prev };
      delete next[String(grade.id)];
      return next;
    });
  };

  const handleAddGrade = async () => {
    if (!newActivity.activityName.trim()) {
      toast.error("Informe o nome da atividade");
      return;
    }
    if (!newActivity.groupName.trim() && !newActivity.homeGroupId) {
      toast.error("Selecione ou informe o nome do grupo");
      return;
    }
    setIsSaving(true);
    upsertMutation.mutate({
      monitorSessionToken: sessionToken,
      classId: selectedClassId!,
      activityType: activeTab,
      activityName: newActivity.activityName,
      homeGroupId: newActivity.homeGroupId,
      groupName: newActivity.groupName,
      grade: newActivity.grade,
      maxGrade: newActivity.maxGrade,
      notes: newActivity.notes || undefined,
    });
    setNewActivity({ activityName: "", homeGroupId: undefined, groupName: "", grade: 0, gradeRaw: "0", maxGrade: 10, maxGradeRaw: "10", notes: "" });
    setShowAddForm(false);
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (!grades || !grades.length) return;
    const header = ["Atividade", "Grupo", "Nota", "Nota Máxima", "Observações", "Lançado por"];
    const rows = grades.map((g) => [
      g.activityName,
      g.groupName,
      String(g.grade),
      String(g.maxGrade),
      g.notes || "",
      g.launchedByName || "",
    ]);
    const csv = [header, ...rows].map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const className = classesList?.find((c) => c.id === selectedClassId)?.name || "turma";
    a.download = `notas_${activeTab}_${className.replace(/\s+/g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!sessionToken) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto">
            <GraduationCap size={24} className="text-amber-400" />
          </div>
          <p className="text-foreground font-medium">Sessão expirada ou inválida</p>
          <p className="text-muted-foreground text-sm">Você precisa fazer login novamente para acessar a planilha de notas.</p>
          <Link
            href="/monitor"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Ir para o login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div
        className="border-b border-border px-4 py-3 flex items-center justify-between sticky top-0 z-10"
        style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}
      >
        <div className="flex items-center gap-3">
          <Link href="/monitor" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-sm font-bold text-foreground">Planilha de Notas</h1>
            <p className="text-xs text-muted-foreground">Kahoot & Casos Clínicos</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetchGrades()}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            title="Atualizar"
          >
            <RefreshCw size={15} />
          </button>
          <button
            onClick={handleExportCSV}
            disabled={!grades?.length}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-40"
          >
            <Download size={13} />
            Exportar CSV
          </button>
        </div>
      </div>

      <div className="container max-w-5xl py-6 px-4">
        {/* Seletor de Turma */}
        <div className="mb-6">
          <label className="block text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
            Turma
          </label>
          {(loadingClasses || (!!sessionToken && monitorMe === undefined)) ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 size={14} className="animate-spin" /> Carregando turmas...
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {classesList?.map((cls) => (
                <button
                  key={cls.id}
                  onClick={() => { setSelectedClassId(cls.id); setActivityFilter("all"); }}
                  className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${
                    selectedClassId === cls.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                  }`}
                >
                  <span
                    className="inline-block w-2 h-2 rounded-full mr-1.5"
                    style={{ backgroundColor: cls.color || "#6366f1" }}
                  />
                  {cls.name}
                </button>
              ))}
              {!classesList?.length && (
                <p className="text-sm text-muted-foreground">Nenhuma turma encontrada.</p>
              )}
            </div>
          )}
        </div>

        {selectedClassId && (
          <>
            {/* Tabs de Tipo de Atividade */}
            <div className="flex gap-1 mb-6 p-1 rounded-xl border border-border" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
              <button
                onClick={() => { setActiveTab("kahoot"); setActivityFilter("all"); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === "kahoot"
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Gamepad2 size={15} />
                Kahoot
              </button>
              <button
                onClick={() => { setActiveTab("clinical_case"); setActivityFilter("all"); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === "clinical_case"
                    ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <BookOpen size={15} />
                Casos Clínicos
              </button>
            </div>

            {/* Info sobre grupos Kahoot */}
            {activeTab === "kahoot" && (
              <div
                className="mb-4 rounded-xl border border-amber-500/20 p-3 flex items-start gap-2"
                style={{ backgroundColor: "oklch(0.696 0.17 85 / 0.06)" }}
              >
                <Users size={15} className="text-amber-400 mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground">
                  Os grupos de Kahoot são os <strong className="text-foreground">grupos mosaico da fase 2 do Jigsaw</strong> desta turma.
                  {homeGroups?.length
                    ? ` Foram encontrados ${homeGroups.length} grupos mosaico.`
                    : " Nenhum grupo mosaico encontrado — os grupos serão criados manualmente."}
                </p>
              </div>
            )}

            {/* Filtro por atividade */}
            {uniqueActivities.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                <button
                  onClick={() => setActivityFilter("all")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                    activityFilter === "all"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/30"
                  }`}
                >
                  Todas
                </button>
                {uniqueActivities.map((name) => (
                  <button
                    key={name}
                    onClick={() => setActivityFilter(name)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                      activityFilter === name
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/30"
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}

            {/* Botão Adicionar Nota */}
            <div className="mb-4">
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 border border-primary/30 text-primary text-sm font-medium hover:bg-primary/20 transition-colors"
              >
                <Plus size={15} />
                Lançar Nova Nota
                {showAddForm ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>

            {/* Formulário de Nova Nota */}
            <AnimatePresence>
              {showAddForm && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-6 overflow-hidden"
                >
                  <div
                    className="rounded-xl border border-primary/20 p-4"
                    style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}
                  >
                    <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                      <ClipboardList size={15} className="text-primary" />
                      Nova Nota — {activeTab === "kahoot" ? "Kahoot" : "Caso Clínico"}
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Nome da atividade */}
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                          Nome da Atividade *
                        </label>
                        <input
                          list="activity-names-list"
                          value={newActivity.activityName}
                          onChange={(e) => setNewActivity((p) => ({ ...p, activityName: e.target.value }))}
                          placeholder={activeTab === "kahoot" ? "ex: Kahoot - Semana 3" : "ex: Caso Clínico 1 - Analgésicos"}
                          className="w-full px-3 py-2 rounded-lg border border-border bg-background/50 text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                        <datalist id="activity-names-list">
                          {activityNames?.map((n) => <option key={n} value={n} />)}
                        </datalist>
                      </div>

                      {/* Grupo */}
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                          Grupo *
                        </label>
                        {activeTab === "kahoot" && homeGroups && homeGroups.length > 0 ? (
                          <select
                            value={newActivity.homeGroupId ?? ""}
                            onChange={(e) => {
                              const id = parseInt(e.target.value);
                              const group = homeGroups.find((g) => g.id === id);
                              setNewActivity((p) => ({
                                ...p,
                                homeGroupId: id || undefined,
                                groupName: group?.name || "",
                              }));
                            }}
                            className="w-full px-3 py-2 rounded-lg border border-border bg-background/50 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                          >
                            <option value="">Selecione o grupo mosaico...</option>
                            {homeGroups.map((g) => (
                              <option key={g.id} value={g.id}>
                                {g.name} ({g.membersList?.length || 0} membros)
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            value={newActivity.groupName}
                            onChange={(e) => setNewActivity((p) => ({ ...p, groupName: e.target.value }))}
                            placeholder="Nome do grupo"
                            className="w-full px-3 py-2 rounded-lg border border-border bg-background/50 text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                          />
                        )}
                      </div>

                      {/* Nota */}
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                          Nota
                        </label>
                        <div className="flex gap-2 items-center">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={newActivity.gradeRaw ?? String(newActivity.grade)}
                            onChange={(e) => {
                              const raw = e.target.value;
                              if (/^[0-9]*[.,]?[0-9]*$/.test(raw) || raw === "") {
                                setNewActivity((p) => ({ ...p, gradeRaw: raw, grade: parseGrade(raw) }));
                              }
                            }}
                            onBlur={() => {
                              const n = parseGrade(newActivity.gradeRaw ?? String(newActivity.grade));
                              setNewActivity((p) => ({ ...p, gradeRaw: String(n), grade: n }));
                            }}
                            placeholder="0,0"
                            className="w-24 px-3 py-2 rounded-lg border border-border bg-background/50 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                          />
                          <span className="text-muted-foreground text-sm">/</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={newActivity.maxGradeRaw ?? String(newActivity.maxGrade)}
                            onChange={(e) => {
                              const raw = e.target.value;
                              if (/^[0-9]*[.,]?[0-9]*$/.test(raw) || raw === "") {
                                setNewActivity((p) => ({ ...p, maxGradeRaw: raw, maxGrade: parseGrade(raw) || 10 }));
                              }
                            }}
                            onBlur={() => {
                              const n = parseGrade(newActivity.maxGradeRaw ?? String(newActivity.maxGrade)) || 10;
                              setNewActivity((p) => ({ ...p, maxGradeRaw: String(n), maxGrade: n }));
                            }}
                            placeholder="10"
                            className="w-20 px-3 py-2 rounded-lg border border-border bg-background/50 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                          />
                        </div>
                      </div>

                      {/* Observações */}
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                          Observações (opcional)
                        </label>
                        <input
                          value={newActivity.notes}
                          onChange={(e) => setNewActivity((p) => ({ ...p, notes: e.target.value }))}
                          placeholder="Alguma observação sobre o grupo..."
                          className="w-full px-3 py-2 rounded-lg border border-border bg-background/50 text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={handleAddGrade}
                        disabled={isSaving}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
                      >
                        {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        Salvar Nota
                      </button>
                      <button
                        onClick={() => setShowAddForm(false)}
                        className="px-4 py-2 rounded-lg border border-border text-muted-foreground text-sm hover:text-foreground transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Tabela de Notas */}
            {loadingGrades ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
                <Loader2 size={18} className="animate-spin" />
                <span>Carregando notas...</span>
              </div>
            ) : Object.keys(gradesByActivity).length === 0 ? (
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-muted/30 mb-4">
                  {activeTab === "kahoot" ? (
                    <Gamepad2 size={24} className="text-muted-foreground" />
                  ) : (
                    <BookOpen size={24} className="text-muted-foreground" />
                  )}
                </div>
                <p className="text-muted-foreground text-sm">
                  Nenhuma nota lançada para {activeTab === "kahoot" ? "Kahoot" : "Casos Clínicos"} nesta turma.
                </p>
                <button
                  onClick={() => setShowAddForm(true)}
                  className="mt-3 text-primary text-sm hover:underline"
                >
                  Lançar a primeira nota →
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(gradesByActivity).map(([activityName, activityGrades]) => {
                  const avg = activityGrades.reduce((sum, g) => sum + parseFloat(String(g.grade)), 0) / activityGrades.length;
                  const maxG = parseFloat(String(activityGrades[0]?.maxGrade || 10));

                  return (
                    <motion.div
                      key={activityName}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-xl border border-border overflow-hidden"
                      style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}
                    >
                      {/* Activity Header */}
                      <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {activeTab === "kahoot" ? (
                            <Gamepad2 size={15} className="text-amber-400" />
                          ) : (
                            <BookOpen size={15} className="text-blue-400" />
                          )}
                          <span className="font-semibold text-sm text-foreground">{activityName}</span>
                          <span className="text-xs text-muted-foreground">
                            ({activityGrades.length} grupo{activityGrades.length !== 1 ? "s" : ""})
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Média: <span className="font-semibold text-foreground">{avg.toFixed(1)}</span>
                          <span className="text-muted-foreground"> / {maxG}</span>
                        </div>
                      </div>

                      {/* Grades Table */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border/30">
                              <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Grupo</th>
                              <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Nota</th>
                              <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground hidden sm:table-cell">Observações</th>
                              <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground hidden md:table-cell">Lançado por</th>
                              <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Ações</th>
                            </tr>
                          </thead>
                          <tbody>
                            {activityGrades.map((grade) => {
                              const isEditing = !!editingRows[String(grade.id)];
                              const editData = editingRows[String(grade.id)] || grade;

                              return (
                                <tr
                                  key={grade.id}
                                  className={`border-b border-border/20 last:border-0 transition-colors ${
                                    isEditing ? "bg-primary/5" : "hover:bg-muted/20"
                                  }`}
                                >
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                                        <Users size={11} className="text-primary" />
                                      </div>
                                      <span className="font-medium text-foreground text-sm">{grade.groupName}</span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <GradeCell
                                      value={isEditing ? editData.grade : parseFloat(String(grade.grade))}
                                      maxGrade={parseFloat(String(grade.maxGrade))}
                                      isEditing={isEditing}
                                      onChange={(v) =>
                                        setEditingRows((prev) => ({
                                          ...prev,
                                          [String(grade.id)]: { ...editData, grade: v },
                                        }))
                                      }
                                    />
                                  </td>
                                  <td className="px-4 py-3 hidden sm:table-cell">
                                    {isEditing ? (
                                      <input
                                        value={editData.notes || ""}
                                        onChange={(e) =>
                                          setEditingRows((prev) => ({
                                            ...prev,
                                            [String(grade.id)]: { ...editData, notes: e.target.value },
                                          }))
                                        }
                                        placeholder="Observação..."
                                        className="w-full px-2 py-1 rounded border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary/50"
                                      />
                                    ) : (
                                      <span className="text-xs text-muted-foreground">{grade.notes || "—"}</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 hidden md:table-cell">
                                    <span className="text-xs text-muted-foreground">{grade.launchedByName || "—"}</span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex items-center justify-end gap-1">
                                      {isEditing ? (
                                        <>
                                          <button
                                            onClick={() => handleSaveEdit(grade)}
                                            className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                                            title="Salvar"
                                          >
                                            <Check size={13} />
                                          </button>
                                          <button
                                            onClick={() =>
                                              setEditingRows((prev) => {
                                                const next = { ...prev };
                                                delete next[String(grade.id)];
                                                return next;
                                              })
                                            }
                                            className="p-1.5 rounded-lg bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                                            title="Cancelar"
                                          >
                                            <X size={13} />
                                          </button>
                                        </>
                                      ) : (
                                        <>
                                          <button
                                            onClick={() =>
                                              setEditingRows((prev) => ({
                                                ...prev,
                                                [String(grade.id)]: {
                                                  grade: parseFloat(String(grade.grade)),
                                                  maxGrade: parseFloat(String(grade.maxGrade)),
                                                  notes: grade.notes || "",
                                                  groupName: grade.groupName,
                                                  activityName: grade.activityName,
                                                },
                                              }))
                                            }
                                            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                                            title="Editar"
                                          >
                                            <Edit2 size={13} />
                                          </button>
                                          <button
                                            onClick={() => {
                                              if (confirm(`Remover nota do grupo "${grade.groupName}"?`)) {
                                                deleteMutation.mutate({
                                                  monitorSessionToken: sessionToken,
                                                  gradeId: grade.id,
                                                  classId: selectedClassId!,
                                                });
                                              }
                                            }}
                                            className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                            title="Remover"
                                          >
                                            <Trash2 size={13} />
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
                    </motion.div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
