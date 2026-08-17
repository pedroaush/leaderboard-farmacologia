/**
 * Lounge Playlist Component
 * Reproduz músicas lounge royalty-free com rotação automática
 */
import { useState, useEffect, useRef } from "react";
import { useAudioContext } from "@/contexts/AudioContext";
import { Music, Play, Pause, SkipForward, Volume2, Volume1, VolumeX } from "lucide-react";

interface Track {
  id: string;
  title: string;
  artist: string;
  duration: number;
  url: string;
}

// Música autoral do projeto Conexão em Farmacologia
const LOUNGE_TRACKS: Track[] = [
  {
    id: "1",
    title: "Conexão em Farmacologia - Mix",
    artist: "Trilha Autoral",
    duration: 240,
    url: "https://files.manuscdn.com/user_upload_by_module/session_file/310419663028318382/dyTXKdfarsaUsmEI.mp3"
  },
];

export default function LoungePlaylist() {
  const audioContext = useAudioContext();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("audioVolume");
      return saved ? parseFloat(saved) : 0.3;
    }
    return 0.3;
  });
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const PLAYER_ID = "lounge-playlist";

  const currentTrack = LOUNGE_TRACKS[currentTrackIndex];

  // Registrar player no contexto global
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    audioContext.registerPlayer(PLAYER_ID, audio);
    
    return () => {
      audioContext.unregisterPlayer(PLAYER_ID);
    };
  }, []);

  // Auto-play next track when current ends
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = () => {
      // Loop na mesma faixa (música autoral em loop contínuo)
      if (audio) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleLoadStart = () => {
      setIsLoading(true);
      setError(null);
    };

    const handleCanPlay = () => {
      setIsLoading(false);
    };

    const handleError = () => {
      setIsLoading(false);
      setError("Erro ao carregar áudio");
      setIsPlaying(false);
    };

    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadstart", handleLoadStart);
    audio.addEventListener("canplay", handleCanPlay);
    audio.addEventListener("error", handleError);

    return () => {
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadstart", handleLoadStart);
      audio.removeEventListener("canplay", handleCanPlay);
      audio.removeEventListener("error", handleError);
    };
  }, []);

  // Auto-play on mount — SÓ se a música não estiver desligada globalmente.
  // Antes disso, esse player tinha seu próprio "silent mode" independente e
  // tocava de qualquer forma, ignorando o botão de mudo do resto da
  // plataforma — essa era a causa real da música "impossível de parar".
  useEffect(() => {
    if (audioContext.isMuted) return;
    if (audioRef.current && !isPlaying) {
      audioRef.current.src = currentTrack.url;
      audioRef.current.load();
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch((err) => {
        console.warn("Autoplay bloqueado pelo navegador:", err);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioContext.isMuted]);

  // Update audio element when track changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.src = currentTrack.url;
      audioRef.current.load();
      if (isPlaying) {
        audioRef.current.play().catch((err) => {
          console.warn("Autoplay blocked:", err);
          setIsPlaying(false);
        });
      }
    }
  }, [currentTrackIndex]);

  // Update volume and save to localStorage
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
    localStorage.setItem("audioVolume", volume.toString());
  }, [volume]);

  // Se o mudo global for ligado enquanto a música está tocando, pausa —
  // reage ao mesmo botão usado no resto da plataforma (StudentArea, Home).
  useEffect(() => {
    if (audioContext.isMuted && audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, [audioContext.isMuted]);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioContext.pauseAudio(PLAYER_ID);
        setIsPlaying(false);
      } else {
        audioContext.playAudio(PLAYER_ID);
        setIsPlaying(true);
      }
    }
  };

  const skipTrack = () => {
    setCurrentTrackIndex((prev) => (prev + 1) % LOUNGE_TRACKS.length);
    setCurrentTime(0);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const progressPercent = (currentTime / currentTrack.duration) * 100;

  return (
    <div className="fixed bottom-4 right-4 z-40">
      <audio
        ref={audioRef}
        preload="auto"
        loop
      />

      {/* Playlist Toggle Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`mb-2 p-3 rounded-full shadow-lg transition-all hover:scale-110 ${audioContext.isMuted ? "" : "animate-pulse"}`}
        style={{
          backgroundColor: audioContext.isMuted ? "rgba(255,255,255,0.15)" : "#F7941D",
          color: "#fff",
        }}
        title={audioContext.isMuted ? "Música desligada" : "Playlist de Lounge"}
      >
        {audioContext.isMuted ? <VolumeX size={24} /> : <Music size={24} />}
      </button>

      {/* Expanded Playlist */}
      {isExpanded && (
        <div
          className="w-80 rounded-lg shadow-2xl p-4 space-y-4 mb-2 max-h-96 overflow-hidden flex flex-col"
          style={{
            backgroundColor: "#0D1B2A",
            border: "1px solid rgba(247, 148, 29, 0.3)",
          }}
        >
          {/* Mudo global — mesmo interruptor usado no resto da plataforma */}
          <button
            onClick={audioContext.toggleMuted}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-colors"
            style={{
              backgroundColor: audioContext.isMuted ? "rgba(255,255,255,0.05)" : "rgba(247,148,29,0.15)",
              color: audioContext.isMuted ? "rgba(255,255,255,0.5)" : "#F7941D",
            }}
          >
            {audioContext.isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
            {audioContext.isMuted ? "Música desligada — toque para ligar" : "Música ligada"}
          </button>

          {/* Current Track Info */}
          <div>
            <h3 className="text-white font-bold text-lg">{currentTrack.title}</h3>
            <p className="text-gray-400 text-sm">{currentTrack.artist}</p>
            {isLoading && <p className="text-xs text-yellow-400 mt-1">Carregando...</p>}
            {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
          </div>

          {/* Progress Bar */}
          <div className="space-y-1">
            <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.1)" }}>
              <div
                className="h-full transition-all"
                style={{
                  backgroundColor: "#F7941D",
                  width: `${progressPercent}%`,
                }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-400">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(currentTrack.duration)}</span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between">
            {/* Play/Pause */}
            <button
              onClick={togglePlay}
              disabled={isLoading}
              className="p-2 rounded-full transition-all hover:scale-110 disabled:opacity-50"
              style={{
                backgroundColor: "#F7941D",
                color: "#fff",
              }}
            >
              {isPlaying ? <Pause size={20} /> : <Play size={20} />}
            </button>

            {/* Skip */}
            <button
              onClick={skipTrack}
              disabled={isLoading}
              className="p-2 rounded-full transition-all hover:scale-110 disabled:opacity-50"
              style={{
                backgroundColor: "rgba(247, 148, 29, 0.3)",
                color: "#F7941D",
              }}
            >
              <SkipForward size={20} />
            </button>

            {/* Volume */}
            <div className="flex items-center gap-1">
              {volume === 0 ? (
                <Volume1 size={16} style={{ color: "#F7941D" }} />
              ) : (
                <Volume2 size={16} style={{ color: "#F7941D" }} />
              )}
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-12"
                style={{
                  accentColor: "#F7941D",
                }}
              />
            </div>
          </div>

          {/* Track List */}
          <div className="space-y-2 overflow-y-auto flex-1">
            <p className="text-xs text-gray-400 font-semibold sticky top-0">PLAYLIST</p>
            {LOUNGE_TRACKS.map((track, index) => (
              <button
                key={track.id}
                onClick={() => {
                  setCurrentTrackIndex(index);
                  setCurrentTime(0);
                  setIsPlaying(true);
                }}
                className="w-full text-left p-2 rounded transition-all hover:bg-opacity-80"
                style={{
                  backgroundColor:
                    index === currentTrackIndex
                      ? "rgba(247, 148, 29, 0.3)"
                      : "rgba(255,255,255,0.05)",
                  color: index === currentTrackIndex ? "#F7941D" : "#fff",
                }}
              >
                <div className="text-sm font-medium truncate">{track.title}</div>
                <div className="text-xs text-gray-400">{track.artist}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}