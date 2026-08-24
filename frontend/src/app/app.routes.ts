import { Routes } from '@angular/router';
import { authGuard } from './guards/auth-guard';
import { loginRedirectGuard } from './guards/login-redirect-guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./auth/pages/login-page/login-page').then((m) => m.LoginPage),
    canActivate: [loginRedirectGuard],
  },
  {
    path: 'auth/callback',
    loadComponent: () =>
      import('./auth/pages/auth-callback-page/auth-callback-page').then(
        (m) => m.AuthCallbackPage,
      ),
  },
  {
    path: '',
    loadComponent: () => import('./layout/shell').then((m) => m.Shell),
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'workouts', pathMatch: 'full' },
      {
        path: 'workouts',
        loadComponent: () =>
          import('./workouts/pages/workouts-page/workouts-page').then(
            (m) => m.WorkoutsPage,
          ),
      },
      {
        path: 'workouts/:id',
        loadComponent: () =>
          import(
            './workouts/pages/workout-detail-page/workout-detail-page'
          ).then((m) => m.WorkoutDetailPage),
      },
      {
        path: 'history',
        loadComponent: () =>
          import('./workouts/pages/history-page/history-page').then(
            (m) => m.HistoryPage,
          ),
      },
      {
        path: 'progress',
        loadComponent: () =>
          import('./progress/pages/progress-page/progress-page').then(
            (m) => m.ProgressPage,
          ),
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./profile/pages/profile-page/profile-page').then(
            (m) => m.ProfilePage,
          ),
      },
      {
        path: 'exercise-definitions',
        loadComponent: () =>
          import(
            './exercise-definitions/pages/exercise-definitions-page/exercise-definitions-page'
          ).then((m) => m.ExerciseDefinitionsPage),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
