import { CollectionComponentsService } from './collection-components.service';

describe('CollectionComponentsService.ensurePsaSpecPopulationFromApi', () => {
  const byGrade: Record<string, number> = {};
  for (let g = 1; g <= 10; g++) byGrade[String(g)] = g * 10;

  function makeService(opts: {
    row: { components: Record<string, unknown> } | null;
    capture: {
      specId: string;
      byGrade: Record<string, number>;
      grade10: number;
      total: number;
      source: 'components_cache' | 'psa_api';
    } | null;
  }) {
    const collectionRepo = {
      findOne: jest.fn().mockResolvedValue(opts.row),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const specPopCapture = {
      captureForSpecId: jest.fn().mockResolvedValue(opts.capture),
    };
    const svc = new CollectionComponentsService(
      collectionRepo as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      specPopCapture as never,
    );
    return { svc, collectionRepo, specPopCapture };
  }

  it('no-ops without allowUpstream (marketplace read path)', async () => {
    const { svc, collectionRepo, specPopCapture } = makeService({
      row: { components: { psaSpecId: '1' } },
      capture: null,
    });
    await svc.ensurePsaSpecPopulationFromApi('abc');
    expect(collectionRepo.findOne).not.toHaveBeenCalled();
    expect(specPopCapture.captureForSpecId).not.toHaveBeenCalled();
  });

  it('writes Spec pop onto components when missing', async () => {
    const { svc, collectionRepo, specPopCapture } = makeService({
      row: { components: { psaSpecId: '284890' } },
      capture: {
        specId: '284890',
        byGrade,
        grade10: 100,
        total: 550,
        source: 'psa_api',
      },
    });
    await svc.ensurePsaSpecPopulationFromApi('abc', { allowUpstream: true });
    expect(specPopCapture.captureForSpecId).toHaveBeenCalledWith('284890');
    expect(collectionRepo.update).toHaveBeenCalledWith(
      { collectionKey: 'abc' },
      expect.objectContaining({
        components: expect.objectContaining({
          psaSpecId: '284890',
          psaPopulationByGrade: byGrade,
          psaSpecTotalPopulation: 550,
          psaGrade10Population: 100,
        }),
      }),
    );
  });

  it('skips when Grade1–10 already complete', async () => {
    const { svc, specPopCapture, collectionRepo } = makeService({
      row: {
        components: {
          psaSpecId: '284890',
          psaPopulationByGrade: byGrade,
          psaSpecTotalPopulation: 550,
          psaGrade10Population: 100,
        },
      },
      capture: null,
    });
    await svc.ensurePsaSpecPopulationFromApi('abc', { allowUpstream: true });
    expect(specPopCapture.captureForSpecId).not.toHaveBeenCalled();
    expect(collectionRepo.update).not.toHaveBeenCalled();
  });
});
