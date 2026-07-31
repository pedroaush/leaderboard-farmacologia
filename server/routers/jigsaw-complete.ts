/**
 * Complete Jigsaw Method Router
 * Implements expert groups, home groups, and scoring
 */

import { router, adminProcedure, protectedProcedure, publicProcedure } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { getDb, getTeacherAccountBySessionToken } from "../db";
import { eq, and } from "drizzle-orm";
import {
  jigsawTopics,
  jigsawExpertGroups,
  jigsawExpertMembers,
  jigsawHomeGroups,
  jigsawHomeMembers,
  jigsawScores,
  jigsawPeerEvaluations,
  studentAccounts,
  members,
} from "../../drizzle/schema";
import { sendJigsawNotification } from "../_core/jigsawNotifications";
import { createStudentNotification } from "../db";

/**
 * Utility: extract clean name from "matricula\tNome\temail" format
 */
function cleanName(raw: string | null | undefined): string {
  if (!raw) return "Desconhecido";
  const parts = raw.split("\t");
  if (parts.length >= 2) return parts[1].trim();
  return raw.trim();
}

/**
 * Input validation schemas
 */
const createTopicInput = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  articleUrl: z.string().url().optional(),
  articleTitle: z.string().optional(),
  articleAuthors: z.string().optional(),
  articleYear: z.number().optional(),
  keyPoints: z.array(z.string()).optional(),
  studyDuration: z.number().default(5),
});

const createExpertGroupInput = z.object({
  classId: z.number(),
  topicId: z.number(),
  name: z.string().min(1),
  description: z.string().optional(),
  maxMembers: z.number().default(14),
  presentationDate: z.date().optional(),
});

const addExpertMemberInput = z.object({
  expertGroupId: z.number(),
  memberId: z.number(),
  role: z.enum(["member", "coordinator", "presenter"]).default("member"),
});

const scoreExpertGroupInput = z.object({
  expertGroupId: z.number(),
  scores: z.array(z.object({
    memberId: z.number(),
    presentationScore: z.number().min(0).max(5),
    participationScore: z.number().min(0).max(2),
  })),
});

const createHomeGroupInput = z.object({
  classId: z.number(),
  name: z.string().min(1),
  description: z.string().optional(),
  meetingNumber: z.number(),
  meetingDate: z.date().optional(),
});

const addHomeMemberInput = z.object({
  homeGroupId: z.number(),
  memberId: z.number(),
  topicId: z.number(),
});

const scoreHomeGroupInput = z.object({
  homeGroupId: z.number(),
  sessionToken: z.string().optional(),
  scores: z.array(z.object({
    memberId: z.number(),
    presentationScore: z.number().min(0).max(5),
    participationScore: z.number().min(0).max(2),
    peerRating: z.number().min(0).max(5),
  })),
});

