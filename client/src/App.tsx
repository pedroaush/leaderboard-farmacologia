import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AudioProvider } from "./contexts/AudioContext";
import Landing from "./pages/Landing";
import Home from "./pages/Home";
import Admin from "./pages/Admin";
import StudentProgress from "./pages/StudentProgress";
import Avisos from "./pages/Avisos";
import StudentNotifications from "./pages/StudentNotifications";
import NotificationPreferences from "./pages/NotificationPreferences";
import Materiais from "./pages/Materiais";
import Conquistas from "./pages/Conquistas";
import StudentLogin from "./pages/StudentLogin";
import Presenca from "./pages/Presenca";
import Dashboard from "./pages/Dashboard";
import TeacherLogin from "./pages/TeacherLogin";
import TeacherRegister from "./pages/TeacherRegister";
import TeacherForgotPassword from "./pages/TeacherForgotPassword";
import TeacherResetPassword from "./pages/TeacherResetPassword";
import SuperAdminSetup from "./pages/SuperAdminSetup";
import SuperAdminProfile from "./pages/SuperAdminProfile";
import TeacherProfile from "./pages/TeacherProfile";
import ProfessorLogin from "./pages/ProfessorLogin";
import Game from "@/pages/Game";
import GameMain from "@/pages/GameMain";
import ProfessorSignup from "./pages/ProfessorSignup";
import SuperAdminLogin from "./pages/SuperAdminLogin";
import PerformanceReport from "./pages/PerformanceReport";
import AdminDashboard from "./pages/AdminDashboard";
import GruposJigsaw from "./pages/GruposJigsaw";
import AdminSettings from "./pages/AdminSettings";
import AdminReports from "./pages/AdminReports";
import Cronograma from "./pages/Cronograma";
import LoungePlaylist from "./components/LoungePlaylist";
import QuestionsManager from "./pages/QuestionsManager";
import ResultsDashboard from "./pages/ResultsDashboard";
import GamePortal from "./pages/GamePortal";
import AdminStudentView from "./pages/AdminStudentView";
import TeacherDashboard from "./pages/TeacherDashboard";
import StudentArea from "./pages/StudentArea";
import AttendanceCheckIn from "./pages/AttendanceCheckIn";
import AdminAttendance from "./pages/AdminAttendance";
import AttendanceDashboard from "./pages/AttendanceDashboard";
import GameAvatarSelect from "@/pages/GameAvatarSelect";
import StudentProgressDashboard from "@/pages/StudentProgressDashboard";
import GameHub from "./pages/GameHub";
import GameMission from "./pages/GameMission";
import GameHintsShop from "./pages/GameHintsShop";
import AdminGamePanel from "./pages/AdminGamePanel";
import GameAchievements from "./pages/GameAchievements";
import QRCodeProjector from "./pages/QRCodeProjector";
import StudentActivities from "./pages/StudentActivities";
import ChatLive from "./pages/ChatLive";
import StudentStats from "./pages/StudentStats";
import TeacherFeedback from "./pages/TeacherFeedback";
import AttendanceReports from "./pages/AttendanceReports";
import ManualAttendance from "./pages/ManualAttendance";
import AttendanceAlerts from "./pages/AttendanceAlerts";
import MonitorPortal from "./pages/MonitorPortal";
import MonitorGrades from "./pages/MonitorGrades";
import MonitorCertificate from "./pages/MonitorCertificate";
import ExamTools from "./pages/ExamTools";
import ProfessorGrades from "./pages/ProfessorGrades";
import AdminMonitors from "./pages/AdminMonitors";


