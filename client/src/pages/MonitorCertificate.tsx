/**
 * MonitorCertificate — Página de certificados de monitoria
 * Monitor visualiza seus certificados emitidos e pode baixar/imprimir em PDF
 * Farmacologia 1 · UNIRIO
 */
import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import {
  Award, ArrowLeft, Download, Printer, RefreshCw,
  CheckCircle2, AlertCircle, Loader2, Eye, EyeOff,
  Calendar, Clock, User, BookOpen, Shield, GraduationCap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// ─── Constantes ────────────────────────────────────────────────────────────────
const BASE_URL = "https://2026.conexaofarmacologia.com.br/api/trpc";
const MONITOR_SESSION_KEY = "monitor_session_token";

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface Certificate {
  id: number;
  monitorAccountId: number;
  monitorName: string;
  monitorEmail: string;
  disciplineName: string;
  periodStart: string;
  periodEnd: string;
  workloadHours: number;
  professorName: string;
  professorTitle: string | null;
  institution: string;
  department: string | null;
  activities: string | null;
  certificateCode: string;
  status: "active" | "revoked";
  issuedAt: string;
}

// ─── API helpers ──────────────────────────────────────────────────────────────
async function trpcQuery(path: string, input: object) {
  const p = encodeURIComponent(JSON.stringify({ json: input }));
  const r = await fetch(`${BASE_URL}/${path}?input=${p}`);
  const data = await r.json();
  if (data.error) throw new Error(data.error.json?.message || "Erro desconhecido");
  return data.result.data.json;
}

// ─── Formatar data ─────────────────────────────────────────────────────────────
function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  } catch {
    return dateStr;
  }
}

function formatPeriod(start: string, end: string): string {
  try {
    const s = new Date(start);
    const e = new Date(end);
    const ms = s.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    const me = e.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    return `${ms} a ${me}`;
  } catch {
    return `${start} a ${end}`;
  }
}

