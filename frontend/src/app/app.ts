import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MnAlertOutletComponent } from 'mn-angular-lib';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, MnAlertOutletComponent],
  template: `
    <router-outlet />
    <mn-alert-outlet />
  `,
})
export class App {}