export const jigsawCompleteRouter = router({
  /**
   * ========================================
   * JIGSAW TOPICS MANAGEMENT
   * ========================================
   */
  topics: {
    /**
     * Get all Jigsaw topics
     */
    getAll: protectedProcedure.query(async () => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        const topics = await db.select().from(jigsawTopics);
        return topics;
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erro ao buscar tópicos Jigsaw",
        });
      }
    }),

    /**
     * Get topic by ID
     */
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        try {
          const db = await getDb();
          if (!db) throw new Error("Database not available");
          
          const result = await db
            .select()
            .from(jigsawTopics)
            .where(eq(jigsawTopics.id, input.id))
            .limit(1);
          
          if (result.length === 0) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Tópico não encontrado",
            });
          }
          return result[0];
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Erro ao buscar tópico",
          });
        }
      }),

    /**
     * Create new Jigsaw topic (admin only)
     */
    create: adminProcedure
      .input(createTopicInput)
      .mutation(async ({ input }) => {
        try {
          const db = await getDb();
          if (!db) throw new Error("Database not available");
          
          await db.insert(jigsawTopics).values({
            name: input.name,
            description: input.description || undefined,
            articleUrl: input.articleUrl || undefined,
            articleTitle: input.articleTitle || undefined,
            articleAuthors: input.articleAuthors || undefined,
            articleYear: input.articleYear || undefined,
            keyPoints: input.keyPoints ? JSON.stringify(input.keyPoints) : undefined,
            studyDuration: input.studyDuration,
          });
          
          return { success: true, topicId: input.name.length };
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Erro ao criar tópico",
          });
        }
      }),

    /**
     * Update Jigsaw topic (admin only)
     */
    update: adminProcedure
      .input(z.object({ id: z.number(), ...createTopicInput.shape }))
      .mutation(async ({ input }) => {
        try {
          const db = await getDb();
          if (!db) throw new Error("Database not available");
          
          await db.update(jigsawTopics).set({
            name: input.name,
            description: input.description || undefined,
            articleUrl: input.articleUrl || undefined,
            articleTitle: input.articleTitle || undefined,
            articleAuthors: input.articleAuthors || undefined,
            articleYear: input.articleYear || undefined,
            keyPoints: input.keyPoints ? JSON.stringify(input.keyPoints) : undefined,
            studyDuration: input.studyDuration,
          }).where(eq(jigsawTopics.id, input.id));
          
          return { success: true };
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Erro ao atualizar tópico",
          });
        }
      }),
  },

  /**
   * ========================================
   * EXPERT GROUPS MANAGEMENT
   * ========================================
   */
  expertGroups: {
    /**
     * Create expert group (admin only)
     */
    create: adminProcedure
      .input(createExpertGroupInput)
      .mutation(async ({ input }) => {
        try {
          const db = await getDb();
          if (!db) throw new Error("Database not available");
          
          await db.insert(jigsawExpertGroups).values({
            classId: input.classId,
            topicId: input.topicId,
            name: input.name,
            description: input.description || undefined,
            maxMembers: input.maxMembers,
            status: "forming",
            presentationDate: input.presentationDate,
          });
          
          return { success: true, groupId: input.classId };
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Erro ao criar grupo de especialistas",
          });
        }
      }),

    /**
     * Get expert groups by class
     */
    getByClass: publicProcedure
      .input(z.object({ classId: z.number() }))
      .query(async ({ input }) => {
        try {
          const db = await getDb();
          if (!db) throw new Error("Database not available");
          
          const groups = await db
            .select()
            .from(jigsawExpertGroups)
            .where(eq(jigsawExpertGroups.classId, input.classId));
          
          // Buscar membros e tópico para cada grupo
          const groupsWithDetails = await Promise.all(
            groups.map(async (group) => {
              // Buscar membros do grupo
              const groupMembers = await db
                .select()
                .from(jigsawExpertMembers)
                .where(eq(jigsawExpertMembers.expertGroupId, group.id));
              
              // Buscar dados completos dos membros
              const membersData = await Promise.all(
                groupMembers.map(async (gm) => {
                  const memberData = await db
                    .select()
                    .from(members)
                    .where(eq(members.id, gm.memberId))
                    .limit(1);
                  return memberData[0] ? { ...memberData[0], name: cleanName(memberData[0].name), role: gm.role } : null;
                })
              );
              
              // Buscar tópico
              const topicData = await db
                .select()
                .from(jigsawTopics)
                .where(eq(jigsawTopics.id, group.topicId))
                .limit(1);
              
              return {
                ...group,
                members: membersData.filter(Boolean),
                topicTitle: topicData[0]?.name || "Tópico não encontrado",
              };
            })
          );
          
          return groupsWithDetails;
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Erro ao buscar grupos de especialistas",
          });
        }
      }),

    /**
     * Get expert group by ID with members
     */
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        try {
          const db = await getDb();
          if (!db) throw new Error("Database not available");
          
          const result = await db
            .select()
            .from(jigsawExpertGroups)
            .where(eq(jigsawExpertGroups.id, input.id))
            .limit(1);
          
          if (result.length === 0) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Grupo de especialistas não encontrado",
            });
          }
          
          return result[0];
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Erro ao buscar grupo",
          });
        }
      }),

    /**
     * Add member to expert group
     */
    addMember: protectedProcedure
      .input(addExpertMemberInput)
      .mutation(async ({ input }) => {
        try {
          const db = await getDb();
          if (!db) throw new Error("Database not available");
          
          // Check if member already in group
          const existing = await db
            .select()
            .from(jigsawExpertMembers)
            .where(
              and(
                eq(jigsawExpertMembers.expertGroupId, input.expertGroupId),
                eq(jigsawExpertMembers.memberId, input.memberId)
              )
            )
            .limit(1);

          if (existing.length > 0) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Membro já está no grupo",
            });
          }

          await db.insert(jigsawExpertMembers).values({
            expertGroupId: input.expertGroupId,
            memberId: input.memberId,
            role: input.role,
          });
          
          // Buscar dados do membro e grupo para notificação
          const memberData = await db
            .select()
            .from(members)
            .where(eq(members.id, input.memberId))
            .limit(1);
          
          const groupData = await db
            .select()
            .from(jigsawExpertGroups)
            .where(eq(jigsawExpertGroups.id, input.expertGroupId))
            .limit(1);
          
          const topicData = await db
            .select()
            .from(jigsawTopics)
            .where(eq(jigsawTopics.id, groupData[0]?.topicId))
            .limit(1);
          
          // Enviar notificação (owner)
          if (memberData[0] && groupData[0]) {
            await sendJigsawNotification({
              type: "member_added_expert",
              studentName: memberData[0].name,
              groupName: groupData[0].name,
              topicName: topicData[0]?.name || "Tópico desconhecido",
            });
            
            // Enviar notificação individual para o aluno
            try {
              await createStudentNotification({
                memberId: input.memberId,
                classId: groupData[0].classId,
                title: `Você foi alocado(a) na equipe de Seminário!`,
                message: `Você foi designado(a) para a equipe "${groupData[0].name}" (Tópico: ${topicData[0]?.name || "A definir"}). Acesse a aba Equipes no seu portal para ver mais detalhes.`,
                type: "team_allocation",
                priority: "high",
                relatedEntityType: "jigsaw_expert_group",
                relatedEntityId: groupData[0].id,
              });
            } catch (notifErr) {
              console.warn("[StudentNotification] Failed to send:", notifErr);
            }
          }
          
          return { success: true, memberId: input.memberId };
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Erro ao adicionar membro",
          });
        }
      }),

    /**
     * Remove member from expert group
     */
    removeMember: protectedProcedure
      .input(z.object({ expertGroupId: z.number(), memberId: z.number() }))
      .mutation(async ({ input }) => {
        try {
          const db = await getDb();
          if (!db) throw new Error("Database not available");
          
          await db
            .delete(jigsawExpertMembers)
            .where(
              and(
                eq(jigsawExpertMembers.expertGroupId, input.expertGroupId),
                eq(jigsawExpertMembers.memberId, input.memberId)
              )
            );
          
          return { success: true };
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Erro ao remover membro",
          });
        }
      }),

    /**
     * Score expert group presentation (admin only)
     */
    scorePresentation: adminProcedure
      .input(scoreExpertGroupInput)
      .mutation(async ({ input }) => {
        try {
          const db = await getDb();
          if (!db) throw new Error("Database not available");
          
          for (const score of input.scores) {
            await db
              .update(jigsawExpertMembers)
              .set({
                presentationScore: String(score.presentationScore),
                participationScore: String(score.participationScore),
              })
              .where(
                and(
                  eq(jigsawExpertMembers.expertGroupId, input.expertGroupId),
                  eq(jigsawExpertMembers.memberId, score.memberId)
                )
              );
          }

          // Update expert group status
          await db
            .update(jigsawExpertGroups)
            .set({ status: "completed" })
            .where(eq(jigsawExpertGroups.id, input.expertGroupId));

          return { success: true };
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Erro ao registrar notas",
          });
        }
      }),

    /**
     * Get scores for expert group
     */
    getScores: protectedProcedure
      .input(z.object({ expertGroupId: z.number() }))
      .query(async ({ input }) => {
        try {
          const db = await getDb();
          if (!db) throw new Error("Database not available");
          
          const memberScores = await db
            .select()
            .from(jigsawExpertMembers)
            .where(eq(jigsawExpertMembers.expertGroupId, input.expertGroupId));

          return memberScores.map((m: any) => ({
            memberId: m.memberId,
            presentationScore: m.presentationScore,
            participationScore: m.participationScore,
            totalScore: (Number(m.presentationScore) || 0) + (Number(m.participationScore) || 0),
          }));
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Erro ao buscar notas",
          });
        }
      }),
  },

  /**
   * ========================================
   * HOME GROUPS (JIGSAW GROUPS) MANAGEMENT
   * ========================================
   */
  homeGroups: {
    /**
     * Create home group (Jigsaw group)
     */
    create: adminProcedure
      .input(createHomeGroupInput)
      .mutation(async ({ input }) => {
        try {
          const db = await getDb();
          if (!db) throw new Error("Database not available");
          
          await db.insert(jigsawHomeGroups).values({
            classId: input.classId,
            name: input.name,
            description: input.description || undefined,
            meetingNumber: input.meetingNumber,
            meetingDate: input.meetingDate,
            status: "forming",
          });
          
          return { success: true, groupId: input.classId };
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Erro ao criar grupo Jigsaw",
          });
        }
      }),

    /**
     * Get home groups by class
     */
    getByClass: publicProcedure
      .input(z.object({ classId: z.number() }))
      .query(async ({ input }) => {
        try {
          const db = await getDb();
          if (!db) throw new Error("Database not available");
          
          const groups = await db
            .select()
            .from(jigsawHomeGroups)
            .where(eq(jigsawHomeGroups.classId, input.classId));
          
          // Buscar membros e tópicos para cada grupo
          const groupsWithDetails = await Promise.all(
            groups.map(async (group) => {
              // Buscar membros do grupo
              const groupMembers = await db
                .select()
                .from(jigsawHomeMembers)
                .where(eq(jigsawHomeMembers.homeGroupId, group.id));
              
              // Buscar dados completos dos membros com seus tópicos
              const membersData = await Promise.all(
                groupMembers.map(async (gm) => {
                  const memberData = await db
                    .select()
                    .from(members)
                    .where(eq(members.id, gm.memberId))
                    .limit(1);
                  
                  // Buscar tópico do membro
                  const topicData = await db
                    .select()
                    .from(jigsawTopics)
                    .where(eq(jigsawTopics.id, gm.topicId))
                    .limit(1);
                  
                  return memberData[0] ? {
                    ...memberData[0],
                    name: cleanName(memberData[0].name),
                    topicId: gm.topicId,
                    topicName: topicData[0]?.name || "Tópico desconhecido",
                  } : null;
                })
              );
              
              return {
                ...group,
                members: membersData.filter(Boolean),
              };
            })
          );
          
          return groupsWithDetails;
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Erro ao buscar grupos Jigsaw",
          });
        }
      }),

    /**
     * Get home group by ID with members
     */
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        try {
          const db = await getDb();
          if (!db) throw new Error("Database not available");
          
          const result = await db
            .select()
            .from(jigsawHomeGroups)
            .where(eq(jigsawHomeGroups.id, input.id))
            .limit(1);
          
          if (result.length === 0) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Grupo Jigsaw não encontrado",
            });
          }
          
          return result[0];
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Erro ao buscar grupo",
          });
        }
      }),

    /**
     * Add member to home group
     */
    addMember: protectedProcedure
      .input(addHomeMemberInput)
      .mutation(async ({ input }) => {
        try {
          const db = await getDb();
          if (!db) throw new Error("Database not available");
          
          // Check if member already in group
          const existing = await db
            .select()
            .from(jigsawHomeMembers)
            .where(
              and(
                eq(jigsawHomeMembers.homeGroupId, input.homeGroupId),
                eq(jigsawHomeMembers.memberId, input.memberId)
              )
            )
            .limit(1);

          if (existing.length > 0) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Membro já está no grupo",
            });
          }

          await db.insert(jigsawHomeMembers).values({
            homeGroupId: input.homeGroupId,
            memberId: input.memberId,
            topicId: input.topicId,
          });

          // Enviar notificação individual para o aluno
          try {
            const groupData = await db
              .select()
              .from(jigsawHomeGroups)
              .where(eq(jigsawHomeGroups.id, input.homeGroupId))
              .limit(1);
            
            const topicData = await db
              .select()
              .from(jigsawTopics)
              .where(eq(jigsawTopics.id, input.topicId))
              .limit(1);
            
            if (groupData[0]) {
              await createStudentNotification({
                memberId: input.memberId,
                classId: groupData[0].classId,
                title: `Você foi alocado(a) em um Grupo Jigsaw!`,
                message: `Você foi designado(a) para o grupo "${groupData[0].name}" (Tópico: ${topicData[0]?.name || "A definir"}). Acesse a aba Equipes no seu portal para ver mais detalhes.`,
                type: "team_allocation",
                priority: "high",
                relatedEntityType: "jigsaw_home_group",
                relatedEntityId: groupData[0].id,
              });
            }
          } catch (notifErr) {
            console.warn("[StudentNotification] Failed to send:", notifErr);
          }

          return { success: true, memberId: input.memberId };
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Erro ao adicionar membro",
          });
        }
      }),

    /**
     * Remove member from home group
     */
    removeMember: protectedProcedure
      .input(z.object({ homeGroupId: z.number(), memberId: z.number() }))
      .mutation(async ({ input }) => {
        try {
          const db = await getDb();
          if (!db) throw new Error("Database not available");
          
          await db
            .delete(jigsawHomeMembers)
            .where(
              and(
                eq(jigsawHomeMembers.homeGroupId, input.homeGroupId),
                eq(jigsawHomeMembers.memberId, input.memberId)
              )
            );
          
          return { success: true };
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Erro ao remover membro",
          });
        }
      }),

    /**
     * Score home group participation (admin only)
     */
    scoreParticipation: publicProcedure
      .input(scoreHomeGroupInput)
      .mutation(async ({ input }) => {
        try {
          const db = await getDb();
          if (!db) throw new Error("Database not available");
          if (input.sessionToken) {
            const teacher = await getTeacherAccountBySessionToken(input.sessionToken);
            if (!teacher) throw new TRPCError({ code: "FORBIDDEN", message: "Token inválido" });
          }
          
          for (const score of input.scores) {
            await db
              .update(jigsawHomeMembers)
              .set({
                presentationScore: String(score.presentationScore),
                participationScore: String(score.participationScore),
                peerRating: String(score.peerRating),
              })
              .where(
                and(
                  eq(jigsawHomeMembers.homeGroupId, input.homeGroupId),
                  eq(jigsawHomeMembers.memberId, score.memberId)
                )
              );
          }

          // Update home group status
          await db
            .update(jigsawHomeGroups)
            .set({ status: "completed" })
            .where(eq(jigsawHomeGroups.id, input.homeGroupId));

          return { success: true };
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Erro ao registrar notas",
          });
        }
      }),

    /**
     * Get scores for home group
     */
     getScores: protectedProcedure
      .input(z.object({ homeGroupId: z.number() }))
      .query(async ({ input }) => {
        try {
          const db = await getDb();
          if (!db) throw new Error("Database not available");
          
          const memberScores = await db
            .select()
            .from(jigsawHomeMembers)
            .where(eq(jigsawHomeMembers.homeGroupId, input.homeGroupId));
          return memberScores.map((m: any) => ({
            memberId: m.memberId,
            presentationScore: m.presentationScore,
            participationScore: m.participationScore,
            peerRating: m.peerRating,
            totalScore:
              (Number(m.presentationScore) || 0) +
              (Number(m.participationScore) || 0) +
              (Number(m.peerRating) || 0),
          }));
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Erro ao buscar notas",
          });
        }
      }),
    /**
     * Renomear membro no grupo mosaico (professor pode corrigir nomes)
     */
    renameMember: publicProcedure
      .input(z.object({
        memberId: z.number(),
        newName: z.string().min(2).max(200),
        sessionToken: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          const db = await getDb();
          if (!db) throw new Error("Database not available");
          // Atualizar o nome na tabela members
          await db
            .update(members)
            .set({ name: input.newName })
            .where(eq(members.id, input.memberId));
          return { success: true, memberId: input.memberId, newName: input.newName };
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Erro ao renomear membro",
          });
        }
      }),
  },

  /**
   * ========================================
   * JIGSAW SCORES & REPORTS
   * ========================================
   */
  scores: {
    /**
     * Get Jigsaw scores for a member
     */
    getByMember: publicProcedure
      .input(z.object({ memberId: z.number() }))
      .query(async ({ input }) => {
        try {
          const db = await getDb();
          if (!db) throw new Error("Database not available");
          
          const result = await db
            .select()
            .from(jigsawScores)
            .where(eq(jigsawScores.memberId, input.memberId))
            .limit(1);

          return result.length > 0 ? result[0] : {
            memberId: input.memberId,
            totalPresentationScore: 0,
            totalParticipationScore: 0,
            totalPeerRating: 0,
            totalJigsawPF: 0,
          };
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Erro ao buscar notas",
          });
        }
      }),

    /**
     * Get Jigsaw scores for all members in a class
     */
    getByClass: publicProcedure
      .input(z.object({ classId: z.number(), sessionToken: z.string().optional() }))
      .query(async ({ input }) => {
        try {
          const db = await getDb();
          if (!db) throw new Error("Database not available");
          if (input.sessionToken) {
            const teacher = await getTeacherAccountBySessionToken(input.sessionToken);
            if (!teacher) throw new TRPCError({ code: "FORBIDDEN", message: "Token inválido" });
          }
          const scores = await db
            .select()
            .from(jigsawScores)
            .where(eq(jigsawScores.classId, input.classId));

          return scores;
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Erro ao buscar notas da turma",
          });
        }
      }),

    /**
     * Calculate and update total Jigsaw PF for a member
     */
    calculateTotal: publicProcedure
      .input(z.object({ memberId: z.number(), sessionToken: z.string().optional() }))
      .mutation(async ({ input }) => {
        try {
          const db = await getDb();
          if (!db) throw new Error("Database not available");
          if (input.sessionToken) {
            const teacher = await getTeacherAccountBySessionToken(input.sessionToken);
            if (!teacher) throw new TRPCError({ code: "FORBIDDEN", message: "Token inválido" });
          }
          
          // Get all expert group scores
          const expertScores = await db
            .select()
            .from(jigsawExpertMembers)
            .where(eq(jigsawExpertMembers.memberId, input.memberId));

          // Get all home group scores
          const homeScores = await db
            .select()
            .from(jigsawHomeMembers)
            .where(eq(jigsawHomeMembers.memberId, input.memberId));

          // === NORMALIZAÇÃO DAS NOTAS POR FASE ===
          // Fase 1: Grupos Especialistas (apresentação 0-5 + participação 0-2 = máx 7 brutos -> normaliza para 0-2 pts)
          const fase1Presentation = expertScores.reduce((s: number, x: any) => s + (Number(x.presentationScore) || 0), 0);
          const fase1Participation = expertScores.reduce((s: number, x: any) => s + (Number(x.participationScore) || 0), 0);
          const fase1Raw = fase1Presentation + fase1Participation; // máx 7 brutos
          // Fase 2: Grupos Mosaico (apresentação 0-5 + participação 0-2 + pares 0-5 = máx 12 brutos -> normaliza para 0-5 pts)
          const fase2Presentation = homeScores.reduce((s: number, x: any) => s + (Number(x.presentationScore) || 0), 0);
          const fase2Participation = homeScores.reduce((s: number, x: any) => s + (Number(x.participationScore) || 0), 0);
          const fase2PeerRating = homeScores.reduce((s: number, x: any) => s + (Number(x.peerRating) || 0), 0);
          const fase2Raw = fase2Presentation + fase2Participation + fase2PeerRating; // máx 12 brutos
          // Totais brutos (para exibição detalhada)
          const totalPresentation = fase1Presentation + fase2Presentation;
          const totalParticipation = fase1Participation + fase2Participation;
          const totalPeerRating = fase2PeerRating;
          // Normalização: F1 -> 0-2 pts, F2 -> 0-5 pts
          const fase1PF = fase1Raw > 0 ? Math.min(2, (fase1Raw / 7) * 2) : 0;
          const fase2PF = fase2Raw > 0 ? Math.min(5, (fase2Raw / 12) * 5) : 0;
          // Fase 3: Casos Clínicos (0-3 pts) - preservar valor existente, não recalcular
          const existingRecord = await db.select().from(jigsawScores).where(eq(jigsawScores.memberId, input.memberId)).limit(1);
          const fase3PF = existingRecord.length > 0 ? Math.min(3, Number(existingRecord[0].fase3PF) || 0) : 0;
          const totalJigsawPF = Math.min(10, fase1PF + fase2PF + fase3PF);

          // Update or create score record
          if (existingRecord.length > 0) {
            await db
              .update(jigsawScores)
              .set({
                totalPresentationScore: String(totalPresentation),
                totalParticipationScore: String(totalParticipation),
                totalPeerRating: String(totalPeerRating),
                fase1PF: String(fase1PF.toFixed(2)),
                fase2PF: String(fase2PF.toFixed(2)),
                fase3PF: String(fase3PF.toFixed(2)),
                totalJigsawPF: String(totalJigsawPF.toFixed(2)),
              })
              .where(eq(jigsawScores.memberId, input.memberId));
          } else {
            await db.insert(jigsawScores).values({
              classId: 0,
              memberId: input.memberId,
              totalPresentationScore: String(totalPresentation),
              totalParticipationScore: String(totalParticipation),
              totalPeerRating: String(totalPeerRating),
              fase1PF: String(fase1PF.toFixed(2)),
              fase2PF: String(fase2PF.toFixed(2)),
              fase3PF: String(fase3PF.toFixed(2)),
              totalJigsawPF: String(totalJigsawPF.toFixed(2)),
            });
          }

          return { success: true, totalJigsawPF, fase1PF, fase2PF, fase3PF };
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Erro ao calcular notas",
          });
        }
      }),

    /**
     * Generate Jigsaw report for a class
     */
    generateReport: adminProcedure
      .input(z.object({ classId: z.number() }))
      .query(async ({ input }) => {
        try {
          const db = await getDb();
          if (!db) throw new Error("Database not available");
          
          const scores = await db
            .select()
            .from(jigsawScores)
            .where(eq(jigsawScores.classId, input.classId));

          const report = {
            classId: input.classId,
            totalMembers: scores.length,
            averageJigsawPF:
              scores.length > 0
                ? scores.reduce((sum: number, s: any) => sum + (Number(s.totalJigsawPF) || 0), 0) /
                  scores.length
                : 0,
            topPerformers: scores
              .sort((a: any, b: any) => (Number(b.totalJigsawPF) || 0) - (Number(a.totalJigsawPF) || 0))
              .slice(0, 10)
              .map((s: any) => ({
                memberId: s.memberId,
                totalJigsawPF: s.totalJigsawPF,
              })),
            scores: scores,
          };

          return report;
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Erro ao gerar relatório",
          });
        }
      }),
  },
