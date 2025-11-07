import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Parcel } from '../entities/parcel.entity';
import { CreateParcelDto } from '../dtos/request/create-parcel.dto';
import { UpdateParcelDto } from '../dtos/request/update-parcel.dto';

@Injectable()
export class ParcelsService {
  constructor(
    @InjectRepository(Parcel)
    private readonly parcelRepository: Repository<Parcel>,
  ) {}

  // ──────────────────────────────── CREATE
  async create(data: CreateParcelDto): Promise<Parcel> {
    const parcel = this.parcelRepository.create(data);
    return this.parcelRepository.save(parcel);
  }

  // ──────────────────────────────── FIND ALL
  async findAll(): Promise<Parcel[]> {
    return this.parcelRepository.find();
  }

  // ──────────────────────────────── FIND ONE
  async findOne(id: string): Promise<Parcel> {
    const parcel = await this.parcelRepository.findOne({ where: { id } });
    if (!parcel) throw new NotFoundException('Parcel not found');
    return parcel;
  }

  // ──────────────────────────────── UPDATE
  async update(id: string, data: UpdateParcelDto): Promise<Parcel> {
    await this.parcelRepository.update(id, data);
    return this.findOne(id);
  }

  // ──────────────────────────────── DELETE
  async remove(id: string): Promise<void> {
    await this.parcelRepository.delete(id);
  }
}
