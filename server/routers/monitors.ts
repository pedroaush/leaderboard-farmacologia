import { z } from "zod";
import { router, publicProcedure } from "../_core/trpc";
import { getDb, getTeacherAccountBySessionToken } from "../db";
import { studentAccounts, monitorActivityLogs, classes, jigsawHomeGroups, jigsawHomeMembers, jigsawExpertGroups, jigsawExpertMembers, members, groupActivityGrades, teacherGrades, monitoringCertificates, jigsawGroups, jigsawMembers, jigsawScores, seminarioApresentacoes, jigsawIntegrationQuestions, jigsawIntegrationAnswers } from "../../drizzle/schema";
import { eq, and, desc, gte, lte } from "drizzle-orm";
import crypto from "crypto";
import bcrypt from "bcryptjs";

// Helper: autenticar monitor e retornar dados completos
async function getMonitorByToken(sessionToken: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const accounts = await db
    .select({
      id: studentAccounts.id,
      email: studentAccounts.email,
      displayName: studentAccounts.displayName,
      accountType: studentAccounts.accountType,
      isActive: studentAccounts.isActive,
      assignedClassId: studentAccounts.assignedClassId,
    })
    .from(studentAccounts)
    .where(and(
      eq(studentAccounts.sessionToken, sessionToken),
      eq(studentAccounts.accountType, "monitor"),
      eq(studentAccounts.isActive, 1)
    ))
    .limit(1);
  return accounts[0] ?? null;
}

