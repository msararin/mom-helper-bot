import test from "node:test";
import assert from "node:assert/strict";

import {
  formatInventoryReply,
  formatMenuIdeasReply,
  getUserModeKey,
  handleLineEvent,
  looksLikeCasualChat,
  normalizeInventoryList,
  parseThaiItems,
  parseThaiNumberWords,
} from "../src/index.js";

class FakeKV {
  constructor(initialEntries = []) {
    this.store = new Map(initialEntries);
  }

  async get(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }

  async put(key, value) {
    this.store.set(key, value);
  }

  async delete(key) {
    this.store.delete(key);
  }
}

function createLineEvent(message, userId = "U123") {
  return {
    type: "message",
    replyToken: "reply-token",
    source: { userId },
    message: {
      type: "text",
      text: message,
    },
  };
}

function createEnv(botState = new FakeKV()) {
  return {
    LINE_CHANNEL_ACCESS_TOKEN: "token",
    GOOGLE_APPS_SCRIPT_URL: "https://example.com/apps-script",
    BOT_STATE: botState,
  };
}

function installFetchMock(handlers) {
  const calls = [];
  global.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    return handlers(url, options, calls);
  };
  return calls;
}

function getLastReplyText(calls) {
  const lineCall = calls.findLast((call) =>
    String(call.url).includes("api.line.me/v2/bot/message/reply")
  );
  assert.ok(lineCall, "expected a LINE reply call");
  const body = JSON.parse(lineCall.options.body);
  return body.messages[0].text;
}

function getLastReplyBody(calls) {
  const lineCall = calls.findLast((call) =>
    String(call.url).includes("api.line.me/v2/bot/message/reply")
  );
  assert.ok(lineCall, "expected a LINE reply call");
  return JSON.parse(lineCall.options.body);
}

test("parseThaiItems parses mixed inventory input", () => {
  assert.deepEqual(parseThaiItems("ไข่ 6 ฟอง นม 1 กล่อง ผักคะน้า"), [
    { item: "ไข่", quantity: "6", unit: "ฟอง" },
    { item: "นม", quantity: "1", unit: "กล่อง" },
    { item: "ผักคะน้า", quantity: "", unit: "" },
  ]);
});

test("parseThaiItems handles compact Arabic quantity and unit", () => {
  assert.deepEqual(parseThaiItems("เนื้อบด 400กรัม"), [
    { item: "เนื้อบด", quantity: "400", unit: "กรัม" },
  ]);
});

test("parseThaiItems handles compact Thai number words and unit", () => {
  assert.deepEqual(parseThaiItems("เนื้อบด สี่ร้อยกรัม"), [
    { item: "เนื้อบด", quantity: "400", unit: "กรัม" },
  ]);
});

test("parseThaiNumberWords supports hundreds", () => {
  assert.equal(parseThaiNumberWords("สี่ร้อย"), "400");
});

test("looksLikeCasualChat rejects greetings as inventory", () => {
  assert.equal(
    looksLikeCasualChat("ว่าไง", [{ item: "ว่าไง", quantity: "", unit: "" }]),
    true
  );
});

test("normalizeInventoryList accepts {items: []} payload", () => {
  assert.deepEqual(
    normalizeInventoryList({
      items: [{ item: "ไข่", quantity: 6, unit: "ฟอง" }],
    }),
    [{ item: "ไข่", quantity: "6", unit: "ฟอง" }]
  );
});

test("default message with no mode replies with main menu", async () => {
  const env = createEnv();
  const calls = installFetchMock(async (url) => {
    if (String(url).includes("api.line.me")) {
      return new Response("OK", { status: 200 });
    }
    throw new Error(`unexpected fetch ${url}`);
  });

  await handleLineEvent(createLineEvent("hi"), env);

  const body = getLastReplyBody(calls);
  assert.equal(body.messages[0].text, "ต้องการทำอะไร?");
  assert.deepEqual(
    body.messages[0].quickReply.items.map((item) => item.action.label),
    ["เพิ่มของ", "คิดเมนู", "ดูของในตู้"]
  );
});

