import { z } from "zod";
import { router, publicProcedure } from "../_core/trpc";
import { getDb, getTeacherAccountBySessionToken, getStudentAccountBySessionToken } from "../db";
import { chatMessages, chatConversations, studentAccounts, teacherAccounts, members, classes } from "../../drizzle/schema";
import { eq, and, or, desc, asc } from "drizzle-orm";

/**
 * Chat ao vivo — aluno/monitor ↔ professor.
 *
 * chatConversations.studentId guarda o id de studentAccounts (funciona tanto
 * pra aluno de verdade quanto pra monitor, já que os dois moram na mesma
 * tabela — só muda o accountType). senderType em chatMessages aceita
 * "student" | "monitor" | "teacher" (é texto livre no banco, sem enum).
 *
 * O modelo é 1 conversa por aluno/monitor com o professor da turma dele —
 * sem necessidade de "escolher com quem falar", já resolve sozinho.
 */

async function resolveTeacherIdForAccount(db: any, account: any): Promise<{ teacherId: number; teacherName: string } | null> {
  // Monitor: já tem assignedClassId direto na conta
  let classId: number | null = account.assignedClassId ?? null;

  // Aluno de verdade: acha a turma pelo member vinculado
  if (!classId && account.memberId) {
    const memberRows = await db.select().from(members).where(eq(members.id, account.memberId)).limit(1);
    classId = memberRows[0]?.classId ?? null;
  }

  if (!classId) return null;

  const classRows = await db.select().from(classes).where(eq(classes.id, classId)).limit(1);
  const cls = classRows[0];
  if (!cls || !cls.teacherAccountId) return null;

  const teacherRows = await db.select().from(teacherAccounts).where(eq(teacherAccounts.id, cls.teacherAccountId)).limit(1);
  const teacher = teacherRows[0];
  if (!teacher) return null;

  return { teacherId: teacher.id, teacherName: teacher.name };
}

