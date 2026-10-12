/**
 * Bancos do jogo por DISCIPLINA — Conexão em Farmacologia
 *
 * Cada turma joga apenas o banco da sua disciplina:
 *   farmaco1 → Farmacologia I (Medicina e Biomedicina)
 *              Temas: farmacocinética, farmacodinâmica, colinérgicos,
 *              bloqueadores neuromusculares, adrenérgicos, anestésicos locais,
 *              histamina e anti-histamínicos, AINEs e glicocorticoides.
 *   farmaco2 → Farmacologia II (em preparação — banco vazio por enquanto)
 *
 * A disciplina de cada turma é deduzida pelo nome da turma ("Farmacologia II",
 * "Farmaco 2" → farmaco2; o resto → farmaco1) e pode ser fixada à mão pelo
 * professor (rota game.definirDisciplinaTurma).
 *
 * Para criar o banco de Farmacologia II no futuro: criar
 * shared/gameQuestionsFarmaco2.ts (ids a partir de 1001), preencher
 * QUESTOES_POR_DISCIPLINA.farmaco2 e CHEFES.farmaco2 abaixo.
 *
 * Conteúdo gerado com apoio de IA e revisado tema a tema — recomenda-se a
 * revisão final do professor.
 */
import { ALL_GAME_QUESTIONS, type GameQuestion } from "./gameQuestions";

export type DisciplinaJogo = "farmaco1" | "farmaco2";

export const NOMES_DISCIPLINA: Record<DisciplinaJogo, string> = {
  farmaco1: "Farmacologia I",
  farmaco2: "Farmacologia II",
};

export type QuestaoComDisciplina = GameQuestion & { disciplina: DisciplinaJogo };

export const QUESTOES_POR_DISCIPLINA: Record<DisciplinaJogo, GameQuestion[]> = {
  farmaco1: ALL_GAME_QUESTIONS,
  farmaco2: [], // em preparação
};

export const TODAS_AS_QUESTOES: QuestaoComDisciplina[] = (Object.keys(QUESTOES_POR_DISCIPLINA) as DisciplinaJogo[])
  .flatMap((d) => QUESTOES_POR_DISCIPLINA[d].map((q) => ({ ...q, disciplina: d })));

/** Semanas que existem no banco da disciplina (ex.: 1..15). */
export function semanasDaDisciplina(d: DisciplinaJogo): number[] {
  return Array.from(new Set(QUESTOES_POR_DISCIPLINA[d].map((q) => q.weekNumber))).sort((a, b) => a - b);
}

/** Deduz a disciplina a partir dos textos da turma (nome, disciplina, curso). */
export function disciplinaPorNomeTurma(textos: Array<string | null | undefined>): DisciplinaJogo {
  const t = textos.filter(Boolean).join(" ").toLowerCase();
  // "Farmacologia II", "Farmacologia 2", "Farmaco II", "Farmaco 2" — sem confundir com "2026"
  if (/farmaco(logia)?\s*[-–]?\s*(ii|2)(?![0-9])/.test(t)) return "farmaco2";
  return "farmaco1";
}

// ═══════════════════════════════════════════════════════════════════
// CHEFES (Boss Battles) por semana
// ═══════════════════════════════════════════════════════════════════

export interface BossQuestion {
  question: string;
  alternatives: { id: string; text: string }[];
  correctAnswer: string;
  explanation: string;
}
export interface BossPhase {
  name: string;
  questions: BossQuestion[];
}
export interface ChefeSemana {
  weekNumber: number;
  /** id do visual (imagem/vídeo) existente em BossBattle.tsx */
  visualId: number;
  name: string;
  title: string;
  emoji?: string;
  color?: string;
  phases: BossPhase[];
}

// helper compacto: alternativas a,b,c,d
function bq(question: string, alts: [string, string, string, string], correct: "a" | "b" | "c" | "d", explanation: string): BossQuestion {
  return {
    question,
    alternatives: alts.map((text, i) => ({ id: "abcd"[i], text })),
    correctAnswer: correct,
    explanation,
  };
}

