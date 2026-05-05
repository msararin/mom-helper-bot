import test from "node:test";
import assert from "node:assert/strict";

import {
  KNOWN_UNITS,
  containsInventoryItem,
  findQuantityUnitAt,
  formatDateOnly,
  formatInventoryReply,
  formatMenuIdeasReply,
  looksLikeCasualChat,
  normalizeHouseholdPreferences,
  normalizeInventoryList,
  normalizeItemName,
  normalizeMenuCatalog,
  normalizeSpokenQuantity,
  normalizeUnit,
  parseConcatenatedThaiItems,
  parseThaiItems,
  parseThaiNumberWords,
  scorePreferenceMatch,
  scoreHouseholdPreferences,
  scoreMenuCandidate,
  splitCatalogList,
  suggestMenuIdeas,
  suggestMenuIdeasFromCatalog,
  uniqueIdeas,
  withDefaultPurchaseDate,
} from "../../src/index.js";

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

test("scorePreferenceMatch favors exact menu name over supporting text", () => {
  assert.equal(scorePreferenceMatch("ไข่ตุ๋น", "ไข่ตุ๋น", "ไข่ นึ่ง"), 3);
  assert.equal(scorePreferenceMatch("ไข่", "ไข่ตุ๋น", "นึ่ง"), 2);
  assert.equal(scorePreferenceMatch("นึ่ง", "ไข่ตุ๋น", "นึ่ง เมนูเบาๆ"), 1);
  assert.equal(scorePreferenceMatch("ตำปลาร้า", "ไข่ตุ๋น", "ไข่ นึ่ง"), 0);
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

  assert.equal(scoreHouseholdPreferences(menu, prefs), 4);
});

test("scoreMenuCandidate lets exact favorite menu outrank a generic tie", () => {
  const inventoryNames = ["ไข่"];
  const prefs = [
    { preference_type: "favorite", keyword: "ข้าวไข่ดาวสองฟอง", weight: "5" },
  ];

  const favoriteScore = scoreMenuCandidate(
    {
      menu_name: "ข้าวไข่ดาวสองฟอง",
      required_items: "ไข่",
      optional_items: "",
      preferred_for_house: "",
      difficulty: "easy",
      time_minutes: "10",
      style: "จานเดียว",
      spicy_level: "mild",
      note: "",
    },
    inventoryNames,
    prefs
  ).score;

  const genericScore = scoreMenuCandidate(
    {
      menu_name: "ไข่ดาว",
      required_items: "ไข่",
      optional_items: "",
      preferred_for_house: "",
      difficulty: "easy",
      time_minutes: "10",
      style: "ทอด",
      spicy_level: "mild",
      note: "",
    },
    inventoryNames,
    prefs
  ).score;

  assert.ok(favoriteScore > genericScore);
});

test("format helpers keep user-facing Thai text stable", () => {
  assert.equal(formatInventoryReply([]), "ตอนนี้ยังไม่มีของในตู้เลย");
  assert.equal(
    formatMenuIdeasReply([]),
    "ยังไม่มีของในตู้ เลยคิดเมนูให้ไม่ค่อยได้ ลองเพิ่มของก่อนนะ"
  );
});

test("formatMenuIdeasReply does not invent fallback menus when Menu_Catalog exists but has no match", () => {
  const reply = formatMenuIdeasReply(
    [{ item: "ไข่", quantity: "6", unit: "ฟอง" }],
    [
      {
        menu_name: "ต้มจืดเต้าหู้หมูสับ",
        required_items: "เต้าหู้,หมูสับ",
        optional_items: "",
        style: "เมนูน้ำ",
        spicy_level: "mild",
        difficulty: "easy",
        time_minutes: "20",
        preferred_for_house: "yes",
        avoid_if: "",
        note: "",
      },
    ],
    []
  );

  assert.equal(
    reply,
    "ตอนนี้ยังหาเมนูจากตารางที่ตรงของในตู้ไม่เจอ ลองเพิ่มเมนูใน Menu_Catalog หรือเพิ่มของในตู้ก่อนนะ"
  );
});

test("formatMenuIdeasReply still uses legacy fallback when Menu_Catalog is empty", () => {
  const reply = formatMenuIdeasReply(
    [{ item: "ไข่", quantity: "6", unit: "ฟอง" }],
    [],
    []
  );

  assert.equal(reply, "ลองทำเมนูพวกนี้ได้นะ:\n- ไข่เจียว");
});

test("helper exports remain stable for menu logic modules", () => {
  assert.deepEqual(splitCatalogList("ไข่, เต้าหู้"), ["ไข่", "เต้าหู้"]);
  assert.equal(containsInventoryItem(["เต้าหู้ผัดไข่"], "เต้าหู้"), true);
  assert.deepEqual(uniqueIdeas(["a", "b", "a"]), ["a", "b"]);
  assert.equal(findQuantityUnitAt("ไข่6ฟอง", 3)?.unit, "ฟอง");
  assert.deepEqual(
    suggestMenuIdeasFromCatalog(
      [{ item: "ไข่", quantity: "6", unit: "ฟอง" }],
      [
        {
          menu_name: "ไข่ดาว",
          required_items: "ไข่",
          optional_items: "",
          preferred_for_house: "yes",
          difficulty: "easy",
          time_minutes: "5",
        },
      ],
      []
    ),
    ["ไข่ดาว"]
  );
  assert.deepEqual(suggestMenuIdeas([{ item: "ไข่", quantity: "6", unit: "ฟอง" }], [], []), [
    "ไข่เจียว",
  ]);
});
