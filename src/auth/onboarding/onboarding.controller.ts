import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  CompleteOnboardingDto,
  CompleteOnboardingResponse,
} from './dto/complete-onboarding.dto';
import { OnboardingService } from './onboarding.service';

@Controller('auth/onboarding')
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Post('complete')
  @HttpCode(HttpStatus.CREATED)
  async complete(
    @Body() dto: CompleteOnboardingDto,
  ): Promise<CompleteOnboardingResponse> {
    return this.onboardingService.complete(dto);
  }
}
