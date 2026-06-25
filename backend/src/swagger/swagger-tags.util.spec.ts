import { sortSwaggerTagsPinFirst } from './swagger-tags.util';

describe('sortSwaggerTagsPinFirst', () => {
  it('pins site-access first and sorts the rest alphabetically', () => {
    const sorted = sortSwaggerTagsPinFirst(
      [
        { name: 'marketplace' },
        { name: 'site-access', description: 'gate' },
        { name: 'auth' },
        { name: 'health' },
      ],
      'site-access',
    );
    expect(sorted?.map((t) => t.name)).toEqual([
      'site-access',
      'auth',
      'health',
      'marketplace',
    ]);
  });
});
