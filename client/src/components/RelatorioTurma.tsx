import { useMemo, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Bot, Download, FileText, Loader2, Printer, Save, Sparkles, Users, X } from "lucide-react";

/**
 * Aba Provas → Resultados da turma: exportação (Excel) e parecer individual.
 */
type Prova = "P1" | "P2";
const fmt = (n: number, c = 1) => (Number.isFinite(n) ? n.toFixed(c).replace(".", ",") : "—");
const pct = (a: number, t: number) => (t ? (a / t) * 100 : 0);

export default function RelatorioTurma({ teacherToken, classId, prova, turmaNome }: { teacherToken: string; classId: number; prova: Prova; turmaNome: string }) {
  const rel = trpc.correcaoProva.getRelatorio.useQuery(
    { sessionToken: teacherToken, classId, provaType: prova },
    { enabled: !!teacherToken && classId > 0, retry: false }
  );
  const painel = trpc.correcaoProva.getPainel.useQuery(
    { sessionToken: teacherToken, classId, provaType: prova },
    { enabled: !!teacherToken && classId > 0, retry: false }
  );
  const salvar = trpc.correcaoProva.salvarParecer.useMutation();
  const ia = trpc.correcaoProva.iaDisponivel.useQuery(undefined, { staleTime: Infinity });
  const gerarIA = trpc.correcaoProva.gerarParecerIA.useMutation();
  const [lote, setLote] = useState<{ feitos: number; total: number } | null>(null);

  async function rascunhoIA(memberId: number) {
    const r: any = await gerarIA.mutateAsync({ sessionToken: teacherToken, classId, provaType: prova, memberId });
    return r.texto as string;
  }
  async function iaNoEditor() {
    if (!alunoAberto) return;
    try {
      const texto = await rascunhoIA(alunoAberto.memberId);
      setRascunho((r) => ({ ...r, texto: r.texto.trim() ? r.texto + "\n\n— Sugestão da IA —\n" + texto : texto }));
      toast.success("Rascunho gerado — revise antes de salvar");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao gerar com IA");
    }
  }
  async function iaParaTodos() {
    const semParecer = (d?.alunos ?? []).filter((a: any) => !d.pareceres?.[a.memberId]);
    if (!semParecer.length) return toast.info("Todos os alunos já têm parecer.");
    if (!confirm(`Gerar rascunhos com IA para ${semParecer.length} aluno(s) sem parecer? Eles ficam salvos como rascunho (não visíveis aos alunos) para você revisar.`)) return;
    setLote({ feitos: 0, total: semParecer.length });
    let falhas = 0;
    for (let i = 0; i < semParecer.length; i++) {
      try {
        const texto = await rascunhoIA(semParecer[i].memberId);
        await salvar.mutateAsync({ sessionToken: teacherToken, classId, provaType: prova, memberId: semParecer[i].memberId, texto, visivelAluno: false });
      } catch { falhas++; }
      setLote({ feitos: i + 1, total: semParecer.length });
    }
    setLote(null);
    rel.refetch();
    toast.success(`Rascunhos gerados${falhas ? ` (${falhas} falharam)` : ""}. Revise e marque "Mostrar ao aluno".`);
  }

  const [aberto, setAberto] = useState<number | null>(null);
  const [rascunho, setRascunho] = useState<{ texto: string; visivel: boolean }>({ texto: "", visivel: false });
  const [busca, setBusca] = useState("");
  const [exportando, setExportando] = useState(false);

  const d: any = rel.data;
  const temaTurma = useMemo(() => new Map<string, number>((d?.temasTurma ?? []).map((t: any) => [t.tema, t.pct])), [d]);
  const alunos: any[] = useMemo(
    () => (d?.alunos ?? []).filter((a: any) => !busca || a.nome.toLowerCase().includes(busca.toLowerCase())),
    [d, busca]
  );
  const alunoAberto = useMemo(() => (d?.alunos ?? []).find((a: any) => a.memberId === aberto), [d, aberto]);

  function abrir(a: any) {
    const p = d?.pareceres?.[a.memberId];
    setRascunho({ texto: p?.texto ?? "", visivel: p?.visivel ?? false });
    setAberto(a.memberId);
  }

  async function gravar() {
    if (!alunoAberto) return;
    try {
      await salvar.mutateAsync({ sessionToken: teacherToken, classId, provaType: prova, memberId: alunoAberto.memberId, texto: rascunho.texto, visivelAluno: rascunho.visivel });
      toast.success(rascunho.texto.trim() ? "Parecer salvo" : "Parecer apagado");
      rel.refetch();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar parecer");
    }
  }

  // ── Sugestão automática a partir dos acertos e erros
  function sugestao(a: any): string {
    const media = d.media as number;
    const dif = a.nota - media;
    const comp = Math.abs(dif) < 0.3 ? "na média da turma" : dif > 0 ? "acima da média da turma" : "abaixo da média da turma";
    const temas = a.porTema.map((t: any) => ({ ...t, p: pct(t.acertos, t.total), turma: temaTurma.get(t.tema) ?? 0 }));
    const fortes = temas.filter((t: any) => t.p >= 75).sort((x: any, y: any) => y.p - x.p);
    const fracos = temas.filter((t: any) => t.p < 50).sort((x: any, y: any) => x.p - y.p);
    const erradas = a.porQuestao.filter((q: any) => !q.acertou && !q.anulada);
    const linhas: string[] = [];
    linhas.push(`Desempenho na ${prova}: nota ${fmt(a.nota)} (${a.acertos}/${a.total} acertos), ${comp} (${fmt(media)}). Posição: ${a.posicao}º de ${d.corrigidos}.`);
    if (fortes.length) linhas.push(`Pontos fortes: ${fortes.map((t: any) => `${t.tema} (${Math.round(t.p)}%)`).join("; ")}.`);
    if (fracos.length) linhas.push(`Pontos a reforçar: ${fracos.map((t: any) => `${t.tema} (${Math.round(t.p)}% — turma ${Math.round(t.turma)}%)`).join("; ")}.`);
    if (erradas.length) linhas.push(`Questões erradas (numeração da sua versão ${a.versao}): ${erradas.map((q: any) => `${q.posicao}${q.marcada ? "" : " (em branco)"}`).join(", ")}.`);
    if (a.nota < 5) linhas.push(`Recomendação: revisar ${fracos.length ? "prioritariamente " + fracos.map((t: any) => t.tema).join(", ") : "os temas da prova"} com o gabarito comentado, procurar a monitoria e refazer os casos clínicos correspondentes. Vamos acompanhar sua evolução nas próximas semanas.`);
    else if (a.nota < 7) linhas.push(`Recomendação: bom ponto de partida. Revise ${fracos.length ? fracos.map((t: any) => t.tema).join(", ") : "as questões erradas"} usando o gabarito comentado para consolidar o conteúdo antes da próxima avaliação.`);
    else linhas.push(`Recomendação: ótimo desempenho. ${fracos.length ? `Vale ainda revisar ${fracos.map((t: any) => t.tema).join(", ")}. ` : ""}Mantenha o ritmo de estudo.`);
    return linhas.join("\n\n");
  }

  // ── Exportação Excel
  async function exportar() {
    if (!d) return;
    setExportando(true);
    try {
      const XLSX: any = await import("xlsx");
      const p: any = painel.data;
      const wb = XLSX.utils.book_new();
      const temas: string[] = (d.temasTurma ?? []).map((t: any) => t.tema);

      const resumo = [
        ["Conexão em Farmacologia — Resultados da prova"],
        ["Turma", turmaNome], ["Prova", prova], ["Exportado em", new Date().toLocaleString("pt-BR")],
        [],
        ["Alunos na turma", d.totalAlunos], ["Cartões corrigidos", d.corrigidos], ["Notas lançadas à mão", d.notasManuais.length], ["Sem nota", d.ausentes.length],
        ["Média", p?.media ?? d.media], ["Mediana", p?.mediana ?? ""], ["Nota ≥ 6", p?.aprovados6 ?? ""],
        [],
        ["Distribuição de notas"], ["Faixa", "Alunos"], ...((p?.distribuicao ?? []).map((x: any) => [x.faixa, x.alunos])),
        [],
        ["Acerto da turma por tema"], ["Tema", "% de acerto", "Nº de questões"], ...(d.temasTurma ?? []).map((t: any) => [t.tema, t.pct, t.questoes]),
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumo), "Resumo");

      const linhasAlunos = (d.alunos as any[]).map((a) => {
        const lin: any = { Aluno: a.nome, Versão: a.versao, Nota: a.nota, Acertos: a.acertos, Questões: a.total, "% acerto": Math.round(pct(a.acertos, a.total) * 10) / 10, Posição: a.posicao };
        for (const t of temas) {
          const x = a.porTema.find((y: any) => y.tema === t);
          lin[`% ${t}`] = x ? Math.round(pct(x.acertos, x.total) * 10) / 10 : "";
        }
        lin["Parecer"] = d.pareceres?.[a.memberId]?.texto ?? "";
        lin["Parecer visível ao aluno"] = d.pareceres?.[a.memberId] ? (d.pareceres[a.memberId].visivel ? "sim" : "não") : "";
        return lin;
      });
      for (const m of d.notasManuais) linhasAlunos.push({ Aluno: m.nome, Versão: "(lançada à mão)", Nota: m.nota });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(linhasAlunos), "Alunos");

      if (p?.questoes?.length) {
        const q = p.questoes.map((x: any) => ({
          "Questão (versão A)": x.posA ?? x.posicao ?? x.questaoOriginal,
          Tema: x.tema ?? "",
          Correta: x.correta ?? "",
          "% acerto": x.pctAcerto,
          Discriminação: x.discriminacao,
          A: x.marcadas?.A ?? 0, B: x.marcadas?.B ?? 0, C: x.marcadas?.C ?? 0, D: x.marcadas?.D ?? 0, E: x.marcadas?.E ?? 0,
          "Em branco": x.brancos,
          Anulada: x.anulada ? "sim" : "",
          Alerta: x.alerta ?? "",
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(q), "Questões");
      }

      // Matriz aluno × questão (1 = acerto, 0 = erro, B = branco), na numeração da versão A
      const chaves: number[] = Array.from(new Set<number>((d.alunos as any[]).flatMap((a) => a.porQuestao.map((x: any) => x.chave)))).sort((a, b) => a - b);
      const matriz = (d.alunos as any[]).map((a) => {
        const lin: any = { Aluno: a.nome, Versão: a.versao, Nota: a.nota };
        for (const c of chaves) {
          const x = a.porQuestao.find((y: any) => y.chave === c);
          lin[`Q${c}`] = !x ? "" : x.anulada ? "anulada" : x.marcada === null ? "B" : x.acertou ? 1 : 0;
        }
        return lin;
      });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(matriz), "Matriz de acertos");

      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet((d.ausentes as any[]).map((a) => ({ Aluno: a.nome }))), "Sem nota");

      const nome = `${prova}_${turmaNome}`.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "_");
      XLSX.writeFile(wb, `Resultados_${nome}.xlsx`);
    } catch (e: any) {
      toast.error("Erro ao exportar: " + (e?.message || e));
    } finally {
      setExportando(false);
    }
  }

  // ── Impressão (salvar como PDF pelo navegador)
  function htmlParecer(a: any, texto: string) {
    const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
    const temas = a.porTema.map((t: any) => {
      const p = pct(t.acertos, t.total);
      return `<tr><td>${esc(t.tema)}</td><td>${t.acertos}/${t.total}</td><td>${Math.round(p)}%</td><td>${Math.round(temaTurma.get(t.tema) ?? 0)}%</td></tr>`;
    }).join("");
    return `<section class="pag">
      <header><div><b>Conexão em Farmacologia</b> · UNIRIO</div><div>${esc(turmaNome)} · ${prova}</div></header>
      <h1>Parecer individual de desempenho</h1>
      <p class="aluno">${esc(a.nome)}</p>
      <div class="kpis"><div><span>Nota</span><b>${fmt(a.nota)}</b></div><div><span>Acertos</span><b>${a.acertos}/${a.total}</b></div><div><span>Média da turma</span><b>${fmt(d.media)}</b></div><div><span>Versão</span><b>${a.versao}</b></div></div>
      <table><thead><tr><th>Tema</th><th>Acertos</th><th>Aluno</th><th>Turma</th></tr></thead><tbody>${temas}</tbody></table>
      <h2>Parecer</h2>
      <div class="texto">${esc(texto || "—").replace(/\n/g, "<br>")}</div>
      <footer><span>${new Date().toLocaleDateString("pt-BR")}</span><span class="assin">Professor(a) responsável</span></footer>
    </section>`;
  }
  function imprimir(lista: { aluno: any; texto: string }[]) {
    const w = window.open("", "_blank");
    if (!w) return toast.error("Permita pop-ups para imprimir.");
    w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Pareceres ${prova} — ${turmaNome}</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:0}
        .pag{padding:28px 36px;page-break-after:always}
        header{display:flex;justify-content:space-between;font-size:12px;color:#555;border-bottom:2px solid #F7941D;padding-bottom:6px}
        h1{font-size:20px;margin:18px 0 4px} h2{font-size:15px;margin:18px 0 6px}
        .aluno{font-size:16px;font-weight:bold;margin:0 0 12px}
        .kpis{display:flex;gap:12px;margin-bottom:14px}.kpis div{border:1px solid #ddd;border-radius:6px;padding:6px 12px}
        .kpis span{display:block;font-size:11px;color:#666}.kpis b{font-size:18px}
        table{border-collapse:collapse;width:100%;font-size:12px}th,td{border:1px solid #ddd;padding:4px 8px;text-align:left}th{background:#f6f6f6}
        .texto{font-size:13px;line-height:1.55;border:1px solid #eee;border-radius:6px;padding:10px 12px}
        footer{display:flex;justify-content:space-between;margin-top:40px;font-size:12px}.assin{border-top:1px solid #333;padding-top:4px;width:240px;text-align:center}
      </style></head><body>${lista.map((x) => htmlParecer(x.aluno, x.texto)).join("")}
      <script>window.onload=()=>setTimeout(()=>window.print(),300)<\/script></body></html>`);
    w.document.close();
  }

  const card = "rounded-xl border border-white/10 bg-white/[0.03] p-4";

  if (rel.isLoading) return <div className={`${card} flex items-center gap-2 text-white/60 text-sm`}><Loader2 size={14} className="animate-spin" /> Carregando resultados…</div>;
  if (rel.error) return <div className={`${card} text-red-300 text-sm`}>{rel.error.message}</div>;
  if (!d?.corrigidos) return <div className={`${card} text-white/60 text-sm`}><Users size={14} className="inline mr-1" /> Ainda não há cartões corrigidos nesta prova.</div>;

  const comParecer = Object.keys(d.pareceres ?? {}).length;

  return (
    <div className={card}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <h3 className="font-semibold text-white flex items-center gap-2"><Users size={16} className="text-orange-400" /> Resultados da turma e pareceres</h3>
          <p className="text-xs text-white/50">{d.corrigidos} alunos corrigidos · média {fmt(d.media)} · {comParecer} parecer(es) escrito(s)</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {ia.data?.disponivel && (
            <button onClick={iaParaTodos} disabled={!!lote}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold disabled:opacity-60">
              {lote ? <><Loader2 size={14} className="animate-spin" /> IA {lote.feitos}/{lote.total}</> : <><Bot size={14} /> Pareceres com IA (todos)</>}
            </button>
          )}
          <button onClick={exportar} disabled={exportando}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold disabled:opacity-50">
            {exportando ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Exportar Excel
          </button>
          <button onClick={() => imprimir((d.alunos as any[]).filter((a) => d.pareceres?.[a.memberId]).map((a) => ({ aluno: a, texto: d.pareceres[a.memberId].texto })))}
            disabled={!comParecer}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-semibold disabled:opacity-40">
            <Printer size={14} /> Imprimir pareceres ({comParecer})
          </button>
        </div>
      </div>

      <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar aluno…"
        className="w-full sm:w-72 mb-2 px-3 py-1.5 rounded-md bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground" />

      <div className="overflow-x-auto max-h-[480px] overflow-y-auto rounded-lg border border-white/5">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-[#111827] text-white/60 text-xs">
            <tr><th className="text-left px-3 py-2">Aluno</th><th className="px-2">Versão</th><th className="px-2">Nota</th><th className="px-2">Posição</th><th className="text-left px-2">Temas a reforçar</th><th className="px-2">Parecer</th><th></th></tr>
          </thead>
          <tbody>
            {alunos.map((a) => {
              const fracos = a.porTema.filter((t: any) => pct(t.acertos, t.total) < 50).map((t: any) => t.tema);
              const p = d.pareceres?.[a.memberId];
              return (
                <tr key={a.memberId} className="border-t border-white/5 hover:bg-white/[0.03]">
                  <td className="px-3 py-1.5 text-white">{a.nome}</td>
                  <td className="text-center text-white/70">{a.versao}</td>
                  <td className={`text-center font-semibold ${a.nota >= 6 ? "text-emerald-300" : "text-red-300"}`}>{fmt(a.nota)}</td>
                  <td className="text-center text-white/60">{a.posicao}º</td>
                  <td className="px-2 text-xs text-white/60">{fracos.join(", ") || "—"}</td>
                  <td className="text-center text-xs">{p ? (p.visivel ? <span className="text-emerald-300">visível</span> : <span className="text-white/60">rascunho</span>) : <span className="text-white/30">—</span>}</td>
                  <td className="px-2 text-right">
                    <button onClick={() => abrir(a)} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-orange-500/90 hover:bg-orange-500 text-white text-xs font-semibold">
                      <FileText size={12} /> Parecer
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Editor do parecer */}
      {alunoAberto && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center p-4 overflow-y-auto" onClick={() => setAberto(null)}>
          <div className="w-full max-w-3xl rounded-2xl bg-[#0D1B2A] border border-white/10 p-5 my-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <p className="text-xs text-white/50">Parecer individual · {prova} · {turmaNome}</p>
                <h3 className="text-lg font-bold text-white">{alunoAberto.nome}</h3>
                <p className="text-sm text-white/70">Nota <b className="text-white">{fmt(alunoAberto.nota)}</b> · {alunoAberto.acertos}/{alunoAberto.total} acertos · versão {alunoAberto.versao} · {alunoAberto.posicao}º de {d.corrigidos} · média da turma {fmt(d.media)}</p>
              </div>
              <button onClick={() => setAberto(null)} className="text-white/60 hover:text-white"><X size={20} /></button>
            </div>

            <div className="grid md:grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-white/40 mb-2">Acerto por tema (aluno × turma)</p>
                <div className="space-y-2">
                  {alunoAberto.porTema.map((t: any) => {
                    const pa = pct(t.acertos, t.total);
                    const pt = temaTurma.get(t.tema) ?? 0;
                    return (
                      <div key={t.tema}>
                        <div className="flex justify-between text-xs text-white/70"><span>{t.tema}</span><span>{t.acertos}/{t.total} · {Math.round(pa)}% (turma {Math.round(pt)}%)</span></div>
                        <div className="relative h-2 rounded bg-white/10 mt-1">
                          <div className="absolute inset-y-0 left-0 rounded" style={{ width: `${pa}%`, backgroundColor: pa >= pt ? "#10b981" : "#f97316" }} />
                          <div className="absolute -top-0.5 h-3 w-0.5 bg-white" style={{ left: `${pt}%` }} title="média da turma" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-white/40 mb-2">Questões erradas (numeração da versão {alunoAberto.versao})</p>
                <div className="flex flex-wrap gap-1.5">
                  {alunoAberto.porQuestao.filter((q: any) => !q.acertou && !q.anulada).map((q: any) => (
                    <span key={q.posicao} className="text-xs rounded-md px-2 py-1 bg-red-500/15 text-red-200" title={q.tema}>
                      {q.posicao}: {q.marcada ?? "branco"} → {q.correta}
                    </span>
                  ))}
                  {!alunoAberto.porQuestao.some((q: any) => !q.acertou && !q.anulada) && <span className="text-xs text-emerald-300">Nenhuma 🎉</span>}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between mb-1">
              <p className="text-xs uppercase tracking-wide text-white/40">Parecer</p>
              <div className="flex flex-wrap gap-3">
                {ia.data?.disponivel && (
                  <button onClick={iaNoEditor} disabled={gerarIA.isPending}
                    className="inline-flex items-center gap-1 text-xs text-violet-300 hover:text-violet-200 disabled:opacity-60">
                    {gerarIA.isPending ? <Loader2 size={12} className="animate-spin" /> : <Bot size={12} />} Gerar com IA (prova + padrão de respostas + jogo)
                  </button>
                )}
                <button onClick={() => setRascunho((r) => ({ ...r, texto: r.texto.trim() ? r.texto + "\n\n" + sugestao(alunoAberto) : sugestao(alunoAberto) }))}
                  className="inline-flex items-center gap-1 text-xs text-orange-300 hover:text-orange-200">
                  <Sparkles size={12} /> Sugestão simples (sem IA)
                </button>
              </div>
            </div>
            <textarea value={rascunho.texto} onChange={(e) => setRascunho((r) => ({ ...r, texto: e.target.value }))} rows={9}
              placeholder="Escreva o parecer ou gere uma sugestão e ajuste…"
              className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground resize-y" />

            <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
              <label className="flex items-center gap-2 text-sm text-white/70 cursor-pointer">
                <input type="checkbox" checked={rascunho.visivel} onChange={(e) => setRascunho((r) => ({ ...r, visivel: e.target.checked }))} />
                Mostrar ao aluno na aba Provas (quando o resultado estiver liberado)
              </label>
              <div className="flex gap-2">
                <button onClick={() => imprimir([{ aluno: alunoAberto, texto: rascunho.texto }])}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm"><Printer size={14} /> Imprimir / PDF</button>
                <button onClick={gravar} disabled={salvar.isPending}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold disabled:opacity-50">
                  {salvar.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Salvar parecer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
