import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePasswordResetTokensTable1761570267000
  implements MigrationInterface
{
  name = 'CreatePasswordResetTokensTable1761570267000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "password_reset_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "token" character varying NOT NULL, "expiresAt" TIMESTAMP NOT NULL, "used" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, CONSTRAINT "PK_f3f5a43cc48fb9d0afa2713aa12" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_d2dc750cebb2ba7f7b5c68cf81" ON "password_reset_tokens" ("token")`,
    );
    await queryRunner.query(
      `ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "FK_13afd2a9f706ba98d5c7fe92dc2" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "password_reset_tokens" DROP CONSTRAINT "FK_13afd2a9f706ba98d5c7fe92dc2"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_d2dc750cebb2ba7f7b5c68cf81"`,
    );
    await queryRunner.query(`DROP TABLE "password_reset_tokens"`);
  }
}
