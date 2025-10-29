import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

export const getOrmConfig = (
  config: ConfigService,
): TypeOrmModuleOptions & { autoLoadEntities: boolean } => ({
  type: 'postgres',
  host: config.get<string>('DB_HOST'),
  port: parseInt(config.get<string>('DB_PORT', '5432'), 10),
  username: config.get<string>('DB_USER'),
  password: config.get<string>('DB_PASS'),
  database: config.get<string>('DB_NAME'),
  autoLoadEntities: true,
  synchronize: true,
});
