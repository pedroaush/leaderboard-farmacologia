/** Ativação das notificações no celular (Web Push). */

export type SituacaoPush =
  | "sem-suporte"      // navegador não suporta
  | "iphone-instalar"  // iPhone/iPad: precisa adicionar à Tela de Início primeiro
  | "bloqueado"        // aluno negou a permissão
  | "inativo"          // pode ativar
  | "ativo";           // já ativo neste aparelho

function ehIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function abertoComoApp() {
  return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as any).standalone === true;
}

export async function situacaoPush(): Promise<SituacaoPush> {
  if (ehIOS() && !abertoComoApp()) return "iphone-instalar";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "sem-suporte";
  if (Notification.permission === "denied") return "bloqueado";
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === "granted" ? "ativo" : "inativo";
}

function base64ParaUint8(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b);
  return Uint8Array.from([...bin].map((c) => c.charCodeAt(0)));
}

/** Registra o service worker cedo, para que notificações cheguem mesmo com o site fechado. */
export function registrarServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((e) => console.warn("[Push] SW:", e));
  }
}

export async function ativarPush(
  chavePublica: string,
  enviarAoServidor: (d: { endpoint: string; p256dh: string; auth: string; userAgent: string }) => Promise<unknown>
) {
  const permissao = await Notification.requestPermission();
  if (permissao !== "granted") throw new Error("Permissão negada. Libere as notificações nas configurações do navegador.");
  const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64ParaUint8(chavePublica),
    });
  }
  const json = sub.toJSON() as any;
  await enviarAoServidor({
    endpoint: sub.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth,
    userAgent: navigator.userAgent,
  });
}

export async function desativarPush(avisarServidor: (endpoint: string) => Promise<unknown>) {
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await avisarServidor(sub.endpoint).catch(() => {});
    await sub.unsubscribe();
  }
}
