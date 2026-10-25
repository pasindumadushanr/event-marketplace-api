import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { RolesGuard } from '../roles/guards/roles.guard';
import { Roles } from '../roles/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('create-session')
  @UseGuards(JwtAuthGuard)
  createSession(@Body() body: { bookingId: string }) {
    return this.paymentsService.createSession(body.bookingId);
  }

  @Post('process')
  processPayment(
    @Body() body: { sessionId: string; outcome: 'SUCCESS' | 'FAILED' },
  ) {
    return this.paymentsService.processPayment(body.sessionId, body.outcome);
  }

  @Get('session/:sessionId')
  getSessionDetails(@Param('sessionId') sessionId: string) {
    return this.paymentsService.getSessionDetails(sessionId);
  }

  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  getAdminPayments() {
    return this.paymentsService.getAdminPayments();
  }
}
