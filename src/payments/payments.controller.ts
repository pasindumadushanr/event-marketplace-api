import { Controller, Post, Get, Body, Param, Query, UseGuards } from '@nestjs/common';
import { PaymentsService } from './payments.service';
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
  processPayment(@Body() body: { sessionId: string, outcome: 'SUCCESS' | 'FAILED' }) {
    return this.paymentsService.processPayment(body.sessionId, body.outcome);
  }

  @Get('session/:sessionId')
  getSessionDetails(@Param('sessionId') sessionId: string) {
    return this.paymentsService.getSessionDetails(sessionId);
  }

  @Get('admin')
  @UseGuards(JwtAuthGuard)
  getAdminPayments() {
    // In a real app we'd add @Roles('ADMIN') guard here
    return this.paymentsService.getAdminPayments();
  }
}
