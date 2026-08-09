import { Controller, Get, Patch, Param, Body, UseGuards, Request } from '@nestjs/common';
import { VendorReviewsService } from './vendor-reviews.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../roles/guards/roles.guard';
import { Roles } from '../roles/decorators/roles.decorator';

@Controller('vendor/reviews')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('VENDOR')
export class VendorReviewsController {
  constructor(private readonly vendorReviewsService: VendorReviewsService) {}

  @Get()
  getVendorReviews(@Request() req: any) {
    return this.vendorReviewsService.getVendorReviews(req.user.id);
  }

  @Patch(':id/reply')
  replyToReview(
    @Request() req: any,
    @Param('id') id: string,
    @Body('reply') reply: string
  ) {
    return this.vendorReviewsService.replyToReview(req.user.id, id, reply);
  }
}
