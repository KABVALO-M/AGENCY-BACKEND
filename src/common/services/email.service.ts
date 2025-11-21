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

export interface PasswordResetEmailData {
  firstName: string;
  resetToken: string;
  expiresAt: string;
}

export interface AdminInviteEmailData {
  firstName: string;
  email: string;
  password: string;
  invitedBy: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly appUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly emailQueueService: EmailQueueService,
  ) {
    this.appUrl =
      this.configService.get<string>('APP_URL') || 'http://localhost:3000';
  }

  async sendEmailVerification(userEmail: string, data: EmailVerificationData) {
    try {
      await this.emailQueueService.queueEmailVerification(userEmail, data);
      this.logger.log(`Queued verification email for ${userEmail}`);
    } catch (error) {
      this.logger.error(
        `Failed to queue verification email for ${userEmail}: ${error.message}`,
      );
    }
  }

  async sendWelcomeEmail(userEmail: string, data: WelcomeEmailData) {
    try {
      await this.emailQueueService.queueWelcomeEmail(userEmail, data);
      this.logger.log(`Queued welcome email for ${userEmail}`);
    } catch (error) {
      this.logger.error(
        `Failed to queue welcome email for ${userEmail}: ${error.message}`,
      );
    }
  }

  async sendPasswordResetEmail(
    userEmail: string,
    data: PasswordResetEmailData,
  ) {
    try {
      await this.emailQueueService.queuePasswordResetEmail(userEmail, data);
      this.logger.log(`Queued password reset email for ${userEmail}`);
    } catch (error) {
      this.logger.error(
        `Failed to queue password reset email for ${userEmail}: ${error.message}`,
      );
    }
  }

  async sendAdminInvitationEmail(
    userEmail: string,
    data: AdminInviteEmailData,
  ) {
    try {
      await this.emailQueueService.queueAdminInviteEmail(userEmail, {
        ...data,
        email: userEmail,
      });
      this.logger.log(`Queued admin invitation email for ${userEmail}`);
    } catch (error) {
      this.logger.error(
        `Failed to queue admin invitation email for ${userEmail}: ${error.message}`,
      );
    }
  }
}
