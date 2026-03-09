import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Workout } from '../workouts/workouts.entity';

@Entity()
export class Exercise {
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn()
  exerciseId: number;

  @ManyToOne(() => Workout, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workoutId' })
  workout: Workout;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @Column()
  workoutId: string;

  @ApiProperty({
    example: 'StrengthExercise',
    enum: [
      'StrengthExercise',
      'RunExercise',
      'CyclingExercise',
      'BodyweightExercise',
    ],
  })
  @Column({ unique: false })
  type: string;

  @ApiProperty({ example: 'Bench Press' })
  @Column()
  name: string;

  @ApiProperty({ example: 1 })
  @Column()
  orderInWorkout: number;

  @ApiProperty({ example: 'Stoel staat op 4', required: false })
  @Column({ nullable: true })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
