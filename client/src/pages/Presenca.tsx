/**
 * Presença — Conexão em Farmacologia
 * Geolocation-based attendance check-in
 * Location: Frei Caneca 94, sala D201, raio 100m
 * Available: Tuesdays 8h-12h BRT
 */
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin, Clock, CheckCircle, XCircle, AlertCircle,
  ArrowLeft, FlaskConical, Navigation, Wifi, WifiOff,
  Calendar, Shield, History, LogOut
} from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useStudentAuth, clearStudentSession } from "./StudentLogin";
import { Link } from "wouter";

const LOGO_URL = "/logos/TYglakFwBNwpBXzT.png";
const ORANGE = "#F7941D";
const DARK_BG = "#0A1628";
const CARD_BG = "#0D1B2A";

// Classroom coordinates (Frei Caneca 94, Rio de Janeiro)
const CLASSROOM_LAT = -22.9176;
const CLASSROOM_LNG = -43.1831;
const MAX_DISTANCE = 100; // meters

export default function Presenca() {
  const [, setLocation] = useLocation();
  const { student, isAuthenticated, isLoading, sessionToken } = useStudentAuth();
  const [geoStatus, setGeoStatus] = useState<"idle" | "loading" | "success" | "error" | "denied">("idle");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [checkInResult, setCheckInResult] = useState<{
    success: boolean;
    message: string;
    distance?: number;
    isWithinRange?: boolean;
    week?: number;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setLocation("/login-aluno");
    }
  }, [isLoading, isAuthenticated, setLocation]);

  // Get attendance history
  const { data: attendanceHistory } = trpc.attendanceOld.myAttendance.useQuery(
    { sessionToken: sessionToken || "" },
    { enabled: !!sessionToken }
  );

  const checkInMutation = trpc.attendanceOld.checkIn.useMutation();

  // Calculate distance between two points using Haversine formula
  function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // Request geolocation
  const requestLocation = () => {
    setGeoStatus("loading");
    setCheckInResult(null);

    if (!navigator.geolocation) {
      setGeoStatus("error");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setCoords({ lat, lng });
        const dist = calculateDistance(lat, lng, CLASSROOM_LAT, CLASSROOM_LNG);
        setDistance(dist);
        setGeoStatus("success");
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setGeoStatus("denied");
        } else {
          setGeoStatus("error");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  };

  // Submit check-in
  const handleCheckIn = async () => {
    if (!coords || !sessionToken) return;
    setIsSubmitting(true);

    try {
      const result = await checkInMutation.mutateAsync({
        sessionToken,
        latitude: coords.lat,
        longitude: coords.lng,
      });
      setCheckInResult(result);
    } catch (err: any) {
      setCheckInResult({
        success: false,
        message: err.message || "Erro ao registrar presença",
      });
    } finally {
      setIsSubmitting(false);
    }
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
            onClick={() => setLocation("/leaderboard")}
            className="flex items-center gap-2 text-sm transition-colors"
            style={{ color: "rgba(255,255,255,0.5)" }}
          >
            <ArrowLeft size={16} />
            Voltar
          </button>
          <div className="flex items-center gap-2">
            <img src={LOGO_URL} alt="Logo" className="w-7 h-7 object-contain" />
            <span className="text-sm font-semibold text-white" style={{ fontFamily: "'Outfit', sans-serif" }}>
              Presença
            </span>
          </div>
          <button
            onClick={() => {
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

        {/* Check-in Card */}
        <motion.div
          className="rounded-xl overflow-hidden mb-6"
          style={{ backgroundColor: CARD_BG, border: "1px solid rgba(255,255,255,0.08)" }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: "rgba(247,148,29,0.15)" }}>
                <MapPin size={24} style={{ color: ORANGE }} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white" style={{ fontFamily: "'Outfit', sans-serif" }}>
                  Registrar Presença
                </h2>
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                  Frei Caneca 94, sala D201 • Raio: {MAX_DISTANCE}m
                </p>
              </div>
            </div>

            {/* Info boxes */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="p-3 rounded-lg" style={{ backgroundColor: "rgba(255,255,255,0.04)" }}>
                <div className="flex items-center gap-1.5 mb-1">
                  <Calendar size={14} style={{ color: ORANGE }} />
                  <span className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.6)" }}>Dia</span>
                </div>
                <span className="text-sm font-semibold text-white">Terças-feiras</span>
              </div>
              <div className="p-3 rounded-lg" style={{ backgroundColor: "rgba(255,255,255,0.04)" }}>
                <div className="flex items-center gap-1.5 mb-1">
                  <Clock size={14} style={{ color: ORANGE }} />
                  <span className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.6)" }}>Horário</span>
                </div>
                <span className="text-sm font-semibold text-white">8h — 12h</span>
              </div>
            </div>

            {/* Geolocation Status */}
            <AnimatePresence mode="wait">
              {geoStatus === "idle" && !checkInResult && (
                <motion.div
                  key="idle"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <button
                    onClick={requestLocation}
                    className="w-full py-4 rounded-xl font-semibold text-white flex items-center justify-center gap-3 transition-all hover:opacity-90"
                    style={{ backgroundColor: ORANGE }}
                  >
                    <Navigation size={20} />
                    Obter Localização e Registrar
                  </button>
                  <p className="text-center text-xs mt-3" style={{ color: "rgba(255,255,255,0.3)" }}>
                    Permita o acesso à sua localização para registrar presença
                  </p>
                </motion.div>
              )}

              {geoStatus === "loading" && (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-center py-6"
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    className="inline-block mb-3"
                  >
                    <Navigation size={32} style={{ color: ORANGE }} />
                  </motion.div>
                  <p className="text-sm text-white">Obtendo localização...</p>
                  <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>
                    Aguarde enquanto verificamos sua posição
                  </p>
                </motion.div>
              )}

              {geoStatus === "denied" && (
                <motion.div
                  key="denied"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="p-4 rounded-lg text-center"
                  style={{ backgroundColor: "rgba(239,68,68,0.1)" }}
                >
                  <WifiOff size={32} className="mx-auto mb-2" style={{ color: "#ef4444" }} />
                  <p className="text-sm font-semibold" style={{ color: "#ef4444" }}>Acesso à localização negado</p>
                  <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>
                    Habilite a permissão de localização nas configurações do navegador e tente novamente.
                  </p>
                  <button
                    onClick={() => setGeoStatus("idle")}
                    className="mt-3 px-4 py-2 rounded-lg text-sm font-medium text-white"
                    style={{ backgroundColor: "rgba(255,255,255,0.1)" }}
                  >
                    Tentar Novamente
                  </button>
                </motion.div>
              )}

              {geoStatus === "error" && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="p-4 rounded-lg text-center"
                  style={{ backgroundColor: "rgba(239,68,68,0.1)" }}
                >
                  <AlertCircle size={32} className="mx-auto mb-2" style={{ color: "#ef4444" }} />
                  <p className="text-sm font-semibold" style={{ color: "#ef4444" }}>Erro ao obter localização</p>
                  <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>
                    Verifique se o GPS está ativado e tente novamente.
                  </p>
                  <button
                    onClick={() => setGeoStatus("idle")}
                    className="mt-3 px-4 py-2 rounded-lg text-sm font-medium text-white"
                    style={{ backgroundColor: "rgba(255,255,255,0.1)" }}
                  >
                    Tentar Novamente
                  </button>
                </motion.div>
              )}

              {geoStatus === "success" && !checkInResult && (
                <motion.div
                  key="success-location"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  {/* Distance indicator */}
                  <div className="p-4 rounded-lg mb-4" style={{
                    backgroundColor: distance !== null && distance <= MAX_DISTANCE
                      ? "rgba(34,197,94,0.1)"
                      : "rgba(239,68,68,0.1)",
                    border: `1px solid ${distance !== null && distance <= MAX_DISTANCE
                      ? "rgba(34,197,94,0.2)"
                      : "rgba(239,68,68,0.2)"}`,
                  }}>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{
                        backgroundColor: distance !== null && distance <= MAX_DISTANCE
                          ? "rgba(34,197,94,0.2)"
                          : "rgba(239,68,68,0.2)",
                      }}>
                        {distance !== null && distance <= MAX_DISTANCE ? (
                          <CheckCircle size={24} style={{ color: "#22c55e" }} />
                        ) : (
                          <XCircle size={24} style={{ color: "#ef4444" }} />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {distance !== null && distance <= MAX_DISTANCE
                            ? "Dentro do raio permitido"
                            : "Fora do raio permitido"}
                        </p>
                        <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
                          Distância: {distance?.toFixed(0)}m (máximo: {MAX_DISTANCE}m)
                        </p>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleCheckIn}
                    disabled={isSubmitting}
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
                        Confirmar Presença
                      </>
                    )}
                  </button>
                </motion.div>
              )}

              {checkInResult && (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-5 rounded-lg text-center"
                  style={{
                    backgroundColor: checkInResult.success
                      ? "rgba(34,197,94,0.1)"
                      : "rgba(239,68,68,0.1)",
                    border: `1px solid ${checkInResult.success
                      ? "rgba(34,197,94,0.2)"
                      : "rgba(239,68,68,0.2)"}`,
                  }}
                >
                  {checkInResult.success ? (
                    <CheckCircle size={48} className="mx-auto mb-3" style={{ color: "#22c55e" }} />
                  ) : (
                    <XCircle size={48} className="mx-auto mb-3" style={{ color: "#ef4444" }} />
                  )}
                  <p className="text-base font-semibold text-white mb-1">
                    {checkInResult.success ? "Presença Registrada!" : "Não foi possível registrar"}
                  </p>
                  <p className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
                    {checkInResult.message}
                  </p>
                  {checkInResult.week && (
                    <p className="text-xs mt-2" style={{ color: "rgba(255,255,255,0.3)" }}>
                      Semana {checkInResult.week}
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Attendance History */}
        <motion.div
          className="rounded-xl overflow-hidden"
          style={{ backgroundColor: CARD_BG, border: "1px solid rgba(255,255,255,0.08)" }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="p-4 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            <div className="flex items-center gap-2">
              <History size={18} style={{ color: ORANGE }} />
              <h3 className="text-sm font-semibold text-white">Histórico de Presença</h3>
            </div>
          </div>
          <div className="p-4">
            {!attendanceHistory || attendanceHistory.length === 0 ? (
              <p className="text-center text-sm py-4" style={{ color: "rgba(255,255,255,0.3)" }}>
                Nenhuma presença registrada ainda
              </p>
            ) : (
              <div className="space-y-2">
                {attendanceHistory.map((record: any) => (
                  <div
                    key={record.id}
                    className="flex items-center gap-3 p-3 rounded-lg"
                    style={{ backgroundColor: "rgba(255,255,255,0.03)" }}
                  >
                    <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{
                      backgroundColor: record.status === "valid" || record.status === "manual"
                        ? "rgba(34,197,94,0.15)"
                        : "rgba(239,68,68,0.15)",
                    }}>
                      {record.status === "valid" || record.status === "manual" ? (
                        <CheckCircle size={16} style={{ color: "#22c55e" }} />
                      ) : (
                        <XCircle size={16} style={{ color: "#ef4444" }} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white">Semana {record.week}</div>
                      <div className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                        {record.classDate} • {record.distanceMeters ? `${parseFloat(record.distanceMeters).toFixed(0)}m` : "Manual"}
                      </div>
                    </div>
                    <span
                      className="text-xs px-2 py-1 rounded-full font-medium"
                      style={{
                        backgroundColor: record.status === "valid" ? "rgba(34,197,94,0.15)" :
                          record.status === "manual" ? "rgba(247,148,29,0.15)" :
                            "rgba(239,68,68,0.15)",
                        color: record.status === "valid" ? "#22c55e" :
                          record.status === "manual" ? ORANGE :
                            "#ef4444",
                      }}
                    >
                      {record.status === "valid" ? "Válida" :
                        record.status === "manual" ? "Manual" : "Inválida"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
