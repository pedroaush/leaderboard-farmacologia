/**
 * PATCH — server/unirio-scraper.ts
 * ============================================================================
 * DOIS PROBLEMAS ENCONTRADOS, OS DOIS GRAVES:
 *
 * PROBLEMA 1 (CRÍTICO) — Credencial institucional real hardcoded no código:
 *
 *     if (testMode) {
 *       return cpf === '08714684764' && password === 'Derekriggs38';
 *     }
 *
 *   Isto é um CPF e senha REAIS, escritos em texto puro, presentes em todo o
 *   histórico do Git. AÇÃO IMEDIATA (fora deste patch): trocar essa senha
 *   diretamente no portal da UNIRIO, o quanto antes.
 *
 * PROBLEMA 2 (CRÍTICO, funcional) — Falhas viram dados FALSOS silenciosos:
 *
 *     } catch (error) {
 *       console.error(...);
 *       return MOCK_STUDENTS;   // <- erro real retorna "sucesso" com alunos fictícios
 *     }
 *     ...
 *     return students.length > 0 ? students : MOCK_STUDENTS;  // <- idem, sem erro
 *
 *   Se o portal mudar de layout, a senha estiver errada, ou a rede falhar, o
 *   código devolve "João Silva Santos", "Maria Santos Oliveira" etc. como se
 *   fossem alunos reais importados com sucesso. Isso pode POLUIR o banco com
 *   dados fictícios sem qualquer aviso ao professor.
 *
 * CORREÇÃO: erros SEMPRE propagam como erro (nunca viram mock). O modo de
 * teste (testMode) continua existindo para desenvolvimento, mas nunca roda
 * por acidente em produção (checagem de NODE_ENV) e a credencial de teste
 * sai do código.
 * ============================================================================
 */

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

export interface UnirioStudent {
  name: string;
  email: string;
  matricula: string;
  cpf?: string;
}

export interface UnirioClass {
  id: string;
  name: string;
  code: string;
  period: string;
  professor: string;
}

interface ScraperConfig {
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
  testMode?: boolean;
}

const DEFAULT_CONFIG: ScraperConfig = {
  maxRetries: 3,
  retryDelay: 2000,
  timeout: 30000,
  testMode: false,
};

// ─────────────────────────────────────────────────────────────────────────
// Dados de exemplo, usados APENAS quando testMode=true. Nunca usados como
// fallback silencioso de erro (essa era a falha original).
// ─────────────────────────────────────────────────────────────────────────
const MOCK_CLASSES: UnirioClass[] = [
  { id: 'FARM001', code: 'FARM001', name: 'Farmacologia I - Turma A (EXEMPLO)', period: '2026.1', professor: 'Dr. Pedro Braga' },
];

const MOCK_STUDENTS: UnirioStudent[] = [
  { name: '[TESTE] Aluno Exemplo', email: 'teste.exemplo@edu.unirio.br', matricula: '0000000' },
];

// ─────────────────────────────────────────────────────────────────────────
// testMode só funciona fora de produção. Em produção (Railway), é ignorado
// mesmo que alguém passe testMode: true por engano — evita que dados de
// exemplo cheguem por acidente ao banco real.
// ─────────────────────────────────────────────────────────────────────────
function testModeAtivo(config: ScraperConfig): boolean {
  return !!config.testMode && process.env.NODE_ENV !== "production";
}

