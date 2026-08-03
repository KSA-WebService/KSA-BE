import { Module } from '@nestjs/common';
import { TokenBalancesController } from './token-balances.controller';
import { TokenBalancesService } from './token-balances.service';

@Module({
  controllers: [TokenBalancesController],
  providers: [TokenBalancesService],
})
export class TokenBalancesModule {}
