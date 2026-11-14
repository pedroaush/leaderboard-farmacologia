/*
 * =====================================================
 * CONEXÃO EM FARMACOLOGIA - DADOS DO LEADERBOARD
 * Farmacologia I (2026.1) - UNIRIO
 * =====================================================
 * INSTRUÇÕES PARA O PROFESSOR:
 * Para atualizar os dados, basta editar os valores de PF
 * neste arquivo. O leaderboard será atualizado automaticamente.
 * =====================================================
 * PF = Pontos Farmacológicos
 * =====================================================
 */

export interface TeamMember {
  name: string;
  pf: number;
}

export interface Team {
  id: number;
  name: string;
  emoji: string;
  color: string;
  members: TeamMember[];
}

export interface WeeklyHighlight {
  week: number;
  date: string;
  activity: string;
  topTeam: string;
  topStudent: string;
  description: string;
}

export interface PFActivity {
  name: string;
  maxPF: number;
  icon: string;
}

// Atividades que geram PF (Pontos Farmacológicos)
export const pfActivities: PFActivity[] = [
  { name: "Quiz Relâmpago", maxPF: 0.5, icon: "⚡" },
  { name: "Desafio Semanal", maxPF: 1.0, icon: "🎯" },
  { name: "Jigsaw em Sala", maxPF: 2.0, icon: "🧩" },
  { name: "Escape Room", maxPF: 3.0, icon: "🔓" },
  { name: "Seminário Grand Rounds", maxPF: 3.0, icon: "🎤" },
  { name: "Kahoot", maxPF: 1.5, icon: "🏆" },
  { name: "Scavenger Hunt", maxPF: 2.0, icon: "🔍" },
  { name: "Vídeo 'Explique p/ Avó'", maxPF: 5.0, icon: "📹" },
  { name: "Caso Clínico Integrado", maxPF: 2.0, icon: "🏥" },
];

// PF máximo possível no semestre
export const MAX_PF_SEMESTER = 45;

