import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserAuthProvider } from './entities/user-auth-provider.entity';
import { UserKycEvent } from './entities/user-kyc-event.entity';
import { UserShippingAddress } from './entities/user-shipping-address.entity';
import { User } from './entities/user.entity';
import { UserWallet } from './entities/user-wallet.entity';
import { UserService } from './user.service';
import { PlacesAddressService } from './places-address.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      UserWallet,
      UserAuthProvider,
      UserKycEvent,
      UserShippingAddress,
    ]),
  ],
  providers: [UserService, PlacesAddressService],
  exports: [UserService, PlacesAddressService],
})
export class UserModule {}
