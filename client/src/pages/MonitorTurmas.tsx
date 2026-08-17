/**
 * Monitor Turmas — lista simples de turmas pra escolher, com atalhos pro
 * cronograma e pra planilha de notas de cada uma. Substitui o antigo card
 * "Turmas" que apontava pra uma rota que nunca existiu (/turmas).
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { ArrowLeft, FlaskConical, Calendar, BookOpen, Search, Gamepad2 } from "lucide-react";

export default function MonitorTurmas() {
  const [search, setSearch] = useState("");
  const { data: classesList, isLoading } = trpc.classes.listAll.useQuery();

  const filtered = (classesList || []).filter((c: any) =>
    !search.trim() || c.name.toLowerCase().includes(search.toLowerCase()) || (c.course || "").toLowerCase().includes(search.toLowerCase())
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
          <h1 className="text-sm font-bold text-foreground">Turmas</h1>
          <p className="text-xs text-muted-foreground">Escolha uma turma para ver cronograma ou notas</p>
        </div>
      </div>

      <div className="container max-w-3xl py-6 px-4">
        <div className="relative mb-6">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar turma..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm text-foreground bg-secondary border border-border focus:outline-none"
          />
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-10">Carregando turmas...</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">Nenhuma turma encontrada.</p>
        ) : (
          <div className="space-y-3">
            {filtered.map((c: any) => (
              <div
                key={c.id}
                className="rounded-xl border border-border p-4 flex items-center justify-between gap-3"
                style={{ backgroundColor: "oklch(0.195 0.03 264.052)" }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-indigo-500/15 text-indigo-400 flex items-center justify-center shrink-0">
                    <FlaskConical size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{c.name}</p>
                    {c.course && <p className="text-xs text-muted-foreground truncate">{c.course}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <Link
                    href={`/cronograma?classId=${c.id}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-foreground text-xs font-medium hover:bg-secondary/70 transition-colors"
                  >
                    <Calendar size={13} /> Cronograma
                  </Link>
                  <Link
                    href={`/jogo/${c.id}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-foreground text-xs font-medium hover:bg-secondary/70 transition-colors"
                  >
                    <Gamepad2 size={13} /> Jogo
                  </Link>
                  <Link
                    href={`/monitor/notas?classId=${c.id}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
                  >
                    <BookOpen size={13} /> Notas
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}