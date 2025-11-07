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
    /**
     * Store the polygon geometry (GeoJSON or coordinates)
     * SRID 4326 = GPS coordinate standard.
     */
    @Column({
      type: 'geometry',
      spatialFeatureType: 'Polygon',
      srid: 4326,
    })
    geometry: any;
  
    // ─────────────── OWNER RELATION ───────────────
    /**
     * The real owner of the plot.
     * Can be linked to a user account representing a landowner or client.
     */
    @ManyToOne(() => User, { eager: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'owner_id' })
    owner: User;
  
    // ─────────────── ADMIN CREATOR RELATION ───────────────
    /**
     * The admin who created this parcel record in the system.
     */
    @ManyToOne(() => User, { eager: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'created_by_id' })
    createdBy: User;
  
    // ─────────────── ADDITIONAL INFO ───────────────
    @Column({ nullable: true })
    imageUrl?: string;
  
    @Column({ default: 'available' })
    status: string;
  
    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
    area?: number;
  
    // ─────────────── TIMESTAMPS ───────────────
    @CreateDateColumn()
    createdAt: Date;
  
    @UpdateDateColumn()
    updatedAt: Date;
  }
  