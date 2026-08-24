import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideMnAlerts, provideMnLanguage } from 'mn-angular-lib';

import { routes } from './app.routes';
import { authInterceptor } from './auth/auth.interceptor';

const savedLocale =
  (typeof localStorage !== 'undefined' && localStorage.getItem('locale')) || 'en';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideMnAlerts({ maxVisible: 3 }),
    provideMnLanguage({
      urlPattern: 'i18n/{locale}.json',
      defaultLocale: savedLocale,
      preload: ['en', 'nl'],
    }),
  ],
};
