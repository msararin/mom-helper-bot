const UNIT_ALIASES = {
  กก: "กิโลกรัม",
  กิโล: "กิโลกรัม",
  โล: "กิโลกรัม",
  กิโลกรัม: "กิโลกรัม",
  กรัม: "กรัม",
  ขีด: "ขีด",
  มล: "มิลลิลิตร",
  มิลลิลิตร: "มิลลิลิตร",
  ลิตร: "ลิตร",
  ช้อนชา: "ช้อนชา",
  ช้อนโต๊ะ: "ช้อนโต๊ะ",
  ถ้วย: "ถ้วย",
  แก้ว: "แก้ว",
  ฟอง: "ฟอง",
  ตัว: "ตัว",
  ลูก: "ลูก",
  ชิ้น: "ชิ้น",
  แผ่น: "แผ่น",
  ก้อน: "ก้อน",
  ฝัก: "ฝัก",
  ฝาก: "ฝัก",
  หลอด: "หลอด",
  ช้อน: "ช้อน",
  ซีก: "ซีก",
  กิ่ง: "กิ่ง",
  กำ: "กำ",
  ต้น: "ต้น",
  หัว: "หัว",
  ถุง: "ถุง",
  ซอง: "ซอง",
  ห่อ: "ห่อ",
  แพ็ค: "แพ็ก",
  แพ็ก: "แพ็ก",
  กล่อง: "กล่อง",
  กระป๋อง: "กระป๋อง",
  ขวด: "ขวด",
  โหล: "โหล",
  ถาด: "ถาด",
  แพ: "แพ",
  ชุด: "ชุด",
};

const KNOWN_UNITS = Object.keys(UNIT_ALIASES).sort(
  (left, right) => right.length - left.length
);

const SPEECH_NOISE_PREFIXES = ["พิมพ์", "อ่าน", "เอ่อ", "อ่า", "ช่วย", "ขอ", "มี"];
const SORTED_SPEECH_NOISE_PREFIXES = [...SPEECH_NOISE_PREFIXES].sort(
  (left, right) => right.length - left.length
);

function parseThaiItems(text) {
  const normalizedText = text.trim().replace(/\s+/g, " ");

  if (!normalizedText) {
    return [];
  }

  const concatenatedItems = parseConcatenatedThaiItems(normalizedText);
  if (concatenatedItems.length > 0) {
    return concatenatedItems;
  }

  const tokens = normalizedText.split(" ");
  const items = [];
  let currentNameParts = [];
  let index = 0;

  while (index < tokens.length) {
    const token = tokens[index];
    const nextToken = tokens[index + 1];
    const compactQuantityUnit = parseCompactQuantityUnitToken(token);

    if (compactQuantityUnit && currentNameParts.length > 0) {
      const normalizedItemName = normalizeItemName(
        currentNameParts.join(" ").trim()
      );
      if (!normalizedItemName) {
        currentNameParts = [];
        index += 1;
        continue;
      }

      items.push({
        item: normalizedItemName,
        quantity: compactQuantityUnit.quantity,
        unit: compactQuantityUnit.unit,
      });
      currentNameParts = [];
      index += 1;
      continue;
    }

    if (isNumericToken(token)) {
      const name = normalizeItemName(currentNameParts.join(" ").trim());
      const quantity = normalizeQuantity(token);
      const unit = normalizeUnit(nextToken || "");

      if (name) {
        items.push({
          item: name,
          quantity,
          unit,
        });
      }

      currentNameParts = [];
      index += unit ? 2 : 1;
      continue;
    }

    const nextNextToken = tokens[index + 2];
    if (
      nextToken &&
      isNumericToken(nextToken) &&
      currentNameParts.length > 0
    ) {
      currentNameParts.push(token);
      index += 1;
      continue;
    }

    if (nextToken && isNumericToken(nextToken)) {
      currentNameParts.push(token);
      index += 1;
      continue;
    }

    if (
      currentNameParts.length > 0 &&
      nextNextToken &&
      isNumericToken(nextNextToken)
    ) {
      currentNameParts.push(token);
      index += 1;
      continue;
    }

    if (currentNameParts.length > 0) {
      const normalizedItemName = normalizeItemName(
        currentNameParts.join(" ").trim()
      );
      if (normalizedItemName) {
        items.push({
          item: normalizedItemName,
          quantity: "",
          unit: "",
        });
      }
      currentNameParts = [];
    }

    currentNameParts.push(token);
    index += 1;
  }

  if (currentNameParts.length > 0) {
    const normalizedItemName = normalizeItemName(
      currentNameParts.join(" ").trim()
    );
    if (normalizedItemName) {
      items.push({
        item: normalizedItemName,
        quantity: "",
        unit: "",
      });
    }
  }

  return items.filter((item) => item.item);
}

