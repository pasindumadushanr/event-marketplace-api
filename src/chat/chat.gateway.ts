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
import { WsException } from '@nestjs/websockets';

@WebSocketGateway({
  cors: {
    origin: [
      process.env.FRONTEND_URL,
      'https://nakathata.lk',
      'https://www.nakathata.lk',
      'https://luxeevents.fun',
      'https://www.luxeevents.fun',
      'http://localhost:3000',
    ].filter(Boolean) as string[],
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  broadcastMessage(message: { conversationId: string }) {
    this.server
      ?.to(`conversation_${message.conversationId}`)
      .emit('receive_message', message);
  }

  constructor(
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth.token?.split(' ')[1] ||
        client.handshake.headers.authorization?.split(' ')[1];
      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);
      client.data.user = payload;

      // Join a personal room for direct user-based notifications
      client.join(`user_${payload.sub}`);
      console.log(`User ${payload.sub} connected to chat`);
    } catch (error) {
      console.log('WS Connection error:', error.message);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    console.log(`User ${client.data?.user?.sub} disconnected from chat`);
  }

  @SubscribeMessage('join_conversation')
  async handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    await this.authorize(client, data.conversationId);
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
    await this.authorize(client, data.conversationId);
    const userId = client.data.user.sub;

    // Save to database
    const message = await this.chatService.saveMessage(
      data.conversationId,
      userId,
      data.content,
    );

    // Broadcast to everyone in the conversation room (including sender to confirm delivery)
    this.server
      .to(`conversation_${data.conversationId}`)
      .emit('receive_message', message);

    // Also we might want to emit a notification event to the specific recipient's personal room
    // For that, we would need to know the recipient's ID, which we could fetch from the conversation
    // but the frontend can also just listen to 'receive_message' if they are in the conversation room.

    return message;
  }

  private async authorize(client: Socket, conversationId: string) {
    if (!client.data?.user?.sub)
      throw new WsException('Authentication required');
    try {
      await this.chatService.assertParticipant(
        conversationId,
        client.data.user.sub,
      );
    } catch {
      throw new WsException('Conversation access denied');
    }
  }
}
