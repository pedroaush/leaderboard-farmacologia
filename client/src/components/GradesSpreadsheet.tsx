/**
 * GradesSpreadsheet — Planilha completa de lançamento de notas
 * Design: dark academic, tabela horizontal com scroll, pesos configuráveis
 *
 * Fontes de dados:
 * - PF (gamificado): members.xp
 * - P1/P2: teacherAuth.getClassGrades
 * - Notas de monitores: groupActivityGrades (via teacherAuth.getGradeSheet)
 * - Notas do professor: teacherGrades (via teacherAuth.getGradeSheet)
 *
 * Cálculo da média final:
 * Média = (P1 * pesoP1 + P2 * pesoP2 + PF * pesoPF) / (pesoP1 + pesoP2 + pesoPF)
 * Prova Final: Média < 6.0
 */

import { useState, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Download, RefreshCw, Settings2, ChevronDown, ChevronUp,
  AlertTriangle, CheckCircle, Info, Search, Filter, Loader2, FileSpreadsheet
} from "lucide-react";

// ─── Tipos ───
interface GradeRow {
  memberId: number;
  memberName: string;
  teamId: number;
  teamName: string;
  teamEmoji: string;
  pf: number;
  p1: number | null;
  p2: number | null;
  monitorGrades: Record<string, number | null>;
  teacherGrades: Record<string, number | null>;
}

interface WeightConfig {
  pf: number;
  p1: number;
  p2: number;
  monitorWeight: number; // peso das notas de monitores (0-1 do total)
  teacherWeight: number; // peso das notas do professor (0-1 do total)
  minPassGrade: number;  // nota mínima para aprovação sem prova final
}

const DEFAULT_WEIGHTS: WeightConfig = {
  pf: 1,
  p1: 3,
  p2: 3,
  monitorWeight: 0,
  teacherWeight: 0,
  minPassGrade: 6.0,
};

// ─── Helpers ───
function formatGrade(v: number | null | undefined, max?: number): string {
  if (v === null || v === undefined) return "—";
  if (max) return `${v.toFixed(1)}/${max}`;
  return v.toFixed(1);
}

function gradeColor(v: number | null | undefined, max: number = 10): string {
  if (v === null || v === undefined) return "text-muted-foreground";
  const pct = v / max;
  if (pct >= 0.7) return "text-emerald-400";
  if (pct >= 0.5) return "text-amber-400";
  return "text-red-400";
}

function calcFinalGrade(
  row: GradeRow,
  weights: WeightConfig,
  monitorActivityKeys: string[],
  teacherActivityKeys: string[]
): number | null {
  const { pf, p1, p2 } = row;

  // Notas de monitores normalizadas (0-10)
  let monitorSum = 0;
  let monitorCount = 0;
  for (const key of monitorActivityKeys) {
    const v = row.monitorGrades[key];
    if (v !== null && v !== undefined) {
      monitorSum += v;
      monitorCount++;
    }
  }
  const monitorAvg = monitorCount > 0 ? monitorSum / monitorCount : null;

  // Notas do professor normalizadas (0-10)
  let teacherSum = 0;
  let teacherCount = 0;
  for (const key of teacherActivityKeys) {
    const v = row.teacherGrades[key];
    if (v !== null && v !== undefined) {
      teacherSum += v;
      teacherCount++;
    }
  }
  const teacherAvg = teacherCount > 0 ? teacherSum / teacherCount : null;

  // Calcular média ponderada
  let totalWeight = 0;
  let weightedSum = 0;

  // P1 normalizada para 0-10
  if (p1 !== null && p1 !== undefined && weights.p1 > 0) {
    weightedSum += (p1 / 10) * 10 * weights.p1;
    totalWeight += weights.p1;
  }
  // P2 normalizada para 0-10
  if (p2 !== null && p2 !== undefined && weights.p2 > 0) {
    weightedSum += (p2 / 10) * 10 * weights.p2;
    totalWeight += weights.p2;
  }
  // PF normalizado para 0-10 (max 45 pontos → 10)
  if (pf !== null && pf !== undefined && weights.pf > 0) {
    const pfNorm = Math.min((pf / 45) * 10, 10);
    weightedSum += pfNorm * weights.pf;
    totalWeight += weights.pf;
  }
  // Monitor
  if (monitorAvg !== null && weights.monitorWeight > 0) {
    weightedSum += monitorAvg * weights.monitorWeight;
    totalWeight += weights.monitorWeight;
  }
  // Teacher
  if (teacherAvg !== null && weights.teacherWeight > 0) {
    weightedSum += teacherAvg * weights.teacherWeight;
    totalWeight += weights.teacherWeight;
  }

  if (totalWeight === 0) return null;
  return weightedSum / totalWeight;
}

