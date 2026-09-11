import { Body, Controller, Post, Req } from '@nestjs/common';
import { ApiBody, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { MarketplaceAdminService } from '../../marketplace/admin/marketplace-admin.service';
import { RedeemDeliveryTrackService } from '../redeem-delivery-track.service';
import {
  FedExTrackClient,
  FEDEX_TRACK_PATHS,
  type FedExTrackPathKey,
} from '../shipping/fedex-track.client';

/** Sandbox 12-digit example tracking (prod will use real 12–15 digit FedEx numbers). */
export const FEDEX_SANDBOX_EXAMPLE_TRACKING = '111111111111';

const TRACKING_NUMBERS_EXAMPLE = {
  includeDetailedScans: false,
  trackingInfo: [
    {
      trackingNumberInfo: {
        trackingNumber: FEDEX_SANDBOX_EXAMPLE_TRACKING,
      },
    },
  ],
};

const ASSOCIATED_SHIPMENTS_EXAMPLE = {
  includeDetailedScans: true,
  associatedType: 'STANDARD_MPS',
  masterTrackingNumberInfo: {
    trackingNumberInfo: {
      trackingNumber: '858488600850',
      carrierCode: 'FDXE',
    },
    shipDateBegin: '2018-11-01',
    shipDateEnd: '2018-11-03',
  },
};

const NOTIFICATIONS_EXAMPLE = {
  senderContactName: 'Tokenable Ops',
  senderEMailAddress: 'tokenable.dev@gmail.com',
  trackingNumberInfo: {
    trackingNumber: '874592720570',
  },
  trackingEventNotificationDetail: {
    trackingNotifications: [
      {
        notificationEventTypes: ['ON_DELIVERY'],
        notificationDetail: {
          notificationType: 'HTML',
          emailDetail: {
            emailAddress: 'tokenable.dev@gmail.com',
            locale: 'ko_KR',
          },
        },
      },
    ],
  },
};

const REFERENCES_EXAMPLE = {
  includeDetailedScans: false,
  referencesInformation: {
    type: 'CUSTOMER_REFERENCE',
    value: 'REDEEM-BATCH-123',
    accountNumber: '740561073',
    carrierCode: 'FDXE',
    shipDateBegin: '2026-07-01',
    shipDateEndDate: '2026-07-31',
    destinationCountryCode: 'US',
    destinationPostalCode: '19720',
  },
};

const TCN_EXAMPLE = {
  includeDetailedScans: false,
  tcnInfo: {
    value: 'N552428361Y555XXX',
    carrierCode: 'FDXE',
    shipDateBegin: '2019-02-13',
    shipDateEnd: '2019-02-13',
  },
};

const TRACKING_DOCUMENTS_EXAMPLE = {
  trackDocumentDetail: {
    documentType: 'SIGNATURE_PROOF_OF_DELIVERY',
    documentFormat: 'PDF',
  },
  trackDocumentSpecification: [
    {
      trackingNumberInfo: {
        trackingNumber: '874592720570',
      },
    },
  ],
};

/**
 * Dev/admin FedEx Track probes — passthrough to all Track v1 endpoints.
 * OpenAPI: backend/openapi/fedex-track-v1.openapi.json
 */
@ApiTags('marketplace-admin-fedex')
@ApiCookieAuth('marketplace_admin_session')
@Controller('marketplace/admin/fedex/track')
export class FedexTrackAdminController {
  constructor(
    private readonly admin: MarketplaceAdminService,
    private readonly track: FedExTrackClient,
    private readonly redeemTrack: RedeemDeliveryTrackService,
  ) {}

  private probe(
    req: Request,
    pathKey: FedExTrackPathKey,
    body: Record<string, unknown>,
  ) {
    this.admin.assertAdminSession(req);
    return this.track.probe(pathKey, body);
  }

  @Post('poll-redeems')
  @ApiOperation({
    summary: 'Run redeem FedEx Track poll once (mark Delivered → auto-receipt grace)',
    description:
      'Calls the same path as REDEEM_FEDEX_TRACK_CRON. Stamps vault_redemptions.carrier_delivered_at only when sandbox Track reports Delivered. Sandbox Test keys do not return live shipment status — real 12–15 digit numbers wait for Production keys. User confirm-received still closes the redeem without Track Delivered.',
  })
  async pollRedeems(@Req() req: Request) {
    this.admin.assertAdminSession(req);
    return this.redeemTrack.pollOnce();
  }

  @Post('trackingnumbers-probe')
  @ApiOperation({
    summary: 'Probe FedEx Track — by tracking number(s)',
    description: `POST ${FEDEX_TRACK_PATHS.trackingNumbers}`,
  })
  @ApiBody({
    schema: { type: 'object' },
    examples: {
      single: { summary: 'Single number', value: TRACKING_NUMBERS_EXAMPLE },
    },
  })
  probeTrackingNumbers(
    @Req() req: Request,
    @Body() body: Record<string, unknown>,
  ) {
    return this.probe(req, 'trackingNumbers', body);
  }

  @Post('associatedshipments-probe')
  @ApiOperation({
    summary: 'Probe FedEx Track — multiple-piece / MPS shipment',
    description: `POST ${FEDEX_TRACK_PATHS.associatedShipments}`,
  })
  @ApiBody({
    schema: { type: 'object' },
    examples: {
      mps: { summary: 'STANDARD_MPS', value: ASSOCIATED_SHIPMENTS_EXAMPLE },
    },
  })
  probeAssociatedShipments(
    @Req() req: Request,
    @Body() body: Record<string, unknown>,
  ) {
    return this.probe(req, 'associatedShipments', body);
  }

  @Post('notifications-probe')
  @ApiOperation({
    summary: 'Probe FedEx Track — send tracking email notification',
    description: `POST ${FEDEX_TRACK_PATHS.notifications}`,
  })
  @ApiBody({
    schema: { type: 'object' },
    examples: {
      onDelivery: { summary: 'ON_DELIVERY', value: NOTIFICATIONS_EXAMPLE },
    },
  })
  probeNotifications(
    @Req() req: Request,
    @Body() body: Record<string, unknown>,
  ) {
    return this.probe(req, 'notifications', body);
  }

  @Post('referencenumbers-probe')
  @ApiOperation({
    summary: 'Probe FedEx Track — by customer reference / BOL',
    description: `POST ${FEDEX_TRACK_PATHS.referenceNumbers}`,
  })
  @ApiBody({
    schema: { type: 'object' },
    examples: {
      customerRef: { summary: 'Customer reference', value: REFERENCES_EXAMPLE },
    },
  })
  probeReferenceNumbers(
    @Req() req: Request,
    @Body() body: Record<string, unknown>,
  ) {
    return this.probe(req, 'referenceNumbers', body);
  }

  @Post('tcn-probe')
  @ApiOperation({
    summary: 'Probe FedEx Track — by Transportation Control Number',
    description: `POST ${FEDEX_TRACK_PATHS.tcn}`,
  })
  @ApiBody({
    schema: { type: 'object' },
    examples: { tcn: { summary: 'TCN lookup', value: TCN_EXAMPLE } },
  })
  probeTcn(@Req() req: Request, @Body() body: Record<string, unknown>) {
    return this.probe(req, 'tcn', body);
  }

  @Post('trackingdocuments-probe')
  @ApiOperation({
    summary: 'Probe FedEx Track — signature proof of delivery (SPOD)',
    description: `POST ${FEDEX_TRACK_PATHS.trackingDocuments}`,
  })
  @ApiBody({
    schema: { type: 'object' },
    examples: {
      spod: { summary: 'SPOD PDF', value: TRACKING_DOCUMENTS_EXAMPLE },
    },
  })
  probeTrackingDocuments(
    @Req() req: Request,
    @Body() body: Record<string, unknown>,
  ) {
    return this.probe(req, 'trackingDocuments', body);
  }
}
