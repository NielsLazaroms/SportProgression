import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGymName1794851335533 implements MigrationInterface {
  name = 'AddGymName1794851335533';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "gymName" character varying(60)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "gymName"`);
  }
}
