/**
 * Resultado da prova para o aluno (aba "Provas" do portal do aluno).
 * Só mostra algo depois que o professor libera no Painel da prova.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Loader2, CheckCircle2, XCircle, Lock, MinusCircle } from "lucide-react";

const ORANGE = "#F7941D";
const CARD_BG = "#0D1B2A";

export default function MeuResultadoProva({ token }: { token: string | null }) {
  const [prova, setProva] = useState<"P1" | "P2">("P1");
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
        </>
      )}
    </div>
  );
}

function Caixa({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl p-4" style={{ backgroundColor: CARD_BG }}>{children}</div>;
}
