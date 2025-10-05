import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { CacheModule } from '@nestjs/cache-manager';

@Module({
  providers: [UserService],
  imports: [CacheModule.register()],

  exports: [UserService],
  controllers: [UserController],
})
export class UserModule {}
