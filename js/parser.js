/**
 * parser.js
 * 画像バイナリ解析（PNG / JPEG / WebP）および SD Forge メタデータ・テンプレート抽出エンジン
 */

/**
 * エスケープされた文字列（改行、ダブルクォート、タブ、バックスラッシュ）をアンエスケープして復元
 * @param {string} str 
 * @returns {string}
 */
function unescapeTemplateString(str) {
  if (!str) return '';
  return str
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');
}

/**
 * 入力されたテキストからプロンプト・ネガティブプロンプト・生成パラメータを解析・抽出
 * @param {string} text 
 * @returns {object} 解析結果オブジェクト
 */
function parseMetadata(text) {
  if (!text || !text.trim()) {
    return {
      isEmpty: true,
      template: null,
      negativeTemplate: null,
      hasTemplate: false,
      hasNegativeTemplate: false,
      extraParams: {}
    };
  }

  // クォートで囲まれた Template / Negative Template の抽出用正規表現
  const templateQuotedRegex = /(?<!Negative\s+)Template:\s*"((?:[^"\\]|\\.)*)"/s;
  const negTemplateQuotedRegex = /Negative Template:\s*"((?:[^"\\]|\\.)*)"/s;

  const templateMatch = text.match(templateQuotedRegex);
  const negTemplateMatch = text.match(negTemplateQuotedRegex);

  let template = templateMatch ? unescapeTemplateString(templateMatch[1]) : null;
  let negativeTemplate = negTemplateMatch ? unescapeTemplateString(negTemplateMatch[1]) : null;

  // クォートなしの場合のフォールバック
  if (template === null) {
    const templateUnquoted = /(?<!Negative\s+)Template:\s*([^,\n]+?)(?=,\s*[A-Za-z0-9\s_-]+:|$)/s;
    const unquotedMatch = text.match(templateUnquoted);
    if (unquotedMatch) {
      template = unescapeTemplateString(unquotedMatch[1].trim());
    }
  }

  if (negativeTemplate === null) {
    const negTemplateUnquoted = /Negative Template:\s*([^,\n]+?)(?=,\s*[A-Za-z0-9\s_-]+:|$)/s;
    const unquotedMatch = text.match(negTemplateUnquoted);
    if (unquotedMatch) {
      negativeTemplate = unescapeTemplateString(unquotedMatch[1].trim());
    }
  }

  // Template/Negative Templateが見つからない場合、標準のWebUIパラメータ形式（Prompt / Negative prompt / Steps）から抽出
  if (!template && !negativeTemplate) {
    const stepsIdx = text.search(/(?:^|\n)Steps:\s*\d+/i);
    const negIdx = text.search(/(?:^|\n)Negative prompt:/i);

    if (negIdx !== -1) {
      template = text.substring(0, negIdx).trim();
      if (stepsIdx !== -1 && stepsIdx > negIdx) {
        negativeTemplate = text.substring(negIdx, stepsIdx).replace(/^(?:^|\n)Negative prompt:\s*/i, '').trim();
      } else {
        negativeTemplate = text.substring(negIdx).replace(/^(?:^|\n)Negative prompt:\s*/i, '').trim();
      }
    } else if (stepsIdx !== -1) {
      template = text.substring(0, stepsIdx).trim();
    }
  }

  // SD Forge の主要生成パラメータの抽出
  const extraParams = {};
  const knownKeys = [
    'Steps', 'Sampler', 'Schedule type', 'CFG scale', 'Distilled CFG Scale',
    'Shift', 'Seed', 'Size', 'Model', 'Model hash', 'Lora hashes',
    'Module 1', 'Module 2', 'Emphasis', 'Discard penultimate sigma', 'RNG', 'Version'
  ];

  for (const key of knownKeys) {
    const regex = new RegExp(`(?:^|[,\\n])\\s*${key}:\\s*("((?:[^"\\\\]|\\\\.)*)"|[^,\\n]+)`, 'i');
    const match = text.match(regex);
    if (match) {
      let val = match[1].trim();
      if (val.startsWith('"') && val.endsWith('"')) {
        val = unescapeTemplateString(val.slice(1, -1));
      }
      extraParams[key] = val;
    }
  }

  return {
    isEmpty: false,
    template,
    negativeTemplate,
    hasTemplate: template !== null && template.length > 0,
    hasNegativeTemplate: negativeTemplate !== null && negativeTemplate.length > 0,
    extraParams
  };
}

