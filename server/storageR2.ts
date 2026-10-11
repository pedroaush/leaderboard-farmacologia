/**
 * Armazenamento de arquivos grandes (até 250 MB) no Cloudflare R2.
 *
 * O arquivo NÃO passa pelo servidor da plataforma: o servidor só gera um
 * endereço assinado (válido por 15 min) e o navegador envia o arquivo direto
 * para o R2. Para baixar, o servidor gera outro endereço assinado (1 h).
 *
 * Variáveis de ambiente (Railway → Variables):
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
 *
 * Dependências: pnpm add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
 */
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const R2_PREFIXO = "r2:"; // marca, em materials.fileKey, os arquivos guardados no R2
export const R2_TAMANHO_MAXIMO = 250 * 1024 * 1024;

let cliente: S3Client | null = null;

export function r2Configurado(): boolean {
  return !!(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET);
}

function getCliente(): S3Client {
  if (!r2Configurado()) throw new Error("Armazenamento R2 não configurado (variáveis R2_* ausentes no servidor).");
  if (!cliente) {
    cliente = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      // Versões recentes do SDK colocam "checksum" no endereço assinado, o que
      // faz o R2 recusar o envio feito pelo navegador. Desligado aqui.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }
  return cliente;
}

/** Endereço assinado para o navegador enviar o arquivo (PUT), válido por 15 minutos. */
export async function r2UrlDeEnvio(chave: string, contentType: string, _tamanho?: number): Promise<string> {
  return getSignedUrl(
    getCliente(),
    new PutObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: chave, ContentType: contentType }),
    { expiresIn: 15 * 60, signableHeaders: new Set(["content-type"]) }
  );
}

/** Endereço assinado para baixar/abrir o arquivo, válido por 1 hora. */
export async function r2UrlDeLeitura(chave: string, nomeArquivo?: string | null, abrirNoNavegador = false): Promise<string> {
  const nome = (nomeArquivo || chave.split("/").pop() || "arquivo").replace(/"/g, "");
  return getSignedUrl(
    getCliente(),
    new GetObjectCommand({
      Bucket: process.env.R2_BUCKET!,
      Key: chave,
      ResponseContentDisposition: `${abrirNoNavegador ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(nome)}`,
    }),
    { expiresIn: 60 * 60 }
  );
}

export async function r2Apagar(chave: string): Promise<void> {
  await getCliente().send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: chave }));
}

/** Gera uma chave única e segura a partir do nome original do arquivo. */
export function r2NovaChave(pasta: string, nomeOriginal: string): string {
  const limpo = nomeOriginal
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .slice(-120);
  const aleatorio = Math.random().toString(36).slice(2, 10);
  return `${pasta}/${Date.now()}-${aleatorio}-${limpo}`;
}