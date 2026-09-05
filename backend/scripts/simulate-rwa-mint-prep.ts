/**
 * Dry-run or upload-only simulation of the sell/custody mint prep pipeline.
 *
 * Usage (from backend/):
 *   pnpm exec ts-node -r tsconfig-paths/register scripts/simulate-rwa-mint-prep.ts 151380671
 *   pnpm exec ts-node -r tsconfig-paths/register scripts/simulate-rwa-mint-prep.ts 151380671 --upload
 *
 * Steps:
 *   1. PSA analyze-by-cert (grade policy + slab image URLs)
 *   2. Vault cycle availability check (same as upload)
 *   3. Image download probe (PSA CloudFront preferred)
 *   4. With --upload: POST-equivalent RwaService.uploadToIpfs (Pinata + S3, no on-chain mint)
 *
 * Never calls mintTo unless you pass --mint (not recommended for routine QA).
 */
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ChainConfigService } from '../src/blockchain/chain-config.service';
import {
  mintRejectionMessage,
  psaGradePolicyInputFromGraded,
} from '../src/marketplace/utils/psa-grade-policy.util';
import type { PsaAnalyzeResult } from '../src/psa/psa.service';
import { PsaService } from '../src/psa/psa.service';
import { PinataService } from '../src/rwa/pinata/pinata.service';
import { RwaService } from '../src/rwa/rwa.service';
import { RwaSlabS3Service } from '../src/rwa/rwa-slab-s3.service';
import { VaultService } from '../src/vault/vault.service';

const logger = new Logger('simulate-rwa-mint-prep');

function parseArgs(argv: string[]) {
  const flags = new Set(argv.filter((a) => a.startsWith('--')));
  const positional = argv.filter((a) => !a.startsWith('--'));
  const cert = positional[0]?.trim() || '151380671';
  const chainFlag = argv.find((a) => a.startsWith('--chain-id='));
  const chainId = chainFlag
    ? Number(chainFlag.split('=')[1])
    : Number(process.env.DEFAULT_CHAIN_ID || 11155111);
  return {
    cert,
    chainId,
    upload: flags.has('--upload'),
    mint: flags.has('--mint'),
    dryRun: !flags.has('--upload') && !flags.has('--mint'),
  };
}

function buildGradedMetadata(analyze: PsaAnalyzeResult) {
  const psa = analyze.psa;
  const cardName = psa.cardNameHint?.trim() || 'Unknown card';
  return {
    graded: {
      gradingCompany: 'PSA',
      card: {
        name: cardName,
        set: psa.setHint?.trim() || undefined,
        year: psa.year ? Number(psa.year) : undefined,
        number: psa.cardNumberHint?.trim() || undefined,
      },
      grade: {
        certNumber: psa.certNumber,
        score: psa.gradeScore,
      },
      verification: psa.certVerifyUrl
        ? { certUrl: psa.certVerifyUrl }
        : undefined,
      psa: {
        certNumber: psa.certNumber,
        gradeLabel: psa.gradeLabel,
        gradeScore: psa.gradeScore,
        gradeDescription: psa.gradeDescription,
        certVerifyUrl: psa.certVerifyUrl,
        cardNameHint: psa.cardNameHint,
        setHint: psa.setHint,
        cardNumberHint: psa.cardNumberHint,
        year: psa.year,
        labelType: psa.labelType,
        category: psa.category,
        totalPopulation: psa.totalPopulation,
        populationHigher: psa.populationHigher,
        totalPopulationWithQualifier: psa.totalPopulationWithQualifier,
        reverseBarcode: psa.reverseBarcode,
        specId: psa.specId,
        enrichedFromOfficialApi: psa.enrichedFromOfficialApi,
        ...(analyze.psaCertImages?.front
          ? { certImageSourceUrl: analyze.psaCertImages.front }
          : {}),
        ...(analyze.psaCertImages?.back
          ? { certImageBackUrl: analyze.psaCertImages.back }
          : {}),
        ...(psa.varietyHint?.trim() ? { Variety: psa.varietyHint.trim() } : {}),
      },
      ...(analyze.cardhedgerMint?.cardId
        ? {
            cardhedger: {
              cardId: analyze.cardhedgerMint.cardId,
              ...(analyze.cardhedgerMint.searchQuery
                ? { searchQuery: analyze.cardhedgerMint.searchQuery }
                : {}),
              ...(analyze.cardhedgerMint.imageUrl
                ? { imageUrl: analyze.cardhedgerMint.imageUrl }
                : {}),
            },
          }
        : {}),
    },
    attributes: [
      { trait_type: 'Grading Company', value: 'PSA' },
      { trait_type: 'PSA Cert #', value: psa.certNumber },
      { trait_type: 'Grade', value: String(psa.gradeScore ?? '') },
      { trait_type: 'Card Name', value: cardName },
    ],
    external_url: psa.certVerifyUrl,
  };
}

