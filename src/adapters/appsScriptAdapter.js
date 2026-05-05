import {
  normalizeHouseholdPreferences,
  normalizeInventoryList,
  normalizeMenuCatalog,
} from "../services/menuSuggestionService.js";

async function saveItemsToAppsScript(url, payload) {
  await callAppsScript(url, payload, "Apps Script save");
}

async function fetchInventoryFromAppsScript(url) {
  const data = await callAppsScript(url, { action: "list" }, "Apps Script list");
  return normalizeInventoryList(data);
}

async function fetchMenuCatalogFromAppsScript(url) {
  const data = await callAppsScript(
    url,
    { action: "menu_catalog" },
    "Apps Script menu catalog"
  );
  return normalizeMenuCatalog(data);
}

async function fetchHouseholdPreferencesFromAppsScript(url) {
  const data = await callAppsScript(
    url,
    { action: "household_preferences" },
    "Apps Script household preferences"
  );
  return normalizeHouseholdPreferences(data);
}

async function callAppsScript(url, payload, label = "Apps Script request") {
  if (!url) {
    throw new Error("GOOGLE_APPS_SCRIPT_URL is not set");
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...payload,
    }),
  });

  if (!response.ok) {
    throw new Error(`${label} failed with status ${response.status}`);
  }

  const responseText = await response.text();
  let data;

  try {
    data = JSON.parse(responseText);
  } catch (error) {
    throw new Error(`${label} returned non-JSON: ${responseText}`);
  }

  return data;
}

export {
  callAppsScript,
  fetchHouseholdPreferencesFromAppsScript,
  fetchInventoryFromAppsScript,
  fetchMenuCatalogFromAppsScript,
  saveItemsToAppsScript,
};
