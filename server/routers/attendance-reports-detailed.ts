import { router, protectedProcedure, adminProcedure, publicProcedure } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db";
import { attendanceRecords, members, classes } from "../../drizzle/schema";
import { eq, gte, lte, desc, and as drizzleAnd } from "drizzle-orm";
import { getTeacherAccountBySessionToken } from "../db";
import { TRPCError } from "@trpc/server";

const and = drizzleAnd;

export const attendanceReportsDetailedRouter = router({
  /**
   * Obter relatório detalhado de presença por aluno
   * Inclui: taxa de presença, faltas justificadas, tendências semanais
   */
  getStudentAttendanceDetail: protectedProcedure
    .input(
      z.object({
        memberId: z.number().optional(),
        classId: z.number(),
      })
    )
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const memberId = input.memberId || ctx.user?.id || 0;

      // Buscar registros de presença do aluno
      const records = await db
        .select()
        .from(attendanceRecords)
        .where(eq(attendanceRecords.memberId, memberId))
        .orderBy(desc(attendanceRecords.checkedInAt));

      // Calcular estatísticas gerais
      const totalDays = records.length;
      const validRecords = records.filter((r: any) => r.isValid).length;
      const attendanceRate = totalDays > 0 ? Math.round((validRecords / totalDays) * 100) : 0;

      // Agrupar por semana
      const byWeek = new Map<
        number,
        { present: number; absent: number; total: number }
      >();

      records.forEach((record: any) => {
        const date = new Date(record.checkedInAt);
        const week = Math.ceil((date.getDate()) / 7); // Semana simplificada

        if (!byWeek.has(week)) {
          byWeek.set(week, { present: 0, absent: 0, total: 0 });
        }

        const weekData = byWeek.get(week)!;
        weekData.total++;

        if (record.isValid) {
          weekData.present++;
        } else {
          weekData.absent++;
        }
      });

      return {
        memberId,
        totalDays,
        presentDays: validRecords,
        absentDays: totalDays - validRecords,
        attendanceRate,
        isAtRisk: attendanceRate < 75,
        isExcellent: attendanceRate >= 90,
        weeklyTrend: Object.fromEntries(byWeek),
        recentRecords: records.slice(0, 10).map((r: any) => ({
          date: r.checkedInAt,
          isValid: r.isValid,
          notes: r.validationNotes,
        })),
      };
    }),

  /**
   * Marcar presença manualmente para um aluno
   * Aceita sessionToken de professor ou autenticação admin
   */
  markAttendanceManually: publicProcedure
    .input(
      z.object({
        memberId: z.number(),
        classId: z.number(),
        qrCodeSessionId: z.number(),
        isValid: z.boolean(),
        reason: z.string().optional(),
        sessionToken: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      if (input.sessionToken) {
        const teacher = await getTeacherAccountBySessionToken(input.sessionToken);
        if (!teacher) throw new TRPCError({ code: "FORBIDDEN", message: "Token inválido" });
      }
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Criar novo registro de presença manual
      await db.insert(attendanceRecords).values({
        memberId: input.memberId,
        classId: input.classId,
        qrCodeSessionId: input.qrCodeSessionId,
        isValid: input.isValid,
        validationNotes: input.reason || null,
        checkedInAt: new Date(),
      });

      return {
        success: true,
        message: `Presença marcada como ${input.isValid ? "presente" : "ausente"} para o aluno`,
      };
    }),

  /**
   * Justificar falta de um aluno
   */
  justifyAbsence: adminProcedure
    .input(
      z.object({
        recordId: z.number(),
        reason: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Atualizar registro como válido (justificado)
      await db
        .update(attendanceRecords)
        .set({
          isValid: true,
          validationNotes: `Justificado: ${input.reason}`,
        })
        .where(eq(attendanceRecords.id, input.recordId));

      return {
        success: true,
        message: "Falta justificada com sucesso",
      };
    }),

  /**
   * Obter tendências de presença por semana
   */
  getWeeklyTrends: publicProcedure
    .input(
      z.object({
        classId: z.number(),
        sessionToken: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      if (input.sessionToken) {
        const teacher = await getTeacherAccountBySessionToken(input.sessionToken);
        if (!teacher) throw new TRPCError({ code: "FORBIDDEN", message: "Token inválido" });
      }
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Buscar todos os registros da turma
      const records = await db
        .select()
        .from(attendanceRecords)
        .where(eq(attendanceRecords.classId, input.classId));

      // Agrupar por semana
      const weeklyData = new Map<
        number,
        { present: number; absent: number; total: number }
      >();

      records.forEach((record: any) => {
        const date = new Date(record.checkedInAt);
        const week = Math.ceil((date.getDate()) / 7);

        if (!weeklyData.has(week)) {
          weeklyData.set(week, { present: 0, absent: 0, total: 0 });
        }

        const weekData = weeklyData.get(week)!;
        weekData.total++;

        if (record.isValid) {
          weekData.present++;
        } else {
          weekData.absent++;
        }
      });

      return {
        classId: input.classId,
        trends: Object.fromEntries(weeklyData),
      };
    }),

  /**
   * Listar todos os alunos com suas taxas de presença
   * Aceita sessionToken de professor para acesso sem cookie OAuth
   */
  getClassAttendanceSummary: publicProcedure
    .input(
      z.object({
        classId: z.number(),
        sessionToken: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      if (input.sessionToken) {
        const teacher = await getTeacherAccountBySessionToken(input.sessionToken);
        if (!teacher) throw new TRPCError({ code: "FORBIDDEN", message: "Token inválido" });
      }
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Buscar todos os membros da turma
      const classMembers = await db
        .select()
        .from(members)
        .where(eq(members.classId, input.classId));

      // Buscar registros de presença
      const records = await db
        .select()
        .from(attendanceRecords)
        .where(eq(attendanceRecords.classId, input.classId));

      // Agrupar por aluno
      const attendanceByStudent = new Map<
        number,
        { present: number; total: number }
      >();

      classMembers.forEach((member: any) => {
        attendanceByStudent.set(member.id, { present: 0, total: 0 });
      });

      records.forEach((record: any) => {
        const studentData = attendanceByStudent.get(record.memberId);
        if (studentData) {
          studentData.total++;
          if (record.isValid) {
            studentData.present++;
          }
        }
      });

      // Preparar dados de resposta
      const attendanceData = classMembers.map((member: any) => {
        const data = attendanceByStudent.get(member.id) || {
          present: 0,
          total: 0,
        };

        const attendanceRate =
          data.total > 0 ? Math.round((data.present / data.total) * 100) : 0;

        return {
          memberId: member.id,
          studentName: member.name || "Aluno",
          studentEmail: member.email || "N/A",
          attendanceRate,
          presentDays: data.present,
          totalDays: data.total,
          isAtRisk: attendanceRate < 75,
          isExcellent: attendanceRate >= 90,
        };
      });

      // Calcular estatísticas gerais
      const atRiskCount = attendanceData.filter((d: any) => d.isAtRisk).length;
      const excellentCount = attendanceData.filter((d: any) => d.isExcellent).length;
      const averageAttendance = Math.round(
        attendanceData.reduce((sum: number, d: any) => sum + d.attendanceRate, 0) /
          (attendanceData.length || 1)
      );

      return {
        totalStudents: classMembers.length,
        attendanceData: attendanceData.sort((a: any, b: any) =>
          a.attendanceRate === b.attendanceRate
            ? a.studentName.localeCompare(b.studentName)
            : b.attendanceRate - a.attendanceRate
        ),
        statistics: {
          averageAttendance,
          atRiskCount,
          excellentCount,
        },
      };
    }),
});
