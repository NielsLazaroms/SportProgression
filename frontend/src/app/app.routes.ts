import { Routes } from '@angular/router';
import {LoginPage} from './auth/pages/login-page/login-page';

export const routes: Routes = [
  { path: 'login', component: LoginPage},
  { path: 'workouts', loadChildren: () => import('./workouts/workouts.routes').then(m => m.workoutRoutes) },
  {path: '**', redirectTo: '/login'},
];
