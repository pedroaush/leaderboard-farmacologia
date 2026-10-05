/**
 * Correção de cartão-resposta por QR Code — /correcao?p=P1&c=1&k=007&m=123
 *
 * 1. O professor/monitor aponta a câmera do celular para o QR do cartão
 *    (pela câmera do próprio celular ou pelo botão "Ler cartão" desta tela).
 * 2. A tela abre já com o aluno do cartão; confere-se a versão e as 20
 *    marcações, tocando nas letras.
 * 3. "Salvar e lançar nota": o servidor corrige com o gabarito da versão e
 *    grava a nota P1 na Planilha de Notas.
 */
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useStudentAuth } from "@/pages/StudentLogin";
import jsQR from "jsqr";
import { Camera, CheckCircle, Loader2, QrCode, Save, X, AlertTriangle, Search } from "lucide-react";

const ORANGE = "#F7941D";
const DARK_BG = "#0A1628";
const CARD_BG = "#0D1B2A";
const LETRAS = ["A", "B", "C", "D", "E"] as const;
type Letra = typeof LETRAS[number];

function lerParametros(url: string) {
  try {
    const u = new URL(url, window.location.origin);
    return {
      prova: (u.searchParams.get("p") || "P1").toUpperCase() as "P1" | "P2",
      classId: Number(u.searchParams.get("c") || 0) || null,
      cartao: u.searchParams.get("k"),
      memberId: Number(u.searchParams.get("m") || 0) || null,
    };
  } catch {
    return null;
  }
}

