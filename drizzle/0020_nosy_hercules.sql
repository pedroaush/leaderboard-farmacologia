CREATE TABLE IF NOT EXISTS `jigsawExpertGroups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`classId` int NOT NULL,
	`topicId` int NOT NULL,
	`name` varchar(200) NOT NULL,
	`description` text,
	`maxMembers` int NOT NULL DEFAULT 14,
	`status` enum('forming','active','presenting','completed') NOT NULL DEFAULT 'forming',
	`presentationDate` timestamp,
	`presentationNotes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `jigsawExpertGroups_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `jigsawExpertMembers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`expertGroupId` int NOT NULL,
	`memberId` int NOT NULL,
	`role` enum('member','coordinator','presenter') NOT NULL DEFAULT 'member',
	`presentationScore` decimal(3,1) DEFAULT '0',
	`participationScore` decimal(3,1) DEFAULT '0',
	`readingProgress` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `jigsawExpertMembers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `jigsawHomeGroups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`classId` int NOT NULL,
	`name` varchar(200) NOT NULL,
	`description` text,
	`meetingNumber` int NOT NULL,
	`meetingDate` timestamp,
	`status` enum('forming','active','completed') NOT NULL DEFAULT 'forming',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `jigsawHomeGroups_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `jigsawHomeMembers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`homeGroupId` int NOT NULL,
	`memberId` int NOT NULL,
	`topicId` int NOT NULL,
	`presentationScore` decimal(3,1) DEFAULT '0',
	`participationScore` decimal(3,1) DEFAULT '0',
	`peerRating` decimal(3,1) DEFAULT '0',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `jigsawHomeMembers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `jigsawScores` (
	`id` int AUTO_INCREMENT NOT NULL,
	`memberId` int NOT NULL,
	`classId` int NOT NULL,
	`expertGroupId` int,
	`homeGroupIds` text,
	`totalPresentationScore` decimal(5,1) DEFAULT '0',
	`totalParticipationScore` decimal(5,1) DEFAULT '0',
	`totalPeerRating` decimal(5,1) DEFAULT '0',
	`totalJigsawPF` decimal(6,1) DEFAULT '0',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `jigsawScores_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `jigsawTopics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` text,
	`articleUrl` varchar(500),
	`articleTitle` varchar(300),
	`articleAuthors` varchar(300),
	`articleYear` int,
	`keyPoints` text,
	`studyDuration` int NOT NULL DEFAULT 5,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `jigsawTopics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `jigsawExpertGroups` ADD CONSTRAINT `jigsawExpertGroups_topicId_jigsawTopics_id_fk` FOREIGN KEY (`topicId`) REFERENCES `jigsawTopics`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `jigsawExpertMembers` ADD CONSTRAINT `jigsawExpertMembers_expertGroupId_jigsawExpertGroups_id_fk` FOREIGN KEY (`expertGroupId`) REFERENCES `jigsawExpertGroups`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `jigsawExpertMembers` ADD CONSTRAINT `jigsawExpertMembers_memberId_members_id_fk` FOREIGN KEY (`memberId`) REFERENCES `members`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `jigsawHomeMembers` ADD CONSTRAINT `jigsawHomeMembers_homeGroupId_jigsawHomeGroups_id_fk` FOREIGN KEY (`homeGroupId`) REFERENCES `jigsawHomeGroups`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `jigsawHomeMembers` ADD CONSTRAINT `jigsawHomeMembers_memberId_members_id_fk` FOREIGN KEY (`memberId`) REFERENCES `members`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `jigsawHomeMembers` ADD CONSTRAINT `jigsawHomeMembers_topicId_jigsawTopics_id_fk` FOREIGN KEY (`topicId`) REFERENCES `jigsawTopics`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `jigsawScores` ADD CONSTRAINT `jigsawScores_memberId_members_id_fk` FOREIGN KEY (`memberId`) REFERENCES `members`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `jigsawScores` ADD CONSTRAINT `jigsawScores_expertGroupId_jigsawExpertGroups_id_fk` FOREIGN KEY (`expertGroupId`) REFERENCES `jigsawExpertGroups`(`id`) ON DELETE no action ON UPDATE no action;