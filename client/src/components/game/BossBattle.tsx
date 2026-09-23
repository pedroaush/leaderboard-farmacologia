import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Shield, Sword, Heart, Zap, Star, Trophy, Skull,
  ArrowLeft, Timer, Flame, ChevronRight, AlertTriangle, RotateCcw
} from "lucide-react";

// ═══════════════════════════════════════
// HERO AVATAR IMAGES
// ═══════════════════════════════════════
const HERO_IMAGES = {
  idle: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663038327412/kwzBmmnYSpOpUuWI.png",
  attack: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663038327412/geTmiCzwyIxiizrk.png",
  defeated: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663038327412/qTmvMkatpNAucyRM.png",
};

const BATTLE_SCENES = {
  victory: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663038327412/vaNACrYrOCYvaVZD.png",
  defeat: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663038327412/mnlOkwxnLBBFRuFl.png",
};

// Fallback videos (generic) - used for bosses 10-17 until specific videos are generated
const BATTLE_VIDEOS_FALLBACK = {
  victory_male: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663038327412/IKwJEQhKZqDkdtVJ.mp4",
  victory_female: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663038327412/IKwJEQhKZqDkdtVJ.mp4",
  defeat_male: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663038327412/BLrSVgfJWgCNUCif.mp4",
  defeat_female: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663038327412/BLrSVgfJWgCNUCif.mp4",
};

// Per-boss videos with gender variants (bosses 1-9 complete, 10-17 use fallback)
const BOSS_VIDEOS: Record<number, { victory_male: string; victory_female: string; defeat_male: string; defeat_female: string }> = {
  1: {
    victory_male: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663038327412/gVvPDieekXASsBPa.mp4",
    victory_female: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663038327412/IBRXmtOIwFbRNeDo.mp4",
    defeat_male: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663038327412/rtbwIHSyjoKHwbhL.mp4",
    defeat_female: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663038327412/KQwqrReJstTwKHRJ.mp4",
  },
  2: {
    victory_male: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663038327412/JdKjWQFMsAklXiki.mp4",
    victory_female: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663038327412/UcKaEhuQMcwqtqhV.mp4",
    defeat_male: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663038327412/JCEhYscCjvwKdrvJ.mp4",
    defeat_female: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663038327412/IwrBToEyoJegMOQX.mp4",
  },
  3: {
    victory_male: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663038327412/gIqhXqNYfmkRbkqE.mp4",
    victory_female: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663038327412/OSsODTTyIaePMyML.mp4",
    defeat_male: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663038327412/gidyvyrLaQGuRqjH.mp4",
    defeat_female: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663038327412/oktcAbfUxDZAtSrB.mp4",
  },
  4: {
    victory_male: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663038327412/bsxtJuHdqgVKCspX.mp4",
    victory_female: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663038327412/fiJgsLlZYkyxOSjO.mp4",
    defeat_male: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663038327412/tyMBmWXGtgTFJNmX.mp4",
    defeat_female: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663038327412/NOnOlblMuodmmEmq.mp4",
  },
  5: {
    victory_male: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663038327412/BArJDzgHpdSvJjfa.mp4",
    victory_female: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663038327412/RwauQkvXzXTXPerX.mp4",
    defeat_male: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663038327412/CezIDuEbkLkoxymM.mp4",
    defeat_female: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663038327412/cQFZHFzjYSlucHwi.mp4",
  },
  6: {
    victory_male: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663038327412/AJuhomYSWDJuXmJP.mp4",
    victory_female: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663038327412/xOBtNOZJNgSiiSNe.mp4",
    defeat_male: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663038327412/BdxLJVWVPzRekyqV.mp4",
    defeat_female: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663038327412/hiIHajUFyeAKCwQF.mp4",
  },
  7: {
    victory_male: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663038327412/kYiflbwmpvXhmIua.mp4",
    victory_female: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663038327412/xRCaEcDKctkJLPfy.mp4",
    defeat_male: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663038327412/ynqvzDjnlIfftIrR.mp4",
    defeat_female: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663038327412/xLlDvwNzaxsxEXQs.mp4",
  },
  8: {
    victory_male: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663038327412/NkySISvKfUKkCAwe.mp4",
    victory_female: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663038327412/OYUiwmyfbwueAoEh.mp4",
    defeat_male: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663038327412/TfciSQskYaZOnwfi.mp4",
    defeat_female: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663038327412/YRUBfzcbQpzuzvbF.mp4",
  },
  9: {
    victory_male: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663038327412/CGPBgvjrbYfbewfm.mp4",
    victory_female: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663038327412/cmBtYgGNeYXFYcbs.mp4",
    defeat_male: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663038327412/TGNjrnSQLOLnjOCq.mp4",
    defeat_female: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663038327412/OsFqLdYljSqGvKtx.mp4",
  },
};

function getBossVideo(bossId: number, type: "victory" | "defeat", gender: "male" | "female"): string {
  const key = `${type}_${gender}` as keyof typeof BATTLE_VIDEOS_FALLBACK;
  return BOSS_VIDEOS[bossId]?.[key] ?? BATTLE_VIDEOS_FALLBACK[key];
}

// ═══════════════════════════════════════
// BOSS DATA - 17 bosses, 1 per week
// ═══════════════════════════════════════

interface BossQuestion {
  question: string;
  alternatives: { id: string; text: string }[];
  correctAnswer: string;
  explanation: string;
}

interface BossPhase {
  name: string;
  questions: BossQuestion[];
}

interface BossData {
  id: number;
  weekNumber: number;
  name: string;
  title: string;
  emoji: string;
  imageUrl?: string;
  color: string;
  hp: number;
  playerHp: number;
  pfReward: number;
  xpReward: number;
  phases: BossPhase[];
}

