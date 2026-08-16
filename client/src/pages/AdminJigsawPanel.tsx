/**
 * AdminJigsawPanel — Painel do Seminário Pôster + Quiz
 *
 * Fase 1 — Pôster e Perguntas: cada grupo apresenta um artigo em formato de
 *   pôster e elabora 5 perguntas com gabarito. O professor revisa (podendo
 *   ajustar enunciado/alternativas), aprova ou rejeita, e lança a nota do
 *   pôster por um checklist de critérios.
 * Fase 2 — Quiz e Notas: depois que o grupo apresenta, o professor libera as
 *   perguntas aprovadas por uma janela de tempo. A turma responde
 *   individualmente (alternativas embaralhadas por aluno, gabarito só depois
 *   que a janela expira). A nota final de Seminário combina a nota do pôster
 *   com o desempenho individual respondendo — calculada automaticamente pelo
 *   back-end (seminarioPoster.ts) e refletida em jigsawScores.totalJigsawPF.
 *
 * Não existe mais "Fase 3" aqui — Casos Clínicos agora é uma dinâmica própria
 * (liga de pontos corridos), fora do Jigsaw.
 */
import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import {
  Puzzle, Users, ChevronDown, ChevronUp, Loader2, Save,
  CheckCircle2, XCircle, Clock, Unlock, Edit3, X, FileText,
  ClipboardCheck, GraduationCap, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const GROUP_COLORS = [
  { accent: "#10b981", light: "oklch(0.696 0.17 162.48 / 0.15)" },
  { accent: "#6366f1", light: "oklch(0.585 0.233 277.12 / 0.15)" },
  { accent: "#f59e0b", light: "oklch(0.769 0.188 70.08 / 0.15)" },
  { accent: "#ec4899", light: "oklch(0.656 0.241 354.31 / 0.15)" },
  { accent: "#06b6d4", light: "oklch(0.715 0.143 215.22 / 0.15)" },
  { accent: "#ef4444", light: "oklch(0.637 0.237 25.33 / 0.15)" },
];

const CARD_BG = "oklch(0.195 0.03 264.052)";
const CARD_BORDER = "oklch(0.3 0.03 264.052)";

const CRITERIOS_LABEL: Record<string, string> = {
  posterClaro: "Pôster claro e bem organizado",
  achadoCorreto: "Identificou corretamente o principal achado do artigo",
  relevanciaClinica: "Explicou a relevância clínica do achado",
  perguntasBemFormuladas: "As 5 perguntas estão bem formuladas",
  gabaritoCorreto: "O gabarito enviado está correto",
};
const CRITERIOS_PADRAO = Object.keys(CRITERIOS_LABEL);

function fmtData(d: string | Date | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

// ─── Cartão de revisão de UMA pergunta (Fase 1) ───
function PerguntaReviewCard({ pergunta, teacherToken, onChanged }: { pergunta: any; teacherToken: string; onChanged: () => void }) {
  const [editando, setEditando] = useState(false);
  const [enunciado, setEnunciado] = useState(pergunta.enunciado);
  const [alternativas, setAlternativas] = useState<{ id: string; texto: string; correta: boolean }[]>(pergunta.alternativas);

  const revisar = trpc.seminarioPoster.revisarPergunta.useMutation({
    onSuccess: () => { toast.success("Pergunta atualizada!"); onChanged(); },
    onError: (e) => toast.error(e.message || "Erro ao revisar pergunta"),
  });

  const aprovar = () => {
    const numCorretas = alternativas.filter(a => a.correta).length;
    if (numCorretas !== 1) { toast.error("Precisa ter exatamente 1 alternativa correta"); return; }
    revisar.mutate({
      sessionToken: teacherToken, questionId: pergunta.id, decisao: "approved",
      enunciadoAjustado: editando ? enunciado : undefined,
      alternativasAjustadas: editando ? alternativas : undefined,
    });
  };
  const rejeitar = () => {
    if (!confirm("Rejeitar esta pergunta? O grupo precisará escrever outra.")) return;
    revisar.mutate({ sessionToken: teacherToken, questionId: pergunta.id, decisao: "rejected" });
  };

  return (
    <div className="rounded-lg border p-3 space-y-2" style={{ backgroundColor: "oklch(0.22 0.03 264.052)", borderColor: CARD_BORDER }}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-[10px] font-mono uppercase tracking-wide text-muted-foreground">{pergunta.topico}</span>
        <button onClick={() => setEditando(v => !v)} className="text-[10px] text-primary flex items-center gap-1 hover:underline shrink-0">
          <Edit3 size={11} /> {editando ? "Cancelar edição" : "Ajustar"}
        </button>
      </div>

      {editando ? (
        <textarea value={enunciado} onChange={e => setEnunciado(e.target.value)}
          className="w-full text-sm bg-transparent border border-border rounded p-2 text-foreground" rows={2} />
      ) : (
        <p className="text-sm text-foreground">{pergunta.enunciado}</p>
      )}

      <div className="space-y-1">
        {alternativas.map((a, i) => (
          <div key={a.id} className="flex items-center gap-2">
            <button
              onClick={() => setAlternativas(prev => prev.map((x, j) => ({ ...x, correta: j === i })))}
              disabled={!editando}
              className="w-4 h-4 rounded-full border shrink-0 flex items-center justify-center"
              style={{ borderColor: a.correta ? "#10b981" : "oklch(0.4 0.03 264)" }}
              title={editando ? "Marcar como correta" : undefined}
            >
              {a.correta && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: "#10b981" }} />}
            </button>
            {editando ? (
              <input value={a.texto}
                onChange={e => setAlternativas(prev => prev.map((x, j) => j === i ? { ...x, texto: e.target.value } : x))}
                className="flex-1 text-xs bg-transparent border border-border rounded px-2 py-1 text-foreground" />
            ) : (
              <span className={`text-xs ${a.correta ? "text-emerald-400 font-medium" : "text-muted-foreground"}`}>{a.texto}</span>
            )}
          </div>
        ))}
      </div>

      {pergunta.status === "pending_review" ? (
        <div className="flex gap-2 pt-1">
          <Button size="sm" className="flex-1 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700" onClick={aprovar} disabled={revisar.isPending}>
            {revisar.isPending ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />} Aprovar
          </Button>
          <Button size="sm" variant="outline" className="flex-1 text-xs gap-1.5 text-destructive border-destructive/40" onClick={rejeitar} disabled={revisar.isPending}>
            <XCircle size={13} /> Rejeitar
          </Button>
        </div>
      ) : (
        <span className={`text-[10px] font-medium ${pergunta.status === "approved" ? "text-emerald-400" : "text-destructive"}`}>
          {pergunta.status === "approved" ? "✓ Aprovada" : "✕ Rejeitada"}
        </span>
      )}
    </div>
  );
}

