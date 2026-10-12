/**
 * Avisos (/avisos)
 *
 * Junta as duas fontes de aviso da plataforma:
 *  1. Mural do professor — avisos publicados no Painel Admin (notifications.getActive)
 *  2. Notificações individuais do aluno — equipe, nota, presença (studentNotifications)
 *
 * Antes, a página só lia (2) e com o id do login de professor (OAuth), que o
 * aluno não tem — por isso aparecia sempre "Nenhum aviso".
 */
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Bell, Check, CheckCheck, Megaphone, Search, Trash2, X } from "lucide-react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useStudentAuth } from "@/pages/StudentLogin";
import { toast } from "sonner";

const ORANGE = "#F7941D";
const CHAVE_LIDOS = "avisos_mural_lidos";

const TIPOS: Record<string, string> = {
  mural: "Mural do professor",
  team_allocation: "Equipe",
  grade_update: "Nota",
  announcement: "Anúncio",
  reminder: "Lembrete",
  attendance: "Presença",
};

type Item = {
  chave: string;
  origem: "mural" | "pessoal";
  id: number;
  titulo: string;
  texto: string;
  tipo: string;
  prioridade: "alta" | "normal" | "baixa";
  lido: boolean;
  data: Date;
  expira?: Date | null;
};

function lerLidos(): Set<number> {
  try { return new Set(JSON.parse(localStorage.getItem(CHAVE_LIDOS) || "[]")); } catch { return new Set(); }
}
function gravarLidos(s: Set<number>) {
  try { localStorage.setItem(CHAVE_LIDOS, JSON.stringify([...s])); } catch { /* sem armazenamento */ }
}

