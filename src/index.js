import {
  callAppsScript,
  fetchHouseholdPreferencesFromAppsScript,
  fetchInventoryFromAppsScript,
  fetchMenuCatalogFromAppsScript,
  saveItemsToAppsScript,
} from "./adapters/appsScriptAdapter.js";
import { replyToLine, replyWithMainMenu } from "./adapters/lineAdapter.js";
import {
  containsInventoryItem,
  formatInventoryReply,
  formatMenuIdeasReply,
  formatSavedItemsReply,
  normalizeHouseholdPreferences,
  normalizeInventoryList,
  normalizeMenuCatalog,
  scorePreferenceMatch,
  scoreHouseholdPreferences,
  scoreMenuCandidate,
  splitCatalogList,
  suggestMenuIdeas,
  suggestMenuIdeasFromCatalog,
  uniqueIdeas,
} from "./services/menuSuggestionService.js";
import {
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
} from "./utils/thaiParsing.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/admin/")) {
      return handleAdminRequest(request, env, url);
    }

    if (request.method !== "POST") {
      return new Response("Mom Helper Bot is running", { status: 200 });
    }

    try {
      const signature = request.headers.get("x-line-signature");

      if (!env.LINE_CHANNEL_SECRET) {
        console.error("LINE_CHANNEL_SECRET is not set");
        return new Response("Server misconfigured", { status: 500 });
      }

      if (!signature) {
        return new Response("Missing signature", { status: 401 });
      }

      const rawBody = await request.text();
      const isValidSignature = await verifyLineSignature(
        rawBody,
        signature,
        env.LINE_CHANNEL_SECRET
      );

      if (!isValidSignature) {
        return new Response("Invalid signature", { status: 401 });
      }

      const body = JSON.parse(rawBody);
      const events = Array.isArray(body?.events) ? body.events : [];

      for (const event of events) {
        ctx.waitUntil(handleLineEvent(event, env));
      }

      return new Response("OK", { status: 200 });
    } catch (error) {
      console.error("Webhook parse error:", error);
      return new Response("OK", { status: 200 });
    }
  },
};

const ALLOWED_ADMIN_SHEETS = new Set([
  "Menu_Catalog",
  "Fridge",
  "Fridge_Log",
  "Meal_Log",
  "Household_Preferences",
]);

const ADMIN_ROUTE_ACTIONS = {
  "/admin/sheets/list": "sheet_admin_list",
  "/admin/sheets/create-row": "sheet_admin_create_row",
  "/admin/sheets/update-row": "sheet_admin_update_row",
  "/admin/sheets/delete-row": "sheet_admin_delete_row",
  "/admin/sheets/dedupe": "sheet_admin_dedupe",
};

async function handleAdminRequest(request, env, url) {
  if (request.method !== "POST") {
    return jsonResponse(
      {
        ok: false,
        error: "Method not allowed",
      },
      405
    );
  }

  const action = ADMIN_ROUTE_ACTIONS[url.pathname];
  if (!action) {
    return jsonResponse(
      {
        ok: false,
        error: "Admin route not found",
      },
      404
    );
  }

  if (!env.ADMIN_API_TOKEN) {
    return jsonResponse(
      {
        ok: false,
        error: "ADMIN_API_TOKEN is not set",
      },
      500
    );
  }

  const providedToken = getAdminTokenFromRequest(request);
  if (providedToken !== env.ADMIN_API_TOKEN) {
    return jsonResponse(
      {
        ok: false,
        error: "Unauthorized",
      },
      401
    );
  }

  let payload;
  try {
    payload = await request.json();
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        error: "Invalid JSON body",
      },
      400
    );
  }

  const validationError = validateAdminPayload(action, payload);
  if (validationError) {
    return jsonResponse(
      {
        ok: false,
        error: validationError,
      },
      400
    );
  }

  try {
    const response = await callAppsScript(env.GOOGLE_APPS_SCRIPT_URL, {
      action,
      ...payload,
    });
    return jsonResponse(response, 200);
  } catch (error) {
    console.error("Admin action failed:", error);
    return jsonResponse(
      {
        ok: false,
        error: "Admin action failed",
        detail: error.message,
      },
      502
    );
  }
}

