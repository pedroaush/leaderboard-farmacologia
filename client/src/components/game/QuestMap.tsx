import { motion } from "framer-motion";
import { useState, createElement } from "react";
import { Lock, Star, Trophy, Zap, BookOpen, Swords } from "lucide-react";

interface Quest {
  id: number;
  title: string;
  character: string;
  level: number;
  type: "combat" | "puzzle" | "dialogue" | "collection";
  pfReward: number;
  xpReward: number;
  isLocked: boolean;
  isCompleted: boolean;
  position: { x: number; y: number }; // Position on map (percentage)
}

const QUESTS: Quest[] = [
  { id: 1, title: "O Portal da Farmacocinética", character: "Mestre dos Magos", level: 1, type: "puzzle", pfReward: 50, xpReward: 100, isLocked: false, isCompleted: false, position: { x: 10, y: 15 } },
  { id: 2, title: "O Escudo de Sheila", character: "Sheila", level: 1, type: "dialogue", pfReward: 75, xpReward: 150, isLocked: false, isCompleted: false, position: { x: 20, y: 25 } },
  { id: 3, title: "O Cajado de Presto", character: "Presto", level: 2, type: "combat", pfReward: 100, xpReward: 200, isLocked: true, isCompleted: false, position: { x: 35, y: 30 } },
  { id: 4, title: "O Arco de Hank", character: "Hank", level: 2, type: "combat", pfReward: 100, xpReward: 200, isLocked: true, isCompleted: false, position: { x: 50, y: 40 } },
  { id: 5, title: "O Bastão de Bobby", character: "Bobby", level: 3, type: "combat", pfReward: 125, xpReward: 250, isLocked: true, isCompleted: false, position: { x: 45, y: 55 } },
  { id: 6, title: "O Clava de Eric", character: "Eric", level: 3, type: "dialogue", pfReward: 125, xpReward: 250, isLocked: true, isCompleted: false, position: { x: 30, y: 60 } },
  { id: 7, title: "Uni e o Sistema Nervoso", character: "Uni", level: 4, type: "puzzle", pfReward: 150, xpReward: 300, isLocked: true, isCompleted: false, position: { x: 20, y: 70 } },
  { id: 8, title: "Caverna dos Receptores", character: "Venger (Boss)", level: 4, type: "combat", pfReward: 200, xpReward: 400, isLocked: true, isCompleted: false, position: { x: 15, y: 45 } },
  { id: 9, title: "Castelo dos Adrenérgicos", character: "Tiamat", level: 5, type: "collection", pfReward: 175, xpReward: 350, isLocked: true, isCompleted: false, position: { x: 50, y: 20 } },
  { id: 10, title: "Floresta dos Anestésicos", character: "Mestre dos Magos", level: 5, type: "dialogue", pfReward: 175, xpReward: 350, isLocked: true, isCompleted: false, position: { x: 25, y: 35 } },
  { id: 11, title: "Labirinto dos Analgésicos", character: "Hank + Sheila", level: 6, type: "puzzle", pfReward: 200, xpReward: 400, isLocked: true, isCompleted: false, position: { x: 70, y: 50 } },
  { id: 12, title: "Torre dos Anti-inflamatórios", character: "Presto + Bobby", level: 7, type: "combat", pfReward: 225, xpReward: 450, isLocked: true, isCompleted: false, position: { x: 60, y: 30 } },
  { id: 13, title: "Pântano dos Antimicrobianos", character: "Eric + Uni", level: 8, type: "collection", pfReward: 250, xpReward: 500, isLocked: true, isCompleted: false, position: { x: 40, y: 75 } },
  { id: 14, title: "Montanha dos Cardiovasculares", character: "Todos os Heróis", level: 9, type: "puzzle", pfReward: 275, xpReward: 550, isLocked: true, isCompleted: false, position: { x: 75, y: 65 } },
  { id: 15, title: "Abismo dos Psicotrópicos", character: "Dungeon Master + Venger", level: 9, type: "combat", pfReward: 300, xpReward: 600, isLocked: true, isCompleted: false, position: { x: 55, y: 80 } },
  { id: 16, title: "Portal de Retorno - Boss Final", character: "Tiamat (Forma Final)", level: 10, type: "combat", pfReward: 500, xpReward: 1000, isLocked: true, isCompleted: false, position: { x: 85, y: 85 } },
];

const TYPE_ICONS = {
  combat: Swords,
  puzzle: BookOpen,
  dialogue: Star,
  collection: Trophy,
};

interface QuestMapProps {
  onQuestClick?: (questId: number) => void;
  completedQuests?: number[];
  currentLevel?: number;
}

