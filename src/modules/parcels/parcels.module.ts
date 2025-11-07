import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ParcelsService } from './services/parcels.service';
import { ParcelsController } from './controllers/parcels.controller';
import { Parcel } from './entities/parcel.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Parcel])],
  controllers: [ParcelsController],
  providers: [ParcelsService],
  exports: [ParcelsService],
})
export class ParcelsModule {}
