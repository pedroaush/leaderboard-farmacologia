/**
 * Attendance Check-In — Conexão em Farmacologia
 * Student scans QR Code projected by teacher to register attendance
 * Supports: camera scan, URL params (from QR link), manual entry
 * GPS validation: student must be within allowed radius of classroom
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  QrCode, Camera, CheckCircle, XCircle, AlertCircle,
  ArrowLeft, FlaskConical, Scan, Hash, LogOut, MapPin, Navigation
} from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useStudentAuth, clearStudentSession } from "./StudentLogin";
import jsQR from "jsqr";

const LOGO_URL = "https://files.manuscdn.com/user_upload_by_module/session_file/310419663028318382/TYglakFwBNwpBXzT.png";
const ORANGE = "#F7941D";
const DARK_BG = "#0A1628";
const CARD_BG = "#0D1B2A";

// ═══════ GPS HELPER ═══════
function getStudentLocation(): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocalização não suportada pelo navegador."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            reject(new Error("Permissão de localização negada. Ative a localização nas configurações do navegador para registrar presença."));
            break;
          case error.POSITION_UNAVAILABLE:
            reject(new Error("Localização indisponível. Verifique se o GPS está ativado."));
            break;
          case error.TIMEOUT:
            reject(new Error("Tempo esgotado ao obter localização. Tente novamente."));
            break;
          default:
            reject(new Error("Erro ao obter localização."));
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 30000,
      }
    );
  });
}

export default function AttendanceCheckIn() {
  const [, setLocation] = useLocation();
  const { student, isAuthenticated, isLoading, sessionToken } = useStudentAuth();

  const [mode, setMode] = useState<"scan" | "manual">("scan");
  const [sessionId, setSessionId] = useState<string>("");
  const [classId, setClassId] = useState<string>("");
  const [token, setToken] = useState<string>("");
  const [scanning, setScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState<"idle" | "scanning" | "found" | "error">("idle");
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<"idle" | "acquiring" | "acquired" | "error">("idle");
  const [gpsCoords, setGpsCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [showManualRequest, setShowManualRequest] = useState(false);
  const [manualRequestSent, setManualRequestSent] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Parse URL params (from QR code link)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const s = params.get("s") || params.get("sid"); // sessionId
    const c = params.get("c"); // classId
    const t = params.get("t"); // token
    if (s) setSessionId(s);
    if (c) setClassId(c);
    if (t) setToken(t);
    // If all params present, auto-submit with GPS
    if (s && c && t && student) {
      handleAutoCheckIn(s, c, t);
    }
  }, [student]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      // Save return URL
      const returnUrl = window.location.pathname + window.location.search;
      localStorage.setItem("attendance_return_url", returnUrl);
      setLocation("/login-aluno");
    }
  }, [isLoading, isAuthenticated, setLocation]);

  // Check-in mutation
  const requestManualMutation = trpc.qrcode.requestManualAttendance.useMutation({
    onSuccess: () => {
      setManualRequestSent(true);
      setShowManualRequest(false);
    },
    onError: (error) => {
      alert(error.message || "Erro ao enviar solicitação");
    },
  });

  const checkInMutation = trpc.qrcode.checkIn.useMutation({
    onSuccess: (data) => {
      setResult({
        success: true,
        message: data.message || "Presença registrada com sucesso!",
      });
      stopCamera();
    },
    onError: (error) => {
      setResult({
        success: false,
        message: error.message || "Erro ao registrar presença",
      });
    },
  });

  // Acquire GPS and then check in
  const performCheckInWithGPS = async (sid: string, cid: string, tkn: string) => {
    setIsSubmitting(true);
    setGpsStatus("acquiring");

    // Tentar obter GPS, mas continuar sem ele se permissão negada
    let coords: { latitude: number; longitude: number } | null = null;
    try {
      coords = await getStudentLocation();
      setGpsCoords(coords);
      setGpsStatus("acquired");
    } catch (_gpsErr) {
      // GPS negado ou indisponível — continuar sem GPS
      setGpsStatus("error");
    }

    try {
      // Enviar check-in com ou sem GPS
      await checkInMutation.mutateAsync({
        sessionId: parseInt(sid),
        memberId: student?.memberId || 0,
        classId: parseInt(cid),
        token: tkn,
        latitude: coords?.latitude,
        longitude: coords?.longitude,
      });
    } catch (error: any) {
      if (error?.message && !checkInMutation.isError) {
        setResult({
          success: false,
          message: error.message,
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Auto check-in from URL params
  const handleAutoCheckIn = async (sid: string, cid: string, tkn?: string) => {
    if (!student) return;
    const tokenToUse = tkn || token;
    if (!tokenToUse) {
      setResult({ success: false, message: "Token de presença não encontrado. Escaneie o QR Code novamente." });
      return;
    }
    await performCheckInWithGPS(sid, cid, tokenToUse);
  };

  // Start camera
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 640 } },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setScanning(true);
        setScanStatus("scanning");
      }
    } catch {
      setScanStatus("error");
    }
  };

  // Stop camera
  const stopCamera = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    setScanning(false);
  }, []);

  // Scan QR code from video frame
  const scanFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx || video.videoWidth === 0) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height);

    if (code && code.data) {
      try {
        // Try parsing as URL first (from our QR projector)
        const url = new URL(code.data);
        const sid = url.searchParams.get("s") || url.searchParams.get("sid");
        const cid = url.searchParams.get("c");
        const tkn = url.searchParams.get("t");
        if (sid && cid) {
          setScanStatus("found");
          setSessionId(sid);
          setClassId(cid);
          if (tkn) setToken(tkn);
          stopCamera();
          // Auto-submit with GPS
          if (student) {
            performCheckInWithGPS(sid, cid, tkn || token);
          }
          return;
        }
      } catch {
        // Not a URL, try JSON
      }

      try {
        const data = JSON.parse(code.data);
        if (data.sessionId && data.classId) {
          setScanStatus("found");
          setSessionId(String(data.sessionId));
          setClassId(String(data.classId));
          if (data.token) setToken(data.token);
          stopCamera();
          if (student) {
            performCheckInWithGPS(String(data.sessionId), String(data.classId), data.token || token);
          }
          return;
        }
      } catch {
        // Not valid JSON either
      }
    }
  }, [student, stopCamera, token]);

  // Scanning loop
  useEffect(() => {
    if (!scanning) return;
    scanIntervalRef.current = setInterval(scanFrame, 300);
    return () => {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }
    };
  }, [scanning, scanFrame]);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  // Manual check-in with GPS
  const handleManualCheckIn = async () => {
    if (!sessionId || !classId || !token || !student) return;
    await performCheckInWithGPS(sessionId, classId, token);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: DARK_BG }}>
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
          <FlaskConical size={40} style={{ color: ORANGE }} />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: DARK_BG }}>
      {/* Header */}
      <div className="px-4 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.06)", backgroundColor: CARD_BG }}>
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <button
            onClick={() => {
              stopCamera();
              setLocation("/leaderboard");
            }}
            className="flex items-center gap-2 text-sm transition-colors"
            style={{ color: "rgba(255,255,255,0.5)" }}
          >
            <ArrowLeft size={16} />
            Voltar
          </button>
          <div className="flex items-center gap-2">
            <img src={LOGO_URL} alt="Logo" className="w-7 h-7 object-contain" />
            <span className="text-sm font-semibold text-white" style={{ fontFamily: "'Outfit', sans-serif" }}>
              Presença QR
            </span>
          </div>
          <button
            onClick={() => {
              stopCamera();
              clearStudentSession();
              setLocation("/");
            }}
            className="flex items-center gap-1 text-xs transition-colors"
            style={{ color: "rgba(255,255,255,0.4)" }}
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Student Info */}
        {student && (
          <motion.div
            className="p-4 rounded-lg mb-6 flex items-center gap-3"
            style={{ backgroundColor: CARD_BG, border: "1px solid rgba(255,255,255,0.08)" }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg" style={{ backgroundColor: "rgba(247,148,29,0.15)" }}>
              {student.teamEmoji || "🧪"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white truncate">{student.memberName}</div>
              <div className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                {student.teamName} • {student.email}
              </div>
            </div>
          </motion.div>
        )}

        {/* GPS Status Banner */}
        {isSubmitting && gpsStatus === "acquiring" && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl p-4 mb-4 flex items-center gap-3"
            style={{ backgroundColor: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)" }}
          >
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}>
              <Navigation size={20} style={{ color: "#3b82f6" }} />
            </motion.div>
            <div>
              <p className="text-sm font-medium text-white">Obtendo localização...</p>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
                Ative o GPS do celular para registrar presença
              </p>
            </div>
          </motion.div>
        )}

        {gpsStatus === "acquired" && gpsCoords && isSubmitting && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl p-4 mb-4 flex items-center gap-3"
            style={{ backgroundColor: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)" }}
          >
            <MapPin size={20} style={{ color: "#22c55e" }} />
            <div>
              <p className="text-sm font-medium text-white">Localização obtida</p>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
                Verificando se você está na sala de aula...
              </p>
            </div>
          </motion.div>
        )}

        {/* Result Display */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="rounded-xl p-6 mb-6 text-center"
              style={{
                backgroundColor: result.success ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                border: `1px solid ${result.success ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
              }}
            >
              {result.success ? (
                <CheckCircle size={56} className="mx-auto mb-3" style={{ color: "#22c55e" }} />
              ) : (
                <XCircle size={56} className="mx-auto mb-3" style={{ color: "#ef4444" }} />
              )}
              <p className="text-lg font-bold text-white mb-1">
                {result.success ? "Presença Registrada!" : "Erro no Check-in"}
              </p>
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
                {result.message}
              </p>
              {result.success && (
                <button
                  onClick={() => setLocation("/leaderboard")}
                  className="mt-4 px-6 py-2 rounded-lg text-sm font-medium text-white"
                  style={{ backgroundColor: ORANGE }}
                >
                  Voltar ao Leaderboard
                </button>
              )}
              {!result.success && (
                <div className="mt-4 flex flex-col gap-2">
                  <button
                    onClick={() => {
                      setResult(null);
                      setScanStatus("idle");
                      setGpsStatus("idle");
                      setGpsCoords(null);
                    }}
                    className="px-6 py-2 rounded-lg text-sm font-medium text-white"
                    style={{ backgroundColor: "rgba(255,255,255,0.1)" }}
                  >
                    Tentar Novamente
                  </button>
                  {sessionId && classId && (
                    <button
                      onClick={() => setShowManualRequest(true)}
                      className="px-6 py-2 rounded-lg text-sm font-medium text-white flex items-center justify-center gap-2"
                      style={{ backgroundColor: "rgba(247,148,29,0.15)", border: "1px solid rgba(247,148,29,0.3)" }}
                    >
                      <AlertCircle size={16} style={{ color: ORANGE }} />
                      <span style={{ color: ORANGE }}>Solicitar Confirmação Manual</span>
                    </button>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Content - only show if no result */}
        {!result && (
          <>
            {/* Mode Tabs */}
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => {
                  setMode("scan");
                  setScanStatus("idle");
                }}
                className="flex-1 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all"
                style={{
                  backgroundColor: mode === "scan" ? ORANGE : "rgba(255,255,255,0.06)",
                  color: mode === "scan" ? "white" : "rgba(255,255,255,0.5)",
                }}
              >
                <Camera size={16} />
                Escanear QR
              </button>
              <button
                onClick={() => {
                  setMode("manual");
                  stopCamera();
                  setScanStatus("idle");
                }}
                className="flex-1 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all"
                style={{
                  backgroundColor: mode === "manual" ? ORANGE : "rgba(255,255,255,0.06)",
                  color: mode === "manual" ? "white" : "rgba(255,255,255,0.5)",
                }}
              >
                <Hash size={16} />
                Manual
              </button>
            </div>

            {/* Camera Scanner */}
            {mode === "scan" && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl overflow-hidden"
                style={{ backgroundColor: CARD_BG, border: "1px solid rgba(255,255,255,0.08)" }}
              >
                {!scanning ? (
                  <div className="p-8 text-center">
                    <div className="w-20 h-20 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: "rgba(247,148,29,0.15)" }}>
                      <Scan size={36} style={{ color: ORANGE }} />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2" style={{ fontFamily: "'Outfit', sans-serif" }}>
                      Escanear QR Code
                    </h3>
                    <p className="text-sm mb-6" style={{ color: "rgba(255,255,255,0.4)" }}>
                      Aponte a câmera para o QR Code projetado na TV
                    </p>
                    <button
                      onClick={startCamera}
                      className="w-full py-4 rounded-xl font-semibold text-white flex items-center justify-center gap-3 transition-all hover:opacity-90"
                      style={{ backgroundColor: ORANGE }}
                    >
                      <Camera size={20} />
                      Ativar Câmera
                    </button>
                    {scanStatus === "error" && (
                      <p className="text-xs mt-3" style={{ color: "#ef4444" }}>
                        Erro ao acessar a câmera. Verifique as permissões do navegador.
                      </p>
                    )}
                  </div>
                ) : (
                  <div>
                    {/* Camera viewfinder */}
                    <div className="relative">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full aspect-square object-cover"
                      />
                      <canvas ref={canvasRef} className="hidden" />

                      {/* Scan overlay */}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-56 h-56 relative">
                          {/* Corner brackets */}
                          <div className="absolute top-0 left-0 w-8 h-8 border-t-3 border-l-3 rounded-tl-lg" style={{ borderColor: ORANGE }} />
                          <div className="absolute top-0 right-0 w-8 h-8 border-t-3 border-r-3 rounded-tr-lg" style={{ borderColor: ORANGE }} />
                          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-3 border-l-3 rounded-bl-lg" style={{ borderColor: ORANGE }} />
                          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-3 border-r-3 rounded-br-lg" style={{ borderColor: ORANGE }} />

                          {/* Scanning line animation */}
                          <motion.div
                            className="absolute left-2 right-2 h-0.5"
                            style={{ backgroundColor: ORANGE, opacity: 0.8 }}
                            animate={{ top: ["10%", "90%", "10%"] }}
                            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                          />
                        </div>
                      </div>

                      {/* Status bar */}
                      <div className="absolute bottom-0 left-0 right-0 p-3" style={{ background: "linear-gradient(transparent, rgba(0,0,0,0.8))" }}>
                        <div className="flex items-center justify-center gap-2">
                          <motion.div
                            animate={{ opacity: [1, 0.3, 1] }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                          >
                            <QrCode size={16} style={{ color: ORANGE }} />
                          </motion.div>
                          <span className="text-xs text-white font-medium">Procurando QR Code...</span>
                        </div>
                      </div>
                    </div>

                    {/* Stop button */}
                    <div className="p-4">
                      <button
                        onClick={stopCamera}
                        className="w-full py-3 rounded-xl text-sm font-medium text-white transition-colors"
                        style={{ backgroundColor: "rgba(255,255,255,0.1)" }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* Manual Entry */}
            {mode === "manual" && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl p-6"
                style={{ backgroundColor: CARD_BG, border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: "rgba(247,148,29,0.15)" }}>
                    <Hash size={24} style={{ color: ORANGE }} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white" style={{ fontFamily: "'Outfit', sans-serif" }}>
                      Entrada Manual
                    </h3>
                    <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                      Insira os dados fornecidos pelo professor
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: "rgba(255,255,255,0.5)" }}>
                      ID da Sessão
                    </label>
                    <input
                      type="number"
                      value={sessionId}
                      onChange={(e) => setSessionId(e.target.value)}
                      placeholder="Ex: 1"
                      className="w-full px-4 py-3 rounded-lg text-sm text-white placeholder:text-gray-500 outline-none focus:ring-2"
                      style={{
                        backgroundColor: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(255,255,255,0.1)",
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: "rgba(255,255,255,0.5)" }}>
                      ID da Turma
                    </label>
                    <input
                      type="number"
                      value={classId}
                      onChange={(e) => setClassId(e.target.value)}
                      placeholder="Ex: 1"
                      className="w-full px-4 py-3 rounded-lg text-sm text-white placeholder:text-gray-500 outline-none focus:ring-2"
                      style={{
                        backgroundColor: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(255,255,255,0.1)",
                      }}
                    />
                  </div>

                  <button
                    onClick={handleManualCheckIn}
                    disabled={isSubmitting || !sessionId || !classId}
                    className="w-full py-4 rounded-xl font-semibold text-white flex items-center justify-center gap-3 transition-all hover:opacity-90 disabled:opacity-50"
                    style={{ backgroundColor: ORANGE }}
                  >
                    {isSubmitting ? (
                      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                        <FlaskConical size={20} />
                      </motion.div>
                    ) : (
                      <>
                        <CheckCircle size={20} />
                        Registrar Presença
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            )}

            {/* Info */}
            <div className="mt-6 p-4 rounded-xl" style={{ backgroundColor: "rgba(247,148,29,0.06)", border: "1px solid rgba(247,148,29,0.15)" }}>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
                <strong style={{ color: ORANGE }}>Como funciona:</strong> O professor projeta um QR Code na TV da sala.
                Escaneie com a câmera ou insira os dados manualmente. A presença é registrada automaticamente.
              </p>
              <p className="text-xs mt-2 flex items-center gap-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>
                <MapPin size={12} style={{ color: ORANGE }} />
                <span>Sua localização GPS será verificada para confirmar que você está na sala de aula.</span>
              </p>
            </div>
          </>
        )}

        {/* Banner: Solicitação manual enviada */}
        {manualRequestSent && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 rounded-xl p-5 text-center"
            style={{ backgroundColor: "rgba(247,148,29,0.1)", border: "1px solid rgba(247,148,29,0.3)" }}
          >
            <AlertCircle size={40} className="mx-auto mb-3" style={{ color: ORANGE }} />
            <p className="text-base font-bold text-white mb-1">Solicitação Enviada!</p>
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
              Sua solicitação de confirmação manual foi enviada ao professor.<br />
              Aguarde a aprovação para que sua presença seja registrada.
            </p>
          </motion.div>
        )}
      </div>

      {/* Modal: Solicitação de confirmação manual */}
      <AnimatePresence>
        {showManualRequest && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center"
            style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
            onClick={() => setShowManualRequest(false)}
          >
            <motion.div
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              className="w-full max-w-lg rounded-t-2xl p-6"
              style={{ backgroundColor: "#0D1B2A", border: "1px solid rgba(255,255,255,0.1)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ backgroundColor: "rgba(255,255,255,0.2)" }} />
              <h3 className="text-lg font-bold text-white mb-1">Solicitar Confirmação Manual</h3>
              <p className="text-sm mb-5" style={{ color: "rgba(255,255,255,0.5)" }}>
                Use esta opção quando o GPS não estiver funcionando. O professor receberá sua solicitação e poderá confirmar sua presença manualmente.
              </p>
              <div className="rounded-xl p-4 mb-5" style={{ backgroundColor: "rgba(247,148,29,0.08)", border: "1px solid rgba(247,148,29,0.2)" }}>
                <p className="text-xs font-semibold mb-1" style={{ color: ORANGE }}>Motivo da solicitação</p>
                <p className="text-sm text-white">GPS não disponível ou fora do raio permitido</p>
                {gpsCoords && (
                  <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>
                    Coordenadas: {gpsCoords.latitude.toFixed(5)}, {gpsCoords.longitude.toFixed(5)}
                  </p>
                )}
              </div>
              <button
                onClick={() => {
                  if (!student || !sessionId || !classId) return;
                  requestManualMutation.mutate({
                    qrCodeSessionId: parseInt(sessionId),
                    memberId: student.memberId,
                    classId: parseInt(classId),
                    reason: gpsStatus === "error" ? "gps_failed" : "gps_out_of_range",
                    latitude: gpsCoords?.latitude,
                    longitude: gpsCoords?.longitude,
                  });
                }}
                disabled={requestManualMutation.isPending}
                className="w-full py-4 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: ORANGE }}
              >
                {requestManualMutation.isPending ? (
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                    <FlaskConical size={20} />
                  </motion.div>
                ) : (
                  <><AlertCircle size={18} /> Enviar Solicitação ao Professor</>
                )}
              </button>
              <button
                onClick={() => setShowManualRequest(false)}
                className="w-full mt-3 py-3 rounded-xl text-sm font-medium"
                style={{ color: "rgba(255,255,255,0.4)" }}
              >
                Cancelar
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
