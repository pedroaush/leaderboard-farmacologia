/**
 * Painel da prova — /correcao/painel?p=P1&c=1
 *
 * Para o professor revisar a prova depois da correção dos cartões:
 *  - resumo (corrigidos, ausentes, média, mediana, ≥ 6);
 *  - distribuição das notas e alunos por versão;
 *  - por questão (juntando todas as versões): % de acerto, discriminação,
 *    alternativas marcadas (a correta em verde) e alertas;
 *  - anular / desanular questão (recorrige a turma na hora);
 *  - lista de ausentes (para a 2ª chamada);
 *  - liberar o resultado para os alunos.
 */
import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Loader2, AlertTriangle, Eye, EyeOff, RefreshCw, Users, Ban, Undo2, ScanLine } from "lucide-react";

const ORANGE = "#F7941D";
const DARK_BG = "#0A1628";
const CARD_BG = "#0D1B2A";
const ALTS = ["A", "B", "C", "D", "E"];

export default function PainelProva() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const prova = ((params.get("p") || "P1").toUpperCase() === "P2" ? "P2" : "P1") as "P1" | "P2";
  const classId = Number(params.get("c") || 1);
  const token = localStorage.getItem("teacherSessionToken") || localStorage.getItem("sessionToken") || "";

  const painel = trpc.correcaoProva.getPainel.useQuery({ sessionToken: token, classId, provaType: prova }, { enabled: !!token, retry: false });
  const anular = trpc.correcaoProva.anularQuestao.useMutation();
  const liberar = trpc.correcaoProva.liberarResultado.useMutation();
  const recorrigir = trpc.correcaoProva.recorrigirTodos.useMutation();
  const [msg, setMsg] = useState<string | null>(null);
  const [mostrarAusentes, setMostrarAusentes] = useState(false);

  const d = painel.data;

  async function alternarAnulacao(q: number, anuladaAgora: boolean) {
    const acao = anuladaAgora ? "DESANULAR" : "ANULAR";
    if (!confirm(`${acao} a questão ${q}? Todos os cartões serão recorrigidos na hora.`)) return;
    setMsg(null);
    try {
      const r = await anular.mutateAsync({ sessionToken: token, classId, provaType: prova, questaoOriginal: q, anular: !anuladaAgora });
      setMsg(`Questão ${q} ${anuladaAgora ? "desanulada" : "anulada"}. ${r.recorrigidos} cartões recorrigidos.`);
      painel.refetch();
    } catch (e: any) { setMsg(e?.message || "Erro"); }
  }

  async function alternarLiberacao() {
    if (!d) return;
    const texto = d.liberado ? "Recolher o resultado (os alunos deixam de ver)?" : "Liberar o resultado para os alunos? Cada aluno verá a própria nota, respostas e o gabarito da sua versão.";
    if (!confirm(texto)) return;
    await liberar.mutateAsync({ sessionToken: token, classId, provaType: prova, liberar: !d.liberado });
    painel.refetch();
  }

  async function fazerRecorrecao() {
    const r = await recorrigir.mutateAsync({ sessionToken: token, classId, provaType: prova });
    setMsg(`${r.recorrigidos} cartões recorrigidos com o gabarito atual.`);
    painel.refetch();
  }

  if (!token) return <Tela><Aviso texto="Entre no painel do professor para ver esta página." /></Tela>;
  if (painel.isLoading) return <Tela><div className="flex justify-center py-16"><Loader2 className="animate-spin" style={{ color: ORANGE }} /></div></Tela>;
  if (painel.error) return <Tela><Aviso texto={painel.error.message} erro /></Tela>;
  if (!d) return null;

  const maxFaixa = Math.max(1, ...d.distribuicao.map(f => f.alunos));

  return (
    <Tela>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-bold text-white">Painel da prova — {prova}</h1>
          <p className="text-xs text-white/50">Turma {classId}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={`/correcao?p=${prova}&c=${classId}`} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-white" style={{ backgroundColor: "rgba(255,255,255,0.1)" }}>
            <ScanLine size={15} /> Corrigir cartões
          </a>
          <button onClick={fazerRecorrecao} disabled={recorrigir.isPending} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-white" style={{ backgroundColor: "rgba(255,255,255,0.1)" }}>
            <RefreshCw size={15} className={recorrigir.isPending ? "animate-spin" : ""} /> Recorrigir
          </button>
          <button onClick={alternarLiberacao} disabled={liberar.isPending} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-white" style={{ backgroundColor: d.liberado ? "#10b981" : ORANGE }}>
            {d.liberado ? <><Eye size={15} /> Resultado liberado</> : <><EyeOff size={15} /> Liberar resultado</>}
          </button>
        </div>
      </div>

      {msg && <div className="mb-4 rounded-lg p-3 text-sm text-white" style={{ backgroundColor: "rgba(247,148,29,0.15)", border: `1px solid ${ORANGE}55` }}>{msg}</div>}

      {/* Resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
        <Cartao rotulo="Corrigidos" valor={`${d.corrigidos}/${d.totalAlunos}`} />
        <Cartao rotulo="Ausentes" valor={String(d.ausentes.length)} />
        <Cartao rotulo="Média" valor={d.media.toFixed(1)} />
        <Cartao rotulo="Mediana" valor={d.mediana.toFixed(1)} />
        <Cartao rotulo="Nota ≥ 6" valor={`${d.aprovados6}`} />
      </div>

      {d.notasManuais > 0 && (
        <p className="text-xs text-amber-300 mb-4">
          {d.notasManuais} nota(s) foram lançadas à mão na planilha (sem cartão) e não entram na estatística por questão.
        </p>
      )}

      <div className="grid md:grid-cols-2 gap-4 mb-5">
        {/* Distribuição */}
        <div className="rounded-xl p-4" style={{ backgroundColor: CARD_BG }}>
          <p className="text-sm font-semibold text-white mb-3">Distribuição das notas</p>
          <div className="space-y-1.5">
            {d.distribuicao.map(f => (
              <div key={f.faixa} className="flex items-center gap-2 text-xs">
                <span className="w-12 text-white/60 text-right">{f.faixa}</span>
                <div className="flex-1 h-4 rounded bg-white/5 overflow-hidden">
                  <div className="h-full rounded" style={{ width: `${(f.alunos / maxFaixa) * 100}%`, backgroundColor: ORANGE }} />
                </div>
                <span className="w-6 text-white/80">{f.alunos}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Versões e ausentes */}
        <div className="rounded-xl p-4" style={{ backgroundColor: CARD_BG }}>
          <p className="text-sm font-semibold text-white mb-3">Cartões por versão</p>
          <div className="flex flex-wrap gap-2 mb-4">
            {d.porVersao.map(v => (
              <span key={v.versao} className="px-3 py-1.5 rounded-lg text-sm text-white" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
                <b>{v.versao}</b>: {v.alunos}
              </span>
            ))}
          </div>
          <button onClick={() => setMostrarAusentes(x => !x)} className="flex items-center gap-1.5 text-sm text-white/80 hover:text-white">
            <Users size={15} /> {mostrarAusentes ? "Ocultar" : "Ver"} ausentes ({d.ausentes.length})
          </button>
          {mostrarAusentes && (
            <ul className="mt-2 max-h-48 overflow-y-auto text-sm text-white/70 space-y-0.5">
              {d.ausentes.map(a => <li key={a.id}>{a.nome}</li>)}
              {d.ausentes.length === 0 && <li>Nenhum ausente.</li>}
            </ul>
          )}
        </div>
      </div>

      {/* Questões */}
      <div className="rounded-xl p-4" style={{ backgroundColor: CARD_BG }}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-white">Análise por questão</p>
          {!d.temMapa && <span className="text-xs text-amber-300">Sem mapa da prova: estatística por posição na versão, sem anulação.</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-white/85">
            <thead>
              <tr className="text-xs text-white/50 text-left">
                <th className="py-2 pr-2">{d.temMapa ? "Nº (versão A)" : "Posição"}</th>
                <th className="py-2 pr-2">Tema</th>
                <th className="py-2 pr-2 text-right">Acerto</th>
                <th className="py-2 pr-2 text-right" title="Diferença de acerto entre os 27% melhores e os 27% piores. Acima de 0,3 é boa; negativa indica problema.">Discrim.</th>
                <th className="py-2 pr-2">Marcadas (A–E)</th>
                <th className="py-2 pr-2">Alerta</th>
                {d.temMapa && <th className="py-2"></th>}
              </tr>
            </thead>
            <tbody>
              {d.questoes.map(q => {
                const total = Object.values(q.marcadas).reduce((s, v) => s + v, 0) + q.brancos;
                return (
                  <tr key={`${q.questaoOriginal ?? q.posicao}`} className="border-t border-white/5" style={{ opacity: q.anulada ? 0.55 : 1 }}>
                    <td className="py-2 pr-2 font-mono">{q.posA ?? q.posicao}{q.anulada && <span className="ml-1 text-xs text-red-300">anulada</span>}</td>
                    <td className="py-2 pr-2 text-xs text-white/60">{q.tema || "—"}</td>
                    <td className="py-2 pr-2 text-right font-semibold" style={{ color: q.pctAcerto < 30 ? "#f87171" : q.pctAcerto > 85 ? "#34d399" : "white" }}>{q.pctAcerto}%</td>
                    <td className="py-2 pr-2 text-right" style={{ color: q.discriminacao < 0 ? "#f87171" : q.discriminacao >= 0.3 ? "#34d399" : "white" }}>{q.discriminacao.toFixed(2)}</td>
                    <td className="py-2 pr-2">
                      <div className="flex gap-1">
                        {ALTS.map(l => {
                          const v = q.marcadas[l] || 0;
                          const certa = q.correta === l;
                          return (
                            <span key={l} title={`${l}: ${v} aluno(s)`} className="inline-flex flex-col items-center w-9 rounded text-[11px] py-0.5"
                              style={{ backgroundColor: certa ? "rgba(16,185,129,0.25)" : "rgba(255,255,255,0.05)", border: certa ? "1px solid #10b981" : "1px solid transparent" }}>
                              <b>{l}</b>{total ? Math.round((v / total) * 100) : 0}%
                            </span>
                          );
                        })}
                        {q.brancos > 0 && <span className="text-[11px] text-white/40 self-center ml-1">{q.brancos} em branco</span>}
                      </div>
                    </td>
                    <td className="py-2 pr-2 text-xs">{q.alerta ? <span className="flex items-center gap-1 text-amber-300"><AlertTriangle size={12} /> {q.alerta}</span> : <span className="text-white/30">—</span>}</td>
                    {d.temMapa && q.questaoOriginal !== null && (
                      <td className="py-2">
                        <button onClick={() => alternarAnulacao(q.questaoOriginal!, q.anulada)} disabled={anular.isPending}
                          className="flex items-center gap-1 px-2 py-1 rounded text-xs text-white" style={{ backgroundColor: q.anulada ? "rgba(255,255,255,0.1)" : "rgba(239,68,68,0.25)" }}>
                          {q.anulada ? <><Undo2 size={12} /> Desfazer</> : <><Ban size={12} /> Anular</>}
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-white/40 mt-3">
          A alternativa em verde é a correta. As letras seguem a versão A (as das outras versões são convertidas pelo mapa).
          Distrator muito marcado e discriminação negativa são os sinais mais fortes de questão mal formulada ou gabarito errado.
        </p>
      </div>
    </Tela>
  );
}

function Tela({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen" style={{ backgroundColor: DARK_BG }}><div className="max-w-6xl mx-auto px-4 py-6">{children}</div></div>;
}
function Aviso({ texto, erro }: { texto: string; erro?: boolean }) {
  return <div className="rounded-xl p-5 text-center" style={{ backgroundColor: CARD_BG }}><p className={erro ? "text-red-400 text-sm" : "text-white/60 text-sm"}>{texto}</p></div>;
}
function Cartao({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="rounded-xl p-3" style={{ backgroundColor: CARD_BG }}>
      <p className="text-xs text-white/50">{rotulo}</p>
      <p className="text-xl font-bold text-white">{valor}</p>
    </div>
  );
}
