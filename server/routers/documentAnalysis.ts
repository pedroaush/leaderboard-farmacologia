/**
 * Análise heurística de documentos anexados como justificativa de falta.
 *
 * IMPORTANTE — leia antes de usar:
 * Isso NÃO detecta se um documento é "falso". Detecta sinais objetivos que
 * PODEM indicar edição digital, mas que também aparecem em documentos 100%
 * legítimos (ex.: um atestado escaneado por um app de celular, ou emitido
 * digitalmente por uma clínica, frequentemente não tem EXIF de câmera e
 * pode ter metadados de "editor" só por causa do software do scanner).
 *
 * O suspicionScore é só um heurístico de 0 a 100 pra ordenar prioridade de
 * revisão manual — nunca deve ser tratado como prova, e a lista de sinais
 * deve ser sempre mostrada ao professor em linguagem clara, para que ele
 * mesmo julgue. Nunca usar isso para rejeitar automaticamente um documento.
 */

export interface AnaliseDocumento {
  suspicionScore: number; // 0-100, heurístico — não é probabilidade de fraude
  signals: string[]; // sinais encontrados, em português, prontos pra exibir
}

/** Ponto de entrada: decide o parser certo pelo mimeType. */
export function analisarDocumento(base64: string, mimeType: string): AnaliseDocumento {
  try {
    const buffer = Buffer.from(base64, "base64");
    if (mimeType === "application/pdf") return analisarPDF(buffer);
    if (mimeType.startsWith("image/")) return analisarImagem(buffer, mimeType);
    return { suspicionScore: 0, signals: ["Tipo de arquivo não analisado automaticamente (só PDF e imagens)."] };
  } catch (e) {
    return { suspicionScore: 0, signals: ["Não foi possível analisar o arquivo (formato inesperado)."] };
  }
}

/** PDFs: procura metadados de edição no texto bruto do arquivo. */
function analisarPDF(buffer: Buffer): AnaliseDocumento {
  const signals: string[] = [];
  let score = 0;

  // PDFs são parcialmente texto (mesmo com streams binários comprimidos, os
  // metadados /Producer /Creator /ModDate costumam ficar em texto puro).
  const texto = buffer.toString("latin1");

  const producerMatch = texto.match(/\/Producer\s*\(([^)]*)\)/);
  const creatorMatch = texto.match(/\/Creator\s*\(([^)]*)\)/);
  const modDateMatch = texto.match(/\/ModDate\s*\(([^)]*)\)/);
  const creationDateMatch = texto.match(/\/CreationDate\s*\(([^)]*)\)/);

  const producer = producerMatch?.[1] || "";
  const creator = creatorMatch?.[1] || "";

  const ferramentasEdicaoImagem = ["photoshop", "gimp", "paint.net", "canva", "pixlr"];
  const combinado = (producer + " " + creator).toLowerCase();
  const ferramentaEncontrada = ferramentasEdicaoImagem.find(f => combinado.includes(f));
  if (ferramentaEncontrada) {
    score += 35;
    signals.push(`Metadado do PDF indica que passou por um editor de imagem (${ferramentaEncontrada}), incomum para um documento apenas escaneado.`);
  }

  if (modDateMatch && creationDateMatch && modDateMatch[1] !== creationDateMatch[1]) {
    score += 20;
    signals.push("A data de criação e a data de última modificação do arquivo são diferentes — o arquivo foi reaberto e salvo de novo depois de criado.");
  }

  // Múltiplas ocorrências de /Producer podem indicar que o PDF passou por
  // mais de uma ferramenta (ex.: criado, depois reprocessado por outra).
  const producerCount = (texto.match(/\/Producer\s*\(/g) || []).length;
  if (producerCount > 1) {
    score += 15;
    signals.push(`O arquivo tem ${producerCount} registros de "produtor" diferentes, sugerindo que passou por mais de uma ferramenta/processamento.`);
  }

  if (!producer && !creator) {
    signals.push("O PDF não tem metadados de origem (nem sempre é suspeito — muitos scanners de celular removem essa informação).");
  }

  return { suspicionScore: Math.min(100, score), signals };
}