// ─── Componente do Certificado (para impressão) ────────────────────────────────
function CertificatePrintView({ cert }: { cert: Certificate }) {
  const activities: string[] = (() => {
    try {
      if (!cert.activities) return [];
      const parsed = JSON.parse(cert.activities);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();

  const defaultActivities = [
    "Acompanhamento e suporte às atividades de aprendizagem ativa (Jigsaw, casos clínicos)",
    "Auxílio na condução de sessões de Kahoot e avaliações formativas",
    "Lançamento e controle de frequência e notas dos alunos na plataforma digital",
    "Suporte ao professor durante aulas práticas e teóricas de Farmacologia I",
    "Atendimento e orientação de alunos em horários extraclasse",
  ];

  const actList = activities.length > 0 ? activities : defaultActivities;

  return (
    <div
      id="certificate-print-area"
      style={{
        width: "210mm",
        minHeight: "297mm",
        background: "#fff",
        color: "#1a1a2e",
        fontFamily: "'Georgia', 'Times New Roman', serif",
        padding: "20mm 18mm",
        boxSizing: "border-box",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Borda decorativa */}
      <div style={{
        position: "absolute", top: "8mm", left: "8mm", right: "8mm", bottom: "8mm",
        border: "2px solid #1a3a6e", borderRadius: "4px", pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", top: "10mm", left: "10mm", right: "10mm", bottom: "10mm",
        border: "0.5px solid #a0b4d0", borderRadius: "3px", pointerEvents: "none",
      }} />

      {/* Cabeçalho */}
      <div style={{ textAlign: "center", marginBottom: "8mm" }}>
        <div style={{ fontSize: "11pt", fontWeight: "bold", color: "#1a3a6e", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "2mm" }}>
          Universidade Federal do Estado do Rio de Janeiro
        </div>
        <div style={{ fontSize: "9pt", color: "#4a5568", letterSpacing: "1px", marginBottom: "1mm" }}>
          UNIRIO — Centro de Ciências Biológicas e da Saúde
        </div>
        <div style={{ fontSize: "9pt", color: "#4a5568", marginBottom: "4mm" }}>
          {cert.department || "Departamento de Farmácia e Administração Farmacêutica"}
        </div>
        <div style={{ width: "60mm", height: "0.5mm", background: "#1a3a6e", margin: "0 auto 4mm" }} />
        <div style={{ fontSize: "22pt", fontWeight: "bold", color: "#1a3a6e", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "2mm" }}>
          CERTIFICADO
        </div>
        <div style={{ fontSize: "11pt", color: "#4a5568", fontStyle: "italic" }}>
          de Monitoria Acadêmica
        </div>
      </div>

      {/* Corpo */}
      <div style={{ textAlign: "center", lineHeight: "1.8", marginBottom: "8mm" }}>
        <p style={{ fontSize: "11pt", marginBottom: "4mm" }}>
          Certificamos que
        </p>
        <p style={{ fontSize: "18pt", fontWeight: "bold", color: "#1a3a6e", marginBottom: "4mm", borderBottom: "1px solid #a0b4d0", paddingBottom: "2mm", display: "inline-block", minWidth: "120mm" }}>
          {cert.monitorName}
        </p>
        <p style={{ fontSize: "11pt", marginBottom: "2mm" }}>
          exerceu a função de <strong>Monitor(a) Acadêmico(a)</strong> na disciplina
        </p>
        <p style={{ fontSize: "14pt", fontWeight: "bold", color: "#1a3a6e", marginBottom: "2mm" }}>
          {cert.disciplineName}
        </p>
        <p style={{ fontSize: "11pt", marginBottom: "2mm" }}>
          no período de <strong>{formatPeriod(cert.periodStart, cert.periodEnd)}</strong>,
        </p>
        <p style={{ fontSize: "11pt", marginBottom: "4mm" }}>
          com carga horária total de <strong>{cert.workloadHours} horas</strong>.
        </p>
      </div>

      {/* Atividades */}
      {actList.length > 0 && (
        <div style={{ marginBottom: "8mm" }}>
          <p style={{ fontSize: "10pt", fontWeight: "bold", color: "#1a3a6e", marginBottom: "3mm" }}>
            Atividades desenvolvidas:
          </p>
          <ul style={{ paddingLeft: "6mm", margin: 0 }}>
            {actList.map((act, i) => (
              <li key={i} style={{ fontSize: "9.5pt", marginBottom: "1.5mm", color: "#2d3748" }}>
                {act}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Data de emissão */}
      <div style={{ textAlign: "center", marginBottom: "10mm" }}>
        <p style={{ fontSize: "10pt", color: "#4a5568" }}>
          Rio de Janeiro, {formatDate(cert.issuedAt)}
        </p>
      </div>

      {/* Assinatura */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: "8mm" }}>
        <div style={{ textAlign: "center", minWidth: "80mm" }}>
          <div style={{ width: "80mm", height: "0.5mm", background: "#1a3a6e", marginBottom: "2mm" }} />
          <p style={{ fontSize: "11pt", fontWeight: "bold", color: "#1a3a6e", margin: 0 }}>
            {cert.professorName}
          </p>
          <p style={{ fontSize: "9pt", color: "#4a5568", margin: "1mm 0 0" }}>
            {cert.professorTitle || "Prof. Dr."} — Professor Orientador
          </p>
          <p style={{ fontSize: "8.5pt", color: "#4a5568", margin: "0.5mm 0 0" }}>
            {cert.disciplineName} · UNIRIO
          </p>
        </div>
      </div>

      {/* Código de verificação */}
      <div style={{
        position: "absolute", bottom: "14mm", left: "18mm", right: "18mm",
        borderTop: "0.5px solid #a0b4d0", paddingTop: "3mm",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <p style={{ fontSize: "7.5pt", color: "#718096", margin: 0 }}>
          Código de verificação: <strong style={{ fontFamily: "monospace" }}>{cert.certificateCode}</strong>
        </p>
        <p style={{ fontSize: "7.5pt", color: "#718096", margin: 0 }}>
          Emitido em: {formatDate(cert.issuedAt)}
        </p>
      </div>
    </div>
  );
}

// ─── Componente Principal ──────────────────────────────────────────────────────
export default function MonitorCertificate() {
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [loading, setLoading] = useState(false);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [selectedCert, setSelectedCert] = useState<Certificate | null>(null);
  const [showPrintView, setShowPrintView] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // Carregar token do localStorage
  useEffect(() => {
    const token = localStorage.getItem(MONITOR_SESSION_KEY);
    if (token) {
      setSessionToken(token);
    }
  }, []);

  // Buscar certificados quando token estiver disponível
  useEffect(() => {
    if (sessionToken) {
      loadCertificates();
    }
  }, [sessionToken]);

  async function loadCertificates() {
    if (!sessionToken) return;
    setLoading(true);
    try {
      const data = await trpcQuery("monitors.listCertificates", {
        monitorSessionToken: sessionToken,
      });
      setCertificates(Array.isArray(data) ? data : []);
    } catch (err: any) {
      const msg = err?.message || "Erro ao carregar certificados";
      if (msg.includes("expirado") || msg.includes("Acesso negado")) {
        toast.error("Sessão expirada. Faça login novamente.");
        localStorage.removeItem(MONITOR_SESSION_KEY);
        setSessionToken(null);
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  function handlePrint(cert: Certificate) {
    setSelectedCert(cert);
    setShowPrintView(true);
    setTimeout(() => {
      window.print();
    }, 300);
  }

  function handleViewCert(cert: Certificate) {
    setSelectedCert(cert);
    setShowPrintView(true);
  }

  function handleClosePrint() {
    setShowPrintView(false);
    setSelectedCert(null);
  }

  // ─── Tela de login ────────────────────────────────────────────────────────
  if (!sessionToken) {
    return (
      <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center p-4">
        <Card className="bg-[#111827] border-[#1e3a5f] p-8 max-w-md w-full text-center space-y-4">
          <Award className="w-12 h-12 text-yellow-400 mx-auto" />
          <h2 className="text-xl font-bold text-white">Certificados de Monitoria</h2>
          <p className="text-sm text-slate-400">
            Você precisa estar logado no Portal do Monitor para acessar seus certificados.
          </p>
          <Link href="/monitor">
            <Button className="bg-yellow-600 hover:bg-yellow-700 text-white w-full">
              <ArrowLeft className="w-4 h-4 mr-2" /> Ir para o Portal do Monitor
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  // ─── Visualização de impressão ────────────────────────────────────────────
  if (showPrintView && selectedCert) {
    return (
      <div className="min-h-screen bg-gray-100">
        {/* Barra de controle (não aparece na impressão) */}
        <div className="print:hidden bg-[#111827] border-b border-[#1e3a5f] px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={handleClosePrint} className="text-slate-400 hover:text-white">
            <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
          </Button>
          <span className="text-white text-sm font-medium flex-1">
            Certificado — {selectedCert.monitorName}
          </span>
          <Button
            size="sm"
            onClick={() => window.print()}
            className="bg-yellow-600 hover:bg-yellow-700 text-white"
          >
            <Printer className="w-4 h-4 mr-2" /> Imprimir / Salvar PDF
          </Button>
        </div>

        {/* Área de impressão */}
        <div className="flex justify-center py-8 print:py-0">
          <div ref={printRef} className="shadow-2xl">
            <CertificatePrintView cert={selectedCert} />
          </div>
        </div>

        {/* Dica de impressão */}
        <div className="print:hidden text-center pb-8">
          <p className="text-sm text-slate-500">
            Use <kbd className="bg-slate-700 text-white px-1.5 py-0.5 rounded text-xs">Ctrl+P</kbd> ou o botão acima para salvar como PDF.
            Selecione "Salvar como PDF" na impressora.
          </p>
        </div>

        {/* Estilos de impressão */}
        <style>{`
          @media print {
            body * { visibility: hidden; }
            #certificate-print-area, #certificate-print-area * { visibility: visible; }
            #certificate-print-area {
              position: fixed;
              left: 0;
              top: 0;
              width: 210mm;
              min-height: 297mm;
            }
            @page { size: A4; margin: 0; }
          }
        `}</style>
      </div>
    );
  }

  // ─── Tela principal ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0a0f1e]">
      {/* Header */}
      <header className="bg-[#111827] border-b border-[#1e3a5f] sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/monitor">
            <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
              <ArrowLeft className="w-4 h-4 mr-1" /> Portal
            </Button>
          </Link>
          <div className="flex items-center gap-2 flex-1">
            <Award className="w-5 h-5 text-yellow-400" />
            <h1 className="text-base font-bold text-white">Meu Certificado de Monitoria</h1>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadCertificates}
            disabled={loading}
            className="text-slate-400 hover:text-white"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </Button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Info sobre certificados */}
        <Card className="bg-[#111827] border-yellow-500/20 p-4">
          <div className="flex items-start gap-3">
            <GraduationCap className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-yellow-300">Certificado de Monitoria Acadêmica</h3>
              <p className="text-xs text-slate-400 mt-1">
                Os certificados são emitidos pelo professor orientador após o encerramento do período de monitoria.
                Cada certificado possui um código único de verificação e pode ser impresso ou salvo em PDF.
              </p>
            </div>
          </div>
        </Card>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-yellow-400 animate-spin" />
          </div>
        )}

        {/* Sem certificados */}
        {!loading && certificates.length === 0 && (
          <Card className="bg-[#111827] border-[#1e3a5f] p-8 text-center">
            <Award className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-300 mb-2">Nenhum certificado emitido</h3>
            <p className="text-sm text-slate-500">
              Seu certificado de monitoria ainda não foi emitido pelo professor.
              Entre em contato com o Prof. Pedro Alexandre para solicitar a emissão.
            </p>
          </Card>
        )}

        {/* Lista de certificados */}
        {!loading && certificates.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-slate-300">
              {certificates.length} certificado{certificates.length !== 1 ? "s" : ""} encontrado{certificates.length !== 1 ? "s" : ""}
            </h2>
            {certificates.map((cert) => (
              <Card key={cert.id} className="bg-[#111827] border-[#1e3a5f] overflow-hidden">
                {/* Cabeçalho do card */}
                <div className="bg-gradient-to-r from-yellow-900/30 to-amber-900/20 border-b border-yellow-500/20 px-4 py-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-yellow-600/20 border border-yellow-500/30 flex items-center justify-center shrink-0">
                    <Award className="w-5 h-5 text-yellow-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{cert.disciplineName}</p>
                    <p className="text-xs text-yellow-300/70">{cert.institution}</p>
                  </div>
                  <Badge
                    variant="outline"
                    className={cert.status === "active"
                      ? "border-green-500/40 text-green-400 text-xs"
                      : "border-red-500/40 text-red-400 text-xs"
                    }
                  >
                    {cert.status === "active" ? (
                      <><CheckCircle2 className="w-3 h-3 mr-1" /> Ativo</>
                    ) : (
                      <><AlertCircle className="w-3 h-3 mr-1" /> Revogado</>
                    )}
                  </Badge>
                </div>

                {/* Detalhes */}
                <div className="px-4 py-4 grid sm:grid-cols-2 gap-3">
                  <div className="flex items-start gap-2">
                    <User className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-slate-500">Monitor(a)</p>
                      <p className="text-sm text-white font-medium">{cert.monitorName}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <BookOpen className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-slate-500">Professor Orientador</p>
                      <p className="text-sm text-white font-medium">
                        {cert.professorTitle || "Prof. Dr."} {cert.professorName}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Calendar className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-slate-500">Período</p>
                      <p className="text-sm text-white font-medium">{formatPeriod(cert.periodStart, cert.periodEnd)}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Clock className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-slate-500">Carga Horária</p>
                      <p className="text-sm text-white font-medium">{cert.workloadHours} horas</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 sm:col-span-2">
                    <Shield className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-slate-500">Código de Verificação</p>
                      <p className="text-sm font-mono text-yellow-300">{cert.certificateCode}</p>
                    </div>
                  </div>
                </div>

                {/* Ações */}
                <div className="px-4 pb-4 flex gap-2 flex-wrap">
                  <Button
                    size="sm"
                    onClick={() => handleViewCert(cert)}
                    variant="outline"
                    className="border-[#1e3a5f] text-slate-300 hover:text-white hover:border-yellow-500/40"
                  >
                    <Eye className="w-4 h-4 mr-2" /> Visualizar
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handlePrint(cert)}
                    className="bg-yellow-600 hover:bg-yellow-700 text-white"
                    disabled={cert.status !== "active"}
                  >
                    <Printer className="w-4 h-4 mr-2" /> Imprimir / PDF
                  </Button>
                  <span className="text-xs text-slate-500 self-center ml-auto">
                    Emitido em {formatDate(cert.issuedAt)}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Link para o portal */}
        <div className="text-center pt-4">
          <Link href="/monitor">
            <Button variant="ghost" className="text-slate-400 hover:text-white text-sm">
              <ArrowLeft className="w-4 h-4 mr-2" /> Voltar ao Portal do Monitor
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
