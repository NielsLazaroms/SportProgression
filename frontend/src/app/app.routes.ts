import { Routes } from '@angular/router';
import { authGuard } from './guards/auth-guard';
import { loginRedirectGuard } from './guards/login-redirect-guard';
import { templateEditorLeaveGuard } from './templates/template-editor-leave.guard';

// `title` is an i18n key, see layout/app-title-strategy.ts.
export const routes: Routes = [
  {
    path: 'login',
    title: 'login.tabTitle',
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
        title: 'nav.workouts',
        loadComponent: () =>
          import('./workouts/pages/workouts-page/workouts-page').then(
            (m) => m.WorkoutsPage,
          ),
      },
      {
        path: 'workouts/:id',
        title: 'nav.workouts',
        loadComponent: () =>
          import(
            './workouts/pages/workout-detail-page/workout-detail-page'
          ).then((m) => m.WorkoutDetailPage),
      },
      {
        path: 'history',
        title: 'nav.history',
        loadComponent: () =>
          import('./workouts/pages/history-page/history-page').then(
            (m) => m.HistoryPage,
          ),
      },
      {
        path: 'templates',
        title: 'title.templates',
        loadComponent: () =>
          import('./templates/pages/templates-page/templates-page').then(
            (m) => m.TemplatesPage,
          ),
      },
      {
        path: 'templates/new',
        title: 'title.templates.new',
        canDeactivate: [templateEditorLeaveGuard],
        loadComponent: () =>
          import(
            './templates/pages/template-editor-page/template-editor-page'
          ).then((m) => m.TemplateEditorPage),
      },
      {
        path: 'templates/:id',
        title: 'title.templates.edit',
        canDeactivate: [templateEditorLeaveGuard],
        loadComponent: () =>
          import(
            './templates/pages/template-editor-page/template-editor-page'
          ).then((m) => m.TemplateEditorPage),
      },
      {
        path: 'schedule',
        title: 'nav.calendar',
        loadComponent: () =>
          import('./schedule/schedule-page').then((m) => m.SchedulePage),
      },
      {
        path: 'progress',
        title: 'nav.progress',
        loadComponent: () =>
          import('./progress/pages/progress-page/progress-page').then(
            (m) => m.ProgressPage,
          ),
      },
      {
        path: 'progress/exercise/:id',
        title: 'nav.progress',
        loadComponent: () =>
          import(
            './progress/pages/exercise-progress-page/exercise-progress-page'
          ).then((m) => m.ExerciseProgressPage),
      },
      {
        path: 'profile',
        title: 'nav.profile',
        loadComponent: () =>
          import('./profile/pages/profile-page/profile-page').then(
            (m) => m.ProfilePage,
          ),
      },
      {
        path: 'exercise-definitions',
        title: 'def.tabTitle',
        loadComponent: () =>
          import(
            './exercise-definitions/pages/exercise-definitions-page/exercise-definitions-page'
          ).then((m) => m.ExerciseDefinitionsPage),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
