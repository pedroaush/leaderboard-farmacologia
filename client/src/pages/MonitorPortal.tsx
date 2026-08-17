/**
 * Monitor Portal - Portal dedicado para monitores da disciplina
 * Monitores têm acesso a: Jogo, Turmas, Equipes, Frequências, Recursos, Seminários, Cronograma, Planilha de Notas
 */
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { toast } from "sonner";
import {
  Gamepad2, Users, BookOpen, ClipboardList,
  FolderOpen, Presentation, LogOut, User,
  ChevronRight, Shield, Eye, EyeOff, Loader2,
  GraduationCap, BarChart3, MessageSquare, FileSpreadsheet,
  Calendar, UserPlus, CheckCircle2, AlertCircle, Award
} from "lucide-react";

const MONITOR_SESSION_KEY = "monitor_session_token";

interface MonitorInfo {
  id: number;
  email: string;
  displayName: string | null;
  accountType: string;
  assignedClassId?: number | null;
}

// Monitor feature cards
const MONITOR_FEATURES = [
  {
    icon: <Calendar size={28} />,
    label: "Cronograma",
    description: "Programação das aulas e atividades do semestre",
    href: "/cronograma",
    color: "#a855f7",
    bg: "from-purple-500/20 to-purple-600/10",
  },
  {
    icon: <FileSpreadsheet size={28} />,
    label: "Planilha de Notas",
    description: "Casos Clínicos (automático) e nota do pôster do Seminário da sua turma",
    href: "/monitor/notas",
    color: "#22c55e",
    bg: "from-green-500/20 to-green-600/10",
  },
  {
    icon: <Users size={28} />,
    label: "Turmas",
    description: "Escolher uma turma para ver cronograma e notas",
    href: "/monitor/turmas",
    color: "#6366f1",
    bg: "from-indigo-500/20 to-indigo-600/10",
  },
  {
    icon: <Shield size={28} />,
    label: "Equipes",
    description: "Grupos, integrantes e classificação de Casos Clínicos",
    href: "/monitor/equipes",
    color: "#10b981",
    bg: "from-emerald-500/20 to-emerald-600/10",
  },
  {
    icon: <Presentation size={28} />,
    label: "Seminários",
    description: "Grupos, checklist e nota do pôster do Seminário",
    href: "/monitor/notas",
    color: "#ec4899",
    bg: "from-pink-500/20 to-pink-600/10",
  },
  {
    icon: <ClipboardList size={28} />,
    label: "Frequências",
    description: "Controle de presença e relatórios de frequência",
    href: "/professor/relatorios-presenca",
    color: "#3b82f6",
    bg: "from-blue-500/20 to-blue-600/10",
  },
  {
    icon: <FolderOpen size={28} />,
    label: "Recursos",
    description: "Materiais de estudo, PDFs e playlists",
    href: "/materiais",
    color: "#8b5cf6",
    bg: "from-violet-500/20 to-violet-600/10",
  },
  {
    icon: <BarChart3 size={28} />,
    label: "Leaderboard",
    description: "Quadro geral de pontuação da turma",
    href: "/leaderboard",
    color: "#f97316",
    bg: "from-orange-500/20 to-orange-600/10",
  },
  {
    icon: <MessageSquare size={28} />,
    label: "Chat",
    description: "Comunicação direta com alunos",
    href: "/chat",
    color: "#06b6d4",
    bg: "from-cyan-500/20 to-cyan-600/10",
  },
  {
    icon: <Gamepad2 size={28} />,
    label: "Jogo",
    description: "Acompanhar progresso e pontuações do jogo da turma",
    href: "/jogo",
    color: "#f59e0b",
    bg: "from-amber-500/20 to-amber-600/10",
  },
  {
    icon: <Award size={28} />,
    label: "Meu Certificado",
    description: "Visualizar e baixar seu certificado de monitoria em PDF",
    href: "/monitor/certificado",
    color: "#eab308",
    bg: "from-yellow-500/20 to-yellow-600/10",
  },
];