/** Imagens: procura o segmento EXIF (JPEG) e sinaliza ausência ou tag de editor. */
function analisarImagem(buffer: Buffer, mimeType: string): AnaliseDocumento {
  const signals: string[] = [];
  let score = 0;

  if (mimeType !== "image/jpeg" && mimeType !== "image/jpg") {
    // PNG e outros formatos comuns de print/screenshot não carregam EXIF de
    // câmera por natureza — não é um sinal forte aqui.
    signals.push(`Formato ${mimeType} não guarda metadados de câmera por padrão — normal para prints e capturas de tela.`);
    return { suspicionScore: 0, signals };
  }

  const exif = extrairSoftwareTagJPEG(buffer);
  if (exif.softwareTag) {
    const editoresConhecidos = ["photoshop", "gimp", "snapseed", "picsart", "lightroom", "canva"];
    const editorEncontrado = editoresConhecidos.find(e => exif.softwareTag!.toLowerCase().includes(e));
    if (editorEncontrado) {
      score += 40;
      signals.push(`A foto tem uma tag EXIF indicando edição em "${exif.softwareTag}" — um editor de imagem, não uma câmera.`);
    } else {
      signals.push(`Tag de software encontrada: "${exif.softwareTag}".`);
    }
  }

  if (!exif.hasExif) {
    signals.push("A imagem não tem metadados EXIF (comum em fotos tiradas e enviadas por WhatsApp, que removem essa informação — não é, sozinho, sinal de alteração).");
  }

  return { suspicionScore: Math.min(100, score), signals };
}

/**
 * Parser mínimo do segmento APP1 (EXIF) de um JPEG, sem dependências
 * externas. Procura especificamente a tag "Software" (0x0131) no IFD0.
 * Não é um parser EXIF completo — é o suficiente para o sinal que
 * precisamos aqui.
 */
function extrairSoftwareTagJPEG(buffer: Buffer): { hasExif: boolean; softwareTag: string | null } {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return { hasExif: false, softwareTag: null }; // não é um JPEG válido
  }

  let offset = 2;
  while (offset < buffer.length - 4) {
    if (buffer[offset] !== 0xff) break;
    const marker = buffer[offset + 1];
    const segmentLength = buffer.readUInt16BE(offset + 2);

    if (marker === 0xe1) {
      // APP1 — provável EXIF
      const exifStart = offset + 4;
      const header = buffer.toString("ascii", exifStart, exifStart + 6);
      if (header.startsWith("Exif")) {
        const tiffStart = exifStart + 6;
        const isLittleEndian = buffer.toString("ascii", tiffStart, tiffStart + 2) === "II";
        const readU16 = (o: number) => (isLittleEndian ? buffer.readUInt16LE(o) : buffer.readUInt16BE(o));
        const readU32 = (o: number) => (isLittleEndian ? buffer.readUInt32LE(o) : buffer.readUInt32BE(o));

        const ifd0Offset = tiffStart + readU32(tiffStart + 4);
        const numEntries = readU16(ifd0Offset);
        for (let i = 0; i < numEntries; i++) {
          const entryOffset = ifd0Offset + 2 + i * 12;
          const tag = readU16(entryOffset);
          if (tag === 0x0131) {
            // Tag "Software" — tipo ASCII, offset pro valor real
            const valueOffset = tiffStart + readU32(entryOffset + 8);
            const count = readU32(entryOffset + 4);
            const raw = buffer.toString("ascii", valueOffset, valueOffset + count).replace(/\0/g, "").trim();
            return { hasExif: true, softwareTag: raw || null };
          }
        }
        return { hasExif: true, softwareTag: null };
      }
    }
    if (marker === 0xda) break; // início dos dados da imagem, parar
    offset += 2 + segmentLength;
  }
  return { hasExif: false, softwareTag: null };
}
