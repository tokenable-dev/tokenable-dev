import { resolveInventoryRowCount } from './data-inventory.service';

describe('resolveInventoryRowCount', () => {
  it('uses the planner estimate when it is positive', async () => {
    const countExact = jest.fn(async () => 999);
    await expect(resolveInventoryRowCount(12.7, countExact)).resolves.toBe(12);
    expect(countExact).not.toHaveBeenCalled();
  });

  it('falls back to exact COUNT when the estimate is 0', async () => {
    await expect(resolveInventoryRowCount(0, async () => 4)).resolves.toBe(4);
    await expect(resolveInventoryRowCount(0, async () => 0)).resolves.toBe(0);
  });
});