// ─── Tela de Cadastro ───
function MonitorRegisterForm({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [matricula, setMatricula] = useState("");
  const [assignedClassId, setAssignedClassId] = useState<number | null>(null);
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const { data: classesData, isLoading: loadingClasses } = trpc.monitors.listClassesPublic.useQuery();

  const registerMutation = trpc.monitors.selfRegister.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        setSuccess(true);
        setSuccessMessage(data.message);
      } else {
        toast.error(data.message);
      }
    },
    onError: (err) => toast.error("Erro ao cadastrar: " + err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !displayName || !matricula || !assignedClassId) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    registerMutation.mutate({ email, displayName, matricula, assignedClassId });
  };

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md text-center"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-green-500/10 border border-green-500/20 mb-4">
            <CheckCircle2 size={32} className="text-green-500" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Cadastro realizado!</h2>
          <p className="text-muted-foreground text-sm mb-6">{successMessage}</p>
          <button
            onClick={onBack}
            className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors"
          >
            Voltar ao login
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 mb-4">
            <UserPlus size={32} className="text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground font-display">Cadastro de Monitor</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Conexão em Farmacologia I — UNIRIO
          </p>
        </div>

        {/* Info */}
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 mb-4 flex items-start gap-2">
          <AlertCircle size={16} className="text-amber-500 mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground">
            Sua senha será o seu <strong className="text-foreground">número de matrícula</strong>.
            Após o cadastro, aguarde a <strong className="text-foreground">aprovação do professor</strong> para acessar o portal.
          </p>
        </div>

        {/* Form */}
        <div
          className="rounded-2xl border border-border p-6"
          style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Nome completo <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Seu nome completo"
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-background/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                E-mail institucional <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="monitor@edu.unirio.br"
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-background/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Matrícula <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={matricula}
                onChange={(e) => setMatricula(e.target.value)}
                placeholder="Número de matrícula (será sua senha)"
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-background/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">Este número será usado como sua senha de acesso.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Turma que você monitora <span className="text-red-500">*</span>
              </label>
              {loadingClasses ? (
                <div className="flex items-center gap-2 py-2.5 text-muted-foreground text-sm">
                  <Loader2 size={14} className="animate-spin" /> Carregando turmas...
                </div>
              ) : (
                <select
                  value={assignedClassId ?? ""}
                  onChange={(e) => setAssignedClassId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-3 py-2.5 rounded-lg border border-border bg-background/50 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                >
                  <option value="">Selecione sua turma...</option>
                  {classesData?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}{(c as any).semester ? ` — ${(c as any).semester}` : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <button
              type="submit"
              disabled={registerMutation.isPending}
              className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {registerMutation.isPending ? (
                <><Loader2 size={16} className="animate-spin" /> Cadastrando...</>
              ) : (
                "Solicitar Cadastro"
              )}
            </button>
          </form>

          <div className="mt-4 pt-4 border-t border-border/50 text-center">
            <button
              onClick={onBack}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Voltar ao login
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Tela de Login ───
function MonitorLoginForm({ onLogin }: { onLogin: (token: string, monitor: MonitorInfo) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showRegister, setShowRegister] = useState(false);

  const loginMutation = trpc.monitors.login.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        localStorage.setItem(MONITOR_SESSION_KEY, data.sessionToken);
        onLogin(data.sessionToken, data.monitor as MonitorInfo);
        toast.success("Bem-vindo ao Portal do Monitor!");
      } else {
        toast.error(data.message);
      }
    },
    onError: () => toast.error("Erro ao fazer login"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Preencha todos os campos");
      return;
    }
    loginMutation.mutate({ email, password });
  };

  if (showRegister) {
    return <MonitorRegisterForm onBack={() => setShowRegister(false)} />;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 mb-4">
            <GraduationCap size={32} className="text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground font-display">Portal do Monitor</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Conexão em Farmacologia I — UNIRIO
          </p>
        </div>

        {/* Login Form */}
        <div
          className="rounded-2xl border border-border p-6"
          style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                E-mail institucional
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="monitor@edu.unirio.br"
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-background/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Senha <span className="text-xs text-muted-foreground font-normal">(número de matrícula)</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Número de matrícula"
                  className="w-full px-3 py-2.5 pr-10 rounded-lg border border-border bg-background/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loginMutation.isPending}
              className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loginMutation.isPending ? (
                <><Loader2 size={16} className="animate-spin" /> Entrando...</>
              ) : (
                "Entrar no Portal"
              )}
            </button>
          </form>

          <div className="mt-4 pt-4 border-t border-border/50 space-y-2 text-center">
            <p className="text-xs text-muted-foreground">
              Primeiro acesso?{" "}
              <button
                onClick={() => setShowRegister(true)}
                className="text-primary hover:underline font-medium"
              >
                Cadastre-se aqui
              </button>
            </p>
            <p className="text-xs text-muted-foreground">
              Problemas de acesso?{" "}
              <Link href="/professor/login" className="text-primary hover:underline">
                Fale com o professor
              </Link>
            </p>
          </div>
        </div>

        <div className="mt-4 text-center">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← Voltar ao início
          </Link>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Dashboard do Monitor ───
function MonitorDashboard({ monitor, sessionToken, onLogout }: {
  monitor: MonitorInfo;
  sessionToken: string;
  onLogout: () => void;
}) {
  const logActionMutation = trpc.monitors.logAction.useMutation();

  // Buscar nome da turma vinculada
  const { data: classesData } = trpc.monitors.listClasses.useQuery(
    { monitorSessionToken: sessionToken },
    { enabled: !!sessionToken }
  );
  // Só considera "minha turma" quando há exatamente 1 — é o caso de um
  // monitor de verdade, vinculado a uma turma só. Quando são várias (admin
  // ou professor, que agora tem acesso a todas), não faz sentido escolher
  // uma ao acaso — os cards levam pra tela de Turmas em vez disso.
  const assignedClass = classesData?.length === 1 ? classesData[0] : undefined;
  const hasMultipleClasses = (classesData?.length ?? 0) > 1;

  const logoutMutation = trpc.monitors.logout.useMutation({
    onSuccess: () => {
      logActionMutation.mutate({
        monitorSessionToken: sessionToken,
        actionType: "logout",
        actionDescription: "Sessão encerrada no portal do monitor",
      });
      localStorage.removeItem(MONITOR_SESSION_KEY);
      onLogout();
      toast.success("Sessão encerrada");
    },
  });

  const displayName = monitor.displayName || monitor.email.split("@")[0];
  const initials = displayName
    .split(" ")
    .slice(0, 2)
    .map((n: string) => n[0])
    .join("")
    .toUpperCase();

  // Ajustar href para filtrar pela turma do monitor
  const featuresWithClass = MONITOR_FEATURES.map((f) => {
    if (f.href === "/cronograma") {
      if (assignedClass?.id) return { ...f, href: `/cronograma?classId=${assignedClass.id}` };
      // Sem turma única: leva pra Turmas, que já lista todas com botão de
      // cronograma completo de cada uma — confirmado que é esse o comportamento certo.
      return { ...f, href: "/monitor/turmas", description: "Ver o cronograma de cada turma" };
    }
    if (f.href === "/monitor/notas" && assignedClass?.id) {
      // Com 1 turma só, já manda direto pra ela. Com várias, deixa o link
      // puro (/monitor/notas) — essa página já tem seu próprio seletor de
      // turma embutido, não precisa passar por Turmas.
      return { ...f, href: `/monitor/notas?classId=${assignedClass.id}` };
    }
    if (f.href === "/jogo") {
      if (assignedClass?.id) return { ...f, href: `/jogo/${assignedClass.id}` };
      if (hasMultipleClasses) return { ...f, href: "/monitor/turmas", description: "Escolher a turma para ver o jogo dela" };
    }
    return f;
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div
        className="border-b border-border px-4 py-3 flex items-center justify-between"
        style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
            <span className="text-xs font-bold text-primary">{initials}</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{displayName}</p>
            <p className="text-xs text-muted-foreground">
              Monitor{assignedClass ? ` · ${assignedClass.name}` : " · Farmacologia I"}
            </p>
          </div>
        </div>

        <button
          onClick={() => logoutMutation.mutate({ sessionToken })}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <LogOut size={15} />
          Sair
        </button>
      </div>

      {/* Content */}
      <div className="container max-w-4xl py-8">
        {/* Welcome */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <h1 className="text-2xl font-bold text-foreground font-display">
            Olá, {displayName.split(" ")[0]}! 👋
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Bem-vindo ao painel de monitoria da Conexão em Farmacologia I.
          </p>
        </motion.div>

        {/* Turma vinculada */}
        {assignedClass && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-6 rounded-xl border border-primary/20 p-4 flex items-center gap-3"
            style={{ backgroundColor: "oklch(0.696 0.17 162.48 / 0.06)" }}
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Users size={20} className="text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Sua turma: {assignedClass.name}</p>
              <p className="text-xs text-muted-foreground">
                {(assignedClass as { semester?: string }).semester
                  ? `Semestre: ${(assignedClass as { semester?: string }).semester}`
                  : "Você tem acesso completo às informações desta turma."}
              </p>
            </div>
          </motion.div>
        )}

        {/* Feature Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {featuresWithClass.map((feature, idx) => (
            <motion.div
              key={feature.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              whileHover={{ scale: 1.04, y: -2 }}
              whileTap={{ scale: 0.97 }}
            >
              <Link
                href={feature.href}
                onClick={() => {
                  logActionMutation.mutate({
                    monitorSessionToken: sessionToken,
                    actionType: "navigation",
                    actionDescription: `Acessou o módulo: ${feature.label}`,
                    targetEntity: feature.label,
                    metadata: JSON.stringify({ href: feature.href }),
                  });
                }}
              >
                <div
                  className={`rounded-xl border border-border/50 p-4 cursor-pointer bg-gradient-to-br ${feature.bg} hover:border-primary/30 transition-all`}
                  style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
                    style={{ color: feature.color, backgroundColor: feature.color + "22" }}
                  >
                    {feature.icon}
                  </div>
                  <p className="font-semibold text-sm text-foreground">{feature.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-tight">
                    {feature.description}
                  </p>
                  <div className="flex items-center gap-1 mt-2">
                    <span className="text-xs" style={{ color: feature.color }}>Acessar</span>
                    <ChevronRight size={12} style={{ color: feature.color }} />
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Info card */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-6 rounded-xl border border-border/30 p-4 flex items-start gap-3"
          style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}
        >
          <User size={18} className="text-muted-foreground mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-foreground">Acesso de Monitor</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Você tem acesso às funcionalidades da disciplina para a sua turma.
              A planilha de notas está restrita à sua turma vinculada.
              Para ações administrativas, entre em contato com o professor.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default function MonitorPortal() {
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [monitor, setMonitor] = useState<MonitorInfo | null>(null);
  const [loading, setLoading] = useState(true);

  // Check for existing session on mount — primeiro tenta sessão de monitor
  // de verdade; se não tiver, tenta o token de professor/admin (já logado
  // no resto da plataforma), que o back-end agora também aceita. Assim o
  // admin/professor não esbarra na tela de login do monitor.
  useEffect(() => {
    const monitorToken = localStorage.getItem(MONITOR_SESSION_KEY);
    if (monitorToken) {
      setSessionToken(monitorToken);
      return;
    }
    const teacherToken = localStorage.getItem("teacherSessionToken");
    if (teacherToken) {
      setSessionToken(teacherToken);
      return;
    }
    setLoading(false);
  }, []);

  // Validate session token
  const { data: monitorData, isLoading: isValidating, isError: isValidationError } = trpc.monitors.me.useQuery(
    { sessionToken: sessionToken ?? "" },
    { enabled: !!sessionToken }
  );

  // Handle validation result
  useEffect(() => {
    if (!sessionToken) return;
    if (isValidating) return;
    if (isValidationError || !monitorData) {
      localStorage.removeItem(MONITOR_SESSION_KEY);
      setSessionToken(null);
      setLoading(false);
      return;
    }
    setMonitor(monitorData as MonitorInfo);
    setLoading(false);
  }, [monitorData, isValidating, isValidationError, sessionToken]);

  const handleLogin = (token: string, monitorInfo: MonitorInfo) => {
    setSessionToken(token);
    setMonitor(monitorInfo);
  };

  const handleLogout = () => {
    setSessionToken(null);
    setMonitor(null);
  };

  if (loading || isValidating) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!sessionToken || !monitor) {
    return <MonitorLoginForm onLogin={handleLogin} />;
  }

  return (
    <MonitorDashboard
      monitor={monitor}
      sessionToken={sessionToken}
      onLogout={handleLogout}
    />
  );
}