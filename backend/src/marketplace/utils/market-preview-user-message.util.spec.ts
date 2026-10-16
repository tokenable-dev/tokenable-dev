import {
  sanitizeMarketCollectionPreview,
  sanitizeUserMarketPreviewMessage,
} from './market-preview-user-message.util';

describe('market-preview-user-message.util', () => {
  it('strips vendor-specific preview messages', () => {
    expect(
      sanitizeUserMarketPreviewMessage('No matching Cardhedger card found'),
    ).toBeUndefined();
    expect(
      sanitizeUserMarketPreviewMessage(
        'Cardhedger is not configured (CARDHEDGER_API_KEY)',
      ),
    ).toBeUndefined();
    expect(sanitizeUserMarketPreviewMessage('Collection not found')).toBe(
      'Collection not found',
    );
  });

  it('sanitizeMarketCollectionPreview omits stripped message', () => {
    const out = sanitizeMarketCollectionPreview({
      enabled: true,
      searchQuery: 'test',
      matched: false,
      message: 'No matching Cardhedger card found',
      card: null,
    });
    expect(out.message).toBeUndefined();
  });
});
