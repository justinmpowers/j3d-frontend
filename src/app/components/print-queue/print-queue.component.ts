import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { PrinterService, ScheduledPrint, Printer } from '../../services/printer.service';

@Component({
  selector: 'app-print-queue',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './print-queue.component.html',
  styleUrls: ['./print-queue.component.scss']
})
export class PrintQueueComponent implements OnInit {
  printer: Printer | null = null;
  prints: ScheduledPrint[] = [];
  queuePrints: ScheduledPrint[] = [];
  selectedPrint: ScheduledPrint | null = null;
  loading = false;
  error: string | null = null;
  successMessage: string | null = null;
  filterStatus = 'all';

  statuses = ['all', 'queued', 'scheduled', 'started', 'completed', 'failed'];

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
      this.loadPrints(+printerId);
      this.loadQueue(+printerId);
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

  loadPrints(printerId: number): void {
    this.loading = true;
    this.printerService.getScheduledPrints(printerId).subscribe({
      next: (prints) => {
        this.prints = prints;
        this.applyFilter();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.error = 'Failed to load prints';
        this.loading = false;
      }
    });
  }

  loadQueue(printerId: number): void {
    this.printerService.getPrintQueue(printerId).subscribe({
      next: (prints) => {
        this.queuePrints = prints;
        this.cdr.detectChanges();
      },
      error: (err) => {
        // Error handled silently
      }
    });
  }

  applyFilter(): void {
    if (this.filterStatus === 'all') {
      return;
    }
    this.prints = this.prints.filter(p => p.status === this.filterStatus);
  }

  selectPrint(print: ScheduledPrint): void {
    this.selectedPrint = print;
  }

  startPrint(print: ScheduledPrint): void {
    this.updatePrintStatus(print, 'started');
  }

  completePrint(print: ScheduledPrint): void {
    this.updatePrintStatus(print, 'completed');
  }

  failPrint(print: ScheduledPrint): void {
    const reason = prompt('Enter failure reason:');
    if (reason) {
      this.printerService.updateScheduledPrint(print.id, {
        status: 'failed',
        failed_reason: reason
      }).subscribe({
        next: (updated) => {
          const index = this.prints.findIndex(p => p.id === updated.id);
          if (index !== -1) {
            this.prints[index] = updated;
          }
          this.selectedPrint = updated;
          this.successMessage = 'Print marked as failed';
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.error = 'Failed to update print status';
        }
      });
    }
  }

  updatePrintStatus(print: ScheduledPrint, status: string): void {
    this.loading = true;
    this.printerService.updateScheduledPrint(print.id, { status }).subscribe({
      next: (updated) => {
        const index = this.prints.findIndex(p => p.id === updated.id);
        if (index !== -1) {
          this.prints[index] = updated;
        }
        this.selectedPrint = updated;
        this.loadQueue(this.printer!.id);
        this.successMessage = `Print status updated to ${status}`;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.error = 'Failed to update print status: ' + (err.error?.error || err.statusText);
        this.loading = false;
      }
    });
  }

  deletePrint(print: ScheduledPrint): void {
    if (confirm('Are you sure you want to delete this print job?')) {
      this.loading = true;
      this.printerService.deleteScheduledPrint(print.id).subscribe({
        next: () => {
          this.prints = this.prints.filter(p => p.id !== print.id);
          if (this.selectedPrint?.id === print.id) {
            this.selectedPrint = null;
          }
          this.successMessage = 'Print job deleted';
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.error = 'Failed to delete print: ' + (err.error?.error || err.statusText);
          this.loading = false;
        }
      });
    }
  }

  getStatusColor(status: string | undefined): string {
    switch (status) {
      case 'queued':
        return 'queued';
      case 'scheduled':
        return 'scheduled';
      case 'started':
        return 'started';
      case 'completed':
        return 'completed';
      case 'failed':
        return 'failed';
      default:
        return 'unknown';
    }
  }

  goBack(): void {
    this.router.navigate(['/printers']);
  }

  clearMessages(): void {
    this.error = null;
    this.successMessage = null;
  }
}
