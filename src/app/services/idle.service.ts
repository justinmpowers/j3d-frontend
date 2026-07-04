import { Injectable, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';

const IDLE_TIMEOUT_MINUTES = 30;
const ACTIVITY_EVENTS = ['click', 'keydown', 'mousemove', 'scroll', 'touchstart'];

/**
 * Logs the user out after a period of no interaction, regardless of whether
 * background requests are still silently refreshing the access token.
 */
@Injectable({
  providedIn: 'root'
})
export class IdleService {
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private started = false;
  private boundReset = () => this.resetTimer();

  constructor(
    private authService: AuthService,
    private router: Router,
    private zone: NgZone
  ) {}

  start(): void {
    if (this.started) return;
    this.started = true;
    this.zone.runOutsideAngular(() => {
      ACTIVITY_EVENTS.forEach(event => document.addEventListener(event, this.boundReset, { passive: true }));
    });
    this.resetTimer();
  }

  stop(): void {
    this.started = false;
    ACTIVITY_EVENTS.forEach(event => document.removeEventListener(event, this.boundReset));
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  private resetTimer(): void {
    if (!this.started) return;
    if (this.timeoutId) clearTimeout(this.timeoutId);
    this.timeoutId = setTimeout(() => this.onIdle(), IDLE_TIMEOUT_MINUTES * 60 * 1000);
  }

  private onIdle(): void {
    this.stop();
    this.zone.run(() => {
      this.authService.logout().subscribe(() => {
        this.router.navigate(['/login'], { queryParams: { reason: 'idle' } });
      });
    });
  }
}
