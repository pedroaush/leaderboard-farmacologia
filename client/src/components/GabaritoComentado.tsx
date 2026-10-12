import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Loader2, MessageSquareText, Save } from "lucide-react";

/**
 * Editor do gabarito comentado (aba Provas do Painel Admin).
 * Os comentários aparecem para cada aluno na aba "Provas", ao lado da sua
 * resposta, quando o resultado é liberado.
 *
 * - Versões embaralhadas (com mapa) compartilham o comentário da questão
 *   original: escreve-se uma vez, na numeração da versão A.
 * - Versões sem mapa (ex.: 2ª chamada com questões próprias) têm
 *   comentários separados.
 */
export default function GabaritoComentado({ teacherToken, classId, prova }: { teacherToken: string; classId: number; prova: "P1" | "P2" }) {
  const q = trpc.correcaoProva.getComentarios.useQuery(
    { sessionToken: teacherToken, classId, provaType: prova },
    { enabled: !!teacherToken && classId > 0, retry: false }
  );
  const salvar = trpc.correcaoProva.salvarComentarios.useMutation();
  const [edicao, setEdicao] = useState<Record<string, string>>({});
  const [versaoAvulsa, setVersaoAvulsa] = useState<string>("");

  useEffect(() => { setEdicao({}); }, [classId, prova]);

  const dados: any = q.data;
  const base = useMemo(() => dados?.versoes?.find((v: any) => v.versao === "A") ?? dados?.versoes?.[0], [dados]);
  const avulsas = useMemo(
    () => (dados?.versoes ?? []).filter((v: any) => v.versao !== base?.versao && !v.temMapa),
    [dados, base]
  );
  useEffect(() => { if (avulsas.length && !avulsas.some((v: any) => v.versao === versaoAvulsa)) setVersaoAvulsa(avulsas[0].versao); }, [avulsas, versaoAvulsa]);

  const valor = (chave: string) => edicao[chave] ?? dados?.comentarios?.[chave] ?? "";
  const alterados = Object.keys(edicao).filter((k) => (edicao[k] ?? "") !== (dados?.comentarios?.[k] ?? ""));

  async function gravar() {
    if (!alterados.length) return;
    const comentarios: Record<string, string> = {};
    for (const k of alterados) comentarios[k] = edicao[k];
    try {
      const r: any = await salvar.mutateAsync({ sessionToken: teacherToken, classId, provaType: prova, comentarios });
      toast.success(`Comentários salvos (${r.gravados} gravados${r.apagados ? `, ${r.apagados} apagados` : ""})`);
      setEdicao({});
      q.refetch();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar comentários");
    }
  }

  const preenchidos = Object.keys(dados?.comentarios ?? {}).length;

  // função (não componente) para o campo não perder o foco a cada tecla
  const linha = (chave: string, rotulo: string, tema?: string | null, letra?: string) => (
    <div key={chave} className="grid md:grid-cols-[120px_1fr] gap-2 items-start py-2 border-b border-white/5">
      <div className="text-xs">
        <p className="font-semibold text-white">{rotulo}</p>
        {tema && <p className="text-white/45">{tema}</p>}
        {letra && <p className="text-emerald-300">gabarito: {letra}</p>}
      </div>
      <textarea
        value={valor(chave)}
        onChange={(e) => setEdicao((m) => ({ ...m, [chave]: e.target.value }))}
        rows={2}
        placeholder="Explique por que a alternativa correta está certa e os erros mais comuns… (não cite a letra: ela muda entre as versões)"
        className="w-full px-2 py-1.5 rounded-md bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground resize-y"
      />
    </div>
  );

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <h3 className="font-semibold text-white flex items-center gap-2"><MessageSquareText size={16} className="text-orange-400" /> Gabarito comentado ({prova})</h3>
        <span className="text-xs text-white/45">{preenchidos} comentário(s) salvo(s)</span>
      </div>
      <p className="text-xs text-white/50 mb-3">
        Cada aluno vê o comentário ao lado da própria resposta, na aba <b>Provas</b>, quando o resultado estiver liberado.
        Nas versões embaralhadas, escreva uma vez só (numeração da versão A) — vale para todas. Evite citar a letra no texto.
      </p>

      {q.isLoading ? (
        <div className="flex items-center gap-2 text-white/60 text-sm"><Loader2 size={14} className="animate-spin" /> Carregando…</div>
      ) : q.error ? (
        <p className="text-red-300 text-sm">{q.error.message}</p>
      ) : !base ? (
        <p className="text-white/60 text-sm">Cadastre o gabarito desta prova antes de escrever os comentários.</p>
      ) : (
        <>
          <p className="text-[11px] uppercase tracking-wide text-white/40 mt-2">
            Questões (numeração da versão {base.versao}{dados.versoes.some((v: any) => v.temMapa) ? `; vale para ${dados.versoes.filter((v: any) => v.temMapa || v.versao === base.versao).map((v: any) => v.versao).join(", ")}` : ""})
          </p>
          {base.questoes.map((x: any) => {
            const chave = String(x.q ?? x.posicao);
            return linha(chave, `Questão ${x.posicao}`, x.tema, x.gabarito);
          })}

          {avulsas.length > 0 && (
            <div className="mt-5">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-[11px] uppercase tracking-wide text-white/40">Versões com questões próprias (ex.: 2ª chamada):</p>
                <select value={versaoAvulsa} onChange={(e) => setVersaoAvulsa(e.target.value)}
                  className="px-2 py-1 rounded-md bg-secondary border border-border text-xs text-foreground">
                  {avulsas.map((v: any) => <option key={v.versao} value={v.versao}>Versão {v.versao}</option>)}
                </select>
              </div>
              {(avulsas.find((v: any) => v.versao === versaoAvulsa)?.questoes ?? []).map((x: any) => {
                const chave = `${versaoAvulsa}:${x.posicao}`;
                return linha(chave, `${versaoAvulsa} · Questão ${x.posicao}`, null, x.gabarito);
              })}
            </div>
          )}

          <div className="sticky bottom-2 mt-3 flex items-center gap-3">
            <button onClick={gravar} disabled={!alterados.length || salvar.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold disabled:opacity-50 shadow-lg">
              {salvar.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Salvar comentários {alterados.length ? `(${alterados.length} alterado${alterados.length > 1 ? "s" : ""})` : ""}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
