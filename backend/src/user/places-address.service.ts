import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type PlacesSuggestion = {
  placeId: string;
  main: string;
  sec: string;
};

export type PlacesAddressDetails = {
  placeId: string;
  main: string;
  sec: string;
  line1: string;
  line2: string;
  city: string;
  region: string;
  postal: string;
  country: 'us' | 'ca' | 'intl';
  countryIso2: string;
  phoneDial: string;
  blocked: boolean;
  blockedName: string | null;
};

/** Insured vault packages — same list as design-system `tk-address.js`. */
export const UNDELIVERABLE_ISO2: Record<string, string> = {
  TH: 'Thailand',
  RU: 'Russia',
  BY: 'Belarus',
};

const MOCK_PLACES: PlacesAddressDetails[] = [
  {
    placeId: 'p1',
    main: '1600 Pennsylvania Avenue NW',
    sec: 'Washington, DC 20500, USA',
    line1: '1600 Pennsylvania Avenue NW',
    line2: '',
    city: 'Washington',
    region: 'DC',
    postal: '20500',
    country: 'us',
    countryIso2: 'US',
    phoneDial: '+1',
    blocked: false,
    blockedName: null,
  },
  {
    placeId: 'p2',
    main: '350 Fifth Avenue',
    sec: 'New York, NY 10118, USA',
    line1: '350 Fifth Avenue',
    line2: '',
    city: 'New York',
    region: 'NY',
    postal: '10118',
    country: 'us',
    countryIso2: 'US',
    phoneDial: '+1',
    blocked: false,
    blockedName: null,
  },
  {
    placeId: 'p3',
    main: '1 Apple Park Way',
    sec: 'Cupertino, CA 95014, USA',
    line1: '1 Apple Park Way',
    line2: '',
    city: 'Cupertino',
    region: 'CA',
    postal: '95014',
    country: 'us',
    countryIso2: 'US',
    phoneDial: '+1',
    blocked: false,
    blockedName: null,
  },
  {
    placeId: 'p4',
    main: '221B Baker Street',
    sec: 'London NW1 6XE, United Kingdom',
    line1: '221B Baker Street',
    line2: '',
    city: 'London',
    region: 'Greater London',
    postal: 'NW1 6XE',
    country: 'intl',
    countryIso2: 'GB',
    phoneDial: '+44',
    blocked: false,
    blockedName: null,
  },
  {
    placeId: 'p5',
    main: '1 Chome-1-2 Oshiage',
    sec: 'Sumida City, Tokyo 131-0045, Japan',
    line1: '1 Chome-1-2 Oshiage',
    line2: '',
    city: 'Sumida City',
    region: 'Tokyo',
    postal: '131-0045',
    country: 'intl',
    countryIso2: 'JP',
    phoneDial: '+81',
    blocked: false,
    blockedName: null,
  },
  {
    placeId: 'p6',
    main: '29 Seolleung-ro 152-gil',
    sec: 'Gangnam-gu, Seoul 06021, South Korea',
    line1: '29 Seolleung-ro 152-gil',
    line2: '',
    city: 'Gangnam-gu',
    region: 'Seoul',
    postal: '06021',
    country: 'intl',
    countryIso2: 'KR',
    phoneDial: '+82',
    blocked: false,
    blockedName: null,
  },
  {
    placeId: 'p7',
    main: 'Friedrichstraße 43',
    sec: '10117 Berlin, Germany',
    line1: 'Friedrichstraße 43',
    line2: '',
    city: 'Berlin',
    region: 'Berlin',
    postal: '10117',
    country: 'intl',
    countryIso2: 'DE',
    phoneDial: '+49',
    blocked: false,
    blockedName: null,
  },
  {
    placeId: 'p8',
    main: 'Sukhumvit Road 199',
    sec: 'Khlong Toei, Bangkok 10110, Thailand',
    line1: 'Sukhumvit Road 199',
    line2: '',
    city: 'Bangkok',
    region: 'Krung Thep',
    postal: '10110',
    country: 'intl',
    countryIso2: 'TH',
    phoneDial: '+66',
    blocked: true,
    blockedName: 'Thailand',
  },
];

const ISO2_TO_DIAL: Record<string, string> = {
  US: '+1',
  CA: '+1',
  GB: '+44',
  JP: '+81',
  KR: '+82',
  CN: '+86',
  HK: '+852',
  TW: '+886',
  SG: '+65',
  AU: '+61',
  NZ: '+64',
  DE: '+49',
  FR: '+33',
  IT: '+39',
  ES: '+34',
  NL: '+31',
  CH: '+41',
  SE: '+46',
  NO: '+47',
  DK: '+45',
  FI: '+358',
  PT: '+351',
  IE: '+353',
  BE: '+32',
  AT: '+43',
  PL: '+48',
  CZ: '+420',
  HU: '+36',
  GR: '+30',
  TR: '+90',
  RU: '+7',
  BY: '+375',
  SA: '+966',
  AE: '+971',
  IL: '+972',
  IN: '+91',
  ID: '+62',
  TH: '+66',
  VN: '+84',
  PH: '+63',
  MY: '+60',
  MX: '+52',
  BR: '+55',
  AR: '+54',
  CL: '+56',
  CO: '+57',
  ZA: '+27',
};

type AddressComponent = {
  longText?: string;
  shortText?: string;
  types?: string[];
};

function shippingCountryFromIso(iso: string): 'us' | 'ca' | 'intl' {
  if (iso === 'US') return 'us';
  if (iso === 'CA') return 'ca';
  return 'intl';
}

