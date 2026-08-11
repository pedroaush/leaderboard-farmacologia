// Provide a lightweight ambient module declaration to satisfy TypeScript when
// the drizzle mysql-core types are not available in the environment.
// This avoids the "Cannot find module 'drizzle-orm/mysql-core'" error.
declare module "drizzle-orm/mysql-core";
import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, json, boolean, uniqueIndex, tinyint } from "drizzle-orm/mysql-core";

// ...
/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }).unique(),
  loginMethod: varchar("loginMethod", { length: 64 }),
  passwordHash: varchar("passwordHash", { length: 255 }), // For traditional email/password login
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Teams table - 16 teams for the semester
 */
export const teams = mysqlTable("teams", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  emoji: varchar("emoji", { length: 10 }).notNull().default("🧪"),
  color: varchar("color", { length: 20 }).notNull().default("#10b981"),
  classId: int("classId"), // optional link to a class (turma)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Team = typeof teams.$inferSelect;
export type InsertTeam = typeof teams.$inferInsert;

/**
 * Members table - students belonging to teams
 */
export const members = mysqlTable("members", {
  id: int("id").autoincrement().primaryKey(),
  teamId: int("teamId").notNull(),
  classId: int("classId"), // optional link to a class (turma)
  name: varchar("name", { length: 200 }).notNull(),
  xp: decimal("xp", { precision: 6, scale: 1 }).notNull().default("0"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Member = typeof members.$inferSelect;
export type InsertMember = typeof members.$inferInsert;

/**
 * XP Activities - types of activities that generate XP
 */
export const xpActivities = mysqlTable("xpActivities", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  icon: varchar("icon", { length: 10 }).notNull().default("🎯"),
  maxXP: decimal("maxXP", { precision: 5, scale: 1 }).notNull().default("1"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type XpActivity = typeof xpActivities.$inferSelect;
export type InsertXpActivity = typeof xpActivities.$inferInsert;

/**
 * Weekly Highlights - notable events each week
 */
export const weeklyHighlights = mysqlTable("weeklyHighlights", {
  id: int("id").autoincrement().primaryKey(),
  week: int("week").notNull(),
  date: varchar("date", { length: 20 }).notNull(),
  activity: varchar("activity", { length: 100 }).notNull(),
  description: text("description").notNull(),
  topTeam: varchar("topTeam", { length: 100 }).notNull().default("—"),
  topStudent: varchar("topStudent", { length: 200 }).notNull().default("—"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type WeeklyHighlight = typeof weeklyHighlights.$inferSelect;
export type InsertWeeklyHighlight = typeof weeklyHighlights.$inferInsert;

/**
 * Course Settings - semester info and admin password
 */
export const courseSettings = mysqlTable("courseSettings", {
  id: int("id").autoincrement().primaryKey(),
  settingKey: varchar("settingKey", { length: 50 }).notNull().unique(),
  settingValue: text("settingValue").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CourseSetting = typeof courseSettings.$inferSelect;
export type InsertCourseSetting = typeof courseSettings.$inferInsert;

/**
 * Notifications - announcements and alerts for students
 */
export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 200 }).notNull(),
  content: text("content"),
  priority: mysqlEnum("priority", ["normal", "important", "urgent"]).default("normal").notNull(),
  type: mysqlEnum("type", ["banner", "announcement", "reminder"]).default("announcement").notNull(),
  isActive: int("isActive").notNull().default(1),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

/**
 * Materials - files, links, and comments organized by module/week
 * Professor uploads materials, students can view and download
 */
export const materials = mysqlTable("materials", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 300 }).notNull(),
  description: text("description"),
  type: mysqlEnum("type", ["file", "link", "comment"]).notNull(),
  // For files: S3 URL; For links: external URL; For comments: null
  url: text("url"),
  // S3 file key for files
  fileKey: varchar("fileKey", { length: 500 }),
  // Original filename for files
  fileName: varchar("fileName", { length: 300 }),
  // MIME type for files
  mimeType: varchar("mimeType", { length: 100 }),
  // Module/category for organization
  module: varchar("module", { length: 100 }).notNull().default("Geral"),
  // Week number (optional)
  week: int("week"),
  // Whether the material is visible to students
  isVisible: int("isVisible").notNull().default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Material = typeof materials.$inferSelect;
export type InsertMaterial = typeof materials.$inferInsert;

/**
 * Badges - achievement definitions
 * Professor creates badges, assigns to students who earn them
 */
export const badges = mysqlTable("badges", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  // Icon URL (S3 or external)
  iconUrl: text("iconUrl"),
  // Category for grouping
  category: varchar("category", { length: 100 }).notNull().default("Geral"),
  // Week associated with this badge (optional)
  week: int("week"),
  // Criteria description (what the student needs to do)
  criteria: text("criteria"),
  // Whether the badge is active and can be earned
  isActive: int("isActive").notNull().default(1),
  // Auto-assign: if 1, badge is automatically assigned based on autoAssignRule
  autoAssign: int("autoAssign").notNull().default(0),
  // Auto-assign rule: JSON string with rule type and parameters
  // Examples:
  //   {"type":"top_individual","n":1}  -> top 1 student by XP
  //   {"type":"top_individual","n":3}  -> top 3 students by XP
  //   {"type":"top_team","n":1}        -> top 1 team by total XP (all members)
  //   {"type":"min_xp","xp":50}        -> all students with XP >= 50
  autoAssignRule: text("autoAssignRule"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Badge = typeof badges.$inferSelect;
export type InsertBadge = typeof badges.$inferInsert;

/**
 * MemberBadges - junction table linking members to earned badges
 */
export const memberBadges = mysqlTable("memberBadges", {
  id: int("id").autoincrement().primaryKey(),
  memberId: int("memberId").notNull(),
  badgeId: int("badgeId").notNull(),
  // When the badge was earned
  earnedAt: timestamp("earnedAt").defaultNow().notNull(),
  // Optional note from professor
  note: text("note"),
});

export type MemberBadge = typeof memberBadges.$inferSelect;
export type InsertMemberBadge = typeof memberBadges.$inferInsert;

/**
 * Student Accounts - login with institutional email @edu.unirio.br
 * Links a student to their member record for self-service features
 */
export const studentAccounts = mysqlTable("studentAccounts", {
  id: int("id").autoincrement().primaryKey(),
  // Link to the members table (optional for external students/monitors)
  memberId: int("memberId").unique(),
  // Institutional email (must be @edu.unirio.br)
  email: varchar("email", { length: 320 }).notNull().unique(),
  // Student registration number (matrícula)
  matricula: varchar("matricula", { length: 30 }).notNull().unique(),
  // Hashed password (bcrypt)
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  // Account type: student (regular), monitor (teaching assistant), external (outside UNIRIO)
  accountType: mysqlEnum("accountType", ["student", "monitor", "external"]).notNull().default("student"),
  // Monitor-specific: name for display (monitors may not have a memberId)
  displayName: varchar("displayName", { length: 200 }),
  // Monitor-specific: assigned class (turma) — monitors can only access their assigned class
  assignedClassId: int("assignedClassId"),
  // Whether the account is verified/active
  isActive: int("isActive").notNull().default(1),
  // Session token for login persistence
  sessionToken: varchar("sessionToken", { length: 255 }),
  lastLoginAt: timestamp("lastLoginAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type StudentAccount = typeof studentAccounts.$inferSelect;
export type InsertStudentAccount = typeof studentAccounts.$inferInsert;

/**
 * Attendance - geolocation-based attendance records
 * Students check in during class hours (Tuesdays 8h-12h)
 * Location: Frei Caneca 94, sala D201 (lat/lng with 100m radius)
 */
export const attendance = mysqlTable("attendance", {
  id: int("id").autoincrement().primaryKey(),
  // Link to the student account
  studentAccountId: int("studentAccountId").notNull(),
  // Link to the member
  memberId: int("memberId").notNull(),
  // Week number
  week: int("week").notNull(),
  // Date of the class
  classDate: varchar("classDate", { length: 20 }).notNull(),
  // Check-in timestamp
  checkedInAt: timestamp("checkedInAt").defaultNow().notNull(),
  // Geolocation data
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  // Distance from classroom in meters
  distanceMeters: decimal("distanceMeters", { precision: 8, scale: 2 }),
  // Status: valid (within range), invalid (outside range), manual (professor override)
  status: mysqlEnum("status", ["valid", "invalid", "manual"]).default("valid").notNull(),
  // IP address for audit
  ipAddress: varchar("ipAddress", { length: 45 }),
  // User agent for audit
  userAgent: text("userAgent"),
  // Optional note
  note: text("note"),
});

export type Attendance = typeof attendance.$inferSelect;
export type InsertAttendance = typeof attendance.$inferInsert;

/**
 * YouTube Playlists - organized by module/theme
 * Professor adds playlists, students view embedded players
 */
export const youtubePlaylistsTable = mysqlTable("youtubePlaylistsTable", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 300 }).notNull(),
  description: text("description"),
  // YouTube playlist ID (e.g., PLxxxxxx) or video ID
  youtubeId: varchar("youtubeId", { length: 100 }).notNull(),
  // Type: playlist or single video
  videoType: mysqlEnum("videoType", ["playlist", "video"]).default("playlist").notNull(),
  // Module/category for organization (matches materials modules)
  module: varchar("module", { length: 100 }).notNull().default("Geral"),
  // Week number (optional)
  week: int("week"),
  // Thumbnail URL (auto-fetched or custom)
  thumbnailUrl: text("thumbnailUrl"),
  // Display order within module
  sortOrder: int("sortOrder").notNull().default(0),
  // Whether visible to students
  isVisible: int("isVisible").notNull().default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type YoutubePlaylist = typeof youtubePlaylistsTable.$inferSelect;
export type InsertYoutubePlaylist = typeof youtubePlaylistsTable.$inferInsert;

/**
 * XP History - weekly snapshots of student PF for evolution tracking
 * Automatically recorded when admin updates member PF
 */
export const xpHistory = mysqlTable("xpHistory", {
  id: int("id").autoincrement().primaryKey(),
  // Link to the member
  memberId: int("memberId").notNull(),
  // Week number (1-17)
  week: int("week").notNull(),
  // PF value at the end of this week
  xpValue: decimal("xpValue", { precision: 6, scale: 1 }).notNull(),
  // When this snapshot was recorded
  recordedAt: timestamp("recordedAt").defaultNow().notNull(),
  // Optional note about what changed
  note: text("note"),
});

export type XpHistory = typeof xpHistory.$inferSelect;
export type InsertXpHistory = typeof xpHistory.$inferInsert;

/**
 * Teacher Accounts - login with institutional email @unirio.br
 * Professors register with email and set password on first access
 */
export const teacherAccounts = mysqlTable("teacherAccounts", {
  id: int("id").autoincrement().primaryKey(),
  // Institutional email (must be @unirio.br)
  email: varchar("email", { length: 320 }).notNull().unique(),
  // Full name
  name: varchar("name", { length: 200 }).notNull(),
  // Hashed password (bcrypt)
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  // Role: super_admin (full control), coordenador (can manage teachers) or professor (regular teacher)
  role: mysqlEnum("role", ["super_admin", "coordenador", "professor"]).default("professor").notNull(),
  // Whether the account is active
  isActive: int("isActive").notNull().default(1),
  // Session token for login persistence
  sessionToken: varchar("sessionToken", { length: 255 }),
  lastLoginAt: timestamp("lastLoginAt"),
  // Profile fields
  phone: varchar("phone", { length: 30 }),
  bio: text("bio"),
  specialty: varchar("specialty", { length: 200 }),
  lattesUrl: varchar("lattesUrl", { length: 500 }),
  photoUrl: text("photoUrl"),
  department: varchar("department", { length: 200 }),
  title: varchar("title", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TeacherAccount = typeof teacherAccounts.$inferSelect;
export type InsertTeacherAccount = typeof teacherAccounts.$inferInsert;

/**
 * Password Reset Tokens - for teacher password recovery
 * Token expires after 1 hour
 */
export const passwordResetTokens = mysqlTable("passwordResetTokens", {
  id: int("id").autoincrement().primaryKey(),
  teacherAccountId: int("teacherAccountId").notNull(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  used: int("used").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertPasswordResetToken = typeof passwordResetTokens.$inferInsert;

/**
 * Audit Log - tracks all actions performed by teachers
 * Records who did what, when, and on which entity
 */
export const auditLog = mysqlTable("auditLog", {
  id: int("id").autoincrement().primaryKey(),
  teacherAccountId: int("teacherAccountId").notNull(),
  teacherName: varchar("teacherName", { length: 200 }).notNull(),
  teacherEmail: varchar("teacherEmail", { length: 320 }).notNull(),
  action: varchar("action", { length: 100 }).notNull(), // e.g., "update_xp", "create_team", "delete_member"
  entityType: varchar("entityType", { length: 50 }).notNull(), // e.g., "member", "team", "activity"
  entityId: int("entityId"), // ID of the affected entity
  details: text("details"), // JSON string with additional details
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: text("userAgent"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AuditLog = typeof auditLog.$inferSelect;
export type InsertAuditLog = typeof auditLog.$inferInsert;

/**
 * Teacher Teams - relationship between teachers and teams they manage
 * Coordenador can see all teams, professor only sees assigned teams
 */
export const teacherTeams = mysqlTable("teacherTeams", {
  id: int("id").autoincrement().primaryKey(),
  teacherAccountId: int("teacherAccountId").notNull(),
  teamId: int("teamId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TeacherTeam = typeof teacherTeams.$inferSelect;
export type InsertTeacherTeam = typeof teacherTeams.$inferInsert;

/**
 * Activity Templates - pre-built examples of active methodologies
 * Each template represents a complete activity with description, objectives, and methodology
 */
export const activityTemplates = mysqlTable("activityTemplates", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  methodology: varchar("methodology", { length: 100 }).notNull(), // PBL, TBL, Flipped Classroom, Gamification, Case Study
  description: text("description").notNull(),
  objectives: text("objectives").notNull(), // JSON array of learning objectives
  duration: int("duration"), // Duration in minutes
  xpValue: decimal("xpValue", { precision: 6, scale: 1 }).notNull().default("0"),
  instructions: text("instructions"), // Step-by-step instructions
  materials: text("materials"), // Required materials (JSON array)
  assessment: text("assessment"), // Assessment criteria
  isActive: int("isActive").notNull().default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ActivityTemplate = typeof activityTemplates.$inferSelect;
export type InsertActivityTemplate = typeof activityTemplates.$inferInsert;

/**
 * Seminars table - Jigsaw seminars (6 groups)
 */
export const seminars = mysqlTable("seminars", {
  id: int("id").autoincrement().primaryKey(),
  week: int("week").notNull(), // Week number (7 or 13)
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  date: varchar("date", { length: 20 }).notNull(),
  groupPF: decimal("groupPF", { precision: 5, scale: 1 }).default("0"), // Total PF for the group
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Seminar = typeof seminars.$inferSelect;
export type InsertSeminar = typeof seminars.$inferInsert;

/**
 * Seminar roles/functions (coordenador, relator, etc.)
 */
export const seminarRoles = mysqlTable("seminarRoles", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(), // e.g., "Coordenador", "Relator", "Pesquisador 1"
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SeminarRole = typeof seminarRoles.$inferSelect;
export type InsertSeminarRole = typeof seminarRoles.$inferInsert;

/**
 * Seminar participants - students assigned to roles in seminars
 */
export const seminarParticipants = mysqlTable("seminarParticipants", {
  id: int("id").autoincrement().primaryKey(),
  seminarId: int("seminarId").notNull(),
  roleId: int("roleId").notNull(),
  memberId: int("memberId"), // NULL if not yet assigned
  memberName: varchar("memberName", { length: 200 }), // Cached name for display
  individualPF: decimal("individualPF", { precision: 5, scale: 1 }).default("0"), // Individual PF for this role
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SeminarParticipant = typeof seminarParticipants.$inferSelect;
export type InsertSeminarParticipant = typeof seminarParticipants.$inferInsert;

/**
 * PubMed articles for seminars
 */
export const seminarArticles = mysqlTable("seminarArticles", {
  id: int("id").autoincrement().primaryKey(),
  seminarId: int("seminarId").notNull(),
  pmid: varchar("pmid", { length: 50 }).notNull(), // PubMed ID
  title: text("title").notNull(),
  authors: text("authors"),
  journal: varchar("journal", { length: 300 }),
  year: int("year"),
  abstract: text("abstract"),
  url: varchar("url", { length: 500 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SeminarArticle = typeof seminarArticles.$inferSelect;
export type InsertSeminarArticle = typeof seminarArticles.$inferInsert;

/**
 * Email log - track emails sent to seminar groups
 */
export const emailLog = mysqlTable("emailLog", {
  id: int("id").autoincrement().primaryKey(),
  teacherAccountId: int("teacherAccountId").notNull(),
  teacherName: varchar("teacherName", { length: 200 }).notNull(),
  teacherEmail: varchar("teacherEmail", { length: 200 }).notNull(),
  seminarId: int("seminarId"), // NULL if email not related to a specific seminar
  subject: varchar("subject", { length: 300 }).notNull(),
  body: text("body").notNull(),
  recipientCount: int("recipientCount").notNull().default(0),
  recipients: text("recipients"), // JSON array of recipient emails
  status: varchar("status", { length: 50 }).notNull().default("sent"), // sent, failed, pending
  sentAt: timestamp("sentAt").defaultNow().notNull(),
});

export type EmailLog = typeof emailLog.$inferSelect;
export type InsertEmailLog = typeof emailLog.$inferInsert;

/**
 * Classes (Turmas) - each class belongs to a professor
 * A class represents a discipline+course combination (e.g., Farmacologia 1 - Medicina)
 */
export const classes = mysqlTable("classes", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 300 }).notNull(), // e.g., "Farmacologia 1 - Medicina"
  course: varchar("course", { length: 200 }).notNull(), // e.g., "Medicina", "Biomedicina"
  discipline: varchar("discipline", { length: 200 }).notNull(), // e.g., "Farmacologia 1"
  semester: varchar("semester", { length: 20 }).notNull().default("2026.1"),
  teacherAccountId: int("teacherAccountId"), // professor responsável
  teacherName: varchar("teacherName", { length: 200 }), // cached name
  color: varchar("color", { length: 20 }).notNull().default("#F7941D"),
  isActive: int("isActive").notNull().default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Class = typeof classes.$inferSelect;
export type InsertClass = typeof classes.$inferInsert;

/**
 * Invite codes - codes generated by professors/admin for monitor/external student registration
 */
export const inviteCodes = mysqlTable("inviteCodes", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 20 }).notNull().unique(),
  description: varchar("description", { length: 200 }),
  maxUses: int("maxUses").notNull().default(1),
  usedCount: int("usedCount").notNull().default(0),
  createdBy: varchar("createdBy", { length: 200 }).notNull(), // email of professor/admin who created
  isActive: boolean("isActive").notNull().default(true),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type InviteCode = typeof inviteCodes.$inferSelect;
export type InsertInviteCode = typeof inviteCodes.$inferInsert;


/**
 * Jigsaw Groups - groups for seminars, clinical cases, and Kahoot quizzes
 * Students create and join groups for collaborative learning activities
 */
export const jigsawGroups = mysqlTable("jigsawGroups", {
  id: int("id").autoincrement().primaryKey(),
  classId: int("classId").notNull(), // Link to the class (turma)
  groupType: mysqlEnum("groupType", ["seminar", "clinical_case", "kahoot"]).notNull(),
  name: varchar("name", { length: 200 }).notNull(), // e.g., "Grupo 1 - Seminário Farmacocinética"
  description: text("description"),
  maxMembers: int("maxMembers").notNull().default(5),
  currentMembers: int("currentMembers").notNull().default(0),
  createdBy: int("createdBy"), // memberId of the student who created the group
  createdByName: varchar("createdByName", { length: 200 }),
  isActive: int("isActive").notNull().default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type JigsawGroup = typeof jigsawGroups.$inferSelect;
export type InsertJigsawGroup = typeof jigsawGroups.$inferInsert;

/**
 * Jigsaw Members - students in jigsaw groups
 */
export const jigsawMembers = mysqlTable("jigsawMembers", {
  id: int("id").autoincrement().primaryKey(),
  jigsawGroupId: int("jigsawGroupId").notNull(),
  memberId: int("memberId").notNull(),
  memberName: varchar("memberName", { length: 200 }).notNull(),
  role: mysqlEnum("role", ["coordinator", "reporter", "researcher", "member"]).default("member").notNull(),
  joinedAt: timestamp("joinedAt").defaultNow().notNull(),
});

export type JigsawMember = typeof jigsawMembers.$inferSelect;
export type InsertJigsawMember = typeof jigsawMembers.$inferInsert;


/**
 * Import History - records of UNIRIO imports with timestamps and details
 * Tracks each import operation for audit and monitoring purposes
 */
export const importHistory = mysqlTable("importHistory", {
  id: int("id").autoincrement().primaryKey(),
  classId: int("classId").notNull(), // Link to the class (turma)
  importedBy: int("importedBy"), // userId of admin who triggered import
  importedByName: varchar("importedByName", { length: 200 }),
  totalStudents: int("totalStudents").notNull().default(0), // Total students imported
  successCount: int("successCount").notNull().default(0), // Successfully imported
  errorCount: int("errorCount").notNull().default(0), // Failed to import
  errors: text("errors"), // JSON array of error messages
  status: mysqlEnum("status", ["pending", "in_progress", "completed", "failed"]).default("pending").notNull(),
  source: varchar("source", { length: 50 }).default("unirio").notNull(), // e.g., "unirio", "manual", "csv"
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
  notes: text("notes"), // Additional notes about the import
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ImportHistory = typeof importHistory.$inferSelect;
export type InsertImportHistory = typeof importHistory.$inferInsert;


/**
 * System Settings - Global configuration for the platform
 * Stores general settings like course name, semester, schedule, etc.
 */
export const systemSettings = mysqlTable("systemSettings", {
  id: int("id").autoincrement().primaryKey(),
  courseName: varchar("courseName", { length: 255 }).notNull().default("Farmacologia I"),
  semester: varchar("semester", { length: 50 }).notNull().default("2026.1"),
  academicYear: varchar("academicYear", { length: 50 }).notNull().default("2026"),
  institution: varchar("institution", { length: 255 }).notNull().default("UNIRIO"),
  department: varchar("department", { length: 255 }).notNull().default("Farmacologia"),
  startDate: varchar("startDate", { length: 20 }),
  endDate: varchar("endDate", { length: 20 }),
  totalWeeks: int("totalWeeks").notNull().default(17),
  schedule: text("schedule"), // JSON with weekly schedule
  description: text("description"),
  logoUrl: varchar("logoUrl", { length: 500 }),
  primaryColor: varchar("primaryColor", { length: 7 }).default("#FF9500"), // Hex color
  secondaryColor: varchar("secondaryColor", { length: 7 }).default("#1A1A2E"),
  updatedBy: int("updatedBy"),
  updatedByName: varchar("updatedByName", { length: 200 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type SystemSettings = typeof systemSettings.$inferSelect;
export type InsertSystemSettings = typeof systemSettings.$inferInsert;

/**
 * Backup Records - Track all backups for recovery purposes
 * Stores metadata about each backup operation
 */
export const backupRecords = mysqlTable("backupRecords", {
  id: int("id").autoincrement().primaryKey(),
  backupName: varchar("backupName", { length: 255 }).notNull(),
  backupType: mysqlEnum("backupType", ["full", "partial", "incremental"]).default("full").notNull(),
  status: mysqlEnum("status", ["pending", "in_progress", "completed", "failed"]).default("pending").notNull(),
  fileSize: int("fileSize"), // Size in bytes
  fileUrl: varchar("fileUrl", { length: 500 }), // URL to download backup
  fileKey: varchar("fileKey", { length: 500 }), // S3 key for backup file
  totalRecords: int("totalRecords").notNull().default(0),
  recordsIncluded: text("recordsIncluded"), // JSON array of record types included
  createdBy: int("createdBy").notNull(),
  createdByName: varchar("createdByName", { length: 200 }),
  notes: text("notes"),
  errorMessage: text("errorMessage"),
  expiresAt: timestamp("expiresAt"), // When backup will be deleted
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
});
export type BackupRecord = typeof backupRecords.$inferSelect;
export type InsertBackupRecord = typeof backupRecords.$inferInsert;

/**
 * Restore History - Track all restore operations
 */
export const restoreHistory = mysqlTable("restoreHistory", {
  id: int("id").autoincrement().primaryKey(),
  backupId: int("backupId").notNull().references(() => backupRecords.id),
  status: mysqlEnum("status", ["pending", "in_progress", "completed", "failed"]).default("pending").notNull(),
  recordsRestored: int("recordsRestored").notNull().default(0),
  recordsFailed: int("recordsFailed").notNull().default(0),
  restoredBy: int("restoredBy").notNull(),
  restoredByName: varchar("restoredByName", { length: 200 }),
  notes: text("notes"),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
});
export type RestoreHistory = typeof restoreHistory.$inferSelect;
export type InsertRestoreHistory = typeof restoreHistory.$inferInsert;


/**
 * ========================================
 * JIGSAW METHOD - COOPERATIVE LEARNING
 * ========================================
 * Tables for implementing the complete Jigsaw method:
 * - Expert Groups: Students study one topic in depth
 * - Home Groups (Jigsaw): Students teach each other all topics
 * - Scoring: Individual and group evaluation
 */

/**
 * Jigsaw Topics - The 6 topics for expert groups
 */
export const jigsawTopics = mysqlTable("jigsawTopics", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  articleUrl: varchar("articleUrl", { length: 500 }),
  articleTitle: varchar("articleTitle", { length: 300 }),
  articleAuthors: varchar("articleAuthors", { length: 300 }),
  articleYear: int("articleYear"),
  keyPoints: text("keyPoints"), // JSON array of key points
  studyDuration: int("studyDuration").notNull().default(5), // hours
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type JigsawTopic = typeof jigsawTopics.$inferSelect;
export type InsertJigsawTopic = typeof jigsawTopics.$inferInsert;

/**
 * Jigsaw Expert Groups - Groups of students studying one topic
 */
export const jigsawExpertGroups = mysqlTable("jigsawExpertGroups", {
  id: int("id").autoincrement().primaryKey(),
  classId: int("classId").notNull(),
  topicId: int("topicId").notNull().references(() => jigsawTopics.id),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  maxMembers: int("maxMembers").notNull().default(14),
  status: mysqlEnum("status", ["forming", "active", "presenting", "completed"]).default("forming").notNull(),
  presentationDate: timestamp("presentationDate"),
  presentationNotes: text("presentationNotes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type JigsawExpertGroup = typeof jigsawExpertGroups.$inferSelect;
export type InsertJigsawExpertGroup = typeof jigsawExpertGroups.$inferInsert;

/**
 * Jigsaw Expert Members - Students in expert groups
 */
export const jigsawExpertMembers = mysqlTable("jigsawExpertMembers", {
  id: int("id").autoincrement().primaryKey(),
  expertGroupId: int("expertGroupId").notNull().references(() => jigsawExpertGroups.id, { onDelete: "cascade" }),
  memberId: int("memberId").notNull().references(() => members.id, { onDelete: "cascade" }),
  role: mysqlEnum("role", ["member", "coordinator", "presenter"]).default("member").notNull(),
  presentationScore: decimal("presentationScore", { precision: 3, scale: 1 }).default("0"), // 0-5
  participationScore: decimal("participationScore", { precision: 3, scale: 1 }).default("0"), // 0-2
  readingProgress: int("readingProgress").default(0), // 0-100%
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type JigsawExpertMember = typeof jigsawExpertMembers.$inferSelect;
export type InsertJigsawExpertMember = typeof jigsawExpertMembers.$inferInsert;

/**
 * Jigsaw Home Groups - Groups where students teach each other (Jigsaw groups)
 */
export const jigsawHomeGroups = mysqlTable("jigsawHomeGroups", {
  id: int("id").autoincrement().primaryKey(),
  classId: int("classId").notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  meetingNumber: int("meetingNumber").notNull(), // 1st, 2nd, 3rd, 4th, 5th Jigsaw meeting
  meetingDate: timestamp("meetingDate"),
  status: mysqlEnum("status", ["forming", "active", "completed"]).default("forming").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type JigsawHomeGroup = typeof jigsawHomeGroups.$inferSelect;
export type InsertJigsawHomeGroup = typeof jigsawHomeGroups.$inferInsert;

/**
 * Jigsaw Home Members - Students in home groups (Jigsaw groups)
 * Each student brings expertise from one topic and learns from others
 */
export const jigsawHomeMembers = mysqlTable("jigsawHomeMembers", {
  id: int("id").autoincrement().primaryKey(),
  homeGroupId: int("homeGroupId").notNull().references(() => jigsawHomeGroups.id, { onDelete: "cascade" }),
  memberId: int("memberId").notNull().references(() => members.id, { onDelete: "cascade" }),
  topicId: int("topicId").notNull().references(() => jigsawTopics.id), // Topic this student teaches
  presentationScore: decimal("presentationScore", { precision: 3, scale: 1 }).default("0"), // 0-5
  participationScore: decimal("participationScore", { precision: 3, scale: 1 }).default("0"), // 0-2
  peerRating: decimal("peerRating", { precision: 3, scale: 1 }).default("0"), // 0-5 (peer evaluation)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type JigsawHomeMember = typeof jigsawHomeMembers.$inferSelect;
export type InsertJigsawHomeMember = typeof jigsawHomeMembers.$inferInsert;

/**
 * Jigsaw Scores - Aggregated scores for each student
 */
export const jigsawScores = mysqlTable("jigsawScores", {
  id: int("id").autoincrement().primaryKey(),
  memberId: int("memberId").notNull().references(() => members.id, { onDelete: "cascade" }),
  classId: int("classId").notNull(),
  expertGroupId: int("expertGroupId").references(() => jigsawExpertGroups.id), // Expert group they participated in
  homeGroupIds: text("homeGroupIds"), // JSON array of home group IDs
  totalPresentationScore: decimal("totalPresentationScore", { precision: 5, scale: 1 }).default("0"),
  totalParticipationScore: decimal("totalParticipationScore", { precision: 5, scale: 1 }).default("0"),
  totalPeerRating: decimal("totalPeerRating", { precision: 5, scale: 1 }).default("0"),
  // Notas normalizadas por fase (escala 0-10 total)
  fase1PF: decimal("fase1PF", { precision: 5, scale: 2 }).default("0"),   // Fase 1 normalizada (0-2 pts)
  fase2PF: decimal("fase2PF", { precision: 5, scale: 2 }).default("0"),   // Fase 2 normalizada (0-5 pts)
  fase3PF: decimal("fase3PF", { precision: 5, scale: 2 }).default("0"),   // Fase 3 Casos Clínicos (0-3 pts)
  totalJigsawPF: decimal("totalJigsawPF", { precision: 6, scale: 2 }).default("0"), // Total PF Jigsaw (0-10 pts)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type JigsawScore = typeof jigsawScores.$inferSelect;
export type InsertJigsawScore = typeof jigsawScores.$inferInsert;


/**
 * Assessments - Theoretical evaluation activities with lockdown
 */
export const assessments = mysqlTable("assessments", {
  id: int("id").autoincrement().primaryKey(),
  classId: int("classId").notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  type: mysqlEnum("type", ["multiple_choice", "essay", "mixed"]).default("multiple_choice").notNull(),
  totalQuestions: int("totalQuestions").notNull().default(0),
  timePerQuestion: int("timePerQuestion").notNull().default(120), // seconds (default 2 minutes)
  allowRetrocess: boolean("allowRetrocess").notNull().default(false), // false = no going back
  enableLockdown: boolean("enableLockdown").notNull().default(true), // Prevent tab switching
  passingScore: decimal("passingScore", { precision: 5, scale: 1 }).notNull().default("60"), // percentage
  maxAttempts: int("maxAttempts").notNull().default(1),
  scheduledAt: timestamp("scheduledAt"),
  startsAt: timestamp("startsAt"),
  endsAt: timestamp("endsAt"),
  status: mysqlEnum("status", ["draft", "published", "active", "closed"]).default("draft").notNull(),
  createdBy: int("createdBy").notNull(), // teacherAccountId
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Assessment = typeof assessments.$inferSelect;
export type InsertAssessment = typeof assessments.$inferInsert;

/**
 * Assessment Questions
 */
export const assessmentQuestions = mysqlTable("assessmentQuestions", {
  id: int("id").autoincrement().primaryKey(),
  assessmentId: int("assessmentId").notNull().references(() => assessments.id, { onDelete: "cascade" }),
  questionNumber: int("questionNumber").notNull(),
  question: text("question").notNull(),
  questionType: mysqlEnum("questionType", ["multiple_choice", "essay", "true_false"]).notNull(),
  options: text("options"), // JSON array for multiple choice
  correctAnswer: text("correctAnswer"), // JSON for multiple answers or essay rubric
  points: decimal("points", { precision: 5, scale: 1 }).notNull().default("1"),
  explanation: text("explanation"), // Feedback after submission
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type AssessmentQuestion = typeof assessmentQuestions.$inferSelect;
export type InsertAssessmentQuestion = typeof assessmentQuestions.$inferInsert;

/**
 * Assessment Submissions - Student responses to assessments
 */
export const assessmentSubmissions = mysqlTable("assessmentSubmissions", {
  id: int("id").autoincrement().primaryKey(),
  assessmentId: int("assessmentId").notNull().references(() => assessments.id, { onDelete: "cascade" }),
  memberId: int("memberId").notNull().references(() => members.id, { onDelete: "cascade" }),
  attemptNumber: int("attemptNumber").notNull().default(1),
  startedAt: timestamp("startedAt").notNull(),
  submittedAt: timestamp("submittedAt"),
  score: decimal("score", { precision: 5, scale: 1 }), // Final score
  percentage: decimal("percentage", { precision: 5, scale: 1 }), // Percentage score
  passed: boolean("passed"), // true if >= passingScore
  status: mysqlEnum("status", ["in_progress", "submitted", "graded"]).default("in_progress").notNull(),
  ipAddress: varchar("ipAddress", { length: 45 }), // IPv4 or IPv6
  userAgent: text("userAgent"), // Browser info
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type AssessmentSubmission = typeof assessmentSubmissions.$inferSelect;
export type InsertAssessmentSubmission = typeof assessmentSubmissions.$inferInsert;

/**
 * Assessment Answers - Individual question responses
 */
export const assessmentAnswers = mysqlTable("assessmentAnswers", {
  id: int("id").autoincrement().primaryKey(),
  submissionId: int("submissionId").notNull().references(() => assessmentSubmissions.id, { onDelete: "cascade" }),
  questionId: int("questionId").notNull().references(() => assessmentQuestions.id, { onDelete: "cascade" }),
  answer: text("answer").notNull(), // Student's response
  isCorrect: boolean("isCorrect"), // true if correct
  pointsEarned: decimal("pointsEarned", { precision: 5, scale: 1 }), // Points for this question
  answeredAt: timestamp("answeredAt").notNull(),
  timeSpent: int("timeSpent"), // seconds spent on this question
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AssessmentAnswer = typeof assessmentAnswers.$inferSelect;
export type InsertAssessmentAnswer = typeof assessmentAnswers.$inferInsert;

/**
 * Assessment Logs - Monitoring and security logs
 */
export const assessmentLogs = mysqlTable("assessmentLogs", {
  id: int("id").autoincrement().primaryKey(),
  submissionId: int("submissionId").notNull().references(() => assessmentSubmissions.id, { onDelete: "cascade" }),
  eventType: mysqlEnum("eventType", [
    "focus_lost", // User left the tab/window
    "focus_regained", // User returned to the tab
    "tab_switched", // Attempted to switch tabs
    "window_minimized", // Window was minimized
    "copy_attempt", // Attempted to copy content
    "right_click", // Right-click attempt
    "keyboard_shortcut", // Suspicious keyboard shortcut
    "network_issue", // Connection lost
    "suspicious_activity", // Other suspicious activity
    "question_answered", // Question submitted
    "time_warning", // Time warning issued
    "submission_started", // Assessment started
    "submission_completed", // Assessment completed
  ]).notNull(),
  details: text("details"), // JSON with additional info
  severity: mysqlEnum("severity", ["info", "warning", "critical"]).default("info").notNull(),
  flagged: boolean("flagged").notNull().default(false), // Requires review
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});
export type AssessmentLog = typeof assessmentLogs.$inferSelect;
export type InsertAssessmentLog = typeof assessmentLogs.$inferInsert;

/**
 * Assessment IP Blocks - Prevent multiple simultaneous access from same IP
 */
export const assessmentIPBlocks = mysqlTable("assessmentIPBlocks", {
  id: int("id").autoincrement().primaryKey(),
  assessmentId: int("assessmentId").notNull().references(() => assessments.id, { onDelete: "cascade" }),
  ipAddress: varchar("ipAddress", { length: 45 }).notNull(),
  memberId: int("memberId").notNull().references(() => members.id, { onDelete: "cascade" }),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt").notNull(), // Lock expires after assessment ends
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AssessmentIPBlock = typeof assessmentIPBlocks.$inferSelect;
export type InsertAssessmentIPBlock = typeof assessmentIPBlocks.$inferInsert;


/**
 * Question Bank - Reusable questions for assessments
 */
export const questionBank = mysqlTable("questionBank", {
  id: int("id").autoincrement().primaryKey(),
  createdBy: int("createdBy").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 100 }).notNull(), // e.g., "Farmacocinética", "SNA", "Colinérgicos"
  tags: text("tags"), // JSON array of tags for filtering
  questionText: text("questionText").notNull(),
  questionType: mysqlEnum("questionType", ["multiple_choice", "essay", "true_false"]).default("multiple_choice").notNull(),
  
  // Multiple choice specific fields
  alternatives: text("alternatives"), // JSON array with 5 alternatives: [{ text: string, isCorrect: boolean, explanation?: string }]
  correctAnswer: varchar("correctAnswer", { length: 255 }), // For essay/true-false
  
  // Media
  imageUrl: text("imageUrl"), // URL to question image
  formulaLatex: text("formulaLatex"), // LaTeX formula if applicable
  
  // Metadata
  difficulty: mysqlEnum("difficulty", ["easy", "medium", "hard"]).default("medium").notNull(),
  points: int("points").notNull().default(1),
  estimatedTime: int("estimatedTime"), // seconds
  
  // Statistics
  timesUsed: int("timesUsed").notNull().default(0),
  correctRate: decimal("correctRate", { precision: 5, scale: 2 }).default("0"), // percentage
  
  // Status
  isActive: boolean("isActive").notNull().default(true),
  isPublished: boolean("isPublished").notNull().default(false), // Can be used in assessments
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type QuestionBank = typeof questionBank.$inferSelect;
export type InsertQuestionBank = typeof questionBank.$inferInsert;

/**
 * Assessment Questions - Link between assessments and questions
 */
export const assessmentQuestionLinks = mysqlTable("assessmentQuestionLinks", {
  id: int("id").autoincrement().primaryKey(),
  assessmentId: int("assessmentId").notNull().references(() => assessments.id, { onDelete: "cascade" }),
  questionId: int("questionId").notNull().references(() => questionBank.id, { onDelete: "cascade" }),
  order: int("order").notNull(), // Question order in assessment
  points: int("points").notNull().default(1), // Points for this question
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AssessmentQuestionLink = typeof assessmentQuestionLinks.$inferSelect;
export type InsertAssessmentQuestionLink = typeof assessmentQuestionLinks.$inferInsert;

/**
 * Question Performance - Track performance metrics for each question
 */
export const questionPerformance = mysqlTable("questionPerformance", {
  id: int("id").autoincrement().primaryKey(),
  questionId: int("questionId").notNull().references(() => questionBank.id, { onDelete: "cascade" }),
  assessmentId: int("assessmentId").notNull().references(() => assessments.id, { onDelete: "cascade" }),
  memberId: int("memberId").notNull().references(() => members.id, { onDelete: "cascade" }),
  isCorrect: boolean("isCorrect").notNull(),
  timeSpent: int("timeSpent"), // seconds
  attemptNumber: int("attemptNumber").notNull().default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type QuestionPerformance = typeof questionPerformance.$inferSelect;
export type InsertQuestionPerformance = typeof questionPerformance.$inferInsert;


/**
 * Game Progress - Track player progress in the Caverna do Dragão game
 */
export const gameProgress = mysqlTable("gameProgress", {
  id: int("id").autoincrement().primaryKey(),
  memberId: int("memberId").notNull().references(() => members.id, { onDelete: "cascade" }),
  classId: int("classId").notNull().references(() => classes.id, { onDelete: "cascade" }),
  
  // Game Stats
  level: int("level").notNull().default(1), // 1-10 levels to complete Farmacologia I
  farmacologiaPoints: int("farmacologiaPoints").notNull().default(0), // PF (Pontos de Farmacologia)
  experience: int("experience").notNull().default(0),
  
  // Progress
  questsCompleted: int("questsCompleted").notNull().default(0),
  questsTotal: int("questsTotal").notNull().default(0),
  currentQuestId: int("currentQuestId"), // Current active quest
  
  // Combat Stats
  totalCombats: int("totalCombats").notNull().default(0),
  combatsWon: int("combatsWon").notNull().default(0),
  combatsLost: int("combatsLost").notNull().default(0),
  
  // Achievements
  achievements: text("achievements").default("[]"), // JSON array of achievement IDs
  
  // Status
  isCompleted: boolean("isCompleted").notNull().default(false), // Completed Farmacologia I
  lastPlayedAt: timestamp("lastPlayedAt"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type GameProgress = typeof gameProgress.$inferSelect;
export type InsertGameProgress = typeof gameProgress.$inferInsert;

/**
 * Game Quests - Define quests/challenges in the game
 */
export const gameQuests = mysqlTable("gameQuests", {
  id: int("id").autoincrement().primaryKey(),
  classId: int("classId").notNull().references(() => classes.id, { onDelete: "cascade" }),
  
  // Quest Info
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  npcName: varchar("npcName", { length: 100 }).notNull(), // NPC that gives quest
  npcType: mysqlEnum("npcType", ["merchant", "warrior", "mage", "healer", "boss"]).notNull(),
  
  // Quest Details
  level: int("level").notNull(), // Required level to start
  questType: mysqlEnum("questType", ["combat", "puzzle", "dialogue", "collection"]).notNull(),
  
  // Rewards
  farmacologiaPointsReward: int("farmacologiaPointsReward").notNull().default(10),
  experienceReward: int("experienceReward").notNull().default(100),
  
  // Combat Quest
  questionId: int("questionId").references(() => questionBank.id, { onDelete: "set null" }),
  difficulty: mysqlEnum("difficulty", ["easy", "medium", "hard"]).default("medium").notNull(),
  
  // Status
  isActive: boolean("isActive").notNull().default(true),
  order: int("order").notNull(), // Order in game progression
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type GameQuest = typeof gameQuests.$inferSelect;
export type InsertGameQuest = typeof gameQuests.$inferInsert;

/**
 * Game Combats - Track individual combat encounters
 */
export const gameCombats = mysqlTable("gameCombats", {
  id: int("id").autoincrement().primaryKey(),
  gameProgressId: int("gameProgressId").notNull().references(() => gameProgress.id, { onDelete: "cascade" }),
  questId: int("questId").notNull().references(() => gameQuests.id, { onDelete: "cascade" }),
  questionId: int("questionId").notNull().references(() => questionBank.id, { onDelete: "cascade" }),
  
  // Combat Result
  playerAnswer: varchar("playerAnswer", { length: 500 }),
  correctAnswer: varchar("correctAnswer", { length: 500 }),
  isWon: boolean("isWon").notNull(),
  farmacologiaPointsEarned: int("farmacologiaPointsEarned").notNull().default(0),
  
  // Timing
  timeSpent: int("timeSpent").notNull(), // seconds
  attemptNumber: int("attemptNumber").notNull().default(1),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type GameCombat = typeof gameCombats.$inferSelect;
export type InsertGameCombat = typeof gameCombats.$inferInsert;

/**
 * Game Achievements - Badges and achievements in the game
 */
export const gameAchievements = mysqlTable("gameAchievements", {
  id: int("id").autoincrement().primaryKey(),
  
  // Achievement Info
  title: varchar("title", { length: 100 }).notNull(),
  description: text("description"),
  icon: varchar("icon", { length: 100 }), // Icon name or URL
  
  // Unlock Condition
  condition: varchar("condition", { length: 200 }).notNull(), // e.g., "level_5", "win_10_combats"
  
  // Reward
  farmacologiaPointsBonus: int("farmacologiaPointsBonus").notNull().default(0),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type GameAchievement = typeof gameAchievements.$inferSelect;
export type InsertGameAchievement = typeof gameAchievements.$inferInsert;


/**
 * QR Code Sessions - Presença com QR Code
 * Professor pode ativar presença por dia da semana e horário
 */
export const qrCodeSessions = mysqlTable("qrCodeSessions", {
  id: int("id").autoincrement().primaryKey(),
  classId: int("classId").notNull(), // Turma
  teacherId: int("teacherId").notNull(), // Professor que criou
  
  // Configuração de dia e horário
  dayOfWeek: int("dayOfWeek").notNull(), // 0-6 (domingo a sábado)
  startTime: varchar("startTime", { length: 5 }).notNull(), // HH:MM
  endTime: varchar("endTime", { length: 5 }).notNull(), // HH:MM
  
  // Semana do semestre (1-17) — calculada automaticamente ao criar a sessão
  weekNumber: int("weekNumber").notNull().default(1),

  // Status
  isActive: boolean("isActive").notNull().default(true),
  
  // QR Code data (será gerado dinamicamente)
  qrCodeData: text("qrCodeData"), // JSON com dados da sessão
  
  // Token rotativo para anti-fraude
  currentToken: varchar("currentToken", { length: 128 }), // Token HMAC atual
  tokenExpiresAt: timestamp("tokenExpiresAt"), // Expiração do token (10 min)
  tokenRotationCount: int("tokenRotationCount").notNull().default(0), // Contador de rotações
  
  // Geolocalização da sala de aula (configurada pelo professor)
  geoLatitude: decimal("geoLatitude", { precision: 10, scale: 7 }),  // Latitude da sala
  geoLongitude: decimal("geoLongitude", { precision: 10, scale: 7 }), // Longitude da sala
  geoRadiusMeters: int("geoRadiusMeters").notNull().default(150), // Raio permitido em metros (padrão: 150m)
  geoValidationEnabled: boolean("geoValidationEnabled").notNull().default(true), // Habilitar validação GPS
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type QRCodeSession = typeof qrCodeSessions.$inferSelect;
export type InsertQRCodeSession = typeof qrCodeSessions.$inferInsert;

/**
 * Attendance Records - Registros de presença via QR Code
 */
export const attendanceRecords = mysqlTable("attendanceRecords", {
  id: int("id").autoincrement().primaryKey(),
  qrCodeSessionId: int("qrCodeSessionId").notNull(),
  memberId: int("memberId").notNull(), // Aluno
  classId: int("classId").notNull(), // Turma
  
  // Timestamp do check-in
  checkedInAt: timestamp("checkedInAt").defaultNow().notNull(),
  
  // Validação
  isValid: boolean("isValid").notNull().default(true),
  validationNotes: text("validationNotes"), // Notas do professor se inválido
  
  // Geolocalização do aluno no momento do check-in
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  distanceMeters: decimal("distanceMeters", { precision: 8, scale: 2 }), // Distância da sala em metros
  geoStatus: mysqlEnum("geoStatus", ["valid", "invalid", "no_gps", "disabled"]).default("no_gps"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AttendanceRecord = typeof attendanceRecords.$inferSelect;
export type InsertAttendanceRecord = typeof attendanceRecords.$inferInsert;

/**
 * Attendance Summary - Resumo de presença por aluno
 */
export const attendanceSummary = mysqlTable("attendanceSummary", {
  id: int("id").autoincrement().primaryKey(),
  memberId: int("memberId").notNull(),
  classId: int("classId").notNull(),
  
  // Contadores
  totalSessions: int("totalSessions").notNull().default(0),
  presentSessions: int("presentSessions").notNull().default(0),
  absentSessions: int("absentSessions").notNull().default(0),
  
  // Percentual
  attendancePercentage: decimal("attendancePercentage", { precision: 5, scale: 2 }).notNull().default("0"),
  
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AttendanceSummary = typeof attendanceSummary.$inferSelect;
export type InsertAttendanceSummary = typeof attendanceSummary.$inferInsert;



/**
 * Game Missions - Missões do jogo (configuradas pelo professor)
 */
export const gameMissions = mysqlTable("gameMissions", {
  id: int("id").autoincrement().primaryKey(),
  weekNumber: int("weekNumber").notNull(), // Semana do cronograma (1-16)
  classId: int("classId").notNull(),
  
  // Conteúdo da missão
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description").notNull(),
  pharmacologyTopic: varchar("pharmacologyTopic", { length: 200 }).notNull(), // Tema de farmacologia
  
  // Caso clínico
  clinicalCase: json("clinicalCase").$type<{
    patientName: string;
    symptoms: string[];
    history: string;
    question: string;
  }>().notNull(),
  
  // Opções de decisão
  decisions: json("decisions").$type<{
    id: string;
    text: string;
    isCorrect: boolean;
    feedback: string;
    pfReward: number;
  }[]>().notNull(),
  
  // Dificuldade e recompensas
  difficulty: int("difficulty").notNull().default(1), // 1-5
  pfReward: int("pfReward").notNull().default(10),
  
  // Dicas disponíveis (custam PF para desbloquear)
  hints: json("hints").$type<{
    id: number;
    text: string;
    pfCost: number;
  }[]>().notNull().default([]),
  
  isActive: boolean("isActive").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type GameMission = typeof gameMissions.$inferSelect;
export type InsertGameMission = typeof gameMissions.$inferInsert;

/**
 * Oracle Messages - Mensagens do Oráculo Professor Pedro
 */
export const oracleMessages = mysqlTable("oracleMessages", {
  id: int("id").autoincrement().primaryKey(),
  missionId: int("missionId").notNull(),
  
  // Tipo de mensagem
  triggerType: varchar("triggerType", { length: 50 }).notNull(), // "start", "hint", "correct", "wrong", "complete"
  
  // Conteúdo
  message: text("message").notNull(),
  audioUrl: varchar("audioUrl", { length: 500 }), // URL do áudio (opcional)
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type OracleMessage = typeof oracleMessages.$inferSelect;
export type InsertOracleMessage = typeof oracleMessages.$inferInsert;


/**
 * Game Transactions - Audit trail for all PF transactions
 */
export const gameTransactions = mysqlTable("gameTransactions", {
  id: int("id").autoincrement().primaryKey(),
  memberId: int("memberId").notNull().references(() => members.id, { onDelete: "cascade" }),
  classId: int("classId").notNull().references(() => classes.id, { onDelete: "cascade" }),
  
  pfAmount: int("pfAmount").notNull(), // Positive for gains, negative for spending
  transactionType: varchar("transactionType", { length: 50 }).notNull(), // "mission_complete", "hint_used", "quest_reward", etc.
  missionId: int("missionId"), // Optional reference to mission
  description: text("description"), // Human-readable description
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type GameTransaction = typeof gameTransactions.$inferSelect;
export type InsertGameTransaction = typeof gameTransactions.$inferInsert;


/**
 * Game Weekly Releases - Professor controls which quests are available each week
 */
export const gameWeeklyReleases = mysqlTable("gameWeeklyReleases", {
  id: int("id").autoincrement().primaryKey(),
  classId: int("classId").notNull().references(() => classes.id, { onDelete: "cascade" }),
  
  weekNumber: int("weekNumber").notNull(), // 1-16
  questIds: text("questIds").notNull().default("[]"), // JSON array of quest IDs released this week
  title: varchar("title", { length: 200 }), // e.g., "Semana 3 - Farmacodinâmica"
  description: text("description"), // Description of what's released
  
  isReleased: boolean("isReleased").notNull().default(false), // Professor must explicitly release
  releasedAt: timestamp("releasedAt"), // When it was released
  releasedBy: int("releasedBy"), // Teacher account ID who released it
  scheduledReleaseDate: timestamp("scheduledReleaseDate"), // Auto-release on this date/time
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type GameWeeklyRelease = typeof gameWeeklyReleases.$inferSelect;
export type InsertGameWeeklyRelease = typeof gameWeeklyReleases.$inferInsert;

/**
 * Player Avatars - Custom avatar configurations
 */
export const playerAvatars = mysqlTable("playerAvatars", {
  id: int("id").autoincrement().primaryKey(),
  memberId: int("memberId").notNull().references(() => members.id, { onDelete: "cascade" }),
  
  // Selected character or custom
  characterId: varchar("characterId", { length: 50 }), // "hank", "eric", etc. or "custom"
  
  // Custom avatar options
  skinTone: varchar("skinTone", { length: 50 }),
  hairStyle: varchar("hairStyle", { length: 50 }),
  hairColor: varchar("hairColor", { length: 50 }),
  clothingColor: varchar("clothingColor", { length: 50 }),
  accessory: varchar("accessory", { length: 50 }),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type PlayerAvatar = typeof playerAvatars.$inferSelect;
export type InsertPlayerAvatar = typeof playerAvatars.$inferInsert;

/**
 * Game Error Reports - Students can report errors/doubts about questions
 */
export const gameErrorReports = mysqlTable("gameErrorReports", {
  id: int("id").autoincrement().primaryKey(),
  memberId: int("memberId").notNull().references(() => members.id, { onDelete: "cascade" }),
  classId: int("classId").notNull().references(() => classes.id, { onDelete: "cascade" }),
  questId: int("questId").references(() => gameQuests.id, { onDelete: "set null" }),
  
  reportType: mysqlEnum("reportType", ["error", "doubt", "suggestion"]).notNull().default("error"),
  description: text("description").notNull(),
  
  status: mysqlEnum("status", ["pending", "reviewed", "resolved", "dismissed"]).notNull().default("pending"),
  teacherResponse: text("teacherResponse"),
  resolvedBy: int("resolvedBy"), // Teacher account ID
  resolvedAt: timestamp("resolvedAt"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type GameErrorReport = typeof gameErrorReports.$inferSelect;
export type InsertGameErrorReport = typeof gameErrorReports.$inferInsert;

/**
 * Boss Battles - Records of boss encounters at the end of each week's missions
 */
export const bossBattles = mysqlTable("bossBattles", {
  id: int("id").autoincrement().primaryKey(),
  memberId: int("memberId").notNull().references(() => members.id, { onDelete: "cascade" }),
  classId: int("classId").notNull().references(() => classes.id, { onDelete: "cascade" }),
  weekNumber: int("weekNumber").notNull(),
  
  isVictory: boolean("isVictory").notNull().default(false),
  bossName: varchar("bossName", { length: 100 }).notNull(),
  totalDamageDealt: int("totalDamageDealt").notNull().default(0),
  playerHpRemaining: int("playerHpRemaining").notNull().default(0),
  phasesCompleted: int("phasesCompleted").notNull().default(0),
  totalPhases: int("totalPhases").notNull().default(3),
  comboMax: int("comboMax").notNull().default(0),
  pfEarned: int("pfEarned").notNull().default(0),
  xpEarned: int("xpEarned").notNull().default(0),
  totalTimeSpent: int("totalTimeSpent").notNull().default(0),
  attemptNumber: int("attemptNumber").notNull().default(1),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type BossBattle = typeof bossBattles.$inferSelect;
export type InsertBossBattle = typeof bossBattles.$inferInsert;


/**
 * Student Notifications - Individual notifications for students
 * Used for team allocation alerts, grade updates, reminders, etc.
 */
export const studentNotifications = mysqlTable("studentNotifications", {
  id: int("id").autoincrement().primaryKey(),
  memberId: int("memberId").notNull(), // Target student (member)
  classId: int("classId"), // Optional: related class
  
  // Notification content
  title: varchar("title", { length: 300 }).notNull(),
  message: text("message").notNull(),
  type: mysqlEnum("type", ["team_allocation", "grade_update", "attendance", "announcement", "reminder"]).notNull(),
  priority: mysqlEnum("priority", ["low", "normal", "high"]).default("normal").notNull(),
  
  // Related entity (e.g., jigsawGroupId, teamId)
  relatedEntityType: varchar("relatedEntityType", { length: 50 }), // e.g., "jigsaw_group", "team"
  relatedEntityId: int("relatedEntityId"),
  
  // Read status
  isRead: boolean("isRead").notNull().default(false),
  readAt: timestamp("readAt"),
  
  // Dismissal
  isDismissed: boolean("isDismissed").notNull().default(false),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type StudentNotification = typeof studentNotifications.$inferSelect;
export type InsertStudentNotification = typeof studentNotifications.$inferInsert;


/**
 * Notification Preferences - Student notification settings
 * Stores user preferences for notifications, quiet hours, and notification types
 */
export const notificationPreferences = mysqlTable("notificationPreferences", {
  id: int("id").autoincrement().primaryKey(),
  memberId: int("memberId").notNull().unique(),
  
  // Global enable/disable
  enabled: boolean("enabled").notNull().default(true),
  
  // Enabled notification types (JSON array)
  enabledTypes: text("enabledTypes").notNull().default(JSON.stringify(["team_allocation", "grade_update", "announcement", "reminder", "attendance"])),
  
  // Quiet hours (24-hour format, 0-23)
  quietHoursStart: int("quietHoursStart").notNull().default(22),
  quietHoursEnd: int("quietHoursEnd").notNull().default(8),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type NotificationPreference = typeof notificationPreferences.$inferSelect;
export type InsertNotificationPreference = typeof notificationPreferences.$inferInsert;


// Activity system tables already exist: activityTemplates, activitySubmissions

/**
 * Student Activities - Atividades disponíveis para alunos
 * Armazena atividades criadas pelos professores
 */
export const studentActivities = mysqlTable("studentActivities", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  type: varchar("type", { length: 50 }).notNull(), // "essay", "quiz", "project", "presentation", etc
  maxXP: decimal("maxXP", { precision: 5, scale: 2 }).notNull().default("10"),
  dueDate: timestamp("dueDate"),
  createdBy: int("createdBy").notNull(), // teacher ID
  isActive: boolean("isActive").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type StudentActivity = typeof studentActivities.$inferSelect;
export type InsertStudentActivity = typeof studentActivities.$inferInsert;

/**
 * Activity Submissions - Submissões de alunos para atividades
 * Armazena as respostas dos alunos e feedback do professor
 */
export const activitySubmissions = mysqlTable("activitySubmissions", {
  id: int("id").autoincrement().primaryKey(),
  activityId: int("activityId").notNull(),
  memberId: int("memberId").notNull(),
  content: text("content"), // Texto da resposta
  fileUrl: varchar("fileUrl", { length: 500 }), // URL do arquivo enviado
  linkUrl: varchar("linkUrl", { length: 500 }), // Link enviado
  status: varchar("status", { length: 50 }).notNull().default("submitted"), // "submitted", "reviewed", "graded"
  xpAwarded: decimal("xpAwarded", { precision: 5, scale: 2 }).default("0"),
  feedback: text("feedback"), // Feedback do professor
  feedbackBy: int("feedbackBy"), // ID do professor que deu feedback
  submittedAt: timestamp("submittedAt").defaultNow().notNull(),
  reviewedAt: timestamp("reviewedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type ActivitySubmission = typeof activitySubmissions.$inferSelect;
export type InsertActivitySubmission = typeof activitySubmissions.$inferInsert;

/**
 * Chat Messages - Mensagens de chat entre aluno e professor
 * Armazena histórico de conversas em tempo real
 */
export const chatMessages = mysqlTable("chatMessages", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversationId").notNull(),
  senderId: int("senderId").notNull(), // ID do remetente (aluno ou professor)
  senderType: varchar("senderType", { length: 20 }).notNull(), // "student" ou "teacher"
  content: text("content").notNull(),
  isRead: boolean("isRead").notNull().default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;

/**
 * Chat Conversations - Conversas entre aluno e professor
 * Armazena metadados das conversas
 */
export const chatConversations = mysqlTable("chatConversations", {
  id: int("id").autoincrement().primaryKey(),
  studentId: int("studentId").notNull(),
  teacherId: int("teacherId").notNull(),
  lastMessageAt: timestamp("lastMessageAt").defaultNow().onUpdateNow(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ChatConversation = typeof chatConversations.$inferSelect;
export type InsertChatConversation = typeof chatConversations.$inferInsert;

/**
 * Monitor Activity Logs - Registro de ações dos monitores
 * Armazena todas as ações realizadas pelos monitores para supervisão do professor
 */
export const monitorActivityLogs = mysqlTable("monitorActivityLogs", {
  id: int("id").autoincrement().primaryKey(),
  monitorId: int("monitorId").notNull(), // ID do monitor (studentAccounts.id)
  monitorName: varchar("monitorName", { length: 200 }).notNull(), // Nome do monitor para referência rápida
  actionType: varchar("actionType", { length: 100 }).notNull(), // Tipo de ação
  actionDescription: text("actionDescription").notNull(), // Descrição detalhada da ação
  targetEntity: varchar("targetEntity", { length: 100 }), // Entidade afetada (ex: "attendance", "resource", "seminar")
  targetId: int("targetId"), // ID da entidade afetada (opcional)
  metadata: text("metadata"), // JSON com dados adicionais
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type MonitorActivityLog = typeof monitorActivityLogs.$inferSelect;
export type InsertMonitorActivityLog = typeof monitorActivityLogs.$inferInsert;

/**
 * Schedule Entries - Entradas do cronograma do semestre
 * Editável pelo professor/admin diretamente na plataforma
 */
export const scheduleEntries = mysqlTable("scheduleEntries", {
  id: int("id").autoincrement().primaryKey(),
  weekLabel: varchar("weekLabel", { length: 50 }).notNull(),   // "Semana 1"
  weekDate: varchar("weekDate", { length: 20 }),               // "10/03/2026"
  title: varchar("title", { length: 300 }).notNull(),
  detail: text("detail"),
  type: varchar("type", { length: 50 }).notNull().default("aula"), // aula|tbl|caso|jigsaw|prova
  highlight: boolean("highlight").notNull().default(false),
  isActive: boolean("isActive").notNull().default(true),
  sortOrder: int("sortOrder").notNull().default(0),
  gameWeekNumber: int("gameWeekNumber"),                       // nullable link to gameWeeklyReleases.weekNumber
  classId: int("classId"),                                     // nullable link to classes.id (null = global)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type ScheduleEntry = typeof scheduleEntries.$inferSelect;
export type InsertScheduleEntry = typeof scheduleEntries.$inferInsert;

/**
 * Jigsaw Peer Evaluations - Avaliações entre alunos do grupo mosaico
 * Cada aluno avalia os colegas do seu grupo mosaico (0-5)
 */
export const jigsawPeerEvaluations = mysqlTable("jigsawPeerEvaluations", {
  id: int("id").autoincrement().primaryKey(),
  homeGroupId: int("homeGroupId").notNull(), // Grupo mosaico
  evaluatorMemberId: int("evaluatorMemberId").notNull(), // Aluno que está avaliando
  evaluatedMemberId: int("evaluatedMemberId").notNull(), // Aluno sendo avaliado
  rating: decimal("rating", { precision: 2, scale: 1 }).notNull(), // 0-5
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type JigsawPeerEvaluation = typeof jigsawPeerEvaluations.$inferSelect;
export type InsertJigsawPeerEvaluation = typeof jigsawPeerEvaluations.$inferInsert;

/**
 * ============================================================================
 * SEMINÁRIO PÔSTER + QUIZ — substitui a mecânica clássica de Jigsaw
 * (Grupo Especialista / Grupo Mosaico) a partir de 2026.2.
 *
 * Reaproveita jigsawHomeGroups/jigsawHomeMembers como "grupo de apresentação"
 * (mesma tabela, sem precisar criar uma nova).
 *
 * Fluxo completo:
 *   1. Grupo escreve 5 perguntas com gabarito -> pending_review
 *   2. Professor revisa, pode AJUSTAR o enunciado/alternativas, aprova -> approved
 *      (ainda não visível/respondível pelos alunos)
 *   3. Professor libera as perguntas SÓ DEPOIS que o grupo termina de
 *      apresentar (releasedAt + expiresAt = janela de tempo para responder)
 *   4. Durante a janela: alunos respondem; alternativas embaralhadas de forma
 *      DIFERENTE para cada aluno (contra vazamento tipo "a resposta é a C");
 *      gabarito nunca é revelado durante a janela, nem para quem já respondeu
 *   5. Ao expirar a janela: TODOS passam a ver as perguntas com o gabarito
 *      (não precisa esperar responder — vira material de estudo)
 *   6. Professor lança a nota do grupo por uma planilha de check (pôster +
 *      qualidade das perguntas), convertida em nota 0-10
 *   7. Nota final de Seminário do aluno = combinação da nota do grupo +
 *      desempenho individual respondendo os outros grupos
 * ============================================================================
 */

/**
 * Perguntas do quiz — autoria por grupo, revisão/ajuste pelo professor, e
 * ciclo de liberação por tempo (nunca visíveis antes de releasedAt, gabarito
 * só aparece depois de expiresAt).
 */
export const jigsawIntegrationQuestions = mysqlTable("jigsawIntegrationQuestions", {
  id: int("id").autoincrement().primaryKey(),
  classId: int("classId").notNull(),
  authorGroupId: int("authorGroupId"), // jigsawHomeGroups.id do grupo que escreveu; null = criada pelo professor
  topico: varchar("topico", { length: 200 }).notNull(),
  enunciado: text("enunciado").notNull(),
  alternativas: json("alternativas").notNull(), // [{ id, texto, correta }, ...] — ordem "canônica"; embaralhada por aluno na entrega
  explicacao: text("explicacao"),
  status: mysqlEnum("status", ["pending_review", "approved", "rejected"]).default("approved").notNull(),
  reviewedBy: int("reviewedBy"),
  reviewedByName: varchar("reviewedByName", { length: 200 }),
  reviewedAt: timestamp("reviewedAt"),
  // Ciclo de liberação: null até o professor liberar (depois da apresentação
  // do grupo). expiresAt = releasedAt + duração da janela de resposta.
  releasedAt: timestamp("releasedAt"),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type JigsawIntegrationQuestion = typeof jigsawIntegrationQuestions.$inferSelect;
export type InsertJigsawIntegrationQuestion = typeof jigsawIntegrationQuestions.$inferInsert;

export const jigsawIntegrationAnswers = mysqlTable("jigsawIntegrationAnswers", {
  id: int("id").autoincrement().primaryKey(),
  questionId: int("questionId").notNull(),
  memberId: int("memberId").notNull(),
  respostaEscolhida: varchar("respostaEscolhida", { length: 10 }).notNull(),
  isCorrect: int("isCorrect").notNull(), // 0/1
  answeredAt: timestamp("answeredAt").defaultNow().notNull(),
});

export type JigsawIntegrationAnswer = typeof jigsawIntegrationAnswers.$inferSelect;
export type InsertJigsawIntegrationAnswer = typeof jigsawIntegrationAnswers.$inferInsert;

/**
 * Nota do pôster/apresentação do grupo — planilha de check estruturada
 * (critérios individuais), convertida automaticamente em nota 0-10. Lançada
 * pelo professor/monitor. Combinada com o desempenho individual do aluno
 * como plateia para formar a nota final de Seminário.
 */
export const seminarioApresentacoes = mysqlTable("seminarioApresentacoes", {
  id: int("id").autoincrement().primaryKey(),
  classId: int("classId").notNull(),
  groupId: int("groupId").notNull(), // jigsawHomeGroups.id
  checklist: json("checklist").notNull(), // { posterClaro: true, achadoCorreto: true, ... } - critérios ajustáveis
  notaPoster: decimal("notaPoster", { precision: 3, scale: 1 }).notNull(), // 0-10, calculada a partir do checklist
  gradedBy: int("gradedBy").notNull(),
  gradedByName: varchar("gradedByName", { length: 200 }),
  gradedAt: timestamp("gradedAt").defaultNow().notNull(),
  observacoes: text("observacoes"),
});

export type SeminarioApresentacao = typeof seminarioApresentacoes.$inferSelect;
export type InsertSeminarioApresentacao = typeof seminarioApresentacoes.$inferInsert;

/**
 * Group Activity Grades - Notas lançadas pelos monitores para grupos de Kahoot e Casos Clínicos
 * Os grupos de Kahoot são os mesmos da fase 2 do Jigsaw (jigsawHomeGroups)
 */
export const groupActivityGrades = mysqlTable("groupActivityGrades", {
  id: int("id").autoincrement().primaryKey(),
  classId: int("classId").notNull(), // Turma
  activityType: mysqlEnum("activityType", ["kahoot", "clinical_case"]).notNull(),
  activityName: varchar("activityName", { length: 200 }).notNull(), // e.g., "Kahoot - Semana 3", "Caso Clínico 1"
  homeGroupId: int("homeGroupId"), // Grupo mosaico (fase 2 do Jigsaw) - para Kahoot
  groupName: varchar("groupName", { length: 200 }).notNull(), // Nome do grupo (cacheado)
  grade: decimal("grade", { precision: 5, scale: 2 }).notNull().default("0"), // Nota (0-10)
  maxGrade: decimal("maxGrade", { precision: 5, scale: 2 }).notNull().default("10"), // Nota máxima
  notes: text("notes"), // Observações do monitor
  launchedByMonitorId: int("launchedByMonitorId"), // ID da conta do monitor que lançou
  launchedByName: varchar("launchedByName", { length: 200 }), // Nome do monitor (cacheado)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type GroupActivityGrade = typeof groupActivityGrades.$inferSelect;
export type InsertGroupActivityGrade = typeof groupActivityGrades.$inferInsert;

/**
 * Exam Gabaritos - Gabaritos salvos para P1/P2 por turma
 */
export const examGabaritos = mysqlTable("examGabaritos", {
  id: int("id").autoincrement().primaryKey(),
  classId: int("classId").notNull(),
  provaType: mysqlEnum("provaType", ["P1", "P2"]).notNull(),
  examVersion: varchar("examVersion", { length: 1 }).default("A"), // Versão A, B, C ou D
  answers: text("answers").notNull(), // JSON: ["A","B","C",...] 25 respostas
  difficulties: text("difficulties").notNull(), // JSON: ["facil","intermediario",...] 25 dificuldades
  examDate: varchar("examDate", { length: 20 }),
  createdByName: varchar("createdByName", { length: 200 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  uniqueClassProvaVersion: uniqueIndex("examGabaritos_classId_provaType_version").on(t.classId, t.provaType, t.examVersion),
}));
export type ExamGabarito = typeof examGabaritos.$inferSelect;
export type InsertExamGabarito = typeof examGabaritos.$inferInsert;

/**
 * Exam Student Grades - Notas individuais de alunos nas provas P1/P2
 */
export const examStudentGrades = mysqlTable("examStudentGrades", {
  id: int("id").autoincrement().primaryKey(),
  classId: int("classId").notNull(),
  memberId: int("memberId").notNull(),
  memberName: varchar("memberName", { length: 200 }).notNull(),
  provaType: mysqlEnum("provaType", ["P1", "P2"]).notNull(),
  examVersion: varchar("examVersion", { length: 1 }).default("A"), // Versão A, B, C ou D
  answers: text("answers").notNull(), // JSON: ["A","B",null,...] 25 respostas
  score: decimal("score", { precision: 5, scale: 2 }).notNull().default("0"),
  correctCount: int("correctCount").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  uniqueMemberProva: uniqueIndex("examStudentGrades_memberId_provaType").on(t.memberId, t.provaType),
}));
export type ExamStudentGrade = typeof examStudentGrades.$inferSelect;
export type InsertExamStudentGrade = typeof examStudentGrades.$inferInsert;

/**
 * Attendance Manual Requests - Solicitacoes manuais de presenca quando GPS falha
 * Fluxo: aluno escaneia QR -> GPS falha -> aluno solicita confirmacao manual -> professor/monitor aprova
 */
export const attendanceManualRequests = mysqlTable("attendanceManualRequests", {
  id: int("id").autoincrement().primaryKey(),
  qrCodeSessionId: int("qrCodeSessionId").notNull(),
  memberId: int("memberId").notNull(),
  classId: int("classId").notNull(),
  memberName: varchar("memberName", { length: 200 }).notNull(),
  reason: mysqlEnum("reason", ["gps_failed", "gps_out_of_range", "other"]).notNull().default("gps_failed"),
  reasonNote: text("reasonNote"),
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  distanceMeters: decimal("distanceMeters", { precision: 8, scale: 2 }),
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).notNull().default("pending"),
  reviewedBy: int("reviewedBy"),
  reviewedByName: varchar("reviewedByName", { length: 200 }),
  reviewedAt: timestamp("reviewedAt"),
  reviewNote: text("reviewNote"),
  requestedAt: timestamp("requestedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AttendanceManualRequest = typeof attendanceManualRequests.$inferSelect;
export type InsertAttendanceManualRequest = typeof attendanceManualRequests.$inferInsert;

/**
 * Teacher Grades - Notas lancadas pelo professor (tabela separada, editavel livremente)
 * Integrada visualmente com groupActivityGrades dos monitores no painel admin
 */
export const teacherGrades = mysqlTable("teacherGrades", {
  id: int("id").autoincrement().primaryKey(),
  classId: int("classId").notNull(),
  activityType: mysqlEnum("activityType", ["kahoot", "clinical_case", "prova", "seminario", "participacao", "outro"]).notNull(),
  activityName: varchar("activityName", { length: 200 }).notNull(),
  memberId: int("memberId"),
  memberName: varchar("memberName", { length: 200 }).notNull(),
  groupName: varchar("groupName", { length: 200 }),
  grade: decimal("grade", { precision: 5, scale: 2 }).notNull().default("0.00"),
  maxGrade: decimal("maxGrade", { precision: 5, scale: 2 }).notNull().default("10.00"),
  notes: text("notes"),
  monitorGradeRef: int("monitorGradeRef"),
  editedByTeacherId: int("editedByTeacherId"),
  editedByTeacherName: varchar("editedByTeacherName", { length: 200 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type TeacherGrade = typeof teacherGrades.$inferSelect;
export type InsertTeacherGrade = typeof teacherGrades.$inferInsert;

/**
 * Monitoring Certificates - Certificados de monitoria emitidos pela plataforma
 */
export const monitoringCertificates = mysqlTable("monitoringCertificates", {
  id: int("id").autoincrement().primaryKey(),
  monitorAccountId: int("monitorAccountId").notNull(),
  monitorName: varchar("monitorName", { length: 200 }).notNull(),
  monitorEmail: varchar("monitorEmail", { length: 320 }).notNull(),
  disciplineName: varchar("disciplineName", { length: 300 }).notNull().default("Farmacologia I"),
  courseCode: varchar("courseCode", { length: 50 }),
  periodStart: varchar("periodStart", { length: 20 }).notNull(),
  periodEnd: varchar("periodEnd", { length: 20 }).notNull(),
  workloadHours: int("workloadHours").notNull().default(60),
  professorName: varchar("professorName", { length: 200 }).notNull(),
  professorTitle: varchar("professorTitle", { length: 100 }),
  institution: varchar("institution", { length: 300 }).notNull().default("Universidade Federal do Estado do Rio de Janeiro - UNIRIO"),
  department: varchar("department", { length: 300 }),
  activities: text("activities"),
  issuedByTeacherId: int("issuedByTeacherId"),
  issuedAt: timestamp("issuedAt").defaultNow().notNull(),
  pdfUrl: text("pdfUrl"),
  certificateCode: varchar("certificateCode", { length: 50 }).notNull(),
  status: mysqlEnum("status", ["active", "revoked"]).notNull().default("active"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type MonitoringCertificate = typeof monitoringCertificates.$inferSelect;
export type InsertMonitoringCertificate = typeof monitoringCertificates.$inferInsert;

/**
 * Digital Exam Sessions - Sessoes de prova digital abertas pelo professor
 * O professor abre uma sessao, alunos entram com o codigo, respondem no celular
 */
export const digitalExamSessions = mysqlTable("digitalExamSessions", {
  id: int("id").autoincrement().primaryKey(),
  classId: int("classId").notNull(),
  provaType: mysqlEnum("provaType", ["P1", "P2"]).notNull(),
  accessCode: varchar("accessCode", { length: 8 }).notNull(),
  questions: text("questions").notNull(),
  gabarito: text("gabarito").notNull(),
  difficulties: text("difficulties").notNull(),
  timeLimitMinutes: int("timeLimitMinutes").notNull().default(60),
  status: mysqlEnum("status", ["open", "closed", "finished"]).notNull().default("open"),
  openedAt: timestamp("openedAt").defaultNow().notNull(),
  closedAt: timestamp("closedAt"),
  createdByName: varchar("createdByName", { length: 200 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  uniqueCode: uniqueIndex("digitalExamSessions_accessCode").on(t.accessCode),
}));
export type DigitalExamSession = typeof digitalExamSessions.$inferSelect;
export type InsertDigitalExamSession = typeof digitalExamSessions.$inferInsert;

/**
 * Digital Exam Responses - Respostas individuais dos alunos na prova digital
 */
export const digitalExamResponses = mysqlTable("digitalExamResponses", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  memberId: int("memberId").notNull(),
  memberName: varchar("memberName", { length: 200 }).notNull(),
  classId: int("classId").notNull(),
  questionOrder: text("questionOrder").notNull(),
  answers: text("answers").notNull().default("[]"),
  score: decimal("score", { precision: 5, scale: 2 }).default("0"),
  correctCount: int("correctCount").default(0),
  status: mysqlEnum("status", ["in_progress", "submitted", "graded"]).notNull().default("in_progress"),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  submittedAt: timestamp("submittedAt"),
  gradedAt: timestamp("gradedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  uniqueMemberSession: uniqueIndex("digitalExamResponses_memberId_sessionId").on(t.memberId, t.sessionId),
}));
export type DigitalExamResponse = typeof digitalExamResponses.$inferSelect;
export type InsertDigitalExamResponse = typeof digitalExamResponses.$inferInsert;

/**
 * Live Quiz Sessions - Sessões do quiz ao vivo (P2 digital)
 * Professor controla questão por questão; alunos respondem no celular
 */
export const liveQuizSessions = mysqlTable("liveQuizSessions", {
  id: int("id").autoincrement().primaryKey(),
  accessCode: varchar("accessCode", { length: 8 }).notNull(),
  title: varchar("title", { length: 200 }).notNull().default("P2 - Quiz ao Vivo"),
  provaType: varchar("provaType", { length: 10 }).notNull().default("P2"),
  classId: int("classId").notNull(),
  teacherSessionToken: varchar("teacherSessionToken", { length: 200 }).notNull(),
  questions: text("questions").notNull(),
  currentQuestionIndex: int("currentQuestionIndex").notNull().default(-1),
  totalQuestions: int("totalQuestions").notNull().default(0),
  status: mysqlEnum("status", ["lobby", "active", "question_closed", "finished", "gabarito_released"]).notNull().default("lobby"),
  gabarito: text("gabarito").notNull(),
  gabaritReleasedAt: timestamp("gabaritReleasedAt"),
  finishedAt: timestamp("finishedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  uniqueCode: uniqueIndex("liveQuizSessions_accessCode").on(t.accessCode),
}));
export type LiveQuizSession = typeof liveQuizSessions.$inferSelect;
export type InsertLiveQuizSession = typeof liveQuizSessions.$inferInsert;

/**
 * Live Quiz Answers - Respostas dos alunos por questão no quiz ao vivo
 */
export const liveQuizAnswers = mysqlTable("liveQuizAnswers", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  memberId: int("memberId").notNull(),
  memberName: varchar("memberName", { length: 200 }).notNull(),
  classId: int("classId").notNull(),
  questionIndex: int("questionIndex").notNull(),
  answer: varchar("answer", { length: 200 }).notNull(),
  isCorrect: tinyint("isCorrect").notNull().default(0),
  pointsEarned: decimal("pointsEarned", { precision: 5, scale: 2 }).notNull().default("0"),
  answeredAt: timestamp("answeredAt").defaultNow().notNull(),
}, (t) => ({
  uniqueAnswer: uniqueIndex("liveQuizAnswers_member_session_question").on(t.memberId, t.sessionId, t.questionIndex),
}));
export type LiveQuizAnswer = typeof liveQuizAnswers.$inferSelect;
export type InsertLiveQuizAnswer = typeof liveQuizAnswers.$inferInsert;

/**
 * Live Quiz Participants - Rastreamento de alunos conectados ao lobby
 */
export const liveQuizParticipants = mysqlTable("liveQuizParticipants", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  memberId: int("memberId").notNull(),
  memberName: varchar("memberName", { length: 200 }).notNull(),
  classId: int("classId").notNull(),
  joinedAt: timestamp("joinedAt").defaultNow().notNull(),
  lastSeenAt: timestamp("lastSeenAt").defaultNow().notNull(),
}, (t) => ({
  uniqueParticipant: uniqueIndex("liveQuizParticipants_member_session").on(t.memberId, t.sessionId),
}));
export type LiveQuizParticipant = typeof liveQuizParticipants.$inferSelect;
export type InsertLiveQuizParticipant = typeof liveQuizParticipants.$inferInsert;