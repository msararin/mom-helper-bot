const SHEET_NAME = "inventory";

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

  const items = Array.isArray(payload.items) ? payload.items : [];
  if (items.length === 0) {
    return jsonOutput({
      ok: false,
      error: "No items provided",
    });
  }

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
      };
    });
}

function saveInventoryItems_(items) {
  const sheet = getInventorySheet_();
  const rows = items.map(function(item) {
    return [
      item.item || "",
      item.quantity || "",
      item.unit || "",
      item.expiry_date || "",
    ];
  });

  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 4).setValues(rows);
}

function getInventorySheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["item", "quantity", "unit", "expiry_date"]);
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