// Dados das 16 equipes
export const teams: Team[] = [
  {
    id: 1, name: "Acetilcolina", emoji: "💊", color: "#3b82f6",
    members: [
      { name: "Ana Silva", pf: 12.5 },
      { name: "Bruno Costa", pf: 11.0 },
      { name: "Carla Mendes", pf: 13.5 },
      { name: "Diego Rocha", pf: 10.0 },
      { name: "Elena Souza", pf: 14.0 },
    ]
  },
  {
    id: 2, name: "Adrenalina", emoji: "💉", color: "#10b981",
    members: [
      { name: "Felipe Alves", pf: 15.0 },
      { name: "Gabriela Lima", pf: 14.5 },
      { name: "Hugo Martins", pf: 13.0 },
      { name: "Isabela Nunes", pf: 16.0 },
      { name: "João Ferreira", pf: 12.5 },
    ]
  },
  {
    id: 3, name: "Dopamina", emoji: "🧬", color: "#06b6d4",
    members: [
      { name: "Karen Oliveira", pf: 11.5 },
      { name: "Lucas Pereira", pf: 10.5 },
      { name: "Maria Santos", pf: 12.0 },
      { name: "Nathan Ribeiro", pf: 9.5 },
      { name: "Olívia Araújo", pf: 13.0 },
    ]
  },
  {
    id: 4, name: "Serotonina", emoji: "🧪", color: "#8b5cf6",
    members: [
      { name: "Pedro Gomes", pf: 14.0 },
      { name: "Quésia Dias", pf: 13.5 },
      { name: "Rafael Cardoso", pf: 12.0 },
      { name: "Sara Monteiro", pf: 15.5 },
      { name: "Thiago Barbosa", pf: 11.0 },
    ]
  },
  {
    id: 5, name: "Histamina", emoji: "🔬", color: "#f59e0b",
    members: [
      { name: "Ursula Campos", pf: 10.0 },
      { name: "Vinícius Teixeira", pf: 9.0 },
      { name: "Wanda Correia", pf: 11.5 },
      { name: "Xavier Moura", pf: 8.5 },
      { name: "Yasmin Pinto", pf: 12.0 },
    ]
  },
  {
    id: 6, name: "Noradrenalina", emoji: "⚗️", color: "#ef4444",
    members: [
      { name: "Zara Fonseca", pf: 13.0 },
      { name: "André Vieira", pf: 12.5 },
      { name: "Bianca Lopes", pf: 14.0 },
      { name: "Caio Nascimento", pf: 11.5 },
      { name: "Daniela Reis", pf: 15.0 },
    ]
  },
  {
    id: 7, name: "GABA", emoji: "🧠", color: "#6366f1",
    members: [
      { name: "Eduardo Azevedo", pf: 9.5 },
      { name: "Fernanda Cruz", pf: 10.0 },
      { name: "Gustavo Machado", pf: 8.0 },
      { name: "Helena Borges", pf: 11.0 },
      { name: "Igor Sampaio", pf: 7.5 },
    ]
  },
  {
    id: 8, name: "Glutamato", emoji: "🧫", color: "#ec4899",
    members: [
      { name: "Juliana Freitas", pf: 12.0 },
      { name: "Kevin Duarte", pf: 11.5 },
      { name: "Larissa Cunha", pf: 13.0 },
      { name: "Marcos Tavares", pf: 10.5 },
      { name: "Natália Ramos", pf: 14.5 },
    ]
  },
  {
    id: 9, name: "Prostaglandina", emoji: "💊", color: "#14b8a6",
    members: [
      { name: "Otávio Melo", pf: 11.0 },
      { name: "Patrícia Soares", pf: 12.5 },
      { name: "Quirino Andrade", pf: 10.0 },
      { name: "Renata Barros", pf: 13.5 },
      { name: "Sérgio Carvalho", pf: 9.0 },
    ]
  },
  {
    id: 10, name: "Endorfina", emoji: "🌟", color: "#f97316",
    members: [
      { name: "Tatiana Moreira", pf: 14.5 },
      { name: "Ulisses Pires", pf: 13.0 },
      { name: "Valéria Guedes", pf: 15.0 },
      { name: "Wesley Brito", pf: 12.0 },
      { name: "Ximena Coelho", pf: 16.5 },
    ]
  },
  {
    id: 11, name: "Insulina", emoji: "💉", color: "#84cc16",
    members: [
      { name: "Yuri Pacheco", pf: 8.5 },
      { name: "Zélia Nogueira", pf: 9.0 },
      { name: "Amanda Leite", pf: 7.0 },
      { name: "Bernardo Faria", pf: 10.5 },
      { name: "Cecília Rocha", pf: 6.5 },
    ]
  },
  {
    id: 12, name: "Cortisol", emoji: "⚡", color: "#a855f7",
    members: [
      { name: "Davi Santana", pf: 11.0 },
      { name: "Elisa Medeiros", pf: 12.0 },
      { name: "Fábio Queiroz", pf: 10.5 },
      { name: "Gisele Alencar", pf: 13.0 },
      { name: "Henrique Lima", pf: 9.5 },
    ]
  },
  {
    id: 13, name: "Atropina", emoji: "🔬", color: "#0ea5e9",
    members: [
      { name: "Ingrid Castro", pf: 13.5 },
      { name: "Jorge Silveira", pf: 12.0 },
      { name: "Karina Vasconcelos", pf: 14.0 },
      { name: "Leonardo Prado", pf: 11.0 },
      { name: "Mônica Esteves", pf: 15.5 },
    ]
  },
  {
    id: 14, name: "Morfina", emoji: "🧪", color: "#d946ef",
    members: [
      { name: "Nélson Aguiar", pf: 10.0 },
      { name: "Olga Fernandes", pf: 11.5 },
      { name: "Paulo Henrique", pf: 9.0 },
      { name: "Rita Cavalcanti", pf: 12.5 },
      { name: "Simone Braga", pf: 8.0 },
    ]
  },
  {
    id: 15, name: "Lidocaína", emoji: "💊", color: "#22d3ee",
    members: [
      { name: "Tiago Mendonça", pf: 12.0 },
      { name: "Úrsula Dantas", pf: 13.5 },
      { name: "Valter Siqueira", pf: 11.0 },
      { name: "Wilma Teles", pf: 14.0 },
      { name: "Xande Portela", pf: 10.5 },
    ]
  },
  {
    id: 16, name: "Omeprazol", emoji: "🧫", color: "#fb923c",
    members: [
      { name: "Yago Rezende", pf: 9.5 },
      { name: "Zilma Fontes", pf: 10.0 },
      { name: "Adriano Maia", pf: 8.0 },
      { name: "Bruna Lacerda", pf: 11.0 },
      { name: "Cláudio Rangel", pf: 7.5 },
    ]
  },
];

