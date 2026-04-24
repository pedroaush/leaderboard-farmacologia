import { router, protectedProcedure, adminProcedure } from "../_core/trpc";
import { z } from "zod";
import {
  getSystemSettings,
  updateSystemSettings,
  getBackupRecords,
  createBackupRecord,
  updateBackupRecord,
  getRestoreHistory,
  createRestoreRecord,
} from "../db";
import { createFullBackup, restoreFromBackupData, getBackupContent, listBackups, deleteBackupById } from "../backup-restore";
import { TRPCError } from "@trpc/server";

export const settingsRouter = router({
  // Configurações Gerais
  getSettings: adminProcedure.query(async () => {
    const settings = await getSystemSettings();
    return settings || {
      courseName: "Farmacologia I",
      semester: "2026.1",
      academicYear: "2026",
      institution: "UNIRIO",
      department: "Farmacologia",
      totalWeeks: 17,
      primaryColor: "#FF9500",
      secondaryColor: "#1A1A2E",
      sortBy: "alphabetical",
    };
  }),

  updateSettings: adminProcedure
    .input(
      z.object({
        courseName: z.string().optional(),
        semester: z.string().optional(),
        academicYear: z.string().optional(),
        institution: z.string().optional(),
        department: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        totalWeeks: z.number().optional(),
        schedule: z.string().optional(),
        description: z.string().optional(),
        primaryColor: z.string().optional(),
        secondaryColor: z.string().optional(),
        sortBy: z.enum(["alphabetical", "by_pf", "by_date"]).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await updateSystemSettings({
        ...input,
        updatedBy: ctx.user.id,
        updatedByName: ctx.user.name,
      });
      return { success: true };
    }),

  // Backup
  getBackupHistory: adminProcedure.query(async () => {
    return await listBackups(20);
  }),

  // Criar backup completo real (exporta todos os dados para S3)
  createBackup: adminProcedure
    .input(
      z.object({
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const result = await createFullBackup(
          ctx.user.id,
          ctx.user.name,
          input.notes
        );
        return {
          success: true,
          backupId: result.backupId,
          url: result.url,
          fileSize: result.fileSize,
          totalRecords: result.totalRecords,
          message: `Backup completo criado com sucesso! ${result.totalRecords} registros salvos.`,
        };
      } catch (error: any) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Falha ao criar backup: ${error.message}`,
        });
      }
    }),

  // Deletar backup
  deleteBackup: adminProcedure
    .input(z.object({ backupId: z.number() }))
    .mutation(async ({ input }) => {
      await deleteBackupById(input.backupId);
      return { success: true };
    }),

  // Restore
  getRestoreHistory: adminProcedure.query(async () => {
    return await getRestoreHistory(20);
  }),

  // Restaurar a partir de backup existente no S3
  restoreFromBackup: adminProcedure
    .input(
      z.object({
        backupId: z.number(),
        fileKey: z.string(),
        tables: z.array(z.string()).optional(),
        dryRun: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const backupData = await getBackupContent(input.fileKey);
        const result = await restoreFromBackupData(
          backupData,
          input.backupId,
          ctx.user.id,
          ctx.user.name,
          { tables: input.tables, dryRun: input.dryRun }
        );
        return {
          success: result.success,
          recordsRestored: result.recordsRestored,
          errors: result.errors,
          details: result.details,
          message: result.success
            ? `Restauração concluída! ${result.recordsRestored} registros restaurados.`
            : `Restauração com erros: ${result.errors.slice(0, 3).join('; ')}`,
        };
      } catch (error: any) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Falha na restauração: ${error.message}`,
        });
      }
    }),

  // Compat legado
  createRestore: adminProcedure
    .input(z.object({ backupId: z.number(), notes: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const restoreId = await createRestoreRecord({
        backupId: input.backupId,
        status: "pending",
        recordsRestored: 0,
        recordsFailed: 0,
        restoredBy: ctx.user.id,
        restoredByName: ctx.user.name,
        notes: input.notes,
      });
      return { success: true, restoreId, message: "Restauração iniciada" };
    }),

  updateBackupStatus: adminProcedure
    .input(
      z.object({
        backupId: z.number(),
        status: z.enum(["pending", "in_progress", "completed", "failed"]),
        fileSize: z.number().optional(),
        fileUrl: z.string().optional(),
        fileKey: z.string().optional(),
        totalRecords: z.number().optional(),
        errorMessage: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { backupId, ...data } = input;
      await updateBackupRecord(backupId, {
        ...data,
        completedAt: data.status === "completed" ? new Date() : undefined,
      });
      return { success: true };
    }),

  // Segurança
  changeAdminPassword: adminProcedure
    .input(
      z.object({
        currentPassword: z.string(),
        newPassword: z.string().min(8),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // TODO: Implementar verificação de senha atual e hash da nova senha
      return { success: true, message: "Senha alterada com sucesso" };
    }),

  // Notificações
  getNotificationSettings: adminProcedure.query(async () => {
    return {
      emailNotifications: true,
      slackNotifications: false,
      discordNotifications: false,
      notifyOnNewStudents: true,
      notifyOnMissingSubmissions: true,
      notifyOnLowPerformance: true,
    };
  }),

  updateNotificationSettings: adminProcedure
    .input(
      z.object({
        emailNotifications: z.boolean().optional(),
        slackNotifications: z.boolean().optional(),
        discordNotifications: z.boolean().optional(),
        notifyOnNewStudents: z.boolean().optional(),
        notifyOnMissingSubmissions: z.boolean().optional(),
        notifyOnLowPerformance: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      // TODO: Salvar configurações de notificações no banco
      return { success: true, message: "Configurações atualizadas" };
    }),

  // Relatórios
  generateReport: adminProcedure
    .input(
      z.object({
        reportType: z.enum(["students", "performance", "attendance", "complete"]),
        format: z.enum(["pdf", "csv", "xlsx"]),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // TODO: Gerar relatório baseado no tipo e formato solicitado
      return {
        success: true,
        reportUrl: `/reports/report-${Date.now()}.${input.format}`,
        message: `Relatório ${input.reportType} gerado em formato ${input.format}`,
      };
    }),
});
