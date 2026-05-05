import test from "node:test";
import assert from "node:assert/strict";

import worker, {
  formatDateOnly,
  getUserModeKey,
  handleLineEvent,
} from "../../src/index.js";
import {
  FakeKV,
  createAdminRequest,
  createEnv,
  createLineEvent,
  getLastReplyBody,
  getLastReplyText,
  installFetchMock,
} from "../helpers.js";

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
