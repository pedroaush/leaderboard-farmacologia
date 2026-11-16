import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { CalendarClock, Loader2, RefreshCw, Sparkles, Trash2, Trophy } from "lucide-react";

/**
 * Destaques da semana — 100% automáticos.
 * Toda segunda-feira, 00h: aluno com maior ganho de PF na semana, equipe que
 * mais pontuou e líder no acumulado, por turma. Aqui o professor só acompanha,
 * refaz uma semana se precisar, ou remove um destaque.
 */
const CARD = { backgroundColor: "oklch(0.195 0.03 264.052)" };

export default function DestaquesAutomaticos({ password }: { password: string }) {
  const utils = trpc.useUtils();
  const sit = trpc.destaquesAuto.situacao.useQuery({ password });
  const lista = trpc.destaquesAuto.lista.useQuery({ password });
  const [turmaFiltro, setTurmaFiltro] = useState<number | "todas">("todas");
  const [semanaRefazer, setSemanaRefazer] = useState("");

  const atualizar = () => { sit.refetch(); lista.refetch(); utils.leaderboard.getData.invalidate(); };
  const gerar = trpc.destaquesAuto.gerar.useMutation({
    onSuccess: (r: any[]) => {
      atualizar();
      const g = r.filter((x) => x.situacao === "gerado").length;
      const sp = r.filter((x) => x.situacao === "sem_pontos").length;
      const je = r.filter((x) => x.situacao === "ja_existia").length;
      toast.success(`${g} destaque(s) gerado(s)` + (sp ? ` · ${sp} turma(s) sem ganho de PF` : "") + (je ? ` · ${je} já existia(m)` : ""));
    },
    onError: (e) => toast.error(e.message),
  });
  const apagar = trpc.highlights.delete.useMutation({ onSuccess: () => { atualizar(); toast.success("Destaque removido"); }, onError: (e) => toast.error(e.message) });

  const turmas = (sit.data?.turmas ?? []) as any[];
  const nomeTurma = useMemo(() => new Map(turmas.map((t) => [t.id, t.nome])), [turmas]);
  const itens = ((lista.data ?? []) as any[]).filter((h) => turmaFiltro === "todas" || h.classId === turmaFiltro || h.classId == null);
  const proxima = sit.data ? new Date(sit.data.proximaGeracao).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "…";

  return (
    <div className="space-y-4">
      <div className="border border-emerald-500/30 rounded-lg p-4" style={CARD}>
        <h3 className="font-semibold text-sm text-foreground mb-1 flex items-center gap-2">
          <Sparkles size={16} className="text-emerald-400" /> Destaques da semana — automáticos
        </h3>
        <p className="text-xs text-muted-foreground">
          Toda segunda-feira à 0h, para cada turma, o sistema publica: o aluno com <b>maior ganho de PF na semana</b>, a <b>equipe que mais pontuou</b> e o <b>líder no acumulado</b>.
          O título da semana vem do cronograma. Não é preciso preencher nada.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5 text-foreground"><CalendarClock size={14} className="text-emerald-400" /> Próxima geração: <b>{proxima}</b></span>
          {sit.data && <span className="text-muted-foreground">Última semana concluída: <b className="text-foreground">Semana {sit.data.semanaConcluida}</b></span>}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {sit.isLoading && <p className="text-xs text-muted-foreground">Carregando…</p>}
        {sit.error && <p className="text-xs text-red-400">{sit.error.message}</p>}
        {turmas.map((t) => {
          const ult = t.historico?.[0];
          return (
            <div key={t.id} className="border border-border rounded-lg p-3" style={CARD}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-foreground truncate">{t.nome}</span>
                <button onClick={() => gerar.mutate({ password, classId: t.id })} disabled={gerar.isPending}
                  className="text-[11px] px-2 py-1 rounded bg-secondary text-foreground hover:bg-secondary/80 disabled:opacity-50 flex items-center gap-1" title="Gerar agora a semana que terminou, se ainda não foi gerada">
                  {gerar.isPending ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />} Gerar agora
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {ult ? <>Semana {ult.semana}: {ult.resumo || "—"}</> : "Ainda sem destaque gerado."}
              </p>
            </div>
          );
        })}
      </div>

      <div className="border border-border rounded-lg p-3 flex flex-wrap items-center gap-2 text-xs" style={CARD}>
        <span className="text-muted-foreground">Refazer uma semana (recalcula e substitui o destaque):</span>
        <input value={semanaRefazer} onChange={(e) => setSemanaRefazer(e.target.value)} type="number" min={1} max={30} placeholder="Semana"
          className="w-20 px-2 py-1 rounded bg-background border border-border text-foreground" />
        <button disabled={!semanaRefazer || gerar.isPending}
          onClick={() => { if (confirm(`Refazer o destaque da semana ${semanaRefazer} em todas as turmas?`)) gerar.mutate({ password, semana: Number(semanaRefazer), forcar: true }); }}
          className="px-3 py-1 rounded bg-primary text-primary-foreground font-medium disabled:opacity-50">Refazer</button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><Trophy size={14} className="text-primary" /> Destaques publicados</h3>
          <select value={turmaFiltro} onChange={(e) => setTurmaFiltro(e.target.value === "todas" ? "todas" : Number(e.target.value))}
            className="ml-auto px-2 py-1 rounded bg-background border border-border text-xs text-foreground">
            <option value="todas">Todas as turmas</option>
            {turmas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </select>
        </div>
        {itens.length === 0 && <p className="text-xs text-muted-foreground italic">Nenhum destaque ainda.</p>}
        {itens.map((h) => (
          <div key={h.id} className="border border-border rounded-lg p-3" style={CARD}>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-mono text-xs font-bold text-primary">SEM {h.week}</span>
              <span className="text-xs text-muted-foreground">{h.date}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{h.activity}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{h.classId ? nomeTurma.get(h.classId) ?? `Turma ${h.classId}` : "manual (antigo)"}</span>
              <button onClick={() => { if (confirm("Remover este destaque?")) apagar.mutate({ password, id: h.id }); }} className="ml-auto p-1 rounded hover:bg-destructive/20 text-destructive"><Trash2 size={12} /></button>
            </div>
            <p className="text-xs text-foreground">{h.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
