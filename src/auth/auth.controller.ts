import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
  Res,
  Header,
} from '@nestjs/common';
import { GoogleLoginGuard } from './guards/google-login.guard';
import { frontendUrl as getFrontendUrl } from '../frontend-url';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RecaptchaAction, RecaptchaGuard } from '../recaptcha/recaptcha.guard';
import { Throttle } from '@nestjs/throttler';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('vendor-trial')
  @Header('Cache-Control', 'private, no-store')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  vendorTrial(@CurrentUser() user: any) {
    return this.authService.getVendorTrial(user.id);
  }

  @Post('register')
  @UseGuards(RecaptchaGuard)
  @RecaptchaAction('register')
  @ApiOperation({ summary: 'Register a new user' })
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login user' })
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('refresh')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  refresh(@Body('refreshToken') refreshToken: unknown) {
    return this.authService.refresh(refreshToken);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout user' })
  logout(@CurrentUser() user: any) {
    return this.authService.logout(user.id);
  }

  @Post('send-verification-otp')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send email verification OTP' })
  sendVerificationOtp(@CurrentUser() user: any) {
    return this.authService.sendVerificationOtp(user.id);
  }

  @Post('verify-email-otp')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email with OTP' })
  verifyEmailOtp(@CurrentUser() user: any, @Body('otp') otp: string) {
    return this.authService.verifyEmailOtp(user.id, otp);
  }

  @Post('verify-admin-login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify Admin Login OTP' })
  verifyAdminLoginOtp(
    @Body('userId') userId: string,
    @Body('otp') otp: string,
  ) {
    return this.authService.verifyAdminLoginOtp(userId, otp);
  }

  @Post('forgot-password')
  @UseGuards(RecaptchaGuard)
  @RecaptchaAction('forgot_password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset code' })
  forgotPassword(@Body('email') email: string) {
    return this.authService.forgotPassword(email);
  }

  @Post('reset-password')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password using OTP code' })
  resetPassword(
    @Body('email') email: string,
    @Body('otp') otp: string,
    @Body('newPassword') newPassword: string,
  ) {
    return this.authService.resetPassword(email, otp, newPassword);
  }

  @Get('google')
  @UseGuards(GoogleLoginGuard)
  @ApiOperation({ summary: 'Initiate Google OAuth Login' })
  async googleAuth(@Req() req) {}

  @Get('google/vendor-status')
  googleVendorStatus() {
    return {
      enabled: Boolean(
        process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
      ),
    };
  }

  @Get('google/callback')
  @UseGuards(GoogleLoginGuard)
  @ApiOperation({ summary: 'Google OAuth Callback' })
  async googleAuthRedirect(@Req() req, @Res() res) {
    // The user is injected by Passport's GoogleStrategy
    const user = req.user;

    // Generate our application tokens
    const tokens = await this.authService.generateTokens(
      user.id,
      user.email,
      user.role ? user.role.name : 'CUSTOMER', // Adjust as needed based on how roles are loaded
      user.firstName,
      user.lastName,
    );

    // Keep session tokens out of server access logs and referrer query strings.
    const frontendUrl = getFrontendUrl();
    res.redirect(
      `${frontendUrl}/auth/callback#accessToken=${encodeURIComponent(tokens.accessToken)}&refreshToken=${encodeURIComponent(tokens.refreshToken)}`,
    );
  }
}
