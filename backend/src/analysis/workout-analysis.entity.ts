import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
} from 'typeorm';
import { Workout } from '../workouts/workouts.entity';

/**
 * The AI analysis of one workout. The workout id is the primary key, so a
 * workout can never have more than one: once it is analysed, that analysis is
 * what the user sees from then on. Deleting the workout deletes it too.
 */
@Index(['userId'])
@Entity('workout_analyses')
export class WorkoutAnalysis {
  @PrimaryColumn('uuid')
  workoutId: string;

  @OneToOne(() => Workout, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workoutId' })
  workout: Workout;

  /** Owner of the workout, kept here so lookups never need the join. */
  @Column('uuid')
  userId: string;

  /** Language it was written in. */
  @Column({ type: 'varchar', length: 2 })
  locale: string;

  /** What Claude wrote: headline, summary, wentWell, watchOut, nextTime. */
  @Column({ type: 'jsonb' })
  analysis: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;
}