const CHEFES_FARMACO1: ChefeSemana[] = [
  // ── Semana 1 — Absorção e vias de administração
  {
    weekNumber: 1, visualId: 1, name: "Guardião do Portal", title: "Sentinela da Absorção",
    phases: [
      { name: "Vias de Administração", questions: [
        bq("Qual via de administração tem, por definição, 100% de biodisponibilidade?",
          ["Oral", "Intravenosa", "Sublingual", "Retal"], "b",
          "Na via intravenosa o fármaco é colocado diretamente na circulação sistêmica, sem etapa de absorção — por isso é a referência (100%) para calcular a biodisponibilidade das outras vias."),
        bq("A principal vantagem da via sublingual (ex.: nitroglicerina) em relação à via oral é:",
          ["Maior superfície de absorção que o intestino", "Escapar do efeito de primeira passagem hepático", "Permitir administrar grandes volumes", "Garantir liberação prolongada"], "b",
          "O sangue venoso da mucosa sublingual drena para a veia cava superior, e não para o sistema porta — o fármaco chega à circulação sistêmica sem passar antes pelo fígado."),
      ]},
      { name: "Absorção", questions: [
        bq("O efeito de primeira passagem corresponde a:",
          ["Metabolismo (principalmente hepático) do fármaco antes de atingir a circulação sistêmica", "Absorção no estômago", "Excreção renal imediata", "Ligação a proteínas plasmáticas"], "a",
          "Após absorção intestinal, o fármaco passa pela veia porta e pelo fígado antes de chegar à circulação sistêmica; o que é metabolizado nesse trajeto reduz a biodisponibilidade oral."),
        bq("Um fármaco atravessa membranas por difusão passiva com mais facilidade quando está:",
          ["Ionizado e hidrossolúvel", "Na forma não ionizada e lipossolúvel", "Ligado à albumina", "Em alto peso molecular e polar"], "b",
          "A difusão passiva através da bicamada lipídica favorece moléculas pequenas, não ionizadas e lipossolúveis. O pH do meio e o pKa definem a fração não ionizada."),
      ]},
      { name: "Biodisponibilidade", questions: [
        bq("Dizer que a biodisponibilidade oral de um fármaco é de 30% significa que:",
          ["30% da dose é excretada inalterada na urina", "30% da dose chega à circulação sistêmica na forma inalterada", "O fármaco age por 30% do intervalo entre doses", "30% do fármaco se liga a proteínas plasmáticas"], "b",
          "Biodisponibilidade (F) é a fração da dose que alcança a circulação sistêmica inalterada. Absorção incompleta e efeito de primeira passagem reduzem F."),
      ]},
    ],
  },
  // ── Semana 2 — Distribuição, metabolismo e excreção
  {
    weekNumber: 2, visualId: 12, name: "Leviatã da Eliminação", title: "Senhor da Distribuição, do Metabolismo e da Excreção", emoji: "🌊", color: "#06b6d4",
    phases: [
      { name: "Distribuição", questions: [
        bq("Qual característica do fármaco tende a AUMENTAR seu volume de distribuição (Vd)?",
          ["Alta ligação a proteínas plasmáticas", "Alta lipossolubilidade, com acúmulo nos tecidos", "Alta ionização no pH plasmático", "Molécula muito grande e polar"], "b",
          "Fármacos lipofílicos saem do plasma e se acumulam nos tecidos, o que eleva o Vd. Alta ligação a proteínas plasmáticas e alta polaridade mantêm o fármaco no plasma (Vd menor)."),
        bq("Apenas a fração LIVRE do fármaco (não ligada a proteínas plasmáticas) é capaz de:",
          ["Ser armazenada no fígado", "Atravessar membranas, alcançar o alvo e ser eliminada", "Ser detectada em exames de sangue", "Sofrer absorção oral"], "b",
          "A fração ligada à albumina funciona como reservatório inativo. É a fração livre que se distribui, interage com receptores, é metabolizada e filtrada."),
      ]},
      { name: "Metabolismo", questions: [
        bq("As reações de fase II (conjugação, ex.: glicuronidação) tipicamente:",
          ["Aumentam a lipossolubilidade do fármaco", "Tornam o metabólito mais polar e hidrossolúvel, facilitando a excreção", "Ocorrem exclusivamente nos rins", "Ativam todos os pró-fármacos"], "b",
          "A conjugação acrescenta grupos polares (ácido glicurônico, sulfato, glutationa, acetil), formando compostos mais hidrossolúveis, excretados pela urina ou pela bile."),
        bq("A prednisona precisa ser convertida no fígado em prednisolona para agir. Por isso ela é classificada como:",
          ["Pró-fármaco", "Antagonista", "Metabólito inativo", "Indutor enzimático"], "a",
          "Pró-fármaco é uma substância inativa (ou pouco ativa) que se torna ativa após biotransformação — a prednisona é convertida em prednisolona pela 11β-hidroxiesteroide desidrogenase hepática."),
      ]},
      { name: "Excreção", questions: [
        bq("Em doses repetidas a intervalos regulares, após quantas meias-vidas, aproximadamente, o fármaco atinge o estado de equilíbrio (steady state)?",
          ["1", "2", "4 a 5", "10 ou mais"], "c",
          "Com doses repetidas, o acúmulo se estabiliza após cerca de 4–5 meias-vidas (~94–97% do steady state). O mesmo raciocínio vale para a eliminação após suspender o fármaco."),
      ]},
    ],
  },
  // ── Semana 3 — Mecanismo de ação e interações medicamentosas
  {
    weekNumber: 3, visualId: 2, name: "Quimera dos Receptores", title: "Besta dos Mecanismos e das Interações",
    phases: [
      { name: "Receptores", questions: [
        bq("Qual tipo de receptor produz a resposta MAIS RÁPIDA (milissegundos)?",
          ["Receptor acoplado à proteína G", "Canal iônico regulado por ligante (ex.: receptor nicotínico)", "Receptor nuclear", "Receptor com atividade tirosina-quinase"], "b",
          "Canais iônicos ativados por ligante abrem em milissegundos ao ligar o agonista — é o caso do receptor nicotínico da placa motora."),
        bq("Os glicocorticoides agem em receptores intracelulares/nucleares. Isso explica que seu efeito anti-inflamatório:",
          ["Começa em milissegundos", "Depende de alterar a transcrição gênica, com início em horas", "Ocorre por abertura de canais de sódio", "Depende de proteína G na membrana"], "b",
          "O complexo glicocorticoide-receptor migra ao núcleo e modula a transcrição de genes — um processo lento (horas), diferente dos receptores de membrana."),
      ]},
      { name: "Antagonismo", questions: [
        bq("O efeito de um antagonista competitivo reversível pode ser superado ao:",
          ["Diminuir a dose do agonista", "Aumentar a concentração do agonista", "Associar outro antagonista", "Nada — o bloqueio é permanente"], "b",
          "Agonista e antagonista competitivo disputam o mesmo sítio; aumentando o agonista, ele volta a ocupar os receptores e o efeito máximo é recuperado."),
        bq("Na anafilaxia, a adrenalina reverte a broncoconstrição causada pela histamina agindo em receptores β2 — receptores DIFERENTES dos da histamina. Esse é um exemplo de:",
          ["Antagonismo competitivo", "Antagonismo fisiológico (funcional)", "Antagonismo químico", "Interação farmacocinética"], "b",
          "No antagonismo fisiológico, dois agonistas atuam em receptores diferentes e produzem efeitos opostos no mesmo órgão (broncoconstrição por H1 × broncodilatação por β2)."),
      ]},
      { name: "Interações", questions: [
        bq("Um inibidor do CYP450 associado a um fármaco metabolizado por essa enzima tende a:",
          ["Reduzir os níveis plasmáticos do segundo fármaco", "Aumentar os níveis plasmáticos do segundo fármaco e o risco de toxicidade", "Não alterar os níveis", "Acelerar a excreção renal do segundo fármaco"], "b",
          "Com o metabolismo inibido, a depuração cai e a concentração sobe — interação farmacocinética com risco de toxicidade, especialmente para fármacos de índice terapêutico estreito."),
      ]},
    ],
  },
  // ── Semana 4 — Farmacodinâmica quantitativa
  {
    weekNumber: 4, visualId: 13, name: "Quimera da Dose-Resposta", title: "Guardiã da Potência e da Eficácia", emoji: "📈", color: "#a855f7",
    phases: [
      { name: "Potência e Eficácia", questions: [
        bq("A potência de um fármaco é melhor representada por:",
          ["Seu efeito máximo (Emax)", "Sua EC50 — quanto menor, mais potente", "Sua meia-vida", "Seu volume de distribuição"], "b",
          "Potência diz quanto fármaco é necessário para produzir um efeito; é expressa pela EC50/DE50. Efeito máximo define a eficácia."),
        bq("A eficácia (Emax) de um fármaco corresponde a:",
          ["A dose necessária para 50% do efeito", "O efeito máximo que ele consegue produzir", "A velocidade de início de ação", "A distância entre a dose eficaz e a tóxica"], "b",
          "Eficácia é a resposta máxima atingível, mesmo aumentando a dose. Um fármaco pode ser muito potente e pouco eficaz, ou vice-versa."),
      ]},
      { name: "Agonistas e Antagonistas", questions: [
        bq("Comparado a um agonista total, um agonista parcial:",
          ["Tem maior efeito máximo", "Produz efeito máximo menor, mesmo ocupando todos os receptores", "Tem sempre menor potência", "Não se liga ao receptor"], "b",
          "O agonista parcial tem atividade intrínseca menor: mesmo com ocupação total dos receptores, a resposta máxima fica abaixo da do agonista total."),
        bq("Um antagonista irreversível (não competitivo) altera a curva dose-resposta do agonista:",
          ["Deslocando-a paralelamente à direita, sem mudar o Emax", "Reduzindo o efeito máximo alcançável", "Deslocando-a para a esquerda", "Sem qualquer alteração"], "b",
          "Como os receptores bloqueados não ficam disponíveis, aumentar o agonista não recupera totalmente a resposta — o Emax cai. É diferente do antagonista competitivo reversível."),
      ]},
      { name: "Segurança", questions: [
        bq("O índice terapêutico (IT) é definido como:",
          ["DE50 / DT50", "DT50 / DE50 (dose tóxica ÷ dose eficaz)", "Dose máxima / dose mínima", "Biodisponibilidade oral / intravenosa"], "b",
          "IT = DT50/DE50 (ou DL50/DE50 em estudos animais). Quanto maior o IT, maior a margem de segurança."),
        bq("A redução rápida da resposta a um agonista após exposições repetidas (ex.: uso excessivo de agonista β2 na asma) é chamada de:",
          ["Sensibilização", "Dessensibilização / taquifilaxia", "Idiossincrasia", "Sinergismo"], "b",
          "A exposição contínua ao agonista leva a desacoplamento e internalização de receptores, reduzindo a resposta (dessensibilização; quando rápida, taquifilaxia)."),
      ]},
    ],
  },
  // ── Semana 5 — Colinérgicos de ação direta e anticolinesterásicos
  {
    weekNumber: 5, visualId: 4, name: "Venger, o Senhor Colinérgico", title: "Mestre dos Receptores Muscarínicos",
    phases: [
      { name: "Colinérgicos Diretos", questions: [
        bq("Qual agonista muscarínico é usado no tratamento do glaucoma?",
          ["Atropina", "Pilocarpina", "Rocurônio", "Adrenalina"], "b",
          "A pilocarpina contrai o músculo ciliar e o esfíncter da pupila (M3), abrindo a malha trabecular e facilitando a drenagem do humor aquoso."),
        bq("O betanecol é indicado na retenção urinária não obstrutiva (pós-operatória) porque:",
          ["Bloqueia receptores M3 na bexiga", "Estimula receptores M3 do detrusor, promovendo contração vesical", "Relaxa o esfíncter por ação β2", "Inibe a acetilcolinesterase"], "b",
          "O betanecol é agonista muscarínico resistente à colinesterase, com ação predominante em bexiga e trato gastrointestinal."),
      ]},
      { name: "Anticolinesterásicos", questions: [
        bq("Qual anticolinesterásico é usado no tratamento sintomático da miastenia gravis?",
          ["Atropina", "Piridostigmina / neostigmina", "Succinilcolina", "Pralidoxima"], "b",
          "Inibindo reversivelmente a acetilcolinesterase, aumentam a ACh na junção neuromuscular e compensam a redução de receptores nicotínicos funcionais."),
        bq("Por que a fisostigmina atua no SNC e a neostigmina praticamente não?",
          ["A neostigmina é amina terciária muito lipossolúvel", "A fisostigmina é amina terciária (atravessa a barreira hematoencefálica); a neostigmina é amônio quaternário, com carga", "Somente a neostigmina inibe a acetilcolinesterase", "A fisostigmina é metabolizada no SNC"], "b",
          "Compostos de amônio quaternário têm carga permanente e atravessam mal membranas, incluindo a barreira hematoencefálica."),
      ]},
      { name: "Intoxicação", questions: [
        bq("Na intoxicação por organofosforado, a pralidoxima é útil porque:",
          ["Bloqueia receptores muscarínicos", "Reativa a acetilcolinesterase fosforilada, se usada antes do 'envelhecimento' da enzima", "Bloqueia receptores nicotínicos", "Acelera a excreção renal do tóxico"], "b",
          "A oxima remove o grupo fosfato da enzima. Após o envelhecimento (perda de um grupo alquil), a ligação se torna permanente — por isso deve ser precoce. A atropina continua sendo o antídoto dos efeitos muscarínicos."),
      ]},
    ],
  },
  // ── Semana 6 — Antagonistas colinérgicos e bloqueadores neuromusculares
  {
    weekNumber: 6, visualId: 3, name: "Hidra da Placa Motora", title: "Serpente dos Antimuscarínicos e Bloqueadores Neuromusculares",
    phases: [
      { name: "Antimuscarínicos", questions: [
        bq("A atropina bloqueia receptores muscarínicos. Qual efeito ela causa no olho?",
          ["Miose", "Midríase e cicloplegia", "Redução da pressão intraocular em qualquer paciente", "Nenhum efeito"], "b",
          "Bloqueando M3 no esfíncter da pupila e no músculo ciliar, a atropina causa midríase e paralisia da acomodação — e pode precipitar glaucoma de ângulo fechado."),
        bq("O ipratrópio inalatório é usado na DPOC/asma porque:",
          ["Estimula receptores β2", "Bloqueia receptores muscarínicos brônquicos, causando broncodilatação", "Inibe a acetilcolinesterase", "Bloqueia receptores H1"], "b",
          "Antagonista muscarínico de amônio quaternário: broncodilata com pouca absorção sistêmica e mínimos efeitos centrais."),
      ]},
      { name: "Bloqueador Despolarizante", questions: [
        bq("A succinilcolina é um bloqueador neuromuscular:",
          ["Não despolarizante competitivo", "Despolarizante — agonista nicotínico que causa despolarização persistente", "Anticolinesterásico", "Antimuscarínico"], "b",
          "Ela abre o receptor nicotínico e mantém a placa despolarizada (fasciculações iniciais seguidas de paralisia flácida). Não é revertida pela neostigmina na fase I."),
        bq("Em pacientes com grandes queimaduras ou lesões por esmagamento, a succinilcolina pode causar:",
          ["Hipocalemia", "Hipercalemia grave, com risco de arritmia", "Hipoglicemia", "Hipotermia"], "b",
          "Nessas condições há proliferação de receptores nicotínicos extrajuncionais; a despolarização disseminada libera grande quantidade de potássio das células musculares."),
      ]},
      { name: "Não Despolarizantes", questions: [
        bq("O sugamadex reverte o bloqueio pelo rocurônio porque:",
          ["Inibe a acetilcolinesterase", "Encapsula a molécula de rocurônio no plasma, retirando-a da placa motora", "Ativa receptores nicotínicos", "Aumenta a liberação de acetilcolina"], "b",
          "O sugamadex é uma ciclodextrina que se liga ao rocurônio/vecurônio, sem precisar aumentar a ACh — por isso não exige associação com atropina."),
      ]},
    ],
  },
  // ── Semana 7 — Revisão (semanas 1 a 6)
  {
    weekNumber: 7, visualId: 10, name: "Tiamat, Guardiã da 1ª Prova", title: "Revisão: Farmacocinética, Farmacodinâmica e Sistema Colinérgico",
    phases: [
      { name: "Farmacocinética", questions: [
        bq("Na intoxicação por ácido acetilsalicílico (ácido fraco), alcalinizar a urina:",
          ["Reduz a excreção, pois aumenta a reabsorção", "Aumenta a excreção, pois o fármaco fica ionizado e 'aprisionado' no túbulo", "Não altera a excreção", "Só é útil para bases fracas"], "b",
          "Em urina alcalina, o ácido fraco fica ionizado, não é reabsorvido passivamente e é eliminado — o 'aprisionamento iônico'."),
        bq("Um fármaco muito ligado à albumina é deslocado por outro fármaco. O efeito IMEDIATO esperado é:",
          ["Queda da fração livre", "Aumento transitório da fração livre (e do efeito)", "Redução do volume de distribuição a zero", "Aumento da absorção oral"], "b",
          "O deslocamento eleva a fração livre; em geral a eliminação também aumenta e o efeito é transitório, mas pode ser relevante em fármacos de índice terapêutico estreito."),
      ]},
      { name: "Farmacodinâmica", questions: [
        bq("Um fármaco A tem EC50 de 1 nM e um fármaco B, de 100 nM, ambos com o mesmo Emax. Conclui-se que:",
          ["B é mais potente", "A é mais potente, com a mesma eficácia", "A é mais eficaz", "Os dois têm a mesma potência"], "b",
          "Menor EC50 = maior potência. Como o efeito máximo é igual, a eficácia é a mesma."),
      ]},
      { name: "Sistema Colinérgico", questions: [
        bq("Na intoxicação por organofosforado, a atropina reverte quais manifestações?",
          ["Fasciculações e fraqueza muscular", "Bradicardia, broncorreia, salivação e miose (efeitos muscarínicos)", "Todas as manifestações, inclusive as nicotínicas", "Nenhuma"], "b",
          "A atropina é antagonista muscarínico: trata secreções, broncoespasmo e bradicardia, mas não os efeitos nicotínicos na placa motora."),
        bq("Para reverter um bloqueio por rocurônio com neostigmina, associa-se atropina (ou glicopirrolato) para:",
          ["Potencializar o bloqueio neuromuscular", "Prevenir os efeitos muscarínicos do excesso de ACh (bradicardia, secreções)", "Reativar a acetilcolinesterase", "Bloquear receptores nicotínicos"], "b",
          "A neostigmina aumenta a ACh em todas as sinapses colinérgicas; o antimuscarínico protege coração e vias aéreas enquanto a ACh reverte o bloqueio na placa motora."),
      ]},
    ],
  },
  // ── Semana 8 — Adrenérgicos e aminas simpaticomiméticas
  {
    weekNumber: 8, visualId: 5, name: "Tiamat, Dragão Adrenérgico", title: "As 5 Cabeças dos Receptores Adrenérgicos",
    phases: [
      { name: "Agonistas Diretos", questions: [
        bq("A adrenalina ativa quais receptores adrenérgicos?",
          ["Apenas α1", "Apenas β1 e β2", "Receptores α e β", "Apenas receptores muscarínicos"], "c",
          "A adrenalina é agonista não seletivo α1, α2, β1, β2 (e β3). Em doses baixas predominam efeitos β; em doses altas, a vasoconstrição α1."),
        bq("Qual agonista β2 seletivo é usado como broncodilatador de resgate na asma?",
          ["Propranolol", "Salbutamol", "Fenilefrina", "Clonidina"], "b",
          "O salbutamol relaxa a musculatura lisa brônquica via β2, com menos efeitos cardíacos que agonistas não seletivos."),
      ]},
      { name: "Aminas no Choque", questions: [
        bq("No choque séptico, a noradrenalina eleva a pressão arterial principalmente por:",
          ["Vasodilatação β2", "Vasoconstrição mediada por receptores α1", "Bloqueio β1", "Liberação de histamina"], "b",
          "A noradrenalina tem forte ação α1 (vasoconstrição) e β1, com pouca ação β2 — é o vasopressor de primeira escolha no choque séptico."),
        bq("A dobutamina é usada para aumentar o débito cardíaco por ser predominantemente:",
          ["Agonista α1", "Agonista β1 (inotrópico)", "Antagonista β1", "Agonista α2 central"], "b",
          "A dobutamina aumenta a contratilidade via β1, útil no choque cardiogênico com baixo débito."),
      ]},
      { name: "Ação Indireta", questions: [
        bq("A anfetamina é um simpaticomimético de ação:",
          ["Direta, agonista β2 seletivo", "Indireta — promove a liberação de noradrenalina (e dopamina) das terminações", "Antagonista α1", "Inibidora da acetilcolinesterase"], "b",
          "Aminas de ação indireta entram na terminação nervosa e deslocam as catecolaminas das vesículas, aumentando sua liberação."),
      ]},
    ],
  },
  // ── Semana 9 — Bloqueadores adrenérgicos
  {
    weekNumber: 9, visualId: 11, name: "Kraken dos Bloqueadores", title: "Monstro dos Antagonistas α e β", emoji: "🦑", color: "#0ea5e9",
    phases: [
      { name: "Antagonistas α", questions: [
        bq("A prazosina reduz a pressão arterial porque bloqueia receptores:",
          ["β1 cardíacos", "α1 vasculares", "α2 pré-sinápticos", "β2 brônquicos"], "b",
          "O bloqueio α1 relaxa a musculatura lisa arteriolar e venosa (e prostática), reduzindo a resistência periférica."),
        bq("Um efeito adverso típico da PRIMEIRA dose de um bloqueador α1 é:",
          ["Broncoespasmo", "Hipotensão postural com risco de síncope", "Hipoglicemia", "Bradicardia grave"], "b",
          "O 'efeito de primeira dose' é a hipotensão ortostática; por isso recomenda-se iniciar com dose baixa, à noite."),
      ]},
      { name: "Antagonistas β", questions: [
        bq("Por que o propranolol deve ser evitado em asmáticos?",
          ["Causa taquicardia", "Bloqueia receptores β2 brônquicos, podendo causar broncoconstrição", "Aumenta a pressão arterial", "Estimula receptores muscarínicos"], "b",
          "O propranolol é não seletivo (β1 e β2). Se o β-bloqueio for necessário, prefere-se um cardiosseletivo (β1), com cautela."),
        bq("Em um diabético em uso de insulina, os β-bloqueadores podem:",
          ["Causar hiperglicemia grave sempre", "Mascarar os sinais adrenérgicos de hipoglicemia (taquicardia, tremor)", "Potencializar a ação da insulina sem riscos", "Não ter relação com a glicemia"], "b",
          "Taquicardia e tremor, sinais de alerta da hipoglicemia, dependem de receptores β; com o bloqueio, o paciente pode não perceber o quadro (a sudorese, colinérgica, permanece)."),
      ]},
      { name: "Retirada", questions: [
        bq("A suspensão abrupta de um β-bloqueador usado cronicamente pode causar:",
          ["Bradicardia e hipotensão", "Taquicardia, hipertensão e piora de angina (efeito rebote)", "Broncoespasmo", "Hipercalemia"], "b",
          "O uso crônico aumenta o número de receptores β (up-regulation); na retirada súbita, a resposta às catecolaminas fica exagerada. A retirada deve ser gradual."),
      ]},
    ],
  },
  // ── Semana 10 — AINEs e analgésicos-antitérmicos
  {
    weekNumber: 10, visualId: 7, name: "Golem da Dor", title: "Colosso dos Anti-inflamatórios Não Esteroidais",
    phases: [
      { name: "Mecanismo", questions: [
        bq("Os AINEs tradicionais (ex.: ibuprofeno, naproxeno) inibem:",
          ["Apenas a COX-1", "Apenas a COX-2", "COX-1 e COX-2", "A fosfolipase A2"], "c",
          "Os AINEs não seletivos inibem ambas as isoformas, reduzindo prostaglandinas inflamatórias (COX-2) e também as protetoras gástricas e renais (COX-1)."),
        bq("A aspirina em baixa dose é antiagregante plaquetária porque:",
          ["Bloqueia receptores P2Y12", "Acetila irreversivelmente a COX-1 plaquetária, e a plaqueta (sem núcleo) não ressintetiza a enzima", "Inibe a trombina", "Inibe reversivelmente a COX-2"], "b",
          "Sem tromboxano A2 por toda a vida da plaqueta (~7–10 dias), a agregação fica reduzida."),
      ]},
      { name: "Efeitos Adversos", questions: [
        bq("O risco renal dos AINEs aumenta em pacientes hipovolêmicos ou em uso de diuréticos porque:",
          ["Os AINEs são diretamente nefrotóxicos em qualquer dose", "Inibem prostaglandinas vasodilatadoras que mantêm o fluxo renal nessas situações", "Aumentam a filtração glomerular", "Causam alcalose metabólica"], "b",
          "Quando o fluxo renal depende de prostaglandinas (hipovolemia, IC, cirrose, idosos), bloqueá-las pode causar lesão renal aguda."),
        bq("A aspirina deve ser evitada em crianças com infecção viral (ex.: varicela, influenza) pelo risco de:",
          ["Síndrome de Stevens-Johnson", "Síndrome de Reye (encefalopatia e lesão hepática)", "Agranulocitose", "Hipertermia maligna"], "b",
          "A associação entre aspirina e infecção viral em crianças está ligada à síndrome de Reye; prefere-se paracetamol ou ibuprofeno."),
      ]},
      { name: "Paracetamol", questions: [
        bq("Na intoxicação por paracetamol, o órgão mais lesado e o antídoto são:",
          ["Rim — bicarbonato", "Fígado — N-acetilcisteína", "Coração — atropina", "Pulmão — adrenalina"], "b",
          "Em superdosagem, o metabólito tóxico NAPQI esgota a glutationa e causa necrose hepática; a N-acetilcisteína repõe a glutationa."),
      ]},
    ],
  },
  // ── Semana 11 — Glicocorticoides
  {
    weekNumber: 11, visualId: 8, name: "Fênix do Cortisol", title: "Ave de Fogo dos Glicocorticoides",
    phases: [
      { name: "Mecanismo", questions: [
        bq("Os glicocorticoides exercem efeito anti-inflamatório principalmente por:",
          ["Bloquear receptores H1", "Ligarem-se a receptor intracelular e modular a transcrição gênica (↑ anexina-1, ↓ COX-2 e citocinas)", "Inibir apenas a COX-1", "Ativar receptores β2"], "b",
          "O complexo glicocorticoide-receptor ativa genes anti-inflamatórios (anexina-1/lipocortina, que inibe a fosfolipase A2) e reprime genes pró-inflamatórios."),
        bq("Comparada à hidrocortisona, a dexametasona tem:",
          ["Menor potência anti-inflamatória e maior efeito mineralocorticoide", "Maior potência glicocorticoide, longa duração e efeito mineralocorticoide mínimo", "Mesma potência e duração", "Somente ação tópica"], "b",
          "A dexametasona é cerca de 25–30 vezes mais potente que a hidrocortisona como glicocorticoide, com retenção de sódio desprezível."),
      ]},
      { name: "Efeitos Adversos", questions: [
        bq("Qual destes é um efeito adverso do uso crônico de glicocorticoides sistêmicos?",
          ["Hipoglicemia", "Osteoporose", "Hipotensão", "Ganho de massa muscular"], "b",
          "Também ocorrem hiperglicemia, aspecto cushingoide, miopatia, catarata, imunossupressão e supressão do eixo hipotálamo-hipófise-adrenal."),
        bq("Os glicocorticoides causam hiperglicemia principalmente por:",
          ["Estimular a secreção de insulina", "Aumentar a gliconeogênese hepática e reduzir a captação periférica de glicose", "Inibir a glicogenólise", "Bloquear receptores β2 no fígado"], "b",
          "São hormônios 'contra-insulínicos': estimulam a gliconeogênese e induzem resistência à insulina."),
      ]},
      { name: "Eixo HHA", questions: [
        bq("Após uso prolongado, a suspensão deve ser gradual porque:",
          ["O fármaco se acumula no tecido adiposo", "O eixo hipotálamo-hipófise-adrenal fica suprimido e a adrenal leva tempo para voltar a produzir cortisol", "Provoca dependência química", "Causa hipercalemia imediata"], "b",
          "A retirada abrupta pode precipitar insuficiência adrenal aguda (hipotensão, fraqueza, hipoglicemia)."),
      ]},
    ],
  },
  // ── Semana 12 — Anestésicos locais
  {
    weekNumber: 12, visualId: 6, name: "Espectro da Dormência", title: "Fantasma dos Anestésicos Locais",
    phases: [
      { name: "Mecanismo", questions: [
        bq("Os anestésicos locais bloqueiam a condução nervosa por:",
          ["Abrir canais de potássio", "Bloquear canais de sódio voltagem-dependentes pelo lado interno da membrana", "Estimular receptores GABA-A", "Inibir a liberação de acetilcolina"], "b",
          "A forma não ionizada atravessa a membrana; dentro do axônio, a forma ionizada bloqueia o canal de Na+, impedindo o potencial de ação."),
        bq("Por que o anestésico local funciona mal em tecido infectado/inflamado?",
          ["O tecido inflamado tem pH alcalino", "O pH ácido aumenta a fração ionizada, que atravessa mal a membrana do nervo", "O fluxo sanguíneo está reduzido", "As fibras nervosas desaparecem"], "b",
          "Os anestésicos locais são bases fracas: em meio ácido, predominam ionizados e chega menos fármaco ao interior do axônio."),
      ]},
      { name: "Classes e Adjuvantes", questions: [
        bq("Os anestésicos locais do tipo ÉSTER (ex.: procaína, benzocaína):",
          ["São metabolizados no fígado pelo CYP450", "São hidrolisados por colinesterases plasmáticas e têm maior potencial alérgico (PABA)", "Têm duração sempre maior que as amidas", "Não causam toxicidade sistêmica"], "b",
          "Ésteres são hidrolisados por pseudocolinesterases, gerando PABA, associado a reações alérgicas. Amidas (lidocaína, bupivacaína) são metabolizadas no fígado."),
        bq("A adrenalina associada ao anestésico local:",
          ["Encurta a duração do bloqueio", "Prolonga o bloqueio e reduz a absorção sistêmica (e a toxicidade) por vasoconstrição", "Aumenta a absorção sistêmica", "Substitui o anestésico"], "b",
          "A vasoconstrição local mantém o anestésico no sítio de ação por mais tempo. Deve ser usada com cautela em extremidades de circulação terminal."),
      ]},
      { name: "Toxicidade Sistêmica", questions: [
        bq("Na toxicidade sistêmica grave por anestésico local (convulsão, arritmia, colapso), uma medida específica é:",
          ["Naloxona", "Emulsão lipídica a 20% intravenosa", "Flumazenil", "Atropina em altas doses"], "b",
          "A emulsão lipídica funciona como 'reservatório' que sequestra o anestésico lipofílico (ex.: bupivacaína), junto com suporte avançado de vida."),
      ]},
    ],
  },
  // ── Semana 13 — Revisão (semanas 8 a 12)
  {
    weekNumber: 13, visualId: 15, name: "Titã da 2ª Revisão", title: "Adrenérgicos, AINEs, Glicocorticoides e Anestésicos Locais", emoji: "⚔️", color: "#ef4444",
    phases: [
      { name: "Sistema Adrenérgico", questions: [
        bq("Um paciente em uso de propranolol tem anafilaxia que responde mal à adrenalina. O fármaco que pode ser associado é:",
          ["Atropina", "Glucagon", "Dobutamina", "Prazosina"], "b",
          "O glucagon aumenta o AMPc cardíaco por receptor próprio, independente dos receptores β bloqueados, melhorando frequência e contratilidade."),
        bq("Um homem hipertenso com hiperplasia prostática benigna se beneficia particularmente de:",
          ["β-bloqueador não seletivo", "Bloqueador α1 (ex.: doxazosina)", "Agonista β2", "Agonista α1"], "b",
          "O bloqueio α1 relaxa vasos e musculatura lisa da próstata e do colo vesical, tratando os dois problemas."),
      ]},
      { name: "Inflamação", questions: [
        bq("A associação de AINE com glicocorticoide sistêmico aumenta principalmente o risco de:",
          ["Hipoglicemia", "Úlcera e sangramento gastrointestinal", "Bradicardia", "Broncodilatação excessiva"], "b",
          "O AINE reduz as prostaglandinas protetoras (COX-1) e o corticoide prejudica a cicatrização da mucosa — os efeitos se somam."),
      ]},
      { name: "Anestesia Local", questions: [
        bq("Zumbido, gosto metálico e formigamento perioral durante um bloqueio anestésico sugerem:",
          ["Alergia ao látex", "Sinais precoces de toxicidade sistêmica por anestésico local", "Efeito esperado e sem importância", "Hipoglicemia"], "b",
          "São sinais neurológicos iniciais da toxicidade sistêmica; deve-se interromper a injeção e preparar suporte, pois pode evoluir para convulsão e colapso cardiovascular."),
        bq("Qual anestésico local tem maior cardiotoxicidade?",
          ["Lidocaína", "Bupivacaína", "Procaína", "Benzocaína"], "b",
          "A bupivacaína dissocia-se lentamente dos canais de sódio cardíacos, podendo causar arritmias graves e refratárias."),
      ]},
    ],
  },
  // ── Semana 14 — Histamina e anti-histamínicos
  {
    weekNumber: 14, visualId: 14, name: "Basilisco da Histamina", title: "Serpente da Alergia", emoji: "🐍", color: "#ec4899",
    phases: [
      { name: "Histamina", questions: [
        bq("A ativação de receptores H1 pela histamina causa:",
          ["Broncodilatação e vasoconstrição", "Vasodilatação, aumento da permeabilidade vascular, prurido e broncoconstrição", "Aumento da secreção ácida gástrica", "Bradicardia isolada"], "b",
          "Essas ações H1 explicam urticária, edema, rinorreia e broncoespasmo nas reações alérgicas. A secreção ácida é mediada por H2."),
        bq("Os antagonistas H2 (ex.: famotidina) reduzem a acidez gástrica porque bloqueiam receptores nas:",
          ["Células principais", "Células parietais", "Células caliciformes", "Células G"], "b",
          "Nas células parietais, a histamina (via H2/AMPc) estimula a bomba de prótons; o bloqueio H2 reduz a secreção de ácido."),
      ]},
      { name: "Anti-H1", questions: [
        bq("Por que a loratadina causa MENOS sonolência que a difenidramina?",
          ["Não bloqueia receptores H1", "Atravessa pouco a barreira hematoencefálica", "É agonista H1", "Age apenas em receptores H2"], "b",
          "Os anti-H1 de 2ª geração são menos lipofílicos e, em geral, expulsos do SNC pela glicoproteína-P — atravessam pouco a barreira hematoencefálica."),
        bq("Boca seca, retenção urinária e visão borrada com anti-H1 de 1ª geração ocorrem porque eles também:",
          ["Estimulam receptores β", "Bloqueiam receptores muscarínicos (efeito anticolinérgico)", "Inibem a COX", "Bloqueiam canais de sódio cardíacos"], "b",
          "Difenidramina, prometazina e similares têm ação antimuscarínica relevante — cuidado em idosos, glaucoma de ângulo fechado e hiperplasia prostática."),
      ]},
      { name: "Anafilaxia", questions: [
        bq("Na anafilaxia, o tratamento de primeira linha é:",
          ["Anti-histamínico H1 intravenoso", "Adrenalina intramuscular", "Glicocorticoide oral", "Anti-histamínico H2"], "b",
          "Só a adrenalina reverte rapidamente vasodilatação, edema de vias aéreas e broncoespasmo (α1, β1, β2). Anti-histamínicos e corticoides são adjuvantes."),
      ]},
    ],
  },
  // ── Semana 15 — Revisão final
  {
    weekNumber: 15, visualId: 17, name: "Tiamat Omega — O Dragão Supremo", title: "Chefe Final de Farmacologia I",
    phases: [
      { name: "Bases Farmacológicas", questions: [
        bq("Um fármaco oral com extenso efeito de primeira passagem precisaria, por via IV, de uma dose:",
          ["Maior que a oral", "Menor que a oral, pois a biodisponibilidade IV é de 100%", "Igual à oral", "Impossível de calcular"], "b",
          "Como a via oral perde parte da dose no fígado antes da circulação sistêmica, a dose IV equivalente é menor."),
        bq("Um antagonista competitivo reversível, na curva dose-resposta do agonista, causa:",
          ["Queda do efeito máximo", "Desvio paralelo para a direita, com Emax preservado", "Desvio para a esquerda", "Nenhuma alteração"], "b",
          "Aumentando o agonista, o efeito máximo é alcançado; a EC50 aparente aumenta."),
      ]},
      { name: "SNA Integrado", questions: [
        bq("Paciente com intoxicação por organofosforado: qual é o antídoto dos efeitos muscarínicos?",
          ["Neostigmina", "Atropina", "Adrenalina", "Succinilcolina"], "b",
          "A atropina, titulada até secar as secreções brônquicas, é a base do tratamento; a pralidoxima pode ser associada precocemente."),
        bq("Paciente em uso de β-bloqueador não seletivo tem anafilaxia grave. Qual combinação é mais adequada?",
          ["Somente anti-histamínico", "Adrenalina IM e, se resposta inadequada, glucagon", "Propranolol adicional", "Atropina isolada"], "b",
          "O β-bloqueio reduz a resposta à adrenalina; o glucagon age por via independente dos receptores β."),
      ]},
      { name: "Caso Clínico Final", questions: [
        bq("Paciente com artrite em uso crônico de prednisona e de AINE diário é submetido a cirurgia com anestesia local com adrenalina. Qual alternativa reúne riscos corretos a monitorar?",
          ["Hipoglicemia por prednisona e broncodilatação por adrenalina", "Úlcera/sangramento digestivo (AINE + corticoide), insuficiência adrenal se o corticoide for suspenso abruptamente, e toxicidade sistêmica do anestésico se houver injeção intravascular", "Nenhum risco relevante", "Hipercalemia por AINE e hipotensão por adrenalina local"], "b",
          "Integra AINEs e glicocorticoides (risco gastrointestinal somado), eixo HHA suprimido (não suspender abruptamente; avaliar cobertura perioperatória) e anestésicos locais (sinais de toxicidade sistêmica)."),
      ]},
    ],
  },
];

export const CHEFES: Record<DisciplinaJogo, ChefeSemana[]> = {
  farmaco1: CHEFES_FARMACO1,
  farmaco2: [], // em preparação
};

export function chefeDaSemana(d: DisciplinaJogo, weekNumber: number): ChefeSemana | undefined {
  return CHEFES[d].find((c) => c.weekNumber === weekNumber);
}
