// Storage helpers — usa Cloudinary se configurado, caso contrário usa o proxy Manus
import { ENV } from './_core/env';
import { v2 as cloudinary } from 'cloudinary';

// ─── Cloudinary ───────────────────────────────────────────────────────────────

function isCloudinaryConfigured(): boolean {
  return !!(ENV.cloudinaryCloudName && ENV.cloudinaryApiKey && ENV.cloudinaryApiSecret);
}

function initCloudinary() {
  cloudinary.config({
    cloud_name: ENV.cloudinaryCloudName,
    api_key: ENV.cloudinaryApiKey,
    api_secret: ENV.cloudinaryApiSecret,
    secure: true,
  });
}

async function cloudinaryPut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  initCloudinary();

  // Converter para base64 data URI
  const buffer = typeof data === "string" ? Buffer.from(data, "base64") : Buffer.from(data as any);
  const base64 = buffer.toString("base64");
  const dataUri = `data:${contentType};base64,${base64}`;

  // Determinar resource_type baseado no mimeType
  let resourceType: "raw" | "image" | "video" | "auto" = "raw";
  if (contentType.startsWith("image/")) resourceType = "image";
  else if (contentType.startsWith("video/")) resourceType = "video";

  // Usar o relKey como public_id (sem extensão para raw)
  const publicId = relKey.replace(/^\/+/, "").replace(/\.[^.]+$/, "");
  const folder = "farmacologia-materiais";

  const result = await cloudinary.uploader.upload(dataUri, {
    public_id: publicId,
    folder,
    resource_type: resourceType,
    use_filename: true,
    unique_filename: true,
    overwrite: false,
  });

  return {
    key: result.public_id,
    url: result.secure_url,
  };
}

async function cloudinaryGet(relKey: string): Promise<{ key: string; url: string }> {
  initCloudinary();
  const key = relKey.replace(/^\/+/, "");
  // O upload usa folder "farmacologia-materiais", então o public_id completo inclui esse prefixo
  const fullKey = key.startsWith("farmacologia-materiais/") ? key : `farmacologia-materiais/${key}`;
  // Gerar URL assinada com validade de 1 hora
  const url = cloudinary.url(fullKey, {
    resource_type: "raw",
    secure: true,
    sign_url: true,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
  });
  return { key, url };
}

// ─── Fallback: proxy Manus ────────────────────────────────────────────────────

type StorageConfig = { baseUrl: string; apiKey: string };

function getStorageConfig(): StorageConfig {
  const baseUrl = ENV.forgeApiUrl;
  const apiKey = ENV.forgeApiKey;

  if (!baseUrl || !apiKey) {
    throw new Error(
      "Storage proxy credentials missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY"
    );
  }

  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey };
}

function buildUploadUrl(baseUrl: string, relKey: string): URL {
  const url = new URL("v1/storage/upload", ensureTrailingSlash(baseUrl));
  url.searchParams.set("path", normalizeKey(relKey));
  return url;
}

async function buildDownloadUrl(
  baseUrl: string,
  relKey: string,
  apiKey: string
): Promise<string> {
  const downloadApiUrl = new URL(
    "v1/storage/downloadUrl",
    ensureTrailingSlash(baseUrl)
  );
  downloadApiUrl.searchParams.set("path", normalizeKey(relKey));
  const response = await fetch(downloadApiUrl, {
    method: "GET",
    headers: buildAuthHeaders(apiKey),
  });
  return (await response.json()).url;
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function toFormData(
  data: Buffer | Uint8Array | string,
  contentType: string,
  fileName: string
): FormData {
  const blob =
    typeof data === "string"
      ? new Blob([data], { type: contentType })
      : new Blob([data as any], { type: contentType });
  const form = new FormData();
  form.append("file", blob, fileName || "file");
  return form;
}

function buildAuthHeaders(apiKey: string): HeadersInit {
  return { Authorization: `Bearer ${apiKey}` };
}

// ─── Exports públicos ─────────────────────────────────────────────────────────

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  // Usar Cloudinary se configurado
  if (isCloudinaryConfigured()) {
    return cloudinaryPut(relKey, data, contentType);
  }

  // Fallback: proxy Manus
  const { baseUrl, apiKey } = getStorageConfig();
  const key = normalizeKey(relKey);
  const uploadUrl = buildUploadUrl(baseUrl, key);
  const formData = toFormData(data, contentType, key.split("/").pop() ?? key);
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: buildAuthHeaders(apiKey),
    body: formData,
  });

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(
      `Storage upload failed (${response.status} ${response.statusText}): ${message}`
    );
  }
  const url = (await response.json()).url;
  return { key, url };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  // Usar Cloudinary se configurado
  if (isCloudinaryConfigured()) {
    return cloudinaryGet(relKey);
  }

  // Fallback: proxy Manus
  const { baseUrl, apiKey } = getStorageConfig();
  const key = normalizeKey(relKey);
  return {
    key,
    url: await buildDownloadUrl(baseUrl, key, apiKey),
  };
}
