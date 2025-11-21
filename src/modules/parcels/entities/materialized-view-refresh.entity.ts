import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('materialized_view_refreshes')
@Index(['viewName'], { unique: true })
export class MaterializedViewRefresh {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 120 })
  viewName: string;

  @Column({ type: 'timestamp', nullable: true })
  lastRefreshedAt?: Date;

  @Column({ type: 'int', nullable: true })
  durationMs?: number;

  @Column({ length: 20, default: 'idle' })
  status: string;

  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
