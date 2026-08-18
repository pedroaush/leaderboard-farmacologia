/**
 * GradesSpreadsheet — Planilha completa de lançamento de notas
 *
 * FÓRMULA:
 *   Nota Provas   = (P1 + P2) / 2                          → peso 0,75
 *   Nota Atividades = média(Casos Clínicos, Jigsaw)         → peso 0,25
 *     - Casos Clínicos: nota única (0-10), calculada automaticamente pela
 *       classificação da liga de pontos corridos (não é mais somada caso a
 *       caso — os 4 casos individuais deixaram de ser avaliados assim).
 *     - Jigsaw Total (0-10)
 *   Média Final = (NotaProvas × 0,75) + (NotaAtividades × 0,25)
 *   Prova Final: Média Final < 6,0
 *
 *   NOTA: Kahoot foi removido da fórmula a pedido do professor. As notas de
 *   Kahoot já lançadas continuam salvas e visíveis (coluna/exportação), só
 *   não entram mais no cálculo da Nota Atividades / Média Final.
 */

import { useState, useMemo, useCallback, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Download, RefreshCw, Settings2, ChevronDown, ChevronUp,
  AlertTriangle, CheckCircle, Info, Search, Loader2, FileSpreadsheet, Save, Users
} from "lucide-react";

// ─── Tipos ───
type GradeField =
  | "p1" | "p2"
  | "kahoot_1" | "kahoot_2" | "kahoot_3" | "kahoot_4"
  | "jigsaw_fase1" | "jigsaw_fase2" | "jigsaw_fase3" | "jigsaw_total";

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
  // Grupo de Casos Clínicos (pontos corridos) e de Seminário (pôster + quiz)
  // — vêm de jigsawGroups/jigsawHomeGroups, independentes da tabela genérica
  // "teams" (que não é usada por essas duas dinâmicas).
  ccGroupId: number | null;
  ccGroupName: string | null;
  seminarioGroupId: number | null;
  seminarioGroupName: string | null;
}

interface GroupOption {
  id: number;
  name: string;
}

interface WeightConfig {
  pesoProvas: number;
  pesoAtividades: number;
  minPassGrade: number;
}

const DEFAULT_WEIGHTS: WeightConfig = {
  pesoProvas: 0.75,
  pesoAtividades: 0.25,
  minPassGrade: 6.0,
};

// Mapeamento de field → activityName para buscar em teacherGrades/monitorGrades
const FIELD_TO_ACTIVITY: Record<GradeField, string> = {
  p1: "P1", p2: "P2",
  kahoot_1: "Kahoot 1", kahoot_2: "Kahoot 2", kahoot_3: "Kahoot 3", kahoot_4: "Kahoot 4",
  jigsaw_fase1: "Jigsaw F1", jigsaw_fase2: "Jigsaw F2", jigsaw_fase3: "Casos Clínicos", jigsaw_total: "Jigsaw Total",
};

// ─── Helpers ───
function fmt(v: number | null | undefined, decimals = 1): string {
  if (v === null || v === undefined) return "—";
  return v.toFixed(decimals);
}

function gradeColor(v: number | null | undefined, max = 10): string {
  if (v === null || v === undefined) return "text-muted-foreground";
  const pct = v / max;
  if (pct >= 0.7) return "text-emerald-400";
  if (pct >= 0.5) return "text-amber-400";
  return "text-red-400";
}

/** Extrai a nota de um campo fixo a partir do row */
function getFieldValue(row: GradeRow, field: GradeField): number | null {
  if (field === "p1") return row.p1;
  if (field === "p2") return row.p2;
  if (field === "jigsaw_fase1") return row.jigsawFase1;
  if (field === "jigsaw_fase2") return row.jigsawFase2;
  if (field === "jigsaw_fase3") return row.jigsawFase3;
  if (field === "jigsaw_total") return row.jigsawTotal;
  // Kahoot: mantido só para exibição histórica — busca em teacherGrades
  // primeiro, depois monitorGrades. Casos Clínicos não usa mais esse
  // caminho (agora é sempre jigsawFase3, tratado acima).
  const actName = FIELD_TO_ACTIVITY[field];
  const key = `kahoot:::${actName}`;
  const tv = row.teacherGrades[key];
  if (tv !== null && tv !== undefined) return tv;
  const mv = row.monitorGrades[key];
  if (mv !== null && mv !== undefined) return mv;
  return null;
}

