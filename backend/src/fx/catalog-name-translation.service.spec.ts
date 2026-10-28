import { CatalogNameTranslationService } from './catalog-name-translation.service';

describe('CatalogNameTranslationService', () => {
  const original = global.fetch;

  afterEach(() => {
    global.fetch = original;
  });

  it('caches a translation and does not call upstream twice', async () => {
    const fetchMock = jest.fn(async () => ({
      ok: true,
      json: async () => [[['モンキー・D・ルフィ', 'Monkey D. Luffy']]],
    }));
    global.fetch = fetchMock as unknown as typeof fetch;
    const service = new CatalogNameTranslationService();

    const first = await service.translate('ja', ['Monkey D. Luffy', 'Monkey D. Luffy']);
    const second = await service.translate('ja', ['Monkey D. Luffy']);

    expect(first).toEqual({ 'Monkey D. Luffy': 'モンキー・D・ルフィ' });
    expect(second).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('keeps the source string when upstream fails', async () => {
    global.fetch = jest.fn(async () => {
      throw new Error('down');
    }) as unknown as typeof fetch;
    const service = new CatalogNameTranslationService();

    await expect(service.translate('zh-CN', ['Shohei Ohtani'])).resolves.toEqual({
      'Shohei Ohtani': 'Shohei Ohtani',
    });
  });
});
