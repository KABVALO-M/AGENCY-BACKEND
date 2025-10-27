import { Injectable, Logger, LoggerService } from '@nestjs/common';

@Injectable()
export class AppLoggerService extends Logger implements LoggerService {
  constructor() {
    super('AppLogger');
  }

  event(message: string, context?: string) {
    super.log(this.formatMessage('EVENT', message), context);
  }

  info(message: string, context?: string) {
    super.log(this.formatMessage('INFO', message), context);
  }

  override log(message: string, context?: string) {
    super.log(this.formatMessage('LOG', message), context);
  }

  override error(message: string, trace?: string, context?: string) {
    super.error(this.formatMessage('ERROR', message), trace, context);
  }

  override warn(message: string, context?: string) {
    super.warn(this.formatMessage('WARN', message), context);
  }

  override debug(message: string, context?: string) {
    super.debug(this.formatMessage('DEBUG', message), context);
  }

  override verbose(message: string, context?: string) {
    super.verbose(this.formatMessage('VERBOSE', message), context);
  }

  setContext(context: string): void {
    this.context = context;
  }

  private formatMessage(level: string, message: string): string {
    return `[${level}] ${message}`;
  }
}
