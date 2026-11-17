#!/usr/bin/env node
/**
 * aplicar_v18.mjs — tira do mural/faixa do topo os avisos AUTOMÁTICOS do sistema
 * ("Conquista Desbloqueada", "Nova Conquista", "Pontuações Atualizadas").
 * Os avisos que o professor publica continuam iguais.
 *
 *   Rodar na raiz do projeto:  node aplicar_v18.mjs
 */
import fs from "node:fs";
const p = "server/routers.ts";
if (!fs.existsSync(p)) { console.log("✘ server/routers.ts não encontrado — rode na pasta do projeto"); process.exit(1); }
const original = fs.readFileSync(p, "utf8");
const crlf = original.includes("\r\n");
let s = original.replace(/\r\n/g, "\n");
if (s.includes("avisos automáticos desligados (v18)")) { console.log("• já aplicado"); process.exit(0); }
const corpo = /(async function createStudentNotification\(title: string, content: string, priority: "normal" \| "important" \| "urgent" = "normal"\) \{\n)\s*try \{\n\s*await db\.createNotification\(\{\n\s*title,\n\s*content,\n\s*priority,\n\s*type: "announcement",\n\s*isActive: 1,\n\s*\}\);\n\s*\} catch \(err\) \{\n\s*console\.warn\("\[StudentNotification\] Failed:", err\);\n\s*\}\n\}/;
if (!corpo.test(s)) { console.log("✘ createStudentNotification com formato diferente — nada alterado"); process.exit(1); }
s = s.replace(corpo, (m, cab) => cab +
  "  // avisos automáticos desligados (v18): conquistas e atualizações de PF não vão mais para o mural/faixa do topo.\n" +
  "  // O professor continua recebendo a notificação dele (sendNotificationAsync).\n" +
  "  void title; void content; void priority;\n}");
fs.writeFileSync(p, crlf ? s.replace(/\n/g, "\r\n") : s);
console.log("\nResultado da v18:\n  ✔ server/routers.ts: conquistas e PF não geram mais aviso automático no mural\n");
