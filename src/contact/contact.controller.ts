import { Controller, Post, Get, Patch, Body, Param } from '@nestjs/common';
import { ContactService } from './contact.service';
import { CreateContactDto } from './dto/create-contact.dto';

@Controller('contact')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Post()
  submitContactForm(@Body() dto: CreateContactDto) {
    return this.contactService.submitContactForm(dto);
  }

  // Admin routes
  @Get()
  getTickets() {
    return this.contactService.getTickets();
  }

  @Patch(':id/status')
  updateTicketStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.contactService.updateTicketStatus(id, status);
  }
}
