import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailQueueService } from '../rabbitmq/email-queue.service';

export interface EmailVerificationData {
  firstName: string;
  verificationToken: string;
  expiresAt: string;
}

export interface WelcomeEmailData {
  firstName: string;
  verifiedAt: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly appUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly emailQueueService: EmailQueueService,
  ) {
    this.appUrl = this.configService.get<string>('APP_URL') || 'http://localhost:3000';
  }

  async sendEmailVerification(userEmail: string, data: EmailVerificationData) {
    try {
      await this.emailQueueService.queueEmailVerification(userEmail, data);
      this.logger.log(`Queued verification email for ${userEmail}`);
    } catch (error) {
      this.logger.error(`Failed to queue verification email for ${userEmail}: ${error.message}`);
    }
  }

  async sendWelcomeEmail(userEmail: string, data: WelcomeEmailData) {
    try {
      await this.emailQueueService.queueWelcomeEmail(userEmail, data);
      this.logger.log(`Queued welcome email for ${userEmail}`);
    } catch (error) {
      this.logger.error(`Failed to queue welcome email for ${userEmail}: ${error.message}`);
    }
  }
}
