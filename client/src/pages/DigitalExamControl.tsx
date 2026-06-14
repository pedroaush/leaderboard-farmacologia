/**
 * DigitalExamControl — Painel do professor para gerenciar provas digitais
 * 
 * Funcionalidades:
 * - Criar sessão de prova com código único de 6 chars
 * - Monitorar em tempo real quem já respondeu
 * - Fechar acesso quando necessário
 * - Corrigir e lançar notas automaticamente
 * - Exportar resultados em CSV
 */

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Play, Square, CheckSquare, Download, RefreshCw, Users, Clock,
  Eye, EyeOff, QrCode, Trophy, AlertCircle, ChevronDown, ChevronUp
} from "lucide-react";
import QRCode from "qrcode";

const API_BASE = "https://2026.conexaofarmacologia.com.br/api/trpc";
const TEACHER_TOKEN_KEY = "prof_grades_teacher_token";

const TURMAS: { label: string; classId: number }[] = [
  { label: "Medicina 1", classId: 22 },
  { label: "Medicina 2", classId: 23 },
  { label: "Nutrição Integral", classId: 24 },
  { label: "Biomedicina 1", classId: 25 },
  { label: "Biomedicina 2", classId: 26 },
  { label: "Enfermagem", classId: 27 },
  { label: "Nutrição Noturno", classId: 28 },
];

async function apiQuery(path: string, input: object) {
  const p = encodeURIComponent(JSON.stringify({ json: input }));
  const r = await fetch(`${API_BASE}/${path}?input=${p}`);
  const data = await r.json();
  if (data.error) throw new Error(data.error.json?.message || "Erro");
  return data.result.data.json;
}

