import { ConsoleLogger, Injectable, LogLevel } from '@nestjs/common';

@Injectable()
export class AppLoggerService extends ConsoleLogger {
  constructor() {
    super('AppLogger', {
      timestamp: true,
      colors: true,
    });
  }

  event(message: string, context?: string) {
    this.write('log', 'EVENT', message, context);
  }

  info(message: string, context?: string) {
    this.write('log', 'INFO', message, context);
  }

  override log(message: any, context?: string) {
    this.write('log', 'LOG', message, context);
  }

  override error(message: any, trace?: string, context?: string) {
    const payload = this.decorate('ERROR', message);
    super.error(payload, trace, context);
  }

  override warn(message: any, context?: string) {
    this.write('warn', 'WARN', message, context);
  }

  override debug(message: any, context?: string) {
    this.write('debug', 'DEBUG', message, context);
  }

  override verbose(message: any, context?: string) {
    this.write('verbose', 'VERBOSE', message, context);
  }

  private write(level: LogLevel, tag: string, message: any, context?: string) {
    const payload = this.decorate(tag, message);
    if (context) {
      super[level](payload, context);
    } else {
      super[level](payload);
    }
  }

  private decorate(tag: string, message: any): string {
    const body =
      typeof message === 'string' ? message : JSON.stringify(message, null, 2);
    return `[${tag}] ${body}`;
  }
}
