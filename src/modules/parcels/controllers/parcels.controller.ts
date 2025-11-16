import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  Body,
  HttpCode,
  HttpStatus,
  Get,
  Query,
  ParseEnumPipe,
  Param,
  ParseBoolPipe,
  Patch,
  Delete,
  Logger,
  BadRequestException,
  Res,
  Req,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { ParcelsService } from '../services/parcels.service';
import { CreateParcelDto } from '../dtos/request/create-parcel.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { ParcelStatus } from '../constants/parcel-status.constant';
import { UpdateParcelDto } from '../dtos/request/update-parcel.dto';
import { CreateParcelPopulationStatDto } from '../dtos/request/create-parcel-population-stat.dto';
import { CreateParcelFacilityDto } from '../dtos/request/create-parcel-facility.dto';
import { CreateParcelClimateMetricDto } from '../dtos/request/create-parcel-climate-metric.dto';
import { UpsertParcelRiskInputDto } from '../dtos/request/upsert-parcel-risk-input.dto';
import { CreateParcelRiskAssessmentDto } from '../dtos/request/create-parcel-risk-assessment.dto';
import { CreateParcelLocationInsightDto } from '../dtos/request/create-parcel-location-insight.dto';
import { RefreshMaterializedViewDto } from '../dtos/request/refresh-materialized-view.dto';
import {
  GeoServerSyncService,
  GeoServerSyncResult,
} from '../services/geoserver-sync.service';
import { ParcelReportService } from '../services/parcel-report.service';
import type { Response, Request } from 'express';

@ApiTags('Parcels')
@ApiBearerAuth()
@Controller('parcels')
export class ParcelsController {
  private readonly logger = new Logger(ParcelsController.name);

  constructor(
    private readonly parcelsService: ParcelsService,
    private readonly geoServerSyncService: GeoServerSyncService,
    private readonly parcelReportService: ParcelReportService,
  ) {}

