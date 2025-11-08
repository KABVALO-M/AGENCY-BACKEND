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
  import { ParcelsService } from '../services/parcels.service';
  import { CreateParcelDto } from '../dtos/request/create-parcel.dto';
  import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
  import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
  
  @Controller('parcels')
  export class ParcelsController {
    constructor(private readonly parcelsService: ParcelsService) {}
  
    // ──────────────────────────────── CREATE PARCEL ────────────────────────────────
    @Post()
    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.CREATED)
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
  
