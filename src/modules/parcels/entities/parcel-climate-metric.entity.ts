import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { Geometry } from 'geojson';
import { Parcel } from './parcel.entity';

@Entity('parcel_climate_metrics')
@Index(['parcel', 'metricDate'])
export class ParcelClimateMetric {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Parcel, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parcel_id' })
  parcel: Parcel;

  @Column({ type: 'date', nullable: true })
  metricDate?: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  avgTemperatureC?: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  maxTemperatureC?: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  minTemperatureC?: number;

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  rainfallMm?: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  humidityPercentage?: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  floodRiskScore?: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  droughtRiskScore?: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  seaLevelRiskScore?: number;

  @Column({ type: 'decimal', precision: 7, scale: 2, nullable: true })
  elevationMeters?: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  slopeDegrees?: number;

  @Column({ type: 'geometry', srid: 4326, nullable: true })
  sampleArea?: Geometry;

  @Column({ length: 150, nullable: true })
  dataSource?: string;

  @Column({ type: 'timestamp', nullable: true })
  collectedAt?: Date;

  @Column({ length: 120, nullable: true })
  createdBy?: string;

  @Column({ length: 120, nullable: true })
  updatedBy?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

