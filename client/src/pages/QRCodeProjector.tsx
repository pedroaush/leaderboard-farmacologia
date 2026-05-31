/**
 * QR Code Projector — Conexão em Farmacologia
 * Full-screen QR Code display for classroom TV projection
 * Features: rotating token (10 min), countdown, auto-refresh, live check-in count
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  QrCode, Users, Clock, CheckCircle, Maximize, Minimize,
  RefreshCw, ArrowLeft, Wifi, FlaskConical, X, Shield, Timer, AlertTriangle
} from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import QRCode from "qrcode";

const LOGO_URL = "https://files.manuscdn.com/user_upload_by_module/session_file/310419663028318382/TYglakFwBNwpBXzT.png";
const ORANGE = "#F7941D";
const DARK_BG = "#0A1628";
const CARD_BG = "#0D1B2A";
const EMERALD = "#10B981";
const RED = "#EF4444";

interface QRSession {
  id: number;
  classId: number;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
  qrCodeData: any;
  currentToken?: string | null;
  tokenExpiresAt?: string | null;
  tokenRotationCount?: number;
}

export default function QRCodeProjector() {
  const [, setLocation] = useLocation();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedClassId] = useState(1);
  const [activeSession, setActiveSession] = useState<QRSession | null>(null);
  const [activeSessionDbId, setActiveSessionDbId] = useState<number | null>(null);
  const [activeWeekNumber, setActiveWeekNumber] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showSetup, setShowSetup] = useState(true);
  const [tokenCountdown, setTokenCountdown] = useState(0); // seconds remaining
  const [isTokenExpired, setIsTokenExpired] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Feedback visual: aluno recém chegado
  const [newCheckInAlert, setNewCheckInAlert] = useState<{ name: string; id: number } | null>(null);
  const prevCheckInCountRef = useRef<number>(0);
  const alertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check teacher auth
  const teacherToken = localStorage.getItem("teacherSessionToken");

  // Get existing sessions
  const { data: sessions, refetch: refetchSessions } = trpc.qrcode.getSessionsByClass.useQuery(
    { classId: selectedClassId },
    { enabled: !!teacherToken }
  );

  // Get live check-in count
  const { data: checkInData } = trpc.qrcode.getSessionCheckInCount.useQuery(
    { sessionId: activeSessionDbId || 0 },
    {
      enabled: !!activeSessionDbId,
      refetchInterval: 5000, // Poll every 5 seconds
    }
  );

  // Get recent check-ins for visual feedback
  const { data: recentCheckInsData } = trpc.qrcode.getRecentCheckIns.useQuery(
    { sessionId: activeSessionDbId || 0, limit: 5 },
    {
      enabled: !!activeSessionDbId,
      refetchInterval: 3000, // Poll every 3 seconds for faster feedback
    }
  );

  // Detect new check-in and show alert
  useEffect(() => {
    const currentCount = recentCheckInsData?.count || 0;
    if (currentCount > prevCheckInCountRef.current && recentCheckInsData?.recent?.length) {
      const newest = recentCheckInsData.recent[0];
      setNewCheckInAlert({ name: newest.name, id: newest.id });
      // Play a subtle beep sound
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        osc.type = "sine";
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.4);
      } catch (_) {}
      // Clear alert after 3 seconds
      if (alertTimerRef.current) clearTimeout(alertTimerRef.current);
      alertTimerRef.current = setTimeout(() => setNewCheckInAlert(null), 3000);
    }
    prevCheckInCountRef.current = currentCount;
  }, [recentCheckInsData]);

  // Cleanup alert timer
  useEffect(() => {
    return () => {
      if (alertTimerRef.current) clearTimeout(alertTimerRef.current);
    };
  }, []);

  // Create session mutation
  const createSessionMutation = trpc.qrcode.createSession.useMutation({
    onSuccess: async (data) => {
      const dbId = data.sessionId;
      setActiveSessionDbId(dbId);
      if (data.weekNumber) setActiveWeekNumber(data.weekNumber);
      if (data.token) {
        await generateQRImage(dbId, data.token);
        startCountdown(data.tokenExpiresAt);
      }
      refetchSessions();
      setShowSetup(false);
    },
  });

  // Rotate token mutation
  const rotateTokenMutation = trpc.qrcode.rotateToken.useMutation({
    onSuccess: async (data) => {
      if (activeSessionDbId && data.token) {
        await generateQRImage(activeSessionDbId, data.token);
        startCountdown(data.tokenExpiresAt);
        setIsTokenExpired(false);
      }
      setIsRotating(false);
    },
    onError: () => {
      setIsRotating(false);
    },
  });

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Generate QR Code image with token embedded in URL
  const generateQRImage = useCallback(async (sessionDbId: number, token: string) => {
    try {
      const checkInUrl = `${window.location.origin}/attendance/check-in?sid=${sessionDbId}&c=${selectedClassId}&t=${token}`;
      const dataUrl = await QRCode.toDataURL(checkInUrl, {
        width: 600,
        margin: 2,
        color: {
          dark: "#0A1628",
          light: "#FFFFFF",
        },
        errorCorrectionLevel: "H",
      });
      setQrCodeDataUrl(dataUrl);
    } catch (err) {
      console.error("Error generating QR code:", err);
    }
  }, [selectedClassId]);

  // Start countdown timer
  const startCountdown = useCallback((expiresAtStr: string) => {
    // Clear existing countdown
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
    }

    const expiresAt = new Date(expiresAtStr).getTime();

    const updateCountdown = () => {
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
      setTokenCountdown(remaining);

      if (remaining <= 0) {
        setIsTokenExpired(true);
        if (countdownRef.current) {
          clearInterval(countdownRef.current);
          countdownRef.current = null;
        }
      }
    };

    updateCountdown();
    countdownRef.current = setInterval(updateCountdown, 1000);
  }, []);

  // Auto-rotate token when expired
  useEffect(() => {
    if (isTokenExpired && activeSessionDbId && !isRotating) {
      handleRotateToken();
    }
  }, [isTokenExpired, activeSessionDbId]);

  // Cleanup countdown on unmount
  useEffect(() => {
    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, []);

  // Auto-select active session on load
  useEffect(() => {
    if (sessions && sessions.length > 0) {
      const active = sessions.find((s: QRSession) => s.isActive);
      if (active && !activeSessionDbId) {
        setActiveSession(active);
        setActiveSessionDbId(active.id);
        if ((active as any).weekNumber) setActiveWeekNumber((active as any).weekNumber);
        if (active.currentToken && active.tokenExpiresAt) {
          generateQRImage(active.id, active.currentToken);
          startCountdown(active.tokenExpiresAt);
          setShowSetup(false);
        }
      }
    }
  }, [sessions, generateQRImage, startCountdown, activeSessionDbId]);

  // Create new session for today
  const handleCreateSession = async () => {
    setIsCreating(true);
    try {
      const now = new Date();
      await createSessionMutation.mutateAsync({
        classId: selectedClassId,
        dayOfWeek: now.getDay(),
        startTime: "08:00",
        endTime: "22:00",
      });
    } catch (err) {
      console.error("Error creating session:", err);
    } finally {
      setIsCreating(false);
    }
  };

  // Rotate token manually or automatically
  const handleRotateToken = async () => {
    if (!activeSessionDbId || isRotating) return;
    setIsRotating(true);
    try {
      await rotateTokenMutation.mutateAsync({ sessionId: activeSessionDbId });
    } catch (err) {
      console.error("Error rotating token:", err);
      setIsRotating(false);
    }
  };

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Listen for fullscreen changes
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // Format time
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  };

  // Format countdown
  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  // Countdown color based on remaining time
  const getCountdownColor = () => {
    if (tokenCountdown <= 0) return RED;
    if (tokenCountdown <= 60) return RED;
    if (tokenCountdown <= 120) return ORANGE;
    return EMERALD;
  };

  const DAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

  const checkedInCount = checkInData?.count || 0;

  // If not authenticated, redirect
  if (!teacherToken) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: DARK_BG }}>
        <div className="text-center">
          <QrCode size={48} style={{ color: ORANGE }} className="mx-auto mb-4" />
          <p className="text-white text-lg mb-4">Faça login como professor para acessar</p>
          <button
            onClick={() => setLocation("/professor/login")}
            className="px-6 py-3 rounded-xl font-semibold text-white"
            style={{ backgroundColor: ORANGE }}
          >
            Ir para Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: DARK_BG }}
    >
      {/* Top Bar */}
      <div
        className="flex items-center justify-between px-4 py-3 2xl:px-8 2xl:py-5 border-b"
        style={{ borderColor: "rgba(255,255,255,0.08)", backgroundColor: CARD_BG }}
      >
        <div className="flex items-center gap-3 2xl:gap-5">
          <button
            onClick={() => setLocation("/admin")}
            className="flex items-center gap-2 text-sm 2xl:text-lg transition-colors"
            style={{ color: "rgba(255,255,255,0.5)" }}
          >
            <ArrowLeft size={16} className="2xl:w-5 2xl:h-5" />
            Voltar
          </button>
          <div className="h-5 w-px" style={{ backgroundColor: "rgba(255,255,255,0.1)" }} />
          <div className="flex items-center gap-2 2xl:gap-3">
            <img src={LOGO_URL} alt="Logo" className="w-7 h-7 2xl:w-10 2xl:h-10 object-contain" />
            <span className="text-sm 2xl:text-xl font-semibold text-white" style={{ fontFamily: "'Outfit', sans-serif" }}>
              QR Code Presença
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 2xl:gap-5">
          {/* Token countdown */}
          {!showSetup && (
            <div
              className="flex items-center gap-2 2xl:gap-3 px-3 py-1.5 2xl:px-5 2xl:py-2.5 rounded-lg"
              style={{ backgroundColor: `${getCountdownColor()}15` }}
            >
              <Timer size={16} className="2xl:w-5 2xl:h-5" style={{ color: getCountdownColor() }} />
              <span className="font-mono text-sm 2xl:text-xl font-semibold" style={{ color: getCountdownColor() }}>
                {isTokenExpired ? "Renovando..." : formatCountdown(tokenCountdown)}
              </span>
            </div>
          )}

          {/* Live clock */}
          <div className="flex items-center gap-2 2xl:gap-3">
            <Clock size={16} className="2xl:w-5 2xl:h-5" style={{ color: ORANGE }} />
            <span className="font-mono text-sm 2xl:text-xl text-white">{formatTime(currentTime)}</span>
          </div>

          {/* Checked in count */}
          <div className="flex items-center gap-2 2xl:gap-3 px-3 py-1.5 2xl:px-5 2xl:py-2.5 rounded-lg" style={{ backgroundColor: "rgba(16,185,129,0.15)" }}>
            <Users size={16} className="2xl:w-5 2xl:h-5" style={{ color: EMERALD }} />
            <span className="font-mono text-sm 2xl:text-xl font-semibold" style={{ color: EMERALD }}>
              {checkedInCount} presentes
            </span>
          </div>

          {/* Fullscreen toggle */}
          <button
            onClick={toggleFullscreen}
            className="p-2 2xl:p-3 rounded-lg transition-colors"
            style={{ backgroundColor: "rgba(255,255,255,0.06)" }}
          >
            {isFullscreen ? (
              <Minimize size={18} className="2xl:w-6 2xl:h-6 text-white" />
            ) : (
              <Maximize size={18} className="2xl:w-6 2xl:h-6 text-white" />
            )}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-6 2xl:p-12">
        <AnimatePresence mode="wait">
          {showSetup ? (
            /* Setup View - Create or select session */
            <motion.div
              key="setup"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg 2xl:max-w-2xl"
            >
              <div className="text-center mb-8 2xl:mb-12">
                <div className="w-20 h-20 2xl:w-28 2xl:h-28 rounded-2xl mx-auto mb-4 2xl:mb-6 flex items-center justify-center" style={{ backgroundColor: "rgba(247,148,29,0.15)" }}>
                  <QrCode size={40} className="2xl:w-14 2xl:h-14" style={{ color: ORANGE }} />
                </div>
                <h1 className="text-2xl 2xl:text-4xl font-bold text-white mb-2 2xl:mb-3" style={{ fontFamily: "'Outfit', sans-serif" }}>
                  Projetor de QR Code
                </h1>
                <p className="text-sm 2xl:text-xl" style={{ color: "rgba(255,255,255,0.5)" }}>
                  {formatDate(currentTime)}
                </p>
                <div className="mt-3 flex items-center justify-center gap-2">
                  <Shield size={14} style={{ color: EMERALD }} />
                  <span className="text-xs 2xl:text-sm" style={{ color: EMERALD }}>
                    Token rotativo a cada 10 minutos (anti-fraude)
                  </span>
                </div>
              </div>

              {/* Aviso: sessão ativa é de uma data anterior */}
              {sessions && sessions.filter((s: QRSession) => s.isActive).some((s: QRSession) => {
                const created = s.qrCodeData?.timestamp ? new Date(s.qrCodeData.timestamp) : null;
                if (!created) return false;
                const today = new Date();
                return created.toDateString() !== today.toDateString();
              }) && (
                <div className="mb-4 p-4 rounded-xl flex items-start gap-3" style={{ backgroundColor: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)" }}>
                  <AlertTriangle size={18} style={{ color: RED, flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <p className="text-sm font-semibold" style={{ color: RED }}>Sessão de aula anterior ainda ativa</p>
                    <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>Alunos que já registraram presença nessa sessão não conseguirão registrar novamente. Crie uma nova sessão para a aula de hoje.</p>
                  </div>
                </div>
              )}

              {/* Existing sessions */}
              {sessions && sessions.filter((s: QRSession) => s.isActive).length > 0 && (
                <div className="mb-6 2xl:mb-8">
                  <p className="text-xs 2xl:text-base uppercase tracking-wider mb-3 2xl:mb-4" style={{ color: "rgba(255,255,255,0.4)" }}>
                    Sessões ativas
                  </p>
                  <div className="space-y-2 2xl:space-y-3">
                    {sessions.filter((s: QRSession) => s.isActive).map((session: QRSession) => (
                      <button
                        key={session.id}
                        onClick={() => {
                          setActiveSession(session);
                          setActiveSessionDbId(session.id);
                          if (session.currentToken && session.tokenExpiresAt) {
                            generateQRImage(session.id, session.currentToken);
                            startCountdown(session.tokenExpiresAt);
                          }
                          setShowSetup(false);
                        }}
                        className="w-full p-4 2xl:p-6 rounded-xl text-left transition-all hover:scale-[1.01]"
                        style={{ backgroundColor: CARD_BG, border: "1px solid rgba(255,255,255,0.08)" }}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-white font-semibold 2xl:text-xl">
                              {DAYS[session.dayOfWeek]}
                            </span>
                            <span className="text-sm 2xl:text-lg ml-3" style={{ color: "rgba(255,255,255,0.4)" }}>
                              {session.startTime} — {session.endTime}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 2xl:w-3 2xl:h-3 rounded-full bg-green-400 animate-pulse" />
                            <span className="text-xs 2xl:text-sm" style={{ color: EMERALD }}>Ativa</span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Create new session */}
              <button
                onClick={handleCreateSession}
                disabled={isCreating}
                className="w-full py-4 2xl:py-6 rounded-xl font-semibold text-white flex items-center justify-center gap-3 transition-all hover:opacity-90 disabled:opacity-50 2xl:text-xl"
                style={{ backgroundColor: ORANGE }}
              >
                {isCreating ? (
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                    <RefreshCw size={20} className="2xl:w-7 2xl:h-7" />
                  </motion.div>
                ) : (
                  <>
                    <QrCode size={20} className="2xl:w-7 2xl:h-7" />
                    Criar Nova Sessão de Presença
                  </>
                )}
              </button>
            </motion.div>
          ) : (
            /* QR Code Display View - Optimized for TV projection */
            <motion.div
              key="display"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full flex flex-col items-center"
            >
              {/* Title */}
              <div className="text-center mb-4 2xl:mb-8">
                <h1 className="text-2xl sm:text-3xl 2xl:text-6xl font-bold text-white mb-2 2xl:mb-4" style={{ fontFamily: "'Outfit', sans-serif" }}>
                  Escaneie para registrar presença
                </h1>
                <p className="text-sm sm:text-base 2xl:text-2xl" style={{ color: "rgba(255,255,255,0.5)" }}>
                  Aponte a câmera do celular para o QR Code abaixo
                </p>
              </div>

              {/* QR Code Container with countdown ring */}
              <div className="relative">
                {/* Glow effect */}
                <div
                  className="absolute inset-0 blur-3xl opacity-20 rounded-3xl"
                  style={{ backgroundColor: isTokenExpired ? RED : ORANGE }}
                />

                {/* QR Code */}
                <motion.div
                  className="relative p-6 2xl:p-10 rounded-3xl"
                  style={{ backgroundColor: "white" }}
                  animate={{
                    boxShadow: isTokenExpired
                      ? ["0 0 30px rgba(239,68,68,0.3)", "0 0 60px rgba(239,68,68,0.5)", "0 0 30px rgba(239,68,68,0.3)"]
                      : ["0 0 30px rgba(247,148,29,0.2)", "0 0 60px rgba(247,148,29,0.3)", "0 0 30px rgba(247,148,29,0.2)"],
                  }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                >
                  {qrCodeDataUrl ? (
                    <img
                      src={qrCodeDataUrl}
                      alt="QR Code de Presença"
                      className="w-56 h-56 sm:w-64 sm:h-64 md:w-72 md:h-72 lg:w-80 lg:h-80 2xl:w-[440px] 2xl:h-[440px]"
                    />
                  ) : (
                    <div className="w-56 h-56 sm:w-64 sm:h-64 md:w-72 md:h-72 lg:w-80 lg:h-80 2xl:w-[440px] 2xl:h-[440px] flex items-center justify-center">
                      <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}>
                        <FlaskConical size={48} style={{ color: ORANGE }} />
                      </motion.div>
                    </div>
                  )}
                </motion.div>
              </div>

              {/* Token countdown bar */}
              <div className="mt-4 2xl:mt-8 w-64 sm:w-72 md:w-80 lg:w-96 2xl:w-[500px]">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <Shield size={12} className="2xl:w-4 2xl:h-4" style={{ color: getCountdownColor() }} />
                    <span className="text-[10px] 2xl:text-sm uppercase tracking-wider" style={{ color: getCountdownColor() }}>
                      {isTokenExpired ? "Renovando token..." : "Token válido"}
                    </span>
                  </div>
                  <span className="font-mono text-xs 2xl:text-base font-bold" style={{ color: getCountdownColor() }}>
                    {isTokenExpired ? "00:00" : formatCountdown(tokenCountdown)}
                  </span>
                </div>
                <div className="h-1.5 2xl:h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: getCountdownColor() }}
                    animate={{
                      width: `${Math.min(100, (tokenCountdown / (10 * 60)) * 100)}%`,
                    }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </div>

              {/* Session info */}
              <div className="mt-4 2xl:mt-8 flex items-center gap-4 sm:gap-6 2xl:gap-10 flex-wrap justify-center">
                {activeWeekNumber && (
                  <div className="flex items-center gap-2 2xl:gap-3 px-3 py-1 rounded-full" style={{ backgroundColor: "rgba(247,148,29,0.15)", border: "1px solid rgba(247,148,29,0.3)" }}>
                    <span className="text-sm 2xl:text-xl font-bold" style={{ color: ORANGE }}>
                      Semana {activeWeekNumber}/17
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2 2xl:gap-3">
                  <Clock size={16} className="2xl:w-5 2xl:h-5" style={{ color: ORANGE }} />
                  <span className="text-sm 2xl:text-xl text-white">
                    {activeSession?.startTime} — {activeSession?.endTime}
                  </span>
                </div>
                <div className="flex items-center gap-2 2xl:gap-3">
                  <div className="w-2 h-2 2xl:w-3 2xl:h-3 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-sm 2xl:text-xl" style={{ color: EMERALD }}>
                    Sessão ativa
                  </span>
                </div>
                <div className="flex items-center gap-2 2xl:gap-3">
                  <Users size={16} className="2xl:w-5 2xl:h-5" style={{ color: EMERALD }} />
                  <span className="text-sm 2xl:text-xl font-semibold" style={{ color: EMERALD }}>
                    {checkedInCount} check-ins
                  </span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="mt-5 2xl:mt-8 flex items-center gap-3 2xl:gap-5">
                <button
                  onClick={() => {
                    setShowSetup(true);
                    if (countdownRef.current) {
                      clearInterval(countdownRef.current);
                    }
                  }}
                  className="px-4 py-2 2xl:px-6 2xl:py-3 rounded-lg text-sm 2xl:text-lg font-medium transition-colors"
                  style={{ color: "rgba(255,255,255,0.5)", backgroundColor: "rgba(255,255,255,0.06)" }}
                >
                  <X size={16} className="2xl:w-5 2xl:h-5 inline mr-2" />
                  Voltar
                </button>
                <button
                  onClick={handleRotateToken}
                  disabled={isRotating}
                  className="px-4 py-2 2xl:px-6 2xl:py-3 rounded-lg text-sm 2xl:text-lg font-medium transition-colors disabled:opacity-50"
                  style={{ color: ORANGE, backgroundColor: "rgba(247,148,29,0.1)" }}
                >
                  {isRotating ? (
                    <motion.span className="inline-flex items-center gap-2" animate={{ opacity: [1, 0.5, 1] }} transition={{ duration: 1, repeat: Infinity }}>
                      <RefreshCw size={16} className="2xl:w-5 2xl:h-5 animate-spin" />
                      Renovando...
                    </motion.span>
                  ) : (
                    <>
                      <RefreshCw size={16} className="2xl:w-5 2xl:h-5 inline mr-2" />
                      Renovar QR Agora
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Check-in alert popup */}
      <AnimatePresence>
        {newCheckInAlert && (
          <motion.div
            key={newCheckInAlert.id}
            initial={{ opacity: 0, y: 40, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="fixed bottom-20 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl"
            style={{ backgroundColor: "rgba(16,185,129,0.95)", border: "2px solid #10B981" }}
          >
            <CheckCircle size={22} className="text-white shrink-0" />
            <div>
              <p className="text-white font-bold text-sm 2xl:text-base leading-tight">Presença registrada!</p>
              <p className="text-green-100 text-xs 2xl:text-sm truncate max-w-xs">{newCheckInAlert.name}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recent check-ins list (shown during active session) */}
      {!showSetup && recentCheckInsData?.recent && recentCheckInsData.recent.length > 0 && (
        <div
          className="px-4 pb-2 2xl:px-8"
          style={{ backgroundColor: CARD_BG }}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <CheckCircle size={13} style={{ color: EMERALD }} />
            <span className="text-xs 2xl:text-sm font-medium" style={{ color: EMERALD }}>Últimas presenças</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {recentCheckInsData.recent.map((ci: { id: number; name: string }) => (
              <span
                key={ci.id}
                className="px-2 py-0.5 rounded-full text-xs 2xl:text-sm"
                style={{ backgroundColor: "rgba(16,185,129,0.12)", color: EMERALD, border: "1px solid rgba(16,185,129,0.3)" }}
              >
                {ci.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Bottom bar - branding */}
      <div
        className="px-4 py-3 2xl:px-8 2xl:py-5 border-t flex items-center justify-between"
        style={{ borderColor: "rgba(255,255,255,0.06)", backgroundColor: CARD_BG }}
      >
        <div className="flex items-center gap-2 2xl:gap-3">
          <img src={LOGO_URL} alt="Logo" className="w-6 h-6 2xl:w-8 2xl:h-8 object-contain" />
          <span className="text-xs 2xl:text-base" style={{ color: "rgba(255,255,255,0.3)" }}>
            Conexão em Farmacologia — UNIRIO
          </span>
        </div>
        <div className="flex items-center gap-2 2xl:gap-3">
          <Wifi size={14} className="2xl:w-5 2xl:h-5" style={{ color: EMERALD }} />
          <span className="text-xs 2xl:text-base" style={{ color: "rgba(255,255,255,0.3)" }}>
            {formatDate(currentTime)}
          </span>
        </div>
      </div>
    </div>
  );
}
