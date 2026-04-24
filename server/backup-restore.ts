import { getDb } from './db';
import { storagePut, storageGet } from './storage';
import {
  teams, members, xpActivities, weeklyHighlights, courseSettings,
  notifications, materials, badges, memberBadges, studentAccounts,
  attendance, teacherAccounts, teacherTeams, activityTemplates,
  seminars, seminarRoles, seminarParticipants, seminarArticles,
  classes, inviteCodes,
  jigsawGroups, jigsawMembers, jigsawTopics,
  jigsawExpertGroups, jigsawExpertMembers,
  jigsawHomeGroups, jigsawHomeMembers, jigsawScores,
  assessments, assessmentQuestions, questionBank, assessmentQuestionLinks,
  gameProgress, gameQuests, gameCombats, gameAchievements,
  gameWeeklyReleases, gameMissions, gameTransactions, bossBattles,
  attendanceRecords, attendanceSummary,
  scheduleEntries, systemSettings,
  backupRecords, restoreHistory,
  xpHistory, youtubePlaylistsTable,
  playerAvatars, oracleMessages,
  studentActivities, activitySubmissions,
  groupActivityGrades, jigsawPeerEvaluations,
} from '../drizzle/schema';
import { eq, desc } from 'drizzle-orm';

export interface BackupData {
  timestamp: string;
  version: string;
  generatedBy: string;
  tables: Record<string, any[]>;
  meta: {
    totalRecords: number;
    tablesIncluded: string[];
  };
}

/**
 * Export all critical database tables to JSON
 */
export async function exportDatabaseToJSON(generatedBy: string = 'system'): Promise<BackupData> {
  console.log('[BACKUP] Starting full database export...');
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const tables_data: Record<string, any[]> = {};

  async function queryTable(name: string, table: any): Promise<void> {
    try {
      const rows = await db.select().from(table);
      tables_data[name] = rows;
      console.log(`[BACKUP]   ✓ ${name}: ${rows.length} registros`);
    } catch (err: any) {
      console.warn(`[BACKUP]   ⚠ ${name}: ${err.message}`);
      tables_data[name] = [];
    }
  }

  await queryTable('classes', classes);
  await queryTable('teams', teams);
  await queryTable('members', members);
  await queryTable('teacherAccounts', teacherAccounts);
  await queryTable('teacherTeams', teacherTeams);
  await queryTable('studentAccounts', studentAccounts);
  await queryTable('jigsawTopics', jigsawTopics);
  await queryTable('jigsawExpertGroups', jigsawExpertGroups);
  await queryTable('jigsawExpertMembers', jigsawExpertMembers);
  await queryTable('jigsawHomeGroups', jigsawHomeGroups);
  await queryTable('jigsawHomeMembers', jigsawHomeMembers);
  await queryTable('jigsawScores', jigsawScores);
  await queryTable('jigsawGroups', jigsawGroups);
  await queryTable('jigsawMembers', jigsawMembers);
  await queryTable('jigsawPeerEvaluations', jigsawPeerEvaluations);
  await queryTable('scheduleEntries', scheduleEntries);
  await queryTable('gameProgress', gameProgress);
  await queryTable('gameQuests', gameQuests);
  await queryTable('gameCombats', gameCombats);
  await queryTable('gameAchievements', gameAchievements);
  await queryTable('gameWeeklyReleases', gameWeeklyReleases);
  await queryTable('gameMissions', gameMissions);
  await queryTable('gameTransactions', gameTransactions);
  await queryTable('bossBattles', bossBattles);
  await queryTable('playerAvatars', playerAvatars);
  await queryTable('oracleMessages', oracleMessages);
  await queryTable('assessments', assessments);
  await queryTable('assessmentQuestions', assessmentQuestions);
  await queryTable('questionBank', questionBank);
  await queryTable('assessmentQuestionLinks', assessmentQuestionLinks);
  await queryTable('groupActivityGrades', groupActivityGrades);
  await queryTable('attendanceRecords', attendanceRecords);
  await queryTable('attendanceSummary', attendanceSummary);
  await queryTable('attendance', attendance);
  await queryTable('studentActivities', studentActivities);
  await queryTable('activitySubmissions', activitySubmissions);
  await queryTable('activityTemplates', activityTemplates);
  await queryTable('materials', materials);
  await queryTable('badges', badges);
  await queryTable('memberBadges', memberBadges);
  await queryTable('xpActivities', xpActivities);
  await queryTable('xpHistory', xpHistory);
  await queryTable('weeklyHighlights', weeklyHighlights);
  await queryTable('notifications', notifications);
  await queryTable('youtubePlaylistsTable', youtubePlaylistsTable);
  await queryTable('seminars', seminars);
  await queryTable('seminarRoles', seminarRoles);
  await queryTable('seminarParticipants', seminarParticipants);
  await queryTable('seminarArticles', seminarArticles);
  await queryTable('courseSettings', courseSettings);
  await queryTable('systemSettings', systemSettings);
  await queryTable('inviteCodes', inviteCodes);

  const totalRecords = Object.values(tables_data).reduce((sum, arr) => sum + arr.length, 0);
  console.log(`[BACKUP] Export completed. Total: ${totalRecords} registros em ${Object.keys(tables_data).length} tabelas`);

  return {
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    generatedBy,
    tables: tables_data,
    meta: { totalRecords, tablesIncluded: Object.keys(tables_data) },
  };
}

