import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { User } from '../users/user.entity';

/**
 * The AI analysis of one training week (Monday to Sunday). One per user per
 * week: a week keeps changing while it is trained, so "Analyse again"
 * overwrites the saved one. Deleting the user deletes it too.
 */
@Entity('week_analyses')
export class WeekAnalysis {
  @PrimaryColumn('uuid')
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  /** Monday of the week, yyyy-mm-dd. */
  @PrimaryColumn({ type: 'date' })
  weekStart: string;

  /** Workouts with sets in the week when it was analysed. */
  @Column({ type: 'int' })
  workouts: number;

  /** Language it was written in. */
  @Column({ type: 'varchar', length: 2 })
  locale: string;

  /** What Claude wrote: headline, summary, wentWell, watchOut, nextTime. */
  @Column({ type: 'jsonb' })
  analysis: Record<string, unknown>;

  /** When it was (last) written. */
  @Column({ type: 'timestamp', default: () => 'now()' })
  analysedAt: Date;
}
