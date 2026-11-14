import { motion } from "framer-motion";
import { useState } from "react";
import { Check, Sparkles } from "lucide-react";

interface Character {
  id: string;
  name: string;
  role: string;
  description: string;
  imagePath: string;
  stats: {
    intelligence: number;
    agility: number;
    strength: number;
    magic: number;
  };
  specialAbility: string;
}

const CHARACTERS: Character[] = [
  {
    id: "hank",
    name: "Hank",
    role: "Guardião",
    description: "Líder corajoso com arco de energia. Especialista em estratégia e farmacodinâmica.",
    imagePath: "/logos/AsKqpDGcnYabRcGy.png",
    stats: { intelligence: 85, agility: 70, strength: 80, magic: 60 },
    specialAbility: "Foco Preciso: +20% chance de acerto em questões de dose-resposta",
  },
  {
    id: "eric",
    name: "Eric",
    role: "Cavaleiro",
    description: "Cavaleiro valente com escudo mágico. Mestre em defesa e antagonistas farmacológicos.",
    imagePath: "/logos/SahuGNPuHBuCZtmf.png",
    stats: { intelligence: 70, agility: 60, strength: 90, magic: 50 },
    specialAbility: "Escudo Bloqueador: +15% bônus em questões sobre antagonistas",
  },
  {
    id: "diana",
    name: "Diana",
    role: "Acrobata",
    description: "Atleta ágil com cajado solar. Especialista em farmacocinética e absorção.",
    imagePath: "/logos/LapxklOViNUkmzlE.png",
    stats: { intelligence: 80, agility: 95, strength: 65, magic: 70 },
    specialAbility: "Movimento Rápido: -10% tempo para responder questões",
  },
  {
    id: "presto",
    name: "Presto",
    role: "Mago",
    description: "Jovem mago com chapéu vermelho. Gênio em receptores e mecanismos moleculares.",
    imagePath: "/logos/CWntVFVrUoDFWKLk.png",
    stats: { intelligence: 100, agility: 50, strength: 40, magic: 95 },
    specialAbility: "Sabedoria Arcana: +25% PF em todas as missões",
  },
  {
    id: "sheila",
    name: "Sheila",
    role: "Ladina",
    description: "Misteriosa com capa de invisibilidade. Especialista em distribuição e barreiras.",
    imagePath: "/logos/BbHavQVGwRRCiaEE.png",
    stats: { intelligence: 75, agility: 85, strength: 55, magic: 80 },
    specialAbility: "Furtividade: Pode pular 1 questão por missão sem perder PF",
  },
  {
    id: "bobby",
    name: "Bobby",
    role: "Bárbaro",
    description: "Jovem guerreiro com clava mágica. Forte em agonistas e ativação de receptores.",
    imagePath: "/logos/xqwFVCzVDbmCgHqZ.png",
    stats: { intelligence: 65, agility: 70, strength: 85, magic: 55 },
    specialAbility: "Força Bruta: +30% dano em combates contra bosses",
  },
  {
    id: "uni",
    name: "Uni",
    role: "Unicórnio",
    description: "Unicórnio mágico companheiro. Mestre em sistema nervoso e neurotransmissores.",
    imagePath: "/logos/sTJzQUplnCnMpmyg.png",
    stats: { intelligence: 90, agility: 80, strength: 50, magic: 100 },
    specialAbility: "Cura Mágica: Recupera 1 vida extra por missão completada",
  },
];

interface CharacterSelectProps {
  onSelect: (characterId: string) => void;
}

