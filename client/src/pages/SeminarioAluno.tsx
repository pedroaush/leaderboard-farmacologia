import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Eye, CheckCircle, XCircle, Clock, Loader2, FileText, BookOpen, Send } from "lucide-react";

const CARD_BG = "#0D1B2A";
const ORANGE = "#F7941D";
const INDIGO = "#6366f1";

type Props = {
  classId: number;
  /** Token do aluno ou, no modo conferência, do professor/monitor */
  token: string | null;
  modoConferencia: boolean;
};

type Resultado = { ok: boolean; msg: string; acertou?: boolean };

export default function SeminarioAluno({ classId, token, modoConferencia }: Props) {
  const [incluirNaoLiberadas, setIncluirNaoLiberadas] = useState(false);
  const [escolhas, setEscolhas] = useState<Record<number, string>>({});
  const [resultados, setResultados] = useState<Record<number, Resultado>>({});
  const [enviando, setEnviando] = useState<number | null>(null);

  const enabled = !!token;
  const quiz = trpc.seminarioPoster.getQuizDisponivel.useQuery(
    { studentSessionToken: token || "", classId, incluirNaoLiberadas: modoConferencia && incluirNaoLiberadas },
    { enabled, refetchInterval: 10_000 }
  );
  const encerradas = trpc.seminarioPoster.getPerguntasEncerradas.useQuery(
    { studentSessionToken: token || "", classId },
    { enabled, refetchInterval: 30_000 }
  );
  const nota = trpc.seminarioPoster.getNotaSeminario.useQuery(
    { studentSessionToken: token || "", classId },
    { enabled }
  );
  const responder = trpc.seminarioPoster.responderPergunta.useMutation();

  async function enviar(questionId: number) {
    const alt = escolhas[questionId];
    if (!alt || !token) return;
    setEnviando(questionId);
    try {
      const r: any = await responder.mutateAsync({ studentSessionToken: token, questionId, respostaEscolhida: alt });
      setResultados(p => ({ ...p, [questionId]: { ok: true, msg: r.message, acertou: r.conferencia ? r.acertou : undefined } }));
      if (!r.conferencia) nota.refetch();
    } catch (e: any) {
      setResultados(p => ({ ...p, [questionId]: { ok: false, msg: e?.message || "Não foi possível enviar a resposta" } }));
    } finally {
      setEnviando(null);
    }
  }

  if (!token) {
    return <p className="text-sm text-white/50">Faça login para ver o Seminário.</p>;
  }

  const notaData: any = nota.data;
  const perguntas = quiz.data || [];
  const encerradasList = encerradas.data || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 sm:gap-3">
        <FileText size={22} style={{ color: ORANGE }} />
        <h2 className="text-xl sm:text-2xl font-bold text-white">Seminário: pôster e perguntas</h2>
      </div>

      {modoConferencia && (
        <div className="rounded-lg p-3 sm:p-4" style={{ backgroundColor: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.4)" }}>
          <div className="flex items-start gap-2">
            <Eye size={18} className="shrink-0 mt-0.5" style={{ color: INDIGO }} />
            <div className="flex-1">
              <p className="text-sm font-semibold text-white">Modo conferência</p>
              <p className="text-xs text-white/60 mt-0.5">
                Você está vendo esta aba como um aluno veria. Respostas enviadas aqui são corrigidas para você, mas não são gravadas e não entram em nenhuma nota.
              </p>
              <label className="flex items-center gap-2 mt-2 text-xs text-white/80 cursor-pointer">
                <input
                  type="checkbox"
                  checked={incluirNaoLiberadas}
                  onChange={e => setIncluirNaoLiberadas(e.target.checked)}
                />
                Mostrar também as perguntas aprovadas que ainda não foram liberadas
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Nota */}
      <div className="rounded-lg p-4" style={{ backgroundColor: CARD_BG, border: "1px solid rgba(99,102,241,0.3)" }}>
        <h3 className="font-bold text-white text-sm mb-3">Sua nota de Seminário</h3>
        {nota.isLoading ? (
          <Loader2 size={16} className="animate-spin" style={{ color: ORANGE }} />
        ) : notaData?.conferencia ? (
          <p className="text-xs text-white/50">No modo conferência não há nota. O aluno vê aqui a nota do pôster do grupo, o desempenho individual e a nota final (50% cada).</p>
        ) : notaData ? (
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 rounded-lg" style={{ backgroundColor: "rgba(255,255,255,0.04)" }}>
              <div className="font-mono font-bold text-lg text-white">{Number(notaData.notaPosterGrupo).toFixed(1)}</div>
              <div className="text-[11px] text-white/50">Pôster do grupo</div>
            </div>
            <div className="p-2 rounded-lg" style={{ backgroundColor: "rgba(255,255,255,0.04)" }}>
              <div className="font-mono font-bold text-lg text-white">{Number(notaData.notaIndividual).toFixed(1)}</div>
              <div className="text-[11px] text-white/50">Individual ({notaData.acertos}/{notaData.totalRespondidas})</div>
            </div>
            <div className="p-2 rounded-lg" style={{ backgroundColor: "rgba(99,102,241,0.15)" }}>
              <div className="font-mono font-bold text-lg" style={{ color: INDIGO }}>{Number(notaData.notaSeminario).toFixed(1)}</div>
              <div className="text-[11px] text-white/50">Nota final</div>
            </div>
          </div>
        ) : (
          <p className="text-xs text-white/50">Nota ainda não disponível.</p>
        )}
      </div>

      {/* Perguntas abertas */}
      <div>
        <h3 className="font-bold text-white text-sm mb-2 flex items-center gap-1.5">
          <Clock size={14} style={{ color: ORANGE }} /> Perguntas para responder agora
        </h3>
        {quiz.isLoading ? (
          <Loader2 size={16} className="animate-spin" style={{ color: ORANGE }} />
        ) : quiz.error ? (
          <p className="text-xs text-red-400">{quiz.error.message}</p>
        ) : perguntas.length === 0 ? (
          <div className="rounded-lg p-5 text-center" style={{ backgroundColor: CARD_BG, border: "1px solid rgba(255,255,255,0.1)" }}>
            <p className="text-sm text-white/60">Nenhuma pergunta aberta no momento.</p>
            <p className="text-xs text-white/40 mt-1">As perguntas de cada grupo abrem logo depois da apresentação do pôster e ficam disponíveis por poucos minutos.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {perguntas.map((p: any) => {
              const res = resultados[p.id];
              return (
                <div key={p.id} className="rounded-lg p-4" style={{ backgroundColor: CARD_BG, border: "1px solid rgba(247,148,29,0.3)" }}>
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(247,148,29,0.15)", color: ORANGE }}>{p.topico}</span>
                    {p.situacao === "nao_liberada" ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/60">Ainda não liberada</span>
                    ) : p.expiraEm ? (
                      <span className="text-xs text-white/50">
                        Aberta até {new Date(p.expiraEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm text-white mb-3">{p.enunciado}</p>
                  <div className="space-y-1.5">
                    {p.alternativas.map((a: any, idx: number) => {
                      const selecionada = escolhas[p.id] === a.id;
                      return (
                        <button
                          key={a.id}
                          onClick={() => setEscolhas(prev => ({ ...prev, [p.id]: a.id }))}
                          className="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors"
                          style={{
                            backgroundColor: selecionada ? "rgba(247,148,29,0.18)" : "rgba(255,255,255,0.03)",
                            border: selecionada ? `1px solid ${ORANGE}` : "1px solid rgba(255,255,255,0.08)",
                            color: "white",
                          }}
                        >
                          <span className="font-semibold mr-2" style={{ color: selecionada ? ORANGE : "rgba(255,255,255,0.4)" }}>
                            {String.fromCharCode(65 + idx)})
                          </span>
                          {a.texto}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-3 mt-3 flex-wrap">
                    <button
                      onClick={() => enviar(p.id)}
                      disabled={!escolhas[p.id] || enviando === p.id}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-40"
                      style={{ backgroundColor: ORANGE }}
                    >
                      {enviando === p.id ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                      {res?.ok ? "Enviar de novo" : "Enviar resposta"}
                    </button>
                    {res && (
                      <span className={`text-xs flex items-center gap-1 ${res.ok ? "text-white/70" : "text-red-400"}`}>
                        {res.acertou === true && <CheckCircle size={13} className="text-emerald-400" />}
                        {res.acertou === false && <XCircle size={13} className="text-red-400" />}
                        {res.msg}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Encerradas, com gabarito */}
      <div>
        <h3 className="font-bold text-white text-sm mb-2 flex items-center gap-1.5">
          <BookOpen size={14} style={{ color: ORANGE }} /> Perguntas encerradas, com gabarito
        </h3>
        {encerradasList.length === 0 ? (
          <p className="text-xs text-white/40">Quando o tempo de uma pergunta acabar, ela aparece aqui com a resposta certa, para estudo.</p>
        ) : (
          <div className="space-y-3">
            {encerradasList.map((p: any) => (
              <div key={p.id} className="rounded-lg p-4" style={{ backgroundColor: CARD_BG, border: "1px solid rgba(255,255,255,0.1)" }}>
                <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-white/60">{p.topico}</span>
                <p className="text-sm text-white mt-2 mb-2">{p.enunciado}</p>
                <div className="space-y-1">
                  {(p.alternativas as any[]).map((a: any, idx: number) => (
                    <div
                      key={a.id}
                      className="px-3 py-1.5 rounded text-sm flex items-start gap-2"
                      style={{
                        backgroundColor: a.correta ? "rgba(16,185,129,0.12)" : "transparent",
                        color: a.correta ? "#10B981" : "rgba(255,255,255,0.6)",
                      }}
                    >
                      <span className="font-semibold">{String.fromCharCode(65 + idx)})</span>
                      <span className="flex-1">{a.texto}</span>
                      {a.correta && <CheckCircle size={14} className="shrink-0 mt-0.5" />}
                    </div>
                  ))}
                </div>
                {p.explicacao && <p className="text-xs text-white/50 mt-2">{p.explicacao}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
