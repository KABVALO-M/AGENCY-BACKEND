import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    Patch,
    Delete,
  } from '@nestjs/common';
  import { ParcelsService } from '../services/parcels.service';
  import { CreateParcelDto } from '../dtos/request/create-parcel.dto';
  import { UpdateParcelDto } from '../dtos/request/update-parcel.dto';
  
  @Controller('parcels')
  export class ParcelsController {
    constructor(private readonly parcelsService: ParcelsService) {}
  
    // ──────────────────────────────── CREATE PARCEL
    @Post()
    async create(@Body() data: CreateParcelDto) {
      return this.parcelsService.create(data);
    }
  
    // ──────────────────────────────── GET ALL PARCELS
    @Get()
    async findAll() {
      return this.parcelsService.findAll();
    }
  
    // ──────────────────────────────── GET ONE PARCEL
    @Get(':id')
    async findOne(@Param('id') id: string) {
      return this.parcelsService.findOne(id);
    }
  
    // ──────────────────────────────── UPDATE PARCEL
    @Patch(':id')
    async update(@Param('id') id: string, @Body() data: UpdateParcelDto) {
      return this.parcelsService.update(id, data);
    }
  
    // ──────────────────────────────── DELETE PARCEL
    @Delete(':id')
    async remove(@Param('id') id: string) {
      await this.parcelsService.remove(id);
      return { message: 'Parcel deleted successfully' };
    }
  }
  