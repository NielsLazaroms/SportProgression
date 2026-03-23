import {
  Entity,
  Column,
  OneToOne,
  JoinColumn,
  PrimaryColumn,
  OneToMany,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Exercise } from './exercise.entity';
import { ExerciseSet } from '../sets/set.entity';

@Entity('strength_exercises')
export class StrengthExercise {
  @ApiProperty({ example: 1 })
  @PrimaryColumn()
  exerciseId: number;

  @OneToOne(() => Exercise, (exercise) => exercise.strengthExercise, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'exerciseId' })
  exercise: Exercise;

  @ApiProperty({ example: 'Chest' })
  @Column()
  muscleGroup: string;

  @OneToMany(() => ExerciseSet, (set) => set.strengthExercise, {
    cascade: true,
  })
  sets: ExerciseSet[];
}
