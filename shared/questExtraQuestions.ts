/**
 * Perguntas variantes de cada missão (sorteadas junto com a pergunta
 * principal de shared/gameQuestions.ts).
 *
 * REALINHADO ao cronograma 2026.2 (Farmacologia 1 — Medicina). A versão
 * anterior estava ligada à numeração ANTIGA do jogo (16 missões), então a
 * missão 5 puxava variantes de acetilcolina, a 8 de organofosforados, a 10 de
 * anestésicos gerais etc. Agora cada variante está na missão do tema certo:
 *
 *   Sem. 1  Absorção e vias ............ missões 1–4
 *   Sem. 2  Distribuição/metab./excreção  missões 6–9
 *   Sem. 3  Mecanismo de ação/interações  missões 11–14
 *   Sem. 5  Colinérgicos ............... missões 21–22
 *   Sem. 8  Adrenérgicos ............... missões 36–38
 *   Sem. 9  Bloqueadores adrenérgicos .. missão 41
 *   Sem. 10 AINEs ...................... missões 47–48
 *   Sem. 12 Anestésicos locais ......... missões 56–58
 *
 * Removidas por estarem fora da ementa de Farmacologia 1: anestésicos gerais,
 * opioides, antimicrobianos, diuréticos/IECA e psicotrópicos.
 *
 * Missões de CHEFE (a última de cada semana) não recebem variantes de
 * propósito: elas têm penalidade de PF e devem cobrar a pergunta integradora.
 */
export interface ExtraQuestion {
  description: string;
  alternatives: { id: string; text: string; isCorrect: boolean }[];
  explanation: string;
}