function pickMintImageUrl(analyze: PsaAnalyzeResult): string | null {
  const cert = analyze.psa.certNumber?.trim();
  const psaFront = analyze.psaCertImages?.front?.trim();
  if (psaFront && cert) return psaFront;
  const ch = analyze.cardhedgerMint?.imageUrl?.trim();
  return ch || null;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  logger.log(
    `cert=${args.cert} chainId=${args.chainId} mode=${
      args.mint ? 'mint' : args.upload ? 'upload' : 'dry-run'
    }`,
  );

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const psa = app.get(PsaService);
    const vault = app.get(VaultService);
    const pinata = app.get(PinataService);
    const rwa = app.get(RwaService);
    const slabS3 = app.get(RwaSlabS3Service);
    const chainConfig = app.get(ChainConfigService);
    const chainId = chainConfig.resolveChainId(String(args.chainId));

    logger.log('Step 1/4 — PSA analyze-by-cert…');
    const analyze = await psa.analyzeByCertNumber(args.cert);
    const gradedPayload = buildGradedMetadata(analyze);
    const gradeReject = mintRejectionMessage(
      psaGradePolicyInputFromGraded(gradedPayload.graded),
    );
    if (gradeReject) {
      throw new Error(`Grade policy rejected mint: ${gradeReject}`);
    }

    const imageUrl = pickMintImageUrl(analyze);
    logger.log(
      `  card: ${analyze.psa.cardNameHint} | grade: ${analyze.psa.gradeLabel} (${analyze.psa.gradeScore})`,
    );
    logger.log(`  psa slab front: ${analyze.psaCertImages?.front ?? '(none)'}`);
    logger.log(`  mint imageUrl: ${imageUrl ?? '(none — would require file upload)'}`);

    logger.log('Step 2/4 — vault cycle availability…');
    try {
      await vault.assertAvailableForNewCycle(args.cert, chainId);
      logger.log('  OK — cert is available for a new vault cycle on this chain');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.warn(`  BLOCKED — ${msg}`);
      if (!args.upload && !args.mint) {
        logger.warn('  (dry-run continues; real upload/mint would fail here)');
      } else {
        throw e;
      }
    }

    logger.log('Step 3/4 — image download + S3 config…');
    logger.log(`  S3 configured: ${slabS3.isConfigured()}`);
    if (!imageUrl) {
      logger.warn('  No HTTPS slab image — upload would fail unless user uploads a file');
    } else {
      try {
        const fetched = await pinata.fetchImageBufferFromUrl(imageUrl);
        logger.log(
          `  Image download OK (${fetched.mimeType}, ${fetched.buffer.length} bytes)`,
        );
        if (args.dryRun && slabS3.isConfigured()) {
          const preview = await slabS3.ingestMintSlabBestEffort({
            chainId,
            certNumber: args.cert,
            buffer: fetched.buffer,
            contentType: fetched.mimeType,
          });
          logger.log(
            `  S3 dry ingest: ${preview ?? '(failed — mint would still proceed with displayImageUrl=null)'}`,
          );
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        logger.error(`  Image download FAILED — upload would abort: ${msg}`);
        if (args.upload || args.mint) throw e;
      }
    }

    if (args.upload) {
      if (!imageUrl) {
        throw new Error('--upload requires a slab imageUrl (PSA or Cardhedger)');
      }
      logger.log('Step 4/4 — RwaService.uploadToIpfs (Pinata + S3, no mint)…');
      const result = await rwa.uploadToIpfs(
        {
          name: `${analyze.psa.cardNameHint ?? 'PSA card'} PSA ${analyze.psa.gradeScore ?? ''}`.trim(),
          description: `PSA cert ${args.cert}`,
          imageUrl,
          gradedMetadata: JSON.stringify(gradedPayload),
        },
        chainId,
      );
      logger.log(`  tokenURI: ${result.tokenURI}`);
      logger.log(`  metadata.image: ${result.metadata.image}`);
      logger.log(`  displayImageUrl: ${result.displayImageUrl ?? '(null)'}`);
      console.log(
        JSON.stringify(
          {
            ok: true,
            cert: args.cert,
            chainId,
            tokenURI: result.tokenURI,
            displayImageUrl: result.displayImageUrl,
            metadataImage: result.metadata.image,
          },
          null,
          2,
        ),
      );
    } else if (args.mint) {
      throw new Error(
        '--mint is intentionally disabled in this script. Use the app or POST /api/rwa/mint after --upload.',
      );
    } else {
      logger.log('Step 4/4 — skipped (dry-run). Pass --upload to run Pinata + S3.');
      console.log(
        JSON.stringify(
          {
            ok: true,
            mode: 'dry-run',
            cert: args.cert,
            chainId,
            grade: analyze.psa.gradeLabel,
            imageUrl,
            s3Configured: slabS3.isConfigured(),
          },
          null,
          2,
        ),
      );
    }
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  logger.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
