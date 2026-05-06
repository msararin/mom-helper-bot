async function handleLineWebhookRequest(request, env, ctx, onEvent) {
  try {
    const signature = request.headers.get("x-line-signature");

    if (!env.LINE_CHANNEL_SECRET) {
      console.error("LINE_CHANNEL_SECRET is not set");
      return new Response("Server misconfigured", { status: 500 });
    }

    if (!signature) {
      return new Response("Missing signature", { status: 401 });
    }

    const rawBody = await request.text();
    const isValidSignature = await verifyLineSignature(
      rawBody,
      signature,
      env.LINE_CHANNEL_SECRET
    );

    if (!isValidSignature) {
      return new Response("Invalid signature", { status: 401 });
    }

    const body = JSON.parse(rawBody);
    const events = Array.isArray(body?.events) ? body.events : [];

    for (const event of events) {
      ctx.waitUntil(onEvent(event, env));
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Webhook parse error:", error);
    return new Response("OK", { status: 200 });
  }
}

async function verifyLineSignature(rawBody, signature, channelSecret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(channelSecret),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  );

  const signedBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(rawBody)
  );

  const expectedSignature = base64Encode(signedBuffer);
  return signature === expectedSignature;
}

function base64Encode(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

export { handleLineWebhookRequest };
