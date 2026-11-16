import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Workout } from '../workouts/workouts.entity';

/** One exercise of a scheduled workout, as it was planned. */
export interface ScheduledExercise {
  exerciseDefinitionId: number;
  /** Snapshot of the catalog entry, for showing the plan. */
  name: string;
  muscleGroup: string | null;
  bodyweight: boolean;
  targetSets: number;
  targetReps: number;
  /** Suggested working weight; extra weight for bodyweight work. */
  targetWeightKg: number | null;
  supersetGroup: number | null;
}

/**
 * A workout planned for a day, from the coach's week or put there by hand
 * from a template. It is not a workout yet: starting it creates one, and the
 * link to that workout marks it as done. Kept apart from workouts so a plan
 * never counts towards history, stats or streaks.
 */
@Index(['userId', 'date'])
@Entity('scheduled_workouts')
export class ScheduledWorkout {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: string;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  /** Why this session (the coach's reason); null when scheduled by hand. */
  @Column({ type: 'varchar', length: 255, nullable: true })
  note?: string | null;

  @Column({ type: 'simple-json' })
  exercises: ScheduledExercise[];

  /** The workout it became. Deleting that workout makes the plan open again. */
  @ManyToOne(() => Workout, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'workoutId' })
  workout?: Workout | null;

  @Column({ type: 'uuid', nullable: true })
  workoutId?: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
