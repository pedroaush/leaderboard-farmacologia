/**
 * LiveQuizStudent - Tela do aluno para o Quiz ao Vivo (P2)
 * Design: Conexão Farmacologia — vermelho escarlate, fundo escuro
 * Fluxo: digitar código → aguardar no lobby → responder questões → ver gabarito e nota
 */
import { useState, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  CheckCircle2, XCircle, Clock, BookOpen, Loader2, AlertCircle,
  ChevronRight, Trophy, Wifi, WifiOff
} from "lucide-react";

interface LiveQuizStudentProps {
  studentToken: string;
  studentName: string;
}

export default function LiveQuizStudent({ studentToken, studentName }: LiveQuizStudentProps) {
  const [code, setCode] = useState("");
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [joinData, setJoinData] = useState<any>(null);
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [phase, setPhase] = useState<"enter_code" | "lobby" | "question" | "waiting" | "finished" | "gabarito">("enter_code");
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Monitorar conexão
  useEffect(() => {
    const handleOnline = () => { setIsOnline(true); toast.success("Conexão restaurada!"); };
    const handleOffline = () => { setIsOnline(false); toast.error("Sem conexão — suas respostas estão salvas"); };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => { window.removeEventListener("online", handleOnline); window.removeEventListener("offline", handleOffline); };
  }, []);

  // Entrar no quiz
  const { data: joinResult, refetch: refetchJoin } = trpc.studentAuth.joinLiveQuiz.useQuery(
    { accessCode: code.toUpperCase(), sessionToken: studentToken },
    { enabled: false }
  );

  // Questão atual (polling a cada 2s)
  const { data: questionData, refetch: refetchQuestion } = trpc.studentAuth.getLiveQuizCurrentQuestion.useQuery(
    { sessionId: sessionId || 0, sessionToken: studentToken },
    { enabled: !!sessionId && (phase === "lobby" || phase === "question" || phase === "waiting"), refetchInterval: 2000 }
  );

  // Submeter resposta
  const submitMutation = trpc.studentAuth.submitLiveQuizAnswer.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        setSubmitted(true);
        setPhase("waiting");
        toast.success("Resposta enviada!");
      } else {
        toast.error(data.message || "Erro ao enviar resposta");
      }
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  // Processar dados da questão atual
  useEffect(() => {
    if (!questionData) return;
    const q = questionData;
    if (q.status === "gabarito_released") {
      setPhase("gabarito");
      return;
    }
    if (q.status === "finished") {
      setPhase("finished");
      return;
    }
    if (q.question && q.currentQuestionIndex >= 0) {
      if (currentQuestion?.index !== q.question?.index) {
        setCurrentQuestion(q.question);
        setSelectedAnswer(null);
        setSubmitted(false);
        setPhase("question");
      }
      if (q.alreadyAnswered) {
        setSelectedAnswer(q.myAnswer);
        setSubmitted(true);
        setPhase("waiting");
      }
    } else if (q.status === "lobby") {
      setPhase("lobby");
    } else if (q.status === "question_closed") {
      setPhase("waiting");
    }
  }, [questionData]);

  // Buscar gabarito quando liberado
  const { data: gabaritData, refetch: refetchGabarito } = trpc.studentAuth.joinLiveQuiz.useQuery(
    { accessCode: code.toUpperCase(), sessionToken: studentToken },
    { enabled: phase === "gabarito", refetchInterval: false }
  );

  const handleJoin = async () => {
    if (code.length < 4) { toast.error("Digite o código de acesso"); return; }
    const result = await refetchJoin();
    if (result.data?.found) {
      setSessionId(result.data.sessionId);
      setJoinData(result.data);
      if (result.data.status === "gabarito_released") {
        setPhase("gabarito");
      } else {
        setPhase("lobby");
      }
      toast.success("Conectado ao quiz!");
    } else {
      toast.error(result.data?.message || "Código inválido");
    }
  };

  const handleSubmit = () => {
    if (!selectedAnswer || !sessionId || currentQuestion === null) return;
    submitMutation.mutate({
      sessionToken: studentToken,
      sessionId,
      questionIndex: currentQuestion.index ?? currentQuestion.idx ?? 0,
      answer: selectedAnswer,
    });
  };

  const typeLabel = (type: string) => ({ mc: "Múltipla Escolha", vf: "Verdadeiro/Falso", correlacao: "Correlação de Colunas" }[type] || type);

  // ─── TELA: Digitar código ───
  if (phase === "enter_code") {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">Quiz ao Vivo</h1>
            <p className="text-gray-400 text-sm mt-1">Conexão Farmacologia 2026</p>
          </div>

          <Card className="bg-gray-900 border-gray-700">
            <CardContent className="pt-6 space-y-4">
              <div>
                <p className="text-gray-300 text-sm mb-2">Olá, <strong className="text-white">{studentName}</strong>!</p>
                <p className="text-gray-400 text-sm">Digite o código exibido pelo professor:</p>
              </div>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="Ex: FARM2A"
                className="bg-gray-800 border-gray-600 text-white text-center text-2xl font-mono tracking-widest h-14"
                maxLength={8}
                onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              />
              <Button onClick={handleJoin} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold h-12">
                <ChevronRight className="w-5 h-5 mr-2" />
                Entrar no Quiz
              </Button>
            </CardContent>
          </Card>

          {!isOnline && (
            <div className="flex items-center gap-2 text-yellow-400 text-sm bg-yellow-900/30 border border-yellow-700 rounded-lg p-3">
              <WifiOff className="w-4 h-4 shrink-0" />
              <span>Sem conexão. Verifique o Wi-Fi ou dados móveis.</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── TELA: Lobby ───
  if (phase === "lobby") {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mx-auto">
            <Loader2 className="w-8 h-8 text-red-400 animate-spin" />
          </div>
          <h2 className="text-xl font-bold text-white">Aguardando o professor iniciar...</h2>
          <p className="text-gray-400">Você está conectado. Fique com a tela aberta.</p>
          <Badge className="bg-green-700 text-white text-sm px-4 py-1">● Conectado — {code}</Badge>
          {!isOnline && (
            <div className="flex items-center gap-2 text-yellow-400 text-sm">
              <WifiOff className="w-4 h-4" /> Sem conexão
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── TELA: Questão ───
  if (phase === "question" && currentQuestion) {
    const questionIdx = (currentQuestion.index ?? 0) + 1;
    const totalQ = questionData?.totalQuestions || 25;

    return (
      <div className="min-h-screen bg-gray-950 p-4 pb-24">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <Badge className="bg-red-600 text-white">{typeLabel(currentQuestion.type)}</Badge>
          <span className="text-gray-400 text-sm font-mono">Q{questionIdx}/{totalQ}</span>
          {isOnline ? <Wifi className="w-4 h-4 text-green-400" /> : <WifiOff className="w-4 h-4 text-yellow-400" />}
        </div>

        {/* Tópico */}
        <p className="text-red-400 text-xs font-semibold uppercase tracking-wide mb-3">{currentQuestion.topic}</p>

        {/* Enunciado */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 mb-4">
          <p className="text-white text-sm leading-relaxed whitespace-pre-line">{currentQuestion.enunciado}</p>
        </div>

        {/* Alternativas */}
        {currentQuestion.alternativas && (
          <div className="space-y-2">
            {Object.entries(currentQuestion.alternativas).map(([key, val]) => (
              <button
                key={key}
                onClick={() => !submitted && setSelectedAnswer(key)}
                className={`w-full text-left rounded-xl border p-3 transition-all ${
                  selectedAnswer === key
                    ? "bg-red-600 border-red-500 text-white"
                    : "bg-gray-900 border-gray-700 text-gray-300 hover:border-gray-500 hover:bg-gray-800"
                }`}
              >
                <span className="font-bold mr-2">{key})</span>
                <span className="text-sm">{val as string}</span>
              </button>
            ))}
          </div>
        )}

        {/* Botão enviar */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-gray-950 border-t border-gray-800">
          <Button
            onClick={handleSubmit}
            disabled={!selectedAnswer || submitted || submitMutation.isPending}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold h-12 disabled:opacity-50"
          >
            {submitMutation.isPending ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <CheckCircle2 className="w-5 h-5 mr-2" />}
            {submitted ? "Resposta Enviada ✓" : "Confirmar Resposta"}
          </Button>
        </div>
      </div>
    );
  }

  // ─── TELA: Aguardando próxima questão ───
  if (phase === "waiting") {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4">
        <div className="text-center space-y-4">
          <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto" />
          <h2 className="text-xl font-bold text-white">Resposta enviada!</h2>
          <p className="text-gray-400">Aguardando o professor avançar para a próxima questão...</p>
          <div className="flex items-center gap-2 justify-center text-gray-500 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Sincronizando...</span>
          </div>
        </div>
      </div>
    );
  }

  // ─── TELA: Prova encerrada (aguardando gabarito) ───
  if (phase === "finished") {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4">
        <div className="text-center space-y-4">
          <Trophy className="w-16 h-16 text-yellow-400 mx-auto" />
          <h2 className="text-xl font-bold text-white">Prova Encerrada!</h2>
          <p className="text-gray-400">Aguardando o professor liberar o gabarito...</p>
          <Loader2 className="w-6 h-6 text-gray-500 animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  // ─── TELA: Gabarito ───
  if (phase === "gabarito") {
    const gData = gabaritData || joinData;
    const myAnswers: Array<{ questionIndex: number; answer: string; isCorrect: boolean }> = gData?.myAnswers || [];
    const allQuestions: any[] = gData?.questions || [];
    const allGabarito: any[] = gData?.gabarito || [];
    const score = gData?.score ?? 0;
    const totalCorrect = gData?.totalCorrect ?? 0;
    const totalQ = gData?.totalQuestions ?? allQuestions.length;

    return (
      <div className="min-h-screen bg-gray-950 p-4 pb-8">
        {/* Resultado */}
        <div className="text-center mb-6 pt-4">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-3 ${score >= 6 ? "bg-green-700" : "bg-red-700"}`}>
            {score >= 6 ? <CheckCircle2 className="w-10 h-10 text-white" /> : <XCircle className="w-10 h-10 text-white" />}
          </div>
          <h1 className="text-3xl font-bold text-white">{score.toFixed(1)}</h1>
          <p className="text-gray-400">{totalCorrect} de {totalQ} questões corretas</p>
          <Badge className={`mt-2 ${score >= 6 ? "bg-green-700" : "bg-red-700"} text-white`}>
            {score >= 6 ? "✓ Aprovado na P2" : "✗ Necessário Prova Final"}
          </Badge>
        </div>

        {/* Gabarito questão a questão */}
        <div className="space-y-4">
          {allQuestions.map((q: any, idx: number) => {
            const myAns = myAnswers.find(a => a.questionIndex === idx);
            const correctAns = allGabarito[idx]?.gabarito || "";
            const justificativa = allGabarito[idx]?.justificativa || "";
            const isCorrect = myAns?.isCorrect;

            return (
              <div key={idx} className={`rounded-xl border p-4 ${isCorrect ? "bg-green-900/20 border-green-700" : "bg-red-900/20 border-red-700"}`}>
                <div className="flex items-start gap-2 mb-2">
                  {isCorrect ? <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0 mt-0.5" /> : <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-gray-400 text-xs font-mono">Q{idx + 1}</span>
                      <Badge variant="outline" className="text-xs border-gray-600 text-gray-400">{q.topic}</Badge>
                    </div>
                    <p className="text-white text-sm leading-relaxed whitespace-pre-line line-clamp-3">{q.enunciado}</p>
                  </div>
                </div>

                <div className="mt-2 space-y-1 text-sm">
                  {myAns && (
                    <p className={`${isCorrect ? "text-green-300" : "text-red-300"}`}>
                      Sua resposta: <strong>{myAns.answer}</strong>
                    </p>
                  )}
                  {!isCorrect && (
                    <p className="text-green-300">Resposta correta: <strong>{correctAns}</strong></p>
                  )}
                  {justificativa && (
                    <div className="mt-2 bg-blue-900/30 border border-blue-700 rounded-lg p-3">
                      <p className="text-blue-200 text-xs leading-relaxed">{justificativa}</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return null;
}
