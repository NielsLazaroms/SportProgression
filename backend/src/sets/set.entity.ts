import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { WorkoutExercise } from '../exercises/workout-exercise.entity';

@Index(['workoutExerciseId', 'setOrder'])
@Entity('sets')
export class ExerciseSet {
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn()
  setId: number;

  @ManyToOne(() => WorkoutExercise, (we) => we.sets, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workoutExerciseId' })
  workoutExercise: WorkoutExercise;

  @ApiProperty({ example: 1 })
  @Column()
  workoutExerciseId: number;

  @ApiProperty({ example: 1 })
  @Column()
  setOrder: number;

  @ApiProperty({ example: 10 })
  @Column()
  repsAmount: number;

  @ApiProperty({ example: 80.5 })
  @Column('float')
  weightKg: number;

  @ApiProperty({ example: 'Felt easy', required: false })
  @Column({ nullable: true })
  notes: string;

  @ApiProperty({ example: '2026-03-23T10:00:00.000Z' })
  @CreateDateColumn()
  createdAt: Date;
}
