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
import { User } from '../users/user.entity';
import { WorkoutExercise } from '../exercises/workout-exercise.entity';

@Index(['userId', 'date'])
@Entity('workouts')
export class Workout {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ example: '2026-03-23' })
  @Column({ type: 'date' })
  date: string;

  @ApiProperty({ example: 'Push Day' })
  @Column()
  name: string;

  @ApiProperty({ example: 'Upper body focus', required: false })
  @Column({ nullable: true })
  description?: string;

  @ManyToOne(() => User, (user) => user.workouts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @Column()
  userId: string;

  @OneToMany(() => WorkoutExercise, (exercise) => exercise.workout)
  exercises: WorkoutExercise[];

  @ApiProperty({ example: '2026-03-23T10:00:00.000Z' })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({ example: '2026-03-23T10:00:00.000Z' })
  @UpdateDateColumn()
  updatedAt: Date;
}
