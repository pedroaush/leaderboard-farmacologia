/**
 * tRPC Router para Presença com QR Code
 */


import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { z } from "zod";
import { getDb, getTeacherAccountBySessionToken } from "../db";
import { attendance, attendanceManualRequests, qrCodeSessions, studentAccounts, systemSettings, members } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { notifyAttendanceCheckIn } from "../_core/attendanceNotifications";
import {
  generateQRCodeToken,
  calculateDistance,
  generateQRCodeImageUrl,
} from "../_core/attendanceQRCode";

// Valores padrão (usados apenas se uma sessão ainda não tiver configuração
// própria — ex.: a primeira vez que o QR é gerado para uma turma/semana).
// Antes, esses valores estavam FIXOS no código (attendanceQRCode.ts); agora
// são só o ponto de partida, e cada sessão pode ter os seus próprios.
const DEFAULT_GEO_LAT = -23.5505; // Sala D201, Frei Caneca 94
const DEFAULT_GEO_LON = -46.6333;
const DEFAULT_GEO_RADIUS = 100;
const DEFAULT_DAY_OF_WEEK = 2; // Terça-feira
const DEFAULT_START_TIME = "07:30";
const DEFAULT_END_TIME = "13:00";

/** Calcula a semana do semestre (1-17) a partir de systemSettings.startDate. */
async function calcularSemanaSemestre(db: any, classDate: string): Promise<number> {
  const settings = await db.select().from(systemSettings).limit(1);
  const startDate = settings[0]?.startDate;
  if (!startDate) return 1; // sem data configurada, assume semana 1 (defensivo)

  const diffDias = Math.floor((new Date(classDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24));
  const semana = Math.floor(diffDias / 7) + 1;
  return Math.max(1, Math.min(17, semana));
}

/** Verifica se a data/hora atual está dentro da janela configurada na sessão. */
function dentroDoHorario(now: Date, dayOfWeek: number, startTime: string, endTime: string): { valid: boolean; error?: string } {
  const BRT_OFFSET_MS = -3 * 60 * 60 * 1000;
  const brt = new Date(now.getTime() + BRT_OFFSET_MS);
  const diaAtual = brt.getUTCDay();
  const minutosAtual = brt.getUTCHours() * 60 + brt.getUTCMinutes();

  const [hIni, mIni] = startTime.split(":").map(Number);
  const [hFim, mFim] = endTime.split(":").map(Number);
  const minutosIni = hIni * 60 + mIni;
  const minutosFim = hFim * 60 + mFim;

  if (diaAtual !== dayOfWeek) {
    return { valid: false, error: "Presença não permitida neste dia da semana" };
  }
  if (minutosAtual < minutosIni || minutosAtual >= minutosFim) {
    return { valid: false, error: `Presença só é permitida entre ${startTime} e ${endTime} (horário de Brasília)` };
  }
  return { valid: true };
}

/** Resolve o memberId real a partir da conta do aluno autenticado. */
async function resolveMemberId(db: any, studentAccountId: number): Promise<number> {
  const account = await db.select().from(studentAccounts).where(eq(studentAccounts.id, studentAccountId)).limit(1);
  if (!account.length || !account[0].memberId) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Conta não vinculada a um aluno (memberId ausente)" });
  }
  return account[0].memberId;
}

