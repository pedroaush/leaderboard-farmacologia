import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import compression from "compression";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { initializeWebSocket } from "./websocket";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  
  // Trust Railway's proxy so rate limiter uses real client IPs (X-Forwarded-For)
  app.set('trust proxy', 1);
  
  initializeWebSocket(server);
  
  // Security headers with Helmet
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        imgSrc: ["'self'", "https:", "data:", "blob:"],
        connectSrc: ["'self'", "https://files.manuscdn.com", "https://api.manus.im", "wss:", "ws:"],
        frameSrc: ["'self'", "https://www.youtube.com", "https://youtube.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        mediaSrc: ["'self'", "https://files.manuscdn.com", "blob:"],
      },
    },
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
  }));
  
  // Compressão gzip — reduz tamanho das respostas em até 70% (melhora performance para 100 usuários)
  app.use(compression({
    level: 6,           // nível de compressão balanceado (1=rápido, 9=máximo)
    threshold: 1024,    // comprimir respostas maiores que 1KB
    filter: (req, res) => {
      // Não comprimir respostas de streaming/SSE
      if (req.headers['accept'] === 'text/event-stream') return false;
      return compression.filter(req, res);
    },
  }));
  
  // CORS configuration
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:5173'];
  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) return callback(null, true);
      // Allow the production domain
      if (origin.includes('conexaofarmacologia.com.br')) return callback(null, true);
      // Allow any manus.space or manus.computer domain
      if (origin.endsWith('.manus.space') || origin.endsWith('.manus.computer') || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      // Allow localhost in development
      if (process.env.NODE_ENV === 'development' && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
        return callback(null, true);
      }
      callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));
  
  // Rate limiting — configurado para suportar 100 alunos simultâneos
  // Considerando que alunos podem estar na mesma rede (mesmo IP público da UNIRIO)
  // Limites generosos para não bloquear turmas inteiras
  
  const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 5000, // 5000 req/15min por IP — comporta 100 alunos com 50 req cada
    handler: (_req, res) => {
      res.status(429).json({ error: 'Muitas requisições, tente novamente mais tarde' });
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      // Não limitar assets estáticos
      return req.path.startsWith('/assets/') || req.path.endsWith('.js') || req.path.endsWith('.css');
    },
  });
  
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 200, // 200 tentativas de login por IP — comporta 100 alunos com 2 tentativas cada
    handler: (_req, res) => {
      res.status(429).json({ error: 'Muitas tentativas de login, tente novamente mais tarde' });
    },
    skipSuccessfulRequests: true,
  });
  
  // tRPC limiter: 2000 req/min por IP — suporta 100 alunos com 20 req/min cada
  const trpcLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minuto
    max: 2000, // 2000 req/min por IP
    handler: (_req, res) => {
      res.status(429).json({ error: 'Muitas requisições à API, tente novamente mais tarde' });
    },
  });
  
  // Limiter específico para check-in de QR Code — suporta turma inteira de 100 alunos
  const qrCheckInLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutos
    max: 500, // 500 check-ins por IP por 5 minutos — comporta 100 alunos com 5 tentativas cada
    handler: (_req, res) => {
      res.status(429).json({ error: 'Muitas tentativas de check-in. Aguarde alguns minutos.' });
    },
    skip: (req) => !req.path.includes('qrcode.checkIn'),
  });
  
  // Apply rate limiters
  app.use('/api/', generalLimiter);
  app.use('/api/trpc', trpcLimiter);
  app.use('/api/trpc/qrcode.checkIn', qrCheckInLimiter);
  app.use('/api/oauth/callback', authLimiter);
  
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback (rate limited above)
  registerOAuthRoutes(app);

  // Endpoint temporário de busca de aluno (admin)
  app.get('/api/admin/search-student', async (req, res) => {
    try {
      const db = await import('../db');
      const name = (req.query.name as string) || '';
      const [members, accounts, teams, classes] = await Promise.all([
        db.getAllMembers(),
        db.getAllStudentAccounts(),
        db.getAllTeams(),
        db.getAllClasses(),
      ]);
      const lowerName = name.toLowerCase();
      const matchedMembers = members.filter((m: any) => {
        const cleanName = m.name ? m.name.split('\t').map((p: string) => p.trim()).join(' ') : '';
        return cleanName.toLowerCase().includes(lowerName);
      });
      const results = matchedMembers.map((m: any) => {
        const account = accounts.find((a: any) => a.memberId === m.id);
        const team = teams.find((t: any) => t.id === m.teamId);
        const cls = classes.find((c: any) => c.id === m.classId);
        const cleanName = m.name ? m.name.split('\t').map((p: string) => p.trim()).join(' ') : m.name;
        return {
          memberId: m.id,
          name: cleanName,
          classId: m.classId,
          className: cls?.name || 'Sem turma',
          teamId: m.teamId,
          teamName: team?.name || 'Sem equipe',
          hasAccount: !!account,
          accountId: account?.id || null,
          email: account?.email || null,
          matricula: account?.matricula || null,
          createdAt: account?.createdAt || null,
        };
      });
      res.json({ total: results.length, results });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Endpoint temporário de busca de teacher/monitora (admin)
  app.get('/api/admin/search-teacher', async (req, res) => {
    try {
      const db = await import('../db');
      const name = (req.query.name as string) || '';
      const teachers = await db.getAllTeacherAccounts();
      const lowerName = name.toLowerCase();
      const matched = name
        ? teachers.filter((t: any) => t.name?.toLowerCase().includes(lowerName) || t.email?.toLowerCase().includes(lowerName))
        : teachers;
      const results = matched.map((t: any) => ({
        id: t.id,
        name: t.name,
        email: t.email,
        role: t.role,
        createdAt: t.createdAt,
        hasSessionToken: !!t.sessionToken,
        lastLogin: t.updatedAt || null,
      }));
      res.json({ total: results.length, results });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Debug endpoint para verificar configuração do Cloudinary
  app.get('/api/materials/debug', async (_req, res) => {
    const { ENV } = await import('./env');
    res.json({
      cloudName: ENV.cloudinaryCloudName || '(not set)',
      apiKeySet: !!ENV.cloudinaryApiKey,
      apiKeyPrefix: ENV.cloudinaryApiKey ? ENV.cloudinaryApiKey.substring(0, 4) + '...' : '(not set)',
      apiSecretSet: !!ENV.cloudinaryApiSecret,
      // Direct process.env check
      directCloudName: process.env.CLOUDINARY_CLOUD_NAME || '(not set)',
      directApiKeySet: !!process.env.CLOUDINARY_API_KEY,
      directApiSecretSet: !!process.env.CLOUDINARY_API_SECRET,
    });
  });

  // Proxy de download de materiais do Cloudinary
  // Usa generate_archive API (download_zip_url) porque o Cloudinary tem "Signed URLs only" habilitado
  // que bloqueia acesso direto a arquivos raw mesmo com URLs assinadas
  app.get('/api/materials/download', async (req, res) => {
    try {
      const fileKey = req.query.fileKey as string;
      if (!fileKey) {
        return res.status(400).json({ error: 'fileKey é obrigatório' });
      }
      const { ENV } = await import('./env');
      
      if (!ENV.cloudinaryCloudName || !ENV.cloudinaryApiKey || !ENV.cloudinaryApiSecret) {
        console.error('[Download] Cloudinary env vars missing');
        return res.status(500).json({ error: 'Configuração do Cloudinary incompleta' });
      }
      
      const { v2: cloudinary } = await import('cloudinary');
      cloudinary.config({
        cloud_name: ENV.cloudinaryCloudName,
        api_key: ENV.cloudinaryApiKey,
        api_secret: ENV.cloudinaryApiSecret,
        secure: true,
      });
      
      const key = fileKey.replace(/^\/+/, '');
      const fullPublicId = key.startsWith('farmacologia-materiais/') ? key : `farmacologia-materiais/${key}`;
      
      // Extrair nome do arquivo original (remover timestamp prefix)
      const rawFileName = fileKey.split('/').pop() || 'download';
      // Remove o prefixo timestamp-hash (ex: "1774827483589-t60tkj8d-")
      const cleanFileName = rawFileName.replace(/^\d+-[a-z0-9]+-/, '');
      const fileName = cleanFileName || rawFileName;
      
      console.log(`[Download] fileKey: ${fileKey}, fullPublicId: ${fullPublicId}, fileName: ${fileName}`);
      
      // Gerar URL de download via generate_archive API (funciona com Signed URLs only)
      const downloadUrl = cloudinary.utils.download_zip_url({
        public_ids: [fullPublicId],
        resource_type: 'raw',
        flatten_folders: true,
      });
      
      console.log(`[Download] Generated archive URL for: ${fullPublicId}`);
      
      // Baixar o ZIP do Cloudinary
      const zipResp = await globalThis.fetch(downloadUrl);
      if (!zipResp.ok) {
        console.error(`[Download] Archive download failed: ${zipResp.status}`);
        return res.status(404).json({ error: 'Arquivo não encontrado no Cloudinary' });
      }
      
      const zipBuffer = Buffer.from(await zipResp.arrayBuffer());
      
      // Extrair o arquivo do ZIP
      const AdmZip = (await import('adm-zip')).default;
      const zip = new AdmZip(zipBuffer);
      const entries = zip.getEntries();
      
      if (entries.length === 0) {
        return res.status(404).json({ error: 'Arquivo vazio no Cloudinary' });
      }
      
      // Pegar o primeiro (e único) arquivo do ZIP
      const entry = entries[0];
      const fileData = entry.getData();
      
      // Detectar content-type baseado na extensão
      const ext = fileName.split('.').pop()?.toLowerCase();
      const contentTypes: Record<string, string> = {
        'pdf': 'application/pdf',
        'doc': 'application/msword',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'ppt': 'application/vnd.ms-powerpoint',
        'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'xls': 'application/vnd.ms-excel',
        'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'gif': 'image/gif',
        'mp4': 'video/mp4',
        'mp3': 'audio/mpeg',
        'zip': 'application/zip',
        'txt': 'text/plain',
      };
      const contentType = contentTypes[ext || ''] || 'application/octet-stream';
      
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
      res.setHeader('Content-Length', fileData.length.toString());
      
      console.log(`[Download] Serving file: ${fileName} (${fileData.length} bytes)`);
      res.send(fileData);
    } catch (err: any) {
      console.error('Material download proxy error:', err?.message || err, err?.stack);
      return res.status(500).json({ error: 'Erro ao baixar material', details: err?.message });
    }
  });

  // tRPC API (rate limited above)
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, async () => {
    console.log(`Server running on http://localhost:${port}/`);
    console.log('[Security] Helmet enabled');
    console.log('[Security] CORS configured');
    console.log('[Security] Rate limiting enabled');
    console.log('[WebSocket] Real-time notifications enabled');
    
    // Auto-migração: adicionar colunas de geolocalização se não existirem
    try {
      const { getRawDb } = await import("../db");
      const rawDb = await getRawDb();
      if (rawDb) {
        const geoMigrations = [
          "ALTER TABLE qrCodeSessions ADD COLUMN geoLatitude DECIMAL(10,7) DEFAULT NULL",
          "ALTER TABLE qrCodeSessions ADD COLUMN geoLongitude DECIMAL(10,7) DEFAULT NULL",
          "ALTER TABLE qrCodeSessions ADD COLUMN geoRadiusMeters INT NOT NULL DEFAULT 150",
          "ALTER TABLE qrCodeSessions ADD COLUMN geoValidationEnabled BOOLEAN NOT NULL DEFAULT TRUE",
          "ALTER TABLE attendanceRecords ADD COLUMN latitude DECIMAL(10,7) DEFAULT NULL",
          "ALTER TABLE attendanceRecords ADD COLUMN longitude DECIMAL(10,7) DEFAULT NULL",
          "ALTER TABLE attendanceRecords ADD COLUMN distanceMeters DECIMAL(8,2) DEFAULT NULL",
          "ALTER TABLE attendanceRecords ADD COLUMN geoStatus ENUM('valid','invalid','no_gps','disabled') DEFAULT 'no_gps'",
          "ALTER TABLE studentAccounts ADD COLUMN gender ENUM('male','female') DEFAULT 'male'",
        ];
        for (const sql of geoMigrations) {
          try {
            await rawDb.execute(sql);
            console.log(`[Migration] OK: ${sql.substring(0, 60)}...`);
          } catch (err: any) {
            if (err?.code === 'ER_DUP_FIELDNAME' || err?.message?.includes('Duplicate column')) {
              // Coluna já existe, ignorar
            } else {
              console.warn(`[Migration] Warn: ${err?.message?.substring(0, 80)}`);
            }
          }
        }
        console.log('[Migration] Geo columns migration check complete');
        
        // Migração: criar tabela groupActivityGrades se não existir
        try {
          await rawDb.execute(`
            CREATE TABLE IF NOT EXISTS groupActivityGrades (
              id INT AUTO_INCREMENT PRIMARY KEY,
              classId INT NOT NULL,
              activityType ENUM('kahoot', 'clinical_case') NOT NULL,
              activityName VARCHAR(200) NOT NULL,
              homeGroupId INT DEFAULT NULL,
              groupName VARCHAR(200) NOT NULL,
              grade DECIMAL(5,2) NOT NULL DEFAULT 0,
              maxGrade DECIMAL(5,2) NOT NULL DEFAULT 10,
              notes TEXT,
              launchedByMonitorId INT DEFAULT NULL,
              launchedByName VARCHAR(200) DEFAULT NULL,
              createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
              updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
          `);
          console.log('[Migration] OK: groupActivityGrades table created/verified');
        } catch (err: any) {
          console.warn('[Migration] groupActivityGrades:', err?.message?.substring(0, 80));
        }

        // Migração: adicionar assignedClassId em studentAccounts (para monitores)
        try {
          await rawDb.execute(`ALTER TABLE studentAccounts ADD COLUMN assignedClassId INT DEFAULT NULL`);
          console.log('[Migration] OK: assignedClassId added to studentAccounts');
        } catch (err: any) {
          if (!err?.message?.includes('Duplicate column') && err?.code !== 'ER_DUP_FIELDNAME') {
            console.warn('[Migration] assignedClassId:', err?.message?.substring(0, 80));
          }
        }
        // Migração: adicionar colunas de PF por fase no jigsawScores (F1=0-2, F2=0-5, F3=0-3, Total=0-10)
        const jigsawPFMigrations = [
          `ALTER TABLE jigsawScores ADD COLUMN fase1PF DECIMAL(5,2) NOT NULL DEFAULT 0`,
          `ALTER TABLE jigsawScores ADD COLUMN fase2PF DECIMAL(5,2) NOT NULL DEFAULT 0`,
          `ALTER TABLE jigsawScores ADD COLUMN fase3PF DECIMAL(5,2) NOT NULL DEFAULT 0`,
        ];
        for (const sql of jigsawPFMigrations) {
          try {
            await rawDb.execute(sql);
            console.log(`[Migration] OK: ${sql.substring(0, 70)}...`);
          } catch (err: any) {
            if (err?.code !== 'ER_DUP_FIELDNAME' && !err?.message?.includes('Duplicate column')) {
              console.warn(`[Migration] jigsawPF: ${err?.message?.substring(0, 80)}`);
            }
          }
        }

        // === CRON JOB: Verificar e conceder bônus de eventos (a cada 30 minutos) ===
        async function checkEventBonuses() {
          try {
            const db = await getRawDb();
            if (!db) return;
            
            // Buscar eventos ativos
            const [events] = await db.execute(
              `SELECT * FROM gameEvents WHERE isActive = 1 AND endDate >= NOW()`
            ) as any;
            
            if (!events || events.length === 0) {
              console.log('[EventBonus] Nenhum evento ativo encontrado');
              return;
            }
            
            for (const event of events) {
              console.log(`[EventBonus] Processando evento: ${event.eventName}`);
              
              // Buscar alunos que completaram todas as quests do evento
              const questIds = JSON.parse(event.requiredQuestIds || '[]');
              if (questIds.length === 0) continue;
              
              const placeholders = questIds.map(() => '?').join(',');
              
              // Encontrar alunos com progresso no jogo que completaram TODAS as quests requeridas
              const [eligibleStudents] = await db.execute(
                `SELECT gp.memberId, gp.id as gameProgressId, m.name as studentName
                 FROM gameProgress gp
                 JOIN members m ON m.id = gp.memberId
                 WHERE (
                   SELECT COUNT(DISTINCT gt.description)
                   FROM gameTransactions gt
                   WHERE gt.gameProgressId = gp.id
                   AND gt.type = 'quest_complete'
                   AND gt.description IN (${placeholders})
                 ) >= ?
                 AND gp.memberId NOT IN (
                   SELECT memberId FROM gameEventRewards WHERE eventId = ?
                 )`,
                [...questIds.map(String), questIds.length, event.id]
              ) as any;
              
              if (!eligibleStudents || eligibleStudents.length === 0) {
                console.log(`[EventBonus] Nenhum aluno elegível para o evento ${event.eventName}`);
                continue;
              }
              
              let bonusCount = 0;
              for (const student of eligibleStudents) {
                try {
                  // Conceder bônus de PF
                  await db.execute(
                    `UPDATE gameProgress SET totalPF = totalPF + ? WHERE id = ?`,
                    [event.bonusPF, student.gameProgressId]
                  );
                  
                  // Registrar transação
                  await db.execute(
                    `INSERT INTO gameTransactions (gameProgressId, type, amount, description, createdAt)
                     VALUES (?, 'event_bonus', ?, ?, NOW())`,
                    [student.gameProgressId, event.bonusPF, `Bônus do evento: ${event.eventName}`]
                  );
                  
                  // Registrar que o aluno já recebeu o bônus
                  await db.execute(
                    `INSERT INTO gameEventRewards (eventId, memberId, bonusPF, grantedAt)
                     VALUES (?, ?, ?, NOW())`,
                    [event.id, student.memberId, event.bonusPF]
                  );
                  
                  bonusCount++;
                  console.log(`[EventBonus] +${event.bonusPF} PF para ${student.studentName} (evento: ${event.eventName})`);
                } catch (err: any) {
                  console.warn(`[EventBonus] Erro ao conceder bônus para memberId ${student.memberId}:`, err?.message?.substring(0, 100));
                }
              }
              
              console.log(`[EventBonus] ${bonusCount} alunos receberam bônus do evento ${event.eventName}`);
            }
          } catch (err: any) {
            console.warn('[EventBonus] Erro no cron job:', err?.message?.substring(0, 100));
          }
        }
        
        // Executar imediatamente na inicialização
        checkEventBonuses();
        
        // Executar a cada 30 minutos
        setInterval(checkEventBonuses, 30 * 60 * 1000);
        console.log('[CronJob] Event bonus checker started (every 30 minutes)');

      }
    } catch (err) {
      console.warn('[Migration] Could not run geo migration:', err);
    }
  });
}

// Ensure ALLOWED_ORIGINS is set in production
if (process.env.NODE_ENV === 'production' && !process.env.ALLOWED_ORIGINS) {
  console.warn('[WARNING] ALLOWED_ORIGINS not set in production. CORS may not work correctly.');
}

startServer().catch(console.error);
