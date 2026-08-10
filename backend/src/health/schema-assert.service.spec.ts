import {
  REQUIRED_SCHEMA,
  formatSchemaAssertFailure,
  SchemaAssertService,
} from './schema-assert.service';

describe('SchemaAssertService checklist', () => {
  it('REQUIRED_SCHEMA includes rwa_tokens.vault_partner_id (My Assets metadata)', () => {
    expect(
      REQUIRED_SCHEMA.some(
        (r) =>
          r.kind === 'column' &&
          r.table === 'rwa_tokens' &&
          r.column === 'vault_partner_id',
      ),
    ).toBe(true);
  });

  it('formatSchemaAssertFailure names maintenance files', () => {
    const msg = formatSchemaAssertFailure([
      {
        kind: 'column',
        table: 'rwa_tokens',
        column: 'vault_partner_id',
        fix: 'maintenance/add_rwa_tokens_vault_partner_id.sql',
      },
    ]);
    expect(msg).toContain('rwa_tokens.vault_partner_id');
    expect(msg).toContain('add_rwa_tokens_vault_partner_id.sql');
  });

  it('findMissing returns absent columns', async () => {
    const dataSource = {
      query: jest.fn(async (_sql: string, params: string[]) => {
        if (params[0] === 'rwa_tokens' && params[1] === 'vault_partner_id') {
          return [];
        }
        return [{ ok: 1 }];
      }),
    };
    const svc = new SchemaAssertService(dataSource as never, {
      get: () => undefined,
    } as never);
    const missing = await svc.findMissing([
      {
        kind: 'column',
        table: 'rwa_tokens',
        column: 'settlement_policy',
        fix: 'maintenance/add_rwa_tokens_settlement_policy.sql',
      },
      {
        kind: 'column',
        table: 'rwa_tokens',
        column: 'vault_partner_id',
        fix: 'maintenance/add_rwa_tokens_vault_partner_id.sql',
      },
    ]);
    expect(missing).toHaveLength(1);
    expect(missing[0]).toMatchObject({
      kind: 'column',
      column: 'vault_partner_id',
    });
  });
});
