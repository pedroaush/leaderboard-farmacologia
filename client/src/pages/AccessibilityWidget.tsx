/**
 * AccessibilityWidget — botão flutuante de acessibilidade, presente em toda
 * a plataforma (montado uma vez no App.tsx).
 *
 * Controles:
 *  - Tamanho da fonte (normal / grande / extra grande)
 *  - Alto contraste (liga/desliga)
 *  - Modo claro/escuro (alterna a classe "dark" na tag <html>, mesmo
 *    mecanismo que o Tailwind já usa nesse projeto — ver index.css:
 *    "@custom-variant dark (&:is(.dark *));")
 *
 * Tudo é persistido no localStorage, pra manter a preferência entre sessões.
 */
import { useState, useEffect, useRef } from "react";
import { Accessibility, Type, Contrast, SunMoon, X } from "lucide-react";

const STORAGE_KEY = "conexao_acessibilidade_prefs";

type FontSize = "normal" | "grande" | "extra-grande";

interface AcessibilidadePrefs {
  fontSize: FontSize;
  highContrast: boolean;
  lightMode: boolean; // true = modo claro (sobrepõe o padrão escuro do site)
}

function loadPrefs(): AcessibilidadePrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { fontSize: "normal", highContrast: false, lightMode: false, ...JSON.parse(raw) };
  } catch {
    // ignora e usa padrão
  }
  return { fontSize: "normal", highContrast: false, lightMode: false };
}

function savePrefs(prefs: AcessibilidadePrefs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

function applyPrefs(prefs: AcessibilidadePrefs) {
  const html = document.documentElement;

  // Tamanho da fonte
  html.classList.remove("a11y-font-grande", "a11y-font-extra-grande");
  if (prefs.fontSize === "grande") html.classList.add("a11y-font-grande");
  if (prefs.fontSize === "extra-grande") html.classList.add("a11y-font-extra-grande");

  // Alto contraste
  html.classList.toggle("a11y-alto-contraste", prefs.highContrast);

  // Modo claro (o site já é escuro por padrão via classe "dark" no html;
  // aqui só REMOVEMOS essa classe pra ativar o modo claro, sem inventar um
  // sistema de tema paralelo)
  if (prefs.lightMode) {
    html.classList.remove("dark");
  } else {
    html.classList.add("dark");
  }
}

export default function AccessibilityWidget() {
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState<AcessibilidadePrefs>(() => loadPrefs());
  const panelRef = useRef<HTMLDivElement>(null);

  // Aplica as preferências sempre que mudarem (e também no carregamento inicial)
  useEffect(() => {
    applyPrefs(prefs);
    savePrefs(prefs);
  }, [prefs]);

  // Fecha o painel ao clicar fora
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const cicloFonte = () => {
    const ordem: FontSize[] = ["normal", "grande", "extra-grande"];
    const atual = ordem.indexOf(prefs.fontSize);
    const proximo = ordem[(atual + 1) % ordem.length];
    setPrefs(p => ({ ...p, fontSize: proximo }));
  };

  const fontSizeLabel = { normal: "A", grande: "A+", "extra-grande": "A++" }[prefs.fontSize];

  return (
    <div
      className="fixed z-[9999] bottom-20 left-4 sm:bottom-6 sm:left-6"
      style={{ fontFamily: "system-ui, sans-serif" }}
    >
      {/* Botão principal */}
      <button
        onClick={() => setOpen(v => !v)}
        aria-label="Abrir opções de acessibilidade"
        aria-expanded={open}
        className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105"
        style={{ backgroundColor: "#1e40af", color: "#fff" }}
      >
        <Accessibility size={24} />
      </button>

      {/* Painel de opções */}
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Opções de acessibilidade"
          className="absolute bottom-14 left-0 w-64 rounded-xl shadow-2xl p-4 space-y-3"
          style={{ backgroundColor: "#111827", border: "1px solid rgba(255,255,255,0.15)", color: "#fff" }}
        >
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-bold">Acessibilidade</p>
            <button onClick={() => setOpen(false)} aria-label="Fechar" className="p-1 rounded hover:bg-white/10">
              <X size={16} />
            </button>
          </div>

          {/* Tamanho da fonte */}
          <button
            onClick={cicloFonte}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors hover:bg-white/10"
            style={{ border: "1px solid rgba(255,255,255,0.15)" }}
          >
            <span className="flex items-center gap-2"><Type size={16} /> Tamanho da fonte</span>
            <span className="font-mono font-bold">{fontSizeLabel}</span>
          </button>

          {/* Alto contraste */}
          <button
            onClick={() => setPrefs(p => ({ ...p, highContrast: !p.highContrast }))}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors hover:bg-white/10"
            style={{ border: "1px solid rgba(255,255,255,0.15)" }}
          >
            <span className="flex items-center gap-2"><Contrast size={16} /> Alto contraste</span>
            <span
              className="w-9 h-5 rounded-full relative transition-colors"
              style={{ backgroundColor: prefs.highContrast ? "#22c55e" : "rgba(255,255,255,0.2)" }}
            >
              <span
                className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
                style={{ left: prefs.highContrast ? "18px" : "2px" }}
              />
            </span>
          </button>

          {/* Modo claro/escuro */}
          <button
            onClick={() => setPrefs(p => ({ ...p, lightMode: !p.lightMode }))}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors hover:bg-white/10"
            style={{ border: "1px solid rgba(255,255,255,0.15)" }}
          >
            <span className="flex items-center gap-2"><SunMoon size={16} /> Modo {prefs.lightMode ? "claro" : "escuro"}</span>
            <span
              className="w-9 h-5 rounded-full relative transition-colors"
              style={{ backgroundColor: prefs.lightMode ? "#22c55e" : "rgba(255,255,255,0.2)" }}
            >
              <span
                className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
                style={{ left: prefs.lightMode ? "18px" : "2px" }}
              />
            </span>
          </button>

          <p className="text-[10px] pt-1" style={{ color: "rgba(255,255,255,0.4)" }}>
            Suas preferências ficam salvas neste navegador.
          </p>
        </div>
      )}
    </div>
  );
}
