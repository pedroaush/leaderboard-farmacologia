/**
 * Student Login/Register — Conexão em Farmacologia
 * Email institucional @edu.unirio.br + matrícula
 */
import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  GraduationCap, Mail, Lock, User, Hash, ArrowRight,
  ArrowLeft, Eye, EyeOff, AlertCircle, CheckCircle,
  FlaskConical, Search, Fingerprint
} from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

const LOGO_URL = "https://files.manuscdn.com/user_upload_by_module/session_file/310419663028318382/TYglakFwBNwpBXzT.png";
const ORANGE = "#F7941D";

// Student session management via localStorage
export function getStudentSession(): string | null {
  return localStorage.getItem("student_session_token");
}

export function setStudentSession(token: string) {
  localStorage.setItem("student_session_token", token);
}

export function clearStudentSession() {
  localStorage.removeItem("student_session_token");
}

export function useStudentAuth() {
  const token = getStudentSession();
  const { data: student, isLoading, refetch } = trpc.studentAuth.me.useQuery(
    { sessionToken: token || "" },
    { enabled: !!token, retry: false }
  );

  const logout = trpc.studentAuth.logout.useMutation({
    onSuccess: () => {
      clearStudentSession();
      window.location.href = "/";
    },
  });

  return {
    student: token ? student : null,
    isLoading: !!token && isLoading,
    isAuthenticated: !!token && !!student,
    sessionToken: token,
    logout: () => {
      if (token) logout.mutate({ sessionToken: token });
      else window.location.href = "/";
    },
    refetch,
  };
}

