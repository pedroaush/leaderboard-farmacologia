CREATE TABLE IF NOT EXISTS `backupRecords` (
	`id` int AUTO_INCREMENT NOT NULL,
	`backupName` varchar(255) NOT NULL,
	`backupType` enum('full','partial','incremental') NOT NULL DEFAULT 'full',
	`status` enum('pending','in_progress','completed','failed') NOT NULL DEFAULT 'pending',
	`fileSize` int,
	`fileUrl` varchar(500),
	`fileKey` varchar(500),
	`totalRecords` int NOT NULL DEFAULT 0,
	`recordsIncluded` text,
	`createdBy` int NOT NULL,
	`createdByName` varchar(200),
	`notes` text,
	`errorMessage` text,
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `backupRecords_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `restoreHistory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`backupId` int NOT NULL,
	`status` enum('pending','in_progress','completed','failed') NOT NULL DEFAULT 'pending',
	`recordsRestored` int NOT NULL DEFAULT 0,
	`recordsFailed` int NOT NULL DEFAULT 0,
	`restoredBy` int NOT NULL,
	`restoredByName` varchar(200),
	`notes` text,
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `restoreHistory_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `systemSettings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`courseName` varchar(255) NOT NULL DEFAULT 'Farmacologia I',
	`semester` varchar(50) NOT NULL DEFAULT '2026.1',
	`academicYear` varchar(50) NOT NULL DEFAULT '2026',
	`institution` varchar(255) NOT NULL DEFAULT 'UNIRIO',
	`department` varchar(255) NOT NULL DEFAULT 'Farmacologia',
	`startDate` varchar(20),
	`endDate` varchar(20),
	`totalWeeks` int NOT NULL DEFAULT 17,
	`schedule` text,
	`description` text,
	`logoUrl` varchar(500),
	`primaryColor` varchar(7) DEFAULT '#FF9500',
	`secondaryColor` varchar(7) DEFAULT '#1A1A2E',
	`updatedBy` int,
	`updatedByName` varchar(200),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `systemSettings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `restoreHistory` ADD CONSTRAINT `restoreHistory_backupId_backupRecords_id_fk` FOREIGN KEY (`backupId`) REFERENCES `backupRecords`(`id`) ON DELETE no action ON UPDATE no action;