// Destaques semanais - CRONOGRAMA COMPLETO 2026.1 (17 SEMANAS)
export const weeklyHighlights: WeeklyHighlight[] = [
  {
    week: 1, date: "03/03/2026",
    activity: "Introdução à Farmacologia",
    topTeam: "—", topStudent: "—",
    description: "Apresentação da disciplina, regras de gamificação, formação das equipes e TBL diagnóstico."
  },
  {
    week: 2, date: "10/03/2026",
    activity: "Farmacocinética I",
    topTeam: "—", topStudent: "—",
    description: "Vias de administração, biodisponibilidade, volume de distribuição. TBL 1."
  },
  {
    week: 3, date: "17/03/2026",
    activity: "Farmacocinética II",
    topTeam: "—", topStudent: "—",
    description: "Biotransformação hepática, citocromo P450, depuração renal. Caso Clínico 1."
  },
  {
    week: 4, date: "24/03/2026",
    activity: "Farmacodinâmica",
    topTeam: "—", topStudent: "—",
    description: "Agonistas, antagonistas, dose-resposta, potência e eficácia. TBL 2."
  },
  {
    week: 5, date: "31/03/2026",
    activity: "SNA — Transmissão Colinérgica",
    topTeam: "—", topStudent: "—",
    description: "Agonistas e antagonistas muscarínicos, inibidores da colinesterase. Caso Clínico 2."
  },
  {
    week: 6, date: "07/04/2026",
    activity: "SNA — Bloqueadores Neuromusculares",
    topTeam: "—", topStudent: "—",
    description: "Despolarizantes e não-despolarizantes, uso clínico em anestesia. Seminário Jigsaw 1."
  },
  {
    week: 7, date: "14/04/2026",
    activity: "Seminários Jigsaw 2 e 3",
    topTeam: "—", topStudent: "—",
    description: "Apresentações dos grupos especialistas. Revisão integrativa pré-P1."
  },
  {
    week: 8, date: "28/04/2026",
    activity: "Prova P1 + Escape Room",
    topTeam: "—", topStudent: "—",
    description: "Avaliação individual (P1): conteúdo até colinérgicos/BNM + 3 primeiros Jigsaw. Escape Room temático."
  },
  {
    week: 9, date: "05/05/2026",
    activity: "SNA — Transmissão Adrenérgica",
    topTeam: "—", topStudent: "—",
    description: "Agonistas alfa e beta-adrenérgicos, catecolaminas. TBL 3."
  },
  {
    week: 10, date: "12/05/2026",
    activity: "SNA — Anti-adrenérgicos",
    topTeam: "—", topStudent: "—",
    description: "Bloqueadores alfa e beta, uso clínico em hipertensão e ICC. Caso Clínico 3."
  },
  {
    week: 11, date: "19/05/2026",
    activity: "Seminários Jigsaw 4 e 5",
    topTeam: "—", topStudent: "—",
    description: "Apresentações dos grupos especialistas sobre SNA adrenérgico."
  },
  {
    week: 12, date: "26/05/2026",
    activity: "Anti-inflamatórios (AINEs)",
    topTeam: "—", topStudent: "—",
    description: "Inibidores de COX, seletividade, efeitos adversos. TBL 4."
  },
  {
    week: 13, date: "02/06/2026",
    activity: "Corticosteroides & Opioides",
    topTeam: "—", topStudent: "—",
    description: "Mecanismo anti-inflamatório, receptores opioides, escala analgésica. Caso Clínico 4."
  },
  {
    week: 14, date: "09/06/2026",
    activity: "Anestésicos Locais",
    topTeam: "—", topStudent: "—",
    description: "Mecanismo de ação, classificação, uso clínico. Seminário Jigsaw 6."
  },
  {
    week: 15, date: "16/06/2026",
    activity: "Anti-histamínicos",
    topTeam: "—", topStudent: "—",
    description: "Receptores H1 e H2, anti-histamínicos de 1ª e 2ª geração, uso clínico em alergias."
  },
  {
    week: 16, date: "23/06/2026",
    activity: "Seminários Jigsaw 7 e 8 (2º dia)",
    topTeam: "—", topStudent: "—",
    description: "Segundo dia de apresentações dos seminários Jigsaw. Revisão integrativa."
  },
  {
    week: 17, date: "30/06/2026",
    activity: "Prova P2 + Premiação",
    topTeam: "—", topStudent: "—",
    description: "Avaliação individual (P2): conteúdo de adrenérgicos até anti-histamínicos. Cerimônia de premiação das equipes campeãs."
  },
];

// Semana atual do semestre
export const currentWeek = 1;

// Informações do curso
export const courseInfo = {
  name: "Farmacologia I",
  code: "MED-2026.1",
  professor: "Prof. Dr.",
  university: "UNIRIO",
  semester: "2026.1",
  totalStudents: 85,
  totalTeams: 16,
};

// Logo e branding
export const LOGO_URL = "/logos/oUYumbCRVNHBqtNw.png";
export const YOUTUBE_CHANNEL_URL = "https://www.youtube.com/@Conex%C3%A3oemCi%C3%AAncia-Farmacol%C3%B3gica";
export const PLATFORM_NAME = "Conexão em Farmacologia";
