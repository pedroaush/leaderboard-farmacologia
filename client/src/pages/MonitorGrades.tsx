/**
 * Monitor Grades — Planilha do Monitor
 *
 * Casos Clínicos: o monitor lança o resultado de cada confronto (3x0/3x1/3x2)
 * depois que ele acontece presencialmente — a nota de cada grupo é calculada
 * sozinha a partir da classificação. Também pode subir os arquivos do caso
 * pra turma estudar (só visualizar, não baixar).
 * Seminário: o monitor lança a nota do pôster por checklist (mesma lógica
 * do painel do professor), aplicada a todos os integrantes do grupo.
 *
 * Kahoot foi removido — não faz mais parte da fórmula de nota da disciplina.
 */
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  ArrowLeft, BookOpen, FlaskConical, Users, Save, Loader2,
  ChevronDown, ChevronUp, RefreshCw, ClipboardCheck, FileText, Trophy,
  Upload, Eye, Medal, Swords,
} from "lucide-react";
import { Link } from "wouter";

const MONITOR_SESSION_KEY = "monitor_session_token";

const CRITERIOS_LABEL: Record<string, string> = {
  posterClaro: "Pôster claro e bem organizado",
  achadoCorreto: "Identificou corretamente o principal achado do artigo",
  relevanciaClinica: "Explicou a relevância clínica do achado",
  perguntasBemFormuladas: "As 5 perguntas estão bem formuladas",
  gabaritoCorreto: "O gabarito enviado está correto",
};
const CRITERIOS_PADRAO = Object.keys(CRITERIOS_LABEL);

const RODADAS_CS = [1, 2, 3, 4];

