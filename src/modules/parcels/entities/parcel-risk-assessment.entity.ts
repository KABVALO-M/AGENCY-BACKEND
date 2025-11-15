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
import { ParcelRiskBand } from '../constants/parcel-risk-band.constant';

@Entity('parcel_risk_assessments')
@Index(['parcel', 'assessedAt'])
export class ParcelRiskAssessment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Parcel, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parcel_id' })
  parcel: Parcel;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  overallScore: number;

  @Column({ type: 'enum', enum: ParcelRiskBand })
  riskBand: ParcelRiskBand;

  @Column({ type: 'jsonb', nullable: true })
  drivers?: Record<string, unknown>;

  @Column({ length: 50, default: 'v1' })
  methodologyVersion: string;

  @Column({ type: 'timestamp' })
  assessedAt: Date;

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

