import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateParcelsGeometry1762634121099 implements MigrationInterface {
    name = 'UpdateParcelsGeometry1762634121099'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "parcels" ALTER COLUMN "geometry" TYPE geometry`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "parcels" ALTER COLUMN "geometry" TYPE geometry(GEOMETRY,0)`);
    }

}