/**
 * UTF-8またはISO-8859-1（Latin-1）バイト列を文字列へデコード
 * @param {Uint8Array} bytes 
 * @returns {string}
 */
function decodeUtf8OrLatin(bytes) {
  try {
    return new TextDecoder('utf-8').decode(bytes);
  } catch (e) {
    return new TextDecoder('iso-8859-1').decode(bytes);
  }
}

/**
 * TIFFヘッダに基づくExif構造を解析（JPEG APP1 および WebP EXIF チャンクで使用）
 * @param {Uint8Array} uint8 
 * @param {number} tiffStart 
 * @returns {string|null}
 */
function parseTiffExif(uint8, tiffStart) {
  if (tiffStart + 8 > uint8.length) return null;
  const isLittle = uint8[tiffStart] === 0x49 && uint8[tiffStart + 1] === 0x49;
  const isBig = uint8[tiffStart] === 0x4d && uint8[tiffStart + 1] === 0x4d;
  if (!isLittle && !isBig) return null;

  const dataView = new DataView(uint8.buffer, uint8.byteOffset, uint8.byteLength);
  const littleEndian = isLittle;

  const tag42 = dataView.getUint16(tiffStart + 2, littleEndian);
  if (tag42 !== 42) return null;

  const ifd0Offset = dataView.getUint32(tiffStart + 4, littleEndian);
  const currentIfd = tiffStart + ifd0Offset;

  let userComment = null;
  let imageDescription = null;
  let exifIfdOffset = null;

  function scanIfd(offset) {
    if (offset + 2 > uint8.length) return;
    const numEntries = dataView.getUint16(offset, littleEndian);
    let entryOffset = offset + 2;

    for (let i = 0; i < numEntries; i++) {
      if (entryOffset + 12 > uint8.length) break;
      const tag = dataView.getUint16(entryOffset, littleEndian);
      const type = dataView.getUint16(entryOffset + 2, littleEndian);
      const count = dataView.getUint32(entryOffset + 4, littleEndian);
      const valOffset = entryOffset + 8;

      let valueBytesOffset = valOffset;
      if (count > 4 || (type === 2 && count > 4) || (type === 7 && count > 4)) {
        valueBytesOffset = tiffStart + dataView.getUint32(valOffset, littleEndian);
      }

      if (tag === 0x010e) { // ImageDescription
        if (valueBytesOffset + count <= uint8.length) {
          imageDescription = decodeUtf8OrLatin(uint8.subarray(valueBytesOffset, valueBytesOffset + count)).replace(/\0+$/, '');
        }
      } else if (tag === 0x8769) { // Exif IFD Pointer
        exifIfdOffset = tiffStart + dataView.getUint32(valOffset, littleEndian);
      } else if (tag === 0x9286) { // UserComment
        if (valueBytesOffset + count <= uint8.length) {
          const commentBytes = uint8.subarray(valueBytesOffset, valueBytesOffset + count);
          if (commentBytes.length >= 8) {
            const prefix = String.fromCharCode(...commentBytes.subarray(0, 8));
            const dataSub = commentBytes.subarray(8);
            if (prefix.startsWith('UNICODE')) {
              let decoded = '';
              try {
                decoded = new TextDecoder('utf-8', { fatal: true }).decode(dataSub);
              } catch (e) {
                try {
                  decoded = new TextDecoder('utf-16').decode(dataSub);
                } catch (e2) {
                  decoded = decodeUtf8OrLatin(dataSub);
                }
              }
              userComment = decoded.replace(/\0+$/, '');
            } else if (prefix.startsWith('ASCII')) {
              userComment = decodeUtf8OrLatin(dataSub).replace(/\0+$/, '');
            } else {
              userComment = decodeUtf8OrLatin(commentBytes).replace(/\0+$/, '');
            }
          } else {
            userComment = decodeUtf8OrLatin(commentBytes).replace(/\0+$/, '');
          }
        }
      }

      entryOffset += 12;
    }
  }

  scanIfd(currentIfd);
  if (exifIfdOffset) {
    scanIfd(exifIfdOffset);
  }

  return userComment || imageDescription;
}

