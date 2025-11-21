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
import { LocationInsightCategory } from '../constants/location-insight-category.constant';

@Entity('parcel_location_insights')
@Index(['parcel', 'category'])
export class ParcelLocationInsight {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Parcel, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parcel_id' })
  parcel: Parcel;

  @Column({ type: 'enum', enum: LocationInsightCategory })
  category: LocationInsightCategory;

  @Column({ length: 200 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ length: 80, nullable: true })
  status?: string;

  @Column({ type: 'timestamp', nullable: true })
  expectedCompletion?: Date;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  confidenceScore?: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  impactScore?: number;

  @Column({ length: 150, nullable: true })
  source?: string;

  @Column({ length: 120, nullable: true })
  createdBy?: string;

  @Column({ length: 120, nullable: true })
  updatedBy?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
