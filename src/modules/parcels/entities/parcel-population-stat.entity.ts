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

@Entity('parcel_population_stats')
@Index(['parcel', 'collectedAt'])
export class ParcelPopulationStat {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Parcel, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parcel_id' })
  parcel: Parcel;

  @Column({ type: 'int', nullable: true })
  population?: number;

  @Column({ type: 'int', nullable: true })
  households?: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  densityPerSqKm?: number;

  @Column({ type: 'decimal', precision: 8, scale: 4, nullable: true })
  annualGrowthRate?: number;

  @Column({ length: 150, nullable: true })
  source?: string;

  @Column({ type: 'timestamp', nullable: true })
  collectedAt?: Date;

  @Column({ type: 'geometry', srid: 4326, nullable: true })
  coverageArea?: Geometry;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ length: 120, nullable: true })
  createdBy?: string;

  @Column({ length: 120, nullable: true })
  updatedBy?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
