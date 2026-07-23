import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'uploads'),
      serveRoot: '/uploads',
    }),
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
    ContactModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
