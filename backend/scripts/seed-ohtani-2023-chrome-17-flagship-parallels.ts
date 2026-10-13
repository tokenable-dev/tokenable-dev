/**
 * Dev QA: create one marketplace collection per Cardhedger flagship SKU for
 * 2023 Topps Chrome Shohei Ohtani #17 (Base Set parallels).
 *
 *   cd backend && pnpm exec ts-node -r tsconfig-paths/register scripts/seed-ohtani-2023-chrome-17-flagship-parallels.ts
 *   ... --dry-run
 */
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { resolveNestLoggerLevels } from '../src/common/logging/nest-logger-options';
import { ChainConfigService } from '../src/blockchain/chain-config.service';
import { CardhedgerService } from '../src/cardhedger/cardhedger.service';
import { CollectionService } from '../src/marketplace/collections/collection.service';
import { computeMarketBucketKey } from '../src/marketplace/utils/bucket-key.util';
import { extractOrDiagnoseBucketComponents } from '../src/marketplace/utils/bucket-key.util';

const logger = new Logger('seed-ohtani-chrome-17');

/** Cardhedger flagship #17 rows (2023 Topps Chrome Baseball, Base Set). */
const FLAGSHIP_SKUS: Array<{
  variant: string;
  cardId: string;
  description: string;
}> = [
  { variant: 'Aqua', cardId: '1689040576444x952211887210303500', description: 'Shohei Ohtani 2023 Topps Chrome Baseball Aqua' },
  { variant: 'Aqua Lava', cardId: '1689040981680x668796050565373200', description: 'Shohei Ohtani 2023 Topps Chrome Baseball Aqua Lava' },
  { variant: 'Base', cardId: '1689015593015x344265088009482600', description: 'Shohei Ohtani 2023 Topps Chrome Baseball' },
  { variant: 'Blue', cardId: '1689041557073x225687718950226000', description: 'Shohei Ohtani 2023 Topps Chrome Baseball Blue' },
  { variant: 'Blue Sonar', cardId: '1689042294297x289494981994125040', description: 'Shohei Ohtani 2023 Topps Chrome Baseball Blue Sonar' },
  { variant: 'Blue Wave', cardId: '1689044284101x665788718625399300', description: 'Shohei Ohtani 2023 Topps Chrome Baseball Blue Wave' },
  { variant: 'Gold', cardId: '1689044748418x192538087381440200', description: 'Shohei Ohtani 2023 Topps Chrome Baseball Gold' },
  { variant: 'Gold Wave Refractor', cardId: '1689045150326x498339738768849300', description: 'Shohei Ohtani 2023 Topps Chrome Baseball Gold Wave Refractor' },
  { variant: 'Green', cardId: '1689042839531x872092278447222300', description: 'Shohei Ohtani 2023 Topps Chrome Baseball Green' },
  { variant: 'Green Sonar', cardId: '1689043783601x617797670051043700', description: 'Shohei Ohtani 2023 Topps Chrome Baseball Green Sonar' },
  { variant: 'Green Wave', cardId: '1689043215513x781430712389846000', description: 'Shohei Ohtani 2023 Topps Chrome Baseball Green Wave' },
  { variant: 'Magenta', cardId: '1689037187853x582471265769531400', description: 'Shohei Ohtani 2023 Topps Chrome Baseball Magenta' },
  { variant: 'Magenta Speckle', cardId: '1689037742045x719801712781634600', description: 'Shohei Ohtani 2023 Topps Chrome Baseball Magenta Speckle' },
  { variant: 'Negative', cardId: '1689036208509x499010474988494000', description: 'Shohei Ohtani 2023 Topps Chrome Baseball Negative' },
  { variant: 'Orange', cardId: '1689045766221x759365025558105700', description: 'Shohei Ohtani 2023 Topps Chrome Baseball Orange' },
  { variant: 'Orange Wave', cardId: '1689046316835x139046957851391310', description: 'Shohei Ohtani 2023 Topps Chrome Baseball Orange Wave' },
  { variant: 'Pink', cardId: '1689035408937x540407672389821900', description: 'Shohei Ohtani 2023 Topps Chrome Baseball Pink' },
  { variant: 'Printing Plates', cardId: '1689048307133x650650747740494100', description: 'Shohei Ohtani 2023 Topps Chrome Baseball Printing Plates' },
  { variant: 'Prism', cardId: '1689019133414x649014997427014800', description: 'Shohei Ohtani 2023 Topps Chrome Baseball Prism' },
  { variant: 'Purple', cardId: '1689039930372x553692922133791900', description: 'Shohei Ohtani 2023 Topps Chrome Baseball Purple' },
  { variant: 'Purple Sonar', cardId: '1689039308834x436875225451227600', description: 'Shohei Ohtani 2023 Topps Chrome Baseball Purple Sonar' },
  { variant: 'Purple Speckle', cardId: '1689038642264x573990664446548030', description: 'Shohei Ohtani 2023 Topps Chrome Baseball Purple Speckle' },
  { variant: 'Red', cardId: '1689046830096x336240630370267840', description: 'Shohei Ohtani 2023 Topps Chrome Baseball Red' },
  { variant: 'Red Wave', cardId: '1689046940102x527593945436406000', description: 'Shohei Ohtani 2023 Topps Chrome Baseball Red Wave' },
  { variant: 'Refractor', cardId: '1689016970553x279178776367428700', description: 'Shohei Ohtani 2023 Topps Chrome Baseball Refractor' },
  { variant: 'Sepia', cardId: '1689020483998x242851930153800120', description: 'Shohei Ohtani 2023 Topps Chrome Baseball Sepia' },
  { variant: 'Sub-Zero Frozenfractor', cardId: '1689047511358x958009902211871400', description: 'Shohei Ohtani 2023 Topps Chrome Baseball Sub-Zero Frozenfractor' },
  { variant: 'Superfractor', cardId: '1689047615637x970047032727983000', description: 'Shohei Ohtani 2023 Topps Chrome Baseball Superfractor' },
  { variant: 'X-Fractor', cardId: '1689018607961x514969478786381630', description: 'Shohei Ohtani 2023 Topps Chrome Baseball X-Fractor' },
];