function calcNotaAtividades(row: GradeRow, localOverrides: Record<string, Record<GradeField, number | null>>): {
  nota: number | null; mediaKahoots: number | null; notaCasosClinicos: number | null; jigsawNota: number | null;
} {
  const override = localOverrides[row.memberId] || {};
  const get = (f: GradeField) => f in override ? override[f] : getFieldValue(row, f);

  const kahoots = (["kahoot_1", "kahoot_2", "kahoot_3", "kahoot_4"] as GradeField[])
    .map(f => get(f)).filter(v => v !== null) as number[];
  const jigsawNota = get("jigsaw_total");

  // Kahoot mantido só para exibição (não usado na fórmula).
  const mediaKahoots = kahoots.length > 0 ? kahoots.reduce((s, v) => s + v, 0) / kahoots.length : null;

  // Casos Clínicos: nota única (0-10), calculada automaticamente pela
  // classificação da liga de pontos corridos — não é mais soma dos 4 casos
  // individuais lançados manualmente.
  const notaCasosClinicos = get("jigsaw_fase3");

  // Nota de Trabalhos = (Seminários + Casos Clínicos) / 2. Se nenhum dos dois
  // estiver disponível ainda, fica null (sem nota lançada). Se só um estiver
  // disponível, o outro entra como 0 na soma (não é mais média entre "o que
  // existir" — é sempre dividido por 2, como especificado).
  const nota = (jigsawNota === null && notaCasosClinicos === null)
    ? null
    : ((jigsawNota ?? 0) + (notaCasosClinicos ?? 0)) / 2;

  return { nota, mediaKahoots, notaCasosClinicos, jigsawNota };
}

function calcFinalGrade(row: GradeRow, weights: WeightConfig, localOverrides: Record<string, Record<GradeField, number | null>>): number | null {
  const override = localOverrides[row.memberId] || {};
  const get = (f: GradeField) => f in override ? override[f] : getFieldValue(row, f);
  const p1 = get("p1"); const p2 = get("p2");

  let notaProvas: number | null = null;
  if (p1 !== null && p2 !== null) notaProvas = (p1 + p2) / 2;
  else if (p1 !== null) notaProvas = p1;
  else if (p2 !== null) notaProvas = p2;

  const { nota: notaAtiv } = calcNotaAtividades(row, localOverrides);

  if (notaProvas === null && notaAtiv === null) return null;
  let total = 0; let totalPeso = 0;
  if (notaProvas !== null) { total += notaProvas * weights.pesoProvas; totalPeso += weights.pesoProvas; }
  if (notaAtiv !== null) { total += notaAtiv * weights.pesoAtividades; totalPeso += weights.pesoAtividades; }
  return totalPeso > 0 ? total / totalPeso : null;
}

// ─── Célula editável ───
function EditableCell({
  value, field, memberId, memberName, classId, teacherToken, onSaved, disabled
}: {
  value: number | null;
  field: GradeField;
  memberId: number;
  memberName: string;
  classId: number;
  teacherToken: string;
  onSaved: (field: GradeField, value: number | null) => void;
  disabled?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  const saveMutation = trpc.teacherAuth.saveGradeCell.useMutation({
    onSuccess: () => {
      setSaving(false);
      setEditing(false);
      utils.teacherAuth.getGradeSheet.invalidate();
    },
    onError: (e) => {
      setSaving(false);
      toast.error(`Erro ao salvar: ${e.message}`);
    }
  });

  const startEdit = () => {
    if (disabled) return;
    setInputVal(value !== null ? String(value) : "");
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 50);
  };

  const commit = async () => {
    const raw = inputVal.replace(",", ".").trim();
    const parsed = raw === "" ? null : parseFloat(raw);
    if (raw !== "" && (isNaN(parsed!) || parsed! < 0 || parsed! > 100)) {
      toast.error("Nota inválida (0-100)");
      return;
    }
    setSaving(true);
    onSaved(field, parsed);
    saveMutation.mutate({ sessionToken: teacherToken, classId, memberId, memberName, field, value: parsed });
  };

  const cancel = () => setEditing(false);

  if (editing) {
    return (
      <td className="px-1 py-0.5 border-b border-r border-border text-center" style={{ minWidth: 64 }}>
        <div className="flex items-center gap-0.5">
          <input
            ref={inputRef}
            type="text"
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") cancel(); }}
            onBlur={commit}
            className="w-14 px-1 py-0.5 rounded bg-primary/20 border border-primary text-foreground text-xs font-mono text-center focus:outline-none"
            autoFocus
          />
          {saving && <Loader2 size={10} className="animate-spin text-primary flex-shrink-0" />}
        </div>
      </td>
    );
  }

  return (
    <td
      className={`px-2 py-2 border-b border-r border-border text-center font-mono cursor-pointer group hover:bg-primary/10 transition-colors ${disabled ? "cursor-default" : ""}`}
      onClick={startEdit}
      title={disabled ? "" : "Clique para editar"}
      style={{ minWidth: 64 }}
    >
      <span className={`${gradeColor(value)} group-hover:underline`}>
        {value !== null ? value.toFixed(1) : <span className="text-muted-foreground/40 text-[10px]">—</span>}
      </span>
    </td>
  );
}

