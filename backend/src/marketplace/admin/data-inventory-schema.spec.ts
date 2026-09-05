import type { ConfigService } from '@nestjs/config';
import type { DataSource } from 'typeorm';
import { DataInventoryService } from './data-inventory.service';

describe('DataInventoryService.getSchema', () => {
  it('marks PK/FK and includes logical marketplace edges', async () => {
    const query = jest.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes("table_type = 'BASE TABLE'")) {
        return [
          { table_name: 'users' },
          { table_name: 'user_wallets' },
          { table_name: 'marketplace_collections' },
          { table_name: 'orders' },
        ];
      }
      if (sql.includes('information_schema.columns')) {
        const table = params?.[0];
        if (table === 'users') {
          return [{ column_name: 'id', data_type: 'uuid' }];
        }
        if (table === 'user_wallets') {
          return [
            { column_name: 'id', data_type: 'uuid' },
            { column_name: 'user_id', data_type: 'uuid' },
          ];
        }
        if (table === 'marketplace_collections') {
          return [{ column_name: 'collection_key', data_type: 'text' }];
        }
        return [
          { column_name: 'id', data_type: 'int' },
          { column_name: 'collection_key', data_type: 'text' },
        ];
      }
      if (sql.includes("constraint_type IN ('PRIMARY KEY'")) {
        return [
          {
            table_name: 'users',
            column_name: 'id',
            constraint_type: 'PRIMARY KEY',
          },
          {
            table_name: 'user_wallets',
            column_name: 'user_id',
            constraint_type: 'FOREIGN KEY',
          },
        ];
      }
      if (sql.includes("constraint_type = 'FOREIGN KEY'")) {
        return [
          {
            from_table: 'user_wallets',
            from_column: 'user_id',
            to_table: 'users',
            to_column: 'id',
          },
        ];
      }
      if (sql.includes('COUNT(*)')) {
        return [{ n: 0 }];
      }
      return [];
    });

    const service = new DataInventoryService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { query } as unknown as DataSource,
      { get: jest.fn() } as unknown as ConfigService,
    );

    const schema = await service.getSchema();
    const wallets = schema.tables.find((t) => t.table === 'user_wallets');
    expect(wallets?.columns.find((c) => c.name === 'user_id')?.foreignKey).toBe(
      true,
    );
    expect(
      schema.edges.some(
        (e) =>
          e.kind === 'fk' &&
          e.fromTable === 'user_wallets' &&
          e.toTable === 'users',
      ),
    ).toBe(true);
    expect(
      schema.edges.some(
        (e) =>
          e.kind === 'logical' &&
          e.fromTable === 'orders' &&
          e.toTable === 'marketplace_collections',
      ),
    ).toBe(true);
  });
});
