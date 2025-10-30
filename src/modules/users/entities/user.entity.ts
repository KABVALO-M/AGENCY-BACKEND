import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { Role } from '../../roles/entities/role.entity';

@Entity('users')
@Index(['email'], { unique: true })
export class User {
  // Primary key
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Normalized name fields
  @Column({ length: 100 })
  firstName: string;

  @Column({ length: 100 })
  lastName: string;

  // Contact information
  @Column({ unique: true })
  email: string;

  @Column({ nullable: true, length: 20 })
  phone?: string;

  // Security / authentication
  @Exclude()
  @Column({ select: false })
  password: string;

  // 🔐 Token invalidation (version strategy)
  @Column({ type: 'int', default: 0 })
  tokenVersion: number;

  // (Optional) Helpful for audits and conditional logout-on-password-change checks
  @Column({ type: 'timestamp', nullable: true })
  passwordChangedAt?: Date;

  // Role relationship (normalized)
  @ManyToOne(() => Role, (role) => role.users, {
    eager: true,
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'role_id' })
  role: Role;

  // Account state & activity tracking
  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'timestamp', nullable: true })
  lastLogin?: Date;

  // Email verification tracking
  @Column({ default: false })
  emailVerified: boolean;

  @Column({ type: 'timestamp', nullable: true })
  emailVerifiedAt?: Date;

  // Audit fields
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
