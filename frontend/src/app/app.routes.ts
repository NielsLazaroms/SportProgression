import { Routes } from '@angular/router';
import {LoginPage} from './pages/login-page/login-page';

export const routes: Routes = [
  {path: '**', redirectTo: '/login'},
  { path: 'login', component: LoginPage},
];
