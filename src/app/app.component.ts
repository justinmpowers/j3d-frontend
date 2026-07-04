import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './services/auth.service';
import { IdleService } from './services/idle.service';

/**
 * Root component for the 3D Print Shop Manager application.
 * Provides routing outlet for all application views.
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `<router-outlet></router-outlet>`,
  styles: []
})
export class AppComponent implements OnInit {
  constructor(
    private authService: AuthService,
    private idleService: IdleService
  ) {}

  ngOnInit(): void {
    // Idle-based auto-logout only matters while a session exists.
    this.authService.token$.subscribe(token => {
      if (token) {
        this.idleService.start();
      } else {
        this.idleService.stop();
      }
    });
  }
}
