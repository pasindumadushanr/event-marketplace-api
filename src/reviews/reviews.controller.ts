import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  createReview(
    @Request() req: any,
    @Body() data: { businessId: string; rating: number; comment?: string },
  ) {
    return this.reviewsService.createReview(req.user.id, data);
  }

  @Get('business/:id')
  getBusinessReviews(@Param('id') businessId: string) {
    return this.reviewsService.getBusinessReviews(businessId);
  }
}