async function handleLineEvent(event, env) {
  if (event?.type !== "message") {
    return;
  }

  if (event?.message?.type !== "text") {
    return;
  }

  const userId = event?.source?.userId || "";
  const message = event?.message?.text?.trim() || "";
  const replyToken = event?.replyToken || "";

  if (!userId || !message || !replyToken) {
    return;
  }

  console.log("Received LINE text message", {
    userId,
    message,
  });

  if (!env.LINE_CHANNEL_ACCESS_TOKEN) {
    console.warn("LINE_CHANNEL_ACCESS_TOKEN is not set");
    return;
  }

  const mode = await getUserMode(env.BOT_STATE, userId);

  if (message === "เพิ่มของ") {
    await setUserMode(env.BOT_STATE, userId, "adding_item");
    await replyToLine(
      env.LINE_CHANNEL_ACCESS_TOKEN,
      replyToken,
      "พิมพ์ของที่มีได้เลย เช่น ไข่ 6 ฟอง นม 1 กล่อง ผักคะน้า"
    );
    return;
  }

  if (message === "เมนูหลัก") {
    await clearUserMode(env.BOT_STATE, userId);
    await replyWithMainMenu(env.LINE_CHANNEL_ACCESS_TOKEN, replyToken);
    return;
  }

  if (message === "ดูของในตู้") {
    await clearUserMode(env.BOT_STATE, userId);
    try {
      const inventory = await fetchInventoryFromAppsScript(
        env.GOOGLE_APPS_SCRIPT_URL
      );
      await replyToLine(
        env.LINE_CHANNEL_ACCESS_TOKEN,
        replyToken,
        formatInventoryReply(inventory)
      );
    } catch (error) {
      console.error("Inventory fetch failed:", error);
      await replyToLine(
        env.LINE_CHANNEL_ACCESS_TOKEN,
        replyToken,
        "ตอนนี้ยังดึงรายการของในตู้ไม่ได้ ขอแก้ฝั่งชีตก่อนนะ"
      );
    }
    return;
  }

  if (message === "คิดเมนู") {
    await clearUserMode(env.BOT_STATE, userId);
    try {
      const inventory = await fetchInventoryFromAppsScript(
        env.GOOGLE_APPS_SCRIPT_URL
      );
      const menuCatalog = await fetchMenuCatalogFromAppsScript(
        env.GOOGLE_APPS_SCRIPT_URL
      );
      let householdPreferences = [];
      try {
        householdPreferences = await fetchHouseholdPreferencesFromAppsScript(
          env.GOOGLE_APPS_SCRIPT_URL
        );
      } catch (error) {
        console.warn("Household preferences fetch failed, using fallback:", error);
      }
      await replyToLine(
        env.LINE_CHANNEL_ACCESS_TOKEN,
        replyToken,
        formatMenuIdeasReply(inventory, menuCatalog, householdPreferences)
      );
    } catch (error) {
      console.error("Menu suggestion fetch failed:", error);
      await replyToLine(
        env.LINE_CHANNEL_ACCESS_TOKEN,
        replyToken,
        "ตอนนี้ยังอ่านของในตู้ไม่สำเร็จ เลยยังคิดเมนูให้ไม่ได้"
      );
    }
    return;
  }

  if (mode === "adding_item") {
    const items = parseThaiItems(message);

    if (looksLikeCasualChat(message, items)) {
      await clearUserMode(env.BOT_STATE, userId);
      await replyWithMainMenu(env.LINE_CHANNEL_ACCESS_TOKEN, replyToken);
      return;
    }

    if (items.length === 0) {
      await replyToLine(
        env.LINE_CHANNEL_ACCESS_TOKEN,
        replyToken,
        "ยังอ่านรายการของไม่ออก ลองพิมพ์แบบนี้ เช่น ไข่ 6 ฟอง นม 1 กล่อง ผักคะน้า\nถ้าจะกลับ พิมพ์ เมนูหลัก"
      );
      return;
    }

    const itemsToSave = withDefaultPurchaseDate(items);

    await saveItemsToAppsScript(env.GOOGLE_APPS_SCRIPT_URL, {
      userId,
      message,
      items: itemsToSave,
    });
    await clearUserMode(env.BOT_STATE, userId);
    await replyToLine(
      env.LINE_CHANNEL_ACCESS_TOKEN,
      replyToken,
      formatSavedItemsReply(items)
    );
    return;
  }

  await replyWithMainMenu(env.LINE_CHANNEL_ACCESS_TOKEN, replyToken);
}

async function verifyLineSignature(rawBody, signature, channelSecret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(channelSecret),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  );

  const signedBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(rawBody)
  );

  const expectedSignature = base64Encode(signedBuffer);
  return signature === expectedSignature;
}

function base64Encode(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

async function getUserMode(botState, userId) {
  if (!botState) {
    return "";
  }

  return (await botState.get(getUserModeKey(userId))) || "";
}

async function setUserMode(botState, userId, mode) {
  if (!botState) {
    return;
  }

  await botState.put(getUserModeKey(userId), mode);
}

async function clearUserMode(botState, userId) {
  if (!botState) {
    return;
  }

  await botState.delete(getUserModeKey(userId));
}

function getUserModeKey(userId) {
  return `user:${userId}:mode`;
}

function getAdminTokenFromRequest(request) {
  const authorization = request.headers.get("authorization") || "";
  if (authorization.toLowerCase().startsWith("bearer ")) {
    return authorization.slice(7).trim();
  }

  return request.headers.get("x-admin-token") || "";
}

function validateAdminPayload(action, payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return "Payload must be a JSON object";
  }

  const sheet = String(payload.sheet || "").trim();
  if (!ALLOWED_ADMIN_SHEETS.has(sheet)) {
    return "Sheet is not allowed";
  }

  if (action === "sheet_admin_list") {
    return "";
  }

  if (action === "sheet_admin_create_row") {
    return isPlainObject(payload.row) ? "" : "row is required";
  }

  if (action === "sheet_admin_update_row") {
    if (!isPlainObject(payload.match)) {
      return "match is required";
    }

    if (!isPlainObject(payload.updates)) {
      return "updates is required";
    }

    return "";
  }

  if (action === "sheet_admin_delete_row") {
    return isPlainObject(payload.match) ? "" : "match is required";
  }

  if (action === "sheet_admin_dedupe") {
    return Array.isArray(payload.dedupe_by) && payload.dedupe_by.length > 0
      ? ""
      : "dedupe_by is required";
  }

  return "";
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

export {
  KNOWN_UNITS,
  handleLineEvent,
  parseThaiItems,
  parseThaiNumberWords,
  looksLikeCasualChat,
  normalizeInventoryList,
  normalizeHouseholdPreferences,
  normalizeMenuCatalog,
  normalizeUnit,
  normalizeSpokenQuantity,
  normalizeItemName,
  withDefaultPurchaseDate,
  formatDateOnly,
  formatInventoryReply,
  formatMenuIdeasReply,
  suggestMenuIdeas,
  suggestMenuIdeasFromCatalog,
  getUserModeKey,
  parseConcatenatedThaiItems,
  findQuantityUnitAt,
  uniqueIdeas,
  splitCatalogList,
  containsInventoryItem,
  scorePreferenceMatch,
  scoreMenuCandidate,
  scoreHouseholdPreferences,
};
