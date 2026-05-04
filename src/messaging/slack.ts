import type { WebClient } from "@slack/web-api";
import type { MessagingAdapter, MessagingMessage } from "./types.js";

export class SlackAdapter implements MessagingAdapter {
  constructor(private readonly client: WebClient, private readonly botToken: string) {}

  async fetchThread(channel: string, ts: string): Promise<MessagingMessage[]> {
    const result = await this.client.conversations.replies({ channel, ts, limit: 100 });
    const messages = result.messages ?? [];

    return Promise.all(
      messages.map(async (msg) => {
        const images = [];

        for (const file of msg.files ?? []) {
          const url = file.url_private;
          const mime = file.mimetype ?? "";
          if (url && mime.startsWith("image/")) {
            images.push({ url, mimetype: mime });
          } else if (url && mime.startsWith("video/")) {
            images.push({ url, mimetype: mime, isVideo: true });
          }
        }

        const permalink = await this.client.chat
          .getPermalink({ channel, message_ts: msg.ts! })
          .then((r) => r.permalink ?? "")
          .catch(() => "");

        return {
          ts: msg.ts!,
          text: msg.text ?? "",
          images,
          imageUrls: images.map((i) => i.url),
          permalink,
          isBot: !!msg.bot_id,
          botId: msg.bot_id,
          userId: msg.user,
        };
      })
    );
  }

  async postReply(channel: string, ts: string, text: string): Promise<void> {
    await this.client.chat.postMessage({ channel, thread_ts: ts, text });
  }

  async downloadFile(url: string): Promise<{ base64: string; mediaType: string }> {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${this.botToken}` },
    });
    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    const mediaType = contentType.split(";")[0]?.trim() ?? "image/jpeg";
    const buf = await res.arrayBuffer();
    return { base64: Buffer.from(buf).toString("base64"), mediaType };
  }

  async getChannels(): Promise<{ id: string; name: string }[]> {
    const result = await this.client.conversations.list({ limit: 200, types: "public_channel,private_channel" });
    return (result.channels ?? [])
      .filter((c) => c.id && c.name)
      .map((c) => ({ id: c.id!, name: c.name! }));
  }
}
