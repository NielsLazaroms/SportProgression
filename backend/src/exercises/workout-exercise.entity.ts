import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Workout } from '../workouts/workouts.entity';
import {
  ExerciseDefinition,
  ExerciseType,
} from '../exercise-definitions/exercise-definition.entity';
import { ExerciseSet } from '../sets/set.entity';

@Index(['workoutId', 'orderInWorkout'])
@Entity('workout_exercises')
export class WorkoutExercise {
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Workout, (w) => w.exercises, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workoutId' })
  workout: Workout;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @Column()
  workoutId: string;

  @ManyToOne(() => ExerciseDefinition, (ed) => ed.workoutExercises, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'exerciseDefinitionId' })
  exerciseDefinition?: ExerciseDefinition;

  @ApiProperty({ example: 1, required: false })
  @Column({ nullable: true })
  exerciseDefinitionId?: number;

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

  @ApiProperty({ example: 1 })
  @Column()
  orderInWorkout: number;

  @ApiProperty({ example: 'Went heavy today', required: false })
  @Column({ nullable: true })
  notes?: string;

  @OneToMany(() => ExerciseSet, (set) => set.workoutExercise, { cascade: true })
  sets: ExerciseSet[];

  @ApiProperty({ example: '2026-03-23T10:00:00.000Z' })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({ example: '2026-03-23T10:00:00.000Z' })
  @UpdateDateColumn()
  updatedAt: Date;
}
