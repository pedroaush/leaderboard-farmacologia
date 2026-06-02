import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { getDb, getRawDb } from "../db";
import {
  qrCodeSessions,
  attendanceRecords,
  attendanceSummary,
  attendanceManualRequests,
  members,
  teams,
} from "../../drizzle/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import crypto from "crypto";

// ═══════ TOKEN CONFIGURATION ═══════
const TOKEN_VALIDITY_MINUTES = 10;
const TOKEN_SECRET = process.env.JWT_SECRET || "qrcode-attendance-secret-key";

// ═══════ GEO CONFIGURATION ═══════
// Localização padrão: UNIRIO - Instituto Biomédico, Rua Frei Caneca 94, Centro, RJ
const DEFAULT_GEO_LATITUDE = -22.9105064;
const DEFAULT_GEO_LONGITUDE = -43.1925053;
const DEFAULT_GEO_RADIUS_METERS = 150; // Raio padrão: 150 metros

/**
 * Calcula a distância entre dois pontos geográficos usando a fórmula de Haversine
 * @returns distância em metros
 */
function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371000; // Raio da Terra em metros
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Generate a rotating HMAC token for a QR Code session
 * Token = HMAC-SHA256(sessionId + rotationCount + timestamp, secret)
 */
function generateRotatingToken(sessionId: number, rotationCount: number): {
  token: string;
  expiresAt: Date;
} {
  const timestamp = Date.now();
  const payload = `${sessionId}:${rotationCount}:${timestamp}`;
  const token = crypto
    .createHmac("sha256", TOKEN_SECRET)
    .update(payload)
    .digest("hex")
    .substring(0, 32); // 32 char token for QR readability

  const expiresAt = new Date(timestamp + TOKEN_VALIDITY_MINUTES * 60 * 1000);

  return { token, expiresAt };
}

/**
 * Validate a token against the session's current token
 */
function isTokenValid(
  sessionToken: string | null,
  providedToken: string,
  tokenExpiresAt: Date | null
): boolean {
  if (!sessionToken || !tokenExpiresAt) return false;
  if (sessionToken !== providedToken) return false;
  // Tolerância de 30 segundos após expiração para evitar falhas no limite do tempo
  const GRACE_PERIOD_MS = 30_000;
  const now = new Date();
  const expiresWithGrace = new Date(tokenExpiresAt.getTime() + GRACE_PERIOD_MS);
  if (now > expiresWithGrace) return false;
  return true;
}

