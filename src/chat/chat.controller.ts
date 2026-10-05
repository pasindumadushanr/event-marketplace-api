import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../roles/guards/roles.guard';
import { ChatGateway } from './chat.gateway';
import { CreateInquiryDto, RespondInquiryDto } from './dto/inquiry.dto';

@Controller('chat')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly gateway: ChatGateway,
  ) {}

  @Post('inquiries')
  async createInquiry(@Req() req, @Body() body: CreateInquiryDto) {
    const result = await this.chatService.createInquiry(req.user.id, body);
    this.gateway.broadcastMessage(result.inquiry);
    return result;
  }

  @Post('conversations/:id/inquiries/:inquiryId/respond')
  async respondInquiry(
    @Req() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('inquiryId', ParseUUIDPipe) inquiryId: string,
    @Body() body: RespondInquiryDto,
  ) {
    const result = await this.chatService.respondToInquiry(
      id,
      inquiryId,
      req.user.id,
      body,
    );
    this.gateway.broadcastMessage(result);
    return result;
  }

  @Post('conversations/:id/messages')
  async sendMessage(
    @Req() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { content: string },
  ) {
    const message = await this.chatService.saveMessage(
      id,
      req.user.id,
      body.content,
    );
    this.gateway.broadcastMessage(message);
    return message;
  }

  @Get('conversations')
  getConversations(@Req() req, @Query('mode') mode?: string) {
    return this.chatService.getUserConversations(
      req.user.id,
      req.user.role?.name,
      mode === 'vendor',
    );
  }

  @Post('conversations')
  getOrCreateConversation(@Req() req, @Body() body: { businessId: string }) {
    return this.chatService.getOrCreateConversation(
      req.user.id,
      body.businessId,
    );
  }

  @Get('conversations/:id/messages')
  getMessages(@Req() req, @Param('id') conversationId: string) {
    return this.chatService.getMessages(
      conversationId,
      req.user.id,
      req.user.role?.name,
    );
  }

  @Post('conversations/:id/read')
  markAsRead(@Req() req, @Param('id') conversationId: string) {
    return this.chatService.markAsRead(conversationId, req.user.id);
  }
}