export const attendanceRouter = router({
  /**
   * Professor: Gerar (ou renovar) o QR code da aula de hoje.
   * Persiste em qrCodeSessions — sobrevive a reinício do servidor.
   */
  generateQRCode: publicProcedure
    .input(
      z.object({
        sessionToken: z.string(),
        classId: z.number(),
        classDate: z.string(), // "YYYY-MM-DD"
        geoLatitude: z.number().optional(),
        geoLongitude: z.number().optional(),
        geoRadiusMeters: z.number().optional(),
        geoValidationEnabled: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const teacher = await getTeacherAccountBySessionToken(input.sessionToken);
        if (!teacher) throw new TRPCError({ code: "FORBIDDEN", message: "Token inválido" });

        const weekNumber = await calcularSemanaSemestre(db, input.classDate);
        const qrData = generateQRCodeToken(input.classId, input.classDate);

        // Encontra a sessão da turma+semana, ou cria uma nova
        const existing = await db
          .select()
          .from(qrCodeSessions)
          .where(and(eq(qrCodeSessions.classId, input.classId), eq(qrCodeSessions.weekNumber, weekNumber)))
          .limit(1);

        if (existing.length > 0) {
          await db.update(qrCodeSessions)
            .set({
              currentToken: qrData.token,
              tokenExpiresAt: new Date(qrData.expiresAt),
              tokenRotationCount: (existing[0].tokenRotationCount || 0) + 1,
              isActive: true,
              ...(input.geoLatitude !== undefined ? { geoLatitude: String(input.geoLatitude) } : {}),
              ...(input.geoLongitude !== undefined ? { geoLongitude: String(input.geoLongitude) } : {}),
              ...(input.geoRadiusMeters !== undefined ? { geoRadiusMeters: input.geoRadiusMeters } : {}),
              ...(input.geoValidationEnabled !== undefined ? { geoValidationEnabled: input.geoValidationEnabled } : {}),
            })
            .where(eq(qrCodeSessions.id, existing[0].id));
        } else {
          await db.insert(qrCodeSessions).values({
            classId: input.classId,
            teacherId: teacher.id,
            dayOfWeek: DEFAULT_DAY_OF_WEEK,
            startTime: DEFAULT_START_TIME,
            endTime: DEFAULT_END_TIME,
            weekNumber,
            isActive: true,
            currentToken: qrData.token,
            tokenExpiresAt: new Date(qrData.expiresAt),
            tokenRotationCount: 1,
            geoLatitude: String(input.geoLatitude ?? DEFAULT_GEO_LAT),
            geoLongitude: String(input.geoLongitude ?? DEFAULT_GEO_LON),
            geoRadiusMeters: input.geoRadiusMeters ?? DEFAULT_GEO_RADIUS,
            geoValidationEnabled: input.geoValidationEnabled ?? true,
          });
        }

        const qrImageUrl = generateQRCodeImageUrl(qrData.token, input.classDate);

        return {
          success: true,
          token: qrData.token,
          qrImageUrl,
          expiresAt: new Date(qrData.expiresAt),
          weekNumber,
          message: "QR code gerado com sucesso",
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Erro ao gerar QR code: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }),

  /**
   * Aluno: Registrar presença via QR code.
   */
  checkInWithQRCode: protectedProcedure
    .input(
      z.object({
        token: z.string(),
        classDate: z.string(),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const memberId = await resolveMemberId(db, ctx.user.id);

        // Busca a sessão pelo token ATUAL persistido no banco (não mais um Map)
        const sessionRows = await db
          .select()
          .from(qrCodeSessions)
          .where(and(eq(qrCodeSessions.currentToken, input.token), eq(qrCodeSessions.isActive, true)))
          .limit(1);

        if (!sessionRows.length) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "QR code não encontrado, inválido ou já foi renovado" });
        }
        const session = sessionRows[0];

        if (!session.tokenExpiresAt || Date.now() > new Date(session.tokenExpiresAt).getTime()) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "QR code expirado" });
        }

        const hourCheck = dentroDoHorario(new Date(), session.dayOfWeek, session.startTime, session.endTime);
        if (!hourCheck.valid) {
          throw new TRPCError({ code: "BAD_REQUEST", message: hourCheck.error || "Fora do horário de aula" });
        }

        // Já registrou presença hoje?
        const existingAttendance = await db
          .select()
          .from(attendance)
          .where(and(eq(attendance.studentAccountId, ctx.user.id), eq(attendance.classDate, input.classDate)))
          .limit(1);
        if (existingAttendance.length > 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Presença já registrada para este dia" });
        }

        // --- Decisão de status a partir do GPS (lógica testada) ---
        let status: "valid" | "invalid" = "valid";
        let distanceMeters: number | null = null;
        let motivoFalha: "gps_failed" | "gps_out_of_range" | null = null;

        if (session.geoValidationEnabled) {
          if (input.latitude === undefined || input.longitude === undefined) {
            status = "invalid";
            motivoFalha = "gps_failed";
          } else {
            const distancia = calculateDistance(
              Number(session.geoLatitude ?? DEFAULT_GEO_LAT),
              Number(session.geoLongitude ?? DEFAULT_GEO_LON),
              input.latitude,
              input.longitude
            );
            distanceMeters = Math.round(distancia);
            const raio = session.geoRadiusMeters ?? DEFAULT_GEO_RADIUS;
            if (distancia > raio) {
              status = "invalid";
              motivoFalha = "gps_out_of_range";
            }
          }
        }
        // Se geoValidationEnabled === false, status permanece "valid" sem checagem
        // (escape hatch para aulas remotas, configurável pelo professor).

        await db.insert(attendance).values({
          studentAccountId: ctx.user.id,
          memberId,
          week: session.weekNumber,
          classDate: input.classDate,
          latitude: input.latitude !== undefined ? String(input.latitude) : null,
          longitude: input.longitude !== undefined ? String(input.longitude) : null,
          distanceMeters: distanceMeters !== null ? String(distanceMeters) : null,
          status,
          note: motivoFalha === "gps_failed" ? "GPS não disponível - aguardando revisão manual"
              : motivoFalha === "gps_out_of_range" ? "Fora do raio da sala - aguardando revisão manual"
              : null,
        });

        // Se falhou, cria AUTOMATICAMENTE a solicitação de revisão manual —
        // o aluno não precisa lembrar de pedir; já fica na fila do professor.
        if (motivoFalha) {
          const member = await db.select().from(members).where(eq(members.id, memberId)).limit(1);
          await db.insert(attendanceManualRequests).values({
            qrCodeSessionId: session.id,
            memberId,
            classId: session.classId,
            memberName: member[0]?.name || "Aluno",
            reason: motivoFalha,
            latitude: input.latitude !== undefined ? String(input.latitude) : null,
            longitude: input.longitude !== undefined ? String(input.longitude) : null,
            distanceMeters: distanceMeters !== null ? String(distanceMeters) : null,
            status: "pending",
          });
        }

        try {
          await notifyAttendanceCheckIn(ctx.user.email || "Aluno", "Farmacologia 1", input.classDate, status);
        } catch (notificationError) {
          console.error("Erro ao enviar notificação:", notificationError);
        }

        return {
          success: true,
          status,
          pendingReview: !!motivoFalha,
          message:
            status === "valid"
              ? "Presença registrada com sucesso!"
              : "Presença registrada como pendente — o professor/monitor vai revisar e confirmar em breve.",
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Erro ao registrar presença: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }),

  /**
   * Aluno: Listar histórico de presenças (agora incluindo solicitações pendentes).
   */
  getMyAttendance: protectedProcedure.query(async ({ ctx }) => {
    try {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const records = await db
        .select()
        .from(attendance)
        .where(eq(attendance.studentAccountId, ctx.user.id))
        .orderBy(attendance.classDate);

      const memberId = await resolveMemberId(db, ctx.user.id).catch(() => null);
      const pendentes = memberId
        ? await db.select().from(attendanceManualRequests)
            .where(and(eq(attendanceManualRequests.memberId, memberId), eq(attendanceManualRequests.status, "pending")))
        : [];

      return {
        success: true,
        total: records.length,
        attendance: records.map((record) => ({
          id: record.id,
          classDate: record.classDate,
          week: record.week,
          checkedInAt: record.checkedInAt,
          status: record.status,
          distanceMeters: record.distanceMeters ? parseFloat(String(record.distanceMeters)) : null,
          note: record.note,
        })),
        solicitacoesPendentes: pendentes.length,
      };
    } catch (error) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Erro ao buscar histórico de presença" });
    }
  }),

  /**
   * Professor/Monitor: Listar presenças de uma turma em um dia.
   */
  getClassAttendance: publicProcedure
    .input(z.object({ sessionToken: z.string(), classDate: z.string(), classId: z.number() }))
    .query(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const teacher = await getTeacherAccountBySessionToken(input.sessionToken);
        if (!teacher) throw new TRPCError({ code: "FORBIDDEN", message: "Token inválido" });

        const records = await db.select().from(attendance).where(eq(attendance.classDate, input.classDate));

        const validCount = records.filter((r) => r.status === "valid").length;
        const invalidCount = records.filter((r) => r.status === "invalid").length;

        return { success: true, total: records.length, validCount, invalidCount, attendance: records };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Erro ao buscar presença da turma" });
      }
    }),

  /**
   * Professor/Monitor: Registrar presença manualmente (override direto, sem passar pela fila).
   */
  manualCheckIn: publicProcedure
    .input(z.object({
      sessionToken: z.string(),
      studentAccountId: z.number(),
      classDate: z.string(),
      note: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const teacher = await getTeacherAccountBySessionToken(input.sessionToken);
        if (!teacher) throw new TRPCError({ code: "FORBIDDEN", message: "Token inválido" });

        const memberId = await resolveMemberId(db, input.studentAccountId);
        const weekNumber = await calcularSemanaSemestre(db, input.classDate);

        const existing = await db.select().from(attendance)
          .where(and(eq(attendance.studentAccountId, input.studentAccountId), eq(attendance.classDate, input.classDate)))
          .limit(1);
        if (existing.length > 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Presença já registrada para este aluno neste dia" });
        }

        await db.insert(attendance).values({
          studentAccountId: input.studentAccountId,
          memberId,
          week: weekNumber,
          classDate: input.classDate,
          status: "manual",
          note: input.note || `Registrado manualmente por ${teacher.name}`,
        });

        return { success: true, message: "Presença registrada manualmente" };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Erro ao registrar presença manualmente" });
      }
    }),

  /**
   * Professor/Monitor: fila de solicitações de revisão manual pendentes.
   */
  getPendingManualRequests: publicProcedure
    .input(z.object({ sessionToken: z.string(), classId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const teacher = await getTeacherAccountBySessionToken(input.sessionToken);
      if (!teacher) throw new TRPCError({ code: "FORBIDDEN", message: "Token inválido" });

      return db.select().from(attendanceManualRequests)
        .where(and(eq(attendanceManualRequests.classId, input.classId), eq(attendanceManualRequests.status, "pending")));
    }),

  /**
   * Professor/Monitor: aprova ou rejeita uma solicitação de revisão manual.
   * Ao aprovar, o registro de presença correspondente vira "valid".
   */
  resolveManualRequest: publicProcedure
    .input(z.object({
      sessionToken: z.string(),
      requestId: z.number(),
      decisao: z.enum(["approved", "rejected"]),
      reviewNote: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const teacher = await getTeacherAccountBySessionToken(input.sessionToken);
        if (!teacher) throw new TRPCError({ code: "FORBIDDEN", message: "Token inválido" });

        const reqRows = await db.select().from(attendanceManualRequests).where(eq(attendanceManualRequests.id, input.requestId)).limit(1);
        if (!reqRows.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Solicitação não encontrada" });
        const solicitacao = reqRows[0];

        await db.update(attendanceManualRequests).set({
          status: input.decisao,
          reviewedBy: teacher.id,
          reviewedByName: teacher.name,
          reviewedAt: new Date(),
          reviewNote: input.reviewNote || null,
        }).where(eq(attendanceManualRequests.id, input.requestId));

        if (input.decisao === "approved") {
          const sessionRows = await db.select().from(qrCodeSessions).where(eq(qrCodeSessions.id, solicitacao.qrCodeSessionId)).limit(1);
          if (!sessionRows.length) {
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Sessão de QR code associada não foi encontrada" });
          }
          const weekNumber = sessionRows[0].weekNumber;

          // Localiza o registro de presença EXATO (mesmo aluno, mesma semana),
          // em vez de supor "o mais recente invalid" (poderia acertar a
          // pendência errada se houver mais de uma).
          const attRows = await db.select().from(attendance)
            .where(and(
              eq(attendance.memberId, solicitacao.memberId),
              eq(attendance.week, weekNumber),
              eq(attendance.status, "invalid")
            ))
            .limit(1);

          if (attRows.length > 0) {
            await db.update(attendance).set({
              status: "valid",
              note: `Aprovado manualmente por ${teacher.name}${input.reviewNote ? ": " + input.reviewNote : ""}`,
            }).where(eq(attendance.id, attRows[0].id));
          }
        }

        return { success: true, decisao: input.decisao };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Erro ao resolver solicitação" });
      }
    }),
});