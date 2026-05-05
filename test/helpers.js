import assert from "node:assert/strict";

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

export {
  FakeKV,
  createAdminRequest,
  createEnv,
  createLineEvent,
  getLastReplyBody,
  getLastReplyText,
  installFetchMock,
};
