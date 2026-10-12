/**
 * Resultado da prova para o aluno (aba "Provas" do portal do aluno).
 * Só mostra algo depois que o professor libera no Painel da prova.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Loader2, CheckCircle2, XCircle, Lock, MinusCircle, MessageSquareText } from "lucide-react";

const ORANGE = "#F7941D";
const CARD_BG = "#0D1B2A";

export default function MeuResultadoProva({ token }: { token: string | null }) {
  const [prova, setProva] = useState<"P1" | "P2">("P1");
  const [soErros, setSoErros] = useState(false);
  const r = trpc.correcaoProva.getMeuResultado.useQuery(
    { sessionToken: token || "", provaType: prova },
    { enabled: !!token, retry: false }
  );

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(["P1", "P2"] as const).map(p => (
          <button key={p} onClick={() => setProva(p)} className="px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ backgroundColor: prova === p ? ORANGE : "rgba(255,255,255,0.06)", color: prova === p ? "#fff" : "rgba(255,255,255,0.7)" }}>
            {p}
          </button>
        ))}
      </div>

      {!token ? (
        <Caixa><p className="text-white/60 text-sm">Entre com a sua conta de aluno para ver o resultado.</p></Caixa>
      ) : r.isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="animate-spin" style={{ color: ORANGE }} /></div>
      ) : r.error ? (
        <Caixa><p className="text-red-400 text-sm">{r.error.message}</p></Caixa>
      ) : !r.data?.liberado ? (
        <Caixa>
          <div className="flex items-center gap-3 text-white/70 text-sm">
            <Lock size={18} /> O resultado da {prova} ainda não foi liberado pelo professor.
          </div>
        </Caixa>
      ) : !r.data.fezProva ? (
        <Caixa><p className="text-white/70 text-sm">Não há cartão-resposta seu corrigido na {prova}. Se você fez a prova, procure o professor.</p></Caixa>
      ) : (
        <>
          <Caixa>
            <div className="flex flex-wrap items-end gap-6">
              <div>
                <p className="text-xs text-white/50">Nota</p>
                <p className="text-4xl font-bold text-white">{r.data.nota.toFixed(1)}</p>
              </div>
              <div>
                <p className="text-xs text-white/50">Acertos</p>
                <p className="text-xl font-semibold text-white">{r.data.acertos}/{r.data.total}</p>
              </div>
              <div>
                <p className="text-xs text-white/50">Versão</p>
                <p className="text-xl font-semibold text-white">{r.data.versao}</p>
              </div>
            </div>
          </Caixa>

          {(r.data as any).parecer && (
            <Caixa>
              <p className="text-sm font-semibold text-white mb-2">Parecer do professor</p>
              <p className="text-sm text-white/80 whitespace-pre-line leading-relaxed">{(r.data as any).parecer}</p>
            </Caixa>
          )}

          <Caixa>
            <p className="text-sm font-semibold text-white mb-3">Suas respostas × gabarito da versão {r.data.versao}</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2">
              {r.data.questoes.map(q => (
                <div key={q.numero} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
                  style={{ backgroundColor: q.anulada ? "rgba(255,255,255,0.05)" : q.acertou ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)" }}>
                  {q.anulada ? <MinusCircle size={15} className="text-white/50" /> : q.acertou ? <CheckCircle2 size={15} className="text-emerald-400" /> : <XCircle size={15} className="text-red-400" />}
                  <span className="font-mono text-white/80">{String(q.numero).padStart(2, "0")}</span>
                  <span className="text-white">{q.marcada ?? "—"}</span>
                  {q.anulada ? <span className="text-[11px] text-white/50">anulada</span>
                    : !q.acertou && <span className="text-[11px] text-emerald-300">certa: {q.correta}</span>}
                </div>
              ))}
            </div>
            <p className="text-[11px] text-white/40 mt-3">Questões anuladas valem ponto para todos. "—" = em branco, rasurada ou com mais de uma marcação.</p>
          </Caixa>

          {r.data.questoes.some((q: any) => q.comentario) && (
            <Caixa>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <p className="text-sm font-semibold text-white flex items-center gap-2">
                  <MessageSquareText size={16} style={{ color: ORANGE }} /> Gabarito comentado
                </p>
                <label className="flex items-center gap-2 text-xs text-white/60 cursor-pointer">
                  <input type="checkbox" checked={soErros} onChange={(e) => setSoErros(e.target.checked)} />
                  mostrar só as que errei
                </label>
              </div>
              <div className="space-y-3">
                {r.data.questoes
                  .filter((q: any) => q.comentario && (!soErros || (!q.acertou && !q.anulada)))
                  .map((q: any) => (
                    <div key={q.numero} className="rounded-lg p-3"
                      style={{ backgroundColor: "rgba(255,255,255,0.03)", borderLeft: `3px solid ${q.anulada ? "rgba(255,255,255,0.3)" : q.acertou ? "#10b981" : "#ef4444"}` }}>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs mb-1">
                        <span className="font-semibold text-white">Questão {q.numero}</span>
                        {q.tema && <span className="text-white/45">{q.tema}</span>}
                        <span className="text-white/60">sua resposta: <b className="text-white">{q.marcada ?? "—"}</b></span>
                        {q.anulada ? <span className="text-white/50">anulada</span> : <span className="text-emerald-300">correta: <b>{q.correta}</b></span>}
                      </div>
                      <p className="text-sm text-white/80 whitespace-pre-line leading-relaxed">{q.comentario}</p>
                    </div>
                  ))}
                {soErros && !r.data.questoes.some((q: any) => q.comentario && !q.acertou && !q.anulada) && (
                  <p className="text-sm text-white/50">Você não errou nenhuma questão comentada. 🎉</p>
                )}
              </div>
            </Caixa>
          )}
        </>
      )}
    </div>
  );
}

function Caixa({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl p-4" style={{ backgroundColor: CARD_BG }}>{children}</div>;
}
