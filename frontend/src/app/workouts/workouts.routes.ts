import { Routes } from '@angular/router';
import {WorkoutsPage} from './pages/workouts-page/workouts-page';
import {WorkoutDetailPage} from './pages/workout-detail-page/workout-detail-page';
export const workoutRoutes: Routes = [
  { path: '', component: WorkoutsPage },
  { path: ':id', component: WorkoutDetailPage },
];
