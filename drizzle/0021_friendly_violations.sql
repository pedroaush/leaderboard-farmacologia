CREATE TABLE IF NOT EXISTS `assessmentAnswers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`submissionId` int NOT NULL,
	`questionId` int NOT NULL,
	`answer` text NOT NULL,
	`isCorrect` boolean,
	`pointsEarned` decimal(5,1),
	`answeredAt` timestamp NOT NULL,
	`timeSpent` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `assessmentAnswers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `assessmentIPBlocks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`assessmentId` int NOT NULL,
	`ipAddress` varchar(45) NOT NULL,
	`memberId` int NOT NULL,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `assessmentIPBlocks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `assessmentLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`submissionId` int NOT NULL,
	`eventType` enum('focus_lost','focus_regained','tab_switched','window_minimized','copy_attempt','right_click','keyboard_shortcut','network_issue','suspicious_activity','question_answered','time_warning','submission_started','submission_completed') NOT NULL,
	`details` text,
	`severity` enum('info','warning','critical') NOT NULL DEFAULT 'info',
	`flagged` boolean NOT NULL DEFAULT false,
	`timestamp` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `assessmentLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `assessmentQuestions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`assessmentId` int NOT NULL,
	`questionNumber` int NOT NULL,
	`question` text NOT NULL,
	`questionType` enum('multiple_choice','essay','true_false') NOT NULL,
	`options` text,
	`correctAnswer` text,
	`points` decimal(5,1) NOT NULL DEFAULT '1',
	`explanation` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `assessmentQuestions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `assessmentSubmissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`assessmentId` int NOT NULL,
	`memberId` int NOT NULL,
	`attemptNumber` int NOT NULL DEFAULT 1,
	`startedAt` timestamp NOT NULL,
	`submittedAt` timestamp,
	`score` decimal(5,1),
	`percentage` decimal(5,1),
	`passed` boolean,
	`status` enum('in_progress','submitted','graded') NOT NULL DEFAULT 'in_progress',
	`ipAddress` varchar(45),
	`userAgent` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `assessmentSubmissions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `assessments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`classId` int NOT NULL,
	`title` varchar(200) NOT NULL,
	`description` text,
	`type` enum('multiple_choice','essay','mixed') NOT NULL DEFAULT 'multiple_choice',
	`totalQuestions` int NOT NULL DEFAULT 0,
	`timePerQuestion` int NOT NULL DEFAULT 120,
	`allowRetrocess` boolean NOT NULL DEFAULT false,
	`enableLockdown` boolean NOT NULL DEFAULT true,
	`passingScore` decimal(5,1) NOT NULL DEFAULT '60',
	`maxAttempts` int NOT NULL DEFAULT 1,
	`scheduledAt` timestamp,
	`startsAt` timestamp,
	`endsAt` timestamp,
	`status` enum('draft','published','active','closed') NOT NULL DEFAULT 'draft',
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `assessments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `assessmentAnswers` ADD CONSTRAINT `assessmentAnswers_submissionId_assessmentSubmissions_id_fk` FOREIGN KEY (`submissionId`) REFERENCES `assessmentSubmissions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `assessmentAnswers` ADD CONSTRAINT `assessmentAnswers_questionId_assessmentQuestions_id_fk` FOREIGN KEY (`questionId`) REFERENCES `assessmentQuestions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `assessmentIPBlocks` ADD CONSTRAINT `assessmentIPBlocks_assessmentId_assessments_id_fk` FOREIGN KEY (`assessmentId`) REFERENCES `assessments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `assessmentIPBlocks` ADD CONSTRAINT `assessmentIPBlocks_memberId_members_id_fk` FOREIGN KEY (`memberId`) REFERENCES `members`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `assessmentLogs` ADD CONSTRAINT `assessmentLogs_submissionId_assessmentSubmissions_id_fk` FOREIGN KEY (`submissionId`) REFERENCES `assessmentSubmissions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `assessmentQuestions` ADD CONSTRAINT `assessmentQuestions_assessmentId_assessments_id_fk` FOREIGN KEY (`assessmentId`) REFERENCES `assessments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `assessmentSubmissions` ADD CONSTRAINT `assessmentSubmissions_assessmentId_assessments_id_fk` FOREIGN KEY (`assessmentId`) REFERENCES `assessments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `assessmentSubmissions` ADD CONSTRAINT `assessmentSubmissions_memberId_members_id_fk` FOREIGN KEY (`memberId`) REFERENCES `members`(`id`) ON DELETE cascade ON UPDATE no action;