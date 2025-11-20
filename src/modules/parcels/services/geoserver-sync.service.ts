import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'fs';
import { join } from 'path';
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
  private readonly defaultStyleName: string;
  private readonly defaultStylePath: string;
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
    this.defaultStyleName =
      this.configService.get<string>('GEOSERVER_STYLE_NAME') ?? 'generic';
    this.defaultStylePath =
      this.configService.get<string>('GEOSERVER_STYLE_PATH') ??
      join(
        process.cwd(),
        'resources',
        'geoserver',
        'styles',
        `${this.defaultStyleName}.sld`,
      );

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
    await this.ensureDefaultStyle();

    const publishedLayers: string[] = [];
    for (const layer of GEOSERVER_LAYER_CONFIGS) {
      const published = await this.publishLayer(layer);
      await this.assignStyleToLayer(layer.name);
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

  private async ensureDefaultStyle(): Promise<void> {
    let sldContent: string;
    try {
      sldContent = readFileSync(this.defaultStylePath, 'utf8');
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to read GeoServer style file at ${this.defaultStylePath}: ${err.message}`,
      );
      throw err;
    }

    const stylePath = `/workspaces/${this.workspace}/styles/${this.defaultStyleName}.json`;
    const exists = await this.exists(stylePath).catch((error) => {
      this.logger.error(`Style check failed: ${(error as Error).message}`);
      throw error;
    });

    await this.uploadStyle(this.defaultStyleName, sldContent, exists);
  }

  private async uploadStyle(
    name: string,
    sldContent: string,
    replaceExisting: boolean,
  ): Promise<void> {
    const base = this.baseUrl.replace(/\/$/, '');
    const path = replaceExisting
      ? `/workspaces/${this.workspace}/styles/${name}`
      : `/workspaces/${this.workspace}/styles?name=${name}`;
    const method = replaceExisting ? 'PUT' : 'POST';
    const response = await fetch(`${base}/rest${path}`, {
      method,
      headers: this.buildAuthHeaders({
        'Content-Type': 'application/vnd.ogc.sld+xml',
        Accept: 'application/json',
      }),
      body: sldContent,
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Failed to ${replaceExisting ? 'update' : 'create'} style ${name}: ${
          response.status
        } ${text}`,
      );
    }
    this.logger.log(
      `GeoServer style ${name} ${replaceExisting ? 'updated' : 'created'} (${
        response.status
      })`,
    );
  }

  private async assignStyleToLayer(layerName: string): Promise<void> {
    const layerPath = `/layers/${this.workspace}:${layerName}.json`;
    const response = await this.requestRaw('GET', layerPath);

    if (response.status === 404) {
      this.logger.warn(
        `Layer ${layerName} not found when assigning style ${this.defaultStyleName}`,
      );
      return;
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Failed to fetch layer ${layerName} for styling: ${response.status} ${text}`,
      );
    }

    const currentConfig = await response.json();
    const currentStyles =
      currentConfig?.layer?.styles?.style && Array.isArray(currentConfig.layer.styles.style)
        ? currentConfig.layer.styles.style
        : currentConfig?.layer?.styles?.style
          ? [currentConfig.layer.styles.style]
          : [];
    const hasDefault =
      currentConfig?.layer?.defaultStyle?.name === this.defaultStyleName;
    const alreadyListed = currentStyles.some(
      (style: { name?: string }) => style?.name === this.defaultStyleName,
    );

    if (hasDefault && alreadyListed) {
      return;
    }

    const payload = {
      layer: {
        ...currentConfig.layer,
        defaultStyle: { name: this.defaultStyleName },
        styles: {
          style: alreadyListed
            ? currentStyles
            : [...currentStyles, { name: this.defaultStyleName }],
        },
      },
    };

    await this.request(
      'PUT',
      `/layers/${this.workspace}:${layerName}`,
      payload,
    );
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

  private buildAuthHeaders(
    extra?: Record<string, string>,
  ): Record<string, string> {
    return {
      Authorization: `Basic ${Buffer.from(
        `${this.username}:${this.password}`,
      ).toString('base64')}`,
      ...(extra ?? {}),
    };
  }

  private async logResponseDetails(
    response: globalThis.Response,
    context: string,
  ): Promise<void> {
    const loggerMethod = response.ok
      ? this.logger.debug.bind(this.logger)
      : this.logger.warn.bind(this.logger);
    const contentType = response.headers.get('content-type') ?? 'unknown';
    let bodyPreview = '<binary content omitted>';
    if (
      contentType.includes('application/json') ||
      contentType.includes('text/')
    ) {
      try {
        const text = await response.clone().text();
        bodyPreview = text.slice(0, 500);
      } catch (error) {
        bodyPreview = `<failed to read body: ${
          error instanceof Error ? error.message : 'unknown error'
        }>`;
      }
    }
    loggerMethod(
      `${context} -> ${response.status} (${contentType}) body: ${bodyPreview}`,
    );
  }

  private async requestRaw(
    method: string,
    path: string,
    body?: string,
  ): Promise<globalThis.Response> {
    const base = this.baseUrl.replace(/\/$/, '');
    const url = `${base}/rest${path}`;
    this.logger.debug(
      `GeoServer REST request: ${method.toUpperCase()} ${url}`,
    );
    const headers: Record<string, string> = this.buildAuthHeaders({
      Accept: 'application/json',
    });

    if (body) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, {
      method,
      headers,
      body,
    });
    await this.logResponseDetails(
      response,
      `GeoServer REST response ${method.toUpperCase()} ${url}`,
    );
    return response;
  }

  async fetchLegendGraphic(params: {
    layer: string;
    style?: string;
    width?: number;
    height?: number;
    format?: string;
  }): Promise<{ buffer: Buffer; contentType?: string }> {
    const { layer, style, width, height, format } = params;
    const base = this.baseUrl.replace(/\/$/, '');
    const url = new URL(`${base}/${this.workspace}/ows`);
    url.searchParams.set('service', 'WMS');
    url.searchParams.set('version', '1.3.0');
    url.searchParams.set('request', 'GetLegendGraphic');
    url.searchParams.set('layer', layer.includes(':') ? layer : `${this.workspace}:${layer}`);
    url.searchParams.set('format', format ?? 'image/png');
    url.searchParams.set('width', String(width ?? 20));
    url.searchParams.set('height', String(height ?? 20));
    if (style) {
      url.searchParams.set('style', style);
    }

    const requestUrl = url.toString();
    this.logger.log(
      `Fetching legend from GeoServer: ${requestUrl}`,
    );
    const response = await fetch(requestUrl, {
      headers: this.buildAuthHeaders({
        Accept: 'image/png, image/*;q=0.8, */*;q=0.5',
      }),
    });
    if (!response.ok) {
      const text = await response.text();
      this.logger.error(
        `Legend request failed (${response.status}): ${text}`,
      );
      throw new Error(
        `Legend request failed: ${response.status} ${text}`,
      );
    }
    const arrayBuffer = await response.arrayBuffer();
    this.logger.debug(
      `Legend request succeeded (${response.status}) ${requestUrl} -> ${arrayBuffer.byteLength} bytes`,
    );
    return {
      buffer: Buffer.from(arrayBuffer),
      contentType: response.headers.get('content-type') ?? undefined,
    };
  }

  async proxyWmsRequest(query: Record<string, any>): Promise<{
    buffer: Buffer;
    contentType?: string;
  }> {
    const base = this.baseUrl.replace(/\/$/, '');
    const url = new URL(`${base}/${this.workspace}/wms`);
    const searchParams = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach((v) => searchParams.append(key, String(v)));
      } else if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });
    url.search = searchParams.toString();

    const requestUrl = url.toString();
    this.logger.debug(
      `Proxying WMS request to GeoServer: ${requestUrl}`,
    );
    const response = await fetch(requestUrl, {
      headers: this.buildAuthHeaders({
        Accept: 'image/png, image/*;q=0.8, */*;q=0.5',
      }),
    });
    if (!response.ok) {
      const text = await response.text();
      this.logger.error(
        `WMS proxy request failed (${response.status}): ${text}`,
      );
      throw new Error(
        `WMS proxy request failed: ${response.status} ${text}`,
      );
    }
    const arrayBuffer = await response.arrayBuffer();
    this.logger.debug(
      `WMS proxy request succeeded (${response.status}) ${requestUrl} -> ${arrayBuffer.byteLength} bytes`,
    );
    return {
      buffer: Buffer.from(arrayBuffer),
      contentType: response.headers.get('content-type') ?? undefined,
    };
  }
}
