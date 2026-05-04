export default {
  async fetch(request, env, ctx) {
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
      await replyToLine(
        env.LINE_CHANNEL_ACCESS_TOKEN,
        replyToken,
        formatMenuIdeasReply(inventory)
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

    await saveItemsToAppsScript(env.GOOGLE_APPS_SCRIPT_URL, {
      userId,
      message,
      items,
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

function parseThaiItems(text) {
  const normalizedText = text.trim().replace(/\s+/g, " ");

  if (!normalizedText) {
    return [];
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
      items.push({
        item: currentNameParts.join(" ").trim(),
        quantity: compactQuantityUnit.quantity,
        unit: compactQuantityUnit.unit,
      });
      currentNameParts = [];
      index += 1;
      continue;
    }

    if (isNumericToken(token)) {
      const name = currentNameParts.join(" ").trim();
      const quantity = normalizeQuantity(token);
      const unit = nextToken && !isNumericToken(nextToken) ? nextToken : "";

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
      items.push({
        item: currentNameParts.join(" ").trim(),
        quantity: "",
        unit: "",
      });
      currentNameParts = [];
    }

    currentNameParts.push(token);
    index += 1;
  }

  if (currentNameParts.length > 0) {
    items.push({
      item: currentNameParts.join(" ").trim(),
      quantity: "",
      unit: "",
    });
  }

  return items.filter((item) => item.item);
}

function isNumericToken(token) {
  return /^[0-9]+(?:[.,][0-9]+)?$/.test(token);
}

function normalizeQuantity(token) {
  return token.replace(",", ".");
}

function parseCompactQuantityUnitToken(token) {
  const arabicMatch = token.match(/^([0-9]+(?:[.,][0-9]+)?)(.+)$/);
  if (arabicMatch) {
    return {
      quantity: normalizeQuantity(arabicMatch[1]),
      unit: arabicMatch[2],
    };
  }

  let bestMatch = null;

  for (let splitIndex = 1; splitIndex < token.length; splitIndex += 1) {
    const quantityText = token.slice(0, splitIndex);
    const unitText = token.slice(splitIndex);
    const quantity = parseThaiNumberWords(quantityText);

    if (!quantity || !unitText) {
      continue;
    }

    bestMatch = {
      quantity,
      unit: unitText,
    };
  }

  return bestMatch;
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

async function saveItemsToAppsScript(url, payload) {
  if (!url) {
    throw new Error("GOOGLE_APPS_SCRIPT_URL is not set");
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Apps Script save failed with status ${response.status}`);
  }
}

async function fetchInventoryFromAppsScript(url) {
  if (!url) {
    throw new Error("GOOGLE_APPS_SCRIPT_URL is not set");
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "list",
    }),
  });

  if (!response.ok) {
    throw new Error(`Apps Script list failed with status ${response.status}`);
  }

  const responseText = await response.text();
  let data;

  try {
    data = JSON.parse(responseText);
  } catch (error) {
    throw new Error(`Apps Script list returned non-JSON: ${responseText}`);
  }

  return normalizeInventoryList(data);
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
    item: String(item?.item || item?.name || "").trim(),
    quantity: String(item?.quantity || "").trim(),
    unit: String(item?.unit || "").trim(),
  };
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

function formatMenuIdeasReply(items) {
  if (items.length === 0) {
    return "ยังไม่มีของในตู้ เลยคิดเมนูให้ไม่ค่อยได้ ลองเพิ่มของก่อนนะ";
  }

  const ideas = suggestMenuIdeas(items);
  const lines = ideas.map((idea) => `- ${idea}`);
  return `ลองทำเมนูพวกนี้ได้นะ:\n${lines.join("\n")}`;
}

function suggestMenuIdeas(items) {
  const names = items.map((item) => item.item.toLowerCase());
  const ideas = [];

  if (hasAny(names, ["ไข่", "หมูสับ", "เนื้อบด", "ข้าว"])) {
    ideas.push("ข้าวผัดง่ายๆ");
  }

  if (hasAny(names, ["ไข่"]) && hasAny(names, ["มะเขือเทศ", "ต้นหอม", "หอมใหญ่"])) {
    ideas.push("ไข่เจียวใส่ผัก");
  }

  if (hasAny(names, ["หมูสับ", "เนื้อบด"]) && hasAny(names, ["กระเทียม", "พริก", "โหระพา"])) {
    ideas.push("ผัดกะเพรา");
  }

  if (hasAny(names, ["เต้าหู้"]) && hasAny(names, ["ไข่", "ผักกาด", "คะน้า", "เห็ด"])) {
    ideas.push("ต้มจืดเต้าหู้");
  }

  if (hasAny(names, ["คะน้า", "ผักคะน้า", "ผักกาด", "เห็ด"])) {
    ideas.push("ผัดผักง่ายๆ");
  }

  if (ideas.length === 0) {
    ideas.push("ไข่เจียว");
    ideas.push("ผัดผักง่ายๆ");
    ideas.push("ต้มจืดแบบบ้านๆ");
  }

  return ideas.slice(0, 3);
}

function hasAny(names, keywords) {
  return keywords.some((keyword) =>
    names.some((name) => name.includes(keyword))
  );
}

async function replyToLine(channelAccessToken, replyToken, text) {
  return fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${channelAccessToken}`,
    },
    body: JSON.stringify({
      replyToken,
      messages: [
        {
          type: "text",
          text,
        },
      ],
    }),
  });
}

async function replyWithMainMenu(channelAccessToken, replyToken) {
  return fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${channelAccessToken}`,
    },
    body: JSON.stringify({
      replyToken,
      messages: [
        {
          type: "text",
          text: "ต้องการทำอะไร?",
          quickReply: {
            items: [
              createQuickReplyButton("เพิ่มของ"),
              createQuickReplyButton("คิดเมนู"),
              createQuickReplyButton("ดูของในตู้"),
            ],
          },
        },
      ],
    }),
  });
}

function createQuickReplyButton(label) {
  return {
    type: "action",
    action: {
      type: "message",
      label,
      text: label,
    },
  };
}

export {
  handleLineEvent,
  parseThaiItems,
  parseThaiNumberWords,
  looksLikeCasualChat,
  normalizeInventoryList,
  formatInventoryReply,
  formatMenuIdeasReply,
  suggestMenuIdeas,
  getUserModeKey,
};
