import { Component } from '@angular/core';
import { AuthService } from '../../data-access/auth.service';
@Component({
  selector: 'app-login-page',
  imports: [],
  templateUrl: './login-page.html',
})
export class LoginPage {
  constructor(private auth: AuthService) {}

  loginWithGoogle(): void {
    this.auth.loginWithGoogle();
  }
}
