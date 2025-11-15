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
import { Parcel } from './parcel.entity';
import { ParcelRiskMetric } from '../constants/parcel-risk-metric.constant';

@Entity('parcel_risk_inputs')
@Index(['parcel', 'metric'], { unique: true })
export class ParcelRiskInput {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Parcel, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parcel_id' })
  parcel: Parcel;

  @Column({ type: 'enum', enum: ParcelRiskMetric })
  metric: ParcelRiskMetric;

  @Column({ type: 'decimal', precision: 10, scale: 4, nullable: true })
  value?: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 1 })
  weight: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  normalizedScore?: number;

  @Column({ length: 150, nullable: true })
  dataSource?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @Column({ type: 'timestamp', nullable: true })
  lastEvaluatedAt?: Date;

  @Column({ length: 120, nullable: true })
  createdBy?: string;

  @Column({ length: 120, nullable: true })
  updatedBy?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

