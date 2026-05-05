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
  createQuickReplyButton,
  replyToLine,
  replyWithMainMenu,
};
