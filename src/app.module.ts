import { MiddlewareConsumer, Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LoggerMiddleware } from './middleware/winston.middleware';
import { AuthModule } from './res/auth/auth.module';
import { ProblemModule } from './res/problem/problem.module';
import { UploadViewModule } from './res/upload_view/upload_view.module';
import { UserModule } from './res/user/user.module';

@Module({
  imports: [AuthModule, ProblemModule, UploadViewModule, UserModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {
    configure(consumer: MiddlewareConsumer) {
      consumer.apply(LoggerMiddleware).forRoutes('*');
    }
}
