import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MnLanguageService, MnTranslatePipe } from 'mn-angular-lib';
import { AppIcon } from '../../../shared/app-icon';
import { AppHeader } from '../../../layout/app-header';
import { AuthService } from '../../../auth/data-access/auth.service';
import { WorkoutService } from '../../../workouts/data-access/workout.service';
import { workoutVolumeKg } from '../../../workouts/models/workout.model';
import { compactKg } from '../../../shared/format';

@Component({
  selector: 'app-profile-page',
  standalone: true,
  imports: [AppHeader, RouterLink, AppIcon, MnTranslatePipe],
  templateUrl: './profile-page.html',
})
export class ProfilePage implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly workoutService = inject(WorkoutService);
  private readonly lang = inject(MnLanguageService);

  readonly profile = this.auth.profile;
  readonly displayName = this.auth.displayName;
  readonly locale = signal(this.lang.locale);

  setLanguage(code: 'en' | 'nl'): void {
    if (this.lang.locale === code) return;
    localStorage.setItem('locale', code);
    this.lang.setLocale(code);
    this.locale.set(code);
  }

  readonly workoutCount = signal<number | null>(null);
  readonly lifetimeVolume = signal<number | null>(null);

  readonly initials = computed(() => {
    const p = this.profile();
    if (!p) return '';
    const a = p.firstName?.[0] ?? p.email?.[0] ?? '';
    const b = p.lastName?.[0] ?? '';
    return (a + b).toUpperCase();
  });

  readonly compactKg = compactKg;

  ngOnInit(): void {
    if (!this.profile()) {
      this.auth.checkAuth().subscribe();
    }
    this.workoutService.getWorkouts().subscribe({
      next: (data) => {
        this.workoutCount.set(data.length);
        this.lifetimeVolume.set(
          data.reduce((sum, w) => sum + workoutVolumeKg(w), 0),
        );
      },
      error: () => {
        this.workoutCount.set(0);
        this.lifetimeVolume.set(0);
      },
    });
  }

  logout(): void {
    this.auth.logout();
  }
}
