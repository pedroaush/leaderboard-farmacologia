/**
 * Monitor Equipes — visão só de leitura: grupos de Casos Clínicos e
 * Seminário (com integrantes), mais a tabela de pontos corridos dos Casos
 * Clínicos. Sem botões de lançar resultado/nota — isso fica em
 * /monitor/notas.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { ArrowLeft, Loader2, Trophy, Users, FileText, Medal } from "lucide-react";

const MONITOR_SESSION_KEY = "monitor_session_token";

function TabelaClassificacao({ classId }: { classId: number }) {
  const { data: tabela = [], isLoading } = trpc.casosClinicos.getTabelaClassificacao.useQuery({ classId });
  if (isLoading) return <div className="flex items-center justify-center py-6 text-muted-foreground"><Loader2 size={16} className="animate-spin" /></div>;
  if (!tabela.length) return <p className="text-xs text-muted-foreground py-4">Nenhum grupo encontrado.</p>;
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-muted-foreground border-b border-border" style={{ backgroundColor: "oklch(0.22 0.035 264)" }}>
            <th className="py-2 px-3">#</th>
            <th className="py-2 px-3">Grupo</th>
            <th className="py-2 px-3 text-center">Pts</th>
            <th className="py-2 px-3 text-center">V</th>
            <th className="py-2 px-3 text-center">E</th>
            <th className="py-2 px-3 text-center">D</th>
            <th className="py-2 px-3 text-center">J</th>
          </tr>
        </thead>
        <tbody>
          {tabela.map((t: any, i: number) => (
            <tr key={t.grupoId} className="border-b border-border/40">
              <td className="py-1.5 px-3 text-muted-foreground">{i + 1}º</td>
              <td className="py-1.5 px-3 text-foreground font-medium">{t.nome}</td>
              <td className="py-1.5 px-3 text-center font-mono font-bold text-foreground">{t.pontos}</td>
              <td className="py-1.5 px-3 text-center text-emerald-400">{t.vitorias}</td>
              <td className="py-1.5 px-3 text-center text-amber-400">{t.empates}</td>
              <td className="py-1.5 px-3 text-center text-red-400">{t.derrotas}</td>
              <td className="py-1.5 px-3 text-center text-muted-foreground">{t.jogos}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GrupoCard({ nome, membros, color }: { nome: string; membros: { memberId?: number; memberName?: string; name?: string }[]; color: string }) {
  return (
    <div className="rounded-xl border border-border p-4" style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <p className="text-sm font-semibold text-foreground">{nome}</p>
        <span className="text-[10px] text-muted-foreground ml-auto">{membros.length} integrante{membros.length !== 1 ? "s" : ""}</span>
      </div>
      {membros.length > 0 && (
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          {membros.map((m) => m.memberName || m.name).filter(Boolean).join(", ")}
        </p>
      )}
    </div>
  );
}

export default function MonitorEquipes() {
  const sessionToken = localStorage.getItem(MONITOR_SESSION_KEY) || localStorage.getItem("teacherSessionToken") || "";
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);

  const { data: classesList, isLoading: loadingClasses } = trpc.monitors.listClasses.useQuery(
    { monitorSessionToken: sessionToken },
    { enabled: !!sessionToken }
  );

  const classId = selectedClassId ?? (classesList?.length === 1 ? classesList[0].id : null);

  const { data: casosClinicosGroups, isLoading: loadingCC } = trpc.monitors.listCasosClinicosGroups.useQuery(
    { monitorSessionToken: sessionToken, classId: classId! },
    { enabled: !!sessionToken && !!classId }
  );
  const { data: seminarioGroups, isLoading: loadingSem } = trpc.monitors.listSeminarioGroups.useQuery(
    { monitorSessionToken: sessionToken, classId: classId! },
    { enabled: !!sessionToken && !!classId }
  );

  return (
    <div className="min-h-screen bg-background">
      <div
        className="border-b border-border px-4 py-3 flex items-center gap-3 sticky top-0 z-10"
        style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}
      >
        <Link href="/monitor" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-sm font-bold text-foreground">Equipes</h1>
          <p className="text-xs text-muted-foreground">Grupos, integrantes e classificação — só consulta</p>
        </div>
      </div>

      <div className="container max-w-4xl py-6 px-4 space-y-6">
        {/* Seletor de turma */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Turma</label>
          {loadingClasses ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 size={14} className="animate-spin" /> Carregando...</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {classesList?.map((c: any) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedClassId(c.id)}
                  className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${
                    classId === c.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                  }`}
                >
                  {c.name}
                </button>
              ))}
              {!classesList?.length && <p className="text-sm text-muted-foreground">Nenhuma turma encontrada.</p>}
            </div>
          )}
        </div>

        {classId && (
          <>
            {/* Tabela de pontos corridos */}
            <div>
              <p className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-2"><Trophy size={13} /> Classificação — Casos Clínicos</p>
              <TabelaClassificacao classId={classId} />
            </div>

            {/* Grupos de Casos Clínicos */}
            <div>
              <p className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-2"><Medal size={13} /> Grupos de Casos Clínicos</p>
              {loadingCC ? (
                <div className="flex items-center justify-center py-6 text-muted-foreground"><Loader2 size={16} className="animate-spin" /></div>
              ) : !casosClinicosGroups?.length ? (
                <p className="text-xs text-muted-foreground">Nenhum grupo encontrado.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {casosClinicosGroups.map((g: any) => (
                    <GrupoCard key={g.id} nome={g.name} membros={g.membersList || []} color="#f59e0b" />
                  ))}
                </div>
              )}
            </div>

            {/* Grupos de Seminário */}
            <div>
              <p className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-2"><FileText size={13} /> Grupos de Seminário</p>
              {loadingSem ? (
                <div className="flex items-center justify-center py-6 text-muted-foreground"><Loader2 size={16} className="animate-spin" /></div>
              ) : !seminarioGroups?.length ? (
                <p className="text-xs text-muted-foreground">Nenhum grupo encontrado.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {seminarioGroups.map((g: any) => (
                    <GrupoCard key={g.id} nome={g.name} membros={g.membersList || []} color="#a855f7" />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