export const chatRouter = router({
  // ─── Aluno/Monitor: pega (ou cria) a conversa com o professor da turma ───
  getMyConversation: publicProcedure
    .input(z.object({ sessionToken: z.string() }))
    .query(async ({ input }) => {
      const account = await getStudentAccountBySessionToken(input.sessionToken);
      if (!account) throw new Error("Não autorizado");
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const resolved = await resolveTeacherIdForAccount(db, account);
      if (!resolved) {
        return { conversationId: null, teacherName: null, message: "Você ainda não está vinculado a uma turma com professor definido." };
      }

      const existing = await db.select().from(chatConversations)
        .where(and(eq(chatConversations.studentId, account.id), eq(chatConversations.teacherId, resolved.teacherId)))
        .limit(1);

      if (existing.length > 0) {
        return { conversationId: existing[0].id, teacherName: resolved.teacherName, message: null };
      }

      const res = await db.insert(chatConversations).values({
        studentId: account.id,
        teacherId: resolved.teacherId,
      });
      const conversationId = (res as any)[0]?.insertId ?? (res as any).insertId;
      return { conversationId, teacherName: resolved.teacherName, message: null };
    }),

  // ─── Professor: lista todas as conversas dele, com quem é (aluno/monitor) ───
  getTeacherConversations: publicProcedure
    .input(z.object({ teacherSessionToken: z.string() }))
    .query(async ({ input }) => {
      const teacher = await getTeacherAccountBySessionToken(input.teacherSessionToken);
      if (!teacher) throw new Error("Não autorizado");
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const convos = await db.select().from(chatConversations)
        .where(eq(chatConversations.teacherId, teacher.id))
        .orderBy(desc(chatConversations.lastMessageAt));

      const results = await Promise.all(convos.map(async (c: any) => {
        const accRows = await db.select().from(studentAccounts).where(eq(studentAccounts.id, c.studentId)).limit(1);
        const acc = accRows[0];
        let displayName = acc?.displayName || acc?.email || `Aluno #${c.studentId}`;
        if (acc?.memberId) {
          const memberRows = await db.select().from(members).where(eq(members.id, acc.memberId)).limit(1);
          if (memberRows[0]?.name) displayName = memberRows[0].name;
        }
        const lastMsg = await db.select().from(chatMessages)
          .where(eq(chatMessages.conversationId, c.id))
          .orderBy(desc(chatMessages.createdAt)).limit(1);
        const unread = await db.select().from(chatMessages)
          .where(and(eq(chatMessages.conversationId, c.id), eq(chatMessages.isRead, false), or(eq(chatMessages.senderType, "student"), eq(chatMessages.senderType, "monitor"))));

        return {
          id: c.id,
          personName: displayName,
          personType: acc?.accountType === "monitor" ? "monitor" : "student",
          lastMessageAt: c.lastMessageAt,
          lastMessagePreview: lastMsg[0]?.content?.slice(0, 60) || null,
          unreadCount: unread.length,
        };
      }));

      return results;
    }),

  // ─── Buscar mensagens de uma conversa (valida que quem pede é uma das partes) ───
  getMessages: publicProcedure
    .input(z.object({ sessionToken: z.string(), conversationId: z.number(), limit: z.number().default(50) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const convoRows = await db.select().from(chatConversations).where(eq(chatConversations.id, input.conversationId)).limit(1);
      const convo = convoRows[0];
      if (!convo) throw new Error("Conversa não encontrada");

      const { role, id: callerId } = await identifyCaller(db, input.sessionToken);
      const isParticipant = (role === "teacher" && callerId === convo.teacherId) || (role !== "teacher" && callerId === convo.studentId);
      if (!isParticipant) throw new Error("Não autorizado");

      const msgs = await db.select().from(chatMessages)
        .where(eq(chatMessages.conversationId, input.conversationId))
        .orderBy(asc(chatMessages.createdAt))
        .limit(input.limit);

      // Marca como lidas as mensagens que NÃO são do próprio remetente
      const otherSideTypes = role === "teacher" ? ["student", "monitor"] : ["teacher"];
      for (const m of msgs) {
        if (!m.isRead && otherSideTypes.includes(m.senderType)) {
          await db.update(chatMessages).set({ isRead: true }).where(eq(chatMessages.id, m.id));
        }
      }

      return msgs;
    }),

  // ─── Enviar mensagem (funciona pra aluno, monitor ou professor) ───
  sendMessage: publicProcedure
    .input(z.object({ sessionToken: z.string(), conversationId: z.number(), content: z.string().min(1).max(2000) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const convoRows = await db.select().from(chatConversations).where(eq(chatConversations.id, input.conversationId)).limit(1);
      const convo = convoRows[0];
      if (!convo) throw new Error("Conversa não encontrada");

      const { role, id: callerId } = await identifyCaller(db, input.sessionToken);
      let senderType: string;
      if (role === "teacher") {
        if (callerId !== convo.teacherId) throw new Error("Não autorizado");
        senderType = "teacher";
      } else {
        if (callerId !== convo.studentId) throw new Error("Não autorizado");
        senderType = role; // "student" ou "monitor"
      }

      await db.insert(chatMessages).values({
        conversationId: input.conversationId,
        senderId: callerId,
        senderType,
        content: input.content.trim(),
      });
      await db.update(chatConversations).set({ lastMessageAt: new Date() }).where(eq(chatConversations.id, input.conversationId));

      return { success: true };
    }),
});

// Identifica quem está chamando: tenta studentAccounts (aluno OU monitor)
// primeiro, depois teacherAccounts.
async function identifyCaller(db: any, sessionToken: string): Promise<{ role: "student" | "monitor" | "teacher"; id: number }> {
  const account = await getStudentAccountBySessionToken(sessionToken);
  if (account) {
    return { role: account.accountType === "monitor" ? "monitor" : "student", id: account.id };
  }
  const teacher = await getTeacherAccountBySessionToken(sessionToken);
  if (teacher) {
    return { role: "teacher", id: teacher.id };
  }
  throw new Error("Não autorizado");
}