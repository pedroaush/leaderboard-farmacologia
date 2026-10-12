import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import GabaritoComentado from "@/components/GabaritoComentado";
import {
  BarChart3, ClipboardCheck, ExternalLink, Eye, EyeOff, FileKey, Loader2, QrCode, Save, Smartphone,
} from "lucide-react";

/**
 * Aba "Provas" do Painel Admin — central do sistema de correção por QR.
 * Substitui a tela antiga (gabarito com pesos e turmas fixas 22–28), que não
 * estava ligada à correção por cartão. A tela antiga continua disponível no
 * fim da página, recolhida, por causa do Quiz ao Vivo.
 */
type Prova = "P1" | "P2";
const VERSOES = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"] as const;
const BASE = typeof window !== "undefined" ? window.location.origin : "";

export default function ProvasHub({ teacherToken, legado }: { teacherToken: string; legado?: React.ReactNode }) {
  const { data: turmas = [] } = trpc.classes.listAll.useQuery();
  const [classId, setClassId] = useState<number>(() => Number(localStorage.getItem("provas_classId") || 1));
  const [prova, setProva] = useState<Prova>(() => (localStorage.getItem("provas_prova") as Prova) || "P1");
  useEffect(() => { try { localStorage.setItem("provas_classId", String(classId)); localStorage.setItem("provas_prova", prova); } catch {} }, [classId, prova]);

  const painel = trpc.correcaoProva.getPainel.useQuery(
    { sessionToken: teacherToken, classId, provaType: prova },
    { enabled: !!teacherToken && classId > 0, retry: false }
  );
  const liberar = trpc.correcaoProva.liberarResultado.useMutation();
  const salvar = trpc.correcaoProva.salvarGabaritos.useMutation();
  const d: any = painel.data;

  const linkPainel = `${BASE}/correcao/painel?p=${prova}&c=${classId}`;
  const linkCorrecao = `${BASE}/correcao?p=${prova}&c=${classId}`;

  // ── Cadastro de gabarito (versões novas, ex.: 2ª chamada F/G, ou a P2)
  const [textos, setTextos] = useState<Record<string, string>>({});
  const versoesPreenchidas = useMemo(
    () => VERSOES.filter((v) => (textos[v] || "").replace(/[^A-Ea-e]/g, "").length > 0),
    [textos]
  );
  async function salvarGabarito() {
    const gabaritos: Record<string, string[]> = {};
    for (const v of versoesPreenchidas) gabaritos[v] = (textos[v] || "").toUpperCase().replace(/[^A-E]/g, "").split("");
    const tamanhos = new Set(Object.values(gabaritos).map((g) => g.length));
    if (!versoesPreenchidas.length) return toast.error("Preencha o gabarito de pelo menos uma versão.");
    if (tamanhos.size > 1) return toast.error("Todas as versões precisam ter o mesmo número de questões.");
    const n = [...tamanhos][0];
    if (d?.questoes?.length && d.questoes.length !== n) {
      return toast.error(`Esta prova já tem ${d.questoes.length} questões cadastradas; o gabarito novo tem ${n}.`);
    }
    try {
      const r: any = await salvar.mutateAsync({ sessionToken: teacherToken, classId, provaType: prova, gabaritos: gabaritos as any });
      toast.success(`Gabarito salvo: versões ${r.versoes.join(", ")} · ${r.questoes} questões`);
      setTextos({});
      painel.refetch();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar gabarito");
    }
  }

  async function alternarLiberacao() {
    if (!d) return;
    try {
      await liberar.mutateAsync({ sessionToken: teacherToken, classId, provaType: prova, liberar: !d.liberado });
      toast.success(d.liberado ? "Resultado recolhido — alunos não veem mais" : "Resultado liberado na aba Provas dos alunos");
      painel.refetch();
    } catch (e: any) {
      toast.error(e?.message || "Erro");
    }
  }

  const card = "rounded-xl border border-white/10 bg-white/[0.03] p-4";

  return (
    <div className="space-y-5">
      {/* Cabeçalho e seleção */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Provas — correção por cartão (QR)</h2>
          <p className="text-sm text-white/50">Gabarito, correção pelo celular, painel de análise e liberação do resultado aos alunos.</p>
        </div>
        <div className="flex gap-2">
          <select value={classId} onChange={(e) => setClassId(Number(e.target.value))}
            className="px-3 py-2 rounded-md bg-secondary border border-border text-sm text-foreground">
            {(turmas as any[]).length === 0 && <option value={1}>Turma 1</option>}
            {(turmas as any[]).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select value={prova} onChange={(e) => setProva(e.target.value as Prova)}
            className="px-3 py-2 rounded-md bg-secondary border border-border text-sm text-foreground">
            <option value="P1">P1 (inclui 2ª chamada)</option>
            <option value="P2">P2 (inclui 2ª chamada)</option>
          </select>
        </div>
      </div>

      {/* Situação */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {painel.isLoading ? (
          <div className={`${card} col-span-full flex items-center gap-2 text-white/60`}><Loader2 className="animate-spin" size={16} /> Carregando…</div>
        ) : painel.error ? (
          <div className={`${card} col-span-full text-red-300 text-sm`}>Não foi possível carregar: {painel.error.message}</div>
        ) : (
          <>
            <Info titulo="Gabarito" valor={d?.porVersao?.length ? `${d.porVersao.length} versões` : "não cadastrado"}
              detalhe={d?.porVersao?.length ? `${d.porVersao.map((v: any) => v.versao).join(" ")} · ${d.questoes?.length ?? 0} questões` : "cadastre abaixo"} ok={!!d?.porVersao?.length} />
            <Info titulo="Corrigidos" valor={`${d?.corrigidos ?? 0} / ${d?.totalAlunos ?? 0}`} detalhe={`${d?.ausentes?.length ?? 0} sem cartão lançado`} ok={(d?.corrigidos ?? 0) > 0} />
            <Info titulo="Média" valor={d?.corrigidos ? String(d.media).replace(".", ",") : "—"} detalhe={d?.corrigidos ? `mediana ${String(d.mediana).replace(".", ",")}` : ""} />
            <Info titulo="Nota ≥ 6" valor={d?.corrigidos ? `${d.aprovados6}` : "—"} detalhe={d?.corrigidos ? `${Math.round((d.aprovados6 / d.corrigidos) * 100)}% dos corrigidos` : ""} />
            <Info titulo="Resultado aos alunos" valor={d?.liberado ? "Liberado" : "Oculto"} detalhe={d?.anuladas?.length ? `${d.anuladas.length} questão(ões) anulada(s)` : ""} ok={!!d?.liberado} />
          </>
        )}
      </div>

      {/* Ações */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className={card}>
          <h3 className="font-semibold text-white flex items-center gap-2 mb-1"><Smartphone size={16} className="text-orange-400" /> Corrigir pelo celular</h3>
          <p className="text-xs text-white/50 mb-3">Aponte a câmera do celular para o QR do <b>cartão-resposta</b> do aluno — ele já abre a correção com o nome certo. Ou leia este QR para abrir a correção da turma e escolher o aluno.</p>
          <div className="flex items-center gap-3">
            <div className="bg-white p-2 rounded-lg"><QRCodeSVG value={linkCorrecao} size={96} /></div>
            <a href={linkCorrecao} target="_blank" rel="noreferrer" className="text-xs text-orange-300 underline break-all">{linkCorrecao.replace(BASE, "")}</a>
          </div>
        </div>

        <div className={card}>
          <h3 className="font-semibold text-white flex items-center gap-2 mb-1"><BarChart3 size={16} className="text-orange-400" /> Painel da prova</h3>
          <p className="text-xs text-white/50 mb-3">Distribuição de notas, % de acerto e discriminação por questão, alertas, anulação de questões (recorrige a turma toda) e ausentes.</p>
          <a href={linkPainel} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold">
            <ExternalLink size={14} /> Abrir painel
          </a>
        </div>

        <div className={card}>
          <h3 className="font-semibold text-white flex items-center gap-2 mb-1"><ClipboardCheck size={16} className="text-orange-400" /> Resultado para os alunos</h3>
          <p className="text-xs text-white/50 mb-3">Quando liberado, cada aluno vê nota, respostas e gabarito da sua versão na aba <b>Provas</b> da Área do Aluno. Libere só depois da 2ª chamada.</p>
          <button onClick={alternarLiberacao} disabled={!d || liberar.isPending}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 ${d?.liberado ? "bg-white/10 text-white hover:bg-white/20" : "bg-green-600 hover:bg-green-700 text-white"}`}>
            {d?.liberado ? <><EyeOff size={14} /> Recolher resultado</> : <><Eye size={14} /> Liberar resultado</>}
          </button>
        </div>
      </div>

      {/* Gabarito */}
      <div className={card}>
        <h3 className="font-semibold text-white flex items-center gap-2 mb-1"><FileKey size={16} className="text-orange-400" /> Cadastrar ou atualizar gabarito</h3>
        <p className="text-xs text-white/50 mb-3">
          Digite as letras em sequência (ex.: <code className="text-orange-300">BDAECACEBD…</code>) — espaços e números são ignorados.
          Preencha só as versões que quer gravar; as outras ficam como estão. Para a 2ª chamada da {prova}, use versões novas (ex.: <b>F</b> e <b>G</b>) na mesma prova.
          Alterar um gabarito <b>não</b> recorrige automaticamente — use "Recorrigir todos" no painel.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2">
          {VERSOES.map((v) => {
            const qtd = (textos[v] || "").replace(/[^A-Ea-e]/g, "").length;
            const existente = d?.porVersao?.some((x: any) => x.versao === v);
            return (
              <label key={v} className="block">
                <span className="text-xs text-white/60">Versão {v} {existente && <span className="text-green-400">· cadastrada</span>} {qtd > 0 && <span className="text-orange-300">· {qtd} letras</span>}</span>
                <input value={textos[v] || ""} onChange={(e) => setTextos((t) => ({ ...t, [v]: e.target.value }))}
                  placeholder={existente ? "manter atual" : "ex.: BDAEC…"}
                  className="w-full mt-1 px-2 py-1.5 rounded-md bg-secondary border border-border text-sm font-mono uppercase text-foreground placeholder:normal-case placeholder:text-muted-foreground" />
              </label>
            );
          })}
        </div>
        <button onClick={salvarGabarito} disabled={salvar.isPending || versoesPreenchidas.length === 0}
          className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold disabled:opacity-50">
          {salvar.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Salvar gabarito ({versoesPreenchidas.join(", ") || "nenhuma versão"})
        </button>
      </div>

      {/* Gabarito comentado */}
      <GabaritoComentado teacherToken={teacherToken} classId={classId} prova={prova} />

      {/* Tela antiga */}
      {legado && (
        <details className="rounded-xl border border-white/10 bg-white/[0.02]">
          <summary className="cursor-pointer px-4 py-3 text-sm text-white/60 flex items-center gap-2">
            <QrCode size={14} /> Ferramentas antigas (Quiz ao Vivo, impressão antiga) — não usadas na correção por QR
          </summary>
          <div className="p-4 border-t border-white/10">{legado}</div>
        </details>
      )}
    </div>
  );
}

function Info({ titulo, valor, detalhe, ok }: { titulo: string; valor: string; detalhe?: string; ok?: boolean }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <p className="text-[11px] uppercase tracking-wide text-white/40">{titulo}</p>
      <p className={`text-lg font-bold ${ok ? "text-green-400" : "text-white"}`}>{valor}</p>
      {detalhe && <p className="text-[11px] text-white/45">{detalhe}</p>}
    </div>
  );
}
