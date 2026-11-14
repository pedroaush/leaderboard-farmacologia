import { motion } from "framer-motion";
import { Bell, AlertTriangle, Info, Clock, ArrowLeft, FlaskConical, Youtube } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";

const LOGO_URL = "/logos/bQaermuTleJBguWb.png";
const YOUTUBE_URL = "https://www.youtube.com/@Conex%C3%A3oemCi%C3%AAncia-Farmacol%C3%B3gica";

function PriorityIcon({ priority }: { priority: string }) {
  if (priority === "urgent") return <AlertTriangle size={20} className="text-red-400" />;
  if (priority === "important") return <Bell size={20} className="text-amber-400" />;
  return <Info size={20} className="text-primary" />;
}

function PriorityBadge({ priority }: { priority: string }) {
  const styles: Record<string, string> = {
    urgent: "bg-red-500/20 text-red-400 border-red-500/30",
    important: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    normal: "bg-primary/20 text-primary border-primary/30",
  };
  const labels: Record<string, string> = {
    urgent: "Urgente",
    important: "Importante",
    normal: "Normal",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${styles[priority] || styles.normal}`}>
      {labels[priority] || "Normal"}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  const labels: Record<string, string> = {
    banner: "Banner",
    announcement: "Comunicado",
    reminder: "Lembrete",
  };
  return (
    <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-medium">
      {labels[type] || type}
    </span>
  );
}

export default function Avisos() {
  const { data: notifications, isLoading } = trpc.notifications.getActive.useQuery();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
          <Bell size={40} className="text-primary mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground font-display">Carregando avisos...</p>
        </motion.div>
      </div>
    );
  }

  const banners = notifications?.filter(n => n.type === "banner") ?? [];
  const announcements = notifications?.filter(n => n.type === "announcement") ?? [];
  const reminders = notifications?.filter(n => n.type === "reminder") ?? [];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
        <div className="container py-6">
          <div className="flex items-center gap-3 mb-4">
            <Link href="/leaderboard">
              <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft size={16} />
                Voltar ao Ranking
              </button>
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <img src={LOGO_URL} alt="Logo" className="w-10 h-10 rounded-full object-contain" />
            <div>
              <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-foreground">
                Mural de <span className="text-gradient-emerald">Avisos</span>
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Comunicados e lembretes de Farmacologia I — Conexão em Farmacologia
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-8">
        {(!notifications || notifications.length === 0) ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16"
          >
            <Bell size={48} className="text-muted-foreground/30 mx-auto mb-4" />
            <h2 className="font-display font-bold text-lg text-foreground mb-2">Nenhum aviso no momento</h2>
            <p className="text-sm text-muted-foreground">Quando o professor publicar novos avisos, eles aparecerão aqui.</p>
          </motion.div>
        ) : (
          <div className="space-y-8">
            {/* Urgent Banners */}
            {banners.length > 0 && (
              <div>
                <h2 className="font-display font-bold text-lg text-foreground mb-4 flex items-center gap-2">
                  <AlertTriangle size={20} className="text-red-400" />
                  Banners Ativos
                </h2>
                <div className="grid gap-3">
                  {banners.map((notif, idx) => (
                    <motion.div
                      key={notif.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className={`border rounded-lg p-5 ${
                        notif.priority === "urgent"
                          ? "border-red-500/30 bg-red-500/5"
                          : notif.priority === "important"
                          ? "border-amber-500/30 bg-amber-500/5"
                          : "border-primary/30 bg-primary/5"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <PriorityIcon priority={notif.priority} />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <h3 className="font-display font-bold text-foreground">{notif.title}</h3>
                            <PriorityBadge priority={notif.priority} />
                            <TypeBadge type={notif.type} />
                          </div>
                          {notif.content && <p className="text-sm text-muted-foreground mt-2">{notif.content}</p>}
                          <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                            <Clock size={12} />
                            <span>{new Date(notif.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                            {notif.expiresAt && (
                              <span className="text-amber-400">• Expira em {new Date(notif.expiresAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Announcements */}
            {announcements.length > 0 && (
              <div>
                <h2 className="font-display font-bold text-lg text-foreground mb-4 flex items-center gap-2">
                  <Bell size={20} className="text-primary" />
                  Comunicados
                </h2>
                <div className="grid gap-3">
                  {announcements.map((notif, idx) => (
                    <motion.div
                      key={notif.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className="border border-border rounded-lg p-5"
                      style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}
                    >
                      <div className="flex items-start gap-3">
                        <PriorityIcon priority={notif.priority} />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <h3 className="font-display font-bold text-foreground">{notif.title}</h3>
                            <PriorityBadge priority={notif.priority} />
                          </div>
                          {notif.content && <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{notif.content}</p>}
                          <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                            <Clock size={12} />
                            <span>{new Date(notif.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Reminders */}
            {reminders.length > 0 && (
              <div>
                <h2 className="font-display font-bold text-lg text-foreground mb-4 flex items-center gap-2">
                  <Clock size={20} className="text-amber-400" />
                  Lembretes
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {reminders.map((notif, idx) => (
                    <motion.div
                      key={notif.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.1 }}
                      className="border border-border rounded-lg p-4"
                      style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Clock size={16} className="text-amber-400" />
                        <h3 className="font-display font-semibold text-sm text-foreground">{notif.title}</h3>
                      </div>
                      {notif.content && <p className="text-xs text-muted-foreground">{notif.content}</p>}
                      {notif.expiresAt && (
                        <p className="text-xs text-amber-400 mt-2">
                          Até {new Date(notif.expiresAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })}
                        </p>
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-border py-6 mt-8">
        <div className="container text-center">
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link href="/leaderboard">
              <span className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 transition-colors cursor-pointer"><FlaskConical size={10} /> Ranking PF</span>
            </Link>
            <a href={YOUTUBE_URL} target="_blank" rel="noopener noreferrer" className="text-xs text-red-400/60 hover:text-red-400 flex items-center gap-1 transition-colors"><Youtube size={10} /> Conexão em Ciência</a>
          </div>
          <p className="text-[11px] text-muted-foreground/60 mt-1">Conexão em Farmacologia • Mural de Avisos</p>
        </div>
      </footer>
    </div>
  );
}