function component(
  parts: AddressComponent[],
  type: string,
  short = false,
): string {
  const hit = parts.find((p) => (p.types ?? []).includes(type));
  if (!hit) return '';
  const text = short ? hit.shortText || hit.longText : hit.longText || hit.shortText;
  return (text ?? '').trim();
}

export function parseGoogleAddressComponents(
  parts: AddressComponent[],
  formattedAddress: string,
  placeId: string,
): PlacesAddressDetails {
  const iso = component(parts, 'country', true).toUpperCase();
  const streetNumber = component(parts, 'street_number', true);
  const route = component(parts, 'route');
  const line1 = [streetNumber, route].filter(Boolean).join(' ').trim()
    || formattedAddress.split(',')[0]?.trim()
    || '';
  const line2 = component(parts, 'subpremise');
  const city =
    component(parts, 'locality') ||
    component(parts, 'postal_town') ||
    component(parts, 'sublocality_level_1');
  const regionShort = iso === 'US' || iso === 'CA';
  const region =
    component(parts, 'administrative_area_level_1', regionShort) ||
    component(parts, 'administrative_area_level_1');
  const postal = component(parts, 'postal_code');
  const blockedName = UNDELIVERABLE_ISO2[iso] ?? null;
  const main = line1 || formattedAddress;
  const sec = formattedAddress;
  return {
    placeId,
    main,
    sec,
    line1,
    line2,
    city,
    region,
    postal,
    country: shippingCountryFromIso(iso),
    countryIso2: iso || 'US',
    phoneDial: ISO2_TO_DIAL[iso] || '+1',
    blocked: Boolean(blockedName),
    blockedName,
  };
}

@Injectable()
export class PlacesAddressService {
  private readonly logger = new Logger(PlacesAddressService.name);

  constructor(private readonly config: ConfigService) {}

  private apiKey(): string {
    return (this.config.get<string>('GOOGLE_PLACES_API_KEY') ?? '').trim();
  }

  private useLive(): boolean {
    return this.apiKey().length > 0;
  }

  isEnabled(): boolean {
    if (this.useLive()) return true;
    return this.config.get<string>('NODE_ENV') !== 'production';
  }

  async suggest(
    q: string,
    sessionToken?: string,
  ): Promise<{ enabled: boolean; suggestions: PlacesSuggestion[] }> {
    const enabled = this.isEnabled();
    const query = q.trim();
    if (!enabled || query.length < 2) {
      return { enabled, suggestions: [] };
    }
    if (!this.useLive()) {
      const s = query.toLowerCase();
      return {
        enabled: true,
        suggestions: MOCK_PLACES.filter((p) =>
          `${p.main} ${p.sec}`.toLowerCase().includes(s),
        )
          .slice(0, 5)
          .map((p) => ({
            placeId: p.placeId,
            main: p.main,
            sec: p.sec,
          })),
      };
    }

    const body: Record<string, unknown> = { input: query };
    if (sessionToken?.trim()) body.sessionToken = sessionToken.trim();

    const res = await fetch(
      'https://places.googleapis.com/v1/places:autocomplete',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': this.apiKey(),
        },
        body: JSON.stringify(body),
      },
    );
    if (!res.ok) {
      this.logger.warn(`Places autocomplete failed (${res.status})`);
      return { enabled: true, suggestions: [] };
    }
    const data = (await res.json()) as {
      suggestions?: Array<{
        placePrediction?: {
          placeId?: string;
          structuredFormat?: {
            mainText?: { text?: string };
            secondaryText?: { text?: string };
          };
          text?: { text?: string };
        };
      }>;
    };
    const suggestions: PlacesSuggestion[] = [];
    for (const row of data.suggestions ?? []) {
      const pred = row.placePrediction;
      const placeId = pred?.placeId?.replace(/^places\//, '');
      if (!pred || !placeId) continue;
      const main =
        pred.structuredFormat?.mainText?.text?.trim() ||
        pred.text?.text?.trim() ||
        '';
      const sec = pred.structuredFormat?.secondaryText?.text?.trim() || '';
      if (!main) continue;
      suggestions.push({ placeId, main, sec });
      if (suggestions.length >= 5) break;
    }
    return { enabled: true, suggestions };
  }

  async details(
    placeIdRaw: string,
    sessionToken?: string,
  ): Promise<PlacesAddressDetails | null> {
    const placeId = placeIdRaw.replace(/^places\//, '').trim();
    if (!placeId) return null;

    if (!this.useLive()) {
      return MOCK_PLACES.find((p) => p.placeId === placeId) ?? null;
    }

    const params = new URLSearchParams();
    if (sessionToken?.trim()) params.set('sessionToken', sessionToken.trim());
    const qs = params.toString();
    const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}${qs ? `?${qs}` : ''}`;
    const res = await fetch(url, {
      headers: {
        'X-Goog-Api-Key': this.apiKey(),
        'X-Goog-FieldMask': 'id,formattedAddress,addressComponents',
      },
    });
    if (!res.ok) {
      this.logger.warn(`Places details failed (${res.status})`);
      return null;
    }
    const data = (await res.json()) as {
      id?: string;
      formattedAddress?: string;
      addressComponents?: AddressComponent[];
    };
    return parseGoogleAddressComponents(
      data.addressComponents ?? [],
      data.formattedAddress ?? '',
      data.id?.replace(/^places\//, '') || placeId,
    );
  }
}
