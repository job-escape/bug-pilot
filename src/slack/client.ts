import type { WebClient } from "@slack/web-api";

export interface SlackImage {
  url: string;
  mimetype: string;
  isVideo?: boolean;
}

export interface SlackMessage {
  ts: string;
  text: string;
  images: SlackImage[];
  imageUrls: string[]; // kept for compatibility
  permalink: string;
  botId?: string;
  userId?: string;
}

export async function fetchThread(
  client: WebClient,
  channel: string,
  ts: string
): Promise<SlackMessage[]> {
  const result = await client.conversations.replies({ channel, ts, limit: 100 });
  const messages = result.messages ?? [];

  return Promise.all(
    messages.map(async (msg) => {
      const images: SlackImage[] = [];

      for (const file of msg.files ?? []) {
        const url = file.url_private;
        const mime = file.mimetype ?? "";
        if (url && mime.startsWith("image/")) {
          images.push({ url, mimetype: mime });
        } else if (url && (mime === "video/quicktime" || mime === "video/mp4" || mime.startsWith("video/"))) {
          images.push({ url, mimetype: mime, isVideo: true });
        }
      }

      const permalink = await client.chat
        .getPermalink({ channel, message_ts: msg.ts! })
        .then((r) => r.permalink ?? "")
        .catch(() => "");

      return {
        ts: msg.ts!,
        text: msg.text ?? "",
        images,
        imageUrls: images.map((i) => i.url),
        permalink,
        botId: msg.bot_id,
        userId: msg.user,
      };
    })
  );
}

export async function downloadImage(
  url: string,
  botToken: string
): Promise<{ base64: string; mediaType: string }> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${botToken}` },
  });
  const contentType = res.headers.get("content-type") ?? "image/jpeg";
  const mediaType = contentType.split(";")[0]?.trim() ?? "image/jpeg";
  const buf = await res.arrayBuffer();
  return { base64: Buffer.from(buf).toString("base64"), mediaType };
}

export async function postReply(
  client: WebClient,
  channel: string,
  threadTs: string,
  text: string
): Promise<void> {
  await client.chat.postMessage({ channel, thread_ts: threadTs, text });
}
