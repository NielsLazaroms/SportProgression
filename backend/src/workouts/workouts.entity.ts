import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class Workout {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'date' })
  date: string;

  @Column()
  note: string;
}