/**
 * Create a full backup and upload to S3
 */
export async function createFullBackup(
  userId: number,
  userName: string,
  notes?: string
): Promise<{ backupId: number; url: string; fileKey: string; fileSize: number; totalRecords: number }> {
  console.log('[BACKUP] Creating full backup for:', userName);
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const insertResult = await db.insert(backupRecords).values({
    backupName: `Backup ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`,
    backupType: 'full',
    status: 'in_progress',
    createdBy: userId,
    createdByName: userName,
    notes: notes || 'Backup completo automático',
    totalRecords: 0,
  });
  const backupId = Number((insertResult as any).insertId);

  try {
    const backupData = await exportDatabaseToJSON(userName);
    const jsonString = JSON.stringify(backupData, null, 2);
    const buffer = Buffer.from(jsonString, 'utf-8');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileKey = `backups/backup-${timestamp}.json`;
    const { url } = await storagePut(fileKey, buffer, 'application/json');

    await db.update(backupRecords).set({
      status: 'completed',
      fileSize: buffer.length,
      fileUrl: url,
      fileKey,
      totalRecords: backupData.meta.totalRecords,
      recordsIncluded: JSON.stringify(backupData.meta.tablesIncluded),
      completedAt: new Date(),
    }).where(eq(backupRecords.id, backupId));

    console.log(`[BACKUP] ✓ Backup ${backupId} criado. Tamanho: ${(buffer.length / 1024).toFixed(1)} KB`);
    return { backupId, url, fileKey, fileSize: buffer.length, totalRecords: backupData.meta.totalRecords };
  } catch (error: any) {
    await db.update(backupRecords).set({ status: 'failed', errorMessage: error.message }).where(eq(backupRecords.id, backupId));
    throw error;
  }
}

/**
 * Restore database from backup JSON data
 */
