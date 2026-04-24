CREATE TABLE IF NOT EXISTS `attendanceRecords` (
	`id` int AUTO_INCREMENT NOT NULL,
	`qrCodeSessionId` int NOT NULL,
	`memberId` int NOT NULL,
	`classId` int NOT NULL,
	`checkedInAt` timestamp NOT NULL DEFAULT (now()),
	`isValid` boolean NOT NULL DEFAULT true,
	`validationNotes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `attendanceRecords_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `attendanceSummary` (
	`id` int AUTO_INCREMENT NOT NULL,
	`memberId` int NOT NULL,
	`classId` int NOT NULL,
	`totalSessions` int NOT NULL DEFAULT 0,
	`presentSessions` int NOT NULL DEFAULT 0,
	`absentSessions` int NOT NULL DEFAULT 0,
	`attendancePercentage` decimal(5,2) NOT NULL DEFAULT '0',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `attendanceSummary_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `qrCodeSessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`classId` int NOT NULL,
	`teacherId` int NOT NULL,
	`dayOfWeek` int NOT NULL,
	`startTime` varchar(5) NOT NULL,
	`endTime` varchar(5) NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`qrCodeData` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `qrCodeSessions_id` PRIMARY KEY(`id`)
);
