const INVENTORY_SHEET_NAME = "Fridge";
const LOG_SHEET_NAME = "Fridge_Log";
const MENU_SHEET_NAME = "Menu_Catalog";
const MEAL_LOG_SHEET_NAME = "Meal_Log";
const INVENTORY_HEADERS = [
  "item",
  "quantity",
  "unit",
  "expiry_date",
  "note",
  "updated_at",
  "purchase_date",
];
const MENU_HEADERS = [
  "menu_name",
  "required_items",
  "optional_items",
  "style",
  "spicy_level",
  "difficulty",
  "time_minutes",
  "preferred_for_house",
  "avoid_if",
  "note",
];
const LOG_HEADERS = [
  "timestamp",
  "userId",
  "message",
];
const MEAL_LOG_HEADERS = [
  "timestamp",
  "menu_name",
  "source",
  "note",
];
const ADMIN_SHEET_HEADERS = {
  Fridge: INVENTORY_HEADERS,
  Fridge_Log: LOG_HEADERS,
  Menu_Catalog: MENU_HEADERS,
  Meal_Log: MEAL_LOG_HEADERS,
};

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || "";

  if (action === "list") {
    return jsonOutput({
      items: listInventoryItems_(),
    });
  }

  if (action === "menu_catalog") {
    return jsonOutput({
      menus: listMenuCatalog_(),
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

  if (payload.action === "menu_catalog") {
    return jsonOutput({
      menus: listMenuCatalog_(),
    });
  }

  if (isSheetAdminAction_(payload.action)) {
    return handleSheetAdminAction_(payload);
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
  const now = new Date();
  const today = Utilities.formatDate(
    now,
    Session.getScriptTimeZone(),
    "yyyy-MM-dd"
  );
  const headers = getSheetHeaders_(sheet);
  const rows = getSheetRowsAsObjects_(sheet, headers);

  items.forEach(function(item) {
    upsertInventoryRow_(rows, {
      item: item.item || "",
      quantity: item.quantity || "",
      unit: item.unit || "",
      expiry_date: item.expiry_date || "",
      note: item.note || "",
      updated_at: now,
      purchase_date: item.purchase_date || today,
    });
  });

  writeObjectsToSheet_(sheet, headers, rows);
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

function listMenuCatalog_() {
  const sheet = getMenuSheet_();
  const values = sheet.getDataRange().getValues();

  if (values.length <= 1) {
    return [];
  }

  return values
    .slice(1)
    .filter(function(row) {
      return row[0];
    })
    .map(function(row) {
      return {
        menu_name: String(row[0] || "").trim(),
        required_items: String(row[1] || "").trim(),
        optional_items: String(row[2] || "").trim(),
        style: String(row[3] || "").trim(),
        spicy_level: String(row[4] || "").trim(),
        difficulty: String(row[5] || "").trim(),
        time_minutes: String(row[6] || "").trim(),
        preferred_for_house: String(row[7] || "").trim(),
        avoid_if: String(row[8] || "").trim(),
        note: String(row[9] || "").trim(),
      };
    });
}

function getMenuSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  return getOrCreateSheet_(spreadsheet, MENU_SHEET_NAME, MENU_HEADERS);
}

function getMealLogSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  return getOrCreateSheet_(spreadsheet, MEAL_LOG_SHEET_NAME, MEAL_LOG_HEADERS);
}

function appendLogRow_(userId, message) {
  if (!userId && !message) {
    return;
  }

  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getOrCreateSheet_(spreadsheet, LOG_SHEET_NAME, LOG_HEADERS);

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

function isSheetAdminAction_(action) {
  return [
    "sheet_admin_list",
    "sheet_admin_create_row",
    "sheet_admin_update_row",
    "sheet_admin_delete_row",
    "sheet_admin_dedupe",
  ].indexOf(action) >= 0;
}

function handleSheetAdminAction_(payload) {
  const sheetName = String(payload.sheet || "").trim();
  const sheet = getAllowedAdminSheet_(sheetName);
  const headers = getSheetHeaders_(sheet);

  if (payload.action === "sheet_admin_list") {
    return jsonOutput({
      ok: true,
      sheet: sheetName,
      headers: headers,
      rows: getSheetRowsAsObjects_(sheet, headers),
    });
  }

  if (payload.action === "sheet_admin_create_row") {
    const rows = getSheetRowsAsObjects_(sheet, headers);
    const row = normalizeRowForSheet_(sheetName, payload.row, headers);

    if (sheetName === INVENTORY_SHEET_NAME) {
      upsertInventoryRow_(rows, row);
      writeObjectsToSheet_(sheet, headers, rows);
      return jsonOutput({
        ok: true,
        action: payload.action,
        sheet: sheetName,
        affected: 1,
        mode: "merge",
      });
    }

    rows.push(row);
    writeObjectsToSheet_(sheet, headers, rows);
    return jsonOutput({
      ok: true,
      action: payload.action,
      sheet: sheetName,
      affected: 1,
      mode: "append",
    });
  }

  if (payload.action === "sheet_admin_update_row") {
    const rows = getSheetRowsAsObjects_(sheet, headers);
    const match = normalizeMatchObject_(payload.match);
    const updates = normalizeRowForSheet_(sheetName, payload.updates, headers, {
      partial: true,
    });
    var affected = 0;

    rows.forEach(function(row) {
      if (!rowMatches_(row, match)) {
        return;
      }

      headers.forEach(function(header) {
        if (Object.prototype.hasOwnProperty.call(updates, header)) {
          row[header] = updates[header];
        }
      });

      affected += 1;
    });

    writeObjectsToSheet_(sheet, headers, rows);
    return jsonOutput({
      ok: true,
      action: payload.action,
      sheet: sheetName,
      affected: affected,
    });
  }

  if (payload.action === "sheet_admin_delete_row") {
    const rows = getSheetRowsAsObjects_(sheet, headers);
    const match = normalizeMatchObject_(payload.match);
    const keptRows = rows.filter(function(row) {
      return !rowMatches_(row, match);
    });

    writeObjectsToSheet_(sheet, headers, keptRows);
    return jsonOutput({
      ok: true,
      action: payload.action,
      sheet: sheetName,
      affected: rows.length - keptRows.length,
    });
  }

  if (payload.action === "sheet_admin_dedupe") {
    const rows = getSheetRowsAsObjects_(sheet, headers);
    const dedupeBy = Array.isArray(payload.dedupe_by) ? payload.dedupe_by : [];

    if (sheetName === INVENTORY_SHEET_NAME) {
      const mergedRows = dedupeInventoryRows_(rows);
      writeObjectsToSheet_(sheet, headers, mergedRows);
      return jsonOutput({
        ok: true,
        action: payload.action,
        sheet: sheetName,
        affected: rows.length - mergedRows.length,
      });
    }

    const dedupedRows = dedupeRowsByKeys_(rows, dedupeBy);
    writeObjectsToSheet_(sheet, headers, dedupedRows);
    return jsonOutput({
      ok: true,
      action: payload.action,
      sheet: sheetName,
      affected: rows.length - dedupedRows.length,
    });
  }

  return jsonOutput({
    ok: false,
    error: "Unsupported admin action",
  });
}

function getAllowedAdminSheet_(sheetName) {
  if (!ADMIN_SHEET_HEADERS[sheetName]) {
    throw new Error("Sheet is not allowed");
  }

  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  return getOrCreateSheet_(spreadsheet, sheetName, ADMIN_SHEET_HEADERS[sheetName]);
}

function getSheetHeaders_(sheet) {
  const headerValues = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  return headerValues.map(function(value) {
    return String(value || "").trim();
  }).filter(Boolean);
}

function getSheetRowsAsObjects_(sheet, headers) {
  if (sheet.getLastRow() <= 1) {
    return [];
  }

  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
  return values.map(function(rowValues) {
    const row = {};
    headers.forEach(function(header, index) {
      row[header] = rowValues[index];
    });
    return row;
  });
}

function writeObjectsToSheet_(sheet, headers, rows) {
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, headers.length).clearContent();
  }

  if (rows.length === 0) {
    return;
  }

  const values = rows.map(function(row) {
    return headers.map(function(header) {
      return Object.prototype.hasOwnProperty.call(row, header) ? row[header] : "";
    });
  });

  sheet.getRange(2, 1, values.length, headers.length).setValues(values);
}

function normalizeRowForSheet_(sheetName, row, headers, options) {
  const source = row && typeof row === "object" ? row : {};
  const settings = options || {};
  const partial = Boolean(settings.partial);
  const normalized = {};

  headers.forEach(function(header) {
    if (Object.prototype.hasOwnProperty.call(source, header)) {
      normalized[header] = source[header];
    }
  });

  if (sheetName === INVENTORY_SHEET_NAME) {
    [
      "item",
      "quantity",
      "unit",
      "expiry_date",
      "note",
      "purchase_date",
    ].forEach(function(fieldName) {
      if (!partial || Object.prototype.hasOwnProperty.call(normalized, fieldName)) {
        normalized[fieldName] = String(normalized[fieldName] || "").trim();
      }
    });

    if (!partial || Object.prototype.hasOwnProperty.call(normalized, "updated_at")) {
      normalized.updated_at = normalized.updated_at || new Date();
    }
  }

  return normalized;
}

function normalizeMatchObject_(match) {
  const source = match && typeof match === "object" ? match : {};
  const normalized = {};
  Object.keys(source).forEach(function(key) {
    normalized[key] = String(source[key] || "").trim();
  });
  return normalized;
}

function rowMatches_(row, match) {
  const keys = Object.keys(match);
  if (keys.length === 0) {
    return false;
  }

  return keys.every(function(key) {
    return String(row[key] || "").trim() === match[key];
  });
}

function upsertInventoryRow_(rows, incomingRow) {
  const itemName = String(incomingRow.item || "").trim();
  const unitName = String(incomingRow.unit || "").trim();
  const quantityNumber = parseNumber_(incomingRow.quantity);
  var matchedRow = null;

  rows.some(function(row) {
    if (
      String(row.item || "").trim() === itemName &&
      String(row.unit || "").trim() === unitName
    ) {
      matchedRow = row;
      return true;
    }
    return false;
  });

  if (!matchedRow) {
    rows.push(incomingRow);
    return;
  }

  if (quantityNumber !== null) {
    const currentQuantity = parseNumber_(matchedRow.quantity) || 0;
    matchedRow.quantity = normalizeNumber_(currentQuantity + quantityNumber);
  } else if (!matchedRow.quantity) {
    matchedRow.quantity = incomingRow.quantity;
  }

  if (incomingRow.expiry_date) {
    matchedRow.expiry_date = incomingRow.expiry_date;
  }
  if (incomingRow.note) {
    matchedRow.note = incomingRow.note;
  }
  if (incomingRow.purchase_date) {
    matchedRow.purchase_date = incomingRow.purchase_date;
  }
  matchedRow.updated_at = incomingRow.updated_at || new Date();
}

function dedupeInventoryRows_(rows) {
  const mergedRows = [];
  rows.forEach(function(row) {
    upsertInventoryRow_(mergedRows, {
      item: String(row.item || "").trim(),
      quantity: String(row.quantity || "").trim(),
      unit: String(row.unit || "").trim(),
      expiry_date: String(row.expiry_date || "").trim(),
      note: String(row.note || "").trim(),
      purchase_date: String(row.purchase_date || "").trim(),
      updated_at: row.updated_at || new Date(),
    });
  });
  return mergedRows;
}

function dedupeRowsByKeys_(rows, dedupeBy) {
  const keys = dedupeBy.map(function(key) {
    return String(key || "").trim();
  }).filter(Boolean);
  const seen = {};
  const result = [];

  rows.forEach(function(row) {
    const dedupeKey = keys.map(function(key) {
      return String(row[key] || "").trim();
    }).join("||");

    if (seen[dedupeKey]) {
      return;
    }

    seen[dedupeKey] = true;
    result.push(row);
  });

  return result;
}

function parseNumber_(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return null;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeNumber_(value) {
  return Math.floor(value) === value ? String(value) : String(Number(value.toFixed(2)));
}
