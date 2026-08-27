import { CollectionService } from './collection.service';

describe('CollectionService.escapeIlike', () => {
  it('escapes LIKE wildcards and backslashes', () => {
    expect(CollectionService.escapeIlike('100%_raw\\')).toBe(
      '100\\%\\_raw\\\\',
    );
  });
});

describe('CollectionService.buildCollectionSearchSql', () => {
  it('does not substring-match PSA certs for short digit queries', () => {
    const { sql, params } = CollectionService.buildCollectionSearchSql('123');
    expect(sql).not.toContain('psa_cert_number');
    expect(params.cardNumPat).toBe('123%');
    expect(params.hashPat).toBe('%#123%');
  });

  it('prefix-matches certs when the query looks like a PSA cert', () => {
    const { sql, params } =
      CollectionService.buildCollectionSearchSql('159806544');
    expect(sql).toContain('psa_cert_number');
    expect(params.certPat).toBe('159806544%');
  });

  it('searches names without cert ILIKE for text queries', () => {
    const { sql } = CollectionService.buildCollectionSearchSql('charizard');
    expect(sql).toContain('cardName');
    expect(sql).not.toContain('psa_cert_number');
    expect(sql).not.toContain('psaBrand');
  });
});

describe('CollectionService.scoreCollectionSearchHit', () => {
  it('scores exact card name above set substring', () => {
    const nameHit = CollectionService.scoreCollectionSearchHit('charizard', {
      displayLabel: 'x',
      queryUsed: null,
      components: { cardName: 'Charizard' },
    });
    const setHit = CollectionService.scoreCollectionSearchHit('charizard', {
      displayLabel: 'x',
      queryUsed: null,
      components: { cardSet: 'Charizard ex' },
    });
    expect(nameHit).toBeGreaterThan(setHit);
  });

  it('scores cert prefix highest for long digit queries', () => {
    const cert = CollectionService.scoreCollectionSearchHit('159806544', {
      displayLabel: 'x',
      queryUsed: null,
      components: { psaCertNumber: '159806544', cardName: 'Pikachu' },
    });
    const name = CollectionService.scoreCollectionSearchHit('159806544', {
      displayLabel: 'x',
      queryUsed: null,
      components: { cardName: '159806544' },
    });
    expect(cert).toBeGreaterThan(name);
  });
});

describe('CollectionService.buildTokenSearchSql', () => {
  it('prefix-matches token certs for digit queries including short ones', () => {
    const { sql, params } = CollectionService.buildTokenSearchSql('123');
    expect(sql).toContain('certNumber');
    expect(params.certPat).toBe('123%');
  });

  it('matches token display names for text queries', () => {
    const { sql, params } = CollectionService.buildTokenSearchSql('charizard');
    expect(sql).toContain('displayName');
    expect(params.pat).toBe('%charizard%');
  });
});
