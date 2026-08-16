import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb, getRawDb, getMembersByClass, createStudentNotification } from "../db";
import {
  gameProgress, gameQuests, gameCombats, gameAchievements,
  members, gameTransactions, gameWeeklyReleases, playerAvatars,
  gameErrorReports, questionBank, classes, bossBattles, scheduleEntries
} from "../../drizzle/schema";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { QUEST_EXTRA_QUESTIONS } from "../../shared/questExtraQuestions";
import { ALL_GAME_QUESTIONS } from "../../shared/gameQuestions";

// ─── Helper: título real da semana, vindo do cronograma da turma ───
// Busca em scheduleEntries (classId + gameWeekNumber) o título verdadeiro
// daquela semana para aquela turma específica. Antes disso, cada rota tinha
// sua própria lista de títulos genéricos fixa no código (e as duas listas
// nem batiam entre si) — agora as duas leem daqui, e cada turma pode ter seu
// próprio cronograma/tema por semana.
async function getScheduleWeekTitle(db: any, classId: number, weekNumber: number): Promise<string | null> {
  try {
    const rows = await db
      .select({ title: scheduleEntries.title })
      .from(scheduleEntries)
      .where(
        and(
          eq(scheduleEntries.classId, classId),
          eq(scheduleEntries.gameWeekNumber, weekNumber),
          eq(scheduleEntries.isActive, true)
        )
      )
      .limit(1);
    return rows[0]?.title ?? null;
  } catch (e) {
    console.warn("[getScheduleWeekTitle] erro ao buscar título do cronograma:", e);
    return null;
  }
}


// ─── Helper: find memberId from user openId ───
async function findMemberId(db: any, userId: number): Promise<number | null> {
  // The game uses members table, not users table
  // Try to find a member linked to this user
  const memberRows = await db
    .select({ id: members.id })
    .from(members)
    .where(eq(members.id, userId))
    .limit(1);
  return memberRows[0]?.id ?? null;
}

// ─── Built-in 85 quests data (17 weeks × 5 questions) ───
// Convert GameQuestion format to the legacy BUILTIN_QUESTS format for compatibility
const BUILTIN_QUESTS = ALL_GAME_QUESTIONS.map(gq => ({
  id: gq.id,
  order: gq.id,
  level: Math.ceil(gq.weekNumber / 2),
  weekNumber: gq.weekNumber,
  questionInWeek: gq.questionInWeek,
  isBossQuestion: gq.isBossQuestion,
  title: gq.title,
  description: gq.description,
  npcName: gq.npcName,
  npcType: gq.npcType as "warrior" | "mage" | "healer" | "boss",
  questType: gq.isBossQuestion ? "combat" as const : (gq.questionInWeek <= 2 ? "puzzle" as const : "combat" as const),
  difficulty: gq.difficulty,
  farmacologiaPointsReward: gq.pfReward,
  pfPenalty: gq.pfPenalty,
  experienceReward: gq.pfReward * 10,
  alternatives: gq.alternatives,
  explanation: gq.explanation,
}));


// ─── Achievement definitions ───
const ACHIEVEMENT_DEFS = [
  { id: "first_quest", title: "Primeiro Passo", description: "Complete sua primeira missão", icon: "🎯", condition: "quests_completed >= 1", bonus: 10 },
  { id: "five_quests", title: "Aventureiro", description: "Complete 5 missões", icon: "⚔️", condition: "quests_completed >= 5", bonus: 25 },
  { id: "ten_quests", title: "Herói", description: "Complete 10 missões", icon: "🦸", condition: "quests_completed >= 10", bonus: 50 },
  { id: "all_quests", title: "Mestre de Farmacologia I", description: "Complete todas as 16 missões", icon: "👑", condition: "quests_completed >= 16", bonus: 100 },
  { id: "perfect_streak_3", title: "Sequência Perfeita", description: "Acerte 3 questões seguidas", icon: "🔥", condition: "win_streak >= 3", bonus: 15 },
  { id: "perfect_streak_5", title: "Imparável", description: "Acerte 5 questões seguidas", icon: "💥", condition: "win_streak >= 5", bonus: 30 },
  { id: "speed_demon", title: "Velocista", description: "Complete uma missão em menos de 15 segundos", icon: "⚡", condition: "time_under_15", bonus: 20 },
  { id: "pf_100", title: "Coletor de PF", description: "Acumule 100 PF", icon: "💎", condition: "pf >= 100", bonus: 10 },
  { id: "pf_500", title: "Mestre dos PF", description: "Acumule 500 PF", icon: "💰", condition: "pf >= 500", bonus: 25 },
  { id: "pf_1000", title: "Lenda dos PF", description: "Acumule 1000 PF", icon: "🏆", condition: "pf >= 1000", bonus: 50 },
  { id: "farmacocinetica", title: "Mestre da Farmacocinética", description: "Complete missões 1 e 2", icon: "🧪", condition: "quests_1_2", bonus: 20 },
  { id: "farmacodinamica", title: "Mestre da Farmacodinâmica", description: "Complete missões 3 e 4", icon: "🎯", condition: "quests_3_4", bonus: 20 },
  { id: "sna_master", title: "Mestre do SNA", description: "Complete missões 7 e 8", icon: "🧠", condition: "quests_7_8", bonus: 30 },
  { id: "boss_slayer", title: "Caçador de Chefes", description: "Derrote Venger e Tiamat", icon: "🐉", condition: "bosses_defeated", bonus: 50 },
];

