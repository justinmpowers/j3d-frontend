import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { AuthService } from 'services/auth.service';
import { environment } from 'environments/environment';

export interface Printer {
  id: number;
  user_id: number;
  name: string;
  model?: string;
  location?: string;
  notes?: string;
  // Connection fields (populated from PrinterConnection via backend)
  connection_id?: number;
  connection_type?: string; // 'octoprint' | 'klipper' | 'bambu_cloud' | 'bambu_lan'
  connection_status?: string; // 'connected' | 'disconnected' | 'error'
  api_url?: string;
  serial_number?: string;
  status?: string;
  current_job?: string;
  utilization_pct?: number;
  created_at: string;
  updated_at: string;
}

export interface BambuMaterial {
  id: number;
  printer_id: number;
  slot: number;
  material_type: string;
  color: string;
  weight_grams: number;
  remaining_pct: number;
  remaining_grams?: number;
  vendor?: string;
  cost_per_kg?: number;
  loaded_at: string;
  last_synced?: string;
  created_at: string;
  updated_at: string;
}

export interface PrintNotification {
  id: number;
  printer_id: number;
  notify_print_start: boolean;
  notify_print_complete: boolean;
  notify_print_failed: boolean;
  notify_material_change: boolean;
  notify_maintenance: boolean;
  email_enabled: boolean;
  webhook_url?: string;
  created_at: string;
  updated_at: string;
}

export interface ScheduledPrint {
  id: number;
  printer_id: number;
  order_id?: number;
  job_name: string;
  file_name?: string;
  status: string; // 'queued' | 'scheduled' | 'started' | 'completed' | 'failed' | 'cancelled'
  scheduled_start?: string;
  estimated_duration_minutes?: number;
  material_type?: string;
  material_slot?: number;
  nozzle_temp?: number;
  bed_temp?: number;
  print_speed?: number;
  started_at?: string;
  completed_at?: string;
  failed_reason?: string;
  priority: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface PrinterStatus {
  printer_name: string;
  connection_type: string;
  state: string;
  progress_percent?: number;
  layers_printed?: number;
  total_layers?: number;
  nozzle_temp?: number;
  bed_temp?: number;
  chamber_temp?: number;
  errors?: string;
  last_updated: string;
}

/**
 * Service for managing 3D printers and printer-related operations.
 * Supports Bambu Lab, OctoPrint, and Klipper printers.
 * Handles printer status, AMS materials, notifications, and print scheduling.
 */
@Injectable({
  providedIn: 'root'
})
export class PrinterService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient, private authService: AuthService) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('auth_token');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  // Printer Management
  getPrinters(): Observable<Printer[]> {
    return this.http.get<{ printers: Printer[], total: number }>(`${this.apiUrl}/printers`, { headers: this.getHeaders() }).pipe(
      map((r: { printers: Printer[], total: number }) => r.printers)
    );
  }

  getPrinter(id: number): Observable<Printer> {
    return this.http.get<Printer>(`${this.apiUrl}/printers/${id}`, { headers: this.getHeaders() });
  }

  createPrinter(printer: Partial<Printer>): Observable<Printer> {
    return this.http.post<Printer>(`${this.apiUrl}/printers`, printer, { headers: this.getHeaders() });
  }

  updatePrinter(id: number, printer: Partial<Printer>): Observable<Printer> {
    return this.http.put<Printer>(`${this.apiUrl}/printers/${id}`, printer, { headers: this.getHeaders() });
  }

  deletePrinter(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/printers/${id}`, { headers: this.getHeaders() });
  }

  // Printer Connections
  createPrinterConnection(connection: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/printer-connections`, connection, { headers: this.getHeaders() });
  }

  getPrinterStatus(connectionId: number): Observable<PrinterStatus> {
    return this.http.get<PrinterStatus>(`${this.apiUrl}/printer-connections/${connectionId}/status`, {
      headers: this.getHeaders()
    });
  }

  // Bambu Materials
  getMaterials(printerId: number): Observable<BambuMaterial[]> {
    return this.http.get<BambuMaterial[]>(`${this.apiUrl}/bambu/materials/${printerId}`, {
      headers: this.getHeaders()
    });
  }

  addMaterial(printerId: number, material: Partial<BambuMaterial>): Observable<BambuMaterial> {
    return this.http.post<BambuMaterial>(`${this.apiUrl}/bambu/materials/${printerId}`, material, {
      headers: this.getHeaders()
    });
  }

  updateMaterial(materialId: number, material: Partial<BambuMaterial>): Observable<BambuMaterial> {
    return this.http.put<BambuMaterial>(`${this.apiUrl}/bambu/materials/${materialId}`, material, {
      headers: this.getHeaders()
    });
  }

  // Print Notifications
  getNotifications(printerId: number): Observable<PrintNotification> {
    return this.http.get<PrintNotification>(`${this.apiUrl}/bambu/notifications/${printerId}`, {
      headers: this.getHeaders()
    });
  }

  updateNotifications(printerId: number, settings: Partial<PrintNotification>): Observable<PrintNotification> {
    return this.http.put<PrintNotification>(`${this.apiUrl}/bambu/notifications/${printerId}`, settings, {
      headers: this.getHeaders()
    });
  }

  // Scheduled Prints
  getScheduledPrints(printerId: number, status?: string): Observable<ScheduledPrint[]> {
    let httpParams = new HttpParams();
    if (status) {
      httpParams = httpParams.set('status', status);
    }
    return this.http.get<ScheduledPrint[]>(`${this.apiUrl}/bambu/scheduled-prints/${printerId}`, {
      headers: this.getHeaders(),
      params: httpParams
    });
  }

  createScheduledPrint(print: Partial<ScheduledPrint>): Observable<ScheduledPrint> {
    return this.http.post<ScheduledPrint>(`${this.apiUrl}/bambu/scheduled-prints`, print, {
      headers: this.getHeaders()
    });
  }

  updateScheduledPrint(printId: number, print: Partial<ScheduledPrint>): Observable<ScheduledPrint> {
    return this.http.put<ScheduledPrint>(`${this.apiUrl}/bambu/scheduled-prints/${printId}`, print, {
      headers: this.getHeaders()
    });
  }

  deleteScheduledPrint(printId: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/bambu/scheduled-prints/${printId}`, {
      headers: this.getHeaders()
    });
  }

  getPrintQueue(printerId: number): Observable<ScheduledPrint[]> {
    return this.http.get<ScheduledPrint[]>(`${this.apiUrl}/bambu/scheduled-prints/${printerId}/queue`, {
      headers: this.getHeaders()
    });
  }

  scheduleOrderPrints(orderId: number, options: {
    printer_id: number;
    material_type?: string;
    start_offset_minutes?: number;
  }): Observable<{ message: string; prints: ScheduledPrint[] }> {
    return this.http.post<{ message: string; prints: ScheduledPrint[] }>(`${this.apiUrl}/orders/${orderId}/schedule-prints`, options, {
      headers: this.getHeaders()
    });
  }
}
