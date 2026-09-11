import { PsaSpecPopulationCaptureService } from './psa-spec-population-capture.service';

describe('PsaSpecPopulationCaptureService', () => {
  const collections = {
    createQueryBuilder: jest.fn(),
  };
  const psaPublicApi = {
    getSpecPopulation: jest.fn(),
  };

  const service = new PsaSpecPopulationCaptureService(
    psaPublicApi as never,
    collections as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function qbReturning(
    rows: Array<{ components: Record<string, unknown> }>,
  ) {
    collections.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(rows),
    });
  }

  it('reuses complete Grade1–10 from sibling collection components', async () => {
    const byGrade: Record<string, number> = {};
    for (let g = 1; g <= 10; g++) byGrade[String(g)] = g * 10;
    qbReturning([
      {
        components: {
          psaSpecId: '284890',
          psaPopulationByGrade: byGrade,
          psaSpecTotalPopulation: 550,
          psaGrade10Population: 100,
        },
      },
    ]);

    const capture = await service.captureForSpecId(284890);
    expect(capture?.source).toBe('components_cache');
    expect(capture?.total).toBe(550);
    expect(capture?.byGrade['10']).toBe(100);
    expect(psaPublicApi.getSpecPopulation).not.toHaveBeenCalled();
  });

  it('calls PSA when no complete cache exists', async () => {
    qbReturning([]);
    const byGrade: Record<string, number> = {};
    for (let g = 1; g <= 10; g++) byGrade[String(g)] = g;
    psaPublicApi.getSpecPopulation.mockResolvedValue({
      status: 'success',
      specId: '99',
      pop: { total: 55, grade10: 10, byGrade },
      raw: {},
    });

    const capture = await service.captureForSpecId('99');
    expect(capture?.source).toBe('psa_api');
    expect(capture?.total).toBe(55);
    expect(capture?.byGrade['10']).toBe(10);
    expect(psaPublicApi.getSpecPopulation).toHaveBeenCalledWith('99');
  });

  it('returns null for invalid SpecID', async () => {
    await expect(service.captureForSpecId('')).resolves.toBeNull();
    expect(psaPublicApi.getSpecPopulation).not.toHaveBeenCalled();
  });
});