async function apiMutation(path: string, input: object) {
  const r = await fetch(`${API_BASE}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ json: input }),
  });
  const data = await r.json();
  if (data.error) throw new Error(data.error.json?.message || "Erro");
  return data.result.data.json;
}

interface ExamSession {
  id: number;
  accessCode: string;
  provaType: string;
  classId: number;
  status: "open" | "closed" | "finished";
  timeLimitMinutes: number;
  openedAt: string;
  totalResponses: number;
  submittedCount: number;
}

interface ExamResponse {
  id: number;
  memberName: string;
  status: string;
  score: string | null;
  correctCount: number | null;
  submittedAt: string | null;
  answers: string;
}

// Questões da P2 (importadas do gabarito_p2_v2)
const P2_QUESTIONS_SAMPLE = [
  { text: "Questão 1 — Farmacologia Adrenérgica", alternatives: ["A) Alt A", "B) Alt B", "C) Alt C", "D) Alt D", "E) Alt E"], difficulty: "intermediario" },
];

export default function DigitalExamControl() {
  const [token] = useState(() => localStorage.getItem(TEACHER_TOKEN_KEY) || "");
  const [selectedTurma, setSelectedTurma] = useState<{ label: string; classId: number }>(TURMAS[0]);
  const [provaType, setProvaType] = useState<"P1" | "P2">("P2");
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(60);
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<ExamSession | null>(null);
  const [responses, setResponses] = useState<ExamResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [showQR, setShowQR] = useState(false);
  const [expandedSession, setExpandedSession] = useState<number | null>(null);
  const [questionsJson, setQuestionsJson] = useState("");
  const [gabaritoJson, setGabaritoJson] = useState("");
  const [difficultiesJson, setDifficultiesJson] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const loadSessions = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiQuery("teacherAuth.listDigitalExamSessions", {
        sessionToken: token,
        classId: selectedTurma.classId,
      });
      setSessions(data || []);
    } catch (err: any) {
      toast.error("Erro ao carregar sessões: " + err.message);
    }
  }, [token, selectedTurma]);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  // Auto-refresh a cada 10s quando há sessão aberta
  useEffect(() => {
    const hasOpen = sessions.some(s => s.status === "open");
    if (!hasOpen) return;
    const interval = setInterval(loadSessions, 10000);
    return () => clearInterval(interval);
  }, [sessions, loadSessions]);

  const loadResponses = async (session: ExamSession) => {
    if (!token) return;
    try {
      const data = await apiQuery("teacherAuth.getDigitalExamResponses", {
        sessionToken: token,
        sessionId: session.id,
      });
      setResponses(data || []);
      setSelectedSession(session);
    } catch (err: any) {
      toast.error("Erro ao carregar respostas: " + err.message);
    }
  };

  const handleOpenExam = async () => {
    if (!token) { toast.error("Token do professor não encontrado"); return; }

    // Validar JSON se fornecido
    let qs = questionsJson.trim();
    let gb = gabaritoJson.trim();
    let df = difficultiesJson.trim();

    if (!qs) {
      toast.error("Cole o JSON das questões antes de abrir a prova");
      return;
    }
    try { JSON.parse(qs); } catch { toast.error("JSON das questões inválido"); return; }
    try { JSON.parse(gb); } catch { toast.error("JSON do gabarito inválido"); return; }
    if (!df) df = JSON.stringify(new Array(25).fill("intermediario"));

    setLoading(true);
    try {
      const result = await apiMutation("teacherAuth.openDigitalExam", {
        sessionToken: token,
        classId: selectedTurma.classId,
        provaType,
        questions: qs,
        gabarito: gb,
        difficulties: df,
        timeLimitMinutes,
      });
      toast.success(`Prova aberta! Código: ${result.accessCode}`);
      // Gerar QR Code
      const url = `https://2026.conexaofarmacologia.com.br/prova-digital?code=${result.accessCode}`;
      const qr = await QRCode.toDataURL(url, { width: 400, margin: 2, color: { dark: "#000", light: "#fff" } });
      setQrDataUrl(qr);
      setShowQR(true);
      loadSessions();
    } catch (err: any) {
      toast.error("Erro ao abrir prova: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseExam = async (sessionId: number) => {
    if (!token) return;
    try {
      await apiMutation("teacherAuth.closeDigitalExam", { sessionToken: token, sessionId });
      toast.success("Acesso à prova encerrado");
      loadSessions();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleGradeExam = async (sessionId: number) => {
    if (!token) return;
    setLoading(true);
    try {
      const result = await apiMutation("teacherAuth.gradeDigitalExam", { sessionToken: token, sessionId });
      toast.success(`${result.graded} provas corrigidas e notas lançadas automaticamente!`);
      loadSessions();
      if (selectedSession?.id === sessionId) loadResponses(selectedSession);
    } catch (err: any) {
      toast.error("Erro na correção: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = (session: ExamSession) => {
    if (!responses.length) { toast.error("Carregue as respostas primeiro"); return; }
    const rows = [["Nome", "Status", "Nota", "Acertos", "Enviado em"]];
    for (const r of responses) {
      rows.push([
        r.memberName,
        r.status === "graded" ? "Corrigido" : r.status === "submitted" ? "Enviado" : "Em andamento",
        r.score || "-",
        String(r.correctCount || 0),
        r.submittedAt ? new Date(r.submittedAt).toLocaleString("pt-BR") : "-",
      ]);
    }
    const csv = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `prova_digital_${session.provaType}_${session.accessCode}.csv`;
    a.click();
  };

  const statusColor = (s: string) => {
    if (s === "open") return "bg-green-500/20 text-green-300 border-green-500/30";
    if (s === "closed") return "bg-yellow-500/20 text-yellow-300 border-yellow-500/30";
    return "bg-blue-500/20 text-blue-300 border-blue-500/30";
  };
  const statusLabel = (s: string) => s === "open" ? "Aberta" : s === "closed" ? "Fechada" : "Finalizada";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[#0D1B2A] border border-white/10 rounded-xl p-5">
        <h2 className="text-white font-bold text-lg mb-1 flex items-center gap-2">
          <span className="text-blue-400">📱</span> Prova Digital Anti-Cola
        </h2>
        <p className="text-white/40 text-sm">Questões embaralhadas por aluno · Correção automática · Sem cartão resposta</p>
      </div>

      {/* Criar nova sessão */}
      <div className="bg-[#0D1B2A] border border-white/10 rounded-xl p-5 space-y-4">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <Play className="w-4 h-4 text-green-400" /> Abrir Nova Sessão de Prova
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-white/50 text-xs mb-1 block">Turma</label>
            <Select value={String(selectedTurma.classId)} onValueChange={v => setSelectedTurma(TURMAS.find(t => t.classId === Number(v))!)}>
              <SelectTrigger className="bg-[#1A2A3A] border-white/20 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TURMAS.map(t => <SelectItem key={t.classId} value={String(t.classId)}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-white/50 text-xs mb-1 block">Prova</label>
            <Select value={provaType} onValueChange={v => setProvaType(v as "P1" | "P2")}>
              <SelectTrigger className="bg-[#1A2A3A] border-white/20 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="P1">P1</SelectItem>
                <SelectItem value="P2">P2</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <label className="text-white/50 text-xs mb-1 block">Tempo Limite (minutos)</label>
          <Input
            type="number"
            value={timeLimitMinutes}
            onChange={e => setTimeLimitMinutes(Number(e.target.value))}
            className="bg-[#1A2A3A] border-white/20 text-white w-32"
            min={10} max={180}
          />
        </div>

        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-white/40 text-xs flex items-center gap-1 hover:text-white/70"
        >
          {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          Configurar questões e gabarito (JSON)
        </button>

        {showAdvanced && (
          <div className="space-y-3 border-t border-white/10 pt-3">
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-yellow-300 text-xs">
              ⚠️ Cole o JSON das questões e gabarito gerado pelo sistema. O gabarito nunca é enviado aos alunos.
            </div>
            <div>
              <label className="text-white/50 text-xs mb-1 block">JSON das Questões (array de 25 objetos)</label>
              <textarea
                value={questionsJson}
                onChange={e => setQuestionsJson(e.target.value)}
                placeholder='[{"text": "Enunciado...", "alternatives": [{"text": "Alt A"}, ...], "topic": "Adrenérgica", "difficulty": "intermediario"}, ...]'
                className="w-full h-24 bg-[#1A2A3A] border border-white/20 rounded-lg p-3 text-white/70 text-xs font-mono resize-none"
              />
            </div>
            <div>
              <label className="text-white/50 text-xs mb-1 block">JSON do Gabarito (array de 25 letras: ["A","C","B",...])</label>
              <textarea
                value={gabaritoJson}
                onChange={e => setGabaritoJson(e.target.value)}
                placeholder='["A","C","B","D","E","A","B","C","D","E","A","B","C","D","E","A","B","C","D","E","A","B","C","D","E"]'
                className="w-full h-16 bg-[#1A2A3A] border border-white/20 rounded-lg p-3 text-white/70 text-xs font-mono resize-none"
              />
            </div>
            <div>
              <label className="text-white/50 text-xs mb-1 block">JSON das Dificuldades (opcional — padrão: intermediario)</label>
              <textarea
                value={difficultiesJson}
                onChange={e => setDifficultiesJson(e.target.value)}
                placeholder='["facil","intermediario","dificil",...]'
                className="w-full h-12 bg-[#1A2A3A] border border-white/20 rounded-lg p-3 text-white/70 text-xs font-mono resize-none"
              />
            </div>
          </div>
        )}

        <Button
          onClick={handleOpenExam}
          disabled={loading || !questionsJson.trim()}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-bold"
        >
          <Play className="w-4 h-4 mr-2" />
          {loading ? "Abrindo..." : "Abrir Prova Digital"}
        </Button>
      </div>

      {/* QR Code da sessão ativa */}
      {showQR && qrDataUrl && (
        <div className="bg-[#0D1B2A] border border-green-500/30 rounded-xl p-5 text-center">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-green-400 font-bold flex items-center gap-2">
              <QrCode className="w-4 h-4" /> Prova Aberta!
            </h3>
            <button onClick={() => setShowQR(false)} className="text-white/30 hover:text-white text-xs">Fechar</button>
          </div>
          <img src={qrDataUrl} alt="QR Code da prova" className="w-48 h-48 mx-auto rounded-xl mb-4" />
          <p className="text-white/60 text-sm">Mostre este QR Code para os alunos escanearem</p>
          <p className="text-white/30 text-xs mt-1">Ou acesse: 2026.conexaofarmacologia.com.br/prova-digital</p>
        </div>
      )}

      {/* Lista de sessões */}
      <div className="bg-[#0D1B2A] border border-white/10 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <Eye className="w-4 h-4 text-blue-400" /> Sessões de Prova
          </h3>
          <Button variant="ghost" size="sm" onClick={loadSessions} className="text-white/40 hover:text-white">
            <RefreshCw className="w-3.5 h-3.5 mr-1" /> Atualizar
          </Button>
        </div>

        {sessions.length === 0 ? (
          <div className="text-center py-8 text-white/30">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nenhuma sessão encontrada para esta turma</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map(session => (
              <div key={session.id} className="border border-white/10 rounded-xl overflow-hidden">
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer hover:bg-white/5"
                  onClick={() => setExpandedSession(expandedSession === session.id ? null : session.id)}
                >
                  <Badge variant="outline" className={`text-xs ${statusColor(session.status)}`}>
                    {statusLabel(session.status)}
                  </Badge>
                  <span className="text-white font-mono font-bold">{session.accessCode}</span>
                  <span className="text-white/50 text-sm">{session.provaType}</span>
                  <div className="ml-auto flex items-center gap-3">
                    <div className="flex items-center gap-1 text-white/50 text-xs">
                      <Users className="w-3 h-3" />
                      {session.submittedCount}/{session.totalResponses} enviadas
                    </div>
                    <div className="flex items-center gap-1 text-white/30 text-xs">
                      <Clock className="w-3 h-3" />
                      {session.timeLimitMinutes}min
                    </div>
                    {expandedSession === session.id ? <ChevronUp className="w-4 h-4 text-white/30" /> : <ChevronDown className="w-4 h-4 text-white/30" />}
                  </div>
                </div>

                {expandedSession === session.id && (
                  <div className="border-t border-white/10 p-4 space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {session.status === "open" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCloseExam(session.id)}
                          className="border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10"
                        >
                          <Square className="w-3.5 h-3.5 mr-1" /> Fechar Acesso
                        </Button>
                      )}
                      {(session.status === "closed" || session.status === "open") && (
                        <Button
                          size="sm"
                          onClick={() => handleGradeExam(session.id)}
                          disabled={loading}
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          <CheckSquare className="w-3.5 h-3.5 mr-1" />
                          {loading ? "Corrigindo..." : "Corrigir e Lançar Notas"}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          await loadResponses(session);
                          exportCSV(session);
                        }}
                        className="border-white/20 text-white/60 hover:text-white"
                      >
                        <Download className="w-3.5 h-3.5 mr-1" /> Exportar CSV
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => loadResponses(session)}
                        className="border-white/20 text-white/60 hover:text-white"
                      >
                        <Eye className="w-3.5 h-3.5 mr-1" /> Ver Respostas
                      </Button>
                    </div>

                    {/* Tabela de respostas */}
                    {selectedSession?.id === session.id && responses.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-white/10">
                              <th className="text-left text-white/40 py-2 pr-4">Aluno</th>
                              <th className="text-center text-white/40 py-2 pr-4">Status</th>
                              <th className="text-center text-white/40 py-2 pr-4">Nota</th>
                              <th className="text-center text-white/40 py-2">Acertos</th>
                            </tr>
                          </thead>
                          <tbody>
                            {responses.map(r => (
                              <tr key={r.id} className="border-b border-white/5">
                                <td className="text-white/80 py-2 pr-4">{r.memberName}</td>
                                <td className="text-center py-2 pr-4">
                                  <Badge variant="outline" className={`text-xs ${
                                    r.status === "graded" ? "bg-green-500/20 text-green-300 border-green-500/30" :
                                    r.status === "submitted" ? "bg-blue-500/20 text-blue-300 border-blue-500/30" :
                                    "bg-yellow-500/20 text-yellow-300 border-yellow-500/30"
                                  }`}>
                                    {r.status === "graded" ? "Corrigido" : r.status === "submitted" ? "Enviado" : "Em andamento"}
                                  </Badge>
                                </td>
                                <td className="text-center py-2 pr-4">
                                  <span className={`font-bold ${r.score ? (parseFloat(r.score) >= 6 ? "text-green-400" : "text-red-400") : "text-white/30"}`}>
                                    {r.score ? parseFloat(r.score).toFixed(1) : "—"}
                                  </span>
                                </td>
                                <td className="text-center text-white/50 py-2">{r.correctCount ?? "—"}/25</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {responses.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-white/10 flex items-center gap-4 text-xs text-white/40">
                            <span className="flex items-center gap-1">
                              <Trophy className="w-3 h-3 text-yellow-400" />
                              Média: {(responses.filter(r => r.score).reduce((s, r) => s + parseFloat(r.score!), 0) / (responses.filter(r => r.score).length || 1)).toFixed(1)}
                            </span>
                            <span>Aprovados: {responses.filter(r => r.score && parseFloat(r.score) >= 6).length}/{responses.length}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
