/**
 * AdminJigsawPanel — Painel completo de gerenciamento do Seminário Jigsaw
 * Fase 1: Grupos Especialistas (visualização + notas)
 * Fase 2: Grupos Mosaico (lançamento de notas: apresentação + participação + avaliação por pares)
 * Notificações: Envio em massa para todos os alunos
 * Exportação PDF dos grupos
 */
import { useState, useMemo, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, ChevronDown, ChevronUp, Save, Loader2,
  Bell, Shuffle, CheckCircle2, BookOpen,
  RefreshCw, Trash2, Eye, EyeOff, Search, FlaskConical,
  Puzzle, GraduationCap, FileDown, Calculator
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── Color palette for groups ───
const GROUP_COLORS = [
  { accent: "#10b981", light: "oklch(0.696 0.17 162.48 / 0.15)" },
  { accent: "#6366f1", light: "oklch(0.585 0.233 277.12 / 0.15)" },
  { accent: "#f59e0b", light: "oklch(0.769 0.188 70.08 / 0.15)" },
  { accent: "#ec4899", light: "oklch(0.656 0.241 354.31 / 0.15)" },
  { accent: "#06b6d4", light: "oklch(0.715 0.143 215.22 / 0.15)" },
  { accent: "#ef4444", light: "oklch(0.637 0.237 25.33 / 0.15)" },
];

// ─── Score input component ───
function ScoreInput({ label, value, max, onChange, color }: {
  label: string; value: number; max: number; onChange: (v: number) => void; color: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">{label}</span>
      <div className="flex gap-1 flex-wrap">
        {Array.from({ length: max + 1 }, (_, i) => (
          <button key={i} onClick={() => onChange(i)}
            className="w-7 h-7 rounded text-xs font-mono font-bold transition-all"
            style={{
              backgroundColor: value === i ? color : "oklch(0.245 0.03 264.052)",
              color: value === i ? "#fff" : "oklch(0.7 0.02 264)",
              border: `1px solid ${value === i ? color : "oklch(0.35 0.03 264.052)"}`,
            }}>
            {i}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Expert Group Card ───
function ExpertGroupCard({ group, index, onScoresSaved }: {
  group: any; index: number; onScoresSaved: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showScoring, setShowScoring] = useState(false);
  const [scores, setScores] = useState<Record<number, { presentation: number; participation: number }>>({});
  const [search, setSearch] = useState("");
  const color = GROUP_COLORS[index % GROUP_COLORS.length];
  const utils = trpc.useUtils();

  const { data: existingScores } = trpc.jigsawComplete.expertGroups.getScores.useQuery(
    { expertGroupId: group.id }, { enabled: showScoring }
  );

  const scoreMutation = trpc.jigsawComplete.expertGroups.scorePresentation.useMutation({
    onSuccess: () => {
      toast.success(`Notas do ${group.name} salvas!`);
      utils.jigsawComplete.expertGroups.getByClass.invalidate();
      setShowScoring(false); setScores({}); onScoresSaved();
    },
    onError: (e) => toast.error(e.message || "Erro ao salvar notas"),
  });

  const filteredMembers = useMemo(() =>
    (group.members || []).filter((m: any) => !search || m.name?.toLowerCase().includes(search.toLowerCase())),
    [group.members, search]
  );

  const handleSaveScores = () => {
    const arr = Object.entries(scores).map(([memberId, s]) => ({
      memberId: Number(memberId),
      presentationScore: s.presentation,
      participationScore: s.participation,
    }));
    if (arr.length === 0) { toast.error("Preencha ao menos uma nota."); return; }
    scoreMutation.mutate({ expertGroupId: group.id, scores: arr });
  };

  const isCompleted = group.status === "completed";

  return (
    <motion.div layout className="rounded-xl overflow-hidden border"
      style={{ borderColor: isCompleted ? color.accent + "60" : "oklch(0.35 0.03 264.052)", backgroundColor: "oklch(0.195 0.03 264.052)" }}
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.06 }}>
      <div className="p-4 cursor-pointer" style={{ backgroundColor: isCompleted ? color.light : "transparent" }}
        onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold shrink-0"
            style={{ backgroundColor: color.accent + "22", color: color.accent }}>{index + 1}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-foreground text-sm">{group.name}</span>
              {isCompleted && <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                style={{ backgroundColor: color.accent + "20", color: color.accent }}>✓ Notas lançadas</span>}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{group.topicTitle}</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right hidden sm:block">
              <div className="font-mono font-bold text-sm" style={{ color: color.accent }}>{group.members?.length || 0}</div>
              <div className="text-[10px] text-muted-foreground">alunos</div>
            </div>
            {expanded ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
          </div>
        </div>
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
            <div className="border-t px-4 pb-4 pt-3 space-y-3" style={{ borderColor: "oklch(0.3 0.03 264.052)" }}>
              <div className="flex items-start gap-2 p-3 rounded-lg" style={{ backgroundColor: color.light }}>
                <BookOpen size={14} style={{ color: color.accent }} className="mt-0.5 shrink-0" />
                <div><span className="text-xs font-semibold" style={{ color: color.accent }}>Tema: </span>
                  <span className="text-xs text-foreground">{group.topicTitle}</span></div>
              </div>
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type="text" placeholder="Buscar aluno..." value={search} onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md bg-background border border-border text-foreground" />
              </div>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {filteredMembers.map((member: any, mIdx: number) => {
                  const existing = existingScores?.find((s: any) => s.memberId === member.id);
                  const current = scores[member.id];
                  const hasScore = existing?.presentationScore != null;
                  return (
                    <div key={member.id} className="flex items-center gap-2 px-3 py-2 rounded-md"
                      style={{ backgroundColor: "oklch(0.22 0.03 264.052)" }}>
                      <span className="text-[10px] text-muted-foreground font-mono w-5 text-center">{mIdx + 1}</span>
                      <span className="flex-1 text-xs text-foreground truncate">{member.name}</span>
                      {hasScore && !showScoring && (
                        <span className="text-[10px] font-mono" style={{ color: color.accent }}>
                          {Number(existing.presentationScore).toFixed(1)} + {Number(existing.participationScore).toFixed(1)}
                        </span>
                      )}
                      {showScoring && (
                        <div className="flex gap-3 items-center">
                          <ScoreInput label="Apres." value={current?.presentation ?? (existing ? Number(existing.presentationScore) : 0)} max={5}
                            onChange={(v) => setScores(prev => ({ ...prev, [member.id]: { ...prev[member.id], presentation: v, participation: prev[member.id]?.participation ?? 0 } }))} color={color.accent} />
                          <ScoreInput label="Part." value={current?.participation ?? (existing ? Number(existing.participationScore) : 0)} max={2}
                            onChange={(v) => setScores(prev => ({ ...prev, [member.id]: { ...prev[member.id], participation: v, presentation: prev[member.id]?.presentation ?? 0 } }))} color={color.accent} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-2 pt-1">
                <Button size="sm" variant="outline" className="flex-1 text-xs gap-1.5" onClick={() => setShowScoring(!showScoring)}>
                  {showScoring ? <EyeOff size={13} /> : <Eye size={13} />}
                  {showScoring ? "Ocultar notas" : "Lançar notas"}
                </Button>
                {showScoring && (
                  <Button size="sm" className="flex-1 text-xs gap-1.5" style={{ backgroundColor: color.accent }}
                    onClick={handleSaveScores} disabled={scoreMutation.isPending}>
                    {scoreMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                    Salvar notas
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Home Group Card (Fase 2) with scoring ───
function HomeGroupCard({ group, index, onScoresSaved }: {
  group: any; index: number; onScoresSaved: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showScoring, setShowScoring] = useState(false);
  const [scores, setScores] = useState<Record<number, { presentation: number; participation: number; peer: number }>>({});
  const color = GROUP_COLORS[index % GROUP_COLORS.length];
  const utils = trpc.useUtils();

  const { data: existingScores } = trpc.jigsawComplete.homeGroups.getScores.useQuery(
    { homeGroupId: group.id }, { enabled: showScoring }
  );

  const scoreMutation = trpc.jigsawComplete.homeGroups.scoreParticipation.useMutation({
    onSuccess: () => {
      toast.success(`Notas do ${group.name} salvas!`);
      utils.jigsawComplete.homeGroups.getByClass.invalidate();
      setShowScoring(false); setScores({}); onScoresSaved();
    },
    onError: (e) => toast.error(e.message || "Erro ao salvar notas"),
  });

  const handleSaveScores = () => {
    const arr = Object.entries(scores).map(([memberId, s]) => ({
      memberId: Number(memberId),
      presentationScore: s.presentation,
      participationScore: s.participation,
      peerRating: s.peer,
    }));
    if (arr.length === 0) { toast.error("Preencha ao menos uma nota."); return; }
    scoreMutation.mutate({ homeGroupId: group.id, scores: arr });
  };

  const isCompleted = group.status === "completed";
  const memberCount = group.members?.length || 0;

  return (
    <motion.div className="rounded-xl border overflow-hidden"
      style={{ borderColor: isCompleted ? color.accent + "60" : "oklch(0.35 0.03 264.052)", backgroundColor: "oklch(0.195 0.03 264.052)" }}
      initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: index * 0.04 }}>
      <div className="p-3 cursor-pointer flex items-center gap-3" onClick={() => setExpanded(!expanded)}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0"
          style={{ backgroundColor: color.accent + "22", color: color.accent }}>{index + 1}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">{group.name}</span>
            {isCompleted && <span className="text-[10px] px-1.5 py-0.5 rounded-full"
              style={{ backgroundColor: color.accent + "20", color: color.accent }}>✓</span>}
          </div>
          <p className="text-xs text-muted-foreground">{memberCount} especialistas</p>
        </div>
        {expanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="border-t px-3 pb-3 pt-2 space-y-2" style={{ borderColor: "oklch(0.3 0.03 264.052)" }}>
              {/* Members list */}
              <div className="space-y-1 max-h-72 overflow-y-auto">
                {(group.members || []).map((m: any, mIdx: number) => {
                  const existing = existingScores?.find((s: any) => s.memberId === m.id);
                  const current = scores[m.id];
                  const topicColor = GROUP_COLORS[mIdx % GROUP_COLORS.length];
                  return (
                    <div key={m.id} className="rounded px-2 py-2 space-y-1.5"
                      style={{ backgroundColor: "oklch(0.22 0.03 264.052)" }}>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground font-mono w-4">{mIdx + 1}</span>
                        <span className="flex-1 text-xs text-foreground truncate font-medium">{m.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded text-white truncate max-w-[110px]"
                          style={{ backgroundColor: topicColor.accent + "cc" }}>
                          {m.topicName?.split(" ").slice(0, 3).join(" ")}
                        </span>
                      </div>
                      {/* Scores display or input */}
                      {!showScoring && existing && (
                        <div className="flex gap-3 pl-6 text-[10px] text-muted-foreground">
                          <span>Apres: <strong style={{ color: color.accent }}>{Number(existing.presentationScore).toFixed(1)}</strong></span>
                          <span>Part: <strong style={{ color: color.accent }}>{Number(existing.participationScore).toFixed(1)}</strong></span>
                          <span>Pares: <strong style={{ color: color.accent }}>{Number(existing.peerRating).toFixed(1)}</strong></span>
                          <span>Total: <strong style={{ color: color.accent }}>{(Number(existing.presentationScore) + Number(existing.participationScore) + Number(existing.peerRating)).toFixed(1)}</strong></span>
                        </div>
                      )}
                      {showScoring && (
                        <div className="pl-6 flex gap-2 flex-wrap">
                          <ScoreInput label="Apres.(0-5)" value={current?.presentation ?? (existing ? Number(existing.presentationScore) : 0)} max={5}
                            onChange={(v) => setScores(prev => ({ ...prev, [m.id]: { ...prev[m.id], presentation: v, participation: prev[m.id]?.participation ?? 0, peer: prev[m.id]?.peer ?? 0 } }))} color={color.accent} />
                          <ScoreInput label="Part.(0-2)" value={current?.participation ?? (existing ? Number(existing.participationScore) : 0)} max={2}
                            onChange={(v) => setScores(prev => ({ ...prev, [m.id]: { ...prev[m.id], participation: v, presentation: prev[m.id]?.presentation ?? 0, peer: prev[m.id]?.peer ?? 0 } }))} color={color.accent} />
                          <ScoreInput label="Pares(0-5)" value={current?.peer ?? (existing ? Number(existing.peerRating) : 0)} max={5}
                            onChange={(v) => setScores(prev => ({ ...prev, [m.id]: { ...prev[m.id], peer: v, presentation: prev[m.id]?.presentation ?? 0, participation: prev[m.id]?.participation ?? 0 } }))} color={color.accent} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {/* Action buttons */}
              <div className="flex gap-2 pt-1">
                <Button size="sm" variant="outline" className="flex-1 text-xs gap-1.5" onClick={() => setShowScoring(!showScoring)}>
                  {showScoring ? <EyeOff size={13} /> : <Eye size={13} />}
                  {showScoring ? "Ocultar notas" : "Lançar notas"}
                </Button>
                {showScoring && (
                  <Button size="sm" className="flex-1 text-xs gap-1.5" style={{ backgroundColor: color.accent }}
                    onClick={handleSaveScores} disabled={scoreMutation.isPending}>
                    {scoreMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                    Salvar notas
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── PDF Export function ───
function exportGroupsPDF(expertGroups: any[], homeGroups: any[]) {
  const now = new Date().toLocaleDateString("pt-BR");
  let html = `
    <html><head><meta charset="utf-8">
    <style>
      body { font-family: Arial, sans-serif; font-size: 11px; color: #1a1a2e; margin: 20px; }
      h1 { font-size: 18px; color: #0d4f3c; margin-bottom: 4px; }
      h2 { font-size: 14px; color: #10b981; margin: 20px 0 8px; border-bottom: 2px solid #10b981; padding-bottom: 4px; }
      h3 { font-size: 12px; color: #1a1a2e; margin: 12px 0 4px; background: #f0fdf4; padding: 6px 8px; border-left: 3px solid #10b981; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
      th { background: #0d4f3c; color: white; padding: 5px 8px; text-align: left; font-size: 10px; }
      td { padding: 4px 8px; border-bottom: 1px solid #e5e7eb; font-size: 10px; }
      tr:nth-child(even) td { background: #f9fafb; }
      .badge { display: inline-block; padding: 2px 6px; border-radius: 10px; font-size: 9px; font-weight: bold; }
      .topic { color: #6366f1; font-style: italic; }
      .page-break { page-break-before: always; }
      .footer { margin-top: 20px; font-size: 9px; color: #9ca3af; text-align: center; }
    </style></head><body>
    <h1>🧩 Seminário Jigsaw — Farmacologia I</h1>
    <p style="color:#6b7280;font-size:10px;">Gerado em ${now} · Conexão em Farmacologia</p>
    <h2>FASE 1 — Grupos Especialistas (${expertGroups.length} grupos)</h2>`;

  expertGroups.forEach((g, i) => {
    html += `<h3>${i + 1}. ${g.name}</h3>
    <p class="topic">Tema: ${g.topicTitle}</p>
    <table><tr><th>#</th><th>Aluno</th><th>Apres. (0-5)</th><th>Part. (0-2)</th><th>Total</th></tr>`;
    (g.members || []).forEach((m: any, mIdx: number) => {
      html += `<tr><td>${mIdx + 1}</td><td>${m.name}</td><td>—</td><td>—</td><td>—</td></tr>`;
    });
    html += `</table>`;
  });

  html += `<div class="page-break"></div>
    <h2>FASE 2 — Grupos Mosaico (${homeGroups.length} grupos)</h2>`;

  homeGroups.forEach((g, i) => {
    html += `<h3>${i + 1}. ${g.name}</h3>
    <table><tr><th>#</th><th>Aluno</th><th>Tema Especialista</th><th>Apres.</th><th>Part.</th><th>Pares</th><th>Total</th></tr>`;
    (g.members || []).forEach((m: any, mIdx: number) => {
      html += `<tr><td>${mIdx + 1}</td><td>${m.name}</td><td class="topic">${m.topicName || "—"}</td><td>—</td><td>—</td><td>—</td><td>—</td></tr>`;
    });
    html += `</table>`;
  });

  html += `<div class="footer">Conexão em Farmacologia · Seminário Jigsaw ${new Date().getFullYear()}</div></body></html>`;

  const win = window.open("", "_blank");
  if (win) {
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 500);
  }
}

// ─── Export CSV function ───
function exportGradesCSV(expertGroups: any[], homeGroups: any[]) {
  // Build a map of memberId -> all scores
  const memberMap: Record<number, {
    name: string;
    expertGroup: string;
    expertTopic: string;
    expertPresentation: number;
    expertParticipation: number;
    homeGroup: string;
    homeTopic: string;
    homePresentation: number;
    homeParticipation: number;
    homePeerRating: number;
    totalPF: number;
  }> = {};

  expertGroups.forEach((g: any) => {
    (g.members || []).forEach((m: any) => {
      if (!memberMap[m.id]) {
        memberMap[m.id] = {
          name: m.name,
          expertGroup: g.name,
          expertTopic: g.topicTitle || "",
          expertPresentation: Number(m.presentationScore) || 0,
          expertParticipation: Number(m.participationScore) || 0,
          homeGroup: "",
          homeTopic: "",
          homePresentation: 0,
          homeParticipation: 0,
          homePeerRating: 0,
          totalPF: 0,
        };
      } else {
        memberMap[m.id].expertGroup = g.name;
        memberMap[m.id].expertTopic = g.topicTitle || "";
        memberMap[m.id].expertPresentation = Number(m.presentationScore) || 0;
        memberMap[m.id].expertParticipation = Number(m.participationScore) || 0;
      }
    });
  });

  homeGroups.forEach((g: any) => {
    (g.members || []).forEach((m: any) => {
      if (!memberMap[m.id]) {
        memberMap[m.id] = {
          name: m.name,
          expertGroup: "",
          expertTopic: "",
          expertPresentation: 0,
          expertParticipation: 0,
          homeGroup: g.name,
          homeTopic: m.topicName || "",
          homePresentation: Number(m.presentationScore) || 0,
          homeParticipation: Number(m.participationScore) || 0,
          homePeerRating: Number(m.peerRating) || 0,
          totalPF: 0,
        };
      } else {
        memberMap[m.id].homeGroup = g.name;
        memberMap[m.id].homeTopic = m.topicName || "";
        memberMap[m.id].homePresentation = Number(m.presentationScore) || 0;
        memberMap[m.id].homeParticipation = Number(m.participationScore) || 0;
        memberMap[m.id].homePeerRating = Number(m.peerRating) || 0;
      }
    });
  });

  // Normalização das notas por fase:
  // Fase 1: (apres 0-5 + part 0-2 = máx 7 brutos) -> 0-2 pts
  // Fase 2: (apres 0-5 + part 0-2 + pares 0-5 = máx 12 brutos) -> 0-5 pts
  // Fase 3: Casos Clínicos (0-3 pts) - lançada separadamente pelo professor
  const memberMapWithPF = Object.entries(memberMap).reduce((acc, [id, m]) => {
    const fase1Raw = m.expertPresentation + m.expertParticipation; // máx 7
    const fase2Raw = m.homePresentation + m.homeParticipation + m.homePeerRating; // máx 12
    const fase1PF = fase1Raw > 0 ? Math.min(2, (fase1Raw / 7) * 2) : 0;
    const fase2PF = fase2Raw > 0 ? Math.min(5, (fase2Raw / 12) * 5) : 0;
    acc[Number(id)] = { ...m, fase1PF, fase2PF, totalPF: fase1PF + fase2PF };
    return acc;
  }, {} as Record<number, typeof memberMap[number] & { fase1PF: number; fase2PF: number }>);

  const header = [
    "Nome",
    "Grupo Especialista",
    "Tema Especialista",
    "Apres. Fase 1 (bruto 0-5)",
    "Part. Fase 1 (bruto 0-2)",
    "Fase 1 PF (0-2 pts)",
    "Grupo Mosaico",
    "Tema Ensinado",
    "Apres. Fase 2 (bruto 0-5)",
    "Part. Fase 2 (bruto 0-2)",
    "Aval. Pares (bruto 0-5)",
    "Fase 2 PF (0-5 pts)",
    "PF F1+F2 (sem Fase 3)",
    "Fase 3 PF (0-3 pts) - lan\u00e7ar separado",
    "PF Total Jigsaw (0-10 pts)",
  ].join(",");

  const rows = Object.values(memberMapWithPF)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((m) =>
      [
        `"${m.name}"`,
        `"${m.expertGroup}"`,
        `"${m.expertTopic}"`,
        m.expertPresentation.toFixed(1),
        m.expertParticipation.toFixed(1),
        m.fase1PF.toFixed(2),
        `"${m.homeGroup}"`,
        `"${m.homeTopic}"`,
        m.homePresentation.toFixed(1),
        m.homeParticipation.toFixed(1),
        m.homePeerRating.toFixed(1),
        m.fase2PF.toFixed(2),
        m.totalPF.toFixed(2),
        "0.00",
        m.totalPF.toFixed(2),
      ].join(",")
    );

  const csv = [header, ...rows].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `jigsaw_notas_${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Main Component ───
export default function AdminJigsawPanel({ teacherToken }: { teacherToken?: string }) {
  const [activePhase, setActivePhase] = useState<"fase1" | "fase2">("fase1");
  const [classId, setClassId] = useState<number | null>(null);

  // Buscar lista de turmas para seleção
  const { data: classesList = [], error: classesError } = trpc.classes.list.useQuery(
    { sessionToken: teacherToken || "" },
    { enabled: !!teacherToken && teacherToken.length > 10, retry: false }
  );
  const utils = trpc.useUtils();

  const { data: expertGroups = [], isLoading: loadingExpert, refetch: refetchExpert } =
    trpc.jigsawComplete.expertGroups.getByClass.useQuery(
      { classId: classId! },
      { enabled: classId !== null }
    );

  const { data: homeGroups = [], isLoading: loadingHome, refetch: refetchHome } =
    trpc.jigsawComplete.homeGroups.getByClass.useQuery(
      { classId: classId! },
      { enabled: classId !== null }
    );

  const notifyMutation = trpc.jigsawComplete.notifyAllGroups.useMutation({
    onSuccess: (data) => toast.success(`✅ ${data.totalNotified} alunos notificados!`),
    onError: (e) => toast.error(e.message || "Erro ao enviar notificações"),
  });

  const generateHomeMutation = trpc.jigsawComplete.generateHomeGroups.useMutation({
    onSuccess: (data) => {
      toast.success(`🎉 ${data.totalHomeGroups} grupos mosaico criados!`);
      refetchHome(); setActivePhase("fase2");
    },
    onError: (e) => toast.error(e.message || "Erro ao gerar grupos mosaico"),
  });

  const deleteHomeMutation = trpc.jigsawComplete.deleteHomeGroups.useMutation({
    onSuccess: (data) => { toast.success(`${data.deleted} grupos mosaico removidos.`); refetchHome(); },
    onError: (e) => toast.error(e.message || "Erro ao deletar grupos"),
  });

  const calcTotalsMutation = trpc.jigsawComplete.calculateAllTotals.useMutation({
    onSuccess: (data) => toast.success(`PF Jigsaw calculado para ${data.updated} alunos!`),
    onError: (e) => toast.error(e.message || "Erro ao calcular totais"),
  });

  const completedExpert = expertGroups.filter((g: any) => g.status === "completed").length;
  const completedHome = homeGroups.filter((g: any) => g.status === "completed").length;
  const totalMembers = expertGroups.reduce((sum: number, g: any) => sum + (g.members?.length || 0), 0);

  // Seletor de turma: se nenhuma turma selecionada, mostrar grade de turmas
  if (classId === null) {
    if (classesError) {
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Puzzle size={20} className="text-primary" />
            <h2 className="font-display font-bold text-xl text-foreground">Seminário Jigsaw</h2>
          </div>
          <div className="p-4 rounded-lg border border-destructive/30 bg-destructive/10 text-sm text-destructive">
            Erro ao carregar turmas. Verifique se você está autenticado como professor.
          </div>
        </div>
      );
    }
    return (
      <div className="space-y-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Puzzle size={20} className="text-primary" />
            <h2 className="font-display font-bold text-xl text-foreground">Seminário Jigsaw</h2>
          </div>
          <p className="text-sm text-muted-foreground">Selecione uma turma para gerenciar os grupos Jigsaw</p>
        </div>
        {(classesList as any[]).length === 0 && (
          <div className="p-4 rounded-lg border border-border text-sm text-muted-foreground">
            Carregando turmas...
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
          {(classesList as any[]).map((cls: any) => (
            <button
              key={cls.id}
              onClick={() => setClassId(cls.id)}
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

  const selectedClassData = (classesList as any[]).find((c: any) => c.id === classId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <button onClick={() => setClassId(null)} className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 mb-1">
            ← Voltar às turmas
          </button>
          <div className="flex items-center gap-2 mb-1">
            <Puzzle size={20} className="text-primary" />
            <h2 className="font-display font-bold text-xl text-foreground">Seminário Jigsaw — {selectedClassData?.name || "Turma"}</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Grupos especialistas (Fase 1), grupos mosaico (Fase 2), notas e notificações.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="gap-2"
            onClick={() => exportGroupsPDF(expertGroups, homeGroups)}
            disabled={expertGroups.length === 0}>
            <FileDown size={14} /> Exportar PDF
          </Button>
          <Button variant="outline" size="sm" className="gap-2"
            onClick={() => exportGradesCSV(expertGroups, homeGroups)}
            disabled={expertGroups.length === 0}
            title="Exportar notas de todos os alunos em CSV">
            <FileDown size={14} /> Exportar CSV
          </Button>
          <Button variant="outline" size="sm" className="gap-2"
            onClick={() => calcTotalsMutation.mutate({ classId, sessionToken: teacherToken || "" })}
            disabled={calcTotalsMutation.isPending}>
            {calcTotalsMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Calculator size={14} />}
            Calcular PF
          </Button>
          <Button variant="outline" size="sm" className="gap-2"
            onClick={() => notifyMutation.mutate({ classId, sessionToken: teacherToken || "" })}
            disabled={notifyMutation.isPending || expertGroups.length === 0}>
            {notifyMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Bell size={14} />}
            Notificar alunos
          </Button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: <Users size={16} />, label: "Grupos Especialistas", value: expertGroups.length.toString(), color: "#10b981" },
          { icon: <GraduationCap size={16} />, label: "Alunos alocados", value: totalMembers.toString(), color: "#6366f1" },
          { icon: <CheckCircle2 size={16} />, label: "Fase 1 com notas", value: `${completedExpert}/${expertGroups.length}`, color: "#f59e0b" },
          { icon: <Shuffle size={16} />, label: "Fase 2 com notas", value: `${completedHome}/${homeGroups.length}`, color: "#ec4899" },
        ].map((stat, i) => (
          <div key={i} className="rounded-lg p-3 border"
            style={{ backgroundColor: "oklch(0.195 0.03 264.052)", borderColor: "oklch(0.3 0.03 264.052)" }}>
            <div className="flex items-center gap-1.5 mb-1" style={{ color: stat.color }}>
              {stat.icon}
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">{stat.label}</span>
            </div>
            <div className="font-mono font-bold text-xl text-foreground">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Phase tabs */}
      <div className="flex gap-1 p-1 rounded-lg w-fit" style={{ backgroundColor: "oklch(0.22 0.03 264.052)" }}>
        {[
          { key: "fase1" as const, label: "Fase 1 — Especialistas", icon: <FlaskConical size={14} /> },
          { key: "fase2" as const, label: "Fase 2 — Mosaico", icon: <Shuffle size={14} /> },
        ].map((tab) => (
          <button key={tab.key} onClick={() => setActivePhase(tab.key)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all"
            style={{
              backgroundColor: activePhase === tab.key ? "oklch(0.696 0.17 162.48)" : "transparent",
              color: activePhase === tab.key ? "#fff" : "oklch(0.7 0.02 264)",
            }}>
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      {/* ── FASE 1 ── */}
      {activePhase === "fase1" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm text-foreground">{expertGroups.length} grupos especialistas</h3>
            <button onClick={() => refetchExpert()} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground"><RefreshCw size={14} /></button>
          </div>
          {loadingExpert ? (
            <div className="flex items-center justify-center py-12"><Loader2 size={24} className="animate-spin text-primary" /></div>
          ) : expertGroups.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Puzzle size={32} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">Nenhum grupo especialista encontrado.</p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {expertGroups.map((group: any, idx: number) => (
                <ExpertGroupCard key={group.id} group={group} index={idx} onScoresSaved={() => refetchExpert()} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── FASE 2 ── */}
      {activePhase === "fase2" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="font-semibold text-sm text-foreground">
                {homeGroups.length > 0 ? `${homeGroups.length} grupos mosaico` : "Nenhum grupo mosaico criado"}
              </h3>
              {homeGroups.length > 0 && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Notas brutas: Apres. (0–5) + Part. (0–2) + Pares (0–5) = máx. 12 brutos → normalizado para <strong>0–5 pts (Fase 2)</strong>. Após lançar, clique em <strong>Calcular PF</strong>.
                </p>
              )}
            </div>
            <div className="flex gap-2">
              {homeGroups.length > 0 && (
                <Button size="sm" variant="outline" className="gap-1.5 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => { if (confirm(`Deletar todos os ${homeGroups.length} grupos mosaico?`)) deleteHomeMutation.mutate({ classId, sessionToken: teacherToken || "" }); }}
                  disabled={deleteHomeMutation.isPending}>
                  {deleteHomeMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                  Deletar grupos
                </Button>
              )}
              <Button size="sm" className="gap-1.5 text-xs" style={{ backgroundColor: "#ec4899" }}
                onClick={() => generateHomeMutation.mutate({ classId, sessionToken: teacherToken || "" })}
                disabled={generateHomeMutation.isPending || homeGroups.length > 0}>
                {generateHomeMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Shuffle size={13} />}
                Gerar grupos mosaico
              </Button>
            </div>
          </div>

          {homeGroups.length === 0 ? (
            <div className="rounded-xl border p-8 text-center"
              style={{ borderColor: "oklch(0.35 0.03 264.052)", backgroundColor: "oklch(0.195 0.03 264.052)" }}>
              <Shuffle size={36} className="mx-auto mb-3 text-muted-foreground opacity-40" />
              <p className="text-sm font-medium text-foreground mb-1">Grupos Mosaico não gerados</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto mb-4">
                Cada grupo mosaico reúne 1 especialista de cada tema (6 alunos por grupo), criando ~14 grupos. Fase 2 vale <strong>5 pts</strong> (normalizado de máx. 12 brutos).
              </p>
              <Button size="sm" className="gap-2" style={{ backgroundColor: "#ec4899" }}
                onClick={() => generateHomeMutation.mutate({ classId, sessionToken: teacherToken || "" })} disabled={generateHomeMutation.isPending}>
                {generateHomeMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Shuffle size={14} />}
                Gerar grupos mosaico agora
              </Button>
            </div>
          ) : loadingHome ? (
            <div className="flex items-center justify-center py-12"><Loader2 size={24} className="animate-spin text-primary" /></div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {homeGroups.map((group: any, idx: number) => (
                <HomeGroupCard key={group.id} group={group} index={idx} onScoresSaved={() => refetchHome()} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
