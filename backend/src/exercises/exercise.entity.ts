import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Workout } from '../workouts/workouts.entity';
import { StrengthExercise } from './strength-exercise.entity';

export enum ExerciseType {
  STRENGTH = 'StrengthExercise',
  RUN = 'RunExercise',
  CYCLING = 'CyclingExercise',
  BODYWEIGHT = 'BodyweightExercise',
}

@Index(['workoutId', 'orderInWorkout'])
@Entity('exercises')
export class Exercise {
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn()
  exerciseId: number;

  @ManyToOne(() => Workout, (workout) => workout.exercises, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'workoutId' })
  workout: Workout;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @Column()
  workoutId: string;

  @ApiProperty({ example: ExerciseType.STRENGTH, enum: ExerciseType })
  @Column({
    type: 'enum',
    enum: ExerciseType,
  })
  type: ExerciseType;

  @ApiProperty({ example: 'Bench Press' })
  @Column()
  name: string;

  @ApiProperty({ example: 1 })
  @Column()
  orderInWorkout: number;

  @ApiProperty({ example: 'Went heavy today', required: false })
  @Column({ nullable: true })
  notes?: string;

  @OneToOne(() => StrengthExercise, (strength) => strength.exercise)
  strengthExercise?: StrengthExercise;

  @ApiProperty({ example: '2026-03-23T10:00:00.000Z' })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({ example: '2026-03-23T10:00:00.000Z' })
  @UpdateDateColumn()
  updatedAt: Date;
}
