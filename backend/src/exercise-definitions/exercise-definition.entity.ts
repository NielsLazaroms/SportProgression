import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { WorkoutExercise } from '../exercises/workout-exercise.entity';
import { User } from '../users/user.entity';

export enum ExerciseType {
  STRENGTH = 'StrengthExercise',
  RUN = 'RunExercise',
  CYCLING = 'CyclingExercise',
  BODYWEIGHT = 'BodyweightExercise',
}
// TODO check if this is bound to one user or multiple
@Entity('exercise_definitions')
export class ExerciseDefinition {
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ example: 'Bench Press' })
  @Column()
  name: string;

  @ApiProperty({ example: ExerciseType.STRENGTH, enum: ExerciseType })
  @Column({
    type: 'enum',
    enum: ExerciseType,
  })
  type: ExerciseType;

  @ApiProperty({ example: 'Chest', required: false })
  @Column({ nullable: true })
  muscleGroup?: string;

  @ApiProperty({ example: null, required: false })
  @Column({ nullable: true })
  createdByUserId?: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'createdByUserId' })
  createdByUser?: User;

  @OneToMany(() => WorkoutExercise, (we) => we.exerciseDefinition)
  workoutExercises: WorkoutExercise[];

  @ApiProperty({ example: '2026-03-23T10:00:00.000Z' })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({ example: '2026-03-23T10:00:00.000Z' })
  @UpdateDateColumn()
  updatedAt: Date;
}
