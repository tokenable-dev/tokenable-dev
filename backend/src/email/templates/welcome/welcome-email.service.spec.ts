import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../../../user/entities/user.entity';
import { TransactionalEmailService } from '../../transactional-email.service';
import { WelcomeEmailService } from './welcome-email.service';

describe('WelcomeEmailService', () => {
  const mail = {
    isEnvFlagEnabled: jest.fn().mockReturnValue(true),
    hasGmailCredentials: jest.fn().mockReturnValue(true),
    send: jest.fn().mockResolvedValue('msg-id'),
  };
  const usersRepo = {
    update: jest.fn(),
  };

  let service: WelcomeEmailService;

  beforeEach(async () => {
    jest.clearAllMocks();
    usersRepo.update.mockResolvedValue({ affected: 1 });
    const module = await Test.createTestingModule({
      providers: [
        WelcomeEmailService,
        { provide: TransactionalEmailService, useValue: mail },
        { provide: getRepositoryToken(User), useValue: usersRepo },
      ],
    }).compile();
    service = module.get(WelcomeEmailService);
    jest.spyOn(service as never, 'resolveContent' as never).mockResolvedValue({
      template: {
        frontendUrl: 'https://app.tokenable.io',
        heroImgSrc: 'https://app.tokenable.io/assets/email/welcome-hero-composite.png',
        heroComposite: true,
        arrowWhiteImgSrc: 'https://app.tokenable.io/assets/email/welcome-arrow-white.png',
        arrowLinkImgSrc: 'https://app.tokenable.io/assets/email/welcome-arrow-link.png',
        featureAuthIconSrc: 'cid:test',
        featureVaultIconSrc: 'cid:test',
        featureSettleIconSrc: 'cid:test',
      },
    });
  });

  it('sendForContactEmailLinked sends when prior email was @privy.wallet placeholder', async () => {
    const user = {
      id: 'u1',
      email: 'collector@example.com',
    } as User;
    await service.sendForContactEmailLinked(
      user,
      '0xabc@privy.wallet',
    );
    expect(mail.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'collector@example.com' }),
      expect.any(Object),
    );
  });

  it('sendForContactEmailLinked skips when prior email was already real', async () => {
    const user = { id: 'u1', email: 'new@example.com' } as User;
    await service.sendForContactEmailLinked(user, 'old@example.com');
    expect(mail.send).not.toHaveBeenCalled();
  });
});
