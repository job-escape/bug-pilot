import type { BugImage } from "../types.js";

export interface MessagingMessage {
  ts: string;
  text: string;
  images: BugImage[];
  imageUrls: string[];
  permalink: string;
  isBot: boolean;
  botId?: string;
  userId?: string;
}

export interface MessagingAdapter {
  fetchThread(channel: string, ts: string): Promise<MessagingMessage[]>;
  postReply(channel: string, ts: string, text: string): Promise<void>;
  downloadFile(url: string): Promise<{ base64: string; mediaType: string }>;
  getChannels(): Promise<{ id: string; name: string }[]>;
}