// ─── Componente principal ───
export default function GradesSpreadsheet({ teacherToken }: { teacherToken: string }) {
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [weights, setWeights] = useState<WeightConfig>(DEFAULT_WEIGHTS);
  const [showWeights, setShowWeights] = useState(false);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "team" | "p1" | "p2" | "media">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  // Overrides locais para cálculo imediato antes da invalidação
  const [localOverrides, setLocalOverrides] = useState<Record<string, Record<GradeField, number | null>>>({});

  const { data: classesList = [] } = trpc.classes.listAll.useQuery();

  const { data: gradeSheet, isLoading, refetch, error } = trpc.teacherAuth.getGradeSheet.useQuery(
    { sessionToken: teacherToken, classId: selectedClassId! },
    { enabled: !!teacherToken && !!selectedClassId }
  );

  const rows = (gradeSheet?.rows ?? []) as GradeRow[];
  const ccGroups = (gradeSheet?.ccGroups ?? []) as GroupOption[];
  const seminarioGroups = (gradeSheet?.seminarioGroups ?? []) as GroupOption[];

  // ─── Classificação de Casos Clínicos (pontuação do campeonato) ───
  const [showClassificacao, setShowClassificacao] = useState(false);
  const { data: classificacaoCC = [], isLoading: loadingClassificacao } = trpc.casosClinicos.getTabelaClassificacao.useQuery(
    { classId: selectedClassId! },
    { enabled: !!selectedClassId && showClassificacao }
  );
  /** Mesma fórmula do back-end (casosClinicos.ts): 1º=10, cai 0,5 por posição. */
  const notaPorColocacao = (posicao: number) => Math.max(0, 10 - 0.5 * (posicao - 1));

  // ─── Lançamento em bloco por grupo (Casos Clínicos ou Seminário) ───
  const [showBulk, setShowBulk] = useState(false);
  const [bulkKind, setBulkKind] = useState<"cc" | "seminario">("cc");
  const [bulkGroupId, setBulkGroupId] = useState<number | "">("");
  const [bulkField, setBulkField] = useState<GradeField>("jigsaw_fase3");
  const [bulkValue, setBulkValue] = useState("");
  const utilsBulk = trpc.useUtils();
  const bulkMutation = trpc.teacherAuth.saveGradeCellBulk.useMutation({
    onSuccess: (res) => {
      toast.success(`Nota aplicada a ${res.atualizados} aluno(s)!`);
      setBulkValue("");
      setLocalOverrides({});
      utilsBulk.teacherAuth.getGradeSheet.invalidate();
    },
    onError: (e) => toast.error(`Erro ao lançar em bloco: ${e.message}`),
  });

  const bulkGroupMembers = useMemo(() => {
    if (!bulkGroupId) return [];
    const key = bulkKind === "cc" ? "ccGroupId" : "seminarioGroupId";
    return rows.filter(r => (r as any)[key] === bulkGroupId);
  }, [rows, bulkKind, bulkGroupId]);

  const handleApplyBulk = () => {
    const raw = bulkValue.replace(",", ".").trim();
    const parsed = raw === "" ? null : parseFloat(raw);
    if (raw !== "" && (isNaN(parsed!) || parsed! < 0 || parsed! > 100)) {
      toast.error("Nota inválida (0–100)");
      return;
    }
    if (!bulkGroupMembers.length) {
      toast.error("Nenhum aluno encontrado nesse grupo");
      return;
    }
    bulkMutation.mutate({
      sessionToken: teacherToken,
      classId: selectedClassId!,
      memberIds: bulkGroupMembers.map(m => m.memberId),
      field: bulkField,
      value: parsed,
    });
  };

  const handleCellSaved = useCallback((memberId: number, field: GradeField, value: number | null) => {
    setLocalOverrides(prev => ({
      ...prev,
      [memberId]: { ...(prev[memberId] || {}), [field]: value }
    }));
  }, []);

  // Limpar overrides quando os dados são recarregados
  const handleRefetch = () => {
    setLocalOverrides({});
    refetch();
  };

  const filteredRows = useMemo(() => {
    let list = [...rows];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(r => r.memberName.toLowerCase().includes(q) || r.teamName.toLowerCase().includes(q));
    }
    list.sort((a, b) => {
      let va: any, vb: any;
      if (sortBy === "name") { va = a.memberName; vb = b.memberName; }
      else if (sortBy === "team") { va = a.teamName; vb = b.teamName; }
      else if (sortBy === "p1") { va = getFieldValue(a, "p1") ?? -1; vb = getFieldValue(b, "p1") ?? -1; }
      else if (sortBy === "p2") { va = getFieldValue(a, "p2") ?? -1; vb = getFieldValue(b, "p2") ?? -1; }
      else if (sortBy === "media") {
        va = calcFinalGrade(a, weights, localOverrides) ?? -1;
        vb = calcFinalGrade(b, weights, localOverrides) ?? -1;
      }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [rows, search, sortBy, sortDir, weights, localOverrides]);

  const stats = useMemo(() => {
    const medias = filteredRows.map(r => calcFinalGrade(r, weights, localOverrides)).filter(v => v !== null) as number[];
    return {
      total: filteredRows.length,
      passed: medias.filter(v => v >= weights.minPassGrade).length,
      needFinal: medias.filter(v => v < weights.minPassGrade).length,
      avg: medias.length > 0 ? medias.reduce((s, v) => s + v, 0) / medias.length : null,
    };
  }, [filteredRows, weights, localOverrides]);

  const exportXLS = useCallback(async () => {
    if (!filteredRows.length) return;
    const XLSX = await import("xlsx");
    const className = classesList.find(c => c.id === selectedClassId)?.name || "turma";

    // ── Aba 1: Notas Completas ──
    const headers = [
      "Nome", "Equipe",
      "P1", "P2", "Média Provas",
      "Kahoot 1", "Kahoot 2", "Kahoot 3", "Kahoot 4", "Média Kahoots",
      "Casos Clínicos (nota final)",
      "Jigsaw F1 /2", "Jigsaw F2 /5", "Jigsaw Total /10",
      "Nota Atividades", "Média Final", "Prova Final?"
    ];
    const rows = filteredRows.map(r => {
      const ov = localOverrides[r.memberId] || {};
      const g = (f: GradeField) => f in ov ? ov[f] : getFieldValue(r, f);
      const p1 = g("p1"); const p2 = g("p2");
      const mediaProvas = p1 !== null && p2 !== null ? (p1 + p2) / 2 : p1 ?? p2;
      const ks = (["kahoot_1","kahoot_2","kahoot_3","kahoot_4"] as GradeField[]).map(f => g(f));
      const mediaKs = ks.filter(v => v !== null).length > 0 ? (ks.filter(v => v !== null) as number[]).reduce((s,v)=>s+v,0)/(ks.filter(v=>v!==null).length) : null;
      const { nota: notaAtiv, notaCasosClinicos } = calcNotaAtividades(r, localOverrides);
      const media = calcFinalGrade(r, weights, localOverrides);
      return [
        r.memberName, `${r.teamEmoji} ${r.teamName}`,
        p1, p2, mediaProvas !== null ? parseFloat(mediaProvas.toFixed(2)) : null,
        ...ks,
        mediaKs !== null ? parseFloat(mediaKs.toFixed(2)) : null,
        notaCasosClinicos,
        g("jigsaw_fase1"), g("jigsaw_fase2"), g("jigsaw_total"),
        notaAtiv !== null ? parseFloat(notaAtiv.toFixed(2)) : null,
        media !== null ? parseFloat(media.toFixed(2)) : null,
        media !== null ? (media < weights.minPassGrade ? "SIM" : "NÃO") : "",
      ];
    });
    const ws1 = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws1["!cols"] = headers.map((h, i) => ({ wch: i === 0 ? 30 : i === 1 ? 20 : 12 }));

    // ── Aba 2: Resumo Final ──
    const resumoHeaders = ["Nome", "Equipe", "Média Final", "Situação"];
    const resumoRows = [...filteredRows]
      .sort((a, b) => a.memberName.localeCompare(b.memberName))
      .map(r => {
        const media = calcFinalGrade(r, weights, localOverrides);
        return [
          r.memberName,
          `${r.teamEmoji} ${r.teamName}`,
          media !== null ? parseFloat(media.toFixed(2)) : null,
          media !== null ? (media < weights.minPassGrade ? "PROVA FINAL" : "APROVADO") : "SEM NOTA",
        ];
      });
    const ws2 = XLSX.utils.aoa_to_sheet([resumoHeaders, ...resumoRows]);
    ws2["!cols"] = [{ wch: 30 }, { wch: 20 }, { wch: 14 }, { wch: 14 }];

    // ── Aba 3: Estatísticas ──
    const medias = filteredRows
      .map(r => calcFinalGrade(r, weights, localOverrides))
      .filter((v): v is number => v !== null);
    const aprovados = medias.filter(v => v >= weights.minPassGrade).length;
    const sorted = [...medias].sort((a, b) => a - b);
    const mediana = sorted.length > 0
      ? sorted.length % 2 === 0
        ? (sorted[sorted.length/2 - 1] + sorted[sorted.length/2]) / 2
        : sorted[Math.floor(sorted.length/2)]
      : null;
    const statsData = [
      ["Estatística", "Valor"],
      ["Total de alunos", filteredRows.length],
      ["Com nota final", medias.length],
      ["Média da turma", medias.length > 0 ? parseFloat((medias.reduce((s,v)=>s+v,0)/medias.length).toFixed(2)) : null],
      ["Mediana", mediana !== null ? parseFloat(mediana.toFixed(2)) : null],
      ["Maior nota", sorted.length > 0 ? sorted[sorted.length-1] : null],
      ["Menor nota", sorted.length > 0 ? sorted[0] : null],
      ["Aprovados", aprovados],
      ["Prova Final", medias.length - aprovados],
      ["Taxa de aprovação", medias.length > 0 ? `${((aprovados/medias.length)*100).toFixed(1)}%` : "-"],
    ];
    const ws3 = XLSX.utils.aoa_to_sheet(statsData);
    ws3["!cols"] = [{ wch: 22 }, { wch: 14 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, "Notas Completas");
    XLSX.utils.book_append_sheet(wb, ws2, "Resumo Final");
    XLSX.utils.book_append_sheet(wb, ws3, "Estatísticas");
    XLSX.writeFile(wb, `notas_${className.replace(/\s+/g,"_")}_${new Date().toISOString().slice(0,10)}.xlsx`);
    toast.success("Planilha XLS exportada!");
  }, [filteredRows, weights, localOverrides, classesList, selectedClassId]);

  const handleSort = (col: typeof sortBy) => {
    if (sortBy === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("asc"); }
  };

  const SortIcon = ({ col }: { col: typeof sortBy }) =>
    sortBy !== col ? <ChevronDown size={11} className="opacity-30" /> :
    sortDir === "asc" ? <ChevronUp size={11} className="text-primary" /> : <ChevronDown size={11} className="text-primary" />;

  const thBase = "px-2 py-2 text-center font-semibold border-b border-r border-border whitespace-nowrap text-[11px]";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <FileSpreadsheet size={20} className="text-primary" />
          <h2 className="text-lg font-display font-bold text-foreground">Planilha de Notas</h2>
          <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">Clique em qualquer célula para editar</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setShowClassificacao(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary border border-border text-xs text-foreground hover:bg-secondary/80 transition-colors">
            <FileSpreadsheet size={13} /> Classificação Casos Clínicos
          </button>
          <button onClick={() => setShowBulk(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary border border-border text-xs text-foreground hover:bg-secondary/80 transition-colors">
            <Users size={13} /> Lançar em bloco
          </button>
          <button onClick={() => setShowWeights(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary border border-border text-xs text-foreground hover:bg-secondary/80 transition-colors">
            <Settings2 size={13} /> Pesos
          </button>
          <button onClick={handleRefetch}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary border border-border text-xs text-foreground hover:bg-secondary/80 transition-colors">
            <RefreshCw size={13} /> Atualizar
          </button>
          <button onClick={exportXLS} disabled={!filteredRows.length}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors">
            <Download size={13} /> Exportar XLS
          </button>
        </div>
      </div>

      {/* Fórmula */}
      <div className="rounded-lg border border-primary/20 px-4 py-2.5 text-xs text-muted-foreground" style={{ backgroundColor: "oklch(0.18 0.03 264)" }}>
        <span className="text-foreground font-semibold">Fórmula: </span>
        <span className="font-mono">
          Média Final = (MédiaProvas × <span className="text-blue-300">{weights.pesoProvas}</span>) + (MédiaAtividades × <span className="text-purple-300">{weights.pesoAtividades}</span>)
        </span>
        <span className="mx-2 text-border">|</span>
        <span>MédiaAtividades = média(Kahoots, Casos Clínicos, Jigsaw)</span>
        <span className="mx-2 text-border">|</span>
        <span className="text-red-300 font-semibold">Prova Final se Média &lt; {weights.minPassGrade}</span>
      </div>

      {/* Lançamento em bloco por grupo */}
      {showBulk && (
        <div className="rounded-lg border border-primary/30 p-4 space-y-3" style={{ backgroundColor: "oklch(0.18 0.025 264)" }}>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Users size={14} className="text-primary" /> Lançar nota em bloco por grupo
          </h3>
          <p className="text-xs text-muted-foreground">
            Escolha o grupo (Casos Clínicos ou Seminário) e o campo — a nota é aplicada a todos os alunos daquele grupo de uma vez.
            Isso <b>não</b> é a mesma coisa que a coluna "Equipe" da tabela, que usa outro agrupamento (hoje sem uso).
          </p>
          {!selectedClassId ? (
            <p className="text-xs text-amber-400">Selecione uma turma primeiro.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Dinâmica</label>
                <select value={bulkKind}
                  onChange={e => {
                    const kind = e.target.value as "cc" | "seminario";
                    setBulkKind(kind);
                    setBulkGroupId("");
                    setBulkField(kind === "cc" ? "jigsaw_fase3" : "jigsaw_fase1");
                  }}
                  className="w-full px-2 py-1.5 rounded bg-secondary border border-border text-sm text-foreground">
                  <option value="cc">Casos Clínicos</option>
                  <option value="seminario">Seminário</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Grupo</label>
                <select value={bulkGroupId}
                  onChange={e => setBulkGroupId(e.target.value ? parseInt(e.target.value) : "")}
                  className="w-full px-2 py-1.5 rounded bg-secondary border border-border text-sm text-foreground">
                  <option value="">Selecione...</option>
                  {(bulkKind === "cc" ? ccGroups : seminarioGroups).map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Campo</label>
                <select value={bulkField} onChange={e => setBulkField(e.target.value as GradeField)}
                  className="w-full px-2 py-1.5 rounded bg-secondary border border-border text-sm text-foreground">
                  {bulkKind === "cc" ? (
                    <option value="jigsaw_fase3">Casos Clínicos — nota final</option>
                  ) : (
                    <>
                      <option value="jigsaw_fase1">Seminário — Fase 1 (pôster)</option>
                      <option value="jigsaw_fase2">Seminário — Fase 2 (quiz individual)</option>
                      <option value="jigsaw_total">Seminário — Nota total</option>
                    </>
                  )}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Nota (0–10)</label>
                <input type="text" value={bulkValue} onChange={e => setBulkValue(e.target.value)}
                  placeholder="ex: 8,5"
                  className="w-full px-2 py-1.5 rounded bg-secondary border border-border text-sm text-foreground font-mono" />
              </div>
              <div className="col-span-2 sm:col-span-4 flex items-center gap-3">
                <button
                  onClick={handleApplyBulk}
                  disabled={!bulkGroupId || bulkMutation.isPending}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors"
                >
                  {bulkMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  Aplicar a todos
                </button>
                {bulkGroupId !== "" && (
                  <span className="text-xs text-muted-foreground">
                    {bulkGroupMembers.length} aluno(s) neste grupo{bulkGroupMembers.length === 0 ? " — carregue a turma primeiro" : ""}
                  </span>
                )}
              </div>
              {bulkKind === "cc" && (
                <div className="col-span-2 sm:col-span-4">
                  <p className="text-[11px] text-amber-400/80 flex items-start gap-1.5">
                    <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                    A nota de Casos Clínicos normalmente é calculada sozinha pela classificação do campeonato. Um
                    lançamento manual aqui é sobrescrito automaticamente se um novo resultado de rodada for registrado depois.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Classificação de Casos Clínicos */}
      {showClassificacao && (
        <div className="rounded-lg border border-border p-4 space-y-3" style={{ backgroundColor: "oklch(0.18 0.025 264)" }}>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <FileSpreadsheet size={14} className="text-orange-400" /> Classificação — Liga de Pontos Corridos
          </h3>
          <p className="text-xs text-muted-foreground">
            Pontuação após as rodadas já disputadas (3 pts por vitória, 0 por derrota — empate não ocorre no formato
            atual, melhor de 5). A coluna Nota é a mesma que já aparece na Planilha, calculada automaticamente.
          </p>
          {!selectedClassId ? (
            <p className="text-xs text-muted-foreground">Selecione uma turma acima primeiro.</p>
          ) : loadingClassificacao ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground"><Loader2 size={16} className="animate-spin" /></div>
          ) : !classificacaoCC.length ? (
            <p className="text-xs text-muted-foreground py-2">Nenhum grupo de Casos Clínicos encontrado para esta turma.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-border" style={{ backgroundColor: "oklch(0.22 0.035 264)" }}>
                    <th className="py-2 px-3">#</th>
                    <th className="py-2 px-3">Grupo</th>
                    <th className="py-2 px-3 text-center">Pts</th>
                    <th className="py-2 px-3 text-center">V</th>
                    <th className="py-2 px-3 text-center">E</th>
                    <th className="py-2 px-3 text-center">D</th>
                    <th className="py-2 px-3 text-center">J</th>
                    <th className="py-2 px-3 text-center text-orange-300">Nota</th>
                  </tr>
                </thead>
                <tbody>
                  {classificacaoCC.map((t: any, i: number) => (
                    <tr key={t.grupoId} className="border-b border-border/40">
                      <td className="py-1.5 px-3 text-muted-foreground">{i + 1}º</td>
                      <td className="py-1.5 px-3 text-foreground font-medium">{t.nome}</td>
                      <td className="py-1.5 px-3 text-center font-mono font-bold text-foreground">{t.pontos}</td>
                      <td className="py-1.5 px-3 text-center text-emerald-400">{t.vitorias}</td>
                      <td className="py-1.5 px-3 text-center text-amber-400">{t.empates}</td>
                      <td className="py-1.5 px-3 text-center text-red-400">{t.derrotas}</td>
                      <td className="py-1.5 px-3 text-center text-muted-foreground">{t.jogos}</td>
                      <td className="py-1.5 px-3 text-center font-mono font-bold text-orange-300">{notaPorColocacao(i + 1).toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Pesos */}
      {showWeights && (
        <div className="rounded-lg border border-border p-4 space-y-3" style={{ backgroundColor: "oklch(0.18 0.025 264)" }}>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><Settings2 size={14} className="text-primary" /> Ajustar Pesos</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { key: "pesoProvas" as const, label: "Peso Provas (P1+P2)", hint: "padrão: 0,75" },
              { key: "pesoAtividades" as const, label: "Peso Atividades", hint: "padrão: 0,25" },
              { key: "minPassGrade" as const, label: "Nota mínima aprovação", hint: "padrão: 6,0" },
            ].map(({ key, label, hint }) => (
              <div key={key} className="space-y-1">
                <label className="text-xs text-muted-foreground">{label} <span className="text-[10px] opacity-60">({hint})</span></label>
                <input type="number" min="0" max="10" step="0.05" value={weights[key]}
                  onChange={e => setWeights(w => ({ ...w, [key]: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-2 py-1.5 rounded bg-secondary border border-border text-sm text-foreground text-center font-mono" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Seletor + busca */}
      <div className="flex items-center gap-3 flex-wrap">
        <select value={selectedClassId ?? ""} onChange={e => { setSelectedClassId(e.target.value ? parseInt(e.target.value) : null); setLocalOverrides({}); }}
          className="px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm min-w-[220px]">
          <option value="">Selecione a turma...</option>
          {classesList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {selectedClassId && (
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input type="text" placeholder="Buscar aluno..." value={search} onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm w-48" />
          </div>
        )}
      </div>

      {/* Stats */}
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

      {/* Tabela */}
      {!selectedClassId ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileSpreadsheet size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Selecione uma turma para ver a planilha de notas</p>
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
          <Loader2 size={20} className="animate-spin" /><span className="text-sm">Carregando notas...</span>
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
          <table className="w-full text-xs border-collapse" style={{ minWidth: 1100 }}>
            <thead>
              {/* Linha 1: grupos */}
              <tr style={{ backgroundColor: "oklch(0.22 0.035 264)" }}>
                <th className="sticky left-0 z-20 px-3 py-1.5 border-b border-r border-border text-left text-muted-foreground font-normal text-[11px]"
                  style={{ backgroundColor: "oklch(0.22 0.035 264)", minWidth: 200 }} rowSpan={2}>
                  Aluno
                </th>
                <th colSpan={3} className={`${thBase} text-blue-300 border-r`}>
                  Provas <span className="text-blue-300/60 font-normal">(peso {weights.pesoProvas})</span>
                </th>
                <th colSpan={5} className={`${thBase} text-yellow-300 border-r`}>
                  Kahoots <span className="text-yellow-300/60 font-normal">(2,5 pts cada)</span>
                </th>
                <th className={`${thBase} text-orange-300 border-r`} rowSpan={2}>
                  Casos<br />Clínicos<br /><span className="font-normal text-[10px] text-orange-300/60">(0-10)</span>
                </th>
                <th colSpan={3} className={`${thBase} text-purple-300 border-r`}>
                  Jigsaw
                </th>
                <th className={`${thBase} text-violet-300 border-r`} rowSpan={2}>
                  Nota<br />Atividades<br /><span className="font-normal text-[10px] text-violet-300/60">(peso {weights.pesoAtividades})</span>
                </th>
                <th className={`${thBase} text-emerald-300 border-r`} rowSpan={2}>
                  Média<br />Final
                </th>
                <th className={`${thBase} text-red-300`} rowSpan={2}>
                  Prova<br />Final?
                </th>
              </tr>
              {/* Linha 2: sub-cabeçalhos */}
              <tr style={{ backgroundColor: "oklch(0.20 0.03 264)" }}>
                {/* Provas */}
                <th className={`${thBase} text-blue-200 cursor-pointer`} onClick={() => handleSort("p1")}>
                  <span className="flex items-center gap-1 justify-center">P1 /10 <SortIcon col="p1" /></span>
                </th>
                <th className={`${thBase} text-blue-200 cursor-pointer`} onClick={() => handleSort("p2")}>
                  <span className="flex items-center gap-1 justify-center">P2 /10 <SortIcon col="p2" /></span>
                </th>
                <th className={`${thBase} text-blue-300`}>Média</th>
                {/* Kahoots */}
                {[1,2,3,4].map(n => <th key={n} className={`${thBase} text-yellow-200`}>K{n}</th>)}
                <th className={`${thBase} text-yellow-300`}>Média</th>
                {/* Jigsaw */}
                <th className={`${thBase} text-purple-200 text-[10px]`}>F1 /2</th>
                <th className={`${thBase} text-purple-200 text-[10px]`}>F2 /5</th>
                <th className={`${thBase} text-purple-300`}>Total</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, idx) => {
                const ov = localOverrides[row.memberId] || {};
                const g = (f: GradeField) => f in ov ? ov[f] : getFieldValue(row, f);
                const p1 = g("p1"); const p2 = g("p2");
                const mediaProvas = p1 !== null && p2 !== null ? (p1 + p2) / 2 : p1 ?? p2;
                const ks = [g("kahoot_1"), g("kahoot_2"), g("kahoot_3"), g("kahoot_4")];
                const validKs = ks.filter(v => v !== null) as number[];
                const mediaKs = validKs.length > 0 ? validKs.reduce((s,v)=>s+v,0)/validKs.length : null;
                const { nota: notaAtiv, notaCasosClinicos } = calcNotaAtividades(row, localOverrides);
                const media = calcFinalGrade(row, weights, localOverrides);
                const needsFinal = media !== null && media < weights.minPassGrade;
                const rowBg = idx % 2 === 0 ? "oklch(0.16 0.025 264)" : "oklch(0.175 0.028 264)";

                const cellProps = { classId: selectedClassId!, teacherToken, memberId: row.memberId, memberName: row.memberName };
                const onSaved = (field: GradeField, value: number | null) => handleCellSaved(row.memberId, field, value);

                return (
                  <tr key={row.memberId} className="hover:brightness-110 transition-all" style={{ backgroundColor: rowBg }}>
                    {/* Nome */}
                    <td className="sticky left-0 z-10 px-3 py-2 border-b border-r border-border" style={{ backgroundColor: rowBg, minWidth: 200 }}>
                      <div className="font-medium text-foreground text-xs leading-tight">{row.memberName}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {row.ccGroupName || row.seminarioGroupName
                          ? [row.ccGroupName, row.seminarioGroupName].filter(Boolean).join(" · ")
                          : `${row.teamEmoji} ${row.teamName}`}
                      </div>
                    </td>
                    {/* P1 */}
                    <EditableCell {...cellProps} field="p1" value={p1} onSaved={onSaved} />
                    {/* P2 */}
                    <EditableCell {...cellProps} field="p2" value={p2} onSaved={onSaved} />
                    {/* Média Provas (readonly) */}
                    <td className="px-2 py-2 border-b border-r border-border text-center font-mono font-semibold">
                      <span className={gradeColor(mediaProvas)}>{fmt(mediaProvas)}</span>
                    </td>
                    {/* Kahoots */}
                    {([1,2,3,4] as const).map(n => (
                      <EditableCell key={n} {...cellProps} field={`kahoot_${n}` as GradeField} value={g(`kahoot_${n}` as GradeField)} onSaved={onSaved} />
                    ))}
                    {/* Média Kahoots */}
                    <td className="px-2 py-2 border-b border-r border-border text-center font-mono font-semibold">
                      <span className={gradeColor(mediaKs)}>{fmt(mediaKs)}</span>
                    </td>
                    {/* Casos Clínicos — nota única (mesmo campo jigsaw_fase3, calculado
                        automaticamente pelo campeonato; editável manualmente se preciso) */}
                    <EditableCell {...cellProps} field="jigsaw_fase3" value={notaCasosClinicos} onSaved={onSaved} />
                    {/* Jigsaw F1 */}
                    <EditableCell {...cellProps} field="jigsaw_fase1" value={g("jigsaw_fase1")} onSaved={onSaved} />
                    {/* Jigsaw F2 */}
                    <EditableCell {...cellProps} field="jigsaw_fase2" value={g("jigsaw_fase2")} onSaved={onSaved} />
                    {/* Jigsaw Total */}
                    <EditableCell {...cellProps} field="jigsaw_total" value={g("jigsaw_total")} onSaved={onSaved} />
                    {/* Nota Atividades */}
                    <td className="px-2 py-2 border-b border-r border-border text-center font-mono font-bold">
                      <span className={gradeColor(notaAtiv)}>{fmt(notaAtiv, 2)}</span>
                    </td>
                    {/* Média Final */}
                    <td className="px-2 py-2 border-b border-r border-border text-center font-mono font-bold text-sm">
                      {media !== null ? (
                        <span className={media >= weights.minPassGrade ? "text-emerald-400" : "text-red-400"}>
                          {media.toFixed(2)}
                        </span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    {/* Prova Final */}
                    <td className="px-2 py-2 border-b border-border text-center">
                      {media === null ? <span className="text-muted-foreground text-[10px]">—</span> :
                        needsFinal ? (
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

      {/* Legenda */}
      {selectedClassId && !isLoading && filteredRows.length > 0 && (
        <div className="flex flex-wrap gap-4 text-[11px] text-muted-foreground pt-1">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block" /> P1/P2 = Provas (0–10) · peso {weights.pesoProvas}</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" /> Kahoot 1–4 = 2,5 pts cada</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-orange-400 inline-block" /> Casos Clínicos = nota única (0-10), automática pelo campeonato</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-purple-400 inline-block" /> Jigsaw Total (0–10)</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-violet-400 inline-block" /> Nota Atividades = média(Kahoots, Casos, Jigsaw) · peso {weights.pesoAtividades}</span>
          <span className="flex items-center gap-1.5 text-primary">✏️ Clique em qualquer célula para editar — salva automaticamente</span>
        </div>
      )}
    </div>
  );
}