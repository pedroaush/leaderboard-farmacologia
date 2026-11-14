import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { KeyRound, CheckCircle2, XCircle, Loader2, Eye, EyeOff, ArrowLeft, AlertTriangle, Clock, Timer } from "lucide-react";
import { toast } from "sonner";

const ORANGE = "#F7941D";
const LOGO_URL = "/logos/TYglakFwBNwpBXzT.png";

function CountdownTimer({ expiresAt }: { expiresAt: string }) {
  const [timeLeft, setTimeLeft] = useState<{ minutes: number; seconds: number; expired: boolean }>({ minutes: 0, seconds: 0, expired: false });

  const calculateTimeLeft = useCallback(() => {
    const now = new Date().getTime();
    const expiry = new Date(expiresAt).getTime();
    const diff = expiry - now;

    if (diff <= 0) {
      return { minutes: 0, seconds: 0, expired: true };
    }

    const minutes = Math.floor(diff / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    return { minutes, seconds, expired: false };
  }, [expiresAt]);

  useEffect(() => {
    setTimeLeft(calculateTimeLeft());
    const interval = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);
    return () => clearInterval(interval);
  }, [calculateTimeLeft]);

  if (timeLeft.expired) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg" style={{ backgroundColor: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)" }}>
        <AlertTriangle size={16} className="text-red-400 shrink-0" />
        <span className="text-sm text-red-400 font-medium">Token expirado. Solicite um novo link.</span>
      </div>
    );
  }

  const isUrgent = timeLeft.minutes < 10;
  const timerColor = isUrgent ? "#ef4444" : ORANGE;
  const bgColor = isUrgent ? "rgba(239,68,68,0.08)" : "rgba(247,148,29,0.08)";
  const borderColor = isUrgent ? "rgba(239,68,68,0.2)" : "rgba(247,148,29,0.2)";

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: bgColor, border: `1px solid ${borderColor}` }}>
      <Timer size={18} style={{ color: timerColor }} className="shrink-0" />
      <div className="flex-1">
        <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>Tempo restante para redefinir</p>
        <div className="flex items-center gap-1 mt-0.5">
          <span className="font-mono font-bold text-lg" style={{ color: timerColor }}>
            {String(timeLeft.minutes).padStart(2, "0")}
          </span>
          <span className="font-mono font-bold text-lg" style={{ color: timerColor, opacity: 0.6 }}>:</span>
          <span className="font-mono font-bold text-lg" style={{ color: timerColor }}>
            {String(timeLeft.seconds).padStart(2, "0")}
          </span>
        </div>
      </div>
      {isUrgent && (
        <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ backgroundColor: "rgba(239,68,68,0.2)", color: "#ef4444" }}>
          Expirando!
        </span>
      )}
    </div>
  );
}

