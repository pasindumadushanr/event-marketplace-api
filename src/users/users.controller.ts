import { Controller, Get, Param, UseGuards, Patch, Body, Query, Request, Post, UseInterceptors, UploadedFile, BadRequestException, Inject, Delete } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../roles/guards/roles.guard';
import { Roles } from '../roles/decorators/roles.decorator';
import { ApiTags, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { STORAGE_PROVIDER } from '../common/providers/storage.provider';
import type { StorageProvider } from '../common/providers/storage.provider';

import { EmailService } from '../email/email.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly emailService: EmailService,
    @Inject(STORAGE_PROVIDER) private readonly storageProvider: StorageProvider
  ) {}

  @Post(':id/contact')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  async contactUser(
    @Param('id') id: string,
    @Body() body: { subject: string; message: string; method: string }
  ) {
    const user = await this.usersService.findById(id);
    if (!user) throw new BadRequestException('User not found');
    
    if (body.method === 'EMAIL') {
      const html = `<div style="font-family: sans-serif; color: #333;">
        <h2>Message from LuxeEvents Admin</h2>
        <p>${body.message.replace(/\n/g, '<br/>')}</p>
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #eaeaea;" />
        <p style="font-size: 12px; color: #888;">This is an automated message from the LuxeEvents administration team.</p>
      </div>`;
      await this.emailService.sendMail(user.email, body.subject, html);
      return { success: true, message: 'Email sent successfully' };
    } else {
      throw new BadRequestException('Inbox messaging is not yet implemented for direct admin-to-user.');
    }
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  findAll(@Query('roles') roles?: string) {
    const rolesArray = roles ? roles.split(',') : undefined;
    return this.usersService.findAll(rolesArray);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  updateMe(@Request() req: any, @Body() data: any) {
    return this.usersService.updateMe(req.user.id, data);
  }

  @Post('me/avatar')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } }
    }
  })
  async uploadAvatar(
    @Request() req: any,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    
    // Upload to Cloudinary
    const url = await this.storageProvider.uploadFile(file, 'avatars');
    
    // Update user record
    return this.usersService.updateMe(req.user.id, { profileImage: url });
  }

  @Get('email/:email')
  @UseGuards(JwtAuthGuard)
  findByEmail(@Param('email') email: string) {
    return this.usersService.findByEmail(email);
  }

  @Delete('me')
  @UseGuards(JwtAuthGuard)
  async deleteMe(@Request() req: any) {
    return this.usersService.deleteAccount(req.user.id);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findById(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.usersService.updateStatus(id, status);
  }
}
