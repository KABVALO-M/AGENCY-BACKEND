import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
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
  geometry: any;

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

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  area?: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  perimeter?: number;

  @Column({ type: 'int', nullable: true })
  population?: number;

  // ─────────────── TIMESTAMPS ───────────────
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
