import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmailVerificationFieldsToUserEntity1761570266000
  implements MigrationInterface
{
  name = 'AddEmailVerificationFieldsToUserEntity1761570266000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    let emailVerifiedColumnExists = await queryRunner.hasColumn(
      'users',
      'emailVerified',
    );
    if (!emailVerifiedColumnExists) {
      await queryRunner.query(
        `ALTER TABLE "users" ADD "emailVerified" boolean NOT NULL DEFAULT false`,
      );
      emailVerifiedColumnExists = true;
    }

    let emailVerifiedAtColumnExists = await queryRunner.hasColumn(
      'users',
      'emailVerifiedAt',
    );
    if (!emailVerifiedAtColumnExists) {
      await queryRunner.query(
        `ALTER TABLE "users" ADD "emailVerifiedAt" TIMESTAMP`,
      );
      emailVerifiedAtColumnExists = true;
    }

    if (emailVerifiedColumnExists && emailVerifiedAtColumnExists) {
      await queryRunner.query(
        `UPDATE "users" SET "emailVerified" = "isActive", "emailVerifiedAt" = CASE WHEN "isActive" = true THEN COALESCE("emailVerifiedAt", "updatedAt") ELSE NULL END`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasEmailVerifiedAt = await queryRunner.hasColumn(
      'users',
      'emailVerifiedAt',
    );
    if (hasEmailVerifiedAt) {
      await queryRunner.query(
        `ALTER TABLE "users" DROP COLUMN "emailVerifiedAt"`,
      );
    }

    const hasEmailVerified = await queryRunner.hasColumn(
      'users',
      'emailVerified',
    );
    if (hasEmailVerified) {
      await queryRunner.query(
        `ALTER TABLE "users" DROP COLUMN "emailVerified"`,
      );
    }
  }
}
