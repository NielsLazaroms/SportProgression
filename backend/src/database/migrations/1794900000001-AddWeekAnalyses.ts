import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWeekAnalyses1794900000001 implements MigrationInterface {
  name = 'AddWeekAnalyses1794900000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "week_analyses" ("userId" uuid NOT NULL, "weekStart" date NOT NULL, "workouts" integer NOT NULL, "locale" character varying(2) NOT NULL, "analysis" jsonb NOT NULL, "analysedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_week_analyses_user_week" PRIMARY KEY ("userId", "weekStart"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "week_analyses" ADD CONSTRAINT "FK_week_analyses_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "week_analyses" DROP CONSTRAINT "FK_week_analyses_userId"`,
    );
    await queryRunner.query(`DROP TABLE "week_analyses"`);
  }
}
