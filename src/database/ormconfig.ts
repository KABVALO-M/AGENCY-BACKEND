import 'dotenv/config';
import { join } from 'path';
import { DataSource, DataSourceOptions } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { getOrmConfig } from '../config/ormconfig';

const configService = new ConfigService();

const { autoLoadEntities, ...baseOptions } = getOrmConfig(
  configService,
) as DataSourceOptions & { autoLoadEntities?: boolean };

const dataSourceOptions: DataSourceOptions = {
  ...baseOptions,
  entities: [join(__dirname, '..', 'modules', '**', '*.entity.{ts,js}')],
  migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
};

export default new DataSource(dataSourceOptions);
