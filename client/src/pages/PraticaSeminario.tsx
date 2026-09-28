/**
 * PraticaSeminario.tsx — quiz assíncrono do Seminário Pôster (cada aluno
 * responde sozinho, no próprio ritmo, dentro da janela liberada pelo
 * professor). Usa o router seminarioPoster já existente no back-end.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Link } from "wouter";
import {
  ArrowLeft, BookOpen, Loader2, CheckCircle2, Clock, Trophy,
  ChevronDown, ChevronUp, GraduationCap,
} from "lucide-react";
import { useStudentAuth } from "@/pages/StudentLogin";

const ORANGE = "#F7941D";
const DARK_BG = "#0A1628";
const CARD_BG = "#0D1B2A";

function tempoRestante(expiraEm: string): string {
  const ms = new Date(expiraEm).getTime() - Date.now();
  if (ms <= 0) return "expirando...";
  const min = Math.floor(ms / 60000);
  const seg = Math.floor((ms % 60000) / 1000);
  return `${min}min ${seg}s`;
}

function PerguntaDisponivel({ pergunta, sessionToken, onRespondida }: { pergunta: any; sessionToken: string; onRespondida: () => void }) {
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [enviada, setEnviada] = useState(false);

  const responder = trpc.seminarioPoster.responderPergunta.useMutation({
    onSuccess: () => {
      setEnviada(true);
      toast.success("Resposta registrada!");
      onRespondida();
    },
    onError: (e) => toast.error(e.message || "Erro ao enviar resposta"),
  });

  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: CARD_BG, border: "1px solid rgba(255,255,255,0.08)" }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: ORANGE }}>{pergunta.topico}</span>
        <span className="text-xs flex items-center gap-1" style={{ color: "rgba(255,255,255,0.4)" }}>
          <Clock size={11} /> {tempoRestante(pergunta.expiraEm)}
        </span>
      </div>
      <p className="text-white text-sm leading-relaxed mb-3">{pergunta.enunciado}</p>
      <div className="space-y-2">
        {pergunta.alternativas.map((alt: any) => (
          <button
            key={alt.id}
            onClick={() => !enviada && setSelecionada(alt.id)}
            disabled={enviada}
            className="w-full text-left rounded-lg border p-2.5 text-sm transition-colors disabled:opacity-60"
            style={{
              backgroundColor: selecionada === alt.id ? ORANGE : "rgba(255,255,255,0.04)",
              borderColor: selecionada === alt.id ? ORANGE : "rgba(255,255,255,0.1)",
              color: selecionada === alt.id ? "#0A1628" : "#fff",
            }}
          >
            <strong className="mr-1.5">{alt.id})</strong>{alt.texto}
          </button>
        ))}
      </div>
      {!enviada ? (
        <button
          onClick={() => responder.mutate({ studentSessionToken: sessionToken, questionId: pergunta.id, respostaEscolhida: selecionada || "" })}
          disabled={!selecionada || responder.isPending}
          className="mt-3 w-full py-2 rounded-lg font-medium text-sm disabled:opacity-40"
          style={{ backgroundColor: ORANGE, color: "#0A1628" }}
        >
          {responder.isPending ? "Enviando..." : "Confirmar Resposta"}
        </button>
      ) : (
        <div className="mt-3 flex items-center justify-center gap-1.5 py-2 text-sm text-emerald-400">
          <CheckCircle2 size={16} /> Resposta enviada
        </div>
      )}
    </div>
  );
}

function PerguntaEncerrada({ pergunta }: { pergunta: any }) {
  const [aberta, setAberta] = useState(false);
  const correta = pergunta.alternativas.find((a: any) => a.correta);
  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: CARD_BG, border: "1px solid rgba(255,255,255,0.08)" }}>
      <button onClick={() => setAberta(v => !v)} className="w-full flex items-center justify-between p-3 text-left">
        <div className="min-w-0">
          <span className="text-xs font-semibold uppercase tracking-wide block" style={{ color: ORANGE }}>{pergunta.topico}</span>
          <p className="text-white text-sm truncate">{pergunta.enunciado}</p>
        </div>
        {aberta ? <ChevronUp size={16} className="text-gray-400 shrink-0 ml-2" /> : <ChevronDown size={16} className="text-gray-400 shrink-0 ml-2" />}
      </button>
      {aberta && (
        <div className="px-3 pb-3 space-y-2">
          {pergunta.alternativas.map((alt: any) => (
            <div
              key={alt.id}
              className="rounded-lg border p-2.5 text-sm"
              style={{
                backgroundColor: alt.correta ? "rgba(52,211,153,0.12)" : "rgba(255,255,255,0.03)",
                borderColor: alt.correta ? "rgba(52,211,153,0.4)" : "rgba(255,255,255,0.1)",
                color: alt.correta ? "#6ee7b7" : "rgba(255,255,255,0.7)",
              }}
            >
              <strong className="mr-1.5">{alt.id})</strong>{alt.texto}
              {alt.correta && <CheckCircle2 size={14} className="inline ml-1.5" />}
            </div>
          ))}
          {pergunta.explicacao && (
            <div className="rounded-lg p-3 text-xs leading-relaxed" style={{ backgroundColor: "rgba(59,130,246,0.1)", color: "#93c5fd" }}>
              {pergunta.explicacao}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function PraticaSeminario() {
  const { student, sessionToken } = useStudentAuth();
  const classId = student?.classId;

  const { data: disponiveis, isLoading: carregandoDisponiveis, refetch } = trpc.seminarioPoster.getQuizDisponivel.useQuery(
    { studentSessionToken: sessionToken || "", classId: classId! },
    { enabled: !!sessionToken && !!classId, refetchInterval: 15000 }
  );
  const { data: encerradas, isLoading: carregandoEncerradas } = trpc.seminarioPoster.getPerguntasEncerradas.useQuery(
    { studentSessionToken: sessionToken || "", classId: classId! },
    { enabled: !!sessionToken && !!classId }
  );
  const { data: minhaNota } = trpc.seminarioPoster.getNotaSeminario.useQuery(
    { studentSessionToken: sessionToken || "", classId: classId! },
    { enabled: !!sessionToken && !!classId }
  );

  if (!sessionToken) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: DARK_BG }}>
        <div className="text-center">
          <p className="text-white mb-4">Faça login para acessar as perguntas do Seminário.</p>
          <Link href="/login-aluno" className="text-sm underline" style={{ color: ORANGE }}>Ir para o login</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: DARK_BG }}>
      <div className="px-4 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.08)", backgroundColor: CARD_BG }}>
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Link href="/leaderboard" className="p-2 -ml-2 rounded-lg hover:bg-white/10 transition-colors">
            <ArrowLeft size={18} style={{ color: "rgba(255,255,255,0.6)" }} />
          </Link>
          <div>
            <h1 className="text-sm font-bold text-white flex items-center gap-1.5"><BookOpen size={16} style={{ color: ORANGE }} /> Perguntas do Seminário</h1>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Responda no seu próprio ritmo, dentro da janela liberada</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Minha nota */}
        {minhaNota && minhaNota.totalRespondidas > 0 && (
          <div className="rounded-xl p-4 flex items-center gap-3" style={{ backgroundColor: CARD_BG, border: "1px solid rgba(247,148,29,0.3)" }}>
            <Trophy size={24} style={{ color: ORANGE }} />
            <div>
              <p className="text-white text-sm font-medium">
                Nota de Seminário até agora: <span style={{ color: ORANGE }}>{minhaNota.notaSeminario.toFixed(1)}</span>
              </p>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                {minhaNota.acertos}/{minhaNota.totalRespondidas} corretas · pôster do grupo: {minhaNota.notaPosterGrupo.toFixed(1)}
              </p>
            </div>
          </div>
        )}

        {/* Disponíveis agora */}
        <div>
          <p className="text-sm font-semibold text-white mb-3">Disponíveis agora</p>
          {carregandoDisponiveis ? (
            <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin" style={{ color: ORANGE }} /></div>
          ) : !disponiveis?.length ? (
            <p className="text-sm text-center py-8" style={{ color: "rgba(255,255,255,0.4)" }}>
              Nenhuma pergunta liberada no momento. Volte quando o professor liberar a janela de respostas.
            </p>
          ) : (
            <div className="space-y-3">
              {disponiveis.map((p: any) => (
                <PerguntaDisponivel key={p.id} pergunta={p} sessionToken={sessionToken} onRespondida={refetch} />
              ))}
            </div>
          )}
        </div>

        {/* Encerradas (material de estudo, com gabarito) */}
        {!!encerradas?.length && (
          <div>
            <p className="text-sm font-semibold text-white mb-3 flex items-center gap-1.5">
              <GraduationCap size={15} style={{ color: ORANGE }} /> Perguntas encerradas — com gabarito
            </p>
            <div className="space-y-2">
              {encerradas.map((p: any) => <PerguntaEncerrada key={p.id} pergunta={p} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
