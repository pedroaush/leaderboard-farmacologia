/**
 * Arquivos de Casos Clínicos — visualização para estudo, sem download.
 * PDFs e imagens são mostrados embutidos na própria página.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { ArrowLeft, FileText, Loader2, X, Image as ImageIcon, Trophy, Calendar, Swords } from "lucide-react";
import { useStudentAuth } from "@/pages/StudentLogin";

const ORANGE = "#F7941D";
const DARK_BG = "#0A1628";
const CARD_BG = "#0D1B2A";

function TabelaClassificacao({ classId }: { classId: number }) {
  const { data: tabela = [], isLoading } = trpc.casosClinicos.getTabelaClassificacao.useQuery({ classId });
  if (isLoading) return <div className="flex items-center justify-center py-6"><Loader2 size={16} className="animate-spin" style={{ color: ORANGE }} /></div>;
  if (!tabela.length) return <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Nenhum grupo encontrado.</p>;
  return (
    <div className="overflow-x-auto rounded-lg" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left" style={{ backgroundColor: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.5)" }}>
            <th className="py-2 px-3">#</th>
            <th className="py-2 px-3">Grupo</th>
            <th className="py-2 px-3 text-center">Pts</th>
            <th className="py-2 px-3 text-center">V</th>
            <th className="py-2 px-3 text-center">E</th>
            <th className="py-2 px-3 text-center">D</th>
            <th className="py-2 px-3 text-center">J</th>
          </tr>
        </thead>
        <tbody>
          {tabela.map((t: any, i: number) => (
            <tr key={t.grupoId} style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <td className="py-1.5 px-3" style={{ color: "rgba(255,255,255,0.4)" }}>{i + 1}º</td>
              <td className="py-1.5 px-3 text-white font-medium">{t.nome}</td>
              <td className="py-1.5 px-3 text-center font-mono font-bold text-white">{t.pontos}</td>
              <td className="py-1.5 px-3 text-center text-emerald-400">{t.vitorias}</td>
              <td className="py-1.5 px-3 text-center text-amber-400">{t.empates}</td>
              <td className="py-1.5 px-3 text-center text-red-400">{t.derrotas}</td>
              <td className="py-1.5 px-3 text-center" style={{ color: "rgba(255,255,255,0.4)" }}>{t.jogos}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Confrontos({ classId }: { classId: number }) {
  const { data: rodadas, isLoading } = trpc.casosClinicos.getTodosConfrontos.useQuery({ classId });
  if (isLoading) return <div className="flex items-center justify-center py-6"><Loader2 size={16} className="animate-spin" style={{ color: ORANGE }} /></div>;
  if (!rodadas?.length) return <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Calendário ainda não gerado.</p>;
  return (
    <div className="space-y-3">
      {rodadas.map((r: any) => (
        <div key={r.rodada} className="rounded-lg p-3" style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold" style={{ color: ORANGE }}>CS{r.rodada}</span>
            {r.data && (
              <span className="text-xs flex items-center gap-1" style={{ color: "rgba(255,255,255,0.5)" }}>
                <Calendar size={11} /> {r.data}
              </span>
            )}
          </div>
          {r.confrontos.length === 0 ? (
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Sem confrontos definidos.</p>
          ) : (
            <div className="grid gap-1.5 sm:grid-cols-2">
              {r.confrontos.map((c: any) => (
                <div key={c.id} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded text-xs" style={{ backgroundColor: "rgba(255,255,255,0.03)" }}>
                  <span className="text-white truncate">{c.grupoANome}</span>
                  {c.status === "concluida" ? (
                    <span className="font-mono font-bold shrink-0" style={{ color: ORANGE }}>{c.grupoAAcertos}×{c.grupoBAcertos}</span>
                  ) : (
                    <Swords size={12} className="shrink-0" style={{ color: "rgba(255,255,255,0.3)" }} />
                  )}
                  <span className="text-white truncate text-right">{c.grupoBNome}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function CasosClinicosArquivos() {
  const { student, sessionToken: studentSessionToken } = useStudentAuth();
  const [openId, setOpenId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"campeonato" | "arquivos">("campeonato");

  // Aceita sessão de aluno OU, se não houver, o token de professor/admin já
  // logado no resto da plataforma (mesmo bypass usado no Portal do Monitor).
  const teacherSessionToken = typeof window !== "undefined" ? localStorage.getItem("teacherSessionToken") : null;
  const isTeacherView = !studentSessionToken && !!teacherSessionToken;
  const sessionToken = studentSessionToken || teacherSessionToken || "";

  const searchParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const classIdFromUrl = searchParams.get("classId") ? parseInt(searchParams.get("classId")!) : null;
  const classId = student?.classId || classIdFromUrl;

  const { data: classesForPicker } = trpc.classes.listAll.useQuery(undefined, { enabled: isTeacherView && !classId });

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

  // Professor/admin sem turma na URL: pede pra escolher, em vez de travar.
  if (isTeacherView && !classId) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: DARK_BG }}>
        <div className="w-full max-w-md">
          <h1 className="text-xl font-bold text-white mb-1">Escolha a turma</h1>
          <p className="text-sm mb-6" style={{ color: "rgba(255,255,255,0.5)" }}>
            Selecione uma turma para ver os Casos Clínicos dela.
          </p>
          <div className="space-y-2">
            {!classesForPicker ? (
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>Carregando turmas...</p>
            ) : (
              classesForPicker.map((c: any) => (
                <a
                  key={c.id}
                  href={`/casos-clinicos/arquivos?classId=${c.id}`}
                  className="block w-full text-left px-4 py-3 rounded-lg transition-colors hover:bg-white/10"
                  style={{ backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                >
                  <span className="text-sm font-medium text-white">{c.name}</span>
                </a>
              ))
            )}
          </div>
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
        {/* Abas */}
        <div className="flex gap-1 mb-5 p-1 rounded-xl" style={{ backgroundColor: CARD_BG, border: "1px solid rgba(255,255,255,0.08)" }}>
          <button
            onClick={() => setActiveTab("campeonato")}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all"
            style={activeTab === "campeonato" ? { backgroundColor: "rgba(247,148,29,0.15)", color: ORANGE } : { color: "rgba(255,255,255,0.5)" }}
          >
            <Trophy size={14} /> Campeonato
          </button>
          <button
            onClick={() => setActiveTab("arquivos")}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all"
            style={activeTab === "arquivos" ? { backgroundColor: "rgba(247,148,29,0.15)", color: ORANGE } : { color: "rgba(255,255,255,0.5)" }}
          >
            <FileText size={14} /> Arquivos
          </button>
        </div>

        {activeTab === "campeonato" && classId && (
          <div className="space-y-6">
            <div>
              <p className="text-xs font-semibold text-white flex items-center gap-1.5 mb-2"><Trophy size={13} style={{ color: ORANGE }} /> Classificação</p>
              <TabelaClassificacao classId={classId} />
            </div>
            <div>
              <p className="text-xs font-semibold text-white flex items-center gap-1.5 mb-2"><Swords size={13} style={{ color: ORANGE }} /> Confrontos por rodada</p>
              <Confrontos classId={classId} />
            </div>
          </div>
        )}
        {activeTab === "campeonato" && !classId && (
          <p className="text-sm text-center py-10" style={{ color: "rgba(255,255,255,0.4)" }}>
            Não conseguimos identificar sua turma. Fale com o professor ou monitor.
          </p>
        )}

        {activeTab === "arquivos" && (
          <>
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
          </>
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