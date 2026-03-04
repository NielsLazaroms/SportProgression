import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity()
export class Workout {
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ example: '2024-01-01' })
  @Column({ type: 'date' })
  date: string;

  @ApiProperty({ example: 'Some note' })
  @Column()
  note: string;
}
