import { Controller, Get, Post, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../roles/guards/roles.guard';

@Controller('chat')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('conversations')
  getConversations(@Req() req) {
    return this.chatService.getUserConversations(req.user.userId, req.user.roleName);
  }

  @Post('conversations')
  getOrCreateConversation(@Req() req, @Body() body: { businessId: string }) {
    return this.chatService.getOrCreateConversation(req.user.userId, body.businessId);
  }

  @Get('conversations/:id/messages')
  getMessages(@Req() req, @Param('id') conversationId: string) {
    return this.chatService.getMessages(conversationId, req.user.userId, req.user.roleName);
  }
  
  @Post('conversations/:id/read')
  markAsRead(@Req() req, @Param('id') conversationId: string) {
    return this.chatService.markAsRead(conversationId, req.user.userId);
  }
}
