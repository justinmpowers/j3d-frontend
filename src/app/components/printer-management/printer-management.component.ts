import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { PrinterService, Printer } from '../../services/printer.service';

@Component({
  selector: 'app-printer-management',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './printer-management.component.html',
  styleUrls: ['./printer-management.component.scss']
})
export class PrinterManagementComponent implements OnInit {
  printers: Printer[] = [];
  selectedPrinter: Printer | null = null;
  isAdding = false;
  isEditing = false;
  loading = false;
  error: string | null = null;
  successMessage: string | null = null;

  newPrinter: Partial<Printer> = {
    name: '',
    type: 'bambu',
    connection_type: 'bambu_cloud',
    api_url: '',
    api_key: '',
    serial_number: '',
    access_code: ''
  };

  printerTypes = ['octoprint', 'klipper', 'bambu'];
  connectionTypes = ['octoprint', 'klipper', 'bambu_cloud', 'bambu_lan'];

  constructor(private printerService: PrinterService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.loadPrinters();
  }

  loadPrinters(): void {
    this.loading = true;
    this.printerService.getPrinters().subscribe({
      next: (data) => {
        this.printers = data;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.error = 'Failed to load printers';
        this.loading = false;
      }
    });
  }

  selectPrinter(printer: Printer): void {
    this.selectedPrinter = printer;
    this.isAdding = false;
    this.isEditing = false;
  }

  startAdding(): void {
    this.isAdding = true;
    this.isEditing = false;
    this.selectedPrinter = null;
    this.newPrinter = {
      name: '',
      type: 'bambu',
      connection_type: 'bambu_cloud',
      api_url: '',
      api_key: '',
      serial_number: '',
      access_code: ''
    };
  }

  startEditing(): void {
    if (this.selectedPrinter) {
      this.isEditing = true;
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

    this.loading = true;
    this.printerService.createPrinter(this.newPrinter).subscribe({
      next: (printer) => {
        this.printers.push(printer);
        this.successMessage = 'Printer created successfully';
        this.isAdding = false;
        this.loading = false;
        this.resetForm();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.error = 'Failed to create printer: ' + (err.error?.error || err.statusText);
        this.loading = false;
      }
    });
  }

  updatePrinter(): void {
    if (!this.selectedPrinter) return;

    const updates: Partial<Printer> = {};
    if (this.newPrinter.name) updates.name = this.newPrinter.name;
    if (this.newPrinter.type) updates.type = this.newPrinter.type;
    if (this.newPrinter.connection_type) updates.connection_type = this.newPrinter.connection_type;
    if (this.newPrinter.api_url) updates.api_url = this.newPrinter.api_url;
    if (this.newPrinter.api_key) updates.api_key = this.newPrinter.api_key;
    if (this.newPrinter.serial_number) updates.serial_number = this.newPrinter.serial_number;
    if (this.newPrinter.access_code) updates.access_code = this.newPrinter.access_code;

    this.loading = true;
    this.printerService.updatePrinter(this.selectedPrinter.id, updates).subscribe({
      next: (printer) => {
        const index = this.printers.findIndex(p => p.id === printer.id);
        if (index !== -1) {
          this.printers[index] = printer;
        }
        this.selectedPrinter = printer;
        this.successMessage = 'Printer updated successfully';
        this.isEditing = false;
        this.loading = false;
        this.resetForm();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.error = 'Failed to update printer: ' + (err.error?.error || err.statusText);
        this.loading = false;
      }
    });
  }

  deletePrinter(printer: Printer): void {
    if (confirm(`Are you sure you want to delete "${printer.name}"?`)) {
      this.loading = true;
      this.printerService.deletePrinter(printer.id).subscribe({
        next: () => {
          this.printers = this.printers.filter(p => p.id !== printer.id);
          if (this.selectedPrinter?.id === printer.id) {
            this.selectedPrinter = null;
          }
          this.successMessage = 'Printer deleted successfully';
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.error = 'Failed to delete printer: ' + (err.error?.error || err.statusText);
          this.loading = false;
        }
      });
    }
  }

  cancel(): void {
    this.isAdding = false;
    this.isEditing = false;
    this.resetForm();
  }

  resetForm(): void {
    this.newPrinter = {
      name: '',
      type: 'bambu',
      connection_type: 'bambu_cloud'
    };
  }

  clearMessages(): void {
    this.error = null;
    this.successMessage = null;
  }
}
