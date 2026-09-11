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

  it('pins multiple tags in order then sorts the rest', () => {
    const sorted = sortSwaggerTagsPinFirst(
      [
        { name: 'zebra' },
        { name: 'health' },
        { name: 'privy' },
        { name: 'site-access' },
        { name: 'marketplace' },
      ],
      ['site-access', 'privy', 'health'],
    );
    expect(sorted?.map((t) => t.name)).toEqual([
      'site-access',
      'privy',
      'health',
      'marketplace',
      'zebra',
    ]);
  });
});
