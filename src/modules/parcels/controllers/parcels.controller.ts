import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ParcelsService } from '../services/parcels.service';
import { CreateParcelDto } from '../dtos/request/create-parcel.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.type';

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
        status: { type: 'string', example: 'available' },
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
}
