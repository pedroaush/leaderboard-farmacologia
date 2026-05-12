import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { QrCode, Copy, Download, RefreshCw, AlertCircle, CheckCircle, XCircle, Clock } from "lucide-react";
import { motion } from "framer-motion";

// Turmas do semestre 2026.1
const TURMAS = [
  { id: 26, name: "Medicina I (SCF0051)" },
  { id: 27, name: "Medicina II (SCF0051)" },
  { id: 28, name: "Biomedicina (CFF0026)" },
  { id: 29, name: "Biomedicina II (SCF0063)" },
  { id: 30, name: "Enfermagem (SCF0057)" },
  { id: 31, name: "Nutrição Integral (SCF0062)" },
  { id: 32, name: "Nutrição Noturno (SCF0019)" },
];

export default function AttendanceQRCodeManager() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedClassId, setSelectedClassId] = useState<number>(26);
  const [qrCode, setQrCode] = useState<{
    token: string;
    qrImageUrl: string;
    expiresAt: Date;
  } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [reviewingId, setReviewingId] = useState<number | null>(null);

  // Solicitações manuais pendentes
  const { data: manualRequests, refetch: refetchRequests } = trpc.qrcode.listManualRequests.useQuery(
    { classId: selectedClassId, status: "pending" },
    { refetchInterval: 15000 } // Atualiza a cada 15 segundos
  );

  const reviewMutation = trpc.qrcode.reviewManualRequest.useMutation({
    onSuccess: () => {
      setReviewingId(null);
      refetchRequests();
    },
  });

  // Pegar sessionToken do localStorage
  const sessionToken = localStorage.getItem("teacherSessionToken") || localStorage.getItem("sessionToken") || "";

  const generateQRMutation = trpc.attendance.generateQRCode.useMutation();

  const handleGenerateQRCode = async () => {
    setIsGenerating(true);
    try {
      const result = await generateQRMutation.mutateAsync({
        classId: selectedClassId,
        classDate: selectedDate,
        sessionToken,
      });

      setQrCode({
        token: result.token,
        qrImageUrl: result.qrImageUrl,
        expiresAt: result.expiresAt,
      });
    } catch (error: any) {
      console.error("Erro ao gerar QR code:", error);
      alert("❌ Erro ao gerar QR code: " + (error?.message || "Erro desconhecido"));
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = () => {
    if (qrCode) {
      navigator.clipboard.writeText(qrCode.token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const downloadQRCode = () => {
    if (qrCode) {
      const link = document.createElement("a");
      link.href = qrCode.qrImageUrl;
      link.download = `presenca-turma${selectedClassId}-${selectedDate}.png`;
      link.click();
    }
  };

  const isToday = selectedDate === new Date().toISOString().split("T")[0];
  const turmaSelecionada = TURMAS.find(t => t.id === selectedClassId);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Gerar QR Code de Presença</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Gere um QR code diário para que os alunos registrem presença na aula
        </p>
      </div>

      {/* Seletor de Turma e Data */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode size={18} />
            Configurar QR Code
          </CardTitle>
          <CardDescription>
            Selecione a turma e a data para gerar um QR code de presença
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Seletor de Turma */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Turma</label>
            <select
              value={selectedClassId}
              onChange={(e) => {
                setSelectedClassId(Number(e.target.value));
                setQrCode(null);
              }}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
            >
              {TURMAS.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* Seletor de Data */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Data da Aula</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
            />
            <div className="text-xs text-muted-foreground">
              {isToday && (
                <Badge variant="default" className="mt-2">
                  Hoje
                </Badge>
              )}
            </div>
          </div>

          <Button
            onClick={handleGenerateQRCode}
            disabled={isGenerating}
            className="w-full"
            size="lg"
          >
            {isGenerating ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Gerando...
              </>
            ) : (
              <>
                <QrCode size={16} className="mr-2" />
                Gerar QR Code para {turmaSelecionada?.name}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* QR Code Gerado */}
      {qrCode && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                ✅ QR Code Gerado com Sucesso
              </CardTitle>
              <CardDescription>
                Turma: {turmaSelecionada?.name} | Data: {selectedDate} | Expira em: {new Date(qrCode.expiresAt).toLocaleTimeString("pt-BR")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Imagem QR Code */}
              <div className="flex justify-center">
                <motion.img
                  src={qrCode.qrImageUrl}
                  alt="QR Code de Presença"
                  className="w-64 h-64 border-2 border-border rounded-lg p-2 bg-white"
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                />
              </div>

              {/* Token */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Token (para referência)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={qrCode.token}
                    readOnly
                    className="flex-1 px-3 py-2 border border-border rounded-md bg-muted text-xs font-mono"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyToClipboard}
                  >
                    {copied ? "✓ Copiado" : <Copy size={16} />}
                  </Button>
                </div>
              </div>

              {/* Botões de Ação */}
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  onClick={downloadQRCode}
                  className="w-full"
                >
                  <Download size={16} className="mr-2" />
                  Baixar Imagem
                </Button>
                <Button
                  variant="outline"
                  onClick={handleGenerateQRCode}
                  disabled={isGenerating}
                  className="w-full"
                >
                  <RefreshCw size={16} className="mr-2" />
                  Gerar Novo
                </Button>
              </div>

              {/* Instruções */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900">
                <strong>Como usar:</strong>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Exiba este QR code na sala de aula (projetor ou celular)</li>
                  <li>Os alunos escaneiam com seus celulares</li>
                  <li>A presença é registrada automaticamente</li>
                  <li>O QR code expira em 4 horas</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Solicitações Manuais Pendentes */}
      {manualRequests && manualRequests.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-orange-200 bg-orange-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-orange-800">
                <AlertCircle size={18} className="text-orange-500" />
                Solicitações de Confirmação Manual
                <Badge variant="destructive" className="ml-auto">{manualRequests.length}</Badge>
              </CardTitle>
              <CardDescription className="text-orange-700">
                Alunos com GPS indisponível aguardando confirmação de presença
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {manualRequests.map((req: any) => (
                <div key={req.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-orange-100 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center">
                      <Clock size={16} className="text-orange-500" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{req.memberName}</p>
                      <p className="text-xs text-gray-500">
                        {req.reason === "gps_failed" ? "GPS indisponível" : req.reason === "gps_out_of_range" ? "Fora do raio GPS" : "Outro motivo"}
                        {req.distanceMeters && ` • ${parseFloat(req.distanceMeters).toFixed(0)}m da sala`}
                        {" • "}{new Date(req.requestedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-green-300 text-green-700 hover:bg-green-50"
                      disabled={reviewingId === req.id}
                      onClick={() => {
                        setReviewingId(req.id);
                        reviewMutation.mutate({ requestId: req.id, action: "approve", reviewedByName: "Professor" });
                      }}
                    >
                      <CheckCircle size={14} className="mr-1" /> Aprovar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-red-300 text-red-700 hover:bg-red-50"
                      disabled={reviewingId === req.id}
                      onClick={() => {
                        setReviewingId(req.id);
                        reviewMutation.mutate({ requestId: req.id, action: "reject", reviewedByName: "Professor" });
                      }}
                    >
                      <XCircle size={14} className="mr-1" /> Rejeitar
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Estado Vazio */}
      {!qrCode && (
        <Card className="border-dashed">
          <CardContent className="pt-8 text-center">
            <QrCode size={32} className="mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">
              Selecione a turma e clique em "Gerar QR Code" para criar um novo código para a aula
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
