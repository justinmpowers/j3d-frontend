import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { PrinterService, Printer, PrinterStatus } from '../../services/printer.service';

@Component({
  selector: 'app-printer-management',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './printer-management.component.html',
  styleUrls: ['./printer-management.component.scss']
})
export class PrinterManagementComponent implements OnInit, OnDestroy {
  printers: Printer[] = [];
  selectedPrinter: Printer | null = null;
  isAdding = false;
  isEditing = false;
  loading = false;
  error: string | null = null;
  successMessage: string | null = null;

  liveStatus: PrinterStatus | null = null;
  statusLoading = false;
  statusError: string | null = null;
  private statusPollInterval: any = null;

  newPrinter: Partial<Printer> & { api_key?: string; access_code?: string } = {
    name: '',
    connection_type: 'bambu_cloud',
    api_url: '',
    serial_number: '',
  };

  // Separate fields not on the Printer interface (credentials)
  formApiKey = '';
  formAccessCode = '';

  printerTypes = ['octoprint', 'klipper', 'bambu'];
  connectionTypes = ['octoprint', 'klipper', 'bambu_cloud', 'bambu_lan'];

  constructor(private printerService: PrinterService) {}

  ngOnInit(): void {
    this.loadPrinters();
  }

  ngOnDestroy(): void {
    this.stopStatusPolling();
  }

  loadPrinters(): void {
    this.loading = true;
    this.printerService.getPrinters().subscribe({
      next: (data) => {
        this.printers = data;
        this.loading = false;
        // Refresh selected printer data if one is selected
        if (this.selectedPrinter) {
          const updated = data.find(p => p.id === this.selectedPrinter!.id);
          if (updated) this.selectedPrinter = updated;
        }
      },
      error: () => {
        this.error = 'Failed to load printers';
        this.loading = false;
      }
    });
  }

  selectPrinter(printer: Printer): void {
    this.selectedPrinter = printer;
    this.isAdding = false;
    this.isEditing = false;
    this.liveStatus = null;
    this.statusError = null;
    this.startStatusPolling();
  }

  startStatusPolling(): void {
    this.stopStatusPolling();
    if (!this.selectedPrinter?.connection_id) return;
    this.refreshStatus();
    this.statusPollInterval = setInterval(() => this.refreshStatus(), 30000);
  }

  stopStatusPolling(): void {
    if (this.statusPollInterval) {
      clearInterval(this.statusPollInterval);
      this.statusPollInterval = null;
    }
  }

  refreshStatus(): void {
    if (!this.selectedPrinter?.connection_id) {
      this.statusError = 'No connection configured for this printer.';
      return;
    }
    this.statusLoading = true;
    this.statusError = null;
    this.printerService.getPrinterStatus(this.selectedPrinter.connection_id).subscribe({
      next: (status) => {
        this.liveStatus = status;
        this.statusLoading = false;
        // Update connection status on the printer object
        if (this.selectedPrinter) {
          this.selectedPrinter.connection_status = 'connected';
        }
      },
      error: (err) => {
        this.statusLoading = false;
        const msg = err.error?.error || 'Could not reach printer';
        this.statusError = msg;
        if (this.selectedPrinter) {
          this.selectedPrinter.connection_status = 'error';
        }
      }
    });
  }

  startAdding(): void {
    this.isAdding = true;
    this.isEditing = false;
    this.selectedPrinter = null;
    this.stopStatusPolling();
    this.resetForm();
  }

  startEditing(): void {
    if (this.selectedPrinter) {
      this.isEditing = true;
      this.newPrinter = {
        name: this.selectedPrinter.name,
        connection_type: this.selectedPrinter.connection_type || 'bambu_cloud',
        api_url: this.selectedPrinter.api_url || '',
        serial_number: this.selectedPrinter.serial_number || '',
      };
      this.formApiKey = '';
      this.formAccessCode = '';
    }
  }