export default function StudentLogin() {
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [matricula, setMatricula] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [memberSearch, setMemberSearch] = useState("");
  const [studentName, setStudentName] = useState("");
  const [registerType, setRegisterType] = useState<"turma" | "externo">("turma");
  const [inviteCode, setInviteCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [redirectAfterLogin, setRedirectAfterLogin] = useState(false);

  // Check if already logged in
  const { isAuthenticated, isLoading, student } = useStudentAuth();

  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      const returnUrl = localStorage.getItem("attendance_return_url");
      if (returnUrl) {
        localStorage.removeItem("attendance_return_url");
        setLocation(returnUrl);
      } else if (student?.classId) {
        setLocation(`/aluno/${student.classId}`);
      } else {
        setLocation("/leaderboard");
      }
    }
  }, [isAuthenticated, isLoading, student, setLocation]);

  // Redirecionar após login quando dados do aluno carregarem
  useEffect(() => {
    if (redirectAfterLogin && isAuthenticated && student) {
      setRedirectAfterLogin(false);
      if (student.classId) {
        setLocation(`/aluno/${student.classId}`);
      } else {
        setLocation("/leaderboard");
      }
    }
  }, [redirectAfterLogin, isAuthenticated, student, setLocation]);

  // Get available members for registration
  const { data: availableMembers } = trpc.studentAuth.getAvailableMembers.useQuery(
    undefined,
    { enabled: mode === "register" }
  );

  const filteredMembers = useMemo(() => {
    if (!availableMembers) return [];
    if (!memberSearch.trim()) return availableMembers;
    const search = memberSearch.toLowerCase();
    return availableMembers.filter(m =>
      m.name.toLowerCase().includes(search) ||
      m.teamName.toLowerCase().includes(search)
    );
  }, [availableMembers, memberSearch]);

  const loginMutation = trpc.studentAuth.login.useMutation();
  const registerMutation = trpc.studentAuth.register.useMutation();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsSubmitting(true);

    try {
      const result = await loginMutation.mutateAsync({ email, password });
      if (result.success && "sessionToken" in result) {
        setStudentSession(result.sessionToken);
        setSuccess("Login realizado com sucesso!");
        const returnUrl = localStorage.getItem("attendance_return_url");
        if (returnUrl) {
          localStorage.removeItem("attendance_return_url");
          setTimeout(() => setLocation(returnUrl), 500);
        } else {
          // Redirecionar para o portal da turma após carregar os dados do aluno
          setRedirectAfterLogin(true);
        }
      } else {
        setError(result.message);
      }
    } catch (err: any) {
      setError(err.message || "Erro ao fazer login");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (password.length < 5) {
      setError("A senha deve ter pelo menos 5 caracteres");
      return;
    }
    if (password !== confirmPassword) {
      setError("As senhas não coincidem");
      return;
    }
    if (!selectedMemberId) {
      setError("Selecione seu nome na lista de alunos");
      return;
    }
    if (matricula.length < 5) {
      setError("A matrícula deve ter pelo menos 5 caracteres");
      return;
    }

    // Get name from selected member
    const nameToSend = availableMembers?.find(m => m.id === selectedMemberId)?.name || studentName;

    setIsSubmitting(true);
    try {
      const result = await registerMutation.mutateAsync({
        email,
        name: nameToSend,
        matricula,
        password,
        memberId: selectedMemberId!,
      });
      if (result.success && "sessionToken" in result) {
        setStudentSession(result.sessionToken);
        setSuccess("Conta criada com sucesso! Redirecionando...");
        const returnUrl = localStorage.getItem("attendance_return_url");
        if (returnUrl) {
          localStorage.removeItem("attendance_return_url");
          setTimeout(() => setLocation(returnUrl), 1000);
        } else {
          setTimeout(() => setLocation("/leaderboard"), 1000);
        }
      } else {
        setError(result.message);
      }
    } catch (err: any) {
      setError(err.message || "Erro ao criar conta");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#0A1628" }}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <FlaskConical size={40} style={{ color: ORANGE }} />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen landscape-min-h-auto flex flex-col" style={{ backgroundColor: "#0A1628" }}>
      {/* Header */}
      <div className="px-3 sm:px-4 py-3 sm:py-4">
        <div className="max-w-md 2xl:max-w-lg mx-auto flex items-center justify-between">
          <button
            onClick={() => setLocation("/")}
            className="flex items-center gap-2 text-sm transition-colors"
            style={{ color: "rgba(255,255,255,0.5)" }}
          >
            <ArrowLeft size={16} />
            Voltar
          </button>
          <div className="flex items-center gap-2">
            <img src={LOGO_URL} alt="Logo" className="w-8 h-8 object-contain" />
            <span className="text-sm font-semibold text-white" style={{ fontFamily: "'Outfit', sans-serif" }}>
              Conexão em Farmacologia
            </span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-3 sm:px-4 py-4 sm:py-8">
        <motion.div
          className="w-full max-w-md 2xl:max-w-lg"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Icon */}
          <div className="text-center mb-8">
            <div
              className="w-20 h-20 2xl:w-24 2xl:h-24 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: "rgba(247,148,29,0.15)" }}
            >
              <GraduationCap size={40} style={{ color: ORANGE }} />
            </div>
            <h1 className="text-xl sm:text-2xl 2xl:text-3xl font-bold text-white" style={{ fontFamily: "'Outfit', sans-serif" }}>
              {mode === "login" ? "Entrar na Plataforma" : "Criar Conta"}
            </h1>
            <p className="text-sm mt-2" style={{ color: "rgba(255,255,255,0.5)" }}>
              {mode === "login"
                ? "Use seu email e matrícula como senha"
                : "Cadastre-se com seu email e matrícula"}
            </p>
          </div>

          {/* Tab Switch */}
          <div className="flex gap-1 p-1 rounded-lg mb-6" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
            <button
              onClick={() => { setMode("login"); setError(""); setSuccess(""); }}
              className="flex-1 py-2.5 rounded-md text-sm font-medium transition-all"
              style={{
                backgroundColor: mode === "login" ? ORANGE : "transparent",
                color: mode === "login" ? "#fff" : "rgba(255,255,255,0.5)",
              }}
            >
              Entrar
            </button>
            <button
              onClick={() => { setMode("register"); setError(""); setSuccess(""); }}
              className="flex-1 py-2.5 rounded-md text-sm font-medium transition-all"
              style={{
                backgroundColor: mode === "register" ? ORANGE : "transparent",
                color: mode === "register" ? "#fff" : "rgba(255,255,255,0.5)",
              }}
            >
              Cadastrar
            </button>
          </div>

          {/* Error/Success Messages */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-4 p-3 rounded-lg flex items-center gap-2 text-sm"
                style={{ backgroundColor: "rgba(239,68,68,0.15)", color: "#ef4444" }}
              >
                <AlertCircle size={16} className="shrink-0" />
                {error}
              </motion.div>
            )}
            {success && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-4 p-3 rounded-lg flex items-center gap-2 text-sm"
                style={{ backgroundColor: "rgba(34,197,94,0.15)", color: "#22c55e" }}
              >
                <CheckCircle size={16} className="shrink-0" />
                {success}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Login Form */}
          <AnimatePresence mode="wait">
            {mode === "login" ? (
              <motion.form
                key="login"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                onSubmit={handleLogin}
                className="space-y-4"
              >
                {/* Email */}
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "rgba(255,255,255,0.6)" }}>
                    Email Institucional
                  </label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "rgba(255,255,255,0.3)" }} />
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="seu.email@edu.unirio.br"
                      required
                      className="w-full pl-10 pr-4 py-3 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 transition-all"
                      style={{
                        backgroundColor: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(255,255,255,0.1)",
                      }}
                    />
                  </div>
                </div>

                {/* Matrícula (Password) */}
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "rgba(255,255,255,0.6)" }}>
                    Matrícula (senha)
                  </label>
                  <div className="relative">
                    <Hash size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "rgba(255,255,255,0.3)" }} />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Digite sua matrícula"
                      required
                      className="w-full pl-10 pr-12 py-3 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 transition-all"
                      style={{
                        backgroundColor: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(255,255,255,0.1)",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                      style={{ color: "rgba(255,255,255,0.3)" }}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>
                    Sua matrícula é sua senha de acesso
                  </p>
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 rounded-lg font-semibold text-white flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: ORANGE }}
                >
                  {isSubmitting ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    >
                      <FlaskConical size={18} />
                    </motion.div>
                  ) : (
                    <>
                      Entrar
                      <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </motion.form>
            ) : (
              <motion.form
                key="register"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={handleRegister}
                className="space-y-4"
              >


                {/* Select Student Name (turma) or Type Name (externo) */}
                {registerType === "turma" ? (
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "rgba(255,255,255,0.6)" }}>
                    Selecione seu Nome
                  </label>
                  <div className="relative mb-2">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "rgba(255,255,255,0.3)" }} />
                    <input
                      type="text"
                      value={memberSearch}
                      onChange={e => setMemberSearch(e.target.value)}
                      placeholder="Buscar por nome ou equipe..."
                      className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 transition-all"
                      style={{
                        backgroundColor: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(255,255,255,0.1)",
                      }}
                    />
                  </div>
                  <div
                    className="max-h-40 overflow-y-auto rounded-lg"
                    style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                  >
                    {filteredMembers.length === 0 ? (
                      <div className="p-3 text-center text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                        {availableMembers?.length === 0 ? "Todos os alunos já estão cadastrados" : "Nenhum aluno encontrado"}
                      </div>
                    ) : (
                      filteredMembers.map(m => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setSelectedMemberId(m.id)}
                          className="w-full px-3 py-2 text-left flex items-center gap-2 transition-colors text-sm"
                          style={{
                            backgroundColor: selectedMemberId === m.id ? "rgba(247,148,29,0.15)" : "transparent",
                            color: selectedMemberId === m.id ? ORANGE : "rgba(255,255,255,0.7)",
                            borderBottom: "1px solid rgba(255,255,255,0.04)",
                          }}
                        >
                          <span>{m.teamEmoji}</span>
                          <span className="flex-1 truncate">{m.name}</span>
                          <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>{m.teamName}</span>
                          {selectedMemberId === m.id && <CheckCircle size={14} style={{ color: ORANGE }} />}
                        </button>
                      ))
                    )}
                  </div>
                </div>
                ) : (
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "rgba(255,255,255,0.6)" }}>
                    Nome Completo
                  </label>
                  <div className="relative">
                    <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "rgba(255,255,255,0.3)" }} />
                    <input
                      type="text"
                      value={studentName}
                      onChange={e => setStudentName(e.target.value)}
                      placeholder="Seu nome completo"
                      required
                      className="w-full pl-10 pr-4 py-3 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 transition-all"
                      style={{
                        backgroundColor: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(255,255,255,0.1)",
                      }}
                    />
                  </div>
                  <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>
                    Monitores e alunos de outras turmas da UNIRIO
                  </p>
                  {/* Código de Convite */}
                  <label className="block text-xs font-medium mt-3 mb-1.5" style={{ color: "rgba(255,255,255,0.6)" }}>
                    Código de Convite
                  </label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "rgba(255,255,255,0.3)" }} />
                    <input
                      type="text"
                      value={inviteCode}
                      onChange={e => setInviteCode(e.target.value.toUpperCase())}
                      placeholder="Ex: FARM2026"
                      required
                      className="w-full pl-10 pr-4 py-3 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 transition-all font-mono tracking-wider"
                      style={{
                        backgroundColor: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(255,255,255,0.1)",
                      }}
                    />
                  </div>
                  <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>
                    Solicite o código ao professor ou coordenador
                  </p>
                </div>
                )}

                {/* Email */}
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "rgba(255,255,255,0.6)" }}>
                    Email Institucional
                  </label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "rgba(255,255,255,0.3)" }} />
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="seu.email@edu.unirio.br"
                      required
                      className="w-full pl-10 pr-4 py-3 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 transition-all"
                      style={{
                        backgroundColor: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(255,255,255,0.1)",
                      }}
                    />
                  </div>
                  {email && !email.endsWith("@edu.unirio.br") && (
                    <p className="text-xs mt-1" style={{ color: "#ef4444" }}>
                      O email deve terminar com @edu.unirio.br
                    </p>
                  )}
                </div>

                {/* Matrícula */}
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "rgba(255,255,255,0.6)" }}>
                    Matrícula
                  </label>
                  <div className="relative">
                    <Hash size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "rgba(255,255,255,0.3)" }} />
                    <input
                      type="text"
                      value={matricula}
                      onChange={e => setMatricula(e.target.value)}
                      placeholder="Sua matrícula (ex: 20261234)"
                      required
                      className="w-full pl-10 pr-4 py-3 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 transition-all"
                      style={{
                        backgroundColor: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(255,255,255,0.1)",
                      }}
                    />
                  </div>
                </div>

                {/* Senha (matrícula) */}
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "rgba(255,255,255,0.6)" }}>
                    Senha (matrícula)
                  </label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "rgba(255,255,255,0.3)" }} />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Sua matrícula será sua senha"
                      required
                      className="w-full pl-10 pr-12 py-3 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 transition-all"
                      style={{
                        backgroundColor: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(255,255,255,0.1)",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                      style={{ color: "rgba(255,255,255,0.3)" }}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>
                    Sua matrícula é sua senha de acesso
                  </p>
                </div>

                {/* Confirmar Senha */}
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "rgba(255,255,255,0.6)" }}>
                    Confirmar Senha
                  </label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "rgba(255,255,255,0.3)" }} />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="Repita a matrícula"
                      required
                      className="w-full pl-10 pr-4 py-3 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 transition-all"
                      style={{
                        backgroundColor: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(255,255,255,0.1)",
                      }}
                    />
                  </div>
                  {confirmPassword && password !== confirmPassword && (
                    <p className="text-xs mt-1" style={{ color: "#ef4444" }}>
                      As senhas não coincidem
                    </p>
                  )}
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 rounded-lg font-semibold text-white flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: ORANGE }}
                >
                  {isSubmitting ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    >
                      <FlaskConical size={18} />
                    </motion.div>
                  ) : (
                    <>
                      Criar Conta
                      <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </motion.form>
            )}
          </AnimatePresence>

          {/* Footer info */}
          <div className="mt-8 text-center">
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
              Farmacologia I — UNIRIO — 2026.1
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
