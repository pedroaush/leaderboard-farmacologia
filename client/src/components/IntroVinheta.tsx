import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";

const LOGO_URL = "/logos/TYglakFwBNwpBXzT.png";
const ORANGE = "#F7941D";

interface IntroVinhetaProps {
  onComplete: () => void;
}

/**
 * Animated intro vinheta inspired by TV show openings
 * Features dynamic transitions, particle effects, and logo reveal
 */
export default function IntroVinheta({ onComplete }: IntroVinhetaProps) {
  const [stage, setStage] = useState(0);
  const [showSkipButton, setShowSkipButton] = useState(false);

  // Check if user has seen intro before
  useEffect(() => {
    const hasSeenIntro = localStorage.getItem("hasSeenIntro");
    if (hasSeenIntro) {
      onComplete();
      return;
    }

    // Show skip button after 1 second
    const skipTimer = setTimeout(() => setShowSkipButton(true), 1000);

    const timers = [
      setTimeout(() => setStage(1), 500),   // Particles appear
      setTimeout(() => setStage(2), 1500),  // Logo appears
      setTimeout(() => setStage(3), 2500),  // Title appears
      setTimeout(() => setStage(4), 3500),  // Fade to main content
      setTimeout(() => {
        localStorage.setItem("hasSeenIntro", "true");
        onComplete();
      }, 4000), // Complete
    ];

    return () => {
      clearTimeout(skipTimer);
      timers.forEach(clearTimeout);
    };
  }, [onComplete]);

  const handleSkip = () => {
    localStorage.setItem("hasSeenIntro", "true");
    onComplete();
  };

  return (
    <AnimatePresence>
      {stage < 4 && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden"
          style={{ backgroundColor: "#0A1628" }}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
        >
          {/* Animated background particles */}
          <div className="absolute inset-0">
            {Array.from({ length: 30 }).map((_, i) => (
              <motion.div
                key={i}
                className="absolute rounded-full"
                style={{
                  width: Math.random() * 8 + 4,
                  height: Math.random() * 8 + 4,
                  backgroundColor: i % 2 === 0 ? ORANGE : "#fff",
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                }}
                initial={{ opacity: 0, scale: 0 }}
                animate={stage >= 1 ? {
                  opacity: [0, 0.6, 0],
                  scale: [0, 1.5, 0],
                  x: [0, (Math.random() - 0.5) * 200],
                  y: [0, (Math.random() - 0.5) * 200],
                } : {}}
                transition={{
                  duration: 2 + Math.random() * 2,
                  repeat: Infinity,
                  delay: Math.random() * 0.5,
                }}
              />
            ))}
          </div>

          {/* Radial gradient overlay */}
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(circle at center, transparent 0%, #0A1628 70%)`,
            }}
          />

          {/* Center content */}
          <div className="relative z-10 flex flex-col items-center gap-8">
            {/* Logo with reveal animation */}
            {stage >= 2 && (
              <motion.div
                initial={{ scale: 0, rotate: -180, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                transition={{
                  type: "spring",
                  stiffness: 200,
                  damping: 20,
                  duration: 0.8,
                }}
                className="relative"
              >
                {/* Glow effect behind logo */}
                <motion.div
                  className="absolute inset-0 rounded-full blur-2xl"
                  style={{ backgroundColor: ORANGE, opacity: 0.3 }}
                  animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.3, 0.5, 0.3],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />

                <img
                  src={LOGO_URL}
                  alt="Conexão em Farmacologia"
                  className="relative w-32 h-32 sm:w-40 sm:h-40 object-contain drop-shadow-2xl"
                />
              </motion.div>
            )}

            {/* Title with staggered letter animation */}
            {stage >= 3 && (
              <motion.div
                className="flex flex-col items-center gap-2"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
              >
                <div className="flex gap-1 overflow-hidden">
                  {"CONEXÃO".split("").map((letter, i) => (
                    <motion.span
                      key={i}
                      className="text-4xl sm:text-6xl font-black"
                      style={{ color: ORANGE }}
                      initial={{ y: 100, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{
                        delay: i * 0.05,
                        type: "spring",
                        stiffness: 300,
                        damping: 20,
                      }}
                    >
                      {letter}
                    </motion.span>
                  ))}
                </div>

                <div className="flex gap-1 overflow-hidden">
                  {"em Farmacologia".split("").map((letter, i) => (
                    <motion.span
                      key={i}
                      className="text-2xl sm:text-3xl font-light text-white"
                      initial={{ y: 100, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{
                        delay: 0.4 + i * 0.03,
                        type: "spring",
                        stiffness: 300,
                        damping: 20,
                      }}
                    >
                      {letter === " " ? "\u00A0" : letter}
                    </motion.span>
                  ))}
                </div>

                {/* Animated underline */}
                <motion.div
                  className="h-1 rounded-full mt-2"
                  style={{ backgroundColor: ORANGE }}
                  initial={{ width: 0 }}
                  animate={{ width: "100%" }}
                  transition={{ delay: 1, duration: 0.6, ease: "easeOut" }}
                />
              </motion.div>
            )}
          </div>

          {/* Skip button */}
          {showSkipButton && stage < 4 && (
            <motion.button
              onClick={handleSkip}
              className="absolute top-6 right-6 px-4 py-2 rounded-lg font-semibold text-sm transition-all hover:scale-105 z-50"
              style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)" }}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              Pular
            </motion.button>
          )}

          {/* Expanding circles effect */}
          {stage >= 2 && (
            <motion.div
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
            >
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="absolute rounded-full border-2"
                  style={{ borderColor: ORANGE, opacity: 0.2 }}
                  initial={{ width: 0, height: 0 }}
                  animate={{
                    width: [0, 800],
                    height: [0, 800],
                    opacity: [0.4, 0],
                  }}
                  transition={{
                    duration: 2,
                    delay: i * 0.3,
                    ease: "easeOut",
                  }}
                />
              ))}
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
