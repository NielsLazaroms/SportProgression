import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWeightStep1794900000002 implements MigrationInterface {
  name = 'AddWeightStep1794900000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "weightStepKg" double precision NOT NULL DEFAULT '1'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "weightStepKg"`);
  }
}
