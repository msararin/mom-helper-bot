import test from "node:test";
import assert from "node:assert/strict";

import worker from "../src/index.js";
import {
  formatInventoryReply,
  formatDateOnly,
  formatMenuIdeasReply,
  getUserModeKey,
  handleLineEvent,
  KNOWN_UNITS,
  looksLikeCasualChat,
  normalizeInventoryList,
  normalizeHouseholdPreferences,
  normalizeMenuCatalog,
  normalizeItemName,
  normalizeUnit,
  normalizeSpokenQuantity,
  parseConcatenatedThaiItems,
  parseThaiItems,
  parseThaiNumberWords,
  scoreMenuCandidate,
  scoreHouseholdPreferences,
  withDefaultPurchaseDate,
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
    LINE_CHANNEL_SECRET: "secret",
    GOOGLE_APPS_SCRIPT_URL: "https://example.com/apps-script",
    ADMIN_API_TOKEN: "admin-secret",
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

function createAdminRequest(pathname, body, token = "admin-secret") {
  return new Request(`https://example.com${pathname}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-token": token,
    },
    body: JSON.stringify(body),
  });
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

test("parseThaiItems normalizes kilogram aliases", () => {
  assert.deepEqual(parseThaiItems("หมู 1 โล"), [
    { item: "หมู", quantity: "1", unit: "กิโลกรัม" },
  ]);

  assert.deepEqual(parseThaiItems("แป้ง 2กก"), [
    { item: "แป้ง", quantity: "2", unit: "กิโลกรัม" },
  ]);
});

test("parseThaiItems supports household food units", () => {
  assert.deepEqual(parseThaiItems("ปลากระป๋อง 3 กระป๋อง"), [
    { item: "ปลากระป๋อง", quantity: "3", unit: "กระป๋อง" },
  ]);

  assert.deepEqual(parseThaiItems("นม 500มล"), [
    { item: "นม", quantity: "500", unit: "มิลลิลิตร" },
  ]);

  assert.deepEqual(parseThaiItems("ขนม 1 แพ็ค"), [
    { item: "ขนม", quantity: "1", unit: "แพ็ก" },
  ]);

  assert.deepEqual(parseThaiItems("ปลาทู 1 ตัว"), [
    { item: "ปลาทู", quantity: "1", unit: "ตัว" },
  ]);
});

test("parseThaiItems supports fractional quantity shorthand", () => {
  assert.deepEqual(parseThaiItems("หมู ครึ่งโล"), [
    { item: "หมู", quantity: "0.5", unit: "กิโลกรัม" },
  ]);

  assert.deepEqual(parseThaiItems("น้ำปลา ครึ่งขวด"), [
    { item: "น้ำปลา", quantity: "0.5", unit: "ขวด" },
  ]);
});

test("parseConcatenatedThaiItems handles speech-to-text style input without spaces", () => {
  assert.deepEqual(
    parseConcatenatedThaiItems("มีทูน่าหนึ่งถุงลูกชิ้นสองถุงฟักทองสามฝักฝรั่งสามโล"),
    [
      { item: "ทูน่า", quantity: "1", unit: "ถุง" },
      { item: "ลูกชิ้น", quantity: "2", unit: "ถุง" },
      { item: "ฟักทอง", quantity: "3", unit: "ฝัก" },
      { item: "ฝรั่ง", quantity: "3", unit: "กิโลกรัม" },
    ]
  );
});

test("parseConcatenatedThaiItems strips speech noise and common misheard units", () => {
  assert.deepEqual(
    parseConcatenatedThaiItems("พิมพ์อ่านอ่านอ่านทูน่าหนึ่งถุงลูกชิ้นสองถุงฟักทองสามฝากฝรั่งสามโล"),
    [
      { item: "ทูน่า", quantity: "1", unit: "ถุง" },
      { item: "ลูกชิ้น", quantity: "2", unit: "ถุง" },
      { item: "ฟักทอง", quantity: "3", unit: "ฝัก" },
      { item: "ฝรั่ง", quantity: "3", unit: "กิโลกรัม" },
    ]
  );
});

test("parseThaiNumberWords supports hundreds", () => {
  assert.equal(parseThaiNumberWords("สี่ร้อย"), "400");
});

test("unit dictionary normalizes kitchen unit aliases", () => {
  assert.equal(normalizeUnit("โล"), "กิโลกรัม");
  assert.equal(normalizeUnit("กก"), "กิโลกรัม");
  assert.equal(normalizeUnit("แพ็ค"), "แพ็ก");
  assert.equal(normalizeUnit("มล"), "มิลลิลิตร");
  assert.ok(KNOWN_UNITS.includes("กระป๋อง"));
  assert.ok(KNOWN_UNITS.includes("ตัว"));
  assert.ok(KNOWN_UNITS.includes("หลอด"));
  assert.ok(KNOWN_UNITS.includes("ช้อน"));
});

test("normalizeSpokenQuantity supports thai digits and speech words", () => {
  assert.equal(normalizeSpokenQuantity("๓"), "3");
  assert.equal(normalizeSpokenQuantity("ครึ่ง"), "0.5");
  assert.equal(normalizeSpokenQuantity("สี่ร้อย"), "400");
});

test("normalizeItemName trims speech-to-text filler prefixes", () => {
  assert.equal(normalizeItemName("พิมพ์อ่านอ่านอ่านทูน่า"), "ทูน่า");
  assert.equal(normalizeItemName("มีนม"), "นม");
  assert.equal(normalizeItemName("1.พิมพ์อ่านอ่านอ่านทูน่า"), "ทูน่า");
  assert.equal(normalizeItemName("2.มีนม"), "นม");
});

test("withDefaultPurchaseDate fills purchase_date when missing", () => {
  assert.deepEqual(
    withDefaultPurchaseDate(
      [{ item: "ไข่", quantity: "6", unit: "ฟอง" }],
      new Date("2026-05-04T10:00:00Z")
    ),
    [
      {
        item: "ไข่",
        quantity: "6",
        unit: "ฟอง",
        purchase_date: "2026-05-04",
      },
    ]
  );
});

test("withDefaultPurchaseDate preserves existing purchase_date", () => {
  assert.deepEqual(
    withDefaultPurchaseDate(
      [
        {
          item: "ไข่",
          quantity: "6",
          unit: "ฟอง",
          purchase_date: "2026-05-01",
        },
      ],
      new Date("2026-05-04T10:00:00Z")
    ),
    [
      {
        item: "ไข่",
        quantity: "6",
        unit: "ฟอง",
        purchase_date: "2026-05-01",
      },
    ]
  );
});

test("formatDateOnly returns yyyy-mm-dd", () => {
  assert.equal(formatDateOnly(new Date("2026-05-04T10:00:00Z")), "2026-05-04");
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
      items: [
        { item: "ไข่", quantity: 6, unit: "ฟอง", purchase_date: "2026-05-04" },
        { item: "- เต้าหู้", quantity: 1, unit: "ชิ้น", purchase_date: "2026-05-04" },
      ],
    }),
    [
      { item: "ไข่", quantity: "6", unit: "ฟอง", purchase_date: "2026-05-04" },
      { item: "เต้าหู้", quantity: "1", unit: "ชิ้น", purchase_date: "2026-05-04" },
    ]
  );
});

test("normalizeMenuCatalog accepts {menus: []} payload", () => {
  assert.deepEqual(
    normalizeMenuCatalog({
      menus: [
        {
          menu_name: "ต้มจืดเต้าหู้หมูสับ",
          required_items: "เต้าหู้,หมูสับ",
          optional_items: "ต้นหอม",
          preferred_for_house: "yes",
          difficulty: "easy",
        },
      ],
    }),
    [
      {
        menu_name: "ต้มจืดเต้าหู้หมูสับ",
        required_items: "เต้าหู้,หมูสับ",
        optional_items: "ต้นหอม",
        style: "",
        spicy_level: "",
        difficulty: "easy",
        time_minutes: "",
        preferred_for_house: "yes",
        avoid_if: "",
        note: "",
      },
    ]
  );
});

test("normalizeHouseholdPreferences accepts {preferences: []} payload", () => {
  assert.deepEqual(
    normalizeHouseholdPreferences({
      preferences: [
        {
          preference_type: "favorite",
          keyword: "ตำปลาร้า",
          weight: "5",
          enabled: "yes",
        },
      ],
    }),
    [
      {
        preference_type: "favorite",
        keyword: "ตำปลาร้า",
        weight: "5",
        enabled: "yes",
        note: "",
      },
    ]
  );
});

test("scoreMenuCandidate prefers household-friendly quick menus on ties", () => {
  const inventoryNames = ["ไข่", "เต้าหู้"];

  assert.ok(
    scoreMenuCandidate(
      {
        menu_name: "เต้าหู้ผัดไข่",
        required_items: "เต้าหู้,ไข่",
        optional_items: "",
        preferred_for_house: "yes",
        difficulty: "easy",
        time_minutes: "15",
      },
      inventoryNames
    ).score >
      scoreMenuCandidate(
        {
          menu_name: "ไข่กับเต้าหู้แบบทั่วไป",
          required_items: "เต้าหู้,ไข่",
          optional_items: "",
          preferred_for_house: "",
          difficulty: "medium",
          time_minutes: "25",
        },
        inventoryNames
      ).score
  );
});

test("scoreHouseholdPreferences boosts favorites and penalizes dislikes", () => {
  const menu = {
    menu_name: "ต้มจืดเต้าหู้หมูสับ",
    required_items: "เต้าหู้,หมูสับ",
    optional_items: "",
    style: "เมนูน้ำ",
    spicy_level: "mild",
    note: "",
  };

  const prefs = [
    { preference_type: "favorite", keyword: "เต้าหู้", weight: "4" },
    { preference_type: "dislike", keyword: "หมูสับ", weight: "2" },
  ];

  assert.equal(scoreHouseholdPreferences(menu, prefs), 2);
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
        {
          item: "ไข่",
          quantity: "6",
          unit: "ฟอง",
          purchase_date: formatDateOnly(new Date()),
        },
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

test("คิดเมนู suggests menus from menu catalog before fallback rules", async () => {
  const env = createEnv();
  const calls = installFetchMock(async (url, options) => {
    if (String(url).includes("example.com/apps-script")) {
      const payload = JSON.parse(options.body);

      if (payload.action === "menu_catalog") {
        return new Response(
          JSON.stringify({
            menus: [
              {
                menu_name: "ต้มจืดเต้าหู้หมูสับ",
                required_items: "เต้าหู้,เนื้อบด",
                optional_items: "",
                preferred_for_house: "yes",
                difficulty: "easy",
                time_minutes: "20",
              },
              {
                menu_name: "ไข่เจียวหมูสับ",
                required_items: "ไข่,เนื้อบด",
                optional_items: "",
                preferred_for_house: "yes",
                difficulty: "easy",
                time_minutes: "10",
              },
              {
                menu_name: "เต้าหู้ผัดไข่",
                required_items: "เต้าหู้,ไข่",
                optional_items: "",
                preferred_for_house: "yes",
                difficulty: "easy",
                time_minutes: "15",
              },
            ],
          }),
          { status: 200 }
        );
      }

      if (payload.action === "household_preferences") {
        return new Response(
          JSON.stringify({
            preferences: [
              {
                preference_type: "favorite",
                keyword: "เต้าหู้ผัดไข่",
                weight: "5",
                enabled: "yes",
              },
            ],
          }),
          { status: 200 }
        );
      }

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
    "ลองทำเมนูพวกนี้ได้นะ:\n- เต้าหู้ผัดไข่\n- ไข่เจียวหมูสับ\n- ต้มจืดเต้าหู้หมูสับ"
  );
});

test("admin fridge create-row merges duplicate item quantities", async () => {
  const env = createEnv();
  const calls = installFetchMock(async (url, options) => {
    if (String(url).includes("example.com/apps-script")) {
      const payload = JSON.parse(options.body);
      assert.equal(payload.action, "sheet_admin_create_row");
      assert.equal(payload.sheet, "Fridge");
      assert.deepEqual(payload.row, {
        item: "ไข่",
        quantity: "2",
        unit: "ฟอง",
      });

      return new Response(
        JSON.stringify({
          ok: true,
          action: "sheet_admin_create_row",
          sheet: "Fridge",
          affected: 1,
          mode: "merge",
        }),
        { status: 200 }
      );
    }

    throw new Error(`unexpected fetch ${url}`);
  });

  const response = await worker.fetch(
    createAdminRequest("/admin/sheets/create-row", {
      sheet: "Fridge",
      row: {
        item: "ไข่",
        quantity: "2",
        unit: "ฟอง",
      },
    }),
    env,
    {}
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    action: "sheet_admin_create_row",
    sheet: "Fridge",
    affected: 1,
    mode: "merge",
  });
  assert.equal(calls.length, 1);
});

test("admin routes reject invalid token", async () => {
  const env = createEnv();

  const response = await worker.fetch(
    createAdminRequest(
      "/admin/sheets/list",
      {
        sheet: "Fridge",
      },
      "wrong-token"
    ),
    env,
    {}
  );

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    ok: false,
    error: "Unauthorized",
  });
});

test("format helpers keep user-facing Thai text stable", () => {
  assert.equal(formatInventoryReply([]), "ตอนนี้ยังไม่มีของในตู้เลย");
  assert.equal(
    formatMenuIdeasReply([]),
    "ยังไม่มีของในตู้ เลยคิดเมนูให้ไม่ค่อยได้ ลองเพิ่มของก่อนนะ"
  );
});
