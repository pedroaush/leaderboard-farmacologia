/**
 * Arquivos de Casos Clínicos — visualização para estudo, sem download.
 * PDFs e imagens são mostrados embutidos na própria página.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { ArrowLeft, FileText, Loader2, X, Image as ImageIcon } from "lucide-react";
import { useStudentAuth } from "@/pages/StudentLogin";

const ORANGE = "#F7941D";
const DARK_BG = "#0A1628";
const CARD_BG = "#0D1B2A";

export default function CasosClinicosArquivos() {
  const { student, sessionToken } = useStudentAuth();
  const [openId, setOpenId] = useState<number | null>(null);

  const classId = student?.classId;

  const { data: arquivos, isLoading } = trpc.casosClinicos.listarArquivos.useQuery(
    { sessionToken: sessionToken || "", classId: classId! },
    { enabled: !!sessionToken && !!classId }
  );

  const { data: arquivoAberto, isLoading: loadingConteudo } = trpc.casosClinicos.verArquivo.useQuery(
    { sessionToken: sessionToken || "", arquivoId: openId! },
    { enabled: !!sessionToken && !!openId }
  );

  if (!sessionToken) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: DARK_BG }}>
        <div className="text-center">
          <p className="text-white mb-4">Faça login para acessar os arquivos de Casos Clínicos.</p>
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
            <h1 className="text-sm font-bold text-white">Arquivos de Casos Clínicos</h1>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Só para consulta — visualize aqui mesmo, sem baixar</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin" style={{ color: ORANGE }} />
          </div>
        ) : !arquivos?.length ? (
          <div className="text-center py-16">
            <FileText size={40} className="mx-auto mb-3" style={{ color: "rgba(255,255,255,0.2)" }} />
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>Nenhum arquivo publicado ainda.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {arquivos.map((a: any) => (
              <button
                key={a.id}
                onClick={() => setOpenId(a.id)}
                className="w-full flex items-center gap-3 p-4 rounded-lg text-left transition-colors hover:bg-white/5"
                style={{ backgroundColor: CARD_BG, border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(247,148,29,0.12)" }}>
                  {a.mimeType?.startsWith("image/") ? <ImageIcon size={18} style={{ color: ORANGE }} /> : <FileText size={18} style={{ color: ORANGE }} />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white truncate">{a.titulo}</p>
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                    CS{a.rodada} · {a.uploadedByName || "Monitor"}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Modal de visualização */}
      {openId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.85)" }}
          onClick={() => setOpenId(null)}
        >
          <div
            className="w-full max-w-3xl h-[85vh] rounded-xl overflow-hidden flex flex-col"
            style={{ backgroundColor: CARD_BG, border: "1px solid rgba(255,255,255,0.1)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
              <p className="text-sm font-medium text-white truncate">{arquivoAberto?.titulo || "Carregando..."}</p>
              <button onClick={() => setOpenId(null)} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
                <X size={18} style={{ color: "rgba(255,255,255,0.6)" }} />
              </button>
            </div>
            <div className="flex-1 overflow-auto bg-white flex items-center justify-center">
              {loadingConteudo ? (
                <Loader2 size={28} className="animate-spin" style={{ color: ORANGE }} />
              ) : arquivoAberto?.mimeType === "application/pdf" ? (
                <iframe
                  src={`data:application/pdf;base64,${arquivoAberto.fileBase64}#toolbar=0`}
                  className="w-full h-full"
                  title={arquivoAberto.titulo}
                />
              ) : arquivoAberto ? (
                <img
                  src={`data:${arquivoAberto.mimeType};base64,${arquivoAberto.fileBase64}`}
                  alt={arquivoAberto.titulo}
                  className="max-w-full max-h-full object-contain"
                  onContextMenu={(e) => e.preventDefault()}
                />
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