export default function CorrecaoCartao() {
  const inicial = useMemo(() => lerParametros(window.location.href)!, []);
  const [prova] = useState<"P1" | "P2">(inicial.prova);
  const [classId, setClassId] = useState<number | null>(inicial.classId);
  const [cartao, setCartao] = useState<string | null>(inicial.cartao);
  const [memberId, setMemberId] = useState<number | null>(inicial.memberId);
  const [versao, setVersao] = useState<Letra | null>(null);
  const [respostas, setRespostas] = useState<(Letra | null)[]>([]);
  const [busca, setBusca] = useState("");
  const [resultado, setResultado] = useState<null | { nota: number; acertos: number; total: number; aluno: string }>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [lendo, setLendo] = useState(false);

  // Professor (painel) ou monitor (login de aluno/monitor)
  const { sessionToken: tokenMonitor } = useStudentAuth();
  const token = localStorage.getItem("teacherSessionToken") || localStorage.getItem("sessionToken") || tokenMonitor || "";

  const contexto = trpc.correcaoProva.getContexto.useQuery(
    { sessionToken: token, classId: classId || 0, provaType: prova, memberId: memberId || undefined },
    { enabled: !!token && !!classId, retry: false }
  );
  const lancar = trpc.correcaoProva.lancarCartao.useMutation();

  const numQuestoes = contexto.data?.numQuestoes || 20;

  // Ao trocar de aluno: carrega a correção já lançada (se houver) ou zera
  useEffect(() => {
    setResultado(null);
    setErro(null);
    const l = contexto.data?.lancamento;
    if (l && l.respostas.length === numQuestoes) {
      setVersao(l.versao as Letra);
      setRespostas(l.respostas as (Letra | null)[]);
    } else {
      setVersao(null);
      setRespostas(Array(numQuestoes).fill(null));
    }
  }, [memberId, contexto.data?.lancamento, numQuestoes]);

  const aluno = useMemo(() => {
    if (!memberId) return null;
    return contexto.data?.alunos.find(a => a.id === memberId) || null;
  }, [memberId, contexto.data?.alunos]);

  const marcar = (i: number, l: Letra) => {
    setResultado(null);
    setRespostas(prev => prev.map((r, j) => (j === i ? (r === l ? null : l) : r)));
  };

  const emBranco = respostas.filter(r => r === null).length;

  async function salvar() {
    if (!memberId || !versao || !classId) return;
    setErro(null);
    try {
      const r = await lancar.mutateAsync({ sessionToken: token, classId, provaType: prova, memberId, versao, respostas });
      setResultado({ nota: r.nota, acertos: r.acertos, total: r.total, aluno: r.aluno });
      contexto.refetch();
    } catch (e: any) {
      setErro(e?.message || "Não foi possível salvar");
    }
  }

  const aoLerQr = useCallback((texto: string) => {
    const p = lerParametros(texto);
    if (!p || !p.classId) { setErro("QR não reconhecido como cartão-resposta."); return; }
    setLendo(false);
    setClassId(p.classId);
    setCartao(p.cartao);
    setMemberId(p.memberId);
    setBusca("");
    window.history.replaceState(null, "", `/correcao?p=${p.prova}&c=${p.classId}${p.cartao ? `&k=${p.cartao}` : ""}${p.memberId ? `&m=${p.memberId}` : ""}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  if (!token) {
    return (
      <Tela>
        <div className="rounded-xl p-6 text-center" style={{ backgroundColor: CARD_BG }}>
          <AlertTriangle className="mx-auto mb-3" style={{ color: ORANGE }} />
          <p className="text-white font-semibold">Entre como professor ou monitor para corrigir cartões.</p>
          <p className="text-white/50 text-sm mt-1">Faça login no painel e leia o QR de novo.</p>
        </div>
      </Tela>
    );
  }

  return (
    <Tela>
      {/* Cabeçalho */}
      <div className="flex items-center justify-between gap-2 mb-4">
        <div>
          <h1 className="text-lg font-bold text-white">Correção de cartões — {prova}</h1>
          <p className="text-xs text-white/50">
            {contexto.data?.corretor ? `Corrigindo como ${contexto.data.corretor}` : "Carregando..."}
            {cartao ? ` · cartão nº ${cartao}` : ""}
          </p>
        </div>
        <button onClick={() => setLendo(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-white" style={{ backgroundColor: ORANGE }}>
          <QrCode size={16} /> Ler cartão
        </button>
      </div>

      {lendo && <LeitorQr onLer={aoLerQr} onFechar={() => setLendo(false)} />}

      {!classId ? (
        <Aviso texto="Leia o QR Code de um cartão-resposta para começar." />
      ) : contexto.isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin" style={{ color: ORANGE }} /></div>
      ) : contexto.error ? (
        <Aviso texto={contexto.error.message} erro />
      ) : contexto.data && contexto.data.versoes.length === 0 ? (
        <Aviso texto={`O gabarito da ${prova} ainda não foi cadastrado para esta turma.`} erro />
      ) : (
        <div className="space-y-4">
          {/* Aluno */}
          <div className="rounded-xl p-4" style={{ backgroundColor: CARD_BG }}>
            <p className="text-xs text-white/50 mb-1">Aluno</p>
            {aluno ? (
              <div className="flex items-center justify-between gap-2">
                <p className="text-white font-semibold">{aluno.nome}</p>
                {!inicial.memberId && (
                  <button onClick={() => setMemberId(null)} className="text-xs text-white/50 underline">trocar</button>
                )}
              </div>
            ) : (
              <div>
                <div className="relative mb-2">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                  <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar aluno pelo nome escrito no cartão..."
                    className="w-full pl-8 pr-3 py-2 rounded-lg text-sm text-white" style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }} />
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {(contexto.data?.alunos || [])
                    .filter(a => !busca.trim() || a.nome.toLowerCase().includes(busca.toLowerCase()))
                    .slice(0, 30)
                    .map(a => (
                      <button key={a.id} onClick={() => setMemberId(a.id)}
                        className="w-full text-left px-3 py-2 rounded text-sm text-white/80 hover:bg-white/10">{a.nome}</button>
                    ))}
                </div>
              </div>
            )}
            {contexto.data?.lancamento && (
              <p className="text-xs mt-2" style={{ color: ORANGE }}>
                Este cartão já foi corrigido (nota {contexto.data.lancamento.nota.toFixed(1)}). Salvar de novo substitui a nota.
              </p>
            )}
          </div>

          {memberId && (
            <>
              {/* Versão */}
              <div className="rounded-xl p-4" style={{ backgroundColor: CARD_BG }}>
                <p className="text-xs text-white/50 mb-2">Versão marcada no cartão</p>
                <div className="flex gap-2">
                  {LETRAS.filter(l => contexto.data?.versoes.includes(l)).map(l => (
                    <button key={l} onClick={() => { setVersao(l); setResultado(null); }}
                      className="w-11 h-11 rounded-full font-bold text-base"
                      style={{ backgroundColor: versao === l ? ORANGE : "rgba(255,255,255,0.06)", color: versao === l ? "#fff" : "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.15)" }}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              {/* Respostas */}
              <div className="rounded-xl p-3" style={{ backgroundColor: CARD_BG }}>
                <div className="flex items-center justify-between mb-2 px-1">
                  <p className="text-xs text-white/50">Toque na letra marcada. Toque de novo para deixar em branco (anulada/rasurada).</p>
                  <span className="text-xs text-white/40 shrink-0 ml-2">{emBranco} em branco</span>
                </div>
                <div className="grid gap-1">
                  {respostas.map((r, i) => (
                    <div key={i} className="flex items-center gap-1.5 px-1 py-0.5 rounded" style={{ backgroundColor: i % 2 ? "transparent" : "rgba(255,255,255,0.03)" }}>
                      <span className="w-7 text-right text-sm font-mono font-bold text-white/70">{String(i + 1).padStart(2, "0")}</span>
                      {LETRAS.map(l => (
                        <button key={l} onClick={() => marcar(i, l)}
                          className="flex-1 h-9 rounded-md text-sm font-bold"
                          style={{ backgroundColor: r === l ? ORANGE : "rgba(255,255,255,0.05)", color: r === l ? "#fff" : "rgba(255,255,255,0.45)" }}>
                          {l}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              {/* Salvar */}
              <div className="sticky bottom-0 pb-3 pt-2" style={{ backgroundColor: DARK_BG }}>
                {resultado && (
                  <div className="rounded-lg p-3 mb-2 flex items-center gap-2" style={{ backgroundColor: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.35)" }}>
                    <CheckCircle size={18} className="text-emerald-400 shrink-0" />
                    <p className="text-sm text-white">
                      <b>{resultado.aluno}</b>: nota <b>{resultado.nota.toFixed(1)}</b> ({resultado.acertos}/{resultado.total}) lançada na planilha.
                    </p>
                  </div>
                )}
                {erro && <p className="text-sm text-red-400 mb-2">{erro}</p>}
                <div className="flex gap-2">
                  <button onClick={salvar} disabled={!versao || lancar.isPending}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-white disabled:opacity-40" style={{ backgroundColor: ORANGE }}>
                    {lancar.isPending ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                    {versao ? "Salvar e lançar nota" : "Escolha a versão"}
                  </button>
                  {resultado && (
                    <button onClick={() => setLendo(true)} className="flex items-center gap-1.5 px-4 rounded-xl font-semibold text-white" style={{ backgroundColor: "rgba(255,255,255,0.1)" }}>
                      <Camera size={18} /> Próximo
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </Tela>
  );
}

function Tela({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ backgroundColor: DARK_BG }}>
      <div className="max-w-lg mx-auto px-3 py-4">{children}</div>
    </div>
  );
}

function Aviso({ texto, erro }: { texto: string; erro?: boolean }) {
  return (
    <div className="rounded-xl p-5 text-center" style={{ backgroundColor: CARD_BG }}>
      <p className={erro ? "text-red-400 text-sm" : "text-white/60 text-sm"}>{texto}</p>
    </div>
  );
}

/** Leitor de QR pela câmera (mesma biblioteca jsQR da página de presença). */
function LeitorQr({ onLer, onFechar }: { onLer: (t: string) => void; onFechar: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [falha, setFalha] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let ativo = true;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (!ativo || !videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        timer = setInterval(() => {
          const v = videoRef.current, c = canvasRef.current;
          if (!v || !c || v.videoWidth === 0) return;
          c.width = v.videoWidth; c.height = v.videoHeight;
          const ctx = c.getContext("2d"); if (!ctx) return;
          ctx.drawImage(v, 0, 0);
          const img = ctx.getImageData(0, 0, c.width, c.height);
          const code = jsQR(img.data, img.width, img.height);
          if (code?.data) onLer(code.data);
        }, 250);
      } catch {
        setFalha("Não foi possível abrir a câmera. Verifique a permissão do navegador.");
      }
    })();
    return () => {
      ativo = false;
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach(t => t.stop());
    };
  }, [onLer]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: "rgba(0,0,0,0.92)" }}>
      <div className="flex items-center justify-between p-3">
        <p className="text-white text-sm font-semibold">Aponte para o QR do cartão</p>
        <button onClick={onFechar} className="p-2 text-white/70"><X size={22} /></button>
      </div>
      <div className="flex-1 flex items-center justify-center px-3">
        {falha ? <p className="text-red-400 text-sm text-center">{falha}</p> : (
          <video ref={videoRef} playsInline muted className="w-full max-w-md rounded-xl" />
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
}
