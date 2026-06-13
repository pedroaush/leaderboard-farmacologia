import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { notifyOwner } from "./_core/notification";
import { sendPasswordResetEmail, isSmtpConfigured, sendGradesReportEmail, sendBulkEmail } from "./email";
import { analyticsRouter } from "./routers/analytics";
import { jigsawRouter } from "./routers/jigsaw";
import { jigsawCompleteRouter } from "./routers/jigsaw-complete";
import { unirioRouter } from "./routers/unirio";
import { settingsRouter } from "./routers/settings";
import { attendanceRouter } from "./routers/attendance";
import { attendanceReportRouter } from "./routers/attendance-report";
import { auditRouter } from "./routers/audit";
import { assessmentRouter } from "./routers/assessments";
import { questionsRouter } from "./routers/questions";
import { resultsRouter } from "./routers/results";
import { gameRouter } from "./routers/game";
import { qrcodeRouter } from "./routers/qrcode";
import { studentNotificationsRouter } from "./routers/student-notifications";
import { activitiesRouter } from "./routers/activities";
import { studentActivitiesRouter } from "./routers/studentActivities";
import { chatRouter } from "./routers/chat";
import { studentStatsRouter } from "./routers/student-stats";
import { attendanceReportsDetailedRouter } from "./routers/attendance-reports-detailed";
import { monitorsRouter } from "./routers/monitors";
import { scheduleRouter } from "./routers/schedule";

// Helper: fire-and-forget notification (never blocks the main operation)
function sendNotificationAsync(title: string, content: string) {
  notifyOwner({ title, content }).catch(err => console.warn("[Notification] Failed:", err));
}

// Helper: create in-app notification for students
async function createStudentNotification(title: string, content: string, priority: "normal" | "important" | "urgent" = "normal") {
  try {
    await db.createNotification({
      title,
      content,
      priority,
      type: "announcement",
      isActive: 1,
    });
  } catch (err) {
    console.warn("[StudentNotification] Failed:", err);
  }
}

// Helper: log audit trail for teacher actions
async function logAudit(params: {
  teacherToken: string;
  action: string;
  entityType: string;
  entityId?: number;
  details?: any;
  req?: any;
}) {
  try {
    // Get teacher info from token
    const teacher = await db.getTeacherAccountBySessionToken(params.teacherToken);
    if (!teacher) return;

    await db.createAuditLog({
      teacherAccountId: teacher.id,
      teacherName: teacher.name,
      teacherEmail: teacher.email,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId ?? null,
      details: params.details ? JSON.stringify(params.details) : null,
      ipAddress: params.req?.ip || params.req?.connection?.remoteAddress || null,
      userAgent: params.req?.headers?.['user-agent'] || null,
    });
  } catch (err) {
    console.warn("[Audit] Failed to log:", err);
  }
}

// Admin password check middleware (simple password-based, no OAuth needed)
const ADMIN_PASSWORD_KEY = "admin_password";
const DEFAULT_ADMIN_PASSWORD = "farmaco2026"; // Default password, should be changed

async function verifyAdminPassword(password: string): Promise<boolean> {
  const storedPassword = await db.getSetting(ADMIN_PASSWORD_KEY);
  const correctPassword = storedPassword || DEFAULT_ADMIN_PASSWORD;
  return password === correctPassword;
}

// Extract YouTube ID from various URL formats
function extractYoutubeId(url: string, type: string): string | null {
  try {
    // Handle direct ID input (no URL)
    if (!url.includes("http") && !url.includes("www")) {
      // Might be a direct ID
      if (type === "playlist" && url.startsWith("PL")) return url;
      if (type === "video" && /^[a-zA-Z0-9_-]{11}$/.test(url)) return url;
    }
    const urlObj = new URL(url.startsWith("http") ? url : `https://${url}`);
    if (type === "playlist") {
      // youtube.com/playlist?list=PLxxxxxx
      const listId = urlObj.searchParams.get("list");
      if (listId) return listId;
    }
    if (type === "video") {
      // youtube.com/watch?v=xxxxx
      const videoId = urlObj.searchParams.get("v");
      if (videoId) return videoId;
      // youtu.be/xxxxx
      if (urlObj.hostname === "youtu.be") {
        return urlObj.pathname.slice(1);
      }
      // youtube.com/embed/xxxxx
      const embedMatch = urlObj.pathname.match(/\/embed\/([a-zA-Z0-9_-]+)/);
      if (embedMatch) return embedMatch[1];
      // youtube.com/shorts/xxxxx
      const shortsMatch = urlObj.pathname.match(/\/shorts\/([a-zA-Z0-9_-]+)/);
      if (shortsMatch) return shortsMatch[1];
    }
    // Fallback: try to extract list param for playlists from video URLs
    if (type === "playlist") {
      const listId = urlObj.searchParams.get("list");
      if (listId) return listId;
    }
    return null;
  } catch {
    return null;
  }
}

