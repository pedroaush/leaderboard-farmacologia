import { useEffect, useState } from "react";
import { Bell, BellOff, Share, Loader2, CheckCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { ativarPush, desativarPush, situacaoPush, type SituacaoPush } from "@/lib/push";

const ORANGE = "#F7941D";
const CARD_BG = "#0D1B2A";

/**
 * Cartão "Receber avisos no celular" para a Área do Aluno.
 * Fica compacto quando já está ativo.
 */
export default function AtivarNotificacoes({ sessionToken }: { sessionToken: string | null }) {
  const [situacao, setSituacao] = useState<SituacaoPush | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const { data: config } = trpc.notificacoes.chavePublica.useQuery(undefined, { staleTime: Infinity });
  const inscrever = trpc.notificacoes.inscrever.useMutation();
  const desinscrever = trpc.notificacoes.desinscrever.useMutation();

  useEffect(() => {
    situacaoPush().then(setSituacao).catch(() => setSituacao("sem-suporte"));
  }, []);

  if (!sessionToken || !situacao || !config?.ativo || !config.chave) return null;

  async function ativar() {
    setErro(null);
    setOcupado(true);
    try {
      await ativarPush(config!.chave!, (d) => inscrever.mutateAsync({ sessionToken: sessionToken!, ...d }));
      setSituacao("ativo");
    } catch (e: any) {
      setErro(e?.message || "Não foi possível ativar.");
      setSituacao(await situacaoPush());
    } finally {
      setOcupado(false);
    }
  }

  async function desativar() {
    setOcupado(true);
    try {
      await desativarPush((endpoint) => desinscrever.mutateAsync({ endpoint }));
      setSituacao("inativo");
    } finally {
      setOcupado(false);
    }
  }

  if (situacao === "ativo") {
    return (
      <div className="mb-4 flex items-center justify-between gap-3 rounded-lg px-4 py-2.5 text-sm"
        style={{ backgroundColor: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)" }}>
        <span className="flex items-center gap-2 text-green-300">
          <CheckCircle size={16} /> Avisos no celular ativados neste aparelho
        </span>
        <button onClick={desativar} disabled={ocupado} className="text-xs text-white/50 hover:text-white/80 underline">
          desativar
        </button>
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-xl p-4" style={{ backgroundColor: CARD_BG, border: `1px solid ${ORANGE}55` }}>
      <div className="flex items-start gap-3">
        <Bell size={22} style={{ color: ORANGE }} className="mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-white text-sm sm:text-base">Receba avisos no celular</h3>

          {situacao === "inativo" && (
            <>
              <p className="text-white/60 text-xs sm:text-sm mt-1">
                Seja avisado na hora quando o professor publicar aula, material ou aviso.
              </p>
              <button onClick={ativar} disabled={ocupado}
                className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-60"
                style={{ backgroundColor: ORANGE }}>
                {ocupado ? <Loader2 size={14} className="animate-spin" /> : <Bell size={14} />}
                Ativar notificações
              </button>
            </>
          )}

          {situacao === "iphone-instalar" && (
            <div className="text-white/70 text-xs sm:text-sm mt-1 space-y-1">
              <p>No iPhone, as notificações só funcionam com a plataforma instalada na tela inicial:</p>
              <ol className="list-decimal ml-5 space-y-0.5">
                <li>Abra este site no <b>Safari</b>.</li>
                <li>Toque em <Share size={13} className="inline -mt-0.5" /> <b>Compartilhar</b> → <b>Adicionar à Tela de Início</b>.</li>
                <li>Abra pelo ícone criado, entre na sua conta e toque em <b>Ativar notificações</b>.</li>
              </ol>
            </div>
          )}

          {situacao === "bloqueado" && (
            <p className="text-white/70 text-xs sm:text-sm mt-1 flex items-start gap-1.5">
              <BellOff size={14} className="mt-0.5 flex-shrink-0" />
              As notificações estão bloqueadas para este site. Libere em: cadeado ao lado do endereço → Notificações → Permitir, e recarregue a página.
            </p>
          )}

          {situacao === "sem-suporte" && (
            <p className="text-white/50 text-xs sm:text-sm mt-1">
              Este navegador não recebe notificações. No Android use o Chrome; no iPhone, o Safari (iOS 16.4 ou mais novo).
            </p>
          )}

          {erro && <p className="text-red-400 text-xs mt-2">{erro}</p>}
        </div>
      </div>
    </div>
  );
}
