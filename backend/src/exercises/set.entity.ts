import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { StrengthExercise } from './strength-exercise.entity';

@Entity()
export class Set {
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn()
  setId: number;

  @ManyToOne(() => StrengthExercise, (se) => se.sets, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'exerciseId' })
  strengthExercise: StrengthExercise;

  @ApiProperty({ example: 1 })
  @Column()
  exerciseId: number;

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

  @CreateDateColumn()
  createdAt: Date;
}
