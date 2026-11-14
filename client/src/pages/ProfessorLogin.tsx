import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Eye, EyeOff, LogIn, AlertCircle, XCircle } from "lucide-react";
import { toast } from "sonner";

const ORANGE = "#F7941D";
const LOGO_URL = "/logos/TYglakFwBNwpBXzT.png";

export default function ProfessorLogin() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const loginMutation = trpc.teacherAuth.login.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        // Save session token and teacher info to localStorage
        localStorage.setItem("teacherSessionToken", result.sessionToken);
        localStorage.setItem("teacherName", result.teacher.name);
        localStorage.setItem("teacherEmail", result.teacher.email);
        setError("");
        toast.success("Login realizado com sucesso!");
        // Redirect to admin panel
        setTimeout(() => navigate("/admin/professor"), 500);
      } else {
        setError(result.message || "Erro ao fazer login");
        toast.error(result.message || "Erro ao fazer login");
        setIsLoading(false);
      }
    },
    onError: (error) => {
      setError("Erro ao conectar com o servidor. Tente novamente.");
      toast.error("Erro ao conectar com o servidor");
      console.error(error);
      setIsLoading(false);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    if (!email || !password) {
      setError("Por favor, preencha todos os campos");
      return;
    }

    setIsLoading(true);
    loginMutation.mutate({ email: email.toLowerCase().trim(), password });
  };

  return (
    <div className="min-h-screen landscape-min-h-auto flex flex-col lg:flex-row" style={{ backgroundColor: "#0A1628" }}>
      {/* Left Side - Branding (Hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-center items-center p-12 2xl:p-16" style={{ backgroundColor: "#0D1B2A" }}>
        <div className="text-center max-w-md 2xl:max-w-lg">
          <img src={LOGO_URL} alt="Logo" className="w-32 h-32 2xl:w-40 2xl:h-40 mx-auto mb-8 object-contain" />
          <h1 className="text-4xl 2xl:text-5xl font-bold text-white mb-4">Conexão em Farmacologia</h1>
          <p className="text-lg mb-2" style={{ color: "rgba(255,255,255,0.7)" }}>
            UNIRIO - Universidade Federal do Estado do Rio de Janeiro
          </p>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
            Semestre 2026.1
          </p>
          
          <div className="mt-12 space-y-6">
            <div className="text-left">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: ORANGE + "20" }}>
                  <span style={{ color: ORANGE }}>📊</span>
                </div>
                <span className="text-white font-semibold">Leaderboard Gamificado</span>
              </div>
              <p className="text-sm ml-13" style={{ color: "rgba(255,255,255,0.5)" }}>
                Acompanhe o desempenho das equipes em tempo real
              </p>
            </div>

            <div className="text-left">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: ORANGE + "20" }}>
                  <span style={{ color: ORANGE }}>🎯</span>
                </div>
                <span className="text-white font-semibold">Seminários Jigsaw</span>
              </div>
              <p className="text-sm ml-13" style={{ color: "rgba(255,255,255,0.5)" }}>
                Gerencie grupos de seminário e atribua coordenadores
              </p>
            </div>

            <div className="text-left">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: ORANGE + "20" }}>
                  <span style={{ color: ORANGE }}>📈</span>
                </div>
                <span className="text-white font-semibold">Análise Detalhada</span>
              </div>
              <p className="text-sm ml-13" style={{ color: "rgba(255,255,255,0.5)" }}>
                Visualize métricas e progresso dos alunos
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-6 sm:p-12 2xl:p-16">
        <div className="w-full max-w-md 2xl:max-w-lg">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8">
            <img src={LOGO_URL} alt="Logo" className="w-16 h-16 mx-auto mb-4 object-contain" />
            <h1 className="text-2xl font-bold text-white">Conexão em Farmacologia</h1>
          </div>

          {/* Login Card */}
          <div className="rounded-lg p-8 2xl:p-10" style={{ backgroundColor: "#0D1B2A", border: `1px solid rgba(255,255,255,0.1)` }}>
            <h2 className="text-2xl 2xl:text-3xl font-bold text-white mb-2">Acesso Professor</h2>
            <p className="text-sm mb-8" style={{ color: "rgba(255,255,255,0.5)" }}>
              Faça login com suas credenciais institucionais
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Error Message - Inline */}
              {error && (
                <div className="p-3 rounded-lg flex items-start gap-3" style={{ backgroundColor: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)" }}>
                  <XCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-red-400 font-medium">{error}</p>
                    {error.includes("incorretos") && (
                      <p className="text-xs text-red-400/70 mt-1">
                        Verifique seu email e senha. Se esqueceu a senha, clique em{" "}
                        <button type="button" onClick={() => navigate("/professor/esqueci-senha")} className="underline text-red-300 hover:text-red-200">Redefinir senha</button>.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Email Input */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">Email Institucional</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(""); }}
                  placeholder="seu.email@unirio.br"
                  className="w-full px-4 py-3 rounded-lg text-white text-sm"
                  style={{
                    backgroundColor: "rgba(255,255,255,0.08)",
                    border: error ? `1px solid rgba(239,68,68,0.5)` : `1px solid rgba(255,255,255,0.1)`,
                  }}
                  disabled={isLoading}
                />
              </div>

              {/* Password Input */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">Senha</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(""); }}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 rounded-lg text-white text-sm"
                    style={{
                      backgroundColor: "rgba(255,255,255,0.08)",
                      border: error ? `1px solid rgba(239,68,68,0.5)` : `1px solid rgba(255,255,255,0.1)`,
                    }}
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                    disabled={isLoading}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Info Box */}
              <div className="p-3 rounded-lg flex gap-3" style={{ backgroundColor: ORANGE + "10", border: `1px solid ${ORANGE}30` }}>
                <AlertCircle size={18} style={{ color: ORANGE, flexShrink: 0 }} />
                <p className="text-xs" style={{ color: ORANGE }}>
                  Use suas credenciais institucionais UNIRIO (@unirio.br ou @edu.unirio.br)
                </p>
              </div>

              {/* Login Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 rounded-lg font-semibold text-white flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: ORANGE }}
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Conectando...
                  </>
                ) : (
                  <>
                    <LogIn size={18} />
                    Entrar
                  </>
                )}
              </button>


            </form>

            {/* Footer */}
            <div className="mt-8 pt-6 border-t border-gray-700 space-y-3">
              <p className="text-xs text-center" style={{ color: "rgba(255,255,255,0.4)" }}>
                Esqueceu a senha?{" "}
                <button
                  type="button"
                  onClick={() => navigate("/professor/esqueci-senha")}
                  className="hover:underline font-semibold"
                  style={{ color: ORANGE }}
                >
                  Redefinir senha
                </button>
              </p>
              <p className="text-xs text-center" style={{ color: "rgba(255,255,255,0.4)" }}>
                Não tem uma conta?{" "}
                <button
                  type="button"
                  onClick={() => navigate("/professor/signup")}
                  className="hover:underline font-semibold"
                  style={{ color: ORANGE }}
                >
                  Criar conta
                </button>
              </p>
              <p className="text-xs text-center" style={{ color: "rgba(255,255,255,0.4)" }}>
                <button
                  type="button"
                  onClick={() => navigate("/")}
                  className="hover:underline"
                  style={{ color: ORANGE }}
                >
                  Voltar para início
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
