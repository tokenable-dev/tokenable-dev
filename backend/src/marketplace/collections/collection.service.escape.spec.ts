import { CollectionService } from './collection.service';

describe('CollectionService.escapeIlike', () => {
  it('escapes LIKE wildcards and backslashes', () => {
    expect(CollectionService.escapeIlike('100%_raw\\')).toBe(
      '100\\%\\_raw\\\\',
    );
  });
});
