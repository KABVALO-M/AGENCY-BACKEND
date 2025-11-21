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
import { ParcelFacilityType } from '../constants/parcel-facility-type.constant';

@Entity('parcel_facilities')
@Index(['parcel', 'facilityType'])
export class ParcelFacility {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Parcel, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parcel_id' })
  parcel: Parcel;

  @Column({ type: 'enum', enum: ParcelFacilityType })
  facilityType: ParcelFacilityType;

  @Column({ length: 150 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  importanceScore: number;

  @Column({ type: 'int', nullable: true })
  distanceMeters?: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @Column({ type: 'geometry', srid: 4326 })
  geometry: Geometry;

  @Column({ length: 150, nullable: true })
  source?: string;

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