function isNumericToken(token) {
  return /^[0-9]+(?:[.,][0-9]+)?$/.test(token);
}

function normalizeQuantity(token) {
  return token.replace(",", ".");
}

function parseConcatenatedThaiItems(text) {
  const normalizedText = text.replace(/\s+/g, "");
  const cleanedText = normalizedText.replace(/^มี/, "");
  const matches = findQuantityUnitMatches(cleanedText);

  if (matches.length === 0) {
    return [];
  }

  const items = [];
  let cursor = 0;

  for (const match of matches) {
    const itemName = normalizeItemName(cleanedText.slice(cursor, match.index));
    if (itemName) {
      items.push({
        item: itemName,
        quantity: match.quantity,
        unit: match.unit,
      });
    }
    cursor = match.endIndex;
  }

  const trailingItem = normalizeItemName(cleanedText.slice(cursor));
  if (trailingItem) {
    items.push({
      item: trailingItem,
      quantity: "",
      unit: "",
    });
  }

  return items;
}

function findQuantityUnitMatches(text) {
  const matches = [];

  for (let index = 0; index < text.length; index += 1) {
    const quantityMatch = findQuantityUnitAt(text, index);
    if (!quantityMatch) {
      continue;
    }

    matches.push(quantityMatch);
    index = quantityMatch.endIndex - 1;
  }

  return matches;
}

function findQuantityUnitAt(text, index) {
  let bestMatch = null;

  for (let end = index + 1; end <= text.length; end += 1) {
    const quantityText = text.slice(index, end);
    const quantity = normalizeSpokenQuantity(quantityText);
    if (!quantity) {
      continue;
    }

    const unitMatch = findKnownUnitAt(text, end);
    if (!unitMatch) {
      continue;
    }

    bestMatch = {
      index,
      endIndex: end + unitMatch.length,
      quantity,
      unit: normalizeUnit(unitMatch),
    };
  }

  return bestMatch;
}

function findKnownUnitAt(text, index) {
  return KNOWN_UNITS.find((unit) => text.startsWith(unit, index)) || "";
}

function normalizeSpokenQuantity(rawQuantity) {
  if (!rawQuantity) {
    return "";
  }

  if (rawQuantity === "ครึ่ง") {
    return "0.5";
  }

  const thaiDigits = rawQuantity.replace(/[๐-๙]/g, (digit) =>
    String("๐๑๒๓๔๕๖๗๘๙".indexOf(digit))
  );

  if (/^[0-9]+(?:[.,][0-9]+)?$/.test(thaiDigits)) {
    return normalizeQuantity(thaiDigits);
  }

  return parseThaiNumberWords(rawQuantity);
}

