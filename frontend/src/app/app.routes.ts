import { Routes } from '@angular/router';
import {LoginPage} from './auth/pages/login-page/login-page';
import {AuthCallbackPage} from './auth/pages/auth-callback-page/auth-callback-page';
import {ExerciseDefinitionsPage} from './exercise-definitions/pages/exercise-definitions-page/exercise-definitions-page';
import {authGuard} from './guards/auth-guard';
import {loginRedirectGuard} from './guards/login-redirect-guard';
export const routes: Routes = [
  { path: 'login', component: LoginPage, canActivate: [loginRedirectGuard]},
  { path: 'auth/callback', component: AuthCallbackPage},
  { path: 'workouts', loadChildren: () => import('./workouts/workouts.routes').then(m => m.workoutRoutes), canActivate: [authGuard] },
  { path: 'exercise-definitions', component: ExerciseDefinitionsPage, canActivate: [authGuard] },
  {path: '**', redirectTo: '/login'},
];
