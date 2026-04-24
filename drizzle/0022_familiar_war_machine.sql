CREATE TABLE IF NOT EXISTS `assessmentQuestionLinks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`assessmentId` int NOT NULL,
	`questionId` int NOT NULL,
	`order` int NOT NULL,
	`points` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `assessmentQuestionLinks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `questionBank` (
	`id` int AUTO_INCREMENT NOT NULL,
	`createdBy` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`category` varchar(100) NOT NULL,
	`tags` text,
	`questionText` text NOT NULL,
	`questionType` enum('multiple_choice','essay','true_false') NOT NULL DEFAULT 'multiple_choice',
	`alternatives` text,
	`correctAnswer` varchar(255),
	`imageUrl` text,
	`formulaLatex` text,
	`difficulty` enum('easy','medium','hard') NOT NULL DEFAULT 'medium',
	`points` int NOT NULL DEFAULT 1,
	`estimatedTime` int,
	`timesUsed` int NOT NULL DEFAULT 0,
	`correctRate` decimal(5,2) DEFAULT '0',
	`isActive` boolean NOT NULL DEFAULT true,
	`isPublished` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `questionBank_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `questionPerformance` (
	`id` int AUTO_INCREMENT NOT NULL,
	`questionId` int NOT NULL,
	`assessmentId` int NOT NULL,
	`memberId` int NOT NULL,
	`isCorrect` boolean NOT NULL,
	`timeSpent` int,
	`attemptNumber` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `questionPerformance_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `assessmentQuestionLinks` ADD CONSTRAINT `assessmentQuestionLinks_assessmentId_assessments_id_fk` FOREIGN KEY (`assessmentId`) REFERENCES `assessments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `assessmentQuestionLinks` ADD CONSTRAINT `assessmentQuestionLinks_questionId_questionBank_id_fk` FOREIGN KEY (`questionId`) REFERENCES `questionBank`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `questionBank` ADD CONSTRAINT `questionBank_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `questionPerformance` ADD CONSTRAINT `questionPerformance_questionId_questionBank_id_fk` FOREIGN KEY (`questionId`) REFERENCES `questionBank`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `questionPerformance` ADD CONSTRAINT `questionPerformance_assessmentId_assessments_id_fk` FOREIGN KEY (`assessmentId`) REFERENCES `assessments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `questionPerformance` ADD CONSTRAINT `questionPerformance_memberId_members_id_fk` FOREIGN KEY (`memberId`) REFERENCES `members`(`id`) ON DELETE cascade ON UPDATE no action;