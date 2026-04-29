/**
 * ExamToolsManager — Ferramentas de Prova para o Portal do Professor
 * Design: Dark academic, vermelho escarlate, tipografia Crimson Text
 *
 * Funcionalidades:
 * 1. Cartão resposta imprimível em branco (A4, 25 questões, bolhas)
 * 2. Modo turma: corrigir múltiplos alunos e gerar planilha de notas
 * 3. Integração automática de notas P1/P2 via API
 *
 * Pontuação:
 * - Q1–10 Fácil: 0,20 pt × 10 = 2,0 pt
 * - Q11–20 Intermediário: 0,40 pt × 10 = 4,0 pt
 * - Q21–25 Difícil: 0,80 pt × 5 = 4,0 pt
 * - Total: 10,0 pt | Aprovado ≥ 5,0
 */

import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Printer, CheckCircle, Download, RefreshCw, Users, ChevronDown, ChevronUp, Save, Loader2, AlertTriangle, Camera, BarChart2, Database } from "lucide-react";

// ─── Tipos ───
type Difficulty = "facil" | "intermediario" | "dificil";
type Answer = "A" | "B" | "C" | "D" | "E" | null;

const DIFFICULTY_CONFIG: Record<Difficulty, { label: string; color: string; points: number; range: [number, number] }> = {
  facil:         { label: "Fácil",         color: "#22c55e", points: 0.20, range: [1, 10] },
  intermediario: { label: "Intermediário", color: "#f59e0b", points: 0.40, range: [11, 20] },
  dificil:       { label: "Difícil",       color: "#ef4444", points: 0.80, range: [21, 25] },
};

const DEFAULT_DIFFICULTIES: Difficulty[] = Array.from({ length: 25 }, (_, i) => {
  if (i < 10) return "facil";
  if (i < 20) return "intermediario";
  return "dificil";
});

function getDifficulty(q: number): Difficulty {
  if (q <= 10) return "facil";
  if (q <= 20) return "intermediario";
  return "dificil";
}

function calcScore(answers: Answer[], gabarito: Answer[], difficulties: Difficulty[]): number {
  let total = 0;
  for (let i = 0; i < 25; i++) {
    if (answers[i] && answers[i] === gabarito[i]) {
      total += DIFFICULTY_CONFIG[difficulties[i]].points;
    }
  }
  return Math.round(total * 100) / 100;
}

// ─── Componente de bolha de alternativa ───
function Bubble({ letter, selected, correct, wrong, onClick }: {
  letter: string; selected: boolean; correct?: boolean; wrong?: boolean; onClick?: () => void;
}) {
  let bg = "bg-transparent border-2 border-gray-600 text-gray-400";
  if (selected && correct) bg = "bg-green-600 border-green-600 text-white";
  else if (selected && wrong) bg = "bg-red-600 border-red-600 text-white";
  else if (selected) bg = "bg-amber-600 border-amber-600 text-white";
  return (
    <button
      onClick={onClick}
      className={`w-8 h-8 rounded-full text-xs font-bold transition-all ${bg} ${onClick ? "hover:opacity-80 cursor-pointer" : "cursor-default"}`}
    >
      {letter}
    </button>
  );
}

// ─── Resultado de um aluno ───
interface StudentResult {
  name: string;
  memberId?: number;
  examVersion?: string;
  answers: Answer[];
  score: number;
  approved: boolean;
  correctCount: number;
  byDifficulty: Record<Difficulty, { correct: number; total: number; points: number }>;
}

// ─── Props ───
interface ExamToolsManagerProps {
  teacherToken: string;
  classes?: Array<{ id: number; name: string }>;
}

