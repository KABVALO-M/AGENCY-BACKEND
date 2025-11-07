import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateParcelsTable1762515631140 implements MigrationInterface {
    name = 'CreateParcelsTable1762515631140'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "postgis"`);
        await queryRunner.query(`CREATE TABLE "parcels" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(150) NOT NULL, "description" text, "titleNumber" character varying(100), "geometry" geometry(Polygon,4326) NOT NULL, "imageUrl" character varying, "status" character varying NOT NULL DEFAULT 'available', "area" numeric(10,2), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "owner_id" uuid, "created_by_id" uuid, CONSTRAINT "PK_47847f79fee8a3926f2b3022a96" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "parcels" ADD CONSTRAINT "FK_abf798438d22b945de4758a5b2c" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "parcels" ADD CONSTRAINT "FK_a438c45cf22cb028a241fb66c73" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "parcels" DROP CONSTRAINT "FK_a438c45cf22cb028a241fb66c73"`);
        await queryRunner.query(`ALTER TABLE "parcels" DROP CONSTRAINT "FK_abf798438d22b945de4758a5b2c"`);
        await queryRunner.query(`DROP TABLE "parcels"`);
    }

}
