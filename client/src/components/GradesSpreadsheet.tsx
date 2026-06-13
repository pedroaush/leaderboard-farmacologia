/**
 * GradesSpreadsheet — Planilha completa de lançamento de notas
 *
 * FÓRMULA DA MÉDIA FINAL:
 * ─────────────────────────────────────────────────────────────────
 * Nota Provas   = (P1 + P2) / 2  → peso 0,75
 * Nota Atividades = média(Kahoots, Casos Clínicos, Jigsaw) → peso 0,25
 *   - Kahoot: cada um vale 2,5 pontos (escala 0-10 normalizada)
 *   - Caso Clínico: cada um vale 2,5 pontos
 *   - Jigsaw: nota total (0-10) entra na média das atividades
 *
 * Média Final = (NotaProvas × 0,75) + (NotaAtividades × 0,25)
 * Prova Final: Média Final < 6,0
 * ─────────────────────────────────────────────────────────────────
 */

import { useState, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Download, RefreshCw, Settings2, ChevronDown, ChevronUp,
  AlertTriangle, CheckCircle, Info, Search, Loader2, FileSpreadsheet
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
  jigsawFase1: number | null;
  jigsawFase2: number | null;
  jigsawFase3: number | null;
  jigsawTotal: number | null;
}

interface WeightConfig {
  pesoProvas: number;       // padrão 0.75
  pesoAtividades: number;   // padrão 0.25
  minPassGrade: number;     // padrão 6.0
}

const DEFAULT_WEIGHTS: WeightConfig = {
  pesoProvas: 0.75,
  pesoAtividades: 0.25,
  minPassGrade: 6.0,
};

// ─── Helpers ───
function fmt(v: number | null | undefined, decimals = 1): string {
  if (v === null || v === undefined) return "—";
  return v.toFixed(decimals);
}

function gradeColor(v: number | null | undefined, max: number = 10): string {
  if (v === null || v === undefined) return "text-muted-foreground";
  const pct = v / max;
  if (pct >= 0.7) return "text-emerald-400";
  if (pct >= 0.5) return "text-amber-400";
  return "text-red-400";
}

/**
 * Calcula a Nota de Atividades:
 * - Kahoots: cada nota (0-10) vale 2.5 pontos → somados e divididos por (nKahoots * 2.5) * 10
 *   Na prática: média simples dos kahoots (0-10)
 * - Casos Clínicos: idem
 * - Jigsaw: jigsawTotal (0-10)
 * Média das três categorias (se existirem), normalizada 0-10
 */
function calcNotaAtividades(
  row: GradeRow,
  monitorActivityKeys: string[],
  teacherActivityKeys: string[]
): { nota: number | null; kahoots: number[]; casos: number[]; jigsawNota: number | null } {
  // Separar kahoots e casos clínicos das notas de monitores
  const kahoots: number[] = [];
  const casos: number[] = [];

  for (const key of monitorActivityKeys) {
    const [type] = key.split(":::");
    const v = row.monitorGrades[key];
    if (v !== null && v !== undefined) {
      if (type === "kahoot") kahoots.push(v);
      else if (type === "clinical_case") casos.push(v);
    }
  }
  // Também das notas do professor
  for (const key of teacherActivityKeys) {
    const [type] = key.split(":::");
    const v = row.teacherGrades[key];
    if (v !== null && v !== undefined) {
      if (type === "kahoot") kahoots.push(v);
      else if (type === "clinical_case") casos.push(v);
    }
  }

  const jigsawNota = row.jigsawTotal;

  // Média de cada categoria
  const categorias: number[] = [];
  if (kahoots.length > 0) {
    categorias.push(kahoots.reduce((s, v) => s + v, 0) / kahoots.length);
  }
  if (casos.length > 0) {
    categorias.push(casos.reduce((s, v) => s + v, 0) / casos.length);
  }
  if (jigsawNota !== null && jigsawNota !== undefined) {
    categorias.push(jigsawNota);
  }

  const nota = categorias.length > 0
    ? categorias.reduce((s, v) => s + v, 0) / categorias.length
    : null;

  return { nota, kahoots, casos, jigsawNota };
}

