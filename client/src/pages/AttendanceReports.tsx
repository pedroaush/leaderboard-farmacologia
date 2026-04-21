import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Download, Search, Filter, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts";

export default function AttendanceReports() {
  const { user, loading: authLoading } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTeam, setSelectedTeam] = useState<string>("all");
  const [selectedClass, setSelectedClass] = useState<number>(1);
  const [sessionToken, setSessionToken] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('sessionToken');
    if (token) setSessionToken(token);
  }, []);

  // Fetch attendance summary
  const { data: attendanceSummary, isLoading: summaryLoading } = trpc.attendanceReportsDetailed.getClassAttendanceSummary.useQuery(
    { classId: selectedClass, sessionToken: sessionToken || undefined },
    { enabled: true }
  );

  // Fetch weekly trends
  const { data: weeklyTrends, isLoading: trendsLoading } = trpc.attendanceReportsDetailed.getWeeklyTrends.useQuery(
    { classId: selectedClass, sessionToken: sessionToken || undefined },
    { enabled: true }
  );

  // Filter and search
  const filteredStudents = useMemo(() => {
    if (!attendanceSummary?.attendanceData) return [];

    return attendanceSummary.attendanceData.filter((student: any) => {
      const matchesSearch =
        student.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.studentEmail.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesTeam =
        selectedTeam === "all" || student.studentName.includes(selectedTeam);

      return matchesSearch && matchesTeam;
    });
  }, [attendanceSummary?.attendanceData, searchTerm, selectedTeam]);

  // Prepare chart data
  const chartData = useMemo(() => {
    if (!weeklyTrends?.trends) return [];

    return Object.entries(weeklyTrends.trends).map(([week, data]: [string, any]) => ({
      week: `Semana ${week}`,
      presente: data.present,
      ausente: data.absent,
      total: data.total,
      taxa: data.total > 0 ? Math.round((data.present / data.total) * 100) : 0,
    }));
  }, [weeklyTrends]);

  const handleExportPDF = () => {
    // TODO: Implement PDF export
    alert("Exportação PDF em desenvolvimento");
  };

  const handleExportCSV = () => {
    if (!filteredStudents.length) return;

    const csv = [
      ["Nome", "Email", "Taxa de Presença", "Dias Presentes", "Total de Dias", "Status"],
      ...filteredStudents.map((s: any) => [
        s.studentName,
        s.studentEmail,
        `${s.attendanceRate}%`,
        s.presentDays,
        s.totalDays,
        s.isAtRisk ? "Em Risco" : s.isExcellent ? "Excelente" : "Normal",
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-presenca-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8"
        >
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-2">
            Relatório de Presença
          </h1>
          <p className="text-muted-foreground">
            Acompanhe a frequência dos alunos e identifique tendências
          </p>
        </motion.div>

        {/* Statistics Cards */}
        {attendanceSummary && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8"
          >
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Média de Presença
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-foreground">
                  {attendanceSummary.statistics.averageAttendance}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  da turma
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Em Risco
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-500">
                  {attendanceSummary.statistics.atRiskCount}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  alunos com &lt;75% presença
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Excelente
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-500">
                  {attendanceSummary.statistics.excellentCount}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  alunos com ≥90% presença
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Charts */}
        {chartData.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8"
          >
            <Card>
              <CardHeader>
                <CardTitle>Presença por Semana</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="week" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="presente" fill="#10b981" />
                    <Bar dataKey="ausente" fill="#ef4444" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Taxa de Presença Semanal</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="week" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip formatter={(value) => `${value}%`} />
                    <Line
                      type="monotone"
                      dataKey="taxa"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={{ fill: "#3b82f6", r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Filters and Search */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mb-6 flex flex-col sm:flex-row gap-4"
        >
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar aluno por nome ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              disabled={!filteredStudents.length}
            >
              <Download className="w-4 h-4 mr-2" />
              CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPDF}
              disabled={!filteredStudents.length}
            >
              <Download className="w-4 h-4 mr-2" />
              PDF
            </Button>
          </div>
        </motion.div>

        {/* Students Table */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Frequência dos Alunos</CardTitle>
            </CardHeader>
            <CardContent>
              {summaryLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Carregando dados...
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum aluno encontrado
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-4 font-semibold">Nome</th>
                        <th className="text-left py-3 px-4 font-semibold">Email</th>
                        <th className="text-center py-3 px-4 font-semibold">Presentes</th>
                        <th className="text-center py-3 px-4 font-semibold">Total</th>
                        <th className="text-center py-3 px-4 font-semibold">Taxa</th>
                        <th className="text-center py-3 px-4 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStudents.map((student: any, idx: number) => (
                        <motion.tr
                          key={student.memberId}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: idx * 0.05 }}
                          className="border-b border-border hover:bg-secondary/50 transition-colors"
                        >
                          <td className="py-3 px-4">{student.studentName}</td>
                          <td className="py-3 px-4 text-muted-foreground text-xs">
                            {student.studentEmail}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="font-semibold text-green-600">
                              {student.presentDays}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            {student.totalDays}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="font-semibold">
                              {student.attendanceRate}%
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            {student.isAtRisk ? (
                              <Badge variant="destructive" className="flex items-center gap-1 justify-center">
                                <AlertCircle className="w-3 h-3" />
                                Em Risco
                              </Badge>
                            ) : student.isExcellent ? (
                              <Badge variant="default" className="flex items-center gap-1 justify-center bg-green-600">
                                <CheckCircle2 className="w-3 h-3" />
                                Excelente
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="flex items-center gap-1 justify-center">
                                <Clock className="w-3 h-3" />
                                Normal
                              </Badge>
                            )}
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
