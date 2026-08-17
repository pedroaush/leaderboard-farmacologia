import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, PieChart, TrendingUp, Users, Target, Zap, GraduationCap, ChevronRight, MessageCircle } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";

export default function TeacherDashboard() {
  const { user } = useAuth();
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "students">("overview");

  // Buscar desempenho individual dos alunos
  const { data: studentPerformance } = trpc.analytics.getStudentPerformance.useQuery(
    { limit: 20 },
    { enabled: !!selectedClassId }
  );

  // Buscar comparação entre turmas
  const { data: classComparison } = trpc.analytics.getTeamPerformance.useQuery({});

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Faça login para acessar o dashboard</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Dashboard de Progresso</h1>
          <p className="text-muted-foreground">Acompanhe o desempenho e dificuldades da sua turma</p>
        </div>

        {/* Seletor de Turma */}
        <div className="mb-6">
          <Select value={selectedClassId?.toString() || ""} onValueChange={(val) => setSelectedClassId(parseInt(val))}>
            <SelectTrigger className="w-full md:w-64">
              <SelectValue placeholder="Selecione uma turma" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Turma 1 - Farmacologia I</SelectItem>
              <SelectItem value="2">Turma 2 - Farmacologia I</SelectItem>
              <SelectItem value="3">Turma 3 - Farmacologia I</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Abas de Navegação */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {["overview", "students"].map((tab) => (
            <Button
              key={tab}
              variant={activeTab === tab ? "default" : "outline"}
              onClick={() => setActiveTab(tab as any)}
              className="whitespace-nowrap"
            >
              {tab === "overview" && "Visão Geral"}
              {tab === "students" && "Alunos"}
            </Button>
          ))}
        </div>

        {/* Conteúdo por Aba */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Estatísticas Resumidas */}
            {studentPerformance?.data && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Total de Alunos</p>
                      <p className="text-2xl font-bold">{studentPerformance.data.length}</p>
                    </div>
                    <Users className="w-8 h-8 text-primary opacity-50" />
                  </div>
                </Card>

                <Card className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Média de PF</p>
                      <p className="text-2xl font-bold">{(studentPerformance.data.reduce((sum: number, s: any) => sum + s.xp, 0) / studentPerformance.data.length).toFixed(1)}</p>
                    </div>
                    <TrendingUp className="w-8 h-8 text-green-500 opacity-50" />
                  </div>
                </Card>

                <Card className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Máximo PF</p>
                      <p className="text-2xl font-bold">{Math.max(...studentPerformance.data.map((s: any) => s.xp))}</p>
                    </div>
                    <Target className="w-8 h-8 text-blue-500 opacity-50" />
                  </div>
                </Card>

                <Card className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Mínimo PF</p>
                      <p className="text-2xl font-bold">{Math.min(...studentPerformance.data.map((s: any) => s.xp))}</p>
                    </div>
                    <Zap className="w-8 h-8 text-yellow-500 opacity-50" />
                  </div>
                </Card>
              </div>
            )}

            {/* Gráficos */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Distribuição de PF */}
              <Card className="p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <BarChart className="w-5 h-5" />
                  Distribuição de PF
                </h3>
                <div className="h-64 bg-muted rounded flex items-center justify-center">
                  <p className="text-sm text-muted-foreground">Gráfico de distribuição (em desenvolvimento)</p>
                </div>
              </Card>

              {/* Comparação de Turmas */}
              <Card className="p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <PieChart className="w-5 h-5" />
                  Comparação de Turmas
                </h3>
                <div className="space-y-3">
                  {classComparison?.data?.slice(0, 5).map((team: any) => (
                    <div key={team.teamId} className="flex items-center justify-between">
                      <span className="text-sm">{team.teamName}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary"
                            style={{
                              width: `${Math.min(
                                (team.currentXP / (classComparison.data[0]?.currentXP || 1)) * 100,
                                100
                              )}%`,
                            }}
                          />
                        </div>
                        <span className="text-sm font-medium w-12 text-right">{team.currentXP}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* Estatísticas Detalhadas */}
            {studentPerformance?.data && (
              <Card className="p-6">
                <h3 className="font-semibold mb-4">Estatísticas Detalhadas</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Máximo PF</p>
                    <p className="text-lg font-bold">{Math.max(...(studentPerformance.data?.map(s => s.xp) || [0]))}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Mínimo PF</p>
                    <p className="text-lg font-bold">{Math.min(...(studentPerformance.data?.map(s => s.xp) || [0]))}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Total de Alunos</p>
                    <p className="text-lg font-bold">{studentPerformance.data?.length || 0}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Média de PF</p>
                    <p className="text-lg font-bold">{studentPerformance.data && studentPerformance.data.length > 0 ? (studentPerformance.data.reduce((sum, s) => sum + s.xp, 0) / studentPerformance.data.length).toFixed(1) : 0}</p>
                  </div>
                </div>
              </Card>
            )}
          </div>
        )}

        {activeTab === "students" && (
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Desempenho Individual dos Alunos</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {studentPerformance?.data?.map((student: any, idx: number) => (
                <div key={student.rank} className="flex items-center justify-between p-3 bg-muted rounded">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-muted-foreground w-6">#{student.rank}</span>
                    <span className="text-sm">{student.name}</span>
                  </div>
                  <span className="text-sm font-semibold">{student.xp} PF</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Seção de Chat */}
        <Card className="p-6 mb-6">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-primary" />
              Chat com Alunos e Monitores
            </h3>
            <Link href="/professor/chat">
              <Button variant="outline" size="sm" className="gap-1">
                Abrir Chat <ChevronRight size={14} />
              </Button>
            </Link>
          </div>
        </Card>

        {/* Seção de Monitores */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-primary" />
              Monitores da Disciplina
            </h3>
            <Link href="/monitor">
              <Button variant="outline" size="sm" className="gap-1">
                Portal do Monitor <ChevronRight size={14} />
              </Button>
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-muted/50 border border-border">
              <p className="text-xs text-muted-foreground mb-1">Acesso do Monitor</p>
              <p className="text-sm font-medium">Portal dedicado em <code className="text-primary">/monitor</code></p>
              <p className="text-xs text-muted-foreground mt-1">Login com email e senha cadastrados</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50 border border-border">
              <p className="text-xs text-muted-foreground mb-1">Funcionalidades</p>
              <p className="text-sm font-medium">Jogo, Turmas, Equipes</p>
              <p className="text-xs text-muted-foreground mt-1">Frequências, Recursos, Seminários</p>
            </div>
            <Link href="/admin/monitores">
              <div className="p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/20 hover:border-emerald-500/40 cursor-pointer transition-colors">
                <p className="text-xs text-emerald-400 mb-1">Gerenciar Monitores</p>
                <p className="text-sm font-medium">Cadastrar, Promover e Remover</p>
                <p className="text-xs text-muted-foreground mt-1">5 monitores ativos</p>
              </div>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}