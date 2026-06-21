import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from 'services/auth.service';
import { environment } from 'environments/environment';

export interface AlertSettings {
  id?: number;
  user_id?: number;
  slack_webhook_url?: string | null;
  discord_webhook_url?: string | null;
  email_enabled?: boolean;
  email_to?: string | null;
  telegram_bot_token?: string | null;
  telegram_chat_id?: string | null;
  telegram_enabled?: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface AlertPreview {
  low_stock: Array<{ id: number; material: string; color: string; current_amount: number; unit: string; low_stock_threshold: number }>; 
  printer_issues: Array<{ id: number; name: string; status: string }>;
}

@Injectable({ providedIn: 'root' })
export class AlertsService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient, private authService: AuthService) {}

  getSettings(): Observable<AlertSettings> {
    return this.http.get<AlertSettings>(`${this.apiUrl}/alerts/settings`, {
      headers: this.authService.getAuthHeaders()
    });
  }

  updateSettings(settings: Partial<AlertSettings>): Observable<AlertSettings> {
    return this.http.put<AlertSettings>(`${this.apiUrl}/alerts/settings`, settings, {
      headers: this.authService.getAuthHeaders()
    });
  }

  preview(): Observable<AlertPreview> {
    return this.http.get<AlertPreview>(`${this.apiUrl}/alerts/preview`, {
      headers: this.authService.getAuthHeaders()
    });
  }

  trigger(): Observable<{ sent: boolean; channels: string[]; low_stock_count: number; printer_issue_count: number }> {
    return this.http.post<{ sent: boolean; channels: string[]; low_stock_count: number; printer_issue_count: number }>(
      `${this.apiUrl}/alerts/trigger`, {}, {
        headers: this.authService.getAuthHeaders()
      }
    );
  }
}
