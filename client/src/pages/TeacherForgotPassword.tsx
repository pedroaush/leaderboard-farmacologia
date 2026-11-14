import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { KeyRound, ArrowLeft, Copy, CheckCircle2, Mail, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

const ORANGE = "#F7941D";
const LOGO_URL = "/logos/TYglakFwBNwpBXzT.png";

export default function TeacherForgotPassword() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [resetLink, setResetLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const requestResetMutation = trpc.teacherAuth.requestPasswordReset.useMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResetLink("");
    setError("");

    try {
      const result = await requestResetMutation.mutateAsync({
        email: email.toLowerCase().trim(),
        origin: window.location.origin,
      });

      setSubmitted(true);

      if (result.success && result.resetLink) {
        setResetLink(window.location.origin + result.resetLink);
        toast.success("Link de redefinição gerado!");
      } else if (result.success && (result as any).emailSent) {
        toast.success("Email de redefinição enviado!");
      } else {
        toast.info(result.message);
      }
    } catch (err: any) {
      setError(err.message || "Erro ao solicitar redefinição. Tente novamente.");
      toast.error("Erro ao solicitar redefinição");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(resetLink);
    setCopied(true);
    toast.success("Link copiado!");
    setTimeout(() => setCopied(false), 3000);
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

          <div className="mt-12 space-y-6">
            <div className="text-left">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: ORANGE + "20" }}>
                  <KeyRound size={20} style={{ color: ORANGE }} />
                </div>
                <span className="text-white font-semibold">Recuperação Segura</span>
              </div>
              <p className="text-sm ml-13" style={{ color: "rgba(255,255,255,0.5)" }}>
                Link de redefinição com validade de 1 hora
              </p>
            </div>

            <div className="text-left">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: ORANGE + "20" }}>
                  <Mail size={20} style={{ color: ORANGE }} />
                </div>
                <span className="text-white font-semibold">Notificação Automática</span>
              </div>
              <p className="text-sm ml-13" style={{ color: "rgba(255,255,255,0.5)" }}>
                O coordenador é notificado automaticamente
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-6 sm:p-12 2xl:p-16">
        <div className="w-full max-w-md 2xl:max-w-lg">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8">
            <img src={LOGO_URL} alt="Logo" className="w-16 h-16 mx-auto mb-4 object-contain" />
            <h1 className="text-2xl font-bold text-white">Conexão em Farmacologia</h1>
          </div>

          {/* Card */}
          <div className="rounded-lg p-8 2xl:p-10" style={{ backgroundColor: "#0D1B2A", border: "1px solid rgba(255,255,255,0.1)" }}>
            {!submitted ? (
              <>
                <div className="flex items-center gap-3 mb-2">
                  <KeyRound size={24} style={{ color: ORANGE }} />
                  <h2 className="text-2xl 2xl:text-3xl font-bold text-white">Esqueci minha senha</h2>
                </div>
                <p className="text-sm mb-8" style={{ color: "rgba(255,255,255,0.5)" }}>
                  Digite seu email institucional para receber um link de redefinição de senha
                </p>

                <form onSubmit={handleSubmit} className="space-y-5">
                  {error && (
                    <div className="p-3 rounded-lg flex items-start gap-3" style={{ backgroundColor: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)" }}>
                      <XCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
                      <p className="text-sm text-red-400">{error}</p>
                    </div>
                  )}

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
                        border: error ? "1px solid rgba(239,68,68,0.5)" : "1px solid rgba(255,255,255,0.1)",
                      }}
                      disabled={loading}
                      required
                      autoComplete="email"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !email}
                    className="w-full py-3 rounded-lg font-semibold text-white flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ backgroundColor: ORANGE }}
                  >
                    {loading ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        Gerando link...
                      </>
                    ) : (
                      <>
                        <KeyRound size={18} />
                        Solicitar Redefinição
                      </>
                    )}
                  </button>
                </form>
              </>
            ) : resetLink ? (
              <>
                <div className="text-center mb-6">
                  <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: "rgba(34,197,94,0.1)" }}>
                    <CheckCircle2 size={32} className="text-green-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">Link Gerado!</h2>
                  <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
                    Use o link abaixo para redefinir sua senha. O coordenador do curso também foi notificado.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-white mb-2">Link de Redefinição</label>
                    <div className="flex gap-2">
                      <input
                        value={resetLink}
                        readOnly
                        className="flex-1 px-3 py-2.5 rounded-lg text-white text-xs font-mono truncate"
                        style={{
                          backgroundColor: "rgba(255,255,255,0.08)",
                          border: "1px solid rgba(255,255,255,0.1)",
                        }}
                      />
                      <button
                        onClick={copyToClipboard}
                        className="px-3 py-2.5 rounded-lg flex items-center gap-1.5 text-sm font-medium transition-all hover:opacity-90 shrink-0"
                        style={{
                          backgroundColor: copied ? "rgba(34,197,94,0.2)" : ORANGE + "20",
                          border: `1px solid ${copied ? "rgba(34,197,94,0.3)" : ORANGE + "30"}`,
                          color: copied ? "#22c55e" : ORANGE,
                        }}
                      >
                        {copied ? <CheckCircle2 size={16} /> : <Copy size={16} />}
                        {copied ? "Copiado!" : "Copiar"}
                      </button>
                    </div>
                    <p className="text-xs mt-2" style={{ color: "rgba(255,255,255,0.4)" }}>
                      Este link expira em 1 hora
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      // Navigate directly to the reset page
                      window.location.href = resetLink;
                    }}
                    className="w-full py-3 rounded-lg font-semibold text-white flex items-center justify-center gap-2 transition-all hover:opacity-90"
                    style={{ backgroundColor: ORANGE }}
                  >
                    <KeyRound size={18} />
                    Redefinir Senha Agora
                  </button>

                  <button
                    onClick={() => {
                      setSubmitted(false);
                      setResetLink("");
                      setEmail("");
                    }}
                    className="w-full py-2.5 rounded-lg font-medium text-sm transition-all hover:opacity-80"
                    style={{ color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.1)" }}
                  >
                    Gerar Novo Link
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="text-center mb-6">
                  <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: "rgba(34,197,94,0.1)" }}>
                    <Mail size={32} className="text-green-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">Email Enviado!</h2>
                  <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
                    Se o email <strong className="text-white">{email}</strong> estiver cadastrado, você receberá um link de redefinição de senha em breve.
                  </p>
                </div>

                <div className="p-3 rounded-lg mb-4" style={{ backgroundColor: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
                  <p className="text-xs text-green-400">
                    📧 Verifique sua caixa de entrada e a pasta de spam. O link expira em 1 hora.
                  </p>
                </div>

                <div className="p-3 rounded-lg mb-4" style={{ backgroundColor: ORANGE + "10", border: `1px solid ${ORANGE}30` }}>
                  <p className="text-xs" style={{ color: ORANGE }}>
                    Não recebeu? O coordenador do curso também foi notificado e pode enviar o link manualmente.
                  </p>
                </div>

                <button
                  onClick={() => {
                    setSubmitted(false);
                    setResetLink("");
                    setEmail("");
                    setError("");
                  }}
                  className="w-full py-2.5 rounded-lg font-medium text-sm transition-all hover:opacity-80 mb-3"
                  style={{ color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.1)" }}
                >
                  Tentar Novamente
                </button>
              </>
            )}

            {/* Footer */}
            <div className="mt-6 pt-4 border-t border-gray-700">
              <p className="text-xs text-center" style={{ color: "rgba(255,255,255,0.4)" }}>
                Lembrou a senha?{" "}
                <button
                  type="button"
                  onClick={() => navigate("/professor/login")}
                  className="hover:underline font-semibold"
                  style={{ color: ORANGE }}
                >
                  Voltar ao Login
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
