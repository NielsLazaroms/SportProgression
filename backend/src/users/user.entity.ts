import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Workout } from '../workouts/workouts.entity';

@Entity('users')
export class User {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ example: '1234567890' })
  @Column({ unique: true })
  googleId: string;

  @ApiProperty({ example: 'john@example.com' })
  @Column({ unique: true })
  email: string;

  @ApiProperty({ example: 'John', required: false })
  @Column({ nullable: true })
  firstName?: string;

  @ApiProperty({ example: 'Doe', required: false })
  @Column({ nullable: true })
  lastName?: string;

  @ApiProperty({ example: 'https://example.com/photo.jpg', required: false })
  @Column({ nullable: true })
  picture?: string;

  /**
   * Bumped on sign-out (and whenever all sessions must end). Access tokens
   * carry the version they were issued for, so older ones stop working at once
   * instead of lingering until they expire.
   */
  @Column({ default: 0 })
  tokenVersion: number;

  /**
   * The "AI" role: only users with it may use the analysis and plan features,
   * because every use is a paid call to Claude. Off for new accounts; can also
   * be granted by e-mail address through AI_ALLOWED_EMAILS.
   */
  @Column({ default: false })
  aiAccess: boolean;

  /**
   * Muscle groups the user deliberately does not train. The analysis leaves
   * these alone instead of reporting them as missing.
   */
  @Column({ type: 'simple-json', nullable: true })
  ignoredMuscleGroups?: string[] | null;

  /**
   * Weekdays the user prefers to train on, 1 = Monday ... 7 = Sunday. Weekly
   * plans are laid out on these days.
   */
  @Column({ type: 'simple-json', nullable: true })
  trainingDays?: number[] | null;

  /** The user's own wishes for how plans should look ("pull day: 3 back, 2 biceps"). */
  @Column({ type: 'varchar', length: 300, nullable: true })
  coachNote?: string | null;

  /**
   * What the user's gym has: keys of the standard equipment (see
   * account/gym-equipment.ts) and names of other machines. Empty means not
   * set, and plans then assume a fully equipped gym.
   */
  @Column({ type: 'simple-json', nullable: true })
  gymEquipment?: string[] | null;

  /** What the user calls their gym ("040FIT Heeze"); only shown in the app. */
  @Column({ type: 'varchar', length: 60, nullable: true })
  gymName?: string | null;

  /** How much the weight + and - buttons add or take off, in kg. */
  @Column({ type: 'double precision', default: 1 })
  weightStepKg: number;

  @OneToMany(() => Workout, (workout) => workout.user)
  workouts: Workout[];

  @ApiProperty({ example: '2026-03-23T10:00:00.000Z' })
  @CreateDateColumn()
  createdAt: Date;
}