function chVariantToPsaVariety(variant: string): string {
  const v = variant.trim();
  if (!v || v.toLowerCase() === 'base') return '';
  return v.toUpperCase().replace(/\s+/g, ' ');
}

function buildGradedMeta(
  sku: (typeof FLAGSHIP_SKUS)[number],
  imageUrl: string | null,
): Record<string, unknown> {
  const psaVariety = chVariantToPsaVariety(sku.variant);
  const titleSuffix =
    sku.variant.toLowerCase() === 'base'
      ? ''
      : ` ${sku.variant}`;
  const name = `2023 Topps Chrome Shohei Ohtani${titleSuffix} #17`;
  const graded = {
    gradingCompany: 'PSA',
    gradeScore: 10,
    grade: { score: 10 },
    card: {
      name: 'SHOHEI OHTANI',
      set: 'TOPPS CHROME',
      year: 2023,
      number: '17',
      variant: sku.variant,
    },
    psa: {
      cardNameHint: 'SHOHEI OHTANI',
      setHint: 'TOPPS CHROME',
      brand: 'TOPPS CHROME',
      cardNumberHint: '17',
      year: '2023',
      gradeScore: 10,
      gradeLabel: 'GEM MT 10',
      ...(psaVariety
        ? { variety: psaVariety, Variety: psaVariety }
        : {}),
    },
    cardhedger: {
      cardId: sku.cardId,
      searchQuery: sku.description,
      ...(imageUrl ? { imageUrl } : {}),
    },
  };
  return {
    name,
    description: `Dev catalog matrix row — Cardhedger ${sku.variant} (${sku.cardId})`,
    properties: { graded },
  };
}

type EnsureBucket = (
  meta: Record<string, unknown>,
  opts: {
    step: string;
    chainId?: number;
    linkRwaToken: boolean;
    catalogSource?: string;
  },
) => Promise<{
  collectionKey: string;
  created: boolean;
  displayLabel: string;
  coverImageUrl: string | null;
} | null>;

async function fetchCardImage(
  cardhedger: CardhedgerService,
  cardId: string,
): Promise<string | null> {
  try {
    cardhedger.assertConfigured();
  } catch {
    return null;
  }
  try {
    const body = await cardhedger.forwardJson('POST', '/v1/cards/card-details', {
      body: { card_id: cardId },
    });
    const cards = (body as { cards?: unknown[] }).cards;
    if (!Array.isArray(cards) || cards.length === 0) return null;
    const row = cards[0] as Record<string, unknown>;
    const img = typeof row.image === 'string' ? row.image.trim() : '';
    return img || null;
  } catch {
    return null;
  }
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: resolveNestLoggerLevels(),
  });
  try {
    const collections = app.get(CollectionService);
    const chainConfig = app.get(ChainConfigService);
    const cardhedger = app.get(CardhedgerService);
    const chainId = chainConfig.getDefaultChainId();
    const ensureBucket = (
      collections as unknown as { ensureCollectionBucketFromGradedMeta: EnsureBucket }
    ).ensureCollectionBucketFromGradedMeta.bind(collections);

    const results: Array<{
      variant: string;
      cardId: string;
      collectionKey: string;
      created: boolean;
      displayLabel: string;
      psaVariety: string;
    }> = [];

    for (const sku of FLAGSHIP_SKUS) {
      const imageUrl = await fetchCardImage(cardhedger, sku.cardId);
      const meta = buildGradedMeta(sku, imageUrl);
      const extracted = extractOrDiagnoseBucketComponents(meta);
      if (!extracted.ok) {
        logger.error(
          `Bucket extract failed for ${sku.variant}: ${extracted.code}`,
        );
        continue;
      }
      const collectionKey = computeMarketBucketKey(extracted.components);
      const psaVariety = chVariantToPsaVariety(sku.variant);

      if (dryRun) {
        logger.log(
          `[dry-run] ${sku.variant} -> ${collectionKey} cardId=${sku.cardId}`,
        );
        results.push({
          variant: sku.variant,
          cardId: sku.cardId,
          collectionKey,
          created: false,
          displayLabel: '(dry-run)',
          psaVariety,
        });
        continue;
      }

      const out = await ensureBucket(meta, {
        step: 'seed_ohtani_2023_chrome_17_flagship',
        chainId,
        linkRwaToken: false,
        catalogSource: 'dev_ch_flagship_matrix',
      });
      if (!out) {
        logger.warn(`ensure failed for variant ${sku.variant}`);
        continue;
      }
      results.push({
        variant: sku.variant,
        cardId: sku.cardId,
        collectionKey: out.collectionKey,
        created: out.created,
        displayLabel: out.displayLabel,
        psaVariety,
      });
      logger.log(
        `${out.created ? 'created' : 'exists'} ${sku.variant} key=${out.collectionKey}`,
      );
    }

    const outPath =
      'scripts/seed-ohtani-2023-chrome-17-flagship-parallels.results.json';
    const fs = await import('node:fs');
    fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
    logger.log(`Wrote ${results.length} rows to ${outPath}`);
    console.log('\nvariant | collection_key | created | cardhedger_card_id');
    console.log('---|---|---|---');
    for (const r of results) {
      console.log(
        `${r.variant} | ${r.collectionKey} | ${r.created} | ${r.cardId}`,
      );
    }
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
