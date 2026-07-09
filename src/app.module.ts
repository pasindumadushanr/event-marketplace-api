import { Module } from '@nestjs/common';
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

@Module({
  imports: [
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
    VendorGalleryModule, AdminApprovalsModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
