import { BadRequestException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { DataSource } from 'typeorm';
import { DataInventoryService } from './data-inventory.service';

describe('DataInventoryService.getTableRows', () => {
  function makeService(opts?: {
    exists?: boolean;
    columns?: { column_name: string; data_type: string }[];
    rows?: Record<string, unknown>[];
  }) {
    const exists = opts?.exists ?? true;
    const columns = opts?.columns ?? [
      { column_name: 'id', data_type: 'uuid' },
      { column_name: 'password_hash', data_type: 'text' },
      { column_name: 'email', data_type: 'text' },
    ];
    const dataRows = opts?.rows ?? [
      { id: '1', password_hash: 'secret', email: 'a@b.c' },
    ];

    const query = jest.fn(async (sql: string) => {
      if (sql.includes('to_regclass')) {
        return [{ reg: exists ? 'public.users' : null }];
      }
      if (sql.includes('COUNT(*)')) {
        return [{ n: dataRows.length }];
      }
      if (sql.includes('information_schema.columns')) {
        return columns;
      }
      if (sql.includes('SELECT * FROM')) {
        return dataRows;
      }
      return [];
    });

    const dataSource = {
      query,
      transaction: jest.fn(),
    } as unknown as DataSource;

    const config = {
      get: jest.fn(() => false),
    } as unknown as ConfigService;

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
      dataSource,
      config,
    );

    return { service };
  }

  it('rejects invalid table names', async () => {
    const { service } = makeService();
    await expect(service.getTableRows('Users;drop', 1, 50)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('redacts sensitive columns', async () => {
    const { service } = makeService();
    const result = await service.getTableRows('users', 1, 50);
    expect(result.rows[0]?.password_hash).toBe('[REDACTED]');
    expect(result.rows[0]?.email).toBe('a@b.c');
    expect(result.redactedColumns).toContain('password_hash');
  });
});
