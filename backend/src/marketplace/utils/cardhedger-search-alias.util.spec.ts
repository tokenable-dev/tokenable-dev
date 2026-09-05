import {
  cardhedgerExtraSearchQueries,
  cardhedgerSetAliasTokens,
  hintsLookLikeOnePieceChampionshipStamp,
  hintsLookLikePrizmRookieSignatures,
} from './cardhedger-search-alias.util';

describe('cardhedger-search-alias — Prizm Rookie Signatures', () => {
  const lonnieHints = {
    cardName: 'LONNIE WALKER IV',
    cardNumber: 'RSLW4',
    cardSet: 'PANINI PRIZM ROOKIE SIGNATURES',
    psaBrand: 'PANINI PRIZM ROOKIE SIGNATURES',
    psaSubject: 'LONNIE WALKER IV',
    psaVariety: 'ROOKIE SIGNATURES',
    psaYear: '2018',
  };

  it('detects Prizm Rookie Signatures insert sets', () => {
    expect(hintsLookLikePrizmRookieSignatures(lonnieHints)).toBe(true);
  });

  it('emits Cardhedger-idiomatic basketball search lines', () => {
    const queries = cardhedgerExtraSearchQueries(lonnieHints);
    expect(queries.some((q) => /panini prizm basketball rookie signatures/i.test(q))).toBe(
      true,
    );
    expect(queries.some((q) => q.includes('LONNIE WALKER IV'))).toBe(true);
  });

  it('adds set alias tokens for basketball Prizm matching', () => {
    const tokens = cardhedgerSetAliasTokens(
      lonnieHints.cardSet,
      lonnieHints.psaBrand,
    );
    expect(tokens).toContain('panini prizm basketball');
    expect(tokens).toContain('rookie signatures');
  });
});

describe('cardhedger-search-alias — Japanese Sword & Shield expansions', () => {
  it('aliases PSA EEVEE HEROES brand to Cardhedger set wording', () => {
    const tokens = cardhedgerSetAliasTokens(
      'POKEMON JAPANESE SWORD & SHIELD EEVEE HEROES',
      'POKEMON JAPANESE SWORD & SHIELD EEVEE HEROES',
    );
    expect(tokens).toEqual(
      expect.arrayContaining([
        'sword & shield eevee heroes',
        'eevee heroes',
      ]),
    );
  });
});

describe('cardhedger-search-alias — One Piece championship promos', () => {
  const viviHints = {
    cardName: 'NEFELTARI VIVI',
    cardNumber: '086',
    cardSet: 'ONE PIECE JAPANESE PROMOS',
    psaBrand: 'ONE PIECE JAPANESE PROMOS',
    psaSubject: 'NEFELTARI VIVI',
    psaVariety: 'CHAMPIONSHIP 2024-TOP PRIZE',
    psaYear: '2024',
  };

  it('detects PSA One Piece championship promo stamps', () => {
    expect(hintsLookLikeOnePieceChampionshipStamp(viviHints)).toBe(true);
  });

  it('searches Championship 2024 without a Top Prize token', () => {
    const queries = cardhedgerExtraSearchQueries(viviHints);
    expect(queries.some((q) => /Championship 2024/i.test(q))).toBe(true);
    expect(queries.some((q) => /Top Prize/i.test(q))).toBe(false);
  });

  it('aliases Japanese Promos to One Piece Japanese parent sets', () => {
    const tokens = cardhedgerSetAliasTokens(
      viviHints.cardSet,
      viviHints.psaBrand,
    );
    expect(tokens).toContain('one piece japanese');
  });
});