export const qrcodeRouter = router({
  /**
   * Criar nova sessão de QR Code com token rotativo
   * Professor define dia da semana e horário
   */
  createSession: publicProcedure
    .input(
      z.object({
        classId: z.number(),
        dayOfWeek: z.number().min(0).max(6),
        startTime: z.string().regex(/^\d{2}:\d{2}$/),
        endTime: z.string().regex(/^\d{2}:\d{2}$/),
        sessionToken: z.string().optional(),
        geoLatitude: z.number().optional(),
        geoLongitude: z.number().optional(),
        geoRadiusMeters: z.number().min(50).max(1000).optional(),
        geoValidationEnabled: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const teacherId = 0;

      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Calcular automaticamente a semana do semestre:
      // weekNumber = número de sessões já criadas para esta turma + 1 (máx 17)
      // Cada novo QR Code gerado pelo professor avança automaticamente uma semana
      const existingSessions = await db
        .select({ id: qrCodeSessions.id })
        .from(qrCodeSessions)
        .where(eq(qrCodeSessions.classId, input.classId));
      const nextWeekNumber = Math.min(existingSessions.length + 1, 17);

      // Generate initial rotating token
      const { token, expiresAt } = generateRotatingToken(0, 0);

      const qrCodeData = {
        classId: input.classId,
        dayOfWeek: input.dayOfWeek,
        startTime: input.startTime,
        endTime: input.endTime,
        weekNumber: nextWeekNumber,
        timestamp: Date.now(),
        sessionId: `qr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      };

      // Desativar automaticamente sessões anteriores da mesma turma
      // Isso evita que alunos que já registraram em sessões antigas
      // recebam "Presença já registrada" ao usar o novo QR Code
      const rawDb = await getRawDb();
      if (!rawDb) throw new Error("Database not available");

      await rawDb.execute(
        `UPDATE qrCodeSessions SET isActive = false WHERE classId = ? AND isActive = true`,
        [input.classId]
      );

      // Usar SQL raw para o INSERT — garante compatibilidade mesmo se a coluna weekNumber
      // ainda não existir no banco (migração pode estar pendente)
      // Tenta primeiro com weekNumber, depois sem (fallback)
      let insertedId: number;
      try {
        const [insertResult] = await rawDb.execute(
          `INSERT INTO qrCodeSessions 
            (classId, teacherId, dayOfWeek, startTime, endTime, weekNumber, isActive, qrCodeData, currentToken, tokenExpiresAt, tokenRotationCount, geoLatitude, geoLongitude, geoRadiusMeters, geoValidationEnabled)
           VALUES (?, ?, ?, ?, ?, ?, true, ?, ?, ?, 0, ?, ?, ?, ?)`,
          [
            input.classId,
            teacherId,
            input.dayOfWeek,
            input.startTime,
            input.endTime,
            nextWeekNumber,
            JSON.stringify(qrCodeData),
            token,
            expiresAt,
            String(input.geoLatitude ?? DEFAULT_GEO_LATITUDE),
            String(input.geoLongitude ?? DEFAULT_GEO_LONGITUDE),
            input.geoRadiusMeters ?? DEFAULT_GEO_RADIUS_METERS,
            input.geoValidationEnabled ?? true,
          ]
        ) as any;
        insertedId = insertResult.insertId;
      } catch (err: any) {
        // Fallback: inserir sem weekNumber (coluna pode não existir ainda)
        if (err?.code === 'ER_BAD_FIELD_ERROR' || err?.message?.includes('weekNumber')) {
          console.warn('[QRCode] weekNumber column not found, inserting without it');
          const [insertResult] = await rawDb.execute(
            `INSERT INTO qrCodeSessions 
              (classId, teacherId, dayOfWeek, startTime, endTime, isActive, qrCodeData, currentToken, tokenExpiresAt, tokenRotationCount, geoLatitude, geoLongitude, geoRadiusMeters, geoValidationEnabled)
             VALUES (?, ?, ?, ?, ?, true, ?, ?, ?, 0, ?, ?, ?, ?)`,
            [
              input.classId,
              teacherId,
              input.dayOfWeek,
              input.startTime,
              input.endTime,
              JSON.stringify(qrCodeData),
              token,
              expiresAt,
              String(input.geoLatitude ?? DEFAULT_GEO_LATITUDE),
              String(input.geoLongitude ?? DEFAULT_GEO_LONGITUDE),
              input.geoRadiusMeters ?? DEFAULT_GEO_RADIUS_METERS,
              input.geoValidationEnabled ?? true,
            ]
          ) as any;
          insertedId = insertResult.insertId;
        } else {
          console.error("Erro ao criar sessão QR Code:", err);
          throw err;
        }
      }

      return {
        success: true,
        sessionId: insertedId,
        weekNumber: nextWeekNumber,
        qrCodeData,
        token,
        tokenExpiresAt: expiresAt.toISOString(),
      };
    }),

  /**
   * Gerar novo token rotativo para uma sessão ativa
   * Chamado automaticamente a cada 10 minutos pelo frontend
   */
  rotateToken: publicProcedure
    .input(z.object({ sessionId: z.number(), sessionToken: z.string().optional() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Get current session
      const session = await db
        .select()
        .from(qrCodeSessions)
        .where(eq(qrCodeSessions.id, input.sessionId));

      if (!session || session.length === 0) {
        throw new Error("Sessão não encontrada");
      }

      if (!session[0].isActive) {
        throw new Error("Sessão não está ativa");
      }

      const newRotationCount = (session[0].tokenRotationCount || 0) + 1;
      const { token, expiresAt } = generateRotatingToken(
        input.sessionId,
        newRotationCount
      );

      // Update session with new token
      await db
        .update(qrCodeSessions)
        .set({
          currentToken: token,
          tokenExpiresAt: expiresAt,
          tokenRotationCount: newRotationCount,
        })
        .where(eq(qrCodeSessions.id, input.sessionId));

      return {
        success: true,
        token,
        tokenExpiresAt: expiresAt.toISOString(),
        rotationCount: newRotationCount,
      };
    }),

  /**
   * Obter token atual e tempo restante de uma sessão
   */
  getCurrentToken: publicProcedure
    .input(z.object({ sessionId: z.number(), sessionToken: z.string().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const session = await db
        .select()
        .from(qrCodeSessions)
        .where(eq(qrCodeSessions.id, input.sessionId));

      if (!session || session.length === 0) {
        throw new Error("Sessão não encontrada");
      }

      const s = session[0];
      const now = new Date();
      const isExpired = s.tokenExpiresAt ? now > s.tokenExpiresAt : true;
      const remainingMs = s.tokenExpiresAt
        ? Math.max(0, s.tokenExpiresAt.getTime() - now.getTime())
        : 0;

      return {
        token: s.currentToken,
        tokenExpiresAt: s.tokenExpiresAt?.toISOString() || null,
        isExpired,
        remainingSeconds: Math.floor(remainingMs / 1000),
        rotationCount: s.tokenRotationCount,
        isActive: s.isActive,
      };
    }),

  /**
   * Listar sessões de QR Code de uma turma
   */
  getSessionsByClass: publicProcedure
    .input(z.object({ classId: z.number(), sessionToken: z.string().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const sessions = await db
        .select()
        .from(qrCodeSessions)
        .where(eq(qrCodeSessions.classId, input.classId))
        .orderBy(desc(qrCodeSessions.createdAt));

      return sessions.map((session) => ({
        ...session,
        qrCodeData: session.qrCodeData ? JSON.parse(session.qrCodeData) : null,
        tokenExpiresAt: session.tokenExpiresAt?.toISOString() || null,
      }));
    }),

  /**
   * Ativar/desativar sessão de QR Code
   */
  toggleSession: publicProcedure
    .input(
      z.object({
        sessionId: z.number(),
        isActive: z.boolean(),
        sessionToken: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db
        .update(qrCodeSessions)
        .set({ isActive: input.isActive })
        .where(eq(qrCodeSessions.id, input.sessionId));

      return { success: true };
    }),

  /**
   * Deletar sessão de QR Code
   */
  deleteSession: publicProcedure
    .input(z.object({ sessionId: z.number(), sessionToken: z.string().optional() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db
        .delete(qrCodeSessions)
        .where(eq(qrCodeSessions.id, input.sessionId));

      return { success: true };
    }),

  /**
   * Registrar presença via QR Code com validação de token rotativo + GPS
   * Aluno escaneia o QR Code e registra presença (deve estar no local da aula)
   */
  checkIn: publicProcedure
    .input(
      z.object({
        sessionId: z.number(),
        memberId: z.number(),
        classId: z.number(),
        token: z.string().min(1), // Token rotativo obrigatório
        latitude: z.number().optional(),  // GPS do aluno
        longitude: z.number().optional(), // GPS do aluno
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Verificar se a sessão existe e está ativa
      const session = await db
        .select()
        .from(qrCodeSessions)
        .where(eq(qrCodeSessions.id, input.sessionId));

      if (!session || session.length === 0) {
        throw new Error("Sessão de QR Code não encontrada");
      }

      if (!session[0].isActive) {
        throw new Error("Sessão de QR Code não está ativa");
      }

      // ═══════ VALIDAR TOKEN ROTATIVO ═══════
      const tokenValid = isTokenValid(
        session[0].currentToken,
        input.token,
        session[0].tokenExpiresAt
      );

      if (!tokenValid) {
        if (
          session[0].tokenExpiresAt &&
          new Date() > session[0].tokenExpiresAt
        ) {
          throw new Error(
            "QR Code expirado. Peça ao professor para gerar um novo QR Code."
          );
        }
        throw new Error(
          "Token inválido. Escaneie o QR Code atualizado na tela do professor."
        );
      }

      // ═══════ VALIDAÇÃO GEOGRÁFICA (GPS) ═══════
      const geoEnabled = session[0].geoValidationEnabled ?? true;
      const sessionLat = session[0].geoLatitude ? parseFloat(String(session[0].geoLatitude)) : DEFAULT_GEO_LATITUDE;
      const sessionLon = session[0].geoLongitude ? parseFloat(String(session[0].geoLongitude)) : DEFAULT_GEO_LONGITUDE;
      const allowedRadius = session[0].geoRadiusMeters ?? DEFAULT_GEO_RADIUS_METERS;

      let distanceFromClass: number | null = null;
      let geoStatus: "valid" | "invalid" | "no_gps" | "disabled" = "no_gps";

      if (geoEnabled) {
        // GPS é obrigatório quando validação geográfica está ativada
        if (input.latitude == null || input.longitude == null) {
          throw new Error(
            "Localização GPS obrigatória. Ative a localização do celular e tente novamente."
          );
        }

        // Calcular distância entre aluno e sala de aula
        distanceFromClass = haversineDistance(
          input.latitude, input.longitude,
          sessionLat, sessionLon
        );

        if (distanceFromClass > allowedRadius) {
          geoStatus = "invalid";
          throw new Error(
            `Você está a ${Math.round(distanceFromClass)}m da sala de aula. ` +
            `O limite é ${allowedRadius}m. Você precisa estar na sala para registrar presença.`
          );
        }

        geoStatus = "valid";
      } else {
        geoStatus = "disabled";
        // Se GPS foi enviado mesmo com validação desabilitada, calcular distância para registro
        if (input.latitude != null && input.longitude != null) {
          distanceFromClass = haversineDistance(
            input.latitude, input.longitude,
            sessionLat, sessionLon
          );
        }
      }

      // Verificar se aluno já registrou presença nesta sessão
      const existingRecord = await db
        .select()
        .from(attendanceRecords)
        .where(
          and(
            eq(attendanceRecords.qrCodeSessionId, input.sessionId),
            eq(attendanceRecords.memberId, input.memberId)
          )
        );

      if (existingRecord.length > 0) {
        const checkedAt = existingRecord[0].checkedInAt;
        const timeStr = checkedAt
          ? new Date(checkedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })
          : "";
        return {
          success: true,
          message: `Sua presença já foi confirmada nesta aula${timeStr ? ` às ${timeStr}` : ""}. Tudo certo! ✓`,
          alreadyCheckedIn: true,
        };
      }

      // Registrar presença com dados de geolocalização
      await db
        .insert(attendanceRecords)
        .values({
          qrCodeSessionId: input.sessionId,
          memberId: input.memberId,
          classId: input.classId,
          isValid: true,
          latitude: input.latitude != null ? String(input.latitude) : null,
          longitude: input.longitude != null ? String(input.longitude) : null,
          distanceMeters: distanceFromClass != null ? String(Math.round(distanceFromClass * 100) / 100) : null,
          geoStatus,
        })
        .catch((err: any) => {
          console.error("Erro ao registrar presença:", err);
          throw err;
        });

      // Atualizar resumo de presença
      await updateAttendanceSummary(input.memberId, input.classId);

      const distMsg = distanceFromClass != null ? ` (${Math.round(distanceFromClass)}m da sala)` : "";
      return {
        success: true,
        message: `Presença registrada com sucesso!${distMsg}`,
        alreadyCheckedIn: false,
      };
    }),

  /**
   * Contar check-ins de uma sessão (para exibir no projetor)
   */
  getSessionCheckInCount: publicProcedure
    .input(z.object({ sessionId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const records = await db
        .select()
        .from(attendanceRecords)
        .where(eq(attendanceRecords.qrCodeSessionId, input.sessionId));

      return {
        count: records.length,
        records: records.map((r) => ({
          memberId: r.memberId,
          checkedInAt: r.checkedInAt,
        })),
      };
    }),

  /**
   * Obter histórico de presença de um aluno
   */
  getStudentAttendance: protectedProcedure
    .input(
      z.object({
        memberId: z.number(),
        classId: z.number(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const records = await db
        .select()
        .from(attendanceRecords)
        .where(
          and(
            eq(attendanceRecords.memberId, input.memberId),
            eq(attendanceRecords.classId, input.classId)
          )
        );

      const summary = await db
        .select()
        .from(attendanceSummary)
        .where(
          and(
            eq(attendanceSummary.memberId, input.memberId),
            eq(attendanceSummary.classId, input.classId)
          )
        );

      return {
        records,
        summary: summary[0] || null,
      };
    }),

  /**
   * Obter relatório detalhado de presença da turma por sessão
   * Inclui dados de cada sessão com lista de presentes/ausentes
   */
  getDetailedAttendanceReport: protectedProcedure
    .input(z.object({ classId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Get all sessions for this class
      const sessions = await db
        .select()
        .from(qrCodeSessions)
        .where(eq(qrCodeSessions.classId, input.classId))
        .orderBy(desc(qrCodeSessions.createdAt));

      // Get all members for this class
      const allMembers = await db
        .select()
        .from(members)
        .where(eq(members.classId, input.classId));

      // Get all attendance records for this class
      const allRecords = await db
        .select()
        .from(attendanceRecords)
        .where(eq(attendanceRecords.classId, input.classId));

      // Get team info
      const allTeams = await db.select().from(teams);
      const teamMap = new Map(allTeams.map((t) => [t.id, t]));

      // Build report per session
      const sessionReports = sessions.map((session) => {
        const sessionRecords = allRecords.filter(
          (r) => r.qrCodeSessionId === session.id
        );
        const presentMemberIds = new Set(sessionRecords.map((r) => r.memberId));

        const presentMembers = allMembers
          .filter((m) => presentMemberIds.has(m.id))
          .map((m) => ({
            id: m.id,
            name: m.name,
            teamName: teamMap.get(m.teamId || 0)?.name || "Sem equipe",
            checkedInAt: sessionRecords.find((r) => r.memberId === m.id)
              ?.checkedInAt,
          }));

        const absentMembers = allMembers
          .filter((m) => !presentMemberIds.has(m.id))
          .map((m) => ({
            id: m.id,
            name: m.name,
            teamName: teamMap.get(m.teamId || 0)?.name || "Sem equipe",
          }));

        const DAYS = [
          "Domingo",
          "Segunda",
          "Terça",
          "Quarta",
          "Quinta",
          "Sexta",
          "Sábado",
        ];

        return {
          sessionId: session.id,
          weekNumber: session.weekNumber || 0,
          date: session.createdAt,
          dayOfWeek: DAYS[session.dayOfWeek] || "Desconhecido",
          startTime: session.startTime,
          endTime: session.endTime,
          totalStudents: allMembers.length,
          presentCount: presentMembers.length,
          absentCount: absentMembers.length,
          attendanceRate:
            allMembers.length > 0
              ? ((presentMembers.length / allMembers.length) * 100).toFixed(1)
              : "0.0",
          presentMembers,
          absentMembers,
        };
      });

      // Build summary per student
      const studentSummaries = allMembers.map((member) => {
        const memberRecords = allRecords.filter(
          (r) => r.memberId === member.id
        );
        const presentCount = memberRecords.length;
        const totalSessions = sessions.length;
        const absentCount = totalSessions - presentCount;
        const percentage =
          totalSessions > 0
            ? ((presentCount / totalSessions) * 100).toFixed(1)
            : "0.0";

        return {
          memberId: member.id,
          name: member.name,
          teamName: teamMap.get(member.teamId || 0)?.name || "Sem equipe",
          totalSessions,
          presentCount,
          absentCount,
          attendancePercentage: percentage,
        };
      });

      return {
        sessions: sessionReports,
        studentSummaries: studentSummaries.sort(
          (a, b) => parseFloat(b.attendancePercentage) - parseFloat(a.attendancePercentage)
        ),
        totalSessions: sessions.length,
        totalStudents: allMembers.length,
      };
    }),

  /**
   * Exportar relatório de presença em CSV
   */
  exportAttendanceCSV: protectedProcedure
    .input(z.object({ classId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Get all sessions
      const sessions = await db
        .select()
        .from(qrCodeSessions)
        .where(eq(qrCodeSessions.classId, input.classId))
        .orderBy(qrCodeSessions.createdAt);

      // Get all members
      const allMembers = await db
        .select()
        .from(members)
        .where(eq(members.classId, input.classId));

      // Get all records
      const allRecords = await db
        .select()
        .from(attendanceRecords)
        .where(eq(attendanceRecords.classId, input.classId));

      // Get teams
      const allTeams = await db.select().from(teams);
      const teamMap = new Map(allTeams.map((t) => [t.id, t]));

      const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

      // Build CSV headers: Nome, Equipe, Sessão1, Sessão2, ..., Total, Percentual
      const sessionHeaders = sessions.map((s, i) => {
        const date = s.createdAt
          ? new Date(s.createdAt).toLocaleDateString("pt-BR")
          : `Sessão ${i + 1}`;
        return `${DAYS[s.dayOfWeek]} ${date}`;
      });

      const headers = [
        "Nome do Aluno",
        "Equipe",
        ...sessionHeaders,
        "Presenças",
        "Faltas",
        "Total Sessões",
        "Percentual (%)",
      ];

      // Build rows
      const rows = allMembers
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((member) => {
          const memberRecords = allRecords.filter(
            (r) => r.memberId === member.id
          );
          const presentSessionIds = new Set(
            memberRecords.map((r) => r.qrCodeSessionId)
          );

          const sessionCells = sessions.map((s) =>
            presentSessionIds.has(s.id) ? "P" : "F"
          );

          const presentCount = memberRecords.length;
          const totalSessions = sessions.length;
          const absentCount = totalSessions - presentCount;
          const percentage =
            totalSessions > 0
              ? ((presentCount / totalSessions) * 100).toFixed(1)
              : "0.0";

          return [
            `"${member.name}"`,
            `"${teamMap.get(member.teamId || 0)?.name || "Sem equipe"}"`,
            ...sessionCells,
            presentCount,
            absentCount,
            totalSessions,
            percentage,
          ];
        });

      const csv = [
        headers.join(","),
        ...rows.map((row) => row.join(",")),
      ].join("\n");

      return {
        csv,
        filename: `relatorio_presenca_turma_${input.classId}_${new Date().toISOString().split("T")[0]}.csv`,
      };
    }),

  /**
   * Obter relatório de presença da turma (resumo)
   */
  getClassAttendanceReport: protectedProcedure
    .input(z.object({ classId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const summaries = await db
        .select()
        .from(attendanceSummary)
        .where(eq(attendanceSummary.classId, input.classId));

      const report = await Promise.all(
        summaries.map(
          async (summary: typeof attendanceSummary.$inferSelect) => {
            const member = await db
              .select()
              .from(members)
              .where(eq(members.id, summary.memberId));

            return {
              ...summary,
              studentName: member[0]?.name || "Desconhecido",
            };
          }
        )
      );

      return report;
    }),

  /**
   * Verificar se existe alguma sessão de QR Code ativa (para badge no botão Presença)
   */
  hasActiveSession: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { hasActive: false };
    const activeSessions = await db
      .select({ id: qrCodeSessions.id })
      .from(qrCodeSessions)
      .where(eq(qrCodeSessions.isActive, true))
      .limit(1);
    return { hasActive: activeSessions.length > 0 };
  }),

  /**
   * Validar/invalidar presença (professor)
   */
  validateAttendance: protectedProcedure
    .input(
      z.object({
        recordId: z.number(),
        isValid: z.boolean(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db
        .update(attendanceRecords)
        .set({
          isValid: input.isValid,
          validationNotes: input.notes || null,
        })
        .where(eq(attendanceRecords.id, input.recordId));

      const record = await db
        .select()
        .from(attendanceRecords)
        .where(eq(attendanceRecords.id, input.recordId));

      if (record[0]) {
        await updateAttendanceSummary(record[0].memberId, record[0].classId);
      }

      return { success: true };
    }),

  /**
   * Obter check-ins recentes com nome do aluno para feedback visual no projetor
   */
  getRecentCheckIns: publicProcedure
    .input(z.object({
      sessionId: z.number(),
      limit: z.number().min(1).max(20).default(5),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Get total count for change detection
      const allRecords = await db
        .select({ id: attendanceRecords.id })
        .from(attendanceRecords)
        .where(eq(attendanceRecords.qrCodeSessionId, input.sessionId));

      const records = await db
        .select({
          id: attendanceRecords.id,
          memberId: attendanceRecords.memberId,
          checkedInAt: attendanceRecords.checkedInAt,
          memberName: members.name,
        })
        .from(attendanceRecords)
        .leftJoin(members, eq(attendanceRecords.memberId, members.id))
        .where(eq(attendanceRecords.qrCodeSessionId, input.sessionId))
        .orderBy(desc(attendanceRecords.checkedInAt))
        .limit(input.limit);

      const cleanName = (raw: string | null) => {
        if (!raw) return "Aluno";
        const parts = raw.split("\t");
        if (parts.length >= 2) return parts[1].trim();
        return raw.trim();
      };

      return {
        count: allRecords.length, // total count for change detection
        recent: records.map((r) => ({
          id: r.id,
          memberId: r.memberId,
          name: cleanName(r.memberName),
          checkedInAt: r.checkedInAt,
        })),
      };
    }),

  /**
   * Aluno solicita confirmacao manual de presenca quando GPS falha
   */
  requestManualAttendance: publicProcedure
    .input(
      z.object({
        qrCodeSessionId: z.number(),
        memberId: z.number(),
        classId: z.number(),
        reason: z.enum(["gps_failed", "gps_out_of_range", "other"]).default("gps_failed"),
        reasonNote: z.string().optional(),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
        distanceMeters: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const memberRows = await db.select({ name: members.name }).from(members).where(eq(members.id, input.memberId)).limit(1);
      const memberName = memberRows[0]?.name || "Aluno";
      // Verificar se ja existe solicitacao para esta sessao e aluno
      const existing = await db.select({ id: attendanceManualRequests.id, status: attendanceManualRequests.status })
        .from(attendanceManualRequests)
        .where(and(eq(attendanceManualRequests.memberId, input.memberId), eq(attendanceManualRequests.qrCodeSessionId, input.qrCodeSessionId)))
        .limit(1);
      if (existing.length > 0) {
        if (existing[0].status === "approved") throw new Error("Presenca ja confirmada para esta sessao");
        if (existing[0].status === "pending") throw new Error("Solicitacao ja enviada. Aguarde a aprovacao do professor");
      }
      // Verificar se ja fez check-in normal
      const checkedIn = await db.select({ id: attendanceRecords.id })
        .from(attendanceRecords)
        .where(and(eq(attendanceRecords.memberId, input.memberId), eq(attendanceRecords.qrCodeSessionId, input.qrCodeSessionId)))
        .limit(1);
      if (checkedIn.length > 0) throw new Error("Presenca ja registrada via QR Code para esta sessao");
      await db.insert(attendanceManualRequests).values({
        qrCodeSessionId: input.qrCodeSessionId,
        memberId: input.memberId,
        classId: input.classId,
        memberName,
        reason: input.reason,
        reasonNote: input.reasonNote,
        latitude: input.latitude !== undefined ? String(input.latitude) : undefined,
        longitude: input.longitude !== undefined ? String(input.longitude) : undefined,
        distanceMeters: input.distanceMeters !== undefined ? String(input.distanceMeters) : undefined,
        status: "pending",
      });
      return { success: true, message: "Solicitacao enviada. Aguarde a confirmacao do professor" };
    }),

  /**
   * Professor/monitor lista solicitacoes manuais de uma turma
   */
  listManualRequests: publicProcedure
    .input(z.object({ classId: z.number(), status: z.enum(["pending", "approved", "rejected", "all"]).default("pending") }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const conditions: any[] = [eq(attendanceManualRequests.classId, input.classId)];
      if (input.status !== "all") conditions.push(eq(attendanceManualRequests.status, input.status as any));
      const rows = await db.select().from(attendanceManualRequests).where(and(...conditions)).orderBy(desc(attendanceManualRequests.requestedAt));
      return rows;
    }),

  /**
   * Professor/monitor aprova ou rejeita solicitacao manual
   */
  reviewManualRequest: publicProcedure
    .input(z.object({
      requestId: z.number(),
      action: z.enum(["approve", "reject"]),
      reviewedByName: z.string().default("Professor"),
      reviewNote: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const req = await db.select().from(attendanceManualRequests).where(eq(attendanceManualRequests.id, input.requestId)).limit(1);
      if (!req.length) throw new Error("Solicitacao nao encontrada");
      const request = req[0];
      if (request.status !== "pending") throw new Error("Solicitacao ja foi processada");
      const newStatus = input.action === "approve" ? "approved" : "rejected";
      await db.update(attendanceManualRequests).set({
        status: newStatus,
        reviewedByName: input.reviewedByName,
        reviewedAt: new Date(),
        reviewNote: input.reviewNote,
      }).where(eq(attendanceManualRequests.id, input.requestId));
      if (input.action === "approve") {
        await db.insert(attendanceRecords).values({
          qrCodeSessionId: request.qrCodeSessionId,
          memberId: request.memberId,
          classId: request.classId,
          memberName: request.memberName,
          isValid: true,
          validationNotes: `Confirmacao manual por ${input.reviewedByName}`,
          latitude: request.latitude,
          longitude: request.longitude,
          distanceMeters: request.distanceMeters,
          geoStatus: "no_gps",
        });
        await updateAttendanceSummary(request.memberId, request.classId);
      }
      return { success: true, status: newStatus };
    }),
});

/**
 * Helper function para atualizar resumo de presença
 */
async function updateAttendanceSummary(
  memberId: number,
  classId: number
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const sessions = await db
    .select()
    .from(qrCodeSessions)
    .where(eq(qrCodeSessions.classId, classId));

  const presentRecords = await db
    .select()
    .from(attendanceRecords)
    .where(
      and(
        eq(attendanceRecords.memberId, memberId),
        eq(attendanceRecords.classId, classId),
        eq(attendanceRecords.isValid, true)
      )
    );

  const totalSessions = sessions.length;
  const presentSessions = presentRecords.length;
  const absentSessions = totalSessions - presentSessions;
  const attendancePercentage =
    totalSessions > 0 ? (presentSessions / totalSessions) * 100 : 0;

  const existing = await db
    .select()
    .from(attendanceSummary)
    .where(
      and(
        eq(attendanceSummary.memberId, memberId),
        eq(attendanceSummary.classId, classId)
      )
    );

  if (existing.length > 0) {
    await db
      .update(attendanceSummary)
      .set({
        totalSessions,
        presentSessions,
        absentSessions,
        attendancePercentage: attendancePercentage.toFixed(2),
      })
      .where(
        and(
          eq(attendanceSummary.memberId, memberId),
          eq(attendanceSummary.classId, classId)
        )
      );
  } else {
    await db.insert(attendanceSummary).values({
      memberId,
      classId,
      totalSessions,
      presentSessions,
      absentSessions,
      attendancePercentage: attendancePercentage.toFixed(2),
    });
  }
}