// ─── Componente principal ───
export default function GradesSpreadsheet({ teacherToken }: { teacherToken: string }) {
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [weights, setWeights] = useState<WeightConfig>(DEFAULT_WEIGHTS);
  const [showWeights, setShowWeights] = useState(false);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "team" | "pf" | "p1" | "p2" | "media">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [pfEdits, setPfEdits] = useState<Record<number, string>>({});
  const utils = trpc.useUtils();

  // Turmas
  const { data: classesList = [] } = trpc.classes.listAll.useQuery();

  // Planilha de notas
  const {
    data: gradeSheet,
    isLoading,
    refetch,
    error,
  } = trpc.teacherAuth.getGradeSheet.useQuery(
    { sessionToken: teacherToken, classId: selectedClassId! },
    { enabled: !!teacherToken && !!selectedClassId }
  );

  // Mutation para atualizar PF
  const bulkUpdatePF = trpc.members.bulkUpdateXP.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.count} alunos atualizados!`);
      setPfEdits({});
      utils.teacherAuth.getGradeSheet.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  // Mutation para atualizar nota do professor (teacherGrades)
  const upsertTeacherGrade = trpc.monitors.upsertTeacherGrade.useMutation({
    onSuccess: () => {
      toast.success("Nota salva!");
      utils.teacherAuth.getGradeSheet.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const rows = gradeSheet?.rows ?? [];
  const monitorActivityKeys = gradeSheet?.monitorActivityKeys ?? [];
  const teacherActivityKeys = gradeSheet?.teacherActivityKeys ?? [];

  // Filtrar e ordenar
  const filteredRows = useMemo(() => {
    let list = [...rows];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        r.memberName.toLowerCase().includes(q) ||
        r.teamName.toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      let va: any, vb: any;
      if (sortBy === "name") { va = a.memberName; vb = b.memberName; }
      else if (sortBy === "team") { va = a.teamName; vb = b.teamName; }
      else if (sortBy === "pf") { va = a.pf; vb = b.pf; }
      else if (sortBy === "p1") { va = a.p1 ?? -1; vb = b.p1 ?? -1; }
      else if (sortBy === "p2") { va = a.p2 ?? -1; vb = b.p2 ?? -1; }
      else if (sortBy === "media") {
        va = calcFinalGrade(a, weights, monitorActivityKeys, teacherActivityKeys) ?? -1;
        vb = calcFinalGrade(b, weights, monitorActivityKeys, teacherActivityKeys) ?? -1;
      }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [rows, search, sortBy, sortDir, weights, monitorActivityKeys, teacherActivityKeys]);

  // Estatísticas
  const stats = useMemo(() => {
    const withMedia = filteredRows
      .map(r => calcFinalGrade(r, weights, monitorActivityKeys, teacherActivityKeys))
      .filter(v => v !== null) as number[];
    const needFinal = withMedia.filter(v => v < weights.minPassGrade).length;
    const passed = withMedia.filter(v => v >= weights.minPassGrade).length;
    const avg = withMedia.length > 0 ? withMedia.reduce((s, v) => s + v, 0) / withMedia.length : null;
    return { needFinal, passed, avg, total: filteredRows.length };
  }, [filteredRows, weights, monitorActivityKeys, teacherActivityKeys]);

  // Exportar CSV
  const exportCSV = useCallback(() => {
    if (!filteredRows.length) return;
    const headers = [
      "Nome", "Equipe", "PF (Gamificado)", "P1 (0-10)", "P2 (0-10)",
      ...monitorActivityKeys.map(k => `Monitor: ${k.split(":::")[1] || k}`),
      ...teacherActivityKeys.map(k => `Professor: ${k.split(":::")[1] || k}`),
      "Média Final", "Prova Final?"
    ];
    const lines = filteredRows.map(r => {
      const media = calcFinalGrade(r, weights, monitorActivityKeys, teacherActivityKeys);
      return [
        `"${r.memberName}"`,
        `"${r.teamEmoji} ${r.teamName}"`,
        r.pf.toFixed(1),
        r.p1 !== null ? r.p1.toFixed(1) : "",
        r.p2 !== null ? r.p2.toFixed(1) : "",
        ...monitorActivityKeys.map(k => r.monitorGrades[k] !== null && r.monitorGrades[k] !== undefined ? r.monitorGrades[k]!.toFixed(1) : ""),
        ...teacherActivityKeys.map(k => r.teacherGrades[k] !== null && r.teacherGrades[k] !== undefined ? r.teacherGrades[k]!.toFixed(1) : ""),
        media !== null ? media.toFixed(2) : "",
        media !== null ? (media < weights.minPassGrade ? "SIM" : "NÃO") : "",
      ].join(",");
    });
    const csv = [headers.join(","), ...lines].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const className = classesList.find(c => c.id === selectedClassId)?.name || "turma";
    a.href = url;
    a.download = `notas_${className.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Planilha exportada!");
  }, [filteredRows, weights, monitorActivityKeys, teacherActivityKeys, classesList, selectedClassId]);

  const handleSort = (col: typeof sortBy) => {
    if (sortBy === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("asc"); }
  };

  const SortIcon = ({ col }: { col: typeof sortBy }) => {
    if (sortBy !== col) return <ChevronDown size={12} className="opacity-30" />;
    return sortDir === "asc" ? <ChevronUp size={12} className="text-primary" /> : <ChevronDown size={12} className="text-primary" />;
  };

  const handleSavePF = () => {
    const updates = Object.entries(pfEdits)
      .filter(([_, v]) => v !== "")
      .map(([id, xp]) => ({ id: parseInt(id), xp }));
    if (!updates.length) { toast.info("Nenhuma alteração"); return; }
    // Need password for bulkUpdateXP — use teacherToken approach via upsertTeacherGrade
    // Actually bulkUpdateXP uses password, not teacherToken
    // We'll show a message to use the PF field in the main BulkXPManager
    toast.info("Para atualizar o PF, use a seção abaixo ou o campo de edição inline.");
  };

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <FileSpreadsheet size={20} className="text-primary" />
          <h2 className="text-lg font-display font-bold text-foreground">Planilha de Notas</h2>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowWeights(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary border border-border text-xs text-foreground hover:bg-secondary/80 transition-colors"
          >
            <Settings2 size={13} /> Pesos
          </button>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary border border-border text-xs text-foreground hover:bg-secondary/80 transition-colors"
          >
            <RefreshCw size={13} /> Atualizar
          </button>
          <button
            onClick={exportCSV}
            disabled={!filteredRows.length}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors"
          >
            <Download size={13} /> Exportar CSV
          </button>
        </div>
      </div>

      {/* ── Seletor de turma + busca ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={selectedClassId ?? ""}
          onChange={e => setSelectedClassId(e.target.value ? parseInt(e.target.value) : null)}
          className="px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm min-w-[220px]"
        >
          <option value="">Selecione a turma...</option>
          {classesList.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {selectedClassId && (
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar aluno..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm w-48"
            />
          </div>
        )}
      </div>

      {/* ── Configuração de pesos ── */}
      {showWeights && (
        <div className="rounded-lg border border-border p-4 space-y-3" style={{ backgroundColor: "oklch(0.18 0.025 264)" }}>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Settings2 size={14} className="text-primary" /> Configurar Pesos da Média Final
          </h3>
          <p className="text-xs text-muted-foreground">
            Média = (P1×{weights.p1} + P2×{weights.p2} + PF×{weights.pf}) / ({weights.p1 + weights.p2 + weights.pf})
            {weights.monitorWeight > 0 && ` + Monitor×${weights.monitorWeight}`}
            {weights.teacherWeight > 0 && ` + Professor×${weights.teacherWeight}`}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[
              { key: "p1" as const, label: "Peso P1", max: 10 },
              { key: "p2" as const, label: "Peso P2", max: 10 },
              { key: "pf" as const, label: "Peso PF", max: 10 },
              { key: "monitorWeight" as const, label: "Peso Monitores", max: 5 },
              { key: "teacherWeight" as const, label: "Peso Professor", max: 5 },
            ].map(({ key, label, max }) => (
              <div key={key} className="space-y-1">
                <label className="text-xs text-muted-foreground">{label}</label>
                <input
                  type="number"
                  min="0"
                  max={max}
                  step="0.5"
                  value={weights[key]}
                  onChange={e => setWeights(w => ({ ...w, [key]: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-2 py-1.5 rounded bg-secondary border border-border text-sm text-foreground text-center font-mono"
                />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs text-muted-foreground">Nota mínima para aprovação:</label>
            <input
              type="number"
              min="0"
              max="10"
              step="0.5"
              value={weights.minPassGrade}
              onChange={e => setWeights(w => ({ ...w, minPassGrade: parseFloat(e.target.value) || 6 }))}
              className="w-20 px-2 py-1.5 rounded bg-secondary border border-border text-sm text-foreground text-center font-mono"
            />
          </div>
        </div>
      )}

      {/* ── Estatísticas ── */}
      {selectedClassId && !isLoading && filteredRows.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total de alunos", value: stats.total, color: "text-foreground", icon: "👥" },
            { label: "Aprovados", value: stats.passed, color: "text-emerald-400", icon: "✅" },
            { label: "Prova Final", value: stats.needFinal, color: "text-red-400", icon: "⚠️" },
            { label: "Média da turma", value: stats.avg !== null ? stats.avg.toFixed(2) : "—", color: stats.avg !== null && stats.avg >= weights.minPassGrade ? "text-emerald-400" : "text-amber-400", icon: "📊" },
          ].map(s => (
            <div key={s.label} className="rounded-lg border border-border p-3 text-center" style={{ backgroundColor: "oklch(0.18 0.025 264)" }}>
              <div className="text-lg">{s.icon}</div>
              <div className={`text-xl font-bold font-mono ${s.color}`}>{s.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Tabela ── */}
      {!selectedClassId ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileSpreadsheet size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Selecione uma turma para ver a planilha de notas</p>
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
          <Loader2 size={20} className="animate-spin" />
          <span className="text-sm">Carregando notas...</span>
        </div>
      ) : error ? (
        <div className="text-center py-8 text-red-400">
          <AlertTriangle size={32} className="mx-auto mb-2" />
          <p className="text-sm">Erro ao carregar notas: {error.message}</p>
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Info size={32} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">Nenhum aluno encontrado</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border" style={{ backgroundColor: "oklch(0.16 0.025 264)" }}>
          <table className="w-full text-xs border-collapse min-w-[700px]">
            <thead>
              <tr style={{ backgroundColor: "oklch(0.20 0.03 264)" }}>
                <th className="sticky left-0 z-10 px-3 py-2.5 text-left font-semibold text-foreground border-b border-r border-border cursor-pointer select-none whitespace-nowrap" style={{ backgroundColor: "oklch(0.20 0.03 264)", minWidth: 180 }} onClick={() => handleSort("name")}>
                  <span className="flex items-center gap-1">Nome <SortIcon col="name" /></span>
                </th>
                <th className="px-3 py-2.5 text-left font-semibold text-foreground border-b border-r border-border cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort("team")}>
                  <span className="flex items-center gap-1">Equipe <SortIcon col="team" /></span>
                </th>
                {/* PF */}
                <th className="px-3 py-2.5 text-center font-semibold text-amber-300 border-b border-r border-border cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort("pf")}>
                  <span className="flex items-center gap-1 justify-center">PF <span className="text-[10px] text-muted-foreground font-normal">/45</span> <SortIcon col="pf" /></span>
                </th>
                {/* P1 */}
                <th className="px-3 py-2.5 text-center font-semibold text-blue-300 border-b border-r border-border cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort("p1")}>
                  <span className="flex items-center gap-1 justify-center">P1 <span className="text-[10px] text-muted-foreground font-normal">/10</span> <SortIcon col="p1" /></span>
                </th>
                {/* P2 */}
                <th className="px-3 py-2.5 text-center font-semibold text-blue-300 border-b border-r border-border cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort("p2")}>
                  <span className="flex items-center gap-1 justify-center">P2 <span className="text-[10px] text-muted-foreground font-normal">/10</span> <SortIcon col="p2" /></span>
                </th>
                {/* Notas de monitores */}
                {monitorActivityKeys.map(key => {
                  const [type, name] = key.split(":::");
                  return (
                    <th key={key} className="px-3 py-2.5 text-center font-semibold text-purple-300 border-b border-r border-border whitespace-nowrap" title={`Tipo: ${type}`}>
                      <span className="block max-w-[100px] truncate">{name || key}</span>
                      <span className="text-[10px] text-muted-foreground font-normal">Monitor</span>
                    </th>
                  );
                })}
                {/* Notas do professor */}
                {teacherActivityKeys.map(key => {
                  const [type, name] = key.split(":::");
                  return (
                    <th key={key} className="px-3 py-2.5 text-center font-semibold text-orange-300 border-b border-r border-border whitespace-nowrap" title={`Tipo: ${type}`}>
                      <span className="block max-w-[100px] truncate">{name || key}</span>
                      <span className="text-[10px] text-muted-foreground font-normal">Professor</span>
                    </th>
                  );
                })}
                {/* Média Final */}
                <th className="px-3 py-2.5 text-center font-semibold text-emerald-300 border-b border-r border-border cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort("media")}>
                  <span className="flex items-center gap-1 justify-center">Média <SortIcon col="media" /></span>
                </th>
                {/* Prova Final */}
                <th className="px-3 py-2.5 text-center font-semibold text-red-300 border-b border-border whitespace-nowrap">
                  Prova Final?
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, idx) => {
                const media = calcFinalGrade(row, weights, monitorActivityKeys, teacherActivityKeys);
                const needsFinal = media !== null && media < weights.minPassGrade;
                const rowBg = idx % 2 === 0 ? "oklch(0.16 0.025 264)" : "oklch(0.175 0.028 264)";
                return (
                  <tr
                    key={row.memberId}
                    className="hover:brightness-110 transition-all"
                    style={{ backgroundColor: rowBg }}
                  >
                    {/* Nome */}
                    <td className="sticky left-0 z-10 px-3 py-2 border-b border-r border-border font-medium text-foreground whitespace-nowrap" style={{ backgroundColor: rowBg }}>
                      {row.memberName}
                    </td>
                    {/* Equipe */}
                    <td className="px-3 py-2 border-b border-r border-border text-muted-foreground whitespace-nowrap">
                      {row.teamEmoji} {row.teamName}
                    </td>
                    {/* PF */}
                    <td className="px-3 py-2 border-b border-r border-border text-center font-mono">
                      <span className={gradeColor(row.pf, 45)}>{row.pf.toFixed(1)}</span>
                      <span className="text-muted-foreground text-[10px]">/45</span>
                    </td>
                    {/* P1 */}
                    <td className="px-3 py-2 border-b border-r border-border text-center font-mono">
                      <span className={gradeColor(row.p1, 10)}>{formatGrade(row.p1)}</span>
                    </td>
                    {/* P2 */}
                    <td className="px-3 py-2 border-b border-r border-border text-center font-mono">
                      <span className={gradeColor(row.p2, 10)}>{formatGrade(row.p2)}</span>
                    </td>
                    {/* Notas de monitores */}
                    {monitorActivityKeys.map(key => (
                      <td key={key} className="px-3 py-2 border-b border-r border-border text-center font-mono">
                        <span className={gradeColor(row.monitorGrades[key], 10)}>
                          {formatGrade(row.monitorGrades[key])}
                        </span>
                      </td>
                    ))}
                    {/* Notas do professor */}
                    {teacherActivityKeys.map(key => (
                      <td key={key} className="px-3 py-2 border-b border-r border-border text-center font-mono">
                        <span className={gradeColor(row.teacherGrades[key], 10)}>
                          {formatGrade(row.teacherGrades[key])}
                        </span>
                      </td>
                    ))}
                    {/* Média Final */}
                    <td className="px-3 py-2 border-b border-r border-border text-center font-mono font-bold">
                      {media !== null ? (
                        <span className={media >= weights.minPassGrade ? "text-emerald-400" : "text-red-400"}>
                          {media.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    {/* Prova Final */}
                    <td className="px-3 py-2 border-b border-border text-center">
                      {media === null ? (
                        <span className="text-muted-foreground text-[10px]">—</span>
                      ) : needsFinal ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[10px] font-semibold whitespace-nowrap">
                          <AlertTriangle size={10} /> SIM
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-semibold whitespace-nowrap">
                          <CheckCircle size={10} /> NÃO
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Legenda ── */}
      {selectedClassId && !isLoading && filteredRows.length > 0 && (
        <div className="flex flex-wrap gap-4 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> PF = Pontos de Farmacologia (gamificado, max 45)</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block" /> P1/P2 = Provas (0–10)</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-purple-400 inline-block" /> Monitor = Notas lançadas pelos monitores</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-orange-400 inline-block" /> Professor = Notas lançadas pelo professor</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> Verde ≥ 70% | Amarelo ≥ 50% | Vermelho &lt; 50%</span>
        </div>
      )}

      {/* ── Lançamento rápido de PF ── */}
      {selectedClassId && !isLoading && filteredRows.length > 0 && (
        <div className="rounded-lg border border-border p-4" style={{ backgroundColor: "oklch(0.18 0.025 264)" }}>
          <h3 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
            <Info size={14} className="text-primary" /> Como lançar notas?
          </h3>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
            <li><strong className="text-foreground">PF (Gamificado):</strong> Use a seção "Lançar Notas" acima (campo de edição por equipe)</li>
            <li><strong className="text-foreground">P1 / P2:</strong> Use a seção "Provas" para lançar gabarito e corrigir automaticamente</li>
            <li><strong className="text-foreground">Notas de monitores:</strong> Os monitores lançam diretamente no painel deles</li>
            <li><strong className="text-foreground">Notas do professor:</strong> Use a seção "Monitores → Notas" para lançar manualmente</li>
          </ul>
        </div>
      )}
    </div>
  );
}
