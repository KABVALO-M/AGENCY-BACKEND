import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import type { Geometry } from 'geojson';
import { User } from '../../users/entities/user.entity';
import { ParcelStatus } from '../constants/parcel-status.constant';

@Entity('parcels')
export class Parcel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ─────────────── BASIC INFO ───────────────
  @Column({ length: 150 })
  name: string;

  @Column({ nullable: true, type: 'text' })
  description?: string;

  @Column({ nullable: true, length: 100 })
  titleNumber?: string;

  // ─────────────── GEOMETRY ───────────────
  @Column({
    type: 'geometry',
    spatialFeatureType: 'Polygon',
    srid: 4326,
  })
  geometry: Geometry;

  // ─────────────── OWNER RELATION ───────────────
  @ManyToOne(() => User, { eager: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'owner_id' })
  owner: User;

  // ─────────────── ADMIN CREATOR RELATION ───────────────
  @ManyToOne(() => User, { eager: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User;

  // ─────────────── ADDITIONAL INFO ───────────────
  @Column('text', { array: true, nullable: true })
  imageUrls?: string[];

  @Column({ nullable: true })
  shapefileUrl?: string;

  @Column({
    type: 'enum',
    enum: ParcelStatus,
    default: ParcelStatus.AVAILABLE,
  })
  status: ParcelStatus;

  // Changed from decimal(12, 2) to decimal(15, 2) to support larger areas
  // Max value: 10^13 = 10,000,000,000,000 m² (10 million km²)
  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  area?: number;

  // Changed from decimal(12, 2) to decimal(15, 2) to support larger perimeters
  // Max value: 10^13 = 10,000,000,000,000 m (10 billion km)
  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  perimeter?: number;

  @Column({ type: 'int', nullable: true })
  population?: number;

  // ─────────────── TIMESTAMPS ───────────────
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // ─────────────── SOFT DELETE ───────────────
  /**
   * When this column has a value, the parcel is considered deleted.
   * If null, the parcel is active.
   */
  @Column({ type: 'timestamp', nullable: true })
  deletedAt?: Date;
}
