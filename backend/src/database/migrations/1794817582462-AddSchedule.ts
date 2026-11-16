import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSchedule1794817582462 implements MigrationInterface {
  name = 'AddSchedule1794817582462';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "scheduled_workouts" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "userId" uuid NOT NULL, "date" date NOT NULL, "name" character varying(100) NOT NULL, "note" character varying(255), "exercises" text NOT NULL, "workoutId" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a1c4887c828503bd533108f3aec" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3066eb283d212b46022b01248b" ON "scheduled_workouts" ("userId", "date") `,
    );
    await queryRunner.query(
      `ALTER TABLE "scheduled_workouts" ADD CONSTRAINT "FK_ba3b520f0eecd474f65b6f494d8" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "scheduled_workouts" ADD CONSTRAINT "FK_03ce046e3eac39982f35a74fdfb" FOREIGN KEY ("workoutId") REFERENCES "workouts"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "scheduled_workouts" DROP CONSTRAINT "FK_03ce046e3eac39982f35a74fdfb"`,
    );
    await queryRunner.query(
      `ALTER TABLE "scheduled_workouts" DROP CONSTRAINT "FK_ba3b520f0eecd474f65b6f494d8"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3066eb283d212b46022b01248b"`,
    );
    await queryRunner.query(`DROP TABLE "scheduled_workouts"`);
  }
}
