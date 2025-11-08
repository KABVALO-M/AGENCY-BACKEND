import '../../../common/polyfills/global-this';
import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';
import { Parcel } from '../entities/parcel.entity';
import { CreateParcelDto } from '../dtos/request/create-parcel.dto';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import type { User } from '../../users/entities/user.entity';
import { PARCEL_MESSAGES } from '../messages/parcel.messages';
import { ParcelStatus } from '../constants/parcel-status.constant';
import * as fs from 'fs';
import * as path from 'path';
import * as turf from '@turf/turf';
import shp from 'shpjs';
  
  @Injectable()
  export class ParcelsService {
    constructor(
      @InjectRepository(Parcel)
      private readonly parcelRepository: Repository<Parcel>,
    ) {}
  
    // ──────────────────────────────── CREATE PARCEL ────────────────────────────────
    async create(
      dto: CreateParcelDto,
      user: AuthenticatedUser,
      image?: Express.Multer.File,
      shapefile?: Express.Multer.File,
    ): Promise<{ message: string; data: Parcel }> {
      let geometry = dto.geometry;
  
      // 1️⃣ Parse shapefile if uploaded
      if (!geometry && shapefile) {
        const filePath = path.join(process.cwd(), 'uploads/parcels', shapefile.filename);
        try {
          const fileBuffer = fs.readFileSync(filePath);
          const geojson = await shp(fileBuffer);
          if (!geojson.features?.length) {
            throw new BadRequestException(PARCEL_MESSAGES.SHAPEFILE_EMPTY);
          }
          geometry = geojson.features[0].geometry;
        } catch (error) {
          throw new BadRequestException(PARCEL_MESSAGES.SHAPEFILE_PARSE_ERROR);
        }
      }
  
      if (!geometry) {
        throw new BadRequestException(PARCEL_MESSAGES.GEOMETRY_REQUIRED);
      }
  
      // 2️⃣ Compute area & perimeter using turf.js
      let area = 0;
      let perimeter = 0;
      try {
        const feature = turf.feature(geometry);
        area = turf.area(feature); // m²
        perimeter = Number(
          (turf.length(feature, { units: 'kilometers' }) * 1000).toFixed(2),
        ); // meters
      } catch {
        throw new BadRequestException(PARCEL_MESSAGES.GEOMETRY_INVALID);
      }
  
      // 3️⃣ Create Parcel entity
    const parcelData: DeepPartial<Parcel> = {
      name: dto.name,
      description: dto.description,
      titleNumber: dto.titleNumber,
      geometry,
      area,
      perimeter,
      population: dto.population,
      status: dto.status ?? ParcelStatus.AVAILABLE,
      createdBy: { id: user.id } as DeepPartial<User>,
      owner: undefined,
      imageUrl: image ? `/uploads/parcels/${image.filename}` : undefined,
      shapefileUrl: shapefile ? `/uploads/parcels/${shapefile.filename}` : undefined,
    };
    const parcel = this.parcelRepository.create(parcelData);
  
      // 4️⃣ Save to DB
      try {
        const saved = await this.parcelRepository.save(parcel);
        return { message: PARCEL_MESSAGES.CREATED, data: saved };
      } catch (error) {
        throw new InternalServerErrorException(PARCEL_MESSAGES.CREATE_FAILED);
      }
    }

    // ──────────────────────────────── FIND ALL PARCELS ────────────────────────────────
    async findAll(options?: { asGeoJson?: boolean; status?: ParcelStatus }) {
        const { asGeoJson = false, status } = options || {};
    
        // Base query builder
        const query = this.parcelRepository
        .createQueryBuilder('parcel')
        .leftJoinAndSelect('parcel.createdBy', 'createdBy')
        .leftJoinAndSelect('parcel.owner', 'owner')
        .orderBy('parcel.createdAt', 'DESC');
    
        if (status) {
        query.andWhere('parcel.status = :status', { status });
        }
    
        const parcels = await query.getMany();
    
        // If no parcels
        if (!parcels.length) {
        return asGeoJson
            ? { type: 'FeatureCollection', features: [] }
            : [];
        }
    
        // Transform to GeoJSON format if requested
        if (asGeoJson) {
        const features = parcels.map((parcel) => ({
            type: 'Feature',
            geometry: parcel.geometry,
            properties: {
            id: parcel.id,
            name: parcel.name,
            description: parcel.description,
            titleNumber: parcel.titleNumber,
            area: parcel.area,
            perimeter: parcel.perimeter,
            population: parcel.population,
            imageUrl: parcel.imageUrl,
            shapefileUrl: parcel.shapefileUrl,
            status: parcel.status,
            createdBy: parcel.createdBy
                ? `${parcel.createdBy.firstName} ${parcel.createdBy.lastName}`
                : null,
            owner: parcel.owner
                ? `${parcel.owner.firstName} ${parcel.owner.lastName}`
                : null,
            createdAt: parcel.createdAt,
            },
        }));
    
        return {
            type: 'FeatureCollection',
            features,
        };
        }
    
        // Default JSON format
        return parcels;
    }
    
  }
  
