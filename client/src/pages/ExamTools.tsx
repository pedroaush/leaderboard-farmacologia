/**
 * ExamTools — Ferramentas de Prova
 * Design: Dark medical/sci-fi — identidade visual da plataforma Conexão Farmacologia
 *
 * Versões A, B, C, D com gabarito automático por versão.
 * Pontuação total = 10,0 pt:
 *   Q1–Q10:  10 × 0,20 = 2,0 pt
 *   Q11–Q20: 10 × 0,40 = 4,0 pt
 *   Q21–Q25:  5 × 0,80 = 4,0 pt
 *
 * Funcionalidades:
 *   - Seleção de versão A/B/C/D com gabarito automático
 *   - Nota em tempo real conforme respostas são marcadas
 *   - Modo Turma: corrigir múltiplos alunos em sequência
 *   - Exportar planilha CSV com todas as notas
 *   - Imprimir boletim individual
 */
import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Link } from "wouter";
import {
  ArrowLeft, CheckCircle2, ClipboardList, FileText, RotateCcw,
  User, Users, Download, Printer, Trophy, Target, BookOpen,
  ChevronRight, AlertCircle, TrendingUp, BarChart2, FileSpreadsheet,
  Send, Lock, Unlock, RefreshCw
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type ExamVersion = "A" | "B" | "C" | "D";
type Answer = "A" | "B" | "C" | "D" | "E" | null;

interface Question {
  number: number;
  gabarito: Answer;
  resposta: Answer;
  points: number;
}

interface ExamConfig {
  disciplina: string;
  turma: string;
  prova: "P1" | "P2" | "Substitutiva";
  data: string;
  professor: string;
  semestre: string;
}

interface StudentResult {
  id: number;
  name: string;
  matricula: string;
  version: ExamVersion;
  turma: string;
  answers: Answer[];
  correct: number;
  wrong: number;
  blank: number;
  totalPoints: number;
  approved: boolean;
  timestamp: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const TURMAS = [
  "Farmacologia 1 - Medicina",
  "Farmacologia 1 - Medicina 2",
  "Farmacologia 1 - Nutrição",
  "Farmacologia 1 - Biomedicina 1",
  "Farmacologia 1 - Biomedicina 2",
  "Farmacologia 1 - Enfermagem",
  "Farmacologia 1 - Nutrição Noturno",
];

const ANSWERS: Answer[] = ["A", "B", "C", "D", "E"];

function getPoints(num: number): number {
  if (num <= 10) return 0.20;
  if (num <= 20) return 0.40;
  return 0.80;
}

// ─── Gabaritos das 4 versões ─────────────────────────────────────────────────
const GABARITOS: Record<ExamVersion, Answer[]> = {
  A: ["E","D","B","C","A","E","D","B","E","C","D","C","E","A","B","A","C","C","C","B","E","E","D","C","E"],
  B: ["E","B","B","C","B","E","E","A","A","B","A","A","B","A","C","B","C","A","D","B","C","C","E","E","D"],
  C: ["B","A","A","C","B","E","E","D","E","B","B","E","E","D","C","C","D","E","B","B","B","D","B","E","B"],
  D: ["C","C","C","B","E","E","D","C","E","B","A","C","A","A","E","D","D","B","A","B","A","A","B","D","C"],
};

const VERSION_COLORS: Record<ExamVersion, { bg: string; text: string; border: string; badge: string; solid: string }> = {
  A: { bg: "bg-blue-600",    text: "text-blue-400",    border: "border-blue-500/40",    badge: "bg-blue-500/20 text-blue-300 border-blue-500/30",    solid: "#2563eb" },
  B: { bg: "bg-emerald-600", text: "text-emerald-400", border: "border-emerald-500/40", badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30", solid: "#059669" },
  C: { bg: "bg-rose-600",    text: "text-rose-400",    border: "border-rose-500/40",    badge: "bg-rose-500/20 text-rose-300 border-rose-500/30",    solid: "#e11d48" },
  D: { bg: "bg-violet-600",  text: "text-violet-400",  border: "border-violet-500/40",  badge: "bg-violet-500/20 text-violet-300 border-violet-500/30",  solid: "#7c3aed" },
};

function initQuestions(version: ExamVersion | null): Question[] {
  return Array.from({ length: 25 }, (_, i) => ({
    number: i + 1,
    gabarito: version ? GABARITOS[version][i] : null,
    resposta: null,
    points: getPoints(i + 1),
  }));
}

// ─── Logo SVG ─────────────────────────────────────────────────────────────────
function LogoIcon({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="18" fill="url(#logoGradET)" />
      <path d="M14 20h12M20 14v12" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
      <circle cx="20" cy="20" r="4" fill="white" fillOpacity="0.2"/>
      <defs>
        <radialGradient id="logoGradET" cx="30%" cy="30%">
          <stop offset="0%" stopColor="#F7941D"/>
          <stop offset="100%" stopColor="#C0392B"/>
        </radialGradient>
      </defs>
    </svg>
  );
}

// ─── Live Score Display ────────────────────────────────────────────────────────
function LiveScore({ questions, version }: { questions: Question[]; version: ExamVersion | null }) {
  const correct = questions.filter(q => q.gabarito !== null && q.resposta === q.gabarito);
  const wrong = questions.filter(q => q.gabarito !== null && q.resposta !== null && q.resposta !== q.gabarito);
  const blank = questions.filter(q => q.resposta === null);
  const answered = questions.filter(q => q.resposta !== null);
  const totalPoints = correct.reduce((sum, q) => sum + q.points, 0);
  const percentage = (totalPoints / 10.0) * 100;
  const approved = totalPoints >= 5.0;
  const progress = (answered.length / 25) * 100;

  const scoreColor = totalPoints >= 7 ? "text-emerald-400" :
                     totalPoints >= 5 ? "text-amber-400" : "text-rose-400";
  const scoreBg = totalPoints >= 7 ? "bg-emerald-500/10 border-emerald-500/30" :
                  totalPoints >= 5 ? "bg-amber-500/10 border-amber-500/30" : "bg-rose-500/10 border-rose-500/30";
  const barColor = totalPoints >= 7 ? "bg-emerald-500" :
                   totalPoints >= 5 ? "bg-amber-500" : "bg-rose-500";

  return (
    <div className={`rounded-2xl border p-5 transition-all duration-500 ${answered.length > 0 ? scoreBg : "bg-[#0D1B2A] border-white/10"}`}>
      {/* Main score */}
      <div className="text-center mb-4">
        <div className={`text-6xl font-black transition-all duration-300 ${answered.length > 0 ? scoreColor : "text-white/20"}`}>
          {totalPoints.toFixed(1)}
          <span className="text-2xl text-white/30 font-normal"> / 10,0</span>
        </div>
        {answered.length > 0 && (
          <div className={`text-sm font-bold mt-1 ${approved ? "text-emerald-400" : "text-rose-400"}`}>
            {approved ? "✓ APROVADO" : "✗ REPROVADO"}
          </div>
        )}
        {answered.length === 0 && (
          <div className="text-white/30 text-sm mt-1">Aguardando respostas...</div>
        )}
      </div>

      {/* Score bar */}
      <div className="mb-4">
        <div className="h-3 bg-white/10 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-white/30 mt-1">
          <span>0,0</span>
          <span className="text-amber-400/60">5,0 (mínimo)</span>
          <span>10,0</span>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="text-center bg-emerald-500/10 rounded-lg py-2 border border-emerald-500/20">
          <div className="text-emerald-400 text-xl font-bold">{correct.length}</div>
          <div className="text-white/40 text-xs">Acertos</div>
        </div>
        <div className="text-center bg-rose-500/10 rounded-lg py-2 border border-rose-500/20">
          <div className="text-rose-400 text-xl font-bold">{wrong.length}</div>
          <div className="text-white/40 text-xs">Erros</div>
        </div>
        <div className="text-center bg-white/5 rounded-lg py-2 border border-white/10">
          <div className="text-white/40 text-xl font-bold">{blank.length}</div>
          <div className="text-white/40 text-xs">Em branco</div>
        </div>
      </div>

      {/* Progress */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-white/40 mb-1">
          <span>Progresso</span>
          <span>{answered.length}/25 respondidas</span>
        </div>
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* By range */}
      <div className="space-y-2">
        {[
          { label: "Q1–10",  range: [1, 10],  color: "text-sky-400",    bg: "bg-sky-500/10 border-sky-500/20",    bar: "bg-sky-500" },
          { label: "Q11–20", range: [11, 20], color: "text-amber-400",  bg: "bg-amber-500/10 border-amber-500/20", bar: "bg-amber-500" },
          { label: "Q21–25", range: [21, 25], color: "text-violet-400", bg: "bg-violet-500/10 border-violet-500/20", bar: "bg-violet-500" },
        ].map(({ label, range, color, bg, bar }) => {
          const qs = questions.filter(q => q.number >= range[0] && q.number <= range[1]);
          const c = qs.filter(q => q.gabarito !== null && q.resposta === q.gabarito);
          const maxPts = qs.reduce((s, q) => s + q.points, 0);
          const pts = c.reduce((s, q) => s + q.points, 0);
          const pct = qs.length > 0 ? (c.length / qs.length) * 100 : 0;
          return (
            <div key={label} className={`rounded-lg p-2.5 border ${bg}`}>
              <div className="flex justify-between items-center mb-1">
                <span className={`text-xs font-bold ${color}`}>{label}</span>
                <span className="text-white/50 text-xs">{c.length}/{qs.length} — {pts.toFixed(2)}/{maxPts.toFixed(2)} pt</span>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-300 ${bar}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Version badge */}
      {version && (
        <div className={`mt-3 text-center text-xs ${VERSION_COLORS[version].text}`}>
          Versão {version} — {percentage.toFixed(1)}%
        </div>
      )}
    </div>
  );
}

// ─── Answer Grid (compact, keyboard-friendly) ─────────────────────────────────
function AnswerGrid({
  questions,
  onAnswerChange,
  locked = false,
  mode = "resposta",
}: {
  questions: Question[];
  onAnswerChange: (qNum: number, answer: Answer) => void;
  locked?: boolean;
  mode?: "gabarito" | "resposta";
}) {
  const field: keyof Question = mode === "gabarito" ? "gabarito" : "resposta";

  // Split into two columns: Q1-13 left, Q14-25 right
  const leftQs = questions.filter(q => q.number <= 13);
  const rightQs = questions.filter(q => q.number >= 14);

  const renderRow = (q: Question) => {
    const selected = q[field] as Answer;
    const isQ1_10 = q.number <= 10;
    const isQ11_20 = q.number >= 11 && q.number <= 20;
    const hasGabarito = mode === "resposta" && q.gabarito !== null;
    const isCorrect = hasGabarito && selected !== null && selected === q.gabarito;
    const isWrong = hasGabarito && selected !== null && selected !== q.gabarito;
    const rowBg = isCorrect ? "bg-emerald-500/8 border-emerald-500/20" :
                  isWrong   ? "bg-rose-500/8 border-rose-500/20" :
                  isQ1_10   ? "bg-sky-500/5 border-sky-500/10" :
                  isQ11_20  ? "bg-amber-500/5 border-amber-500/10" :
                              "bg-violet-500/5 border-violet-500/10";
    const numColor = isQ1_10 ? "text-sky-400" : isQ11_20 ? "text-amber-400" : "text-violet-400";
    return (
      <div key={q.number} className={`flex items-center gap-3 rounded-lg px-4 py-3 border ${rowBg} transition-colors duration-150`}>
        {/* Q number */}
        <div className={`w-8 text-right text-base font-black ${numColor}`}>{q.number}</div>
        {/* Answer buttons */}
        <div className="flex gap-2 flex-1">
          {ANSWERS.map(opt => {
            const isSelected = selected === opt;
            const isGabaritoOpt = mode === "resposta" && q.gabarito === opt;
            let btnClass = "flex-1 h-11 rounded-lg text-base font-bold transition-all duration-100 ";
            if (isSelected) {
              if (mode === "gabarito") {
                btnClass += "bg-[#F7941D] text-white shadow-md scale-105";
              } else if (isCorrect) {
                btnClass += "bg-emerald-500 text-white shadow-md scale-105";
              } else {
                btnClass += "bg-rose-500 text-white shadow-md scale-105";
              }
            } else if (mode === "resposta" && isWrong && isGabaritoOpt) {
              btnClass += "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40";
            } else {
              btnClass += "bg-white/8 text-white/40 hover:bg-white/15 hover:text-white/80";
            }
            return (
              <button
                key={opt}
                onClick={() => !locked && onAnswerChange(q.number, selected === opt ? null : opt)}
                disabled={locked}
                className={btnClass}
              >
                {opt}
              </button>
            );
          })}
        </div>
        {/* Points indicator */}
        <div className="w-12 text-right">
          {mode === "resposta" && isCorrect && (
            <span className="text-emerald-400 text-sm font-bold">+{q.points.toFixed(2)}</span>
          )}
          {mode === "resposta" && isWrong && (
            <span className="text-rose-400 text-sm font-bold">✗</span>
          )}
          {mode === "gabarito" && selected && (
            <span className="text-[#F7941D]/70 text-xs">{q.points.toFixed(2)}</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-[#0D1B2A] border border-white/10 rounded-xl overflow-hidden">
      <div className="p-5 grid grid-cols-2 gap-x-5 gap-y-2">
        <div className="space-y-2">
          {leftQs.map(renderRow)}
        </div>
        <div className="space-y-2">
          {rightQs.map(renderRow)}
        </div>
      </div>
    </div>
  );
}

// ─── Student List (Modo Turma) ─────────────────────────────────────────────────
function StudentList({
  students,
  onExportCSV,
  onClear,
  gabaritoRef,
}: {
  students: StudentResult[];
  onExportCSV: () => void;
  onClear: () => void;
  gabaritoRef: Question[];
}) {
  const [showStats, setShowStats] = useState(false);
  if (students.length === 0) return null;

  const avg = students.reduce((s, st) => s + st.totalPoints, 0) / students.length;
  const approved = students.filter(s => s.approved).length;
  const highest = Math.max(...students.map(s => s.totalPoints));
  const lowest = Math.min(...students.map(s => s.totalPoints));

  // Estatísticas por questão
  const questionStats = Array.from({ length: 25 }, (_, i) => {
    const qNum = i + 1;
    const gabarito = gabaritoRef[i]?.gabarito ?? null;
    const total = students.length;
    const acertos = students.filter(s => s.answers[i] === gabarito).length;
    const erros = students.filter(s => s.answers[i] !== null && s.answers[i] !== gabarito).length;
    const branco = students.filter(s => s.answers[i] === null).length;
    const pctAcerto = total > 0 ? (acertos / total) * 100 : 0;
    return { qNum, gabarito, acertos, erros, branco, pctAcerto, total };
  });
  const hardest = [...questionStats].sort((a, b) => a.pctAcerto - b.pctAcerto).slice(0, 5);

  return (
    <div className="bg-[#0D1B2A] border border-white/10 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-white/10 bg-gradient-to-r from-[#0D1B2A] to-[#0a1628]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#F7941D]" />
            <span className="text-white font-bold text-sm">Turma — {students.length} aluno{students.length > 1 ? "s" : ""} corrigido{students.length > 1 ? "s" : ""}</span>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setShowStats(s => !s)} size="sm" variant="outline" className={`border-white/20 h-7 text-xs gap-1 ${showStats ? "text-amber-400 border-amber-500/40" : "text-white/50 hover:text-white"}`}>
              <BarChart2 className="w-3 h-3" /> {showStats ? "Ocultar Stats" : "Ver por Questão"}
            </Button>
            <Button onClick={onExportCSV} size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white h-7 text-xs gap-1">
              <FileSpreadsheet className="w-3 h-3" /> Exportar Excel
            </Button>
            <Button onClick={onClear} size="sm" variant="outline" className="border-white/20 text-white/50 hover:text-white h-7 text-xs">
              Limpar
            </Button>
          </div>
        </div>
        {/* Stats gerais */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "Média", value: avg.toFixed(1), color: avg >= 5 ? "text-emerald-400" : "text-rose-400" },
            { label: "Aprovados", value: `${approved}/${students.length}`, color: "text-blue-400" },
            { label: "Maior nota", value: highest.toFixed(1), color: "text-amber-400" },
            { label: "Menor nota", value: lowest.toFixed(1), color: "text-white/60" },
          ].map(({ label, value, color }) => (
            <div key={label} className="text-center bg-white/5 rounded-lg py-2 border border-white/10">
              <div className={`text-base font-bold ${color}`}>{value}</div>
              <div className="text-white/30 text-xs">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Painel de estatísticas por questão */}
      {showStats && (
        <div className="p-4 border-b border-white/10 bg-[#0a1628]">
          <div className="flex items-center gap-2 mb-3">
            <BarChart2 className="w-4 h-4 text-amber-400" />
            <span className="text-white font-bold text-sm">Desempenho por Questão</span>
            <span className="text-white/30 text-xs ml-auto">5 questões com maior índice de erro destacadas</span>
          </div>
          {/* Grid de todas as questões */}
          <div className="grid grid-cols-5 gap-1.5 mb-4">
            {questionStats.map(({ qNum, pctAcerto, acertos, total }) => {
              const isHard = hardest.some(h => h.qNum === qNum);
              const barColor = pctAcerto >= 70 ? "bg-emerald-500" : pctAcerto >= 40 ? "bg-amber-500" : "bg-rose-500";
              return (
                <div key={qNum} className={`rounded-lg p-2 border text-center ${isHard ? "border-rose-500/40 bg-rose-500/10" : "border-white/10 bg-white/5"}`}>
                  <div className={`text-xs font-bold mb-1 ${isHard ? "text-rose-400" : "text-white/60"}`}>Q{qNum}</div>
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mb-1">
                    <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pctAcerto}%` }} />
                  </div>
                  <div className={`text-xs font-bold ${pctAcerto >= 70 ? "text-emerald-400" : pctAcerto >= 40 ? "text-amber-400" : "text-rose-400"}`}>
                    {pctAcerto.toFixed(0)}%
                  </div>
                  <div className="text-white/20 text-xs">{acertos}/{total}</div>
                </div>
              );
            })}
          </div>
          {/* Top 5 questões mais difíceis */}
          <div className="space-y-1.5">
            <div className="text-white/40 text-xs font-bold uppercase tracking-wide mb-2">Questões com maior índice de erro</div>
            {hardest.map(({ qNum, pctAcerto, erros, branco, total, gabarito }) => (
              <div key={qNum} className="flex items-center gap-3 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
                <div className="w-8 text-rose-400 font-black text-sm">Q{qNum}</div>
                <div className="text-white/40 text-xs">Gabarito: <span className="text-white/70 font-bold">{gabarito ?? "—"}</span></div>
                <div className="flex-1">
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-rose-500 rounded-full" style={{ width: `${((erros + branco) / total) * 100}%` }} />
                  </div>
                </div>
                <div className="text-rose-400 text-xs font-bold">{(100 - pctAcerto).toFixed(0)}% de erro</div>
                <div className="text-white/30 text-xs">{erros} erros · {branco} em branco</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Student rows */}
      <div className="divide-y divide-white/5 max-h-72 overflow-y-auto">
        {students.map((st, idx) => (
          <div key={st.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/3 transition-colors">
            <div className="w-5 text-white/30 text-xs text-right">{idx + 1}</div>
            <div className={`w-6 h-6 rounded text-xs font-black flex items-center justify-center ${VERSION_COLORS[st.version].bg} text-white`}>
              {st.version}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white text-sm font-medium truncate">{st.name || "Sem nome"}</div>
              <div className="text-white/30 text-xs">{st.matricula ? `Mat. ${st.matricula} · ` : ""}{st.turma}</div>
            </div>
            <div className="text-right">
              <div className={`text-sm font-bold ${st.approved ? "text-emerald-400" : "text-rose-400"}`}>
                {st.totalPoints.toFixed(1)}
              </div>
              <div className="text-white/30 text-xs">{st.correct} acertos</div>
            </div>
            <div className={`w-2 h-2 rounded-full ${st.approved ? "bg-emerald-400" : "bg-rose-400"}`} />
          </div>
        ))}
      </div>
      {/* Painel de lançamento automático de P1 */}
      <LaunchP1Panel students={students} prova="P1" />
    </div>
  );
}

// ─── Exam Cover Component (printable) ─────────────────────────────────────────
function ExamCover({ config, version }: { config: ExamConfig; version: ExamVersion | null }) {
  const versionColors: Record<ExamVersion, string> = {
    A: "#1a3a5c", B: "#1a5c2e", C: "#5c1a1a", D: "#3d1a5c",
  };
  const vColor = version ? versionColors[version] : "#C0392B";
  return (
    <div
      id="exam-cover"
      className="bg-white text-black font-serif"
      style={{ width: "210mm", minHeight: "297mm", padding: "20mm 25mm", boxSizing: "border-box" }}
    >
      {/* Header */}
      <div style={{ borderBottom: `3px solid ${vColor}`, paddingBottom: "12px", marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ width: "60px", height: "60px", borderRadius: "50%", background: `linear-gradient(135deg, #F7941D, #C0392B)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "white", fontSize: "24px", fontWeight: "bold" }}>Rx</span>
          </div>
          <div>
            <div style={{ fontSize: "20px", fontWeight: "bold", color: vColor, fontFamily: "sans-serif" }}>CONEXÃO FARMACOLOGIA</div>
            <div style={{ fontSize: "12px", color: "#666", fontFamily: "sans-serif" }}>Universidade Federal do Estado do Rio de Janeiro — UNIRIO</div>
          </div>
          {version && (
            <div style={{ marginLeft: "auto", width: "60px", height: "60px", borderRadius: "8px", background: vColor, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "white", fontSize: "28px", fontWeight: "900", fontFamily: "sans-serif" }}>V.{version}</span>
            </div>
          )}
        </div>
      </div>

      {/* Title */}
      <div style={{ textAlign: "center", marginBottom: "24px" }}>
        <div style={{ fontSize: "18px", fontWeight: "bold", color: vColor, fontFamily: "sans-serif", textTransform: "uppercase", letterSpacing: "2px" }}>
          {config.disciplina}
        </div>
        <div style={{ fontSize: "14px", color: "#333", fontFamily: "sans-serif", marginTop: "4px" }}>
          {config.prova} — {config.semestre}
        </div>
      </div>

      {/* Student info */}
      <div style={{ border: `1px solid ${vColor}`, borderRadius: "8px", padding: "16px", marginBottom: "20px" }}>
        <div style={{ fontSize: "11px", fontWeight: "bold", color: vColor, fontFamily: "sans-serif", marginBottom: "12px", textTransform: "uppercase" }}>
          Identificação do Aluno
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", fontFamily: "sans-serif" }}>
          {[
            { label: "Nome completo", span: 2 },
            { label: "Matrícula" },
            { label: "Turma" },
            { label: "Data", value: config.data },
            { label: "Assinatura" },
          ].map((field, i) => (
            <div key={i} style={{ gridColumn: field.span === 2 ? "span 2" : "span 1" }}>
              <div style={{ fontSize: "10px", color: "#888", marginBottom: "4px" }}>{field.label}</div>
              <div style={{ borderBottom: `1px solid #ccc`, height: "24px", paddingLeft: "4px", fontSize: "12px", color: "#333" }}>
                {field.value || ""}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Instructions */}
      <div style={{ marginBottom: "20px" }}>
        <div style={{ fontSize: "11px", fontWeight: "bold", color: vColor, fontFamily: "sans-serif", marginBottom: "8px", textTransform: "uppercase" }}>
          Instruções
        </div>
        <ul style={{ fontSize: "11px", color: "#444", fontFamily: "sans-serif", margin: 0, paddingLeft: "16px", lineHeight: "1.8" }}>
          <li>Esta prova contém <strong>25 questões de múltipla escolha</strong> (A, B, C, D, E).</li>
          <li>Marque apenas <strong>uma alternativa</strong> por questão no cartão resposta.</li>
          <li>Não é permitido o uso de corretivo. Rasuras invalidam a questão.</li>
          <li>Duração: <strong>2 horas</strong>. Valor total: <strong>10,0 pontos</strong>.</li>
          {version && <li>Esta é a <strong>Versão {version}</strong>. Certifique-se de usar o gabarito correto para esta versão.</li>}
        </ul>
      </div>

      {/* Scoring legend */}
      <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
        {[
          { label: "Questões 1–10", pts: "0,20 pts/questão", total: "2,0 pts" },
          { label: "Questões 11–20", pts: "0,40 pts/questão", total: "4,0 pts" },
          { label: "Questões 21–25", pts: "0,80 pts/questão", total: "4,0 pts" },
        ].map(item => (
          <div key={item.label} style={{ textAlign: "center", padding: "8px 14px", border: `1px solid ${vColor}`, borderRadius: "4px", flex: 1 }}>
            <div style={{ fontSize: "11px", fontWeight: "bold", color: vColor, fontFamily: "sans-serif" }}>{item.label}</div>
            <div style={{ fontSize: "10px", color: "#666", fontFamily: "sans-serif" }}>{item.pts}</div>
            <div style={{ fontSize: "12px", fontWeight: "bold", color: "#333", fontFamily: "sans-serif" }}>{item.total}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── API helpers (lançamento P1) ─────────────────────────────────────────────
const API_BASE = "https://2026.conexaofarmacologia.com.br/api/trpc";
const TEACHER_TOKEN_KEY = "prof_grades_teacher_token";
const CLASS_ID_MEDICINA = 22;

async function apiQuery(path: string, input: object) {
  const p = encodeURIComponent(JSON.stringify({ json: input }));
  const r = await fetch(`${API_BASE}/${path}?input=${p}`);
  const data = await r.json();
  if (data.error) throw new Error(data.error.json?.message || "Erro desconhecido");
  return data.result.data.json;
}
async function apiMutation(path: string, input: object) {
  const r = await fetch(`${API_BASE}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ json: input }),
  });
  const data = await r.json();
  if (data.error) throw new Error(data.error.json?.message || "Erro desconhecido");
  return data.result.data.json;
}

// ─── LaunchP1Panel ────────────────────────────────────────────────────────────
function LaunchP1Panel({ students, prova }: { students: StudentResult[]; prova: string }) {
  const [token, setToken] = useState(() => localStorage.getItem(TEACHER_TOKEN_KEY) || "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [launched, setLaunched] = useState<Record<string, "ok" | "error" | "notfound">>({});
  const [showLogin, setShowLogin] = useState(!token);
  const [members, setMembers] = useState<{ id: number; name: string; teamId: number }[]>([]);
  const [membersLoaded, setMembersLoaded] = useState(false);

  // Carregar lista de membros ao ter token
  useEffect(() => {
    if (!token || membersLoaded) return;
    apiQuery("members.list", { sessionToken: token })
      .then((data: any[]) => {
        setMembers(data.map((m: any) => ({
          id: m.id,
          name: (() => { const n = m.name || ""; const p = n.split("\t"); return p.length >= 2 ? p[1].trim() : n.trim(); })(),
          teamId: m.teamId,
        })));
        setMembersLoaded(true);
      })
      .catch(() => setMembersLoaded(false));
  }, [token, membersLoaded]);

  const handleLogin = async () => {
    if (!email || !password) return;
    setLoginLoading(true);
    try {
      let res = await apiMutation("teacherAuth.login", { email, password }).catch(() => null);
      if (!res?.sessionToken) {
        res = await apiMutation("teacherAuth.superAdminLogin", { email, password }).catch(() => null);
      }
      if (res?.sessionToken) {
        setToken(res.sessionToken);
        localStorage.setItem(TEACHER_TOKEN_KEY, res.sessionToken);
        setShowLogin(false);
        setMembersLoaded(false);
      } else {
        toast.error("Credenciais inválidas. Apenas professores podem lançar notas.");
      }
    } catch {
      toast.error("Erro ao autenticar. Verifique suas credenciais.");
    } finally {
      setLoginLoading(false);
    }
  };

  // Normaliza nome para comparação fuzzy
  const normName = (s: string) => s.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, "").trim();

  const findMember = (studentName: string) => {
    const norm = normName(studentName);
    if (!norm) return null;
    // Exact match first
    let found = members.find(m => normName(m.name) === norm);
    if (found) return found;
    // Partial: student name words all in member name
    const words = norm.split(" ").filter(w => w.length > 2);
    found = members.find(m => words.every(w => normName(m.name).includes(w)));
    return found || null;
  };

  const handleLaunch = async () => {
    if (!token || students.length === 0) return;
    setLaunching(true);
    const results: Record<string, "ok" | "error" | "notfound"> = {};
    for (const st of students) {
      const member = findMember(st.name);
      if (!member) {
        results[st.id] = "notfound";
        continue;
      }
      try {
        // Usar activityType "prova" e activityName "P1" (ou P2 etc.)
        await apiMutation("monitors.adminUpsertActivityGrade", {
          teacherSessionToken: token,
          classId: CLASS_ID_MEDICINA,
          activityType: "prova",
          activityName: prova,
          homeGroupId: member.teamId,
          groupName: `Membro ${member.id}`,
          grade: st.totalPoints,
          maxGrade: 10,
          memberId: member.id,
        });
        results[st.id] = "ok";
      } catch {
        results[st.id] = "error";
      }
    }
    setLaunched(results);
    setLaunching(false);
    const ok = Object.values(results).filter(v => v === "ok").length;
    const notfound = Object.values(results).filter(v => v === "notfound").length;
    const errors = Object.values(results).filter(v => v === "error").length;
    if (ok > 0) toast.success(`${ok} nota(s) lançada(s) com sucesso!`);
    if (notfound > 0) toast.warning(`${notfound} aluno(s) não encontrado(s) na turma.`);
    if (errors > 0) toast.error(`${errors} erro(s) ao lançar nota(s).`);
  };

  const okCount = Object.values(launched).filter(v => v === "ok").length;
  const allDone = students.length > 0 && okCount === students.length;

  return (
    <div className="border-t border-white/10 bg-[#0a1628]">
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Send className="w-4 h-4 text-purple-400" />
          <span className="text-white font-bold text-sm">Lançar {prova} na Tabela do Professor</span>
          {allDone && <span className="ml-auto text-emerald-400 text-xs font-bold">✓ Todas as notas lançadas</span>}
        </div>

        {showLogin || !token ? (
          <div className="bg-white/5 rounded-lg p-3 border border-white/10 space-y-2">
            <p className="text-white/50 text-xs mb-2">Autentique-se como professor para lançar as notas automaticamente.</p>
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="professor@unirio.br"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleLogin()}
                className="flex-1 bg-[#1a2744] border border-[#1e3a5f] rounded px-3 py-1.5 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-purple-500"
              />
              <input
                type="password"
                placeholder="Senha"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleLogin()}
                className="w-28 bg-[#1a2744] border border-[#1e3a5f] rounded px-3 py-1.5 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-purple-500"
              />
              <Button
                size="sm"
                onClick={handleLogin}
                disabled={loginLoading || !email || !password}
                className="bg-purple-600 hover:bg-purple-700 text-white text-xs px-3"
              >
                {loginLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Unlock className="w-3 h-3" />}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-emerald-400 text-xs">
                <Unlock className="w-3 h-3" />
                <span>Autenticado</span>
              </div>
              <span className="text-white/30 text-xs">·</span>
              <span className="text-white/40 text-xs">{membersLoaded ? `${members.length} alunos carregados` : "Carregando turma..."}</span>
              <button onClick={() => { setToken(""); setShowLogin(true); localStorage.removeItem(TEACHER_TOKEN_KEY); }} className="ml-auto text-white/30 hover:text-white/60 text-xs">
                Trocar conta
              </button>
            </div>

            {/* Preview dos alunos com status */}
            {Object.keys(launched).length > 0 && (
              <div className="bg-white/5 rounded-lg border border-white/10 divide-y divide-white/5 max-h-40 overflow-y-auto">
                {students.map(st => {
                  const status = launched[st.id];
                  const member = findMember(st.name);
                  return (
                    <div key={st.id} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                      <div className="flex-1 text-white/70 truncate">{st.name || "Sem nome"}</div>
                      <div className="text-white/40">{st.totalPoints.toFixed(1)}</div>
                      {status === "ok" && <span className="text-emerald-400 font-bold">✓ Lançado</span>}
                      {status === "notfound" && <span className="text-amber-400">Não encontrado</span>}
                      {status === "error" && <span className="text-rose-400">Erro</span>}
                      {!status && member && <span className="text-white/30">Pronto</span>}
                      {!status && !member && membersLoaded && <span className="text-amber-400/60 text-xs">Não encontrado</span>}
                    </div>
                  );
                })}
              </div>
            )}

            <Button
              onClick={handleLaunch}
              disabled={launching || !membersLoaded || allDone}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white text-sm"
            >
              {launching ? (
                <><RefreshCw className="w-4 h-4 animate-spin mr-2" />Lançando notas...</>
              ) : allDone ? (
                <><CheckCircle2 className="w-4 h-4 mr-2" />Notas lançadas</>
              ) : (
                <><Send className="w-4 h-4 mr-2" />Lançar {students.length} nota(s) de {prova}</>
              )}
            </Button>
            <p className="text-white/30 text-xs text-center">
              As notas serão visíveis na Tabela do Professor após o próximo carregamento.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function ExamTools() {
  const [activeTab, setActiveTab] = useState<"cover" | "correction">("correction");
  const [examConfig, setExamConfig] = useState<ExamConfig>({
    disciplina: "Farmacologia I",
    turma: TURMAS[0],
    prova: "P1",
    data: new Date().toISOString().split("T")[0],
    professor: "",
    semestre: "1º Semestre 2026",
  });

  // Correction state
  const [selectedVersion, setSelectedVersion] = useState<ExamVersion | null>(null);
  const [questions, setQuestions] = useState<Question[]>(() => initQuestions(null));
  const [studentName, setStudentName] = useState("");
  const [studentMatricula, setStudentMatricula] = useState("");
  const [gabaritoLocked, setGabaritoLocked] = useState(false);
  const [savedGabarito, setSavedGabarito] = useState<Question[] | null>(null);

  // Turma mode
  const [studentResults, setStudentResults] = useState<StudentResult[]>([]);
  const [studentCounter, setStudentCounter] = useState(0);

  // Computed
  const respostaFilled = questions.filter(q => q.resposta !== null).length;
  const gabaritoFilled = questions.filter(q => q.gabarito !== null).length;
  const totalPoints = useMemo(() =>
    questions.filter(q => q.gabarito !== null && q.resposta === q.gabarito)
             .reduce((sum, q) => sum + q.points, 0),
    [questions]
  );

  const handleVersionSelect = useCallback((v: ExamVersion) => {
    if (gabaritoLocked) {
      toast.warning("Reinicie para trocar a versão.");
      return;
    }
    setSelectedVersion(v);
    setQuestions(initQuestions(v));
    toast.success(`Versão ${v} selecionada — gabarito carregado automaticamente.`);
  }, [gabaritoLocked]);

  const handleAnswerChange = useCallback((qNum: number, answer: Answer) => {
    setQuestions(prev => prev.map(q => q.number === qNum ? { ...q, resposta: answer } : q));
  }, []);

  const lockGabarito = () => {
    if (!selectedVersion) return;
    setGabaritoLocked(true);
    setSavedGabarito(questions.map(q => ({ ...q })));
    toast.success(`Gabarito Versão ${selectedVersion} confirmado. Preencha as respostas do aluno.`);
  };

  const saveAndNextStudent = () => {
    if (!savedGabarito || !selectedVersion) return;
    const correct = questions.filter(q => q.gabarito !== null && q.resposta === q.gabarito);
    const wrong = questions.filter(q => q.gabarito !== null && q.resposta !== null && q.resposta !== q.gabarito);
    const blank = questions.filter(q => q.resposta === null);
    const pts = correct.reduce((sum, q) => sum + q.points, 0);

    const result: StudentResult = {
      id: studentCounter + 1,
      name: studentName || `Aluno ${studentCounter + 1}`,
      matricula: studentMatricula,
      version: selectedVersion,
      turma: examConfig.turma,
      answers: questions.map(q => q.resposta),
      correct: correct.length,
      wrong: wrong.length,
      blank: blank.length,
      totalPoints: pts,
      approved: pts >= 5.0,
      timestamp: new Date().toLocaleTimeString("pt-BR"),
    };

    setStudentResults(prev => [...prev, result]);
    setStudentCounter(prev => prev + 1);

    // Reset for next student
    setQuestions(savedGabarito.map(q => ({ ...q, resposta: null })));
    setStudentName("");
    setStudentMatricula("");
    toast.success(`${result.name} — ${pts.toFixed(1)} pts salvo! Próximo aluno.`);
  };

  const newStudent = () => {
    if (!savedGabarito) return;
    setQuestions(savedGabarito.map(q => ({ ...q, resposta: null })));
    setStudentName("");
  };

  const resetAll = () => {
    setQuestions(initQuestions(null));
    setSelectedVersion(null);
    setGabaritoLocked(false);
    setSavedGabarito(null);
    setStudentName("");
    toast.info("Tudo reiniciado.");
  };

  const exportXLSX = () => {
    if (studentResults.length === 0) return;
    const rows = studentResults.map((s, i) => ({
      "Nº": i + 1,
      "Nome": s.name,
      "Matrícula": s.matricula || "",
      "Turma": s.turma,
      "Versão": s.version,
      "Nota": parseFloat(s.totalPoints.toFixed(1)),
      "Acertos": s.correct,
      "Erros": s.wrong,
      "Em Branco": s.blank,
      "Situação": s.approved ? "APROVADO" : "REPROVADO",
      "Horário": s.timestamp,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    // Largura das colunas
    ws["!cols"] = [
      { wch: 5 }, { wch: 30 }, { wch: 14 }, { wch: 30 }, { wch: 8 },
      { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 10 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Notas");
    // Aba de estatísticas por questão
    const gabaritoRef = savedGabarito || [];
    const statsRows = Array.from({ length: 25 }, (_, i) => {
      const qNum = i + 1;
      const gabarito = gabaritoRef[i]?.gabarito ?? "";
      const total = studentResults.length;
      const acertos = studentResults.filter(s => s.answers[i] === gabarito).length;
      const erros = studentResults.filter(s => s.answers[i] !== null && s.answers[i] !== gabarito).length;
      const branco = studentResults.filter(s => s.answers[i] === null).length;
      return {
        "Questão": qNum,
        "Gabarito": gabarito,
        "Acertos": acertos,
        "Erros": erros,
        "Em Branco": branco,
        "% Acerto": total > 0 ? parseFloat(((acertos / total) * 100).toFixed(1)) : 0,
        "% Erro": total > 0 ? parseFloat(((erros / total) * 100).toFixed(1)) : 0,
      };
    });
    const ws2 = XLSX.utils.json_to_sheet(statsRows);
    ws2["!cols"] = [{ wch: 8 }, { wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 10 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, ws2, "Estatísticas por Questão");
    const fname = `notas_${examConfig.prova}_${examConfig.turma.replace(/\s+/g, "_")}_${new Date().toLocaleDateString("pt-BR").replace(/\//g, "-")}.xlsx`;
    XLSX.writeFile(wb, fname);
    toast.success("Planilha Excel exportada com sucesso!");
  };
  const exportCSV = exportXLSX;

  const printBoletim = () => {
    const correct = questions.filter(q => q.gabarito !== null && q.resposta === q.gabarito);
    const wrong = questions.filter(q => q.gabarito !== null && q.resposta !== null && q.resposta !== q.gabarito);
    const blank = questions.filter(q => q.resposta === null);
    const pts = correct.reduce((sum, q) => sum + q.points, 0);
    const approved = pts >= 5.0;

    const win = window.open("", "_blank");
    if (!win) return;
    const rows = questions.map(q => {
      const isCorrect = q.gabarito !== null && q.resposta === q.gabarito;
      return `<tr style="background:${isCorrect ? "#f0fff4" : q.resposta ? "#fff5f5" : "#fafafa"}">
        <td style="padding:5px 10px;border:1px solid #ddd;text-align:center;font-weight:bold">${q.number}</td>
        <td style="padding:5px 10px;border:1px solid #ddd;text-align:center">${q.gabarito || "—"}</td>
        <td style="padding:5px 10px;border:1px solid #ddd;text-align:center">${q.resposta || "—"}</td>
        <td style="padding:5px 10px;border:1px solid #ddd;text-align:center;color:${isCorrect ? "#16a34a" : "#dc2626"}">${isCorrect ? "✓" : q.resposta ? "✗" : "—"}</td>
        <td style="padding:5px 10px;border:1px solid #ddd;text-align:center">${isCorrect ? q.points.toFixed(2) : "0,00"}</td>
      </tr>`;
    }).join("");

    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>Boletim — ${studentName || "Aluno"}</title>
    <style>
      body{font-family:Arial,sans-serif;padding:24px;max-width:700px;margin:0 auto}
      h2{color:#1a3a5c;border-bottom:3px solid #F7941D;padding-bottom:8px}
      .header{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}
      .score{font-size:48px;font-weight:900;color:${approved ? "#16a34a" : "#dc2626"}}
      .badge{display:inline-block;padding:4px 12px;border-radius:4px;font-weight:bold;background:${approved ? "#dcfce7" : "#fee2e2"};color:${approved ? "#16a34a" : "#dc2626"}}
      table{border-collapse:collapse;width:100%;margin-top:16px}
      th{background:#1a3a5c;color:white;padding:8px 10px;border:1px solid #ddd}
      .stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:16px 0}
      .stat{text-align:center;padding:12px;border:1px solid #ddd;border-radius:6px}
      .stat-val{font-size:24px;font-weight:bold}
      @media print{body{padding:12px}}
    </style>
    </head><body>
    <h2>Conexão Farmacologia — UNIRIO</h2>
    <div class="header">
      <div>
        <div style="font-size:18px;font-weight:bold">${studentName || "Aluno sem nome"}</div>
        <div style="color:#666;font-size:13px">${examConfig.turma} | ${examConfig.prova}${selectedVersion ? ` — Versão ${selectedVersion}` : ""}</div>
        <div style="color:#666;font-size:12px">${new Date().toLocaleDateString("pt-BR")}</div>
      </div>
      <div style="text-align:right">
        <div class="score">${pts.toFixed(1)}</div>
        <div style="color:#666;font-size:13px">/ 10,0 pontos</div>
        <div class="badge">${approved ? "✓ APROVADO" : "✗ REPROVADO"}</div>
      </div>
    </div>
    <div class="stats">
      <div class="stat"><div class="stat-val" style="color:#16a34a">${correct.length}</div><div>Acertos</div></div>
      <div class="stat"><div class="stat-val" style="color:#dc2626">${wrong.length}</div><div>Erros</div></div>
      <div class="stat"><div class="stat-val" style="color:#9ca3af">${blank.length}</div><div>Em branco</div></div>
    </div>
    <table>
      <thead><tr><th>Q</th><th>Gabarito</th><th>Resposta</th><th>Resultado</th><th>Pontos</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="margin-top:20px;font-size:13px;color:#666">
      <strong>Total: ${pts.toFixed(1)} pts</strong> | Acertos: ${correct.length} | Erros: ${wrong.length} | Em branco: ${blank.length}
    </p>
    </body></html>`);
    win.document.close();
    setTimeout(() => { win.print(); }, 400);
  };

  const printCover = () => {
    const el = document.getElementById("exam-cover");
    if (!el) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Capa da Prova</title>
      <style>@page{size:A4;margin:0}body{margin:0;padding:0}*{box-sizing:border-box}</style>
      </head><body>${el.outerHTML}</body></html>`);
    win.document.close();
    setTimeout(() => { win.print(); win.close(); }, 500);
  };

  return (
    <div className="min-h-screen bg-[#0A1628] text-white">
      {/* Top bar */}
      <div className="border-b border-white/10 bg-[#0D1B2A]/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/professor/notas">
              <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                <ArrowLeft className="w-4 h-4 mr-1" /> Portal
              </Button>
            </Link>
            <div className="h-5 w-px bg-white/10" />
            <LogoIcon size={28} />
            <div>
              <div className="text-white font-bold text-sm">Ferramentas de Prova</div>
              <div className="text-white/40 text-xs">Conexão Farmacologia — UNIRIO</div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost" size="sm"
              onClick={() => setActiveTab("cover")}
              className={activeTab === "cover" ? "bg-white/10 text-white" : "text-white/50 hover:text-white"}
            >
              <FileText className="w-3.5 h-3.5 mr-1" /> Capa da Prova
            </Button>
            <Button
              variant="ghost" size="sm"
              onClick={() => setActiveTab("correction")}
              className={activeTab === "correction" ? "bg-white/10 text-white" : "text-white/50 hover:text-white"}
            >
              <ClipboardList className="w-3.5 h-3.5 mr-1" /> Correção
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">

        {/* ── TAB: CAPA ─────────────────────────────────────────────────────── */}
        {activeTab === "cover" && (
          <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
            <div className="space-y-4">
              <div className="bg-[#0D1B2A] border border-white/10 rounded-xl p-5">
                <h2 className="text-white font-bold text-base mb-4 flex items-center gap-2">
                  <span className="text-[#F7941D]">⚙</span> Configurar Capa
                </h2>
                <div className="space-y-3">
                  <div>
                    <Label className="text-white/60 text-xs">Disciplina</Label>
                    <Input value={examConfig.disciplina} onChange={e => setExamConfig(p => ({ ...p, disciplina: e.target.value }))}
                      className="bg-white/5 border-white/20 text-white mt-1 h-8 text-sm" />
                  </div>
                  <div>
                    <Label className="text-white/60 text-xs">Turma</Label>
                    <Select value={examConfig.turma} onValueChange={v => setExamConfig(p => ({ ...p, turma: v }))}>
                      <SelectTrigger className="bg-white/5 border-white/20 text-white mt-1 h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#0D1B2A] border-white/20">
                        {TURMAS.map(t => <SelectItem key={t} value={t} className="text-white">{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-white/60 text-xs">Prova</Label>
                    <Select value={examConfig.prova} onValueChange={v => setExamConfig(p => ({ ...p, prova: v as "P1" | "P2" | "Substitutiva" }))}>
                      <SelectTrigger className="bg-white/5 border-white/20 text-white mt-1 h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#0D1B2A] border-white/20">
                        <SelectItem value="P1" className="text-white">P1 — Primeira Prova</SelectItem>
                        <SelectItem value="P2" className="text-white">P2 — Segunda Prova</SelectItem>
                        <SelectItem value="Substitutiva" className="text-white">Substitutiva</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-white/60 text-xs">Versão</Label>
                    <Select value={selectedVersion || ""} onValueChange={v => setSelectedVersion(v as ExamVersion)}>
                      <SelectTrigger className="bg-white/5 border-white/20 text-white mt-1 h-8 text-sm">
                        <SelectValue placeholder="Selecionar versão..." />
                      </SelectTrigger>
                      <SelectContent className="bg-[#0D1B2A] border-white/20">
                        {(["A", "B", "C", "D"] as ExamVersion[]).map(v => (
                          <SelectItem key={v} value={v} className="text-white">Versão {v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-white/60 text-xs">Data</Label>
                      <Input type="date" value={examConfig.data} onChange={e => setExamConfig(p => ({ ...p, data: e.target.value }))}
                        className="bg-white/5 border-white/20 text-white mt-1 h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-white/60 text-xs">Semestre</Label>
                      <Input value={examConfig.semestre} onChange={e => setExamConfig(p => ({ ...p, semestre: e.target.value }))}
                        className="bg-white/5 border-white/20 text-white mt-1 h-8 text-sm" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-white/60 text-xs">Professor(a)</Label>
                    <Input value={examConfig.professor} onChange={e => setExamConfig(p => ({ ...p, professor: e.target.value }))}
                      className="bg-white/5 border-white/20 text-white mt-1 h-8 text-sm" />
                  </div>
                </div>
                <Button onClick={printCover} className="w-full mt-4 bg-[#F7941D] hover:bg-[#e8851a] text-white font-bold">
                  <Printer className="w-4 h-4 mr-2" /> Imprimir Capa
                </Button>
              </div>
            </div>
            {/* Preview */}
            <div className="overflow-auto">
              <div className="text-white/40 text-xs uppercase tracking-wider mb-3">Pré-visualização</div>
              <div className="transform scale-75 origin-top-left" style={{ width: "133.3%", pointerEvents: "none" }}>
                <ExamCover config={examConfig} version={selectedVersion} />
              </div>
            </div>
          </div>
        )}

        {/* ── TAB: CORREÇÃO ─────────────────────────────────────────────────── */}
        {activeTab === "correction" && (
          <div className="space-y-6">

            {/* Step 1: Version selector */}
            <div className="bg-[#0D1B2A] border border-white/10 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${gabaritoLocked ? "bg-emerald-500 text-white" : "bg-[#F7941D] text-white"}`}>
                  {gabaritoLocked ? "✓" : "1"}
                </div>
                <div>
                  <div className="text-white font-bold text-sm">Selecionar Versão da Prova</div>
                  <div className="text-white/40 text-xs">O gabarito é carregado automaticamente ao selecionar a versão</div>
                </div>
                {gabaritoLocked && selectedVersion && (
                  <Badge className={`ml-auto ${VERSION_COLORS[selectedVersion].badge}`}>
                    Versão {selectedVersion} — Gabarito Confirmado
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-4 gap-3">
                {(["A", "B", "C", "D"] as ExamVersion[]).map(v => {
                  const vc = VERSION_COLORS[v];
                  const isSelected = selectedVersion === v;
                  return (
                    <button
                      key={v}
                      onClick={() => handleVersionSelect(v)}
                      disabled={gabaritoLocked}
                      className={`
                        relative rounded-xl py-4 text-center font-black text-2xl transition-all duration-200
                        ${isSelected
                          ? `${vc.bg} text-white shadow-lg scale-105`
                          : `bg-white/5 ${vc.text} hover:bg-white/10 border border-white/10`
                        }
                        ${gabaritoLocked ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                      `}
                    >
                      {v}
                      {isSelected && !gabaritoLocked && (
                        <div className="absolute -top-1.5 -right-1.5">
                          <CheckCircle2 className="w-5 h-5 text-white fill-current" />
                        </div>
                      )}
                      <div className="text-xs font-normal mt-0.5 opacity-70">Versão {v}</div>
                    </button>
                  );
                })}
              </div>

              {selectedVersion && !gabaritoLocked && (
                <Button onClick={lockGabarito} className="w-full mt-4 bg-[#F7941D] hover:bg-[#e8851a] text-white font-bold h-10">
                  <CheckCircle2 className="w-4 h-4 mr-2" /> Confirmar Gabarito — Versão {selectedVersion}
                </Button>
              )}
            </div>

            {/* Step 2 + 3: Answer entry + Live score */}
            {gabaritoLocked && (
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">

                {/* Left: Student info + answer grid */}
                <div className="space-y-4">
                  {/* Student header */}
                  <div className="bg-[#0D1B2A] border border-white/10 rounded-xl p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold text-white">2</div>
                      <div>
                        <div className="text-white font-bold text-sm">Respostas do Aluno</div>
                        <div className="text-white/40 text-xs">A nota é calculada em tempo real</div>
                      </div>
                      <div className="ml-auto flex items-center gap-3">
                        <span className="text-white/40 text-xs">{respostaFilled}/25</span>
                        {respostaFilled === 25 && (
                          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">Completo</Badge>
                        )}
                      </div>
                    </div>

                    {/* Student name + matrícula + turma */}
                    <div className="grid grid-cols-3 gap-3 mb-3">
                      <div>
                        <Label className="text-white/50 text-xs">Nome do aluno</Label>
                        <Input
                          placeholder="Digite o nome..."
                          value={studentName}
                          onChange={e => setStudentName(e.target.value)}
                          className="bg-white/5 border-white/20 text-white placeholder:text-white/20 mt-1 h-8 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-white/50 text-xs">Matrícula</Label>
                        <Input
                          placeholder="Ex: 2024001234"
                          value={studentMatricula}
                          onChange={e => setStudentMatricula(e.target.value)}
                          className="bg-white/5 border-white/20 text-white placeholder:text-white/20 mt-1 h-8 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-white/50 text-xs">Turma</Label>
                        <Select value={examConfig.turma} onValueChange={v => setExamConfig(p => ({ ...p, turma: v }))}>
                          <SelectTrigger className="bg-white/5 border-white/20 text-white mt-1 h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-[#0D1B2A] border-white/20">
                            {TURMAS.map(t => <SelectItem key={t} value={t} className="text-white">{t}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Answer grid */}
                    <AnswerGrid
                      questions={questions}
                      onAnswerChange={handleAnswerChange}
                      mode="resposta"
                    />

                    {/* Action buttons */}
                    <div className="flex gap-2 mt-3">
                      <Button
                        onClick={saveAndNextStudent}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-9"
                        disabled={respostaFilled === 0}
                      >
                        <Users className="w-4 h-4 mr-2" />
                        Salvar e Próximo Aluno
                      </Button>
                      <Button
                        onClick={printBoletim}
                        variant="outline"
                        className="border-white/20 text-white/60 hover:text-white hover:bg-white/5 h-9"
                        disabled={respostaFilled === 0}
                      >
                        <Printer className="w-4 h-4 mr-1" /> Boletim
                      </Button>
                      <Button
                        onClick={newStudent}
                        variant="outline"
                        className="border-white/20 text-white/60 hover:text-white hover:bg-white/5 h-9"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Right: Live score */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center text-sm font-bold text-white">3</div>
                    <div>
                      <div className="text-white font-bold text-sm">Nota em Tempo Real</div>
                      <div className="text-white/40 text-xs">Atualiza a cada resposta marcada</div>
                    </div>
                  </div>
                  <LiveScore questions={questions} version={selectedVersion} />

                  {/* Reset button */}
                  <Button onClick={resetAll} variant="outline" className="w-full border-white/20 text-white/50 hover:text-white hover:bg-white/5 h-8 text-xs">
                    <RotateCcw className="w-3 h-3 mr-1" /> Reiniciar Tudo (nova versão)
                  </Button>
                </div>
              </div>
            )}

            {/* Student list (Modo Turma) */}
            {studentResults.length > 0 && (
              <StudentList
                students={studentResults}
                onExportCSV={exportCSV}
                onClear={() => { setStudentResults([]); setStudentCounter(0); }}
                gabaritoRef={savedGabarito ?? []}
              />
            )}

            {/* ── Gabaritos para Download ─────────────────────────────── */}
            <div className="bg-[#0D1B2A] border border-white/10 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-white/10 flex items-center gap-2">
                <FileText className="w-4 h-4 text-orange-400" />
                <span className="text-sm font-semibold text-white">Provas P1 — Gabaritos e Downloads</span>
                <span className="ml-auto text-xs text-white/30">1º Semestre 2026 · Farmacologia I</span>
              </div>
              <div className="p-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
                {([
                  { versao: 'A', cor: '#1a3a5c', corTexto: '#60a5fa', url: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663038327412/OxQHVQtiUVRYRQWa.pdf' },
                  { versao: 'B', cor: '#1a5c2e', corTexto: '#4ade80', url: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663038327412/YKHYuOjhgIKPIgiz.pdf' },
                  { versao: 'C', cor: '#5c1a1a', corTexto: '#f87171', url: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663038327412/kGekZNgQLzZqQtsl.pdf' },
                  { versao: 'D', cor: '#3d1a5c', corTexto: '#c084fc', url: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663038327412/NmmQsXcvYrxJnrBe.pdf' },
                ] as const).map(({ versao, cor, corTexto, url }) => (
                  <a
                    key={versao}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 rounded-lg border p-3 hover:opacity-90 transition-opacity cursor-pointer"
                    style={{ backgroundColor: cor + '33', borderColor: cor + '88' }}
                  >
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg shrink-0" style={{ backgroundColor: cor, color: corTexto }}>
                      {versao}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white">Versão {versao}</p>
                      <p className="text-xs text-white/40">25 questões · PDF</p>
                    </div>
                    <Download className="w-4 h-4 ml-auto shrink-0" style={{ color: corTexto }} />
                  </a>
                ))}
              </div>
              <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <a
                  href="https://files.manuscdn.com/user_upload_by_module/session_file/310519663038327412/dTzzaKFuvhAFTqdo.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 hover:bg-yellow-500/20 transition-colors cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-lg bg-yellow-600 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-yellow-300">Gabarito Consolidado A/B/C/D</p>
                    <p className="text-xs text-white/40">Tabela comparativa das 4 versões · PDF</p>
                  </div>
                  <Download className="w-4 h-4 ml-auto text-yellow-400 shrink-0" />
                </a>
                <a
                  href="https://files.manuscdn.com/user_upload_by_module/session_file/310519663038327412/YuhRnCWeEMLOQYka.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-lg border border-green-500/30 bg-green-500/10 p-3 hover:bg-green-500/20 transition-colors cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-lg bg-green-700 flex items-center justify-center shrink-0">
                    <BookOpen className="w-5 h-5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-green-300">Gabarito Comentado</p>
                    <p className="text-xs text-white/40">Com justificativas farmacológicas · PDF</p>
                  </div>
                  <Download className="w-4 h-4 ml-auto text-green-400 shrink-0" />
                </a>
              </div>
            </div>

            {/* Empty state */}
            {!gabaritoLocked && (
              <div className="bg-[#0D1B2A] border border-white/10 rounded-xl p-12 text-center">
                <div className="text-5xl mb-4">📋</div>
                <div className="text-white font-bold text-lg mb-2">Selecione a versão da prova</div>
                <div className="text-white/40 text-sm max-w-md mx-auto">
                  Escolha a versão (A, B, C ou D) acima. O gabarito será carregado automaticamente
                  e a nota do aluno será calculada em tempo real conforme as respostas são marcadas.
                </div>
                <div className="flex items-center justify-center gap-6 mt-6">
                  {(["A", "B", "C", "D"] as ExamVersion[]).map(v => (
                    <div key={v} className={`text-2xl font-black ${VERSION_COLORS[v].text}`}>{v}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
