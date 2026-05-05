import { normalizeItemName } from "../utils/thaiParsing.js";

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

function normalizeHouseholdPreferences(data) {
  const rawPreferences = Array.isArray(data)
    ? data
    : Array.isArray(data?.preferences)
      ? data.preferences
      : Array.isArray(data?.items)
        ? data.items
        : [];

  return rawPreferences
    .map((preference) => ({
      preference_type: String(preference?.preference_type || "").trim(),
      keyword: String(preference?.keyword || "").trim(),
      weight: String(preference?.weight || "").trim(),
      enabled: String(preference?.enabled || "").trim(),
      note: String(preference?.note || "").trim(),
    }))
    .filter((preference) => preference.keyword)
    .filter((preference) => {
      const enabled = String(preference.enabled || "").trim().toLowerCase();
      return enabled === "" || ["yes", "y", "true", "1"].includes(enabled);
    });
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

function formatMenuIdeasReply(items, menuCatalog = [], householdPreferences = []) {
  if (items.length === 0) {
    return "ยังไม่มีของในตู้ เลยคิดเมนูให้ไม่ค่อยได้ ลองเพิ่มของก่อนนะ";
  }

  const ideas = suggestMenuIdeas(items, menuCatalog, householdPreferences);
  if (ideas.length === 0) {
    return "ตอนนี้ยังหาเมนูจากตารางที่ตรงของในตู้ไม่เจอ ลองเพิ่มเมนูใน Menu_Catalog หรือเพิ่มของในตู้ก่อนนะ";
  }

  const lines = ideas.map((idea) => `- ${idea}`);
  return `ลองทำเมนูพวกนี้ได้นะ:\n${lines.join("\n")}`;
}

function suggestMenuIdeas(items, menuCatalog = [], householdPreferences = []) {
  const names = items.map((item) => item.item.toLowerCase());
  const catalogIdeas = suggestMenuIdeasFromCatalog(
    items,
    menuCatalog,
    householdPreferences
  );

  if (catalogIdeas.length > 0) {
    return catalogIdeas;
  }

  if (Array.isArray(menuCatalog) && menuCatalog.length > 0) {
    return [];
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

function suggestMenuIdeasFromCatalog(items, menuCatalog, householdPreferences) {
  if (!Array.isArray(menuCatalog) || menuCatalog.length === 0) {
    return [];
  }

  const inventoryNames = items.map((item) => item.item.toLowerCase());
  const scoredMenus = menuCatalog
    .map((menu) =>
      scoreMenuCandidate(menu, inventoryNames, householdPreferences)
    )
    .filter((entry) => entry.score > 0)
    .sort(compareScoredMenus);

  return uniqueIdeas(
    scoredMenus.slice(0, 3).map((entry) => entry.menu.menu_name)
  );
}

function scoreMenuCandidate(menu, inventoryNames, householdPreferences = []) {
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

  score += scoreHouseholdPreferences(menu, householdPreferences);

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

  return String(left.menu.menu_name).localeCompare(
    String(right.menu.menu_name),
    "th"
  );
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

function scoreHouseholdPreferences(menu, householdPreferences) {
  if (!Array.isArray(householdPreferences) || householdPreferences.length === 0) {
    return 0;
  }

  const haystack = [
    menu.menu_name,
    menu.required_items,
    menu.optional_items,
    menu.style,
    menu.spicy_level,
    menu.note,
  ]
    .join(" ")
    .toLowerCase();

  return householdPreferences.reduce((score, preference) => {
    const keyword = String(preference.keyword || "").trim().toLowerCase();
    if (!keyword || !haystack.includes(keyword)) {
      return score;
    }

    const type = String(preference.preference_type || "").trim().toLowerCase();
    const weight = parsePreferenceWeight(preference.weight);

    if (["favorite", "prefer", "like"].includes(type)) {
      return score + weight;
    }

    if (["dislike", "avoid", "no"].includes(type)) {
      return score - weight;
    }

    return score;
  }, 0);
}

function parsePreferenceWeight(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return 3;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 3;
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
  containsInventoryItem,
  formatInventoryReply,
  formatMenuIdeasReply,
  formatSavedItemsReply,
  normalizeHouseholdPreferences,
  normalizeInventoryList,
  normalizeMenuCatalog,
  parsePreferenceWeight,
  scoreHouseholdPreferences,
  scoreMenuCandidate,
  splitCatalogList,
  suggestMenuIdeas,
  suggestMenuIdeasFromCatalog,
  uniqueIdeas,
};
