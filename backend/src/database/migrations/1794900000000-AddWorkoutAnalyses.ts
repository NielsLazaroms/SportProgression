import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWorkoutAnalyses1794900000000 implements MigrationInterface {
  name = 'AddWorkoutAnalyses1794900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "workout_analyses" ("workoutId" uuid NOT NULL, "userId" uuid NOT NULL, "locale" character varying(2) NOT NULL, "analysis" jsonb NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_workout_analyses_workoutId" PRIMARY KEY ("workoutId"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_workout_analyses_userId" ON "workout_analyses" ("userId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "workout_analyses" ADD CONSTRAINT "FK_workout_analyses_workoutId" FOREIGN KEY ("workoutId") REFERENCES "workouts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "workout_analyses" DROP CONSTRAINT "FK_workout_analyses_workoutId"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_workout_analyses_userId"`,
    );
    await queryRunner.query(`DROP TABLE "workout_analyses"`);
  }
}