export const monitorsRouter = router({
  // ─── Cadastro público de monitor ───
  // Monitor se cadastra com email, nome, matrícula (senha = matrícula) e turma
  selfRegister: publicProcedure
    .input(z.object({
      email: z.string().email(),
      displayName: z.string().min(2).max(200),
      matricula: z.string().min(3).max(30),
      assignedClassId: z.number().int().positive(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // Verificar se email já existe
      const existingEmail = await db
        .select({ id: studentAccounts.id })
        .from(studentAccounts)
        .where(eq(studentAccounts.email, input.email))
        .limit(1);
      if (existingEmail.length > 0) {
        return { success: false, message: "Este e-mail já está cadastrado no sistema." } as const;
      }

      // Verificar se matrícula já existe
      const existingMatricula = await db
        .select({ id: studentAccounts.id })
        .from(studentAccounts)
        .where(eq(studentAccounts.matricula, input.matricula))
        .limit(1);
      if (existingMatricula.length > 0) {
        return { success: false, message: "Esta matrícula já está cadastrada no sistema." } as const;
      }

      // Verificar se a turma existe
      const turma = await db
        .select({ id: classes.id, name: classes.name })
        .from(classes)
        .where(and(eq(classes.id, input.assignedClassId), eq(classes.isActive, 1)))
        .limit(1);
      if (!turma.length) {
        return { success: false, message: "Turma não encontrada ou inativa." } as const;
      }

      // Senha = matrícula (hash)
      const passwordHash = await bcrypt.hash(input.matricula, 10);

      await db.insert(studentAccounts).values({
        email: input.email,
        matricula: input.matricula,
        displayName: input.displayName,
        passwordHash,
        accountType: "monitor",
        assignedClassId: input.assignedClassId,
        isActive: 0, // Aguarda aprovação do professor
      });

      return {
        success: true,
        message: `Cadastro realizado! Aguarde a aprovação do professor para acessar o portal. Sua turma: ${turma[0].name}`,
      } as const;
    }),

  // ─── Listar turmas disponíveis (público, para o formulário de cadastro) ───
  listClassesPublic: publicProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db
        .select({ id: classes.id, name: classes.name, semester: classes.semester, course: classes.course })
        .from(classes)
        .where(eq(classes.isActive, 1))
        .orderBy(classes.name);
    }),

  // ─── List all monitors (teacher only) ───
  list: publicProcedure
    .input(z.object({ teacherSessionToken: z.string() }))
    .query(async ({ input }) => {
      const teacher = await getTeacherAccountBySessionToken(input.teacherSessionToken);
      if (!teacher) throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const monitors = await db
        .select({
          id: studentAccounts.id,
          email: studentAccounts.email,
          matricula: studentAccounts.matricula,
          displayName: studentAccounts.displayName,
          accountType: studentAccounts.accountType,
          isActive: studentAccounts.isActive,
          assignedClassId: studentAccounts.assignedClassId,
          lastLoginAt: studentAccounts.lastLoginAt,
          createdAt: studentAccounts.createdAt,
        })
        .from(studentAccounts)
        .where(eq(studentAccounts.accountType, "monitor"));
      return monitors;
    }),

  // ─── Register a new monitor (teacher only) ───
  register: publicProcedure
    .input(z.object({
      teacherSessionToken: z.string(),
      email: z.string().email(),
      matricula: z.string().min(3),
      displayName: z.string().min(2),
      password: z.string().min(6),
      assignedClassId: z.number().int().positive().optional(),
    }))
    .mutation(async ({ input }) => {
      const teacher = await getTeacherAccountBySessionToken(input.teacherSessionToken);
      if (!teacher) throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const existing = await db
        .select({ id: studentAccounts.id })
        .from(studentAccounts)
        .where(eq(studentAccounts.email, input.email));
      if (existing.length > 0) {
        return { success: false, message: "Email já cadastrado" } as const;
      }
      const passwordHash = await bcrypt.hash(input.password, 10);
      await db.insert(studentAccounts).values({
        email: input.email,
        matricula: input.matricula,
        displayName: input.displayName,
        passwordHash,
        accountType: "monitor",
        assignedClassId: input.assignedClassId ?? null,
        isActive: 1,
      });
      return { success: true, message: "Monitor cadastrado com sucesso" } as const;
    }),

  // ─── Update monitor info (teacher only) ───
  update: publicProcedure
    .input(z.object({
      teacherSessionToken: z.string(),
      monitorId: z.number(),
      displayName: z.string().min(2).optional(),
      isActive: z.number().optional(),
      newPassword: z.string().min(6).optional(),
      assignedClassId: z.number().int().positive().nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      const teacher = await getTeacherAccountBySessionToken(input.teacherSessionToken);
      if (!teacher) throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const updates: Record<string, unknown> = {};
      if (input.displayName !== undefined) updates.displayName = input.displayName;
      if (input.isActive !== undefined) updates.isActive = input.isActive;
      if (input.assignedClassId !== undefined) updates.assignedClassId = input.assignedClassId;
      if (input.newPassword) {
        updates.passwordHash = await bcrypt.hash(input.newPassword, 10);
      }
      if (Object.keys(updates).length === 0) {
        return { success: false, message: "Nenhum campo para atualizar" } as const;
      }
      await db
        .update(studentAccounts)
        .set(updates)
        .where(and(
          eq(studentAccounts.id, input.monitorId),
          eq(studentAccounts.accountType, "monitor")
        ));
      return { success: true, message: "Monitor atualizado com sucesso" } as const;
    }),

  // ─── Remove a monitor (teacher only) ───
  remove: publicProcedure
    .input(z.object({
      teacherSessionToken: z.string(),
      monitorId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const teacher = await getTeacherAccountBySessionToken(input.teacherSessionToken);
      if (!teacher) throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db
        .delete(studentAccounts)
        .where(and(
          eq(studentAccounts.id, input.monitorId),
          eq(studentAccounts.accountType, "monitor")
        ));
      return { success: true, message: "Monitor removido com sucesso" } as const;
    }),

  // ─── Monitor login ───
  login: publicProcedure
    .input(z.object({
      email: z.string().email(),
      password: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const account = await db
        .select()
        .from(studentAccounts)
        .where(and(
          eq(studentAccounts.email, input.email),
          eq(studentAccounts.accountType, "monitor")
        ))
        .limit(1);
      if (account.length === 0) {
        return { success: false, message: "Monitor não encontrado. Verifique o e-mail ou cadastre-se." } as const;
      }
      const monitor = account[0];
      if (!monitor.isActive) {
        return { success: false, message: "Conta aguardando aprovação do professor. Entre em contato com o professor responsável." } as const;
      }
      const passwordMatch = await bcrypt.compare(input.password, monitor.passwordHash);
      if (!passwordMatch) {
        return { success: false, message: "Senha incorreta. Lembre-se: a senha é o seu número de matrícula." } as const;
      }
      const sessionToken = `monitor_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      await db
        .update(studentAccounts)
        .set({ sessionToken, lastLoginAt: new Date() })
        .where(eq(studentAccounts.id, monitor.id));
      // Auto-log login action
      await db.insert(monitorActivityLogs).values({
        monitorId: monitor.id,
        monitorName: monitor.displayName ?? monitor.email,
        actionType: "login",
        actionDescription: `Login realizado no portal do monitor`,
      }).catch(() => {}); // Non-blocking
      return {
        success: true,
        sessionToken,
        monitor: {
          id: monitor.id,
          email: monitor.email,
          displayName: monitor.displayName,
          accountType: monitor.accountType,
          assignedClassId: monitor.assignedClassId,
        },
      } as const;
    }),

  // ─── Get monitor profile from session token ───
  me: publicProcedure
    .input(z.object({ sessionToken: z.string() }))
    .query(async ({ input }) => {
      if (!input.sessionToken) return null;
      const monitor = await getMonitorByToken(input.sessionToken);
      return monitor;
    }),

  // ─── Monitor logout ───
  logout: publicProcedure
    .input(z.object({ sessionToken: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db
        .update(studentAccounts)
        .set({ sessionToken: null })
        .where(eq(studentAccounts.sessionToken, input.sessionToken));
      return { success: true } as const;
    }),

  // ─── Promote existing external student to monitor (teacher only) ───
  promoteToMonitor: publicProcedure
    .input(z.object({
      teacherSessionToken: z.string(),
      studentAccountId: z.number(),
      displayName: z.string().min(2),
      assignedClassId: z.number().int().positive().optional(),
    }))
    .mutation(async ({ input }) => {
      const teacher = await getTeacherAccountBySessionToken(input.teacherSessionToken);
      if (!teacher) throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db
        .update(studentAccounts)
        .set({
          accountType: "monitor",
          displayName: input.displayName,
          assignedClassId: input.assignedClassId ?? null,
        })
        .where(eq(studentAccounts.id, input.studentAccountId));
      return { success: true, message: "Conta promovida a monitor" } as const;
    }),

  // ─── Activity Log Endpoints ───

  // Log a monitor action (called by monitor portal)
  logAction: publicProcedure
    .input(z.object({
      monitorSessionToken: z.string(),
      actionType: z.string().min(1),
      actionDescription: z.string().min(1),
      targetEntity: z.string().optional(),
      targetId: z.number().optional(),
      metadata: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const accounts = await db
        .select({
          id: studentAccounts.id,
          displayName: studentAccounts.displayName,
          email: studentAccounts.email,
        })
        .from(studentAccounts)
        .where(and(
          eq(studentAccounts.sessionToken, input.monitorSessionToken),
          eq(studentAccounts.accountType, "monitor")
        ))
        .limit(1);
      const monitor = accounts[0];
      if (!monitor) throw new Error("Monitor não autenticado");
      await db.insert(monitorActivityLogs).values({
        monitorId: monitor.id,
        monitorName: monitor.displayName ?? monitor.email,
        actionType: input.actionType,
        actionDescription: input.actionDescription,
        targetEntity: input.targetEntity ?? null,
        targetId: input.targetId ?? null,
        metadata: input.metadata ?? null,
      });
      return { success: true } as const;
    }),

  // Get activity logs (teacher only)
  getActivityLogs: publicProcedure
    .input(z.object({
      teacherSessionToken: z.string(),
      monitorId: z.number().optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      limit: z.number().min(1).max(500).default(100),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ input }) => {
      const teacher = await getTeacherAccountBySessionToken(input.teacherSessionToken);
      if (!teacher) throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const conditions = [];
      if (input.monitorId) {
        conditions.push(eq(monitorActivityLogs.monitorId, input.monitorId));
      }
      if (input.dateFrom) {
        conditions.push(gte(monitorActivityLogs.createdAt, new Date(input.dateFrom)));
      }
      if (input.dateTo) {
        const endDate = new Date(input.dateTo);
        endDate.setHours(23, 59, 59, 999);
        conditions.push(lte(monitorActivityLogs.createdAt, endDate));
      }
      const query = db
        .select()
        .from(monitorActivityLogs)
        .orderBy(desc(monitorActivityLogs.createdAt))
        .limit(input.limit)
        .offset(input.offset);
      if (conditions.length > 0) {
        return await query.where(conditions.length === 1 ? conditions[0] : and(...conditions));
      }
      return await query;
    }),

  // Get activity summary per monitor (teacher only)
  getActivitySummary: publicProcedure
    .input(z.object({ teacherSessionToken: z.string() }))
    .query(async ({ input }) => {
      const teacher = await getTeacherAccountBySessionToken(input.teacherSessionToken);
      if (!teacher) throw new Error("Unauthorized");
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const monitors = await db
        .select({
          id: studentAccounts.id,
          email: studentAccounts.email,
          displayName: studentAccounts.displayName,
          isActive: studentAccounts.isActive,
          assignedClassId: studentAccounts.assignedClassId,
          lastLoginAt: studentAccounts.lastLoginAt,
        })
        .from(studentAccounts)
        .where(eq(studentAccounts.accountType, "monitor"));
      const result = await Promise.all(
        monitors.map(async (monitor) => {
          const recentLogs = await db
            .select()
            .from(monitorActivityLogs)
            .where(eq(monitorActivityLogs.monitorId, monitor.id))
            .orderBy(desc(monitorActivityLogs.createdAt))
            .limit(5);
          const allLogs = await db
            .select({ id: monitorActivityLogs.id })
            .from(monitorActivityLogs)
            .where(eq(monitorActivityLogs.monitorId, monitor.id));
          return {
            monitor,
            recentLogs,
            totalActions: allLogs.length,
          };
        })
      );
      return result;
    }),

  // ============================================================
  // TURMAS E NOTAS DE ATIVIDADES (Kahoot e Casos Clínicos)
  // ============================================================

  // Listar a turma do monitor logado (apenas a turma vinculada)
  listClasses: publicProcedure
    .input(z.object({ monitorSessionToken: z.string() }))
    .query(async ({ input }) => {
      const monitor = await getMonitorByToken(input.monitorSessionToken);
      if (!monitor) throw new Error("Acesso negado");
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // Se o monitor tem turma vinculada, retorna apenas ela
      if (monitor.assignedClassId) {
        return db
          .select()
          .from(classes)
          .where(and(eq(classes.id, monitor.assignedClassId), eq(classes.isActive, 1)));
      }
      // Sem turma vinculada: retorna lista vazia (não deve acontecer em produção)
      return [];
    }),

  // Listar grupos mosaico (fase 2 do Jigsaw) de uma turma com seus membros
  listHomeGroups: publicProcedure
    .input(z.object({
      monitorSessionToken: z.string(),
      classId: z.number(),
    }))
    .query(async ({ input }) => {
      const monitor = await getMonitorByToken(input.monitorSessionToken);
      if (!monitor) throw new Error("Acesso negado");
      // Verificar que o monitor está acessando apenas sua turma
      if (monitor.assignedClassId && monitor.assignedClassId !== input.classId) {
        throw new Error("Acesso negado: você só pode acessar dados da sua turma.");
      }
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const groups = await db
        .select()
        .from(jigsawHomeGroups)
        .where(eq(jigsawHomeGroups.classId, input.classId))
        .orderBy(jigsawHomeGroups.meetingNumber, jigsawHomeGroups.name);

      const groupsWithMembers = await Promise.all(
        groups.map(async (group) => {
          const groupMembers = await db
            .select({
              id: jigsawHomeMembers.id,
              memberId: jigsawHomeMembers.memberId,
              memberName: members.name,
            })
            .from(jigsawHomeMembers)
            .leftJoin(members, eq(jigsawHomeMembers.memberId, members.id))
            .where(eq(jigsawHomeMembers.homeGroupId, group.id));
          return { ...group, membersList: groupMembers };
        })
      );
      return groupsWithMembers;
    }),

  // ─── Casos Clínicos — Liga de Pontos Corridos ───
  // A nota já é calculada automaticamente pela classificação do campeonato
  // (fase3PF em jigsawScores, atualizado pelo router casosClinicos quando os
  // resultados das rodadas são registrados). O monitor só VISUALIZA aqui —
  // não lança nota manual, diferente do fluxo antigo de Kahoot.
  listCasosClinicosGroups: publicProcedure
    .input(z.object({
      monitorSessionToken: z.string(),
      classId: z.number(),
    }))
    .query(async ({ input }) => {
      const monitor = await getMonitorByToken(input.monitorSessionToken);
      if (!monitor) throw new Error("Acesso negado");
      if (monitor.assignedClassId && monitor.assignedClassId !== input.classId) {
        throw new Error("Acesso negado: você só pode acessar dados da sua turma.");
      }
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const groups = await db
        .select()
        .from(jigsawGroups)
        .where(and(eq(jigsawGroups.classId, input.classId), eq(jigsawGroups.groupType, "clinical_case")))
        .orderBy(jigsawGroups.name);

      const groupsWithMembers = await Promise.all(
        groups.map(async (group) => {
          const groupMembers = await db
            .select({
              memberId: jigsawMembers.memberId,
              memberName: members.name,
              fase3PF: jigsawScores.fase3PF,
            })
            .from(jigsawMembers)
            .leftJoin(members, eq(jigsawMembers.memberId, members.id))
            .leftJoin(jigsawScores, eq(jigsawScores.memberId, jigsawMembers.memberId))
            .where(eq(jigsawMembers.jigsawGroupId, group.id));
          const notaAtual = groupMembers.length > 0 && groupMembers[0].fase3PF !== null
            ? Number(groupMembers[0].fase3PF)
            : null;
          return { ...group, membersList: groupMembers, notaAtual };
        })
      );
      return groupsWithMembers;
    }),

  // Listar grupos experts (grupos de seminário/Kahoot) de uma turma com seus membros
  listExpertGroups: publicProcedure
    .input(z.object({
      monitorSessionToken: z.string(),
      classId: z.number(),
    }))
    .query(async ({ input }) => {
      const monitor = await getMonitorByToken(input.monitorSessionToken);
      if (!monitor) throw new Error("Acesso negado");
      if (monitor.assignedClassId && monitor.assignedClassId !== input.classId) {
        throw new Error("Acesso negado: você só pode acessar dados da sua turma.");
      }
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const groups = await db
        .select()
        .from(jigsawExpertGroups)
        .where(eq(jigsawExpertGroups.classId, input.classId))
        .orderBy(jigsawExpertGroups.name);
      const groupsWithMembers = await Promise.all(
        groups.map(async (group) => {
          const groupMembers = await db
            .select({
              id: jigsawExpertMembers.id,
              memberId: jigsawExpertMembers.memberId,
              memberName: members.name,
            })
            .from(jigsawExpertMembers)
            .leftJoin(members, eq(jigsawExpertMembers.memberId, members.id))
            .where(eq(jigsawExpertMembers.expertGroupId, group.id));
          return { ...group, membersList: groupMembers };
        })
      );
      return groupsWithMembers;
    }),

  // Listar notas de atividades de uma turma
  listActivityGrades: publicProcedure
    .input(z.object({
      monitorSessionToken: z.string(),
      classId: z.number(),
      activityType: z.enum(["kahoot", "clinical_case"]).optional(),
    }))
    .query(async ({ input }) => {
      const monitor = await getMonitorByToken(input.monitorSessionToken);
      if (!monitor) throw new Error("Acesso negado");
      // Verificar que o monitor está acessando apenas sua turma
      if (monitor.assignedClassId && monitor.assignedClassId !== input.classId) {
        throw new Error("Acesso negado: você só pode acessar dados da sua turma.");
      }
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const conditions: ReturnType<typeof eq>[] = [eq(groupActivityGrades.classId, input.classId)];
      if (input.activityType) {
        conditions.push(eq(groupActivityGrades.activityType, input.activityType));
      }
      return db
        .select()
        .from(groupActivityGrades)
        .where(and(...conditions))
        .orderBy(groupActivityGrades.activityType, groupActivityGrades.activityName, groupActivityGrades.groupName);
    }),

  // Lançar ou atualizar nota de um grupo
  upsertActivityGrade: publicProcedure
    .input(z.object({
      monitorSessionToken: z.string(),
      classId: z.number(),
      activityType: z.enum(["kahoot", "clinical_case"]),
      activityName: z.string().min(1).max(200),
      homeGroupId: z.number().optional(),
      groupName: z.string().min(1).max(200),
      grade: z.number().min(0).max(100),
      maxGrade: z.number().min(0).max(100).default(10),
      notes: z.string().optional(),
      existingId: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const monitor = await getMonitorByToken(input.monitorSessionToken);
      if (!monitor) throw new Error("Acesso negado");
      // Verificar que o monitor está acessando apenas sua turma
      if (monitor.assignedClassId && monitor.assignedClassId !== input.classId) {
        throw new Error("Acesso negado: você só pode lançar notas da sua turma.");
      }
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const monitorName = monitor.displayName || monitor.email.split("@")[0];

      if (input.existingId) {
        await db
          .update(groupActivityGrades)
          .set({
            grade: String(input.grade),
            maxGrade: String(input.maxGrade),
            notes: input.notes,
            launchedByMonitorId: monitor.id,
            launchedByName: monitorName,
          })
          .where(eq(groupActivityGrades.id, input.existingId));
        return { success: true, action: "updated" };
      } else {
        await db.insert(groupActivityGrades).values({
          classId: input.classId,
          activityType: input.activityType,
          activityName: input.activityName,
          homeGroupId: input.homeGroupId,
          groupName: input.groupName,
          grade: String(input.grade),
          maxGrade: String(input.maxGrade),
          notes: input.notes,
          launchedByMonitorId: monitor.id,
          launchedByName: monitorName,
        });
        return { success: true, action: "created" };
      }
    }),

  // Deletar nota de atividade
  deleteActivityGrade: publicProcedure
    .input(z.object({
      monitorSessionToken: z.string(),
      gradeId: z.number(),
      classId: z.number(), // para validar acesso
    }))
    .mutation(async ({ input }) => {
      const monitor = await getMonitorByToken(input.monitorSessionToken);
      if (!monitor) throw new Error("Acesso negado");
      if (monitor.assignedClassId && monitor.assignedClassId !== input.classId) {
        throw new Error("Acesso negado: você só pode excluir notas da sua turma.");
      }
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db
        .delete(groupActivityGrades)
        .where(eq(groupActivityGrades.id, input.gradeId));
      return { success: true };
    }),

  // Listar nomes únicos de atividades (para autocomplete)
  listActivityNames: publicProcedure
    .input(z.object({
      monitorSessionToken: z.string(),
      classId: z.number(),
      activityType: z.enum(["kahoot", "clinical_case"]),
    }))
    .query(async ({ input }) => {
      const monitor = await getMonitorByToken(input.monitorSessionToken);
      if (!monitor) throw new Error("Acesso negado");
      if (monitor.assignedClassId && monitor.assignedClassId !== input.classId) {
        throw new Error("Acesso negado: você só pode acessar dados da sua turma.");
      }
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const results = await db
        .selectDistinct({ activityName: groupActivityGrades.activityName })
        .from(groupActivityGrades)
        .where(and(
          eq(groupActivityGrades.classId, input.classId),
          eq(groupActivityGrades.activityType, input.activityType)
        ))
        .orderBy(groupActivityGrades.activityName);
      return results.map(r => r.activityName);
    }),

  // ─── Seminário — Pôster + Quiz ───
  // Lista os grupos de Seminário (mesma tabela jigsawHomeGroups que
  // listHomeGroups já usa) junto com a nota do pôster já lançada, se houver.
  listSeminarioGroups: publicProcedure
    .input(z.object({
      monitorSessionToken: z.string(),
      classId: z.number(),
    }))
    .query(async ({ input }) => {
      const monitor = await getMonitorByToken(input.monitorSessionToken);
      if (!monitor) throw new Error("Acesso negado");
      if (monitor.assignedClassId && monitor.assignedClassId !== input.classId) {
        throw new Error("Acesso negado: você só pode acessar dados da sua turma.");
      }
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const groups = await db
        .select()
        .from(jigsawHomeGroups)
        .where(eq(jigsawHomeGroups.classId, input.classId))
        .orderBy(jigsawHomeGroups.name);

      const groupsWithData = await Promise.all(
        groups.map(async (group) => {
          const groupMembers = await db
            .select({ memberId: jigsawHomeMembers.memberId, memberName: members.name })
            .from(jigsawHomeMembers)
            .leftJoin(members, eq(jigsawHomeMembers.memberId, members.id))
            .where(eq(jigsawHomeMembers.homeGroupId, group.id));

          const apresentacao = await db.select().from(seminarioApresentacoes)
            .where(eq(seminarioApresentacoes.groupId, group.id)).limit(1);

          const questoesPendentes = await db.select().from(jigsawIntegrationQuestions)
            .where(and(eq(jigsawIntegrationQuestions.authorGroupId, group.id), eq(jigsawIntegrationQuestions.status, "pending_review")));

          return {
            ...group,
            membersList: groupMembers,
            notaPoster: apresentacao.length > 0 ? Number(apresentacao[0].notaPoster) : null,
            gradedByName: apresentacao.length > 0 ? apresentacao[0].gradedByName : null,
            perguntasPendentes: questoesPendentes.length,
          };
        })
      );
      return groupsWithData;
    }),

  // Lança/atualiza a nota do pôster de um grupo de Seminário (checklist),
  // igual o professor faz no AdminJigsawPanel — versão pro monitor, com
  // autenticação e escopo de turma próprios do sistema de monitores.
  lancarNotaPosterSeminario: publicProcedure
    .input(z.object({
      monitorSessionToken: z.string(),
      classId: z.number(),
      groupId: z.number(),
      checklist: z.record(z.boolean()),
      observacoes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const monitor = await getMonitorByToken(input.monitorSessionToken);
      if (!monitor) throw new Error("Acesso negado");
      if (monitor.assignedClassId && monitor.assignedClassId !== input.classId) {
        throw new Error("Acesso negado: você só pode lançar notas da sua turma.");
      }
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const monitorName = monitor.displayName || monitor.email.split("@")[0];

      const valores = Object.values(input.checklist);
      if (!valores.length) throw new Error("Checklist vazio");
      const positivos = valores.filter(Boolean).length;
      const notaPoster = Math.round((positivos / valores.length) * 10 * 10) / 10;

      const existing = await db.select().from(seminarioApresentacoes)
        .where(and(eq(seminarioApresentacoes.classId, input.classId), eq(seminarioApresentacoes.groupId, input.groupId)))
        .limit(1);

      if (existing.length > 0) {
        await db.update(seminarioApresentacoes).set({
          checklist: input.checklist, notaPoster: String(notaPoster),
          gradedBy: monitor.id, gradedByName: `${monitorName} (monitor)`, gradedAt: new Date(), observacoes: input.observacoes,
        }).where(eq(seminarioApresentacoes.id, existing[0].id));
      } else {
        await db.insert(seminarioApresentacoes).values({
          classId: input.classId, groupId: input.groupId, checklist: input.checklist,
          notaPoster: String(notaPoster), gradedBy: monitor.id, gradedByName: `${monitorName} (monitor)`, observacoes: input.observacoes,
        });
      }

      // Recalcula a nota final de Seminário (grupo + individual) de cada
      // membro do grupo — mesma fórmula usada em seminarioPoster.ts.
      const membrosDoGrupo = await db.select().from(jigsawHomeMembers).where(eq(jigsawHomeMembers.homeGroupId, input.groupId));
      for (const m of membrosDoGrupo) {
        const questoesDaTurma = await db.select().from(jigsawIntegrationQuestions).where(eq(jigsawIntegrationQuestions.classId, input.classId));
        const idsDaTurma = new Set(questoesDaTurma.map((q: any) => q.id));
        const respostas = await db.select().from(jigsawIntegrationAnswers).where(eq(jigsawIntegrationAnswers.memberId, m.memberId));
        const minhasRespostas = respostas.filter((r: any) => idsDaTurma.has(r.questionId));
        const totalRespondidas = minhasRespostas.length;
        const acertos = minhasRespostas.filter((r: any) => r.isCorrect === 1).length;
        const notaIndividual = totalRespondidas > 0 ? (acertos / totalRespondidas) * 10 : 0;
        const notaSeminario = Math.round(((notaPoster * 0.5) + (notaIndividual * 0.5)) * 10) / 10;

        const existingScore = await db.select().from(jigsawScores).where(eq(jigsawScores.memberId, m.memberId)).limit(1);
        if (existingScore.length > 0) {
          await db.update(jigsawScores).set({ totalJigsawPF: String(notaSeminario.toFixed(2)) }).where(eq(jigsawScores.memberId, m.memberId));
        } else {
          await db.insert(jigsawScores).values({
            classId: input.classId, memberId: m.memberId, totalPresentationScore: "0", totalParticipationScore: "0", totalPeerRating: "0",
            fase1PF: "0", fase2PF: "0", fase3PF: "0", totalJigsawPF: String(notaSeminario.toFixed(2)),
          });
        }
      }

      return { success: true, notaPoster };
    }),

  // ─── Endpoints para o ADMIN visualizar e editar notas dos monitores ───
  adminListActivityGrades: publicProcedure
    .input(z.object({
      teacherSessionToken: z.string(),
      classId: z.number().optional(),
      activityType: z.enum(["kahoot", "clinical_case"]).optional(),
    }))
    .query(async ({ input }) => {
      const teacher = await getTeacherAccountBySessionToken(input.teacherSessionToken);
      if (!teacher) throw new Error("Acesso negado");
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      let results;
      if (input.classId && input.activityType) {
        results = await db.select().from(groupActivityGrades)
          .where(and(eq(groupActivityGrades.classId, input.classId), eq(groupActivityGrades.activityType, input.activityType)))
          .orderBy(groupActivityGrades.activityName, groupActivityGrades.groupName);
      } else if (input.classId) {
        results = await db.select().from(groupActivityGrades)
          .where(eq(groupActivityGrades.classId, input.classId))
          .orderBy(groupActivityGrades.activityType, groupActivityGrades.activityName, groupActivityGrades.groupName);
      } else if (input.activityType) {
        results = await db.select().from(groupActivityGrades)
          .where(eq(groupActivityGrades.activityType, input.activityType))
          .orderBy(groupActivityGrades.classId, groupActivityGrades.activityName, groupActivityGrades.groupName);
      } else {
        results = await db.select().from(groupActivityGrades)
          .orderBy(groupActivityGrades.classId, groupActivityGrades.activityType, groupActivityGrades.activityName, groupActivityGrades.groupName);
      }
      return results;
    }),

  adminUpsertActivityGrade: publicProcedure
    .input(z.object({
      teacherSessionToken: z.string(),
      classId: z.number(),
      activityType: z.enum(["kahoot", "clinical_case"]),
      activityName: z.string().min(1).max(200),
      homeGroupId: z.number().optional(),
      groupName: z.string().min(1).max(200),
      grade: z.number().min(0).max(100),
      maxGrade: z.number().min(0).max(100).default(10),
      notes: z.string().optional(),
      existingId: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const teacher = await getTeacherAccountBySessionToken(input.teacherSessionToken);
      if (!teacher) throw new Error("Acesso negado");
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const now = new Date();
      if (input.existingId) {
        await db
          .update(groupActivityGrades)
          .set({
            grade: String(input.grade),
            maxGrade: String(input.maxGrade),
            notes: input.notes,
            launchedByName: teacher.name + " (admin)",
            updatedAt: now,
          })
          .where(eq(groupActivityGrades.id, input.existingId));
        return { success: true, message: "Nota atualizada" };
      }
      await db.insert(groupActivityGrades).values({
        classId: input.classId,
        activityType: input.activityType,
        activityName: input.activityName,
        homeGroupId: input.homeGroupId,
        groupName: input.groupName,
        grade: String(input.grade),
        maxGrade: String(input.maxGrade),
        notes: input.notes,
        launchedByName: teacher.name + " (admin)",
        createdAt: now,
        updatedAt: now,
      });
      return { success: true, message: "Nota lançada" };
    }),

  adminDeleteActivityGrade: publicProcedure
    .input(z.object({
      teacherSessionToken: z.string(),
      gradeId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const teacher = await getTeacherAccountBySessionToken(input.teacherSessionToken);
      if (!teacher) throw new Error("Acesso negado");
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.delete(groupActivityGrades).where(eq(groupActivityGrades.id, input.gradeId));
      return { success: true, message: "Nota excluída" };
    }),

  // ─── Teacher Grades: tabela de notas do professor (editavel livremente) ───
  listTeacherGrades: publicProcedure
    .input(z.object({
      teacherSessionToken: z.string(),
      classId: z.number().int().positive(),
      activityType: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const teacher = await getTeacherAccountBySessionToken(input.teacherSessionToken);
      if (!teacher) throw new Error("Acesso negado");
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const conditions = [eq(teacherGrades.classId, input.classId)];
      if (input.activityType) {
        conditions.push(eq(teacherGrades.activityType, input.activityType as any));
      }
      const rows = await db.select().from(teacherGrades).where(and(...conditions)).orderBy(desc(teacherGrades.createdAt));
      return rows;
    }),

  upsertTeacherGrade: publicProcedure
    .input(z.object({
      teacherSessionToken: z.string(),
      id: z.number().optional(),
      classId: z.number().int().positive(),
      activityType: z.enum(["kahoot","clinical_case","prova","seminario","participacao","outro"]),
      activityName: z.string().min(1).max(200),
      memberId: z.number().optional(),
      memberName: z.string().min(1).max(200),
      groupName: z.string().max(200).optional(),
      grade: z.number().min(0).max(100),
      maxGrade: z.number().min(0).max(100),
      notes: z.string().max(500).optional(),
      monitorGradeRef: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const teacher = await getTeacherAccountBySessionToken(input.teacherSessionToken);
      if (!teacher) throw new Error("Acesso negado");
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const now = new Date();
      const payload = {
        classId: input.classId,
        activityType: input.activityType,
        activityName: input.activityName,
        memberId: input.memberId ?? null,
        memberName: input.memberName,
        groupName: input.groupName ?? null,
        grade: String(input.grade),
        maxGrade: String(input.maxGrade),
        notes: input.notes ?? null,
        monitorGradeRef: input.monitorGradeRef ?? null,
        editedByTeacherId: teacher.id,
        editedByTeacherName: teacher.name,
        updatedAt: now,
      };
      if (input.id) {
        await db.update(teacherGrades).set(payload).where(eq(teacherGrades.id, input.id));
        return { success: true, message: "Nota atualizada" };
      } else {
        await db.insert(teacherGrades).values({ ...payload, createdAt: now });
        return { success: true, message: "Nota lançada" };
      }
    }),

  deleteTeacherGrade: publicProcedure
    .input(z.object({
      teacherSessionToken: z.string(),
      gradeId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const teacher = await getTeacherAccountBySessionToken(input.teacherSessionToken);
      if (!teacher) throw new Error("Acesso negado");
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.delete(teacherGrades).where(eq(teacherGrades.id, input.gradeId));
      return { success: true, message: "Nota excluída" };
    }),

  importMonitorGradesToTeacher: publicProcedure
    .input(z.object({
      teacherSessionToken: z.string(),
      classId: z.number().int().positive(),
      activityType: z.enum(["kahoot","clinical_case","prova","seminario","participacao","outro"]),
      activityName: z.string().min(1).max(200),
    }))
    .mutation(async ({ input }) => {
      const teacher = await getTeacherAccountBySessionToken(input.teacherSessionToken);
      if (!teacher) throw new Error("Acesso negado");
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      // Buscar notas dos monitores para esta atividade
      const monitorRows = await db.select().from(groupActivityGrades)
        .where(and(
          eq(groupActivityGrades.classId, input.classId),
          eq(groupActivityGrades.activityName, input.activityName)
        ));
      if (!monitorRows.length) return { success: false, message: "Nenhuma nota de monitor encontrada" };
      const now = new Date();
      for (const row of monitorRows) {
        await db.insert(teacherGrades).values({
          classId: input.classId,
          activityType: input.activityType,
          activityName: input.activityName,
          groupName: row.groupName ?? null,
          memberName: row.groupName ?? "Grupo",
          grade: row.grade,
          maxGrade: row.maxGrade,
          notes: row.notes ?? null,
          monitorGradeRef: row.id,
          editedByTeacherId: teacher.id,
          editedByTeacherName: teacher.name,
          createdAt: now,
          updatedAt: now,
        });
      }
      return { success: true, message: `${monitorRows.length} notas importadas dos monitores` };
    }),

  // ─── Monitoring Certificates ───
  issueCertificate: publicProcedure
    .input(z.object({
      teacherSessionToken: z.string(),
      monitorAccountId: z.number(),
      periodStart: z.string(),
      periodEnd: z.string(),
      workloadHours: z.number().default(60),
      professorTitle: z.string().optional(),
      department: z.string().optional(),
      activities: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input }) => {
      const teacher = await getTeacherAccountBySessionToken(input.teacherSessionToken);
      if (!teacher) throw new Error("Acesso negado");
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      // Buscar dados do monitor
      const monitorRows = await db.select({
        id: studentAccounts.id,
        displayName: studentAccounts.displayName,
        email: studentAccounts.email,
      }).from(studentAccounts).where(eq(studentAccounts.id, input.monitorAccountId)).limit(1);
      if (!monitorRows.length) throw new Error("Monitor não encontrado");
      const monitor = monitorRows[0];
      const certCode = "CF-" + crypto.randomBytes(4).toString("hex").toUpperCase() + "-" + Date.now().toString(36).toUpperCase();
      await db.insert(monitoringCertificates).values({
        monitorAccountId: input.monitorAccountId,
        monitorName: monitor.displayName ?? monitor.email,
        monitorEmail: monitor.email,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        workloadHours: input.workloadHours,
        professorName: teacher.name,
        professorTitle: input.professorTitle ?? "Prof. Dr.",
        department: input.department ?? "Departamento de Farmácia e Administração Farmacêutica",
        activities: input.activities ? JSON.stringify(input.activities) : null,
        issuedByTeacherId: teacher.id,
        certificateCode: certCode,
        createdAt: new Date(),
        issuedAt: new Date(),
      });
      return { success: true, certificateCode: certCode, message: "Certificado emitido com sucesso" };
    }),

  listCertificates: publicProcedure
    .input(z.object({
      teacherSessionToken: z.string().optional(),
      monitorSessionToken: z.string().optional(),
      monitorAccountId: z.number().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      // Autenticar como professor ou monitor
      let targetMonitorId: number | undefined;
      if (input.teacherSessionToken) {
        const teacher = await getTeacherAccountBySessionToken(input.teacherSessionToken);
        if (!teacher) throw new Error("Acesso negado");
        targetMonitorId = input.monitorAccountId;
      } else if (input.monitorSessionToken) {
        const monitor = await getMonitorByToken(input.monitorSessionToken);
        if (!monitor) throw new Error("Acesso negado");
        targetMonitorId = monitor.id;
      } else {
        throw new Error("Autenticação necessária");
      }
      const conditions = [eq(monitoringCertificates.status, "active")];
      if (targetMonitorId) conditions.push(eq(monitoringCertificates.monitorAccountId, targetMonitorId));
      return db.select().from(monitoringCertificates).where(and(...conditions)).orderBy(desc(monitoringCertificates.issuedAt));
    }),

  revokeCertificate: publicProcedure
    .input(z.object({
      teacherSessionToken: z.string(),
      certificateId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const teacher = await getTeacherAccountBySessionToken(input.teacherSessionToken);
      if (!teacher) throw new Error("Acesso negado");
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.update(monitoringCertificates).set({ status: "revoked" }).where(eq(monitoringCertificates.id, input.certificateId));
      return { success: true, message: "Certificado revogado" };
    }),

  getMonitorProfile: publicProcedure
    .input(z.object({ monitorSessionToken: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const monitor = await getMonitorByToken(input.monitorSessionToken);
      if (!monitor) throw new Error("Acesso negado");
      const certs = await db.select().from(monitoringCertificates)
        .where(and(
          eq(monitoringCertificates.monitorAccountId, monitor.id),
          eq(monitoringCertificates.status, "active")
        ))
        .orderBy(desc(monitoringCertificates.issuedAt));
      return { monitor, certificates: certs };
    }),
});