function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={Landing} />
      <Route path={"/leaderboard"} component={Home} />
      <Route path={"/admin"} component={AdminDashboard} />
      <Route path={"/admin/configuracoes"} component={AdminSettings} />
      <Route path={"/admin/relatorios"} component={AdminReports} />
      <Route path={"/admin/alunos/:classId"} component={AdminStudentView} />
      <Route path={"/admin/attendance"} component={AdminAttendance} />
      <Route path={"/admin/attendance/dashboard"} component={AttendanceDashboard} />
      <Route path={"/attendance/check-in"} component={AttendanceCheckIn} />
      <Route path={"/professor/qrcode"} component={QRCodeProjector} />
      <Route path={"/professor/dashboard"} component={TeacherDashboard} />
      <Route path={"/admin/professor"} component={Admin} />
      <Route path={"/professor/questoes"} component={QuestionsManager} />
      <Route path={"/professor/resultados"} component={ResultsDashboard} />
      <Route path={"/jogo/:classId"} component={GamePortal} />
      <Route path={"/game/avatar-select"} component={GameAvatarSelect} />
      <Route path="/game/hub" component={GameHub} />
      <Route path="/game/map" component={Game} />
      <Route path="/game/main" component={GameMain} />
      <Route path={"/game/mission/:id"} component={GameMission} />
      <Route path="/game/hints" component={GameHintsShop} />
      <Route path="/admin/jogo" component={AdminGamePanel} />
      <Route path="/game/progress" component={StudentProgressDashboard} />
      <Route path="/jogo/conquistas" component={GameAchievements} />
      <Route path={"/aluno/:classId"} component={StudentArea} />
      <Route path={"/meu-progresso"} component={StudentProgress} />      <Route path={"/avisos"} component={StudentNotifications} />
      <Route path={"/avisos-legado"} component={Avisos} />
      <Route path={"/avisos/preferencias"} component={NotificationPreferences} />      <Route path={"/materiais"} component={Materiais} />
      <Route path={"/conquistas"} component={Conquistas} />
      <Route path={"/login-aluno"} component={StudentLogin} />
      <Route path={"/presenca"} component={Presenca} />
      <Route path={"/dashboard"} component={Dashboard} />
      <Route path={"/performance"} component={PerformanceReport} />
      <Route path={"/grupos-jigsaw"} component={GruposJigsaw} />
      <Route path={"/cronograma"} component={Cronograma} />
      <Route path={"/atividades"} component={StudentActivities} />
      <Route path={"/chat"} component={ChatLive} />
      <Route path={"/estatisticas"} component={StudentStats} />
      <Route path={"/professor/avaliar-atividades"} component={TeacherFeedback} />
      <Route path={"/professor/relatorios-presenca"} component={AttendanceReports} />
      <Route path={"/professor/presenca-manual"} component={ManualAttendance} />
      <Route path={"/professor/alertas-presenca"} component={AttendanceAlerts} />
      <Route path={"/admin/monitores"} component={AdminMonitors} />
      <Route path={"/monitor"} component={MonitorPortal} />
      <Route path={"/monitor/notas"} component={MonitorGrades} />
      <Route path={"/monitor/certificado"} component={MonitorCertificate} />
      <Route path={"/professor/ferramentas-prova"} component={ExamTools} />
      <Route path={"/professor/notas"} component={ProfessorGrades} />

      <Route path={"/professor/perfil"} component={TeacherProfile} />      <Route path={"/professor/login"} component={ProfessorLogin} />
      <Route path={"/professor/signup"} component={ProfessorSignup} />
      <Route path={"/professor/cadastro"} component={TeacherRegister} />
      <Route path={"/professor/esqueci-senha"} component={TeacherForgotPassword} />
      <Route path={"/professor/redefinir-senha"} component={TeacherResetPassword} />
      <Route path={"/super-admin/login"} component={SuperAdminLogin} />
      <Route path={"/super-admin/setup"} component={SuperAdminSetup} />
      <Route path={"/super-admin/perfil"} component={SuperAdminProfile} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <AudioProvider>
          <TooltipProvider>
            <Toaster />
            <LoungePlaylist />
            <Router />
          </TooltipProvider>
        </AudioProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
