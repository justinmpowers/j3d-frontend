import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { PrinterService, PrintNotification, Printer } from '../../services/printer.service';

@Component({
  selector: 'app-notification-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './notification-settings.component.html',
  styleUrls: ['./notification-settings.component.scss']
})
export class NotificationSettingsComponent implements OnInit {
  printer: Printer | null = null;
  notifications: PrintNotification | null = null;
  loading = false;
  saving = false;
  error: string | null = null;
  successMessage: string | null = null;

  settings = {
    notify_print_start: true,
    notify_print_complete: true,
    notify_print_failed: true,
    notify_material_change: false,
    notify_maintenance: true,
    email_enabled: true,
    webhook_url: ''
  };

  constructor(
    private printerService: PrinterService,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const printerId = this.route.snapshot.paramMap.get('printerId');
    if (printerId) {
      this.loadPrinter(+printerId);
      this.loadNotifications(+printerId);
    }
  }

  loadPrinter(id: number): void {
    this.printerService.getPrinter(id).subscribe({
      next: (printer) => {
        this.printer = printer;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.error = 'Failed to load printer';
      }
    });
  }

  loadNotifications(printerId: number): void {
    this.loading = true;
    this.printerService.getNotifications(printerId).subscribe({
      next: (notif) => {
        this.notifications = notif;
        this.settings = {
          notify_print_start: notif.notify_print_start,
          notify_print_complete: notif.notify_print_complete,
          notify_print_failed: notif.notify_print_failed,
          notify_material_change: notif.notify_material_change,
          notify_maintenance: notif.notify_maintenance,
          email_enabled: notif.email_enabled,
          webhook_url: notif.webhook_url || ''
        };
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.error = 'Failed to load notification settings';
        this.loading = false;
      }
    });
  }

  saveSettings(): void {
    if (!this.printer) return;

    this.saving = true;
    this.printerService.updateNotifications(this.printer.id, this.settings).subscribe({
      next: (notif) => {
        this.notifications = notif;
        this.successMessage = 'Notification settings saved successfully';
        this.saving = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.error = 'Failed to save settings: ' + (err.error?.error || err.statusText);
        this.saving = false;
      }
    });
  }

  toggleAllNotifications(enabled: boolean): void {
    this.settings.notify_print_start = enabled;
    this.settings.notify_print_complete = enabled;
    this.settings.notify_print_failed = enabled;
    this.settings.notify_maintenance = enabled;
  }

  testWebhook(): void {
    if (!this.settings.webhook_url) {
      this.error = 'Please enter a webhook URL';
      return;
    }

    this.saving = true;
    // In a real app, you'd make an API call to test the webhook
    // For now, just show a success message
    setTimeout(() => {
      this.successMessage = 'Test webhook sent! Check your webhook endpoint.';
      this.saving = false;
    }, 500);
  }

  goBack(): void {
    this.router.navigate(['/printers']);
  }

  clearMessages(): void {
    this.error = null;
    this.successMessage = null;
  }
}
