/**
 * GerenciarSimulacoes.tsx — Painel do professor/admin pra Casos Clínicos:
 * Prática Simulada. Sobe simulações HTML interativas (tipo o caso GLP-1),
 * escolhe se contam como nota/frequência, e vê quem completou.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Link } from "wouter";
import {
  ArrowLeft, Upload, Loader2, FlaskConical, Trash2, Users,
  CheckCircle2, ChevronDown, ChevronUp, GraduationCap, Calendar,
} from "lucide-react";

function NovaSimulacao({ sessionToken, onCreated }: { sessionToken: string; onCreated: () => void }) {
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [contaComoNota, setContaComoNota] = useState(false);
  const [contaComoFrequencia, setContaComoFrequencia] = useState(false);
  const [pontuacaoMaxima, setPontuacaoMaxima] = useState(5);
  const [enviando, setEnviando] = useState(false);

  const criar = trpc.simulacoesClinicas.criar.useMutation({
    onSuccess: () => {
      toast.success("Simulação publicada!");
      setTitulo(""); setDescricao(""); setFile(null);
      setContaComoNota(false); setContaComoFrequencia(false); setPontuacaoMaxima(5);
      onCreated();
    },
    onError: (e) => toast.error(e.message || "Erro ao publicar simulação"),
    onSettled: () => setEnviando(false),
  });

  const handleSubmit = async () => {
    if (!file || !titulo.trim()) return;
    setEnviando(true);
    const htmlConteudo = await file.text();
    criar.mutate({
      sessionToken, titulo: titulo.trim(), descricao: descricao.trim() || undefined,
      htmlConteudo, contaComoNota, contaComoFrequencia, pontuacaoMaxima,
    });
  };

  return (
    <div className="rounded-xl border border-dashed border-border p-4 space-y-3" style={{ backgroundColor: "oklch(0.18 0.03 264.052)" }}>
      <p className="text-sm font-semibold text-foreground flex items-center gap-1.5"><Upload size={14} /> Publicar nova simulação</p>
      <input
        value={titulo} onChange={(e) => setTitulo(e.target.value)}
        placeholder="Título (ex: Caso Clínico: GLP-1 e eventos gastrointestinais)"
        className="w-full text-sm bg-background border border-border rounded px-3 py-2 text-foreground"
      />
      <textarea
        value={descricao} onChange={(e) => setDescricao(e.target.value)}
        placeholder="Descrição curta (opcional)"
        rows={2}
        className="w-full text-sm bg-background border border-border rounded px-3 py-2 text-foreground resize-none"
      />
      <div>
        <label className="block text-xs text-muted-foreground mb-1">Arquivo do simulador (index.html)</label>
        <input
          type="file" accept=".html,text/html"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="w-full text-xs text-muted-foreground"
        />
      </div>
      <div className="flex flex-wrap gap-4 pt-1">
        <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
          <input type="checkbox" checked={contaComoNota} onChange={(e) => setContaComoNota(e.target.checked)} />
          Conta como nota
        </label>
        <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
          <input type="checkbox" checked={contaComoFrequencia} onChange={(e) => setContaComoFrequencia(e.target.checked)} />
          Conta como frequência
        </label>
        <label className="flex items-center gap-2 text-sm text-foreground">
          Pontuação máxima
          <input
            type="number" value={pontuacaoMaxima} min={1}
            onChange={(e) => setPontuacaoMaxima(parseInt(e.target.value) || 1)}
            className="w-16 text-sm bg-background border border-border rounded px-2 py-1 text-foreground"
          />
        </label>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Aparece pra todas as turmas por padrão. O aluno acessa em "Casos Clínicos → Prática Simulada".
      </p>
      <button
        onClick={handleSubmit}
        disabled={enviando || !file || !titulo.trim()}
        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors"
      >
        {enviando ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
        Publicar
      </button>
    </div>
  );
}

function SimulacaoCard({ sim, sessionToken, onChanged }: { sim: any; sessionToken: string; onChanged: () => void }) {
  const [expandido, setExpandido] = useState(false);
  const { data: progresso, isLoading } = trpc.simulacoesClinicas.verProgressoDetalhado.useQuery(
    { sessionToken, simulacaoId: sim.id },
    { enabled: expandido }
  );

  const atualizar = trpc.simulacoesClinicas.atualizar.useMutation({
    onSuccess: () => { toast.success("Atualizado"); onChanged(); },
    onError: (e) => toast.error(e.message),
  });
  const remover = trpc.simulacoesClinicas.remover.useMutation({
    onSuccess: () => { toast.success("Removida"); onChanged(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="rounded-xl border border-border p-4" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{sim.titulo}</p>
          {sim.descricao && <p className="text-xs text-muted-foreground mt-0.5">{sim.descricao}</p>}
          <div className="flex flex-wrap gap-2 mt-2">
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
              {sim.classIds ? `${sim.classIds.length} turma(s)` : "Todas as turmas"}
            </span>
            {sim.contaComoNota && <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">Conta como nota</span>}
            {sim.contaComoFrequencia && <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400">Conta como frequência</span>}
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
              {sim.totalConcluiram}/{sim.totalIniciaram} concluíram
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => { if (confirm(`Remover "${sim.titulo}"?`)) remover.mutate({ sessionToken, id: sim.id }); }}
            className="p-1.5 rounded hover:bg-destructive/20 text-destructive"
          >
            <Trash2 size={14} />
          </button>
          <button onClick={() => setExpandido(v => !v)} className="p-1.5 rounded hover:bg-secondary text-muted-foreground">
            {expandido ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {expandido && (
        <div className="mt-3 pt-3 border-t border-border/50 space-y-3">
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
              <input
                type="checkbox" checked={sim.contaComoNota}
                onChange={(e) => atualizar.mutate({ sessionToken, id: sim.id, contaComoNota: e.target.checked })}
              />
              Conta como nota
            </label>
            <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
              <input
                type="checkbox" checked={sim.contaComoFrequencia}
                onChange={(e) => atualizar.mutate({ sessionToken, id: sim.id, contaComoFrequencia: e.target.checked })}
              />
              Conta como frequência
            </label>
          </div>

          <p className="text-xs font-semibold text-foreground flex items-center gap-1.5"><Users size={12} /> Progresso dos alunos</p>
          {isLoading ? (
            <div className="flex items-center justify-center py-4"><Loader2 size={16} className="animate-spin text-muted-foreground" /></div>
          ) : !progresso?.length ? (
            <p className="text-xs text-muted-foreground">Nenhum aluno iniciou ainda.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground" style={{ backgroundColor: "rgba(255,255,255,0.04)" }}>
                    <th className="py-1.5 px-2">Aluno</th>
                    <th className="py-1.5 px-2 text-center">Etapas</th>
                    <th className="py-1.5 px-2 text-center">Nota</th>
                    <th className="py-1.5 px-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {progresso.map((p: any) => (
                    <tr key={p.id} className="border-t border-border/40">
                      <td className="py-1.5 px-2 text-foreground">{p.memberName}</td>
                      <td className="py-1.5 px-2 text-center text-muted-foreground">{p.completedSteps}/{p.totalSteps}</td>
                      <td className="py-1.5 px-2 text-center font-mono text-foreground">{p.score}/{p.maxScore}</td>
                      <td className="py-1.5 px-2 text-center">
                        {p.completed ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400"><CheckCircle2 size={12} /> Concluído</span>
                        ) : (
                          <span className="text-amber-400">Em andamento</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function GerenciarSimulacoes() {
  const sessionToken = localStorage.getItem("teacherSessionToken") || "";
  const { data: simulacoes, isLoading, refetch } = trpc.simulacoesClinicas.listarTodas.useQuery(
    { sessionToken },
    { enabled: !!sessionToken }
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border px-4 py-3 flex items-center gap-3 sticky top-0 z-10" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
        <Link href="/admin/professor" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-sm font-bold text-foreground flex items-center gap-1.5"><FlaskConical size={16} /> Casos Clínicos — Prática Simulada</h1>
          <p className="text-xs text-muted-foreground">Simulações interativas que o aluno joga sozinho</p>
        </div>
      </div>

      <div className="container max-w-3xl py-6 px-4 space-y-6">
        <NovaSimulacao sessionToken={sessionToken} onCreated={refetch} />

        <div>
          <p className="text-sm font-semibold text-foreground mb-3">Simulações publicadas</p>
          {isLoading ? (
            <div className="flex items-center justify-center py-10"><Loader2 size={20} className="animate-spin text-muted-foreground" /></div>
          ) : !simulacoes?.length ? (
            <p className="text-sm text-muted-foreground text-center py-10">Nenhuma simulação publicada ainda.</p>
          ) : (
            <div className="space-y-3">
              {simulacoes.map((s: any) => (
                <SimulacaoCard key={s.id} sim={s} sessionToken={sessionToken} onChanged={refetch} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}