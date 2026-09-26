import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { RedeemsAdminService } from './redeems-admin.service';

describe('RedeemsAdminService partner scope', () => {
  it('rejects tracking updates for another partner shipmentKey', async () => {
    const svc = Object.create(RedeemsAdminService.prototype) as RedeemsAdminService;
    svc.updateTrackingBatch = jest.fn();

    await expect(
      svc.updateTrackingBatchForPartner('partner-a', 'batch-1', {
        shipmentKey: 'partner:partner-b',
        trackingNumber: '1Z',
        redemptionIds: ['redeem-1'],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(svc.updateTrackingBatch).not.toHaveBeenCalled();
  });

  it('forwards matching partner shipmentKey to updateTrackingBatch', async () => {
    const svc = Object.create(RedeemsAdminService.prototype) as RedeemsAdminService;
    svc.updateTrackingBatch = jest.fn().mockResolvedValue({
      paymentBatchId: 'batch-1',
      shipmentKey: 'partner:partner-a',
      items: [],
    });

    await svc.updateTrackingBatchForPartner('partner-a', 'batch-1', {
      shipmentKey: 'partner:partner-a',
      trackingNumber: '1Z999',
      trackingCarrier: 'ups',
      redemptionIds: ['redeem-1'],
    });

    expect(svc.updateTrackingBatch).toHaveBeenCalledWith('batch-1', {
      shipmentKey: 'partner:partner-a',
      trackingNumber: '1Z999',
      trackingCarrier: 'ups',
      redemptionIds: ['redeem-1'],
      partnerOnly: true,
    });
  });

  it('listForPartner requires partnerId', async () => {
    const svc = Object.create(RedeemsAdminService.prototype) as RedeemsAdminService;
    await expect(svc.listForPartner('')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