export default function TeacherResetPassword() {
  const [, navigate] = useLocation();
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tokenMissing, setTokenMissing] = useState(false);

  const resetPasswordMutation = trpc.teacherAuth.resetPassword.useMutation();

  // Extract token from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get("token");
    if (tokenParam) {
      setToken(tokenParam);
    } else {
      setTokenMissing(true);
    }
  }, []);

  // Verify token validity and get expiration
  const { data: tokenInfo, isLoading: tokenLoading } = trpc.teacherAuth.verifyResetToken.useQuery(
    { token },
    { enabled: !!token, retry: false }
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("As senhas não coincidem");
      return;
    }

    if (newPassword.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres");
      return;
    }

    // Check if token is still valid before submitting
    if (tokenInfo && !tokenInfo.valid) {
      setError(tokenInfo.message || "Token inválido ou expirado");
      return;
    }

    setLoading(true);

    try {
      const result = await resetPasswordMutation.mutateAsync({
        token,
        newPassword,
      });

      if (result.success) {
        setSuccess(true);
        toast.success("Senha redefinida com sucesso!");
        setTimeout(() => navigate("/professor/login"), 3000);
      } else {
        setError(result.message);
      }
    } catch (err: any) {
      setError(err.message || "Erro ao redefinir senha. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  // Password strength indicator
  const getPasswordStrength = (pw: string) => {
    if (!pw) return { level: 0, label: "", color: "" };
    let score = 0;
    if (pw.length >= 6) score++;
    if (pw.length >= 8) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;

    if (score <= 1) return { level: 1, label: "Fraca", color: "#ef4444" };
    if (score <= 2) return { level: 2, label: "Razoável", color: "#f59e0b" };
    if (score <= 3) return { level: 3, label: "Boa", color: "#3b82f6" };
    return { level: 4, label: "Forte", color: "#22c55e" };
  };

  const strength = getPasswordStrength(newPassword);
  const tokenExpired = tokenInfo && !tokenInfo.valid && tokenInfo.message === "Token expirado";
  const tokenInvalid = tokenInfo && !tokenInfo.valid && !tokenExpired;

  return (
    <div className="min-h-screen landscape-min-h-auto flex flex-col justify-center items-center p-4 sm:p-6 md:p-12" style={{ backgroundColor: "#0A1628" }}>
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-6 sm:mb-8">
          <img src={LOGO_URL} alt="Logo" className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 object-contain" />
          <h1 className="text-lg sm:text-xl font-bold text-white">Conexão em Farmacologia</h1>
        </div>

        {/* Card */}
        <div className="rounded-lg p-6 sm:p-8" style={{ backgroundColor: "#0D1B2A", border: "1px solid rgba(255,255,255,0.1)" }}>
          {tokenLoading ? (
            <div className="text-center py-8">
              <Loader2 size={32} className="animate-spin mx-auto mb-4" style={{ color: ORANGE }} />
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>Verificando token...</p>
            </div>
          ) : success ? (
            <div className="text-center">
              <div className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center" style={{ backgroundColor: "rgba(34,197,94,0.1)" }}>
                <CheckCircle2 size={40} className="text-green-400" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-3">Senha Redefinida!</h2>
              <p className="text-sm mb-6" style={{ color: "rgba(255,255,255,0.5)" }}>
                Sua senha foi alterada com sucesso. Redirecionando para o login...
              </p>
              <div className="w-8 h-8 border-2 border-green-400/30 border-t-green-400 rounded-full animate-spin mx-auto" />
            </div>
          ) : tokenMissing || tokenInvalid ? (
            <div className="text-center">
              <div className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center" style={{ backgroundColor: "rgba(239,68,68,0.1)" }}>
                <AlertTriangle size={40} className="text-red-400" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-3">
                {tokenMissing ? "Token Não Encontrado" : "Token Inválido"}
              </h2>
              <p className="text-sm mb-6" style={{ color: "rgba(255,255,255,0.5)" }}>
                {tokenMissing
                  ? "O link de redefinição é inválido ou está incompleto."
                  : tokenInfo?.message || "Este token não é válido."}
                {" "}Solicite um novo link.
              </p>
              <button
                onClick={() => navigate("/professor/esqueci-senha")}
                className="w-full py-3 rounded-lg font-semibold text-white flex items-center justify-center gap-2 transition-all hover:opacity-90"
                style={{ backgroundColor: ORANGE }}
              >
                <KeyRound size={18} />
                Solicitar Novo Link
              </button>
            </div>
          ) : tokenExpired ? (
            <div className="text-center">
              <div className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center" style={{ backgroundColor: "rgba(239,68,68,0.1)" }}>
                <Clock size={40} className="text-red-400" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-3">Token Expirado</h2>
              <p className="text-sm mb-6" style={{ color: "rgba(255,255,255,0.5)" }}>
                O link de redefinição expirou. Solicite um novo link para redefinir sua senha.
              </p>
              <button
                onClick={() => navigate("/professor/esqueci-senha")}
                className="w-full py-3 rounded-lg font-semibold text-white flex items-center justify-center gap-2 transition-all hover:opacity-90"
                style={{ backgroundColor: ORANGE }}
              >
                <KeyRound size={18} />
                Solicitar Novo Link
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-2">
                <KeyRound size={24} style={{ color: ORANGE }} />
                <h2 className="text-xl sm:text-2xl font-bold text-white">Redefinir Senha</h2>
              </div>
              <p className="text-sm mb-4" style={{ color: "rgba(255,255,255,0.5)" }}>
                Digite sua nova senha abaixo
              </p>

              {/* Countdown Timer */}
              {tokenInfo?.expiresAt && (
                <div className="mb-5">
                  <CountdownTimer expiresAt={tokenInfo.expiresAt} />
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <div className="p-3 rounded-lg flex items-start gap-3" style={{ backgroundColor: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)" }}>
                    <XCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
                    <p className="text-sm text-red-400">{error}</p>
                  </div>
                )}

                {/* New Password */}
                <div>
                  <label className="block text-sm font-medium text-white mb-2">Nova Senha</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => { setNewPassword(e.target.value); setError(""); }}
                      placeholder="Mínimo 6 caracteres"
                      className="w-full px-4 py-3 rounded-lg text-white text-sm pr-12"
                      style={{
                        backgroundColor: "rgba(255,255,255,0.08)",
                        border: error ? "1px solid rgba(239,68,68,0.5)" : "1px solid rgba(255,255,255,0.1)",
                      }}
                      disabled={loading}
                      required
                      minLength={6}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {/* Password strength bar */}
                  {newPassword && (
                    <div className="mt-2">
                      <div className="flex gap-1 mb-1">
                        {[1, 2, 3, 4].map((i) => (
                          <div
                            key={i}
                            className="h-1 flex-1 rounded-full transition-all"
                            style={{
                              backgroundColor: i <= strength.level ? strength.color : "rgba(255,255,255,0.1)",
                            }}
                          />
                        ))}
                      </div>
                      <p className="text-xs" style={{ color: strength.color }}>
                        Senha {strength.label}
                      </p>
                    </div>
                  )}
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-sm font-medium text-white mb-2">Confirmar Senha</label>
                  <div className="relative">
                    <input
                      type={showConfirm ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => { setConfirmPassword(e.target.value); setError(""); }}
                      placeholder="Digite novamente"
                      className="w-full px-4 py-3 rounded-lg text-white text-sm pr-12"
                      style={{
                        backgroundColor: "rgba(255,255,255,0.08)",
                        border: confirmPassword && confirmPassword !== newPassword
                          ? "1px solid rgba(239,68,68,0.5)"
                          : confirmPassword && confirmPassword === newPassword
                            ? "1px solid rgba(34,197,94,0.5)"
                            : "1px solid rgba(255,255,255,0.1)",
                      }}
                      disabled={loading}
                      required
                      minLength={6}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                    >
                      {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {confirmPassword && confirmPassword !== newPassword && (
                    <p className="text-xs text-red-400 mt-1">As senhas não coincidem</p>
                  )}
                  {confirmPassword && confirmPassword === newPassword && (
                    <p className="text-xs text-green-400 mt-1">Senhas coincidem ✓</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading || !token || !newPassword || !confirmPassword || newPassword !== confirmPassword}
                  className="w-full py-3 rounded-lg font-semibold text-white flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: ORANGE }}
                >
                  {loading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Redefinindo...
                    </>
                  ) : (
                    <>
                      <KeyRound size={18} />
                      Redefinir Senha
                    </>
                  )}
                </button>
              </form>
            </>
          )}

          {/* Footer */}
          {!success && (
            <div className="mt-6 pt-4 border-t border-gray-700">
              <p className="text-xs text-center" style={{ color: "rgba(255,255,255,0.4)" }}>
                <button
                  type="button"
                  onClick={() => navigate("/professor/login")}
                  className="hover:underline font-semibold"
                  style={{ color: ORANGE }}
                >
                  <ArrowLeft size={12} className="inline mr-1" />
                  Voltar ao Login
                </button>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
