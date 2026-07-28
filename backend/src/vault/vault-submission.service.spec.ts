import { VaultSubmissionService } from './vault-submission.service';

describe('VaultSubmissionService.resolveScenario', () => {
  it('maps draft / awaiting / transit', () => {
    expect(VaultSubmissionService.resolveScenario('draft', [])).toBe('A');
    expect(VaultSubmissionService.resolveScenario('awaiting_shipment', [])).toBe('B');
    expect(VaultSubmissionService.resolveScenario('in_transit', [])).toBe('C');
  });

  it('maps PSA reviewing and outcomes', () => {
    expect(
      VaultSubmissionService.resolveScenario('psa_reviewing', [
        { status: 'reviewing' },
        { status: 'reviewing' },
      ]),
    ).toBe('D');
    expect(
      VaultSubmissionService.resolveScenario('psa_reviewing', [
        { status: 'approved' },
        { status: 'approved' },
      ]),
    ).toBe('E');
    expect(
      VaultSubmissionService.resolveScenario('psa_reviewing', [
        { status: 'rejected' },
        { status: 'rejected' },
      ]),
    ).toBe('F');
    expect(
      VaultSubmissionService.resolveScenario('completed', [
        { status: 'completed' },
        { status: 'completed' },
      ]),
    ).toBe('G');
    expect(
      VaultSubmissionService.resolveScenario('psa_reviewing', [
        { status: 'completed' },
        { status: 'failed' },
      ]),
    ).toBe('H');
  });
});
