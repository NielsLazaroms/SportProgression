import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { MnLanguageService } from 'mn-angular-lib';

const APP_NAME = 'Iron Pulse';

/**
 * Browser tab titles. A route's `title` is an i18n key; the tab shows
 * "<translated> · Iron Pulse" and follows a language switch.
 */
@Injectable({ providedIn: 'root' })
export class AppTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly lang = inject(MnLanguageService);
  private key: string | undefined;

  constructor() {
    super();
    this.lang.locale$.subscribe(() => this.apply());
  }

  override updateTitle(snapshot: RouterStateSnapshot): void {
    this.key = this.buildTitle(snapshot);
    this.apply();
  }

  private apply(): void {
    const page = this.key ? this.lang.translateIfPresent(this.key) : null;
    this.title.setTitle(page ? `${page} · ${APP_NAME}` : APP_NAME);
  }
}