export default function ExamToolsManager({ teacherToken, classes = [] }: ExamToolsManagerProps) {
  const [tab, setTab] = useState<"gabarito" | "correcao" | "turma" | "imprimir">("gabarito");

  // Gabarito
  const [gabarito, setGabarito] = useState<Answer[]>(Array(25).fill(null));
  const [difficulties, setDifficulties] = useState<Difficulty[]>([...DEFAULT_DIFFICULTIES]);
  const [gabaritoConfirmed, setGabaritoConfirmed] = useState(false);
  const [showDiffConfig, setShowDiffConfig] = useState(false);

  // Correção individual
  const [studentName, setStudentName] = useState("");
  const [studentAnswers, setStudentAnswers] = useState<Answer[]>(Array(25).fill(null));
  const [currentResult, setCurrentResult] = useState<StudentResult | null>(null);

  // Modo turma
  const [classResults, setClassResults] = useState<StudentResult[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [classMembers, setClassMembers] = useState<Array<{ id: number; name: string }>>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [currentMemberIdx, setCurrentMemberIdx] = useState(0);
  const [turmaMode, setTurmaMode] = useState(false);
  const [savingGrades, setSavingGrades] = useState(false);

  // Prova (P1 ou P2) e versão (A/B/C/D)
  const [provaType, setProvaType] = useState<"P1" | "P2">("P1");
  const [examVersion, setExamVersion] = useState<"A" | "B" | "C" | "D">("A");
  const [turmaName, setTurmaName] = useState("");
  const [examDate, setExamDate] = useState(() => new Date().toISOString().split("T")[0]);

  // Gabarito fixo no banco
  const [savingGabarito, setSavingGabarito] = useState(false);
  const [loadingGabarito, setLoadingGabarito] = useState(false);

  // OCR
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [ocrLoading, setOcrLoading] = useState(false);

  const utils = trpc.useUtils();

  // ─── Pré-selecionar primeira turma ao montar ───
  useEffect(() => {
    if (classes.length > 0 && !selectedClassId) {
      const first = classes[0];
      setSelectedClassId(first.id);
      setTurmaName(first.name);
    }
  }, [classes]);

  // ─── Carregar gabarito automaticamente ao selecionar turma/versão ───
  useEffect(() => {
    if (selectedClassId) {
      setGabaritoConfirmed(false);
      loadGabaritoFromDB();
    }
  }, [selectedClassId, provaType, examVersion]);

  // ─── Carregar notas automaticamente ao entrar na aba relatório ───
  useEffect(() => {
    if (tab === "relatorio" && selectedClassId && classResults.length === 0) {
      loadGradesFromDB();
    }
  }, [tab, selectedClassId]);

  // ─── Salvar gabarito no banco ───
  async function saveGabaritoToDB() {
    if (!selectedClassId) { toast.error("Selecione uma turma para salvar o gabarito."); return; }
    const filled = gabarito.filter(Boolean).length;
    if (filled < 25) { toast.error(`Preencha todas as 25 questões. Faltam ${25 - filled}.`); return; }
    setSavingGabarito(true);
    try {
      await utils.client.teacherAuth.saveGabarito.mutate({
        sessionToken: teacherToken,
        classId: selectedClassId,
        provaType,
        examVersion,
        answers: gabarito,
        difficulties: difficulties,
        examDate,
      });
      toast.success("Gabarito salvo no banco de dados!");
      setGabaritoConfirmed(true);
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar gabarito.");
    } finally {
      setSavingGabarito(false);
    }
  }

  // ─── Carregar gabarito do banco ───
  async function loadGabaritoFromDB() {
    if (!selectedClassId) { toast.error("Selecione uma turma."); return; }
    setLoadingGabarito(true);
    try {
      const data = await utils.client.teacherAuth.getGabarito.query({
        sessionToken: teacherToken,
        classId: selectedClassId,
        provaType,
        examVersion,
      });
      if (data) {
        setGabarito(data.answers as Answer[]);
        setDifficulties(data.difficulties as Difficulty[]);
        if (data.examDate) setExamDate(data.examDate);
        setGabaritoConfirmed(true);
        toast.success("Gabarito carregado do banco!");
      } else {
        toast.error("Nenhum gabarito salvo para esta turma/prova.");
      }
    } catch (e: any) {
      toast.error(e.message || "Erro ao carregar gabarito.");
    } finally {
      setLoadingGabarito(false);
    }
  }

  // ─── Carregar notas do banco ───
  const [loadingGradesDB, setLoadingGradesDB] = useState(false);
  async function loadGradesFromDB() {
    if (!selectedClassId) { toast.error("Selecione uma turma."); return; }
    setLoadingGradesDB(true);
    try {
      const grades = await utils.client.teacherAuth.getClassGrades.query({
        sessionToken: teacherToken,
        classId: selectedClassId,
        provaType,
      });
      if (!grades || grades.length === 0) {
        toast.error("Nenhuma nota encontrada no banco para esta turma/prova.");
        return;
      }
      const results: StudentResult[] = grades.map((g: any) => {
        const answers = (g.answers || Array(25).fill(null)) as Answer[];
        const byDifficulty: Record<Difficulty, { correct: number; total: number; points: number }> = {
          facil: { correct: 0, total: 10, points: 0 },
          intermediario: { correct: 0, total: 10, points: 0 },
          dificil: { correct: 0, total: 5, points: 0 },
        };
        if (gabarito.some(Boolean)) {
          for (let i = 0; i < 25; i++) {
            const d = getDifficulty(i + 1);
            if (answers[i] && gabarito[i] && answers[i] === gabarito[i]) {
              byDifficulty[d].correct++;
              byDifficulty[d].points += DIFFICULTY_CONFIG[d].points;
            }
          }
        }
        return {
          name: g.memberName,
          memberId: g.memberId,
          answers,
          score: g.score,
          approved: g.score >= 5.0,
          correctCount: g.correctCount,
          byDifficulty,
        };
      });
      setClassResults(results);
      toast.success(`${results.length} nota(s) carregada(s) do banco!`);
    } catch (e: any) {
      toast.error(e.message || "Erro ao carregar notas.");
    } finally {
      setLoadingGradesDB(false);
    }
  }

  // ─── OCR: ler cartão resposta via foto ───
  async function handleOCR(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setOcrLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const base64 = (ev.target?.result as string).split(",")[1];
        try {
            // Usar a API de visão (Forge/GPT-4o) para extrair respostas do cartão
          const forgeApiUrl = import.meta.env.VITE_FRONTEND_FORGE_API_URL;
          const forgeApiKey = import.meta.env.VITE_FRONTEND_FORGE_API_KEY;
          const visionRes = await fetch(`${forgeApiUrl}/v1/chat/completions`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${forgeApiKey}` },
            body: JSON.stringify({
              model: "gpt-4o",
              messages: [{
                role: "user",
                content: [
                  { type: "text", text: "Este é um cartão resposta de prova com 25 questões (Q1 a Q25). Cada questão tem alternativas A, B, C, D, E. Identifique qual alternativa está marcada em cada questão. Responda APENAS com um JSON no formato: {\"answers\": [\"A\", \"B\", null, ...]} onde null significa questão em branco. Não inclua mais nada na resposta." },
                  { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64}` } }
                ]
              }],
              max_tokens: 500,
            }),
          });
          const visionData = await visionRes.json();
          const content = visionData?.choices?.[0]?.message?.content || "";
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            const answers = parsed.answers as Answer[];
            if (answers && answers.length === 25) {
              setStudentAnswers(answers);
              toast.success("Respostas extraídas com sucesso! Verifique antes de corrigir.");
            } else {
              toast.error("Não foi possível identificar todas as respostas. Preencha manualmente.");
            }
          } else {
            toast.error("Não foi possível ler o cartão. Tente uma foto mais nítida.");
          }
        } catch {
          toast.error("Erro ao processar a imagem. Tente novamente.");
        } finally {
          setOcrLoading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch {
      setOcrLoading(false);
    }
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // ─── Confirmar gabarito ───
  function confirmGabarito() {
    const filled = gabarito.filter(Boolean).length;
    if (filled < 25) {
      toast.error(`Preencha todas as 25 questões. Faltam ${25 - filled}.`);
      return;
    }
    setGabaritoConfirmed(true);
    setTab("correcao");
    toast.success("Gabarito confirmado! Agora corrija os alunos.");
  }

  // ─── Calcular resultado de um aluno ───
  function calcResult(name: string, answers: Answer[], memberId?: number): StudentResult {
    const score = calcScore(answers, gabarito, difficulties);
    const approved = score >= 5.0;
    const correctCount = answers.filter((a, i) => a && a === gabarito[i]).length;
    const byDifficulty: Record<Difficulty, { correct: number; total: number; points: number }> = {
      facil: { correct: 0, total: 10, points: 0 },
      intermediario: { correct: 0, total: 10, points: 0 },
      dificil: { correct: 0, total: 5, points: 0 },
    };
    for (let i = 0; i < 25; i++) {
      const d = difficulties[i];
      if (answers[i] && answers[i] === gabarito[i]) {
        byDifficulty[d].correct++;
        byDifficulty[d].points += DIFFICULTY_CONFIG[d].points;
      }
    }
    return { name, memberId, examVersion, answers, score, approved, correctCount, byDifficulty };
  }

  // ─── Corrigir aluno atual ───
  function handleCorrect() {
    if (!studentName.trim()) { toast.error("Informe o nome do aluno."); return; }
    const result = calcResult(studentName, studentAnswers);
    setCurrentResult(result);
    if (turmaMode) {
      setClassResults(prev => [...prev, result]);
      // Avançar para próximo aluno
      if (currentMemberIdx + 1 < classMembers.length) {
        const next = classMembers[currentMemberIdx + 1];
        setCurrentMemberIdx(prev => prev + 1);
        setStudentName(next.name);
        setStudentAnswers(Array(25).fill(null));
        setCurrentResult(null);
      } else {
        toast.success("Todos os alunos corrigidos! Veja o resumo da turma.");
        setTab("turma");
      }
    }
  }

  // ─── Carregar membros da turma ───
  async function loadClassMembers(classId: number) {
    setLoadingMembers(true);
    try {
      const data = await utils.classes.getById.fetch({ sessionToken: teacherToken, classId });
      const mems = (data?.members || []).map((m: any) => ({
        id: m.id,
        name: m.name?.includes("\t") ? m.name.split("\t")[1]?.trim() : m.name,
      }));
      setClassMembers(mems);
      if (mems.length > 0) {
        setCurrentMemberIdx(0);
        setStudentName(mems[0].name);
        setStudentAnswers(Array(25).fill(null));
        setCurrentResult(null);
        setClassResults([]);
        setTurmaMode(true);
        setTab("correcao");
        toast.success(`${mems.length} alunos carregados. Iniciando correção em sequência.`);
      } else {
        toast.error("Nenhum aluno encontrado nesta turma.");
      }
    } catch (e: any) {
      toast.error(e.message || "Erro ao carregar alunos");
    } finally {
      setLoadingMembers(false);
    }
  }

  // ─── Exportar planilha CSV ───
  function exportCSV() {
    const header = ["Nome", "Nota", "Aprovado", "Acertos", "Fácil (pts)", "Intermediário (pts)", "Difícil (pts)"];
    const rows = classResults.map(r => [
      r.name,
      r.score.toFixed(2),
      r.approved ? "SIM" : "NÃO",
      r.correctCount,
      r.byDifficulty.facil.points.toFixed(2),
      r.byDifficulty.intermediario.points.toFixed(2),
      r.byDifficulty.dificil.points.toFixed(2),
    ]);
    const csv = [header, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `notas_${provaType}_${turmaName || "turma"}_${examDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Planilha exportada com sucesso!");
  }

  // ─── Salvar notas P1/P2 via API ───
  async function saveGradesAPI() {
    if (classResults.length === 0) { toast.error("Nenhuma nota para salvar."); return; }
    setSavingGrades(true);
    let saved = 0;
    let errors = 0;
    try {
      for (const result of classResults) {
        if (!result.memberId) { errors++; continue; }
        try {
          // Salva na tabela dedicada de notas de prova
          await utils.client.teacherAuth.saveStudentGrade.mutate({
            sessionToken: teacherToken,
            classId: selectedClassId || 22,
            memberId: result.memberId,
            memberName: result.name,
            provaType: provaType,
            examVersion: result.examVersion || examVersion,
            answers: result.answers,
            score: result.score,
            correctCount: result.correctCount,
          });
          saved++;
        } catch {
          errors++;
        }
      }
      if (saved > 0) toast.success(`${saved} notas salvas no sistema!`);
      if (errors > 0) toast.error(`${errors} notas não puderam ser salvas (sem ID de membro).`);
    } finally {
      setSavingGrades(false);
    }
  }

  // ─── Imprimir cartão resposta ───
  function printAnswerSheet() {
    const win = window.open("", "_blank");
    if (!win) { toast.error("Popup bloqueado. Permita popups para imprimir."); return; }
    const html = generatePrintHTML();
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 500);
  }

  function generatePrintHTML() {
    const questionsHTML = Array.from({ length: 25 }, (_, i) => {
      const q = i + 1;
      const d = difficulties[i];
      const cfg = DIFFICULTY_CONFIG[d];
      return `
        <div class="question-row">
          <span class="q-num">${q}</span>
          <span class="q-diff" style="color:${cfg.color}">${cfg.label[0]}</span>
          <span class="q-pts">(${cfg.points.toFixed(2)}pt)</span>
          <div class="bubbles">
            ${["A","B","C","D","E"].map(l => `<div class="bubble">${l}</div>`).join("")}
          </div>
        </div>
      `;
    }).join("");

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Cartão Resposta — Conexão Farmacologia</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Crimson+Text:wght@400;600;700&family=Inter:wght@400;500;600&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Inter', sans-serif; background: white; color: #1a1a1a; }
  @page { size: A4; margin: 15mm; }
  .page { width: 100%; max-width: 180mm; margin: 0 auto; }

  /* CAPA */
  .header {
    border: 2px solid #8b0000;
    border-radius: 8px;
    padding: 16px 20px;
    margin-bottom: 16px;
    background: linear-gradient(135deg, #1a0000 0%, #2d0000 100%);
    color: white;
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .logo-area {
    width: 60px;
    height: 60px;
    border: 2px solid #8b0000;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 28px;
    flex-shrink: 0;
  }
  .header-text h1 {
    font-family: 'Crimson Text', serif;
    font-size: 18px;
    font-weight: 700;
    color: #ff4444;
    letter-spacing: 1px;
    text-transform: uppercase;
  }
  .header-text h2 {
    font-family: 'Crimson Text', serif;
    font-size: 14px;
    color: #ffaaaa;
    margin-top: 2px;
  }
  .header-text p {
    font-size: 11px;
    color: #aaa;
    margin-top: 4px;
  }

  /* INFO DO ALUNO */
  .student-info {
    border: 1px solid #ccc;
    border-radius: 6px;
    padding: 12px 16px;
    margin-bottom: 16px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .info-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .info-field.full { grid-column: 1 / -1; }
  .info-label {
    font-size: 9px;
    font-weight: 600;
    text-transform: uppercase;
    color: #666;
    letter-spacing: 0.5px;
  }
  .info-line {
    border-bottom: 1px solid #999;
    height: 20px;
  }

  /* LEGENDA */
  .legend {
    display: flex;
    gap: 16px;
    margin-bottom: 12px;
    padding: 8px 12px;
    background: #f9f9f9;
    border-radius: 6px;
    border: 1px solid #eee;
    font-size: 10px;
  }
  .legend-item { display: flex; align-items: center; gap: 6px; }
  .legend-dot { width: 10px; height: 10px; border-radius: 50%; }

  /* QUESTÕES */
  .questions-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }
  .question-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    border: 1px solid #e5e5e5;
    border-radius: 4px;
    background: #fafafa;
  }
  .q-num {
    font-weight: 700;
    font-size: 12px;
    width: 20px;
    text-align: right;
    color: #333;
  }
  .q-diff {
    font-size: 9px;
    font-weight: 700;
    width: 12px;
  }
  .q-pts {
    font-size: 8px;
    color: #888;
    width: 36px;
  }
  .bubbles {
    display: flex;
    gap: 4px;
    flex: 1;
    justify-content: flex-end;
  }
  .bubble {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: 1.5px solid #555;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 9px;
    font-weight: 600;
    color: #555;
  }

  /* PONTUAÇÃO */
  .score-table {
    margin-top: 16px;
    border: 1px solid #ccc;
    border-radius: 6px;
    overflow: hidden;
  }
  .score-table table {
    width: 100%;
    border-collapse: collapse;
    font-size: 10px;
  }
  .score-table th {
    background: #1a0000;
    color: white;
    padding: 6px 10px;
    text-align: left;
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .score-table td {
    padding: 5px 10px;
    border-bottom: 1px solid #eee;
  }
  .score-table tr:last-child td { border-bottom: none; }

  /* ASSINATURA */
  .signature {
    margin-top: 20px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }
  .sig-line {
    border-top: 1px solid #999;
    padding-top: 4px;
    font-size: 9px;
    color: #666;
    text-align: center;
  }

  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
<div class="page">
  <!-- CABEÇALHO -->
  <div class="header">
    <div class="logo-area">🧬</div>
    <div class="header-text">
      <h1>Conexão Farmacologia</h1>
      <h2>A Praga Escarlate — Cartão Resposta</h2>
      <p>Farmacologia I • UNIRIO • ${provaType} • ${examDate ? new Date(examDate + "T12:00:00").toLocaleDateString("pt-BR") : ""}</p>
    </div>
  </div>

  <!-- DADOS DO ALUNO -->
  <div class="student-info">
    <div class="info-field full">
      <span class="info-label">Nome completo</span>
      <div class="info-line"></div>
    </div>
    <div class="info-field">
      <span class="info-label">Matrícula</span>
      <div class="info-line"></div>
    </div>
    <div class="info-field">
      <span class="info-label">Turma</span>
      <div class="info-line"></div>
    </div>
  </div>

  <!-- LEGENDA -->
  <div class="legend">
    <strong style="font-size:10px; margin-right:4px;">Legenda:</strong>
    <div class="legend-item">
      <div class="legend-dot" style="background:#22c55e"></div>
      <span>F = Fácil (0,20 pt)</span>
    </div>
    <div class="legend-item">
      <div class="legend-dot" style="background:#f59e0b"></div>
      <span>I = Intermediário (0,40 pt)</span>
    </div>
    <div class="legend-item">
      <div class="legend-dot" style="background:#ef4444"></div>
      <span>D = Difícil (0,80 pt)</span>
    </div>
    <div style="margin-left:auto; font-weight:600;">Total: 10,0 pts | Aprovado ≥ 5,0</div>
  </div>

  <!-- QUESTÕES -->
  <div class="questions-grid">
    ${questionsHTML}
  </div>

  <!-- TABELA DE PONTUAÇÃO -->
  <div class="score-table">
    <table>
      <tr>
        <th>Nível</th>
        <th>Questões</th>
        <th>Pts/questão</th>
        <th>Total possível</th>
        <th>Acertos</th>
        <th>Pontos obtidos</th>
      </tr>
      <tr>
        <td style="color:#22c55e; font-weight:600;">Fácil</td>
        <td>Q1 – Q10</td>
        <td>0,20</td>
        <td>2,00</td>
        <td>___/10</td>
        <td>_____</td>
      </tr>
      <tr>
        <td style="color:#f59e0b; font-weight:600;">Intermediário</td>
        <td>Q11 – Q20</td>
        <td>0,40</td>
        <td>4,00</td>
        <td>___/10</td>
        <td>_____</td>
      </tr>
      <tr>
        <td style="color:#ef4444; font-weight:600;">Difícil</td>
        <td>Q21 – Q25</td>
        <td>0,80</td>
        <td>4,00</td>
        <td>___/5</td>
        <td>_____</td>
      </tr>
      <tr style="background:#f9f9f9; font-weight:700;">
        <td colspan="3">TOTAL</td>
        <td>10,00</td>
        <td>___/25</td>
        <td>_____</td>
      </tr>
    </table>
  </div>

  <!-- ASSINATURA -->
  <div class="signature">
    <div class="sig-line">Assinatura do aluno</div>
    <div class="sig-line">Assinatura do professor / monitor</div>
  </div>
</div>
</body>
</html>`;
  }

  // ─── RENDER ───
  const tabs = [
    { id: "gabarito", label: "📋 Gabarito" },
    { id: "correcao", label: "✏️ Correção" },
    { id: "turma", label: `👥 Turma (${classResults.length})` },
    { id: "relatorio", label: "📊 Relatório" },
    { id: "imprimir", label: "🖨️ Imprimir" },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Hidden file input for OCR */}
      <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleOCR} className="hidden" />

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground">Ferramentas de Prova</h2>
          <p className="text-sm text-muted-foreground">Gabarito fixo, correção em turma, OCR e relatórios</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={selectedClassId || ""}
            onChange={e => { setSelectedClassId(Number(e.target.value) || null); setTurmaName(classes.find(c => c.id === Number(e.target.value))?.name || ""); }}
            className="px-3 py-1.5 rounded-lg border border-border bg-card text-sm text-foreground"
          >
            <option value="">Turma...</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select
            value={provaType}
            onChange={e => setProvaType(e.target.value as "P1" | "P2")}
            className="px-3 py-1.5 rounded-lg border border-border bg-card text-sm text-foreground"
          >
            <option value="P1">Prova P1</option>
            <option value="P2">Prova P2</option>
          </select>
          <select
            value={examVersion}
            onChange={e => {
              setExamVersion(e.target.value as "A" | "B" | "C" | "D");
              setGabaritoConfirmed(false);
              setGabarito(Array(25).fill(null));
            }}
            className="px-3 py-1.5 rounded-lg border border-amber-500/50 bg-amber-500/10 text-sm text-amber-300 font-bold"
            title="Versão do gabarito (A, B, C ou D)"
          >
            <option value="A">Versão A</option>
            <option value="B">Versão B</option>
            <option value="C">Versão C</option>
            <option value="D">Versão D</option>
          </select>
          <button
            onClick={loadGabaritoFromDB}
            disabled={loadingGabarito || !selectedClassId}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card text-sm text-foreground hover:bg-muted/50 disabled:opacity-50 transition-colors"
          >
            {loadingGabarito ? <Loader2 size={14} className="animate-spin" /> : <Database size={14} />}
            Carregar Gabarito
          </button>
          <input
            type="date"
            value={examDate}
            onChange={e => setExamDate(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-border bg-card text-sm text-foreground"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ─── TAB: GABARITO ─── */}
      {tab === "gabarito" && (
        <div className="space-y-4">
          {gabaritoConfirmed && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-sm">
              <CheckCircle size={16} />
              Gabarito confirmado! Você pode editá-lo clicando nas alternativas abaixo.
              <button onClick={() => setGabaritoConfirmed(false)} className="ml-auto text-xs underline">Editar</button>
            </div>
          )}

          {/* Config de dificuldade */}
          <div className="border border-border rounded-lg overflow-hidden">
            <button
              onClick={() => setShowDiffConfig(!showDiffConfig)}
              className="w-full flex items-center justify-between px-4 py-3 bg-card hover:bg-muted/50 transition-colors text-sm font-medium text-foreground"
            >
              <span>⚙️ Configurar dificuldade por questão</span>
              {showDiffConfig ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {showDiffConfig && (
              <div className="p-4 border-t border-border bg-card/50">
                <div className="grid grid-cols-5 gap-2">
                  {Array.from({ length: 25 }, (_, i) => (
                    <div key={i} className="flex flex-col items-center gap-1">
                      <span className="text-xs text-muted-foreground">Q{i + 1}</span>
                      <select
                        value={difficulties[i]}
                        onChange={e => {
                          const d = [...difficulties];
                          d[i] = e.target.value as Difficulty;
                          setDifficulties(d);
                        }}
                        className="w-full text-xs px-1 py-1 rounded border border-border bg-background text-foreground"
                      >
                        <option value="facil">F</option>
                        <option value="intermediario">I</option>
                        <option value="dificil">D</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Cartão gabarito */}
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-card border-b border-border flex items-center justify-between">
              <span className="font-semibold text-foreground text-sm">Gabarito — {provaType} • Versão <span className="text-amber-400">{examVersion}</span></span>
              <span className="text-xs text-muted-foreground">{gabarito.filter(Boolean).length}/25 preenchidas</span>
            </div>
            <div className="p-4 space-y-2">
              {Array.from({ length: 25 }, (_, i) => {
                const d = difficulties[i];
                const cfg = DIFFICULTY_CONFIG[d];
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-sm font-bold text-foreground w-6 text-right">{i + 1}</span>
                    <span className="text-xs font-semibold w-20" style={{ color: cfg.color }}>
                      {cfg.label} ({cfg.points.toFixed(2)}pt)
                    </span>
                    <div className="flex gap-2">
                      {(["A","B","C","D","E"] as const).map(l => (
                        <Bubble
                          key={l}
                          letter={l}
                          selected={gabarito[i] === l}
                          onClick={() => {
                            const g = [...gabarito];
                            g[i] = gabarito[i] === l ? null : l;
                            setGabarito(g);
                          }}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="px-4 py-3 border-t border-border bg-card/50 flex justify-between items-center gap-3">
              <button
                onClick={saveGabaritoToDB}
                disabled={savingGabarito}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-card text-sm text-foreground hover:bg-muted/50 disabled:opacity-50 transition-colors"
              >
                {savingGabarito ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Salvar no Banco
              </button>
              <button
                onClick={confirmGabarito}
                className="px-6 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
              >
                Confirmar Gabarito →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB: CORREÇÃO ─── */}
      {tab === "correcao" && (
        <div className="space-y-4">
          {!gabaritoConfirmed && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm">
              <AlertTriangle size={16} />
              Confirme o gabarito antes de corrigir.
              <button onClick={() => setTab("gabarito")} className="ml-auto underline">Ir para Gabarito</button>
            </div>
          )}

          {/* Modo turma: progresso */}
          {turmaMode && classMembers.length > 0 && (
            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 text-sm flex items-center gap-3">
              <Users size={16} />
              <span>Modo Turma: Aluno {currentMemberIdx + 1} de {classMembers.length}</span>
              <div className="flex-1 bg-blue-900/30 rounded-full h-2">
                <div
                  className="bg-blue-400 h-2 rounded-full transition-all"
                  style={{ width: `${((currentMemberIdx) / classMembers.length) * 100}%` }}
                />
              </div>
              <button
                onClick={() => { setTurmaMode(false); setClassMembers([]); setClassResults([]); }}
                className="text-xs underline"
              >
                Sair do modo turma
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Respostas do aluno */}
            <div className="lg:col-span-2 border border-border rounded-lg overflow-hidden">
              <div className="px-4 py-3 bg-card border-b border-border">
                <input
                  type="text"
                  value={studentName}
                  onChange={e => setStudentName(e.target.value)}
                  placeholder="Nome do aluno..."
                  className="w-full bg-transparent text-foreground font-semibold text-sm outline-none placeholder:text-muted-foreground"
                />
              </div>
              <div className="p-4 space-y-2">
                {Array.from({ length: 25 }, (_, i) => {
                  const d = difficulties[i];
                  const cfg = DIFFICULTY_CONFIG[d];
                  const correct = gabarito[i];
                  const answer = studentAnswers[i];
                  const isCorrect = answer && answer === correct;
                  const isWrong = answer && answer !== correct;
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-sm font-bold text-foreground w-6 text-right">{i + 1}</span>
                      <span className="text-xs font-semibold w-20" style={{ color: cfg.color }}>
                        {cfg.label}
                      </span>
                      <div className="flex gap-2">
                        {(["A","B","C","D","E"] as const).map(l => (
                          <Bubble
                            key={l}
                            letter={l}
                            selected={answer === l}
                            correct={gabaritoConfirmed && answer === l && isCorrect ? true : undefined}
                            wrong={gabaritoConfirmed && answer === l && !!isWrong ? true : undefined}
                            onClick={() => {
                              const a = [...studentAnswers];
                              a[i] = studentAnswers[i] === l ? null : l;
                              setStudentAnswers(a);
                            }}
                          />
                        ))}
                      </div>
                      {gabaritoConfirmed && answer && (
                        <span className="text-xs ml-1">
                          {isCorrect
                            ? <span className="text-green-400">✓ {cfg.points.toFixed(2)}pt</span>
                            : <span className="text-red-400">✗ Gabarito: {correct}</span>
                          }
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="px-4 py-3 border-t border-border bg-card/50 flex justify-between items-center">
                <span className="text-xs text-muted-foreground">
                  {studentAnswers.filter(Boolean).length}/25 respondidas
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={ocrLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
                    title="Fotografar cartão resposta e extrair respostas automaticamente"
                  >
                    {ocrLoading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
                    {ocrLoading ? "Processando..." : "OCR"}
                  </button>
                  <button
                    onClick={() => { setStudentAnswers(Array(25).fill(null)); setCurrentResult(null); }}
                    className="px-3 py-1.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <RefreshCw size={14} className="inline mr-1" />Limpar
                  </button>
                  <button
                    onClick={handleCorrect}
                    disabled={!gabaritoConfirmed}
                    className="px-5 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  >
                    Ver Resultado →
                  </button>
                </div>
              </div>
            </div>

            {/* Resultado */}
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="px-4 py-3 bg-card border-b border-border">
                <span className="font-semibold text-foreground text-sm">Resultado</span>
              </div>
              {currentResult ? (
                <div className="p-4 space-y-4">
                  <div className={`text-center p-4 rounded-lg ${currentResult.approved ? "bg-green-500/10 border border-green-500/30" : "bg-red-500/10 border border-red-500/30"}`}>
                    <div className={`text-4xl font-bold ${currentResult.approved ? "text-green-400" : "text-red-400"}`}>
                      {currentResult.score.toFixed(2)}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">de 10,00 pontos</div>
                    <div className={`mt-2 text-sm font-semibold ${currentResult.approved ? "text-green-400" : "text-red-400"}`}>
                      {currentResult.approved ? "✓ APROVADO" : "✗ REPROVADO"}
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground text-center">
                    {currentResult.correctCount}/25 questões corretas
                  </div>
                  <div className="space-y-2">
                    {(["facil", "intermediario", "dificil"] as Difficulty[]).map(d => {
                      const cfg = DIFFICULTY_CONFIG[d];
                      const r = currentResult.byDifficulty[d];
                      return (
                        <div key={d} className="flex items-center justify-between text-xs">
                          <span style={{ color: cfg.color }} className="font-semibold">{cfg.label}</span>
                          <span className="text-muted-foreground">{r.correct}/{r.total}</span>
                          <span className="font-semibold text-foreground">{r.points.toFixed(2)} pt</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  Preencha as respostas e clique em "Ver Resultado"
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB: TURMA ─── */}
      {tab === "turma" && (
        <div className="space-y-4">
          {/* Carregar turma */}
          {!turmaMode && (
            <div className="border border-border rounded-lg p-4 space-y-3">
              <h3 className="font-semibold text-foreground text-sm">Iniciar Correção em Modo Turma</h3>
              <p className="text-xs text-muted-foreground">Selecione uma turma para corrigir os alunos em sequência. As notas serão salvas automaticamente.</p>
              <div className="flex gap-3">
                <select
                  value={selectedClassId || ""}
                  onChange={e => setSelectedClassId(Number(e.target.value) || null)}
                  className="flex-1 px-3 py-2 rounded-lg border border-border bg-card text-sm text-foreground"
                >
                  <option value="">Selecione uma turma...</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <button
                  onClick={() => selectedClassId && loadClassMembers(selectedClassId)}
                  disabled={!selectedClassId || loadingMembers || !gabaritoConfirmed}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  {loadingMembers ? <Loader2 size={14} className="animate-spin" /> : <Users size={14} />}
                  Iniciar
                </button>
              </div>
              {!gabaritoConfirmed && (
                <p className="text-xs text-amber-400">⚠️ Confirme o gabarito antes de iniciar o modo turma.</p>
              )}
            </div>
          )}

          {/* Resultados da turma */}
          {classResults.length > 0 && (
            <div className="space-y-4">
              {/* Resumo */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: "Alunos corrigidos", value: classResults.length, color: "text-blue-400" },
                  { label: "Aprovados", value: classResults.filter(r => r.approved).length, color: "text-green-400" },
                  { label: "Reprovados", value: classResults.filter(r => !r.approved).length, color: "text-red-400" },
                  { label: "Média da turma", value: (classResults.reduce((s, r) => s + r.score, 0) / classResults.length).toFixed(2), color: "text-amber-400" },
                ].map(stat => (
                  <div key={stat.label} className="border border-border rounded-lg p-3 text-center">
                    <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                    <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* Ações */}
              <div className="flex gap-3">
                <button
                  onClick={exportCSV}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors"
                >
                  <Download size={14} />
                  Exportar Planilha CSV
                </button>
                <button
                  onClick={saveGradesAPI}
                  disabled={savingGrades}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {savingGrades ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Salvar Notas no Sistema
                </button>
              </div>

              {/* Tabela */}
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-card border-b border-border">
                      <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">Aluno</th>
                      <th className="text-center px-3 py-2 text-xs font-semibold text-amber-400">Versão</th>
                      <th className="text-center px-3 py-2 text-xs font-semibold text-muted-foreground">Nota</th>
                      <th className="text-center px-3 py-2 text-xs font-semibold text-muted-foreground">Acertos</th>
                      <th className="text-center px-3 py-2 text-xs font-semibold text-muted-foreground">Fácil</th>
                      <th className="text-center px-3 py-2 text-xs font-semibold text-muted-foreground">Interm.</th>
                      <th className="text-center px-3 py-2 text-xs font-semibold text-muted-foreground">Difícil</th>
                      <th className="text-center px-3 py-2 text-xs font-semibold text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classResults.map((r, i) => (
                      <tr key={i} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-2 font-medium text-foreground">{r.name}</td>
                        <td className="px-3 py-2 text-center">
                          <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">{r.examVersion || examVersion}</span>
                        </td>
                        <td className="px-3 py-2 text-center font-bold text-foreground">{r.score.toFixed(2)}</td>
                        <td className="px-3 py-2 text-center text-muted-foreground">{r.correctCount}/25</td>
                        <td className="px-3 py-2 text-center text-green-400">{r.byDifficulty.facil.correct}/10</td>
                        <td className="px-3 py-2 text-center text-amber-400">{r.byDifficulty.intermediario.correct}/10</td>
                        <td className="px-3 py-2 text-center text-red-400">{r.byDifficulty.dificil.correct}/5</td>
                        <td className="px-3 py-2 text-center">
                          {r.approved
                            ? <span className="text-green-400 text-xs font-semibold">✓ APR</span>
                            : <span className="text-red-400 text-xs font-semibold">✗ REP</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {classResults.length === 0 && !turmaMode && (
            <div className="text-center py-12 text-muted-foreground text-sm">
              <Users size={40} className="mx-auto mb-3 opacity-30" />
              <p>Nenhum resultado ainda. Inicie o modo turma acima.</p>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB: RELATÓRIO ─── */}
      {tab === "relatorio" && (
        <div className="space-y-4">
          {/* Botão carregar do banco */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm text-muted-foreground">
              {classResults.length > 0 ? `${classResults.length} aluno(s) no relatório` : "Nenhuma nota carregada"}
            </p>
            <button
              onClick={loadGradesFromDB}
              disabled={loadingGradesDB || !selectedClassId}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm rounded-lg font-medium transition-colors"
            >
              {loadingGradesDB ? <Loader2 size={14} className="animate-spin" /> : <Database size={14} />}
              {loadingGradesDB ? "Carregando..." : "Carregar Notas do Banco"}
            </button>
          </div>
          {classResults.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              <BarChart2 size={40} className="mx-auto mb-3 opacity-30" />
              <p>Clique em <strong>"Carregar Notas do Banco"</strong> para ver o relatório.</p>
              <p className="text-xs mt-1">Selecione a turma e o tipo de prova antes de carregar.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Cards de resumo */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Total", value: classResults.length, color: "text-blue-400" },
                  { label: "Média", value: (classResults.reduce((s, r) => s + r.score, 0) / classResults.length).toFixed(2), color: "text-amber-400" },
                  { label: "Aprovados", value: `${classResults.filter(r => r.approved).length} (${Math.round(classResults.filter(r => r.approved).length / classResults.length * 100)}%)`, color: "text-green-400" },
                  { label: "Reprovados", value: `${classResults.filter(r => !r.approved).length} (${Math.round(classResults.filter(r => !r.approved).length / classResults.length * 100)}%)`, color: "text-red-400" },
                ].map(stat => (
                  <div key={stat.label} className="border border-border rounded-lg p-3 text-center">
                    <div className={`text-xl font-bold ${stat.color}`}>{stat.value}</div>
                    <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* Distribuição de notas */}
              <div className="border border-border rounded-lg p-4">
                <h4 className="text-sm font-semibold text-foreground mb-3">Distribuição de Notas</h4>
                {[
                  { range: "9,0 – 10,0", min: 9, max: 10, color: "#22c55e" },
                  { range: "7,0 – 8,9", min: 7, max: 8.99, color: "#86efac" },
                  { range: "5,0 – 6,9", min: 5, max: 6.99, color: "#f59e0b" },
                  { range: "3,0 – 4,9", min: 3, max: 4.99, color: "#f97316" },
                  { range: "0,0 – 2,9", min: 0, max: 2.99, color: "#ef4444" },
                ].map(band => {
                  const count = classResults.filter(r => r.score >= band.min && r.score <= band.max).length;
                  const pct = classResults.length > 0 ? (count / classResults.length) * 100 : 0;
                  return (
                    <div key={band.range} className="flex items-center gap-3 mb-2">
                      <span className="text-xs font-medium w-20 text-right" style={{ color: band.color }}>{band.range}</span>
                      <div className="flex-1 bg-muted/30 rounded-full h-4 overflow-hidden">
                        <div
                          className="h-4 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, backgroundColor: band.color }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-8 text-right">{count}</span>
                      <span className="text-xs text-muted-foreground w-10 text-right">{pct.toFixed(0)}%</span>
                    </div>
                  );
                })}
              </div>

              {/* Desempenho por nível de dificuldade */}
              <div className="border border-border rounded-lg p-4">
                <h4 className="text-sm font-semibold text-foreground mb-3">Desempenho por Nível</h4>
                <div className="grid grid-cols-3 gap-3">
                  {(["facil", "intermediario", "dificil"] as Difficulty[]).map(d => {
                    const cfg = DIFFICULTY_CONFIG[d];
                    const avgCorrect = classResults.reduce((s, r) => s + r.byDifficulty[d].correct, 0) / classResults.length;
                    const pct = (avgCorrect / cfg.range[1] - cfg.range[0] + 1) * 100;
                    const totalQ = d === "facil" ? 10 : d === "intermediario" ? 10 : 5;
                    const avgPct = (avgCorrect / totalQ) * 100;
                    return (
                      <div key={d} className="rounded-lg p-3 text-center" style={{ backgroundColor: cfg.color + "15", border: `1px solid ${cfg.color}40` }}>
                        <div className="text-lg font-bold" style={{ color: cfg.color }}>{avgCorrect.toFixed(1)}/{totalQ}</div>
                        <div className="text-xs font-semibold mb-2" style={{ color: cfg.color }}>{cfg.label}</div>
                        <div className="bg-muted/30 rounded-full h-2 overflow-hidden">
                          <div className="h-2 rounded-full" style={{ width: `${avgPct}%`, backgroundColor: cfg.color }} />
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">{avgPct.toFixed(0)}% de acerto</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Tabela completa */}
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="px-4 py-3 bg-card border-b border-border flex items-center justify-between">
                  <span className="font-semibold text-foreground text-sm">Resultados Individuais</span>
                  <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors">
                    <Download size={12} />Exportar CSV
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-card/50 border-b border-border">
                        <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">#</th>
                        <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">Aluno</th>
                        <th className="text-center px-3 py-2 text-xs font-semibold text-muted-foreground">Nota</th>
                        <th className="text-center px-3 py-2 text-xs font-semibold text-muted-foreground">Acertos</th>
                        <th className="text-center px-3 py-2 text-xs font-semibold text-green-400">Fácil</th>
                        <th className="text-center px-3 py-2 text-xs font-semibold text-amber-400">Interm.</th>
                        <th className="text-center px-3 py-2 text-xs font-semibold text-red-400">Difícil</th>
                        <th className="text-center px-3 py-2 text-xs font-semibold text-muted-foreground">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...classResults].sort((a, b) => b.score - a.score).map((r, i) => (
                        <tr key={i} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-2 text-xs text-muted-foreground">{i + 1}</td>
                          <td className="px-4 py-2 font-medium text-foreground">{r.name}</td>
                          <td className="px-3 py-2 text-center font-bold" style={{ color: r.approved ? "#22c55e" : "#ef4444" }}>{r.score.toFixed(2)}</td>
                          <td className="px-3 py-2 text-center text-muted-foreground">{r.correctCount}/25</td>
                          <td className="px-3 py-2 text-center text-green-400">{r.byDifficulty.facil.correct}/10</td>
                          <td className="px-3 py-2 text-center text-amber-400">{r.byDifficulty.intermediario.correct}/10</td>
                          <td className="px-3 py-2 text-center text-red-400">{r.byDifficulty.dificil.correct}/5</td>
                          <td className="px-3 py-2 text-center">
                            {r.approved
                              ? <span className="text-green-400 text-xs font-semibold">✓ APR</span>
                              : <span className="text-red-400 text-xs font-semibold">✗ REP</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB: IMPRIMIR ─── */}
      {tab === "imprimir" && (
        <div className="space-y-4">
          <div className="border border-border rounded-lg p-6 space-y-4">
            <div className="flex items-center gap-3">
              <Printer size={24} className="text-primary" />
              <div>
                <h3 className="font-semibold text-foreground">Cartão Resposta Imprimível</h3>
                <p className="text-xs text-muted-foreground">Gera um cartão resposta em branco formatado para A4 com as 25 questões e bolhas para marcar.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nome da Turma</label>
                <input
                  type="text"
                  value={turmaName}
                  onChange={e => setTurmaName(e.target.value)}
                  placeholder="Ex: Farmacologia 1 - Medicina"
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-card text-sm text-foreground"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Data da Prova</label>
                <input
                  type="date"
                  value={examDate}
                  onChange={e => setExamDate(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-card text-sm text-foreground"
                />
              </div>
            </div>

            {/* Preview da distribuição */}
            <div className="rounded-lg border border-border p-4 bg-card/50">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Distribuição de Pontos</h4>
              <div className="grid grid-cols-3 gap-3 text-center">
                {(["facil", "intermediario", "dificil"] as Difficulty[]).map(d => {
                  const cfg = DIFFICULTY_CONFIG[d];
                  const count = difficulties.filter(x => x === d).length;
                  return (
                    <div key={d} className="rounded-lg p-3" style={{ backgroundColor: cfg.color + "15", border: `1px solid ${cfg.color}40` }}>
                      <div className="text-lg font-bold" style={{ color: cfg.color }}>{count}</div>
                      <div className="text-xs font-semibold" style={{ color: cfg.color }}>{cfg.label}</div>
                      <div className="text-xs text-muted-foreground mt-1">{cfg.points.toFixed(2)} pt × {count} = {(cfg.points * count).toFixed(2)} pt</div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 text-center text-sm font-bold text-foreground">
                Total: {difficulties.reduce((s, d) => s + DIFFICULTY_CONFIG[d].points, 0).toFixed(2)} pontos
              </div>
            </div>

            <button
              onClick={printAnswerSheet}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors"
            >
              <Printer size={18} />
              Imprimir Cartão Resposta em Branco
            </button>
          </div>

          <div className="border border-border rounded-lg p-4 bg-amber-500/5 border-amber-500/20">
            <p className="text-xs text-amber-400">
              <strong>Dica:</strong> Configure as dificuldades por questão na aba "Gabarito" antes de imprimir. O cartão impresso refletirá a distribuição atual ({difficulties.filter(d => d === "facil").length}F / {difficulties.filter(d => d === "intermediario").length}I / {difficulties.filter(d => d === "dificil").length}D).
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
