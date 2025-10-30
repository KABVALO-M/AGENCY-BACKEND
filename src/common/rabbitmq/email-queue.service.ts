import { Injectable, Logger, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';
import { EmailVerificationData, WelcomeEmailData } from '../services/email.service';

@Injectable()
export class EmailQueueService {
  private readonly logger = new Logger(EmailQueueService.name);

  constructor(@Inject('EMAIL_QUEUE') private readonly client: ClientProxy) {}

  async queueEmailVerification(userEmail: string, data: EmailVerificationData) {
    try {
      await lastValueFrom(this.client.emit('send-email-verification', { userEmail, data }));
      this.logger.log(`📧 Queued email verification for ${userEmail}`);
    } catch (error) {
      this.logger.error(`Failed to queue verification email for ${userEmail}: ${error.message}`);
      throw error;
    }
  }

  async queueWelcomeEmail(userEmail: string, data: WelcomeEmailData) {
    try {
      await lastValueFrom(this.client.emit('send-welcome-email', { userEmail, data }));
      this.logger.log(`📧 Queued welcome email for ${userEmail}`);
    } catch (error) {
      this.logger.error(`Failed to queue welcome email for ${userEmail}: ${error.message}`);
    }
  }
}