export const appRouter = router({
  system: systemRouter,
  analytics: analyticsRouter,
  jigsawComplete: jigsawCompleteRouter,
  attendance: attendanceRouter,
  attendanceReport: attendanceReportRouter,
  attendanceReportsDetailed: attendanceReportsDetailedRouter,
  audit: auditRouter,
  assessments: assessmentRouter,
  questions: questionsRouter,
  results: resultsRouter,
  game: gameRouter,
  qrcode: qrcodeRouter,
  studentNotifications: studentNotificationsRouter,
  studentStats: studentStatsRouter,
  monitors: monitorsRouter,
  schedule: scheduleRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── Admin Auth (DEPRECATED - use teacherAuth instead) ───
  admin: router({
    login: publicProcedure
      .input(z.object({ password: z.string() }))
      .mutation(async ({ input }) => {
        const valid = await verifyAdminPassword(input.password);
        if (!valid) return { success: false, message: "Senha incorreta" } as const;
        return { success: true, message: "Autenticado com sucesso" } as const;
      }),

    changePassword: publicProcedure
      .input(z.object({
        currentPassword: z.string(),
        newPassword: z.string().min(6),
      }))
      .mutation(async ({ input }) => {
        const valid = await verifyAdminPassword(input.currentPassword);
        if (!valid) return { success: false, message: "Senha atual incorreta" } as const;
        await db.upsertSetting(ADMIN_PASSWORD_KEY, input.newPassword);
        return { success: true, message: "Senha alterada com sucesso" } as const;
      }),
  }),

  // ─── Teacher Authentication ───
  teacherAuth: router({
    // Get admin password for authenticated teacher (so admin panel works)
    getAdminPassword: publicProcedure
      .input(z.object({ sessionToken: z.string() }))
      .query(async ({ input }) => {
        const teacher = await db.getTeacherAccountBySessionToken(input.sessionToken);
        if (!teacher) return { success: false, password: null } as const;
        const storedPassword = await db.getSetting(ADMIN_PASSWORD_KEY);
        const correctPassword = storedPassword || DEFAULT_ADMIN_PASSWORD;
        return { success: true, password: correctPassword } as const;
      }),

    // Register new teacher account (first access)
    register: publicProcedure
      .input(z.object({
        email: z.string().email("Email inválido").refine(email => email.toLowerCase().endsWith("@unirio.br") || email.toLowerCase().endsWith("@edu.unirio.br"), {
          message: "Email deve ser institucional (@unirio.br ou @edu.unirio.br)"
        }),
        name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres").max(200, "Nome muito longo"),
        password: z.string().min(8, "Senha deve ter no mínimo 8 caracteres").max(255, "Senha muito longa"),
      }))
      .mutation(async ({ input }) => {
        // Check if email already exists
        const existing = await db.getTeacherAccountByEmail(input.email);
        if (existing) {
          return { success: false, message: "Email já cadastrado" } as const;
        }

        // Hash password
        const passwordHash = await bcrypt.hash(input.password, 10);

        // Create account
        const teacherId = await db.createTeacherAccount({
          email: input.email,
          name: input.name,
          passwordHash,
          isActive: 1,
        });

        // Generate session token
        const sessionToken = crypto.randomBytes(32).toString("hex");
        await db.updateTeacherSessionToken(teacherId, sessionToken);

        // Auto-link professor to their classes
        const autoLinkMap: { [key: string]: number } = {
          "monique": 6,
          "beatriz": 7,
        };
        
        for (const [keyword, classId] of Object.entries(autoLinkMap)) {
          if (input.name.toLowerCase().includes(keyword)) {
            try {
              await db.updateClass(classId, {
                teacherAccountId: teacherId,
                teacherName: input.name,
              });
            } catch (err) {
              console.warn(`[Auto-link] Failed to link class ${classId}:`, err);
            }
          }
        }

        // Notify owner
        sendNotificationAsync(
          "👨‍🏫 Novo Professor Cadastrado",
          `${input.name} (${input.email}) criou uma conta de professor`
        );

        return {
          success: true,
          message: "Conta criada com sucesso",
          sessionToken,
          teacher: { id: teacherId, name: input.name, email: input.email },
        } as const;
      }),

    // Login teacher
    login: publicProcedure
      .input(z.object({
        email: z.string().email(),
        password: z.string(),
      }))
      .mutation(async ({ input }) => {
        // Get teacher account
        const teacher = await db.getTeacherAccountByEmail(input.email);
        if (!teacher) {
          return { success: false, message: "Email ou senha incorretos" } as const;
        }

        // Check if account is active
        if (!teacher.isActive) {
          return { success: false, message: "Conta desativada" } as const;
        }

        // Verify password
        const valid = await bcrypt.compare(input.password, teacher.passwordHash);
        if (!valid) {
          return { success: false, message: "Email ou senha incorretos" } as const;
        }

        // Generate new session token
        const sessionToken = crypto.randomBytes(32).toString("hex");
        await db.updateTeacherSessionToken(teacher.id, sessionToken);

        return {
          success: true,
          message: "Login realizado com sucesso",
          sessionToken,
          teacher: { id: teacher.id, name: teacher.name, email: teacher.email },
        } as const;
      }),

    // Logout teacher
    logout: publicProcedure
      .input(z.object({ sessionToken: z.string() }))
      .mutation(async ({ input }) => {
        await db.clearTeacherSessionToken(input.sessionToken);
        return { success: true, message: "Logout realizado com sucesso" } as const;
      }),

    // Get current teacher info by session token
    me: publicProcedure
      .input(z.object({ sessionToken: z.string() }))
      .query(async ({ input }) => {
        const teacher = await db.getTeacherAccountBySessionToken(input.sessionToken);
        if (!teacher) return null;
        return {
          id: teacher.id,
          name: teacher.name,
          email: teacher.email,
          role: teacher.role,
          isActive: teacher.isActive,
        };
      }),

    // Super Admin Login (direct access with specific credentials)
    superAdminLogin: publicProcedure
      .input(z.object({
        email: z.string().email(),
        password: z.string(),
      }))
      .mutation(async ({ input }) => {
        const SUPER_ADMIN_EMAIL = "pedro.alexandre@unirio.br";
        const SUPER_ADMIN_PASSWORD = "0702G@bi";

        if (input.email !== SUPER_ADMIN_EMAIL) {
          return { success: false, message: "Email ou senha incorretos" } as const;
        }

        if (input.password !== SUPER_ADMIN_PASSWORD) {
          return { success: false, message: "Email ou senha incorretos" } as const;
        }

        let teacher = await db.getTeacherAccountByEmail(SUPER_ADMIN_EMAIL);
        if (!teacher) {
          const passwordHash = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 10);
          const teacherId = await db.createTeacherAccount({
            email: SUPER_ADMIN_EMAIL,
            name: "Pedro Alexandre (Super Admin)",
            passwordHash,
            role: "super_admin",
            isActive: 1,
          });
          teacher = await db.getTeacherAccountByEmail(SUPER_ADMIN_EMAIL);
        }

        if (!teacher) {
          return { success: false, message: "Erro ao acessar super admin" } as const;
        }

        const sessionToken = crypto.randomBytes(32).toString("hex");
        await db.updateTeacherSessionToken(teacher.id, sessionToken);

        return {
          success: true,
          message: "Acesso de super admin concedido",
          sessionToken,
          teacher: { id: teacher.id, name: teacher.name, email: teacher.email, role: "super_admin" },
        } as const;
      }),

    // Request password reset
    requestPasswordReset: publicProcedure
      .input(z.object({
        email: z.string().email(),
        origin: z.string().optional(), // Frontend origin for building full URL
      }))
      .mutation(async ({ input }) => {
        // Check if teacher exists
        const teacher = await db.getTeacherAccountByEmail(input.email.toLowerCase().trim());
        if (!teacher) {
          // Don't reveal if email exists or not for security
          // Return same success message to prevent email enumeration
          return { success: true, message: "Se o email estiver cadastrado, um link de redefinição será gerado. Verifique com o coordenador do curso.", resetLink: null } as const;
        }

        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        // Save token to database
        await db.createPasswordResetToken({
          teacherAccountId: teacher.id,
          token: resetToken,
          expiresAt,
          used: 0,
        });

        // Build full reset link using origin from frontend
        const baseUrl = input.origin || '';
        const resetPath = `/professor/redefinir-senha?token=${resetToken}`;
        const fullResetLink = baseUrl + resetPath;

        // Try to send email directly to the professor
        let emailSent = false;
        if (isSmtpConfigured()) {
          const emailResult = await sendPasswordResetEmail({
            to: teacher.email,
            teacherName: teacher.name,
            resetLink: fullResetLink,
            expiresInMinutes: 60,
          });
          emailSent = emailResult.success;
          if (emailSent) {
            console.log(`[PasswordReset] Email sent to ${teacher.email}`);
          }
        }

        // Always notify owner/coordinator as backup
        sendNotificationAsync(
          "🔑 Solicitação de Redefinição de Senha",
          `Professor(a) ${teacher.name} (${teacher.email}) solicitou redefinição de senha.\n\n${emailSent ? '✅ Email enviado automaticamente ao professor.' : '⚠️ Email NÃO enviado (SMTP não configurado). Envie o link manualmente.'}\n\nLink completo: ${fullResetLink}\n\nEste link expira em 1 hora.`
        );

        return {
          success: true,
          message: emailSent
            ? "Um email com o link de redefinição foi enviado para o seu endereço cadastrado."
            : "Link de redefinição gerado com sucesso!",
          resetLink: emailSent ? null : resetPath, // Only show link if email was NOT sent
          emailSent,
        } as const;
      }),

    // Verify reset token and return expiration info
    verifyResetToken: publicProcedure
      .input(z.object({ token: z.string() }))
      .query(async ({ input }) => {
        const tokenData = await db.getPasswordResetToken(input.token);
        if (!tokenData) {
          return { valid: false, message: "Token inválido", expiresAt: null } as const;
        }
        if (tokenData.used) {
          return { valid: false, message: "Token já utilizado", expiresAt: null } as const;
        }
        const expiresAt = new Date(tokenData.expiresAt);
        if (new Date() > expiresAt) {
          return { valid: false, message: "Token expirado", expiresAt: expiresAt.toISOString() } as const;
        }
        return { valid: true, message: "Token válido", expiresAt: expiresAt.toISOString() } as const;
      }),

    // Reset password with token
    resetPassword: publicProcedure
      .input(z.object({
        token: z.string(),
        newPassword: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
      }))
      .mutation(async ({ input }) => {
        // Get token from database
        const tokenData = await db.getPasswordResetToken(input.token);
        if (!tokenData) {
          return { success: false, message: "Token inválido" } as const;
        }

        // Check if token is expired
        if (new Date() > new Date(tokenData.expiresAt)) {
          return { success: false, message: "Token expirado" } as const;
        }

        // Check if token was already used
        if (tokenData.used) {
          return { success: false, message: "Token já utilizado" } as const;
        }

        // Hash new password
        const passwordHash = await bcrypt.hash(input.newPassword, 10);

        // Update teacher password
        await db.updateTeacherAccount(tokenData.teacherAccountId, { passwordHash });

        // Mark token as used
        await db.markPasswordResetTokenUsed(tokenData.id);

        // Get teacher info for notification
        const teacher = await db.getTeacherAccountByEmail(""); // We'll get it by ID instead
        const allTeachers = await db.getAllTeacherAccounts();
        const teacherInfo = allTeachers.find(t => t.id === tokenData.teacherAccountId);

        if (teacherInfo) {
          sendNotificationAsync(
            "✅ Senha Redefinida",
            `${teacherInfo.name} (${teacherInfo.email}) redefiniu a senha com sucesso`
          );
        }

        return { success: true, message: "Senha redefinida com sucesso" } as const;
      }),

    // Verify session token is valid
    verify: publicProcedure
      .input(z.object({ sessionToken: z.string() }))
      .query(async ({ input }) => {
        const teacher = await db.getTeacherAccountBySessionToken(input.sessionToken);
        return { valid: !!teacher && teacher.isActive === 1 };
      }),

    // Create super admin account (one-time setup, requires secret key)
    createSuperAdmin: publicProcedure
      .input(z.object({
        secretKey: z.string(),
        name: z.string(),
        email: z.string().email(),
        password: z.string().min(6),
      }))
      .mutation(async ({ input }) => {
        // Secret key for super admin creation (should be changed in production)
        const SUPER_ADMIN_SECRET = process.env.SUPER_ADMIN_SECRET || "farmaco_super_2026";
        
        if (input.secretKey !== SUPER_ADMIN_SECRET) {
          return { success: false, message: "Chave secreta inválida" } as const;
        }

        // Check if super admin already exists
        const allTeachers = await db.getAllTeacherAccounts();
        const existingSuperAdmin = allTeachers.find(t => t.role === "super_admin");
        if (existingSuperAdmin) {
          return { success: false, message: "Super admin já existe" } as const;
        }

        // Check if email already exists
        const existing = await db.getTeacherAccountByEmail(input.email);
        if (existing) {
          return { success: false, message: "Email já cadastrado" } as const;
        }

        // Hash password
        const passwordHash = await bcrypt.hash(input.password, 10);

        // Create super admin account
        await db.createTeacherAccount({
          email: input.email,
          name: input.name,
          passwordHash,
          role: "super_admin",
          isActive: 1,
        });

        sendNotificationAsync(
          "👑 Super Admin Criado",
          `Conta de super admin criada: ${input.name} (${input.email})`
        );

        return { success: true, message: "Super admin criado com sucesso" } as const;
      }),

    // Get teacher profile
    getProfile: publicProcedure
      .input(z.object({ sessionToken: z.string() }))
      .query(async ({ input }) => {
        const teacher = await db.getTeacherAccountBySessionToken(input.sessionToken);
        if (!teacher) return { success: false, profile: null } as const;
        const profile = await db.getTeacherProfile(teacher.id);
        return { success: true, profile } as const;
      }),

    // Update teacher profile
    updateProfile: publicProcedure
      .input(z.object({
        sessionToken: z.string(),
        name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres").max(200).optional(),
        phone: z.string().max(30).nullable().optional(),
        bio: z.string().max(2000).nullable().optional(),
        specialty: z.string().max(200).nullable().optional(),
        lattesUrl: z.string().max(500).nullable().optional(),
        photoUrl: z.string().nullable().optional(),
        department: z.string().max(200).nullable().optional(),
        title: z.string().max(100).nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        const teacher = await db.getTeacherAccountBySessionToken(input.sessionToken);
        if (!teacher) return { success: false, message: "Sessão inválida" } as const;

        const { sessionToken, ...updateData } = input;
        // Remove undefined fields
        const cleanData: Record<string, any> = {};
        for (const [key, value] of Object.entries(updateData)) {
          if (value !== undefined) cleanData[key] = value;
        }

        if (Object.keys(cleanData).length === 0) {
          return { success: false, message: "Nenhum campo para atualizar" } as const;
        }

        await db.updateTeacherProfile(teacher.id, cleanData);
        const updatedProfile = await db.getTeacherProfile(teacher.id);
        return { success: true, message: "Perfil atualizado com sucesso", profile: updatedProfile } as const;
      }),

    // Change password (requires current password)
    changePassword: publicProcedure
      .input(z.object({
        sessionToken: z.string(),
        currentPassword: z.string(),
        newPassword: z.string().min(6, "Nova senha deve ter pelo menos 6 caracteres"),
      }))
      .mutation(async ({ input }) => {
        const teacher = await db.getTeacherAccountBySessionToken(input.sessionToken);
        if (!teacher) return { success: false, message: "Sessão inválida" } as const;

        // Verify current password
        const valid = await bcrypt.compare(input.currentPassword, teacher.passwordHash);
        if (!valid) return { success: false, message: "Senha atual incorreta" } as const;

        // Hash and update new password
        const passwordHash = await bcrypt.hash(input.newPassword, 10);
        await db.updateTeacherAccount(teacher.id, { passwordHash });

        return { success: true, message: "Senha alterada com sucesso" } as const;
      }),

    // Upload profile photo (receives base64 data)
    uploadPhoto: publicProcedure
      .input(z.object({
        sessionToken: z.string(),
        photoData: z.string(), // base64 encoded image
        mimeType: z.string().default("image/jpeg"),
      }))
      .mutation(async ({ input }) => {
        const teacher = await db.getTeacherAccountBySessionToken(input.sessionToken);
        if (!teacher) return { success: false, message: "Sessão inválida" } as const;

        try {
          const { storagePut } = await import("./storage");
          const buffer = Buffer.from(input.photoData, "base64");
          const ext = input.mimeType.includes("png") ? "png" : "jpg";
          const randomSuffix = crypto.randomBytes(8).toString("hex");
          const fileKey = `teacher-photos/${teacher.id}-${randomSuffix}.${ext}`;
          const { url } = await storagePut(fileKey, buffer, input.mimeType);
          await db.updateTeacherProfile(teacher.id, { photoUrl: url });
          return { success: true, message: "Foto atualizada", photoUrl: url } as const;
        } catch (error) {
          console.error("[Profile] Photo upload error:", error);
          return { success: false, message: "Erro ao enviar foto" } as const;
        }
      }),

    // Send grades report by email
    sendGradesReport: publicProcedure
      .input(z.object({
        sessionToken: z.string(),
        csvContent: z.string(),
        className: z.string().default("Farmacologia I - Medicina"),
        totalStudents: z.number(),
        recipientEmail: z.string().email().optional(),
      }))
      .mutation(async ({ input }) => {
        const teacher = await db.getTeacherAccountBySessionToken(input.sessionToken);
        if (!teacher) return { success: false, message: "Sessão inválida" } as const;

        const toEmail = input.recipientEmail || teacher.email;
        const timestamp = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

        const result = await sendGradesReportEmail({
          to: toEmail,
          professorName: teacher.name || teacher.email,
          className: input.className,
          csvContent: input.csvContent,
          totalStudents: input.totalStudents,
          timestamp,
        });

        if (result.success) {
          return { success: true, message: `Relatório enviado para ${toEmail}` } as const;
        } else {
          return { success: false, message: result.error || "Erro ao enviar email" } as const;
        }
      }),

    // Send bulk email to all students
    sendBulkEmail: publicProcedure
      .input(z.object({
        sessionToken: z.string(),
        subject: z.string().min(1),
        htmlTemplate: z.string().min(1),
        textTemplate: z.string().min(1),
        recipients: z.array(z.object({
          email: z.string().email(),
          name: z.string(),
        })).min(1).max(500),
        delayMs: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const teacher = await db.getTeacherAccountBySessionToken(input.sessionToken);
        if (!teacher || (teacher.role !== "super_admin" && teacher.role !== "coordenador")) {
          return { success: false, message: "Acesso negado" } as const;
        }
        const result = await sendBulkEmail({
          recipients: input.recipients,
          subject: input.subject,
          htmlTemplate: input.htmlTemplate,
          textTemplate: input.textTemplate,
          delayMs: input.delayMs,
        });
        sendNotificationAsync(
          "📧 Email em Massa Enviado",
          `${teacher.name} enviou email para ${result.sent} alunos. Falhas: ${result.failed}`
        );
         return { success: true, sent: result.sent, failed: result.failed, errors: result.errors } as const;
      }),
    // ─── Exam Gabaritos ───
    saveGabarito: publicProcedure
      .input(z.object({
        sessionToken: z.string(),
        classId: z.number(),
        provaType: z.enum(["P1", "P2"]),
        examVersion: z.string().max(1).optional().default("A"),
        answers: z.array(z.string().nullable()).length(25),
        difficulties: z.array(z.enum(["facil", "intermediario", "dificil"])).length(25),
        examDate: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const teacher = await db.getTeacherAccountBySessionToken(input.sessionToken);
        if (!teacher) throw new Error("Não autorizado");
        await db.upsertExamGabarito({
          classId: input.classId,
          provaType: input.provaType,
          examVersion: input.examVersion || "A",
          answers: JSON.stringify(input.answers),
          difficulties: JSON.stringify(input.difficulties),
          examDate: input.examDate,
          createdByName: teacher.name,
        });
        return { success: true };
      }),
    getGabarito: publicProcedure
      .input(z.object({ sessionToken: z.string(), classId: z.number(), provaType: z.enum(["P1", "P2"]), examVersion: z.string().max(1).optional().default("A") }))
      .query(async ({ input }) => {
        const teacher = await db.getTeacherAccountBySessionToken(input.sessionToken);
        if (!teacher) throw new Error("Não autorizado");
        const g = await db.getExamGabarito(input.classId, input.provaType, input.examVersion || "A");
        if (!g) return null;
        return {
          ...g,
          answers: JSON.parse(g.answers) as (string | null)[],
          difficulties: JSON.parse(g.difficulties) as string[],
        };
      }),
    getAllGabaritos: publicProcedure
      .input(z.object({ sessionToken: z.string(), classId: z.number(), provaType: z.enum(["P1", "P2"]) }))
      .query(async ({ input }) => {
        const teacher = await db.getTeacherAccountBySessionToken(input.sessionToken);
        if (!teacher) throw new Error("Não autorizado");
        const gabaritos = await db.getAllExamGabaritosByClassProva(input.classId, input.provaType);
        return gabaritos.map(g => ({
          ...g,
          answers: JSON.parse(g.answers) as (string | null)[],
          difficulties: JSON.parse(g.difficulties) as string[],
        }));
      }),
    saveStudentGrade: publicProcedure
      .input(z.object({
        sessionToken: z.string(),
        classId: z.number(),
        memberId: z.number(),
        memberName: z.string(),
        provaType: z.enum(["P1", "P2"]),
        examVersion: z.string().max(1).optional().default("A"),
        answers: z.array(z.string().nullable()).length(25),
        score: z.number(),
        correctCount: z.number(),
      }))
      .mutation(async ({ input }) => {
        const teacher = await db.getTeacherAccountBySessionToken(input.sessionToken);
        if (!teacher) throw new Error("Não autorizado");
        await db.upsertExamStudentGrade({
          classId: input.classId,
          memberId: input.memberId,
          memberName: input.memberName,
          provaType: input.provaType,
          examVersion: input.examVersion || "A",
          answers: JSON.stringify(input.answers),
          score: input.score.toFixed(2),
          correctCount: input.correctCount,
        });
        return { success: true };
      }),
    getClassGrades: publicProcedure
      .input(z.object({ sessionToken: z.string(), classId: z.number(), provaType: z.enum(["P1", "P2"]) }))
      .query(async ({ input }) => {
        const teacher = await db.getTeacherAccountBySessionToken(input.sessionToken);
        if (!teacher) throw new Error("Não autorizado");
        const grades = await db.getExamStudentGradesByClass(input.classId, input.provaType);
        return grades.map(g => ({
          ...g,
          answers: JSON.parse(g.answers) as (string | null)[],
          score: parseFloat(g.score.toString()),
        }));
      }),
    getAllGradesReport: publicProcedure
      .input(z.object({ sessionToken: z.string(), provaType: z.enum(["P1", "P2"]) }))
      .query(async ({ input }) => {
        const teacher = await db.getTeacherAccountBySessionToken(input.sessionToken);
        if (!teacher) throw new Error("Não autorizado");
        const grades = await db.getExamStudentGradesByAllClasses(input.provaType);
        const allClasses = await db.getAllClasses();
        const classMap = new Map(allClasses.map((c: any) => [c.id, c.name]));
        return grades.map(g => ({
          ...g,
          className: classMap.get(g.classId) || `Turma ${g.classId}`,
          score: parseFloat(g.score.toString()),
        }));
      }),
    // ─── Grade Sheet: Planilha completa de notas por turma ───
    getGradeSheet: publicProcedure
      .input(z.object({ sessionToken: z.string(), classId: z.number() }))
      .query(async ({ input }) => {
        const teacher = await db.getTeacherAccountBySessionToken(input.sessionToken);
        if (!teacher) throw new Error("Não autorizado");
        // 1. Membros da turma
        const membersList = await db.getMembersByClass(input.classId);
        // 2. Notas de provas P1 e P2
        const p1Grades = await db.getExamStudentGradesByClass(input.classId, "P1");
        const p2Grades = await db.getExamStudentGradesByClass(input.classId, "P2");
        const p1Map = new Map(p1Grades.map((g: any) => [g.memberId, parseFloat(g.score.toString())]));
        const p2Map = new Map(p2Grades.map((g: any) => [g.memberId, parseFloat(g.score.toString())]));
        // 3. Equipes
        const allTeams = await db.getAllTeams();
        const teamMap = new Map(allTeams.map((t: any) => [t.id, { name: t.name, emoji: t.emoji }]));
        // 4. Notas de monitores (groupActivityGrades) - por grupo
        const { groupActivityGrades: gagTable, jigsawHomeMembers: jhmTable, teacherGrades: tgTable, jigsawScores: jsTable } = await import("../drizzle/schema");
        const { eq: eqOp } = await import("drizzle-orm");
        const dbConn = await db.getDb();
        let monitorGrades: any[] = [];
        let homeGroupMemberRows: any[] = [];
        try {
          if (dbConn) {
            monitorGrades = await dbConn.select().from(gagTable).where(eqOp(gagTable.classId, input.classId));
            homeGroupMemberRows = await dbConn.select().from(jhmTable);
          }
        } catch (e) { console.warn("[GradeSheet] monitorGrades error:", e); }
        // Map homeGroupId -> [memberId]
        const homeGroupMemberMap = new Map<number, number[]>();
        for (const row of homeGroupMemberRows) {
          if (!homeGroupMemberMap.has(row.homeGroupId)) homeGroupMemberMap.set(row.homeGroupId, []);
          homeGroupMemberMap.get(row.homeGroupId)!.push(row.memberId);
        }
        // 5. Notas do professor (teacherGrades)
        let teacherGradesList: any[] = [];
        try {
          if (dbConn) {
            teacherGradesList = await dbConn.select().from(tgTable).where(eqOp(tgTable.classId, input.classId));
          }
        } catch (e) { console.warn("[GradeSheet] teacherGrades error:", e); }
        // 6. Notas do Jigsaw por membro
        let jigsawScoresList: any[] = [];
        try {
          if (dbConn) {
            jigsawScoresList = await dbConn.select().from(jsTable).where(eqOp(jsTable.classId, input.classId));
          }
        } catch (e) { console.warn("[GradeSheet] jigsawScores error:", e); }
        // Map memberId -> jigsawScore
        const jigsawMap = new Map<number, { fase1PF: number; fase2PF: number; fase3PF: number; totalJigsawPF: number }>();
        for (const js of jigsawScoresList) {
          jigsawMap.set(js.memberId, {
            fase1PF: parseFloat(js.fase1PF?.toString() || "0"),
            fase2PF: parseFloat(js.fase2PF?.toString() || "0"),
            fase3PF: parseFloat(js.fase3PF?.toString() || "0"),
            totalJigsawPF: parseFloat(js.totalJigsawPF?.toString() || "0"),
          });
        }
        // 7. Montar linhas por membro
        const rows = membersList.map((member: any) => {
          const memberId = member.id;
          const pf = parseFloat(member.xp?.toString() || "0");
          const p1 = p1Map.get(memberId) ?? null;
          const p2 = p2Map.get(memberId) ?? null;
          // Notas de monitores: pegar nota do grupo do membro
          const memberMonitorGrades: Record<string, number | null> = {};
          for (const mg of monitorGrades) {
            if (mg.homeGroupId) {
              const groupMembers = homeGroupMemberMap.get(mg.homeGroupId) || [];
              if (groupMembers.includes(memberId)) {
                const key = `${mg.activityType}:::${mg.activityName}`;
                if (!(key in memberMonitorGrades)) {
                  memberMonitorGrades[key] = parseFloat(mg.grade?.toString() || "0");
                }
              }
            }
          }
          // Notas do professor: por memberId ou memberName
          const memberTeacherGrades: Record<string, number | null> = {};
          for (const tg of teacherGradesList) {
            if (tg.memberId === memberId || (!tg.memberId && tg.memberName === member.name)) {
              const key = `${tg.activityType}:::${tg.activityName}`;
              if (!(key in memberTeacherGrades)) {
                memberTeacherGrades[key] = parseFloat(tg.grade?.toString() || "0");
              }
            }
          }
          // Notas do Jigsaw
          const jigsaw = jigsawMap.get(memberId) || null;
          return {
            memberId,
            memberName: member.name,
            teamId: member.teamId,
            teamName: teamMap.get(member.teamId)?.name || "Sem equipe",
            teamEmoji: teamMap.get(member.teamId)?.emoji || "🧪",
            pf,
            p1,
            p2,
            monitorGrades: memberMonitorGrades,
            teacherGrades: memberTeacherGrades,
            jigsawFase1: jigsaw?.fase1PF ?? null,
            jigsawFase2: jigsaw?.fase2PF ?? null,
            jigsawFase3: jigsaw?.fase3PF ?? null,
            jigsawTotal: jigsaw?.totalJigsawPF ?? null,
          };
        });
        // 8. Atividades únicas
        const monitorActivityKeys = [...new Set(monitorGrades.map((g: any) => `${g.activityType}:::${g.activityName}`))].sort();
        const teacherActivityKeys = [...new Set(teacherGradesList.map((g: any) => `${g.activityType}:::${g.activityName}`))].sort();
        return { rows, monitorActivityKeys, teacherActivityKeys };
      }),
  }),
  // ─── Super Admin Profile & Stats ───
  superAdmin: router({
    // Get system statistics (super admin only)
    getStats: publicProcedure
      .input(z.object({ sessionToken: z.string(), classId: z.number().optional() }))
      .query(async ({ input }) => {
        // Verify super admin or coordenador
        const teacher = await db.getTeacherAccountBySessionToken(input.sessionToken);
        if (!teacher || (teacher.role !== "super_admin" && teacher.role !== "coordenador")) {
          throw new Error("Acesso negado: apenas super admin ou coordenador pode acessar estatísticas");
        }

        // Get all data (optionally filtered by class)
        const allClasses = await db.getAllClasses();
        const allTeachers = await db.getAllTeacherAccounts();
        const allStudents = await db.getAllStudentAccounts();

        let scopeTeams, scopeMembers;
        if (input.classId) {
          scopeTeams = await db.getTeamsByClass(input.classId);
          scopeMembers = await db.getMembersByClass(input.classId);
        } else {
          scopeTeams = await db.getAllTeams();
          scopeMembers = await db.getAllMembers();
        }
        
        // Calculate stats
        const totalTeams = scopeTeams.length;
        const totalMembers = scopeMembers.length;
        const totalTeachers = allTeachers.length;
        const activeTeachers = allTeachers.filter(t => t.isActive === 1).length;
        const coordenadores = allTeachers.filter(t => t.role === "coordenador").length;

        // For student accounts, filter by class if needed
        const memberIds = new Set(scopeMembers.map((m: any) => m.studentAccountId).filter(Boolean));
        const scopeStudents = input.classId
          ? allStudents.filter(s => memberIds.has(s.id))
          : allStudents;
        const totalStudentAccounts = scopeStudents.length;
        const activeStudentAccounts = scopeStudents.filter(s => s.isActive === 1).length;
        
        // Calculate total PF
        const totalXP = scopeMembers.reduce((sum: number, m: any) => sum + parseFloat(m.xp.toString()), 0);
        const avgXPPerMember = totalMembers > 0 ? totalXP / totalMembers : 0;

        // Selected class info
        const selectedClass = input.classId ? allClasses.find(c => c.id === input.classId) : null;

        return {
          system: {
            totalTeams,
            totalMembers,
            totalClasses: allClasses.length,
            totalXP: totalXP.toFixed(1),
            avgXPPerMember: avgXPPerMember.toFixed(1),
            selectedClassName: selectedClass?.name || null,
          },
          teachers: {
            total: totalTeachers,
            active: activeTeachers,
            inactive: totalTeachers - activeTeachers,
            coordenadores,
            superAdmins: allTeachers.filter(t => t.role === "super_admin").length,
          },
          students: {
            totalMembers,
            totalAccounts: totalStudentAccounts,
            activeAccounts: activeStudentAccounts,
            withoutAccount: totalMembers - totalStudentAccounts,
          },
          classes: allClasses.map(c => ({ id: c.id, name: c.name, course: c.course })),
        };
      }),

    // Get recent activities (super admin only)
    getRecentActivities: publicProcedure
      .input(z.object({ sessionToken: z.string(), limit: z.number().optional() }))
      .query(async ({ input }) => {
        // Verify super admin or coordenador
        const teacher = await db.getTeacherAccountBySessionToken(input.sessionToken);
        if (!teacher || (teacher.role !== "super_admin" && teacher.role !== "coordenador")) {
          throw new Error("Acesso negado: apenas super admin ou coordenador pode acessar atividades");
        }

        // Get recent audit logs for this super admin
        // TODO: Implement getAuditLogsByTeacher in db.ts
        return [];
      }),

    // Get super admin profile
    getProfile: publicProcedure
      .input(z.object({ sessionToken: z.string() }))
      .query(async ({ input }) => {
        // Verify super admin
        const teacher = await db.getTeacherAccountBySessionToken(input.sessionToken);
        if (!teacher || teacher.role !== "super_admin") {
          throw new Error("Acesso negado: apenas super admin pode acessar perfil");
        }

        return {
          id: teacher.id,
          name: teacher.name,
          email: teacher.email,
          role: teacher.role,
          createdAt: teacher.createdAt,
          lastLoginAt: teacher.lastLoginAt,
          permissions: [
            "Gerenciar professores (criar, editar, promover, remover)",
            "Gerenciar alunos e equipes",
            "Visualizar e editar todos os dados do sistema",
            "Acessar logs de auditoria completos",
            "Configurar parâmetros do sistema",
            "Exportar relatórios e estatísticas",
          ],
        };
      }),
    // Run a database migration (super admin only)
    runMigration: publicProcedure
      .input(z.object({ sessionToken: z.string(), sql: z.string() }))
      .mutation(async ({ input }) => {
        const teacher = await db.getTeacherAccountBySessionToken(input.sessionToken);
        if (!teacher || teacher.role !== "super_admin") throw new Error("Acesso negado");
        const rawDb = await db.getRawDb();
        if (!rawDb) throw new Error("Database unavailable");
        const [rows] = await rawDb.execute(input.sql);
        return { success: true, rows };
      }),
  }),

  // ─── Teacher Management (Coordenador only) ───
  teacherManagement: router({ // List all teachers (coordenador only)
    listAll: publicProcedure
      .input(z.object({ sessionToken: z.string() }))
      .query(async ({ input }) => {
        // Verify teacher is coordenador
        const teacher = await db.getTeacherAccountBySessionToken(input.sessionToken);
        if (!teacher || (teacher.role !== "coordenador" && teacher.role !== "super_admin")) {
          throw new Error("Acesso negado: apenas coordenadores ou super admin podem listar professores");
        }

        const allTeachers = await db.getAllTeacherAccounts();
        return allTeachers.map(t => ({
          id: t.id,
          name: t.name,
          email: t.email,
          role: t.role,
          isActive: t.isActive,
          lastLoginAt: t.lastLoginAt,
          createdAt: t.createdAt,
        }));
      }),

    // Toggle teacher active status
    toggleActive: publicProcedure
      .input(z.object({
        sessionToken: z.string(),
        teacherId: z.number(),
        isActive: z.number(),
      }))
      .mutation(async ({ input }) => {
        // Verify teacher is coordenador
        const teacher = await db.getTeacherAccountBySessionToken(input.sessionToken);
        if (!teacher || (teacher.role !== "coordenador" && teacher.role !== "super_admin")) {
          throw new Error("Acesso negado: apenas coordenadores ou super admin podem ativar/desativar professores");
        }

        // Can't deactivate yourself
        if (teacher.id === input.teacherId) {
          throw new Error("Você não pode desativar sua própria conta");
        }

        await db.updateTeacherAccount(input.teacherId, { isActive: input.isActive });

        const targetTeacher = await db.getAllTeacherAccounts().then(all => all.find(t => t.id === input.teacherId));
        sendNotificationAsync(
          input.isActive ? "✅ Professor Ativado" : "❌ Professor Desativado",
          `${teacher.name} ${input.isActive ? 'ativou' : 'desativou'} a conta de ${targetTeacher?.name} (${targetTeacher?.email})`
        );

        return { success: true, message: input.isActive ? "Professor ativado" : "Professor desativado" } as const;
      }),

    // Promote teacher to coordenador
    promoteToCoordinator: publicProcedure
      .input(z.object({
        sessionToken: z.string(),
        teacherId: z.number(),
      }))
      .mutation(async ({ input }) => {
        // Verify teacher is coordenador
        const teacher = await db.getTeacherAccountBySessionToken(input.sessionToken);
        if (!teacher || (teacher.role !== "coordenador" && teacher.role !== "super_admin")) {
          throw new Error("Acesso negado: apenas coordenadores ou super admin podem promover professores");
        }

        await db.updateTeacherAccount(input.teacherId, { role: "coordenador" });

        const targetTeacher = await db.getAllTeacherAccounts().then(all => all.find(t => t.id === input.teacherId));
        sendNotificationAsync(
          "👑 Professor Promovido a Coordenador",
          `${teacher.name} promoveu ${targetTeacher?.name} (${targetTeacher?.email}) a coordenador`
        );

        return { success: true, message: "Professor promovido a coordenador" } as const;
      }),

    // Demote coordenador to professor
    demoteToTeacher: publicProcedure
      .input(z.object({
        sessionToken: z.string(),
        teacherId: z.number(),
      }))
      .mutation(async ({ input }) => {
        // Verify teacher is coordenador
        const teacher = await db.getTeacherAccountBySessionToken(input.sessionToken);
        if (!teacher || (teacher.role !== "coordenador" && teacher.role !== "super_admin")) {
          throw new Error("Acesso negado: apenas coordenadores ou super admin podem rebaixar professores");
        }

        // Can't demote yourself
        if (teacher.id === input.teacherId) {
          throw new Error("Você não pode rebaixar sua própria conta");
        }

        await db.updateTeacherAccount(input.teacherId, { role: "professor" });

        const targetTeacher = await db.getAllTeacherAccounts().then(all => all.find(t => t.id === input.teacherId));
        sendNotificationAsync(
          "👨‍🏫 Coordenador Rebaixado a Professor",
          `${teacher.name} rebaixou ${targetTeacher?.name} (${targetTeacher?.email}) a professor`
        );

        return { success: true, message: "Coordenador rebaixado a professor" } as const;
      }),

    // Delete teacher account
    deleteTeacher: publicProcedure
      .input(z.object({
        sessionToken: z.string(),
        teacherId: z.number(),
      }))
      .mutation(async ({ input }) => {
        // Verify teacher is coordenador
        const teacher = await db.getTeacherAccountBySessionToken(input.sessionToken);
        if (!teacher || (teacher.role !== "coordenador" && teacher.role !== "super_admin")) {
          throw new Error("Acesso negado: apenas coordenadores ou super admin podem remover professores");
        }

        // Can't delete yourself
        if (teacher.id === input.teacherId) {
          throw new Error("Você não pode remover sua própria conta");
        }

        const targetTeacher = await db.getAllTeacherAccounts().then(all => all.find(t => t.id === input.teacherId));
        
        // Remove all team assignments first
        await db.removeAllTeacherTeams(input.teacherId);
        
        // Delete teacher account
        await db.deleteTeacherAccount(input.teacherId);

        sendNotificationAsync(
          "🗑️ Professor Removido",
          `${teacher.name} removeu a conta de ${targetTeacher?.name} (${targetTeacher?.email})`
        );

        return { success: true, message: "Professor removido com sucesso" } as const;
      }),
  }),

  // ─── Student Dashboard ───
  studentDashboard: router({
    // Get student's own stats and ranking
    getMyStats: publicProcedure
      .input(z.object({ sessionToken: z.string() }))
      .query(async ({ input }) => {
      // Tentar obter conta de aluno primeiro, depois admin
      let account = await db.getStudentAccountBySessionToken(input.sessionToken);
      if (!account) {
        // Se não for aluno, verificar se é admin
        const adminAccount = await db.getTeacherAccountBySessionToken(input.sessionToken);
        if (!adminAccount) return null;
        // Admin pode visualizar dashboard vazio ou com dados gerais
        return {
          studentName: "Administrador",
          totalPF: 0,
          rank: 0,
          totalStudents: 0,
          badgesCount: 0,
          attendanceCount: 0,
          teamName: "Admin",
        };
      }
      
      const allMembers = await db.getAllMembers();
      const myMember = allMembers.find(m => m.id === account.memberId);
      if (!myMember) return null;
      
      // Calculate ranking
      const sortedMembers = [...allMembers].sort((a, b) => Number(b.xp) - Number(a.xp));
      const myRank = sortedMembers.findIndex(m => m.id === myMember.id) + 1;
      
      // Get badges
      const myBadges = await db.getStudentBadges(account.id);
      
      // Get attendance
      const myAttendance = await db.getAttendanceByStudent(account.id);
      
      return {
        studentName: myMember.name,
        totalPF: myMember.xp,
        rank: myRank,
        totalStudents: allMembers.length,
        badgesCount: myBadges.length,
        attendanceCount: myAttendance.length,
        teamName: myMember.teamId ? (await db.getTeamById(myMember.teamId))?.name : "Sem equipe",
        classId: myMember.classId || null,
        memberId: myMember.id,
      };
    }),
    
    // Get PF evolution over weeks
    getEvolution: publicProcedure
      .input(z.object({ sessionToken: z.string() }))
      .query(async ({ input }) => {
      let account = await db.getStudentAccountBySessionToken(input.sessionToken);
      if (!account) {
        // Se não for aluno, verificar se é admin
        const adminAccount = await db.getTeacherAccountBySessionToken(input.sessionToken);
        if (!adminAccount) return [];
        return [];
      }
      
      const allMembers = await db.getAllMembers();
      if (!account.memberId) return [];
      const myMember = allMembers.find(m => m.id === account.memberId);
      if (!myMember) return [];
      
      // Get real XP history from database
      const history = await db.getXpHistoryByMember(account.memberId);
      
      // If we have history data, use it
      if (history.length > 0) {
        return history.map(h => ({
          week: h.week,
          pf: Number(h.xpValue),
        }));
      }
      
      // Fallback: if no history yet, return simulated progressive data
      const totalPF = Number(myMember.xp);
      const weeklyData: { week: number; pf: number }[] = [];
      
      for (let week = 1; week <= 17; week++) {
        // Simulate progressive accumulation
        const progress = week / 17;
        const weekPF = totalPF * progress;
        weeklyData.push({ week, pf: Math.round(weekPF * 10) / 10 });
      }
      
      return weeklyData;
    }),
    
    //     // Get badges
    getBadges: publicProcedure
      .input(z.object({ sessionToken: z.string() }))
      .query(async ({ input }) => {
      let account = await db.getStudentAccountBySessionToken(input.sessionToken);
      if (!account) {
        // Se não for aluno, verificar se é admin
        const adminAccount = await db.getTeacherAccountBySessionToken(input.sessionToken);
        if (!adminAccount) return [];
        return [];
      };
      
      const myBadges = await db.getStudentBadges(account.id);
      return myBadges;
    }),
  }),

  // ─── Public Leaderboard Data ───
  leaderboard: router({
    getData: publicProcedure.query(async () => {
      const [teamsData, membersData, activitiesData, highlightsData, settings, classesData] = await Promise.all([
        db.getAllTeams(),
        db.getAllMembers(),
        db.getAllXpActivities(),
        db.getAllHighlights(),
        db.getAllSettings(),
        db.getAllClasses(),
      ]);

      const settingsMap: Record<string, string> = {};
      for (const s of settings) {
        if (s.settingKey !== ADMIN_PASSWORD_KEY) {
          settingsMap[s.settingKey] = s.settingValue;
        }
      }

      // Build teams from real teams
      let teamsResult: any[] = teamsData.map(t => ({
        ...t,
        members: membersData
          .filter(m => m.teamId === t.id)
          .map(m => ({ ...m, xp: parseFloat(m.xp) }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      }));

      // If no teams, create virtual teams per class
      if (teamsResult.length === 0 && membersData.length > 0) {
        const classColors = ["#F7941D", "#4CAF50", "#2196F3", "#9C27B0", "#FF5722", "#00BCD4", "#E91E63"];
        const classMap = new Map(classesData.map(c => [c.id, c]));
        const membersByClass = new Map<number | null, typeof membersData>();
        for (const m of membersData) {
          const key = m.classId ?? null;
          if (!membersByClass.has(key)) membersByClass.set(key, []);
          membersByClass.get(key)!.push(m);
        }
        let colorIdx = 0;
        for (const [classId, classMembers] of membersByClass.entries()) {
          if (!classId) continue; // Skip unassigned
          const cls = classMap.get(classId);
          teamsResult.push({
            id: -classId,
            name: cls?.name || `Turma ${classId}`,
            emoji: "\uD83C\uDF93",
            color: classColors[colorIdx++ % classColors.length],
            classId,
            createdAt: new Date(),
            members: classMembers
              .map(m => ({ ...m, xp: parseFloat(m.xp) }))
              .sort((a, b) => parseFloat(b.xp as any) - parseFloat(a.xp as any)),
          });
        }
      }

      return {
        teams: teamsResult,
        members: membersData.map(m => ({ ...m, xp: parseFloat(m.xp) })).sort((a, b) => parseFloat(b.xp as any) - parseFloat(a.xp as any)),
        activities: activitiesData.map(a => ({ ...a, maxXP: parseFloat(a.maxXP) })).sort((a, b) => a.name.localeCompare(b.name)),
        highlights: highlightsData.sort((a, b) => b.week - a.week),
        settings: settingsMap,
      };
    }),

    getDataByClass: publicProcedure
      .input(z.object({ classId: z.number() }))
      .query(async ({ input }) => {
        const classTeams = await db.getTeamsByClass(input.classId);
        const classMembers = await db.getMembersByClass(input.classId);
        const activitiesData = await db.getAllXpActivities();
        const highlightsData = await db.getAllHighlights();
        const settings = await db.getAllSettings();

        const settingsMap: Record<string, string> = {};
        for (const s of settings) {
          if (s.settingKey !== ADMIN_PASSWORD_KEY) {
            settingsMap[s.settingKey] = s.settingValue;
          }
        }

        // Build teams list: real teams + virtual team for unassigned members
        let teamsResult: any[] = classTeams.map(t => ({
          ...t,
          members: classMembers
            .filter(m => m.teamId === t.id)
            .map(m => ({ ...m, xp: parseFloat(m.xp) }))
            .sort((a, b) => a.name.localeCompare(b.name)),
        }));
        // If no teams exist, create a virtual team with all class members for ranking display
        if (teamsResult.length === 0 && classMembers.length > 0) {
          teamsResult = [{
            id: -input.classId,
            name: "Alunos da Turma",
            emoji: "\uD83C\uDF93",
            color: "#F7941D",
            classId: input.classId,
            createdAt: new Date(),
            members: classMembers
              .map(m => ({ ...m, xp: parseFloat(m.xp) }))
              .sort((a, b) => parseFloat(b.xp as any) - parseFloat(a.xp as any)),
          }];
        }
        return {
          teams: teamsResult,
          members: classMembers.map(m => ({ ...m, xp: parseFloat(m.xp) })).sort((a, b) => parseFloat(b.xp as any) - parseFloat(a.xp as any)),
          activities: activitiesData.map(a => ({ ...a, maxXP: parseFloat(a.maxXP) })).sort((a, b) => a.name.localeCompare(b.name)),
          highlights: highlightsData.sort((a, b) => b.week - a.week),
          settings: settingsMap,
        };
      }),
  }),

  // ─── Admin CRUD (password-protected) ───
  teams: router({
    list: publicProcedure
      .input(z.object({ password: z.string().optional(), sessionToken: z.string().optional() }))
      .query(async ({ input }) => {
        // Allow access via password OR sessionToken (for super admin / coordenador)
        if (input.sessionToken) {
          const teacher = await db.getTeacherAccountBySessionToken(input.sessionToken);
          if (teacher && (teacher.role === "super_admin" || teacher.role === "coordenador")) {
            return db.getAllTeams();
          }
        }
        if (input.password) {
          const valid = await verifyAdminPassword(input.password);
          if (valid) return db.getAllTeams();
        }
        throw new Error("Não autorizado");
      }),

    create: publicProcedure
      .input(z.object({
        password: z.string(),
        name: z.string().min(1),
        emoji: z.string().default("🧪"),
        color: z.string().default("#10b981"),
        classId: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const valid = await verifyAdminPassword(input.password);
        if (!valid) throw new Error("Não autorizado");
        const { password, ...data } = input;
        const id = await db.createTeam(data);
        return { id };
      }),

    update: publicProcedure
      .input(z.object({
        password: z.string(),
        id: z.number(),
        name: z.string().optional(),
        emoji: z.string().optional(),
        color: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const valid = await verifyAdminPassword(input.password);
        if (!valid) throw new Error("Não autorizado");
        const { password, id, ...data } = input;
        await db.updateTeam(id, data);
        return { success: true };
      }),

    delete: publicProcedure
      .input(z.object({ password: z.string().optional(), sessionToken: z.string().optional(), id: z.number() }))
      .mutation(async ({ input }) => {
        // Allow access via password OR sessionToken
        let authorized = false;
        if (input.sessionToken) {
          const teacher = await db.getTeacherAccountBySessionToken(input.sessionToken);
          if (teacher && (teacher.role === "super_admin" || teacher.role === "coordenador")) authorized = true;
        }
        if (!authorized && input.password) {
          authorized = await verifyAdminPassword(input.password);
        }
        if (!authorized) throw new Error("Não autorizado");
        await db.deleteTeam(input.id);
        return { success: true };
      }),
  }),

  members: router({
    list: publicProcedure
      .input(z.object({ password: z.string().optional(), sessionToken: z.string().optional(), teamId: z.number().optional() }))
      .query(async ({ input }) => {
        // Allow access via password OR sessionToken
        let authorized = false;
        if (input.sessionToken) {
          const teacher = await db.getTeacherAccountBySessionToken(input.sessionToken);
          if (teacher && (teacher.role === "super_admin" || teacher.role === "coordenador")) authorized = true;
        }
        if (!authorized && input.password) {
          authorized = await verifyAdminPassword(input.password);
        }
        if (!authorized) throw new Error("Não autorizado");
        if (input.teamId) return db.getMembersByTeam(input.teamId);
        return db.getAllMembers();
      }),

    create: publicProcedure
      .input(z.object({
        sessionToken: z.string().optional(),
        password: z.string(),
        teamId: z.number(),
        name: z.string().min(1),
        xp: z.string().default("0"),
        classId: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const valid = await verifyAdminPassword(input.password);
        if (!valid) throw new Error("Não autorizado");
        const { password, sessionToken, ...data } = input;
        const id = await db.createMember(data);
        
        // Audit log
        if (sessionToken) {
          await logAudit({
            teacherToken: sessionToken,
            action: "Criar Aluno",
            entityType: "member",
            entityId: id,
            details: `Nome: ${input.name}, Equipe ID: ${input.teamId}`,
            req: ctx.req,
          });
        }
        
        return { id };
      }),

    update: publicProcedure
      .input(z.object({
        sessionToken: z.string().optional(),
        password: z.string(),
        id: z.number(),
        name: z.string().optional(),
        teamId: z.number().optional(),
        xp: z.string().optional(),
        classId: z.number().nullable().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const valid = await verifyAdminPassword(input.password);
        if (!valid) throw new Error("Não autorizado");
        const { password, sessionToken, id, ...data } = input;
        
        // Get member before update for audit
        const allMembers = await db.getAllMembers();
        const member = allMembers.find(m => m.id === id);
        
        await db.updateMember(id, data);
        
        // Audit log
        if (sessionToken && member) {
          const changes = [];
          if (data.name) changes.push(`Nome: ${member.name} → ${data.name}`);
          if (data.teamId) changes.push(`Equipe: ${member.teamId} → ${data.teamId}`);
          if (data.xp) changes.push(`PF: ${member.xp} → ${data.xp}`);
          
          await logAudit({
            teacherToken: sessionToken,
            action: "Atualizar Aluno",
            entityType: "member",
            entityId: id,
            details: changes.join(", "),
            req: ctx.req,
          });
        }
        
        return { success: true };
      }),

    updateXP: publicProcedure
      .input(z.object({
        sessionToken: z.string().optional(), // Teacher session token for audit
        password: z.string(),
        id: z.number(),
        xp: z.string(),
        week: z.number().optional(), // Optional week number for history tracking
      }))
      .mutation(async ({ input, ctx }) => {
        const valid = await verifyAdminPassword(input.password);
        if (!valid) throw new Error("Não autorizado");
        
        // Get member before update for audit
        const allMembers = await db.getAllMembers();
        const member = allMembers.find(m => m.id === input.id);
        const oldXP = member?.xp || "0";
        
        await db.updateMemberXP(input.id, input.xp);
        
        // Record XP history if week is provided
        if (input.week) {
          try {
            await db.recordXpHistory({
              memberId: input.id,
              week: input.week,
              xpValue: input.xp,
            });
          } catch (err) {
            console.warn("[XP History] Failed to record:", err);
          }
        }
        
        // Audit log
        if (input.sessionToken) {
          await logAudit({
            teacherToken: input.sessionToken,
            action: "Atualizar PF",
            entityType: "member",
            entityId: input.id,
            details: `${member?.name}: ${oldXP} → ${input.xp} PF${input.week ? ` (Semana ${input.week})` : ''}`,
            req: ctx.req,
          });
        }
        
        // Notification: XP updated
        try {
          if (member) {
            sendNotificationAsync(
              "📊 Pontuação Atualizada",
              `PF de ${member.name} atualizado para ${input.xp}`
            );
          }
        } catch {}
        return { success: true };
      }),

    bulkUpdateXP: publicProcedure
      .input(z.object({
        sessionToken: z.string().optional(),
        password: z.string(),
        updates: z.array(z.object({ id: z.number(), xp: z.string() })),
        week: z.number().optional(), // Optional week number for history tracking
      }))
      .mutation(async ({ input, ctx }) => {
        const valid = await verifyAdminPassword(input.password);
        if (!valid) throw new Error("Não autorizado");
        await db.bulkUpdateXP(input.updates);
        
        // Record XP history for all updated members if week is provided
        if (input.week) {
          for (const update of input.updates) {
            try {
              await db.recordXpHistory({
                memberId: update.id,
                week: input.week,
                xpValue: update.xp,
              });
            } catch (err) {
              console.warn(`[XP History] Failed to record for member ${update.id}:`, err);
            }
          }
        }
        
        // Audit log
        if (input.sessionToken) {
          await logAudit({
            teacherToken: input.sessionToken,
            action: "Atualização em Massa de PF",
            entityType: "member",
            details: `${input.updates.length} aluno(s) atualizados${input.week ? ` (Semana ${input.week})` : ''}`,
            req: ctx.req,
          });
        }
        
        // Notification: bulk XP update
        const count = input.updates.length;
        createStudentNotification(
          "🎯 Pontuações Atualizadas",
          `Os Pontos Farmacológicos de ${count} aluno(s) foram atualizados. Confira o leaderboard!`,
          "important"
        );
        sendNotificationAsync(
          "📊 Atualização em Massa de PF",
          `${count} aluno(s) tiveram seus PF atualizados`
        );
        return { success: true, count };
      }),

    delete: publicProcedure
      .input(z.object({ sessionToken: z.string().optional(), password: z.string().optional(), id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        // Allow access via password OR sessionToken
        let authorized = false;
        if (input.sessionToken) {
          const teacher = await db.getTeacherAccountBySessionToken(input.sessionToken);
          if (teacher && (teacher.role === "super_admin" || teacher.role === "coordenador")) authorized = true;
        }
        if (!authorized && input.password) {
          authorized = await verifyAdminPassword(input.password);
        }
        if (!authorized) throw new Error("Não autorizado");
        
        // Get member before delete for audit
        const allMembers = await db.getAllMembers();
        const member = allMembers.find(m => m.id === input.id);
        
        await db.deleteMember(input.id);
        
        // Audit log
        if (input.sessionToken && member) {
          await logAudit({
            teacherToken: input.sessionToken,
            action: "Excluir Aluno",
            entityType: "member",
            entityId: input.id,
            details: `${member.name} (Equipe ${member.teamId})`,
            req: ctx.req,
          });
        }
        
        return { success: true };
      }),

    importBulk: publicProcedure
      .input(z.object({
        sessionToken: z.string(),
        classId: z.number(),
        students: z.array(z.object({
          name: z.string().min(1),
          email: z.string().email().optional(),
          teamId: z.number().optional(),
          xp: z.string().default("0"),
        })),
      }))
      .mutation(async ({ input, ctx }) => {
        const teacher = await db.getTeacherAccountBySessionToken(input.sessionToken);
        if (!teacher) throw new Error("Nao autorizado");
        
        const classData = await db.getClassById(input.classId);
        if (!classData) throw new Error("Turma nao encontrada");
        if (teacher.role !== "super_admin" && classData.teacherAccountId !== teacher.id) {
          throw new Error("Voce nao tem permissao para importar alunos nesta turma");
        }
        
        const imported = [];
        const errors = [];
        
        for (const student of input.students) {
          try {
            const id = await db.createMember({
              name: student.name,
              teamId: student.teamId || 0,
              xp: student.xp,
              classId: input.classId,
            });
            imported.push({ id, name: student.name });
          } catch (err: any) {
            errors.push({ name: student.name, error: err.message });
          }
        }
        
        await logAudit({
          teacherToken: input.sessionToken,
          action: "Importar Alunos em Massa",
          entityType: "member",
          details: `Turma ${classData.name}: ${imported.length} aluno(s) importado(s), ${errors.length} erro(s)`,
          req: ctx.req,
        });
        
        sendNotificationAsync(
          "Importacao de Alunos",
          `${imported.length} aluno(s) importado(s) para ${classData.name}${errors.length > 0 ? ` (${errors.length} erro(s))` : ''}`
        );
        
        return {
          success: true,
          imported: imported.length,
          errors: errors.length,
          details: { imported, errors },
        };
      }),

    importFromUnirio: publicProcedure
      .input(z.object({
        cpf: z.string(),
        password: z.string(),
        sessionToken: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return { imported: 5, errors: 0, message: "Importacao simulada" };
      }),
  }),

  activities: router({
    create: publicProcedure
      .input(z.object({
        password: z.string(),
        name: z.string().min(1),
        icon: z.string().default("🎯"),
        maxXP: z.string().default("1"),
      }))
      .mutation(async ({ input }) => {
        const valid = await verifyAdminPassword(input.password);
        if (!valid) throw new Error("Não autorizado");
        const { password, ...data } = input;
        const id = await db.createXpActivity(data);
        return { id };
      }),

    update: publicProcedure
      .input(z.object({
        password: z.string(),
        id: z.number(),
        name: z.string().optional(),
        icon: z.string().optional(),
        maxXP: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const valid = await verifyAdminPassword(input.password);
        if (!valid) throw new Error("Não autorizado");
        const { password, id, ...data } = input;
        await db.updateXpActivity(id, data);
        return { success: true };
      }),

    delete: publicProcedure
      .input(z.object({ password: z.string(), id: z.number() }))
      .mutation(async ({ input }) => {
        const valid = await verifyAdminPassword(input.password);
        if (!valid) throw new Error("Não autorizado");
        await db.deleteXpActivity(input.id);
        return { success: true };
      }),

    // Import all default semester activities
    importDefault: publicProcedure
      .input(z.object({ password: z.string() }))
      .mutation(async ({ input }) => {
        const valid = await verifyAdminPassword(input.password);
        if (!valid) throw new Error("Não autorizado");

        const defaultActivities = [
          { name: "Participação em Aula", icon: "📚", maxXP: "5" },
          { name: "TBL 1 — Farmacocinética 2", icon: "🧠", maxXP: "10" },
          { name: "TBL 2 — Boas Práticas de Prescrição", icon: "🧠", maxXP: "10" },
          { name: "TBL 3 — Adrenérgicos", icon: "🧠", maxXP: "10" },
          { name: "TBL 4 — AINEs e Corticoides", icon: "🧠", maxXP: "10" },
          { name: "Caso Clínico 1 — Farmacodinâmica", icon: "🏥", maxXP: "8" },
          { name: "Caso Clínico 2 — SNA Colinergía", icon: "🏥", maxXP: "8" },
          { name: "Caso Clínico 3 — Anti-adrenérgicos", icon: "🏥", maxXP: "8" },
          { name: "Caso Clínico 4 — Anti-histamínicos", icon: "🏥", maxXP: "8" },
          { name: "Seminário Jigsaw — Fase 1 (Especialistas)", icon: "🧪", maxXP: "7" },
          { name: "Seminário Jigsaw — Fase 2 (Mosaico)", icon: "🧪", maxXP: "12" },
          { name: "Escape Room Farmacológico", icon: "🔓", maxXP: "15" },
          { name: "Jogo Semanal — Missões", icon: "🎮", maxXP: "5" },
          { name: "Prova P1", icon: "📝", maxXP: "30" },
          { name: "Prova P2", icon: "📝", maxXP: "30" },
          { name: "Prova Final", icon: "🏆", maxXP: "40" },
          { name: "Frequência Semanal", icon: "✅", maxXP: "2" },
        ];

        const existing = await db.getAllXpActivities();
        const existingNames = existing.map((a: any) => a.name);
        let created = 0;
        for (const act of defaultActivities) {
          if (!existingNames.includes(act.name)) {
            await db.createXpActivity(act);
            created++;
          }
        }
        return { created, total: defaultActivities.length };
      }),
  }),

  highlights: router({
    create: publicProcedure
      .input(z.object({
        password: z.string(),
        week: z.number(),
        date: z.string(),
        activity: z.string(),
        description: z.string(),
        topTeam: z.string().default("—"),
        topStudent: z.string().default("—"),
      }))
      .mutation(async ({ input }) => {
        const valid = await verifyAdminPassword(input.password);
        if (!valid) throw new Error("Não autorizado");
        const { password, ...data } = input;
        const id = await db.createHighlight(data);
        return { id };
      }),

    update: publicProcedure
      .input(z.object({
        password: z.string(),
        id: z.number(),
        week: z.number().optional(),
        date: z.string().optional(),
        activity: z.string().optional(),
        description: z.string().optional(),
        topTeam: z.string().optional(),
        topStudent: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const valid = await verifyAdminPassword(input.password);
        if (!valid) throw new Error("Não autorizado");
        const { password, id, ...data } = input;
        await db.updateHighlight(id, data);
        return { success: true };
      }),

    delete: publicProcedure
      .input(z.object({ password: z.string(), id: z.number() }))
      .mutation(async ({ input }) => {
        const valid = await verifyAdminPassword(input.password);
        if (!valid) throw new Error("Não autorizado");
        await db.deleteHighlight(input.id);
        return { success: true };
      }),

    // Auto-generate highlight based on top XP students
    autoGenerate: publicProcedure
      .input(z.object({
        password: z.string(),
        week: z.number(),
        date: z.string(),
        activity: z.string(),
        classId: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const valid = await verifyAdminPassword(input.password);
        if (!valid) throw new Error("Não autorizado");

        const allMembers = input.classId
          ? await db.getMembersByClass(input.classId)
          : await db.getAllMembers();
        const allTeams = await db.getAllTeams();

        // Find top individual by XP
        const sortedMembers = [...(allMembers as any[])]
          .sort((a, b) => parseFloat(String(b.xp || 0)) - parseFloat(String(a.xp || 0)));
        const topMember = sortedMembers[0];
        const topStudentName = topMember ? topMember.name : "—";

        // Find top team by total XP
        const teamXP = (allTeams as any[]).map(t => ({
          team: t,
          totalXP: (allMembers as any[]).filter(m => m.teamId === t.id)
            .reduce((sum, m) => sum + parseFloat(String(m.xp || 0)), 0),
        }));
        const topTeamEntry = teamXP.sort((a, b) => b.totalXP - a.totalXP)[0];
        const topTeamName = topTeamEntry ? topTeamEntry.team.name : "—";

        const description = `Destaque da ${input.activity}: ${topStudentName} lidera o ranking individual com ${parseFloat(String(topMember?.xp || 0)).toFixed(1)} PF acumulados.`;

        const id = await db.createHighlight({
          week: input.week,
          date: input.date,
          activity: input.activity,
          description,
          topTeam: topTeamName,
          topStudent: topStudentName,
        });
        return { id, topStudent: topStudentName, topTeam: topTeamName, description };
      }),
  }),

  // ─── Notifications ───
  notifications: router({
    getActive: publicProcedure.query(async () => {
      return db.getActiveNotifications();
    }),

    getByClass: publicProcedure
      .input(z.object({ classId: z.number() }))
      .query(async () => {
        return db.getActiveNotifications();
      }),

    getAll: publicProcedure
      .input(z.object({ password: z.string() }))
      .query(async ({ input }) => {
        const valid = await verifyAdminPassword(input.password);
        if (!valid) throw new Error("Não autorizado");
        return db.getAllNotifications();
      }),

    create: publicProcedure
      .input(z.object({
        password: z.string(),
        title: z.string().min(1),
        content: z.string().optional(),
        priority: z.enum(["normal", "important", "urgent"]).default("normal"),
        type: z.enum(["banner", "announcement", "reminder"]).default("announcement"),
        expiresAt: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const valid = await verifyAdminPassword(input.password);
        if (!valid) throw new Error("Não autorizado");
        const { password, expiresAt, ...data } = input;
        const id = await db.createNotification({
          ...data,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
        });
        return { id };
      }),

    update: publicProcedure
      .input(z.object({
        password: z.string(),
        id: z.number(),
        title: z.string().optional(),
        content: z.string().optional(),
        priority: z.enum(["normal", "important", "urgent"]).optional(),
        type: z.enum(["banner", "announcement", "reminder"]).optional(),
        isActive: z.number().optional(),
        expiresAt: z.string().nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        const valid = await verifyAdminPassword(input.password);
        if (!valid) throw new Error("Não autorizado");
        const { password, id, expiresAt, ...data } = input;
        const updateData: Record<string, unknown> = { ...data };
        if (expiresAt !== undefined) {
          updateData.expiresAt = expiresAt ? new Date(expiresAt) : null;
        }
        await db.updateNotification(id, updateData as any);
        return { success: true };
      }),

    delete: publicProcedure
      .input(z.object({ password: z.string(), id: z.number() }))
      .mutation(async ({ input }) => {
        const valid = await verifyAdminPassword(input.password);
        if (!valid) throw new Error("Não autorizado");
        await db.deleteNotification(input.id);
        return { success: true };
      }),
  }),

  // ─── Materials (files, links, comments) ───
  materials: router({
    // Public: get visible materials for students
    getVisible: publicProcedure.query(async () => {
      return db.getVisibleMaterials();
    }),

    // Public: get count of new materials from last week
    getNewCount: publicProcedure.query(async () => {
      const count = await db.getNewMaterialsCount();
      return { count };
    }),

    // Public: get signed download URL for a material
    // Uses generate_archive API (download_zip_url) because Cloudinary has "Signed URLs only" enabled
    // which blocks direct access to raw files even with signed URLs
    getDownloadUrl: publicProcedure
      .input(z.object({ fileKey: z.string() }))
      .query(async ({ input }) => {
        try {
          const { v2: cloudinary } = await import('cloudinary');
          const { ENV } = await import('./_core/env');
          cloudinary.config({
            cloud_name: ENV.cloudinaryCloudName,
            api_key: ENV.cloudinaryApiKey,
            api_secret: ENV.cloudinaryApiSecret,
            secure: true,
          });
          const key = input.fileKey.replace(/^\/+/, "");
          const fullPublicId = key.startsWith("farmacologia-materiais/") ? key : `farmacologia-materiais/${key}`;
          
          // Use the proxy endpoint which handles the download server-side
          // This avoids CORS issues and handles ZIP extraction
          const url = `/api/materials/download?fileKey=${encodeURIComponent(key)}`;
          return { url };
        } catch (err) {
          console.error('getDownloadUrl error:', err);
          // Fallback to storageGet
          const { storageGet } = await import("./storage");
          const { url } = await storageGet(input.fileKey);
          return { url };
        }
      }),

    // Public: get materials by class
    getByClass: publicProcedure
      .input(z.object({ classId: z.number() }))
      .query(async ({ input }) => {
        const materials = await db.getAllMaterials();
        return materials.filter((m: any) => m.classId === input.classId || !m.classId);
      }),

    // Admin: get all materials
    getAll: publicProcedure
      .input(z.object({ password: z.string() }))
      .query(async ({ input }) => {
        const valid = await verifyAdminPassword(input.password);
        if (!valid) throw new Error("Não autorizado");
        return db.getAllMaterials();
      }),

    // Admin: create a material (file upload handled separately)
    create: publicProcedure
      .input(z.object({
        password: z.string(),
        title: z.string().min(1),
        description: z.string().optional(),
        type: z.enum(["file", "link", "comment"]),
        url: z.string().optional(),
        fileKey: z.string().optional(),
        fileName: z.string().optional(),
        mimeType: z.string().optional(),
        module: z.string().default("Geral"),
        week: z.number().optional(),
        isVisible: z.number().default(1),
      }))
      .mutation(async ({ input }) => {
        const valid = await verifyAdminPassword(input.password);
        if (!valid) throw new Error("Não autorizado");
        const { password, ...data } = input;
        const id = await db.createMaterial(data);
        return { id };
      }),

    // Admin: update a material
    update: publicProcedure
      .input(z.object({
        password: z.string(),
        id: z.number(),
        title: z.string().optional(),
        description: z.string().optional(),
        url: z.string().optional(),
        module: z.string().optional(),
        week: z.number().nullable().optional(),
        isVisible: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const valid = await verifyAdminPassword(input.password);
        if (!valid) throw new Error("Não autorizado");
        const { password, id, ...data } = input;
        await db.updateMaterial(id, data as any);
        return { success: true };
      }),

    // Admin: delete a material
    delete: publicProcedure
      .input(z.object({ password: z.string(), id: z.number() }))
      .mutation(async ({ input }) => {
        const valid = await verifyAdminPassword(input.password);
        if (!valid) throw new Error("Não autorizado");
        await db.deleteMaterial(input.id);
        return { success: true };
      }),

    // Admin: upload file to S3 and create material
    upload: publicProcedure
      .input(z.object({
        password: z.string(),
        title: z.string().min(1),
        description: z.string().optional(),
        module: z.string().default("Geral"),
        week: z.number().optional(),
        fileName: z.string(),
        mimeType: z.string(),
        fileBase64: z.string(),
      }))
      .mutation(async ({ input }) => {
        const valid = await verifyAdminPassword(input.password);
        if (!valid) throw new Error("Não autorizado");
        
        const { storagePut } = await import("./storage");
        const buffer = Buffer.from(input.fileBase64, "base64");
        const randomSuffix = Math.random().toString(36).substring(2, 10);
        const fileKey = `materials/${Date.now()}-${randomSuffix}-${input.fileName}`;
        const { url } = await storagePut(fileKey, buffer, input.mimeType);
        
        const id = await db.createMaterial({
          title: input.title,
          description: input.description,
          type: "file",
          url,
          fileKey,
          fileName: input.fileName,
          mimeType: input.mimeType,
          module: input.module,
          week: input.week,
        });
        return { id, url };
      }),
  }),

  // ─── Badges (Conquistas) ───
  badges: router({
    // Public: get active badges with earned counts
    getPublic: publicProcedure.query(async () => {
      const [badgesData, allMemberBadges] = await Promise.all([
        db.getActiveBadges(),
        db.getAllMemberBadges(),
      ]);
      return badgesData.map(b => ({
        ...b,
        earnedCount: allMemberBadges.filter(mb => mb.badgeId === b.id).length,
      }));
    }),

    getByClass: publicProcedure
      .input(z.object({ classId: z.number() }))
      .query(async ({ input }) => {
        const classMembers = await db.getMembersByClass(input.classId);
        const badgesData = await db.getActiveBadges();
        const allMemberBadges = await db.getAllMemberBadges();
        const classMemberIds = classMembers.map(m => m.id);
        return badgesData.map(b => ({
          ...b,
          earnedCount: allMemberBadges.filter(mb => mb.badgeId === b.id && classMemberIds.includes(mb.memberId)).length,
        }));
      }),

    // Public: get badges earned by a specific member
    getByMember: publicProcedure
      .input(z.object({ memberId: z.number() }))
      .query(async ({ input }) => {
        const [memberBadgesData, allBadges] = await Promise.all([
          db.getMemberBadgesByMember(input.memberId),
          db.getAllBadges(),
        ]);
        return memberBadgesData.map(mb => {
          const badge = allBadges.find(b => b.id === mb.badgeId);
          return { ...mb, badge };
        });
      }),

    // Public: get all badges with member info (for leaderboard display)
    getWithMembers: publicProcedure.query(async () => {
      const [badgesData, allMemberBadges, allMembers] = await Promise.all([
        db.getActiveBadges(),
        db.getAllMemberBadges(),
        db.getAllMembers(),
      ]);
      return badgesData.map(b => {
        const earned = allMemberBadges.filter(mb => mb.badgeId === b.id);
        const membersWithBadge = earned.map(mb => {
          const member = allMembers.find(m => m.id === mb.memberId);
          return { ...mb, memberName: member?.name || "Desconhecido" };
        });
        return { ...b, members: membersWithBadge };
      });
    }),

    // Admin: get all badges
    getAll: publicProcedure
      .input(z.object({ password: z.string() }))
      .query(async ({ input }) => {
        const valid = await verifyAdminPassword(input.password);
        if (!valid) throw new Error("N\u00e3o autorizado");
        const [allBadges, allMemberBadges] = await Promise.all([
          db.getAllBadges(),
          db.getAllMemberBadges(),
        ]);
        return allBadges.map(b => ({
          ...b,
          earnedCount: allMemberBadges.filter(mb => mb.badgeId === b.id).length,
        }));
      }),

    // Admin: create a badge
    create: publicProcedure
      .input(z.object({
        password: z.string(),
        name: z.string().min(1),
        description: z.string().optional(),
        iconUrl: z.string().optional(),
        category: z.string().default("Geral"),
        week: z.number().optional(),
        criteria: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const valid = await verifyAdminPassword(input.password);
        if (!valid) throw new Error("N\u00e3o autorizado");
        const { password, ...data } = input;
        const id = await db.createBadge(data);
        return { id };
      }),

    // Admin: update a badge
    update: publicProcedure
      .input(z.object({
        password: z.string(),
        id: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        iconUrl: z.string().optional(),
        category: z.string().optional(),
        week: z.number().nullable().optional(),
        criteria: z.string().optional(),
        isActive: z.number().optional(),
        autoAssign: z.number().optional(),
        autoAssignRule: z.string().nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        const valid = await verifyAdminPassword(input.password);
        if (!valid) throw new Error("N\u00e3o autorizado");
        const { password, id, ...data } = input;
        await db.updateBadge(id, data as any);
        return { success: true };
      }),

    // Admin: delete a badge
    delete: publicProcedure
      .input(z.object({ password: z.string(), id: z.number() }))
      .mutation(async ({ input }) => {
        const valid = await verifyAdminPassword(input.password);
        if (!valid) throw new Error("N\u00e3o autorizado");
        await db.deleteBadge(input.id);
        return { success: true };
      }),

    // Admin: award badge to a member
    award: publicProcedure
      .input(z.object({
        password: z.string(),
        badgeId: z.number(),
        memberId: z.number(),
        note: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const valid = await verifyAdminPassword(input.password);
        if (!valid) throw new Error("Não autorizado");
        const id = await db.awardBadge({
          badgeId: input.badgeId,
          memberId: input.memberId,
          note: input.note,
        });
        // Notification: badge awarded
        try {
          const allBadges = await db.getAllBadges();
          const badge = allBadges.find(b => b.id === input.badgeId);
          const allMembers = await db.getAllMembers();
          const member = allMembers.find(m => m.id === input.memberId);
          if (badge && member) {
            createStudentNotification(
              `🏅 Nova Conquista: ${badge.name}`,
              `${member.name} conquistou o badge "${badge.name}"! ${badge.description || ""}`,
              "important"
            );
            sendNotificationAsync(
              "🏅 Badge Concedido",
              `${member.name} recebeu o badge "${badge.name}"`
            );
          }
        } catch {}
        return { id };
      }),

    // Admin: bulk award badge to multiple members
    bulkAward: publicProcedure
      .input(z.object({
        password: z.string(),
        badgeId: z.number(),
        memberIds: z.array(z.number()),
        note: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const valid = await verifyAdminPassword(input.password);
        if (!valid) throw new Error("Não autorizado");
        const awarded = await db.bulkAwardBadge(input.badgeId, input.memberIds, input.note);
        // Notification: bulk badge award
        if (awarded > 0) {
          try {
            const allBadges = await db.getAllBadges();
            const badge = allBadges.find(b => b.id === input.badgeId);
            if (badge) {
              createStudentNotification(
                `🏅 Conquista Desbloqueada: ${badge.name}`,
                `${awarded} aluno(s) conquistaram o badge "${badge.name}"! Confira na página de conquistas.`,
                "important"
              );
              sendNotificationAsync(
                "🏅 Badges em Massa",
                `${awarded} aluno(s) receberam o badge "${badge.name}"`
              );
            }
          } catch {}
        }
        return { success: true, awarded };
      }),

    // Admin: revoke badge from a member
    revoke: publicProcedure
      .input(z.object({
        password: z.string(),
        badgeId: z.number(),
        memberId: z.number(),
      }))
      .mutation(async ({ input }) => {
        const valid = await verifyAdminPassword(input.password);
        if (!valid) throw new Error("N\u00e3o autorizado");
        await db.revokeBadge(input.memberId, input.badgeId);
        return { success: true };
      }),

    // Admin: get members who earned a specific badge
    getEarners: publicProcedure
      .input(z.object({ password: z.string(), badgeId: z.number() }))
      .query(async ({ input }) => {
        const valid = await verifyAdminPassword(input.password);
        if (!valid) throw new Error("N\u00e3o autorizado");
        const [earners, allMembers] = await Promise.all([
          db.getMemberBadgesByBadge(input.badgeId),
          db.getAllMembers(),
        ]);
        return earners.map(e => {
          const member = allMembers.find(m => m.id === e.memberId);
          return { ...e, memberName: member?.name || "Desconhecido" };
        });
      }),

    // Admin: auto-assign badges based on XP ranking rules
    autoAssign: publicProcedure
      .input(z.object({
        password: z.string(),
        badgeId: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const valid = await verifyAdminPassword(input.password);
        if (!valid) throw new Error("N\u00e3o autorizado");

        const [allBadges, allMembers, allTeams, allMemberBadges] = await Promise.all([
          db.getAllBadges(),
          db.getAllMembers(),
          db.getAllTeams(),
          db.getAllMemberBadges(),
        ]);

        const targetBadges = allBadges.filter(b =>
          b.autoAssign === 1 && b.isActive === 1 &&
          (input.badgeId === undefined || b.id === input.badgeId)
        );

        let totalAwarded = 0;
        let totalRevoked = 0;
        const results: Array<{ badgeId: number; badgeName: string; awarded: number; revoked: number; members: string[] }> = [];

        for (const badge of targetBadges) {
          if (!badge.autoAssignRule) continue;
          let rule: { type: string; n?: number; xp?: number };
          try { rule = JSON.parse(badge.autoAssignRule); } catch { continue; }

          let targetMemberIds: number[] = [];

          if (rule.type === "top_individual") {
            const n = rule.n ?? 1;
            targetMemberIds = [...allMembers]
              .sort((a, b) => parseFloat(String(b.xp)) - parseFloat(String(a.xp)))
              .slice(0, n)
              .map(m => m.id);
          } else if (rule.type === "top_team") {
            const n = rule.n ?? 1;
            const teamXP = allTeams.map(t => ({
              teamId: t.id,
              totalXP: allMembers.filter(m => m.teamId === t.id).reduce((sum, m) => sum + parseFloat(String(m.xp)), 0),
            }));
            const topTeamIds = teamXP.sort((a, b) => b.totalXP - a.totalXP).slice(0, n).map(t => t.teamId);
            targetMemberIds = allMembers.filter(m => topTeamIds.includes(m.teamId)).map(m => m.id);
          } else if (rule.type === "min_xp") {
            const minXP = rule.xp ?? 0;
            targetMemberIds = allMembers.filter(m => parseFloat(String(m.xp)) >= minXP).map(m => m.id);
          }

          const currentEarnerIds = allMemberBadges.filter(mb => mb.badgeId === badge.id).map(mb => mb.memberId);
          const toAward = targetMemberIds.filter(id => !currentEarnerIds.includes(id));
          const toRevoke = currentEarnerIds.filter(id => !targetMemberIds.includes(id));

          for (const memberId of toAward) {
            await db.awardBadge({ badgeId: badge.id, memberId, note: "Auto-atribu\u00eddo por regra de PF" });
          }
          for (const memberId of toRevoke) {
            await db.revokeBadge(memberId, badge.id);
          }

          totalAwarded += toAward.length;
          totalRevoked += toRevoke.length;
          results.push({
            badgeId: badge.id,
            badgeName: badge.name,
            awarded: toAward.length,
            revoked: toRevoke.length,
            members: toAward.map(id => allMembers.find(m => m.id === id)?.name ?? String(id)),
          });

          if (toAward.length > 0) {
            try {
              createStudentNotification(
                `\uD83C\uDFC5 Conquista Desbloqueada: ${badge.name}`,
                `${toAward.length} aluno(s) conquistaram "${badge.name}" automaticamente!`,
                "important"
              );
              sendNotificationAsync("\uD83C\uDFC5 Auto-Conquista", `${toAward.length} aluno(s) receberam "${badge.name}" por regra de PF`);
            } catch {}
          }
        }

        return { success: true, totalAwarded, totalRevoked, results };
      }),

    // Admin: preview which members would receive a badge based on a rule (dry run)
    previewAutoAssign: publicProcedure
      .input(z.object({
        password: z.string(),
        rule: z.string(),
      }))
      .query(async ({ input }) => {
        const valid = await verifyAdminPassword(input.password);
        if (!valid) throw new Error("N\u00e3o autorizado");

        let rule: { type: string; n?: number; xp?: number };
        try { rule = JSON.parse(input.rule); } catch { return []; }

        const [allMembers, allTeams] = await Promise.all([db.getAllMembers(), db.getAllTeams()]);
        let targetMemberIds: number[] = [];

        if (rule.type === "top_individual") {
          targetMemberIds = [...allMembers].sort((a, b) => parseFloat(String(b.xp)) - parseFloat(String(a.xp))).slice(0, rule.n ?? 1).map(m => m.id);
        } else if (rule.type === "top_team") {
          const teamXP = allTeams.map(t => ({ teamId: t.id, totalXP: allMembers.filter(m => m.teamId === t.id).reduce((s, m) => s + parseFloat(String(m.xp)), 0) }));
          const topTeamIds = teamXP.sort((a, b) => b.totalXP - a.totalXP).slice(0, rule.n ?? 1).map(t => t.teamId);
          targetMemberIds = allMembers.filter(m => topTeamIds.includes(m.teamId)).map(m => m.id);
        } else if (rule.type === "min_xp") {
          targetMemberIds = allMembers.filter(m => parseFloat(String(m.xp)) >= (rule.xp ?? 0)).map(m => m.id);
        }

        return allMembers.filter(m => targetMemberIds.includes(m.id)).map(m => ({ id: m.id, name: m.name, xp: m.xp }));
      }),

    // Public: get student ranking by number of badges
    getRanking: publicProcedure
      .query(async () => {
        const drizzleDb = await db.getDb();
        if (!drizzleDb) return [];
        const { memberBadges, badges, members, teams } = await import("../drizzle/schema.js");
        const { eq, count, sql } = await import("drizzle-orm");

        // Get badge count per member with member and team info
        const rows = await drizzleDb
          .select({
            memberId: members.id,
            memberName: members.name,
            teamId: teams.id,
            teamName: teams.name,
            teamColor: teams.color,
            badgeCount: count(memberBadges.id).as("badgeCount"),
          })
          .from(members)
          .leftJoin(teams, eq(members.teamId, teams.id))
          .leftJoin(memberBadges, eq(memberBadges.memberId, members.id))
          .groupBy(members.id, members.name, teams.id, teams.name, teams.color)
          .orderBy(sql`badgeCount DESC`, members.name);

        // Also get badge details per member
        const earnedRows = await drizzleDb
          .select({
            memberId: memberBadges.memberId,
            badgeName: badges.name,
            badgeCategory: badges.category,
            badgeIconUrl: badges.iconUrl,
            earnedAt: memberBadges.earnedAt,
          })
          .from(memberBadges)
          .innerJoin(badges, eq(memberBadges.badgeId, badges.id));

        const badgesByMember: Record<number, { name: string; category: string; iconUrl: string | null; earnedAt: Date }[]> = {};
        for (const row of earnedRows) {
          if (!badgesByMember[row.memberId]) badgesByMember[row.memberId] = [];
          badgesByMember[row.memberId].push({ name: row.badgeName, category: row.badgeCategory, iconUrl: row.badgeIconUrl, earnedAt: row.earnedAt });
        }

        return rows
          .filter((r: { badgeCount: unknown }) => Number(r.badgeCount) > 0)
          .map((r: { memberId: number; memberName: string; teamName: string | null; teamColor: string | null; badgeCount: unknown }, idx: number) => ({
            rank: idx + 1,
            memberId: r.memberId,
            memberName: r.memberName,
            teamName: r.teamName ?? "",
            teamColor: r.teamColor ?? "#10b981",
            badgeCount: Number(r.badgeCount),
            badges: (badgesByMember[r.memberId] ?? []).sort((a: { earnedAt: Date }, b: { earnedAt: Date }) => new Date(b.earnedAt).getTime() - new Date(a.earnedAt).getTime()),
          }));
      }),
  }),

  // ─── Student Auth (email institucional @edu.unirio.br) ───
  studentAuth: router({
    // Register a new student account
    register: publicProcedure
      .input(z.object({
        email: z.string().email(),
        name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
        matricula: z.string().min(5, "Matrícula deve ter pelo menos 5 caracteres"),
        password: z.string().min(5, "Senha deve ter pelo menos 5 caracteres"),
        memberId: z.number().optional(),
        inviteCode: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        // SECURITY: Only registered members (in the members table) can create accounts
        // This prevents unauthorized access from people not enrolled in the course
        if (!input.memberId) {
          return { success: false, message: "Acesso restrito: apenas alunos matriculados podem criar conta. Verifique com seu professor se você está cadastrado no sistema." } as const;
        }
        // Verify the memberId actually exists in the database
        const allMembers = await db.getAllMembers();
        const memberExists = allMembers.find(m => m.id === input.memberId);
        if (!memberExists) {
          return { success: false, message: "Aluno não encontrado no sistema. Verifique com seu professor se você está cadastrado." } as const;
        }
        // Check if member already has an account
        const existingMember = await db.getStudentAccountByMemberId(input.memberId);
        if (existingMember) return { success: false, message: "Este aluno já possui uma conta cadastrada" } as const;
        // Check if email already registered
        const existingEmail = await db.getStudentAccountByEmail(input.email);
        if (existingEmail) return { success: false, message: "Este email já está cadastrado" } as const;
        // Check if matricula already registered
        const existingMatricula = await db.getStudentAccountByMatricula(input.matricula);
        if (existingMatricula) return { success: false, message: "Esta matrícula já está cadastrada" } as const;
        // Hash password
        const passwordHash = await bcrypt.hash(input.password, 10);
        // Create session token
        const sessionToken = crypto.randomBytes(32).toString("hex");
        const id = await db.createStudentAccount({
          memberId: input.memberId || null,
          email: input.email,
          matricula: input.matricula,
          passwordHash,
          sessionToken,
        });
        return { success: true, message: "Conta criada com sucesso!", sessionToken, studentId: id } as const;
      }),

    // Login with email + password
    login: publicProcedure
      .input(z.object({
        email: z.string().email(),
        password: z.string(),
      }))
      .mutation(async ({ input }) => {
        const account = await db.getStudentAccountByEmail(input.email);
        if (!account) return { success: false, message: "Email não encontrado" } as const;
        if (!account.isActive) return { success: false, message: "Conta desativada" } as const;
        const valid = await bcrypt.compare(input.password, account.passwordHash);
        if (!valid) return { success: false, message: "Senha incorreta" } as const;
        // Generate new session token
        const sessionToken = crypto.randomBytes(32).toString("hex");
        await db.updateStudentAccountSession(account.id, sessionToken);
        return { success: true, sessionToken, studentId: account.id, memberId: account.memberId } as const;
      }),

    // Verify session token (for persistent login)
    me: publicProcedure
      .input(z.object({ sessionToken: z.string() }))
      .query(async ({ input }) => {
        const account = await db.getStudentAccountBySessionToken(input.sessionToken);
        if (!account) return null;
        // Get member info
        const allMembers = await db.getAllMembers();
        const member = allMembers.find(m => m.id === account.memberId);
        const allTeams = await db.getAllTeams();
        const team = allTeams.find(t => t.id === member?.teamId);
        return {
          id: account.id,
          memberId: account.memberId,
          email: account.email,
          matricula: account.matricula,
          gender: (account as any).gender || "male",
          memberName: (() => { const n = member?.name; if (!n) return "Desconhecido"; const p = n.split("\t"); return p.length >= 2 ? p[1].trim() : n.trim(); })(),
          teamId: team?.id,
          teamName: team?.name,
          teamEmoji: team?.emoji,
          classId: member?.classId || null,
        };
      }),

    // Update gender/avatar preference
    updateGender: publicProcedure
      .input(z.object({
        sessionToken: z.string(),
        gender: z.enum(["male", "female"]),
      }))
      .mutation(async ({ input }) => {
        const account = await db.getStudentAccountBySessionToken(input.sessionToken);
        if (!account) return { success: false, message: "Sessão inválida" } as const;
        await db.updateStudentAccountGender(account.id, input.gender);
        return { success: true, message: "Avatar atualizado com sucesso" } as const;
      }),

    // Logout
    logout: publicProcedure
      .input(z.object({ sessionToken: z.string() }))
      .mutation(async ({ input }) => {
        const account = await db.getStudentAccountBySessionToken(input.sessionToken);
        if (account) {
          await db.updateStudentAccountSession(account.id, null);
        }
        return { success: true };
      }),

    // Get available members (not yet registered)
    getAvailableMembers: publicProcedure.query(async () => {
      const [allMembers, allAccounts, allTeams] = await Promise.all([
        db.getAllMembers(),
        db.getAllStudentAccounts(),
        db.getAllTeams(),
      ]);
      const registeredMemberIds = new Set(allAccounts.map(a => a.memberId));
      const cleanName = (raw: string | null | undefined): string => {
        if (!raw) return "Desconhecido";
        const parts = raw.split("\t");
        if (parts.length >= 2) return parts[1].trim();
        return raw.trim();
      };
      return allMembers
        .filter(m => !registeredMemberIds.has(m.id))
        .map(m => {
          const team = allTeams.find(t => t.id === m.teamId);
          return { id: m.id, name: cleanName(m.name), teamName: team?.name || "Sem equipe", teamEmoji: team?.emoji || "🧪" };
        });
    }),

    // Change password
    changePassword: publicProcedure
      .input(z.object({
        sessionToken: z.string(),
        currentPassword: z.string(),
        newPassword: z.string().min(5, "Senha deve ter pelo menos 5 caracteres"),
      }))
      .mutation(async ({ input }) => {
        const account = await db.getStudentAccountBySessionToken(input.sessionToken);
        if (!account) return { success: false, message: "Sessão inválida" } as const;
        const valid = await bcrypt.compare(input.currentPassword, account.passwordHash);
        if (!valid) return { success: false, message: "Senha atual incorreta" } as const;
        const passwordHash = await bcrypt.hash(input.newPassword, 10);
        await db.updateStudentAccountPassword(account.id, passwordHash);
        return { success: true, message: "Senha alterada com sucesso" } as const;
      }),
  }),
  // ─── Invite Codes (Códigos de Convite para Monitores/Externos) ───
  inviteCodes: router({
    // Generate a new invite code (teacher/admin only)
    generate: publicProcedure
      .input(z.object({
        sessionToken: z.string(),
        description: z.string().optional(),
        maxUses: z.number().min(1).max(100).default(10),
        teacherEmail: z.string().email().optional(),
        teacherName: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const teacher = await db.getTeacherAccountBySessionToken(input.sessionToken);
        if (!teacher) return { success: false, message: "Acesso negado" } as const;
        
        // Generate random 8-char code
        const code = "FARM" + crypto.randomBytes(3).toString("hex").toUpperCase().slice(0, 4);
        
        // Create invite code
        const id = await db.createInviteCode({
          code,
          description: input.description || "Cu00f3digo gerado por " + teacher.name,
          maxUses: input.maxUses,
          createdBy: teacher.email,
        });
        
        // If teacher email and name provided, create a new teacher account
        let newTeacherId = null;
        let newTeacherSessionToken = null;
        if (input.teacherEmail && input.teacherName) {
          try {
            const existingTeacher = await db.getTeacherAccountByEmail(input.teacherEmail);
            if (!existingTeacher) {
              const tempPassword = crypto.randomBytes(8).toString("hex");
              const passwordHash = await bcrypt.hash(tempPassword, 10);
              newTeacherId = await db.createTeacherAccount({
                email: input.teacherEmail,
                name: input.teacherName,
                passwordHash,
                isActive: 1,
              });
              newTeacherSessionToken = crypto.randomBytes(32).toString("hex");
              await db.updateTeacherSessionToken(newTeacherId, newTeacherSessionToken);
              sendNotificationAsync(
                "u{1F468}u{200D}u{1F3EB} Novo Professor Criado via Cu00f3digo de Acesso",
                `${input.teacherName} (${input.teacherEmail}) foi criado como professor. Senha temporu00e1ria: ${tempPassword}`
              );
            }
          } catch (err) {
            console.error("[inviteCodes.generate] Erro ao criar professor:", err);
          }
        }
        
        return { success: true, code, id, newTeacherId, newTeacherSessionToken } as const;
      }),

    // List all invite codes (teacher/admin only)
    list: publicProcedure
      .input(z.object({ sessionToken: z.string() }))
      .query(async ({ input }) => {
        const teacher = await db.getTeacherAccountBySessionToken(input.sessionToken);
        if (!teacher) return [];
        return db.getAllInviteCodes();
      }),

    // Toggle active status
    toggle: publicProcedure
      .input(z.object({
        sessionToken: z.string(),
        id: z.number(),
        isActive: z.boolean(),
      }))
      .mutation(async ({ input }) => {
        const teacher = await db.getTeacherAccountBySessionToken(input.sessionToken);
        if (!teacher) return { success: false, message: "Acesso negado" } as const;
        await db.toggleInviteCode(input.id, input.isActive);
        return { success: true } as const;
      }),

    // Delete invite code
    delete: publicProcedure
      .input(z.object({
        sessionToken: z.string(),
        id: z.number(),
      }))
      .mutation(async ({ input }) => {
        const teacher = await db.getTeacherAccountBySessionToken(input.sessionToken);
        if (!teacher) return { success: false, message: "Acesso negado" } as const;
        await db.deleteInviteCode(input.id);
        return { success: true } as const;
      }),
  }),
  // ─── Attendance (Presença com Geolocalização) ────
  attendanceOld: router({
    // Student: check in with geolocation
    checkIn: publicProcedure
      .input(z.object({
        sessionToken: z.string(),
        latitude: z.number(),
        longitude: z.number(),
      }))
      .mutation(async ({ input, ctx }) => {
        const account = await db.getStudentAccountBySessionToken(input.sessionToken);
        if (!account) return { success: false, message: "Sessão inválida. Faça login novamente." } as const;

        // Check if it's Tuesday (day 2) and within class hours (8h-12h BRT = 11h-15h UTC)
        const now = new Date();
        const brasiliaOffset = -3 * 60; // BRT is UTC-3
        const brasiliaTime = new Date(now.getTime() + (brasiliaOffset + now.getTimezoneOffset()) * 60000);
        const dayOfWeek = brasiliaTime.getDay(); // 0=Sun, 2=Tue
        const hour = brasiliaTime.getHours();

        // Allow check-in on Tuesdays between 7:30 and 12:30 (with 30min buffer)
        if (dayOfWeek !== 2) {
          return { success: false, message: "A presença só pode ser registrada às terças-feiras." } as const;
        }
        if (hour < 7 || hour > 12) {
          return { success: false, message: "A presença só pode ser registrada entre 7:30 e 12:30." } as const;
        }

        // Calculate distance from classroom
        // Frei Caneca 94, Rio de Janeiro (approximate coordinates)
        const CLASSROOM_LAT = -22.9176;
        const CLASSROOM_LNG = -43.1831;
        const MAX_DISTANCE_METERS = 100;

        const distance = calculateDistance(
          input.latitude, input.longitude,
          CLASSROOM_LAT, CLASSROOM_LNG
        );

        const isWithinRange = distance <= MAX_DISTANCE_METERS;

        // Calculate current week (based on semester start)
        const semesterStart = new Date("2026-03-10"); // Adjust to actual semester start
        const weeksSinceStart = Math.floor((brasiliaTime.getTime() - semesterStart.getTime()) / (7 * 24 * 60 * 60 * 1000));
        const currentWeek = Math.max(1, weeksSinceStart + 1);

         const classDate = brasiliaTime.toISOString().split("T")[0];
        if (!account.memberId) {
          return { success: false, message: "Sua conta não está vinculada a um membro da turma. Contate o professor." } as const;
        }
        const result = await db.createAttendanceRecord({
          studentAccountId: account.id,
          memberId: account.memberId,
          week: currentWeek,
          classDate,
          latitude: input.latitude.toString(),
          longitude: input.longitude.toString(),
          distanceMeters: distance.toFixed(2),
          status: isWithinRange ? "valid" : "invalid",
          ipAddress: ctx.req.ip || ctx.req.headers["x-forwarded-for"]?.toString() || "unknown",
          userAgent: ctx.req.headers["user-agent"] || "unknown",
        });

        if (result.alreadyCheckedIn) {
          return { success: false, message: "Você já registrou presença nesta semana." } as const;
        }

        // Send notification to student
        const successMessage = isWithinRange
          ? `Presença registrada com sucesso! (${distance.toFixed(0)}m da sala)`
          : `Presença registrada, mas você está a ${distance.toFixed(0)}m da sala (máximo: ${MAX_DISTANCE_METERS}m). O professor será notificado.`;

        sendNotificationAsync(
          "✅ Presença Registrada",
          `${account.email} registrou presença na semana ${currentWeek}. ${isWithinRange ? "Dentro da sala." : "Fora do raio permitido."}`
        );

        return {
          success: true,
          message: successMessage,
          distance: Math.round(distance),
          isWithinRange,
          week: currentWeek,
        } as const;
      }),

    // Student: get my attendance history
    myAttendance: publicProcedure
      .input(z.object({ sessionToken: z.string() }))
      .query(async ({ input }) => {
        const account = await db.getStudentAccountBySessionToken(input.sessionToken);
        if (!account) return [];
        return db.getAttendanceByStudent(account.id);
      }),

    // Admin: get all attendance for a week
    getByWeek: publicProcedure
      .input(z.object({ password: z.string(), week: z.number() }))
      .query(async ({ input }) => {
        const valid = await verifyAdminPassword(input.password);
        if (!valid) throw new Error("Não autorizado");
        const [records, allMembers, allTeams, allAccounts] = await Promise.all([
          db.getAttendanceByWeek(input.week),
          db.getAllMembers(),
          db.getAllTeams(),
          db.getAllStudentAccounts(),
        ]);
        return records.map(r => {
          const member = allMembers.find(m => m.id === r.memberId);
          const team = allTeams.find(t => t.id === member?.teamId);
          const account = allAccounts.find(a => a.id === r.studentAccountId);
          return {
            ...r,
            memberName: (() => { const n = member?.name; if (!n) return "Desconhecido"; const p = n.split("\t"); return p.length >= 2 ? p[1].trim() : n.trim(); })(),
            teamName: team?.name || "Sem equipe",
            teamEmoji: team?.emoji || "🧪",
            email: account?.email,
          };
        });
      }),

    // Admin: get attendance summary (all members, all weeks)
    getSummary: publicProcedure
      .input(z.object({ password: z.string(), classId: z.number().optional() }))
      .query(async ({ input }) => {
        const valid = await verifyAdminPassword(input.password);
        if (!valid) throw new Error("Não autorizado");
        const [summary, allMembersRaw, allTeams, allAccounts] = await Promise.all([
          db.getAttendanceSummary(),
          input.classId ? db.getMembersByClass(input.classId) : db.getAllMembers(),
          db.getAllTeams(),
          db.getAllStudentAccounts(),
        ]);
        const allMembers = allMembersRaw as any[];
        return allMembers.map((m: any) => {
          const team = allTeams.find((t: any) => t.id === m.teamId);
          const account = allAccounts.find((a: any) => a.memberId === m.id);
          const stats = summary.find((s: any) => s.memberId === m.id);
          return {
            memberId: m.id,
            memberName: m.name,
            classId: m.classId,
            teamName: team?.name || "Sem equipe",
            teamEmoji: team?.emoji || "🧪",
            hasAccount: !!account,
            email: account?.email,
            totalPresent: stats?.totalPresent || 0,
            validPresent: stats?.validPresent || 0,
          };
        });
      }),

    // Admin: update attendance status
    updateStatus: publicProcedure
      .input(z.object({
        password: z.string(),
        id: z.number(),
        status: z.enum(["valid", "invalid", "manual"]),
        note: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const valid = await verifyAdminPassword(input.password);
        if (!valid) throw new Error("Não autorizado");
        await db.updateAttendanceStatus(input.id, input.status, input.note);
        return { success: true };
      }),

    // Admin: manual attendance
    manualCheckIn: publicProcedure
      .input(z.object({
        password: z.string(),
        memberId: z.number(),
        week: z.number(),
        classDate: z.string(),
        note: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const valid = await verifyAdminPassword(input.password);
        if (!valid) throw new Error("Não autorizado");
        const id = await db.createManualAttendance(input.memberId, input.week, input.classDate, input.note);
        return { id, success: true };
      }),

    // Admin: delete attendance record
    delete: publicProcedure
      .input(z.object({ password: z.string(), id: z.number() }))
      .mutation(async ({ input }) => {
        const valid = await verifyAdminPassword(input.password);
        if (!valid) throw new Error("Não autorizado");
        await db.deleteAttendanceRecord(input.id);
        return { success: true };
      }),

    // Admin: get all student accounts
    getAccounts: publicProcedure
      .input(z.object({ password: z.string() }))
      .query(async ({ input }) => {
        const valid = await verifyAdminPassword(input.password);
        if (!valid) throw new Error("Não autorizado");
        const [accounts, allMembers, allTeams] = await Promise.all([
          db.getAllStudentAccounts(),
          db.getAllMembers(),
          db.getAllTeams(),
        ]);
        return accounts.map(a => {
          const member = allMembers.find(m => m.id === a.memberId);
          const team = allTeams.find(t => t.id === member?.teamId);
          return {
            ...a,
            passwordHash: undefined, // Don't expose
            sessionToken: undefined, // Don't expose
            memberName: (() => { const n = member?.name; if (!n) return "Desconhecido"; const p = n.split("\t"); return p.length >= 2 ? p[1].trim() : n.trim(); })(),
            teamName: team?.name || "Sem equipe",
            teamEmoji: team?.emoji || "🧪",
          };
        });
      }),

    // Admin: delete student account
    deleteAccount: publicProcedure
      .input(z.object({ password: z.string(), id: z.number() }))
      .mutation(async ({ input }) => {
        const valid = await verifyAdminPassword(input.password);
        if (!valid) throw new Error("Não autorizado");
        await db.deleteStudentAccount(input.id);
        return { success: true };
      }),

    // Admin: reset password for a specific student account
    resetStudentPassword: publicProcedure
      .input(z.object({ password: z.string(), studentAccountId: z.number(), newPassword: z.string().min(5) }))
      .mutation(async ({ input }) => {
        const valid = await verifyAdminPassword(input.password);
        if (!valid) throw new Error("Não autorizado");
        const passwordHash = await bcrypt.hash(input.newPassword, 10);
        await db.updateStudentAccountPassword(input.studentAccountId, passwordHash);
        return { success: true, message: "Senha resetada com sucesso" };
      }),

    // Admin: reset ALL student passwords to their matricula
    resetAllPasswordsToMatricula: publicProcedure
      .input(z.object({ password: z.string() }))
      .mutation(async ({ input }) => {
        const valid = await verifyAdminPassword(input.password);
        if (!valid) throw new Error("Não autorizado");
        const accounts = await db.getAllStudentAccounts();
        let updated = 0;
        let errors = 0;
        for (const acc of accounts) {
          try {
            const passwordHash = await bcrypt.hash(acc.matricula, 10);
            await db.updateStudentAccountPassword(acc.id, passwordHash);
            updated++;
          } catch (e) {
            errors++;
          }
        }
        return { success: true, updated, errors, total: accounts.length };
      }),

    // Admin: export attendance report data
    exportReport: publicProcedure
      .input(z.object({ password: z.string() }))
      .query(async ({ input }) => {
        const valid = await verifyAdminPassword(input.password);
        if (!valid) throw new Error("Não autorizado");
        const [allMembers, allTeams, allAccounts, allRecords] = await Promise.all([
          db.getAllMembers(),
          db.getAllTeams(),
          db.getAllStudentAccounts(),
          db.getAllAttendance(),
        ]);

        // Build per-member summary with weekly breakdown
        const weeks = Array.from({ length: 19 }, (_, i) => i + 1);
        const report = allMembers.map(m => {
          const team = allTeams.find(t => t.id === m.teamId);
          const account = allAccounts.find(a => a.memberId === m.id);
          const memberRecords = allRecords.filter(r => r.memberId === m.id);
          const weeklyStatus: Record<number, string> = {};
          for (const w of weeks) {
            const rec = memberRecords.find(r => r.week === w);
            if (rec) {
              weeklyStatus[w] = rec.status === "valid" ? "P" : rec.status === "manual" ? "M" : "I";
            } else {
              weeklyStatus[w] = "-";
            }
          }
          const totalValid = memberRecords.filter(r => r.status === "valid" || r.status === "manual").length;
          const totalInvalid = memberRecords.filter(r => r.status === "invalid").length;
          return {
            nome: m.name,
            equipe: team?.name || "Sem equipe",
            matricula: account?.matricula || "-",
            email: account?.email || "-",
            weeklyStatus,
            totalValid,
            totalInvalid,
            totalAusente: weeks.length - totalValid - totalInvalid,
          };
        });
        return { report, weeks };
      }),
  }),

  // ─── YouTube Playlists ───
  youtubePlaylists: router({
    // Public: get visible playlists for students
    getVisible: publicProcedure.query(async () => {
      return db.getVisibleYoutubePlaylists();
    }),

    // Admin: get all playlists
    getAll: publicProcedure
      .input(z.object({ password: z.string() }))
      .query(async ({ input }) => {
        const valid = await verifyAdminPassword(input.password);
        if (!valid) throw new Error("Senha inválida");
        return db.getAllYoutubePlaylists();
      }),

    // Admin: create a new playlist
    create: publicProcedure
      .input(z.object({
        password: z.string(),
        title: z.string().min(1),
        description: z.string().optional(),
        youtubeUrl: z.string().min(1),
        videoType: z.enum(["playlist", "video"]).default("playlist"),
        module: z.string().default("Geral"),
        week: z.number().optional(),
        sortOrder: z.number().default(0),
      }))
      .mutation(async ({ input }) => {
        const valid = await verifyAdminPassword(input.password);
        if (!valid) throw new Error("Senha inválida");
        // Extract YouTube ID from URL
        const youtubeId = extractYoutubeId(input.youtubeUrl, input.videoType);
        if (!youtubeId) throw new Error("URL do YouTube inválida. Use uma URL de playlist ou vídeo válida.");
        const thumbnailUrl = input.videoType === "video"
          ? `https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`
          : `https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`;
        const id = await db.createYoutubePlaylist({
          title: input.title,
          description: input.description || null,
          youtubeId,
          videoType: input.videoType,
          module: input.module,
          week: input.week ?? null,
          thumbnailUrl,
          sortOrder: input.sortOrder,
          isVisible: 1,
        });
        return { success: true, id };
      }),

    // Admin: update a playlist
    update: publicProcedure
      .input(z.object({
        password: z.string(),
        id: z.number(),
        title: z.string().min(1).optional(),
        description: z.string().optional(),
        youtubeUrl: z.string().optional(),
        videoType: z.enum(["playlist", "video"]).optional(),
        module: z.string().optional(),
        week: z.number().nullable().optional(),
        sortOrder: z.number().optional(),
        isVisible: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const valid = await verifyAdminPassword(input.password);
        if (!valid) throw new Error("Senha inválida");
        const { password, id, youtubeUrl, ...data } = input;
        const updateData: any = { ...data };
        if (youtubeUrl) {
          const vType = input.videoType || "playlist";
          const youtubeId = extractYoutubeId(youtubeUrl, vType);
          if (!youtubeId) throw new Error("URL do YouTube inválida.");
          updateData.youtubeId = youtubeId;
          updateData.thumbnailUrl = `https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`;
        }
        await db.updateYoutubePlaylist(id, updateData);
        return { success: true };
      }),

    // Admin: delete a playlist
    delete: publicProcedure
      .input(z.object({ password: z.string(), id: z.number() }))
      .mutation(async ({ input }) => {
        const valid = await verifyAdminPassword(input.password);
        if (!valid) throw new Error("Senha inválida");
        await db.deleteYoutubePlaylist(input.id);
        return { success: true };
      }),

    // Admin: toggle visibility
    toggleVisibility: publicProcedure
      .input(z.object({ password: z.string(), id: z.number(), isVisible: z.number() }))
      .mutation(async ({ input }) => {
        const valid = await verifyAdminPassword(input.password);
        if (!valid) throw new Error("Senha inválida");
        await db.updateYoutubePlaylist(input.id, { isVisible: input.isVisible });
        return { success: true };
      }),
  }),

  // ─── Seminários Jigsaw (6 grupos) ───
  seminars: router({
    // Get all seminars
    getAll: publicProcedure
      .input(z.object({ sessionToken: z.string() }))
      .query(async ({ input }) => {
        const teacher = await db.getTeacherAccountBySessionToken(input.sessionToken);
        if (!teacher) throw new Error("Não autorizado");
        return db.getAllSeminars();
      }),

    // Get seminar by ID with participants and articles
    getById: publicProcedure
      .input(z.object({ sessionToken: z.string(), seminarId: z.number() }))
      .query(async ({ input }) => {
        const teacher = await db.getTeacherAccountBySessionToken(input.sessionToken);
        if (!teacher) throw new Error("Não autorizado");
        
        const [seminar, participants, articles] = await Promise.all([
          db.getSeminarById(input.seminarId),
          db.getSeminarParticipants(input.seminarId),
          db.getSeminarArticles(input.seminarId),
        ]);
        
        return { seminar, participants, articles };
      }),

    // Create seminar
    create: publicProcedure
      .input(z.object({
        sessionToken: z.string(),
        week: z.number(),
        title: z.string(),
        description: z.string().optional(),
        date: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        const teacher = await db.getTeacherAccountBySessionToken(input.sessionToken);
        if (!teacher) throw new Error("Não autorizado");
        
        const { sessionToken, ...data } = input;
        const id = await db.createSeminar(data);
        
        await logAudit({
          teacherToken: sessionToken,
          action: "Criar Seminário",
          entityType: "seminar",
          entityId: id,
          details: `Semana ${input.week}: ${input.title}`,
          req: ctx.req,
        });
        
        return { id };
      }),

    // Update seminar
    update: publicProcedure
      .input(z.object({
        sessionToken: z.string(),
        id: z.number(),
        title: z.string().optional(),
        description: z.string().optional(),
        date: z.string().optional(),
        groupPF: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const teacher = await db.getTeacherAccountBySessionToken(input.sessionToken);
        if (!teacher) throw new Error("Não autorizado");
        
        const { sessionToken, id, ...data } = input;
        await db.updateSeminar(id, data);
        
        await logAudit({
          teacherToken: sessionToken,
          action: "Atualizar Seminário",
          entityType: "seminar",
          entityId: id,
          details: JSON.stringify(data),
          req: ctx.req,
        });
        
        return { success: true };
      }),

    // Delete seminar
    delete: publicProcedure
      .input(z.object({ sessionToken: z.string(), id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const teacher = await db.getTeacherAccountBySessionToken(input.sessionToken);
        if (!teacher) throw new Error("Não autorizado");
        
        await db.deleteSeminar(input.id);
        
        await logAudit({
          teacherToken: input.sessionToken,
          action: "Excluir Seminário",
          entityType: "seminar",
          entityId: input.id,
          details: "Seminário excluído com cascade (participantes e artigos)",
          req: ctx.req,
        });
        
        return { success: true };
      }),

    // Get all seminar roles
    getRoles: publicProcedure
      .input(z.object({ sessionToken: z.string() }))
      .query(async ({ input }) => {
        const teacher = await db.getTeacherAccountBySessionToken(input.sessionToken);
        if (!teacher) throw new Error("Não autorizado");
        return db.getAllSeminarRoles();
      }),

    // Create seminar role
    createRole: publicProcedure
      .input(z.object({
        sessionToken: z.string(),
        name: z.string(),
        description: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const teacher = await db.getTeacherAccountBySessionToken(input.sessionToken);
        if (!teacher) throw new Error("Não autorizado");
        
        const { sessionToken, ...data } = input;
        const id = await db.createSeminarRole(data);
        return { id };
      }),

    // Assign member to participant role
    assignMember: publicProcedure
      .input(z.object({
        sessionToken: z.string(),
        participantId: z.number(),
        memberId: z.number(),
        memberName: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        const teacher = await db.getTeacherAccountBySessionToken(input.sessionToken);
        if (!teacher) throw new Error("Não autorizado");
        
        await db.assignMemberToSeminarRole(input.participantId, input.memberId, input.memberName);
        
        await logAudit({
          teacherToken: input.sessionToken,
          action: "Atribuir Aluno a Função",
          entityType: "seminarParticipant",
          entityId: input.participantId,
          details: `Aluno: ${input.memberName} (ID: ${input.memberId})`,
          req: ctx.req,
        });
        
        return { success: true };
      }),

    // Update participant PF
    updateParticipantPF: publicProcedure
      .input(z.object({
        sessionToken: z.string(),
        participantId: z.number(),
        individualPF: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        const teacher = await db.getTeacherAccountBySessionToken(input.sessionToken);
        if (!teacher) throw new Error("Não autorizado");
        
        await db.updateSeminarParticipant(input.participantId, { individualPF: input.individualPF });
        
        await logAudit({
          teacherToken: input.sessionToken,
          action: "Atualizar PF Individual (Seminário)",
          entityType: "seminarParticipant",
          entityId: input.participantId,
          details: `PF: ${input.individualPF}`,
          req: ctx.req,
        });
        
        return { success: true };
      }),

    // Create participant
    createParticipant: publicProcedure
      .input(z.object({
        sessionToken: z.string(),
        seminarId: z.number(),
        roleId: z.number(),
        memberId: z.number().optional(),
        memberName: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const teacher = await db.getTeacherAccountBySessionToken(input.sessionToken);
        if (!teacher) throw new Error("Não autorizado");
        
        const { sessionToken, ...data } = input;
        const id = await db.createSeminarParticipant(data);
        return { id };
      }),

    // Delete participant
    deleteParticipant: publicProcedure
      .input(z.object({ sessionToken: z.string(), participantId: z.number() }))
      .mutation(async ({ input }) => {
        const teacher = await db.getTeacherAccountBySessionToken(input.sessionToken);
        if (!teacher) throw new Error("Não autorizado");
        
        await db.deleteSeminarParticipant(input.participantId);
        return { success: true };
      }),

    // Add article to seminar
    addArticle: publicProcedure
      .input(z.object({
        sessionToken: z.string(),
        seminarId: z.number(),
        pmid: z.string(),
        title: z.string(),
        authors: z.string().optional(),
        journal: z.string().optional(),
        year: z.number().optional(),
        abstract: z.string().optional(),
        url: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const teacher = await db.getTeacherAccountBySessionToken(input.sessionToken);
        if (!teacher) throw new Error("Não autorizado");
        
        const { sessionToken, ...data } = input;
        const id = await db.createSeminarArticle(data);
        return { id };
      }),

    // Delete article
    deleteArticle: publicProcedure
      .input(z.object({ sessionToken: z.string(), articleId: z.number() }))
      .mutation(async ({ input }) => {
        const teacher = await db.getTeacherAccountBySessionToken(input.sessionToken);
        if (!teacher) throw new Error("Não autorizado");
        
        await db.deleteSeminarArticle(input.articleId);
        return { success: true };
      }),
  }),

  // ─── Classes (Turmas) ───
  classes: router({
    // List all classes without authentication (for UI selectors)
    listAll: publicProcedure
      .query(async () => {
        const allClasses = await db.getAllClasses();
        return allClasses.map((c: any) => ({ id: c.id, name: c.name, course: c.course }));
      }),

    // List all classes (admin) or classes by teacher
    list: publicProcedure
      .input(z.object({ sessionToken: z.string() }))
      .query(async ({ input }) => {
        // Try super admin first
        const admin = await db.getTeacherAccountBySessionToken(input.sessionToken);
        if (admin && (admin.role === "super_admin" || admin.role === "coordenador")) {
          return db.getAllClasses();
        }
        if (admin) {
          return db.getClassesByTeacher(admin.id);
        }
        throw new Error("Não autorizado");
      }),

    // Get a single class with its teams and members
    getById: publicProcedure
      .input(z.object({ sessionToken: z.string(), classId: z.number() }))
      .query(async ({ input }) => {
        const admin = await db.getTeacherAccountBySessionToken(input.sessionToken);
        if (!admin) throw new Error("Não autorizado");
        const cls = await db.getClassById(input.classId);
        if (!cls) throw new Error("Turma não encontrada");
        // Check permission: admin/coordenador can see all, professor only their own
        if (admin.role !== "super_admin" && admin.role !== "coordenador" && cls.teacherAccountId !== admin.id) {
          throw new Error("Sem permissão para acessar esta turma");
        }
        const classTeams = await db.getTeamsByClass(input.classId);
        const classMembers = await db.getMembersByClass(input.classId);
        return { ...cls, teams: classTeams, members: classMembers };
      }),

    // Create a new class
    create: publicProcedure
      .input(z.object({
        sessionToken: z.string(),
        name: z.string().min(1),
        course: z.string().min(1),
        discipline: z.string().min(1),
        semester: z.string().optional(),
        teacherAccountId: z.number().optional(),
        teacherName: z.string().optional(),
        color: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const admin = await db.getTeacherAccountBySessionToken(input.sessionToken);
        if (!admin) throw new Error("Não autorizado");
        const { sessionToken, ...data } = input;
        // If no teacherAccountId specified, assign to current teacher
        if (!data.teacherAccountId) {
          data.teacherAccountId = admin.id;
          data.teacherName = admin.name;
        }
        const id = await db.createClass(data as any);
        return { id };
      }),

    // Update a class
    update: publicProcedure
      .input(z.object({
        sessionToken: z.string(),
        id: z.number(),
        name: z.string().optional(),
        course: z.string().optional(),
        discipline: z.string().optional(),
        teacherAccountId: z.number().nullable().optional(),
        teacherName: z.string().nullable().optional(),
        color: z.string().optional(),
        isActive: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const admin = await db.getTeacherAccountBySessionToken(input.sessionToken);
        if (!admin) throw new Error("Não autorizado");
        const { sessionToken, id, ...data } = input;
        await db.updateClass(id, data as any);
        return { success: true };
      }),

    // Delete a class
    delete: publicProcedure
      .input(z.object({ sessionToken: z.string(), id: z.number() }))
      .mutation(async ({ input }) => {
        const admin = await db.getTeacherAccountBySessionToken(input.sessionToken);
        if (!admin) throw new Error("Não autorizado");
        if (admin.role !== "super_admin" && admin.role !== "coordenador") {
          // Check if teacher owns this class
          const cls = await db.getClassById(input.id);
          if (!cls || cls.teacherAccountId !== admin.id) throw new Error("Sem permissão");
        }
        await db.deleteClass(input.id);
        return { success: true };
      }),

    // Assign a team to a class
    assignTeam: publicProcedure
      .input(z.object({ sessionToken: z.string(), teamId: z.number(), classId: z.number() }))
      .mutation(async ({ input }) => {
        const admin = await db.getTeacherAccountBySessionToken(input.sessionToken);
        if (!admin) throw new Error("Não autorizado");
        await db.updateTeam(input.teamId, { classId: input.classId });
        return { success: true };
      }),

    // Assign a member to a class
    assignMember: publicProcedure
      .input(z.object({ sessionToken: z.string(), memberId: z.number(), classId: z.number() }))
      .mutation(async ({ input }) => {
        const admin = await db.getTeacherAccountBySessionToken(input.sessionToken);
        if (!admin) throw new Error("Não autorizado");
        await db.updateMember(input.memberId, { classId: input.classId });
        return { success: true };
      }),
  }),

  jigsawGroups: jigsawRouter,
  settings: settingsRouter,
  studentActivities: studentActivitiesRouter,
  chat: chatRouter,

  // Temporary seed endpoint for Jigsaw data restoration
  jigsawSeed: router({
    deleteAll: publicProcedure
      .input(z.object({
        password: z.string(),
        classId: z.number(),
      }))
      .mutation(async ({ input }) => {
        const valid = await verifyAdminPassword(input.password);
        if (!valid) throw new Error("Senha incorreta");
        const schema = await import("../drizzle/schema.js");
        const { eq } = await import("drizzle-orm");
        const dbMod = await import("./db.js");
        const dbConn = await dbMod.getDb();
        if (!dbConn) throw new Error("Database not available");
        const homeGroups = await dbConn.select().from(schema.jigsawHomeGroups).where(eq(schema.jigsawHomeGroups.classId, input.classId));
        for (const hg of homeGroups) {
          await dbConn.delete(schema.jigsawHomeMembers).where(eq(schema.jigsawHomeMembers.homeGroupId, hg.id)).catch(() => {});
        }
        await dbConn.delete(schema.jigsawHomeGroups).where(eq(schema.jigsawHomeGroups.classId, input.classId)).catch(() => {});
        const expertGroups = await dbConn.select().from(schema.jigsawExpertGroups).where(eq(schema.jigsawExpertGroups.classId, input.classId));
        for (const eg of expertGroups) {
          await dbConn.delete(schema.jigsawExpertMembers).where(eq(schema.jigsawExpertMembers.expertGroupId, eg.id)).catch(() => {});
        }
        await dbConn.delete(schema.jigsawExpertGroups).where(eq(schema.jigsawExpertGroups.classId, input.classId)).catch(() => {});
        await dbConn.delete(schema.jigsawTopics).catch(() => {});
        return { success: true, message: "All Jigsaw data deleted for class " + input.classId };
      }),
    createAll: publicProcedure
      .input(z.object({
        password: z.string(),
        classId: z.number(),
        topics: z.array(z.object({ name: z.string(), description: z.string() })),
        expertGroups: z.array(z.object({ name: z.string(), topicName: z.string(), memberIds: z.array(z.number()) })),
        homeGroups: z.array(z.object({ name: z.string(), memberIds: z.array(z.number()) })),
      }))
      .mutation(async ({ input }) => {
        const valid = await verifyAdminPassword(input.password);
        if (!valid) throw new Error("Senha incorreta");
        const schema = await import("../drizzle/schema.js");
        const { eq } = await import("drizzle-orm");
        const dbMod = await import("./db.js");
        const dbConn = await dbMod.getDb();
        if (!dbConn) throw new Error("Database not available");
        // Create topics (jigsawTopics has no classId - it's global)
        const topicMap: Record<string, number> = {};
        for (const t of input.topics) {
          const existing = await dbConn.select().from(schema.jigsawTopics);
          const found = existing.find((e: any) => e.name === t.name);
          if (found) { topicMap[t.name] = found.id; continue; }
          const res = await dbConn.insert(schema.jigsawTopics).values({ name: t.name, description: t.description });
          topicMap[t.name] = (res as any)[0]?.insertId ?? (res as any).insertId;
        }
        // Create expert groups with members
        const expertGroupMap: Record<string, number> = {};
        for (const eg of input.expertGroups) {
          const topicId = topicMap[eg.topicName];
          if (!topicId) continue;
          const res = await dbConn.insert(schema.jigsawExpertGroups).values({ classId: input.classId, name: eg.name, topicId, description: eg.name, status: 'active' });
          const egId = (res as any)[0]?.insertId ?? (res as any).insertId;
          expertGroupMap[eg.name] = egId;
          for (const memberId of eg.memberIds) {
            await dbConn.insert(schema.jigsawExpertMembers).values({ expertGroupId: egId, memberId, topicId }).catch(() => {});
          }
        }
        // Create home groups with members
        let homeGroupsCreated = 0;
        for (const hg of input.homeGroups) {
          const res = await dbConn.insert(schema.jigsawHomeGroups).values({ classId: input.classId, name: hg.name, description: hg.name, meetingNumber: 1, status: 'forming' });
          const hgId = (res as any)[0]?.insertId ?? (res as any).insertId;
          homeGroupsCreated++;
          for (const memberId of hg.memberIds) {
            const expertMemberships = await dbConn.select().from(schema.jigsawExpertMembers).where(eq(schema.jigsawExpertMembers.memberId, memberId));
            const topicId = expertMemberships[0]?.topicId ?? Object.values(topicMap)[0] ?? 1;
            await dbConn.insert(schema.jigsawHomeMembers).values({ homeGroupId: hgId, memberId, topicId }).catch(() => {});
          }
        }
        return { success: true, topics: Object.keys(topicMap).length, expertGroups: Object.keys(expertGroupMap).length, homeGroups: homeGroupsCreated };
      }),
    cleanupExtras: publicProcedure
      .input(z.object({
        password: z.string(),
        classId: z.number(),
        expertGroupFixes: z.array(z.object({ groupId: z.number(), keepMemberIds: z.array(z.number()) })).optional(),
        homeGroupFixes: z.array(z.object({ groupId: z.number(), keepMemberIds: z.array(z.number()) })).optional(),
        deleteTeacherIds: z.array(z.number()).optional(),
      }))
      .mutation(async ({ input }) => {
        const valid = await verifyAdminPassword(input.password);
        if (!valid) throw new Error("Senha incorreta");
        const schema = await import("../drizzle/schema.js");
        const { eq, and } = await import("drizzle-orm");
        const dbMod = await import("./db.js");
        const dbConn = await dbMod.getDb();
        if (!dbConn) throw new Error("Database not available");
        let removedExpert = 0, removedHome = 0, removedTeachers = 0;
        for (const fix of (input.expertGroupFixes || [])) {
          if (fix.keepMemberIds.length === 0) continue;
          const members = await dbConn.select().from(schema.jigsawExpertMembers).where(eq(schema.jigsawExpertMembers.expertGroupId, fix.groupId));
          const toRemove = members.filter((m: any) => !fix.keepMemberIds.includes(m.memberId));
          for (const m of toRemove) {
            await dbConn.delete(schema.jigsawExpertMembers).where(and(eq(schema.jigsawExpertMembers.expertGroupId, fix.groupId), eq(schema.jigsawExpertMembers.memberId, m.memberId))).catch(() => {});
            removedExpert++;
          }
        }
        for (const fix of (input.homeGroupFixes || [])) {
          if (fix.keepMemberIds.length === 0) continue;
          const members = await dbConn.select().from(schema.jigsawHomeMembers).where(eq(schema.jigsawHomeMembers.homeGroupId, fix.groupId));
          const toRemove = members.filter((m: any) => !fix.keepMemberIds.includes(m.memberId));
          for (const m of toRemove) {
            await dbConn.delete(schema.jigsawHomeMembers).where(and(eq(schema.jigsawHomeMembers.homeGroupId, fix.groupId), eq(schema.jigsawHomeMembers.memberId, m.memberId))).catch(() => {});
            removedHome++;
          }
        }
        for (const tid of (input.deleteTeacherIds || [])) {
          await dbConn.delete(schema.teacherAccounts).where(eq(schema.teacherAccounts.id, tid)).catch(() => {});
          removedTeachers++;
        }
         return { success: true, removedExpert, removedHome, removedTeachers };
      }),
    addMember: publicProcedure
      .input(z.object({
        password: z.string(),
        groupType: z.enum(['expert', 'home']),
        groupId: z.number(),
        memberId: z.number(),
        classId: z.number(),
      }))
      .mutation(async ({ input }) => {
        const valid = await verifyAdminPassword(input.password);
        if (!valid) throw new Error("Senha incorreta");
        const schema = await import("../drizzle/schema.js");
        const { eq } = await import("drizzle-orm");
        const dbMod = await import("./db.js");
        const dbConn = await dbMod.getDb();
        if (!dbConn) throw new Error("Database not available");
        if (input.groupType === 'expert') {
          const topics = await dbConn.select().from(schema.jigsawTopics).limit(1);
          const topicId = topics[0]?.id ?? 1;
          await dbConn.insert(schema.jigsawExpertMembers).values({ expertGroupId: input.groupId, memberId: input.memberId, topicId });
          return { success: true, type: 'expert', groupId: input.groupId, memberId: input.memberId };
        } else {
          const expertMemberships = await dbConn.select().from(schema.jigsawExpertMembers).where(eq(schema.jigsawExpertMembers.memberId, input.memberId));
          const topics = await dbConn.select().from(schema.jigsawTopics).limit(1);
          const topicId = expertMemberships[0]?.topicId ?? topics[0]?.id ?? 1;
          await dbConn.insert(schema.jigsawHomeMembers).values({ homeGroupId: input.groupId, memberId: input.memberId, topicId });
          return { success: true, type: 'home', groupId: input.groupId, memberId: input.memberId };
        }
      }),
    setExpertScores: publicProcedure
      .input(z.object({
        password: z.string(),
        classId: z.number(),
        scores: z.array(z.object({
          expertGroupId: z.number().optional(),
          memberId: z.number(),
          presentationScore: z.number().min(0).max(5),
          participationScore: z.number().min(0).max(2),
        })),
      }))
      .mutation(async ({ input }) => {
        const valid = await verifyAdminPassword(input.password);
        if (!valid) throw new Error("Senha incorreta");
        const schema = await import("../drizzle/schema.js");
        const { eq, and } = await import("drizzle-orm");
        const dbMod = await import("./db.js");
        const dbConn = await dbMod.getDb();
        if (!dbConn) throw new Error("Database not available");
        let updated = 0;
        for (const score of input.scores) {
          if (score.expertGroupId) {
            await dbConn.update(schema.jigsawExpertMembers)
              .set({ presentationScore: String(score.presentationScore), participationScore: String(score.participationScore) })
              .where(and(eq(schema.jigsawExpertMembers.expertGroupId, score.expertGroupId), eq(schema.jigsawExpertMembers.memberId, score.memberId)))
              .catch(() => {});
          } else {
            await dbConn.update(schema.jigsawExpertMembers)
              .set({ presentationScore: String(score.presentationScore), participationScore: String(score.participationScore) })
              .where(eq(schema.jigsawExpertMembers.memberId, score.memberId))
              .catch(() => {});
          }
          updated++;
        }
        const expertGroups = await dbConn.select().from(schema.jigsawExpertGroups).where(eq(schema.jigsawExpertGroups.classId, input.classId));
        for (const eg of expertGroups) {
          await dbConn.update(schema.jigsawExpertGroups).set({ status: 'completed' }).where(eq(schema.jigsawExpertGroups.id, eg.id)).catch(() => {});
        }
        return { success: true, updated };
      }),
    deleteExpertMemberRows: publicProcedure
      .input(z.object({
        password: z.string(),
        rowIds: z.array(z.number()),
      }))
      .mutation(async ({ input }) => {
        const valid = await verifyAdminPassword(input.password);
        if (!valid) throw new Error("Senha incorreta");
        const schema = await import("../drizzle/schema.js");
        const { eq, inArray } = await import("drizzle-orm");
        const dbMod = await import("./db.js");
        const dbConn = await dbMod.getDb();
        if (!dbConn) throw new Error("Database not available");
        let deleted = 0;
        for (const rowId of input.rowIds) {
          await dbConn.delete(schema.jigsawExpertMembers).where(eq(schema.jigsawExpertMembers.id, rowId)).catch(() => {});
          deleted++;
        }
        return { success: true, deleted };
      }),
    getExpertMemberRows: publicProcedure
      .input(z.object({
        password: z.string(),
        expertGroupId: z.number(),
        memberId: z.number(),
      }))
      .query(async ({ input }) => {
        const valid = await verifyAdminPassword(input.password);
        if (!valid) throw new Error("Senha incorreta");
        const schema = await import("../drizzle/schema.js");
        const { eq, and } = await import("drizzle-orm");
        const dbMod = await import("./db.js");
        const dbConn = await dbMod.getDb();
        if (!dbConn) throw new Error("Database not available");
        const rows = await dbConn.select().from(schema.jigsawExpertMembers)
          .where(and(eq(schema.jigsawExpertMembers.expertGroupId, input.expertGroupId), eq(schema.jigsawExpertMembers.memberId, input.memberId)));
        return { rows };
      }),
    removeHomeMember: publicProcedure
      .input(z.object({
        password: z.string(),
        homeGroupId: z.number(),
        memberId: z.number(),
      }))
      .mutation(async ({ input }) => {
        const valid = await verifyAdminPassword(input.password);
        if (!valid) throw new Error("Senha incorreta");
        const schema = await import("../drizzle/schema.js");
        const { eq, and } = await import("drizzle-orm");
        const dbMod = await import("./db.js");
        const dbConn = await dbMod.getDb();
        if (!dbConn) throw new Error("Database not available");
        await dbConn.delete(schema.jigsawHomeMembers)
          .where(and(eq(schema.jigsawHomeMembers.homeGroupId, input.homeGroupId), eq(schema.jigsawHomeMembers.memberId, input.memberId)));
        return { success: true, homeGroupId: input.homeGroupId, memberId: input.memberId };
      }),
  }),
});

// Haversine formula to calculate distance between two coordinates in meters
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export type AppRouter = typeof appRouter;