submitSelfAssessment: publicProcedure
  .input(z.object({
    studentSessionToken: z.string(),
    homeGroupId: z.number(),
    contribuicaoEspecifica: z.string().min(10, "Descreva sua contribuição com um pouco mais de detalhe"),
    explicouNoTempo: z.boolean(),
    topicosNaoEntendidos: z.string().optional(),
  }))
  .mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const student = await db
      .select()
      .from(studentAccounts)
      .where(and(eq(studentAccounts.sessionToken, input.studentSessionToken), eq(studentAccounts.isActive, 1)))
      .limit(1);
    if (!student.length || !student[0].memberId) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Token inválido" });
    }
    const memberId = student[0].memberId!;

    const membership = await db
      .select()
      .from(jigsawHomeMembers)
      .where(and(eq(jigsawHomeMembers.homeGroupId, input.homeGroupId), eq(jigsawHomeMembers.memberId, memberId)))
      .limit(1);
    if (!membership.length) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Você não pertence a este grupo-base" });
    }

    const existing = await db
      .select()
      .from(jigsawSelfAssessments)
      .where(and(eq(jigsawSelfAssessments.homeGroupId, input.homeGroupId), eq(jigsawSelfAssessments.memberId, memberId)))
      .limit(1);

    const valores = {
      contribuicaoEspecifica: input.contribuicaoEspecifica,
      explicouNoTempo: input.explicouNoTempo ? 1 : 0,
      topicosNaoEntendidos: input.topicosNaoEntendidos || null,
    };

    if (existing.length > 0) {
      await db.update(jigsawSelfAssessments).set(valores).where(eq(jigsawSelfAssessments.id, existing[0].id));
    } else {
      await db.insert(jigsawSelfAssessments).values({ homeGroupId: input.homeGroupId, memberId, ...valores });
    }

    return { success: true };
  }),

  /**
   * ========================================
   * NOTIFICATIONS - Notify all students about their Jigsaw groups
   * ========================================
   */
  notifyAllGroups: publicProcedure
    .input(z.object({ classId: z.number(), sessionToken: z.string().optional() }))
    .mutation(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        if (input.sessionToken) {
          const teacher = await getTeacherAccountBySessionToken(input.sessionToken);
          if (!teacher) throw new TRPCError({ code: "FORBIDDEN", message: "Token inválido" });
        }

        const groups = await db
          .select()
          .from(jigsawExpertGroups)
          .where(eq(jigsawExpertGroups.classId, input.classId));

        let totalNotified = 0;

        for (const group of groups) {
          const topicData = await db
            .select()
            .from(jigsawTopics)
            .where(eq(jigsawTopics.id, group.topicId))
            .limit(1);
          const topicName = topicData[0]?.name || "Tópico";

          const groupMembers = await db
            .select()
            .from(jigsawExpertMembers)
            .where(eq(jigsawExpertMembers.expertGroupId, group.id));

          for (const gm of groupMembers) {
            try {
              await createStudentNotification({
                memberId: gm.memberId,
                classId: input.classId,
                title: `🧩 Grupo Jigsaw: ${group.name}`,
                message: `Você foi alocado(a) no grupo "${group.name}" para o Seminário Jigsaw Fase 1. Seu tema de estudo é: ${topicName}. Prepare-se para se tornar especialista neste tema e ensinar seus colegas!`,
                type: "team_allocation",
                priority: "high",
                relatedEntityType: "jigsaw_group",
                relatedEntityId: group.id,
              });
              totalNotified++;
            } catch (notifErr) {
              console.warn("[JigsawNotif] Failed for member", gm.memberId, notifErr);
            }
          }
        }

        return { success: true, totalNotified };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erro ao enviar notificações",
        });
      }
    }),

  /**
   * ========================================
   * GENERATE HOME GROUPS (FASE 2 - MOSAICO)
   * ========================================
   */
  generateHomeGroups: publicProcedure
    .input(z.object({ classId: z.number(), sessionToken: z.string().optional() }))
    .mutation(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        if (input.sessionToken) {
          const teacher = await getTeacherAccountBySessionToken(input.sessionToken);
          if (!teacher) throw new TRPCError({ code: "FORBIDDEN", message: "Token inválido" });
        }

        const existingHomeGroups = await db
          .select()
          .from(jigsawHomeGroups)
          .where(eq(jigsawHomeGroups.classId, input.classId));

        // Check if existing groups have members; auto-clean empty groups
        if (existingHomeGroups.length > 0) {
          const groupsWithMembers = await Promise.all(
            existingHomeGroups.map(async (g) => {
              const members = await db
                .select()
                .from(jigsawHomeMembers)
                .where(eq(jigsawHomeMembers.homeGroupId, g.id));
              return { ...g, memberCount: members.length };
            })
          );
          const nonEmptyGroups = groupsWithMembers.filter((g) => g.memberCount > 0);
          const emptyGroups = groupsWithMembers.filter((g) => g.memberCount === 0);

          // Auto-delete empty groups
          if (emptyGroups.length > 0) {
            for (const eg of emptyGroups) {
              await db.delete(jigsawHomeGroups).where(eq(jigsawHomeGroups.id, eg.id));
            }
            console.log(`[Jigsaw] Auto-cleaned ${emptyGroups.length} empty home groups for class ${input.classId}`);
          }

          // Only block if there are non-empty groups
          if (nonEmptyGroups.length > 0) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Grupos mosaico já existem (${nonEmptyGroups.length} grupos com membros). Delete-os antes de gerar novamente.`,
            });
          }
        }

        const expertGroups = await db
          .select()
          .from(jigsawExpertGroups)
          .where(eq(jigsawExpertGroups.classId, input.classId));

        if (expertGroups.length === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Nenhum grupo especialista encontrado.",
          });
        }

        const expertGroupsWithMembers = await Promise.all(
          expertGroups.map(async (eg) => {
            const egMembers = await db
              .select()
              .from(jigsawExpertMembers)
              .where(eq(jigsawExpertMembers.expertGroupId, eg.id));
            const topicData = await db
              .select()
              .from(jigsawTopics)
              .where(eq(jigsawTopics.id, eg.topicId))
              .limit(1);
            return {
              ...eg,
              topicName: topicData[0]?.name || "Tópico",
              memberIds: egMembers.map((m) => m.memberId),
            };
          })
        );

        const maxGroupSize = Math.max(...expertGroupsWithMembers.map((g) => g.memberIds.length));

        // Shuffle each expert group's members independently
        const shuffledGroups = expertGroupsWithMembers.map((eg) => ({
          ...eg,
          shuffledMembers: [...eg.memberIds].sort(() => Math.random() - 0.5),
        }));

        const createdGroups: { id: number; name: string; memberCount: number }[] = [];

        for (let i = 0; i < maxGroupSize; i++) {
          const homeGroupName = `Grupo Mosaico ${i + 1}`;
          const result = await db.insert(jigsawHomeGroups).values({
            classId: input.classId,
            name: homeGroupName,
            description: `Grupo Mosaico ${i + 1} — Fase 2 Jigsaw (1 especialista de cada tema)`,
            meetingNumber: 1,
            status: "forming",
          });
          const homeGroupId = (result as any)[0]?.insertId ?? (result as any).insertId;

          let memberCount = 0;
          for (const eg of shuffledGroups) {
            const memberId = eg.shuffledMembers[i];
            if (memberId) {
              await db.insert(jigsawHomeMembers).values({
                homeGroupId,
                memberId,
                topicId: eg.topicId,
              });
              memberCount++;
            }
          }

          createdGroups.push({ id: homeGroupId, name: homeGroupName, memberCount });
        }

        return {
          success: true,
          totalHomeGroups: createdGroups.length,
          groups: createdGroups,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("[Jigsaw] Error generating home groups:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Erro ao gerar grupos mosaico: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }),

  /**
   * Delete all home groups for a class
   */
  deleteHomeGroups: publicProcedure
    .input(z.object({ classId: z.number(), sessionToken: z.string().optional() }))
    .mutation(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        if (input.sessionToken) {
          const teacher = await getTeacherAccountBySessionToken(input.sessionToken);
          if (!teacher) throw new TRPCError({ code: "FORBIDDEN", message: "Token inválido" });
        }

        const homeGroups = await db
          .select()
          .from(jigsawHomeGroups)
          .where(eq(jigsawHomeGroups.classId, input.classId));

        for (const hg of homeGroups) {
          await db
            .delete(jigsawHomeMembers)
            .where(eq(jigsawHomeMembers.homeGroupId, hg.id));
        }

        await db
          .delete(jigsawHomeGroups)
          .where(eq(jigsawHomeGroups.classId, input.classId));

        return { success: true, deleted: homeGroups.length };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erro ao deletar grupos mosaico",
        });
      }
    }),

  /**
   * ========================================
   * STUDENT: Get my Jigsaw groups (expert + home)
   * ========================================
   */
  getMyJigsawGroups: publicProcedure
    .input(z.object({ memberId: z.number(), classId: z.number() }))
    .query(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // Find expert group
        const expertMembership = await db
          .select()
          .from(jigsawExpertMembers)
          .where(eq(jigsawExpertMembers.memberId, input.memberId))
          .limit(1);

        let expertGroup = null;
        if (expertMembership.length > 0) {
          const eg = await db
            .select()
            .from(jigsawExpertGroups)
            .where(eq(jigsawExpertGroups.id, expertMembership[0].expertGroupId))
            .limit(1);
          if (eg.length > 0) {
            const topic = await db
              .select()
              .from(jigsawTopics)
              .where(eq(jigsawTopics.id, eg[0].topicId))
              .limit(1);
            const egMembers = await db
              .select()
              .from(jigsawExpertMembers)
              .where(eq(jigsawExpertMembers.expertGroupId, eg[0].id));
            const memberNames = await Promise.all(
              egMembers.map(async (m) => {
                const md = await db.select().from(members).where(eq(members.id, m.memberId)).limit(1);
                return md[0] ? { id: md[0].id, name: cleanName(md[0].name), role: m.role } : null;
              })
            );
            expertGroup = {
              ...eg[0],
              topicName: topic[0]?.name || "Tópico",
              topicDescription: topic[0]?.description || "",
              members: memberNames.filter(Boolean),
              myRole: expertMembership[0].role,
              myPresentationScore: expertMembership[0].presentationScore,
              myParticipationScore: expertMembership[0].participationScore,
            };
          }
        }

        // Find home group (mosaico)
        const homeMembership = await db
          .select()
          .from(jigsawHomeMembers)
             // Find home group (mosaico)
        const homeMembership = await db
          .select()
          .from(jigsawHomeMembers)
          .where(eq(jigsawHomeMembers.memberId, input.memberId))
          .limit(1);

        let homeGroup = null;
        if (homeMembership.length > 0) {
          const hg = await db
            .select()
            .from(jigsawHomeGroups)
            .where(eq(jigsawHomeGroups.id, homeMembership[0].homeGroupId))
            .limit(1);
          if (hg.length > 0) {
            const hgMembers = await db
              .select()
              .from(jigsawHomeMembers)
              .where(eq(jigsawHomeMembers.homeGroupId, hg[0].id));
            const memberDetails = await Promise.all(
  hgMembers.map(async (m) => {
    const md = await db.select().from(members).where(eq(members.id, m.memberId)).limit(1);
    const topicData = await db.select().from(jigsawTopics).where(eq(jigsawTopics.id, m.topicId)).limit(1);
    return md[0] ? {
      id: md[0].id,
      name: cleanName(md[0].name),
      topicName: topicData[0]?.name || "Tópico",
      // presentationScore/participationScore/peerRating REMOVIDOS da resposta ao aluno.
      // Ficam disponíveis só em endpoints autenticados como professor/monitor.
    } : null;
  })
);

homeGroup = {
  ...hg[0],
  members: memberDetails.filter(Boolean),
  myTopicName: (await db.select().from(jigsawTopics).where(eq(jigsawTopics.id, homeMembership[0].topicId)).limit(1))[0]?.name || "Tópico",
  // myPresentationScore / myParticipationScore / myPeerRating REMOVIDOS.
};


  /**
   * ========================================
   * ADMIN: Calculate total PF for all members in a class
   * ========================================
   */
  calculateAllTotals: publicProcedure
    .input(z.object({ classId: z.number(), sessionToken: z.string().optional() }))
    .mutation(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        if (input.sessionToken) {
          const teacher = await getTeacherAccountBySessionToken(input.sessionToken);
          if (!teacher) throw new TRPCError({ code: "FORBIDDEN", message: "Token inválido" });
        }

        const allMembers = await db
          .select({ id: members.id })
          .from(jigsawExpertMembers)
          .innerJoin(jigsawExpertGroups, eq(jigsawExpertMembers.expertGroupId, jigsawExpertGroups.id))
          .where(eq(jigsawExpertGroups.classId, input.classId));

        let updated = 0;
        for (const m of allMembers) {
          const expertScores = await db
            .select()
            .from(jigsawExpertMembers)
            .where(eq(jigsawExpertMembers.memberId, m.id));
          const homeScores = await db
            .select()
            .from(jigsawHomeMembers)
            .where(eq(jigsawHomeMembers.memberId, m.id));

          // === NORMALIZAÇÃO DAS NOTAS POR FASE ===
          // Fase 1: Grupos Especialistas (máx 7 brutos -> normaliza para 0-2 pts)
          const fase1Pres = expertScores.reduce((s: number, x: any) => s + (Number(x.presentationScore) || 0), 0);
          const fase1Part = expertScores.reduce((s: number, x: any) => s + (Number(x.participationScore) || 0), 0);
          const fase1Raw = fase1Pres + fase1Part;
          // Fase 2: Grupos Mosaico (máx 12 brutos -> normaliza para 0-5 pts)
          const fase2Pres = homeScores.reduce((s: number, x: any) => s + (Number(x.presentationScore) || 0), 0);
          const fase2Part = homeScores.reduce((s: number, x: any) => s + (Number(x.participationScore) || 0), 0);
          const fase2Peer = homeScores.reduce((s: number, x: any) => s + (Number(x.peerRating) || 0), 0);
          const fase2Raw = fase2Pres + fase2Part + fase2Peer;
          const totalPresentation = fase1Pres + fase2Pres;
          const totalParticipation = fase1Part + fase2Part;
          const totalPeerRating = fase2Peer;
          const fase1PF = fase1Raw > 0 ? Math.min(2, (fase1Raw / 7) * 2) : 0;
          const fase2PF = fase2Raw > 0 ? Math.min(5, (fase2Raw / 12) * 5) : 0;
          // Fase 3: preservar valor existente
          const existing = await db.select().from(jigsawScores).where(eq(jigsawScores.memberId, m.id)).limit(1);
          const fase3PF = existing.length > 0 ? Math.min(3, Number(existing[0].fase3PF) || 0) : 0;
          const totalJigsawPF = Math.min(10, fase1PF + fase2PF + fase3PF);

          if (existing.length > 0) {
            await db.update(jigsawScores).set({
              totalPresentationScore: String(totalPresentation),
              totalParticipationScore: String(totalParticipation),
              totalPeerRating: String(totalPeerRating),
              fase1PF: String(fase1PF.toFixed(2)),
              fase2PF: String(fase2PF.toFixed(2)),
              fase3PF: String(fase3PF.toFixed(2)),
              totalJigsawPF: String(totalJigsawPF.toFixed(2)),
            }).where(eq(jigsawScores.memberId, m.id));
          } else {
            await db.insert(jigsawScores).values({
              classId: input.classId,
              memberId: m.id,
              totalPresentationScore: String(totalPresentation),
              totalParticipationScore: String(totalParticipation),
              totalPeerRating: String(totalPeerRating),
              fase1PF: String(fase1PF.toFixed(2)),
              fase2PF: String(fase2PF.toFixed(2)),
              fase3PF: String(fase3PF.toFixed(2)),
              totalJigsawPF: String(totalJigsawPF.toFixed(2)),
            });
          }
          updated++;
        }

        return { success: true, updated };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erro ao calcular totais",
        });
      }
    }),

  /**
   * ========================================
   * PEER EVALUATION: Student submits rating for mosaic group colleague
   * ========================================
   */
  submitPeerEvaluation: publicProcedure
    .input(z.object({
      evaluatorToken: z.string(),
      evaluatedMemberId: z.number(),
      homeGroupId: z.number(),
      rating: z.number().min(0).max(5),
    }))
    .mutation(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // Validate evaluator token via studentAccounts
        const accountRows = await db
          .select()
          .from(studentAccounts)
          .where(and(eq(studentAccounts.sessionToken, input.evaluatorToken), eq(studentAccounts.isActive, 1)))
          .limit(1);

        if (!accountRows.length || !accountRows[0].memberId) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Token inválido ou conta sem membro vinculado" });
        }
        const evaluatorMemberId = accountRows[0].memberId!;

        // Check evaluator is in the home group
        const evaluatorMembership = await db
          .select()
          .from(jigsawHomeMembers)
          .where(and(
            eq(jigsawHomeMembers.homeGroupId, input.homeGroupId),
            eq(jigsawHomeMembers.memberId, evaluatorMemberId)
          ))
          .limit(1);

        if (!evaluatorMembership.length) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Você não pertence a este grupo mosaico" });
        }

        // Cannot evaluate yourself
        if (evaluatorMemberId === input.evaluatedMemberId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Você não pode se autoavaliar" });
        }

        // Check evaluated member is in the same home group
        const evaluatedMembership = await db
          .select()
          .from(jigsawHomeMembers)
          .where(and(
            eq(jigsawHomeMembers.homeGroupId, input.homeGroupId),
            eq(jigsawHomeMembers.memberId, input.evaluatedMemberId)
          ))
          .limit(1);

        if (!evaluatedMembership.length) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Aluno avaliado não pertence ao mesmo grupo mosaico" });
        }

        // Upsert peer evaluation
        const existing = await db
          .select()
          .from(jigsawPeerEvaluations)
          .where(and(
            eq(jigsawPeerEvaluations.homeGroupId, input.homeGroupId),
            eq(jigsawPeerEvaluations.evaluatorMemberId, evaluatorMemberId),
            eq(jigsawPeerEvaluations.evaluatedMemberId, input.evaluatedMemberId)
          ))
          .limit(1);

        if (existing.length > 0) {
          await db
            .update(jigsawPeerEvaluations)
            .set({ rating: String(input.rating) })
            .where(eq(jigsawPeerEvaluations.id, existing[0].id));
        } else {
          await db.insert(jigsawPeerEvaluations).values({
            homeGroupId: input.homeGroupId,
            evaluatorMemberId: evaluatorMemberId,
            evaluatedMemberId: input.evaluatedMemberId,
            rating: String(input.rating),
          });
        }

        // Recalculate average peer rating for the evaluated member in this home group
        const allRatings = await db
          .select()
          .from(jigsawPeerEvaluations)
          .where(and(
            eq(jigsawPeerEvaluations.homeGroupId, input.homeGroupId),
            eq(jigsawPeerEvaluations.evaluatedMemberId, input.evaluatedMemberId)
          ));

        const avgRating = allRatings.length > 0
          ? allRatings.reduce((s, r) => s + Number(r.rating), 0) / allRatings.length
          : 0;

        // Update peerRating in jigsawHomeMembers
        await db
          .update(jigsawHomeMembers)
          .set({ peerRating: String(avgRating.toFixed(1)) })
          .where(and(
            eq(jigsawHomeMembers.homeGroupId, input.homeGroupId),
            eq(jigsawHomeMembers.memberId, input.evaluatedMemberId)
          ));

        return { success: true, newAvgRating: avgRating };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("[PeerEval] Error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Erro ao salvar avaliação por pares: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }),
submitExpertChecklist: publicProcedure
  .input(z.object({
    evaluatorToken: z.string(),
    evaluatedMemberId: z.number(),
    expertGroupId: z.number(),
    chegouComLeitura: z.boolean(),
    contribuiuDiscussao: z.boolean(),
    ajudouResumo: z.boolean(),
  }))
  .mutation(async ({ input }) => {
    try {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const accountRows = await db
        .select()
        .from(studentAccounts)
        .where(and(eq(studentAccounts.sessionToken, input.evaluatorToken), eq(studentAccounts.isActive, 1)))
        .limit(1);
      if (!accountRows.length || !accountRows[0].memberId) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Token inválido ou conta sem membro vinculado" });
      }
      const evaluatorMemberId = accountRows[0].memberId!;

      // Verifica que avaliador pertence ao mesmo grupo especialista
      const evaluatorMembership = await db
        .select()
        .from(jigsawExpertMembers)
        .where(and(
          eq(jigsawExpertMembers.expertGroupId, input.expertGroupId),
          eq(jigsawExpertMembers.memberId, evaluatorMemberId)
        ))
        .limit(1);
      if (!evaluatorMembership.length) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Você não pertence a este grupo de especialistas" });
      }

      if (evaluatorMemberId === input.evaluatedMemberId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Você não pode se autoavaliar" });
      }

      const evaluatedMembership = await db
        .select()
        .from(jigsawExpertMembers)
        .where(and(
          eq(jigsawExpertMembers.expertGroupId, input.expertGroupId),
          eq(jigsawExpertMembers.memberId, input.evaluatedMemberId)
        ))
        .limit(1);
      if (!evaluatedMembership.length) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Aluno avaliado não pertence a este grupo" });
      }

      // Converte o checklist em nota (0-5) — MESMA lógica testada em teste_checklist.js
      const itens = [input.chegouComLeitura, input.contribuiuDiscussao, input.ajudouResumo];
      const positivos = itens.filter(Boolean).length;
      const notaCalculada = Math.round((positivos / itens.length) * 5 * 10) / 10;

      const existing = await db
        .select()
        .from(jigsawExpertPeerEvaluations)
        .where(and(
          eq(jigsawExpertPeerEvaluations.expertGroupId, input.expertGroupId),
          eq(jigsawExpertPeerEvaluations.evaluatorMemberId, evaluatorMemberId),
          eq(jigsawExpertPeerEvaluations.evaluatedMemberId, input.evaluatedMemberId)
        ))
        .limit(1);

      if (existing.length > 0) {
        await db.update(jigsawExpertPeerEvaluations)
          .set({
            chegouComLeitura: input.chegouComLeitura ? 1 : 0,
            contribuiuDiscussao: input.contribuiuDiscussao ? 1 : 0,
            ajudouResumo: input.ajudouResumo ? 1 : 0,
            rating: String(notaCalculada),
          })
          .where(eq(jigsawExpertPeerEvaluations.id, existing[0].id));
      } else {
        await db.insert(jigsawExpertPeerEvaluations).values({
          expertGroupId: input.expertGroupId,
          evaluatorMemberId,
          evaluatedMemberId: input.evaluatedMemberId,
          chegouComLeitura: input.chegouComLeitura ? 1 : 0,
          contribuiuDiscussao: input.contribuiuDiscussao ? 1 : 0,
          ajudouResumo: input.ajudouResumo ? 1 : 0,
          rating: String(notaCalculada),
        });
      }

      // Recalcula a média e grava em jigsawExpertMembers — REAPROVEITA o
      // campo participationScore (0-2) já existente, escalando de 0-5 para
      // 0-2, para não precisar alterar a fórmula de nota final (fase1Raw).
      const allRatings = await db
        .select()
        .from(jigsawExpertPeerEvaluations)
        .where(and(
          eq(jigsawExpertPeerEvaluations.expertGroupId, input.expertGroupId),
          eq(jigsawExpertPeerEvaluations.evaluatedMemberId, input.evaluatedMemberId)
        ));
      const media = allRatings.length > 0
        ? allRatings.reduce((s, r) => s + Number(r.rating), 0) / allRatings.length
        : 0;
      const participationEscalada = Math.round((media / 5) * 2 * 10) / 10; // 0-5 -> 0-2

      await db.update(jigsawExpertMembers)
        .set({ participationScore: String(participationEscalada) })
        .where(and(
          eq(jigsawExpertMembers.expertGroupId, input.expertGroupId),
          eq(jigsawExpertMembers.memberId, input.evaluatedMemberId)
        ));

      // IMPORTANTE: a resposta NÃO devolve a nota/média ao aluno — só confirma o envio.
      return { success: true };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Erro ao salvar checklist: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }),

  /**
   * Get peer evaluations submitted by a student (to show what they already rated)
   */
  getMyPeerEvaluations: publicProcedure
    .input(z.object({
      evaluatorToken: z.string(),
      homeGroupId: z.number(),
    }))
    .query(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const accountRows = await db
          .select()
          .from(studentAccounts)
          .where(and(eq(studentAccounts.sessionToken, input.evaluatorToken), eq(studentAccounts.isActive, 1)))
          .limit(1);

        if (!accountRows.length || !accountRows[0].memberId) return { evaluations: [] };
        const evaluatorMemberId = accountRows[0].memberId!;

        const evals = await db
          .select()
          .from(jigsawPeerEvaluations)
          .where(and(
            eq(jigsawPeerEvaluations.homeGroupId, input.homeGroupId),
            eq(jigsawPeerEvaluations.evaluatorMemberId, evaluatorMemberId)
          ));

        return {
          evaluations: evals.map(e => ({
            evaluatedMemberId: e.evaluatedMemberId,
            rating: Number(e.rating),
          }))
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erro ao buscar avaliações",
        });
      }
    }),

  /**
   * ADMIN: Get all peer evaluations for a class (for overview)
   */
  getAdminPeerEvaluations: adminProcedure
    .input(z.object({ classId: z.number() }))
    .query(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // Get all home groups for this class
        const homeGroups = await db
          .select()
          .from(jigsawHomeGroups)
          .where(eq(jigsawHomeGroups.classId, input.classId));

        const result = [];
        for (const hg of homeGroups) {
          const homeMembers = await db
            .select()
            .from(jigsawHomeMembers)
            .where(eq(jigsawHomeMembers.homeGroupId, hg.id));

          const memberDetails = await Promise.all(
            homeMembers.map(async (m) => {
              const md = await db.select().from(members).where(eq(members.id, m.memberId)).limit(1);
              const evals = await db
                .select()
                .from(jigsawPeerEvaluations)
                .where(and(
                  eq(jigsawPeerEvaluations.homeGroupId, hg.id),
                  eq(jigsawPeerEvaluations.evaluatedMemberId, m.memberId)
                ));
              return {
                memberId: m.memberId,
                name: md[0] ? cleanName(md[0].name) : "Desconhecido",
                avgPeerRating: Number(m.peerRating) || 0,
                evalCount: evals.length,
              };
            })
          );

          result.push({
            homeGroupId: hg.id,
            homeGroupName: hg.name,
            members: memberDetails,
          });
        }

        return result;
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erro ao buscar avaliações por pares",
        });
      }
    }),

  /**
   * ========================================
   * ADMIN: Set Fase 3 (Casos Clínicos) score for a member (0-3 pts)
   * ========================================
   */
  setFase3PF: publicProcedure
    .input(z.object({
      memberId: z.number(),
      classId: z.number(),
      fase3PF: z.number().min(0).max(3),
      sessionToken: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        if (input.sessionToken) {
          const teacher = await getTeacherAccountBySessionToken(input.sessionToken);
          if (!teacher) throw new TRPCError({ code: "FORBIDDEN", message: "Token inválido" });
        }
        const existing = await db.select().from(jigsawScores).where(eq(jigsawScores.memberId, input.memberId)).limit(1);
        const fase3PF = Math.min(3, Math.max(0, input.fase3PF));
        // Recalculate total with new fase3
        const fase1PF = existing.length > 0 ? Number(existing[0].fase1PF) || 0 : 0;
        const fase2PF = existing.length > 0 ? Number(existing[0].fase2PF) || 0 : 0;
        const totalJigsawPF = Math.min(10, fase1PF + fase2PF + fase3PF);
        if (existing.length > 0) {
          await db.update(jigsawScores).set({
            fase3PF: String(fase3PF.toFixed(2)),
            totalJigsawPF: String(totalJigsawPF.toFixed(2)),
          }).where(eq(jigsawScores.memberId, input.memberId));
        } else {
          await db.insert(jigsawScores).values({
            classId: input.classId,
            memberId: input.memberId,
            totalPresentationScore: "0",
            totalParticipationScore: "0",
            totalPeerRating: "0",
            fase1PF: "0",
            fase2PF: "0",
            fase3PF: String(fase3PF.toFixed(2)),
            totalJigsawPF: String(fase3PF.toFixed(2)),
          });
        }
        return { success: true, fase3PF, totalJigsawPF };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erro ao lançar nota da Fase 3",
        });
      }
    }),

  /**
   * ADMIN: Set Fase 3 for all members in a class at once
   */
  setFase3PFBulk: publicProcedure
    .input(z.object({
      classId: z.number(),
      scores: z.array(z.object({ memberId: z.number(), fase3PF: z.number().min(0).max(3) })),
      sessionToken: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        if (input.sessionToken) {
          const teacher = await getTeacherAccountBySessionToken(input.sessionToken);
          if (!teacher) throw new TRPCError({ code: "FORBIDDEN", message: "Token inválido" });
        }
        let updated = 0;
        for (const s of input.scores) {
          const fase3PF = Math.min(3, Math.max(0, s.fase3PF));
          const existing = await db.select().from(jigsawScores).where(eq(jigsawScores.memberId, s.memberId)).limit(1);
          const fase1PF = existing.length > 0 ? Number(existing[0].fase1PF) || 0 : 0;
          const fase2PF = existing.length > 0 ? Number(existing[0].fase2PF) || 0 : 0;
          const totalJigsawPF = Math.min(10, fase1PF + fase2PF + fase3PF);
          if (existing.length > 0) {
            await db.update(jigsawScores).set({
              fase3PF: String(fase3PF.toFixed(2)),
              totalJigsawPF: String(totalJigsawPF.toFixed(2)),
            }).where(eq(jigsawScores.memberId, s.memberId));
          } else {
            await db.insert(jigsawScores).values({
              classId: input.classId,
              memberId: s.memberId,
              totalPresentationScore: "0",
              totalParticipationScore: "0",
              totalPeerRating: "0",
              fase1PF: "0",
              fase2PF: "0",
              fase3PF: String(fase3PF.toFixed(2)),
              totalJigsawPF: String(fase3PF.toFixed(2)),
            });
          }
          updated++;
        }
        return { success: true, updated };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erro ao lançar notas da Fase 3",
        });
      }
    }),
});
