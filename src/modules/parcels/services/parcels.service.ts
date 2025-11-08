import '../../../common/polyfills/global-this';
import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
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
import { UpdateParcelDto } from '../dtos/request/update-parcel.dto';
  
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
      images?: Express.Multer.File[],
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
  
      const imageUrls = images?.length
        ? images.map((file) => `/uploads/parcels/${file.filename}`)
        : undefined;

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
      imageUrls,
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
            imageUrls: parcel.imageUrls,
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
    
    // ──────────────────────────────── FIND ONE PARCEL ────────────────────────────────
    async findOne(id: string, asGeoJson = false): Promise<any> {
        // Find parcel with related entities
        const parcel = await this.parcelRepository.findOne({
        where: { id },
        relations: ['createdBy', 'owner'],
        });
    
        if (!parcel) {
        throw new BadRequestException(PARCEL_MESSAGES.NOT_FOUND);
        }
    
        // If GeoJSON output is requested
        if (asGeoJson) {
        return {
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
            imageUrls: parcel.imageUrls,
            shapefileUrl: parcel.shapefileUrl,
            status: parcel.status,
            createdBy: parcel.createdBy
                ? `${parcel.createdBy.firstName} ${parcel.createdBy.lastName}`
                : null,
            owner: parcel.owner
                ? `${parcel.owner.firstName} ${parcel.owner.lastName}`
                : null,
            createdAt: parcel.createdAt,
            updatedAt: parcel.updatedAt,
            },
        };
        }
    
        // Default JSON structure
        return parcel;
    }

    // ──────────────────────────────── UPDATE PARCEL ────────────────────────────────
    async update(
        id: string,
        dto: UpdateParcelDto,
        _user: AuthenticatedUser,
        images?: Express.Multer.File[],
        shapefile?: Express.Multer.File,
    ): Promise<{ message: string; data: Parcel }> {
        // 1️⃣ Load existing parcel
        const parcel = await this.parcelRepository.findOne({
        where: { id },
        relations: ['createdBy', 'owner'],
        });

        if (!parcel) {
        throw new NotFoundException(PARCEL_MESSAGES.NOT_FOUND);
        }

        let geometryWasUpdated = false;
        let newGeometry = dto.geometry;

        // 2️⃣ If shapefile was uploaded, parse and replace geometry
        if (!newGeometry && shapefile) {
        const filePath = path.join(process.cwd(), 'uploads/parcels', shapefile.filename);
        try {
            const fileBuffer = fs.readFileSync(filePath);
            const geojson = await shp(fileBuffer);
            if (!geojson.features?.length) {
            throw new BadRequestException(PARCEL_MESSAGES.SHAPEFILE_EMPTY);
            }
            newGeometry = geojson.features[0].geometry;
            geometryWasUpdated = true;
            parcel.shapefileUrl = `/uploads/parcels/${shapefile.filename}`;
        } catch (error) {
            throw new BadRequestException(PARCEL_MESSAGES.SHAPEFILE_PARSE_ERROR);
        }
        }

        // 3️⃣ If geometry was sent directly in body, update it
        if (newGeometry) {
        // validate & compute
        try {
            const feature = turf.feature(newGeometry);
            const area = turf.area(feature);
            const perimeter = Number(
            (turf.length(feature, { units: 'kilometers' }) * 1000).toFixed(2),
            );

            parcel.geometry = newGeometry;
            parcel.area = area;
            parcel.perimeter = perimeter;
            geometryWasUpdated = true;
        } catch {
            throw new BadRequestException(PARCEL_MESSAGES.GEOMETRY_INVALID);
        }
        }

        // 4️⃣ Update simple scalar fields
        if (dto.name !== undefined) parcel.name = dto.name;
        if (dto.description !== undefined) parcel.description = dto.description;
        if (dto.titleNumber !== undefined) parcel.titleNumber = dto.titleNumber;
        if (dto.population !== undefined) parcel.population = dto.population;
        if (dto.status !== undefined) parcel.status = dto.status;

        // (optional) future: if you add owner_id to dto, set parcel.owner = {id: ...}

        // 5️⃣ Handle image upload + optional deletion of old image
        if (images?.length) {
        const newImageUrls = images.map(
            (file) => `/uploads/parcels/${file.filename}`,
        );
        const wantsDelete = Boolean(dto.deleteOldImage);
        const existingImages = parcel.imageUrls ?? [];

        if (wantsDelete && existingImages.length) {
            // Delete existing files before replacing references
            existingImages.forEach((imagePath) => {
            const absolute = path.join(
                process.cwd(),
                imagePath.replace(/^\//, ''),
            );
            fs.promises
                .stat(absolute)
                .then(() => fs.promises.unlink(absolute))
                .catch(() => undefined);
            });
            parcel.imageUrls = newImageUrls;
        } else {
            parcel.imageUrls = [...existingImages, ...newImageUrls];
        }
        }

        // 6️⃣ Save updates
        try {
        const saved = await this.parcelRepository.save(parcel);
        return { message: PARCEL_MESSAGES.UPDATED, data: saved };
        } catch (error) {
        throw new InternalServerErrorException(PARCEL_MESSAGES.UPDATE_FAILED);
        }
    }
  
  }
  