// Credenciais de teste vêm do ambiente (nunca hardcoded).
// Defina TEST_UNIRIO_CPF e TEST_UNIRIO_PASSWORD no seu .env LOCAL de
// desenvolvimento — nunca no Railway de produção.
function credenciaisDeTesteValidas(cpf: string, password: string): boolean {
  const testCpf = process.env.TEST_UNIRIO_CPF;
  const testPassword = process.env.TEST_UNIRIO_PASSWORD;
  if (!testCpf || !testPassword) return false;
  return cpf === testCpf && password === testPassword;
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3, delay = 2000): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[UNIRIO] Attempt ${attempt}/${maxRetries}`);
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`[UNIRIO] Attempt ${attempt} failed:`, lastError.message);
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  // CORRIGIDO: continua lançando o erro (comportamento original preservado aqui;
  // o bug estava nas funções abaixo, que capturavam e mascaravam com mock).
  throw lastError || new Error('Numero maximo de tentativas excedido');
}

export async function validateUnirioCredentials(
  cpf: string,
  password: string,
  config: ScraperConfig = DEFAULT_CONFIG
): Promise<boolean> {
  const { maxRetries = 3, retryDelay = 2000, timeout = 30000 } = config;

  if (testModeAtivo(config)) {
    console.log('[UNIRIO] Test mode: validando credenciais de teste (ambiente de desenvolvimento)');
    return credenciaisDeTesteValidas(cpf, password);
  }

  return withRetry(
    async () => {
      let browser;
      try {
        browser = await puppeteer.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        });
        const page = await browser.newPage();
        page.setDefaultTimeout(timeout);
        page.setDefaultNavigationTimeout(timeout);

        console.log('[UNIRIO] Validando credenciais para CPF:', cpf.substring(0, 3) + '***');
        await page.goto('https://portal.unirio.br', { waitUntil: 'networkidle2' });

        await page.waitForSelector('input[type="text"], input[name*="cpf"], input[name*="usuario"]', { timeout: 10000 });
        const cpfInputs = await page.$$('input[type="text"], input[name*="cpf"], input[name*="usuario"]');
        if (cpfInputs.length === 0) throw new Error('Campo de CPF não encontrado no portal');
        await cpfInputs[0].type(cpf, { delay: 50 });

        const passwordInputs = await page.$$('input[type="password"]');
        if (passwordInputs.length === 0) throw new Error('Campo de senha não encontrado no portal');
        await passwordInputs[0].type(password, { delay: 50 });

        const submitButton = await page.$('button[type="submit"], input[type="submit"]');
        if (submitButton) {
          await submitButton.click();
          await page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => null);
        }

        const errors = await page.evaluate(() => {
          const errorElements = document.querySelectorAll('.error, .alert-danger, [role="alert"]');
          return Array.from(errorElements).map(e => e.textContent?.trim() || '');
        });

        if (errors.length > 0) {
          throw new Error(`Falha no login: ${errors.join(', ')}`);
        }

        console.log('[UNIRIO] Credenciais validadas com sucesso');
        return true;
      } finally {
        if (browser) await browser.close();
      }
      // CORRIGIDO: removido o catch que engolia o erro e retornava `false`
      // silenciosamente. Agora um erro de rede/timeout PROPAGA como erro,
      // em vez de parecer "senha errada" para o professor.
    },
    maxRetries,
    retryDelay
  );
}

export async function scrapeUnirioClasses(
  cpf: string,
  password: string,
  config: ScraperConfig = DEFAULT_CONFIG
): Promise<UnirioClass[]> {
  const { maxRetries = 3, retryDelay = 2000, timeout = 30000 } = config;

  if (testModeAtivo(config)) {
    console.log('[UNIRIO] Test mode: retornando turmas de exemplo');
    return MOCK_CLASSES;
  }

  return withRetry(
    async () => {
      let browser;
      try {
        browser = await puppeteer.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        });
        const page = await browser.newPage();
        page.setDefaultTimeout(timeout);
        page.setDefaultNavigationTimeout(timeout);

        console.log('[UNIRIO] Buscando turmas para CPF:', cpf.substring(0, 3) + '***');
        await page.goto('https://portal.unirio.br', { waitUntil: 'networkidle2' });

        const cpfInputs = await page.$$('input[type="text"], input[name*="cpf"], input[name*="usuario"]');
        if (cpfInputs.length > 0) await cpfInputs[0].type(cpf, { delay: 50 });

        const passwordInputs = await page.$$('input[type="password"]');
        if (passwordInputs.length > 0) await passwordInputs[0].type(password, { delay: 50 });

        const submitButton = await page.$('button[type="submit"], input[type="submit"]');
        if (submitButton) {
          await submitButton.click();
          await page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => null);
        }

        const classUrls = [
          'https://portal.unirio.br/turmas',
          'https://portal.unirio.br/minhas-turmas',
          'https://portal.unirio.br/docente/turmas',
        ];
        for (const url of classUrls) {
          const ok = await page.goto(url, { waitUntil: 'networkidle2' }).then(() => true).catch(() => false);
          if (ok) break;
        }

        const classes = await page.evaluate(() => {
          const result: UnirioClass[] = [];
          const rows = document.querySelectorAll('table tbody tr, .class-row, .turma-item');
          rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 2) {
              const code = cells[0]?.textContent?.trim() || '';
              const name = cells[1]?.textContent?.trim() || '';
              const professor = cells[2]?.textContent?.trim() || '';
              const period = cells[3]?.textContent?.trim() || '';
              if (code && name) result.push({ id: code, code, name, professor, period });
            }
          });
          return result;
        });

        console.log(`[UNIRIO] Encontradas ${classes.length} turmas`);

        // CORRIGIDO: zero turmas encontradas é reportado como ERRO, não como
        // sucesso silencioso com dados de exemplo. O professor precisa saber
        // que o scraper não achou nada — pode ser mudança de layout do portal.
        if (classes.length === 0) {
          throw new Error(
            'Nenhuma turma encontrada no portal UNIRIO. O layout do portal pode ' +
            'ter mudado, ou não há turmas vinculadas a este CPF. Nenhum dado de ' +
            'exemplo foi inserido.'
          );
        }
        return classes;
      } finally {
        if (browser) await browser.close();
      }
    },
    maxRetries,
    retryDelay
  );
}

export async function scrapeUnirioStudents(
  cpf: string,
  password: string,
  classCode?: string,
  config: ScraperConfig = DEFAULT_CONFIG
): Promise<UnirioStudent[]> {
  if (testModeAtivo(config)) {
    console.log('[UNIRIO] Test mode: retornando alunos de exemplo');
    return MOCK_STUDENTS;
  }
  return scrapeUnirioAllStudents(cpf, password, config);
}

export async function scrapeUnirioAllStudents(
  cpf: string,
  password: string,
  config: ScraperConfig = DEFAULT_CONFIG
): Promise<UnirioStudent[]> {
  const { maxRetries = 3, retryDelay = 2000, timeout = 30000 } = config;

  if (testModeAtivo(config)) {
    console.log('[UNIRIO] Test mode: retornando alunos de exemplo');
    return MOCK_STUDENTS;
  }

  return withRetry(
    async () => {
      let browser;
      try {
        browser = await puppeteer.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        });
        const page = await browser.newPage();
        page.setDefaultTimeout(timeout);
        page.setDefaultNavigationTimeout(timeout);

        console.log('[UNIRIO] Buscando todos os alunos para CPF:', cpf.substring(0, 3) + '***');
        await page.goto('https://portal.unirio.br', { waitUntil: 'networkidle2' });

        const cpfInputs = await page.$$('input[type="text"], input[name*="cpf"], input[name*="usuario"]');
        if (cpfInputs.length > 0) await cpfInputs[0].type(cpf, { delay: 50 });

        const passwordInputs = await page.$$('input[type="password"]');
        if (passwordInputs.length > 0) await passwordInputs[0].type(password, { delay: 50 });

        const submitButton = await page.$('button[type="submit"], input[type="submit"]');
        if (submitButton) {
          await submitButton.click();
          await page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => null);
        }

        const studentUrls = [
          'https://portal.unirio.br/alunos',
          'https://portal.unirio.br/turmas/alunos',
          'https://portal.unirio.br/docente/alunos',
        ];
        for (const url of studentUrls) {
          const ok = await page.goto(url, { waitUntil: 'networkidle2' }).then(() => true).catch(() => false);
          if (ok) break;
        }

        const students = await page.evaluate(() => {
          const result: UnirioStudent[] = [];
          const rows = document.querySelectorAll('table tbody tr, .student-row, .aluno-item');
          const seen = new Set<string>();
          rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 2) {
              const name = cells[0]?.textContent?.trim() || '';
              const email = cells[1]?.textContent?.trim() || '';
              const matricula = cells[2]?.textContent?.trim() || '';
              if (name && email && email.includes('@') && !seen.has(email)) {
                seen.add(email);
                result.push({ name, email, matricula });
              }
            }
          });
          return result;
        });

        console.log(`[UNIRIO] Encontrados ${students.length} alunos`);

        // CORRIGIDO: mesma correção — zero alunos é ERRO explícito, nunca
        // dados de exemplo silenciosos.
        if (students.length === 0) {
          throw new Error(
            'Nenhum aluno encontrado no portal UNIRIO. O layout do portal pode ' +
            'ter mudado, a turma pode estar vazia, ou houve falha no scraping. ' +
            'Nenhum dado de exemplo foi inserido.'
          );
        }
        return students;
      } finally {
        if (browser) await browser.close();
      }
    },
    maxRetries,
    retryDelay
  );
}
