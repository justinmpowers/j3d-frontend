import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';
import { User } from '../models/types';
import { environment } from 'environments/environment';

/**
 * Service for managing user authentication with Etsy OAuth.
 * Handles login, access/refresh token management, and user information retrieval.
 */
@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = environment.apiUrl;
  private tokenSubject = new BehaviorSubject<string | null>(this.getToken());
  private userSubject = new BehaviorSubject<User | null>(null);

  public token$ = this.tokenSubject.asObservable();
  public user$ = this.userSubject.asObservable();

  constructor(private http: HttpClient) {
    // Deferred to a microtask: authInterceptor injects AuthService, so firing
    // this HTTP call synchronously during construction causes Angular to see
    // a circular dependency (this provider hasn't finished instantiating yet).
    if (this.getToken()) {
      queueMicrotask(() => this.getUserInfo().subscribe());
    }
  }

  getLoginUrl(): Observable<{ auth_url: string; code_verifier: string }> {
    return this.http.get<{ auth_url: string; code_verifier: string }>(`${this.apiUrl}/auth/login`);
  }

  handleCallback(code: string, code_verifier: string): Observable<{ token: string; user: User }> {
    return this.http.post<{ token: string; refresh_token: string; user: User }>(`${this.apiUrl}/auth/callback`, { code, code_verifier })
      .pipe(
        tap(response => {
          this.setToken(response.token);
          this.setRefreshToken(response.refresh_token);
          this.userSubject.next(response.user);
        })
      );
  }

  getUserInfo(): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/auth/user`).pipe(
      tap(user => this.userSubject.next(user))
    );
  }

  /** Exchange the stored refresh token for a new access/refresh pair. Used by the auth interceptor on 401. */
  refreshAccessToken(): Observable<string | null> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      return of(null);
    }
    return this.http.post<{ token: string; refresh_token: string }>(`${this.apiUrl}/auth/refresh`, { refresh_token: refreshToken })
      .pipe(
        map(response => {
          this.setToken(response.token);
          this.setRefreshToken(response.refresh_token);
          return response.token;
        }),
        catchError(() => {
          this.clearToken();
          return of(null);
        })
      );
  }

  logout(): Observable<any> {
    const refreshToken = this.getRefreshToken();
    return this.http.post(`${this.apiUrl}/auth/logout`, { refresh_token: refreshToken }).pipe(
      tap(() => {
        this.clearToken();
        this.userSubject.next(null);
      }),
      catchError(() => {
        // Still clear local state even if the revoke call fails (e.g. token already expired)
        this.clearToken();
        this.userSubject.next(null);
        return of(null);
      })
    );
  }

  setToken(token: string): void {
    localStorage.setItem('auth_token', token);
    this.tokenSubject.next(token);
  }

  getToken(): string | null {
    return localStorage.getItem('auth_token');
  }

  setRefreshToken(token: string): void {
    localStorage.setItem('refresh_token', token);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem('refresh_token');
  }

  clearToken(): void {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
    this.tokenSubject.next(null);
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  /** Seconds until the current access token expires, or null if there's no valid token. */
  getTokenExpirySeconds(): number | null {
    const token = this.getToken();
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (!payload.exp) return null;
      return payload.exp - Math.floor(Date.now() / 1000);
    } catch {
      return null;
    }
  }

  /** @deprecated Authorization headers are now attached centrally by authInterceptor. */
  getAuthHeaders(): HttpHeaders {
    const token = this.getToken();
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
  }
}
