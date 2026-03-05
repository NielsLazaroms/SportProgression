import { Routes } from '@angular/router';
import {LoginPage} from './auth/pages/login-page/login-page';
import {AuthCallbackPage} from './auth/pages/auth-callback-page/auth-callback-page';
export const routes: Routes = [
  { path: 'login', component: LoginPage},
  { path: 'auth/callback', component: AuthCallbackPage},
  { path: 'workouts', loadChildren: () => import('./workouts/workouts.routes').then(m => m.workoutRoutes) },
  {path: '**', redirectTo: '/login'},
];
