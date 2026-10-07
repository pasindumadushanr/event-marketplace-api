import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../roles/guards/roles.guard';
import { Roles } from '../roles/decorators/roles.decorator';
import { NewsletterDto } from './dto/newsletter.dto';
import { Throttle } from '@nestjs/throttler';
import { ContactService } from './contact.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { RecaptchaAction, RecaptchaGuard } from '../recaptcha/recaptcha.guard';

@Controller('contact')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Post()
  @UseGuards(RecaptchaGuard)
  @RecaptchaAction('contact')
  submitContactForm(@Body() dto: CreateContactDto) {
    return this.contactService.submitContactForm(dto);
  }

  @Post('newsletter')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  subscribe(@Body() dto: NewsletterDto) {
    return this.contactService.subscribeNewsletter(dto);
  }

  // Admin routes
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  getTickets() {
    return this.contactService.getTickets();
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  updateTicketStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.contactService.updateTicketStatus(id, status);
  }
}
