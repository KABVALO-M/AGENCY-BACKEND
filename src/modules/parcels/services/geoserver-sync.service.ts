import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GEOSERVER_LAYER_CONFIGS,
  GeoServerLayerConfig,
} from '../constants/geoserver-layer.constant';
import { PARCEL_MESSAGES } from '../messages/parcel.messages';

export interface GeoServerSyncResult {
  workspace: string;
  dataStore: string;
  layers: string[];
}

@Injectable()
export class GeoServerSyncService {
  private readonly logger = new Logger(GeoServerSyncService.name);
  private readonly baseUrl: string;
  private readonly username: string;
  private readonly password: string;
  private readonly workspace: string;
  private readonly dataStore: string;
  private readonly dbConfig: {
    host: string;
    port: string;
    database: string;
    schema: string;
    user: string;
    password: string;
  };

  constructor(private readonly configService: ConfigService) {
    this.baseUrl =
      this.configService.get<string>('GEOSERVER_BASE_URL') ??
      'http://localhost:8080/geoserver';
    this.username =
      this.configService.get<string>('GEOSERVER_USERNAME') ?? 'admin';
    this.password =
      this.configService.get<string>('GEOSERVER_PASSWORD') ?? 'admin';
    this.workspace =
      this.configService.get<string>('GEOSERVER_WORKSPACE') ?? 'terracore';
    this.dataStore =
      this.configService.get<string>('GEOSERVER_DATASTORE') ??
      'terracore_store';

    const defaultDbHost = this.configService.get<string>('DB_HOST', 'localhost');
    const defaultDbPort = this.configService.get<string>('DB_PORT', '55432');
    const defaultDbUser = this.configService.get<string>(
      'DB_USER',
      'terracore_user',
    );
    const defaultDbPass = this.configService.get<string>(
      'DB_PASS',
      'Terracore@2025',
    );
    const defaultDbName = this.configService.get<string>(
      'DB_NAME',
      'terracore',
    );
    const defaultDbSchema = this.configService.get<string>(
      'DB_SCHEMA',
      'public',
    );

    this.dbConfig = {
      host: this.configService.get<string>(
        'GEOSERVER_DB_HOST',
        defaultDbHost,
      ),
      port: this.configService.get<string>(
        'GEOSERVER_DB_PORT',
        defaultDbPort,
      ),
      database: this.configService.get<string>(
        'GEOSERVER_DB_NAME',
        defaultDbName,
      ),
      schema: this.configService.get<string>(
        'GEOSERVER_DB_SCHEMA',
        defaultDbSchema,
      ),
      user: this.configService.get<string>(
        'GEOSERVER_DB_USER',
        defaultDbUser,
      ),
      password: this.configService.get<string>(
        'GEOSERVER_DB_PASS',
        defaultDbPass,
      ),
    };
  }

  async syncAll(): Promise<{ message: string; data: GeoServerSyncResult }> {
    await this.ensureWorkspace();
    await this.ensureDataStore();

    const publishedLayers: string[] = [];
    for (const layer of GEOSERVER_LAYER_CONFIGS) {
      const published = await this.publishLayer(layer);
      if (published) {
        publishedLayers.push(layer.name);
      }
    }

    return {
      message: PARCEL_MESSAGES.GEOSERVER_SYNC_TRIGGERED,
      data: {
        workspace: this.workspace,
        dataStore: this.dataStore,
        layers: publishedLayers,
      },
    };
  }

  private async ensureWorkspace(): Promise<void> {
    const exists = await this.exists(
      `/workspaces/${this.workspace}.json`,
    ).catch((error) => {
      this.logger.error(`Workspace check failed: ${error.message}`);
      throw error;
    });

    if (exists) {
      return;
    }

    await this.request(
      'POST',
      '/workspaces',
      {
        workspace: {
          name: this.workspace,
        },
      },
    );
  }

  private async ensureDataStore(): Promise<void> {
    const path = `/workspaces/${this.workspace}/datastores/${this.dataStore}.json`;
    const exists = await this.exists(path).catch((error) => {
      this.logger.error(`Data store check failed: ${error.message}`);
      throw error;
    });

    const payload = {
      dataStore: {
        name: this.dataStore,
        type: 'PostGIS',
        enabled: true,
        connectionParameters: {
          entry: Object.entries({
            dbtype: 'postgis',
            host: this.dbConfig.host,
            port: this.dbConfig.port,
            database: this.dbConfig.database,
            schema: this.dbConfig.schema,
            user: this.dbConfig.user,
            passwd: this.dbConfig.password,
            expose_primary_keys: 'true',
            preparedStatements: 'true',
            createSchema: 'false',
            validate_connections: 'true',
          }).map(([key, value]) => ({
            '@key': key,
            $: value,
          })),
        },
      },
    };

    if (exists) {
      await this.request(
        'PUT',
        `/workspaces/${this.workspace}/datastores/${this.dataStore}`,
        payload,
      );
    } else {
      await this.request(
        'POST',
        `/workspaces/${this.workspace}/datastores`,
        payload,
      );
    }
  }

  private async publishLayer(config: GeoServerLayerConfig): Promise<boolean> {
    const path = `/workspaces/${this.workspace}/datastores/${this.dataStore}/featuretypes/${config.name}.json`;
    const exists = await this.exists(path).catch((error) => {
      this.logger.error(
        `Layer check failed for ${config.name}: ${error.message}`,
      );
      throw error;
    });

    const payload = {
      featureType: {
        name: config.name,
        nativeName: config.nativeName ?? config.name,
        title: config.title,
        srs: config.srs ?? 'EPSG:4326',
        enabled: true,
      },
    };

    if (exists) {
      await this.request(
        'PUT',
        `/workspaces/${this.workspace}/datastores/${this.dataStore}/featuretypes/${config.name}`,
        payload,
      );
      return false;
    }

    await this.request(
      'POST',
      `/workspaces/${this.workspace}/datastores/${this.dataStore}/featuretypes`,
      payload,
    );
    return true;
  }

  private async exists(path: string): Promise<boolean> {
    const response = await this.requestRaw('GET', path.replace(/\.json$/, '.json'));
    if (response.status === 200) {
      return true;
    }
    if (response.status === 404) {
      return false;
    }
    const text = await response.text();
    throw new Error(
      `Request to ${path} failed with status ${response.status}: ${text}`,
    );
  }

  private async request(
    method: string,
    path: string,
    body?: Record<string, unknown>,
  ): Promise<void> {
    const response = await this.requestRaw(
      method,
      path,
      body ? JSON.stringify(body) : undefined,
    );

    if (response.ok) {
      return;
    }

    const text = await response.text();
    throw new Error(
      `GeoServer request failed (${method} ${path}): ${response.status} ${text}`,
    );
  }

  private async requestRaw(
    method: string,
    path: string,
    body?: string,
  ): Promise<Response> {
    const base = this.baseUrl.replace(/\/$/, '');
    const url = `${base}/rest${path}`;
    const headers: Record<string, string> = {
      Authorization: `Basic ${Buffer.from(
        `${this.username}:${this.password}`,
      ).toString('base64')}`,
      Accept: 'application/json',
    };

    if (body) {
      headers['Content-Type'] = 'application/json';
    }

    return fetch(url, {
      method,
      headers,
      body,
    });
  }
}