test("เพิ่มของ sets mode and replies with add prompt", async () => {
  const botState = new FakeKV();
  const env = createEnv(botState);
  const calls = installFetchMock(async (url) => {
    if (String(url).includes("api.line.me")) {
      return new Response("OK", { status: 200 });
    }
    throw new Error(`unexpected fetch ${url}`);
  });

  await handleLineEvent(createLineEvent("เพิ่มของ"), env);

  assert.equal(await botState.get(getUserModeKey("U123")), "adding_item");
  assert.equal(
    getLastReplyText(calls),
    "พิมพ์ของที่มีได้เลย เช่น ไข่ 6 ฟอง นม 1 กล่อง ผักคะน้า"
  );
});

test("casual chat inside adding_item clears mode and shows main menu", async () => {
  const botState = new FakeKV([[getUserModeKey("U123"), "adding_item"]]);
  const env = createEnv(botState);
  const calls = installFetchMock(async (url) => {
    if (String(url).includes("api.line.me")) {
      return new Response("OK", { status: 200 });
    }
    throw new Error(`unexpected fetch ${url}`);
  });

  await handleLineEvent(createLineEvent("ว่าไง"), env);

  assert.equal(await botState.get(getUserModeKey("U123")), null);
  assert.equal(getLastReplyText(calls), "ต้องการทำอะไร?");
});

test("valid add-item input saves to Apps Script and clears mode", async () => {
  const botState = new FakeKV([[getUserModeKey("U123"), "adding_item"]]);
  const env = createEnv(botState);
  const calls = installFetchMock(async (url, options) => {
    if (String(url).includes("example.com/apps-script")) {
      const payload = JSON.parse(options.body);
      assert.equal(payload.userId, "U123");
      assert.deepEqual(payload.items, [
        { item: "ไข่", quantity: "6", unit: "ฟอง" },
      ]);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    if (String(url).includes("api.line.me")) {
      return new Response("OK", { status: 200 });
    }

    throw new Error(`unexpected fetch ${url}`);
  });

  await handleLineEvent(createLineEvent("ไข่ 6 ฟอง"), env);

  assert.equal(await botState.get(getUserModeKey("U123")), null);
  assert.equal(getLastReplyText(calls), "บันทึกให้แล้วนะ:\n- ไข่ 6 ฟอง");
});

test("ดูของในตู้ formats inventory from Apps Script", async () => {
  const env = createEnv();
  const calls = installFetchMock(async (url) => {
    if (String(url).includes("example.com/apps-script")) {
      return new Response(
        JSON.stringify({
          items: [
            { item: "ไข่", quantity: "6", unit: "ฟอง" },
            { item: "เต้าหู้", quantity: "1", unit: "ชิ้น" },
          ],
        }),
        { status: 200 }
      );
    }

    if (String(url).includes("api.line.me")) {
      return new Response("OK", { status: 200 });
    }

    throw new Error(`unexpected fetch ${url}`);
  });

  await handleLineEvent(createLineEvent("ดูของในตู้"), env);

  assert.equal(
    getLastReplyText(calls),
    "ตอนนี้มีของประมาณนี้นะ:\n- ไข่ 6 ฟอง\n- เต้าหู้ 1 ชิ้น"
  );
});

test("คิดเมนู suggests simple menus from inventory", async () => {
  const env = createEnv();
  const calls = installFetchMock(async (url) => {
    if (String(url).includes("example.com/apps-script")) {
      return new Response(
        JSON.stringify({
          items: [
            { item: "ไข่", quantity: "6", unit: "ฟอง" },
            { item: "เต้าหู้", quantity: "1", unit: "ชิ้น" },
            { item: "เนื้อบด", quantity: "400", unit: "กรัม" },
          ],
        }),
        { status: 200 }
      );
    }

    if (String(url).includes("api.line.me")) {
      return new Response("OK", { status: 200 });
    }

    throw new Error(`unexpected fetch ${url}`);
  });

  await handleLineEvent(createLineEvent("คิดเมนู"), env);

  assert.equal(
    getLastReplyText(calls),
    "ลองทำเมนูพวกนี้ได้นะ:\n- ข้าวผัดง่ายๆ\n- ต้มจืดเต้าหู้"
  );
});

test("format helpers keep user-facing Thai text stable", () => {
  assert.equal(formatInventoryReply([]), "ตอนนี้ยังไม่มีของในตู้เลย");
  assert.equal(
    formatMenuIdeasReply([]),
    "ยังไม่มีของในตู้ เลยคิดเมนูให้ไม่ค่อยได้ ลองเพิ่มของก่อนนะ"
  );
});
