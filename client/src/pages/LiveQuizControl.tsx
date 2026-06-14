/**
 * LiveQuizControl - Painel do professor para controlar o Quiz ao Vivo (P2)
 * Design: Conexão Farmacologia — vermelho escarlate, fundo escuro
 * Fluxo: criar sessão → projetar questão por questão → liberar gabarito → lançar notas
 */
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Play, ChevronRight, CheckCircle2, XCircle, Users, BookOpen,
  Loader2, Trophy, Send, Eye, SkipForward, Lock, Unlock,
  Monitor, Smartphone, AlertCircle, RefreshCw
} from "lucide-react";

const API_BASE = "/api/trpc";

async function callApi(endpoint: string, input: any) {
  const res = await fetch(`${API_BASE}/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ json: input }),
  });
  const data = await res.json();
  if (data?.result?.data?.json) return data.result.data.json;
  if (data?.error) throw new Error(data.error?.message || "Erro na API");
  return data;
}

const TEACHER_TOKEN_KEY = "prof_grades_teacher_token";

const TURMAS = [
  { id: 22, name: "Medicina 1" },
  { id: 23, name: "Nutrição Integral" },
  { id: 24, name: "Biomedicina" },
  { id: 25, name: "Enfermagem" },
  { id: 26, name: "Medicina 2" },
  { id: 27, name: "Farmácia" },
  { id: 28, name: "Nutrição Noturno" },
];

// Questões da P2 pré-carregadas
const P2_QUESTIONS = [
  // Bloco I — Farmacologia Adrenérgica (Q1-Q5)
  {
    idx: 0, type: "mc", topic: "Farmacologia Adrenérgica",
    enunciado: "Paciente de 62 anos, hipertenso em uso de metoprolol, é admitido em choque anafilático após picada de abelha. O médico administra epinefrina 0,3 mg IM. Qual o mecanismo pelo qual a epinefrina reverte a broncoconstrição nesse cenário, considerando o bloqueio β1 preexistente?",
    alternativas: {
      A: "Ativação de receptores α1 brônquicos, promovendo broncodilatação direta por contração do músculo liso.",
      B: "Ativação de receptores β2 brônquicos, que permanecem funcionais e mediam broncodilatação via AMPc.",
      C: "Inibição competitiva do metoprolol nos receptores β1, restaurando o tônus adrenérgico normal.",
      D: "Estimulação de receptores muscarínicos M2, reduzindo a liberação de acetilcolina nos brônquios.",
      E: "Ativação de receptores dopaminérgicos D2 na musculatura lisa brônquica, causando relaxamento."
    },
    gabarito: "B",
    justificativa: "O metoprolol é seletivo para β1 (cardíaco). Os receptores β2 brônquicos permanecem livres e a epinefrina os ativa, elevando AMPc intracelular e relaxando o músculo liso brônquico. A seletividade β1 do metoprolol é a chave do raciocínio."
  },
  {
    idx: 1, type: "mc", topic: "Farmacologia Adrenérgica",
    enunciado: "Homem de 55 anos com insuficiência cardíaca descompensada recebe dobutamina IV em UTI. Após 6 horas, a equipe observa taquicardia e decide reduzir a dose. Qual propriedade farmacodinâmica da dobutamina justifica o efeito cronotrópico positivo indesejado?",
    alternativas: {
      A: "Agonismo puro em receptores α1, aumentando a pós-carga e reflexamente a frequência cardíaca.",
      B: "Agonismo predominante em β1 com atividade parcial em β2, elevando AMPc no nó sinusal.",
      C: "Antagonismo de receptores M2 cardíacos, removendo o tônus vagal e acelerando o nó sinusal.",
      D: "Inibição da recaptação de norepinefrina nas terminações simpáticas cardíacas.",
      E: "Ativação de canais If (funny) por mecanismo independente de receptores adrenérgicos."
    },
    gabarito: "B",
    justificativa: "A dobutamina é agonista β1 (inotropia) e β2 (vasodilatação periférica). A ativação β1 no nó sinusal eleva o AMPc, aumentando a corrente If e acelerando a despolarização espontânea — efeito cronotrópico positivo indesejado em altas doses."
  },
  {
    idx: 2, type: "mc", topic: "Farmacologia Adrenérgica",
    enunciado: "Mulher de 45 anos com feocromocitoma é submetida a adrenalectomia. No pré-operatório, recebe fenoxibenzamina por 10 dias. Por que esse fármaco é preferido ao prazosin nesse contexto específico?",
    alternativas: {
      A: "O prazosin tem meia-vida muito curta, exigindo administração a cada 2 horas no perioperatório.",
      B: "A fenoxibenzamina bloqueia α1 e α2 de forma irreversível, garantindo controle pressórico mesmo com picos catecolaminérgicos intraoperatórios.",
      C: "O prazosin causa taquicardia reflexa mais intensa que a fenoxibenzamina por bloquear α2 pré-sinápticos.",
      D: "A fenoxibenzamina tem maior seletividade para α1 vascular, evitando hipotensão ortostática.",
      E: "O prazosin é contraindicado em tumores neuroendócrinos por estimular a secreção de catecolaminas."
    },
    gabarito: "B",
    justificativa: "A fenoxibenzamina forma ligação covalente irreversível com receptores α1 e α2. Durante a manipulação cirúrgica do tumor, ocorrem picos maciços de catecolaminas que superariam um bloqueio competitivo (prazosin). O bloqueio irreversível garante controle pressórico mesmo nesses picos."
  },
  {
    idx: 3, type: "mc", topic: "Farmacologia Adrenérgica",
    enunciado: "Recém-nascido prematuro de 28 semanas apresenta hipotensão refratária a volume. A equipe inicia dopamina em dose baixa (3 μg/kg/min). Qual receptor é predominantemente ativado nessa dose e qual é o efeito esperado?",
    alternativas: {
      A: "Receptores β1 cardíacos — aumento do débito cardíaco por efeito inotrópico positivo.",
      B: "Receptores dopaminérgicos D1 renais e mesentéricos — vasodilatação e aumento do fluxo renal.",
      C: "Receptores α1 vasculares — vasoconstrição periférica e aumento da pressão arterial média.",
      D: "Receptores β2 vasculares — vasodilatação sistêmica e redução da resistência vascular periférica.",
      E: "Receptores D2 pré-sinápticos — inibição da liberação de norepinefrina e redução da FC."
    },
    gabarito: "B",
    justificativa: "Em doses baixas (1–5 μg/kg/min), a dopamina ativa preferencialmente receptores D1 renais e esplâncnicos, promovendo vasodilatação local e aumento do fluxo renal. Doses intermediárias (5–10) ativam β1; altas doses (>10) ativam α1."
  },
  {
    idx: 4, type: "vf", topic: "Farmacologia Adrenérgica",
    enunciado: "Julgue as afirmativas sobre farmacologia adrenérgica:\n\nI. A clonidina, agonista α2 central, reduz a pressão arterial por diminuir o tônus simpático eferente.\nII. O carvedilol bloqueia seletivamente receptores β1, sem ação em α1 ou β2.\nIII. A fenilefrina, agonista α1 puro, pode causar bradicardia reflexa por ativação do barorreflexo.\nIV. A norepinefrina eleva a pressão arterial diastólica mais que a sistólica por vasoconstrição arterial e venosa.",
    alternativas: {
      A: "Apenas I e III são verdadeiras.",
      B: "Apenas I, III e IV são verdadeiras.",
      C: "Todas são verdadeiras.",
      D: "Apenas II e IV são verdadeiras.",
      E: "Apenas I e II são verdadeiras."
    },
    gabarito: "B",
    justificativa: "I ✓ — clonidina ativa α2 no núcleo do trato solitário, reduzindo o simpático. II ✗ — carvedilol é não-seletivo (β1+β2) e também bloqueia α1. III ✓ — fenilefrina eleva PA → barorreflexo → bradicardia. IV ✓ — norepinefrina tem forte ação α1 venosa e arterial, elevando a diastólica."
  },
  // Bloco II — AINEs e Glicocorticoides (Q6-Q10)
  {
    idx: 5, type: "mc", topic: "AINEs e Glicocorticoides",
    enunciado: "Homem de 68 anos, hipertenso em uso de losartana, solicita analgésico para artralgia. O médico prescreve ibuprofeno 400 mg 8/8h por 7 dias. Após 5 dias, o paciente apresenta elevação da creatinina. Qual mecanismo explica a nefrotoxicidade nesse contexto?",
    alternativas: {
      A: "Inibição de COX-2 renal, reduzindo a síntese de prostaciclina e aumentando a resistência vascular glomerular.",
      B: "Inibição de COX-1 e COX-2 renais, reduzindo prostaglandinas vasodilatadoras (PGE2, PGI2) que mantêm a perfusão glomerular em estados de baixo fluxo.",
      C: "Antagonismo direto dos receptores AT1 renais, potencializando o efeito da losartana e causando hipoperfusão.",
      D: "Inibição da síntese de tromboxano A2 plaquetário, reduzindo a agregação e o fluxo capilar glomerular.",
      E: "Ativação de receptores EP3 no túbulo coletor, aumentando a reabsorção de sódio e reduzindo o fluxo urinário."
    },
    gabarito: "B",
    justificativa: "Em estados de baixo fluxo renal (hipertensão tratada com losartana = bloqueio do SRAA), as prostaglandinas renais (PGE2, PGI2) são essenciais para manter a vasodilatação da arteríola aferente. AINEs inibem COX-1/2 renais, eliminando esse mecanismo compensatório e precipitando IRA pré-renal."
  },
  {
    idx: 6, type: "mc", topic: "AINEs e Glicocorticoides",
    enunciado: "Mulher de 52 anos com artrite reumatoide em uso de prednisona 20 mg/dia há 8 meses deseja interromper o corticoide por conta própria. O médico alerta sobre a síndrome de retirada. Qual é o principal mecanismo fisiopatológico dessa síndrome?",
    alternativas: {
      A: "Hipersensibilidade de rebote dos receptores glicocorticoides, causando inflamação exacerbada.",
      B: "Supressão do eixo HPA pelo corticoide exógeno, levando à insuficiência adrenal relativa com a retirada abrupta.",
      C: "Acúmulo de metabólitos tóxicos da prednisona que causam crise adrenérgica na retirada.",
      D: "Upregulation de COX-2 durante o uso do corticoide, com produção excessiva de prostaglandinas na retirada.",
      E: "Depleção de catecolaminas medulares adrenais pelo uso prolongado de glicocorticoides."
    },
    gabarito: "B",
    justificativa: "O uso prolongado de corticoides exógenos suprime o eixo HPA por feedback negativo no hipotálamo e hipófise. O córtex adrenal atrofia por falta de estímulo do ACTH. A retirada abrupta expõe o paciente à insuficiência adrenal (hipotensão, fadiga, hipoglicemia, hiponatremia)."
  },
  {
    idx: 7, type: "mc", topic: "AINEs e Glicocorticoides",
    enunciado: "Paciente de 70 anos com histórico de infarto do miocárdio há 2 anos usa AAS 100 mg/dia como antiagregante. Desenvolve artrite gotosa aguda. Qual AINE seria mais seguro para tratar a crise, considerando o menor risco cardiovascular e a menor interferência com o efeito antiagregante do AAS?",
    alternativas: {
      A: "Ibuprofeno, pois é seletivo para COX-2 e não interfere com a ligação do AAS à COX-1 plaquetária.",
      B: "Celecoxibe em dose baixa, pois a seletividade COX-2 preserva o efeito antiagregante do AAS e tem menor risco GI.",
      C: "Naproxeno, pois tem meia-vida longa que permite espaçar as doses e reduzir a competição com o AAS.",
      D: "Indometacina, pois inibe seletivamente a COX-1 sinovial sem afetar a COX-1 plaquetária.",
      E: "Diclofenaco, pois tem maior seletividade COX-2 que o ibuprofeno e menor risco de interação com AAS."
    },
    gabarito: "B",
    justificativa: "O ibuprofeno e o naproxeno competem com o AAS pelo sítio de acetilação da COX-1 plaquetária, podendo anular o efeito antiagregante. O celecoxibe (seletivo COX-2) não compete com o AAS na COX-1 plaquetária, preservando a antiagregação. Porém, deve-se monitorar o risco CV dos inibidores COX-2 seletivos."
  },
  {
    idx: 8, type: "correlacao", topic: "AINEs e Glicocorticoides",
    enunciado: "Correlacione o fármaco (Coluna 1) com seu principal mecanismo ou característica farmacológica (Coluna 2):\n\nColuna 1:\n1. Celecoxibe\n2. Dexametasona\n3. AAS (alta dose)\n4. Meloxicam\n5. Prednisona\n\nColuna 2:\n(A) Inibidor seletivo de COX-2; indicado em pacientes com risco GI elevado\n(B) Inibe COX-1 e COX-2 irreversivelmente; em altas doses, inibe também a síntese de prostaglandinas\n(C) Glicocorticoide de longa ação sem atividade mineralocorticoide; usado em edema cerebral\n(D) Inibidor preferencial de COX-2 (razão COX-1/COX-2 ~10); menor risco GI que AINEs não seletivos\n(E) Pró-fármaco convertido a prednisolona no fígado; atividade mineralocorticoide residual",
    alternativas: {
      A: "1-A, 2-C, 3-B, 4-D, 5-E",
      B: "1-D, 2-E, 3-A, 4-C, 5-B",
      C: "1-A, 2-E, 3-C, 4-D, 5-B",
      D: "1-B, 2-C, 3-A, 4-E, 5-D",
      E: "1-C, 2-A, 3-D, 4-B, 5-E"
    },
    gabarito: "A",
    justificativa: "1-A (celecoxibe = inibidor seletivo COX-2); 2-C (dexametasona = longa ação, sem mineralocorticoide, edema cerebral); 3-B (AAS alta dose = inibe COX-1 e COX-2 irreversivelmente + bloqueia síntese de PG); 4-D (meloxicam = preferencial COX-2, razão ~10); 5-E (prednisona = pró-fármaco → prednisolona)."
  },
  {
    idx: 9, type: "vf", topic: "AINEs e Glicocorticoides",
    enunciado: "Sobre os efeitos adversos dos glicocorticoides, julgue:\n\nI. O uso prolongado de corticoides causa osteoporose por inibição dos osteoblastos e aumento da atividade osteoclástica.\nII. Glicocorticoides aumentam a glicemia por estimular a gliconeogênese hepática e reduzir a captação periférica de glicose.\nIII. A hidrocortisona tem maior potência anti-inflamatória que a betametasona em doses equimolares.\nIV. O uso de corticoides aumenta o risco de infecções oportunistas por supressão da imunidade celular e humoral.",
    alternativas: {
      A: "Apenas I, II e IV são verdadeiras.",
      B: "Apenas II e III são verdadeiras.",
      C: "Todas são verdadeiras.",
      D: "Apenas I e IV são verdadeiras.",
      E: "Apenas I, II e III são verdadeiras."
    },
    gabarito: "A",
    justificativa: "I ✓ — corticoides inibem osteoblastos e aumentam RANKL (osteoclastos). II ✓ — estimulam gliconeogênese e reduzem GLUT4. III ✗ — betametasona tem potência ~25× maior que hidrocortisona. IV ✓ — suprimem linfócitos T e B, neutrófilos e macrófagos."
  },
  // Bloco III — Anestésicos Locais (Q11-Q15)
  {
    idx: 10, type: "mc", topic: "Anestésicos Locais",
    enunciado: "Durante bloqueio de nervo periférico com bupivacaína 0,5%, o paciente apresenta convulsões e arritmia ventricular. Qual propriedade farmacocinética da bupivacaína explica a maior cardiotoxicidade em relação à lidocaína?",
    alternativas: {
      A: "A bupivacaína tem menor lipossolubilidade, dificultando sua saída do canal de sódio cardíaco após bloqueio.",
      B: "A bupivacaína tem alta lipossolubilidade e forte ligação proteica, resultando em dissociação lenta dos canais de sódio cardíacos (cinética 'fast-in, slow-out').",
      C: "A bupivacaína inibe canais de potássio hERG com maior afinidade que a lidocaína, prolongando o QT.",
      D: "A bupivacaína tem maior pKa, resultando em maior fração ionizada no pH fisiológico e maior bloqueio cardíaco.",
      E: "A bupivacaína é metabolizada a metabólitos cardiotóxicos pela CYP3A4 hepática em maior proporção que a lidocaína."
    },
    gabarito: "B",
    justificativa: "A bupivacaína tem alta lipossolubilidade e forte ligação proteica (95%). Nos canais de sódio cardíacos, apresenta cinética 'fast-in, slow-out': entra rapidamente durante a despolarização mas dissocia muito lentamente, acumulando-se e causando bloqueio persistente com arritmias ventriculares graves e refratárias."
  },
  {
    idx: 11, type: "mc", topic: "Anestésicos Locais",
    enunciado: "Dentista adiciona epinefrina 1:100.000 à solução de lidocaína para anestesia local. Qual é o principal objetivo farmacológico dessa combinação e qual o limite máximo de epinefrina recomendado em paciente cardiopata?",
    alternativas: {
      A: "Aumentar o pH da solução para acelerar o início de ação; limite de 0,04 mg em cardiopatas.",
      B: "Promover vasoconstrição local, reduzindo a absorção sistêmica da lidocaína e prolongando o efeito; limite de 0,04 mg em cardiopatas.",
      C: "Aumentar a lipossolubilidade da lidocaína para maior penetração neural; limite de 0,2 mg em cardiopatas.",
      D: "Antagonizar os efeitos vasodilatatórios da lidocaína no endotélio vascular; limite de 0,1 mg em cardiopatas.",
      E: "Prevenir a formação de metemoglobina pela lidocaína; limite de 0,02 mg em cardiopatas."
    },
    gabarito: "B",
    justificativa: "A epinefrina causa vasoconstrição α1 local, reduzindo a absorção sistêmica da lidocaína (menor toxicidade), prolongando a duração do bloqueio e reduzindo o sangramento. Em cardiopatas, o limite é 0,04 mg (2 tubetes de 1,8 mL com 1:100.000) para evitar efeitos β1 cardíacos."
  },
  {
    idx: 12, type: "mc", topic: "Anestésicos Locais",
    enunciado: "Paciente de 35 anos recebe raquianestesia com bupivacaína hiperbárica para cesariana. Desenvolve hipotensão arterial severa (PA 70/40 mmHg) e bradicardia. Qual é o mecanismo fisiopatológico principal?",
    alternativas: {
      A: "Absorção sistêmica da bupivacaína com bloqueio direto dos canais de sódio cardíacos.",
      B: "Bloqueio simpático torácico alto (T1-T4) com vasodilatação periférica, redução do retorno venoso e bloqueio dos aceleradores cardíacos.",
      C: "Estimulação vagal reflexa por distensão uterina durante a cirurgia.",
      D: "Bloqueio dos nervos frênicos (C3-C5) com comprometimento respiratório e hipóxia miocárdica.",
      E: "Inibição dos barorreceptores carotídeos pelo anestésico local circulante."
    },
    gabarito: "B",
    justificativa: "Na raquianestesia alta, o bloqueio simpático torácico (T1-T4) elimina a inervação dos nervos aceleradores cardíacos (cronotropismo e inotropismo negativos) e causa vasodilatação periférica maciça com redução do retorno venoso — hipotensão + bradicardia. Tratamento: efedrina ou fenilefrina IV + atropina."
  },
  {
    idx: 13, type: "mc", topic: "Anestésicos Locais",
    enunciado: "Qual das seguintes afirmativas descreve corretamente a diferença entre anestésicos locais do tipo amida e éster em relação ao metabolismo e ao potencial alergênico?",
    alternativas: {
      A: "Ésteres são metabolizados no fígado pela CYP2D6; amidas são hidrolisadas por pseudocolinesterases plasmáticas.",
      B: "Amidas são metabolizadas no fígado por enzimas microssomais; ésteres são hidrolisados por pseudocolinesterases plasmáticas, gerando PABA — principal responsável pelas reações alérgicas.",
      C: "Ambos os grupos são metabolizados no fígado, mas ésteres geram metabólitos mais lipossolúveis com maior potencial de acúmulo.",
      D: "Amidas são hidrolisadas por pseudocolinesterases; ésteres são metabolizados pelo fígado, gerando PABA.",
      E: "Ésteres têm maior duração de ação por serem metabolizados mais lentamente no fígado que as amidas."
    },
    gabarito: "B",
    justificativa: "Amidas (lidocaína, bupivacaína, ropivacaína): metabolismo hepático microsomal (CYP). Ésteres (procaína, tetracaína, benzocaína): hidrólise por pseudocolinesterases plasmáticas, gerando ácido para-aminobenzóico (PABA) — responsável por reações alérgicas. Déficit de pseudocolinesterase aumenta toxicidade dos ésteres."
  },
  {
    idx: 14, type: "correlacao", topic: "Anestésicos Locais",
    enunciado: "Correlacione o anestésico local (Coluna 1) com sua principal característica clínica (Coluna 2):\n\nColuna 1:\n1. Lidocaína\n2. Bupivacaína\n3. Ropivacaína\n4. Prilocaína\n5. Articaína\n\nColuna 2:\n(A) Pode causar metemoglobinemia; contraindicada em neonatos e gestantes\n(B) Anestésico amida de início rápido e duração intermediária; também antiarrítmico classe IB\n(C) Alta cardiotoxicidade; bloqueio sensorial e motor intenso e prolongado\n(D) Menor cardiotoxicidade que bupivacaína; bloqueio motor menos intenso; preferida em obstetrícia\n(E) Único anestésico amida com grupo tiofeno; alta difusão óssea; muito usada em odontologia",
    alternativas: {
      A: "1-B, 2-C, 3-D, 4-A, 5-E",
      B: "1-C, 2-B, 3-A, 4-D, 5-E",
      C: "1-B, 2-D, 3-C, 4-E, 5-A",
      D: "1-A, 2-C, 3-D, 4-B, 5-E",
      E: "1-D, 2-C, 3-B, 4-A, 5-E"
    },
    gabarito: "A",
    justificativa: "1-B (lidocaína: amida, início rápido, antiarrítmico IB); 2-C (bupivacaína: alta cardiotoxicidade, bloqueio intenso e longo); 3-D (ropivacaína: menor cardiotoxicidade, preferida em obstetrícia); 4-A (prilocaína: metemoglobinemia por ortotoluidina); 5-E (articaína: único amida com tiofeno, alta difusão óssea, odontologia)."
  },
  // Bloco IV — Anti-histamínicos (Q16-Q20)
  {
    idx: 15, type: "mc", topic: "Anti-histamínicos",
    enunciado: "Piloto de aeronave de 32 anos desenvolve rinite alérgica sazonal. O médico do trabalho deve prescrever um anti-histamínico que não comprometa a capacidade de pilotar. Qual a melhor escolha e por quê?",
    alternativas: {
      A: "Difenidramina, pois tem início de ação rápido e é eficaz para rinorreia aguda.",
      B: "Fexofenadina, pois é de 3ª geração, não atravessa a BHE e não causa sedação clinicamente relevante.",
      C: "Loratadina, pois é de 2ª geração e tem menor sedação que os de 1ª geração, sendo aprovada para pilotos.",
      D: "Cetirizina, pois é de 2ª geração e tem o melhor perfil de segurança cardiovascular.",
      E: "Prometazina, pois tem meia-vida longa permitindo dose única diária sem sedação."
    },
    gabarito: "B",
    justificativa: "A fexofenadina (3ª geração) é substrato da P-gp, não atravessa a BHE e tem mínima atividade anticolinérgica — sem sedação clinicamente relevante. A loratadina (2ª geração) tem sedação mínima mas não é formalmente aprovada para pilotos em muitos países. A cetirizina pode causar sedação em alguns pacientes. A difenidramina e prometazina (1ª geração) são contraindicadas."
  },
  {
    idx: 16, type: "mc", topic: "Anti-histamínicos",
    enunciado: "Criança de 4 anos recebe difenidramina para urticária aguda. Os pais relatam que a criança ficou agitada e não dormiu após a dose. Qual mecanismo explica esse efeito paradoxal?",
    alternativas: {
      A: "Ativação de receptores H2 no SNC pela difenidramina em altas concentrações, estimulando a vigília.",
      B: "Em crianças pequenas, o bloqueio H1 central pode causar estimulação paradoxal do SNC por mecanismo não completamente elucidado, possivelmente relacionado à ativação de receptores muscarínicos centrais.",
      C: "A difenidramina inibe a recaptação de dopamina no estriado, causando hiperatividade.",
      D: "Crianças têm maior densidade de receptores H1 no locus coeruleus, tornando o bloqueio estimulante.",
      E: "A difenidramina bloqueia receptores GABA-A em crianças, causando efeito excitatório paradoxal."
    },
    gabarito: "B",
    justificativa: "A excitação paradoxal pelos anti-histamínicos H1 de 1ª geração em crianças é bem documentada, embora o mecanismo exato não seja completamente elucidado. Acredita-se que envolva o bloqueio anticolinérgico central e/ou efeitos sobre sistemas dopaminérgicos e serotoninérgicos em desenvolvimento, que diferem dos adultos."
  },
  {
    idx: 17, type: "mc", topic: "Anti-histamínicos",
    enunciado: "Mulher de 28 anos grávida (32 semanas) apresenta prurido intenso por colestase intra-hepática gestacional. Qual anti-histamínico seria mais seguro nesse contexto, considerando o perfil de segurança na gestação?",
    alternativas: {
      A: "Fexofenadina (categoria C), pois não atravessa a BHE e tem menor risco fetal.",
      B: "Loratadina (categoria B), com amplos dados de segurança em humanos e sem teratogenicidade demonstrada.",
      C: "Cetirizina (categoria B), preferida por ter maior eficácia antipruriginosa que a loratadina.",
      D: "Difenidramina (categoria B), com longa experiência de uso e segurança estabelecida no 3º trimestre.",
      E: "Prometazina (categoria C), pois tem efeito antiemérico adicional útil na gestação."
    },
    gabarito: "B",
    justificativa: "A loratadina é categoria B da FDA, com amplos estudos epidemiológicos em gestantes sem evidência de teratogenicidade. A cetirizina também é categoria B, mas tem menos dados. A difenidramina, embora categoria B, pode causar contraturas uterinas no 3º trimestre. A fexofenadina é categoria C (dados animais adversos). A loratadina é a escolha mais consensual."
  },
  {
    idx: 18, type: "vf", topic: "Anti-histamínicos",
    enunciado: "Julgue as afirmativas sobre anti-histamínicos:\n\nI. Anti-histamínicos H1 de 1ª geração têm efeito anticolinérgico que pode causar retenção urinária, glaucoma e boca seca.\nII. A cetirizina é metabólito ativo da hidroxizina, com menor sedação e maior seletividade H1 periférica.\nIII. Anti-histamínicos H2 (ranitidina, famotidina) são usados no tratamento da rinite alérgica por bloquear H2 nasais.\nIV. A bilastina (3ª geração) tem absorção reduzida com alimentos e suco de toranja por ser substrato da P-gp intestinal.",
    alternativas: {
      A: "Apenas I e II são verdadeiras.",
      B: "Apenas I, II e IV são verdadeiras.",
      C: "Todas são verdadeiras.",
      D: "Apenas II e III são verdadeiras.",
      E: "Apenas I e IV são verdadeiras."
    },
    gabarito: "B",
    justificativa: "I ✓ — efeitos anticolinérgicos clássicos dos de 1ª geração. II ✓ — cetirizina é o metabólito ativo da hidroxizina, com menor penetração no SNC. III ✗ — H2 bloqueiam receptores gástricos (ácido), não são usados para rinite. IV ✓ — bilastina é substrato da P-gp; alimentos e suco de toranja reduzem sua absorção em ~30%."
  },
  {
    idx: 19, type: "mc", topic: "Artigos Jigsaw — Cannabis",
    enunciado: "Segundo Legare et al. (2022), o sistema endocanabinoide modula a dor e a inflamação principalmente através de receptores CB1 e CB2. Em relação ao uso terapêutico de canabinoides em dor crônica, qual afirmativa está correta com base na literatura atual?",
    alternativas: {
      A: "O THC atua exclusivamente em receptores CB2 periféricos, sem efeitos psicoativos centrais.",
      B: "O CBD tem atividade agonista direta em receptores CB1 e CB2, sendo responsável pelos efeitos analgésicos.",
      C: "Canabinoides têm evidência moderada para dor neuropática crônica, com THC e CBD atuando em vias complementares — CB1 central e CB2 periférico/imune, respectivamente.",
      D: "O uso de cannabis medicinal é contraindicado em dor oncológica por risco de dependência física.",
      E: "O sistema endocanabinoide é exclusivamente inibitório, sem participação em processos inflamatórios."
    },
    gabarito: "C",
    justificativa: "Legare et al. (2022) descrevem que THC atua principalmente em CB1 (SNC — analgesia, efeitos psicoativos) e CB2 (imune — anti-inflamatório). O CBD tem baixa afinidade por CB1/CB2 mas modula o sistema endocanabinoide indiretamente (inibe FAAH, antagonista alostérico CB1). Há evidência moderada para dor neuropática crônica e dor oncológica."
  },
  {
    idx: 20, type: "mc", topic: "Artigos Jigsaw — Reações Cutâneas Graves",
    enunciado: "O artigo de Hung et al. (2024) sobre reações cutâneas adversas graves (SCARs) destaca a importância do reconhecimento precoce. Qual fármaco é classicamente associado à síndrome de Stevens-Johnson/Necrólise Epidérmica Tóxica (SJS/TEN) e qual é o mecanismo imunológico predominante?",
    alternativas: {
      A: "Penicilina; reação de hipersensibilidade tipo I mediada por IgE com liberação de histamina.",
      B: "Carbamazepina; reação de hipersensibilidade tipo IV (citotóxica), mediada por linfócitos T CD8+ que atacam queratinócitos.",
      C: "AAS; inibição de COX-1 com desvio do ácido araquidônico para leucotrienos que causam apoptose epidérmica.",
      D: "Metformina; reação idiossincrásica por acúmulo de metabólito tóxico com ativação do complemento.",
      E: "Amoxicilina; reação tipo II mediada por anticorpos IgG contra antígenos epidérmicos."
    },
    gabarito: "B",
    justificativa: "SJS/TEN é classicamente associada a anticonvulsivantes aromáticos (carbamazepina, fenitoína, lamotrigina), alopurinol e sulfonamidas. O mecanismo é hipersensibilidade tipo IV tardia, com linfócitos T CD8+ citotóxicos reconhecendo o fármaco (ou metabólito) apresentado pelo HLA-B*1502 (carbamazepina em asiáticos) e induzindo apoptose maciça de queratinócitos via perforina/granzima e Fas-FasL."
  },
  {
    idx: 21, type: "mc", topic: "Artigos Jigsaw — Epigenética e Drogas",
    enunciado: "Zhang et al. (2026) descrevem mecanismos epigenéticos pelo qual o abuso de drogas causa depressão. Qual mecanismo epigenético está mais diretamente associado à neuroplasticidade negativa no sistema mesolímbico após uso crônico de opioides?",
    alternativas: {
      A: "Hipermetilação do promotor do gene BDNF no núcleo accumbens, reduzindo a expressão de fator neurotrófico e comprometendo a plasticidade sináptica.",
      B: "Hipometilação global do DNA no córtex pré-frontal, aumentando a expressão de genes pró-inflamatórios.",
      C: "Acetilação de histonas H3K27 no hipocampo, aumentando a expressão de receptores NMDA.",
      D: "Deacetilação de H4K16 no estriado, silenciando genes de receptores dopaminérgicos D1.",
      E: "Metilação do RNA mensageiro (m6A) no hipotálamo, alterando o ritmo circadiano e o apetite."
    },
    gabarito: "A",
    justificativa: "Zhang et al. descrevem que o uso crônico de opioides e outras drogas de abuso causa hipermetilação do promotor do gene BDNF (Brain-Derived Neurotrophic Factor) no núcleo accumbens e córtex pré-frontal. A redução do BDNF compromete a plasticidade sináptica, a sobrevivência neuronal e está associada à depressão comórbida ao vício."
  },
  {
    idx: 22, type: "mc", topic: "Artigos Jigsaw — Obesidade",
    enunciado: "Gudzune & Kushner (2024) revisaram os medicamentos aprovados para obesidade. Qual é o mecanismo de ação do semaglutide (GLP-1 RA) que justifica sua eficácia na redução de peso, além do controle glicêmico?",
    alternativas: {
      A: "Inibição da lipase pancreática, reduzindo a absorção de gorduras dietéticas em ~30%.",
      B: "Agonismo em receptores GLP-1 no hipotálamo e tronco cerebral, reduzindo o apetite e a ingestão calórica; retardo do esvaziamento gástrico; e possível efeito direto no tecido adiposo.",
      C: "Bloqueio de receptores de leptina hipotalâmicos, sensibilizando o centro da saciedade.",
      D: "Inibição do transportador SGLT2 renal, causando glicosúria e perda calórica urinária.",
      E: "Antagonismo de receptores canabinoide CB1 hipotalâmicos, reduzindo o apetite e a lipogênese."
    },
    gabarito: "B",
    justificativa: "O semaglutide (GLP-1 RA) atua em receptores GLP-1 no hipotálamo (núcleo arqueado — redução do apetite), no tronco cerebral (área postrema — náusea/saciedade) e no trato GI (retardo do esvaziamento gástrico). A combinação desses efeitos resulta em redução de 15–17% do peso corporal em estudos fase 3 (STEP trials). Gudzune & Kushner destacam essa classe como transformadora no tratamento da obesidade."
  },
  {
    idx: 23, type: "mc", topic: "Artigos Jigsaw — Interações Medicamentosas",
    enunciado: "Fagiolino et al. descrevem interações fármaco-fármaco mediadas pelo citocromo P450. Paciente em uso de varfarina (substrato CYP2C9) inicia fluconazol (inibidor potente CYP2C9). Qual o desfecho esperado e a conduta correta?",
    alternativas: {
      A: "Redução do efeito anticoagulante da varfarina; aumentar a dose de varfarina e monitorar INR.",
      B: "Aumento do efeito anticoagulante da varfarina por redução do seu metabolismo; reduzir a dose de varfarina e monitorar INR diariamente.",
      C: "Sem interação clinicamente relevante, pois a varfarina tem índice terapêutico amplo.",
      D: "Indução do CYP2C9 pelo fluconazol, aumentando o metabolismo da varfarina e reduzindo o INR.",
      E: "Competição pelo sítio de ligação à albumina, deslocando a varfarina e causando toxicidade transitória sem necessidade de ajuste de dose."
    },
    gabarito: "B",
    justificativa: "O fluconazol é inibidor potente e seletivo do CYP2C9 (e também CYP3A4). A varfarina S (mais potente) é metabolizada pelo CYP2C9. A inibição reduz o metabolismo da varfarina → aumento dos níveis plasmáticos → aumento do INR → risco de sangramento. Conduta: reduzir a dose de varfarina em ~25–50% e monitorar INR diariamente até estabilização."
  },
  {
    idx: 24, type: "mc", topic: "Artigos Jigsaw — Oncologia (KRAS)",
    enunciado: "Inibidores de KRAS G12C (sotorasibe, adagrasibe) representam avanço no tratamento do câncer de pulmão não pequenas células. Qual é o mecanismo molecular que torna o KRAS G12C 'drogável', diferentemente de outras mutações KRAS?",
    alternativas: {
      A: "A mutação G12C aumenta a atividade GTPase intrínseca do KRAS, criando um sítio de ligação para inibidores competitivos com o GTP.",
      B: "A mutação G12C (glicina → cisteína) cria um resíduo de cisteína na posição 12 que permite ligação covalente irreversível de inibidores ao KRAS na conformação GDP-bound (inativa).",
      C: "A mutação G12C reduz a afinidade do KRAS pelo GTP, permitindo que inibidores competitivos deslocuem o nucleotídeo.",
      D: "A mutação G12C ativa constitutivamente a via PI3K/AKT, criando um alvo druggable downstream.",
      E: "A mutação G12C aumenta a expressão de KRAS na membrana celular, tornando-o acessível a anticorpos monoclonais."
    },
    gabarito: "B",
    justificativa: "A mutação G12C substitui glicina por cisteína na posição 12 do KRAS. Essa cisteína única permite que inibidores como sotorasibe e adagrasibe formem ligação covalente irreversível com o KRAS no estado GDP-bound (inativo), aprisionando-o na conformação inativa e impedindo a ativação por fatores de troca de nucleotídeos (GEFs). Outras mutações KRAS (G12D, G12V) não têm esse resíduo de cisteína."
  }
];

export default function LiveQuizControl() {
  const [token, setToken] = useState(() => localStorage.getItem(TEACHER_TOKEN_KEY) || "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [showLogin, setShowLogin] = useState(!token);

  const [sessionId, setSessionId] = useState<number | null>(null);
  const [accessCode, setAccessCode] = useState("");
  const [sessionStatus, setSessionStatus] = useState<any>(null);
  const [currentQIdx, setCurrentQIdx] = useState(-1); // -1 = lobby
  const [creating, setCreating] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [grading, setGrading] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<number>(22);
  const [selectedProva, setSelectedProva] = useState<"P1" | "P2">("P2");
  const [timeLimitSec, setTimeLimitSec] = useState(90);

  // Polling do status da sessão
  useEffect(() => {
    if (!sessionId) return;
    const interval = setInterval(async () => {
      try {
        const data = await callApi("teacherAuth.getLiveQuizStatus", { sessionToken: token, sessionId });
        setSessionStatus(data);
        if (data?.currentQuestionIndex !== undefined) setCurrentQIdx(data.currentQuestionIndex);
      } catch (e) { /* ignore */ }
    }, 2000);
    return () => clearInterval(interval);
  }, [sessionId, token]);

  const handleLogin = async () => {
    setLoginLoading(true);
    try {
      const res = await callApi("teacherAuth.login", { email, password });
      if (res?.sessionToken) {
        setToken(res.sessionToken);
        localStorage.setItem(TEACHER_TOKEN_KEY, res.sessionToken);
        setShowLogin(false);
        toast.success("Login realizado!");
      } else {
        toast.error("Email ou senha incorretos");
      }
    } catch (e: any) {
      toast.error(e.message || "Erro no login");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await callApi("teacherAuth.createLiveQuiz", {
        sessionToken: token,
        classId: selectedClassId,
        provaType: selectedProva,
        timeLimitSeconds: timeLimitSec,
        questions: P2_QUESTIONS,
      });
      if (res?.sessionId) {
        setSessionId(res.sessionId);
        setAccessCode(res.accessCode);
        setCurrentQIdx(-1);
        toast.success(`Quiz criado! Código: ${res.accessCode}`);
      } else {
        toast.error(res?.message || "Erro ao criar quiz");
      }
    } catch (e: any) {
      toast.error(e.message || "Erro ao criar quiz");
    } finally {
      setCreating(false);
    }
  };

  const handleAdvance = async () => {
    if (!sessionId) return;
    setAdvancing(true);
    try {
      const nextIdx = currentQIdx + 1;
      const res = await callApi("teacherAuth.advanceLiveQuiz", {
        sessionToken: token,
        sessionId,
        questionIndex: nextIdx,
      });
      if (res?.success) {
        setCurrentQIdx(nextIdx);
        toast.success(`Questão ${nextIdx + 1} exibida`);
      } else {
        toast.error(res?.message || "Erro ao avançar");
      }
    } catch (e: any) {
      toast.error(e.message || "Erro ao avançar");
    } finally {
      setAdvancing(false);
    }
  };

  const handleCloseQuestion = async () => {
    if (!sessionId) return;
    try {
      await callApi("teacherAuth.closeLiveQuizQuestion", { sessionToken: token, sessionId });
      toast.info("Questão fechada para respostas");
    } catch (e: any) {
      toast.error(e.message || "Erro");
    }
  };

  const handleReleaseGabarito = async () => {
    if (!sessionId) return;
    setReleasing(true);
    try {
      const res = await callApi("teacherAuth.releaseLiveQuizGabarito", {
        sessionToken: token,
        sessionId,
        gabarito: P2_QUESTIONS.map(q => ({ gabarito: q.gabarito, justificativa: q.justificativa })),
      });
      if (res?.success) {
        toast.success("Gabarito liberado para os alunos!");
      } else {
        toast.error(res?.message || "Erro ao liberar gabarito");
      }
    } catch (e: any) {
      toast.error(e.message || "Erro ao liberar gabarito");
    } finally {
      setReleasing(false);
    }
  };

  const handleGradeAndLaunch = async () => {
    if (!sessionId) return;
    setGrading(true);
    try {
      const res = await callApi("teacherAuth.gradeLiveQuiz", {
        sessionToken: token,
        sessionId,
        classId: selectedClassId,
        provaType: selectedProva,
      });
      if (res?.success) {
        toast.success(`Notas lançadas! ${res.gradedCount} alunos corrigidos.`);
      } else {
        toast.error(res?.message || "Erro ao lançar notas");
      }
    } catch (e: any) {
      toast.error(e.message || "Erro ao lançar notas");
    } finally {
      setGrading(false);
    }
  };

  const currentQ = currentQIdx >= 0 ? P2_QUESTIONS[currentQIdx] : null;
  const totalQ = P2_QUESTIONS.length;
  const answeredCount = sessionStatus?.answeredCount || 0;
  const totalStudents = sessionStatus?.totalStudents || 0;
  const isFinished = sessionStatus?.status === "finished" || sessionStatus?.status === "gabarito_released";

  // ─── LOGIN ───
  if (showLogin) {
    return (
      <div className="p-6 max-w-sm mx-auto">
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Monitor className="w-5 h-5 text-red-400" /> Quiz ao Vivo — Login
        </h2>
        <div className="space-y-3">
          <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email do professor" className="bg-gray-800 border-gray-600 text-white" />
          <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Senha" className="bg-gray-800 border-gray-600 text-white" onKeyDown={e => e.key === "Enter" && handleLogin()} />
          <Button onClick={handleLogin} disabled={loginLoading} className="w-full bg-red-600 hover:bg-red-700">
            {loginLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Entrar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Monitor className="w-5 h-5 text-red-400" /> Quiz ao Vivo — Controle do Professor
        </h2>
        <button onClick={() => { setToken(""); setShowLogin(true); localStorage.removeItem(TEACHER_TOKEN_KEY); }} className="text-gray-500 hover:text-gray-300 text-xs">Sair</button>
      </div>

      {/* Configuração / Criar sessão */}
      {!sessionId && (
        <Card className="bg-gray-900 border-gray-700">
          <CardHeader><CardTitle className="text-white text-base">Configurar Quiz</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Turma</label>
                <Select value={String(selectedClassId)} onValueChange={v => setSelectedClassId(Number(v))}>
                  <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TURMAS.map(t => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Prova</label>
                <Select value={selectedProva} onValueChange={v => setSelectedProva(v as "P1" | "P2")}>
                  <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="P1">P1</SelectItem>
                    <SelectItem value="P2">P2</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Tempo por questão (segundos)</label>
              <Select value={String(timeLimitSec)} onValueChange={v => setTimeLimitSec(Number(v))}>
                <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="60">60 segundos</SelectItem>
                  <SelectItem value="90">90 segundos (padrão)</SelectItem>
                  <SelectItem value="120">120 segundos</SelectItem>
                  <SelectItem value="180">180 segundos</SelectItem>
                  <SelectItem value="0">Sem limite</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="bg-gray-800 rounded-lg p-3 text-sm text-gray-300">
              <p className="font-semibold text-white mb-1">📋 {totalQ} questões carregadas:</p>
              <p>• Q1–Q5: Farmacologia Adrenérgica</p>
              <p>• Q6–Q10: AINEs e Glicocorticoides</p>
              <p>• Q11–Q15: Anestésicos Locais</p>
              <p>• Q16–Q19: Anti-histamínicos</p>
              <p>• Q20–Q25: Artigos Jigsaw Fase 1</p>
            </div>
            <Button onClick={handleCreate} disabled={creating} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold">
              {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
              Criar Sessão do Quiz
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Sessão ativa */}
      {sessionId && (
        <>
          {/* Código de acesso */}
          <Card className="bg-gray-900 border-green-700">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-xs">Código de acesso</p>
                  <p className="text-4xl font-mono font-bold text-green-400 tracking-widest">{accessCode}</p>
                  <p className="text-gray-400 text-xs mt-1">Alunos acessam: <span className="text-white">2026.conexaofarmacologia.com.br/quiz-ao-vivo</span></p>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 text-green-400">
                    <Users className="w-4 h-4" />
                    <span className="text-2xl font-bold">{answeredCount}</span>
                    <span className="text-gray-400 text-sm">/{totalStudents}</span>
                  </div>
                  <p className="text-gray-400 text-xs">responderam</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Questão atual */}
          <Card className="bg-gray-900 border-gray-700">
            <CardContent className="pt-4 space-y-3">
              {currentQIdx === -1 ? (
                <div className="text-center py-4">
                  <Loader2 className="w-8 h-8 text-gray-500 animate-spin mx-auto mb-2" />
                  <p className="text-gray-400">Aguardando alunos entrarem no lobby...</p>
                  <p className="text-gray-500 text-sm mt-1">Clique em "Iniciar Q1" quando todos estiverem conectados</p>
                </div>
              ) : currentQ ? (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-red-600 text-white">Q{currentQIdx + 1}/{totalQ}</Badge>
                    <Badge variant="outline" className="border-gray-600 text-gray-300 text-xs">{currentQ.topic}</Badge>
                    <Badge variant="outline" className="border-gray-600 text-gray-300 text-xs">{currentQ.type === "mc" ? "Múltipla Escolha" : currentQ.type === "vf" ? "V/F" : "Correlação"}</Badge>
                  </div>
                  <p className="text-white text-sm leading-relaxed whitespace-pre-line line-clamp-4">{currentQ.enunciado}</p>
                  <div className="mt-2 bg-green-900/30 border border-green-700 rounded px-3 py-1 text-sm">
                    <span className="text-gray-400">Gabarito: </span>
                    <span className="text-green-400 font-bold">{currentQ.gabarito}</span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <Trophy className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
                  <p className="text-white font-semibold">Todas as questões foram exibidas!</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Controles */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={handleAdvance}
              disabled={advancing || isFinished || currentQIdx >= totalQ - 1}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {advancing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ChevronRight className="w-4 h-4 mr-2" />}
              {currentQIdx === -1 ? "Iniciar Q1" : currentQIdx >= totalQ - 1 ? "Última questão" : `Próxima Q${currentQIdx + 2}`}
            </Button>
            <Button
              onClick={handleCloseQuestion}
              disabled={currentQIdx < 0 || isFinished}
              variant="outline"
              className="border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              <Lock className="w-4 h-4 mr-2" /> Fechar Respostas
            </Button>
          </div>

          {/* Liberar gabarito + Lançar notas */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={handleReleaseGabarito}
              disabled={releasing || sessionStatus?.status === "gabarito_released"}
              className="bg-yellow-600 hover:bg-yellow-700 text-white"
            >
              {releasing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
              {sessionStatus?.status === "gabarito_released" ? "Gabarito Liberado ✓" : "Liberar Gabarito"}
            </Button>
            <Button
              onClick={handleGradeAndLaunch}
              disabled={grading}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {grading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
              Corrigir e Lançar Notas
            </Button>
          </div>

          {/* Status */}
          {sessionStatus && (
            <div className="bg-gray-800 rounded-lg p-3 text-xs text-gray-400 space-y-1">
              <p>Status: <span className="text-white">{sessionStatus.status}</span></p>
              <p>Questão atual: <span className="text-white">{currentQIdx >= 0 ? `Q${currentQIdx + 1}` : "Lobby"}</span></p>
              <p>Respostas recebidas: <span className="text-white">{answeredCount}/{totalStudents}</span></p>
            </div>
          )}

          {/* Reiniciar */}
          <Button
            onClick={() => { setSessionId(null); setAccessCode(""); setCurrentQIdx(-1); setSessionStatus(null); }}
            variant="ghost"
            className="w-full text-gray-500 hover:text-gray-300 text-xs"
          >
            <RefreshCw className="w-3 h-3 mr-1" /> Criar novo quiz
          </Button>
        </>
      )}
    </div>
  );
}