export default function QuestMap({ onQuestClick, completedQuests = [], currentLevel = 1 }: QuestMapProps) {
  const [selectedQuest, setSelectedQuest] = useState<Quest | null>(null);
  const [hoveredQuest, setHoveredQuest] = useState<number | null>(null);

  const getQuestColor = (quest: Quest) => {
    if (quest.isCompleted) return "#10b981"; // Green
    if (quest.isLocked) return "#6b7280"; // Gray
    return "#F7941D"; // Orange
  };

  const getQuestIcon = (quest: Quest) => {
    if (quest.isCompleted) return Star;
    if (quest.isLocked) return Lock;
    const TypeIcon = TYPE_ICONS[quest.type];
    return TypeIcon;
  };

  return (
    <div className="relative w-full h-screen overflow-hidden" style={{ backgroundColor: "#0A1628" }}>
      {/* Background Map */}
      <div className="absolute inset-0">
        <img
          src="/logos/kTVTdKnTVaNYAwXL.png"
          alt="Quest Map"
          className="w-full h-full object-cover opacity-80"
        />
        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0A1628]/60" />
      </div>

      {/* Quest Markers */}
      <div className="relative w-full h-full">
        {QUESTS.map((quest) => {
          const Icon = getQuestIcon(quest);
          const color = getQuestColor(quest);
          const isHovered = hoveredQuest === quest.id;
          const isSelected = selectedQuest?.id === quest.id;

          return (
            <motion.button
              key={quest.id}
              className="absolute"
              style={{
                left: `${quest.position.x}%`,
                top: `${quest.position.y}%`,
                transform: "translate(-50%, -50%)",
              }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{
                scale: isHovered || isSelected ? 1.3 : 1,
                opacity: 1,
              }}
              transition={{ duration: 0.3, delay: quest.id * 0.05 }}
              whileHover={{ scale: 1.3 }}
              whileTap={{ scale: 0.95 }}
              onMouseEnter={() => setHoveredQuest(quest.id)}
              onMouseLeave={() => setHoveredQuest(null)}
              onClick={() => {
                setSelectedQuest(quest);
                if (onQuestClick && !quest.isLocked) {
                  onQuestClick(quest.id);
                }
              }}
              disabled={quest.isLocked}
            >
              {/* Glow effect */}
              {!quest.isLocked && (
                <motion.div
                  className="absolute inset-0 rounded-full blur-xl"
                  style={{ backgroundColor: color }}
                  animate={{
                    opacity: [0.3, 0.6, 0.3],
                    scale: [1, 1.2, 1],
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              )}

              {/* Quest marker */}
              <div
                className="relative w-16 h-16 rounded-full flex items-center justify-center border-4 shadow-2xl"
                style={{
                  backgroundColor: quest.isLocked ? "#1f2937" : color,
                  borderColor: quest.isCompleted ? "#10b981" : "#ffffff40",
                }}
              >
                <Icon size={28} className="text-white" />
                
                {/* Level badge */}
                <div
                  className="absolute -top-2 -right-2 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white border-2 border-white"
                  style={{ backgroundColor: color }}
                >
                  {quest.level}
                </div>
              </div>

              {/* Quest number */}
              <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs font-bold text-white/80">
                #{quest.id}
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Quest Detail Panel */}
      {selectedQuest && (
        <motion.div
          className="absolute bottom-0 left-0 right-0 p-6 border-t-4"
          style={{
            backgroundColor: "#0A1628ee",
            borderColor: getQuestColor(selectedQuest),
          }}
          initial={{ y: 300 }}
          animate={{ y: 0 }}
          exit={{ y: 300 }}
        >
          <button
            onClick={() => setSelectedQuest(null)}
            className="absolute top-4 right-4 text-white/60 hover:text-white text-2xl"
          >
            ×
          </button>

          <div className="max-w-4xl mx-auto">
            <div className="flex items-start gap-6">
              {/* Quest Icon */}
              <div
                className="w-24 h-24 rounded-2xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: getQuestColor(selectedQuest) }}
              >
                {createElement(getQuestIcon(selectedQuest), {
                  size: 48,
                  className: "text-white",
                })}
              </div>

              {/* Quest Info */}
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-2xl font-bold text-white">{selectedQuest.title}</h2>
                  <span
                    className="px-3 py-1 rounded-full text-sm font-semibold text-white"
                    style={{ backgroundColor: getQuestColor(selectedQuest) }}
                  >
                    Nível {selectedQuest.level}
                  </span>
                </div>

                <p className="text-white/70 mb-4">
                  <strong>Personagem:</strong> {selectedQuest.character}
                </p>

                <div className="flex items-center gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <Zap size={18} className="text-orange-400" />
                    <span className="text-white">
                      <strong>{selectedQuest.pfReward}</strong> PF
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Star size={18} className="text-yellow-400" />
                    <span className="text-white">
                      <strong>{selectedQuest.xpReward}</strong> XP
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {createElement(TYPE_ICONS[selectedQuest.type], {
                      size: 18,
                      className: "text-blue-400",
                    })}
                    <span className="text-white capitalize">{selectedQuest.type}</span>
                  </div>
                </div>

                {/* Action Button */}
                <div className="mt-6">
                  {selectedQuest.isCompleted ? (
                    <button
                      disabled
                      className="px-6 py-3 rounded-xl font-semibold text-white bg-green-600 opacity-50 cursor-not-allowed"
                    >
                      ✓ Missão Completa
                    </button>
                  ) : selectedQuest.isLocked ? (
                    <button
                      disabled
                      className="px-6 py-3 rounded-xl font-semibold text-white/50 bg-gray-700 cursor-not-allowed flex items-center gap-2"
                    >
                      <Lock size={18} />
                      Bloqueada
                    </button>
                  ) : (
                    <button
                      className="px-6 py-3 rounded-xl font-semibold text-white transition-all hover:scale-105"
                      style={{ backgroundColor: "#F7941D" }}
                    >
                      Iniciar Missão →
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-6 bg-gradient-to-b from-[#0A1628] to-transparent">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-1" style={{ fontFamily: "'Outfit', sans-serif" }}>
              Mapa de Missões
            </h1>
            <p className="text-white/60 text-sm">
              Caverna do Dragão • Farmacologia I
            </p>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-right">
              <div className="text-2xl font-bold text-white">0 / 16</div>
              <div className="text-xs text-white/60">Missões Completas</div>
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="absolute bottom-6 right-6 bg-[#0A1628ee] p-4 rounded-xl border border-white/10">
        <div className="text-xs text-white/60 mb-2 font-semibold">LEGENDA</div>
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-[#F7941D]" />
            <span className="text-white/80">Disponível</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-gray-600" />
            <span className="text-white/80">Bloqueada</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-green-600" />
            <span className="text-white/80">Completa</span>
          </div>
        </div>
      </div>
    </div>
  );
}
