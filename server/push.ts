/**
 * Notificações no celular (Web Push) — Conexão em Farmacologia
 *
 * O aluno ativa as notificações na Área do Aluno; o navegador gera uma
 * "inscrição" que fica guardada na tabela pushSubscriptions (criada sozinha
 * no primeiro uso). Quando um material é publicado, o servidor envia a
 * notificação para todas as inscrições da turma.
 *
 * Variáveis de ambiente (Railway → Variables):
 *   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (ex.: mailto:seu@email)
 *
 * Dependências: pnpm add web-push && pnpm add -D @types/web-push
 */
import webpush from "web-push";
import { getRawDb } from "./db";

export type MensagemPush = {
  title: string;
  body: string;
  /** Caminho aberto ao tocar na notificação. "{classId}" é trocado pela turma do aluno. */
  url?: string;
  tag?: string;
};

let configurado: boolean | null = null;

export function pushConfigurado(): boolean {
  if (configurado !== null) return configurado;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return (configurado = false);
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:contato@conexaofarmacologia.com.br", pub, priv);
  return (configurado = true);
}

export function chavePublicaPush(): string | null {
  return process.env.VAPID_PUBLIC_KEY || null;
}

let tabelaPronta = false;
async function garantirTabela() {
  if (tabelaPronta) return;
  const raw = await getRawDb();
  if (!raw) throw new Error("Banco indisponível");
  await raw.execute(`
    CREATE TABLE IF NOT EXISTS \`pushSubscriptions\` (
      \`id\` int AUTO_INCREMENT PRIMARY KEY,
      \`memberId\` int NOT NULL,
      \`classId\` int NULL,
      \`endpoint\` varchar(700) NOT NULL,
      \`p256dh\` varchar(255) NOT NULL,
      \`auth\` varchar(255) NOT NULL,
      \`userAgent\` varchar(300) NULL,
      \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`lastSuccessAt\` timestamp NULL,
      UNIQUE KEY \`uq_push_endpoint\` (\`endpoint\`(500)),
      KEY \`idx_push_class\` (\`classId\`),
      KEY \`idx_push_member\` (\`memberId\`)
    )
  `);
  tabelaPronta = true;
}

export async function salvarInscricao(dados: {
  memberId: number;
  classId: number | null;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
}) {
  await garantirTabela();
  const raw = await getRawDb();
  await raw!.execute(
    `INSERT INTO \`pushSubscriptions\` (memberId, classId, endpoint, p256dh, auth, userAgent)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE memberId = VALUES(memberId), classId = VALUES(classId),
       p256dh = VALUES(p256dh), auth = VALUES(auth), userAgent = VALUES(userAgent)`,
    [dados.memberId, dados.classId, dados.endpoint, dados.p256dh, dados.auth, (dados.userAgent || "").slice(0, 300)]
  );
}

export async function removerInscricao(endpoint: string) {
  await garantirTabela();
  const raw = await getRawDb();
  await raw!.execute(`DELETE FROM \`pushSubscriptions\` WHERE endpoint = ?`, [endpoint]);
}

type Linha = { id: number; classId: number | null; endpoint: string; p256dh: string; auth: string };

async function enviarParaLinhas(linhas: Linha[], msg: MensagemPush) {
  const raw = await getRawDb();
  let enviados = 0;
  let removidos = 0;
  // Envia em lotes de 20 para não sobrecarregar
  for (let i = 0; i < linhas.length; i += 20) {
    const lote = linhas.slice(i, i + 20);
    await Promise.all(
      lote.map(async (l) => {
        const url = (msg.url || "/aluno/{classId}?tab=materiais").replace("{classId}", String(l.classId ?? 1));
        const payload = JSON.stringify({ title: msg.title, body: msg.body, url, tag: msg.tag || "conexao" });
        try {
          await webpush.sendNotification(
            { endpoint: l.endpoint, keys: { p256dh: l.p256dh, auth: l.auth } },
            payload,
            { TTL: 60 * 60 * 24 * 3, urgency: "normal" }
          );
          enviados++;
          await raw!.execute(`UPDATE \`pushSubscriptions\` SET lastSuccessAt = NOW() WHERE id = ?`, [l.id]);
        } catch (e: any) {
          // 404/410 = o aluno desativou ou o celular trocou de inscrição → apaga
          if (e?.statusCode === 404 || e?.statusCode === 410) {
            removidos++;
            await raw!.execute(`DELETE FROM \`pushSubscriptions\` WHERE id = ?`, [l.id]);
          } else {
            console.warn("[Push] falha no envio:", e?.statusCode, e?.body || e?.message);
          }
        }
      })
    );
  }
  return { total: linhas.length, enviados, removidos };
}

/** Envia para todos os inscritos; se classId vier, só para essa turma. */
export async function enviarPush(msg: MensagemPush, filtro?: { classId?: number | null; memberId?: number }) {
  if (!pushConfigurado()) return { total: 0, enviados: 0, removidos: 0, motivo: "VAPID não configurado" };
  await garantirTabela();
  const raw = await getRawDb();
  let sql = `SELECT id, classId, endpoint, p256dh, auth FROM \`pushSubscriptions\``;
  const params: any[] = [];
  if (filtro?.memberId) {
    sql += ` WHERE memberId = ?`;
    params.push(filtro.memberId);
  } else if (filtro?.classId) {
    sql += ` WHERE classId = ?`;
    params.push(filtro.classId);
  }
  const [rows] = await raw!.execute(sql, params);
  return enviarParaLinhas(rows as Linha[], msg);
}

/** Aviso de material novo. Nunca derruba a publicação se falhar. */
export function avisarMaterialNovo(material: { title: string; type?: string; module?: string | null; classId?: number | null }) {
  const tipo = material.type === "link" ? "Novo link" : material.type === "comment" ? "Novo aviso" : "Novo material";
  const modulo = material.module && material.module !== "Geral" ? ` · ${material.module}` : "";
  enviarPush(
    { title: `${tipo} na plataforma`, body: `${material.title}${modulo}`, url: "/aluno/{classId}?tab=materiais", tag: "material" },
    material.classId ? { classId: material.classId } : undefined
  )
    .then((r) => console.log("[Push] material:", r))
    .catch((e) => console.warn("[Push] erro ao avisar material:", e?.message || e));
}

export async function contarInscritos(): Promise<{ classId: number | null; total: number }[]> {
  await garantirTabela();
  const raw = await getRawDb();
  const [rows] = await raw!.execute(
    `SELECT classId, COUNT(*) AS total FROM \`pushSubscriptions\` GROUP BY classId ORDER BY classId`
  );
  return (rows as any[]).map((r) => ({ classId: r.classId, total: Number(r.total) }));
}
