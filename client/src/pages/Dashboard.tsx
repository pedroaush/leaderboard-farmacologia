/*
 * Dashboard do Aluno — Conexão em Farmacologia
 * Padronizado: Laranja (#F7941D) + Cinza (#4A4A4A) + Branco
 */
import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { ArrowLeft, Trophy, Award, MapPin, TrendingUp, Users, Shield } from "lucide-react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const ORANGE = "#F7941D";
const GRAY = "#4A4A4A";
const DARK_BG = "#0A1628";
const CARD_BG = "#0D1B2A";

export default function Dashboard() {
  const [sessionToken, setSessionToken] = useState<string>("");
  const [isAdmin, setIsAdmin] = useState(false);
  
  useEffect(() => {
    // Tentar obter token de aluno primeiro, depois token de admin
    const studentToken = localStorage.getItem("studentSessionToken");
    const adminToken = localStorage.getItem("sessionToken");
    
    if (studentToken) {
      setSessionToken(studentToken);
      setIsAdmin(false);
    } else if (adminToken) {
      setSessionToken(adminToken);
      setIsAdmin(true);
    }
  }, []);
  
  const { data: stats, isLoading: statsLoading } = trpc.studentDashboard.getMyStats.useQuery({ sessionToken }, { enabled: !!sessionToken && !isAdmin });
  const { data: evolution, isLoading: evolutionLoading } = trpc.studentDashboard.getEvolution.useQuery({ sessionToken }, { enabled: !!sessionToken && !isAdmin });
  const { data: badges, isLoading: badgesLoading } = trpc.studentDashboard.getBadges.useQuery({ sessionToken }, { enabled: !!sessionToken && !isAdmin });

  // Esta tela mostra o desempenho de UM aluno específico — não faz sentido
  // pra um admin, que não é aluno de nenhuma turma. Checado ANTES do loading
  // porque as consultas de aluno nem disparam quando isAdmin=true (ficariam
  // "carregando" pra sempre se checássemos depois).
  if (isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: DARK_BG }}>
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: ORANGE + "20" }}>
            <Shield size={28} style={{ color: ORANGE }} />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Tela exclusiva para alunos</h1>
          <p className="text-sm mb-6" style={{ color: "rgba(255,255,255,0.6)" }}>
            O "Meu Dashboard" mostra o desempenho individual de um aluno — como admin, essa tela não se aplica a você.
            Use o Painel Admin para acompanhar a turma inteira.
          </p>
          <Link href="/admin">
            <span className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-white font-medium" style={{ backgroundColor: ORANGE }}>
              Ir para o Painel Admin
            </span>
          </Link>
        </div>
      </div>
    );
  }

  if (statsLoading || evolutionLoading || badgesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: DARK_BG }}>
        <div className="text-center">
          <div className="w-16 h-16 border-4 rounded-full animate-spin mx-auto mb-4" style={{ borderColor: ORANGE + "40", borderTopColor: ORANGE }} />
          <p style={{ color: "rgba(255,255,255,0.6)" }}>Carregando seu dashboard...</p>
        </div>
      </div>
    );
  }

  // Esta tela mostra o desempenho de UM aluno específico — não faz sentido
  // pra um admin, que não é aluno de nenhuma turma. Antes disso, o código já
  // detectava isAdmin mas nunca usava — seguia direto pra tela de aluno com
  // tudo zerado (era o que aparecia no print).
  if (isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: DARK_BG }}>
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: ORANGE + "20" }}>
            <Shield size={28} style={{ color: ORANGE }} />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Tela exclusiva para alunos</h1>
          <p className="text-sm mb-6" style={{ color: "rgba(255,255,255,0.6)" }}>
            O "Meu Dashboard" mostra o desempenho individual de um aluno — como admin, essa tela não se aplica a você.
            Use o Painel Admin para acompanhar a turma inteira.
          </p>
          <Link href="/admin">
            <span className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-white font-medium" style={{ backgroundColor: ORANGE }}>
              Ir para o Painel Admin
            </span>
          </Link>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: DARK_BG }}>
        <div className="text-center">
          <p className="text-white mb-4">Você precisa estar logado como aluno para acessar o dashboard.</p>
          <Link href="/login-aluno">
            <span className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-white font-medium" style={{ backgroundColor: ORANGE }}>
              Fazer Login
            </span>
          </Link>
        </div>
      </div>
    );
  }

  const percentile = stats.totalStudents > 0 ? ((stats.totalStudents - stats.rank + 1) / stats.totalStudents * 100).toFixed(0) : 0;

  return (
    <div className="min-h-screen" style={{ backgroundColor: DARK_BG }}>
      {/* Header */}
      <div className="border-b" style={{ backgroundColor: CARD_BG, borderColor: "rgba(255,255,255,0.1)" }}>
        <div className="container px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8">
          <Link href="/leaderboard">
            <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-medium mb-3 sm:mb-4 transition-colors" style={{ color: "rgba(255,255,255,0.6)", backgroundColor: "rgba(255,255,255,0.05)" }}>
              <ArrowLeft size={16} />
              Voltar ao Leaderboard
            </button>
          </Link>
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl 2xl:text-6xl font-bold text-white">Meu Dashboard</h1>
          <p style={{ color: "rgba(255,255,255,0.6)" }} className="mt-1">Olá, {stats.studentName}! Acompanhe seu desempenho.</p>
        </div>
      </div>

      <div className="container px-3 sm:px-4 md:px-6 lg:px-8 2xl:px-12 py-6 sm:py-8 md:py-10 lg:py-12 2xl:py-16">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5 lg:gap-6 2xl:gap-8 mb-8">
          {/* Total PF */}
          <div className="p-3 sm:p-4 md:p-5 lg:p-6 rounded-lg border" style={{ backgroundColor: CARD_BG, borderColor: "rgba(255,255,255,0.1)" }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-lg flex items-center justify-center" style={{ backgroundColor: ORANGE + "20" }}>
                <TrendingUp size={24} style={{ color: ORANGE }} />
              </div>
              <div>
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>PF Acumulados</p>
                <p className="text-xl sm:text-2xl md:text-3xl font-bold" style={{ color: ORANGE }}>{Number(stats.totalPF).toFixed(1)}</p>
              </div>
            </div>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>de 45 possíveis</p>
          </div>

          {/* Ranking */}
          <div className="p-3 sm:p-4 md:p-5 lg:p-6 rounded-lg border" style={{ backgroundColor: CARD_BG, borderColor: "rgba(255,255,255,0.1)" }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-lg flex items-center justify-center" style={{ backgroundColor: ORANGE + "20" }}>
                <Trophy size={24} style={{ color: ORANGE }} />
              </div>
              <div>
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>Ranking</p>
                <p className="text-xl sm:text-2xl md:text-3xl font-bold text-white">#{stats.rank}</p>
              </div>
            </div>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>Top {percentile}% da turma</p>
          </div>

          {/* Badges */}
          <div className="p-3 sm:p-4 md:p-5 lg:p-6 rounded-lg border" style={{ backgroundColor: CARD_BG, borderColor: "rgba(255,255,255,0.1)" }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-lg flex items-center justify-center" style={{ backgroundColor: ORANGE + "20" }}>
                <Award size={24} style={{ color: ORANGE }} />
              </div>
              <div>
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>Badges</p>
                <p className="text-xl sm:text-2xl md:text-3xl font-bold text-white">{stats.badgesCount}</p>
              </div>
            </div>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>conquistas desbloqueadas</p>
          </div>

          {/* Attendance */}
          <div className="p-3 sm:p-4 md:p-5 lg:p-6 rounded-lg border" style={{ backgroundColor: CARD_BG, borderColor: "rgba(255,255,255,0.1)" }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-lg flex items-center justify-center" style={{ backgroundColor: ORANGE + "20" }}>
                <MapPin size={24} style={{ color: ORANGE }} />
              </div>
              <div>
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>Presenças</p>
                <p className="text-xl sm:text-2xl md:text-3xl font-bold text-white">{stats.attendanceCount}</p>
              </div>
            </div>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>de 17 aulas</p>
          </div>

          {/* Team */}
          <div className="p-3 sm:p-4 md:p-5 lg:p-6 rounded-lg border sm:col-span-2" style={{ backgroundColor: CARD_BG, borderColor: "rgba(255,255,255,0.1)" }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-lg flex items-center justify-center" style={{ backgroundColor: ORANGE + "20" }}>
                <Users size={24} style={{ color: ORANGE }} />
              </div>
              <div>
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>Equipe</p>
                <p className="text-xl sm:text-2xl md:text-3xl font-bold text-white">{stats.teamName}</p>
              </div>
            </div>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>Trabalhe em equipe para conquistar mais PF!</p>
          </div>
        </div>

        {/* Evolution Chart */}
        <div className="p-3 sm:p-4 md:p-5 lg:p-6 rounded-lg border mb-8" style={{ backgroundColor: CARD_BG, borderColor: "rgba(255,255,255,0.1)" }}>
          <h2 className="text-xl font-bold text-white mb-4">Evolução de PF</h2>
          {evolution && evolution.length > 0 ? (
            <div style={{ height: "300px" }}>
              <Line
                data={{
                  labels: evolution.map(d => `Sem ${d.week}`),
                  datasets: [
                    {
                      label: "PF Acumulados",
                      data: evolution.map(d => d.pf),
                      borderColor: ORANGE,
                      backgroundColor: `${ORANGE}33`,
                      fill: true,
                      tension: 0.4,
                      pointBackgroundColor: ORANGE,
                      pointBorderColor: "#fff",
                      pointBorderWidth: 2,
                      pointRadius: 4,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      display: false,
                    },
                    tooltip: {
                      backgroundColor: "rgba(20,20,30,0.9)",
                      titleColor: ORANGE,
                      bodyColor: "#fff",
                      borderColor: ORANGE,
                      borderWidth: 1,
                    },
                  },
                  scales: {
                    x: {
                      grid: {
                        color: "rgba(255,255,255,0.1)",
                      },
                      ticks: {
                        color: "rgba(255,255,255,0.6)",
                      },
                    },
                    y: {
                      grid: {
                        color: "rgba(255,255,255,0.1)",
                      },
                      ticks: {
                        color: "rgba(255,255,255,0.6)",
                      },
                      beginAtZero: true,
                    },
                  },
                }}
              />
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center" style={{ color: "rgba(255,255,255,0.4)" }}>
              Nenhum dado disponível
            </div>
          )}
        </div>

        {/* Badges History */}
        <div className="p-3 sm:p-4 md:p-5 lg:p-6 rounded-lg border" style={{ backgroundColor: CARD_BG, borderColor: "rgba(255,255,255,0.1)" }}>
          <h2 className="text-xl font-bold text-white mb-4">Histórico de Badges</h2>
          {badges && badges.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {badges.map((badge) => (
                <div
                  key={badge.id}
                  className="p-4 rounded-lg border" 
                  style={{ backgroundColor: "rgba(20,20,30,0.5)", borderColor: ORANGE + "33" }}
                >
                  <div className="flex items-start gap-3">
                    <div className="text-3xl flex-shrink-0">
                      {badge.badgeIconUrl ? (
                        <img src={badge.badgeIconUrl} alt={badge.badgeName || "Badge"} className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 object-contain" />
                      ) : (
                        "🏆"
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-white truncate">{badge.badgeName || "Badge"}</h3>
                      <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
                        {badge.badgeDescription || "Conquista desbloqueada"}
                      </p>
                      {badge.week && (
                        <p className="text-xs mt-1" style={{ color: ORANGE }}>
                          Semana {badge.week}
                        </p>
                      )}
                      {badge.earnedAt && (
                        <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                          {new Date(badge.earnedAt).toLocaleDateString("pt-BR")}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-32" style={{ color: "rgba(255,255,255,0.4)" }}>
              Nenhum badge conquistado ainda. Continue participando das aulas!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}