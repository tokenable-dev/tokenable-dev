import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type GmailMessageList = {
  messages?: { id: string; threadId: string }[];
  nextPageToken?: string;
};

export type GmailMessagePart = {
  mimeType?: string;
  filename?: string;
  body?: { data?: string };
  parts?: GmailMessagePart[];
};

export type GmailMessage = {
  id: string;
  payload?: {
    headers?: { name: string; value: string }[];
    mimeType?: string;
    body?: { data?: string };
    parts?: GmailMessagePart[];
  };
};

type GmailLabelList = {
  labels?: { id: string; name: string }[];
};

const DEFAULT_GMAIL_USER = 'tokenable.dev@gmail.com';

/**
 * Shared Gmail REST + OAuth refresh for PSA mail pollers.
 * Query, processed-label name, and ingest stay on each mail service.
 */
@Injectable()
export class GmailApiClient {
  private readonly labelIds = new Map<string, string>();

  constructor(private readonly config: ConfigService) {}

  user(): string {
    return this.config.get<string>('GMAIL_USER')?.trim() || DEFAULT_GMAIL_USER;
  }

  hasCredentials(): boolean {
    return Boolean(
      this.config.get<string>('GMAIL_CLIENT_ID')?.trim() &&
        this.config.get<string>('GMAIL_CLIENT_SECRET')?.trim() &&
        this.config.get<string>('GMAIL_REFRESH_TOKEN')?.trim(),
    );
  }

  async fetchAccessToken(): Promise<string> {
    const clientId = this.config.get<string>('GMAIL_CLIENT_ID')?.trim();
    const clientSecret = this.config.get<string>('GMAIL_CLIENT_SECRET')?.trim();
    const refreshToken = this.config.get<string>('GMAIL_REFRESH_TOKEN')?.trim();
    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error(
        'GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET / GMAIL_REFRESH_TOKEN required',
      );
    }
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!res.ok) {
      throw new Error(`Gmail token refresh failed: ${res.status}`);
    }
    const json = (await res.json()) as { access_token?: string };
    if (!json.access_token) throw new Error('Gmail token refresh: no access_token');
    return json.access_token;
  }

  async listMessageIds(
    accessToken: string,
    query: string,
    opts: { max: number; pageSize: number },
  ): Promise<{ ids: string[]; hitCap: boolean }> {
    const user = encodeURIComponent(this.user());
    const q = encodeURIComponent(query);
    const ids: string[] = [];
    let pageToken: string | undefined;
    while (ids.length < opts.max) {
      const remaining = opts.max - ids.length;
      const max = Math.min(opts.pageSize, remaining);
      let url = `https://gmail.googleapis.com/gmail/v1/users/${user}/messages?q=${q}&maxResults=${max}`;
      if (pageToken) {
        url += `&pageToken=${encodeURIComponent(pageToken)}`;
      }
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        throw new Error(`Gmail list messages failed: ${res.status}`);
      }
      const json = (await res.json()) as GmailMessageList;
      for (const m of json.messages ?? []) ids.push(m.id);
      if (!json.nextPageToken || !json.messages?.length) break;
      pageToken = json.nextPageToken;
    }
    return { ids, hitCap: ids.length >= opts.max };
  }

  async getMessage(accessToken: string, messageId: string): Promise<GmailMessage> {
    const user = encodeURIComponent(this.user());
    const url = `https://gmail.googleapis.com/gmail/v1/users/${user}/messages/${encodeURIComponent(messageId)}?format=full`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      throw new Error(`Gmail get message failed: ${res.status}`);
    }
    return (await res.json()) as GmailMessage;
  }

  async ensureLabel(accessToken: string, name: string): Promise<string> {
    const cached = this.labelIds.get(name);
    if (cached) return cached;
    const user = encodeURIComponent(this.user());
    const listRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/${user}/labels`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!listRes.ok) {
      throw new Error(`Gmail list labels failed: ${listRes.status}`);
    }
    const list = (await listRes.json()) as GmailLabelList;
    const existing = (list.labels ?? []).find((l) => l.name === name);
    if (existing?.id) {
      this.labelIds.set(name, existing.id);
      return existing.id;
    }
    const createRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/${user}/labels`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          labelListVisibility: 'labelShow',
          messageListVisibility: 'show',
        }),
      },
    );
    if (!createRes.ok) {
      throw new Error(`Gmail create label failed: ${createRes.status}`);
    }
    const created = (await createRes.json()) as { id: string };
    this.labelIds.set(name, created.id);
    return created.id;
  }

  async markProcessed(
    accessToken: string,
    messageId: string,
    labelId: string,
  ): Promise<void> {
    const user = encodeURIComponent(this.user());
    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/${user}/messages/${encodeURIComponent(messageId)}/modify`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          addLabelIds: [labelId],
          removeLabelIds: ['UNREAD'],
        }),
      },
    );
    if (!res.ok) {
      throw new Error(`Gmail modify message failed: ${res.status}`);
    }
  }

  async insertRfc822(accessToken: string, rawRfc822: string): Promise<string> {
    const encoded = Buffer.from(rawRfc822)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    const user = encodeURIComponent(this.user());
    const insertRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/${user}/messages?internalDateSource=dateHeader`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          raw: encoded,
          labelIds: ['INBOX', 'UNREAD'],
        }),
      },
    );
    const insertJson = (await insertRes.json()) as {
      id?: string;
      error?: { message?: string };
    };
    if (!insertRes.ok || !insertJson.id) {
      throw new Error(
        `Gmail insert failed: ${insertRes.status} ${insertJson.error?.message ?? ''}`.trim(),
      );
    }
    return insertJson.id;
  }

  decodeMessage(msg: GmailMessage): {
    subject: string;
    from: string;
    bodyText: string;
  } {
    const headers = msg.payload?.headers ?? [];
    const subject =
      headers.find((h) => h.name.toLowerCase() === 'subject')?.value ?? '';
    const from =
      headers.find((h) => h.name.toLowerCase() === 'from')?.value ?? '';
    const bodyText = this.collectText(msg.payload);
    return { subject, from, bodyText };
  }

  private collectText(part?: GmailMessagePart | GmailMessage['payload']): string {
    if (!part) return '';
    const chunks: string[] = [];
    if (part.mimeType === 'text/plain' && part.body?.data) {
      chunks.push(this.decodeBase64Url(part.body.data));
    }
    if (part.mimeType === 'text/html' && part.body?.data && chunks.length === 0) {
      chunks.push(this.stripHtml(this.decodeBase64Url(part.body.data)));
    }
    for (const child of part.parts ?? []) {
      chunks.push(this.collectText(child));
    }
    return chunks.join('\n');
  }

  private decodeBase64Url(data: string): string {
    const padded = data.replace(/-/g, '+').replace(/_/g, '/');
    return Buffer.from(padded, 'base64').toString('utf8');
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
  }
}
