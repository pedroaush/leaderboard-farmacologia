/**
 * Envia um arquivo de até 250 MB direto para o Cloudflare R2, com progresso.
 * O arquivo não passa pelo servidor da plataforma.
 */
export const LIMITE_MATERIAL_MB = 250;

const MIME_POR_EXTENSAO: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
  mp4: "video/mp4",
};

export function tipoDoArquivo(file: File): string {
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  return MIME_POR_EXTENSAO[ext] || file.type || "application/octet-stream";
}

type Opcoes = {
  password: string;
  title: string;
  description?: string;
  module?: string;
  week?: number;
  pedirEnvio: (i: { password: string; fileName: string; mimeType: string; tamanho: number }) => Promise<{ uploadUrl: string; fileKey: string }>;
  confirmar: (i: {
    password: string; fileKey: string; fileName: string; mimeType: string;
    title: string; description?: string; module?: string; week?: number;
  }) => Promise<{ id: unknown; url: string }>;
  onProgresso?: (pct: number) => void;
};

export async function enviarMaterialGrande(file: File, o: Opcoes) {
  if (file.size > LIMITE_MATERIAL_MB * 1024 * 1024) {
    throw new Error(`O arquivo tem ${(file.size / 1048576).toFixed(1)} MB; o limite é ${LIMITE_MATERIAL_MB} MB.`);
  }
  const mimeType = tipoDoArquivo(file);
  const { uploadUrl, fileKey } = await o.pedirEnvio({
    password: o.password, fileName: file.name, mimeType, tamanho: file.size,
  });

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", mimeType);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) o.onProgresso?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300
      ? resolve()
      : reject(new Error(`Falha no envio ao armazenamento (HTTP ${xhr.status}).`)));
    xhr.onerror = () => reject(new Error("Falha de rede no envio. Verifique a conexão e a regra de CORS do bucket."));
    xhr.send(file);
  });

  return o.confirmar({
    password: o.password, fileKey, fileName: file.name, mimeType,
    title: o.title, description: o.description, module: o.module ?? "Geral", week: o.week,
  });
}