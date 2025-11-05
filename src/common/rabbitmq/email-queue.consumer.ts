import { Controller, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import * as nodemailer from 'nodemailer';
import { EmailVerificationTemplate } from '../templates/email-verification.template';
import { WelcomeEmailTemplate } from '../templates/welcome-email.template';
import { PasswordResetTemplate } from '../templates/password-reset.template';
import {
  EmailVerificationData,
  PasswordResetEmailData,
  WelcomeEmailData,
} from '../services/email.service';

@Controller()
export class EmailQueueConsumer {
  private readonly logger = new Logger(EmailQueueConsumer.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly fromAddress: string;
  private readonly appUrl: string;

  constructor(private readonly configService: ConfigService) {
    const host = configService.get<string>('MAIL_HOST');
    const port = parseInt(configService.get<string>('MAIL_PORT') ?? '587', 10);
    const secure = port === 465;
    const user = configService.get<string>('MAIL_USERNAME');
    const pass = configService.get<string>('MAIL_PASSWORD');

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });
    this.appUrl =
      configService.get<string>('APP_URL') || 'http://localhost:3000';

    const emailAddress =
      configService.get<string>('MAIL_FROM_ADDRESS') ||
      'noreply@terracore.local';
    const emailName =
      configService.get<string>('MAIL_FROM_NAME') || 'TerraCore';
    this.fromAddress = `${emailName} <${emailAddress}>`;
  }

  @EventPattern('send-email-verification')
  async handleEmailVerification(
    @Payload() payload: { userEmail: string; data: EmailVerificationData },
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();

    try {
      const verificationLink = `${this.appUrl}/verify-email?token=${payload.data.verificationToken}`;
      const html = EmailVerificationTemplate.generate(
        payload.data,
        verificationLink,
      );

      await this.transporter.sendMail({
        from: this.fromAddress,
        to: payload.userEmail,
        subject: 'Verify your email',
        html,
      });

      this.logger.log(`Verification email sent to ${payload.userEmail}`);
      channel.ack(originalMsg);
    } catch (error) {
      this.logger.error(
        `Failed to send verification email to ${payload.userEmail}: ${error.message}`,
      );
      channel.nack(originalMsg, false, false);
    }
  }

  @EventPattern('send-welcome-email')
  async handleWelcomeEmail(
    @Payload() payload: { userEmail: string; data: WelcomeEmailData },
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();

    try {
      const html = WelcomeEmailTemplate.generate(payload.data, this.appUrl);
      await this.transporter.sendMail({
        from: this.fromAddress,
        to: payload.userEmail,
        subject: 'Welcome to Terracore!',
        html,
      });

      this.logger.log(`Welcome email sent to ${payload.userEmail}`);
      channel.ack(originalMsg);
    } catch (error) {
      this.logger.error(
        `Failed to send welcome email to ${payload.userEmail}: ${error.message}`,
      );
      channel.nack(originalMsg, false, false);
    }
  }

  @EventPattern('send-password-reset-email')
  async handlePasswordResetEmail(
    @Payload() payload: { userEmail: string; data: PasswordResetEmailData },
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();

    try {
      const resetLink = `${this.appUrl}/reset-password?token=${payload.data.resetToken}`;
      const html = PasswordResetTemplate.generate(payload.data, resetLink);

      await this.transporter.sendMail({
        from: this.fromAddress,
        to: payload.userEmail,
        subject: 'Reset your Terracore password',
        html,
      });

      this.logger.log(`Password reset email sent to ${payload.userEmail}`);
      channel.ack(originalMsg);
    } catch (error) {
      this.logger.error(
        `Failed to send password reset email to ${payload.userEmail}: ${error.message}`,
      );
      channel.nack(originalMsg, false, false);
    }
  }
}
