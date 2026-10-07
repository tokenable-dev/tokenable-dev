import { existsSync, readFileSync } from 'fs';
import sharp from 'sharp';
import { resolveRepoPublicPath } from '../../repo-public-assets.util';

/** Gmail-safe badge: solid tile + icon (no rgba/CSS — clients strip nested backgrounds). */
const BADGE_SIZE = 40;
const ICON_SIZE = 22;
const ICON_PAD = Math.floor((BADGE_SIZE - ICON_SIZE) / 2);
/** ~5% white on #101016 */
const BADGE_BG = '#1a1c26';

const ICON_AUTH_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M18.3239 1.8324H3.66479V3.66478H18.3239V1.8324Z" fill="#E9EEFB"/><path d="M3.66478 3.66479H1.8324V12.8267H3.66478V3.66479Z" fill="#E9EEFB"/><path d="M20.1574 3.66498H18.325V12.8269H20.1574V3.66498Z" fill="#E9EEFB"/><path d="M5.49718 12.8275H3.66479V14.6599H5.49718V12.8275Z" fill="#E9EEFB"/><path d="M7.32988 14.66H5.4975V16.4924H7.32988V14.66Z" fill="#E9EEFB"/><path d="M12.8272 18.325H9.16248V20.1574H12.8272V18.325Z" fill="#E9EEFB"/><path d="M16.4921 12.8275H18.3245V14.6599H16.4921V12.8275Z" fill="#E9EEFB"/><path d="M14.6601 14.66H16.4925V16.4924H14.6601V14.66Z" fill="#E9EEFB"/><path d="M12.8272 16.4925H14.6595V18.3249H12.8272V16.4925Z" fill="#E9EEFB"/><path d="M7.33009 16.4925H9.16248V18.3249H7.33009V16.4925Z" fill="#E9EEFB"/></svg>`;

const ICON_VAULT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M19.2411 1.8324H2.7486V3.6649H19.2411V1.8324Z" fill="#E9EEFB"/><path d="M19.2413 6.41376H2.74878V8.24626H19.2413V6.41376Z" fill="#E9EEFB"/><path d="M2.74858 3.66479H0.916199V6.41337H2.74858V3.66479Z" fill="#E9EEFB"/><path d="M21.0737 3.66498H19.2413V6.41355H21.0737V3.66498Z" fill="#E9EEFB"/><path d="M19.2411 8.24628H17.4088V18.3244H19.2411V8.24628Z" fill="#E9EEFB"/><path d="M4.58116 8.24628H2.74878V18.3244H4.58116V8.24628Z" fill="#E9EEFB"/><path d="M17.4079 18.325H4.58124V20.1574H17.4079V18.325Z" fill="#E9EEFB"/><path d="M13.7434 10.0787H8.24628V11.9111H13.7434V10.0787Z" fill="#E9EEFB"/></svg>`;

const ICON_SETTLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M3.6649 11.9112H10.9949V17.4087H12.8274V19.2412H10.9949V21.0737H9.1624V13.7437H1.8324V10.0787H3.6649V11.9112ZM14.6599 17.4087H12.8274V15.5762H14.6599V17.4087ZM16.4924 15.5762H14.6599V13.7437H16.4924V15.5762ZM18.3249 13.7437H16.4924V11.9112H18.3249V13.7437ZM12.8274 8.2462H20.1574V11.9112H18.3249V10.0787H10.9949V4.5812H9.1624V2.7487H10.9949V0.916199H12.8274V8.2462ZM5.4974 10.0787H3.6649V8.2462H5.4974V10.0787ZM7.3299 8.2462H5.4974V6.4137H7.3299V8.2462ZM9.1624 6.4137H7.3299V4.5812H9.1624V6.4137Z" fill="#E9EEFB"/></svg>`;

function badgeBackgroundSvg(): Buffer {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${BADGE_SIZE}" height="${BADGE_SIZE}"><rect width="${BADGE_SIZE}" height="${BADGE_SIZE}" rx="9" fill="${BADGE_BG}"/></svg>`,
    'utf8',
  );
}

async function svgToFeatureBadgePng(iconSvg: string): Promise<Buffer> {
  const icon = await sharp(Buffer.from(iconSvg, 'utf8'))
    .resize(ICON_SIZE, ICON_SIZE)
    .png()
    .toBuffer();
  const tile = await sharp(badgeBackgroundSvg())
    .resize(BADGE_SIZE, BADGE_SIZE)
    .png()
    .toBuffer();
  return sharp(tile)
    .composite([{ input: icon, top: ICON_PAD, left: ICON_PAD }])
    .png()
    .toBuffer();
}

function readFeatureIconFile(name: string): Buffer | null {
  const filePath =
    resolveRepoPublicPath('frontend', 'public', 'assets', 'email', name) ??
    resolveRepoPublicPath('public', 'assets', 'email', name);
  if (!filePath || !existsSync(filePath)) return null;
  const buf = readFileSync(filePath);
  return buf.length > 0 ? buf : null;
}

export async function buildWelcomeFeatureAuthPng(): Promise<Buffer> {
  return svgToFeatureBadgePng(ICON_AUTH_SVG);
}

export async function buildWelcomeFeatureVaultPng(): Promise<Buffer> {
  return svgToFeatureBadgePng(ICON_VAULT_SVG);
}

export async function buildWelcomeFeatureSettlePng(): Promise<Buffer> {
  return svgToFeatureBadgePng(ICON_SETTLE_SVG);
}

export function tryReadWelcomeFeatureAuthPng(): Buffer | null {
  return readFeatureIconFile('welcome-feature-auth.png');
}

export function tryReadWelcomeFeatureVaultPng(): Buffer | null {
  return readFeatureIconFile('welcome-feature-vault.png');
}

export function tryReadWelcomeFeatureSettlePng(): Buffer | null {
  return readFeatureIconFile('welcome-feature-settle.png');
}

/** HTML `img src` without MIME attachments (small badge PNGs). */
export async function welcomeFeatureIconDataUriSrcs(): Promise<{
  featureAuthIconSrc: string;
  featureVaultIconSrc: string;
  featureSettleIconSrc: string;
}> {
  const [auth, vault, settle] = await Promise.all([
    buildWelcomeFeatureAuthPng(),
    buildWelcomeFeatureVaultPng(),
    buildWelcomeFeatureSettlePng(),
  ]);
  const toDataUri = (buf: Buffer) =>
    `data:image/png;base64,${buf.toString('base64')}`;
  return {
    featureAuthIconSrc: toDataUri(auth),
    featureVaultIconSrc: toDataUri(vault),
    featureSettleIconSrc: toDataUri(settle),
  };
}
