import { PaymentEscrowWriterService } from './payment-escrow-writer.service';

describe('PaymentEscrowWriterService.escrowOrderIdForListing', () => {
  it('is deterministic for the same listing id', () => {
    const a = PaymentEscrowWriterService.escrowOrderIdForListing(
      '11111111-1111-1111-1111-111111111111',
    );
    const b = PaymentEscrowWriterService.escrowOrderIdForListing(
      '11111111-1111-1111-1111-111111111111',
    );
    expect(a).toBe(b);
    expect(a).toMatch(/^0x[a-f0-9]{64}$/);
  });

  it('differs across listing ids', () => {
    const a = PaymentEscrowWriterService.escrowOrderIdForListing(
      '11111111-1111-1111-1111-111111111111',
    );
    const b = PaymentEscrowWriterService.escrowOrderIdForListing(
      '22222222-2222-2222-2222-222222222222',
    );
    expect(a).not.toBe(b);
  });

  it('normalizes case', () => {
    const a = PaymentEscrowWriterService.escrowOrderIdForListing(
      'AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA',
    );
    const b = PaymentEscrowWriterService.escrowOrderIdForListing(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    );
    expect(a).toBe(b);
  });
});
