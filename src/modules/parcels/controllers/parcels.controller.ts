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
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { ParcelsService } from '../services/parcels.service';
import { CreateParcelDto } from '../dtos/request/create-parcel.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { ParcelStatus } from '../constants/parcel-status.constant';

@ApiTags('Parcels')
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
      'Parcel details plus optional `image` and `shapefile` uploads (zipped shapefile).',
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
        image: { type: 'string', format: 'binary' },
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
        { name: 'image', maxCount: 1 },
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
    files: { image?: Express.Multer.File[]; shapefile?: Express.Multer.File[] },
    @Body() dto: CreateParcelDto,
  ) {
    const image = files?.image?.[0];
    const shapefile = files?.shapefile?.[0];
    return this.parcelsService.create(dto, user, image, shapefile);
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
    @Query('asGeoJson') asGeoJson?: string,
    @Query('status', new ParseEnumPipe(ParcelStatus, { optional: true }))
    status?: ParcelStatus,
  ) {
    const geo = asGeoJson === 'true';
    return this.parcelsService.findAll({ asGeoJson: geo, status });
  }
}