export const QUEST_EXTRA_QUESTIONS: Record<number, ExtraQuestion[]> = {
  // ══════════ SEMANA 1 — Absorção e vias de administração ══════════

  // Missão 1: O Portal da Farmacocinética (ADME)
  1: [
    {
      description: "Qual fator NÃO influencia a absorção de fármacos por via oral?",
      alternatives: [
        { id: "a", text: "pH gástrico", isCorrect: false },
        { id: "b", text: "Motilidade gastrointestinal", isCorrect: false },
        { id: "c", text: "Cor do comprimido", isCorrect: true },
        { id: "d", text: "Presença de alimentos", isCorrect: false },
      ],
      explanation: "A cor do comprimido é apenas estética e não influencia a absorção. pH, motilidade e alimentos são fatores reais.",
    },
  ],

  // ══════════ SEMANA 2 — Distribuição, metabolismo e excreção ══════════

  // Missão 6: O Mapa da Distribuição (Vd)
  6: [
    {
      description: "Qual proteína plasmática é a principal responsável pela ligação de fármacos ácidos?",
      alternatives: [
        { id: "a", text: "Albumina", isCorrect: true },
        { id: "b", text: "Globulina", isCorrect: false },
        { id: "c", text: "Fibrinogênio", isCorrect: false },
        { id: "d", text: "Transferrina", isCorrect: false },
      ],
      explanation: "A albumina é a principal proteína de ligação para fármacos ácidos no plasma.",
    },
    {
      description: "O que acontece quando dois fármacos competem pela mesma proteína plasmática?",
      alternatives: [
        { id: "a", text: "Ambos são inativados", isCorrect: false },
        { id: "b", text: "A fração livre do fármaco deslocado aumenta, podendo intensificar seu efeito", isCorrect: true },
        { id: "c", text: "Ambos deixam de ser eliminados", isCorrect: false },
        { id: "d", text: "Não há nenhuma consequência possível", isCorrect: false },
      ],
      explanation: "Quando um fármaco é deslocado da proteína, sua fração livre aumenta; o efeito pode se intensificar, sobretudo em fármacos de margem terapêutica estreita.",
    },
    {
      description: "Em qual compartimento corporal fármacos muito lipofílicos tendem a se acumular, aumentando o volume de distribuição?",
      alternatives: [
        { id: "a", text: "Plasma sanguíneo", isCorrect: false },
        { id: "b", text: "Líquido extracelular", isCorrect: false },
        { id: "c", text: "Tecido adiposo", isCorrect: true },
        { id: "d", text: "Líquido cefalorraquidiano", isCorrect: false },
      ],
      explanation: "Fármacos lipofílicos se acumulam no tecido adiposo, resultando em grande volume de distribuição.",
    },
    {
      description: "O que é a meia-vida plasmática (t½) de um fármaco?",
      alternatives: [
        { id: "a", text: "Tempo para o fármaco atingir o pico de concentração", isCorrect: false },
        { id: "b", text: "Tempo para a concentração plasmática cair pela metade", isCorrect: true },
        { id: "c", text: "Tempo total de ação do fármaco no organismo", isCorrect: false },
        { id: "d", text: "Tempo para o fármaco ser completamente absorvido", isCorrect: false },
      ],
      explanation: "A meia-vida (t½) é o tempo necessário para a concentração plasmática do fármaco cair pela metade.",
    },
  ],

  // Missão 7: As Duas Fases da Transformação (metabolismo)
  7: [
    {
      description: "Quais reações caracterizam a fase I do metabolismo hepático?",
      alternatives: [
        { id: "a", text: "Conjugação com ácido glicurônico", isCorrect: false },
        { id: "b", text: "Oxidação, redução e hidrólise, principalmente pelo citocromo P450", isCorrect: true },
        { id: "c", text: "Acetilação e metilação", isCorrect: false },
        { id: "d", text: "Ligação a proteínas plasmáticas", isCorrect: false },
      ],
      explanation: "Reações de fase I (funcionalização) envolvem oxidação, redução e hidrólise, principalmente pelo sistema CYP450.",
    },
  ],

  // Missão 8: O Filtro Renal (excreção)
  8: [
    {
      description: "Qual é a principal via de excreção de fármacos e seus metabólitos?",
      alternatives: [
        { id: "a", text: "Via biliar", isCorrect: false },
        { id: "b", text: "Via renal", isCorrect: true },
        { id: "c", text: "Via pulmonar", isCorrect: false },
        { id: "d", text: "Via cutânea", isCorrect: false },
      ],
      explanation: "A via renal é a principal via de excreção de fármacos, por filtração glomerular, secreção tubular e reabsorção.",
    },
  ],

  // Missão 9: O Duelo das Enzimas (CYP)
  9: [
    {
      description: "Por que as interações envolvendo o CYP3A4 têm tanta importância clínica?",
      alternatives: [
        { id: "a", text: "Porque o CYP3A4 metaboliza apenas 5% dos fármacos", isCorrect: false },
        { id: "b", text: "Porque o CYP3A4 participa do metabolismo de cerca de metade dos fármacos em uso", isCorrect: true },
        { id: "c", text: "Porque o CYP3A4 só existe nos rins", isCorrect: false },
        { id: "d", text: "Porque o CYP3A4 não é afetado por indutores nem inibidores", isCorrect: false },
      ],
      explanation: "O CYP3A4 participa do metabolismo de cerca de metade dos fármacos, tornando-o o principal alvo de interações medicamentosas.",
    },
  ],

  // ══════════ SEMANA 3 — Mecanismo de ação e interações ══════════

  // Missão 11: O Encaixe Perfeito (agonistas e receptores)
  11: [
    {
      description: "Qual é a diferença entre agonista total e agonista parcial?",
      alternatives: [
        { id: "a", text: "O agonista total age mais rápido", isCorrect: false },
        { id: "b", text: "O agonista parcial produz resposta máxima menor, mesmo ocupando todos os receptores", isCorrect: true },
        { id: "c", text: "O agonista total tem sempre mais efeitos colaterais", isCorrect: false },
        { id: "d", text: "O agonista parcial não se liga ao receptor", isCorrect: false },
      ],
      explanation: "O agonista parcial tem atividade intrínseca menor que a do agonista total, produzindo resposta submáxima mesmo com ocupação total dos receptores.",
    },
    {
      description: "O que é um agonista inverso?",
      alternatives: [
        { id: "a", text: "Um fármaco que apenas bloqueia o receptor, sem efeito próprio", isCorrect: false },
        { id: "b", text: "Um fármaco que reduz a atividade constitutiva do receptor, produzindo efeito oposto ao do agonista", isCorrect: true },
        { id: "c", text: "Um antagonista competitivo", isCorrect: false },
        { id: "d", text: "Um fármaco que age em um receptor diferente", isCorrect: false },
      ],
      explanation: "O agonista inverso reduz a atividade basal (constitutiva) do receptor, produzindo efeito oposto ao do agonista.",
    },
    {
      description: "Receptores acoplados à proteína G (GPCRs) possuem quantos domínios transmembrana?",
      alternatives: [
        { id: "a", text: "3 domínios", isCorrect: false },
        { id: "b", text: "5 domínios", isCorrect: false },
        { id: "c", text: "7 domínios", isCorrect: true },
        { id: "d", text: "12 domínios", isCorrect: false },
      ],
      explanation: "GPCRs são receptores com 7 domínios transmembrana (receptores serpentinos).",
    },
    {
      description: "Qual tipo de receptor possui atividade enzimática intrínseca?",
      alternatives: [
        { id: "a", text: "Receptor ionotrópico", isCorrect: false },
        { id: "b", text: "Receptor acoplado à proteína G", isCorrect: false },
        { id: "c", text: "Receptor tirosina-quinase", isCorrect: true },
        { id: "d", text: "Receptor nuclear", isCorrect: false },
      ],
      explanation: "Receptores tirosina-quinase (ex: receptor de insulina) possuem atividade enzimática intrínseca.",
    },
    {
      description: "O que é dessensibilização (taquifilaxia) de receptores?",
      alternatives: [
        { id: "a", text: "Aumento da resposta após exposição repetida", isCorrect: false },
        { id: "b", text: "Diminuição da resposta após exposição prolongada ao agonista", isCorrect: true },
        { id: "c", text: "Bloqueio irreversível do receptor", isCorrect: false },
        { id: "d", text: "Aumento do número de receptores", isCorrect: false },
      ],
      explanation: "Dessensibilização é a redução progressiva da resposta após exposição contínua ao agonista.",
    },
  ],

  // Missão 13: O Antagonista Removível (antagonismo e curva dose-resposta)
  13: [
    {
      description: "Qual é a característica de um antagonista NÃO competitivo?",
      alternatives: [
        { id: "a", text: "Pode ser superado aumentando a dose do agonista", isCorrect: false },
        { id: "b", text: "Liga-se a um sítio diferente do agonista e reduz o efeito máximo (Emax)", isCorrect: true },
        { id: "c", text: "Tem afinidade e atividade intrínseca", isCorrect: false },
        { id: "d", text: "Bloqueia reversivelmente o mesmo sítio do agonista", isCorrect: false },
      ],
      explanation: "O antagonista não competitivo atua em sítio alostérico (ou de forma irreversível), reduzindo o Emax, que não é recuperado aumentando o agonista.",
    },
    {
      description: "O que acontece com a curva dose-resposta do agonista na presença de um antagonista competitivo?",
      alternatives: [
        { id: "a", text: "Desloca-se para a direita, sem alterar o Emax", isCorrect: true },
        { id: "b", text: "Desloca-se para a esquerda", isCorrect: false },
        { id: "c", text: "O Emax diminui, sem deslocamento", isCorrect: false },
        { id: "d", text: "A resposta desaparece completamente", isCorrect: false },
      ],
      explanation: "O antagonista competitivo desloca a curva para a direita (aumenta a EC50), mas o Emax ainda pode ser alcançado com doses maiores de agonista.",
    },
    {
      description: "Um fármaco com alta POTÊNCIA necessariamente tem alta EFICÁCIA?",
      alternatives: [
        { id: "a", text: "Sim, potência e eficácia são sinônimos", isCorrect: false },
        { id: "b", text: "Não, são conceitos independentes", isCorrect: true },
        { id: "c", text: "Sim, pois ambos dependem apenas da afinidade", isCorrect: false },
        { id: "d", text: "Depende apenas da via de administração", isCorrect: false },
      ],
      explanation: "Potência (dose necessária para o efeito) e eficácia (efeito máximo possível) são conceitos independentes.",
    },
    {
      description: "O que representa a EC50 em uma curva dose-resposta?",
      alternatives: [
        { id: "a", text: "Dose que causa efeito em 50% dos pacientes", isCorrect: false },
        { id: "b", text: "Concentração que produz 50% do efeito máximo", isCorrect: true },
        { id: "c", text: "Dose letal para 50% da população", isCorrect: false },
        { id: "d", text: "Concentração mínima eficaz", isCorrect: false },
      ],
      explanation: "EC50 é a concentração que produz 50% da resposta máxima (Emax); quanto menor a EC50, mais potente o fármaco.",
    },
  ],

  // Missão 14: A Armadilha da Varfarina (margem terapêutica)
  14: [
    {
      description: "O índice terapêutico de um fármaco é definido como:",
      alternatives: [
        { id: "a", text: "A relação entre a dose eficaz e a dose máxima", isCorrect: false },
        { id: "b", text: "A relação DL50/DE50", isCorrect: true },
        { id: "c", text: "A relação entre potência e eficácia", isCorrect: false },
        { id: "d", text: "A relação entre absorção e eliminação", isCorrect: false },
      ],
      explanation: "O índice terapêutico (DL50/DE50) indica a margem de segurança; fármacos como a varfarina têm índice estreito, por isso interações pesam tanto.",
    },
  ],

  // ══════════ SEMANA 5 — Colinérgicos e anticolinesterásicos ══════════

  // Missão 21: O Chamado Direto
  21: [
    {
      description: "A acetilcolina é agonista endógeno de quais tipos de receptores?",
      alternatives: [
        { id: "a", text: "Apenas nicotínicos", isCorrect: false },
        { id: "b", text: "Apenas muscarínicos", isCorrect: false },
        { id: "c", text: "Nicotínicos e muscarínicos", isCorrect: true },
        { id: "d", text: "Adrenérgicos e colinérgicos", isCorrect: false },
      ],
      explanation: "A acetilcolina é agonista endógeno tanto de receptores nicotínicos quanto muscarínicos.",
    },
  ],

  // Missão 22: O Acúmulo Silencioso (anticolinesterásicos)
  22: [
    {
      description: "Qual enzima degrada a acetilcolina na fenda sináptica?",
      alternatives: [
        { id: "a", text: "Monoamina oxidase (MAO)", isCorrect: false },
        { id: "b", text: "COMT", isCorrect: false },
        { id: "c", text: "Acetilcolinesterase", isCorrect: true },
        { id: "d", text: "Tirosina hidroxilase", isCorrect: false },
      ],
      explanation: "A acetilcolinesterase hidrolisa a acetilcolina em colina e acetato na fenda sináptica.",
    },
    {
      description: "Qual é o mecanismo de ação dos organofosforados (pesticidas)?",
      alternatives: [
        { id: "a", text: "Bloqueio de receptores nicotínicos", isCorrect: false },
        { id: "b", text: "Inibição irreversível da acetilcolinesterase", isCorrect: true },
        { id: "c", text: "Estimulação direta de receptores muscarínicos", isCorrect: false },
        { id: "d", text: "Bloqueio da liberação de acetilcolina", isCorrect: false },
      ],
      explanation: "Organofosforados inibem irreversivelmente a acetilcolinesterase, causando acúmulo de acetilcolina e crise colinérgica.",
    },
  ],

  // ══════════ SEMANA 8 — Adrenérgicos ══════════

  // Missão 36: Os Dois Reinos Adrenérgicos
  36: [
    {
      description: "Qual neurotransmissor é liberado pelas terminações pós-ganglionares simpáticas na maioria dos órgãos?",
      alternatives: [
        { id: "a", text: "Acetilcolina", isCorrect: false },
        { id: "b", text: "Noradrenalina", isCorrect: true },
        { id: "c", text: "Dopamina", isCorrect: false },
        { id: "d", text: "Serotonina", isCorrect: false },
      ],
      explanation: "As fibras pós-ganglionares simpáticas liberam noradrenalina (exceto nas glândulas sudoríparas, que recebem acetilcolina).",
    },
    {
      description: "A resposta de 'luta ou fuga' é mediada por qual divisão do sistema nervoso autônomo?",
      alternatives: [
        { id: "a", text: "Parassimpática", isCorrect: false },
        { id: "b", text: "Simpática", isCorrect: true },
        { id: "c", text: "Entérica", isCorrect: false },
        { id: "d", text: "Somática", isCorrect: false },
      ],
      explanation: "O sistema simpático medeia a resposta de 'luta ou fuga', com liberação de noradrenalina e adrenalina.",
    },
  ],

  // Missão 37: A Amina de Emergência
  37: [
    {
      description: "Qual é o efeito da ativação de receptores α1-adrenérgicos nos vasos sanguíneos?",
      alternatives: [
        { id: "a", text: "Vasodilatação", isCorrect: false },
        { id: "b", text: "Vasoconstrição", isCorrect: true },
        { id: "c", text: "Nenhum efeito", isCorrect: false },
        { id: "d", text: "Aumento da permeabilidade capilar", isCorrect: false },
      ],
      explanation: "A ativação de α1 na musculatura lisa vascular causa vasoconstrição e aumento da pressão arterial — um dos efeitos que tornam a adrenalina útil na anafilaxia.",
    },
  ],

  // Missão 38: O Alívio das Vias Aéreas
  38: [
    {
      description: "Qual receptor adrenérgico, quando ativado, causa broncodilatação?",
      alternatives: [
        { id: "a", text: "α1", isCorrect: false },
        { id: "b", text: "α2", isCorrect: false },
        { id: "c", text: "β1", isCorrect: false },
        { id: "d", text: "β2", isCorrect: true },
      ],
      explanation: "Receptores β2 nos brônquios relaxam a musculatura lisa, causando broncodilatação.",
    },
  ],

  // ══════════ SEMANA 9 — Bloqueadores adrenérgicos ══════════

  // Missão 41: O Freio Beta
  41: [
    {
      description: "Por quais mecanismos os β-bloqueadores reduzem a pressão arterial?",
      alternatives: [
        { id: "a", text: "Vasodilatação direta", isCorrect: false },
        { id: "b", text: "Redução do débito cardíaco e da liberação de renina", isCorrect: true },
        { id: "c", text: "Aumento da excreção de sódio", isCorrect: false },
        { id: "d", text: "Bloqueio de canais de cálcio", isCorrect: false },
      ],
      explanation: "β-bloqueadores reduzem a frequência e o débito cardíaco e a secreção de renina (β1 renal), diminuindo a pressão arterial.",
    },
  ],

  // ══════════ SEMANA 10 — AINEs ══════════

  // Missão 47: Os Efeitos Indesejados
  47: [
    {
      description: "Por que o uso crônico de AINEs pode causar úlcera gástrica?",
      alternatives: [
        { id: "a", text: "Porque aumentam diretamente a secreção de ácido", isCorrect: false },
        { id: "b", text: "Porque inibem a COX-1, que produz prostaglandinas protetoras da mucosa", isCorrect: true },
        { id: "c", text: "Porque destroem diretamente as células parietais", isCorrect: false },
        { id: "d", text: "Porque bloqueiam receptores H2", isCorrect: false },
      ],
      explanation: "A inibição da COX-1 reduz prostaglandinas gastroprotetoras, diminuindo muco e bicarbonato e o fluxo sanguíneo da mucosa.",
    },
  ],

  // Missão 48: A Seletividade da COX-2
  48: [
    {
      description: "Qual é a principal diferença entre AINEs seletivos e não seletivos?",
      alternatives: [
        { id: "a", text: "Os seletivos inibem preferencialmente a COX-2; os não seletivos inibem COX-1 e COX-2", isCorrect: true },
        { id: "b", text: "Os seletivos são sempre mais potentes", isCorrect: false },
        { id: "c", text: "Os não seletivos têm menos efeitos colaterais", isCorrect: false },
        { id: "d", text: "Os seletivos são todos de uso tópico", isCorrect: false },
      ],
      explanation: "Os coxibes inibem preferencialmente a COX-2, reduzindo efeitos gastrointestinais, mas com preocupação de risco cardiovascular.",
    },
  ],

  // ══════════ SEMANA 12 — Anestésicos locais ══════════

  // Missão 56: O Bloqueio do Impulso
  56: [
    {
      description: "Qual é o mecanismo de ação dos anestésicos locais?",
      alternatives: [
        { id: "a", text: "Bloqueio de receptores de dor", isCorrect: false },
        { id: "b", text: "Bloqueio de canais de sódio voltagem-dependentes", isCorrect: true },
        { id: "c", text: "Ativação de receptores opioides locais", isCorrect: false },
        { id: "d", text: "Inibição da COX local", isCorrect: false },
      ],
      explanation: "Anestésicos locais bloqueiam canais de Na+ voltagem-dependentes, impedindo a condução do impulso nervoso.",
    },
  ],

  // Missão 57: Ésteres e Amidas
  57: [
    {
      description: "Qual destes anestésicos locais pertence ao grupo dos ÉSTERES?",
      alternatives: [
        { id: "a", text: "Lidocaína", isCorrect: false },
        { id: "b", text: "Bupivacaína", isCorrect: false },
        { id: "c", text: "Procaína", isCorrect: true },
        { id: "d", text: "Ropivacaína", isCorrect: false },
      ],
      explanation: "A procaína é um éster; lidocaína, bupivacaína e ropivacaína são amidas.",
    },
  ],

  // Missão 58: O Vasoconstritor Aliado
  58: [
    {
      description: "Por que a adrenalina é frequentemente adicionada a anestésicos locais?",
      alternatives: [
        { id: "a", text: "Para aumentar a potência intrínseca do anestésico", isCorrect: false },
        { id: "b", text: "Para causar vasoconstrição local e prolongar o efeito", isCorrect: true },
        { id: "c", text: "Para prevenir reações alérgicas", isCorrect: false },
        { id: "d", text: "Para reduzir a dor da injeção", isCorrect: false },
      ],
      explanation: "A adrenalina causa vasoconstrição local, reduzindo a absorção sistêmica e prolongando a duração do anestésico.",
    },
  ],
};