const BOSSES: BossData[] = [
  {
    id: 1, weekNumber: 1, name: "Guardião do Portal", title: "Sentinela da Farmacocinética",
    emoji: "🛡️", imageUrl: "https://files.manuscdn.com/user_upload_by_module/session_file/310419663028318382/JbsXuycNvrmiUuhC.png", color: "#3b82f6", hp: 300, playerHp: 100, pfReward: 25, xpReward: 200,
    phases: [
      { name: "Absorção", questions: [
        { question: "Qual via de administração tem 100% de biodisponibilidade?", alternatives: [{ id: "a", text: "Oral" }, { id: "b", text: "Intravenosa" }, { id: "c", text: "Sublingual" }, { id: "d", text: "Retal" }], correctAnswer: "b", explanation: "A via IV injeta o fármaco diretamente na corrente sanguínea, garantindo biodisponibilidade de 100%." },
        { question: "O que é efeito de primeira passagem?", alternatives: [{ id: "a", text: "Metabolismo hepático antes de atingir a circulação sistêmica" }, { id: "b", text: "Absorção no estômago" }, { id: "c", text: "Excreção renal imediata" }, { id: "d", text: "Ligação a proteínas plasmáticas" }], correctAnswer: "a", explanation: "O efeito de primeira passagem é o metabolismo do fármaco pelo fígado antes de alcançar a circulação sistêmica." },
      ]},
      { name: "Distribuição", questions: [
        { question: "Qual fator AUMENTA o volume de distribuição de um fármaco?", alternatives: [{ id: "a", text: "Alta ligação a proteínas plasmáticas" }, { id: "b", text: "Alta lipossolubilidade" }, { id: "c", text: "Baixo peso molecular apenas" }, { id: "d", text: "Alta ionização em pH fisiológico" }], correctAnswer: "b", explanation: "Fármacos lipofílicos se distribuem amplamente pelos tecidos, aumentando o Vd." },
      ]},
      { name: "Eliminação", questions: [
        { question: "O que representa a meia-vida (t½) de um fármaco?", alternatives: [{ id: "a", text: "Tempo para absorver 50% da dose" }, { id: "b", text: "Tempo para a concentração plasmática cair pela metade" }, { id: "c", text: "Tempo para atingir o pico plasmático" }, { id: "d", text: "Tempo para excretar 100% do fármaco" }], correctAnswer: "b", explanation: "A meia-vida é o tempo necessário para que a concentração plasmática do fármaco seja reduzida em 50%." },
      ]},
    ],
  },
  {
    id: 2, weekNumber: 2, name: "Quimera dos Receptores", title: "Besta da Farmacodinâmica",
    emoji: "🐲", imageUrl: "https://files.manuscdn.com/user_upload_by_module/session_file/310419663028318382/mEsWljGyRXvvuUgf.png", color: "#8b5cf6", hp: 350, playerHp: 100, pfReward: 30, xpReward: 250,
    phases: [
      { name: "Receptores", questions: [
        { question: "Qual tipo de receptor tem ação mais RÁPIDA?", alternatives: [{ id: "a", text: "Receptor acoplado a proteína G" }, { id: "b", text: "Canal iônico regulado por ligante" }, { id: "c", text: "Receptor nuclear" }, { id: "d", text: "Receptor tirosina quinase" }], correctAnswer: "b", explanation: "Canais iônicos regulados por ligante abrem em milissegundos, sendo os mais rápidos." },
        { question: "O que é potência de um fármaco?", alternatives: [{ id: "a", text: "Efeito máximo que o fármaco produz" }, { id: "b", text: "Concentração necessária para produzir 50% do efeito máximo (EC50)" }, { id: "c", text: "Velocidade de absorção" }, { id: "d", text: "Duração do efeito" }], correctAnswer: "b", explanation: "Potência refere-se à EC50: quanto menor, mais potente o fármaco." },
      ]},
      { name: "Agonistas", questions: [
        { question: "Um agonista parcial, comparado a um agonista total, tem:", alternatives: [{ id: "a", text: "Maior eficácia máxima" }, { id: "b", text: "Menor eficácia máxima" }, { id: "c", text: "Mesma eficácia, menor potência" }, { id: "d", text: "Nenhum efeito" }], correctAnswer: "b", explanation: "Agonistas parciais não conseguem produzir o efeito máximo mesmo em doses altas." },
      ]},
      { name: "Antagonistas", questions: [
        { question: "Um antagonista competitivo reversível pode ser superado por:", alternatives: [{ id: "a", text: "Diminuir a dose do agonista" }, { id: "b", text: "Aumentar a concentração do agonista" }, { id: "c", text: "Adicionar outro antagonista" }, { id: "d", text: "Nada, o bloqueio é permanente" }], correctAnswer: "b", explanation: "Antagonistas competitivos reversíveis competem pelo mesmo sítio; aumentar o agonista desloca o equilíbrio." },
      ]},
    ],
  },
  {
    id: 3, weekNumber: 3, name: "Hidra Autonômica", title: "Serpente do SNA",
    emoji: "🐍", imageUrl: "https://files.manuscdn.com/user_upload_by_module/session_file/310419663028318382/jPOGVblAgLnIiLdt.png", color: "#10b981", hp: 400, playerHp: 100, pfReward: 35, xpReward: 300,
    phases: [
      { name: "Simpático", questions: [
        { question: "Qual neurotransmissor é liberado pelos neurônios simpáticos PÓS-ganglionares?", alternatives: [{ id: "a", text: "Acetilcolina" }, { id: "b", text: "Noradrenalina" }, { id: "c", text: "Dopamina" }, { id: "d", text: "Serotonina" }], correctAnswer: "b", explanation: "Os neurônios simpáticos pós-ganglionares liberam noradrenalina (exceto glândulas sudoríparas)." },
        { question: "A ativação simpática causa qual efeito no coração?", alternatives: [{ id: "a", text: "Bradicardia" }, { id: "b", text: "Taquicardia" }, { id: "c", text: "Nenhum efeito" }, { id: "d", text: "Arritmia sempre" }], correctAnswer: "b", explanation: "A estimulação simpática via receptores β1 aumenta a frequência e a força de contração cardíaca." },
      ]},
      { name: "Parassimpático", questions: [
        { question: "Qual receptor é responsável pela bradicardia induzida pela acetilcolina no coração?", alternatives: [{ id: "a", text: "Nicotínico" }, { id: "b", text: "Muscarínico M2" }, { id: "c", text: "Muscarínico M1" }, { id: "d", text: "Beta-1 adrenérgico" }], correctAnswer: "b", explanation: "Receptores M2 no coração reduzem a frequência cardíaca quando ativados pela ACh." },
      ]},
      { name: "Integração", questions: [
        { question: "A atropina bloqueia receptores muscarínicos. Qual efeito ela causa no olho?", alternatives: [{ id: "a", text: "Miose" }, { id: "b", text: "Midríase" }, { id: "c", text: "Nenhum efeito" }, { id: "d", text: "Aumento da pressão intraocular apenas" }], correctAnswer: "b", explanation: "A atropina bloqueia M3 no músculo esfíncter da pupila, causando midríase (dilatação)." },
      ]},
    ],
  },
  {
    id: 4, weekNumber: 4, name: "Venger, o Senhor Colinérgico", title: "Mestre dos Receptores Muscarínicos",
    emoji: "😈", imageUrl: "https://files.manuscdn.com/user_upload_by_module/session_file/310419663028318382/IJclFIdvDkbZLdKj.png", color: "#ef4444", hp: 450, playerHp: 100, pfReward: 40, xpReward: 350,
    phases: [
      { name: "Colinérgicos Diretos", questions: [
        { question: "Qual fármaco colinérgico é usado no tratamento do glaucoma?", alternatives: [{ id: "a", text: "Atropina" }, { id: "b", text: "Pilocarpina" }, { id: "c", text: "Tubocurarina" }, { id: "d", text: "Adrenalina" }], correctAnswer: "b", explanation: "A pilocarpina é um agonista muscarínico que contrai o músculo ciliar, facilitando a drenagem do humor aquoso." },
        { question: "A betanecol é usada para tratar:", alternatives: [{ id: "a", text: "Hipertensão" }, { id: "b", text: "Retenção urinária pós-operatória" }, { id: "c", text: "Asma" }, { id: "d", text: "Taquicardia" }], correctAnswer: "b", explanation: "A betanecol estimula receptores M3 na bexiga, promovendo contração do detrusor." },
      ]},
      { name: "Anticolinesterásicos", questions: [
        { question: "Qual anticolinesterásico é usado no tratamento da miastenia gravis?", alternatives: [{ id: "a", text: "Donepezila" }, { id: "b", text: "Neostigmina" }, { id: "c", text: "Sarin" }, { id: "d", text: "Atropina" }], correctAnswer: "b", explanation: "A neostigmina inibe reversivelmente a AChE, aumentando a ACh na junção neuromuscular." },
      ]},
      { name: "Anticolinérgicos", questions: [
        { question: "O ipratrópio é usado na asma porque:", alternatives: [{ id: "a", text: "Estimula receptores β2" }, { id: "b", text: "Bloqueia receptores muscarínicos nos brônquios" }, { id: "c", text: "Inibe a fosfodiesterase" }, { id: "d", text: "Bloqueia receptores H1" }], correctAnswer: "b", explanation: "O ipratrópio é um antagonista muscarínico que causa broncodilatação ao bloquear M3 nos brônquios." },
      ]},
    ],
  },
  {
    id: 5, weekNumber: 5, name: "Tiamat, Dragão Adrenérgico", title: "As 5 Cabeças dos Receptores Adrenérgicos",
    emoji: "🐉", imageUrl: "https://files.manuscdn.com/user_upload_by_module/session_file/310419663028318382/EcTqzpkeXTPMTrZC.png", color: "#f59e0b", hp: 500, playerHp: 100, pfReward: 45, xpReward: 400,
    phases: [
      { name: "Agonistas Adrenérgicos", questions: [
        { question: "A adrenalina ativa quais receptores?", alternatives: [{ id: "a", text: "Apenas α1" }, { id: "b", text: "Apenas β1 e β2" }, { id: "c", text: "Todos os receptores adrenérgicos (α e β)" }, { id: "d", text: "Apenas receptores muscarínicos" }], correctAnswer: "c", explanation: "A adrenalina é um agonista não-seletivo que ativa todos os receptores α e β adrenérgicos." },
        { question: "Qual agonista β2 seletivo é usado como broncodilatador na asma?", alternatives: [{ id: "a", text: "Propranolol" }, { id: "b", text: "Salbutamol" }, { id: "c", text: "Fenilefrina" }, { id: "d", text: "Clonidina" }], correctAnswer: "b", explanation: "O salbutamol é um agonista β2 seletivo que relaxa a musculatura brônquica." },
      ]},
      { name: "Antagonistas α", questions: [
        { question: "A prazosina é usada na hipertensão porque bloqueia receptores:", alternatives: [{ id: "a", text: "β1 cardíacos" }, { id: "b", text: "α1 vasculares" }, { id: "c", text: "α2 pré-sinápticos" }, { id: "d", text: "β2 brônquicos" }], correctAnswer: "b", explanation: "A prazosina bloqueia α1 nos vasos, causando vasodilatação e redução da pressão arterial." },
      ]},
      { name: "Antagonistas β", questions: [
        { question: "Por que o propranolol é CONTRAINDICADO em asmáticos?", alternatives: [{ id: "a", text: "Causa taquicardia" }, { id: "b", text: "Bloqueia β2 nos brônquios, causando broncoconstrição" }, { id: "c", text: "Aumenta a pressão arterial" }, { id: "d", text: "Causa hipoglicemia sempre" }], correctAnswer: "b", explanation: "O propranolol é não-seletivo e bloqueia β2 brônquicos, podendo precipitar broncoespasmo em asmáticos." },
      ]},
    ],
  },
  {
    id: 6, weekNumber: 6, name: "Espectro do Sono", title: "Fantasma dos Anestésicos",
    emoji: "👻", imageUrl: "https://files.manuscdn.com/user_upload_by_module/session_file/310419663028318382/ZzpfcLIlXJIelFeC.png", color: "#6366f1", hp: 500, playerHp: 100, pfReward: 45, xpReward: 400,
    phases: [
      { name: "Anestésicos Gerais", questions: [
        { question: "Qual anestésico inalatório tem o MENOR coeficiente de partição sangue/gás (indução mais rápida)?", alternatives: [{ id: "a", text: "Halotano" }, { id: "b", text: "Desflurano" }, { id: "c", text: "Isoflurano" }, { id: "d", text: "Éter" }], correctAnswer: "b", explanation: "O desflurano tem baixo coeficiente de partição sangue/gás, permitindo indução e recuperação rápidas." },
        { question: "O propofol é amplamente usado na indução anestésica porque:", alternatives: [{ id: "a", text: "Tem longa duração de ação" }, { id: "b", text: "Tem início de ação rápido e recuperação suave" }, { id: "c", text: "É um analgésico potente" }, { id: "d", text: "Não causa depressão respiratória" }], correctAnswer: "b", explanation: "O propofol tem início rápido (30-40s IV) e recuperação suave sem náuseas." },
      ]},
      { name: "Anestésicos Locais", questions: [
        { question: "Os anestésicos locais bloqueiam a condução nervosa por:", alternatives: [{ id: "a", text: "Ativar canais de potássio" }, { id: "b", text: "Bloquear canais de sódio voltagem-dependentes" }, { id: "c", text: "Estimular receptores GABA" }, { id: "d", text: "Inibir a liberação de acetilcolina" }], correctAnswer: "b", explanation: "Anestésicos locais bloqueiam canais de Na+ voltagem-dependentes, impedindo a propagação do potencial de ação." },
      ]},
      { name: "Relaxantes Musculares", questions: [
        { question: "A succinilcolina é um bloqueador neuromuscular do tipo:", alternatives: [{ id: "a", text: "Não-despolarizante" }, { id: "b", text: "Despolarizante" }, { id: "c", text: "Competitivo reversível" }, { id: "d", text: "Anticolinesterásico" }], correctAnswer: "b", explanation: "A succinilcolina é um agonista nicotínico que causa despolarização sustentada, resultando em paralisia." },
      ]},
    ],
  },
  {
    id: 7, weekNumber: 7, name: "Golem da Dor", title: "Colosso dos Analgésicos",
    emoji: "🗿", imageUrl: "https://files.manuscdn.com/user_upload_by_module/session_file/310419663028318382/NVIMkchXBsjsYLWQ.png", color: "#dc2626", hp: 550, playerHp: 100, pfReward: 50, xpReward: 450,
    phases: [
      { name: "Opioides", questions: [
        { question: "A morfina exerce seu efeito analgésico principalmente através de receptores:", alternatives: [{ id: "a", text: "μ (mu)" }, { id: "b", text: "δ (delta)" }, { id: "c", text: "κ (kappa)" }, { id: "d", text: "NMDA" }], correctAnswer: "a", explanation: "Os receptores μ são os principais responsáveis pela analgesia, euforia e depressão respiratória dos opioides." },
        { question: "Qual fármaco é o antídoto para overdose de opioides?", alternatives: [{ id: "a", text: "Flumazenil" }, { id: "b", text: "Naloxona" }, { id: "c", text: "Atropina" }, { id: "d", text: "N-acetilcisteína" }], correctAnswer: "b", explanation: "A naloxona é um antagonista competitivo dos receptores opioides, revertendo rapidamente a depressão respiratória." },
      ]},
      { name: "AINEs", questions: [
        { question: "Os AINEs tradicionais inibem:", alternatives: [{ id: "a", text: "Apenas COX-1" }, { id: "b", text: "Apenas COX-2" }, { id: "c", text: "COX-1 e COX-2" }, { id: "d", text: "Lipoxigenase" }], correctAnswer: "c", explanation: "AINEs tradicionais como ibuprofeno e naproxeno inibem tanto COX-1 quanto COX-2." },
      ]},
      { name: "Adjuvantes", questions: [
        { question: "O paracetamol (acetaminofeno) em overdose causa lesão principalmente em qual órgão?", alternatives: [{ id: "a", text: "Rins" }, { id: "b", text: "Fígado" }, { id: "c", text: "Coração" }, { id: "d", text: "Pulmões" }], correctAnswer: "b", explanation: "O metabólito tóxico NAPQI causa necrose hepática. O antídoto é N-acetilcisteína." },
      ]},
    ],
  },
  {
    id: 8, weekNumber: 8, name: "Fênix Inflamatória", title: "Ave de Fogo Anti-inflamatória",
    emoji: "🔥", imageUrl: "https://files.manuscdn.com/user_upload_by_module/session_file/310419663028318382/UBudIpcKSKWfhfCp.png", color: "#f97316", hp: 550, playerHp: 100, pfReward: 50, xpReward: 450,
    phases: [
      { name: "Corticosteroides", questions: [
        { question: "Os glicocorticoides exercem efeito anti-inflamatório principalmente por:", alternatives: [{ id: "a", text: "Inibir a fosfolipase A2 via lipocortina" }, { id: "b", text: "Bloquear receptores de histamina" }, { id: "c", text: "Inibir apenas a COX-2" }, { id: "d", text: "Ativar receptores β2" }], correctAnswer: "a", explanation: "Glicocorticoides induzem lipocortina que inibe a fosfolipase A2, reduzindo prostaglandinas e leucotrienos." },
        { question: "Qual é um efeito adverso do uso crônico de corticosteroides?", alternatives: [{ id: "a", text: "Hipoglicemia" }, { id: "b", text: "Osteoporose" }, { id: "c", text: "Hipotensão" }, { id: "d", text: "Ganho de massa muscular" }], correctAnswer: "b", explanation: "O uso crônico causa osteoporose, síndrome de Cushing, hiperglicemia e imunossupressão." },
      ]},
      { name: "Anti-histamínicos", questions: [
        { question: "Por que a loratadina causa MENOS sonolência que a difenidramina?", alternatives: [{ id: "a", text: "Não bloqueia receptores H1" }, { id: "b", text: "Não atravessa a barreira hematoencefálica significativamente" }, { id: "c", text: "É um agonista H1" }, { id: "d", text: "Atua apenas em receptores H2" }], correctAnswer: "b", explanation: "Anti-histamínicos de 2ª geração como loratadina são menos lipofílicos e penetram pouco no SNC." },
      ]},
      { name: "Imunomoduladores", questions: [
        { question: "O metotrexato, usado em artrite reumatoide, atua como:", alternatives: [{ id: "a", text: "Antagonista de TNF-α" }, { id: "b", text: "Inibidor da di-hidrofolato redutase" }, { id: "c", text: "Agonista de corticosteroides" }, { id: "d", text: "Bloqueador de IL-6" }], correctAnswer: "b", explanation: "O metotrexato inibe a DHFR, reduzindo a síntese de purinas e a proliferação de células imunes." },
      ]},
    ],
  },
  {
    id: 9, weekNumber: 9, name: "Praga Bacteriana", title: "Enxame dos Antimicrobianos",
    emoji: "🦠", imageUrl: "https://files.manuscdn.com/user_upload_by_module/session_file/310419663028318382/saoQUPkDvEHxSsfW.png", color: "#14b8a6", hp: 600, playerHp: 100, pfReward: 55, xpReward: 500,
    phases: [
      { name: "β-Lactâmicos", questions: [
        { question: "As penicilinas atuam inibindo:", alternatives: [{ id: "a", text: "A síntese proteica no ribossomo 30S" }, { id: "b", text: "A síntese da parede celular (transpeptidases/PBPs)" }, { id: "c", text: "A síntese de ácido fólico" }, { id: "d", text: "A DNA girase" }], correctAnswer: "b", explanation: "β-lactâmicos inibem as transpeptidases (PBPs), impedindo a síntese de peptidoglicano da parede celular." },
        { question: "A associação amoxicilina + ácido clavulânico é útil porque:", alternatives: [{ id: "a", text: "O ácido clavulânico é um antibiótico mais potente" }, { id: "b", text: "O ácido clavulânico inibe β-lactamases bacterianas" }, { id: "c", text: "Aumenta a absorção oral" }, { id: "d", text: "Reduz efeitos colaterais" }], correctAnswer: "b", explanation: "O ácido clavulânico é um inibidor de β-lactamases, protegendo a amoxicilina da degradação enzimática." },
      ]},
      { name: "Quinolonas e Macrolídeos", questions: [
        { question: "As fluoroquinolonas (ciprofloxacino) atuam inibindo:", alternatives: [{ id: "a", text: "A síntese da parede celular" }, { id: "b", text: "A DNA girase e topoisomerase IV" }, { id: "c", text: "A síntese de ácido fólico" }, { id: "d", text: "A membrana celular" }], correctAnswer: "b", explanation: "Fluoroquinolonas inibem a DNA girase (gram-negativos) e topoisomerase IV (gram-positivos)." },
      ]},
      { name: "Resistência", questions: [
        { question: "Qual é o principal mecanismo de resistência do MRSA aos β-lactâmicos?", alternatives: [{ id: "a", text: "Produção de β-lactamases apenas" }, { id: "b", text: "Alteração do alvo (PBP2a codificada pelo gene mecA)" }, { id: "c", text: "Bomba de efluxo" }, { id: "d", text: "Impermeabilidade da membrana" }], correctAnswer: "b", explanation: "MRSA possui o gene mecA que codifica PBP2a, uma transpeptidase com baixa afinidade por β-lactâmicos." },
      ]},
    ],
  },
  {
    id: 10, weekNumber: 10, name: "Tiamat Supremo", title: "O Dragão Final da Farmacologia",
    emoji: "🐲", imageUrl: "https://files.manuscdn.com/user_upload_by_module/session_file/310419663028318382/wBoAgOslFPfCwoXg.png", color: "#dc2626", hp: 700, playerHp: 100, pfReward: 75, xpReward: 600,
    phases: [
      { name: "Revisão Geral I", questions: [
        { question: "Um paciente asmático precisa de um anti-hipertensivo. Qual β-bloqueador é MAIS seguro?", alternatives: [{ id: "a", text: "Propranolol" }, { id: "b", text: "Atenolol (β1-seletivo)" }, { id: "c", text: "Timolol" }, { id: "d", text: "Nadolol" }], correctAnswer: "b", explanation: "Atenolol é β1-seletivo, tendo menor risco de broncoconstrição que β-bloqueadores não-seletivos." },
        { question: "Qual fármaco é usado para reverter intoxicação por benzodiazepínicos?", alternatives: [{ id: "a", text: "Naloxona" }, { id: "b", text: "Flumazenil" }, { id: "c", text: "N-acetilcisteína" }, { id: "d", text: "Atropina" }], correctAnswer: "b", explanation: "Flumazenil é antagonista competitivo do sítio benzodiazepínico no receptor GABA-A." },
      ]},
      { name: "Revisão Geral II", questions: [
        { question: "A resistência bacteriana por produção de β-lactamases pode ser contornada com:", alternatives: [{ id: "a", text: "Aumento da dose do antibiótico" }, { id: "b", text: "Associação com inibidores de β-lactamase (ex: ácido clavulânico)" }, { id: "c", text: "Troca por um macrolídeo sempre" }, { id: "d", text: "Uso de anti-inflamatórios" }], correctAnswer: "b", explanation: "Inibidores de β-lactamase protegem o antibiótico da degradação enzimática." },
      ]},
      { name: "Caso Clínico Final", questions: [
        { question: "Paciente com choque anafilático. Qual é o fármaco de PRIMEIRA escolha?", alternatives: [{ id: "a", text: "Difenidramina" }, { id: "b", text: "Adrenalina (epinefrina) IM" }, { id: "c", text: "Hidrocortisona" }, { id: "d", text: "Salbutamol" }], correctAnswer: "b", explanation: "A adrenalina IM é o tratamento de primeira linha na anafilaxia: reverte broncoespasmo, hipotensão e edema." },
      ]},
    ],
  },
  {
    id: 11, weekNumber: 11, name: "Kraken Cardiovascular", title: "Monstro dos Fármacos Cardíacos",
    emoji: "🦑", color: "#0ea5e9", hp: 650, playerHp: 100, pfReward: 60, xpReward: 520,
    phases: [
      { name: "Anti-hipertensivos", questions: [
        { question: "Qual classe de anti-hipertensivo é preferida em pacientes com insuficiência cardíaca com fração de ejeção reduzida?", alternatives: [{ id: "a", text: "Bloqueadores de canal de cálcio" }, { id: "b", text: "IECA ou BRA" }, { id: "c", text: "Diuréticos tiazídicos" }, { id: "d", text: "Alfa-bloqueadores" }], correctAnswer: "b", explanation: "IECA/BRA reduzem pós-carga e remodelamento cardíaco, sendo primeira linha na IC com FE reduzida." },
        { question: "O mecanismo de ação dos bloqueadores de canal de cálcio di-hidropiridínicos é:", alternatives: [{ id: "a", text: "Bloqueio de canais de sódio" }, { id: "b", text: "Bloqueio de canais L de cálcio nas células musculares lisas vasculares" }, { id: "c", text: "Inibição da enzima conversora de angiotensina" }, { id: "d", text: "Bloqueio de receptores beta-adrenérgicos" }], correctAnswer: "b", explanation: "Di-hidropiridinas (ex: anlodipino) bloqueiam canais L de cálcio vasculares, causando vasodilatação." },
      ]},
      { name: "Antiarrítmicos", questions: [
        { question: "A amiodarona pertence a qual classe de antiarrítmicos (Vaughan Williams)?", alternatives: [{ id: "a", text: "Classe I" }, { id: "b", text: "Classe II" }, { id: "c", text: "Classe III" }, { id: "d", text: "Classe IV" }], correctAnswer: "c", explanation: "Amiodarona é Classe III (bloqueador de canal de potássio), prolongando o potencial de ação." },
      ]},
      { name: "Caso Clínico Cardíaco", questions: [
        { question: "Paciente com fibrilação atrial e insuficiência cardíaca. Qual fármaco controla a frequência cardíaca e melhora a contratilidade?", alternatives: [{ id: "a", text: "Metoprolol" }, { id: "b", text: "Digoxina" }, { id: "c", text: "Verapamil" }, { id: "d", text: "Adenosina" }], correctAnswer: "b", explanation: "Digoxina controla a FC na FA e tem efeito inotrópico positivo, útil na IC com FA." },
      ]},
    ],
  },
  {
    id: 12, weekNumber: 12, name: "Leviatã Renal", title: "Senhor dos Diuréticos",
    emoji: "🌊", color: "#06b6d4", hp: 650, playerHp: 100, pfReward: 60, xpReward: 520,
    phases: [
      { name: "Diuréticos", questions: [
        { question: "Qual diurético é o mais potente e age na alça de Henle?", alternatives: [{ id: "a", text: "Hidroclorotiazida" }, { id: "b", text: "Furosemida" }, { id: "c", text: "Espironolactona" }, { id: "d", text: "Acetazolamida" }], correctAnswer: "b", explanation: "Furosemida é diurético de alça, inibe o cotransportador Na-K-2Cl no ramo ascendente espesso." },
        { question: "A espironolactona é um antagonista de:", alternatives: [{ id: "a", text: "Angiotensina II" }, { id: "b", text: "Aldosterona" }, { id: "c", text: "Vasopressina" }, { id: "d", text: "Renina" }], correctAnswer: "b", explanation: "Espironolactona bloqueia receptores de aldosterona, poupando potássio e sendo útil na IC." },
      ]},
      { name: "Fármacos Renais", questions: [
        { question: "Qual fármaco é usado para tratar hipercalcemia aguda por seu efeito calciúrico?", alternatives: [{ id: "a", text: "Tiazídicos" }, { id: "b", text: "Furosemida" }, { id: "c", text: "Espironolactona" }, { id: "d", text: "Amilorida" }], correctAnswer: "b", explanation: "Furosemida aumenta a excreção de cálcio, sendo usada com hidratação na hipercalcemia aguda." },
      ]},
      { name: "Caso Clínico Renal", questions: [
        { question: "Paciente com edema por IC e hipocalemia. Qual combinação diurética é mais adequada?", alternatives: [{ id: "a", text: "Furosemida + hidroclorotiazida" }, { id: "b", text: "Furosemida + espironolactona" }, { id: "c", text: "Acetazolamida + tiazídico" }, { id: "d", text: "Amilorida isolada" }], correctAnswer: "b", explanation: "Furosemida (diurético de alça) + espironolactona (poupador de K+) combina eficácia e proteção contra hipocalemia." },
      ]},
    ],
  },
  {
    id: 13, weekNumber: 13, name: "Quimera Endócrina", title: "Besta Hormonal",
    emoji: "🧬", color: "#a855f7", hp: 680, playerHp: 100, pfReward: 65, xpReward: 550,
    phases: [
      { name: "Antidiabéticos", questions: [
        { question: "Qual antidiabético oral tem como mecanismo a inibição da gliconeogênese hepática e não causa hipoglicemia isolado?", alternatives: [{ id: "a", text: "Glibenclamida" }, { id: "b", text: "Metformina" }, { id: "c", text: "Acarbose" }, { id: "d", text: "Pioglitazona" }], correctAnswer: "b", explanation: "Metformina reduz a produção hepática de glicose e não causa hipoglicemia quando usada isoladamente." },
        { question: "As sulfonilureias atuam estimulando:", alternatives: [{ id: "a", text: "Receptores de insulina no músculo" }, { id: "b", text: "Secreção de insulina pelas células beta pancreáticas" }, { id: "c", text: "Absorção de glicose no intestino" }, { id: "d", text: "Excreção renal de glicose" }], correctAnswer: "b", explanation: "Sulfonilureias bloqueiam canais de K+ ATP-dependentes nas células beta, aumentando a secreção de insulina." },
      ]},
      { name: "Hormônios Tireoidianos", questions: [
        { question: "O propiltiouracil (PTU) inibe a síntese de hormônios tireoidianos e também:", alternatives: [{ id: "a", text: "Bloqueia receptores de TSH" }, { id: "b", text: "Inibe a conversão periférica de T4 em T3" }, { id: "c", text: "Destrói células foliculares" }, { id: "d", text: "Aumenta a captação de iodo" }], correctAnswer: "b", explanation: "PTU inibe a peroxidase tireoidiana E a desiodase periférica, reduzindo a conversão de T4 em T3 ativo." },
      ]},
      { name: "Caso Clínico Endócrino", questions: [
        { question: "Paciente com DM2 e doença renal crônica estágio 3. Qual antidiabético deve ser evitado?", alternatives: [{ id: "a", text: "Insulina" }, { id: "b", text: "Metformina em dose plena" }, { id: "c", text: "Sitagliptina" }, { id: "d", text: "Liraglutida" }], correctAnswer: "b", explanation: "Metformina é contraindicada em DRC avançada (TFG < 30) pelo risco de acidose lática; doses devem ser ajustadas na DRC estágio 3." },
      ]},
    ],
  },
  {
    id: 14, weekNumber: 14, name: "Basilisco Oncológico", title: "Serpente da Quimioterapia",
    emoji: "🐍", color: "#ec4899", hp: 700, playerHp: 100, pfReward: 65, xpReward: 550,
    phases: [
      { name: "Antineoplásicos I", questions: [
        { question: "O metotrexato atua como antineoplásico por:", alternatives: [{ id: "a", text: "Alquilação do DNA" }, { id: "b", text: "Inibição da di-hidrofolato redutase" }, { id: "c", text: "Inibição da topoisomerase II" }, { id: "d", text: "Bloqueio de receptores de estrogênio" }], correctAnswer: "b", explanation: "Metotrexato inibe a DHFR, impedindo a síntese de folato ativo e, consequentemente, a síntese de purinas e timidilato." },
        { question: "Qual antineoplásico causa cardiotoxicidade dose-dependente?", alternatives: [{ id: "a", text: "Vincristina" }, { id: "b", text: "Doxorrubicina" }, { id: "c", text: "Tamoxifeno" }, { id: "d", text: "Imatinibe" }], correctAnswer: "b", explanation: "Doxorrubicina (antraciclina) causa cardiomiopatia dose-dependente por geração de radicais livres." },
      ]},
      { name: "Antineoplásicos II", questions: [
        { question: "O imatinibe é um exemplo de terapia-alvo que inibe:", alternatives: [{ id: "a", text: "Topoisomerase I" }, { id: "b", text: "BCR-ABL tirosina quinase" }, { id: "c", text: "Aromatase" }, { id: "d", text: "Receptor de androgênio" }], correctAnswer: "b", explanation: "Imatinibe inibe seletivamente a BCR-ABL, sendo revolucionário no tratamento da leucemia mieloide crônica." },
      ]},
      { name: "Caso Clínico Oncológico", questions: [
        { question: "Paciente com câncer de mama HER2+ recebe trastuzumabe. Qual é o mecanismo de ação?", alternatives: [{ id: "a", text: "Inibe a síntese de DNA" }, { id: "b", text: "Anticorpo monoclonal anti-HER2 que bloqueia sinalização proliferativa" }, { id: "c", text: "Bloqueia receptores de estrogênio" }, { id: "d", text: "Inibe a angiogênese" }], correctAnswer: "b", explanation: "Trastuzumabe é um anticorpo monoclonal que se liga ao domínio extracelular do HER2, bloqueando a proliferação celular." },
      ]},
    ],
  },
  {
    id: 15, weekNumber: 15, name: "Titã da Coagulação", title: "Guardião do Sistema Hemostático",
    emoji: "🩸", color: "#ef4444", hp: 720, playerHp: 100, pfReward: 70, xpReward: 580,
    phases: [
      { name: "Anticoagulantes", questions: [
        { question: "A heparina não fracionada exerce seu efeito anticoagulante principalmente por:", alternatives: [{ id: "a", text: "Inibição da vitamina K" }, { id: "b", text: "Potencialização da antitrombina III" }, { id: "c", text: "Inibição direta da trombina" }, { id: "d", text: "Bloqueio do receptor GPIIb/IIIa" }], correctAnswer: "b", explanation: "Heparina se liga à antitrombina III, aumentando 1000x sua capacidade de inibir trombina e fator Xa." },
        { question: "Qual anticoagulante oral inibe diretamente o fator Xa?", alternatives: [{ id: "a", text: "Varfarina" }, { id: "b", text: "Dabigatrana" }, { id: "c", text: "Rivaroxabana" }, { id: "d", text: "Heparina de baixo peso molecular" }], correctAnswer: "c", explanation: "Rivaroxabana é inibidor direto do fator Xa, sem necessidade de cofator como a antitrombina." },
      ]},
      { name: "Antiagregantes", questions: [
        { question: "O clopidogrel inibe a agregação plaquetária por:", alternatives: [{ id: "a", text: "Inibição da COX-1" }, { id: "b", text: "Bloqueio irreversível do receptor P2Y12 de ADP" }, { id: "c", text: "Inibição da fosfodiesterase" }, { id: "d", text: "Bloqueio do receptor GPIIb/IIIa" }], correctAnswer: "b", explanation: "Clopidogrel é um pró-fármaco que, após ativação hepática, bloqueia irreversivelmente o receptor P2Y12." },
      ]},
      { name: "Caso Clínico Hemostático", questions: [
        { question: "Paciente em uso de varfarina com INR 8,5 e sangramento ativo. Qual é a conduta farmacológica imediata?", alternatives: [{ id: "a", text: "Suspender varfarina e aguardar" }, { id: "b", text: "Vitamina K IV + concentrado de complexo protrombínico" }, { id: "c", text: "Protamina IV" }, { id: "d", text: "Transfusão de plaquetas" }], correctAnswer: "b", explanation: "Vitamina K IV reverte o efeito da varfarina; o CCP fornece fatores imediatos para reverter o sangramento agudo." },
      ]},
    ],
  },
  {
    id: 16, weekNumber: 16, name: "Hidra Psiquiátrica", title: "Monstro dos Psicotrópicos",
    emoji: "🧠", color: "#7c3aed", hp: 750, playerHp: 100, pfReward: 70, xpReward: 580,
    phases: [
      { name: "Antidepressivos", questions: [
        { question: "Os ISRS (inibidores seletivos de recaptação de serotonina) atuam por:", alternatives: [{ id: "a", text: "Inibição da MAO" }, { id: "b", text: "Bloqueio do transportador de serotonina (SERT)" }, { id: "c", text: "Agonismo direto de receptores 5-HT" }, { id: "d", text: "Inibição da síntese de serotonina" }], correctAnswer: "b", explanation: "ISRS bloqueiam o SERT, impedindo a recaptação de serotonina e aumentando sua concentração sináptica." },
        { question: "Qual antidepressivo tem maior risco de síndrome serotoninérgica quando combinado com tramadol?", alternatives: [{ id: "a", text: "Bupropiona" }, { id: "b", text: "Mirtazapina" }, { id: "c", text: "ISRS (ex: fluoxetina)" }, { id: "d", text: "Trazodona" }], correctAnswer: "c", explanation: "ISRS + tramadol (que também inibe recaptação de serotonina) aumenta risco de síndrome serotoninérgica." },
      ]},
      { name: "Antipsicóticos", questions: [
        { question: "Os antipsicóticos típicos (1ª geração) causam efeitos extrapiramidais principalmente por:", alternatives: [{ id: "a", text: "Bloqueio de receptores D2 no estriado" }, { id: "b", text: "Bloqueio de receptores muscarínicos" }, { id: "c", text: "Agonismo de receptores 5-HT2A" }, { id: "d", text: "Inibição da recaptação de dopamina" }], correctAnswer: "a", explanation: "Bloqueio D2 no estriado causa parkinsonismo, acatisia, distonia aguda e discinesia tardia." },
      ]},
      { name: "Caso Clínico Psiquiátrico", questions: [
        { question: "Paciente com transtorno bipolar em uso de lítio apresenta tremor, poliúria e confusão. Qual é a conduta?", alternatives: [{ id: "a", text: "Aumentar a dose de lítio" }, { id: "b", text: "Suspeitar de intoxicação por lítio e dosar litemia" }, { id: "c", text: "Adicionar haloperidol" }, { id: "d", text: "Iniciar diurético tiazídico" }], correctAnswer: "b", explanation: "Sintomas de intoxicação por lítio incluem tremor, poliúria, confusão e ataxia; a litemia deve ser dosada urgentemente." },
      ]},
    ],
  },
  {
    id: 17, weekNumber: 17, name: "Tiamat Omega — O Dragão Supremo", title: "Chefe Final de Farmacologia I",
    emoji: "🐲", color: "#fbbf24", hp: 900, playerHp: 100, pfReward: 80, xpReward: 700,
    phases: [
      { name: "Revisão Integradora I", questions: [
        { question: "Um paciente usa inibidor da MAO (IMAO) e ingere alimentos ricos em tiramina. O resultado é:", alternatives: [{ id: "a", text: "Hipotensão grave" }, { id: "b", text: "Crise hipertensiva" }, { id: "c", text: "Bradicardia" }, { id: "d", text: "Hipoglicemia" }], correctAnswer: "b", explanation: "IMAOs impedem a degradação da tiramina, que libera noradrenalina em excesso, causando crise hipertensiva (efeito queijo)." },
        { question: "Qual é o antídoto específico para intoxicação por paracetamol (acetaminofeno)?", alternatives: [{ id: "a", text: "Flumazenil" }, { id: "b", text: "N-acetilcisteína" }, { id: "c", text: "Naloxona" }, { id: "d", text: "Atropina" }], correctAnswer: "b", explanation: "N-acetilcisteína repõe glutationa hepática, neutralizando o metabólito tóxico NAPQI do paracetamol." },
      ]},
      { name: "Revisão Integradora II", questions: [
        { question: "O índice terapêutico (IT) de um fármaco é definido como:", alternatives: [{ id: "a", text: "DE50 / DL50" }, { id: "b", text: "DL50 / DE50" }, { id: "c", text: "Dose máxima / dose mínima" }, { id: "d", text: "Biodisponibilidade oral / IV" }], correctAnswer: "b", explanation: "IT = DL50/DE50. Quanto maior o IT, mais seguro o fármaco. Lítio e digoxina têm IT estreito." },
      ]},
      { name: "Caso Clínico Final Integrador", questions: [
        { question: "Paciente com sepse recebe aminoglicosídeo + beta-lactâmico. Qual é a base farmacológica desta combinação?", alternatives: [{ id: "a", text: "Efeito antagônico para reduzir toxicidade" }, { id: "b", text: "Sinergismo: beta-lactâmico facilita entrada do aminoglicosídeo ao romper a parede celular" }, { id: "c", text: "Ambos inibem a síntese proteica" }, { id: "d", text: "Redução da resistência por competição" }], correctAnswer: "b", explanation: "Beta-lactâmicos rompem a parede bacteriana, facilitando a entrada dos aminoglicosídeos que inibem a síntese proteica — sinergismo bactericida." },
      ]},
    ],
  },
];


