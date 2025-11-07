import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

export const getOrmConfig = (
  config: ConfigService,
): TypeOrmModuleOptions & { autoLoadEntities: boolean } => ({
  type: 'postgres',
  host: config.get<string>('DB_HOST', 'localhost'),
  port: parseInt(config.get<string>('DB_PORT', '55432'), 10),
  username: config.get<string>('DB_USER', 'terracore_user'),
  password: config.get<string>('DB_PASS', 'Terracore@2025'),
  database: config.get<string>('DB_NAME', 'terracore'),
  autoLoadEntities: true,
  synchronize: true,
});
