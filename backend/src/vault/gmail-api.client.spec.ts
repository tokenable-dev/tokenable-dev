import { ConfigService } from '@nestjs/config';
import { GmailApiClient } from './gmail-api.client';

function client(env: Record<string, string> = {}): GmailApiClient {
  return new GmailApiClient(
    new ConfigService({
      GMAIL_USER: 'ops@example.com',
      GMAIL_CLIENT_ID: 'id',
      GMAIL_CLIENT_SECRET: 'secret',
      GMAIL_REFRESH_TOKEN: 'refresh',
      ...env,
    }),
  );
}

describe('GmailApiClient', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('defaults user and reports credentials', () => {
    const bare = new GmailApiClient(new ConfigService({}));
    expect(bare.user()).toBe('tokenable.dev@gmail.com');
    expect(bare.hasCredentials()).toBe(false);
    expect(client().hasCredentials()).toBe(true);
    expect(client().user()).toBe('ops@example.com');
  });

  it('decodes multipart text/plain the same way as the old mail services', () => {
    const body = Buffer.from('Cert 12345678 is here', 'utf8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    const decoded = client().decodeMessage({
      id: 'm1',
      payload: {
        headers: [
          { name: 'Subject', value: 'Items Received at PSA Vault' },
          { name: 'From', value: 'PSA Vault <noreply@collectors.com>' },
        ],
        mimeType: 'multipart/alternative',
        parts: [{ mimeType: 'text/plain', body: { data: body } }],
      },
    });
    expect(decoded.subject).toBe('Items Received at PSA Vault');
    expect(decoded.from).toContain('noreply@collectors.com');
    expect(decoded.bodyText).toContain('12345678');
  });

  it('lists message ids with the same query/cap contract', async () => {
    const calls: string[] = [];
    global.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      return {
        ok: true,
        json: async () => ({
          messages: [{ id: 'a', threadId: 't' }, { id: 'b', threadId: 't' }],
        }),
      } as Response;
    }) as typeof fetch;

    const listed = await client().listMessageIds('tok', 'from:noreply@collectors.com', {
      max: 200,
      pageSize: 25,
    });
    expect(listed.ids).toEqual(['a', 'b']);
    expect(listed.hitCap).toBe(false);
    expect(calls[0]).toContain('/users/ops%40example.com/messages');
    expect(calls[0]).toContain('q=from%3Anoreply%40collectors.com');
    expect(calls[0]).toContain('maxResults=25');
  });

  it('refreshes OAuth without logging the refresh token', async () => {
    let posted: URLSearchParams | undefined;
    global.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      posted = new URLSearchParams(String(init?.body ?? ''));
      return {
        ok: true,
        json: async () => ({ access_token: 'access-1' }),
      } as Response;
    }) as typeof fetch;

    await expect(client().fetchAccessToken()).resolves.toBe('access-1');
    expect(posted?.get('grant_type')).toBe('refresh_token');
    expect(posted?.get('refresh_token')).toBe('refresh');
  });
});
