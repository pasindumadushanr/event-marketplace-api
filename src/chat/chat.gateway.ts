import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({
  cors: {
    origin: '*', // In production, restrict this to frontend URL
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth.token?.split(' ')[1] || client.handshake.headers.authorization?.split(' ')[1];
      if (!token) {
        client.disconnect();
        return;
      }
      
      const payload = this.jwtService.verify(token);
      client.data.user = payload;
      
      // Join a personal room for direct user-based notifications
      client.join(`user_${payload.userId}`);
      console.log(`User ${payload.userId} connected to chat`);
    } catch (error) {
      console.log('WS Connection error:', error.message);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    console.log(`User ${client.data?.user?.userId} disconnected from chat`);
  }

  @SubscribeMessage('join_conversation')
  handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    // Join the specific conversation room
    client.join(`conversation_${data.conversationId}`);
    return { event: 'joined', data: data.conversationId };
  }

  @SubscribeMessage('leave_conversation')
  handleLeaveConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    client.leave(`conversation_${data.conversationId}`);
    return { event: 'left', data: data.conversationId };
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string; content: string },
  ) {
    const userId = client.data.user.userId;
    
    // Save to database
    const message = await this.chatService.saveMessage(
      data.conversationId,
      userId,
      data.content,
    );

    // Broadcast to everyone in the conversation room (including sender to confirm delivery)
    this.server.to(`conversation_${data.conversationId}`).emit('receive_message', message);
    
    // Also we might want to emit a notification event to the specific recipient's personal room
    // For that, we would need to know the recipient's ID, which we could fetch from the conversation
    // but the frontend can also just listen to 'receive_message' if they are in the conversation room.
    
    return message;
  }
}
