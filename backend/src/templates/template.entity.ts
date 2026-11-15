import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import {
  ExerciseDefinition,
  ExerciseType,
} from '../exercise-definitions/exercise-definition.entity';

/** A reusable workout plan: named list of exercises with target sets × reps. */
@Index(['userId', 'name'])
@Entity('workout_templates')
export class WorkoutTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: string;

  @OneToMany(() => TemplateExercise, (e) => e.template, { cascade: true })
  exercises: TemplateExercise[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Index(['templateId', 'orderInTemplate'])
@Entity('template_exercises')
export class TemplateExercise {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => WorkoutTemplate, (t) => t.exercises, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'templateId' })
  template: WorkoutTemplate;

  @Column()
  templateId: string;

  @ManyToOne(() => ExerciseDefinition, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'exerciseDefinitionId' })
  exerciseDefinition?: ExerciseDefinition;

  @Column({ nullable: true })
  exerciseDefinitionId?: number;

  // Snapshot of the catalog entry, like on a logged workout exercise.
  @Column()
  name: string;

  @Column({ type: 'simple-enum', enum: ExerciseType })
  type: ExerciseType;

  @Column({ nullable: true })
  muscleGroup?: string;

  @Column()
  orderInTemplate: number;

  /** Members of one superset share this number (see common/superset.ts).
   *  Null for an exercise done on its own. */
  @Column({ type: 'int', nullable: true })
  supersetGroup?: number | null;

  /** The plan: this many working sets of this many reps. No weight on
   *  purpose: that comes from what the lifter did last time. */
  @Column()
  targetSets: number;

  @Column()
  targetReps: number;
}