export default function StudentNotifications() {
  const { student } = useStudentAuth();
  const memberId = (student as any)?.memberId ?? 0;

  const [filtro, setFiltro] = useState<"todos" | "nao_lidos">("todos");
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState<string | null>(null);
  const [lidosMural, setLidosMural] = useState<Set<number>>(() => lerLidos());

  const mural = trpc.notifications.getActive.useQuery(undefined, { refetchInterval: 60000 });
  const pessoais = trpc.studentNotifications.getMyNotifications.useQuery({ memberId }, { enabled: memberId > 0 });

  const marcarLida = trpc.studentNotifications.markAsRead.useMutation({ onSuccess: () => pessoais.refetch() });
  const marcarTodas = trpc.studentNotifications.markAllAsRead.useMutation({ onSuccess: () => pessoais.refetch() });
  const remover = trpc.studentNotifications.dismiss.useMutation({
    onSuccess: () => { pessoais.refetch(); toast("Aviso removido", { duration: 1500 }); },
  });

  useEffect(() => gravarLidos(lidosMural), [lidosMural]);

  const itens: Item[] = useMemo(() => {
    const doMural: Item[] = ((mural.data as any[]) ?? []).map((n) => ({
      chave: `m${n.id}`,
      origem: "mural" as const,
      id: n.id,
      titulo: n.title,
      texto: n.content || "",
      tipo: "mural",
      prioridade: n.priority === "urgent" ? "alta" : n.priority === "important" ? "normal" : "baixa",
      lido: lidosMural.has(n.id),
      data: new Date(n.createdAt),
      expira: n.expiresAt ? new Date(n.expiresAt) : null,
    }));
    const meus: Item[] = ((pessoais.data as any[]) ?? [])
      .filter((n) => !n.isDismissed)
      .map((n) => ({
        chave: `p${n.id}`,
        origem: "pessoal" as const,
        id: n.id,
        titulo: n.title,
        texto: n.message || "",
        tipo: n.type,
        prioridade: n.priority === "high" ? "alta" : n.priority === "low" ? "baixa" : "normal",
        lido: !!n.isRead,
        data: new Date(n.createdAt),
      }));
    return [...doMural, ...meus].sort((a, b) => b.data.getTime() - a.data.getTime());
  }, [mural.data, pessoais.data, lidosMural]);

  const naoLidos = itens.filter((i) => !i.lido).length;
  const visiveis = itens.filter((i) =>
    (filtro === "todos" || !i.lido) &&
    (!tipo || i.tipo === tipo) &&
    (!busca || (i.titulo + " " + i.texto).toLowerCase().includes(busca.toLowerCase()))
  );

  function lerItem(i: Item) {
    if (i.origem === "mural") setLidosMural((s) => new Set(s).add(i.id));
    else marcarLida.mutate({ notificationId: i.id, memberId });
  }
  function lerTudo() {
    setLidosMural((s) => { const n = new Set(s); itens.filter((i) => i.origem === "mural").forEach((i) => n.add(i.id)); return n; });
    if (memberId > 0 && itens.some((i) => i.origem === "pessoal" && !i.lido)) marcarTodas.mutate({ memberId });
  }

  const cor = (p: Item["prioridade"]) => (p === "alta" ? "#EF4444" : p === "normal" ? ORANGE : "#6B7280");
  const quando = (d: Date) => {
    const min = Math.floor((Date.now() - d.getTime()) / 60000);
    if (min < 1) return "agora";
    if (min < 60) return `${min} min atrás`;
    if (min < 1440) return `${Math.floor(min / 60)} h atrás`;
    if (min < 10080) return `${Math.floor(min / 1440)} d atrás`;
    return d.toLocaleDateString("pt-BR");
  };
  const carregando = mural.isLoading || (memberId > 0 && pessoais.isLoading);

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-40 border-b border-border/30" style={{ backgroundColor: "oklch(0.165 0.03 264.052 / 0.95)", backdropFilter: "blur(12px)" }}>
        <div className="container py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/leaderboard">
              <button className="p-2 hover:bg-secondary rounded-lg transition-colors"><ArrowLeft size={20} className="text-foreground" /></button>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-foreground">Avisos</h1>
              <p className="text-xs text-muted-foreground">{naoLidos} não lido(s)</p>
            </div>
          </div>
          {naoLidos > 0 && (
            <button onClick={lerTudo} className="px-3 py-1.5 rounded-lg text-sm font-medium"
              style={{ color: ORANGE, backgroundColor: ORANGE + "10", border: `1px solid ${ORANGE}30` }}>
              Marcar tudo como lido
            </button>
          )}
        </div>
      </div>

      <div className="container py-4 border-b border-border/20">
        <div className="relative mb-4">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input type="text" placeholder="Buscar avisos…" value={busca} onChange={(e) => setBusca(e.target.value)}
            className="w-full pl-10 pr-10 py-2 rounded-lg bg-secondary text-foreground placeholder-muted-foreground border border-border/30 focus:outline-none" />
          {busca && <button onClick={() => setBusca("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><X size={16} /></button>}
        </div>
        <div className="flex gap-2 flex-wrap">
          {(["todos", "nao_lidos"] as const).map((f) => (
            <button key={f} onClick={() => setFiltro(f)} className="px-4 py-2 rounded-lg text-sm font-medium border"
              style={{ color: filtro === f ? "#fff" : ORANGE, backgroundColor: filtro === f ? ORANGE : ORANGE + "10", borderColor: filtro === f ? ORANGE : ORANGE + "30" }}>
              {f === "todos" ? `Todos (${itens.length})` : `Não lidos (${naoLidos})`}
            </button>
          ))}
        </div>
        <div className="mt-3 flex gap-2 flex-wrap">
          {[null, ...Object.keys(TIPOS)].map((t) => (
            <button key={t ?? "all"} onClick={() => setTipo(t)} className="px-3 py-1.5 rounded-lg text-xs font-medium border"
              style={{ color: tipo === t ? "#fff" : "#9CA3AF", backgroundColor: tipo === t ? (t ? ORANGE : "#6B7280") : "#374151", borderColor: tipo === t ? ORANGE : "#4B5563" }}>
              {t ? TIPOS[t] : "Todos os tipos"}
            </button>
          ))}
        </div>
        {!memberId && (
          <p className="text-xs text-muted-foreground mt-3">Entre com sua conta de aluno para ver também os avisos individuais (equipe, nota, presença).</p>
        )}
      </div>

      <div className="container py-6">
        {carregando ? (
          <p className="text-center py-12 text-muted-foreground">Carregando avisos…</p>
        ) : visiveis.length === 0 ? (
          <div className="text-center py-12">
            <Bell size={48} className="mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-muted-foreground">{filtro === "nao_lidos" ? "Nenhum aviso não lido" : "Nenhum aviso"}</p>
          </div>
        ) : (
          <AnimatePresence>
            <div className="space-y-3">
              {visiveis.map((i, idx) => (
                <motion.div key={i.chave} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                  transition={{ delay: Math.min(idx, 10) * 0.04 }}
                  className="p-4 rounded-lg border"
                  style={{
                    backgroundColor: i.lido ? "oklch(0.165 0.03 264.052 / 0.5)" : "oklch(0.165 0.03 264.052 / 0.85)",
                    borderColor: i.lido ? "oklch(0.165 0.03 264.052 / 0.3)" : cor(i.prioridade) + "40",
                    borderLeftWidth: 4, borderLeftColor: cor(i.prioridade),
                  }}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {i.origem === "mural" && <Megaphone size={14} style={{ color: ORANGE }} />}
                        <h3 className="font-semibold text-foreground">{i.titulo}</h3>
                        {!i.lido && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ORANGE }} />}
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{TIPOS[i.tipo] ?? i.tipo}</span>
                        {i.prioridade === "alta" && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">Urgente</span>}
                      </div>
                      {i.texto && <p className="text-sm text-muted-foreground mb-2 whitespace-pre-wrap">{i.texto}</p>}
                      <p className="text-xs text-muted-foreground/70">
                        {quando(i.data)}
                        {i.expira && <span className="text-amber-400"> · até {i.expira.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })}</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {!i.lido ? (
                        <button onClick={() => lerItem(i)} className="p-2 hover:bg-secondary rounded-lg" title="Marcar como lido"><Check size={18} className="text-muted-foreground" /></button>
                      ) : (
                        <CheckCheck size={18} className="text-muted-foreground/50 m-2" />
                      )}
                      {i.origem === "pessoal" && (
                        <button onClick={() => remover.mutate({ notificationId: i.id, memberId })} className="p-2 hover:bg-secondary rounded-lg" title="Remover">
                          <Trash2 size={18} className="text-muted-foreground" />
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
