/**
 * Banco completo de questões do jogo Caverna do Dragão — Farmacologia I
 * 15 semanas de jogo × 5 questões = 75 missões
 * Dificuldade crescente por semana: Q1=fácil, Q2=fácil, Q3=médio, Q4=difícil, Q5=chefe (boss)
 *
 * REFORMULADO para cobrir SOMENTE os temas reais da ementa de Farmacologia 1
 * (Medicina), alinhado ao cronograma real da disciplina:
 *   Semana 1  — Farmacocinética/Farmacodinâmica: Absorção e Vias
 *   Semana 2  — Distribuição, Metabolismo e Excreção
 *   Semana 3  — Mecanismo de ação e Interações medicamentosas
 *   Semana 4  — Boas Práticas de Prescrição
 *   Semana 5  — Colinérgicos de ação direta e anticolinesterásicos
 *   Semana 6  — Antagonistas colinérgicos e bloqueadores neuromusculares
 *   Semana 7  — Revisão geral (semanas 1-6) — dia de Seminários
 *   Semana 8  — Adrenérgicos e aminas simpaticomiméticas
 *   Semana 9  — Bloqueadores Adrenérgicos
 *   Semana 10 — Anti-inflamatórios Não Esteroidais (AINEs)
 *   Semana 11 — Glicocorticoides
 *   Semana 12 — Anestésicos Locais
 *   Semana 13 — Revisão geral (semanas 8-12) — dia de Seminários
 *   Semana 14 — Histamina e Anti-histamínicos
 *   Semana 15 — Revisão Geral / Prova Final
 *
 * Sistema de PF (Pontos Farmacológicos):
 * Semanas 1-4:   Q1-Q4 = 1 PF cada, Q5 (boss) = 1 PF
 * Semanas 5-15:  Q1-Q4 = 1 PF cada, Q5 (boss) = 2 PF
 *
 * Penalidade por erro no boss: -1 PF (descontado do total acumulado)
 *
 * IMPORTANTE: as perguntas/explicações foram escritas e revisadas com
 * cuidado, mas são conteúdo gerado por IA — recomenda-se uma revisão final
 * do professor antes de publicar para os alunos, especialmente em pontos
 * de nuance clínica ou onde a literatura possa divergir.
 */

export interface Alternative {
  id: "a" | "b" | "c" | "d";
  text: string;
  isCorrect: boolean;
}

export interface GameQuestion {
  id: number;           // 1-75
  weekNumber: number;   // 1-15
  questionInWeek: number; // 1-5 (5 = boss)
  title: string;
  npcName: string;
  npcType: "warrior" | "mage" | "healer" | "boss";
  difficulty: "easy" | "medium" | "hard" | "boss";
  isBossQuestion: boolean;
  pfReward: number;     // PF ganhos ao acertar
  pfPenalty: number;    // PF perdidos ao errar (apenas boss questions)
  description: string;
  alternatives: Alternative[];
  explanation: string;
}

// Helper to build a question
function q(
  id: number, week: number, qInWeek: number,
  title: string, npcName: string, npcType: GameQuestion["npcType"],
  difficulty: GameQuestion["difficulty"],
  description: string,
  alternatives: Alternative[],
  explanation: string
): GameQuestion {
  // isBoss é deduzido pela dificuldade "boss" (não mais pela posição fixa
  // qInWeek===5), porque agora as semanas de revisão (7, 13, 15) têm mais
  // perguntas regulares que as demais — o chefe pode estar em qualquer
  // posição, sempre a última da semana.
  const isBoss = difficulty === "boss";
  // PF reward: semanas 1-4 boss=1PF; semanas 5-15 boss=2PF; regulares sempre 1PF
  let pfReward = 1;
  if (isBoss && week >= 5) pfReward = 2;

  return {
    id, weekNumber: week, questionInWeek: qInWeek,
    title, npcName, npcType, difficulty, isBossQuestion: isBoss,
    pfReward, pfPenalty: isBoss ? 1 : 0,
    description, alternatives, explanation,
  };
}