  // ──────────────────────────────── CREATE PARCEL ────────────────────────────────
  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a parcel record',
    description:
      'Accepts parcel metadata plus optional image/shapefile uploads and stores the geometry.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description:
      'Parcel details plus optional `images` (multiple) and `shapefile` uploads (.zip Shapefile, .kml, .kmz, or .geojson).',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'Parcel 17 - Downtown' },
        description: { type: 'string', example: 'Vacant lot close to the river.' },
        titleNumber: { type: 'string', example: 'TTX-009123' },
        geometry: {
          type: 'object',
          example: {
            type: 'Polygon',
            coordinates: [
              [
                [30.121, -1.951],
                [30.122, -1.951],
                [30.122, -1.952],
                [30.121, -1.952],
                [30.121, -1.951],
              ],
            ],
          },
        },
        population: { type: 'number', example: 125 },
        status: {
          type: 'string',
          enum: Object.values(ParcelStatus),
          example: ParcelStatus.AVAILABLE,
        },
        images: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
        shapefile: {
          type: 'string',
          format: 'binary',
          description: 'Geo data file (.zip shapefile, .kml, .kmz, or .geojson)',
        },
      },
      required: ['name'],
    },
  })
  @ApiCreatedResponse({
    description: 'Returns the newly created parcel record.',
  })
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'images', maxCount: 5 },
        { name: 'shapefile', maxCount: 1 },
      ],
      {
        storage: diskStorage({
          destination: './uploads/parcels',
          filename: (_req, file, cb) => {
            const unique = `${Date.now()}-${file.originalname}`;
            cb(null, unique);
          },
        }),
      },
    ),
  )
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFiles()
    files: { images?: Express.Multer.File[]; shapefile?: Express.Multer.File[] },
    @Body() dto: CreateParcelDto,
  ) {
    const images = files?.images;
    const shapefile = files?.shapefile?.[0];

    this.logger.debug(
      `Create parcel payload: ${JSON.stringify({
        dto: {
          name: dto.name,
          hasGeometry: Boolean(dto.geometry),
          status: dto.status,
          population: dto.population,
        },
        files: {
          imageCount: images?.length ?? 0,
          hasShapefile: Boolean(shapefile),
          shapefileName: shapefile?.originalname ?? null,
        },
      })}`,
    );

    return this.parcelsService.create(dto, user, images, shapefile);
  }

  // ──────────────────────────────── FIND ALL PARCELS ────────────────────────────────
  @Get()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Retrieve all parcel records',
    description:
      'Returns all parcels. Use `?asGeoJson=true` for GeoJSON format or `?status=available` to filter by status.',
  })
  @ApiQuery({
    name: 'asGeoJson',
    required: false,
    type: Boolean,
    description: 'Return results in GeoJSON format if true',
    example: false,
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ParcelStatus,
    description: 'Filter parcels by status (available or sold)',
    example: ParcelStatus.AVAILABLE,
  })
  @ApiOkResponse({
    description: 'Returns a list of all parcels or GeoJSON FeatureCollection.',
  })
  async findAll(
    @Query('asGeoJson', new ParseBoolPipe({ optional: true }))
    asGeoJson?: boolean,
    @Query('status', new ParseEnumPipe(ParcelStatus, { optional: true }))
    status?: ParcelStatus,
  ) {
    const geo = asGeoJson ?? false;
    return this.parcelsService.findAll({ asGeoJson: geo, status });
  }

  // ──────────────────────────────── MATERIALIZED VIEW STATUS ────────────────────────────────
  @Get('materialized-views/status')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get materialized view statuses',
    description: 'Lists the tracked parcel analytics materialized views and their last refresh metadata.',
  })
  async getMaterializedViewStatus() {
    return this.parcelsService.getMaterializedViewStatuses();
  }

  // ──────────────────────────────── MATERIALIZED VIEW REFRESH ────────────────────────────────
  @Post('materialized-views/refresh')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Trigger a materialized view refresh',
    description: 'Refreshes the parcel analytics materialized views immediately.',
  })
  async refreshMaterializedViews(@Body() dto: RefreshMaterializedViewDto) {
    return this.parcelsService.refreshMaterializedViews(dto);
  }

  // ──────────────────────────────── GEOSERVER SYNC ────────────────────────────────
  @Post('geoserver/sync')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Synchronize GeoServer workspace, datastore, and layers',
    description:
      'Ensures the configured workspace/datastore exist and publishes parcels analytics tables as layers.',
  })
  async syncGeoServer(): Promise<{
    message: string;
    data: GeoServerSyncResult;
  }> {
    return this.geoServerSyncService.syncAll();
  }

  @Get('geoserver/legend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Proxy GeoServer legend graphic',
    description:
      'Fetches the WMS legend graphic through the backend so browsers avoid cross-origin restrictions.',
  })
  async getLegendGraphic(
    @Query('layer') layer: string,
    @Res() res: Response,
    @Query('style') style?: string,
    @Query('width') width?: number,
    @Query('height') height?: number,
  ) {
    if (!layer) {
      throw new BadRequestException('Layer query parameter is required.');
    }
    const parsedWidth = width ? Number(width) : undefined;
    const parsedHeight = height ? Number(height) : undefined;
    const result = await this.geoServerSyncService.fetchLegendGraphic({
      layer,
      style,
      width: parsedWidth,
      height: parsedHeight,
    });
    res.setHeader('Content-Type', result.contentType ?? 'image/png');
    res.send(result.buffer);
  }

  @Get('geoserver/wms-proxy')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Proxy GeoServer WMS requests',
    description: 'Fetches WMS tiles via the backend to avoid browser cross-origin issues.',
  })
  async proxyWms(
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const result = await this.geoServerSyncService.proxyWmsRequest(req.query);
    res.setHeader('Content-Type', result.contentType ?? 'image/png');
    res.send(result.buffer);
  }

  // ──────────────────────────────── RISK SUMMARY ────────────────────────────────
  @Get(':id/risk-summary')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get latest risk summary for a parcel',
  })
  async getParcelRiskSummary(@Param('id') id: string) {
    return this.parcelsService.getParcelRiskSummary(id);
  }

  // ──────────────────────────────── TOP RISK PARCELS ────────────────────────────────
  @Get('analytics/top-risk')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List highest-risk parcels',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Max parcels to return (default 5)',
  })
  async getTopRiskParcels(@Query('limit') limit?: number) {
    const parsed = limit && Number(limit) > 0 ? Number(limit) : undefined;
    return this.parcelsService.getTopRiskParcels(parsed);
  }

  // ──────────────────────────────── GET ONE PARCEL ────────────────────────────────
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Retrieve a parcel by its ID',
    description:
      'Returns a single parcel record. Use `?asGeoJson=true` to receive GeoJSON format.',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    description: 'Parcel UUID',
    example: '07cf1b52-fb4d-46e8-8c4a-b29a4ab2dfee',
  })
  @ApiQuery({
    name: 'asGeoJson',
    required: false,
    type: Boolean,
    description: 'If true, returns parcel geometry as GeoJSON feature',
    example: false,
  })
  @ApiOkResponse({
    description: 'Returns parcel details or GeoJSON feature.',
  })
  async findOne(
    @Param('id') id: string,
    @Query('asGeoJson', new ParseBoolPipe({ optional: true }))
    asGeoJson?: boolean,
  ) {
    const geo = asGeoJson ?? false;
    return this.parcelsService.findOne(id, geo);
  }

  // ──────────────────────────────── UPDATE/PATCH PARCEL ────────────────────────────────
  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update a parcel record',
    description:
      'Allows partial updates. You can update metadata, upload additional images, or upload a new Geo file (.zip/.kml/.kmz/.geojson) to replace geometry. Use deleteOldImage=true to replace existing images instead of appending.',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    description: 'Parcel UUID',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description:
      'Any subset of parcel fields, plus optional new images/geo file (.zip/.kml/.kmz/.geojson) and deleteOldImage flag.',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'Updated Parcel 17' },
        description: { type: 'string' },
        titleNumber: { type: 'string' },
        status: { type: 'string', example: 'available' },
        population: { type: 'number', example: 4100 },
        geometry: {
          type: 'object',
          example: {
            type: 'Polygon',
            coordinates: [
              [
                [30.121, -1.951],
                [30.122, -1.951],
                [30.122, -1.952],
                [30.121, -1.952],
                [30.121, -1.951],
              ],
            ],
          },
        },
        deleteOldImage: { type: 'boolean', example: true },
        images: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
        shapefile: {
          type: 'string',
          format: 'binary',
          description: 'Geo data file (.zip shapefile, .kml, .kmz, or .geojson)',
        },
      },
    },
  })
  @ApiOkResponse({
    description: 'Returns the updated parcel.',
  })
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'images', maxCount: 5 },
        { name: 'shapefile', maxCount: 1 },
      ],
      {
        storage: diskStorage({
          destination: './uploads/parcels',
          filename: (_req, file, cb) => {
            const unique = `${Date.now()}-${file.originalname}`;
            cb(null, unique);
          },
        }),
      },
    ),
  )
  async update(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFiles()
    files: {
      images?: Express.Multer.File[];
      shapefile?: Express.Multer.File[];
    },
    @Body() dto: UpdateParcelDto,
  ) {
    const images = files?.images;
    const shapefile = files?.shapefile?.[0];
    return this.parcelsService.update(id, dto, user, images, shapefile);
  }

  // ──────────────────────────────── DELETE (SOFT) PARCEL ────────────────────────────────
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Soft delete a parcel',
    description:
      'Marks the parcel as deleted by setting deletedAt timestamp. It remains in the database but will be excluded from normal queries.',
  })
  @ApiParam({
    name: 'id',
    description: 'Parcel UUID',
    example: '07cf1b52-fb4d-46e8-8c4a-b29a4ab2dfee',
  })
  @ApiOkResponse({
    description: 'Parcel soft-deleted successfully.',
  })
  async softDelete(@Param('id') id: string) {
    return this.parcelsService.softDelete(id);
  }

  // ──────────────────────────────── POPULATION STAT ────────────────────────────────
  @Post(':id/population-stats')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Record a population statistic for a parcel',
  })
  async addPopulationStat(
    @Param('id') id: string,
    @Body() dto: CreateParcelPopulationStatDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.parcelsService.addPopulationStat(id, dto, user);
  }

  // ──────────────────────────────── FACILITY ────────────────────────────────
  @Post(':id/facilities')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Attach a nearby facility to a parcel',
  })
  async addFacility(
    @Param('id') id: string,
    @Body() dto: CreateParcelFacilityDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.parcelsService.addFacility(id, dto, user);
  }

  // ──────────────────────────────── CLIMATE METRIC ────────────────────────────────
  @Post(':id/climate-metrics')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Record climate/elevation metrics for a parcel',
  })
  async addClimateMetric(
    @Param('id') id: string,
    @Body() dto: CreateParcelClimateMetricDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.parcelsService.addClimateMetric(id, dto, user);
  }

  // ──────────────────────────────── RISK INPUT ────────────────────────────────
  @Post(':id/risk-inputs')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Upsert a risk input metric for a parcel',
  })
  async upsertRiskInput(
    @Param('id') id: string,
    @Body() dto: UpsertParcelRiskInputDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.parcelsService.upsertRiskInput(id, dto, user);
  }

  // ──────────────────────────────── RISK ASSESSMENT ────────────────────────────────
  @Post(':id/risk-assessments')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Store a computed risk assessment for a parcel',
  })
  async addRiskAssessment(
    @Param('id') id: string,
    @Body() dto: CreateParcelRiskAssessmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.parcelsService.addRiskAssessment(id, dto, user);
  }

  // ──────────────────────────────── LOCATION INSIGHT ────────────────────────────────
  @Post(':id/location-insights')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Record a narrative insight for the parcel',
  })
  async addLocationInsight(
    @Param('id') id: string,
    @Body() dto: CreateParcelLocationInsightDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.parcelsService.addLocationInsight(id, dto, user);
  }

  // ──────────────────────────────── REPORT DOWNLOAD ────────────────────────────────
  @Get(':id/report')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generate parcel PDF report',
  })
  async downloadReport(@Param('id') id: string, @Res() res: Response) {
    const buffer = await this.parcelReportService.generateParcelReport(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="parcel-${id}.pdf"`,
    );
    res.send(buffer);
  }
}
