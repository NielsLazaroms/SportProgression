import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGymEquipment1794848919998 implements MigrationInterface {
  name = 'AddGymEquipment1794848919998';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "gymEquipment" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "gymEquipment"`);
  }
}
