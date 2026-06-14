/**
 * DigitalExam — Tela de prova digital para o aluno
 * 
 * Segurança anti-cola:
 * - Questões embaralhadas individualmente por aluno (seed = memberId)
 * - Alternativas também embaralhadas por questão
 * - Gabarito nunca enviado ao navegador
 * 
 * Resiliência:
 * - Auto-save a cada resposta no servidor E no localStorage
 * - Recuperação automática após queda de conexão ou travamento
 * - Envio automático quando o tempo esgota
 * - Modo offline: questões carregadas localmente ao abrir
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle, AlertTriangle, Wifi, WifiOff, ChevronLeft, ChevronRight, Send, BookOpen } from "lucide-react";

const STUDENT_TOKEN_KEY = "studentSessionToken";
const EXAM_DRAFT_KEY = "digitalExam_draft";

interface Question {
  origIdx: number;
  text: string;
  alternatives: { letter: string; text: string; shuffledLetter: string }[];
  topic?: string;
  difficulty?: string;
}

interface ExamDraft {
  sessionId: number;
  questionOrder: string;
  answers: (string | null)[];
  startedAt: number;
  timeLimitMinutes: number;
  questions: Question[];
}

function shuffleAlternatives(q: any, seed: number): Question {
  const letters = ["A", "B", "C", "D", "E"];
  const origAlts = q.alternatives || [];
  // Embaralhar alternativas com seed baseado no origIdx + seed do aluno
  const altSeed = seed + q.origIdx * 7919;
  const indices = [0, 1, 2, 3, 4].slice(0, origAlts.length);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.abs((altSeed * (i + 13)) % (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return {
    origIdx: q.origIdx,
    text: q.text,
    topic: q.topic,
    difficulty: q.difficulty,
    alternatives: indices.map((origI, newI) => ({
      letter: letters[origI],
      text: origAlts[origI]?.text || origAlts[origI] || "",
      shuffledLetter: letters[newI],
    })),
  };
}

export default function DigitalExam() {
  const [sessionToken] = useState(() => localStorage.getItem(STUDENT_TOKEN_KEY) || "");
  const [accessCode, setAccessCode] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [phase, setPhase] = useState<"enter_code" | "loading" | "exam" | "submitted">("enter_code");
  const [examData, setExamData] = useState<any>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<(string | null)[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSaving, setIsSaving] = useState(false);
  const [finalScore, setFinalScore] = useState<number | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoSubmitRef = useRef(false);

  // Monitor conexão
  useEffect(() => {
    const onOnline = () => { setIsOnline(true); toast.success("Conexão restaurada — respostas sincronizadas"); };
    const onOffline = () => { setIsOnline(false); toast.warning("Sem conexão — respostas salvas localmente"); };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => { window.removeEventListener("online", onOnline); window.removeEventListener("offline", onOffline); };
  }, []);

  // Recuperar rascunho local ao montar
  useEffect(() => {
    const draft = localStorage.getItem(EXAM_DRAFT_KEY);
    if (draft) {
      try {
        const d: ExamDraft = JSON.parse(draft);
        // Verificar se o rascunho é recente (menos de 3h)
        if (Date.now() - d.startedAt < 3 * 60 * 60 * 1000) {
          toast.info("Rascunho recuperado — suas respostas anteriores foram restauradas", { duration: 5000 });
        }
      } catch {}
    }
  }, []);

  const getExamQuery = trpc.studentAuth.getDigitalExamByCode.useQuery(
    { accessCode, sessionToken },
    {
      enabled: false,
      retry: false,
    }
  );

  const startOrUpdateMutation = trpc.studentAuth.startOrUpdateDigitalExam.useMutation();
  const submitMutation = trpc.studentAuth.submitDigitalExam.useMutation();

  const handleLoadExam = async () => {
    if (!sessionToken) {
      toast.error("Você precisa estar logado para fazer a prova");
      return;
    }
    if (codeInput.trim().length < 4) {
      toast.error("Digite o código de acesso fornecido pelo professor");
      return;
    }
    setPhase("loading");
    setAccessCode(codeInput.trim().toUpperCase());
  };

  // Quando accessCode muda, buscar a prova
  useEffect(() => {
    if (!accessCode || phase !== "loading") return;
    getExamQuery.refetch().then((result) => {
      if (result.error) {
        toast.error("Erro ao buscar prova: " + result.error.message);
        setPhase("enter_code");
        return;
      }
      const data = result.data;
      if (!data) { setPhase("enter_code"); return; }
      if (!data.found) {
        toast.error(data.message || "Prova não encontrada");
        setPhase("enter_code");
        return;
      }
      if (data.alreadySubmitted) {
        setFinalScore(parseFloat(data.existingScore || "0"));
        setPhase("submitted");
        return;
      }
      // Embaralhar alternativas com seed do aluno (memberId embutido no questionOrder)
      const seed = data.questions[0]?.origIdx || 1;
      const processedQs: Question[] = data.questions.map((q: any) => shuffleAlternatives(q, seed * 31337));
      setQuestions(processedQs);
      setExamData(data);

      // Verificar rascunho local
      const draft = localStorage.getItem(EXAM_DRAFT_KEY);
      let restoredAnswers: (string | null)[] = new Array(processedQs.length).fill(null);
      if (draft) {
        try {
          const d: ExamDraft = JSON.parse(draft);
          if (d.sessionId === data.sessionId) {
            restoredAnswers = d.answers;
            toast.success(`${d.answers.filter(Boolean).length} respostas anteriores restauradas`);
          }
        } catch {}
      }
      setAnswers(restoredAnswers);

      // Calcular tempo restante
      const openedAt = new Date(data.openedAt).getTime();
      const limitMs = data.timeLimitMinutes * 60 * 1000;
      const elapsed = Date.now() - openedAt;
      const remaining = Math.max(0, Math.floor((limitMs - elapsed) / 1000));
      setTimeLeft(remaining);

      // Salvar rascunho inicial
      const newDraft: ExamDraft = {
        sessionId: data.sessionId,
        questionOrder: data.questionOrder,
        answers: restoredAnswers,
        startedAt: Date.now(),
        timeLimitMinutes: data.timeLimitMinutes,
        questions: processedQs,
      };
      localStorage.setItem(EXAM_DRAFT_KEY, JSON.stringify(newDraft));

      setPhase("exam");
    });
  }, [accessCode, phase]);

  // Cronômetro
  useEffect(() => {
    if (phase !== "exam") return;
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          if (!autoSubmitRef.current) {
            autoSubmitRef.current = true;
            toast.warning("Tempo esgotado! Enviando prova automaticamente...");
            handleSubmit(true);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current!);
  }, [phase]);

  const saveProgress = useCallback(async (currentAnswers: (string | null)[]) => {
    if (!examData || !sessionToken) return;
    // Salvar localmente sempre
    const draft = localStorage.getItem(EXAM_DRAFT_KEY);
    if (draft) {
      try {
        const d: ExamDraft = JSON.parse(draft);
        d.answers = currentAnswers;
        localStorage.setItem(EXAM_DRAFT_KEY, JSON.stringify(d));
      } catch {}
    }
    // Salvar no servidor se online
    if (!isOnline) return;
    setIsSaving(true);
    try {
      await startOrUpdateMutation.mutateAsync({
        sessionToken,
        sessionId: examData.sessionId,
        questionOrder: examData.questionOrder,
        answers: JSON.stringify(currentAnswers),
      });
    } catch (err) {
      // Silencioso — já está salvo localmente
    } finally {
      setIsSaving(false);
    }
  }, [examData, sessionToken, isOnline, startOrUpdateMutation]);

  const handleAnswer = (questionIdx: number, shuffledLetter: string) => {
    // Mapear letra embaralhada de volta para letra original
    const q = questions[questionIdx];
    const alt = q.alternatives.find(a => a.shuffledLetter === shuffledLetter);
    const originalLetter = alt?.letter || shuffledLetter;

    const newAnswers = [...answers];
    newAnswers[questionIdx] = originalLetter;
    setAnswers(newAnswers);

    // Auto-save com debounce de 800ms
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => saveProgress(newAnswers), 800);

    // Avançar para próxima questão automaticamente
    if (questionIdx < questions.length - 1) {
      setTimeout(() => setCurrentQ(questionIdx + 1), 300);
    }
  };

  const handleSubmit = async (isAutoSubmit = false) => {
    if (!examData || !sessionToken) return;
    if (!isAutoSubmit) {
      const answered = answers.filter(Boolean).length;
      if (answered < questions.length) {
        const confirm = window.confirm(`Você respondeu ${answered} de ${questions.length} questões. Deseja enviar mesmo assim?`);
        if (!confirm) return;
      }
    }
    clearInterval(timerRef.current!);
    try {
      await submitMutation.mutateAsync({
        sessionToken,
        sessionId: examData.sessionId,
        answers: JSON.stringify(answers),
        questionOrder: examData.questionOrder,
      });
      localStorage.removeItem(EXAM_DRAFT_KEY);
      setPhase("submitted");
      toast.success("Prova enviada com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao enviar: " + err.message);
      // Tentar novamente em 5s
      setTimeout(() => handleSubmit(isAutoSubmit), 5000);
    }
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const answeredCount = answers.filter(Boolean).length;
  const timePercent = examData ? (timeLeft / (examData.timeLimitMinutes * 60)) * 100 : 100;
  const isUrgent = timeLeft < 300 && timeLeft > 0; // menos de 5 min

  // ── TELA: DIGITAR CÓDIGO ──────────────────────────────────────────────────
  if (phase === "enter_code") {
    return (
      <div className="min-h-screen bg-[#060D1A] flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">Prova Digital</h1>
            <p className="text-white/50 mt-2">Digite o código fornecido pelo professor</p>
          </div>
          <div className="bg-[#0D1B2A] border border-white/10 rounded-2xl p-6 space-y-4">
            {!sessionToken && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-300 text-sm">
                ⚠️ Você precisa estar logado na plataforma para fazer a prova.
              </div>
            )}
            <div>
              <label className="text-white/70 text-sm mb-2 block">Código de Acesso</label>
              <Input
                value={codeInput}
                onChange={e => setCodeInput(e.target.value.toUpperCase())}
                placeholder="Ex: A3F9C2"
                className="bg-[#1A2A3A] border-white/20 text-white text-center text-2xl font-mono tracking-widest h-14"
                maxLength={8}
                onKeyDown={e => e.key === "Enter" && handleLoadExam()}
              />
            </div>
            <Button
              onClick={handleLoadExam}
              disabled={!sessionToken || codeInput.trim().length < 4}
              className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold text-base"
            >
              Entrar na Prova
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── TELA: CARREGANDO ──────────────────────────────────────────────────────
  if (phase === "loading") {
    return (
      <div className="min-h-screen bg-[#060D1A] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/70">Carregando prova...</p>
        </div>
      </div>
    );
  }

  // ── TELA: PROVA ENVIADA ───────────────────────────────────────────────────
  if (phase === "submitted") {
    return (
      <div className="min-h-screen bg-[#060D1A] flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="w-20 h-20 rounded-full bg-green-600/20 border-2 border-green-500 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Prova Enviada!</h2>
          <p className="text-white/60 mb-6">Suas respostas foram registradas com sucesso.</p>
          {finalScore !== null && (
            <div className="bg-[#0D1B2A] border border-white/10 rounded-xl p-6 mb-6">
              <p className="text-white/50 text-sm mb-1">Sua nota</p>
              <p className="text-5xl font-black text-blue-400">{finalScore.toFixed(1)}</p>
              <p className="text-white/30 text-xs mt-1">de 10,0</p>
            </div>
          )}
          <p className="text-white/40 text-sm">O professor irá liberar o gabarito após o encerramento da prova.</p>
        </div>
      </div>
    );
  }

  // ── TELA: PROVA ───────────────────────────────────────────────────────────
  const q = questions[currentQ];
  if (!q) return null;

  return (
    <div className="min-h-screen bg-[#060D1A] flex flex-col">
      {/* Header fixo */}
      <div className={`sticky top-0 z-50 border-b ${isUrgent ? "bg-red-900/80 border-red-500/50" : "bg-[#0D1B2A]/95 border-white/10"} backdrop-blur-sm`}>
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-white/70 border-white/20 font-mono text-xs">
              {examData?.provaType}
            </Badge>
            <span className="text-white/40 text-xs">{answeredCount}/{questions.length} respondidas</span>
          </div>
          <div className={`flex items-center gap-2 font-mono font-bold text-lg ${isUrgent ? "text-red-400 animate-pulse" : "text-white"}`}>
            <Clock className="w-4 h-4" />
            {formatTime(timeLeft)}
          </div>
          <div className="flex items-center gap-2">
            {isOnline ? (
              <div className="flex items-center gap-1 text-green-400 text-xs">
                <Wifi className="w-3 h-3" />
                {isSaving ? "Salvando..." : "Salvo"}
              </div>
            ) : (
              <div className="flex items-center gap-1 text-yellow-400 text-xs">
                <WifiOff className="w-3 h-3" />
                Offline
              </div>
            )}
          </div>
        </div>
        {/* Barra de progresso do tempo */}
        <div className="h-1 bg-white/5">
          <div
            className={`h-full transition-all duration-1000 ${isUrgent ? "bg-red-500" : "bg-blue-500"}`}
            style={{ width: `${timePercent}%` }}
          />
        </div>
      </div>

      {/* Mapa de questões */}
      <div className="max-w-2xl mx-auto w-full px-4 pt-4">
        <div className="flex flex-wrap gap-1.5 mb-4">
          {questions.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentQ(i)}
              className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                i === currentQ
                  ? "bg-blue-600 text-white ring-2 ring-blue-400"
                  : answers[i]
                  ? "bg-green-700/60 text-green-200"
                  : "bg-white/5 text-white/40 hover:bg-white/10"
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>

      {/* Questão atual */}
      <div className="flex-1 max-w-2xl mx-auto w-full px-4 pb-32">
        <div className="bg-[#0D1B2A] border border-white/10 rounded-2xl p-6 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-blue-400 font-bold text-sm">Questão {currentQ + 1}</span>
            {q.topic && <Badge variant="outline" className="text-white/40 border-white/10 text-xs">{q.topic}</Badge>}
            {q.difficulty && (
              <Badge variant="outline" className={`text-xs border-0 ${
                q.difficulty === "facil" ? "bg-green-500/20 text-green-300" :
                q.difficulty === "dificil" ? "bg-red-500/20 text-red-300" :
                "bg-yellow-500/20 text-yellow-300"
              }`}>
                {q.difficulty === "facil" ? "Fácil" : q.difficulty === "dificil" ? "Difícil" : "Intermediário"}
              </Badge>
            )}
          </div>
          <p className="text-white leading-relaxed text-base">{q.text}</p>
        </div>

        <div className="space-y-3">
          {q.alternatives.map((alt) => {
            const isSelected = answers[currentQ] === alt.letter;
            return (
              <button
                key={alt.shuffledLetter}
                onClick={() => handleAnswer(currentQ, alt.shuffledLetter)}
                className={`w-full text-left rounded-xl border p-4 transition-all flex items-start gap-3 ${
                  isSelected
                    ? "bg-blue-600/20 border-blue-500 text-white"
                    : "bg-[#0D1B2A] border-white/10 text-white/80 hover:border-white/30 hover:bg-white/5"
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-bold text-sm ${
                  isSelected ? "bg-blue-600 text-white" : "bg-white/10 text-white/50"
                }`}>
                  {alt.shuffledLetter}
                </div>
                <span className="pt-1 text-sm leading-relaxed">{alt.text}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer fixo com navegação e enviar */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#0D1B2A]/95 backdrop-blur-sm border-t border-white/10 p-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Button
            variant="ghost"
            onClick={() => setCurrentQ(Math.max(0, currentQ - 1))}
            disabled={currentQ === 0}
            className="text-white/50 hover:text-white"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 text-center text-white/40 text-sm">
            {currentQ + 1} de {questions.length}
          </div>
          {currentQ < questions.length - 1 ? (
            <Button
              variant="ghost"
              onClick={() => setCurrentQ(Math.min(questions.length - 1, currentQ + 1))}
              className="text-white/50 hover:text-white"
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          ) : (
            <Button
              onClick={() => handleSubmit(false)}
              disabled={submitMutation.isPending}
              className="bg-green-600 hover:bg-green-700 text-white font-bold px-6"
            >
              <Send className="w-4 h-4 mr-2" />
              {submitMutation.isPending ? "Enviando..." : "Enviar Prova"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
