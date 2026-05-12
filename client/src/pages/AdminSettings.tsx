/**
 * Admin Settings - Configurações Gerais do Sistema
 * Gerencia: Configurações Gerais, Backup/Restore, Segurança, Notificações, Relatórios
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Settings, Save, Download, Upload, Shield, Bell, BarChart3,
  AlertCircle, CheckCircle, Loader, ArrowLeft, Trash2, RefreshCw,
  Database, Clock, FileJson, HardDrive
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useLocation } from "wouter";

const DARK_BG = "#0A1628";
const CARD_BG = "#0D1B2A";
const ORANGE = "#F7941D";

type SettingsTab = "general" | "backup" | "security" | "notifications" | "reports";

export default function AdminSettings() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const [loading, setLoading] = useState(false);

  // Rotas tRPC
  const { data: settings, isLoading: loadingSettings } = trpc.settings.getSettings.useQuery();
  const updateSettingsMutation = trpc.settings.updateSettings.useMutation();
  const createBackupMutation = trpc.settings.createBackup.useMutation();
  const { data: backupHistory, refetch: refetchBackups } = trpc.settings.getBackupHistory.useQuery();
  const { data: restoreHistory } = trpc.settings.getRestoreHistory.useQuery();
  const restoreFromBackupMutation = trpc.settings.restoreFromBackup.useMutation();
  const deleteBackupMutation = trpc.settings.deleteBackup.useMutation();
  const changePasswordMutation = trpc.settings.changeAdminPassword.useMutation();
  const { data: notificationSettings } = trpc.settings.getNotificationSettings.useQuery();
  const updateNotificationsMutation = trpc.settings.updateNotificationSettings.useMutation();
  const generateReportMutation = trpc.settings.generateReport.useMutation();

  // Configurações Gerais
  const [courseName, setCourseName] = useState("Farmacologia I");
  const [semester, setSemester] = useState("2026.1");
  const [institution, setInstitution] = useState("UNIRIO");
  const [department, setDepartment] = useState("Farmacologia");

  // Backup/Restore
  const [backupNotes, setBackupNotes] = useState("");
  const [backupProgress, setBackupProgress] = useState(0);
  const [restoringId, setRestoringId] = useState<number | null>(null);

  // Segurança
  const [adminPassword, setAdminPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Notificações
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [slackNotifications, setSlackNotifications] = useState(false);
  const [notificationEmail, setNotificationEmail] = useState("admin@unirio.br");

  // Relatórios
  const [reportFormat, setReportFormat] = useState<"pdf" | "csv" | "xlsx">("pdf");
  const [reportType, setReportType] = useState<"performance" | "attendance" | "grades">("performance");

  const handleSaveGeneralSettings = async () => {
    setLoading(true);
    try {
      await updateSettingsMutation.mutateAsync({
        courseName,
        semester,
        institution,
        department,
      });
      toast.success("Configurações gerais salvas com sucesso!");
    } catch (error) {
      toast.error("Erro ao salvar configurações");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBackup = async () => {
    setLoading(true);
    setBackupProgress(10);
    try {
      const interval = setInterval(() => {
        setBackupProgress(prev => Math.min(prev + Math.random() * 15, 85));
      }, 800);
      const result = await createBackupMutation.mutateAsync({ notes: backupNotes || undefined });
      clearInterval(interval);
      setBackupProgress(100);
      toast.success(result.message || "Backup criado com sucesso!");
      setTimeout(() => setBackupProgress(0), 1500);
      refetchBackups();
    } catch (error: any) {
      setBackupProgress(0);
      toast.error(error?.message || "Erro ao criar backup");
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreBackup = async (backup: any) => {
    if (!backup.fileKey) {
      toast.error("Este backup não possui arquivo para restaurar");
      return;
    }
    if (!confirm(`Restaurar backup de ${new Date(backup.createdAt).toLocaleString('pt-BR')}?\n\nATENÇÃO: Isso irá sobrescrever dados existentes!`)) return;
    setRestoringId(backup.id);
    try {
      const result = await restoreFromBackupMutation.mutateAsync({
        backupId: backup.id,
        fileKey: backup.fileKey,
      });
      toast.success(result.message || "Restauração concluída!");
    } catch (error: any) {
      toast.error(error?.message || "Erro na restauração");
    } finally {
      setRestoringId(null);
    }
  };

  const handleDeleteBackup = async (backupId: number) => {
    if (!confirm("Deletar este backup permanentemente?")) return;
    try {
      await deleteBackupMutation.mutateAsync({ backupId });
      toast.success("Backup deletado");
      refetchBackups();
    } catch (error) {
      toast.error("Erro ao deletar backup");
    }
  };

  const formatFileSize = (bytes?: number | null) => {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleUpdateSecurity = async () => {
    if (adminPassword !== confirmPassword) {
      toast.error("As senhas não correspondem");
      return;
    }

    setLoading(true);
    try {
      await changePasswordMutation.mutateAsync({
        currentPassword: "",
        newPassword: adminPassword,
      });
      toast.success("Configurações de segurança atualizadas!");
      setAdminPassword("");
      setConfirmPassword("");
    } catch (error) {
      toast.error("Erro ao atualizar segurança");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNotifications = async () => {
    setLoading(true);
    try {
      await updateNotificationsMutation.mutateAsync({
        emailNotifications,
        slackNotifications,
        notifyOnNewStudents: true,
        notifyOnMissingSubmissions: true,
        notifyOnLowPerformance: true,
      });
      toast.success("Configurações de notificações salvas!");
    } catch (error) {
      toast.error("Erro ao salvar notificações");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    setLoading(true);
    try {
      const result = await generateReportMutation.mutateAsync({
        reportType: reportType as any,
        format: reportFormat,
      });
      toast.success(result.message);
      window.open(result.reportUrl, "_blank");
    } catch (error) {
      toast.error("Erro ao gerar relatório");
    } finally {
      setLoading(false);
    }
  };



  return (
    <div className="min-h-screen" style={{ backgroundColor: DARK_BG }}>
      {/* Header */}
      <div className="border-b border-gray-700 p-6" style={{ backgroundColor: CARD_BG }}>
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/admin")}
            className="p-2 hover:bg-gray-700 rounded-lg transition"
          >
            <ArrowLeft size={20} className="text-gray-400" />
          </button>
          <div className="flex items-center gap-3">
            <Settings size={28} className="text-orange-500" />
            <h1 className="text-2xl font-bold text-white">Configurações do Sistema</h1>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-700 flex overflow-x-auto" style={{ backgroundColor: CARD_BG }}>
        {[
          { id: "general" as const, label: "Gerais", icon: Settings },
          { id: "backup" as const, label: "Backup", icon: Download },
          { id: "security" as const, label: "Segurança", icon: Shield },
          { id: "notifications" as const, label: "Notificações", icon: Bell },
          { id: "reports" as const, label: "Relatórios", icon: BarChart3 },
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-4 border-b-2 transition whitespace-nowrap ${
                activeTab === tab.id
                  ? "border-orange-500 text-orange-500"
                  : "border-transparent text-gray-400 hover:text-gray-300"
              }`}
            >
              <Icon size={18} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="p-6 max-w-4xl">
        {/* Configurações Gerais */}
        {activeTab === "general" && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Settings size={24} className="text-orange-500" />
              Configurações Gerais
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Nome da Disciplina
                </label>
                <input
                  type="text"
                  value={courseName}
                  onChange={(e) => setCourseName(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-gray-800 text-white border border-gray-700 focus:border-orange-500 outline-none"
                  placeholder="Ex: Farmacologia I"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Semestre
                </label>
                <input
                  type="text"
                  value={semester}
                  onChange={(e) => setSemester(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-gray-800 text-white border border-gray-700 focus:border-orange-500 outline-none"
                  placeholder="Ex: 2026.1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Instituição
                </label>
                <input
                  type="text"
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-gray-800 text-white border border-gray-700 focus:border-orange-500 outline-none"
                  placeholder="Ex: UNIRIO"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Departamento
                </label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-gray-800 text-white border border-gray-700 focus:border-orange-500 outline-none"
                  placeholder="Ex: Farmacologia"
                />
              </div>
            </div>

            <Button
              onClick={handleSaveGeneralSettings}
              disabled={loading}
              className="bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2 px-6 rounded-lg flex items-center gap-2"
            >
              {loading ? <Loader size={18} className="animate-spin" /> : <Save size={18} />}
              Salvar Configurações
            </Button>
          </div>
        )}

        {/* Backup/Restore */}
        {activeTab === "backup" && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Database size={24} className="text-orange-500" />
              Backup e Restauração
            </h2>

            {/* Criar novo backup */}
            <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-5 space-y-4">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <Download size={18} className="text-green-400" />
                Criar Novo Backup
              </h3>
              <p className="text-gray-400 text-sm">
                Exporta todos os dados críticos (turmas, alunos, equipes, Jigsaw, cronograma, jogo, avaliações, frequência) para um arquivo JSON seguro armazenado na nuvem.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Observações (opcional)</label>
                <input
                  type="text"
                  value={backupNotes}
                  onChange={(e) => setBackupNotes(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-gray-900 text-white border border-gray-600 focus:border-orange-500 outline-none"
                  placeholder="Ex: Antes da atualização do semestre"
                />
              </div>
              {backupProgress > 0 && (
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-300">{backupProgress < 100 ? "Exportando dados..." : "Backup concluído!"}</span>
                    <span className="text-orange-400 font-mono">{Math.round(backupProgress)}%</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div className="bg-orange-500 h-2 rounded-full transition-all duration-500" style={{ width: `${backupProgress}%` }} />
                  </div>
                </div>
              )}
              <Button
                onClick={handleCreateBackup}
                disabled={loading}
                className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-6 rounded-lg flex items-center gap-2"
              >
                {loading ? <Loader size={18} className="animate-spin" /> : <Download size={18} />}
                {loading ? "Criando backup..." : "Criar Backup Completo"}
              </Button>
            </div>

            {/* Histórico de backups */}
            <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-white font-semibold flex items-center gap-2">
                  <Clock size={18} className="text-blue-400" />
                  Histórico de Backups
                </h3>
                <button onClick={() => refetchBackups()} className="text-gray-400 hover:text-white transition">
                  <RefreshCw size={16} />
                </button>
              </div>

              {!backupHistory || backupHistory.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <FileJson size={40} className="mx-auto mb-3 opacity-40" />
                  <p>Nenhum backup encontrado.</p>
                  <p className="text-sm mt-1">Crie o primeiro backup acima.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {(backupHistory as any[]).map((backup) => (
                    <div key={backup.id} className="flex items-center gap-3 p-3 bg-gray-900/60 rounded-lg border border-gray-700">
                      <div className="flex-shrink-0">
                        {backup.status === 'completed' ? (
                          <CheckCircle size={20} className="text-green-400" />
                        ) : backup.status === 'failed' ? (
                          <AlertCircle size={20} className="text-red-400" />
                        ) : (
                          <Loader size={20} className="text-yellow-400 animate-spin" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-white text-sm font-medium truncate">{backup.backupName}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            backup.status === 'completed' ? 'bg-green-900/50 text-green-400' :
                            backup.status === 'failed' ? 'bg-red-900/50 text-red-400' :
                            'bg-yellow-900/50 text-yellow-400'
                          }`}>{backup.status}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                          <span className="flex items-center gap-1">
                            <Clock size={11} />
                            {new Date(backup.createdAt).toLocaleString('pt-BR')}
                          </span>
                          <span className="flex items-center gap-1">
                            <HardDrive size={11} />
                            {formatFileSize(backup.fileSize)}
                          </span>
                          {backup.totalRecords > 0 && (
                            <span className="flex items-center gap-1">
                              <Database size={11} />
                              {backup.totalRecords.toLocaleString()} registros
                            </span>
                          )}
                        </div>
                        {backup.notes && <p className="text-xs text-gray-500 mt-1 truncate">{backup.notes}</p>}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {backup.fileUrl && (
                          <a
                            href={backup.fileUrl}
                            download
                            className="p-1.5 rounded-lg bg-blue-900/40 text-blue-400 hover:bg-blue-900/70 transition"
                            title="Baixar backup"
                          >
                            <Download size={15} />
                          </a>
                        )}
                        {backup.fileKey && backup.status === 'completed' && (
                          <button
                            onClick={() => handleRestoreBackup(backup)}
                            disabled={restoringId === backup.id}
                            className="p-1.5 rounded-lg bg-orange-900/40 text-orange-400 hover:bg-orange-900/70 transition disabled:opacity-50"
                            title="Restaurar este backup"
                          >
                            {restoringId === backup.id ? <Loader size={15} className="animate-spin" /> : <Upload size={15} />}
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteBackup(backup.id)}
                          className="p-1.5 rounded-lg bg-red-900/40 text-red-400 hover:bg-red-900/70 transition"
                          title="Deletar backup"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4 flex gap-3">
              <AlertCircle size={20} className="text-yellow-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-yellow-300 font-semibold">Aviso Importante</p>
                <p className="text-yellow-200 text-sm mt-1">
                  A restauração sobrescreve dados existentes usando <code className="bg-yellow-900/40 px-1 rounded">INSERT ... ON DUPLICATE KEY UPDATE</code>. Dados criados após o backup não serão afetados se tiverem IDs diferentes.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Segurança */}
        {activeTab === "security" && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Shield size={24} className="text-orange-500" />
              Configurações de Segurança
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Nova Senha do Admin
                </label>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-gray-800 text-white border border-gray-700 focus:border-orange-500 outline-none"
                  placeholder="Digite a nova senha"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Confirmar Senha
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-gray-800 text-white border border-gray-700 focus:border-orange-500 outline-none"
                  placeholder="Confirme a senha"
                />
              </div>

              <Button
                onClick={handleUpdateSecurity}
                disabled={loading || !adminPassword}
                className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-6 rounded-lg flex items-center gap-2"
              >
                {loading ? <Loader size={18} className="animate-spin" /> : <Shield size={18} />}
                Atualizar Senha
              </Button>
            </div>

            <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4 flex gap-3">
              <CheckCircle size={20} className="text-blue-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-blue-300 font-semibold">Segurança Ativa</p>
                <p className="text-blue-200 text-sm mt-1">
                  Autenticação OAuth Manus + Rate Limiting + Helmet.js + CORS restritivo
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Notificações */}
        {activeTab === "notifications" && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Bell size={24} className="text-orange-500" />
              Configurações de Notificações
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Email para Notificações
                </label>
                <input
                  type="email"
                  value={notificationEmail}
                  onChange={(e) => setNotificationEmail(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-gray-800 text-white border border-gray-700 focus:border-orange-500 outline-none"
                  placeholder="admin@unirio.br"
                />
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={emailNotifications}
                    onChange={(e) => setEmailNotifications(e.target.checked)}
                    className="w-4 h-4 rounded bg-gray-700 border-gray-600 cursor-pointer"
                  />
                  <span className="text-gray-300">Notificações por Email</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={slackNotifications}
                    onChange={(e) => setSlackNotifications(e.target.checked)}
                    className="w-4 h-4 rounded bg-gray-700 border-gray-600 cursor-pointer"
                  />
                  <span className="text-gray-300">Notificações no Slack</span>
                </label>
              </div>

              <Button
                onClick={handleSaveNotifications}
                disabled={loading}
                className="bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2 px-6 rounded-lg flex items-center gap-2"
              >
                {loading ? <Loader size={18} className="animate-spin" /> : <Save size={18} />}
                Salvar Notificações
              </Button>
            </div>
          </div>
        )}

        {/* Relatórios */}
        {activeTab === "reports" && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <BarChart3 size={24} className="text-orange-500" />
              Geração de Relatórios
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Tipo de Relatório
                </label>
                <select
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value as any)}
                  className="w-full px-4 py-2 rounded-lg bg-gray-800 text-white border border-gray-700 focus:border-orange-500 outline-none"
                >
                  <option value="performance">Desempenho dos Alunos</option>
                  <option value="attendance">Frequência</option>
                  <option value="grades">Notas e Conceitos</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Formato de Exportação
                </label>
                <select
                  value={reportFormat}
                  onChange={(e) => setReportFormat(e.target.value as any)}
                  className="w-full px-4 py-2 rounded-lg bg-gray-800 text-white border border-gray-700 focus:border-orange-500 outline-none"
                >
                  <option value="pdf">PDF</option>
                  <option value="csv">CSV</option>
                  <option value="xlsx">Excel (XLSX)</option>
                </select>
              </div>

              <Button
                onClick={handleGenerateReport}
                disabled={loading}
                className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-6 rounded-lg flex items-center gap-2"
              >
                {loading ? <Loader size={18} className="animate-spin" /> : <BarChart3 size={18} />}
                Gerar Relatório
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
