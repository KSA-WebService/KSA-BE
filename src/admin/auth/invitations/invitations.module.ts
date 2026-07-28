import { Module } from '@nestjs/common';
import { InvitationsController } from './invitations.controller';
import { InvitationsService } from './invitations.service';
import { InvitationMailService } from './invitation-mail.service';

@Module({
  controllers: [InvitationsController],
  providers: [InvitationsService, InvitationMailService],
})
export class InvitationsModule {}
