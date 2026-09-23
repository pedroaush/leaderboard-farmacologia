/**
 * PraticaSimulada.tsx — tela do aluno pra Casos Clínicos: Prática Simulada.
 * Lista as simulações disponíveis pra turma dele, abre num modal com
 * iframe, e escuta o postMessage do simulador pra registrar o progresso.
 */
import { useState, useCallback, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { ArrowLeft, FlaskConical, Loader2, X, CheckCircle2, Play } from "lucide-react";
import { useStudentAuth } from "@/pages/StudentLogin";

const ORANGE = "#F7941D";
const DARK_BG = "#0A1628";
const CARD_BG = "#0D1B2A";

function SimuladorModal({
  simulacaoId, classId, sessionToken, onClose,
}: { simulacaoId: number; classId: number; sessionToken: string; onClose: () => void }) {
  const { data, isLoading } = trpc.simulacoesClinicas.abrir.useQuery({ sessionToken, simulacaoId });
  const registrarProgresso = trpc.simulacoesClinicas.registrarProgresso.useMutation();

  const handleMessage = useCallback((event: MessageEvent) => {
    const msg = event.data;
    if (!msg || typeof msg !== "object" || !msg.type || !String(msg.type).includes("simulation-progress")) return;
    registrarProgresso.mutate({
      sessionToken,
      simulacaoId,
      classId,
      currentStep: msg.currentStep ?? 0,
      completedSteps: msg.completedSteps ?? 0,
      totalSteps: msg.totalSteps ?? 5,
      score: msg.score ?? 0,
      maxScore: msg.maxScore ?? 5,
      completed: !!msg.completed,
    });
  }, [sessionToken, simulacaoId, classId]);

  useEffect(() => {
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [handleMessage]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4" style={{ backgroundColor: "rgba(0,0,0,0.9)" }}>
      <div className="w-full max-w-4xl h-[90vh] rounded-xl overflow-hidden flex flex-col" style={{ backgroundColor: CARD_BG, border: "1px solid rgba(255,255,255,0.1)" }}>
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <p className="text-sm font-medium text-white truncate">{data?.titulo || "Carregando..."}</p>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
            <X size={18} style={{ color: "rgba(255,255,255,0.6)" }} />
          </button>
        </div>
        <div className="flex-1 bg-white">
          {isLoading ? (
            <div className="w-full h-full flex items-center justify-center">
              <Loader2 size={28} className="animate-spin" style={{ color: ORANGE }} />
            </div>
          ) : (
            <iframe
              srcDoc={data?.htmlConteudo || ""}
              title={data?.titulo || "Simulação"}
              className="w-full h-full border-0"
              sandbox="allow-scripts allow-same-origin"
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default function PraticaSimulada() {
  const { student, sessionToken } = useStudentAuth();
  const [openId, setOpenId] = useState<number | null>(null);
  const classId = student?.classId;

  const { data: simulacoes, isLoading, refetch } = trpc.simulacoesClinicas.listarDisponiveis.useQuery(
    { sessionToken: sessionToken || "", classId: classId! },
    { enabled: !!sessionToken && !!classId }
  );

  if (!sessionToken) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: DARK_BG }}>
        <div className="text-center">
          <p className="text-white mb-4">Faça login para acessar as práticas simuladas.</p>
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
            <h1 className="text-sm font-bold text-white flex items-center gap-1.5"><FlaskConical size={16} style={{ color: ORANGE }} /> Prática Simulada</h1>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Casos clínicos interativos pra você jogar sozinho</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin" style={{ color: ORANGE }} />
          </div>
        ) : !simulacoes?.length ? (
          <div className="text-center py-16">
            <FlaskConical size={40} className="mx-auto mb-3" style={{ color: "rgba(255,255,255,0.2)" }} />
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>Nenhuma prática simulada disponível ainda.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {simulacoes.map((s: any) => (
              <button
                key={s.id}
                onClick={() => setOpenId(s.id)}
                className="w-full flex items-center gap-3 p-4 rounded-lg text-left transition-colors hover:bg-white/5"
                style={{ backgroundColor: CARD_BG, border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: s.completado ? "rgba(52,211,153,0.15)" : "rgba(247,148,29,0.12)" }}>
                  {s.completado ? <CheckCircle2 size={18} className="text-emerald-400" /> : <Play size={18} style={{ color: ORANGE }} />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white truncate">{s.titulo}</p>
                  {s.descricao && <p className="text-xs truncate" style={{ color: "rgba(255,255,255,0.4)" }}>{s.descricao}</p>}
                </div>
                {s.completado && (
                  <span className="text-xs font-mono font-bold text-emerald-400 shrink-0">{s.meuScore}/{s.pontuacaoMaxima}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {openId && classId && (
        <SimuladorModal
          simulacaoId={openId}
          classId={classId}
          sessionToken={sessionToken}
          onClose={() => { setOpenId(null); refetch(); }}
        />
      )}
    </div>
  );
}