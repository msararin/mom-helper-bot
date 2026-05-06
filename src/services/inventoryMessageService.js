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
  กล่อง: "กล่อง",
  ขวด: "ขวด",
  กระปุก: "กระปุก",
  กระป๋อง: "กระป๋อง",
  แพ็ก: "แพ็ก",
  แพ็ค: "แพ็ก",
  แพค: "แพ็ก",
  ถาด: "ถาด",
  กำมือ: "กำมือ",
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

function withDefaultPurchaseDate(items, now = new Date()) {
  const purchaseDate = formatDateOnly(now);
  return items.map((item) => ({
    ...item,
    purchase_date: item.purchase_date || purchaseDate,
  }));
}

function formatDateOnly(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeInventoryList(data) {
  const rawItems = Array.isArray(data)
    ? data
    : Array.isArray(data?.items)
      ? data.items
      : Array.isArray(data?.data)
        ? data.data
        : [];

  return rawItems
    .map((item) => normalizeInventoryItem(item))
    .filter((item) => item.item);
}

function normalizeInventoryItem(item) {
  return {
    item: normalizeItemName(String(item?.item || item?.name || "").trim()),
    quantity: String(item?.quantity || "").trim(),
    unit: String(item?.unit || "").trim(),
    purchase_date: String(item?.purchase_date || "").trim(),
  };
}

function normalizeMenuCatalog(data) {
  const rawMenus = Array.isArray(data)
    ? data
    : Array.isArray(data?.menus)
      ? data.menus
      : Array.isArray(data?.items)
        ? data.items
        : [];

  return rawMenus
    .map((menu) => ({
      menu_name: String(menu?.menu_name || "").trim(),
      required_items: String(menu?.required_items || "").trim(),
      optional_items: String(menu?.optional_items || "").trim(),
      style: String(menu?.style || "").trim(),
      spicy_level: String(menu?.spicy_level || "").trim(),
      difficulty: String(menu?.difficulty || "").trim(),
      time_minutes: String(menu?.time_minutes || "").trim(),
      preferred_for_house: String(menu?.preferred_for_house || "").trim(),
      avoid_if: String(menu?.avoid_if || "").trim(),
      note: String(menu?.note || "").trim(),
    }))
    .filter((menu) => menu.menu_name);
}

function formatSavedItemsReply(items) {
  const lines = items.map((item) => {
    const details = [item.quantity, item.unit].filter(Boolean).join(" ");
    return details ? `- ${item.item} ${details}` : `- ${item.item}`;
  });

  return `บันทึกให้แล้วนะ:\n${lines.join("\n")}`;
}

function formatInventoryReply(items) {
  if (items.length === 0) {
    return "ตอนนี้ยังไม่มีของในตู้เลย";
  }

  const lines = items.slice(0, 20).map((item) => {
    const details = [item.quantity, item.unit].filter(Boolean).join(" ");
    return details ? `- ${item.item} ${details}` : `- ${item.item}`;
  });

  return `ตอนนี้มีของประมาณนี้นะ:\n${lines.join("\n")}`;
}

function formatMenuIdeasReply(items, menuCatalog = []) {
  if (items.length === 0) {
    return "ยังไม่มีของในตู้ เลยคิดเมนูให้ไม่ค่อยได้ ลองเพิ่มของก่อนนะ";
  }

  const ideas = suggestMenuIdeas(items, menuCatalog);
  const lines = ideas.map((idea) => `- ${idea}`);
  return `ลองทำเมนูพวกนี้ได้นะ:\n${lines.join("\n")}`;
}

function suggestMenuIdeas(items, menuCatalog = []) {
  const names = items.map((item) => item.item.toLowerCase());
  const catalogIdeas = suggestMenuIdeasFromCatalog(items, menuCatalog);

  if (catalogIdeas.length > 0) {
    return catalogIdeas;
  }

  const ideas = [];

  if (hasAny(names, ["เต้าหู้"]) && hasAny(names, ["หมูสับ", "เนื้อบด"])) {
    ideas.push("ต้มจืดเต้าหู้หมูสับ");
  }

  if (hasAny(names, ["ไข่"]) && hasAny(names, ["หมูสับ", "เนื้อบด"])) {
    ideas.push("ไข่เจียวหมูสับ");
  }

  if (hasAny(names, ["เต้าหู้"]) && hasAny(names, ["ไข่"])) {
    ideas.push("เต้าหู้ผัดไข่");
  }

  if (
    hasAny(names, ["หมูสับ", "เนื้อบด"]) &&
    hasAny(names, ["กระเทียม", "พริก", "โหระพา"])
  ) {
    ideas.push("ผัดกะเพรา");
  }

  if (hasAny(names, ["ปลา", "ปลาทู"]) && hasAny(names, ["พริก", "หอมแดง", "มะนาว"])) {
    ideas.push("น้ำพริกปลาทู");
  }

  if (hasAny(names, ["ไข่"]) && hasAny(names, ["มะเขือเทศ", "ต้นหอม", "หอมใหญ่"])) {
    ideas.push("ไข่เจียวใส่ผัก");
  }

  if (hasAny(names, ["คะน้า", "ผักคะน้า", "ผักกาด", "เห็ด", "ฟักทอง"])) {
    ideas.push("ผัดผักง่ายๆ");
  }

  if (hasAny(names, ["เต้าหู้"])) {
    ideas.push("เต้าหู้ทอดกินกับข้าว");
  }

  if (hasAny(names, ["ไข่"])) {
    ideas.push("ไข่เจียว");
  }

  if (ideas.length === 0) {
    ideas.push("ผัดผักง่ายๆ");
    ideas.push("ต้มจืดแบบบ้านๆ");
    ideas.push("ข้าวผัดง่ายๆ");
  }

  return uniqueIdeas(ideas).slice(0, 3);
}

function suggestMenuIdeasFromCatalog(items, menuCatalog) {
  if (!Array.isArray(menuCatalog) || menuCatalog.length === 0) {
    return [];
  }

  const inventoryNames = items.map((item) => item.item.toLowerCase());
  const scoredMenus = menuCatalog
    .map((menu) => scoreMenuCandidate(menu, inventoryNames))
    .filter((entry) => entry.score > 0)
    .sort(compareScoredMenus);

  return uniqueIdeas(
    scoredMenus.slice(0, 3).map((entry) => entry.menu.menu_name)
  );
}

function scoreMenuCandidate(menu, inventoryNames) {
  const requiredItems = splitCatalogList(menu.required_items);
  const optionalItems = splitCatalogList(menu.optional_items);

  if (requiredItems.length === 0) {
    return { menu, score: 0 };
  }

  const missingRequired = requiredItems.filter(
    (requiredItem) => !containsInventoryItem(inventoryNames, requiredItem)
  );

  if (missingRequired.length > 0) {
    return { menu, score: 0 };
  }

  const optionalMatches = optionalItems.filter((optionalItem) =>
    containsInventoryItem(inventoryNames, optionalItem)
  ).length;

  let score = requiredItems.length * 10 + optionalMatches;

  if (isAffirmativeFlag(menu.preferred_for_house)) {
    score += 5;
  }

  if (String(menu.difficulty || "").toLowerCase() === "easy") {
    score += 2;
  }

  const timeMinutes = parseTimeMinutes(menu.time_minutes);
  if (timeMinutes > 0 && timeMinutes <= 15) {
    score += 1;
  }

  return { menu, score };
}

function compareScoredMenus(left, right) {
  if (right.score !== left.score) {
    return right.score - left.score;
  }

  const leftPreferred = isAffirmativeFlag(left.menu.preferred_for_house) ? 1 : 0;
  const rightPreferred = isAffirmativeFlag(right.menu.preferred_for_house) ? 1 : 0;
  if (rightPreferred !== leftPreferred) {
    return rightPreferred - leftPreferred;
  }

  const leftTime = parseTimeMinutes(left.menu.time_minutes);
  const rightTime = parseTimeMinutes(right.menu.time_minutes);
  if (leftTime !== rightTime) {
    if (leftTime === Number.POSITIVE_INFINITY) {
      return 1;
    }
    if (rightTime === Number.POSITIVE_INFINITY) {
      return -1;
    }
    return leftTime - rightTime;
  }

  return String(left.menu.menu_name).localeCompare(String(right.menu.menu_name), "th");
}

function splitCatalogList(value) {
  return String(value || "")
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}

function containsInventoryItem(inventoryNames, keyword) {
  return inventoryNames.some((name) => name.includes(keyword));
}

function isAffirmativeFlag(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return ["yes", "y", "true", "1"].includes(normalized);
}

function parseTimeMinutes(value) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return Number.POSITIVE_INFINITY;
  }

  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : Number.POSITIVE_INFINITY;
}

function hasAny(names, keywords) {
  return keywords.some((keyword) =>
    names.some((name) => name.includes(keyword))
  );
}

function uniqueIdeas(ideas) {
  return [...new Set(ideas)];
}

export {
  KNOWN_UNITS,
  containsInventoryItem,
  findQuantityUnitAt,
  formatDateOnly,
  formatInventoryReply,
  formatMenuIdeasReply,
  formatSavedItemsReply,
  looksLikeCasualChat,
  normalizeInventoryList,
  normalizeItemName,
  normalizeMenuCatalog,
  normalizeSpokenQuantity,
  normalizeUnit,
  parseConcatenatedThaiItems,
  parseThaiItems,
  parseThaiNumberWords,
  scoreMenuCandidate,
  splitCatalogList,
  suggestMenuIdeas,
  suggestMenuIdeasFromCatalog,
  uniqueIdeas,
  withDefaultPurchaseDate,
};
