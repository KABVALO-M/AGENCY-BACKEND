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

@ApiTags('Parcels')
@ApiBearerAuth()
@Controller('parcels')
export class ParcelsController {
  constructor(private readonly parcelsService: ParcelsService) {}

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
      'Parcel details plus optional `images` (multiple) and `shapefile` uploads (zipped shapefile).',
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
        shapefile: { type: 'string', format: 'binary' },
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
      'Allows partial updates. You can update metadata, upload additional images, or upload a new shapefile to replace geometry. Use deleteOldImage=true to replace existing images instead of appending.',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    description: 'Parcel UUID',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description:
      'Any subset of parcel fields, plus optional new images/shapefile and deleteOldImage flag.',
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
        shapefile: { type: 'string', format: 'binary' },
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
}
