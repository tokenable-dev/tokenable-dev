import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserAuthProvider } from './entities/user-auth-provider.entity';
import { UserKycEvent } from './entities/user-kyc-event.entity';
import { User } from './entities/user.entity';
import { UserWallet } from './entities/user-wallet.entity';
import { UserService } from './user.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, UserWallet, UserAuthProvider, UserKycEvent])],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