function normalizeItemName(itemName) {
  let normalized = String(itemName || "").trim();

  if (!normalized) {
    return "";
  }

  normalized = normalized.replace(/^[\s\-•·–—]+/u, "").trim();
  normalized = normalized.replace(/^[0-9๐-๙]+[.)\-:\s]*/u, "").trim();

  const speechNoisePattern = new RegExp(
    `^(?:${SORTED_SPEECH_NOISE_PREFIXES.map(escapeRegex).join("|")})+`,
    "u"
  );

  normalized = normalized.replace(speechNoisePattern, "").trim();
  normalized = normalized.replace(/^[\s\-•·–—]+/u, "").trim();

  return normalized;
}

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseCompactQuantityUnitToken(token) {
  const arabicMatch = token.match(/^([0-9]+(?:[.,][0-9]+)?)(.+)$/);
  if (arabicMatch && isKnownUnit(arabicMatch[2])) {
    return {
      quantity: normalizeQuantity(arabicMatch[1]),
      unit: normalizeUnit(arabicMatch[2]),
    };
  }

  const fractionalMatch = parseFractionalQuantityUnitToken(token);
  if (fractionalMatch) {
    return fractionalMatch;
  }

  let bestMatch = null;

  for (let splitIndex = 1; splitIndex < token.length; splitIndex += 1) {
    const quantityText = token.slice(0, splitIndex);
    const unitText = token.slice(splitIndex);
    const quantity = parseThaiNumberWords(quantityText);

    if (!quantity || !unitText || !isKnownUnit(unitText)) {
      continue;
    }

    bestMatch = {
      quantity,
      unit: normalizeUnit(unitText),
    };
  }

  return bestMatch;
}

function parseFractionalQuantityUnitToken(token) {
  if (!token.startsWith("ครึ่ง")) {
    return null;
  }

  const unitText = token.slice("ครึ่ง".length);
  if (!isKnownUnit(unitText)) {
    return null;
  }

  return {
    quantity: "0.5",
    unit: normalizeUnit(unitText),
  };
}

function parseThaiNumberWords(text) {
  const digitMap = {
    ศูนย์: 0,
    หนึ่ง: 1,
    เอ็ด: 1,
    สอง: 2,
    ยี่: 2,
    สาม: 3,
    สี่: 4,
    ห้า: 5,
    หก: 6,
    เจ็ด: 7,
    แปด: 8,
    เก้า: 9,
  };
  const multiplierMap = {
    สิบ: 10,
    ร้อย: 100,
    พัน: 1000,
    หมื่น: 10000,
    แสน: 100000,
    ล้าน: 1000000,
  };

  let remaining = text;
  let total = 0;
  let current = 0;

  while (remaining.length > 0) {
    let matched = false;

    for (const [word, value] of Object.entries(multiplierMap)) {
      if (!remaining.startsWith(word)) {
        continue;
      }

      const base = current || 1;
      if (value === 1000000) {
        total = (total + base) * value;
      } else {
        total += base * value;
      }

      current = 0;
      remaining = remaining.slice(word.length);
      matched = true;
      break;
    }

    if (matched) {
      continue;
    }

    for (const [word, value] of Object.entries(digitMap)) {
      if (!remaining.startsWith(word)) {
        continue;
      }

      current = value;
      remaining = remaining.slice(word.length);
      matched = true;
      break;
    }

    if (!matched) {
      return "";
    }
  }

  const result = total + current;
  return result ? String(result) : "";
}

function looksLikeCasualChat(message, items) {
  if (items.length !== 1) {
    return false;
  }

  const [item] = items;
  if (item.quantity || item.unit) {
    return false;
  }

  const normalizedMessage = message.trim().toLowerCase();
  const casualPhrases = new Set([
    "hi",
    "hello",
    "hey",
    "yo",
    "ว่าไง",
    "หวัดดี",
    "สวัสดี",
    "ดี",
    "จ้า",
    "จ้ะ",
    "ค่ะ",
    "ครับ",
    "ok",
    "โอเค",
  ]);

  return casualPhrases.has(normalizedMessage);
}

function isKnownUnit(unit) {
  return Boolean(normalizeUnit(unit));
}

function normalizeUnit(unit) {
  const trimmedUnit = String(unit || "").trim();
  return UNIT_ALIASES[trimmedUnit] || "";
}

function formatDateOnly(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function withDefaultPurchaseDate(items, now = new Date()) {
  const purchaseDate = formatDateOnly(now);
  return items.map((item) => ({
    ...item,
    purchase_date: item.purchase_date || purchaseDate,
  }));
}

export {
  KNOWN_UNITS,
  findQuantityUnitAt,
  formatDateOnly,
  looksLikeCasualChat,
  normalizeItemName,
  normalizeSpokenQuantity,
  normalizeUnit,
  parseConcatenatedThaiItems,
  parseThaiItems,
  parseThaiNumberWords,
  withDefaultPurchaseDate,
};
