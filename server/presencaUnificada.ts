/**
 * Presença unificada.
 *
 * A plataforma tinha DOIS sistemas de presença que não conversavam:
 *   • QR Code (projetor)  → grava em `attendanceRecords`
 *   • Painel Admin → Frequência, "Minha Presença" do aluno → leem a tabela `attendance`
 * Resultado: o aluno registrava pelo QR Code e a presença não aparecia em lugar nenhum.
 *
 * Aqui, toda presença do QR Code (inclusive as já gravadas e as aprovadas
 * manualmente) é copiada para `attendance`, uma por aluno por dia, com a semana
 * do semestre calculada pela data (Semana 1 = SEMESTRE_INICIO, padrão 18/08/2026).
 * Roda logo após cada check-in e, por garantia, a cada 10 minutos.
 */
import { getRawDb } from "./db";

const DIA = 86_400_000;
const INICIO = Date.parse(`${process.env.SEMESTRE_INICIO || "2026-08-18"}T00:00:00-03:00`);

/** "2026-11-17" no horário de Brasília */
export const dataSP = (d: Date | string | number) => new Date(d).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
/** Semana do semestre de uma data "AAAA-MM-DD" */
export const semanaDaData = (iso: string) =>
  Math.max(1, Math.floor((Date.parse(`${iso}T12:00:00-03:00`) - INICIO) / (7 * DIA)) + 1);

let rodando = false;

/** Copia para `attendance` toda presença do QR Code que ainda não está lá. Nunca lança erro. */
export async function sincronizarPresencas(): Promise<{ copiadas: number }> {
  if (rodando) return { copiadas: 0 };
  rodando = true;
  try {
    const raw: any = await getRawDb();
    if (!raw) return { copiadas: 0 };
    const [qr] = await raw.execute(
      `SELECT r.memberId, r.checkedInAt, r.latitude, r.longitude, r.distanceMeters, r.isValid, sa.id AS contaId
         FROM attendanceRecords r
         LEFT JOIN studentAccounts sa ON sa.memberId = r.memberId
        WHERE r.isValid = 1`
    );
    const [existentes] = await raw.execute("SELECT memberId, classDate FROM attendance");
    const ja = new Set((existentes as any[]).map((a) => `${a.memberId}|${String(a.classDate).slice(0, 10)}`));

    let copiadas = 0;
    for (const r of qr as any[]) {
      const dia = dataSP(r.checkedInAt);
      const chave = `${r.memberId}|${dia}`;
      if (ja.has(chave)) continue;
      ja.add(chave);
      await raw.execute(
        `INSERT INTO attendance (studentAccountId, memberId, week, classDate, checkedInAt, latitude, longitude, distanceMeters, status, note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'valid', 'QR Code')`,
        [Number(r.contaId) || 0, r.memberId, semanaDaData(dia), dia, new Date(r.checkedInAt), r.latitude ?? null, r.longitude ?? null, r.distanceMeters ?? null]
      );
      copiadas++;
    }
    if (copiadas) console.log(`[Presença] ${copiadas} presença(s) do QR Code copiadas para a Frequência.`);
    return { copiadas };
  } catch (e: any) {
    console.error("[Presença] erro ao sincronizar:", e?.message || e);
    return { copiadas: 0 };
  } finally {
    rodando = false;
  }
}

export function iniciarSincronizacaoPresencas() {
  const g = globalThis as any;
  if (g.__sincPresencas) return;
  g.__sincPresencas = true;
  setTimeout(() => void sincronizarPresencas(), 20_000);
  setInterval(() => void sincronizarPresencas(), 10 * 60_000);
  console.log("[Presença] sincronização QR Code → Frequência ligada");
}