// ═══════════════════════════════════════
// CSS ANIMATIONS - Caverna do Dragão Style
// ═══════════════════════════════════════
const BATTLE_STYLES = `
  @keyframes shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-8px)} 75%{transform:translateX(8px)} }
  .animate-shake { animation: shake 0.3s ease-in-out; }
  @keyframes damageFlash { 0%{opacity:0} 50%{opacity:0.3} 100%{opacity:0} }
  .damage-flash { animation: damageFlash 0.4s ease-out; }

  @keyframes heroSlash {
    0% { transform: translateX(0) rotate(0deg); opacity: 1; }
    30% { transform: translateX(80px) rotate(15deg); opacity: 1; }
    50% { transform: translateX(120px) rotate(-10deg) scale(1.2); opacity: 1; }
    70% { transform: translateX(80px) rotate(5deg); opacity: 1; }
    100% { transform: translateX(0) rotate(0deg); opacity: 1; }
  }
  .hero-slash { animation: heroSlash 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94); }

  @keyframes bossHit {
    0% { transform: translateX(0) scale(1); filter: brightness(1); }
    20% { transform: translateX(15px) scale(0.95); filter: brightness(2) saturate(0); }
    40% { transform: translateX(-10px) scale(1.05); filter: brightness(1.5); }
    60% { transform: translateX(5px) scale(0.98); filter: brightness(1.2); }
    100% { transform: translateX(0) scale(1); filter: brightness(1); }
  }
  .boss-hit { animation: bossHit 0.6s ease-out; }

  @keyframes bossAttack {
    0% { transform: translateX(0) scale(1); }
    20% { transform: translateX(-30px) scale(1.1); }
    40% { transform: translateX(-100px) scale(1.2); }
    60% { transform: translateX(-60px) scale(1.1); }
    100% { transform: translateX(0) scale(1); }
  }
  .boss-attack { animation: bossAttack 0.7s cubic-bezier(0.25, 0.46, 0.45, 0.94); }

  @keyframes playerHit {
    0% { transform: translateX(0) scale(1); filter: brightness(1); }
    20% { transform: translateX(-20px) scale(0.9); filter: brightness(2) hue-rotate(340deg); }
    50% { transform: translateX(10px) scale(0.95); filter: brightness(1.3); }
    100% { transform: translateX(0) scale(1); filter: brightness(1); }
  }
  .player-hit { animation: playerHit 0.5s ease-out; }

  @keyframes swordSlash {
    0% { transform: rotate(-45deg) scale(0); opacity: 0; }
    30% { transform: rotate(15deg) scale(1.5); opacity: 1; }
    60% { transform: rotate(45deg) scale(1.2); opacity: 0.8; }
    100% { transform: rotate(90deg) scale(0); opacity: 0; }
  }
  .sword-slash { animation: swordSlash 0.5s ease-out forwards; }

  @keyframes explosionBurst {
    0% { transform: scale(0); opacity: 1; }
    50% { transform: scale(2); opacity: 0.8; }
    100% { transform: scale(3); opacity: 0; }
  }
  .explosion-burst { animation: explosionBurst 0.6s ease-out forwards; }

  @keyframes victoryGlow {
    0% { box-shadow: 0 0 0 rgba(234,179,8,0); }
    50% { box-shadow: 0 0 80px rgba(234,179,8,0.6), 0 0 120px rgba(234,179,8,0.3); }
    100% { box-shadow: 0 0 40px rgba(234,179,8,0.3); }
  }
  .victory-glow { animation: victoryGlow 1.5s ease-in-out infinite; }

  @keyframes defeatFall {
    0% { transform: translateY(0) rotate(0deg); opacity: 1; }
    30% { transform: translateY(-20px) rotate(-5deg); opacity: 1; }
    70% { transform: translateY(40px) rotate(15deg); opacity: 0.7; }
    100% { transform: translateY(80px) rotate(25deg); opacity: 0.3; }
  }
  .defeat-fall { animation: defeatFall 1.2s ease-in forwards; }

  @keyframes bossDefeat {
    0% { transform: scale(1) rotate(0deg); opacity: 1; filter: brightness(1); }
    20% { transform: scale(1.1) rotate(-3deg); opacity: 1; filter: brightness(2); }
    40% { transform: scale(0.9) rotate(5deg); opacity: 0.8; filter: brightness(1.5) saturate(0.5); }
    60% { transform: scale(0.7) rotate(-8deg); opacity: 0.6; filter: brightness(1) saturate(0.2); }
    80% { transform: scale(0.4) rotate(10deg); opacity: 0.3; filter: brightness(0.5) saturate(0); }
    100% { transform: scale(0) rotate(15deg); opacity: 0; filter: brightness(0) saturate(0); }
  }
  .boss-defeat { animation: bossDefeat 1.5s ease-in forwards; }

  @keyframes bossVictory {
    0% { transform: scale(1); }
    25% { transform: scale(1.15) translateY(-5px); }
    50% { transform: scale(1.1); }
    75% { transform: scale(1.2) translateY(-8px); }
    100% { transform: scale(1.15); }
  }
  .boss-victory { animation: bossVictory 1s ease-in-out infinite; }

  @keyframes heroVictory {
    0% { transform: scale(1) translateY(0); }
    30% { transform: scale(1.2) translateY(-15px); }
    60% { transform: scale(1.15) translateY(-10px); }
    100% { transform: scale(1.25) translateY(-20px); }
  }
  .hero-victory { animation: heroVictory 1s ease-out forwards; }

  @keyframes sparkle {
    0%, 100% { opacity: 0; transform: scale(0) rotate(0deg); }
    50% { opacity: 1; transform: scale(1) rotate(180deg); }
  }

  @keyframes battleIntro {
    0% { opacity: 0; transform: scale(0.5); }
    50% { opacity: 1; transform: scale(1.1); }
    100% { opacity: 1; transform: scale(1); }
  }
  .battle-intro { animation: battleIntro 0.8s ease-out; }

  @keyframes slideInLeft {
    0% { transform: translateX(-200px); opacity: 0; }
    100% { transform: translateX(0); opacity: 1; }
  }
  .slide-in-left { animation: slideInLeft 0.6s ease-out; }

  @keyframes slideInRight {
    0% { transform: translateX(200px); opacity: 0; }
    100% { transform: translateX(0); opacity: 1; }
  }
  .slide-in-right { animation: slideInRight 0.6s ease-out; }

  @keyframes gameOverText {
    0% { transform: scale(0) rotate(-10deg); opacity: 0; }
    50% { transform: scale(1.3) rotate(3deg); opacity: 1; }
    100% { transform: scale(1) rotate(0deg); opacity: 1; }
  }
  .game-over-text { animation: gameOverText 0.8s cubic-bezier(0.34, 1.56, 0.64, 1); }

  @keyframes pulseRed {
    0%, 100% { background-color: rgba(239, 68, 68, 0.1); }
    50% { background-color: rgba(239, 68, 68, 0.25); }
  }
  .pulse-red { animation: pulseRed 1s ease-in-out infinite; }
`;

