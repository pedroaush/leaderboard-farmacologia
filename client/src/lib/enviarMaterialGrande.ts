/**
 * Envia um arquivo de até 250 MB direto para o R2, com barra de progresso.
 *
 * Uso no componente de upload:
 *   const pedirEnvio = trpc.materiaisGrandes.pedirEnvio.useMutation();
 *   const confirmar  = trpc.materiaisGrandes.confirmar.useMutation();
 *   await enviarMaterialGrande(file, {
 *     sessionToken, title, description, module, week,
 *     pedirEnvio: pedirEnvio.mutateAsync, confirmar: confirmar.mutateAsync,
 *     onProgresso: (pct) => setProgresso(pct),
 *   });
 */
export const LIMITE_MATERIAL_MB = 250;

type Opcoes = {
  sessionToken: string;
  title: string;
  description?: string;
  module?: string;
  week?: number;
  pedirEnvio: (i: { sessionToken: string; fileName: string; mimeType: string; tamanho: number }) => Promise<{ uploadUrl: string; fileKey: string }>;
  confirmar: (i: any) => Promise<{ success: boolean; id: number }>;
  onProgresso?: (pct: number) => void;
};

export async function enviarMaterialGrande(file: File, o: Opcoes) {
  if (file.size > LIMITE_MATERIAL_MB * 1024 * 1024) {
    throw new Error(`O arquivo tem ${(file.size / 1048576).toFixed(1)} MB; o limite é ${LIMITE_MATERIAL_MB} MB.`);
  }
  const mimeType = file.type || "application/octet-stream";
  const { uploadUrl, fileKey } = await o.pedirEnvio({
    sessionToken: o.sessionToken, fileName: file.name, mimeType, tamanho: file.size,
  });

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", mimeType);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) o.onProgresso?.(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Falha no envio (HTTP ${xhr.status}).`)));
    xhr.onerror = () => reject(new Error("Falha de rede no envio. Verifique a conexão e o CORS do bucket."));
    xhr.send(file);
  });

  return o.confirmar({
    sessionToken: o.sessionToken, fileKey, fileName: file.name, mimeType,
    title: o.title, description: o.description, module: o.module ?? "Geral", week: o.week,
  });
}
