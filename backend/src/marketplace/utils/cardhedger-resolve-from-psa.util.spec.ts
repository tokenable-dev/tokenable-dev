import {
  pickCardhedgerRowFromSearchResults,
} from './cardhedger-resolve-from-psa.util';

describe('pickCardhedgerRowFromSearchResults — Pink vs Pink Refractor', () => {
  const pinkOnly = {
    card_id: 'ch_pink',
    variant: 'Pink',
    description: 'Shohei Ohtani 2023 Topps Chrome Baseball Pink',
    name: 'Shohei Ohtani',
    number: '17',
  };
  const pinkRefractor = {
    card_id: 'ch_pink_ref',
    variant: 'Pink Refractor',
    description: 'Shohei Ohtani 2023 Topps Chrome Baseball Pink Refractor',
    name: 'Shohei Ohtani',
    number: '17',
  };

  const hints = {
    psaSubject: 'SHOHEI OHTANI',
    psaBrand: 'TOPPS CHROME',
    psaYear: '2023',
    cardNumber: '17',
    cardName: 'SHOHEI OHTANI',
    psaVariety: 'PINK REFRACTOR',
  };

  it('selects Pink Refractor for PSA PINK REFRACTOR when both rows appear', () => {
    const picked = pickCardhedgerRowFromSearchResults(
      [pinkOnly, pinkRefractor],
      hints,
    );
    expect(picked?.cardId).toBe('ch_pink_ref');
  });

  it('selects Pink for PSA PINK only', () => {
    const picked = pickCardhedgerRowFromSearchResults(
      [pinkOnly, pinkRefractor],
      { ...hints, psaVariety: 'PINK' },
    );
    expect(picked?.cardId).toBe('ch_pink');
  });

  it('returns null for PSA PINK REFRACTOR when only Pink row exists', () => {
    const picked = pickCardhedgerRowFromSearchResults([pinkOnly], hints);
    expect(picked).toBeNull();
  });
});