function calcFinalGrade(
  row: GradeRow,
  weights: WeightConfig,
  monitorActivityKeys: string[],
  teacherActivityKeys: string[]
): number | null {
  const { p1, p2 } = row;

  // Nota de provas: média de P1 e P2
  let notaProvas: number | null = null;
  if (p1 !== null && p2 !== null) {
    notaProvas = (p1 + p2) / 2;
  } else if (p1 !== null) {
    notaProvas = p1;
  } else if (p2 !== null) {
    notaProvas = p2;
  }

  const { nota: notaAtividades } = calcNotaAtividades(row, monitorActivityKeys, teacherActivityKeys);

  if (notaProvas === null && notaAtividades === null) return null;

  let total = 0;
  let totalPeso = 0;

  if (notaProvas !== null) {
    total += notaProvas * weights.pesoProvas;
    totalPeso += weights.pesoProvas;
  }
  if (notaAtividades !== null) {
    total += notaAtividades * weights.pesoAtividades;
    totalPeso += weights.pesoAtividades;
  }

  return totalPeso > 0 ? total / totalPeso : null;
}

// ─── Componente principal ───
export default function GradesSpreadsheet({ teacherToken }: { teacherToken: string }) {
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [weights, setWeights] = useState<WeightConfig>(DEFAULT_WEIGHTS);
  const [showWeights, setShowWeights] = useState(false);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "team" | "p1" | "p2" | "atividades" | "media">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
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

  const rows = gradeSheet?.rows ?? [];
  const monitorActivityKeys = gradeSheet?.monitorActivityKeys ?? [];
  const teacherActivityKeys = gradeSheet?.teacherActivityKeys ?? [];

  // Separar kahoots e casos clínicos para exibição
  const kahootKeys = useMemo(() =>
    monitorActivityKeys.filter(k => k.startsWith("kahoot:::"))
      .concat(teacherActivityKeys.filter(k => k.startsWith("kahoot:::")))
  , [monitorActivityKeys, teacherActivityKeys]);

  const casoKeys = useMemo(() =>
    monitorActivityKeys.filter(k => k.startsWith("clinical_case:::"))
      .concat(teacherActivityKeys.filter(k => k.startsWith("clinical_case:::")))
  , [monitorActivityKeys, teacherActivityKeys]);

  // Filtrar e ordenar
  const filteredRows = useMemo(() => {
    let list = [...rows] as GradeRow[];
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
      else if (sortBy === "p1") { va = a.p1 ?? -1; vb = b.p1 ?? -1; }
      else if (sortBy === "p2") { va = a.p2 ?? -1; vb = b.p2 ?? -1; }
      else if (sortBy === "atividades") {
        va = calcNotaAtividades(a, monitorActivityKeys, teacherActivityKeys).nota ?? -1;
        vb = calcNotaAtividades(b, monitorActivityKeys, teacherActivityKeys).nota ?? -1;
      }
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
    return { needFinal, passed, avg, total: filteredRows.length, withMedia: withMedia.length };
  }, [filteredRows, weights, monitorActivityKeys, teacherActivityKeys]);

  // Exportar CSV
  const exportCSV = useCallback(() => {
    if (!filteredRows.length) return;
    const headers = [
      "Nome", "Equipe",
      "P1 (0-10)", "P2 (0-10)", "Média Provas",
      ...kahootKeys.map(k => `Kahoot: ${k.split(":::")[1] || k}`),
      "Média Kahoots",
      ...casoKeys.map(k => `Caso Clínico: ${k.split(":::")[1] || k}`),
      "Média Casos Clínicos",
      "Jigsaw Fase 1 (0-2)", "Jigsaw Fase 2 (0-5)", "Jigsaw Fase 3 (0-3)", "Jigsaw Total (0-10)",
      "Nota Atividades (0-10)",
      "Média Final", "Prova Final?"
    ];
    const lines = filteredRows.map(r => {
      const media = calcFinalGrade(r, weights, monitorActivityKeys, teacherActivityKeys);
      const { nota: notaAtiv, kahoots, casos } = calcNotaAtividades(r, monitorActivityKeys, teacherActivityKeys);
      const mediaProvas = r.p1 !== null && r.p2 !== null ? ((r.p1 + r.p2) / 2).toFixed(2) :
        r.p1 !== null ? r.p1.toFixed(2) : r.p2 !== null ? r.p2.toFixed(2) : "";
      const mediaKahoots = kahoots.length > 0 ? (kahoots.reduce((s, v) => s + v, 0) / kahoots.length).toFixed(2) : "";
      const mediaCasos = casos.length > 0 ? (casos.reduce((s, v) => s + v, 0) / casos.length).toFixed(2) : "";
      return [
        `"${r.memberName}"`,
        `"${r.teamEmoji} ${r.teamName}"`,
        r.p1 !== null ? r.p1.toFixed(1) : "",
        r.p2 !== null ? r.p2.toFixed(1) : "",
        mediaProvas,
        ...kahootKeys.map(k => {
          const v = r.monitorGrades[k] ?? r.teacherGrades[k];
          return v !== null && v !== undefined ? v.toFixed(1) : "";
        }),
        mediaKahoots,
        ...casoKeys.map(k => {
          const v = r.monitorGrades[k] ?? r.teacherGrades[k];
          return v !== null && v !== undefined ? v.toFixed(1) : "";
        }),
        mediaCasos,
        r.jigsawFase1 !== null ? r.jigsawFase1.toFixed(2) : "",
        r.jigsawFase2 !== null ? r.jigsawFase2.toFixed(2) : "",
        r.jigsawFase3 !== null ? r.jigsawFase3.toFixed(2) : "",
        r.jigsawTotal !== null ? r.jigsawTotal.toFixed(2) : "",
        notaAtiv !== null ? notaAtiv.toFixed(2) : "",
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
  }, [filteredRows, weights, monitorActivityKeys, teacherActivityKeys, kahootKeys, casoKeys, classesList, selectedClassId]);

  const handleSort = (col: typeof sortBy) => {
    if (sortBy === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("asc"); }
  };

  const SortIcon = ({ col }: { col: typeof sortBy }) => {
    if (sortBy !== col) return <ChevronDown size={12} className="opacity-30" />;
    return sortDir === "asc" ? <ChevronUp size={12} className="text-primary" /> : <ChevronDown size={12} className="text-primary" />;
  };

  const getMonitorGrade = (row: GradeRow, key: string): number | null => {
    const v = row.monitorGrades[key];
    if (v !== null && v !== undefined) return v;
    const v2 = row.teacherGrades[key];
    if (v2 !== null && v2 !== undefined) return v2;
    return null;
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

      {/* ── Fórmula resumida ── */}
      <div className="rounded-lg border border-primary/20 px-4 py-2.5 text-xs text-muted-foreground" style={{ backgroundColor: "oklch(0.18 0.03 264)" }}>
        <span className="text-foreground font-semibold">Fórmula: </span>
        <span className="font-mono">Média Final = (NotaProvas × <span className="text-blue-300">{weights.pesoProvas}</span>) + (NotaAtividades × <span className="text-purple-300">{weights.pesoAtividades}</span>)</span>
        <span className="mx-2 text-border">|</span>
        <span className="text-foreground font-semibold">NotaAtividades</span> = média(Kahoots, Casos Clínicos, Jigsaw)
        <span className="mx-2 text-border">|</span>
        <span className="text-red-300 font-semibold">Prova Final se Média &lt; {weights.minPassGrade}</span>
      </div>

      {/* ── Configuração de pesos ── */}
      {showWeights && (
        <div className="rounded-lg border border-border p-4 space-y-3" style={{ backgroundColor: "oklch(0.18 0.025 264)" }}>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Settings2 size={14} className="text-primary" /> Ajustar Pesos
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { key: "pesoProvas" as const, label: "Peso Provas (P1+P2)", hint: "padrão: 0,75" },
              { key: "pesoAtividades" as const, label: "Peso Atividades", hint: "padrão: 0,25" },
              { key: "minPassGrade" as const, label: "Nota mínima aprovação", hint: "padrão: 6,0" },
            ].map(({ key, label, hint }) => (
              <div key={key} className="space-y-1">
                <label className="text-xs text-muted-foreground">{label} <span className="text-[10px] opacity-60">({hint})</span></label>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.05"
                  value={weights[key]}
                  onChange={e => setWeights(w => ({ ...w, [key]: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-2 py-1.5 rounded bg-secondary border border-border text-sm text-foreground text-center font-mono"
                />
              </div>
            ))}
          </div>
        </div>
      )}

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

      {/* ── Estatísticas ── */}
      {selectedClassId && !isLoading && filteredRows.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total de alunos", value: stats.total, color: "text-foreground", icon: "👥" },
            { label: "Aprovados", value: stats.passed, color: "text-emerald-400", icon: "✅" },
            { label: "Prova Final", value: stats.needFinal, color: "text-red-400", icon: "⚠️" },
            {
              label: "Média da turma",
              value: stats.avg !== null ? stats.avg.toFixed(2) : "—",
              color: stats.avg !== null && stats.avg >= weights.minPassGrade ? "text-emerald-400" : "text-amber-400",
              icon: "📊"
            },
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
          <table className="w-full text-xs border-collapse" style={{ minWidth: 900 }}>
            <thead>
              {/* ── Grupo de colunas ── */}
              <tr style={{ backgroundColor: "oklch(0.22 0.035 264)" }}>
                <th className="sticky left-0 z-10 px-3 py-1.5 border-b border-r border-border" style={{ backgroundColor: "oklch(0.22 0.035 264)" }} rowSpan={2} />
                <th className="sticky left-[180px] z-10 px-3 py-1.5 border-b border-r border-border text-left text-muted-foreground font-normal" style={{ backgroundColor: "oklch(0.22 0.035 264)" }} rowSpan={2} />
                {/* Provas */}
                <th colSpan={3} className="px-3 py-1.5 text-center text-blue-300 font-semibold border-b border-r border-border text-[11px] uppercase tracking-wider">
                  Provas <span className="text-blue-300/60 font-normal text-[10px]">(peso {weights.pesoProvas})</span>
                </th>
                {/* Kahoots */}
                {kahootKeys.length > 0 && (
                  <th colSpan={kahootKeys.length + 1} className="px-3 py-1.5 text-center text-yellow-300 font-semibold border-b border-r border-border text-[11px] uppercase tracking-wider">
                    Kahoots <span className="text-yellow-300/60 font-normal text-[10px]">(2,5 pts cada)</span>
                  </th>
                )}
                {/* Casos Clínicos */}
                {casoKeys.length > 0 && (
                  <th colSpan={casoKeys.length + 1} className="px-3 py-1.5 text-center text-orange-300 font-semibold border-b border-r border-border text-[11px] uppercase tracking-wider">
                    Casos Clínicos <span className="text-orange-300/60 font-normal text-[10px]">(2,5 pts cada)</span>
                  </th>
                )}
                {/* Jigsaw */}
                <th colSpan={4} className="px-3 py-1.5 text-center text-purple-300 font-semibold border-b border-r border-border text-[11px] uppercase tracking-wider">
                  Jigsaw
                </th>
                {/* Nota Atividades */}
                <th className="px-3 py-1.5 text-center text-violet-300 font-semibold border-b border-r border-border text-[11px] uppercase tracking-wider" rowSpan={2}>
                  Nota<br />Atividades<br /><span className="text-violet-300/60 font-normal text-[10px]">(peso {weights.pesoAtividades})</span>
                </th>
                {/* Média + PF */}
                <th className="px-3 py-1.5 text-center text-emerald-300 font-semibold border-b border-r border-border text-[11px] uppercase tracking-wider" rowSpan={2}>
                  Média<br />Final
                </th>
                <th className="px-3 py-1.5 text-center text-red-300 font-semibold border-b border-border text-[11px] uppercase tracking-wider" rowSpan={2}>
                  Prova<br />Final?
                </th>
              </tr>
              {/* ── Sub-cabeçalhos ── */}
              <tr style={{ backgroundColor: "oklch(0.20 0.03 264)" }}>
                {/* Nome (sticky) */}
                {/* Provas */}
                <th className="px-3 py-2 text-center font-semibold text-blue-200 border-b border-r border-border whitespace-nowrap cursor-pointer" onClick={() => handleSort("p1")}>
                  <span className="flex items-center gap-1 justify-center">P1 /10 <SortIcon col="p1" /></span>
                </th>
                <th className="px-3 py-2 text-center font-semibold text-blue-200 border-b border-r border-border whitespace-nowrap cursor-pointer" onClick={() => handleSort("p2")}>
                  <span className="flex items-center gap-1 justify-center">P2 /10 <SortIcon col="p2" /></span>
                </th>
                <th className="px-3 py-2 text-center font-semibold text-blue-300 border-b border-r border-border whitespace-nowrap">
                  Média
                </th>
                {/* Kahoots */}
                {kahootKeys.map(key => (
                  <th key={key} className="px-3 py-2 text-center font-semibold text-yellow-200 border-b border-r border-border whitespace-nowrap max-w-[90px]" title={key.split(":::")[1]}>
                    <span className="block truncate max-w-[80px]">{key.split(":::")[1] || key}</span>
                  </th>
                ))}
                {kahootKeys.length > 0 && (
                  <th className="px-3 py-2 text-center font-semibold text-yellow-300 border-b border-r border-border whitespace-nowrap">Média</th>
                )}
                {/* Casos Clínicos */}
                {casoKeys.map(key => (
                  <th key={key} className="px-3 py-2 text-center font-semibold text-orange-200 border-b border-r border-border whitespace-nowrap max-w-[90px]" title={key.split(":::")[1]}>
                    <span className="block truncate max-w-[80px]">{key.split(":::")[1] || key}</span>
                  </th>
                ))}
                {casoKeys.length > 0 && (
                  <th className="px-3 py-2 text-center font-semibold text-orange-300 border-b border-r border-border whitespace-nowrap">Média</th>
                )}
                {/* Jigsaw */}
                <th className="px-3 py-2 text-center font-semibold text-purple-200 border-b border-r border-border whitespace-nowrap text-[10px]">F1 /2</th>
                <th className="px-3 py-2 text-center font-semibold text-purple-200 border-b border-r border-border whitespace-nowrap text-[10px]">F2 /5</th>
                <th className="px-3 py-2 text-center font-semibold text-purple-200 border-b border-r border-border whitespace-nowrap text-[10px]">F3 /3</th>
                <th className="px-3 py-2 text-center font-semibold text-purple-300 border-b border-r border-border whitespace-nowrap cursor-pointer" onClick={() => handleSort("atividades")}>
                  <span className="flex items-center gap-1 justify-center">Total /10</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, idx) => {
                const media = calcFinalGrade(row, weights, monitorActivityKeys, teacherActivityKeys);
                const { nota: notaAtiv, kahoots, casos } = calcNotaAtividades(row, monitorActivityKeys, teacherActivityKeys);
                const needsFinal = media !== null && media < weights.minPassGrade;
                const mediaProvas = row.p1 !== null && row.p2 !== null ? (row.p1 + row.p2) / 2 :
                  row.p1 !== null ? row.p1 : row.p2 !== null ? row.p2 : null;
                const mediaKahoots = kahoots.length > 0 ? kahoots.reduce((s, v) => s + v, 0) / kahoots.length : null;
                const mediaCasos = casos.length > 0 ? casos.reduce((s, v) => s + v, 0) / casos.length : null;
                const rowBg = idx % 2 === 0 ? "oklch(0.16 0.025 264)" : "oklch(0.175 0.028 264)";

                return (
                  <tr key={row.memberId} className="hover:brightness-110 transition-all" style={{ backgroundColor: rowBg }}>
                    {/* Nome */}
                    <td className="sticky left-0 z-10 px-3 py-2 border-b border-r border-border font-medium text-foreground whitespace-nowrap" style={{ backgroundColor: rowBg, minWidth: 180 }}>
                      {row.memberName}
                    </td>
                    {/* Equipe */}
                    <td className="sticky left-[180px] z-10 px-3 py-2 border-b border-r border-border text-muted-foreground whitespace-nowrap text-[11px]" style={{ backgroundColor: rowBg }}>
                      {row.teamEmoji} {row.teamName}
                    </td>
                    {/* P1 */}
                    <td className="px-3 py-2 border-b border-r border-border text-center font-mono">
                      <span className={gradeColor(row.p1, 10)}>{fmt(row.p1)}</span>
                    </td>
                    {/* P2 */}
                    <td className="px-3 py-2 border-b border-r border-border text-center font-mono">
                      <span className={gradeColor(row.p2, 10)}>{fmt(row.p2)}</span>
                    </td>
                    {/* Média Provas */}
                    <td className="px-3 py-2 border-b border-r border-border text-center font-mono font-semibold">
                      <span className={gradeColor(mediaProvas, 10)}>{fmt(mediaProvas)}</span>
                    </td>
                    {/* Kahoots individuais */}
                    {kahootKeys.map(key => (
                      <td key={key} className="px-3 py-2 border-b border-r border-border text-center font-mono">
                        <span className={gradeColor(getMonitorGrade(row, key), 10)}>
                          {fmt(getMonitorGrade(row, key))}
                        </span>
                      </td>
                    ))}
                    {/* Média Kahoots */}
                    {kahootKeys.length > 0 && (
                      <td className="px-3 py-2 border-b border-r border-border text-center font-mono font-semibold">
                        <span className={gradeColor(mediaKahoots, 10)}>{fmt(mediaKahoots)}</span>
                      </td>
                    )}
                    {/* Casos Clínicos individuais */}
                    {casoKeys.map(key => (
                      <td key={key} className="px-3 py-2 border-b border-r border-border text-center font-mono">
                        <span className={gradeColor(getMonitorGrade(row, key), 10)}>
                          {fmt(getMonitorGrade(row, key))}
                        </span>
                      </td>
                    ))}
                    {/* Média Casos */}
                    {casoKeys.length > 0 && (
                      <td className="px-3 py-2 border-b border-r border-border text-center font-mono font-semibold">
                        <span className={gradeColor(mediaCasos, 10)}>{fmt(mediaCasos)}</span>
                      </td>
                    )}
                    {/* Jigsaw Fase 1 */}
                    <td className="px-3 py-2 border-b border-r border-border text-center font-mono">
                      <span className={gradeColor(row.jigsawFase1, 2)}>{fmt(row.jigsawFase1, 2)}</span>
                    </td>
                    {/* Jigsaw Fase 2 */}
                    <td className="px-3 py-2 border-b border-r border-border text-center font-mono">
                      <span className={gradeColor(row.jigsawFase2, 5)}>{fmt(row.jigsawFase2, 2)}</span>
                    </td>
                    {/* Jigsaw Fase 3 */}
                    <td className="px-3 py-2 border-b border-r border-border text-center font-mono">
                      <span className={gradeColor(row.jigsawFase3, 3)}>{fmt(row.jigsawFase3, 2)}</span>
                    </td>
                    {/* Jigsaw Total */}
                    <td className="px-3 py-2 border-b border-r border-border text-center font-mono font-semibold">
                      <span className={gradeColor(row.jigsawTotal, 10)}>{fmt(row.jigsawTotal, 2)}</span>
                    </td>
                    {/* Nota Atividades */}
                    <td className="px-3 py-2 border-b border-r border-border text-center font-mono font-bold">
                      <span className={gradeColor(notaAtiv, 10)}>{fmt(notaAtiv, 2)}</span>
                    </td>
                    {/* Média Final */}
                    <td className="px-3 py-2 border-b border-r border-border text-center font-mono font-bold text-sm">
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
        <div className="flex flex-wrap gap-4 text-[11px] text-muted-foreground pt-1">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block" /> P1/P2 = Provas (0–10) · peso {weights.pesoProvas}</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" /> Kahoot = 2,5 pts cada</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-orange-400 inline-block" /> Caso Clínico = 2,5 pts cada</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-purple-400 inline-block" /> Jigsaw = nota total (0–10)</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-violet-400 inline-block" /> Nota Atividades = média(Kahoots, Casos, Jigsaw) · peso {weights.pesoAtividades}</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> Verde ≥ 70% | Amarelo ≥ 50% | Vermelho &lt; 50%</span>
        </div>
      )}
    </div>
  );
}
