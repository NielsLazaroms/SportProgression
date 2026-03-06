import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../data-access/auth.service';

@Component({
  selector: 'app-auth-callback-page',
  imports: [],
  template: '<p>Logging in...</p>',
})
export class AuthCallbackPage implements OnInit {
  constructor(
    private router: Router,
    private auth: AuthService,
  ) {}

  ngOnInit(): void {
    // Cookies are already set by the backend redirect.
    // Verify auth status, then navigate to the app.
    this.auth.checkAuth().subscribe((loggedIn) => {
      if (loggedIn) {
        this.router.navigate(['/workouts']);
      } else {
        this.router.navigate(['/login']);
      }
    });
  }
}