// ─── Cartão de grupo — Fase 1 (perguntas + nota do pôster) ───
function GrupoFase1Card({ group, index, perguntasDoGrupo, teacherToken, classId, alunosSemGrupo, onChanged }: {
  group: any; index: number; perguntasDoGrupo: any[]; teacherToken: string; classId: number;
  alunosSemGrupo: { id: number; name: string }[]; onChanged: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [checklist, setChecklist] = useState<Record<string, boolean>>(
    Object.fromEntries(CRITERIOS_PADRAO.map(c => [c, false]))
  );
  const [observacoes, setObservacoes] = useState("");
  const [alunoParaAdicionar, setAlunoParaAdicionar] = useState<number | "">("");
  const color = GROUP_COLORS[index % GROUP_COLORS.length];

  const pendentes = perguntasDoGrupo.filter(p => p.status === "pending_review");
  const aprovadas = perguntasDoGrupo.filter(p => p.status === "approved");

  const lancarNota = trpc.seminarioPoster.lancarNotaPoster.useMutation({
    onSuccess: (data) => { toast.success(`Nota do pôster salva: ${data.notaPoster}`); onChanged(); },
    onError: (e) => toast.error(e.message || "Erro ao salvar nota"),
  });

  const adicionarAluno = trpc.teacherAuth.adicionarAlunosAoGrupoSeminario.useMutation({
    onSuccess: () => { toast.success("Aluno adicionado ao grupo!"); setAlunoParaAdicionar(""); onChanged(); },
    onError: (e) => toast.error(e.message || "Erro ao adicionar aluno"),
  });
  const removerAluno = trpc.teacherAuth.removerAlunoDoGrupoSeminario.useMutation({
    onSuccess: () => { toast.success("Aluno removido do grupo"); onChanged(); },
    onError: (e) => toast.error(e.message || "Erro ao remover aluno"),
  });

  const salvarNota = () => {
    lancarNota.mutate({ sessionToken: teacherToken, classId, groupId: group.id, checklist, observacoes: observacoes || undefined });
  };

  return (
    <motion.div layout className="rounded-xl border overflow-hidden" style={{ backgroundColor: CARD_BG, borderColor: CARD_BORDER }}>
      <button onClick={() => setExpanded(v => !v)} className="w-full flex items-center justify-between p-4 text-left">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: color.light, color: color.accent }}>
            <Users size={15} />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{group.name}</p>
            <p className="text-[11px] text-muted-foreground">{group.members?.length || 0} integrantes</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {pendentes.length > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: "oklch(0.769 0.188 70.08 / 0.2)", color: "#f59e0b" }}>
              {pendentes.length} pendente{pendentes.length > 1 ? "s" : ""}
            </span>
          )}
          {aprovadas.length > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: "oklch(0.696 0.17 162.48 / 0.2)", color: "#10b981" }}>
              {aprovadas.length} aprovada{aprovadas.length > 1 ? "s" : ""}
            </span>
          )}
          {expanded ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="px-4 pb-4 space-y-4 border-t" style={{ borderColor: CARD_BORDER }}>
              {/* Gerenciar alunos */}
              <div className="pt-3 space-y-2">
                <p className="text-xs font-semibold text-foreground flex items-center gap-1.5"><Users size={13} /> Alunos do grupo ({group.members?.length || 0})</p>
                {group.members?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {group.members.map((m: any) => (
                      <span key={m.id} className="text-[11px] pl-2 pr-1 py-1 rounded-full flex items-center gap-1"
                        style={{ backgroundColor: color.light, color: color.accent }}>
                        {m.name}
                        <button onClick={() => { if (confirm(`Remover ${m.name} do grupo?`)) removerAluno.mutate({ sessionToken: teacherToken, groupId: group.id, memberId: m.id }); }}
                          className="hover:opacity-70" title="Remover do grupo">
                          <X size={11} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <select value={alunoParaAdicionar} onChange={e => setAlunoParaAdicionar(e.target.value ? Number(e.target.value) : "")}
                    className="flex-1 text-xs bg-transparent border border-border rounded px-2 py-1.5 text-foreground">
                    <option value="" className="bg-background">
                      {alunosSemGrupo.length === 0 ? "Todos os alunos já têm grupo" : "Selecione um aluno sem grupo..."}
                    </option>
                    {alunosSemGrupo.map(a => <option key={a.id} value={a.id} className="bg-background">{a.name}</option>)}
                  </select>
                  <Button size="sm" className="text-xs gap-1.5 shrink-0" style={{ backgroundColor: color.accent }}
                    disabled={!alunoParaAdicionar || adicionarAluno.isPending}
                    onClick={() => alunoParaAdicionar && adicionarAluno.mutate({ sessionToken: teacherToken, groupId: group.id, memberIds: [alunoParaAdicionar] })}>
                    {adicionarAluno.isPending ? <Loader2 size={13} className="animate-spin" /> : "Adicionar"}
                  </Button>
                </div>
              </div>

              {/* Perguntas */}
              <div className="pt-3 space-y-2 border-t" style={{ borderColor: CARD_BORDER }}>
                <p className="text-xs font-semibold text-foreground flex items-center gap-1.5 pt-2"><FileText size={13} /> Perguntas ({perguntasDoGrupo.length}/5 enviadas)</p>
                {perguntasDoGrupo.length === 0 ? (
                  <p className="text-xs text-muted-foreground">O grupo ainda não enviou perguntas.</p>
                ) : (
                  <div className="space-y-2">
                    {perguntasDoGrupo.map(p => (
                      <PerguntaReviewCard key={p.id} pergunta={p} teacherToken={teacherToken} onChanged={onChanged} />
                    ))}
                  </div>
                )}
              </div>

              {/* Nota do pôster */}
              <div className="space-y-2 pt-2 border-t" style={{ borderColor: CARD_BORDER }}>
                <p className="text-xs font-semibold text-foreground flex items-center gap-1.5 pt-2"><ClipboardCheck size={13} /> Nota do pôster (checklist)</p>
                <div className="space-y-1.5">
                  {CRITERIOS_PADRAO.map(c => (
                    <label key={c} className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                      <input type="checkbox" checked={checklist[c]} onChange={e => setChecklist(prev => ({ ...prev, [c]: e.target.checked }))} />
                      {CRITERIOS_LABEL[c]}
                    </label>
                  ))}
                </div>
                <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Observações (opcional)"
                  className="w-full text-xs bg-transparent border border-border rounded p-2 text-foreground" rows={2} />
                <Button size="sm" className="text-xs gap-1.5" style={{ backgroundColor: color.accent }} onClick={salvarNota} disabled={lancarNota.isPending}>
                  {lancarNota.isPending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Salvar nota do pôster
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Cartão de grupo — Fase 2 (liberar quiz) ───
function GrupoFase2Card({ group, index, perguntasDoGrupo, teacherToken, classId, onChanged }: {
  group: any; index: number; perguntasDoGrupo: any[]; teacherToken: string; classId: number; onChanged: () => void;
}) {
  const [duracao, setDuracao] = useState(5);
  const color = GROUP_COLORS[index % GROUP_COLORS.length];
  const aprovadas = perguntasDoGrupo.filter(p => p.status === "approved");
  const agora = new Date();
  const jaLiberou = aprovadas.some(p => p.releasedAt);
  const janelaAberta = aprovadas.some(p => p.releasedAt && p.expiresAt && agora >= new Date(p.releasedAt) && agora < new Date(p.expiresAt));
  const janelaExpirada = jaLiberou && !janelaAberta;
  const expiraEm = aprovadas.find(p => p.expiresAt)?.expiresAt;

  const liberar = trpc.seminarioPoster.liberarPerguntasDoGrupo.useMutation({
    onSuccess: (data) => { toast.success(`${data.liberadas} perguntas liberadas por ${duracao} min!`); onChanged(); },
    onError: (e) => toast.error(e.message || "Erro ao liberar perguntas"),
  });

  return (
    <div className="rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between" style={{ backgroundColor: CARD_BG, borderColor: CARD_BORDER }}>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: color.light, color: color.accent }}>
          <Users size={15} />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">{group.name}</p>
          <p className="text-[11px] text-muted-foreground">
            {aprovadas.length} pergunta{aprovadas.length !== 1 ? "s" : ""} aprovada{aprovadas.length !== 1 ? "s" : ""}
            {janelaAberta && <span className="text-emerald-400"> · janela aberta até {fmtData(expiraEm)}</span>}
            {janelaExpirada && <span className="text-muted-foreground"> · janela encerrada em {fmtData(expiraEm)} (virou material de estudo)</span>}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {!janelaAberta && (
          <>
            <input type="number" min={1} max={60} value={duracao} onChange={e => setDuracao(Number(e.target.value))}
              className="w-16 text-xs text-center bg-transparent border border-border rounded px-1 py-1.5 text-foreground" />
            <span className="text-[10px] text-muted-foreground">min</span>
          </>
        )}
        <Button size="sm" className="text-xs gap-1.5" style={{ backgroundColor: color.accent }}
          onClick={() => liberar.mutate({ sessionToken: teacherToken, classId, groupId: group.id, duracaoMinutos: duracao })}
          disabled={liberar.isPending || aprovadas.length === 0 || janelaAberta}>
          {liberar.isPending ? <Loader2 size={13} className="animate-spin" /> : <Unlock size={13} />}
          {janelaAberta ? "Janela aberta" : janelaExpirada ? "Liberar de novo" : "Liberar perguntas"}
        </Button>
      </div>
    </div>
  );
}

export default function AdminJigsawPanel({ teacherToken }: { teacherToken?: string }) {
  const [classId, setClassId] = useState<number | null>(null);
  const [activePhase, setActivePhase] = useState<"fase1" | "fase2">("fase1");
  const [searchAluno, setSearchAluno] = useState("");

  const { data: classesList = [], error: classesError } = trpc.classes.list.useQuery(
    { sessionToken: teacherToken || "" },
    { enabled: !!teacherToken && teacherToken.length > 10, retry: false }
  );

  const { data: homeGroups = [], isLoading: loadingGroups, refetch: refetchGroups } =
    trpc.jigsawComplete.homeGroups.getByClass.useQuery({ classId: classId! }, { enabled: classId !== null });

  const { data: todasPerguntas = [], refetch: refetchPerguntas } =
    trpc.seminarioPoster.getTodasPerguntas.useQuery(
      { sessionToken: teacherToken || "", classId: classId! },
      { enabled: classId !== null && !!teacherToken }
    );

  const { data: classData } = trpc.classes.getById.useQuery(
    { classId: classId!, sessionToken: teacherToken || "" }, { enabled: classId !== null }
  );
  const classMembers: any[] = (classData as any)?.members || [];

  // Alunos da turma que ainda não estão em nenhum grupo de Seminário —
  // disponíveis pro professor adicionar manualmente em qualquer grupo.
  const alunosSemGrupo = useMemo(() => {
    const idsComGrupo = new Set<number>();
    for (const g of homeGroups as any[]) {
      for (const m of g.members || []) idsComGrupo.add(m.id);
    }
    return classMembers
      .filter(m => !idsComGrupo.has(m.id))
      .map(m => ({ id: m.id, name: m.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [classMembers, homeGroups]);

  const { data: jigsawScoresByClass = [], refetch: refetchScores } = trpc.jigsawComplete.scores.getByClass.useQuery(
    { classId: classId!, sessionToken: teacherToken || "" }, { enabled: classId !== null }
  );

  const refetchAll = () => { refetchGroups(); refetchPerguntas(); refetchScores(); };

  const perguntasPorGrupo = useMemo(() => {
    const m = new Map<number, any[]>();
    for (const p of todasPerguntas as any[]) {
      if (p.authorGroupId === null) continue;
      if (!m.has(p.authorGroupId)) m.set(p.authorGroupId, []);
      m.get(p.authorGroupId)!.push(p);
    }
    return m;
  }, [todasPerguntas]);

  const totalPendentes = (todasPerguntas as any[]).filter(p => p.status === "pending_review").length;
  const totalAprovadas = (todasPerguntas as any[]).filter(p => p.status === "approved").length;
  const gruposComNota = new Set(
    (jigsawScoresByClass as any[]).filter(s => Number(s.totalJigsawPF) > 0).map(s => s.memberId)
  ).size;

  const alunosOrdenados = useMemo(() => {
    const scoreMap = new Map((jigsawScoresByClass as any[]).map(s => [s.memberId, s]));
    return classMembers
      .map(m => ({ ...m, score: scoreMap.get(m.id) }))
      .filter(m => !searchAluno || m.name?.toLowerCase().includes(searchAluno.toLowerCase()))
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [classMembers, jigsawScoresByClass, searchAluno]);

  // ── Seletor de turma ──
  if (classId === null) {
    if (classesError) {
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-1"><Puzzle size={20} className="text-primary" /><h2 className="font-display font-bold text-xl text-foreground">Seminário Pôster + Quiz</h2></div>
          <div className="p-4 rounded-lg border border-destructive/30 bg-destructive/10 text-sm text-destructive">
            Erro ao carregar turmas. Verifique se você está autenticado como professor.
          </div>
        </div>
      );
    }
    return (
      <div className="space-y-4">
        <div>
          <div className="flex items-center gap-2 mb-1"><Puzzle size={20} className="text-primary" /><h2 className="font-display font-bold text-xl text-foreground">Seminário Pôster + Quiz</h2></div>
          <p className="text-sm text-muted-foreground">Selecione uma turma para gerenciar os grupos</p>
        </div>
        {(classesList as any[]).length === 0 && (
          <div className="p-4 rounded-lg border border-border text-sm text-muted-foreground">Carregando turmas...</div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
          {(classesList as any[]).map((cls: any) => (
            <button key={cls.id} onClick={() => setClassId(cls.id)}
              className="border border-border rounded-lg p-4 text-left hover:border-primary/50 transition-colors" style={{ backgroundColor: CARD_BG }}>
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
          <button onClick={() => setClassId(null)} className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 mb-1">← Voltar às turmas</button>
          <div className="flex items-center gap-2 mb-1"><Puzzle size={20} className="text-primary" /><h2 className="font-display font-bold text-xl text-foreground">Seminário — {selectedClassData?.name || "Turma"}</h2></div>
          <p className="text-sm text-muted-foreground">Fase 1: pôster e perguntas. Fase 2: liberação do quiz e acompanhamento das notas.</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={refetchAll}>
          <RefreshCw size={14} /> Atualizar
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: <Users size={16} />, label: "Grupos", value: (homeGroups as any[]).length.toString(), color: "#10b981" },
          { icon: <Clock size={16} />, label: "Perguntas pendentes", value: totalPendentes.toString(), color: "#f59e0b" },
          { icon: <CheckCircle2 size={16} />, label: "Perguntas aprovadas", value: totalAprovadas.toString(), color: "#6366f1" },
          { icon: <GraduationCap size={16} />, label: "Alunos com nota", value: gruposComNota.toString(), color: "#ec4899" },
        ].map((stat, i) => (
          <div key={i} className="rounded-lg p-3 border" style={{ backgroundColor: CARD_BG, borderColor: CARD_BORDER }}>
            <div className="flex items-center gap-1.5 mb-1" style={{ color: stat.color }}>{stat.icon}<span className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">{stat.label}</span></div>
            <div className="font-mono font-bold text-xl text-foreground">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs — só 2 fases */}
      <div className="flex gap-1 p-1 rounded-lg w-fit flex-wrap" style={{ backgroundColor: "oklch(0.22 0.03 264.052)" }}>
        {[
          { key: "fase1" as const, label: "Fase 1 — Pôster e Perguntas", icon: <FileText size={14} /> },
          { key: "fase2" as const, label: "Fase 2 — Quiz e Notas", icon: <Unlock size={14} /> },
        ].map((tab) => (
          <button key={tab.key} onClick={() => setActivePhase(tab.key)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all"
            style={{ backgroundColor: activePhase === tab.key ? "oklch(0.696 0.17 162.48)" : "transparent", color: activePhase === tab.key ? "#fff" : "oklch(0.7 0.02 264)" }}>
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      {/* FASE 1 */}
      {activePhase === "fase1" && (
        <div className="space-y-3">
          {loadingGroups ? (
            <div className="flex items-center justify-center py-12"><Loader2 size={24} className="animate-spin text-primary" /></div>
          ) : (homeGroups as any[]).length === 0 ? (
            <div className="p-6 rounded-lg border border-border text-sm text-muted-foreground text-center" style={{ backgroundColor: CARD_BG }}>
              Nenhum grupo encontrado para esta turma. Os grupos de Seminário precisam ser criados previamente (mesma tabela usada pelos grupos "mosaico").
            </div>
          ) : (
            (homeGroups as any[]).map((group, i) => (
              <GrupoFase1Card key={group.id} group={group} index={i} classId={classId} alunosSemGrupo={alunosSemGrupo}
                perguntasDoGrupo={perguntasPorGrupo.get(group.id) || []} teacherToken={teacherToken || ""} onChanged={refetchAll} />
            ))
          )}
        </div>
      )}

      {/* FASE 2 */}
      {activePhase === "fase2" && (
        <div className="space-y-6">
          <div className="space-y-3">
            {(homeGroups as any[]).length === 0 ? (
              <div className="p-6 rounded-lg border border-border text-sm text-muted-foreground text-center" style={{ backgroundColor: CARD_BG }}>
                Nenhum grupo encontrado para esta turma.
              </div>
            ) : (
              (homeGroups as any[]).map((group, i) => (
                <GrupoFase2Card key={group.id} group={group} index={i} classId={classId}
                  perguntasDoGrupo={perguntasPorGrupo.get(group.id) || []} teacherToken={teacherToken || ""} onChanged={refetchAll} />
              ))
            )}
          </div>

          {/* Acompanhamento de notas */}
          <div className="rounded-xl border p-4 space-y-3" style={{ backgroundColor: CARD_BG, borderColor: CARD_BORDER }}>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-sm font-semibold text-foreground flex items-center gap-1.5"><GraduationCap size={15} /> Nota de Seminário por aluno</p>
              <input value={searchAluno} onChange={e => setSearchAluno(e.target.value)} placeholder="Buscar aluno..."
                className="text-xs bg-transparent border border-border rounded px-2 py-1.5 text-foreground w-48" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground border-b" style={{ borderColor: CARD_BORDER }}>
                    <th className="py-1.5 pr-3">Aluno</th>
                    <th className="py-1.5 text-center">Nota Seminário</th>
                  </tr>
                </thead>
                <tbody>
                  {alunosOrdenados.map(m => (
                    <tr key={m.id} className="border-b" style={{ borderColor: "oklch(0.25 0.03 264.052)" }}>
                      <td className="py-1.5 pr-3 text-foreground">{m.name}</td>
                      <td className="py-1.5 text-center font-mono font-semibold text-foreground">{m.score ? Number(m.score.totalJigsawPF || 0).toFixed(1) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {alunosOrdenados.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Nenhum aluno encontrado.</p>}
            </div>
            <p className="text-[10px] text-muted-foreground">
              Nota Seminário = 50% nota do pôster (do grupo) + 50% desempenho individual respondendo as perguntas dos outros grupos.
              Calculada automaticamente sempre que o aluno responde uma pergunta ou o professor lança a nota do pôster — mas só é
              recalculada quando o próprio aluno consulta sua nota (getNotaSeminario) ou quando o professor lança a nota do pôster do
              grupo dele. Se um aluno nunca abriu a tela de nota, o valor pode aparecer "—" mesmo já tendo respondido perguntas.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}