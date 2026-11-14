import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { TitleStrategy, provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideMnAlerts, provideMnLanguage } from 'mn-angular-lib';

import { routes } from './app.routes';
import { authInterceptor } from './auth/auth.interceptor';
import { AppTitleStrategy } from './layout/app-title-strategy';

/** The saved choice, else Dutch for a Dutch browser, else English. */
function initialLocale(): 'en' | 'nl' {
  try {
    const saved = localStorage.getItem('locale');
    if (saved === 'en' || saved === 'nl') return saved;
  } catch {
    /* storage unavailable: fall through to the browser language */
  }
  const browser = typeof navigator !== 'undefined' ? navigator.language : '';
  return browser?.toLowerCase().startsWith('nl') ? 'nl' : 'en';
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes, withComponentInputBinding()),
    { provide: TitleStrategy, useExisting: AppTitleStrategy },
    provideHttpClient(withInterceptors([authInterceptor])),
    provideMnAlerts({ maxVisible: 3 }),
    provideMnLanguage({
      urlPattern: 'i18n/{locale}.json',
      defaultLocale: initialLocale(),
      preload: ['en', 'nl'],
    }),
  ],
};