  savePrinter(): void {
    if (this.isAdding) {
      this.createPrinter();
    } else if (this.isEditing && this.selectedPrinter) {
      this.updatePrinter();
    }
  }

  createPrinter(): void {
    if (!this.newPrinter.name) {
      this.error = 'Printer name is required';
      return;
    }

    const payload: any = {
      name: this.newPrinter.name,
      connection_type: this.newPrinter.connection_type,
      api_url: this.newPrinter.api_url,
      serial_number: this.newPrinter.serial_number,
      api_key: this.formApiKey || undefined,
      access_code: this.formAccessCode || undefined,
    };

    this.loading = true;
    this.printerService.createPrinter(payload).subscribe({
      next: (printer) => {
        this.printers.push(printer);
        this.successMessage = 'Printer created successfully';
        this.isAdding = false;
        this.loading = false;
        this.resetForm();
        this.selectPrinter(printer);
      },
      error: (err) => {
        this.error = 'Failed to create printer: ' + (err.error?.error || err.statusText);
        this.loading = false;
      }
    });
  }

  updatePrinter(): void {
    if (!this.selectedPrinter) return;

    const updates: any = {};
    if (this.newPrinter.name) updates.name = this.newPrinter.name;
    if (this.newPrinter.connection_type) updates.connection_type = this.newPrinter.connection_type;
    if (this.newPrinter.api_url) updates.api_url = this.newPrinter.api_url;
    if (this.newPrinter.serial_number) updates.serial_number = this.newPrinter.serial_number;
    if (this.formApiKey) updates.api_key = this.formApiKey;
    if (this.formAccessCode) updates.access_code = this.formAccessCode;

    this.loading = true;
    this.printerService.updatePrinter(this.selectedPrinter.id, updates).subscribe({
      next: (printer) => {
        const index = this.printers.findIndex(p => p.id === printer.id);
        if (index !== -1) this.printers[index] = printer;
        this.selectedPrinter = printer;
        this.successMessage = 'Printer updated successfully';
        this.isEditing = false;
        this.loading = false;
        this.resetForm();
        this.startStatusPolling();
      },
      error: (err) => {
        this.error = 'Failed to update printer: ' + (err.error?.error || err.statusText);
        this.loading = false;
      }
    });
  }

  deletePrinter(printer: Printer): void {
    if (!confirm(`Delete "${printer.name}"? This cannot be undone.`)) return;
    this.loading = true;
    this.printerService.deletePrinter(printer.id).subscribe({
      next: () => {
        this.printers = this.printers.filter(p => p.id !== printer.id);
        if (this.selectedPrinter?.id === printer.id) {
          this.selectedPrinter = null;
          this.liveStatus = null;
          this.stopStatusPolling();
        }
        this.successMessage = 'Printer deleted';
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Failed to delete printer: ' + (err.error?.error || err.statusText);
        this.loading = false;
      }
    });
  }

  cancel(): void {
    this.isAdding = false;
    this.isEditing = false;
    this.resetForm();
    if (this.selectedPrinter) this.startStatusPolling();
  }

  resetForm(): void {
    this.newPrinter = { name: '', connection_type: 'bambu_cloud', api_url: '', serial_number: '' };
    this.formApiKey = '';
    this.formAccessCode = '';
  }

  clearMessages(): void {
    this.error = null;
    this.successMessage = null;
  }

  getConnectionLabel(type: string | undefined): string {
    const labels: Record<string, string> = {
      bambu_cloud: 'Bambu Cloud',
      bambu_lan: 'Bambu LAN',
      octoprint: 'OctoPrint',
      klipper: 'Klipper / Moonraker',
    };
    return labels[type || ''] || type || 'Unknown';
  }

  getStatusDotClass(status: string | undefined): string {
    switch (status) {
      case 'connected': return 'dot-green';
      case 'error': return 'dot-red';
      default: return 'dot-gray';
    }
  }
}