// ─── Card de uma disputa (confronto) dentro de uma rodada ───
function DisputaCard({ disputa, sessionToken, onChanged }: { disputa: any; sessionToken: string; onChanged: () => void }) {
  const [enviando, setEnviando] = useState<string | null>(null);
  const registrar = trpc.casosClinicos.registrarResultado.useMutation({
    onSuccess: () => { toast.success("Resultado registrado!"); onChanged(); },
    onError: (e) => toast.error(e.message || "Erro ao registrar resultado"),
    onSettled: () => setEnviando(null),
  });

  const jaConcluida = disputa.status === "concluida";
  const placares = [
    { label: "3×0", a: 3, b: 0 }, { label: "3×1", a: 3, b: 1 }, { label: "3×2", a: 3, b: 2 },
  ];

  const lancar = (grupoAAcertos: number, grupoBAcertos: number, key: string) => {
    setEnviando(key);
    registrar.mutate({ sessionToken, disputaId: disputa.id, grupoAAcertos, grupoBAcertos });
  };

  return (
    <div className="rounded-xl border border-border p-4" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <span>{disputa.grupoANome}</span>
          <Swords size={13} className="text-muted-foreground" />
          <span>{disputa.grupoBNome}</span>
        </div>
        {jaConcluida && (
          <span className="text-xs px-2 py-0.5 rounded-full font-mono font-bold bg-emerald-500/15 text-emerald-400">
            {disputa.grupoAAcertos} × {disputa.grupoBAcertos}
          </span>
        )}
      </div>

      {jaConcluida ? (
        <p className="text-[11px] text-muted-foreground">Registrado por {disputa.registradoPorNome}</p>
      ) : (
        <div className="space-y-2">
          <p className="text-[11px] text-muted-foreground mb-1">Vitória de {disputa.grupoANome}:</p>
          <div className="flex gap-2 flex-wrap">
            {placares.map((p) => (
              <button
                key={`a-${p.label}`}
                onClick={() => lancar(p.a, p.b, `a-${p.label}`)}
                disabled={!!enviando}
                className="px-3 py-1.5 rounded-lg text-xs font-mono font-semibold bg-secondary text-foreground hover:bg-primary hover:text-primary-foreground transition-colors disabled:opacity-50"
              >
                {enviando === `a-${p.label}` ? <Loader2 size={12} className="animate-spin" /> : p.label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground mb-1 mt-2">Vitória de {disputa.grupoBNome}:</p>
          <div className="flex gap-2 flex-wrap">
            {placares.map((p) => (
              <button
                key={`b-${p.label}`}
                onClick={() => lancar(p.b, p.a, `b-${p.label}`)}
                disabled={!!enviando}
                className="px-3 py-1.5 rounded-lg text-xs font-mono font-semibold bg-secondary text-foreground hover:bg-primary hover:text-primary-foreground transition-colors disabled:opacity-50"
              >
                {enviando === `b-${p.label}` ? <Loader2 size={12} className="animate-spin" /> : p.label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground mb-1 mt-2">Empate (pararam antes da 5ª pergunta):</p>
          <button
            onClick={() => lancar(2, 2, "empate")}
            disabled={!!enviando}
            className="px-3 py-1.5 rounded-lg text-xs font-mono font-semibold bg-amber-500/15 text-amber-400 hover:bg-amber-500/30 transition-colors disabled:opacity-50"
          >
            {enviando === "empate" ? <Loader2 size={12} className="animate-spin" /> : "2×2 (empate)"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Tabela de classificação (ao vivo) ───
function TabelaClassificacao({ classId }: { classId: number }) {
  const { data: tabela = [], isLoading } = trpc.casosClinicos.getTabelaClassificacao.useQuery({ classId });

  if (isLoading) return <div className="flex items-center justify-center py-6 text-muted-foreground"><Loader2 size={16} className="animate-spin" /></div>;
  if (!tabela.length) return <p className="text-xs text-muted-foreground py-4">Nenhum grupo encontrado.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-muted-foreground border-b border-border">
            <th className="py-1.5 pr-2">#</th>
            <th className="py-1.5 pr-2">Grupo</th>
            <th className="py-1.5 px-2 text-center">Pts</th>
            <th className="py-1.5 px-2 text-center">V</th>
            <th className="py-1.5 px-2 text-center">E</th>
            <th className="py-1.5 px-2 text-center">D</th>
            <th className="py-1.5 pl-2 text-center">J</th>
          </tr>
        </thead>
        <tbody>
          {tabela.map((t: any, i: number) => (
            <tr key={t.grupoId} className="border-b border-border/40">
              <td className="py-1.5 pr-2 text-muted-foreground">{i + 1}º</td>
              <td className="py-1.5 pr-2 text-foreground font-medium">{t.nome}</td>
              <td className="py-1.5 px-2 text-center font-mono font-bold text-foreground">{t.pontos}</td>
              <td className="py-1.5 px-2 text-center text-emerald-400">{t.vitorias}</td>
              <td className="py-1.5 px-2 text-center text-amber-400">{t.empates}</td>
              <td className="py-1.5 px-2 text-center text-red-400">{t.derrotas}</td>
              <td className="py-1.5 pl-2 text-center text-muted-foreground">{t.jogos}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Upload de arquivo do Caso Clínico (visualização, não download) ───
function UploadArquivoCaso({ sessionToken, classId, rodada, onChanged }: {
  sessionToken: string; classId: number; rodada: number; onChanged: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [titulo, setTitulo] = useState("");
  const [enviando, setEnviando] = useState(false);

  const upload = trpc.casosClinicos.publicarArquivo.useMutation({
    onSuccess: () => { toast.success("Arquivo publicado para a turma!"); setFile(null); setTitulo(""); onChanged(); },
    onError: (e) => toast.error(e.message || "Erro ao enviar arquivo"),
    onSettled: () => setEnviando(false),
  });

  const handleUpload = async () => {
    if (!file || !titulo.trim()) return;
    setEnviando(true);
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(",")[1] || "");
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    upload.mutate({
      sessionToken, classId, titulo: titulo.trim(), rodada,
      fileName: file.name, mimeType: file.type as any, fileBase64: base64,
    });
  };

  return (
    <div className="rounded-xl border border-dashed border-border p-4 space-y-2" style={{ backgroundColor: "oklch(0.18 0.03 264.052)" }}>
      <p className="text-xs font-semibold text-foreground flex items-center gap-1.5"><Upload size={13} /> Publicar arquivo do caso (CS{rodada})</p>
      <p className="text-[11px] text-muted-foreground">A turma só consegue visualizar — não é possível baixar.</p>
      <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título (ex: Caso Clínico 1 — Enunciado)"
        className="w-full text-xs bg-background border border-border rounded px-2 py-1.5 text-foreground" />
      <input type="file" accept="application/pdf,image/jpeg,image/png"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
        className="w-full text-xs text-muted-foreground" />
      <button
        onClick={handleUpload}
        disabled={enviando || !file || !titulo.trim()}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors"
      >
        {enviando ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
        Publicar
      </button>
    </div>
  );
}

// ─── Seletor de rodada + confrontos daquela rodada + upload de arquivo ───
function RodadaCasosClinicos({ sessionToken, classId }: { sessionToken: string; classId: number }) {
  const [rodada, setRodada] = useState(1);
  const [showUpload, setShowUpload] = useState(false);

  const { data: disputas, isLoading, refetch } = trpc.casosClinicos.getDisputasDaRodada.useQuery(
    { sessionToken, classId, rodada },
    { enabled: !!sessionToken && !!classId }
  );

  return (
    <div className="rounded-xl border border-border p-4 space-y-3" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs font-semibold text-foreground flex items-center gap-1.5"><Swords size={13} /> Confrontos por rodada</p>
        <div className="flex gap-1">
          {RODADAS_CS.map((r) => (
            <button
              key={r}
              onClick={() => setRodada(r)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                rodada === r ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              CS{r}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground"><Loader2 size={16} className="animate-spin" /></div>
      ) : !disputas?.length ? (
        <p className="text-xs text-muted-foreground py-4">Nenhum confronto encontrado para essa rodada — o calendário pode ainda não ter sido gerado.</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {disputas.map((d: any) => (
            <DisputaCard key={d.id} disputa={d} sessionToken={sessionToken} onChanged={refetch} />
          ))}
        </div>
      )}

      <div className="pt-2 border-t border-border/50">
        {showUpload ? (
          <UploadArquivoCaso sessionToken={sessionToken} classId={classId} rodada={rodada} onChanged={() => setShowUpload(false)} />
        ) : (
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-1.5 text-xs text-primary hover:underline"
          >
            <Upload size={13} /> Publicar arquivo do caso pra turma estudar
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Card de um grupo de Casos Clínicos (leitura) ───
function CasoClinicoCard({ group }: { group: any }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded-xl border border-border overflow-hidden" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
      <button onClick={() => setExpanded(v => !v)} className="w-full flex items-center justify-between p-4 text-left">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center bg-orange-500/15 text-orange-400">
            <Users size={16} />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{group.name}</p>
            <p className="text-xs text-muted-foreground">{group.membersList?.length || 0} integrantes</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Nota atual</p>
            <p className="text-sm font-mono font-bold text-foreground">
              {group.notaAtual !== null ? group.notaAtual.toFixed(1) : "—"}
            </p>
          </div>
          {expanded ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
        </div>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="px-4 pb-4 border-t border-border pt-3 space-y-1">
              {(group.membersList || []).map((m: any) => (
                <p key={m.memberId} className="text-xs text-muted-foreground">{m.memberName}</p>
              ))}
              {(!group.membersList || group.membersList.length === 0) && (
                <p className="text-xs text-muted-foreground">Nenhum integrante cadastrado.</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Card de um grupo de Seminário (lança nota do pôster) ───
function SeminarioCard({ group, sessionToken, classId, onChanged }: {
  group: any; sessionToken: string; classId: number; onChanged: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [checklist, setChecklist] = useState<Record<string, boolean>>(
    Object.fromEntries(CRITERIOS_PADRAO.map(c => [c, false]))
  );
  const [observacoes, setObservacoes] = useState("");

  const lancarNota = trpc.monitors.lancarNotaPosterSeminario.useMutation({
    onSuccess: (data) => { toast.success(`Nota do pôster salva: ${data.notaPoster}`); onChanged(); },
    onError: (e) => toast.error(e.message || "Erro ao salvar nota"),
  });

  return (
    <div className="rounded-xl border border-border overflow-hidden" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
      <button onClick={() => setExpanded(v => !v)} className="w-full flex items-center justify-between p-4 text-left">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center bg-indigo-500/15 text-indigo-400">
            <Users size={16} />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{group.name}</p>
            <p className="text-xs text-muted-foreground">{group.membersList?.length || 0} integrantes</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {group.perguntasPendentes > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-amber-500/15 text-amber-400">
              {group.perguntasPendentes} pergunta{group.perguntasPendentes > 1 ? "s" : ""} pendente{group.perguntasPendentes > 1 ? "s" : ""} (professor revisa)
            </span>
          )}
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Nota pôster</p>
            <p className="text-sm font-mono font-bold text-foreground">
              {group.notaPoster !== null ? group.notaPoster.toFixed(1) : "—"}
            </p>
          </div>
          {expanded ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
        </div>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="px-4 pb-4 border-t border-border pt-3 space-y-3">
              <div className="space-y-1">
                {(group.membersList || []).map((m: any) => (
                  <p key={m.memberId} className="text-xs text-muted-foreground">{m.memberName}</p>
                ))}
              </div>

              <div className="space-y-1.5 pt-2 border-t border-border/50">
                <p className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-1">
                  <ClipboardCheck size={13} /> Checklist do pôster
                </p>
                {CRITERIOS_PADRAO.map(c => (
                  <label key={c} className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                    <input type="checkbox" checked={checklist[c]} onChange={e => setChecklist(prev => ({ ...prev, [c]: e.target.checked }))} />
                    {CRITERIOS_LABEL[c]}
                  </label>
                ))}
              </div>
              <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Observações (opcional)"
                className="w-full text-xs bg-background border border-border rounded p-2 text-foreground" rows={2} />
              <button
                onClick={() => lancarNota.mutate({ monitorSessionToken: sessionToken, classId, groupId: group.id, checklist, observacoes: observacoes || undefined })}
                disabled={lancarNota.isPending}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {lancarNota.isPending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                Salvar nota do pôster
              </button>
              {group.gradedByName && (
                <p className="text-[10px] text-muted-foreground">Última nota lançada por: {group.gradedByName}</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function MonitorGrades() {
  const [sessionToken, setSessionToken] = useState<string>(() =>
    localStorage.getItem(MONITOR_SESSION_KEY) || localStorage.getItem("teacherSessionToken") || ""
  );
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"casos_clinicos" | "seminario">("casos_clinicos");

  const { data: monitorMe, isError: isSessionError } = trpc.monitors.me.useQuery(
    { sessionToken }, { enabled: !!sessionToken, retry: false }
  );

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

  const { data: classesList, isLoading: loadingClasses, isError: isClassesError } = trpc.monitors.listClasses.useQuery(
    { monitorSessionToken: sessionToken },
    { enabled: !!sessionToken && monitorMe !== undefined && monitorMe !== null, retry: false }
  );

  useEffect(() => {
    if (isClassesError && sessionToken) {
      localStorage.removeItem(MONITOR_SESSION_KEY);
      setSessionToken("");
      toast.error("Sessão expirada. Por favor, faça login novamente.");
    }
  }, [isClassesError, sessionToken]);

  useEffect(() => {
    if (classesList?.length && !selectedClassId) {
      const params = new URLSearchParams(window.location.search);
      const urlClassId = params.get("classId");
      if (urlClassId) {
        const found = classesList.find((c) => c.id === parseInt(urlClassId));
        if (found) { setSelectedClassId(found.id); return; }
      }
      setSelectedClassId(classesList[0].id);
    }
  }, [classesList]);

  const {
    data: casosClinicosGroups,
    isLoading: loadingCasos,
    refetch: refetchCasos,
  } = trpc.monitors.listCasosClinicosGroups.useQuery(
    { monitorSessionToken: sessionToken, classId: selectedClassId! },
    { enabled: !!sessionToken && !!selectedClassId && activeTab === "casos_clinicos" }
  );

  const {
    data: seminarioGroups,
    isLoading: loadingSeminario,
    refetch: refetchSeminario,
  } = trpc.monitors.listSeminarioGroups.useQuery(
    { monitorSessionToken: sessionToken, classId: selectedClassId! },
    { enabled: !!sessionToken && !!selectedClassId && activeTab === "seminario" }
  );

  if (!sessionToken) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto">
            <BookOpen size={24} className="text-amber-400" />
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
            <p className="text-xs text-muted-foreground">Casos Clínicos & Seminário</p>
          </div>
        </div>
        <button
          onClick={() => { refetchCasos(); refetchSeminario(); }}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          title="Atualizar"
        >
          <RefreshCw size={15} />
        </button>
      </div>

      <div className="container max-w-5xl py-6 px-4">
        {/* Seletor de Turma */}
        <div className="mb-6">
          <label className="block text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Turma</label>
          {(loadingClasses || (!!sessionToken && monitorMe === undefined)) ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 size={14} className="animate-spin" /> Carregando turmas...
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {classesList?.map((cls) => (
                <button
                  key={cls.id}
                  onClick={() => setSelectedClassId(cls.id)}
                  className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${
                    selectedClassId === cls.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                  }`}
                >
                  <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: cls.color || "#6366f1" }} />
                  {cls.name}
                </button>
              ))}
              {!classesList?.length && <p className="text-sm text-muted-foreground">Nenhuma turma encontrada.</p>}
            </div>
          )}
        </div>

        {selectedClassId && (
          <>
            {/* Tabs */}
            <div className="flex gap-1 mb-6 p-1 rounded-xl border border-border" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
              <button
                onClick={() => setActiveTab("casos_clinicos")}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === "casos_clinicos" ? "bg-orange-500/20 text-orange-400 border border-orange-500/30" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Trophy size={15} /> Casos Clínicos
              </button>
              <button
                onClick={() => setActiveTab("seminario")}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === "seminario" ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <FileText size={15} /> Seminário
              </button>
            </div>

            {activeTab === "casos_clinicos" && (
              <div className="space-y-5">
                <p className="text-xs text-muted-foreground">
                  Depois que a rodada acontece presencialmente, registre o placar de cada confronto abaixo — a nota de
                  cada grupo é recalculada sozinha a partir da classificação.
                </p>

                <RodadaCasosClinicos sessionToken={sessionToken} classId={selectedClassId!} />

                <div className="rounded-xl border border-border p-4" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
                  <p className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-2"><Medal size={13} /> Classificação geral</p>
                  <TabelaClassificacao classId={selectedClassId!} />
                </div>

                <div>
                  <p className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-2"><Users size={13} /> Grupos</p>
                  <div className="space-y-3">
                    {loadingCasos ? (
                      <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
                        <Loader2 size={18} className="animate-spin" /> Carregando grupos...
                      </div>
                    ) : !casosClinicosGroups?.length ? (
                      <div className="text-center py-12">
                        <FlaskConical size={32} className="mx-auto mb-3 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Nenhum grupo de Casos Clínicos encontrado para esta turma.</p>
                      </div>
                    ) : (
                      casosClinicosGroups.map((g: any) => <CasoClinicoCard key={g.id} group={g} />)
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "seminario" && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground mb-2">
                  Lance a nota do pôster de cada grupo por checklist. A nota final de Seminário do aluno combina
                  isso com o desempenho dele respondendo o quiz — calculado automaticamente.
                </p>
                {loadingSeminario ? (
                  <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
                    <Loader2 size={18} className="animate-spin" /> Carregando grupos...
                  </div>
                ) : !seminarioGroups?.length ? (
                  <div className="text-center py-12">
                    <FileText size={32} className="mx-auto mb-3 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Nenhum grupo de Seminário encontrado para esta turma.</p>
                  </div>
                ) : (
                  seminarioGroups.map((g: any) => (
                    <SeminarioCard key={g.id} group={g} sessionToken={sessionToken} classId={selectedClassId} onChanged={() => refetchSeminario()} />
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}