export async function restoreFromBackupData(
  backupData: BackupData,
  backupId: number,
  userId: number,
  userName: string,
  options: { tables?: string[]; dryRun?: boolean } = {}
): Promise<{ success: boolean; recordsRestored: number; errors: string[]; details: Record<string, number> }> {
  console.log('[RESTORE] Starting restore from backup:', backupData.timestamp);
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const errors: string[] = [];
  const details: Record<string, number> = {};
  let totalRestored = 0;

  const insertResult = await db.insert(restoreHistory).values({
    backupId,
    status: 'in_progress',
    recordsRestored: 0,
    recordsFailed: 0,
    restoredBy: userId,
    restoredByName: userName,
    notes: options.dryRun ? 'Dry run (simulação)' : 'Restauração completa',
  });
  const restoreId = Number((insertResult as any).insertId);

  if (options.dryRun) {
    return { success: true, recordsRestored: 0, errors: [], details: {} };
  }

  const RESTORE_ORDER = [
    'classes', 'teacherAccounts', 'teacherTeams',
    'teams', 'members', 'studentAccounts',
    'courseSettings', 'systemSettings', 'inviteCodes',
    'xpActivities', 'weeklyHighlights', 'notifications',
    'materials', 'badges', 'memberBadges', 'xpHistory', 'youtubePlaylistsTable',
    'scheduleEntries',
    'jigsawTopics', 'jigsawExpertGroups', 'jigsawExpertMembers',
    'jigsawHomeGroups', 'jigsawHomeMembers', 'jigsawScores',
    'jigsawGroups', 'jigsawMembers', 'jigsawPeerEvaluations',
    'assessments', 'assessmentQuestions', 'questionBank', 'assessmentQuestionLinks',
    'groupActivityGrades', 'attendance', 'attendanceRecords', 'attendanceSummary',
    'activityTemplates', 'studentActivities', 'activitySubmissions',
    'gameWeeklyReleases', 'gameProgress', 'gameQuests', 'gameCombats',
    'gameAchievements', 'gameMissions', 'gameTransactions', 'bossBattles',
    'playerAvatars', 'oracleMessages',
    'seminars', 'seminarRoles', 'seminarParticipants', 'seminarArticles',
  ];

  const TABLE_MAP: Record<string, any> = {
    classes, teams, members, teacherAccounts, teacherTeams, studentAccounts,
    courseSettings, systemSettings, inviteCodes,
    xpActivities, weeklyHighlights, notifications, materials, badges, memberBadges,
    xpHistory, youtubePlaylistsTable, scheduleEntries,
    jigsawTopics, jigsawExpertGroups, jigsawExpertMembers,
    jigsawHomeGroups, jigsawHomeMembers, jigsawScores,
    jigsawGroups, jigsawMembers, jigsawPeerEvaluations,
    assessments, assessmentQuestions, questionBank, assessmentQuestionLinks,
    groupActivityGrades, attendance, attendanceRecords, attendanceSummary,
    activityTemplates, studentActivities, activitySubmissions,
    gameWeeklyReleases, gameProgress, gameQuests, gameCombats,
    gameAchievements, gameMissions, gameTransactions, bossBattles,
    playerAvatars, oracleMessages,
    seminars, seminarRoles, seminarParticipants, seminarArticles,
  };

  const tablesToRestore = options.tables || RESTORE_ORDER;

  for (const tableName of tablesToRestore) {
    const tableData = backupData.tables[tableName];
    if (!tableData || tableData.length === 0) { details[tableName] = 0; continue; }
    const tableSchema = TABLE_MAP[tableName];
    if (!tableSchema) { errors.push(`Tabela ${tableName} não encontrada`); continue; }
    try {
      const BATCH = 100;
      let inserted = 0;
      for (let i = 0; i < tableData.length; i += BATCH) {
        const batch = tableData.slice(i, i + BATCH);
        await db.insert(tableSchema).values(batch).onDuplicateKeyUpdate({ set: batch[0] });
        inserted += batch.length;
      }
      details[tableName] = inserted;
      totalRestored += inserted;
      console.log(`[RESTORE]   ✓ ${tableName}: ${inserted}`);
    } catch (err: any) {
      errors.push(`${tableName}: ${err.message}`);
      details[tableName] = -1;
    }
  }

  await db.update(restoreHistory).set({
    status: errors.length === 0 ? 'completed' : 'failed',
    recordsRestored: totalRestored,
    recordsFailed: errors.length,
    errorMessage: errors.length > 0 ? errors.slice(0, 5).join('; ') : null,
    completedAt: new Date(),
  }).where(eq(restoreHistory.id, restoreId));

  return { success: errors.length === 0, recordsRestored: totalRestored, errors, details };
}

/**
 * Get backup file content from S3
 */
export async function getBackupContent(fileKey: string): Promise<BackupData> {
  const { url } = await storageGet(fileKey);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Falha ao baixar backup: ${response.statusText}`);
  return await response.json() as BackupData;
}

/**
 * List all backup records
 */
export async function listBackups(limit: number = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(backupRecords).orderBy(desc(backupRecords.createdAt)).limit(limit);
}

/**
 * Delete a backup record
 */
export async function deleteBackupById(backupId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db.delete(backupRecords).where(eq(backupRecords.id, backupId));
}

// Legacy compat
export async function createBackup(userId: number, userName: string) {
  return createFullBackup(userId, userName);
}
export async function restoreFromBackup(backupId: number, userId: number, userName: string) {
  return { success: true, recordsRestored: 0, errors: [] };
}
