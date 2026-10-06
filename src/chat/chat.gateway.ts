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
import { UsersService } from '../users/users.service';
import { assertSession } from '../auth/session';
import { Logger } from '@nestjs/common';

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
  private readonly logger = new Logger(ChatGateway.name);
  @WebSocketServer()
  server: Server;

  async broadcastMessage(message: { conversationId: string }) {
    if (!this.server) return;
    const room = `conversation_${message.conversationId}`;
    // Revoked sockets must not keep passively receiving private room messages.
    try {
      const sockets = await this.server.in(room).fetchSockets();
      await Promise.all(
        sockets.map(async (socket) => {
          try {
            await this.validateSession(socket.data);
          } catch {
            socket.disconnect(true);
          }
        }),
      );
      this.server.to(room).emit('receive_message', message);
    } catch {
      // The message is already saved; fail closed without reporting a failed save.
      this.logger.warn(
        'Live message delivery unavailable; message retained in inbox',
      );
    }
  }

  constructor(
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
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
      client.data.token = token;
      await this.validateSession(client.data);

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
    await this.broadcastMessage(message);

    // Also we might want to emit a notification event to the specific recipient's personal room
    // For that, we would need to know the recipient's ID, which we could fetch from the conversation
    // but the frontend can also just listen to 'receive_message' if they are in the conversation room.

    return message;
  }

  private async authorize(client: Socket, conversationId: string) {
    if (!client.data?.user?.sub)
      throw new WsException('Authentication required');
    try {
      await this.validateSession(client.data);
      await this.chatService.assertParticipant(
        conversationId,
        client.data.user.sub,
      );
    } catch {
      client.disconnect?.();
      throw new WsException('Conversation access denied');
    }
  }

  private async validateSession(data: any) {
    const payload = this.jwtService.verify(data.token);
    const user = await this.usersService.findSessionById(payload.sub);
    assertSession(payload, user);
  }
}
