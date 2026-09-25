CREATE TABLE `simulacoesClinicas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`titulo` varchar(300) NOT NULL,
	`descricao` text,
	`htmlConteudo` text NOT NULL,
	`classIds` text,
	`contaComoNota` boolean NOT NULL DEFAULT false,
	`contaComoFrequencia` boolean NOT NULL DEFAULT false,
	`pontuacaoMaxima` int NOT NULL DEFAULT 5,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdBy` int,
	`createdByName` varchar(200),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `simulacoesClinicas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `simulacoesClinicasProgresso` (
	`id` int AUTO_INCREMENT NOT NULL,
	`simulacaoId` int NOT NULL,
	`memberId` int NOT NULL,
	`classId` int NOT NULL,
	`currentStep` int NOT NULL DEFAULT 0,
	`completedSteps` int NOT NULL DEFAULT 0,
	`totalSteps` int NOT NULL DEFAULT 5,
	`score` int NOT NULL DEFAULT 0,
	`maxScore` int NOT NULL DEFAULT 5,
	`completed` boolean NOT NULL DEFAULT false,
	`firstStartedAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `simulacoesClinicasProgresso_id` PRIMARY KEY(`id`),
	CONSTRAINT `simulacoesClinicasProgresso_member_simulacao` UNIQUE(`memberId`,`simulacaoId`)
);
--> statement-breakpoint
ALTER TABLE `simulacoesClinicasProgresso` ADD CONSTRAINT `simulacoesClinicasProgresso_simulacaoId_simulacoesClinicas_id_fk` FOREIGN KEY (`simulacaoId`) REFERENCES `simulacoesClinicas`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `simulacoesClinicasProgresso` ADD CONSTRAINT `simulacoesClinicasProgresso_memberId_members_id_fk` FOREIGN KEY (`memberId`) REFERENCES `members`(`id`) ON DELETE cascade ON UPDATE no action;