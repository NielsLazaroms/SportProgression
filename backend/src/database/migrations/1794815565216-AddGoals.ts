import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGoals1794815565216 implements MigrationInterface {
  name = 'AddGoals1794815565216';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."goals_kind_enum" AS ENUM('lift', 'muscle')`,
    );
    await queryRunner.query(
      `CREATE TABLE "goals" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "userId" uuid NOT NULL, "kind" "public"."goals_kind_enum" NOT NULL, "exerciseDefinitionId" integer, "targetWeightKg" double precision, "targetReps" integer, "muscleGroup" character varying(50), "targetSetsPerWeek" integer, "targetDate" date, "note" character varying(200), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_26e17b251afab35580dff769223" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_57dd8a3fc26eb760d076bf8840" ON "goals" ("userId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "goals" ADD CONSTRAINT "FK_57dd8a3fc26eb760d076bf8840e" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "goals" ADD CONSTRAINT "FK_00c97c6e67776be367c6172bc3c" FOREIGN KEY ("exerciseDefinitionId") REFERENCES "exercise_definitions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "goals" DROP CONSTRAINT "FK_00c97c6e67776be367c6172bc3c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "goals" DROP CONSTRAINT "FK_57dd8a3fc26eb760d076bf8840e"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_57dd8a3fc26eb760d076bf8840"`,
    );
    await queryRunner.query(`DROP TABLE "goals"`);
    await queryRunner.query(`DROP TYPE "public"."goals_kind_enum"`);
  }
}
