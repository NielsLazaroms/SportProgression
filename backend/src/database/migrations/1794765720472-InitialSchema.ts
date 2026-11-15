import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1794765720472 implements MigrationInterface {
  name = 'InitialSchema1794765720472';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "googleId" character varying NOT NULL, "email" character varying NOT NULL, "firstName" character varying, "lastName" character varying, "picture" character varying, "tokenVersion" integer NOT NULL DEFAULT '0', "aiAccess" boolean NOT NULL DEFAULT false, "ignoredMuscleGroups" text, "trainingDays" text, "coachNote" character varying(300), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_f382af58ab36057334fb262efd5" UNIQUE ("googleId"), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."exercise_definitions_type_enum" AS ENUM('StrengthExercise', 'RunExercise', 'CyclingExercise', 'BodyweightExercise')`,
    );
    await queryRunner.query(
      `CREATE TABLE "exercise_definitions" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "type" "public"."exercise_definitions_type_enum" NOT NULL, "muscleGroup" character varying, "createdByUserId" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_e614333b4f20df0bce0bf457816" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "sets" ("setId" SERIAL NOT NULL, "workoutExerciseId" integer NOT NULL, "setOrder" integer NOT NULL, "repsAmount" integer NOT NULL, "weightKg" double precision NOT NULL, "isWarmup" boolean NOT NULL DEFAULT false, "notes" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_68ee2e6f6bedc1c5112b2997baf" PRIMARY KEY ("setId"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e2764686faabbec0768cdd4299" ON "sets" ("workoutExerciseId", "setOrder") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."workout_exercises_type_enum" AS ENUM('StrengthExercise', 'RunExercise', 'CyclingExercise', 'BodyweightExercise')`,
    );
    await queryRunner.query(
      `CREATE TABLE "workout_exercises" ("id" SERIAL NOT NULL, "workoutId" uuid NOT NULL, "exerciseDefinitionId" integer, "name" character varying NOT NULL, "type" "public"."workout_exercises_type_enum" NOT NULL, "muscleGroup" character varying, "orderInWorkout" integer NOT NULL, "notes" character varying, "supersetGroup" integer, "targetSets" integer, "targetReps" integer, "targetWeightKg" double precision, "planNote" character varying(255), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_377f9ead6fd69b29f0d0feb1028" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_564d1e470e3b24a8e4134317b7" ON "workout_exercises" ("workoutId", "orderInWorkout") `,
    );
    await queryRunner.query(
      `CREATE TABLE "workouts" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "date" date NOT NULL, "name" character varying NOT NULL, "description" character varying, "userId" uuid NOT NULL, "templateId" character varying(36), "completedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_5b2319bf64a674d40237dbb1697" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c7b129635e3069aa5c2e108eef" ON "workouts" ("userId", "date") `,
    );
    await queryRunner.query(
      `CREATE TABLE "workout_templates" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "name" character varying NOT NULL, "userId" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_7ef9887437cbf97fefaa93dc6e5" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cb4aab624bc069c69db808c8c0" ON "workout_templates" ("userId", "name") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."template_exercises_type_enum" AS ENUM('StrengthExercise', 'RunExercise', 'CyclingExercise', 'BodyweightExercise')`,
    );
    await queryRunner.query(
      `CREATE TABLE "template_exercises" ("id" SERIAL NOT NULL, "templateId" uuid NOT NULL, "exerciseDefinitionId" integer, "name" character varying NOT NULL, "type" "public"."template_exercises_type_enum" NOT NULL, "muscleGroup" character varying, "orderInTemplate" integer NOT NULL, "supersetGroup" integer, "targetSets" integer NOT NULL, "targetReps" integer NOT NULL, CONSTRAINT "PK_8c67b5a9e1eaf3e4f7320349cfd" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_949e891dbd64fb168db3521031" ON "template_exercises" ("templateId", "orderInTemplate") `,
    );
    await queryRunner.query(
      `CREATE TABLE "refresh_token" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "hashedToken" character varying NOT NULL, "family" character varying NOT NULL, "userId" uuid NOT NULL, "isRevoked" boolean NOT NULL DEFAULT false, "expiresAt" TIMESTAMP NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_b575dd3c21fb0831013c909e7fe" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "exercise_definitions" ADD CONSTRAINT "FK_21eba014259c14bce2150be1aa6" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sets" ADD CONSTRAINT "FK_fc92232386ee546f3e90df54418" FOREIGN KEY ("workoutExerciseId") REFERENCES "workout_exercises"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "workout_exercises" ADD CONSTRAINT "FK_d616bcfffe0b6bb322281ae3754" FOREIGN KEY ("workoutId") REFERENCES "workouts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "workout_exercises" ADD CONSTRAINT "FK_c9803fa6e13be8bba4ce456d014" FOREIGN KEY ("exerciseDefinitionId") REFERENCES "exercise_definitions"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "workouts" ADD CONSTRAINT "FK_65ff5fd1913246288adad5dc75a" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "workout_templates" ADD CONSTRAINT "FK_6dbab63f48f0d352a96dfc6fe2d" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "template_exercises" ADD CONSTRAINT "FK_6766809ea30b1965585ca859bdf" FOREIGN KEY ("templateId") REFERENCES "workout_templates"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "template_exercises" ADD CONSTRAINT "FK_7366fb5e7b74d63b0271cf7018f" FOREIGN KEY ("exerciseDefinitionId") REFERENCES "exercise_definitions"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_token" ADD CONSTRAINT "FK_8e913e288156c133999341156ad" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "refresh_token" DROP CONSTRAINT "FK_8e913e288156c133999341156ad"`,
    );
    await queryRunner.query(
      `ALTER TABLE "template_exercises" DROP CONSTRAINT "FK_7366fb5e7b74d63b0271cf7018f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "template_exercises" DROP CONSTRAINT "FK_6766809ea30b1965585ca859bdf"`,
    );
    await queryRunner.query(
      `ALTER TABLE "workout_templates" DROP CONSTRAINT "FK_6dbab63f48f0d352a96dfc6fe2d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "workouts" DROP CONSTRAINT "FK_65ff5fd1913246288adad5dc75a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "workout_exercises" DROP CONSTRAINT "FK_c9803fa6e13be8bba4ce456d014"`,
    );
    await queryRunner.query(
      `ALTER TABLE "workout_exercises" DROP CONSTRAINT "FK_d616bcfffe0b6bb322281ae3754"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sets" DROP CONSTRAINT "FK_fc92232386ee546f3e90df54418"`,
    );
    await queryRunner.query(
      `ALTER TABLE "exercise_definitions" DROP CONSTRAINT "FK_21eba014259c14bce2150be1aa6"`,
    );
    await queryRunner.query(`DROP TABLE "refresh_token"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_949e891dbd64fb168db3521031"`,
    );
    await queryRunner.query(`DROP TABLE "template_exercises"`);
    await queryRunner.query(
      `DROP TYPE "public"."template_exercises_type_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_cb4aab624bc069c69db808c8c0"`,
    );
    await queryRunner.query(`DROP TABLE "workout_templates"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_c7b129635e3069aa5c2e108eef"`,
    );
    await queryRunner.query(`DROP TABLE "workouts"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_564d1e470e3b24a8e4134317b7"`,
    );
    await queryRunner.query(`DROP TABLE "workout_exercises"`);
    await queryRunner.query(`DROP TYPE "public"."workout_exercises_type_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_e2764686faabbec0768cdd4299"`,
    );
    await queryRunner.query(`DROP TABLE "sets"`);
    await queryRunner.query(`DROP TABLE "exercise_definitions"`);
    await queryRunner.query(
      `DROP TYPE "public"."exercise_definitions_type_enum"`,
    );
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
