import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { RolesModule } from './roles/roles.module';
import { BusinessCategoriesModule } from './business-categories/business-categories.module';
import { VendorBusinessModule } from './vendor-business/vendor-business.module';
import { VendorGalleryModule } from './vendor-gallery/vendor-gallery.module';
import { AdminApprovalsModule } from './admin-approvals/admin-approvals.module';
import { VendorContentBuilderModule } from './vendor-content-builder/vendor-content-builder.module';
import { VendorPackagesModule } from './vendor-packages/vendor-packages.module';
import { BookingsModule } from './bookings/bookings.module';
import { CustomerAccountModule } from './customer-account/customer-account.module';
import { DiscoveryModule } from './discovery/discovery.module';
import { EmailModule } from './email/email.module';
import { ContactModule } from './contact/contact.module';
import { AdminCmsModule } from './admin-cms/admin-cms.module';
import { PaymentsModule } from './payments/payments.module';
import { VendorReviewsModule } from './vendor-reviews/vendor-reviews.module';
import { VendorRevenueModule } from './vendor-revenue/vendor-revenue.module';
import { VendorDocumentsModule } from './vendor-documents/vendor-documents.module';
import { AdminDashboardModule } from './admin-dashboard/admin-dashboard.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { ChatModule } from './chat/chat.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PackageTemplatesModule } from './package-templates/package-templates.module';
import { ReviewsModule } from './reviews/reviews.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'uploads'),
      serveRoot: '/uploads',
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    PrismaModule,
    UsersModule,
    AuthModule,
    RolesModule,
    BusinessCategoriesModule,
    VendorBusinessModule,
    VendorGalleryModule,
    AdminApprovalsModule,
    VendorContentBuilderModule,
    VendorPackagesModule,
    BookingsModule,
    CustomerAccountModule,
    DiscoveryModule,
    EmailModule,
    ContactModule,
    AdminCmsModule,
    PaymentsModule,
    VendorReviewsModule,
    ReviewsModule,
    VendorRevenueModule,
    VendorDocumentsModule,
    AdminDashboardModule,
    SubscriptionsModule,
    ChatModule,
    NotificationsModule,
    PackageTemplatesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