export const gameRouter = router({
  // ═══════════════════════════════════════
  // PLAYER ROUTES
  // ═══════════════════════════════════════

  /**
   * Get available quests for the player (respects weekly releases)
   */
  getAvailableQuests: publicProcedure
    .input(z.object({ classId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return BUILTIN_QUESTS.filter(q => q.weekNumber <= 1); // Default: only week 1

      // Check weekly releases for this class
      const releases = await db
        .select()
        .from(gameWeeklyReleases)
        .where(
          and(
            eq(gameWeeklyReleases.classId, input.classId),
            eq(gameWeeklyReleases.isReleased, true)
          )
        );

      if (releases.length === 0) {
        // No releases configured - return week 1 by default
        return BUILTIN_QUESTS.filter(q => q.weekNumber <= 1);
      }

      // Get released week numbers
      const releasedWeeks = releases.map(r => r.weekNumber);
      return BUILTIN_QUESTS.filter(q => releasedWeeks.includes(q.weekNumber));
    }),

  /**
   * Get a specific quest by ID
   */
  getQuestById: publicProcedure
    .input(z.object({ questId: z.number() }))
    .query(async ({ input }) => {
      const quest = BUILTIN_QUESTS.find(q => q.id === input.questId);
      if (!quest) throw new Error("Quest not found");
      return quest;
    }),

  /**
   * Get a random question for a quest (from pool of original + extra questions)
   * Returns the question text and alternatives for the frontend to display
   */
  getQuestQuestion: publicProcedure
    .input(z.object({ questId: z.number() }))
    .query(({ input }) => {
      const quest = BUILTIN_QUESTS.find(q => q.id === input.questId);
      if (!quest) throw new Error("Quest not found");
      // Build question pool: original question + extras
      const originalQuestion = {
        description: quest.description,
        alternatives: quest.alternatives,
        explanation: quest.explanation,
      };
      const extras = QUEST_EXTRA_QUESTIONS[input.questId] || [];
      const pool = [originalQuestion, ...extras];
      // Pick a random question from the pool
      const idx = Math.floor(Math.random() * pool.length);
      const selected = pool[idx];
      return {
        questId: input.questId,
        questionIndex: idx,
        totalQuestions: pool.length,
        description: selected.description,
        alternatives: selected.alternatives,
        explanation: selected.explanation,
      };
    }),
  /**
   * Get all questions for a week in review mode (no PF awarded)
   */
  getWeekReviewQuestions: publicProcedure
    .input(z.object({ weekNumber: z.number() }))
    .query(({ input }) => {
      const weekQuests = BUILTIN_QUESTS.filter(q => q.weekNumber === input.weekNumber);
      return weekQuests.map(quest => {
        const extras = QUEST_EXTRA_QUESTIONS[quest.id] || [];
        const pool = [
          { description: quest.description, alternatives: quest.alternatives, explanation: quest.explanation },
          ...extras,
        ];
        return {
          questId: quest.id,
          questTitle: quest.title,
          isBossQuest: quest.isBossQuestion || false,
          difficulty: quest.difficulty,
          questions: pool,
        };
      });
    }),
  /**
   * Get player's game progress (works with memberId directly)
   */
  getProgress: publicProcedure
    .input(z.object({
      classId: z.number(),
      memberId: z.number().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      const memberId = input.memberId;
      if (!memberId) return null;

      const progress = await db
        .select()
        .from(gameProgress)
        .where(
          and(
            eq(gameProgress.memberId, memberId),
            eq(gameProgress.classId, input.classId)
          )
        )
        .limit(1);

      if (!progress[0]) return null;

      // Also fetch characterId from playerAvatars
      const avatarRows = await db
        .select({ characterId: playerAvatars.characterId })
        .from(playerAvatars)
        .where(eq(playerAvatars.memberId, memberId))
        .limit(1);
      const characterId = avatarRows[0]?.characterId || null;

      return { ...progress[0], characterId };
    }),

  /**
   * Initialize game progress for a student
   */
  initializeProgress: publicProcedure
    .input(z.object({
      classId: z.number(),
      memberId: z.number(),
      characterId: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // Check if already exists
      const existing = await db
        .select()
        .from(gameProgress)
        .where(
          and(
            eq(gameProgress.memberId, input.memberId),
            eq(gameProgress.classId, input.classId)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        return existing[0];
      }

      // Validate that memberId exists in members table before inserting
      const rawDb = await getRawDb();
      if (!rawDb) throw new Error("Database unavailable");
      const [memberCheck] = await rawDb.execute(
        `SELECT id FROM \`members\` WHERE id = ? LIMIT 1`,
        [input.memberId]
      ) as any[];
      if (!memberCheck || memberCheck.length === 0) {
        throw new Error(`Aluno não encontrado (memberId=${input.memberId}). A conta não está vinculada a um aluno matriculado. Acesse o portal do aluno e vincule sua conta.`);
      }
      // Create new progress using raw SQL to avoid Drizzle ORM serialization issues
      // with boolean and JSON fields on MySQL
      await rawDb.execute(
        `INSERT INTO \`gameProgress\` (\`memberId\`, \`classId\`, \`level\`, \`farmacologiaPoints\`, \`experience\`, \`questsCompleted\`, \`questsTotal\`, \`currentQuestId\`, \`totalCombats\`, \`combatsWon\`, \`combatsLost\`, \`achievements\`, \`isCompleted\`, \`lastPlayedAt\`) VALUES (?, ?, 1, 0, 0, 0, 16, NULL, 0, 0, 0, '[]', 0, NULL)`,
        [input.memberId, input.classId]
      );

      // Save avatar choice
      if (input.characterId) {
        await db.insert(playerAvatars).values({
          memberId: input.memberId,
          characterId: input.characterId,
        });
      }

      const inserted = await db
        .select()
        .from(gameProgress)
        .where(
          and(
            eq(gameProgress.memberId, input.memberId),
            eq(gameProgress.classId, input.classId)
          )
        )
        .limit(1);

      return inserted[0];
    }),

  /**
   * Submit answer to a quest
   */
  submitAnswer: publicProcedure
    .input(z.object({
      questId: z.number(),
      classId: z.number(),
      memberId: z.number(),
      answer: z.string(), // alternative id: "a", "b", "c", "d"
      timeSpent: z.number(),
      questionIndex: z.number().optional(), // index into question pool (0 = original)
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // Find the quest from built-in data
      const quest = BUILTIN_QUESTS.find(q => q.id === input.questId);
      if (!quest) throw new Error("Quest not found");

      // Determine which question was shown (original or extra)
      const extras = QUEST_EXTRA_QUESTIONS[input.questId] || [];
      const originalQ = { alternatives: quest.alternatives, explanation: quest.explanation };
      const pool = [originalQ, ...extras];
      const qIdx = input.questionIndex ?? 0;
      const activeQuestion = pool[qIdx] || originalQ;

      // Check answer against the active question's alternatives
      const correctAlt = activeQuestion.alternatives.find(a => a.isCorrect);
      const isCorrect = input.answer === correctAlt?.id;
      const pfEarned = isCorrect ? quest.farmacologiaPointsReward : 0;
      const xpEarned = isCorrect ? quest.experienceReward : 0;
      // Boss penalty: if wrong answer on boss question, deduct pfPenalty
      const pfPenalty = (!isCorrect && quest.isBossQuestion && quest.pfPenalty) ? quest.pfPenalty : 0;

      // Get progress
      const progressRows = await db
        .select()
        .from(gameProgress)
        .where(
          and(
            eq(gameProgress.memberId, input.memberId),
            eq(gameProgress.classId, input.classId)
          )
        )
        .limit(1);

      if (!progressRows[0]) throw new Error("Game progress not found");
      const prog = progressRows[0];

      // Update progress
      const updates: any = {
        totalCombats: prog.totalCombats + 1,
        lastPlayedAt: new Date(),
      };

      if (isCorrect) {
        updates.farmacologiaPoints = prog.farmacologiaPoints + pfEarned;
        updates.experience = prog.experience + xpEarned;
        updates.questsCompleted = prog.questsCompleted + 1;
        updates.combatsWon = prog.combatsWon + 1;

        // Level up logic: every 5 quests = 1 level (max 17)
        const newQuestsCompleted = prog.questsCompleted + 1;
        const newLevel = Math.min(Math.ceil(newQuestsCompleted / 5) + 1, 17);
        if (newLevel > prog.level) {
          updates.level = newLevel;
        }

        // Check if game complete (85 quests total)
        if (newQuestsCompleted >= 85) {
          updates.isCompleted = sql`1`; // MySQL boolean: use 1 instead of true
        }
      } else {
        updates.combatsLost = prog.combatsLost + 1;
        // Apply boss penalty if wrong on boss question
        if (pfPenalty > 0) {
          const currentPF = prog.farmacologiaPoints || 0;
          updates.farmacologiaPoints = Math.max(0, currentPF - pfPenalty);
        }
      }

      await db
        .update(gameProgress)
        .set(updates)
        .where(eq(gameProgress.id, prog.id));

      // Record combat in gameCombats (needed for boss unlock check)
      try {
        // Count previous attempts for this quest
        const prevAttempts = await db
          .select({ count: sql<number>`count(*)` })
          .from(gameCombats)
          .where(
            and(
              eq(gameCombats.gameProgressId, prog.id),
              eq(gameCombats.questId, input.questId)
            )
          );
        const attemptNum = Number(prevAttempts[0]?.count || 0) + 1;

        await db.insert(gameCombats).values({
          gameProgressId: prog.id,
          questId: input.questId,
          questionId: input.questId,
          playerAnswer: input.answer,
          correctAnswer: correctAlt?.id || "",
          isWon: isCorrect,
          farmacologiaPointsEarned: pfEarned,
          timeSpent: input.timeSpent,
          attemptNumber: attemptNum,
        });
      } catch (combatErr) {
        console.warn("[Game] Failed to insert gameCombat:", combatErr);
      }

      // Log transaction if PF earned or penalized
      if (pfEarned > 0 || pfPenalty > 0) {
        const netPF = pfEarned - pfPenalty;
        await db.insert(gameTransactions).values({
          memberId: input.memberId,
          classId: input.classId,
          pfAmount: netPF,
          transactionType: pfEarned > 0 ? "quest_complete" : "boss_penalty",
          missionId: input.questId,
          description: pfEarned > 0
            ? `Missão "${quest.title}": +${pfEarned} PF`
            : `Chefe "${quest.npcName}" venceu: -${pfPenalty} PF`,
        });

        // Sync with main leaderboard
        const member = await db
          .select()
          .from(members)
          .where(eq(members.id, input.memberId))
          .limit(1);

        if (member[0]) {
          const currentXP = parseFloat(member[0].xp) || 0;
          const newXP = Math.max(0, currentXP + pfEarned - pfPenalty);
          await db
            .update(members)
            .set({ xp: String(newXP) })
            .where(eq(members.id, input.memberId));
        }
      }

      // Check achievements
      const newAchievements: string[] = [];
      const currentAchievements: string[] = JSON.parse(prog.achievements || "[]");
      const newQC = (prog.questsCompleted || 0) + (isCorrect ? 1 : 0);
      const newPF = (prog.farmacologiaPoints || 0) + pfEarned;

      for (const ach of ACHIEVEMENT_DEFS) {
        if (currentAchievements.includes(ach.id)) continue;
        let earned = false;
        if (ach.id === "first_quest" && newQC >= 1) earned = true;
        if (ach.id === "five_quests" && newQC >= 5) earned = true;
        if (ach.id === "ten_quests" && newQC >= 10) earned = true;
        if (ach.id === "all_quests" && newQC >= 16) earned = true;
        if (ach.id === "pf_100" && newPF >= 100) earned = true;
        if (ach.id === "pf_500" && newPF >= 500) earned = true;
        if (ach.id === "pf_1000" && newPF >= 1000) earned = true;
        if (ach.id === "speed_demon" && isCorrect && input.timeSpent < 15) earned = true;
        if (earned) newAchievements.push(ach.id);
      }

      if (newAchievements.length > 0) {
        const allAchievements = [...currentAchievements, ...newAchievements];
        const achievementsStr = JSON.stringify(allAchievements);
        await db
          .update(gameProgress)
          .set({ achievements: sql`${achievementsStr}` })
          .where(eq(gameProgress.id, prog.id));

        // Award bonus PF for achievements
        const bonusPF = newAchievements.reduce((sum, achId) => {
          const ach = ACHIEVEMENT_DEFS.find(a => a.id === achId);
          return sum + (ach?.bonus || 0);
        }, 0);

        if (bonusPF > 0) {
          await db
            .update(gameProgress)
            .set({ farmacologiaPoints: sql`${gameProgress.farmacologiaPoints} + ${bonusPF}` })
            .where(eq(gameProgress.id, prog.id));
        }
      }

      return {
        isCorrect,
        canAdvance: isCorrect, // Only advance to next question when correct
        correctAnswer: correctAlt?.id || "",
        correctAnswerText: correctAlt?.text || "",
        explanation: activeQuestion.explanation || quest.explanation,
        pfEarned,
        pfPenalty,
        xpEarned,
        isBossQuestion: quest.isBossQuestion || false,
        newAchievements: newAchievements.map(id => ACHIEVEMENT_DEFS.find(a => a.id === id)!),
        message: isCorrect
          ? (quest.isBossQuestion ? `Chefe derrotado! +${pfEarned} PF!` : `Correto! +${pfEarned} PF`)
          : (quest.isBossQuestion ? `O chefe venceu! -${pfPenalty} PF` : `Resposta incorreta. Tente novamente!`),
      };
    }),

  /**
   * Get completed quest IDs for a player
   */
  getCompletedQuests: publicProcedure
    .input(z.object({ classId: z.number(), memberId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const combats = await db
        .select({ questId: gameCombats.questId })
        .from(gameCombats)
        .innerJoin(gameProgress, eq(gameCombats.gameProgressId, gameProgress.id))
        .where(
          and(
            eq(gameProgress.memberId, input.memberId),
            eq(gameProgress.classId, input.classId),
            eq(gameCombats.isWon, true)
          )
        );

      return Array.from(new Set(combats.map(c => c.questId)));
    }),

  /**
   * Get all achievements definitions
   */
  getAchievements: publicProcedure.query(() => {
    return ACHIEVEMENT_DEFS;
  }),

  /**
   * Get player avatar
   */
  getAvatar: publicProcedure
    .input(z.object({ memberId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      const rows = await db
        .select()
        .from(playerAvatars)
        .where(eq(playerAvatars.memberId, input.memberId))
        .limit(1);

      return rows[0] || null;
    }),

  /**
   * Save/update custom avatar
   */
  saveAvatar: publicProcedure
    .input(z.object({
      memberId: z.number(),
      characterId: z.string(),
      skinTone: z.string().optional(),
      hairStyle: z.string().optional(),
      hairColor: z.string().optional(),
      clothingColor: z.string().optional(),
      accessory: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const existing = await db
        .select()
        .from(playerAvatars)
        .where(eq(playerAvatars.memberId, input.memberId))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(playerAvatars)
          .set({
            characterId: input.characterId,
            skinTone: input.skinTone || null,
            hairStyle: input.hairStyle || null,
            hairColor: input.hairColor || null,
            clothingColor: input.clothingColor || null,
            accessory: input.accessory || null,
          })
          .where(eq(playerAvatars.memberId, input.memberId));
      } else {
        await db.insert(playerAvatars).values({
          memberId: input.memberId,
          characterId: input.characterId,
          skinTone: input.skinTone || null,
          hairStyle: input.hairStyle || null,
          hairColor: input.hairColor || null,
          clothingColor: input.clothingColor || null,
          accessory: input.accessory || null,
        });
      }

      return { success: true };
    }),

  /**
   * Report error/doubt about a question
   */
  reportError: publicProcedure
    .input(z.object({
      memberId: z.number(),
      classId: z.number(),
      questId: z.number().optional(),
      reportType: z.enum(["error", "doubt", "suggestion"]),
      description: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      await db.insert(gameErrorReports).values({
        memberId: input.memberId,
        classId: input.classId,
        questId: input.questId || null,
        reportType: input.reportType,
        description: input.description,
      });

      return { success: true, message: "Relatório enviado com sucesso!" };
    }),

  // ═══════════════════════════════════════
  // RANKING / LEADERBOARD
  // ═══════════════════════════════════════

  /**
   * Get game leaderboard (top players)
   */
  getLeaderboard: publicProcedure
    .input(z.object({
      classId: z.number(),
      limit: z.number().default(10),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const rows = await db
        .select({
          memberId: gameProgress.memberId,
          memberName: members.name,
          level: gameProgress.level,
          farmacologiaPoints: gameProgress.farmacologiaPoints,
          questsCompleted: gameProgress.questsCompleted,
          combatsWon: gameProgress.combatsWon,
          totalCombats: gameProgress.totalCombats,
          isCompleted: gameProgress.isCompleted,
          achievements: gameProgress.achievements,
        })
        .from(gameProgress)
        .innerJoin(members, eq(gameProgress.memberId, members.id))
        .where(eq(gameProgress.classId, input.classId))
        .orderBy(desc(gameProgress.farmacologiaPoints))
        .limit(input.limit);

      return rows;
    }),

  // ═══════════════════════════════════════
  // TEACHER / ADMIN ROUTES
  // ═══════════════════════════════════════

  /**
   * Get weekly release schedule for a class
   */
  getWeeklyReleases: publicProcedure
    .input(z.object({ classId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const releases = await db
        .select()
        .from(gameWeeklyReleases)
        .where(eq(gameWeeklyReleases.classId, input.classId))
        .orderBy(gameWeeklyReleases.weekNumber);

      return releases;
    }),

  /**
   * Release quests for a specific week (teacher action)
   */
  releaseWeek: publicProcedure
    .input(z.object({
      classId: z.number(),
      weekNumber: z.number(),
      teacherId: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // Get quest IDs for this week
      const questIds = BUILTIN_QUESTS
        .filter(q => q.weekNumber === input.weekNumber)
        .map(q => q.id);

      // Check if release already exists
      const existing = await db
        .select()
        .from(gameWeeklyReleases)
        .where(
          and(
            eq(gameWeeklyReleases.classId, input.classId),
            eq(gameWeeklyReleases.weekNumber, input.weekNumber)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        // Update existing
        await db
          .update(gameWeeklyReleases)
          .set({
            isReleased: true,
            releasedAt: new Date(),
            releasedBy: input.teacherId || null,
            questIds: JSON.stringify(questIds),
          })
          .where(eq(gameWeeklyReleases.id, existing[0].id));
      } else {
        // Create new
        const scheduleTitle = await getScheduleWeekTitle(db, input.classId, input.weekNumber);

        await db.insert(gameWeeklyReleases).values({
          classId: input.classId,
          weekNumber: input.weekNumber,
          questIds: JSON.stringify(questIds),
          title: scheduleTitle
            ? `Semana ${input.weekNumber} - ${scheduleTitle}`
            : `Semana ${input.weekNumber} - Desafios`,
          isReleased: true,
          releasedAt: new Date(),
          releasedBy: input.teacherId || null,
        });
      }

      return { success: true, questIds, message: `Semana ${input.weekNumber} liberada com ${questIds.length} missões!` };
    }),

  /**
   * Lock a week (undo release)
   */
  lockWeek: publicProcedure
    .input(z.object({
      classId: z.number(),
      weekNumber: z.number(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      await db
        .update(gameWeeklyReleases)
        .set({ isReleased: false })
        .where(
          and(
            eq(gameWeeklyReleases.classId, input.classId),
            eq(gameWeeklyReleases.weekNumber, input.weekNumber)
          )
        );
      return { success: true };
    }),
  /**
   * Schedule a week to be auto-released on a specific date
   */
  scheduleWeekRelease: publicProcedure
    .input(z.object({
      classId: z.number(),
      weekNumber: z.number(),
      scheduledDate: z.string(), // ISO date string
      teacherId: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const scheduledDate = new Date(input.scheduledDate);
      const scheduleTitle = await getScheduleWeekTitle(db, input.classId, input.weekNumber);
      const questIds = BUILTIN_QUESTS.filter(q => q.weekNumber === input.weekNumber).map(q => q.id);
      const existing = await db.select().from(gameWeeklyReleases)
        .where(and(eq(gameWeeklyReleases.classId, input.classId), eq(gameWeeklyReleases.weekNumber, input.weekNumber)))
        .limit(1);
      if (existing.length > 0) {
        await db.update(gameWeeklyReleases)
          .set({ scheduledReleaseDate: scheduledDate })
          .where(eq(gameWeeklyReleases.id, existing[0].id));
      } else {
        await db.insert(gameWeeklyReleases).values({
          classId: input.classId, weekNumber: input.weekNumber,
          questIds: JSON.stringify(questIds),
          title: scheduleTitle
            ? `Semana ${input.weekNumber} - ${scheduleTitle}`
            : `Semana ${input.weekNumber} - Desafios`,
          isReleased: false, scheduledReleaseDate: scheduledDate,
          releasedBy: input.teacherId || null,
        });
      }
      return { success: true, scheduledDate: scheduledDate.toISOString() };
    }),
  /**
   * Check and auto-release scheduled weeks that are past their scheduled date
   */
  checkScheduledReleases: publicProcedure
    .input(z.object({ classId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { released: [] };
      const now = new Date();
      const pending = await db.select().from(gameWeeklyReleases)
        .where(eq(gameWeeklyReleases.classId, input.classId));
      const released: number[] = [];
      for (const entry of pending) {
        if (!entry.isReleased && entry.scheduledReleaseDate && entry.scheduledReleaseDate <= now) {
          await db.update(gameWeeklyReleases)
            .set({ isReleased: true, releasedAt: now })
            .where(eq(gameWeeklyReleases.id, entry.id));
          released.push(entry.weekNumber);
          // Send push notification to all students in the class
          try {
            const classMembers = await getMembersByClass(input.classId);
            const weekTitle = entry.title || `Semana ${entry.weekNumber}`;
            await Promise.all(classMembers.map(member =>
              createStudentNotification({
                memberId: member.id,
                classId: input.classId,
                title: `\uD83C\uDFAE Nova semana liberada: ${weekTitle}`,
                message: `A ${weekTitle} do jogo Conex\u00e3o em Farmacologia est\u00e1 dispon\u00edvel! Acesse agora para ganhar PF e subir no ranking.`,
                type: "announcement",
                priority: "high",
              })
            ));
          } catch (e) {
            console.warn('[checkScheduledReleases] Failed to send notifications:', e);
          }
        }
      }
      return { released };
    }),
  /**
   * Get all students' game progress for a class (teacher view)
   */
  getAllProgress: publicProcedure
    .input(z.object({ classId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const rows = await db
        .select({
          id: gameProgress.id,
          memberId: gameProgress.memberId,
          memberName: members.name,
          level: gameProgress.level,
          farmacologiaPoints: gameProgress.farmacologiaPoints,
          experience: gameProgress.experience,
          questsCompleted: gameProgress.questsCompleted,
          questsTotal: gameProgress.questsTotal,
          combatsWon: gameProgress.combatsWon,
          combatsLost: gameProgress.combatsLost,
          totalCombats: gameProgress.totalCombats,
          achievements: gameProgress.achievements,
          isCompleted: gameProgress.isCompleted,
          lastPlayedAt: gameProgress.lastPlayedAt,
          createdAt: gameProgress.createdAt,
        })
        .from(gameProgress)
        .innerJoin(members, eq(gameProgress.memberId, members.id))
        .where(eq(gameProgress.classId, input.classId))
        .orderBy(desc(gameProgress.farmacologiaPoints));

      return rows;
    }),

  /**
   * Get error reports for a class (teacher view)
   */
  getErrorReports: publicProcedure
    .input(z.object({
      classId: z.number(),
      status: z.enum(["pending", "reviewed", "resolved", "dismissed", "all"]).default("all"),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      let query = db
        .select({
          id: gameErrorReports.id,
          memberId: gameErrorReports.memberId,
          memberName: members.name,
          questId: gameErrorReports.questId,
          reportType: gameErrorReports.reportType,
          description: gameErrorReports.description,
          status: gameErrorReports.status,
          teacherResponse: gameErrorReports.teacherResponse,
          createdAt: gameErrorReports.createdAt,
        })
        .from(gameErrorReports)
        .innerJoin(members, eq(gameErrorReports.memberId, members.id))
        .where(eq(gameErrorReports.classId, input.classId))
        .orderBy(desc(gameErrorReports.createdAt));

      const rows = await query;

      if (input.status !== "all") {
        return rows.filter((r: any) => r.status === input.status);
      }

      return rows;
    }),

  /**
   * Respond to an error report (teacher action)
   */
  respondToReport: publicProcedure
    .input(z.object({
      reportId: z.number(),
      status: z.enum(["reviewed", "resolved", "dismissed"]),
      teacherResponse: z.string().optional(),
      teacherId: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      await db
        .update(gameErrorReports)
        .set({
          status: input.status,
          teacherResponse: input.teacherResponse || null,
          resolvedBy: input.teacherId || null,
          resolvedAt: new Date(),
        })
        .where(eq(gameErrorReports.id, input.reportId));

      return { success: true };
    }),

  /**
   * Get game statistics for a class (teacher dashboard)
   */
  getClassStats: publicProcedure
    .input(z.object({ classId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return {
        totalPlayers: 0,
        avgLevel: 0,
        avgPF: 0,
        avgQuestsCompleted: 0,
        completedCount: 0,
        totalCombats: 0,
        winRate: 0,
        pendingReports: 0,
      };

      const allProgress = await db
        .select()
        .from(gameProgress)
        .where(eq(gameProgress.classId, input.classId));

      const pendingReports = await db
        .select({ count: sql<number>`count(*)` })
        .from(gameErrorReports)
        .where(
          and(
            eq(gameErrorReports.classId, input.classId),
            eq(gameErrorReports.status, "pending")
          )
        );

      const totalPlayers = allProgress.length;
      if (totalPlayers === 0) return {
        totalPlayers: 0, avgLevel: 0, avgPF: 0, avgQuestsCompleted: 0,
        completedCount: 0, totalCombats: 0, winRate: 0, pendingReports: 0,
      };

      const totalCombats = allProgress.reduce((s, p) => s + p.totalCombats, 0);
      const totalWins = allProgress.reduce((s, p) => s + p.combatsWon, 0);

      return {
        totalPlayers,
        avgLevel: +(allProgress.reduce((s, p) => s + p.level, 0) / totalPlayers).toFixed(1),
        avgPF: +(allProgress.reduce((s, p) => s + p.farmacologiaPoints, 0) / totalPlayers).toFixed(1),
        avgQuestsCompleted: +(allProgress.reduce((s, p) => s + p.questsCompleted, 0) / totalPlayers).toFixed(1),
        completedCount: allProgress.filter(p => p.isCompleted).length,
        totalCombats,
        winRate: totalCombats > 0 ? +((totalWins / totalCombats) * 100).toFixed(1) : 0,
        pendingReports: Number(pendingReports[0]?.count || 0),
      };
    }),

  /**
   * Get all builtin quests (for admin reference)
   */
  getAllQuests: publicProcedure.query(() => {
    return BUILTIN_QUESTS;
  }),

  // ═══════════════════════════════════════
  // Boss Battle Routes
  // ═══════════════════════════════════════

  /**
   * Get boss status for a specific week (available/defeated/attempts)
   */
  getBossStatus: publicProcedure
    .input(z.object({
      classId: z.number(),
      memberId: z.number(),
      weekNumber: z.number(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { available: false, defeated: false, attempts: 0 };

      const weekQuests = BUILTIN_QUESTS.filter(q => q.weekNumber === input.weekNumber);
      if (weekQuests.length === 0) return { available: false, defeated: false, attempts: 0 };

      const progressRows = await db
        .select({ id: gameProgress.id })
        .from(gameProgress)
        .where(
          and(
            eq(gameProgress.memberId, input.memberId),
            eq(gameProgress.classId, input.classId)
          )
        )
        .limit(1);

      if (!progressRows[0]) return { available: false, defeated: false, attempts: 0 };

      const completedCombats = await db
        .select({ questId: gameCombats.questId })
        .from(gameCombats)
        .where(
          and(
            eq(gameCombats.gameProgressId, progressRows[0].id),
            eq(gameCombats.isWon, true)
          )
        );

      const completedQuestIds = new Set(completedCombats.map(c => c.questId));
      const allWeekQuestsCompleted = weekQuests.every(q => completedQuestIds.has(q.id));

      const bossBattleRows = await db
        .select()
        .from(bossBattles)
        .where(
          and(
            eq(bossBattles.memberId, input.memberId),
            eq(bossBattles.classId, input.classId),
            eq(bossBattles.weekNumber, input.weekNumber)
          )
        )
        .orderBy(desc(bossBattles.createdAt));

      const defeated = bossBattleRows.some(b => b.isVictory);
      const attempts = bossBattleRows.length;

      return {
        available: allWeekQuestsCompleted,
        defeated,
        attempts,
        lastAttempt: bossBattleRows[0] || null,
      };
    }),

  /**
   * Get all boss statuses for a player (weeks 1-10)
   */
  getAllBossStatuses: publicProcedure
    .input(z.object({
      classId: z.number(),
      memberId: z.number(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const progressRows = await db
        .select({ id: gameProgress.id })
        .from(gameProgress)
        .where(
          and(
            eq(gameProgress.memberId, input.memberId),
            eq(gameProgress.classId, input.classId)
          )
        )
        .limit(1);

      if (!progressRows[0]) return [];

      const completedCombats = await db
        .select({ questId: gameCombats.questId })
        .from(gameCombats)
        .where(
          and(
            eq(gameCombats.gameProgressId, progressRows[0].id),
            eq(gameCombats.isWon, true)
          )
        );

      const completedQuestIds = new Set(completedCombats.map(c => c.questId));

      const allBossBattles = await db
        .select()
        .from(bossBattles)
        .where(
          and(
            eq(bossBattles.memberId, input.memberId),
            eq(bossBattles.classId, input.classId)
          )
        );

      const statuses = [];
      for (let week = 1; week <= 10; week++) {
        const weekQuests = BUILTIN_QUESTS.filter(q => q.weekNumber === week);
        const allCompleted = weekQuests.length > 0 && weekQuests.every(q => completedQuestIds.has(q.id));
        const weekBattles = allBossBattles.filter(b => b.weekNumber === week);
        const defeated = weekBattles.some(b => b.isVictory);

        statuses.push({
          weekNumber: week,
          available: allCompleted,
          defeated,
          attempts: weekBattles.length,
        });
      }

      return statuses;
    }),

  /**
   * Record a boss battle result
   */
  completeBossBattle: publicProcedure
    .input(z.object({
      classId: z.number(),
      memberId: z.number(),
      weekNumber: z.number(),
      isVictory: z.boolean(),
      bossName: z.string(),
      totalDamageDealt: z.number(),
      playerHpRemaining: z.number(),
      phasesCompleted: z.number(),
      totalPhases: z.number(),
      comboMax: z.number(),
      pfEarned: z.number(),
      xpEarned: z.number(),
      totalTimeSpent: z.number(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const previousAttempts = await db
        .select({ count: sql<number>`count(*)` })
        .from(bossBattles)
        .where(
          and(
            eq(bossBattles.memberId, input.memberId),
            eq(bossBattles.classId, input.classId),
            eq(bossBattles.weekNumber, input.weekNumber)
          )
        );

      const attemptNumber = Number(previousAttempts[0]?.count || 0) + 1;

      const alreadyDefeated = await db
        .select({ id: bossBattles.id })
        .from(bossBattles)
        .where(
          and(
            eq(bossBattles.memberId, input.memberId),
            eq(bossBattles.classId, input.classId),
            eq(bossBattles.weekNumber, input.weekNumber),
            eq(bossBattles.isVictory, true)
          )
        )
        .limit(1);

      const isFirstVictory = input.isVictory && alreadyDefeated.length === 0;

      await db.insert(bossBattles).values({
        memberId: input.memberId,
        classId: input.classId,
        weekNumber: input.weekNumber,
        isVictory: input.isVictory,
        bossName: input.bossName,
        totalDamageDealt: input.totalDamageDealt,
        playerHpRemaining: input.playerHpRemaining,
        phasesCompleted: input.phasesCompleted,
        totalPhases: input.totalPhases,
        comboMax: input.comboMax,
        pfEarned: isFirstVictory ? input.pfEarned : 0,
        xpEarned: isFirstVictory ? input.xpEarned : 0,
        totalTimeSpent: input.totalTimeSpent,
        attemptNumber,
      });

      if (isFirstVictory) {
        const progressRows = await db
          .select()
          .from(gameProgress)
          .where(
            and(
              eq(gameProgress.memberId, input.memberId),
              eq(gameProgress.classId, input.classId)
            )
          )
          .limit(1);

        if (progressRows[0]) {
          const prog = progressRows[0];
          await db
            .update(gameProgress)
            .set({
              farmacologiaPoints: prog.farmacologiaPoints + input.pfEarned,
              experience: prog.experience + input.xpEarned,
              combatsWon: prog.combatsWon + 1,
              totalCombats: prog.totalCombats + 1,
              lastPlayedAt: new Date(),
            })
            .where(eq(gameProgress.id, prog.id));

          await db.insert(gameTransactions).values({
            memberId: input.memberId,
            classId: input.classId,
            pfAmount: input.pfEarned,
            transactionType: "boss_victory",
            missionId: null,
            description: `Boss "${input.bossName}" derrotado: +${input.pfEarned} PF`,
          });

          const member = await db
            .select()
            .from(members)
            .where(eq(members.id, input.memberId))
            .limit(1);

          if (member[0]) {
            await db
              .update(members)
              .set({ xp: String(parseFloat(member[0].xp) + input.pfEarned) })
              .where(eq(members.id, input.memberId));
          }

          const currentAchievements: string[] = JSON.parse(prog.achievements || "[]");
          const newAchievements: string[] = [];

          if (!currentAchievements.includes("boss_slayer")) {
            const allBossVictories = await db
              .select({ weekNumber: bossBattles.weekNumber })
              .from(bossBattles)
              .where(
                and(
                  eq(bossBattles.memberId, input.memberId),
                  eq(bossBattles.classId, input.classId),
                  eq(bossBattles.isVictory, true)
                )
              );

            const defeatedWeeks = new Set(allBossVictories.map(b => b.weekNumber));
            if (defeatedWeeks.has(4) && defeatedWeeks.has(10)) {
              newAchievements.push("boss_slayer");
            }
          }

          if (newAchievements.length > 0) {
            const allAchievements = [...currentAchievements, ...newAchievements];
            const achievementsStr2 = JSON.stringify(allAchievements);
            await db
              .update(gameProgress)
              .set({ achievements: sql`${achievementsStr2}` })
              .where(eq(gameProgress.id, prog.id));
          }
        }
      }

      return {
        success: true,
        isFirstVictory,
        pfEarned: isFirstVictory ? input.pfEarned : 0,
        xpEarned: isFirstVictory ? input.xpEarned : 0,
        attemptNumber,
        message: input.isVictory
          ? (isFirstVictory ? `${input.bossName} derrotado! +${input.pfEarned} PF!` : `${input.bossName} derrotado novamente! (sem recompensa adicional)`)
          : `Derrota contra ${input.bossName}. Tente novamente!`,
      };
    }),

  /**
   * Get boss battle history for a player
   */
  getBossBattleHistory: publicProcedure
    .input(z.object({
      classId: z.number(),
      memberId: z.number(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const rows = await db
        .select()
        .from(bossBattles)
        .where(
          and(
            eq(bossBattles.memberId, input.memberId),
            eq(bossBattles.classId, input.classId)
          )
        )
        .orderBy(desc(bossBattles.createdAt));

      return rows;
    }),

  /**
   * Get members of a class for admin game testing
   */
  getMembersForClass: publicProcedure
    .input(z.object({ classId: z.number() }))
    .query(async ({ input }) => {
      const classMembers = await getMembersByClass(input.classId);
      return classMembers.map(m => ({
        id: m.id,
        name: (() => { const n = m.name || ''; const p = n.split('\t'); return p.length >= 2 ? p[1].trim() : n.trim(); })(),
        classId: m.classId,
      }));
    }),

  /**
   * Admin: Get all boss battle stats for a class
   */
  getAdminBossStats: publicProcedure
    .input(z.object({ classId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      // Get all boss battles for this class
      const allBattles = await db
        .select()
        .from(bossBattles)
        .where(eq(bossBattles.classId, input.classId))
        .orderBy(desc(bossBattles.createdAt));

      // Get all members with progress in this class
      const allProgressRows = await db
        .select({
          id: gameProgress.id,
          memberId: gameProgress.memberId,
          questsCompleted: gameProgress.questsCompleted,
        })
        .from(gameProgress)
        .where(eq(gameProgress.classId, input.classId));

      // Get member names
      const classMembers = await getMembersByClass(input.classId);
      const memberMap = new Map(classMembers.map(m => [
        m.id,
        (() => { const n = m.name || ''; const p = n.split('\t'); return p.length >= 2 ? p[1].trim() : n.trim(); })()
      ]));

      // Build stats per week (1-17)
      const weekStats = [];
      for (let week = 1; week <= 17; week++) {
        const weekBattles = allBattles.filter(b => b.weekNumber === week);
        const victories = weekBattles.filter(b => b.isVictory);
        const defeats = weekBattles.filter(b => !b.isVictory);
        const uniquePlayers = new Set(weekBattles.map(b => b.memberId));
        const uniqueVictors = new Set(victories.map(b => b.memberId));

        // Detailed player attempts for this week
        const playerAttempts = Array.from(uniquePlayers).map(memberId => {
          const playerBattles = weekBattles.filter(b => b.memberId === memberId);
          const won = playerBattles.some(b => b.isVictory);
          const bestAttempt = playerBattles.reduce((best, b) => {
            if (!best) return b;
            if (b.isVictory && !best.isVictory) return b;
            if (b.phasesCompleted > best.phasesCompleted) return b;
            return best;
          }, null as typeof playerBattles[0] | null);

          return {
            memberId,
            memberName: memberMap.get(memberId) || `Aluno #${memberId}`,
            attempts: playerBattles.length,
            won,
            bestDamage: bestAttempt?.totalDamageDealt || 0,
            bestCombo: bestAttempt?.comboMax || 0,
            bestTime: bestAttempt?.totalTimeSpent || 0,
            pfEarned: playerBattles.reduce((sum, b) => sum + b.pfEarned, 0),
            lastAttempt: playerBattles[0]?.createdAt || null,
          };
        }).sort((a, b) => (b.won ? 1 : 0) - (a.won ? 1 : 0) || b.bestDamage - a.bestDamage);

        weekStats.push({
          weekNumber: week,
          totalAttempts: weekBattles.length,
          totalVictories: victories.length,
          totalDefeats: defeats.length,
          uniquePlayers: uniquePlayers.size,
          uniqueVictors: uniqueVictors.size,
          avgTimeSpent: victories.length > 0
            ? Math.round(victories.reduce((sum, b) => sum + b.totalTimeSpent, 0) / victories.length)
            : 0,
          avgCombo: victories.length > 0
            ? Math.round(victories.reduce((sum, b) => sum + b.comboMax, 0) / victories.length * 10) / 10
            : 0,
          playerAttempts,
        });
      }

      return {
        totalPlayersInClass: allProgressRows.length,
        weekStats,
      };
    }),

  /**
   * Admin: Reset a boss battle for a specific player (allow retry)
   */
  resetBossBattle: publicProcedure
    .input(z.object({
      classId: z.number(),
      memberId: z.number(),
      weekNumber: z.number(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      await db.delete(bossBattles).where(
        and(
          eq(bossBattles.memberId, input.memberId),
          eq(bossBattles.classId, input.classId),
          eq(bossBattles.weekNumber, input.weekNumber)
        )
      );

      return { success: true, message: `Boss da semana ${input.weekNumber} resetado para o aluno.` };
    }),
});