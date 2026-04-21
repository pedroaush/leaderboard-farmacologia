import { useState, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, XCircle, AlertCircle, Search } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

export default function ManualAttendance() {
  const { user, loading: authLoading } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [status, setStatus] = useState<"present" | "absent" | "justified">("present");
  const [reason, setReason] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedClass, setSelectedClass] = useState<number>(1);
  const [sessionToken, setSessionToken] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('sessionToken');
    if (token) setSessionToken(token);
  }, []);

  // Fetch students
  const { data: students, isLoading: studentsLoading } = trpc.attendanceReportsDetailed.getClassAttendanceSummary.useQuery(
    { classId: selectedClass, sessionToken: sessionToken || undefined },
    { enabled: true }
  );

  // Mutation for marking attendance
  const markAttendanceMutation = trpc.attendanceReportsDetailed.markAttendanceManually.useMutation({
    onSuccess: () => {
      toast.success(`Presença marcada como ${status === "present" ? "presente" : status === "absent" ? "ausente" : "justificada"}`);
      setSelectedStudent(null);
      setStatus("present");
      setReason("");
      setDate(new Date().toISOString().split("T")[0]);
    },
    onError: (error) => {
      toast.error(`Erro ao marcar presença: ${error.message}`);
    },
  });

  const filteredStudents = students?.attendanceData.filter((s: any) =>
    s.studentName.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const handleMarkAttendance = () => {
    if (!selectedStudent) {
      toast.error("Selecione um aluno");
      return;
    }

    markAttendanceMutation.mutate({
      memberId: selectedStudent.memberId,
      classId: selectedClass,
      qrCodeSessionId: 0, // Placeholder
      isValid: status !== "absent",
      reason: reason || undefined,
      sessionToken: sessionToken || undefined,
    });
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
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8"
        >
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-2">
            Marcar Presença Manual
          </h1>
          <p className="text-muted-foreground">
            Registre presença ou falta para alunos que não conseguiram usar o QR code
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Students List */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="lg:col-span-1"
          >
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Alunos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar aluno..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  <div className="max-h-[500px] overflow-y-auto space-y-2">
                    {studentsLoading ? (
                      <p className="text-sm text-muted-foreground">Carregando...</p>
                    ) : filteredStudents.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhum aluno encontrado</p>
                    ) : (
                      filteredStudents.map((student: any) => (
                        <motion.button
                          key={student.memberId}
                          onClick={() => setSelectedStudent(student)}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className={`w-full text-left p-3 rounded-lg border transition-all ${
                            selectedStudent?.memberId === student.memberId
                              ? "border-primary bg-primary/10"
                              : "border-border hover:border-primary/50"
                          }`}
                        >
                          <div className="font-medium text-sm">{student.studentName}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {student.attendanceRate}% presença
                          </div>
                        </motion.button>
                      ))
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Form */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="lg:col-span-2"
          >
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  {selectedStudent ? `Marcar Presença: ${selectedStudent.studentName}` : "Selecione um Aluno"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedStudent ? (
                  <div className="space-y-6">
                    {/* Student Info */}
                    <div className="p-4 bg-secondary/50 rounded-lg">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Email</p>
                          <p className="font-medium">{selectedStudent.studentEmail}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Taxa Atual</p>
                          <p className="font-medium">{selectedStudent.attendanceRate}%</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Dias Presentes</p>
                          <p className="font-medium">{selectedStudent.presentDays}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Total de Dias</p>
                          <p className="font-medium">{selectedStudent.totalDays}</p>
                        </div>
                      </div>
                    </div>

                    {/* Date */}
                    <div>
                      <label className="text-sm font-medium mb-2 block">Data</label>
                      <Input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                      />
                    </div>

                    {/* Status */}
                    <div>
                      <label className="text-sm font-medium mb-2 block">Status</label>
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { value: "present", label: "Presente", icon: CheckCircle2, color: "text-green-600" },
                          { value: "absent", label: "Ausente", icon: XCircle, color: "text-red-600" },
                          { value: "justified", label: "Justificada", icon: AlertCircle, color: "text-yellow-600" },
                        ].map(({ value, label, icon: Icon, color }) => (
                          <motion.button
                            key={value}
                            onClick={() => setStatus(value as any)}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className={`p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${
                              status === value
                                ? "border-primary bg-primary/10"
                                : "border-border hover:border-primary/50"
                            }`}
                          >
                            <Icon className={`w-5 h-5 ${color}`} />
                            <span className="text-xs font-medium">{label}</span>
                          </motion.button>
                        ))}
                      </div>
                    </div>

                    {/* Reason */}
                    {(status === "absent" || status === "justified") && (
                      <div>
                        <label className="text-sm font-medium mb-2 block">
                          Motivo {status === "justified" ? "(Justificativa)" : ""}
                        </label>
                        <Textarea
                          placeholder={
                            status === "justified"
                              ? "Descreva o motivo da justificativa..."
                              : "Descreva o motivo da ausência..."
                          }
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          rows={4}
                        />
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                      <Button
                        onClick={handleMarkAttendance}
                        disabled={markAttendanceMutation.isPending}
                        className="flex-1"
                      >
                        {markAttendanceMutation.isPending ? "Salvando..." : "Marcar Presença"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSelectedStudent(null);
                          setStatus("present");
                          setReason("");
                        }}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <p>Selecione um aluno na lista para começar</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
