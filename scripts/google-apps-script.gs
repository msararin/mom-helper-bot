const INVENTORY_SHEET_NAME = "Fridge";
const LOG_SHEET_NAME = "Fridge_Log";
const INVENTORY_HEADERS = [
  "item",
  "quantity",
  "unit",
  "expiry_date",
  "note",
  "updated_at",
  "purchase_date",
];

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || "";

  if (action === "list") {
    return jsonOutput({
      items: listInventoryItems_(),
    });
  }

  return ContentService.createTextOutput("Google Sheet receiver is running");
}

function doPost(e) {
  const payload = parseJsonBody_(e);

  if (payload.action === "list") {
    return jsonOutput({
      items: listInventoryItems_(),
    });
  }

  const userId = String(payload.userId || "").trim();
  const message = String(payload.message || "").trim();
  const items = Array.isArray(payload.items) ? payload.items : [];
  if (items.length === 0) {
    return jsonOutput({
      ok: false,
      error: "No items provided",
    });
  }

  appendLogRow_(userId, message);
  saveInventoryItems_(items);

  return jsonOutput({
    ok: true,
    savedCount: items.length,
  });
}

function listInventoryItems_() {
  const sheet = getInventorySheet_();
  const values = sheet.getDataRange().getValues();

  if (values.length <= 1) {
    return [];
  }

  const rows = values.slice(1);
  return rows
    .filter(function(row) {
      return row[0];
    })
    .map(function(row) {
      return {
        item: String(row[0] || "").trim(),
        quantity: String(row[1] || "").trim(),
        unit: String(row[2] || "").trim(),
        expiry_date: String(row[3] || "").trim(),
        note: String(row[4] || "").trim(),
        updated_at: String(row[5] || "").trim(),
        purchase_date: String(row[6] || "").trim(),
      };
    });
}

function saveInventoryItems_(items) {
  const sheet = getInventorySheet_();
  const today = Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    "yyyy-MM-dd"
  );
  const rows = items.map(function(item) {
    return [
      item.item || "",
      item.quantity || "",
      item.unit || "",
      item.expiry_date || "",
      item.note || "",
      now,
      item.purchase_date || today,
    ];
  });

  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 7).setValues(rows);
}

function getInventorySheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(INVENTORY_SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(INVENTORY_SHEET_NAME);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(INVENTORY_HEADERS);
  }

  return sheet;
}

function appendLogRow_(userId, message) {
  if (!userId && !message) {
    return;
  }

  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getOrCreateSheet_(spreadsheet, LOG_SHEET_NAME, [
    "timestamp",
    "userId",
    "message",
  ]);

  sheet.appendRow([new Date(), userId, message]);
}

function getOrCreateSheet_(spreadsheet, sheetName, headers) {
  let sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
    sheet.appendRow(headers);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  }

  return sheet;
}

function parseJsonBody_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    return {};
  }

  try {
    return JSON.parse(e.postData.contents);
  } catch (error) {
    return {};
  }
}

function jsonOutput(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
