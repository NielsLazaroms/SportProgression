import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRestTimer1794900000003 implements MigrationInterface {
  name = 'AddRestTimer1794900000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "restTimerSeconds" integer NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "restTimerSeconds"`);
  }
}
