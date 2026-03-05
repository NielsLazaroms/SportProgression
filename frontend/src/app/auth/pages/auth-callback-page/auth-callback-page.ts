import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../data-access/auth.service';

@Component({
  selector: 'app-auth-callback-page',
  imports: [],
  template: '<p>Logging in...</p>',
})
export class AuthCallbackPage implements OnInit {
  constructor(
    private route: ActivatedRoute,
    private auth: AuthService,
  ) {}

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (token) {
      this.auth.handleCallback(token);
    }
  }
}
