import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

/** Opt-in infra — keep tables even when webhook/delta flags are off. */
const CARDHEDGER_PRICE_INFRA_TABLES = [
  'cardhedger_price_subscriptions',
  'cardhedger_price_delta_checkpoints',
  'cardhedger_daily_price_export_runs',
  'cardhedger_price_delta_import_runs',
] as const;

function listFilesRecursive(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      out.push(...listFilesRecursive(full));
    } else {
      out.push(full);
    }
  }
  return out;
}

function dropTableTargets(sql: string): string[] {
  const names: string[] = [];
  const re =
    /DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:public\.)?([a-zA-Z_][a-zA-Z0-9_]*)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql))) {
    names.push(m[1].toLowerCase());
  }
  return names;
}

describe('Cardhedger price infra tables', () => {
  const sqlRoot = join(__dirname, '../../sql');

  it('schema + maintenance SQL never DROP price-infra tables', () => {
    expect(existsSync(sqlRoot)).toBe(true);
    const dropped = new Set<string>();
    for (const file of listFilesRecursive(sqlRoot).filter((f) =>
      f.endsWith('.sql'),
    )) {
      for (const name of dropTableTargets(readFileSync(file, 'utf8'))) {
        dropped.add(name);
      }
    }
    for (const table of CARDHEDGER_PRICE_INFRA_TABLES) {
      expect(dropped.has(table)).toBe(false);
    }
  });

  it('legacy drop script does not name price-infra tables', () => {
    const sql = readFileSync(
      join(sqlRoot, 'maintenance/drop_legacy_unused_tables.sql'),
      'utf8',
    );
    for (const table of CARDHEDGER_PRICE_INFRA_TABLES) {
      expect(sql).not.toContain(table);
    }
  });

  it('marketplace reset truncates subscriptions only — not audit or top100', () => {
    const sql = readFileSync(
      join(sqlRoot, 'maintenance/reset_marketplace_data.sql'),
      'utf8',
    );
    expect(sql).toMatch(/TRUNCATE TABLE cardhedger_price_subscriptions/i);
    expect(sql).not.toMatch(
      /TRUNCATE TABLE cardhedger_price_delta_checkpoints/i,
    );
    expect(sql).not.toMatch(
      /TRUNCATE TABLE cardhedger_price_delta_import_runs/i,
    );
    expect(sql).not.toMatch(
      /TRUNCATE TABLE cardhedger_daily_price_export_runs/i,
    );
    expect(sql).not.toMatch(/TRUNCATE TABLE card_top100_daily_snapshots/i);
    expect(dropTableTargets(sql)).toEqual([]);
  });
});
