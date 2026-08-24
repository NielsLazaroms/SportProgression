import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideMnAlerts } from 'mn-angular-lib';

import { WorkoutsPage } from './workouts-page';

describe('WorkoutsPage', () => {
  let fixture: ComponentFixture<WorkoutsPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorkoutsPage],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideMnAlerts(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(WorkoutsPage);
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
