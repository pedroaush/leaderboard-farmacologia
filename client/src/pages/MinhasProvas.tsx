/**
 * /minhas-provas — resultado das provas, gabarito comentado e parecer do aluno.
 * Não depende do id da turma na URL: o servidor descobre a turma pela sessão do aluno.
 */
import { Link } from "wouter";
import { ArrowLeft, ClipboardCheck } from "lucide-react";
import { useStudentAuth } from "@/pages/StudentLogin";
import MeuResultadoProva from "@/components/MeuResultadoProva";

const ORANGE = "#F7941D";
const DARK_BG = "#0A1628";

export default function MinhasProvas() {
  const { sessionToken } = useStudentAuth();
  return (
    <div className="min-h-screen" style={{ backgroundColor: DARK_BG }}>
      <div className="border-b border-white/10">
        <div className="container py-4 flex items-center gap-3">
          <Link href="/leaderboard">
            <button className="p-2 rounded-lg hover:bg-white/10" title="Voltar"><ArrowLeft size={20} className="text-white" /></button>
          </Link>
          <ClipboardCheck size={22} style={{ color: ORANGE }} />
          <div>
            <h1 className="text-xl font-bold text-white">Provas e Notas</h1>
            <p className="text-xs text-white/50">Sua nota, suas respostas, o gabarito comentado e o parecer do professor</p>
          </div>
        </div>
      </div>
      <div className="container py-6 max-w-4xl">
        {sessionToken ? (
          <MeuResultadoProva token={sessionToken} />
        ) : (
          <div className="rounded-xl p-6 text-center" style={{ backgroundColor: "#0D1B2A" }}>
            <p className="text-white/80 mb-4">Entre com a sua conta de aluno para ver suas provas.</p>
            <Link href="/">
              <span className="inline-block px-4 py-2 rounded-lg text-white text-sm font-semibold cursor-pointer" style={{ backgroundColor: ORANGE }}>Ir para o login</span>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
