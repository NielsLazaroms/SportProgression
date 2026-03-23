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

  @OneToMany(() => Workout, (workout) => workout.user)
  workouts: Workout[];

  @ApiProperty({ example: '2026-03-23T10:00:00.000Z' })
  @CreateDateColumn()
  createdAt: Date;
}
