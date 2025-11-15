import '../../../common/polyfills/global-this';
import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial, IsNull } from 'typeorm';
import { Parcel } from '../entities/parcel.entity';
import { CreateParcelDto } from '../dtos/request/create-parcel.dto';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import type { User } from '../../users/entities/user.entity';
import { PARCEL_MESSAGES } from '../messages/parcel.messages';
import { ParcelStatus } from '../constants/parcel-status.constant';
import * as fs from 'fs';
import * as path from 'path';
import * as turf from '@turf/turf';
import { UpdateParcelDto } from '../dtos/request/update-parcel.dto';
import { parseGeometryFile } from '../utils/geometry-file.util';
import { ParcelPopulationStat } from '../entities/parcel-population-stat.entity';
import { ParcelFacility } from '../entities/parcel-facility.entity';
import { ParcelClimateMetric } from '../entities/parcel-climate-metric.entity';
import { ParcelRiskInput } from '../entities/parcel-risk-input.entity';
import { ParcelRiskAssessment } from '../entities/parcel-risk-assessment.entity';
import { ParcelLocationInsight } from '../entities/parcel-location-insight.entity';
import { MaterializedViewRefresh } from '../entities/materialized-view-refresh.entity';
import { CreateParcelPopulationStatDto } from '../dtos/request/create-parcel-population-stat.dto';
import { CreateParcelFacilityDto } from '../dtos/request/create-parcel-facility.dto';
import { CreateParcelClimateMetricDto } from '../dtos/request/create-parcel-climate-metric.dto';
import { UpsertParcelRiskInputDto } from '../dtos/request/upsert-parcel-risk-input.dto';
import { CreateParcelRiskAssessmentDto } from '../dtos/request/create-parcel-risk-assessment.dto';
import { CreateParcelLocationInsightDto } from '../dtos/request/create-parcel-location-insight.dto';
import { RefreshMaterializedViewDto } from '../dtos/request/refresh-materialized-view.dto';
import { ParcelSchemaService } from './parcel-schema.service';
import {
  PARCEL_MATERIALIZED_VIEWS,
  ParcelMaterializedView,
} from '../constants/materialized-view.constant';
import { ParcelIngestionService } from './parcel-ingestion.service';
  
  @Injectable()
  export class ParcelsService {
    constructor(
      @InjectRepository(Parcel)
      private readonly parcelRepository: Repository<Parcel>,
      @InjectRepository(ParcelPopulationStat)
      private readonly populationRepository: Repository<ParcelPopulationStat>,
      @InjectRepository(ParcelFacility)
      private readonly facilityRepository: Repository<ParcelFacility>,
      @InjectRepository(ParcelClimateMetric)
      private readonly climateRepository: Repository<ParcelClimateMetric>,
      @InjectRepository(ParcelRiskInput)
      private readonly riskInputRepository: Repository<ParcelRiskInput>,
      @InjectRepository(ParcelRiskAssessment)
      private readonly riskAssessmentRepository: Repository<ParcelRiskAssessment>,
      @InjectRepository(ParcelLocationInsight)
      private readonly insightRepository: Repository<ParcelLocationInsight>,
      @InjectRepository(MaterializedViewRefresh)
      private readonly viewRefreshRepository: Repository<MaterializedViewRefresh>,
      private readonly parcelSchemaService: ParcelSchemaService,
      private readonly parcelIngestionService: ParcelIngestionService,
    ) {}

    private async getParcelOrThrow(id: string): Promise<Parcel> {
      const parcel = await this.parcelRepository.findOne({ where: { id, deletedAt: IsNull() } });
      if (!parcel) {
        throw new NotFoundException(PARCEL_MESSAGES.NOT_FOUND);
      }
      return parcel;
    }

    private auditUser(user: AuthenticatedUser): string | undefined {
      return user?.email ?? user?.id ?? undefined;
    }
  
    // ──────────────────────────────── CREATE PARCEL ────────────────────────────────
    async create(
        dto: CreateParcelDto,
        user: AuthenticatedUser,
        images?: Express.Multer.File[],
        shapefile?: Express.Multer.File,
      ): Promise<{ message: string; data: Parcel }> {
        let geometry = dto.geometry;
      
        // ────────────────────────────── 1️⃣ Parse Uploaded File (if any)
        if (!geometry && shapefile) {
          const filePath = path.join(process.cwd(), "uploads/parcels", shapefile.filename);
          const fileBuffer = fs.readFileSync(filePath);
          geometry = await parseGeometryFile(fileBuffer, shapefile.originalname);
        }
      
        if (!geometry) {
          throw new BadRequestException(PARCEL_MESSAGES.GEOMETRY_REQUIRED);
        }
      
        // ────────────────────────────── 2️⃣ Compute area & perimeter using turf.js
        let area = 0;
        let perimeter = 0;
        try {
          const feature = turf.feature(geometry);
          area = turf.area(feature); // m²
          perimeter = Number((turf.length(feature, { units: "kilometers" }) * 1000).toFixed(2)); // meters
        } catch {
          throw new BadRequestException(PARCEL_MESSAGES.GEOMETRY_INVALID);
        }
      
        const imageUrls = images?.length
          ? images.map((file) => `/uploads/parcels/${file.filename}`)
          : undefined;
      
        // ────────────────────────────── 3️⃣ Build and save entity
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
          imageUrls,
          shapefileUrl: shapefile ? `/uploads/parcels/${shapefile.filename}` : undefined,
        };
      
        const parcel = this.parcelRepository.create(parcelData);
      
        try {
          const saved = await this.parcelRepository.save(parcel);
          this.parcelIngestionService.enqueue(saved.id, {
            reason: 'create',
            user,
            providedPopulation: dto.population,
            geometryChanged: true,
          });
          return { message: PARCEL_MESSAGES.CREATED, data: saved };
        } catch (error) {
          console.error("Parcel create error:", error);
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
        .where('parcel.deletedAt IS NULL')
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
        where: { id, deletedAt: IsNull() },
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
        user: AuthenticatedUser,
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
        const fileBuffer = fs.readFileSync(filePath);
        newGeometry = await parseGeometryFile(fileBuffer, shapefile.originalname);
        geometryWasUpdated = true;
        parcel.shapefileUrl = `/uploads/parcels/${shapefile.filename}`;
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
        const providedPopulation =
          dto.population !== undefined ? dto.population : undefined;
        this.parcelIngestionService.enqueue(saved.id, {
          reason: 'update',
          user,
          providedPopulation,
          geometryChanged: geometryWasUpdated,
        });
        return { message: PARCEL_MESSAGES.UPDATED, data: saved };
        } catch (error) {
        throw new InternalServerErrorException(PARCEL_MESSAGES.UPDATE_FAILED);
        }
    }
    
    // ──────────────────────────────── SOFT DELETE PARCEL ────────────────────────────────
    async softDelete(id: string): Promise<{ message: string }> {
        const parcel = await this.parcelRepository.findOne({ where: { id } });
    
        if (!parcel) {
        throw new NotFoundException(PARCEL_MESSAGES.NOT_FOUND);
        }
    
        if (parcel.deletedAt) {
        throw new BadRequestException(PARCEL_MESSAGES.ALREADY_DELETED);
        }
    
        parcel.deletedAt = new Date();
    
        try {
        await this.parcelRepository.save(parcel);
        return { message: PARCEL_MESSAGES.DELETED };
        } catch (error) {
        throw new InternalServerErrorException(PARCEL_MESSAGES.DELETE_FAILED);
        }
    }

    async addPopulationStat(
      parcelId: string,
      dto: CreateParcelPopulationStatDto,
      user: AuthenticatedUser,
    ) {
      const parcel = await this.getParcelOrThrow(parcelId);
      const auditUser = this.auditUser(user);
      const record = this.populationRepository.create({
        ...dto,
        parcel,
        createdBy: auditUser,
        updatedBy: auditUser,
      });
      const saved = await this.populationRepository.save(record);
      return { message: PARCEL_MESSAGES.POPULATION_STAT_CREATED, data: saved };
    }

    async addFacility(parcelId: string, dto: CreateParcelFacilityDto, user: AuthenticatedUser) {
      const parcel = await this.getParcelOrThrow(parcelId);
      const auditUser = this.auditUser(user);
      const facility = this.facilityRepository.create({
        ...dto,
        parcel,
        createdBy: auditUser,
        updatedBy: auditUser,
      });
      const saved = await this.facilityRepository.save(facility);
      return { message: PARCEL_MESSAGES.FACILITY_CREATED, data: saved };
    }

    async addClimateMetric(parcelId: string, dto: CreateParcelClimateMetricDto, user: AuthenticatedUser) {
      const parcel = await this.getParcelOrThrow(parcelId);
      const auditUser = this.auditUser(user);
      const metric = this.climateRepository.create({
        ...dto,
        parcel,
        createdBy: auditUser,
        updatedBy: auditUser,
      });
      const saved = await this.climateRepository.save(metric);
      return { message: PARCEL_MESSAGES.CLIMATE_METRIC_CREATED, data: saved };
    }

    async upsertRiskInput(parcelId: string, dto: UpsertParcelRiskInputDto, user: AuthenticatedUser) {
      const parcel = await this.getParcelOrThrow(parcelId);
      const auditUser = this.auditUser(user);
      let existing = await this.riskInputRepository.findOne({
        where: { parcel: { id: parcel.id }, metric: dto.metric },
      });

      if (!existing) {
        existing = this.riskInputRepository.create({
          ...dto,
          parcel,
          createdBy: auditUser,
          updatedBy: auditUser,
        });
      } else {
        existing.value = dto.value ?? existing.value;
        existing.weight = dto.weight ?? existing.weight;
        existing.normalizedScore = dto.normalizedScore ?? existing.normalizedScore;
        existing.dataSource = dto.dataSource ?? existing.dataSource;
        existing.metadata = dto.metadata ?? existing.metadata;
        existing.lastEvaluatedAt = dto.lastEvaluatedAt ?? existing.lastEvaluatedAt;
        existing.updatedBy = auditUser ?? existing.updatedBy;
      }

      const saved = await this.riskInputRepository.save(existing);
      return { message: PARCEL_MESSAGES.RISK_INPUT_RECORDED, data: saved };
    }

    async addRiskAssessment(
      parcelId: string,
      dto: CreateParcelRiskAssessmentDto,
      user: AuthenticatedUser,
    ) {
      const parcel = await this.getParcelOrThrow(parcelId);
      const auditUser = this.auditUser(user);
      const assessment = this.riskAssessmentRepository.create({
        ...dto,
        methodologyVersion: dto.methodologyVersion ?? 'v1',
        parcel,
        createdBy: auditUser,
        updatedBy: auditUser,
      });
      const saved = await this.riskAssessmentRepository.save(assessment);
      return { message: PARCEL_MESSAGES.RISK_ASSESSMENT_CREATED, data: saved };
    }

    async addLocationInsight(
      parcelId: string,
      dto: CreateParcelLocationInsightDto,
      user: AuthenticatedUser,
    ) {
      const parcel = await this.getParcelOrThrow(parcelId);
      const auditUser = this.auditUser(user);
      const insight = this.insightRepository.create({
        ...dto,
        parcel,
        createdBy: auditUser,
        updatedBy: auditUser,
      });
      const saved = await this.insightRepository.save(insight);
      return { message: PARCEL_MESSAGES.LOCATION_INSIGHT_CREATED, data: saved };
    }

    async refreshMaterializedViews(dto: RefreshMaterializedViewDto) {
      const targets: ParcelMaterializedView[] = dto.viewName
        ? [dto.viewName]
        : [...PARCEL_MATERIALIZED_VIEWS];
      for (const viewName of targets) {
        await this.parcelSchemaService.refreshMaterializedView(viewName);
      }
      return { message: PARCEL_MESSAGES.MATERIALIZED_VIEW_REFRESHED, views: targets };
    }

    async getMaterializedViewStatuses() {
      const statuses = await this.viewRefreshRepository.find({
        order: { viewName: 'ASC' },
      });
      return { message: PARCEL_MESSAGES.MATERIALIZED_VIEW_STATUS_FETCHED, data: statuses };
    }
  }
  