// ═══════════════════════════════════════
// BOSS BATTLE COMPONENT
// ═══════════════════════════════════════

export interface BossBattleProps {
  weekNumber: number;
  gender?: "male" | "female";
  onComplete: (result: {
    isVictory: boolean;
    bossName: string;
    totalDamageDealt: number;
    playerHpRemaining: number;
    phasesCompleted: number;
    totalPhases: number;
    comboMax: number;
    pfEarned: number;
    xpEarned: number;
    totalTimeSpent: number;
  }) => void;
  onBack: () => void;
}

export default function BossBattle({ weekNumber, gender = "male", onComplete, onBack }: BossBattleProps) {
  const boss = useMemo(() => BOSSES.find(b => b.weekNumber === weekNumber), [weekNumber]);
  
  const [phase, setPhase] = useState(0);
  const [questionIdx, setQuestionIdx] = useState(0);
  const [bossHp, setBossHp] = useState(boss?.hp || 300);
  const [playerHp, setPlayerHp] = useState(boss?.playerHp || 100);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [totalDamage, setTotalDamage] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);
  const [timerActive, setTimerActive] = useState(false);
  const [battleState, setBattleState] = useState<"intro" | "fighting" | "hero-attack" | "boss-attack" | "victory-anim" | "victory" | "defeat-anim" | "defeat">("intro");
  const [startTime] = useState(Date.now());
  const [shakeScreen, setShakeScreen] = useState(false);
  const [flashDamage, setFlashDamage] = useState(false);
  const [phasesCompleted, setPhasesCompleted] = useState(0);
  const [animPhase, setAnimPhase] = useState(0);
  // Trava pra garantir que o resultado só é salvo UMA vez, mesmo se o efeito
  // abaixo rodar de novo por algum motivo (ex: re-render).
  const resultadoJaSalvoRef = useRef(false);

  // Intro animation
  useEffect(() => {
    if (battleState === "intro") {
      const t = setTimeout(() => {
        setBattleState("fighting");
        setTimerActive(true);
      }, 2500);
      return () => clearTimeout(t);
    }
  }, [battleState]);

  if (!boss) {
    return (
      <div className="min-h-screen bg-[#0a0e27] flex items-center justify-center text-white">
        <div className="text-center">
          <p className="text-xl">Boss nao encontrado para a semana {weekNumber}</p>
          <Button onClick={onBack} className="mt-4">Voltar</Button>
        </div>
      </div>
    );
  }

  const currentPhase = boss.phases[phase];
  const currentQuestion = currentPhase?.questions[questionIdx];
  const totalQuestions = boss.phases.reduce((sum, p) => sum + p.questions.length, 0);
  const bossHpPercent = (bossHp / boss.hp) * 100;
  const playerHpPercent = (playerHp / boss.playerHp) * 100;

  // Timer
  useEffect(() => {
    if (!timerActive || battleState !== "fighting") return;
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          handleTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timerActive, battleState]);

  const handleTimeout = useCallback(() => {
    setTimerActive(false);
    setIsCorrect(false);
    setShowFeedback(true);
    setCombo(0);
    
    // Boss attack animation
    setBattleState("boss-attack");
    setTimeout(() => {
      const bossDamage = 25;
      const newPlayerHp = Math.max(0, playerHp - bossDamage);
      setPlayerHp(newPlayerHp);
      setShakeScreen(true);
      setTimeout(() => setShakeScreen(false), 500);
      
      if (newPlayerHp <= 0) {
        setTimeout(() => {
          setBattleState("defeat-anim");
          // After video animation (20s), show defeat screen
          setTimeout(() => setBattleState("defeat"), 21000);
        }, 500);
      } else {
        setBattleState("fighting");
      }
    }, 700);
  }, [playerHp]);

  const handleAnswer = (answerId: string) => {
    if (showFeedback || !currentQuestion || battleState !== "fighting") return;
    setTimerActive(false);
    setSelectedAnswer(answerId);

    const correct = answerId === currentQuestion.correctAnswer;
    setIsCorrect(correct);
    setShowFeedback(true);

    if (correct) {
      // Hero attack animation
      setBattleState("hero-attack");
      setTimeout(() => {
        const baseAttack = Math.floor(boss.hp / totalQuestions);
        const comboBonus = Math.floor(baseAttack * combo * 0.15);
        const timeBonus = Math.floor(timeLeft * 1.5);
        const totalAttack = baseAttack + comboBonus + timeBonus;
        
        const newBossHp = Math.max(0, bossHp - totalAttack);
        setBossHp(newBossHp);
        setTotalDamage(prev => prev + totalAttack);
        setCombo(prev => {
          const newCombo = prev + 1;
          setMaxCombo(mc => Math.max(mc, newCombo));
          return newCombo;
        });
        setFlashDamage(true);
        setTimeout(() => setFlashDamage(false), 400);
        setBattleState("fighting");
      }, 800);
    } else {
      // Boss counter-attack animation
      setBattleState("boss-attack");
      setTimeout(() => {
        const bossDamage = 20;
        const newPlayerHp = Math.max(0, playerHp - bossDamage);
        setPlayerHp(newPlayerHp);
        setCombo(0);
        setShakeScreen(true);
        setTimeout(() => setShakeScreen(false), 500);
        
        if (newPlayerHp <= 0) {
          setTimeout(() => {
            setBattleState("defeat-anim");
            // After video animation (20s), show defeat screen
            setTimeout(() => setBattleState("defeat"), 21000);
          }, 500);
        } else {
          setBattleState("fighting");
        }
      }, 700);
    }
  };

  const handleNext = () => {
    if (bossHp <= 0) {
      setBattleState("victory-anim");
      setPhasesCompleted(phase + 1);
      // After video animation (20s), show victory screen
      setTimeout(() => setBattleState("victory"), 21000);
      return;
    }

    if (questionIdx < (currentPhase?.questions.length || 0) - 1) {
      setQuestionIdx(prev => prev + 1);
    } else if (phase < boss.phases.length - 1) {
      setPhasesCompleted(prev => prev + 1);
      setPhase(prev => prev + 1);
      setQuestionIdx(0);
    } else {
      // All questions answered but boss not dead = defeat
      setBattleState("defeat-anim");
      setPhasesCompleted(boss.phases.length);
      // After video animation (20s), show defeat screen
      setTimeout(() => setBattleState("defeat"), 21000);
      return;
    }

    setSelectedAnswer(null);
    setShowFeedback(false);
    setTimeLeft(30);
    setTimerActive(true);
  };

  const handleBattleEnd = () => {
    const totalTime = Math.floor((Date.now() - startTime) / 1000);
    onComplete({
      isVictory: battleState === "victory",
      bossName: boss.name,
      totalDamageDealt: totalDamage,
      playerHpRemaining: playerHp,
      phasesCompleted: phasesCompleted,
      totalPhases: boss.phases.length,
      comboMax: maxCombo,
      pfEarned: battleState === "victory" ? boss.pfReward : Math.floor(boss.pfReward * 0.2),
      xpEarned: battleState === "victory" ? boss.xpReward : Math.floor(boss.xpReward * 0.2),
      totalTimeSpent: totalTime,
    });
  };

  // Salva o resultado da luta automaticamente, assim que a tela de vitória
  // ou derrota aparece — sem depender de o aluno clicar em "Resgatar
  // Recompensas"/"Voltar ao Mapa". Antes disso, se o aluno fechasse a aba ou
  // simplesmente não clicasse nesse botão (a tela já mostra os números como
  // se já estivessem creditados, então é fácil achar que já terminou), o
  // resultado nunca era enviado ao servidor — causa raiz de lutas vencidas
  // de verdade que não apareciam registradas em nenhum lugar.
  useEffect(() => {
    if ((battleState === "victory" || battleState === "defeat") && !resultadoJaSalvoRef.current) {
      resultadoJaSalvoRef.current = true;
      handleBattleEnd();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battleState]);

  const handleRetry = () => {
    setPhase(0);
    setQuestionIdx(0);
    setBossHp(boss.hp);
    setPlayerHp(boss.playerHp);
    setCombo(0);
    setMaxCombo(0);
    setTotalDamage(0);
    setSelectedAnswer(null);
    setShowFeedback(false);
    setTimeLeft(30);
    setTimerActive(true);
    setBattleState("fighting");
    setPhasesCompleted(0);
    setAnimPhase(0);
    // Libera a trava de salvamento pra essa nova tentativa poder ser salva
    // quando terminar (senão só a primeira tentativa seria registrada).
    resultadoJaSalvoRef.current = false;
  };

  // ═══════════════════════════════════════
  // INTRO SCREEN - Caverna do Dragao Style
  // ═══════════════════════════════════════
  if (battleState === "intro") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0a0e27] via-[#1a0a2e] to-[#0a0e27] text-white flex items-center justify-center p-4">
        <style>{BATTLE_STYLES}</style>
        <div className="max-w-lg w-full text-center space-y-8 battle-intro">
          {/* Arena */}
          <div className="relative flex items-center justify-center gap-12 h-56">
            {/* Hero */}
            <div className="slide-in-left">
              <img src={HERO_IMAGES.idle} alt="Herói" className="w-28 h-28 object-contain drop-shadow-[0_0_20px_rgba(52,211,153,0.5)]" />
              <p className="text-xs text-emerald-400 font-bold mt-2">HERÓI</p>
            </div>

            {/* VS */}
            <div className="text-4xl font-black text-yellow-400 animate-pulse">
              VS
            </div>

            {/* Boss */}
            <div className="slide-in-right">
              {boss.imageUrl ? (
                <img src={boss.imageUrl} alt={boss.name} className="w-24 h-24 object-contain drop-shadow-[0_0_30px_rgba(239,68,68,0.5)]" />
              ) : (
                <div className="text-7xl drop-shadow-[0_0_20px_rgba(239,68,68,0.5)]">{boss.emoji}</div>
              )}
              <p className="text-xs font-bold mt-2" style={{ color: boss.color }}>{boss.name}</p>
            </div>
          </div>

          <div>
            <h1 className="text-3xl font-black text-yellow-400 tracking-wider">BATALHA DE CHEFE</h1>
            <p className="text-lg text-gray-300 mt-2">{boss.title}</p>
            <p className="text-sm text-gray-500 mt-1">Semana {boss.weekNumber}</p>
          </div>

          <div className="flex justify-center gap-2">
            {["⚡", "🔥", "⚔️", "🔥", "⚡"].map((s, i) => (
              <span key={i} className="text-2xl animate-bounce" style={{ animationDelay: `${i * 0.15}s` }}>
                {s}
              </span>
            ))}
          </div>

          <p className="text-sm text-gray-400 animate-pulse">Preparando batalha...</p>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════
  // VICTORY ANIMATION - Video: Hero defeats Boss
  // ═══════════════════════════════════════
  if (battleState === "victory-anim") {
    return (
      <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
        <video
          autoPlay
          playsInline
          muted={false}
          className="w-full h-full object-contain"
          onEnded={() => setBattleState("victory")}
        >
          <source src={getBossVideo(boss?.id ?? 1, "victory", gender)} type="video/mp4" />
        </video>
        {/* Skip button */}
        <button
          onClick={() => setBattleState("victory")}
          className="absolute bottom-6 right-6 bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white px-4 py-2 rounded-lg text-sm font-medium transition-all border border-white/20"
        >
          Pular ▶▶
        </button>
        {/* Boss name overlay */}
        <div className="absolute top-6 left-0 right-0 text-center">
          <p className="text-yellow-400 text-2xl font-black tracking-wider drop-shadow-lg animate-pulse">
            VITORIA!
          </p>
          <p className="text-white/80 text-sm mt-1">{boss.name} foi derrotado!</p>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════
  // VICTORY SCREEN - Rewards
  // ═══════════════════════════════════════
  if (battleState === "victory") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0a0e27] via-[#1a1040] to-[#0a0e27] text-white flex items-center justify-center p-4">
        <style>{BATTLE_STYLES}</style>
        <div className="max-w-md w-full text-center space-y-6">
          {/* Victory Scene Image */}
          <div className="relative mx-auto rounded-2xl overflow-hidden border-2 border-yellow-500/30 shadow-[0_0_40px_rgba(234,179,8,0.3)]">
            <img src={BATTLE_SCENES.victory} alt="Vitória!" className="w-full h-48 object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0e27] via-transparent to-transparent" />
          </div>
          
          <div>
            <h1 className="text-3xl font-extrabold text-yellow-400">VITORIA! 🏆</h1>
            <p className="text-lg text-gray-300 mt-2">{boss.name} foi derrotado!</p>
          </div>

          <div className="bg-white/5 border border-yellow-500/30 rounded-2xl p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <Zap size={24} className="text-blue-400 mx-auto mb-1" />
                <p className="text-2xl font-mono font-bold text-blue-400">+{boss.pfReward}</p>
                <p className="text-xs text-gray-400">PF Ganhos</p>
              </div>
              <div className="text-center">
                <Star size={24} className="text-purple-400 mx-auto mb-1" />
                <p className="text-2xl font-mono font-bold text-purple-400">+{boss.xpReward}</p>
                <p className="text-xs text-gray-400">XP Ganhos</p>
              </div>
              <div className="text-center">
                <Flame size={24} className="text-orange-400 mx-auto mb-1" />
                <p className="text-2xl font-mono font-bold text-orange-400">{maxCombo}x</p>
                <p className="text-xs text-gray-400">Combo Maximo</p>
              </div>
              <div className="text-center">
                <Sword size={24} className="text-red-400 mx-auto mb-1" />
                <p className="text-2xl font-mono font-bold text-red-400">{totalDamage}</p>
                <p className="text-xs text-gray-400">Dano Total</p>
              </div>
            </div>
            
            <div className="pt-2 border-t border-white/10">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">HP Restante</span>
                <span className="text-emerald-400 font-mono">{playerHp}/{boss.playerHp}</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-1">
                <span className="text-gray-400">Fases Completadas</span>
                <span className="text-emerald-400 font-mono">{phasesCompleted}/{boss.phases.length}</span>
              </div>
            </div>
          </div>

          <Button
            onClick={onBack}
            className="w-full bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-600 hover:to-amber-700 text-black font-bold text-lg py-6"
          >
            <Trophy size={20} className="mr-2" /> Resgatar Recompensas
          </Button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════
  // DEFEAT ANIMATION - Video: Boss wins, Game Over
  // ═══════════════════════════════════════
  if (battleState === "defeat-anim") {
    return (
      <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
        <video
          autoPlay
          playsInline
          muted={false}
          className="w-full h-full object-contain"
          onEnded={() => setBattleState("defeat")}
        >
          <source src={getBossVideo(boss?.id ?? 1, "defeat", gender)} type="video/mp4" />
        </video>
        {/* Skip button */}
        <button
          onClick={() => setBattleState("defeat")}
          className="absolute bottom-6 right-6 bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white px-4 py-2 rounded-lg text-sm font-medium transition-all border border-white/20"
        >
          Pular ▶▶
        </button>
        {/* Game Over overlay */}
        <div className="absolute top-6 left-0 right-0 text-center">
          <p className="text-red-500 text-3xl font-black tracking-widest drop-shadow-lg animate-pulse">
            GAME OVER
          </p>
          <p className="text-white/80 text-sm mt-1">{boss.name} venceu esta batalha!</p>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════
  // DEFEAT SCREEN - Try Again / Back to Map
  // ═══════════════════════════════════════
  if (battleState === "defeat") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0a0e27] via-[#2a0a0a] to-[#0a0e27] text-white flex items-center justify-center p-4">
        <style>{BATTLE_STYLES}</style>
        <div className="max-w-md w-full text-center space-y-6">
          {/* Defeat Scene Image */}
          <div className="relative mx-auto rounded-2xl overflow-hidden border-2 border-red-500/30 shadow-[0_0_40px_rgba(239,68,68,0.3)]">
            <img src={BATTLE_SCENES.defeat} alt="Derrota" className="w-full h-48 object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0e27] via-transparent to-transparent" />
          </div>
          
          <div>
            <h1 className="text-3xl font-extrabold text-red-400">DERROTA 💀</h1>
            <p className="text-lg text-gray-300 mt-2">{boss.name} venceu desta vez...</p>
          </div>

          <div className="bg-white/5 border border-red-500/30 rounded-2xl p-6 space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <Sword size={20} className="text-red-400 mx-auto mb-1" />
                <p className="text-xl font-mono font-bold text-red-400">{totalDamage}</p>
                <p className="text-xs text-gray-400">Dano Causado</p>
              </div>
              <div className="text-center">
                <Flame size={20} className="text-orange-400 mx-auto mb-1" />
                <p className="text-xl font-mono font-bold text-orange-400">{maxCombo}x</p>
                <p className="text-xs text-gray-400">Combo Maximo</p>
              </div>
            </div>
            <p className="text-sm text-gray-400 pt-2 border-t border-white/10">
              Fases completadas: {phasesCompleted}/{boss.phases.length}
            </p>
            <p className="text-xs text-gray-500">
              Estude mais e tente novamente! O jogo volta ao inicio.
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={onBack}
              variant="outline"
              className="flex-1 border-red-500/30 text-red-400 hover:bg-red-500/10"
            >
              Voltar ao Mapa
            </Button>
            <Button
              onClick={handleRetry}
              className="flex-1 bg-red-600 hover:bg-red-700"
            >
              <RotateCcw size={16} className="mr-2" /> Tentar Novamente
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════
  // BATTLE SCREEN - Main gameplay
  // ═══════════════════════════════════════
  return (
    <div className={`min-h-screen bg-gradient-to-b from-[#0a0e27] via-[#1a1040] to-[#0a0e27] text-white flex flex-col ${shakeScreen ? "animate-shake" : ""}`}>
      <style>{BATTLE_STYLES}</style>

      {flashDamage && (
        <div className="fixed inset-0 bg-red-500 damage-flash pointer-events-none z-50" />
      )}

      {/* Top Bar */}
      <div className="bg-[#0a0e27]/95 backdrop-blur-md border-b border-red-500/20 px-4 py-3">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <Button variant="ghost" size="sm" onClick={onBack} className="text-gray-400 hover:text-white">
              <ArrowLeft size={18} className="mr-1" /> Fugir
            </Button>
            <div className="text-center">
              <p className="text-xs font-medium uppercase tracking-wider" style={{ color: boss.color }}>
                Fase {phase + 1}: {currentPhase?.name}
              </p>
              <p className="text-sm font-bold">{boss.name}</p>
            </div>
            <div className={`
              flex items-center gap-1 px-3 py-1.5 rounded-lg font-mono font-bold text-sm
              ${timeLeft <= 10 ? "bg-red-500/20 text-red-400 animate-pulse" : "bg-white/10 text-white"}
            `}>
              <Timer size={14} />
              {timeLeft}s
            </div>
          </div>

          {/* Battle Arena - Hero vs Boss */}
          <div className="relative flex items-center justify-between px-4 py-2 mb-3 bg-white/5 rounded-xl border border-white/10">
            {/* Hero */}
            <div className={`transition-all duration-300 ${battleState === "hero-attack" ? "hero-slash" : battleState === "boss-attack" ? "player-hit" : ""}`}>
              <img 
                src={battleState === "hero-attack" ? HERO_IMAGES.attack : HERO_IMAGES.idle} 
                alt="Herói" 
                className="w-16 h-16 object-contain" 
              />
            </div>

            {/* Center effects */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              {battleState === "hero-attack" && (
                <div className="sword-slash text-4xl">⚡</div>
              )}
              {battleState === "boss-attack" && (
                <div className="explosion-burst text-4xl">💥</div>
              )}
              {combo > 0 && battleState === "fighting" && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-orange-500/20 border border-orange-500/40 text-orange-400 text-sm font-bold">
                  <Flame size={14} /> COMBO x{combo}!
                </span>
              )}
            </div>

            {/* Boss */}
            <div className={`transition-all duration-300 ${battleState === "hero-attack" ? "boss-hit" : battleState === "boss-attack" ? "boss-attack" : ""}`}>
              {boss.imageUrl ? (
                <img src={boss.imageUrl} alt={boss.name} className="w-14 h-14 object-contain" />
              ) : (
                <span className="text-4xl">{boss.emoji}</span>
              )}
            </div>
          </div>

          {/* Boss HP Bar */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1">
                <Skull size={12} className="text-red-400" />
                <span className="font-bold" style={{ color: boss.color }}>{boss.name}</span>
              </span>
              <span className="font-mono text-gray-400">{bossHp}/{boss.hp} HP</span>
            </div>
            <div className="w-full h-4 rounded-full bg-gray-800 overflow-hidden border border-gray-700">
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${bossHpPercent}%`,
                  backgroundColor: bossHpPercent > 50 ? boss.color : bossHpPercent > 25 ? "#f59e0b" : "#ef4444",
                }}
              />
            </div>
          </div>

          {/* Player HP Bar */}
          <div className="space-y-1 mt-2">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1">
                <Heart size={14} className="text-emerald-400" />
                <span className="font-bold text-emerald-400">Heroi</span>
              </span>
              <span className="font-mono text-gray-400">{playerHp}/{boss.playerHp} HP</span>
            </div>
            <div className="w-full h-3 rounded-full bg-gray-800 overflow-hidden border border-gray-700">
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${playerHpPercent}%`,
                  backgroundColor: playerHpPercent > 50 ? "#10b981" : playerHpPercent > 25 ? "#f59e0b" : "#ef4444",
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Question Area */}
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="max-w-2xl w-full space-y-6">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <p className="text-lg font-medium text-center leading-relaxed">
              {currentQuestion?.question}
            </p>
          </div>

          {!showFeedback ? (
            <div className="space-y-3">
              {currentQuestion?.alternatives.map((alt) => (
                <button
                  key={alt.id}
                  onClick={() => handleAnswer(alt.id)}
                  disabled={battleState !== "fighting"}
                  className="w-full p-4 rounded-xl border text-left transition-all bg-white/5 border-white/10 hover:border-amber-500/30 hover:bg-amber-500/5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center font-bold text-sm uppercase">
                      {alt.id}
                    </span>
                    <span className="text-sm">{alt.text}</span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <div className={`
                p-5 rounded-2xl border text-center
                ${isCorrect
                  ? "bg-emerald-500/10 border-emerald-500/30"
                  : "bg-red-500/10 border-red-500/30"
                }
              `}>
                {isCorrect ? (
                  <>
                    <img src={HERO_IMAGES.attack} alt="Ataque" className="w-20 h-20 object-contain mx-auto mb-2 drop-shadow-[0_0_20px_rgba(52,211,153,0.5)]" />
                    <h3 className="text-xl font-bold text-emerald-400">Ataque Certeiro!</h3>
                    <p className="text-sm text-gray-300 mt-1">
                      O herói golpeou {boss.name}!
                      {combo > 1 && <span className="text-orange-400 font-bold"> (Combo x{combo}!)</span>}
                    </p>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-center gap-3 mb-2">
                      {boss.imageUrl ? (
                        <img src={boss.imageUrl} alt={boss.name} className="w-16 h-16 object-contain drop-shadow-[0_0_20px_rgba(239,68,68,0.5)]" />
                      ) : (
                        <span className="text-4xl">{boss.emoji}</span>
                      )}
                      <span className="text-3xl">💥</span>
                      <img src={HERO_IMAGES.defeated} alt="Herói" className="w-14 h-14 object-contain opacity-70" />
                    </div>
                    <h3 className="text-xl font-bold text-red-400">{boss.name} contra-atacou!</h3>
                    <p className="text-sm text-gray-300 mt-1">-20 HP</p>
                  </>
                )}
              </div>

              <div className="bg-white/5 rounded-xl p-4">
                <p className="text-sm text-gray-300">
                  <span className="text-yellow-400 font-bold">Explicacao:</span> {currentQuestion?.explanation}
                </p>
                {!isCorrect && (
                  <p className="text-sm text-emerald-400 mt-2">
                    Resposta correta: <strong>
                      {currentQuestion?.alternatives.find(a => a.id === currentQuestion.correctAnswer)?.text}
                    </strong>
                  </p>
                )}
              </div>

              <Button
                onClick={handleNext}
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 font-bold"
              >
                {bossHp <= 0 ? (
                  <><Trophy size={16} className="mr-2" /> Vitoria!</>
                ) : (
                  <><ChevronRight size={16} className="mr-2" /> Proximo Ataque</>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export { BOSSES };
export type { BossData };