export default function CharacterSelect({ onSelect }: CharacterSelectProps) {
  const [selectedChar, setSelectedChar] = useState<string | null>(null);
  const [hoveredChar, setHoveredChar] = useState<string | null>(null);

  const selectedCharacter = CHARACTERS.find((c) => c.id === selectedChar);

  const handleConfirm = () => {
    if (selectedChar) {
      onSelect(selectedChar);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ backgroundColor: "#0A1628" }}
    >
      {/* Header */}
      <motion.div
        className="text-center mb-8"
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <h1
          className="text-5xl font-bold text-white mb-3"
          style={{ fontFamily: "'Outfit', sans-serif" }}
        >
          Escolha Seu Herói
        </h1>
        <p className="text-white/70 text-lg">
          Caverna do Dragão • Farmacologia I
        </p>
      </motion.div>

      {/* Character Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-8 max-w-7xl">
        {CHARACTERS.map((char, index) => {
          const isSelected = selectedChar === char.id;
          const isHovered = hoveredChar === char.id;

          return (
            <motion.button
              key={char.id}
              className="relative group"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onMouseEnter={() => setHoveredChar(char.id)}
              onMouseLeave={() => setHoveredChar(null)}
              onClick={() => setSelectedChar(char.id)}
            >
              {/* Glow effect */}
              {(isSelected || isHovered) && (
                <motion.div
                  className="absolute inset-0 rounded-2xl blur-xl"
                  style={{ backgroundColor: "#F7941D" }}
                  animate={{
                    opacity: [0.3, 0.6, 0.3],
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              )}

              {/* Character Card */}
              <div
                className={`relative bg-gradient-to-b from-gray-800 to-gray-900 rounded-2xl overflow-hidden border-4 transition-all ${
                  isSelected
                    ? "border-[#F7941D] shadow-2xl"
                    : "border-transparent"
                }`}
              >
                {/* Character Image */}
                <div className="aspect-[3/4] overflow-hidden">
                  <img
                    src={char.imagePath}
                    alt={char.name}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Character Info Overlay */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-3">
                  <h3 className="text-white font-bold text-lg">{char.name}</h3>
                  <p className="text-white/70 text-xs">{char.role}</p>
                </div>

                {/* Selected Check */}
                {isSelected && (
                  <motion.div
                    className="absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: "#F7941D" }}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                  >
                    <Check size={20} className="text-white" />
                  </motion.div>
                )}
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Character Details Panel */}
      {selectedCharacter && (
        <motion.div
          className="max-w-4xl w-full bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-6 border-4 mb-6"
          style={{ borderColor: "#F7941D" }}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex gap-6">
            {/* Character Portrait */}
            <div className="w-48 h-64 rounded-xl overflow-hidden shrink-0">
              <img
                src={selectedCharacter.imagePath}
                alt={selectedCharacter.name}
                className="w-full h-full object-cover"
              />
            </div>

            {/* Character Info */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-3xl font-bold text-white">
                  {selectedCharacter.name}
                </h2>
                <span
                  className="px-3 py-1 rounded-full text-sm font-semibold text-white"
                  style={{ backgroundColor: "#F7941D" }}
                >
                  {selectedCharacter.role}
                </span>
              </div>

              <p className="text-white/80 mb-4">{selectedCharacter.description}</p>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                {Object.entries(selectedCharacter.stats).map(([stat, value]) => (
                  <div key={stat}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-white/70 text-sm capitalize">
                        {stat === "intelligence" && "Inteligência"}
                        {stat === "agility" && "Agilidade"}
                        {stat === "strength" && "Força"}
                        {stat === "magic" && "Magia"}
                      </span>
                      <span className="text-white font-bold text-sm">{value}</span>
                    </div>
                    <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full"
                        style={{ backgroundColor: "#F7941D" }}
                        initial={{ width: 0 }}
                        animate={{ width: `${value}%` }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Special Ability */}
              <div className="bg-[#F7941D]/10 border border-[#F7941D]/30 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles size={18} className="text-[#F7941D]" />
                  <span className="text-[#F7941D] font-semibold text-sm">
                    Habilidade Especial
                  </span>
                </div>
                <p className="text-white/90 text-sm">
                  {selectedCharacter.specialAbility}
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Confirm Button */}
      {selectedChar && (
        <motion.button
          onClick={handleConfirm}
          className="px-8 py-4 rounded-xl font-bold text-white text-lg shadow-2xl transition-all hover:scale-105"
          style={{ backgroundColor: "#F7941D" }}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          Confirmar Herói →
        </motion.button>
      )}
    </div>
  );
}
