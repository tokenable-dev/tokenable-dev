import { readFileSync } from 'node:fs';
import { registerAs } from '@nestjs/config';

export type Ga4ServiceAccountCredentials = {
  client_email: string;
  private_key: string;
  [key: string]: unknown;
};

function parseServiceAccountJson(
  raw: string,
): Ga4ServiceAccountCredentials | null {
  try {
    const parsed = JSON.parse(raw) as Ga4ServiceAccountCredentials;
    if (
      typeof parsed.client_email !== 'string' ||
      typeof parsed.private_key !== 'string'
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function loadCredentials(): Ga4ServiceAccountCredentials | null {
  const inline = process.env.GA4_SERVICE_ACCOUNT_JSON?.trim();
  if (inline) {
    return parseServiceAccountJson(inline);
  }

  const path = process.env.GA4_SERVICE_ACCOUNT_JSON_PATH?.trim();
  if (!path) return null;

  try {
    return parseServiceAccountJson(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

export default registerAs('ga4', () => {
  const propertyId = process.env.GA4_PROPERTY_ID?.trim() ?? '';
  const measurementId = process.env.GA4_MEASUREMENT_ID?.trim() ?? '';
  const credentials = loadCredentials();
  const propertyIdValid = /^\d{5,}$/.test(propertyId);

  return {
    propertyId: propertyIdValid ? propertyId : '',
    measurementId,
    credentials,
    enabled: propertyIdValid && credentials != null,
  };
});