/**
 * バイナリ全体からプロンプト・パラメータ文字列のパターンを直接スキャン（フォールバック用）
 * @param {Uint8Array} uint8 
 * @returns {string|null}
 */
function scanForPromptStrings(uint8) {
  const str = decodeUtf8OrLatin(uint8);
  const stepsMatch = str.match(/Steps:\s*\d+,\s*Sampler:/i);
  const templateMatch = str.match(/(?:Template:\s*"|Negative Template:\s*")/i);

  if (stepsMatch || templateMatch) {
    const anchorIdx = (templateMatch || stepsMatch).index;
    let startIdx = 0;
    const searchBack = str.substring(Math.max(0, anchorIdx - 2000), anchorIdx);
    const mIdx = searchBack.lastIndexOf('masterpiece');
    if (mIdx !== -1) {
      startIdx = Math.max(0, anchorIdx - 2000 + mIdx);
    } else {
      startIdx = Math.max(0, anchorIdx - 1000);
    }

    const endMatch = str.substring(anchorIdx).match(/Version:\s*[^\n\r,"]+/i);
    let endIdx = anchorIdx + 3000;
    if (endMatch) {
      endIdx = anchorIdx + endMatch.index + endMatch[0].length;
    }

    return str.substring(startIdx, endIdx).trim();
  }

  return null;
}

/**
 * PNGバッファから tEXt / iTXt チャンク内のメタデータを抽出
 * @param {ArrayBuffer} arrayBuffer 
 * @param {Uint8Array} uint8 
 * @returns {string|null}
 */
function parsePngBuffer(arrayBuffer, uint8) {
  const dataView = new DataView(arrayBuffer);
  let offset = 8;
  const metadata = {};
  const utf8Decoder = new TextDecoder('utf-8');
  const latin1Decoder = new TextDecoder('iso-8859-1');

  while (offset + 8 <= uint8.length) {
    const length = dataView.getUint32(offset, false);
    offset += 4;

    const chunkType = String.fromCharCode(
      uint8[offset],
      uint8[offset + 1],
      uint8[offset + 2],
      uint8[offset + 3]
    );
    offset += 4;

    if (offset + length > uint8.length) break;

    if (chunkType === 'tEXt') {
      const chunkData = uint8.subarray(offset, offset + length);
      const nullIdx = chunkData.indexOf(0);
      if (nullIdx !== -1) {
        const keyword = latin1Decoder.decode(chunkData.subarray(0, nullIdx));
        let text = '';
        try {
          text = utf8Decoder.decode(chunkData.subarray(nullIdx + 1));
        } catch (e) {
          text = latin1Decoder.decode(chunkData.subarray(nullIdx + 1));
        }
        metadata[keyword] = text;
      }
    } else if (chunkType === 'iTXt') {
      const chunkData = uint8.subarray(offset, offset + length);
      const nullIdx1 = chunkData.indexOf(0);
      if (nullIdx1 !== -1) {
        const keyword = utf8Decoder.decode(chunkData.subarray(0, nullIdx1));
        const compFlag = chunkData[nullIdx1 + 1];
        const idx = nullIdx1 + 3;
        const nullIdx2 = chunkData.indexOf(0, idx);
        if (nullIdx2 !== -1) {
          const nullIdx3 = chunkData.indexOf(0, nullIdx2 + 1);
          if (nullIdx3 !== -1) {
            const rawText = chunkData.subarray(nullIdx3 + 1);
            if (compFlag === 0) {
              metadata[keyword] = utf8Decoder.decode(rawText);
            }
          }
        }
      }
    } else if (chunkType === 'IEND') {
      break;
    }

    offset += length + 4;
  }

  if (metadata['parameters']) return metadata['parameters'];
  if (metadata['prompt']) return metadata['prompt'];
  if (metadata['Description']) return metadata['Description'];
  if (metadata['Comment']) return metadata['Comment'];

  const firstKey = Object.keys(metadata)[0];
  return firstKey ? metadata[firstKey] : null;
}

/**
 * JPEGバッファから APP1 Exif または COM セグメントのメタデータを抽出
 * @param {Uint8Array} uint8 
 * @returns {string|null}
 */
function parseJpegBuffer(uint8) {
  let offset = 2;
  while (offset + 4 <= uint8.length) {
    if (uint8[offset] !== 0xff) {
      offset++;
      continue;
    }

    const marker = uint8[offset + 1];
    offset += 2;

    if (marker === 0xda) break; // Start of Scan
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) continue;

    if (offset + 2 > uint8.length) break;
    const length = (uint8[offset] << 8) | uint8[offset + 1];
    const segmentData = uint8.subarray(offset + 2, offset + length);

    if (marker === 0xe1) { // APP1 Exif
      if (segmentData.length >= 6 &&
          segmentData[0] === 0x45 && segmentData[1] === 0x78 && segmentData[2] === 0x69 &&
          segmentData[3] === 0x66 && segmentData[4] === 0x00 && segmentData[5] === 0x00) {
        const tiffStart = offset + 2 + 6;
        const meta = parseTiffExif(uint8, tiffStart);
        if (meta && (meta.includes('Steps:') || meta.includes('Template:') || meta.includes('Negative prompt:'))) {
          return meta;
        }
      }
    }

    if (marker === 0xfe) { // COM Comment
      const commentText = decodeUtf8OrLatin(segmentData);
      if (commentText && (commentText.includes('Steps:') || commentText.includes('Template:') || commentText.includes('Negative prompt:'))) {
        return commentText;
      }
    }

    offset += length;
  }

  return scanForPromptStrings(uint8);
}

/**
 * WebPバッファから EXIF または XMP チャンクのメタデータを抽出
 * @param {Uint8Array} uint8 
 * @returns {string|null}
 */
function parseWebpBuffer(uint8) {
  let offset = 12;
  while (offset + 8 <= uint8.length) {
    const chunkHeader = String.fromCharCode(
      uint8[offset],
      uint8[offset + 1],
      uint8[offset + 2],
      uint8[offset + 3]
    );
    const chunkSize = uint8[offset + 4] | (uint8[offset + 5] << 8) | (uint8[offset + 6] << 16) | (uint8[offset + 7] << 24);
    offset += 8;

    if (chunkHeader === 'EXIF') {
      let exifOffset = offset;
      if (offset + 6 <= uint8.length &&
          uint8[offset] === 0x45 && uint8[offset + 1] === 0x78 && uint8[offset + 2] === 0x69 &&
          uint8[offset + 3] === 0x66 && uint8[offset + 4] === 0x00 && uint8[offset + 5] === 0x00) {
        exifOffset += 6;
      }
      const meta = parseTiffExif(uint8, exifOffset);
      if (meta) return meta;
    } else if (chunkHeader === 'XMP ') {
      const xmpText = decodeUtf8OrLatin(uint8.subarray(offset, offset + chunkSize));
      if (xmpText && (xmpText.includes('Steps:') || xmpText.includes('Template:') || xmpText.includes('Negative prompt:'))) {
        return xmpText;
      }
    }

    offset += chunkSize;
    if (chunkSize % 2 !== 0) offset++;
  }

  return scanForPromptStrings(uint8);
}

/**
 * 画像Fileオブジェクトからメタデータ文字列を抽出
 * @param {File} file 
 * @returns {Promise<string|null>}
 */
async function extractMetadataFromImage(file) {
  const buffer = await file.arrayBuffer();
  const uint8 = new Uint8Array(buffer);

  // Check PNG Signature: 89 50 4E 47 0D 0A 1A 0A
  if (uint8.length >= 8 &&
      uint8[0] === 0x89 && uint8[1] === 0x50 && uint8[2] === 0x4e && uint8[3] === 0x47 &&
      uint8[4] === 0x0d && uint8[5] === 0x0a && uint8[6] === 0x1a && uint8[7] === 0x0a) {
    return parsePngBuffer(buffer, uint8);
  }

  // Check JPEG Signature: FF D8
  if (uint8.length >= 2 && uint8[0] === 0xff && uint8[1] === 0xd8) {
    return parseJpegBuffer(uint8);
  }

  // Check WebP Signature: RIFF....WEBP
  if (uint8.length >= 12 &&
      String.fromCharCode(uint8[0], uint8[1], uint8[2], uint8[3]) === 'RIFF' &&
      String.fromCharCode(uint8[8], uint8[9], uint8[10], uint8[11]) === 'WEBP') {
    return parseWebpBuffer(uint8);
  }

  // Fallback text scanner
  return scanForPromptStrings(uint8);
}
