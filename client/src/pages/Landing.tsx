/**
 * Landing Page — Conexão em Farmacologia
 * Design: Logo + Logos institucionais (UNIRIO destaque) à esquerda, Avatar Professor Pedro à direita
 * Sem jornada do semestre, sem stats, sem "Como Funciona"
 */
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy, Youtube, GraduationCap,
  ArrowRight, LogIn, Shield, Lock
} from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { useStudentAuth } from "./StudentLogin";
import BackgroundMusic from "@/components/BackgroundMusic";
import YouTubeButton from "@/components/YouTubeButton";
import RecentVideos from "@/components/RecentVideos";

const LOGO_URL = "/logos/TYglakFwBNwpBXzT.png";
const INTRO_VIDEO_URL = "https://files.manuscdn.com/user_upload_by_module/session_file/310419663028318382/yCXpFhcMWFXbhcrj.mp4";
const YOUTUBE_URL = "https://www.youtube.com/@Conex%C3%A3oemCi%C3%AAncia-Farmacol%C3%B3gica";
const PROFESSOR_AVATAR_URL = "/logos/kmrZlZNcVzNpoWYz.png";

// Floating particles for background
function FloatingParticles() {
  const particles = Array.from({ length: 15 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 4 + 2,
    duration: Math.random() * 10 + 15,
    delay: Math.random() * 5,
  }));

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            backgroundColor: p.id % 3 === 0 ? "#F7941D" : p.id % 3 === 1 ? "#999" : "#4A4A4A",
            opacity: 0.15,
          }}
          animate={{
            y: [0, -30, 0],
            x: [0, Math.random() * 20 - 10, 0],
            opacity: [0.1, 0.25, 0.1],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

export default function Landing() {
  const [, setLocation] = useLocation();
  const [showVinheta, setShowVinheta] = useState(true);
  const [vinhetaComplete, setVinhetaComplete] = useState(false);
  const [vinhetaAudioStopped, setVinhetaAudioStopped] = useState(false);

  const { isAuthenticated } = useAuth();
  const { isAuthenticated: isStudentAuth } = useStudentAuth();

  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Check if intro was already shown this session
  useEffect(() => {
    const shown = sessionStorage.getItem("intro_shown");
    if (shown) {
      setShowVinheta(false);
      setVinhetaComplete(true);
      setVinhetaAudioStopped(true);
    }
  }, []);

  // Vinheta: video has embedded audio. Autoplay muted (allowed by all browsers),
  // then unmute on first user gesture (click/touch/key).
  // This eliminates the need for a separate <audio> element and any "Iniciar" button.
  useEffect(() => {
    if (!showVinheta || vinhetaComplete) return;

    const video = videoRef.current;
    if (!video) return;

    // Start video muted (autoplay allowed on all platforms)
    video.muted = true;
    video.play().catch(() => {});

    let unmuted = false;

    const unmuteVideo = () => {
      if (unmuted || !videoRef.current) return;
      unmuted = true;
      videoRef.current.muted = false;
      videoRef.current.volume = 0.5;
      // Remove all listeners after unmuting
      document.removeEventListener("click", unmuteVideo);
      document.removeEventListener("touchstart", unmuteVideo);
      document.removeEventListener("touchend", unmuteVideo);
      document.removeEventListener("keydown", unmuteVideo);
      document.removeEventListener("pointerdown", unmuteVideo);
    };

    // Try to unmute immediately (works if user navigated from another page with prior interaction)
    try {
      video.muted = false;
      video.volume = 0.5;
      // Check if browser actually allowed unmuting by trying to play unmuted
      const playPromise = video.play();
      if (playPromise) {
        playPromise.then(() => {
          unmuted = true;
        }).catch(() => {
          // Browser blocked unmuted playback — go back to muted and wait for gesture
          video.muted = true;
          video.play().catch(() => {});
          document.addEventListener("click", unmuteVideo);
          document.addEventListener("touchstart", unmuteVideo);
          document.addEventListener("touchend", unmuteVideo);
          document.addEventListener("keydown", unmuteVideo);
          document.addEventListener("pointerdown", unmuteVideo);
        });
      }
    } catch {
      // Fallback: stay muted and register listeners
      video.muted = true;
      video.play().catch(() => {});
      document.addEventListener("click", unmuteVideo);
      document.addEventListener("touchstart", unmuteVideo);
      document.addEventListener("touchend", unmuteVideo);
      document.addEventListener("keydown", unmuteVideo);
      document.addEventListener("pointerdown", unmuteVideo);
    }

    return () => {
      document.removeEventListener("click", unmuteVideo);
      document.removeEventListener("touchstart", unmuteVideo);
      document.removeEventListener("touchend", unmuteVideo);
      document.removeEventListener("keydown", unmuteVideo);
      document.removeEventListener("pointerdown", unmuteVideo);
    };
  }, [showVinheta, vinhetaComplete]);

  const handleVinhetaComplete = () => {
    sessionStorage.setItem("intro_shown", "true");
    // Completely stop and destroy the video to prevent audio overlap with BackgroundMusic
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
      videoRef.current.src = ""; // Release the resource
      videoRef.current.load(); // Force release
      videoRef.current = null;
    }
    setVinhetaAudioStopped(true);
    setVinhetaComplete(true);
    setTimeout(() => setShowVinheta(false), 800);
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0A1628" }}>
      {/* ═══════ ANIMATED INTRO VINHETA ═══════ */}
      {showVinheta && !vinhetaComplete && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black overflow-hidden"
          style={{ width: "100vw", height: "100vh", maxWidth: "100vw", maxHeight: "100vh" }}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
        >
          {/* Single video with embedded audio — autoplay muted, unmute on first gesture */}
          <video
            ref={videoRef}
            key="intro-video"
            autoPlay
            muted
            playsInline
            onEnded={handleVinhetaComplete}
            className="w-full h-full object-contain"
            style={{
              backgroundColor: "#000",
              maxWidth: "100vw",
              maxHeight: "100vh",
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }}
          >
            <source src={INTRO_VIDEO_URL} type="video/mp4" />
          </video>

          {/* Subtle hint for users to tap to enable sound */}
          <motion.div
            className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full z-40"
            style={{ backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", maxWidth: "90vw" }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 1.5 }}
          >
            <span className="text-white/80 text-[11px] sm:text-sm">🔊 Toque na tela para ativar o som</span>
          </motion.div>

          <motion.button
              onClick={handleVinhetaComplete}
              className="absolute top-3 right-3 sm:top-8 sm:right-8 px-4 sm:px-8 py-2 sm:py-4 rounded-lg font-bold text-sm sm:text-lg transition-all hover:scale-110 z-50 shadow-lg"
              style={{
                backgroundColor: "#F7941D",
                color: "#fff",
                border: "2px solid #fff",
                boxShadow: "0 0 20px rgba(247, 148, 29, 0.6)"
              }}
              initial={{ opacity: 0, y: -20, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.4, delay: 1 }}
              whileHover={{ scale: 1.15, boxShadow: "0 0 30px rgba(247, 148, 29, 0.8)" }}
              whileTap={{ scale: 0.95 }}
            >
              Pular
            </motion.button>
        </motion.div>
      )}

      {/* ═══════ BACKGROUND MUSIC PLAYER ═══════ */}
      {vinhetaComplete && vinhetaAudioStopped && <BackgroundMusic />}

      {/* ═══════ HERO SECTION — Logo + Professor Pedro ═══════ */}
      <div className="relative min-h-screen landscape-min-h-auto flex items-center overflow-hidden">
        {/* Animated radial gradient background */}
        <motion.div
          className="absolute inset-0"
          animate={{
            background: [
              "radial-gradient(ellipse at 30% 50%, rgba(247,148,29,0.08) 0%, rgba(10,22,40,0) 60%)",
              "radial-gradient(ellipse at 30% 50%, rgba(247,148,29,0.14) 0%, rgba(10,22,40,0) 50%)",
              "radial-gradient(ellipse at 30% 50%, rgba(247,148,29,0.08) 0%, rgba(10,22,40,0) 60%)",
            ],
          }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        />

        <FloatingParticles />

        {/* Expanding circle rings */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={`ring-${i}`}
              className="absolute rounded-full"
              style={{ border: "1px solid rgba(247,148,29,0.08)" }}
              animate={{
                width: [100, 600 + i * 200],
                height: [100, 600 + i * 200],
                opacity: [0.2, 0],
              }}
              transition={{
                duration: 4,
                delay: i * 1.5,
                repeat: Infinity,
                ease: "easeOut",
              }}
            />
          ))}
        </div>

        <div className="relative z-10 w-full max-w-7xl 2xl:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 2xl:gap-20 items-center min-h-screen landscape-min-h-auto py-12 lg:py-8 landscape-compact-y">
            
            {/* ═══ LEFT SIDE: Logo + Título + Logos Institucionais ═══ */}
            <motion.div
              className="flex flex-col items-center lg:items-start text-center lg:text-left order-2 lg:order-1"
              initial={{ opacity: 0, x: -40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
            >
              {/* Logo Conexão em Farmacologia */}
              <motion.div className="relative mb-6">
                <motion.div
                  className="absolute inset-0 rounded-full blur-3xl"
                  style={{ backgroundColor: "#F7941D", opacity: 0.15 }}
                  animate={{
                    scale: [1, 1.3, 1],
                    opacity: [0.1, 0.25, 0.1],
                  }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                />
                <motion.img
                  src={LOGO_URL}
                  alt="Conexão em Farmacologia"
                  className="relative w-28 h-28 sm:w-44 sm:h-44 md:w-52 md:h-52 2xl:w-64 2xl:h-64 object-contain drop-shadow-2xl"
                  initial={{ scale: 0, rotate: -180, opacity: 0 }}
                  animate={{ scale: 1, rotate: 0, opacity: 1 }}
                  transition={{ duration: 1, delay: 0.5, type: "spring", stiffness: 150, damping: 20 }}
                />
              </motion.div>

              {/* Título animado */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1, duration: 0.6 }}
              >
                <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl 2xl:text-7xl font-bold tracking-tight" style={{ fontFamily: "'Outfit', sans-serif" }}>
                  <span className="inline-flex overflow-hidden">
                    {"Conexão".split("").map((letter, i) => (
                      <motion.span
                        key={`c-${i}`}
                        style={{ color: "#F7941D" }}
                        initial={{ y: 60, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 1 + i * 0.05, type: "spring", stiffness: 300, damping: 20 }}
                      >
                        {letter}
                      </motion.span>
                    ))}
                  </span>
                  <br className="sm:hidden" />
                  <motion.span
                    className="text-white/60 text-xl sm:text-2xl md:text-3xl lg:text-4xl mx-2"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.4, duration: 0.4 }}
                  >
                    em
                  </motion.span>
                  <br className="hidden sm:block lg:hidden" />
                  <span className="inline-flex overflow-hidden">
                    {"Farmacologia".split("").map((letter, i) => (
                      <motion.span
                        key={`f-${i}`}
                        className="text-white"
                        initial={{ y: 60, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 1.5 + i * 0.03, type: "spring", stiffness: 300, damping: 20 }}
                      >
                        {letter}
                      </motion.span>
                    ))}
                  </span>
                </h1>

                {/* Animated underline */}
                <motion.div
                  className="h-1 rounded-full mt-3 lg:mr-auto"
                  style={{ backgroundColor: "#F7941D" }}
                  initial={{ width: 0 }}
                  animate={{ width: "60%" }}
                  transition={{ delay: 2.2, duration: 0.8, ease: "easeOut" }}
                />
              </motion.div>

              {/* Subtítulo */}
              <motion.p
                className="mt-4 text-sm sm:text-base 2xl:text-lg max-w-md 2xl:max-w-lg"
                style={{ color: "rgba(255,255,255,0.5)" }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 2.4, duration: 0.6 }}
              >
                Uma experiência gamificada de aprendizado com metodologias ativas
              </motion.p>

              {/* ═══ LOGOS INSTITUCIONAIS — UNIRIO em destaque ═══ */}
              <motion.div
                className="mt-8 w-full max-w-lg"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 2.6, duration: 0.6 }}
              >
                {/* Linha decorativa */}
                <motion.div
                  className="flex items-center justify-center lg:justify-start gap-3 mb-4"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: 2.8, duration: 0.6 }}
                >
                  <div className="h-px flex-1 max-w-12" style={{ background: "linear-gradient(to right, transparent, rgba(247,148,29,0.4))" }} />
                  <span className="text-[10px] tracking-[0.3em] uppercase" style={{ color: "rgba(247,148,29,0.6)", fontFamily: "'JetBrains Mono', monospace" }}>Parceiros Acadêmicos</span>
                  <div className="h-px flex-1 max-w-12" style={{ background: "linear-gradient(to left, transparent, rgba(247,148,29,0.4))" }} />
                </motion.div>

                {/* UNIRIO em destaque maior */}
                <div className="flex flex-col items-center lg:items-start gap-4">
                  <motion.div
                    className="bg-white/90 rounded-2xl p-3 shadow-xl"
                    initial={{ opacity: 0, scale: 0.8, filter: "blur(8px)" }}
                    animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                    transition={{ delay: 3, duration: 0.8, type: "spring", stiffness: 150, damping: 18 }}
                    whileHover={{ scale: 1.05, y: -4 }}
                  >
                    <img
                      src="/logos/unirio.png"
                      alt="UNIRIO"
                      className="h-16 sm:h-20 w-auto object-contain"
                    />
                  </motion.div>

                  {/* Demais logos menores */}
                  <div className="flex items-center gap-3 flex-wrap justify-center lg:justify-start">
                    {[
                      { src: "/logos/medicina.png", alt: "Escola de Medicina e Cirurgia", bg: false },
                      { src: "/logos/ibio.png", alt: "Instituto Biomédico", bg: true },
                      { src: "/logos/nutricao.png", alt: "Escola de Nutrição", bg: false },
                      { src: "/logos/enfermagem.png", alt: "Escola de Enfermagem", bg: false },
                    ].map((logo, i) => (
                      <motion.div
                        key={logo.alt}
                        className={`relative group cursor-pointer ${
                          logo.bg ? "bg-white/90 rounded-full p-1.5 shadow-md" : ""
                        }`}
                        initial={{ opacity: 0, y: 20, scale: 0.8, filter: "blur(6px)" }}
                        animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                        transition={{
                          delay: 3.2 + i * 0.15,
                          duration: 0.7,
                          type: "spring",
                          stiffness: 150,
                          damping: 18,
                        }}
                        whileHover={{ scale: 1.15, y: -3 }}
                      >
                        <img
                          src={logo.src}
                          alt={logo.alt}
                          className={`h-9 sm:h-11 w-auto object-contain ${
                            logo.bg ? "" : "opacity-75 group-hover:opacity-100 transition-opacity duration-300"
                          }`}
                        />
                        {/* Tooltip */}
                        <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none">
                          <span className="text-[9px] px-2 py-0.5 rounded-md" style={{ backgroundColor: "rgba(247,148,29,0.15)", color: "rgba(247,148,29,0.8)" }}>
                            {logo.alt}
                          </span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </motion.div>
            </motion.div>

            {/* ═══ RIGHT SIDE: Avatar Professor Pedro ═══ */}
            <motion.div
              className="relative flex items-center justify-center order-1 lg:order-2"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
            >
              {/* Glow behind professor */}
              <motion.div
                className="absolute w-72 h-72 sm:w-96 sm:h-96 2xl:w-[500px] 2xl:h-[500px] rounded-full blur-3xl"
                style={{ backgroundColor: "#F7941D", opacity: 0.08 }}
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.06, 0.12, 0.06],
                }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              />

              {/* Decorative ring */}
              <motion.div
                className="absolute w-80 h-80 sm:w-[420px] sm:h-[420px] 2xl:w-[540px] 2xl:h-[540px] rounded-full"
                style={{ border: "2px solid rgba(247,148,29,0.15)" }}
                animate={{ rotate: 360 }}
                transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
              >
                {/* Orbital dots */}
                {[0, 90, 180, 270].map((deg) => (
                  <div
                    key={deg}
                    className="absolute w-2.5 h-2.5 rounded-full"
                    style={{
                      backgroundColor: "#F7941D",
                      opacity: 0.5,
                      top: "50%",
                      left: "50%",
                      transform: `rotate(${deg}deg) translateX(${160}px) translateY(-50%)`,
                    }}
                  />
                ))}
              </motion.div>

              {/* Professor Avatar */}
              <motion.img
                src={PROFESSOR_AVATAR_URL}
                alt="Prof. Pedro Braga"
                className="relative w-48 h-64 sm:w-80 sm:h-[400px] md:w-96 md:h-[480px] 2xl:w-[440px] 2xl:h-[560px] object-contain drop-shadow-2xl"
                initial={{ scale: 0.9, opacity: 0, y: 40, filter: "blur(10px)" }}
                animate={{ scale: 1, opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ duration: 1.2, delay: 0.8, type: "spring", stiffness: 80, damping: 20 }}
              />

              {/* Name badge */}
              <motion.div
                className="absolute bottom-4 sm:bottom-8 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-xl"
                style={{
                  background: "linear-gradient(135deg, rgba(247,148,29,0.9) 0%, rgba(247,148,29,0.7) 100%)",
                  boxShadow: "0 4px 20px rgba(247,148,29,0.3)",
                }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.5, duration: 0.5 }}
              >
                <p className="text-white font-bold text-sm sm:text-base text-center" style={{ fontFamily: "'Outfit', sans-serif" }}>
                  Prof. Pedro Braga
                </p>
                <p className="text-white/80 text-[10px] sm:text-xs text-center">
                  Farmacologia I — UNIRIO
                </p>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* ═══════ CTA + LOGIN SECTION ═══════ */}
      <div className="relative py-10 sm:py-24 2xl:py-32 landscape-compact-y px-4 sm:px-6 2xl:px-12" style={{ backgroundColor: "#0D1B2A" }}>
        {/* Divider decorativo */}
        <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "linear-gradient(to right, transparent, rgba(247,148,29,0.3), transparent)" }} />

        <div className="max-w-5xl 2xl:max-w-6xl mx-auto">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl sm:text-4xl 2xl:text-5xl font-bold text-white mb-4" style={{ fontFamily: "'Outfit', sans-serif" }}>
              Pronto para a Jornada?
            </h2>
            <p className="text-base sm:text-lg 2xl:text-xl mb-4 max-w-xl 2xl:max-w-2xl mx-auto" style={{ color: "rgba(255,255,255,0.5)" }}>
              Acesse o leaderboard, acompanhe sua equipe e conquiste seus Pontos Farmacológicos!
            </p>
          </motion.div>

          {/* Login Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 2xl:gap-8">
            {/* Student Login Card */}
            <motion.div
              className="relative p-5 sm:p-8 2xl:p-10 rounded-2xl border overflow-hidden group"
              style={{
                backgroundColor: "rgba(247,148,29,0.04)",
                borderColor: "rgba(247,148,29,0.2)",
              }}
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              whileHover={{ borderColor: "#F7941D", boxShadow: "0 0 40px rgba(247,148,29,0.15)" }}
            >
              <div className="absolute top-0 right-0 w-32 h-32 rounded-bl-full opacity-10" style={{ backgroundColor: "#F7941D" }} />
              <div className="relative z-10">
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center mb-4 sm:mb-6" style={{ backgroundColor: "rgba(247,148,29,0.15)" }}>
                  <GraduationCap size={28} className="sm:hidden" style={{ color: "#F7941D" }} />
                  <GraduationCap size={32} className="hidden sm:block" style={{ color: "#F7941D" }} />
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-2" style={{ fontFamily: "'Outfit', sans-serif" }}>
                  Área do Aluno
                </h3>
                <p className="text-sm mb-4 sm:mb-6" style={{ color: "rgba(255,255,255,0.5)" }}>
                  Acesse o leaderboard, acompanhe seus Pontos Farmacológicos, veja o ranking da sua equipe e confira os avisos.
                </p>
                <div className="space-y-3">
                  {isStudentAuth ? (
                    <button
                      onClick={() => setLocation("/leaderboard")}
                      className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-base transition-all duration-300 hover:scale-[1.02]"
                      style={{ backgroundColor: "#F7941D", color: "#fff" }}
                    >
                      <Trophy size={18} />
                      Acessar Plataforma
                      <ArrowRight size={18} />
                    </button>
                  ) : (
                    <button
                      onClick={() => setLocation("/login-aluno")}
                      className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-semibold text-base transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:brightness-110 min-h-[48px]"
                      style={{ backgroundColor: "#F7941D", color: "#fff" }}
                    >
                      <LogIn size={18} />
                      Fazer Login / Cadastrar
                    </button>
                  )}
                </div>
              </div>
            </motion.div>

            {/* Professor Card */}
            <motion.div
              className="relative p-5 sm:p-8 2xl:p-10 rounded-2xl border overflow-hidden group"
              style={{
                backgroundColor: "rgba(74,74,74,0.08)",
                borderColor: "rgba(255,255,255,0.1)",
              }}
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              whileHover={{ borderColor: "rgba(255,255,255,0.3)", boxShadow: "0 0 40px rgba(255,255,255,0.05)" }}
            >
              <div className="absolute top-0 right-0 w-32 h-32 rounded-bl-full opacity-5" style={{ backgroundColor: "#fff" }} />
              <div className="relative z-10">
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center mb-4 sm:mb-6" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
                  <Shield size={28} className="sm:hidden" style={{ color: "#ccc" }} />
                  <Shield size={32} className="hidden sm:block" style={{ color: "#ccc" }} />
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-2" style={{ fontFamily: "'Outfit', sans-serif" }}>
                  Área do Professor
                </h3>
                <p className="text-sm mb-4 sm:mb-6" style={{ color: "rgba(255,255,255,0.5)" }}>
                  Gerencie equipes, atualize PF dos alunos, publique avisos, controle atividades e configure o sistema.
                </p>
                <div className="space-y-3">
                  <button
                    onClick={() => setLocation("/professor/login")}
                    className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-semibold text-base transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:bg-white/20 min-h-[48px]"
                    style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "#fff", border: "1px solid rgba(255,255,255,0.15)" }}
                  >
                    <LogIn size={18} />
                    Fazer Login / Cadastrar
                  </button>

                </div>
              </div>
            </motion.div>


            {/* Monitor Card */}
            <motion.div
              className="relative p-5 sm:p-8 2xl:p-10 rounded-2xl border overflow-hidden group"
              style={{
                backgroundColor: "rgba(16,185,129,0.06)",
                borderColor: "rgba(16,185,129,0.2)",
              }}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.15 }}
              whileHover={{ borderColor: "rgba(16,185,129,0.5)", boxShadow: "0 0 40px rgba(16,185,129,0.1)" }}
            >
              <div className="absolute top-0 right-0 w-32 h-32 rounded-bl-full opacity-10" style={{ backgroundColor: "#10B981" }} />
              <div className="relative z-10">
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center mb-4 sm:mb-6" style={{ backgroundColor: "rgba(16,185,129,0.15)" }}>
                  <GraduationCap size={28} className="sm:hidden" style={{ color: "#10B981" }} />
                  <GraduationCap size={32} className="hidden sm:block" style={{ color: "#10B981" }} />
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-2" style={{ fontFamily: "'Outfit', sans-serif" }}>
                  Área do Monitor
                </h3>
                <p className="text-sm mb-4 sm:mb-6" style={{ color: "rgba(255,255,255,0.5)" }}>
                  Acesso exclusivo para monitores da disciplina. Gerencie frequências, equipes, recursos e seminários.
                </p>
                <div className="space-y-3">
                  <button
                    onClick={() => setLocation("/monitor")}
                    className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-semibold text-base transition-all duration-300 hover:scale-105 hover:shadow-2xl min-h-[48px]"
                    style={{ backgroundColor: "rgba(16,185,129,0.2)", color: "#10B981", border: "1px solid rgba(16,185,129,0.4)" }}
                  >
                    <LogIn size={18} />
                    Fazer Login
                  </button>
                </div>
              </div>
            </motion.div>

            {/* Admin Card */}
            <motion.div
              className="relative p-5 sm:p-8 2xl:p-10 rounded-2xl border overflow-hidden group sm:col-span-2 lg:col-span-1"
              style={{
                backgroundColor: "rgba(139,92,246,0.06)",
                borderColor: "rgba(139,92,246,0.2)",
              }}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
              whileHover={{ borderColor: "rgba(139,92,246,0.5)", boxShadow: "0 0 40px rgba(139,92,246,0.1)" }}
            >
              <div className="absolute top-0 right-0 w-32 h-32 rounded-bl-full opacity-10" style={{ backgroundColor: "#8B5CF6" }} />
              <div className="relative z-10">
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center mb-4 sm:mb-6" style={{ backgroundColor: "rgba(139,92,246,0.15)" }}>
                  <Lock size={28} className="sm:hidden" style={{ color: "#8B5CF6" }} />
                  <Lock size={32} className="hidden sm:block" style={{ color: "#8B5CF6" }} />
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-2" style={{ fontFamily: "'Outfit', sans-serif" }}>
                  Administrador Geral
                </h3>
                <p className="text-sm mb-4 sm:mb-6" style={{ color: "rgba(255,255,255,0.5)" }}>
                  Acesso restrito. Gerencie turmas, importe alunos, configure equipes, códigos de convite e configurações do sistema.
                </p>
                <div className="space-y-3">
                  {localStorage.getItem("adminRole") === "super_admin" && localStorage.getItem("sessionToken") ? (
                    <button
                      onClick={() => setLocation("/admin")}
                      className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-base transition-all duration-300 hover:scale-[1.02]"
                      style={{ backgroundColor: "#8B5CF6", color: "#fff" }}
                    >
                      <Shield size={18} />
                      Acessar Painel
                      <ArrowRight size={18} />
                    </button>
                  ) : (
                    <button
                      onClick={() => setLocation("/super-admin/login")}
                      className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-semibold text-base transition-all duration-300 hover:scale-105 hover:shadow-2xl min-h-[48px]"
                      style={{ backgroundColor: "rgba(139,92,246,0.15)", color: "#fff", border: "1px solid rgba(139,92,246,0.3)" }}
                    >
                      <LogIn size={18} />
                      Fazer Login
                    </button>
                  )}
                </div>
              </div>
            </motion.div>

          </div>

          {/* YouTube CTA - Botão com Logotipo */}
          <div className="flex justify-center mt-8">
            <YouTubeButton channelUrl={YOUTUBE_URL} />
          </div>
        </div>
      </div>

      {/* ═══════ RECENT VIDEOS SECTION ═══════ */}
      <div className="relative" style={{ backgroundColor: "#0A1628" }}>
        <RecentVideos />
      </div>

      {/* ═══════ FOOTER ═══════ */}
      <footer className="py-8 2xl:py-12 px-4 2xl:px-8 border-t" style={{ borderColor: "rgba(255,255,255,0.06)", backgroundColor: "#0A1628" }}>
        <div className="max-w-6xl 2xl:max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div className="flex items-center gap-3">
            <img src={LOGO_URL} alt="Logo" className="w-8 h-8 object-contain" />
            <span className="text-sm font-semibold text-white/70">Conexão em Farmacologia</span>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-4 text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
            <span>UNIRIO — Farmacologia I — 2026.1</span>
            <span className="hidden sm:inline">•</span>
            <span>Prof. Pedro Braga</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
