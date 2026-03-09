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
import { Set } from './set.entity';

@Entity()
export class StrengthExercise {
  @ApiProperty({ example: 1 })
  @PrimaryColumn()
  exerciseId: number;

  @OneToOne(() => Exercise, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'exerciseId' })
  exercise: Exercise;

  @ApiProperty({ example: 'Chest' })
  @Column()
  muscleGroup: string;

  @OneToMany(() => Set, (set) => set.strengthExercise)
  sets: Set[];
}
