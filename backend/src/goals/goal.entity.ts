import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { ExerciseDefinition } from '../exercise-definitions/exercise-definition.entity';

export enum GoalKind {
  /** Do one set of `targetReps` at `targetWeightKg` (extra kg for bodyweight work). */
  LIFT = 'lift',
  /** Give one muscle group `targetSetsPerWeek` working sets every week. */
  MUSCLE = 'muscle',
}

/**
 * Something the lifter is working towards. Progress is never stored: it is
 * worked out from the logged sets every time, so it can never go stale.
 */
@Index(['userId'])
@Entity('goals')
export class Goal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: string;

  @Column({ type: 'simple-enum', enum: GoalKind })
  kind: GoalKind;

  // Lift goal. A definition can only be deleted while no workout uses it, so
  // cascading here only ever removes goals for an exercise never trained.
  @ManyToOne(() => ExerciseDefinition, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'exerciseDefinitionId' })
  exerciseDefinition?: ExerciseDefinition | null;

  @Column({ type: 'int', nullable: true })
  exerciseDefinitionId?: number | null;

  @Column({ type: 'double precision', nullable: true })
  targetWeightKg?: number | null;

  @Column({ type: 'int', nullable: true })
  targetReps?: number | null;

  // Muscle group goal.
  @Column({ type: 'varchar', length: 50, nullable: true })
  muscleGroup?: string | null;

  @Column({ type: 'int', nullable: true })
  targetSetsPerWeek?: number | null;

  /** Optional "reach it by" date, yyyy-mm-dd. */
  @Column({ type: 'date', nullable: true })
  targetDate?: string | null;

  /** The lifter's own words, e.g. "wider back for the summer". */
  @Column({ type: 'varchar', length: 200, nullable: true })
  note?: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