export const ALL_GAME_QUESTIONS: GameQuestion[] = [

  // ══════════════════════════════════════════════════════════════════
  // SEMANA 1 — Farmacocinética/Farmacodinâmica: Absorção e Vias de Administração
  // ══════════════════════════════════════════════════════════════════
  q(1, 1, 1, "O Portal da Farmacocinética", "Mestre dos Magos", "mage", "easy",
    "Qual é a ordem correta dos processos farmacocinéticos (ADME)?",
    [
      { id: "a", text: "Absorção → Distribuição → Metabolismo → Excreção", isCorrect: true },
      { id: "b", text: "Distribuição → Absorção → Excreção → Metabolismo", isCorrect: false },
      { id: "c", text: "Metabolismo → Absorção → Distribuição → Excreção", isCorrect: false },
      { id: "d", text: "Excreção → Metabolismo → Distribuição → Absorção", isCorrect: false },
    ],
    "A sigla ADME resume a sequência: Absorção, Distribuição, Metabolismo e Excreção."
  ),

  q(2, 1, 2, "A Via Direta ao Sangue", "Hank", "warrior", "easy",
    "Qual via de administração tem, por definição, 100% de biodisponibilidade?",
    [
      { id: "a", text: "Via oral" },
      { id: "b", text: "Via sublingual" },
      { id: "c", text: "Via intravenosa" },
      { id: "d", text: "Via intramuscular" },
    ].map(a => ({ ...a, isCorrect: a.id === "c" } as Alternative)),
    "A via IV entrega o fármaco diretamente na circulação sistêmica, sem nenhuma etapa de absorção — por isso é a referência (100%) para calcular a biodisponibilidade de outras vias."
  ),

  q(3, 1, 3, "O Primeiro Obstáculo", "Presto", "mage", "medium",
    "Um fármaco administrado por via oral sofre extenso metabolismo hepático antes de atingir a circulação sistêmica. Esse fenômeno é chamado de:",
    [
      { id: "a", text: "Efeito de primeira passagem" },
      { id: "b", text: "Efeito rebote" },
      { id: "c", text: "Indução enzimática" },
      { id: "d", text: "Recirculação êntero-hepática" },
    ].map(a => ({ ...a, isCorrect: a.id === "a" } as Alternative)),
    "O efeito de primeira passagem ocorre porque fármacos absorvidos no intestino vão pela veia porta direto ao fígado antes de alcançar a circulação sistêmica, podendo reduzir bastante a biodisponibilidade oral."
  ),

  q(4, 1, 4, "A Barreira Iônica", "Sheila", "warrior", "hard",
    "Um fármaco é um ácido fraco (pKa 4,4). Em qual compartimento ele estará MAIS ionizado, e por isso menos absorvido por difusão passiva?",
    [
      { id: "a", text: "No estômago (pH ácido)" },
      { id: "b", text: "No plasma (pH ~7,4)" },
      { id: "c", text: "Na urina ácida" },
      { id: "d", text: "Na saliva" },
    ].map(a => ({ ...a, isCorrect: a.id === "b" } as Alternative)),
    "Pela equação de Henderson-Hasselbalch, um ácido fraco fica MENOS ionizado (mais absorvível) em meio ácido (estômago) e MAIS ionizado em meio básico/neutro como o plasma — por isso ácidos fracos tendem a ser bem absorvidos no estômago."
  ),

  q(5, 1, 5, "O Guardião da Farmacocinética", "Dragão Ancião", "boss", "boss",
    "Um paciente toma um comprimido de um fármaco ácido fraco. Comparado à administração do mesmo fármaco por via intravenosa, o que se espera da via oral?",
    [
      { id: "a", text: "Pico de concentração mais rápido e biodisponibilidade igual ou maior" },
      { id: "b", text: "Início de ação mais lento e biodisponibilidade igual ou menor" },
      { id: "c", text: "Início de ação idêntico, sem qualquer diferença" },
      { id: "d", text: "Excreção renal completamente bloqueada" },
    ].map(a => ({ ...a, isCorrect: a.id === "b" } as Alternative)),
    "A via oral depende de dissolução, absorção intestinal e pode sofrer efeito de primeira passagem — por isso o início de ação é mais lento e a biodisponibilidade tende a ser igual ou menor que a via IV (que é sempre 100%)."
  ),

  // ══════════════════════════════════════════════════════════════════
  // SEMANA 2 — Distribuição, Metabolismo e Excreção
  // ══════════════════════════════════════════════════════════════════
  q(6, 2, 1, "O Mapa da Distribuição", "Mestre dos Magos", "mage", "easy",
    "Um fármaco tem volume de distribuição (Vd) de 500 L num adulto de 70 kg. Isso sugere que o fármaco:",
    [
      { id: "a", text: "Fica retido principalmente no plasma" },
      { id: "b", text: "Distribui-se amplamente pelos tecidos" },
      { id: "c", text: "Não atravessa nenhuma membrana celular" },
      { id: "d", text: "É eliminado exclusivamente pelos pulmões" },
    ].map(a => ({ ...a, isCorrect: a.id === "b" } as Alternative)),
    "Um Vd muito maior que o volume corporal total (≈42L) indica que o fármaco se acumula em tecidos (ex: gordura, músculo) e não fica concentrado no plasma."
  ),

  q(7, 2, 2, "As Duas Fases da Transformação", "Presto", "mage", "easy",
    "No metabolismo hepático de fase I, o que ocorre tipicamente com a molécula do fármaco?",
    [
      { id: "a", text: "É conjugada com ácido glicurônico, tornando-se inativa" },
      { id: "b", text: "Sofre oxidação, redução ou hidrólise, geralmente por enzimas do citocromo P450" },
      { id: "c", text: "É excretada sem nenhuma alteração química" },
      { id: "d", text: "Vira uma molécula maior e mais lipofílica" },
    ].map(a => ({ ...a, isCorrect: a.id === "b" } as Alternative)),
    "Reações de fase I (oxidação, redução, hidrólise), muitas vezes via CYP450, costumam expor ou criar grupos funcionais que preparam o fármaco para a fase II (conjugação)."
  ),

  q(8, 2, 3, "O Filtro Renal", "Hank", "warrior", "medium",
    "Um fármaco é uma base fraca. Para aumentar sua excreção renal em um caso de intoxicação, o que se pode fazer com o pH urinário?",
    [
      { id: "a", text: "Acidificar a urina, para manter a base mais ionizada e menos reabsorvida" },
      { id: "b", text: "Alcalinizar a urina, para ionizar a base e facilitar sua reabsorção" },
      { id: "c", text: "O pH urinário não influencia a excreção de bases fracas" },
      { id: "d", text: "Aumentar o pH plasmático, sem mexer na urina" },
    ].map(a => ({ ...a, isCorrect: a.id === "a" } as Alternative)),
    "Bases fracas ficam mais ionizadas em meio ácido — nesse estado, não conseguem ser reabsorvidas pelos túbulos renais (membranas não passam moléculas ionizadas), aumentando sua excreção. É a base do 'ion trapping' usado, por exemplo, na intoxicação por anfetaminas."
  ),

  q(9, 2, 4, "O Duelo das Enzimas", "Sheila", "warrior", "hard",
    "Um paciente em uso crônico de um indutor do CYP3A4 inicia um segundo fármaco metabolizado pela mesma enzima. O que tende a acontecer com o efeito do segundo fármaco?",
    [
      { id: "a", text: "Aumenta, pois a indução reduz o metabolismo" },
      { id: "b", text: "Diminui, pois a indução acelera o metabolismo e reduz os níveis plasmáticos" },
      { id: "c", text: "Não se altera, indução enzimática não afeta outros fármacos" },
      { id: "d", text: "O fármaco passa a ser excretado inalterado pelos pulmões" },
    ].map(a => ({ ...a, isCorrect: a.id === "b" } as Alternative)),
    "Indutores enzimáticos aumentam a quantidade/atividade das enzimas do CYP450, acelerando o metabolismo de outros fármacos que dependem da mesma via — isso costuma REDUZIR os níveis plasmáticos e o efeito terapêutico do segundo fármaco."
  ),

  q(10, 2, 5, "O Guardião do Metabolismo", "Dragão Ancião", "boss", "boss",
    "Uma paciente com insuficiência renal recebe um fármaco eliminado predominantemente pelos rins, sem ajuste de dose. Qual o risco mais provável?",
    [
      { id: "a", text: "Subdosagem e falha terapêutica" },
      { id: "b", text: "Acúmulo do fármaco e maior risco de toxicidade" },
      { id: "c", text: "Nenhum risco, rins não influenciam esse fármaco" },
      { id: "d", text: "Aumento da biodisponibilidade oral" },
    ].map(a => ({ ...a, isCorrect: a.id === "b" } as Alternative)),
    "Se a via principal de eliminação (renal) está comprometida e a dose não é ajustada, o fármaco se acumula a cada administração, aumentando o risco de efeitos tóxicos — por isso o ajuste de dose na insuficiência renal é essencial."
  ),

  // ══════════════════════════════════════════════════════════════════
  // SEMANA 3 — Mecanismo de ação e Interações Medicamentosas
  // ══════════════════════════════════════════════════════════════════
  q(11, 3, 1, "O Encaixe Perfeito", "Mestre dos Magos", "mage", "easy",
    "Um fármaco que se liga ao receptor e ativa uma resposta biológica é classificado como:",
    [
      { id: "a", text: "Antagonista" },
      { id: "b", text: "Agonista" },
      { id: "c", text: "Agonista inverso" },
      { id: "d", text: "Agonista parcial silencioso" },
    ].map(a => ({ ...a, isCorrect: a.id === "b" } as Alternative)),
    "Agonistas se ligam ao receptor E ativam a resposta biológica correspondente — é essa dupla característica (afinidade + atividade intrínseca) que os diferencia dos antagonistas."
  ),

  q(12, 3, 2, "Duas Formas de Colisão", "Presto", "mage", "easy",
    "Qual é a diferença central entre uma interação medicamentosa farmacocinética e uma farmacodinâmica?",
    [
      { id: "a", text: "A farmacocinética altera absorção/distribuição/metabolismo/excreção; a farmacodinâmica altera o efeito no receptor/alvo" },
      { id: "b", text: "A farmacodinâmica só ocorre por via intravenosa" },
      { id: "c", text: "Não existe diferença real entre as duas" },
      { id: "d", text: "A farmacocinética só envolve dois fármacos idênticos" },
    ].map(a => ({ ...a, isCorrect: a.id === "a" } as Alternative)),
    "Interações farmacocinéticas mudam quanto fármaco chega ao alvo (ex: um fármaco altera o metabolismo do outro); interações farmacodinâmicas mudam o efeito no próprio sítio de ação (ex: dois depressores do SNC somando sedação)."
  ),

  q(13, 3, 3, "O Antagonista Removível", "Hank", "warrior", "medium",
    "Um antagonista competitivo, ao contrário de um antagonista não competitivo (irreversível), tem qual característica principal?",
    [
      { id: "a", text: "Seu efeito pode ser superado aumentando a dose do agonista" },
      { id: "b", text: "Não se liga ao mesmo sítio do agonista" },
      { id: "c", text: "Reduz permanentemente o número de receptores funcionais" },
      { id: "d", text: "Nunca é removido do receptor" },
    ].map(a => ({ ...a, isCorrect: a.id === "a" } as Alternative)),
    "O antagonismo competitivo é reversível e disputa o mesmo sítio de ligação do agonista — por isso, aumentando a concentração do agonista, é possível deslocar o antagonista e restaurar o efeito máximo (desvio da curva dose-resposta para a direita, sem reduzir o Emax)."
  ),

  q(14, 3, 4, "A Armadilha da Varfarina", "Sheila", "warrior", "hard",
    "Um paciente em uso crônico de varfarina inicia um antibiótico que inibe o CYP2C9. Qual o risco mais esperado?",
    [
      { id: "a", text: "Redução do efeito anticoagulante" },
      { id: "b", text: "Aumento dos níveis de varfarina livre e maior risco de sangramento" },
      { id: "c", text: "Nenhuma alteração, pois varfarina não é metabolizada pelo CYP450" },
      { id: "d", text: "Bloqueio total da absorção da varfarina" },
    ].map(a => ({ ...a, isCorrect: a.id === "b" } as Alternative)),
    "A varfarina é metabolizada principalmente pelo CYP2C9. Um inibidor dessa enzima reduz o metabolismo da varfarina, aumentando seus níveis plasmáticos e o risco de sangramento — uma interação clinicamente muito relevante e cobrada com frequência."
  ),

  q(15, 3, 5, "O Guardião dos Mecanismos", "Dragão Ancião", "boss", "boss",
    "Dois fármacos depressores do sistema nervoso central (ex: um benzodiazepínico e um opioide) são usados juntos. O risco de depressão respiratória aumentado é um exemplo de:",
    [
      { id: "a", text: "Interação farmacocinética por indução enzimática" },
      { id: "b", text: "Interação farmacodinâmica por sinergismo de efeito" },
      { id: "c", text: "Antagonismo competitivo" },
      { id: "d", text: "Efeito de primeira passagem" },
    ].map(a => ({ ...a, isCorrect: a.id === "b" } as Alternative)),
    "Quando dois fármacos com mecanismos diferentes produzem efeitos farmacológicos semelhantes que se somam (aqui, depressão do SNC), isso é uma interação farmacodinâmica por sinergismo — não envolve alteração de absorção/metabolismo, e sim soma de efeitos no organismo."
  ),

  // ══════════════════════════════════════════════════════════════════
  // SEMANA 4 — Boas Práticas de Prescrição
  // ══════════════════════════════════════════════════════════════════
  q(16, 4, 1, "O Pergaminho Correto", "Mestre dos Magos", "mage", "easy",
    "Ao prescrever um medicamento, por que é considerada boa prática usar a Denominação Comum Brasileira (DCB) em vez do nome comercial?",
    [
      { id: "a", text: "Porque nomes comerciais são proibidos por lei em qualquer receita" },
      { id: "b", text: "Porque o nome genérico identifica o fármaco de forma clara e reduz risco de confusão entre marcas" },
      { id: "c", text: "Porque o nome comercial é sempre mais barato" },
      { id: "d", text: "Não há diferença prática entre as duas formas" },
    ].map(a => ({ ...a, isCorrect: a.id === "b" } as Alternative)),
    "Usar a denominação genérica (DCB/DCI) evita ambiguidade — várias marcas comerciais podem existir para o mesmo princípio ativo, e o nome genérico deixa claro exatamente qual substância está sendo prescrita, facilitando também a dispensação pelo SUS."
  ),

  q(17, 4, 2, "O Selo de Controle Especial", "Presto", "mage", "easy",
    "Medicamentos sujeitos a controle especial (ex: alguns psicotrópicos) exigem, no Brasil, qual tipo de receituário?",
    [
      { id: "a", text: "Receita comum, sem exigências adicionais" },
      { id: "b", text: "Notificação de Receita (talão específico, conforme a Portaria 344/98)" },
      { id: "c", text: "Prescrição verbal é sempre suficiente" },
      { id: "d", text: "Nenhum documento é necessário para dispensação" },
    ].map(a => ({ ...a, isCorrect: a.id === "b" } as Alternative)),
    "Substâncias controladas (psicotrópicos, entorpecentes etc.) exigem notificação de receita em talão específico e numerado, seguindo a Portaria SVS/MS 344/1998, com regras de retenção e validade próprias."
  ),

  q(18, 4, 3, "Nomes Parecidos, Riscos Diferentes", "Hank", "warrior", "medium",
    "Dois medicamentos com grafia e som semelhantes (ex: nomes 'look-alike/sound-alike') representam qual tipo de risco na prescrição?",
    [
      { id: "a", text: "Risco de erro de dispensação/administração por troca acidental" },
      { id: "b", text: "Risco exclusivamente estético da receita" },
      { id: "c", text: "Nenhum risco relevante, é só uma coincidência de nomes" },
      { id: "d", text: "Risco apenas para medicamentos fitoterápicos" },
    ].map(a => ({ ...a, isCorrect: a.id === "a" } as Alternative)),
    "Nomes parecidos (LASA — look-alike, sound-alike) são uma causa clássica e bem documentada de erro de medicação, seja na prescrição, na dispensação pela farmácia ou na administração pela enfermagem — por isso protocolos de segurança recomendam escrever com clareza e, se possível, destacar diferenças (ex: maiúsculas)."
  ),

  q(19, 4, 4, "A Receita com Falhas", "Sheila", "warrior", "hard",
    "Uma prescrição informa apenas 'Dipirona, tomar se dor' sem especificar dose, via de administração e intervalo. Qual é o principal problema dessa prescrição?",
    [
      { id: "a", text: "Nenhum — está completa" },
      { id: "b", text: "Falta de clareza pode levar a subdose, superdose ou uso inadequado pelo paciente" },
      { id: "c", text: "O problema é só a falta de assinatura do médico" },
      { id: "d", text: "Dipirona nunca deve ser prescrita 'se necessário'" },
    ].map(a => ({ ...a, isCorrect: a.id === "b" } as Alternative)),
    "Uma prescrição completa e segura deve conter, no mínimo: nome do fármaco, dose, via, intervalo/frequência e duração do tratamento. Omitir esses dados abre espaço para interpretação equivocada por quem administra ou pelo próprio paciente, aumentando o risco de erro de dose ou uso incorreto."
  ),

  q(20, 4, 5, "O Guardião da Prescrição", "Dragão Ancião", "boss", "boss",
    "Um prescritor identifica que dois medicamentos de um mesmo paciente têm potencial de interação farmacocinética grave. Qual é a conduta mais alinhada às boas práticas de prescrição?",
    [
      { id: "a", text: "Ignorar, pois a interação raramente se manifesta na prática" },
      { id: "b", text: "Revisar a prescrição, considerando ajuste de dose, substituição ou monitorização adicional" },
      { id: "c", text: "Aumentar a dose de ambos para compensar a interação" },
      { id: "d", text: "Suspender toda a medicação do paciente sem avaliação" },
    ].map(a => ({ ...a, isCorrect: a.id === "b" } as Alternative)),
    "Boas práticas de prescrição incluem revisar ativamente o esquema terapêutico diante de uma interação potencialmente grave — o que pode significar ajustar dose, trocar por alternativa mais segura, ou reforçar monitorização, e não simplesmente ignorar ou tomar decisões drásticas sem avaliação criteriosa."
  ),

  // ══════════════════════════════════════════════════════════════════
  // SEMANA 5 — Colinérgicos de ação direta e anticolinesterásicos
  // ══════════════════════════════════════════════════════════════════
  q(21, 5, 1, "O Chamado Direto", "Mestre dos Magos", "mage", "easy",
    "A pilocarpina age diretamente sobre os receptores muscarínicos, sendo classificada como um agonista colinérgico de ação:",
    [
      { id: "a", text: "Indireta, pois inibe a acetilcolinesterase" },
      { id: "b", text: "Direta, pois se liga diretamente ao receptor muscarínico" },
      { id: "c", text: "Mista, agindo em receptores nicotínicos e adrenérgicos" },
      { id: "d", text: "Nenhuma das anteriores" },
    ].map(a => ({ ...a, isCorrect: a.id === "b" } as Alternative)),
    "Agonistas colinérgicos de ação direta (como pilocarpina e betanecol) se ligam diretamente aos receptores muscarínicos, ativando-os — diferente dos anticolinesterásicos, que agem de forma indireta."
  ),

  q(22, 5, 2, "O Acúmulo Silencioso", "Presto", "mage", "easy",
    "Os anticolinesterásicos (ex: neostigmina) produzem efeito colinérgico por qual mecanismo?",
    [
      { id: "a", text: "Ligação direta aos receptores nicotínicos" },
      { id: "b", text: "Inibição da enzima acetilcolinesterase, aumentando a acetilcolina disponível na fenda sináptica" },
      { id: "c", text: "Bloqueio da liberação pré-sináptica de acetilcolina" },
      { id: "d", text: "Estímulo direto dos receptores beta-adrenérgicos" },
    ].map(a => ({ ...a, isCorrect: a.id === "b" } as Alternative)),
    "Anticolinesterásicos inibem a enzima que degrada a acetilcolina, fazendo-a se acumular na fenda sináptica e prolongando/intensificando o estímulo colinérgico — por isso são chamados de ação 'indireta'."
  ),

  q(23, 5, 3, "O Alívio da Pressão Ocular", "Hank", "warrior", "medium",
    "A pilocarpina é utilizada no tratamento do glaucoma porque, ao estimular receptores muscarínicos no olho, ela:",
    [
      { id: "a", text: "Dilata a pupila (midríase), facilitando a drenagem do humor aquoso" },
      { id: "b", text: "Contrai o músculo ciliar/esfíncter da íris (miose), facilitando a drenagem do humor aquoso pelo ângulo" },
      { id: "c", text: "Bloqueia completamente a produção de humor aquoso" },
      { id: "d", text: "Não tem nenhum efeito sobre a pressão intraocular" },
    ].map(a => ({ ...a, isCorrect: a.id === "b" } as Alternative)),
    "A estimulação muscarínica contrai o músculo ciliar e o esfíncter da íris, causando miose e abrindo o ângulo de drenagem, o que facilita o escoamento do humor aquoso e reduz a pressão intraocular — útil no glaucoma de ângulo fechado."
  ),

  q(24, 5, 4, "A Crise dos Organofosforados", "Sheila", "warrior", "hard",
    "Um paciente intoxicado por organofosforado (inibidor irreversível da acetilcolinesterase) apresenta sinais muscarínicos intensos (salivação, miose, bradicardia). Qual antídoto deve ser administrado para reverter esses sinais?",
    [
      { id: "a", text: "Neostigmina, para inibir ainda mais a enzima" },
      { id: "b", text: "Atropina, antagonista muscarínico, para bloquear o excesso de estímulo colinérgico" },
      { id: "c", text: "Betanecol, para reforçar o efeito colinérgico" },
      { id: "d", text: "Propranolol, bloqueador beta-adrenérgico" },
    ].map(a => ({ ...a, isCorrect: a.id === "b" } as Alternative)),
    "A atropina antagoniza os receptores muscarínicos, revertendo os sinais muscarínicos da intoxicação (salivação, bradicardia, miose, broncorreia). A pralidoxima é usada como adjuvante para reativar a acetilcolinesterase, mas a atropina é a primeira linha para controlar os sintomas muscarínicos agudos."
  ),

  q(25, 5, 5, "O Guardião Colinérgico", "Dragão Ancião", "boss", "boss",
    "Um paciente com miastenia gravis (redução de receptores nicotínicos funcionais na junção neuromuscular) melhora a força muscular com neostigmina. O mecanismo desse benefício é:",
    [
      { id: "a", text: "Bloqueio direto dos receptores nicotínicos remanescentes" },
      { id: "b", text: "Aumento da acetilcolina disponível na fenda, compensando o menor número de receptores" },
      { id: "c", text: "Estímulo direto do músculo esquelético, sem envolver acetilcolina" },
      { id: "d", text: "Inibição da liberação de acetilcolina pré-sináptica" },
    ].map(a => ({ ...a, isCorrect: a.id === "b" } as Alternative)),
    "Ao inibir a acetilcolinesterase, a neostigmina aumenta a quantidade de acetilcolina disponível na junção neuromuscular, compensando parcialmente a redução de receptores nicotínicos funcionais característica da miastenia gravis, melhorando a transmissão e a força muscular."
  ),

  // ══════════════════════════════════════════════════════════════════
  // SEMANA 6 — Antagonistas colinérgicos e bloqueadores neuromusculares
  // ══════════════════════════════════════════════════════════════════
  q(26, 6, 1, "O Escudo Muscarínico", "Mestre dos Magos", "mage", "easy",
    "A atropina age como antagonista competitivo em qual tipo de receptor?",
    [
      { id: "a", text: "Receptores nicotínicos musculares" },
      { id: "b", text: "Receptores muscarínicos" },
      { id: "c", text: "Receptores beta-adrenérgicos" },
      { id: "d", text: "Receptores dopaminérgicos" },
    ].map(a => ({ ...a, isCorrect: a.id === "b" } as Alternative)),
    "A atropina bloqueia competitivamente os receptores muscarínicos, antagonizando os efeitos da acetilcolina nesses sítios (glândulas, músculo liso, coração)."
  ),

  q(27, 6, 2, "Os Sinais do Bloqueio", "Presto", "mage", "easy",
    "Qual conjunto de efeitos é esperado com o uso de atropina em dose terapêutica?",
    [
      { id: "a", text: "Miose, bradicardia e aumento de secreções" },
      { id: "b", text: "Midríase, taquicardia e boca seca" },
      { id: "c", text: "Broncoconstrição intensa e sudorese" },
      { id: "d", text: "Hipotensão grave e sonolência profunda" },
    ].map(a => ({ ...a, isCorrect: a.id === "b" } as Alternative)),
    "Ao bloquear receptores muscarínicos, a atropina produz os clássicos efeitos anticolinérgicos: midríase (dilatação pupilar), taquicardia (remoção do tônus vagal), boca seca e redução de outras secreções glandulares."
  ),

  q(28, 6, 3, "Os Dois Caminhos do Bloqueio Muscular", "Hank", "warrior", "medium",
    "Qual é a principal diferença entre a succinilcolina (bloqueador neuromuscular despolarizante) e o rocurônio (não despolarizante)?",
    [
      { id: "a", text: "A succinilcolina inicialmente despolariza a placa motora antes de bloquear; o rocurônio bloqueia competitivamente sem despolarizar" },
      { id: "b", text: "Os dois têm mecanismo idêntico, diferindo só na duração" },
      { id: "c", text: "O rocurônio age nos receptores muscarínicos, e a succinilcolina nos nicotínicos" },
      { id: "d", text: "A succinilcolina não tem nenhum efeito sobre a junção neuromuscular" },
    ].map(a => ({ ...a, isCorrect: a.id === "a" } as Alternative)),
    "A succinilcolina mimetiza a acetilcolina e causa despolarização sustentada (com fasciculações iniciais) antes do bloqueio; já os bloqueadores não despolarizantes, como o rocurônio, competem com a acetilcolina pelo receptor nicotínico sem despolarizar a membrana."
  ),

  q(29, 6, 4, "Revertendo o Bloqueio", "Sheila", "warrior", "hard",
    "Ao final de uma cirurgia, para reverter o bloqueio neuromuscular não despolarizante com neostigmina, por que é necessário associar atropina (ou glicopirrolato)?",
    [
      { id: "a", text: "Para potencializar ainda mais o bloqueio neuromuscular" },
      { id: "b", text: "Para contrapor os efeitos muscarínicos indesejados (bradicardia, broncorreia) causados pelo aumento de acetilcolina" },
      { id: "c", text: "Porque a neostigmina não tem nenhum efeito sem a atropina" },
      { id: "d", text: "Para aumentar a duração do bloqueio muscular" },
    ].map(a => ({ ...a, isCorrect: a.id === "b" } as Alternative)),
    "A neostigmina aumenta a acetilcolina tanto nos receptores nicotínicos (revertendo o bloqueio muscular, efeito desejado) quanto nos muscarínicos (bradicardia, broncoespasmo, secreções — efeitos indesejados). A atropina bloqueia especificamente os receptores muscarínicos, prevenindo esses efeitos colaterais sem atrapalhar a reversão do bloqueio neuromuscular."
  ),

  q(30, 6, 5, "O Guardião do Bloqueio Neuromuscular", "Dragão Ancião", "boss", "boss",
    "Um paciente recebe succinilcolina para intubação e evolui com hipertermia maligna. Esse é um exemplo de reação relacionada a qual característica farmacológica da succinilcolina?",
    [
      { id: "a", text: "Efeito de primeira passagem hepático" },
      { id: "b", text: "Reação idiossincrática/genética rara em indivíduos suscetíveis, ligada ao bloqueio despolarizante" },
      { id: "c", text: "Interação com receptores muscarínicos gástricos" },
      { id: "d", text: "Efeito esperado e benigno em todos os pacientes" },
    ].map(a => ({ ...a, isCorrect: a.id === "b" } as Alternative)),
    "A hipertermia maligna é uma reação rara, genética (mutação no receptor de rianodina), desencadeada por anestésicos halogenados e pela succinilcolina em indivíduos suscetíveis — uma emergência anestésica grave que exige reconhecimento rápido e tratamento com dantrolene."
  ),

  // ══════════════════════════════════════════════════════════════════
  // SEMANA 7 — Revisão Geral (Semanas 1 a 6) — dia de Seminários
  // ══════════════════════════════════════════════════════════════════
  q(31, 7, 1, "Revisão: A Jornada do Fármaco", "Mestre dos Magos", "mage", "easy",
    "Relembrando a farmacocinética: qual processo determina a fração de uma dose oral que efetivamente alcança a circulação sistêmica, na forma inalterada?",
    [
      { id: "a", text: "Biodisponibilidade" },
      { id: "b", text: "Meia-vida" },
      { id: "c", text: "Clearance" },
      { id: "d", text: "Volume de distribuição" },
    ].map(a => ({ ...a, isCorrect: a.id === "a" } as Alternative)),
    "Biodisponibilidade é a fração da dose administrada que chega intacta à circulação sistêmica — reduzida na via oral principalmente pelo efeito de primeira passagem."
  ),

  q(32, 7, 2, "Revisão: Enzimas em Ação", "Presto", "mage", "easy",
    "Um fármaco que inibe o CYP450 tende a ___ os níveis plasmáticos de outro fármaco metabolizado pela mesma enzima.",
    [
      { id: "a", text: "Reduzir" },
      { id: "b", text: "Aumentar" },
      { id: "c", text: "Não alterar" },
      { id: "d", text: "Zerar completamente" },
    ].map(a => ({ ...a, isCorrect: a.id === "b" } as Alternative)),
    "Inibidores enzimáticos reduzem o metabolismo de outros fármacos que dependem da mesma via, aumentando seus níveis plasmáticos — o oposto do que ocorre com indutores enzimáticos."
  ),

  q(33, 7, 3, "Revisão: Ligações e Efeitos", "Hank", "warrior", "medium",
    "Um antagonista muscarínico como a atropina é usado clinicamente para reverter os efeitos de qual classe de intoxicação/fármaco?",
    [
      { id: "a", text: "Beta-bloqueadores" },
      { id: "b", text: "Agonistas colinérgicos e anticolinesterásicos (ex: organofosforados)" },
      { id: "c", text: "Anti-inflamatórios não esteroidais" },
      { id: "d", text: "Anestésicos locais" },
    ].map(a => ({ ...a, isCorrect: a.id === "b" } as Alternative)),
    "Por bloquear os receptores muscarínicos, a atropina é o antídoto clássico para intoxicações que causam excesso de estímulo colinérgico, como organofosforados e outros anticolinesterásicos."
  ),

  q(34, 7, 4, "Revisão: O Duelo dos Receptores", "Sheila", "warrior", "hard",
    "Um paciente miastênico em uso de piridostigmina (anticolinesterásico) recebe, por engano, um bloqueador neuromuscular não despolarizante em dose padrão de anestesia. O que se espera?",
    [
      { id: "a", text: "Efeito exagerado do bloqueador, pois a miastenia já reduz receptores nicotínicos funcionais" },
      { id: "b", text: "Nenhuma alteração na resposta ao bloqueador" },
      { id: "c", text: "Reversão espontânea e imediata do bloqueio, sem necessidade de anticolinesterásico adicional" },
      { id: "d", text: "O bloqueador deixa de agir em pacientes miastênicos" },
    ].map(a => ({ ...a, isCorrect: a.id === "a" } as Alternative)),
    "Pacientes miastênicos já têm menos receptores nicotínicos funcionais disponíveis — por isso são MAIS sensíveis a bloqueadores neuromusculares não despolarizantes, que competem por esses receptores já reduzidos, exigindo doses menores e monitorização cuidadosa."
  ),

  q(76, 7, 5, "Revisão: O Encaixe do Fármaco", "Presto", "mage", "easy",
    "Na farmacodinâmica, um antagonista se diferencia de um agonista principalmente por:",
    [
      { id: "a", text: "Ligar-se ao receptor sem ativar a resposta biológica" },
      { id: "b", text: "Sempre ter maior afinidade que qualquer agonista" },
      { id: "c", text: "Nunca se ligar a nenhum receptor" },
      { id: "d", text: "Produzir sempre o mesmo efeito que o agonista" },
    ].map(a => ({ ...a, isCorrect: a.id === "a" } as Alternative)),
    "Antagonistas têm afinidade pelo receptor (se ligam a ele), mas não possuem atividade intrínseca — não ativam a resposta biológica, e por isso bloqueiam o efeito do agonista natural ou exógeno."
  ),

  q(77, 7, 6, "Revisão: O Caminho da Excreção", "Hank", "warrior", "easy",
    "Fármacos bases fracas tendem a ter sua excreção renal aumentada quando a urina está:",
    [
      { id: "a", text: "Ácida, pois a base fica mais ionizada e menos reabsorvida" },
      { id: "b", text: "Alcalina, pois a base fica mais ionizada" },
      { id: "c", text: "Neutra, sem qualquer efeito sobre a excreção" },
      { id: "d", text: "O pH urinário nunca influencia bases fracas" },
    ].map(a => ({ ...a, isCorrect: a.id === "a" } as Alternative)),
    "Em urina ácida, bases fracas ficam mais ionizadas e por isso são menos reabsorvidas pelos túbulos renais, sendo eliminadas mais rapidamente — o princípio do 'ion trapping' usado em algumas intoxicações."
  ),

  q(78, 7, 7, "Revisão: A Receita Segura", "Sheila", "warrior", "medium",
    "Segundo as boas práticas de prescrição, por que se recomenda escrever a dose e a via de administração de forma explícita, mesmo para medicamentos considerados 'óbvios'?",
    [
      { id: "a", text: "Porque ambiguidade em qualquer prescrição pode gerar erro de administração, independentemente do fármaco" },
      { id: "b", text: "Porque a lei brasileira não exige isso para medicamentos comuns" },
      { id: "c", text: "Porque só medicamentos controlados precisam dessa informação" },
      { id: "d", text: "Não há necessidade real, é apenas formalidade" },
    ].map(a => ({ ...a, isCorrect: a.id === "a" } as Alternative)),
    "Prescrições ambíguas são uma fonte reconhecida de erro de medicação — a clareza (dose, via, frequência, duração) protege o paciente independentemente de o fármaco parecer 'simples' ou de uso comum."
  ),

  q(79, 7, 8, "Revisão: O Duelo das Enzimas Hepáticas", "Presto", "mage", "medium",
    "Um indutor enzimático do CYP450, ao ser associado a outro fármaco metabolizado pela mesma via, tende a causar qual efeito nesse segundo fármaco?",
    [
      { id: "a", text: "Redução dos níveis plasmáticos, podendo levar à falha terapêutica" },
      { id: "b", text: "Aumento dos níveis plasmáticos, com risco de toxicidade" },
      { id: "c", text: "Nenhuma alteração relevante" },
      { id: "d", text: "Bloqueio total da absorção oral do segundo fármaco" },
    ].map(a => ({ ...a, isCorrect: a.id === "a" } as Alternative)),
    "Indutores enzimáticos aumentam a atividade das enzimas do CYP450, acelerando o metabolismo de outros fármacos dependentes da mesma via — isso tende a REDUZIR os níveis plasmáticos e pode comprometer o efeito terapêutico esperado."
  ),

  q(80, 7, 9, "Revisão: O Antídoto Certo", "Hank", "warrior", "medium",
    "Em uma intoxicação por inibidor da acetilcolinesterase com sinais muscarínicos intensos (bradicardia, broncorreia, miose), qual classe farmacológica deve ser usada para reverter esses sinais especificamente?",
    [
      { id: "a", text: "Agonistas muscarínicos diretos" },
      { id: "b", text: "Antagonistas muscarínicos (ex: atropina)" },
      { id: "c", text: "Bloqueadores neuromusculares despolarizantes" },
      { id: "d", text: "Anti-inflamatórios não esteroidais" },
    ].map(a => ({ ...a, isCorrect: a.id === "b" } as Alternative)),
    "Antagonistas muscarínicos, como a atropina, bloqueiam competitivamente os receptores hiperestimulados pelo excesso de acetilcolina, revertendo os sinais muscarínicos da intoxicação."
  ),

  q(81, 7, 10, "Revisão: O Bloqueio Reversível", "Sheila", "warrior", "hard",
    "Um antagonismo competitivo é caracterizado por poder ser revertido ao se aumentar a concentração do agonista. Isso ocorre porque:",
    [
      { id: "a", text: "O antagonista se liga a um sítio diferente do agonista, sem competição real" },
      { id: "b", text: "O antagonista compete de forma reversível pelo mesmo sítio do agonista, podendo ser deslocado" },
      { id: "c", text: "O antagonista destrói permanentemente o receptor" },
      { id: "d", text: "Não existe relação entre dose do agonista e reversibilidade do antagonismo" },
    ].map(a => ({ ...a, isCorrect: a.id === "b" } as Alternative)),
    "No antagonismo competitivo e reversível, agonista e antagonista disputam o mesmo sítio de ligação — aumentando a concentração do agonista, é possível deslocar o antagonista e restaurar a resposta máxima."
  ),

  q(82, 7, 11, "Revisão: A Placa Motora em Risco", "Presto", "mage", "hard",
    "Um paciente com miastenia gravis, condição que já reduz receptores nicotínicos funcionais, recebe um bloqueador neuromuscular não despolarizante em dose padrão. Qual o risco esperado?",
    [
      { id: "a", text: "Resposta reduzida ao bloqueador, exigindo doses maiores" },
      { id: "b", text: "Resposta exagerada ao bloqueador, com risco de bloqueio prolongado" },
      { id: "c", text: "Nenhuma alteração na resposta ao bloqueador" },
      { id: "d", text: "O bloqueador se torna um agonista nesse contexto" },
    ].map(a => ({ ...a, isCorrect: a.id === "b" } as Alternative)),
    "Como a miastenia já reduz o número de receptores nicotínicos disponíveis, pacientes miastênicos são mais sensíveis aos bloqueadores neuromusculares não despolarizantes, podendo apresentar bloqueio mais intenso e prolongado mesmo em doses habituais."
  ),

  q(83, 7, 12, "Revisão: O Encontro dos Temas", "Hank", "warrior", "hard",
    "Um paciente recebe simultaneamente um inibidor do CYP450 e um fármaco de margem terapêutica estreita metabolizado por essa mesma via, sem ajuste de dose. Além do risco de acúmulo tóxico, o que mais deve ser avaliado na prescrição desse paciente?",
    [
      { id: "a", text: "Se a prescrição informa claramente dose, via e frequência, permitindo identificar e corrigir o risco a tempo" },
      { id: "b", text: "Nada mais precisa ser avaliado além da interação" },
      { id: "c", text: "Apenas a cor da embalagem dos medicamentos" },
      { id: "d", text: "Se o paciente prefere sabor doce ou amargo do medicamento" },
    ].map(a => ({ ...a, isCorrect: a.id === "a" } as Alternative)),
    "Essa questão integra dois temas do bloco 1: interação farmacocinética por inibição enzimática E boas práticas de prescrição — uma prescrição clara e completa facilita a identificação precoce de riscos como esse antes que causem dano ao paciente."
  ),

  q(84, 7, 13, "Revisão: O Bloqueio Duplo", "Sheila", "warrior", "hard",
    "Em uma cirurgia, ao final do procedimento, a reversão de um bloqueador neuromuscular não despolarizante com neostigmina exige a associação de atropina. Isso ocorre porque a neostigmina, ao inibir a acetilcolinesterase, também estimula excessivamente quais receptores, exigindo esse bloqueio protetor?",
    [
      { id: "a", text: "Receptores beta-adrenérgicos" },
      { id: "b", text: "Receptores muscarínicos (causando bradicardia, broncorreia)" },
      { id: "c", text: "Receptores histamínicos H1" },
      { id: "d", text: "Receptores opioides" },
    ].map(a => ({ ...a, isCorrect: a.id === "b" } as Alternative)),
    "O aumento de acetilcolina pela neostigmina estimula tanto receptores nicotínicos (revertendo o bloqueio muscular, efeito desejado) quanto muscarínicos (bradicardia, broncorreia — indesejados). A atropina bloqueia especificamente os muscarínicos, prevenindo esses efeitos colaterais."
  ),

  q(35, 7, 14, "O Guardião da Revisão", "Dragão Ancião", "boss", "boss",
    "Uma prescrição sem via de administração especificada, associada a um fármaco metabolizado pelo CYP450 sendo coadministrado com um potente inibidor dessa enzima. Qual é o risco combinado mais provável?",
    [
      { id: "a", text: "Erro de administração E acúmulo tóxico do fármaco por inibição do metabolismo" },
      { id: "b", text: "Nenhum risco, pois os dois problemas se anulam" },
      { id: "c", text: "Apenas risco estético na receita" },
      { id: "d", text: "Redução da absorção oral, sem qualquer outro efeito" },
    ].map(a => ({ ...a, isCorrect: a.id === "a" } as Alternative)),
    "Essa questão integra dois temas: prescrição incompleta (risco de erro de via/administração) e interação farmacocinética por inibição enzimática (acúmulo e toxicidade) — mostrando como problemas de segurança do paciente costumam se somar, não ocorrer isoladamente."
  ),

  // ══════════════════════════════════════════════════════════════════
  // SEMANA 8 — Adrenérgicos e aminas simpaticomiméticas
  // ══════════════════════════════════════════════════════════════════
  q(36, 8, 1, "Os Dois Reinos Adrenérgicos", "Mestre dos Magos", "mage", "easy",
    "De forma geral, a estimulação de receptores beta-1 no coração produz qual efeito?",
    [
      { id: "a", text: "Redução da frequência cardíaca e da força de contração" },
      { id: "b", text: "Aumento da frequência cardíaca e da força de contração (efeitos cronotrópico e inotrópico positivos)" },
      { id: "c", text: "Broncodilatação" },
      { id: "d", text: "Midríase pupilar" },
    ].map(a => ({ ...a, isCorrect: a.id === "b" } as Alternative)),
    "Receptores beta-1, predominantes no coração, aumentam frequência cardíaca (cronotropismo) e força de contração (inotropismo) quando estimulados — por isso agonistas beta-1 são usados em quadros de baixo débito cardíaco."
  ),

  q(37, 8, 2, "A Amina de Emergência", "Presto", "mage", "easy",
    "A adrenalina (epinefrina) é o fármaco de escolha na anafilaxia porque atua em quais receptores, revertendo os sinais mais graves?",
    [
      { id: "a", text: "Somente receptores muscarínicos" },
      { id: "b", text: "Receptores alfa-1 (vasoconstrição) e beta-2 (broncodilatação), além de beta-1 (suporte cardíaco)" },
      { id: "c", text: "Somente receptores dopaminérgicos" },
      { id: "d", text: "Receptores histamínicos H1" },
    ].map(a => ({ ...a, isCorrect: a.id === "b" } as Alternative)),
    "A adrenalina age em múltiplos receptores adrenérgicos: alfa-1 (reverte a vasodilatação/hipotensão), beta-2 (reverte o broncoespasmo) e beta-1 (suporte à função cardíaca) — por isso é o fármaco de primeira linha na anafilaxia."
  ),

  q(38, 8, 3, "O Alívio das Vias Aéreas", "Hank", "warrior", "medium",
    "O salbutamol é preferido em relação à adrenalina no tratamento de crise asmática justamente por ser um agonista:",
    [
      { id: "a", text: "Não seletivo alfa e beta" },
      { id: "b", text: "Seletivo beta-2, com menos efeitos cardíacos (beta-1) indesejados" },
      { id: "c", text: "Seletivo alfa-1, causando vasoconstrição pulmonar" },
      { id: "d", text: "Muscarínico direto" },
    ].map(a => ({ ...a, isCorrect: a.id === "b" } as Alternative)),
    "A seletividade beta-2 do salbutamol favorece a broncodilatação com menor estímulo cardíaco (beta-1) comparado a agonistas não seletivos como a adrenalina, reduzindo efeitos como taquicardia e arritmias no uso repetido para asma."
  ),

  q(39, 8, 4, "A Escolha da Amina Certa", "Sheila", "warrior", "hard",
    "Em um paciente em choque cardiogênico com débito cardíaco baixo mas pressão arterial ainda aceitável, por que a dobutamina é preferida à noradrenalina?",
    [
      { id: "a", text: "A dobutamina tem ação predominante beta-1 (inotrópica), aumentando o débito cardíaco com menor vasoconstrição periférica excessiva" },
      { id: "b", text: "A dobutamina é um antagonista beta, reduzindo a sobrecarga cardíaca" },
      { id: "c", text: "A noradrenalina não tem nenhum efeito cardiovascular" },
      { id: "d", text: "As duas são idênticas em mecanismo e escolha clínica" },
    ].map(a => ({ ...a, isCorrect: a.id === "a" } as Alternative)),
    "A dobutamina age predominantemente em receptores beta-1, aumentando a contratilidade e o débito cardíaco com efeito vasoconstritor periférico mínimo — ideal quando o problema principal é baixo débito, e não hipotensão grave (situação em que a noradrenalina, com forte ação alfa-1 vasoconstritora, seria mais indicada)."
  ),

  q(40, 8, 5, "O Guardião Adrenérgico", "Dragão Ancião", "boss", "boss",
    "Um paciente em anafilaxia recebe adrenalina IM e, minutos depois, apresenta melhora da pressão arterial e da broncoconstrição, mas taquicardia importante. Essa taquicardia é explicada por qual ação da adrenalina?",
    [
      { id: "a", text: "Estímulo beta-1 cardíaco, parte esperada do mecanismo de ação do fármaco" },
      { id: "b", text: "Efeito colateral raro e não relacionado ao mecanismo do fármaco" },
      { id: "c", text: "Bloqueio dos receptores muscarínicos cardíacos" },
      { id: "d", text: "Ação exclusivamente sobre receptores H1" },
    ].map(a => ({ ...a, isCorrect: a.id === "a" } as Alternative)),
    "A taquicardia é uma consequência esperada e direta do estímulo beta-1 cardíaco da adrenalina — faz parte do mesmo mecanismo que ajuda a sustentar a pressão arterial e o débito cardíaco durante a anafilaxia, não é uma reação separada."
  ),

  // ══════════════════════════════════════════════════════════════════
  // SEMANA 9 — Bloqueadores Adrenérgicos
  // ══════════════════════════════════════════════════════════════════
  q(41, 9, 1, "O Freio Beta", "Mestre dos Magos", "mage", "easy",
    "Os beta-bloqueadores reduzem a frequência cardíaca e a pressão arterial principalmente por qual mecanismo?",
    [
      { id: "a", text: "Bloqueio competitivo dos receptores beta-adrenérgicos, reduzindo os efeitos cronotrópico e inotrópico positivos das catecolaminas" },
      { id: "b", text: "Estímulo direto dos receptores muscarínicos" },
      { id: "c", text: "Inibição da enzima conversora de angiotensina" },
      { id: "d", text: "Bloqueio dos canais de sódio" },
    ].map(a => ({ ...a, isCorrect: a.id === "a" } as Alternative)),
    "Beta-bloqueadores competem com catecolaminas (adrenalina/noradrenalina) pelos receptores beta, reduzindo a estimulação cronotrópica e inotrópica no coração — daí a redução de frequência cardíaca e, indiretamente, da pressão arterial."
  ),

  q(42, 9, 2, "Seletivo ou Não Seletivo?", "Presto", "mage", "easy",
    "Qual a principal diferença prática entre um beta-bloqueador não seletivo (ex: propranolol) e um cardiosseletivo (ex: atenolol/metoprolol)?",
    [
      { id: "a", text: "O não seletivo bloqueia beta-1 e beta-2; o cardiosseletivo tem preferência por beta-1, reduzindo o risco de broncoespasmo" },
      { id: "b", text: "O cardiosseletivo bloqueia apenas receptores muscarínicos" },
      { id: "c", text: "Não existe diferença clínica relevante entre eles" },
      { id: "d", text: "O não seletivo é sempre mais seguro em asmáticos" },
    ].map(a => ({ ...a, isCorrect: a.id === "a" } as Alternative)),
    "Beta-bloqueadores não seletivos bloqueiam tanto beta-1 (cardíaco) quanto beta-2 (broncodilatação), podendo precipitar broncoespasmo em asmáticos. Os cardiosseletivos preferem beta-1, sendo relativamente mais seguros nesse contexto (embora a seletividade não seja absoluta em doses altas)."
  ),

  q(43, 9, 3, "O Bloqueio da Próstata", "Hank", "warrior", "medium",
    "A prazosina, um antagonista alfa-1 seletivo, é útil na hiperplasia prostática benigna porque relaxa qual estrutura?",
    [
      { id: "a", text: "O músculo detrusor da bexiga, aumentando a retenção urinária" },
      { id: "b", text: "A musculatura lisa do colo vesical e da próstata, facilitando o fluxo urinário" },
      { id: "c", text: "O músculo cardíaco, reduzindo a frequência cardíaca" },
      { id: "d", text: "A musculatura brônquica" },
    ].map(a => ({ ...a, isCorrect: a.id === "b" } as Alternative)),
    "O bloqueio alfa-1 relaxa a musculatura lisa do colo vesical e da cápsula prostática, reduzindo a resistência à saída da urina — por isso os alfa-bloqueadores são usados nos sintomas obstrutivos da hiperplasia prostática benigna."
  ),

  q(44, 9, 4, "O Dilema do Asmático Hipertenso", "Sheila", "warrior", "hard",
    "Um paciente hipertenso e asmático precisa de um beta-bloqueador para controle de arritmia. Qual conduta é mais prudente?",
    [
      { id: "a", text: "Usar propranolol em dose alta, sem restrições" },
      { id: "b", text: "Preferir um beta-bloqueador cardiosseletivo, em dose baixa, com monitorização respiratória" },
      { id: "c", text: "Beta-bloqueadores são absolutamente proibidos em qualquer asmático, sem exceção" },
      { id: "d", text: "Não há diferença entre as opções, qualquer beta-bloqueador serve" },
    ].map(a => ({ ...a, isCorrect: a.id === "b" } as Alternative)),
    "Em pacientes asmáticos que realmente precisam de beta-bloqueio, a prática mais segura é preferir agentes cardiosseletivos, em doses baixas e com acompanhamento — evitando os não seletivos, que bloqueiam também beta-2 e podem desencadear broncoespasmo."
  ),

  q(45, 9, 5, "O Guardião do Bloqueio Adrenérgico", "Dragão Ancião", "boss", "boss",
    "Um paciente em uso crônico de propranolol para enxaqueca sofre uma reação anafilática grave. Por que a resposta à adrenalina pode ser prejudicada nesse paciente?",
    [
      { id: "a", text: "O beta-bloqueio prévio pode atenuar os efeitos cardíacos e broncodilatadores (beta) da adrenalina, dificultando a reversão do quadro" },
      { id: "b", text: "Propranolol potencializa totalmente o efeito da adrenalina, sem qualquer interferência" },
      { id: "c", text: "Não há nenhuma interação relevante entre os dois fármacos" },
      { id: "d", text: "O propranolol elimina completamente a necessidade de adrenalina na anafilaxia" },
    ].map(a => ({ ...a, isCorrect: a.id === "a" } as Alternative)),
    "Como o propranolol bloqueia os receptores beta, ele pode reduzir a eficácia da adrenalina em reverter o broncoespasmo (beta-2) e sustentar o débito cardíaco (beta-1) durante a anafilaxia — nesses casos, pode ser necessário associar glucagon, que tem ação inotrópica independente de receptores beta."
  ),

  // ══════════════════════════════════════════════════════════════════
  // SEMANA 10 — Anti-inflamatórios Não Esteroidais (AINEs)
  // ══════════════════════════════════════════════════════════════════
  q(46, 10, 1, "O Bloqueio das Prostaglandinas", "Mestre dos Magos", "mage", "easy",
    "O principal mecanismo de ação dos AINEs é:",
    [
      { id: "a", text: "Inibição da enzima ciclo-oxigenase (COX), reduzindo a síntese de prostaglandinas" },
      { id: "b", text: "Bloqueio de receptores opioides" },
      { id: "c", text: "Inibição da acetilcolinesterase" },
      { id: "d", text: "Estímulo direto de receptores beta-adrenérgicos" },
    ].map(a => ({ ...a, isCorrect: a.id === "a" } as Alternative)),
    "AINEs inibem a COX (ciclo-oxigenase), enzima responsável pela síntese de prostaglandinas — mediadoras de dor, febre e inflamação — daí seus efeitos analgésico, antipirético e anti-inflamatório."
  ),

  q(47, 10, 2, "Os Efeitos Indesejados", "Presto", "mage", "easy",
    "Quais são os efeitos adversos mais clássicos do uso prolongado de AINEs não seletivos?",
    [
      { id: "a", text: "Sonolência intensa e hipoglicemia" },
      { id: "b", text: "Lesão gástrica/úlcera péptica e redução da função renal" },
      { id: "c", text: "Hipertermia maligna" },
      { id: "d", text: "Broncoconstrição exclusiva em asmáticos" },
    ].map(a => ({ ...a, isCorrect: a.id === "b" } as Alternative)),
    "Ao inibir a COX-1 (que também protege a mucosa gástrica e mantém a perfusão renal), os AINEs não seletivos podem causar lesão gastrointestinal e comprometer a função renal, especialmente em uso prolongado ou em pacientes de risco."
  ),

  q(48, 10, 3, "A Seletividade da COX-2", "Hank", "warrior", "medium",
    "Os inibidores seletivos da COX-2 (coxibes) foram desenvolvidos para reduzir qual risco em relação aos AINEs tradicionais, mas trouxeram qual preocupação?",
    [
      { id: "a", text: "Reduzem risco gástrico, mas aumentam o risco cardiovascular" },
      { id: "b", text: "Reduzem risco cardiovascular, mas aumentam o risco gástrico" },
      { id: "c", text: "Não têm nenhuma diferença de risco em relação aos não seletivos" },
      { id: "d", text: "Eliminam completamente qualquer risco de efeito adverso" },
    ].map(a => ({ ...a, isCorrect: a.id === "a" } as Alternative)),
    "Ao poupar a COX-1 gástrica, os coxibes reduzem o risco de úlcera/sangramento digestivo — mas o desequilíbrio entre tromboxano e prostaciclina levantou preocupação com aumento de eventos cardiovasculares, especialmente em uso prolongado."
  ),

  q(49, 10, 4, "O AINE Diferente", "Sheila", "warrior", "hard",
    "Diferente dos demais AINEs (inibição reversível), a aspirina inibe a COX de forma:",
    [
      { id: "a", text: "Reversível e competitiva, igual aos outros AINEs" },
      { id: "b", text: "Irreversível, por acetilação da enzima — efeito que dura até a enzima ser renovada (relevante no efeito antiplaquetário prolongado)" },
      { id: "c", text: "Nenhuma inibição direta da COX" },
      { id: "d", text: "Reversível apenas na COX-2" },
    ].map(a => ({ ...a, isCorrect: a.id === "b" } as Alternative)),
    "A aspirina acetila irreversivelmente a COX (especialmente a COX-1 plaquetária). Como as plaquetas não têm núcleo e não conseguem sintetizar nova enzima, esse bloqueio dura toda a vida da plaqueta (~7-10 dias) — por isso é usada em baixa dose como antiagregante plaquetário."
  ),

  q(50, 10, 5, "O Guardião dos AINEs", "Dragão Ancião", "boss", "boss",
    "Um paciente idoso, hipertenso e com função renal levemente reduzida, inicia uso diário de AINE não seletivo para dor crônica. Qual é o principal risco a monitorar?",
    [
      { id: "a", text: "Nenhum risco relevante nesse perfil de paciente" },
      { id: "b", text: "Piora da função renal e possível descompensação da pressão arterial, além de risco gástrico" },
      { id: "c", text: "Apenas risco de sonolência" },
      { id: "d", text: "Risco exclusivo de reação alérgica cutânea" },
    ].map(a => ({ ...a, isCorrect: a.id === "b" } as Alternative)),
    "Idosos, hipertensos e com função renal já reduzida somam fatores de risco: os AINEs podem comprometer ainda mais a perfusão renal (dependente de prostaglandinas), reter sódio/água (piorando a pressão) e ainda mantêm o risco de lesão gástrica — por isso exigem cautela redobrada nesse perfil."
  ),

  // ══════════════════════════════════════════════════════════════════
  // SEMANA 11 — Glicocorticoides
  // ══════════════════════════════════════════════════════════════════
  q(51, 11, 1, "O Poder Anti-inflamatório", "Mestre dos Magos", "mage", "easy",
    "Os glicocorticoides reduzem a inflamação principalmente por qual mecanismo geral?",
    [
      { id: "a", text: "Bloqueio direto de canais de sódio" },
      { id: "b", text: "Ação em receptores intracelulares, modulando a expressão de genes envolvidos na resposta inflamatória (ex: reduzindo citocinas e fosfolipase A2)" },
      { id: "c", text: "Inibição exclusiva da acetilcolinesterase" },
      { id: "d", text: "Estímulo direto de receptores beta-2" },
    ].map(a => ({ ...a, isCorrect: a.id === "b" } as Alternative)),
    "Glicocorticoides atravessam a membrana e se ligam a receptores intracelulares, alterando a transcrição gênica — reduzem a síntese de mediadores inflamatórios (incluindo a inibição da fosfolipase A2, reduzindo prostaglandinas e leucotrienos) e suprimem diversas células do sistema imune."
  ),

  q(52, 11, 2, "Os Efeitos do Uso Prolongado", "Presto", "mage", "easy",
    "Quais efeitos adversos são esperados no uso sistêmico prolongado de glicocorticoides?",
    [
      { id: "a", text: "Hipoglicemia grave e perda de peso" },
      { id: "b", text: "Hiperglicemia, osteoporose, ganho de peso e maior suscetibilidade a infecções" },
      { id: "c", text: "Nenhum efeito relevante em uso prolongado" },
      { id: "d", text: "Apenas sonolência leve" },
    ].map(a => ({ ...a, isCorrect: a.id === "b" } as Alternative)),
    "O uso crônico de glicocorticoides reproduz achados semelhantes à síndrome de Cushing: hiperglicemia, redução da densidade óssea (osteoporose), redistribuição de gordura corporal e imunossupressão, que aumenta o risco de infecções."
  ),

  q(53, 11, 3, "O Eixo Silenciado", "Hank", "warrior", "medium",
    "Por que o uso prolongado de glicocorticoides exige retirada gradual (desmame), em vez de suspensão abrupta?",
    [
      { id: "a", text: "Porque o eixo hipotálamo-hipófise-adrenal fica suprimido, e a suspensão abrupta pode causar insuficiência adrenal aguda" },
      { id: "b", text: "Porque a suspensão abrupta sempre causa hipertensão maligna" },
      { id: "c", text: "Não há necessidade real de desmame, é só uma tradição sem base farmacológica" },
      { id: "d", text: "Porque o glicocorticoide se acumula indefinidamente no tecido adiposo" },
    ].map(a => ({ ...a, isCorrect: a.id === "a" } as Alternative)),
    "O uso exógeno prolongado suprime a produção endógena de ACTH e cortisol (feedback negativo no eixo HHA). Se suspenso abruptamente, as adrenais não conseguem retomar a produção rápido o suficiente, podendo causar insuficiência adrenal aguda — por isso o desmame deve ser gradual."
  ),

  q(54, 11, 4, "O Rosto que Muda", "Sheila", "warrior", "hard",
    "Um paciente em corticoterapia prolongada para doença autoimune desenvolve face arredondada, giba dorsal e estrias violáceas. Esse quadro corresponde a:",
    [
      { id: "a", text: "Síndrome de Cushing iatrogênica (induzida pelo glicocorticoide exógeno)" },
      { id: "b", text: "Doença de Addison" },
      { id: "c", text: "Hipertireoidismo" },
      { id: "d", text: "Reação alérgica aguda ao fármaco" },
    ].map(a => ({ ...a, isCorrect: a.id === "a" } as Alternative)),
    "Esses são achados clássicos de excesso de glicocorticoide — nesse contexto, iatrogênico, pelo uso terapêutico prolongado — reproduzindo o mesmo fenótipo da síndrome de Cushing endógena (que seria causada por hiperprodução própria do organismo)."
  ),

  q(55, 11, 5, "O Guardião dos Glicocorticoides", "Dragão Ancião", "boss", "boss",
    "Um paciente em corticoterapia prolongada suspende o medicamento abruptamente por conta própria e, dias depois, apresenta hipotensão, fraqueza intensa e hipoglicemia. O quadro mais provável é:",
    [
      { id: "a", text: "Crise de insuficiência adrenal aguda por supressão do eixo hipotálamo-hipófise-adrenal" },
      { id: "b", text: "Efeito colateral esperado e sem gravidade" },
      { id: "c", text: "Excesso de cortisol endógeno" },
      { id: "d", text: "Reação alérgica tardia ao glicocorticoide" },
    ].map(a => ({ ...a, isCorrect: a.id === "a" } as Alternative)),
    "A suspensão abrupta após uso prolongado, com o eixo HHA ainda suprimido, pode desencadear insuficiência adrenal aguda — uma emergência com hipotensão, fraqueza e hipoglicemia, que reforça por que o desmame gradual é uma orientação de segurança essencial."
  ),

  // ══════════════════════════════════════════════════════════════════
  // SEMANA 12 — Anestésicos Locais
  // ══════════════════════════════════════════════════════════════════
  q(56, 12, 1, "O Bloqueio do Impulso", "Mestre dos Magos", "mage", "easy",
    "Os anestésicos locais impedem a condução nervosa e a sensação de dor bloqueando principalmente qual estrutura?",
    [
      { id: "a", text: "Canais de sódio voltagem-dependentes na membrana neuronal" },
      { id: "b", text: "Receptores opioides centrais" },
      { id: "c", text: "Receptores muscarínicos periféricos" },
      { id: "d", text: "A enzima ciclo-oxigenase" },
    ].map(a => ({ ...a, isCorrect: a.id === "a" } as Alternative)),
    "Anestésicos locais bloqueiam canais de sódio voltagem-dependentes, impedindo a despolarização e a propagação do potencial de ação ao longo do nervo — por isso impedem a condução do estímulo doloroso sem alterar a consciência."
  ),

  q(57, 12, 2, "Ésteres e Amidas", "Presto", "mage", "easy",
    "Anestésicos locais se dividem quimicamente em duas classes principais. Qual é essa classificação?",
    [
      { id: "a", text: "Ésteres e amidas" },
      { id: "b", text: "Ácidos e bases" },
      { id: "c", text: "Opioides e não opioides" },
      { id: "d", text: "Agonistas e antagonistas" },
    ].map(a => ({ ...a, isCorrect: a.id === "a" } as Alternative)),
    "Os anestésicos locais se dividem em ésteres (ex: procaína, hidrolisados por esterases plasmáticas, maior potencial alergênico) e amidas (ex: lidocaína, bupivacaína, metabolizadas no fígado, menor risco alérgico) — uma distinção clinicamente relevante."
  ),

  q(58, 12, 3, "O Vasoconstritor Aliado", "Hank", "warrior", "medium",
    "Por que a adrenalina é frequentemente associada aos anestésicos locais em procedimentos como sutura ou anestesia dentária?",
    [
      { id: "a", text: "Para acelerar a absorção sistêmica do anestésico" },
      { id: "b", text: "Para causar vasoconstrição local, retardando a absorção do anestésico e prolongando seu efeito no local, além de reduzir sangramento" },
      { id: "c", text: "Para reverter completamente o efeito anestésico" },
      { id: "d", text: "Porque não há nenhum benefício real dessa associação" },
    ].map(a => ({ ...a, isCorrect: a.id === "b" } as Alternative)),
    "A vasoconstrição local causada pela adrenalina retarda a absorção do anestésico para a circulação sistêmica, prolongando o efeito anestésico local, reduzindo a dose sistêmica necessária e diminuindo o sangramento no campo — mas deve ser evitada em extremidades (dedos, nariz, pênis) pelo risco de isquemia."
  ),

  q(59, 12, 4, "Os Sinais de Alerta", "Sheila", "warrior", "hard",
    "Uma injeção acidental intravascular de anestésico local em dose elevada pode causar toxicidade sistêmica (LAST). Quais são os primeiros sinais de alerta mais característicos?",
    [
      { id: "a", text: "Sonolência profunda imediata, sem nenhum outro sintoma" },
      { id: "b", text: "Sintomas neurológicos como zumbido, gosto metálico e formigamento perioral, podendo evoluir para convulsão e arritmias cardíacas graves" },
      { id: "c", text: "Apenas broncoespasmo isolado" },
      { id: "d", text: "Hipertensão isolada, sem qualquer sintoma neurológico" },
    ].map(a => ({ ...a, isCorrect: a.id === "b" } as Alternative)),
    "A toxicidade sistêmica por anestésico local (LAST) costuma começar com sinais neurológicos sutis (zumbido, gosto metálico, formigamento perioral, tontura) antes de progredir para convulsões e, em casos graves, depressão cardiovascular e arritmias — reconhecer esses sinais precocemente é essencial para intervir a tempo."
  ),

  q(60, 12, 5, "O Guardião dos Anestésicos Locais", "Dragão Ancião", "boss", "boss",
    "Durante um bloqueio anestésico, o paciente subitamente apresenta convulsão seguida de colapso cardiovascular, sugerindo toxicidade sistêmica grave por anestésico local. Qual é uma medida específica de resgate nesse cenário, além do suporte básico?",
    [
      { id: "a", text: "Administração de emulsão lipídica intravenosa (terapia com lipídios), que ajuda a 'sequestrar' o anestésico local na circulação" },
      { id: "b", text: "Aumentar a dose do mesmo anestésico local para reverter o quadro" },
      { id: "c", text: "Administrar mais adrenalina no mesmo local da injeção original" },
      { id: "d", text: "Nenhuma medida específica existe além de observação" },
    ].map(a => ({ ...a, isCorrect: a.id === "a" } as Alternative)),
    "A emulsão lipídica IV é uma medida de resgate específica e bem estabelecida para toxicidade sistêmica grave por anestésico local — acredita-se que ela funcione como um 'sequestro lipídico', capturando o anestésico lipofílico circulante e reduzindo sua ação nos tecidos cardíaco e nervoso, sendo usada junto ao suporte cardiovascular básico."
  ),

  // ══════════════════════════════════════════════════════════════════
  // SEMANA 13 — Revisão Geral (Semanas 8 a 12) — dia de Seminários
  // ══════════════════════════════════════════════════════════════════
  q(61, 13, 1, "Revisão: O Coração Acelerado", "Mestre dos Magos", "mage", "easy",
    "Qual receptor adrenérgico, quando estimulado, é o principal responsável pelo aumento da frequência cardíaca?",
    [
      { id: "a", text: "Beta-1" },
      { id: "b", text: "Alfa-1" },
      { id: "c", text: "Muscarínico M2" },
      { id: "d", text: "H1" },
    ].map(a => ({ ...a, isCorrect: a.id === "a" } as Alternative)),
    "O receptor beta-1, predominante no coração, é o principal responsável pelos efeitos cronotrópico (frequência) e inotrópico (força de contração) positivos das catecolaminas."
  ),

  q(62, 13, 2, "Revisão: O Alvo das Prostaglandinas", "Presto", "mage", "easy",
    "Qual enzima é o principal alvo farmacológico tanto dos AINEs tradicionais quanto da aspirina?",
    [
      { id: "a", text: "Ciclo-oxigenase (COX)" },
      { id: "b", text: "Acetilcolinesterase" },
      { id: "c", text: "Monoamina oxidase" },
      { id: "d", text: "CYP3A4" },
    ].map(a => ({ ...a, isCorrect: a.id === "a" } as Alternative)),
    "Tanto os AINEs tradicionais (inibição reversível) quanto a aspirina (inibição irreversível por acetilação) têm a COX como alvo principal, reduzindo a síntese de prostaglandinas."
  ),

  q(63, 13, 3, "Revisão: A Suspensão Perigosa", "Hank", "warrior", "medium",
    "Por que a suspensão abrupta de glicocorticoides após uso prolongado é perigosa?",
    [
      { id: "a", text: "Porque o eixo hipotálamo-hipófise-adrenal está suprimido e pode não responder a tempo, causando insuficiência adrenal aguda" },
      { id: "b", text: "Porque causa hipertermia maligna imediata" },
      { id: "c", text: "Não há nenhum risco real associado" },
      { id: "d", text: "Porque reativa uma alergia prévia ao fármaco" },
    ].map(a => ({ ...a, isCorrect: a.id === "a" } as Alternative)),
    "O uso prolongado suprime a produção endógena de cortisol pelo feedback negativo no eixo HHA — a suspensão abrupta não dá tempo para as adrenais retomarem a produção, podendo causar uma crise de insuficiência adrenal aguda."
  ),

  q(64, 13, 4, "Revisão: O Resgate Lipídico", "Sheila", "warrior", "hard",
    "Um paciente com sinais neurológicos precoces de toxicidade sistêmica por anestésico local (zumbido, gosto metálico) deve ser monitorado de perto porque, se não tratado, pode evoluir para qual desfecho grave?",
    [
      { id: "a", text: "Convulsões e colapso cardiovascular" },
      { id: "b", text: "Apenas sonolência leve e autolimitada, sem necessidade de intervenção" },
      { id: "c", text: "Hipertensão arterial isolada e benigna" },
      { id: "d", text: "Nenhuma progressão é esperada a partir desses sintomas" },
    ].map(a => ({ ...a, isCorrect: a.id === "a" } as Alternative)),
    "Os sinais neurológicos iniciais da toxicidade sistêmica por anestésico local podem evoluir rapidamente para convulsões e depressão cardiovascular grave — por isso reconhecer e agir sobre os sinais precoces (incluindo a possibilidade de usar emulsão lipídica) é fundamental."
  ),

  q(85, 13, 5, "Revisão: A Escolha da Amina", "Presto", "mage", "easy",
    "Em um choque cardiogênico com débito baixo mas pressão ainda aceitável, qual amina simpaticomimética costuma ser preferida por seu efeito predominantemente inotrópico?",
    [
      { id: "a", text: "Dobutamina" },
      { id: "b", text: "Noradrenalina" },
      { id: "c", text: "Atropina" },
      { id: "d", text: "Loratadina" },
    ].map(a => ({ ...a, isCorrect: a.id === "a" } as Alternative)),
    "A dobutamina age predominantemente em receptores beta-1, aumentando a contratilidade cardíaca com efeito vasoconstritor periférico mínimo, sendo preferida quando o problema principal é baixo débito, não hipotensão grave."
  ),

  q(86, 13, 6, "Revisão: O Freio Seletivo", "Hank", "warrior", "easy",
    "Por que um beta-bloqueador cardiosseletivo é preferido a um não seletivo em um paciente asmático que precise de beta-bloqueio?",
    [
      { id: "a", text: "Porque reduz o risco de broncoespasmo ao poupar parcialmente os receptores beta-2" },
      { id: "b", text: "Porque tem efeito idêntico ao não seletivo em qualquer contexto" },
      { id: "c", text: "Porque bloqueia exclusivamente receptores muscarínicos" },
      { id: "d", text: "Não há diferença relevante entre os dois" },
    ].map(a => ({ ...a, isCorrect: a.id === "a" } as Alternative)),
    "Beta-bloqueadores cardiosseletivos preferem o receptor beta-1, reduzindo (sem eliminar completamente) o risco de broncoespasmo associado ao bloqueio beta-2 em pacientes asmáticos."
  ),

  q(87, 13, 7, "Revisão: O Risco Gástrico", "Sheila", "warrior", "medium",
    "Um paciente idoso em uso diário de AINE não seletivo para dor crônica apresenta maior risco de qual complicação, relacionada à inibição da COX-1 gástrica?",
    [
      { id: "a", text: "Úlcera péptica/sangramento digestivo" },
      { id: "b", text: "Hipertermia maligna" },
      { id: "c", text: "Hipoglicemia grave" },
      { id: "d", text: "Bloqueio neuromuscular" },
    ].map(a => ({ ...a, isCorrect: a.id === "a" } as Alternative)),
    "A COX-1 gástrica tem papel protetor da mucosa (produção de muco e bicarbonato). Sua inibição pelos AINEs não seletivos aumenta o risco de lesão da mucosa, úlcera péptica e sangramento digestivo, especialmente em idosos."
  ),

  q(88, 13, 8, "Revisão: O Eixo Suprimido", "Presto", "mage", "medium",
    "Por que a suspensão abrupta de um glicocorticoide após uso prolongado pode ser perigosa?",
    [
      { id: "a", text: "Porque o eixo hipotálamo-hipófise-adrenal está suprimido e pode não retomar a produção de cortisol a tempo" },
      { id: "b", text: "Porque causa hipertermia maligna imediatamente" },
      { id: "c", text: "Não há nenhum risco associado à suspensão abrupta" },
      { id: "d", text: "Porque reativa alergias antigas do paciente" },
    ].map(a => ({ ...a, isCorrect: a.id === "a" } as Alternative)),
    "O uso prolongado suprime a produção endógena de cortisol via feedback negativo no eixo HHA — suspender abruptamente não dá tempo para as adrenais retomarem a produção, podendo causar insuficiência adrenal aguda."
  ),

  q(89, 13, 9, "Revisão: O Resgate Lipídico", "Hank", "warrior", "hard",
    "Diante de sinais precoces de toxicidade sistêmica por anestésico local (zumbido, gosto metálico, formigamento perioral), qual conduta reduz o risco de progressão para convulsão e colapso cardiovascular?",
    [
      { id: "a", text: "Reconhecer os sinais precocemente e, se necessário, usar emulsão lipídica IV como medida de resgate" },
      { id: "b", text: "Ignorar os sintomas, pois são sempre autolimitados" },
      { id: "c", text: "Aumentar a dose do mesmo anestésico local" },
      { id: "d", text: "Administrar apenas um anti-histamínico" },
    ].map(a => ({ ...a, isCorrect: a.id === "a" } as Alternative)),
    "Reconhecer precocemente os sinais neurológicos de toxicidade sistêmica por anestésico local permite intervir antes da progressão para convulsão e colapso cardiovascular — a emulsão lipídica IV é uma medida de resgate específica e bem estabelecida nesses casos graves."
  ),

  q(90, 13, 10, "Revisão: A Dupla Ameaça Gástrica", "Sheila", "warrior", "hard",
    "Um paciente em uso concomitante de AINE e glicocorticoide sistêmico tem qual risco combinado mais relevante?",
    [
      { id: "a", text: "Aumento adicional do risco de sangramento/lesão gastrointestinal" },
      { id: "b", text: "Nenhum risco adicional relevante" },
      { id: "c", text: "Apenas risco de sonolência leve" },
      { id: "d", text: "Redução do risco gástrico de ambos os fármacos" },
    ].map(a => ({ ...a, isCorrect: a.id === "a" } as Alternative)),
    "A combinação de AINE com glicocorticoide é um cenário clássico de atenção redobrada — os dois fármacos, por mecanismos distintos, aumentam o risco gastrointestinal quando associados, exigindo avaliação cuidadosa da real necessidade dessa combinação."
  ),

  q(91, 13, 11, "Revisão: O Vasoconstritor Aliado", "Presto", "mage", "hard",
    "Por que a adrenalina é frequentemente associada a anestésicos locais, mas deve ser evitada em bloqueios de extremidades (dedos, nariz)?",
    [
      { id: "a", text: "Porque prolonga o efeito anestésico local ao causar vasoconstrição, mas pode causar isquemia em áreas com circulação terminal" },
      { id: "b", text: "Porque não tem nenhum efeito sobre a duração do anestésico" },
      { id: "c", text: "Porque acelera a absorção sistêmica em qualquer região do corpo" },
      { id: "d", text: "Porque bloqueia diretamente os canais de sódio" },
    ].map(a => ({ ...a, isCorrect: a.id === "a" } as Alternative)),
    "A vasoconstrição da adrenalina prolonga o efeito local e reduz sangramento, mas em regiões com circulação terminal (dedos, nariz, pênis) pode comprometer a perfusão e causar isquemia — por isso é evitada nesses bloqueios específicos."
  ),

  q(92, 13, 12, "Revisão: O Duelo dos Bloqueadores", "Hank", "warrior", "hard",
    "Um paciente hipertenso com hiperplasia prostática benigna se beneficia particularmente de qual classe de bloqueador adrenérgico, que relaxa simultaneamente a musculatura vascular e prostática?",
    [
      { id: "a", text: "Antagonistas alfa-1 (ex: prazosina)" },
      { id: "b", text: "Beta-bloqueadores não seletivos" },
      { id: "c", text: "Agonistas muscarínicos diretos" },
      { id: "d", text: "Anti-histamínicos H1" },
    ].map(a => ({ ...a, isCorrect: a.id === "a" } as Alternative)),
    "Antagonistas alfa-1, como a prazosina, relaxam a musculatura lisa vascular (reduzindo a pressão) e também a do colo vesical/próstata (aliviando sintomas obstrutivos), sendo úteis nesse perfil combinado de paciente."
  ),

  q(65, 13, 13, "O Guardião da Segunda Revisão", "Dragão Ancião", "boss", "boss",
    "Um paciente asmático em uso crônico de glicocorticoide inalatório desenvolve uma crise de dor intensa e recebe um AINE não seletivo em dose alta. Quais dois riscos combinados merecem atenção?",
    [
      { id: "a", text: "Risco gástrico aumentado pelo AINE, somado ao risco imunossupressor já existente pelo corticoide, favorecendo infecções" },
      { id: "b", text: "Nenhum risco adicional, os fármacos não interagem de forma relevante" },
      { id: "c", text: "Apenas risco de hipoglicemia" },
      { id: "d", text: "Risco exclusivo de reação alérgica cruzada" },
    ].map(a => ({ ...a, isCorrect: a.id === "a" } as Alternative)),
    "A combinação de AINE (risco gastrointestinal) com corticoide (imunossupressão e também risco gástrico somado) é um cenário clássico de atenção redobrada — o uso concomitante das duas classes aumenta particularmente o risco de sangramento digestivo, exigindo avaliação cuidadosa da real necessidade e, se possível, proteção gástrica associada."
  ),

  // ══════════════════════════════════════════════════════════════════
  // SEMANA 14 — Histamina e Anti-histamínicos
  // ══════════════════════════════════════════════════════════════════
  q(66, 14, 1, "O Mensageiro da Alergia", "Mestre dos Magos", "mage", "easy",
    "A estimulação de receptores H1 pela histamina é responsável principalmente por quais efeitos em uma reação alérgica?",
    [
      { id: "a", text: "Aumento da secreção ácida gástrica" },
      { id: "b", text: "Prurido, vasodilatação, broncoconstrição e aumento da permeabilidade vascular" },
      { id: "c", text: "Redução da frequência cardíaca" },
      { id: "d", text: "Bloqueio da transmissão neuromuscular" },
    ].map(a => ({ ...a, isCorrect: a.id === "b" } as Alternative)),
    "Receptores H1, presentes em pele, vasos e brônquios, medeiam os sinais clássicos de reação alérgica: prurido, urticária, vasodilatação (rubor), aumento da permeabilidade vascular (edema) e broncoconstrição."
  ),

  q(67, 14, 2, "Sonolência ou Não?", "Presto", "mage", "easy",
    "Qual é a principal vantagem prática dos anti-histamínicos H1 de segunda geração (ex: loratadina, cetirizina) em relação aos de primeira geração (ex: difenidramina)?",
    [
      { id: "a", text: "Maior penetração no sistema nervoso central, causando mais sonolência" },
      { id: "b", text: "Menor penetração no SNC, causando bem menos sedação" },
      { id: "c", text: "Ação exclusiva em receptores H2" },
      { id: "d", text: "Não têm nenhuma diferença prática relevante" },
    ].map(a => ({ ...a, isCorrect: a.id === "b" } as Alternative)),
    "Anti-histamínicos de segunda geração são mais seletivos para receptores H1 periféricos e atravessam pouco a barreira hematoencefálica, resultando em bem menos sedação do que os de primeira geração — uma vantagem importante para uso diurno."
  ),

  q(68, 14, 3, "O Bloqueio da Acidez", "Hank", "warrior", "medium",
    "Antagonistas H2 (ex: ranitidina, famotidina) são úteis no tratamento de úlcera péptica porque bloqueiam receptores H2 localizados em quais células?",
    [
      { id: "a", text: "Células parietais gástricas, reduzindo a secreção de ácido clorídrico estimulada pela histamina" },
      { id: "b", text: "Mastócitos cutâneos, reduzindo o prurido" },
      { id: "c", text: "Células do músculo liso brônquico" },
      { id: "d", text: "Neurônios centrais, causando sedação" },
    ].map(a => ({ ...a, isCorrect: a.id === "a" } as Alternative)),
    "A histamina estimula receptores H2 nas células parietais gástricas, promovendo secreção ácida. Bloqueando esses receptores, os antagonistas H2 reduzem a produção de ácido clorídrico, sendo úteis (embora hoje menos usados que os inibidores de bomba de prótons) no tratamento de úlcera péptica e doença do refluxo."
  ),

  q(69, 14, 4, "A Urticária Persistente", "Sheila", "warrior", "hard",
    "Um paciente com urticária alérgica intensa não melhora satisfatoriamente apenas com anti-histamínico H1. Qual associação terapêutica é frequentemente considerada nesses casos mais graves?",
    [
      { id: "a", text: "Associação com glicocorticoide sistêmico, para reforço anti-inflamatório em casos refratários ou mais graves" },
      { id: "b", text: "Suspender todo tratamento, pois anti-histamínicos nunca falham" },
      { id: "c", text: "Associar outro anti-histamínico H1 idêntico, dobrando a mesma classe sem critério" },
      { id: "d", text: "Iniciar antibiótico, já que urticária é sempre infecciosa" },
    ].map(a => ({ ...a, isCorrect: a.id === "a" } as Alternative)),
    "Em quadros alérgicos mais intensos ou refratários ao anti-histamínico isolado, é comum associar um glicocorticoide sistêmico por curto período, aproveitando seu efeito anti-inflamatório mais amplo — sempre avaliando gravidade e critérios clínicos individuais."
  ),

  q(70, 14, 5, "O Guardião da Histamina", "Dragão Ancião", "boss", "boss",
    "Um paciente com reação alérgica moderada (urticária e prurido, sem comprometimento respiratório ou hemodinâmico) é tratado com anti-histamínico H1 de segunda geração. Por que a adrenalina NÃO é indicada nesse caso específico?",
    [
      { id: "a", text: "Porque a adrenalina é reservada para anafilaxia — quadros com risco respiratório/hemodinâmico — e não para reações alérgicas leves a moderadas sem esses sinais" },
      { id: "b", text: "Porque a adrenalina piora qualquer reação alérgica" },
      { id: "c", text: "Porque anti-histamínicos e adrenalina nunca podem ser usados no mesmo paciente" },
      { id: "d", text: "Porque a adrenalina só funciona em crianças" },
    ].map(a => ({ ...a, isCorrect: a.id === "a" } as Alternative)),
    "A adrenalina é reservada para anafilaxia (comprometimento respiratório e/ou cardiovascular) pelo seu perfil de ação rápida e potente, com riscos próprios (arritmias, hipertensão). Reações alérgicas leves a moderadas, sem esses sinais de alarme, são adequadamente tratadas com anti-histamínicos (e, se necessário, corticoide), reservando a adrenalina para quando realmente há risco de vida."
  ),

  // ══════════════════════════════════════════════════════════════════
  // SEMANA 15 — Revisão Geral / Prova Final
  // ══════════════════════════════════════════════════════════════════
  q(71, 15, 1, "A Grande Revisão: Farmacocinética", "Mestre dos Magos", "mage", "easy",
    "Qual via de administração é usada como referência (100%) para o cálculo de biodisponibilidade de outras vias?",
    [
      { id: "a", text: "Via oral" },
      { id: "b", text: "Via intravenosa" },
      { id: "c", text: "Via intramuscular" },
      { id: "d", text: "Via sublingual" },
    ].map(a => ({ ...a, isCorrect: a.id === "b" } as Alternative)),
    "A via intravenosa entrega 100% da dose diretamente à circulação sistêmica, servindo de referência para calcular a biodisponibilidade relativa de outras vias de administração."
  ),

  q(72, 15, 2, "A Grande Revisão: Sistema Colinérgico", "Presto", "mage", "easy",
    "Qual é o antídoto de escolha para reverter os sinais muscarínicos de uma intoxicação por organofosforado?",
    [
      { id: "a", text: "Atropina" },
      { id: "b", text: "Neostigmina" },
      { id: "c", text: "Propranolol" },
      { id: "d", text: "Loratadina" },
    ].map(a => ({ ...a, isCorrect: a.id === "a" } as Alternative)),
    "A atropina, antagonista muscarínico, reverte os sinais muscarínicos do excesso colinérgico causado pela intoxicação por organofosforados (inibidores da acetilcolinesterase)."
  ),

  q(73, 15, 3, "A Grande Revisão: Sistema Adrenérgico", "Hank", "warrior", "medium",
    "Por que a adrenalina é o fármaco de escolha na anafilaxia, e não um agonista beta-2 seletivo isolado?",
    [
      { id: "a", text: "Porque a adrenalina age em múltiplos receptores (alfa-1, beta-1 e beta-2), revertendo hipotensão, suportando o coração E revertendo broncoespasmo simultaneamente" },
      { id: "b", text: "Porque agonistas beta-2 seletivos são mais potentes em qualquer cenário" },
      { id: "c", text: "Porque a adrenalina não tem nenhum efeito cardiovascular" },
      { id: "d", text: "As duas opções são sempre equivalentes na anafilaxia" },
    ].map(a => ({ ...a, isCorrect: a.id === "a" } as Alternative)),
    "A anafilaxia envolve múltiplos sistemas ao mesmo tempo (hipotensão, broncoespasmo, edema) — a ação combinada da adrenalina em receptores alfa-1, beta-1 e beta-2 cobre essas múltiplas frentes simultaneamente, o que um agonista beta-2 isolado não conseguiria fazer sozinho."
  ),

  q(74, 15, 4, "A Grande Revisão: Segurança do Paciente", "Sheila", "warrior", "hard",
    "Um paciente em uso crônico de glicocorticoide sistêmico desenvolve uma infecção grave. Qual é a relação mais provável entre o uso do corticoide e essa complicação?",
    [
      { id: "a", text: "O uso crônico de glicocorticoide causa imunossupressão, aumentando a suscetibilidade a infecções" },
      { id: "b", text: "Glicocorticoides sempre fortalecem a resposta imune contra infecções" },
      { id: "c", text: "Não existe nenhuma relação entre corticoide e risco infeccioso" },
      { id: "d", text: "O corticoide só afeta a pressão arterial, sem relação com imunidade" },
    ].map(a => ({ ...a, isCorrect: a.id === "a" } as Alternative)),
    "Um dos efeitos mais relevantes do uso crônico de glicocorticoides é a imunossupressão — a supressão da resposta inflamatória e imune (parte do próprio mecanismo terapêutico) também reduz a capacidade de defesa contra infecções, exigindo vigilância clínica constante nesses pacientes."
  ),

  q(93, 15, 5, "Revisão Final: A Via de Referência", "Presto", "mage", "easy",
    "Qual efeito farmacocinético reduz tipicamente a biodisponibilidade de um fármaco administrado por via oral, em comparação à via intravenosa?",
    [
      { id: "a", text: "Efeito de primeira passagem hepático" },
      { id: "b", text: "Volume de distribuição elevado" },
      { id: "c", text: "Indução enzimática" },
      { id: "d", text: "Antagonismo competitivo" },
    ].map(a => ({ ...a, isCorrect: a.id === "a" } as Alternative)),
    "O efeito de primeira passagem, decorrente da absorção intestinal seguida de metabolismo hepático antes de atingir a circulação sistêmica, é uma das principais razões da menor biodisponibilidade oral em relação à via IV."
  ),

  q(94, 15, 6, "Revisão Final: O Sistema Colinérgico", "Hank", "warrior", "easy",
    "Qual fármaco é usado como antídoto para reverter os sinais muscarínicos de uma intoxicação por anticolinesterásico?",
    [
      { id: "a", text: "Atropina" },
      { id: "b", text: "Pilocarpina" },
      { id: "c", text: "Succinilcolina" },
      { id: "d", text: "Cetirizina" },
    ].map(a => ({ ...a, isCorrect: a.id === "a" } as Alternative)),
    "A atropina, antagonista muscarínico, reverte os sinais causados pelo excesso de acetilcolina característico da intoxicação por anticolinesterásicos."
  ),

  q(95, 15, 7, "Revisão Final: O Sistema Adrenérgico", "Sheila", "warrior", "medium",
    "Por que a adrenalina, e não um beta-2 agonista isolado, é o fármaco de escolha na anafilaxia grave?",
    [
      { id: "a", text: "Porque age simultaneamente em receptores alfa-1, beta-1 e beta-2, cobrindo hipotensão, suporte cardíaco e broncoespasmo ao mesmo tempo" },
      { id: "b", text: "Porque não tem nenhum efeito cardiovascular" },
      { id: "c", text: "Porque age exclusivamente em receptores muscarínicos" },
      { id: "d", text: "As duas opções são sempre equivalentes" },
    ].map(a => ({ ...a, isCorrect: a.id === "a" } as Alternative)),
    "A anafilaxia grave envolve múltiplos sistemas simultaneamente — a ação combinada da adrenalina em receptores alfa-1, beta-1 e beta-2 cobre essas frentes de uma vez, o que um agonista isolado não conseguiria."
  ),

  q(96, 15, 8, "Revisão Final: O Risco Combinado", "Presto", "mage", "medium",
    "Um paciente em uso crônico de AINE e glicocorticoide sistêmico simultaneamente tem qual risco combinado mais relevante?",
    [
      { id: "a", text: "Aumento do risco de sangramento/lesão gastrointestinal" },
      { id: "b", text: "Redução do risco gástrico de ambos" },
      { id: "c", text: "Nenhum risco adicional relevante" },
      { id: "d", text: "Apenas sonolência leve" },
    ].map(a => ({ ...a, isCorrect: a.id === "a" } as Alternative)),
    "AINEs e glicocorticoides, por mecanismos distintos, aumentam de forma somada o risco gastrointestinal quando associados — um cenário clássico de atenção redobrada na prática clínica."
  ),

  q(97, 15, 9, "Revisão Final: O Alerta Neurológico", "Hank", "warrior", "hard",
    "Quais sinais precoces de toxicidade sistêmica por anestésico local devem alertar para o risco de progressão a convulsão e colapso cardiovascular?",
    [
      { id: "a", text: "Zumbido, gosto metálico e formigamento perioral" },
      { id: "b", text: "Apenas sonolência leve e autolimitada" },
      { id: "c", text: "Hipertensão isolada, sem qualquer outro sintoma" },
      { id: "d", text: "Nenhum sinal precoce é identificável nesse quadro" },
    ].map(a => ({ ...a, isCorrect: a.id === "a" } as Alternative)),
    "Reconhecer precocemente os sinais neurológicos (zumbido, gosto metálico, formigamento perioral) permite intervir antes da progressão para convulsão e colapso cardiovascular, incluindo o uso de emulsão lipídica se necessário."
  ),

  q(98, 15, 10, "Revisão Final: A Prescrição e a Interação", "Sheila", "warrior", "hard",
    "Um paciente recebe um fármaco de margem terapêutica estreita junto com um inibidor do CYP450 que o metaboliza, numa prescrição sem via de administração especificada. Quais dois riscos de segurança estão presentes simultaneamente?",
    [
      { id: "a", text: "Risco de acúmulo tóxico por inibição enzimática E risco de erro de administração por prescrição incompleta" },
      { id: "b", text: "Nenhum risco relevante, os problemas se anulam" },
      { id: "c", text: "Apenas risco estético da receita" },
      { id: "d", text: "Redução da absorção oral, sem qualquer outro efeito" },
    ].map(a => ({ ...a, isCorrect: a.id === "a" } as Alternative)),
    "Essa questão integra dois temas centrais do semestre: interação farmacocinética por inibição enzimática (acúmulo/toxicidade) e boas práticas de prescrição (clareza previne erro de administração) — problemas de segurança do paciente costumam se somar."
  ),

  q(99, 15, 11, "Revisão Final: O Eixo e a Suspensão", "Presto", "mage", "hard",
    "Um paciente em corticoterapia prolongada suspende o medicamento abruptamente e evolui com hipotensão, fraqueza e hipoglicemia. Esse quadro é explicado por qual mecanismo?",
    [
      { id: "a", text: "Insuficiência adrenal aguda por supressão do eixo hipotálamo-hipófise-adrenal" },
      { id: "b", text: "Excesso de cortisol endógeno" },
      { id: "c", text: "Reação alérgica tardia ao glicocorticoide" },
      { id: "d", text: "Efeito esperado e sem gravidade" },
    ].map(a => ({ ...a, isCorrect: a.id === "a" } as Alternative)),
    "A suspensão abrupta após uso prolongado, com o eixo HHA ainda suprimido, pode desencadear insuficiência adrenal aguda — por isso o desmame gradual é uma orientação de segurança essencial no uso crônico de glicocorticoides."
  ),

  q(100, 15, 12, "Revisão Final: O Duelo dos Bloqueadores Beta", "Hank", "warrior", "hard",
    "Um paciente em uso crônico de beta-bloqueador não seletivo sofre uma anafilaxia grave. Por que a resposta à adrenalina pode ficar comprometida, e o que pode ser associado nesse caso?",
    [
      { id: "a", text: "O beta-bloqueio pode atenuar os efeitos beta da adrenalina; glucagon pode ser associado por ter ação inotrópica independente de receptores beta" },
      { id: "b", text: "Não há nenhuma interferência do beta-bloqueador nesse cenário" },
      { id: "c", text: "O beta-bloqueador elimina totalmente a necessidade de adrenalina" },
      { id: "d", text: "Deve-se aumentar a dose do próprio beta-bloqueador para reverter a anafilaxia" },
    ].map(a => ({ ...a, isCorrect: a.id === "a" } as Alternative)),
    "O beta-bloqueio prévio pode reduzir a eficácia da adrenalina em reverter broncoespasmo e sustentar o débito cardíaco durante a anafilaxia — nesses casos, o glucagon pode ser associado por atuar de forma independente dos receptores beta, sendo um raciocínio integrativo importante para fechar o curso."
  ),

  q(75, 15, 13, "O Dragão Ancião Final — Farmacologia I", "Dragão Ancião", "boss", "boss",
    "Uma paciente idosa, hipertensa, em uso de beta-bloqueador não seletivo para enxaqueca, é picada por inseto e desenvolve reação anafilática moderada a grave (hipotensão e broncoespasmo). Considerando tudo que foi estudado no semestre, qual é a conduta e o raciocínio mais completos?",
    [
      { id: "a", text: "Administrar adrenalina IM prontamente — mesmo sabendo que o beta-bloqueio prévio pode atenuar parcialmente a resposta —, e considerar glucagon como adjuvante se a resposta for insuficiente" },
      { id: "b", text: "Evitar adrenalina completamente por causa do beta-bloqueador, tratando só com anti-histamínico" },
      { id: "c", text: "Aumentar a dose do beta-bloqueador para compensar a reação alérgica" },
      { id: "d", text: "Aguardar resolução espontânea, sem qualquer intervenção farmacológica" },
    ].map(a => ({ ...a, isCorrect: a.id === "a" } as Alternative)),
    "Esta questão integra vários temas do semestre: a adrenalina continua sendo a primeira linha na anafilaxia com sinais de gravidade (hipotensão, broncoespasmo), mesmo com resposta potencialmente atenuada pelo beta-bloqueio prévio — e o conhecimento de que o glucagon pode ajudar nesses casos (ação inotrópica independente de receptores beta) é o tipo de raciocínio integrativo que fecha o curso de Farmacologia I."
  ),
];

export function getQuestionsByWeek(weekNumber: number): GameQuestion[] {
  return ALL_GAME_QUESTIONS
    .filter(q => q.weekNumber === weekNumber)
    .sort((a, b) => a.questionInWeek - b.questionInWeek);
}

export function getBossQuestion(weekNumber: number): GameQuestion | undefined {
  return ALL_GAME_QUESTIONS.find(q => q.weekNumber === weekNumber && q.isBossQuestion);
}