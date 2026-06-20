import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductionService } from '../../services/production.service';
import { Order, PrintSession } from '../../models/types';

@Component({
  selector: 'app-production',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './production.component.html',
  styleUrls: ['./production.component.scss']
})
export class ProductionComponent implements OnInit {
  orders: Order[] = [];
  sessions: PrintSession[] = [];
  loading = false;
  error: string | null = null;
  selectedOrders: Set<number> = new Set();
  
  // Filters
  filterStatus: string = 'ALL';
  filterPriority: string = 'ALL';
  
  // Session creation
  showSessionModal = false;
  newSessionName = '';
  newSessionNotes = '';
  
  // Order editing
  editingOrderId: number | null = null;
  editedPrintTime: number | null = null;
  editedNotes: string = '';

  constructor(private productionService: ProductionService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.loadProductionQueue();
    this.loadPrintSessions();
  }

  loadProductionQueue(): void {
    this.loading = true;
    this.error = null;
    
    this.productionService.getProductionQueue().subscribe({
      next: (response) => {
        this.orders = response.orders;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.error = 'Failed to load production queue';
        this.loading = false;
      }
    });
  }

  loadPrintSessions(): void {
    this.productionService.getPrintSessions().subscribe({
      next: (response) => {
        this.sessions = response.sessions;
        this.cdr.detectChanges();
      },
      error: (err) => {
        // Error handled silently
      }
    });
  }

  get filteredOrders(): Order[] {
    return this.orders.filter(order => {
      const statusMatch = this.filterStatus === 'ALL' || order.production_status === this.filterStatus;
      const priorityMatch = this.filterPriority === 'ALL' || order.priority.toString() === this.filterPriority;
      return statusMatch && priorityMatch;
    });
  }

  getStatusClass(status: string): string {
    const statusMap: { [key: string]: string } = {
      'QUEUED': 'status-queued',
      'PRINTING': 'status-printing',
      'PRINTED': 'status-printed',
      'SHIPPED': 'status-shipped',
      'FAILED': 'status-failed'
    };
    return statusMap[status] || 'status-default';
  }

  getPriorityLabel(priority: number): string {
    const labels: { [key: number]: string } = {
      1: 'URGENT',
      2: 'HIGH',
      3: 'MEDIUM',
      4: 'LOW',
      5: 'BACKLOG'
    };
    return labels[priority] || 'MEDIUM';
  }

  getPriorityClass(priority: number): string {
    const classes: { [key: number]: string } = {
      1: 'priority-urgent',
      2: 'priority-high',
      3: 'priority-medium',
      4: 'priority-low',
      5: 'priority-backlog'
    };
    return classes[priority] || 'priority-medium';
  }

  updateStatus(order: Order, newStatus: string): void {
    this.productionService.updateProductionStatus(order.id, newStatus).subscribe({
      next: (updated) => {
        const index = this.orders.findIndex(o => o.id === order.id);
        if (index !== -1) {
          this.orders[index] = updated;
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        alert('Failed to update status');
      }
    });
  }

  changePriority(order: Order, delta: number): void {
    const newPriority = Math.max(1, Math.min(5, order.priority + delta));
    if (newPriority !== order.priority) {
      this.productionService.updatePriority(order.id, newPriority).subscribe({
        next: (updated) => {
          const index = this.orders.findIndex(o => o.id === order.id);
          if (index !== -1) {
            this.orders[index] = updated;
          }
          this.loadProductionQueue(); // Reload to get correct sorting
          this.cdr.detectChanges();
        },
        error: (err) => {
          alert('Failed to update priority');
        }
      });
    }
  }

  toggleOrderSelection(orderId: number): void {
    if (this.selectedOrders.has(orderId)) {
      this.selectedOrders.delete(orderId);
    } else {
      this.selectedOrders.add(orderId);
    }
  }

  selectAll(): void {
    this.filteredOrders.forEach(order => this.selectedOrders.add(order.id));
  }

  clearSelection(): void {
    this.selectedOrders.clear();
  }

  openSessionModal(): void {
    if (this.selectedOrders.size === 0) {
      alert('Please select at least one order');
      return;
    }
    this.showSessionModal = true;
  }

  closeSessionModal(): void {
    this.showSessionModal = false;
    this.newSessionName = '';
    this.newSessionNotes = '';
  }

  createSession(): void {
    if (!this.newSessionName.trim()) {
      alert('Please enter a session name');
      return;
    }

    const orderIds = Array.from(this.selectedOrders);
    this.productionService.createPrintSession(
      this.newSessionName,
      orderIds,
      this.newSessionNotes
    ).subscribe({
      next: (session) => {
        this.sessions.unshift(session);
        this.closeSessionModal();
        this.clearSelection();
        this.loadProductionQueue(); // Refresh to show updated session assignments
        this.cdr.detectChanges();
      },
      error: (err) => {
        alert('Failed to create session');
        console.error(err);
      }
    });
  }

  startEditing(order: Order): void {
    this.editingOrderId = order.id;
    this.editedPrintTime = order.estimated_print_time;
    this.editedNotes = order.print_notes || '';
  }

  saveEdits(order: Order): void {
    if (this.editedPrintTime !== null && this.editedPrintTime !== order.estimated_print_time) {
      this.productionService.updatePrintTime(order.id, this.editedPrintTime).subscribe({
        next: (updated) => {
          const index = this.orders.findIndex(o => o.id === order.id);
          if (index !== -1) {
            this.orders[index] = updated;
          }
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Failed to update print time', err);
        }
      });
    }

    if (this.editedNotes !== (order.print_notes || '')) {
      this.productionService.updateProductionStatus(
        order.id,
        order.production_status,
        this.editedNotes
      ).subscribe({
        next: (updated) => {
          const index = this.orders.findIndex(o => o.id === order.id);
          if (index !== -1) {
            this.orders[index] = updated;
          }
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Failed to update notes', err);
        }
      });
    }

    this.cancelEditing();
  }

  cancelEditing(): void {
    this.editingOrderId = null;
    this.editedPrintTime = null;
    this.editedNotes = '';
  }

  formatTime(minutes: number | null): string {
    if (!minutes) return '-';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  }

  getTotalEstimatedTime(): string {
    const total = this.filteredOrders.reduce(
      (sum, order) => sum + (order.estimated_print_time || 0),
      0
    );
    return this.formatTime(total);
  }

  getSelectedEstimatedTime(): string {
    const total = this.filteredOrders
      .filter(order => this.selectedOrders.has(order.id))
      .reduce((sum, order) => sum + (order.estimated_print_time || 0), 0);
    return this.formatTime(total);
  }

  getStatusCount(status: string): number {
    return this.filteredOrders.filter(order => order.production_status === status).length;
  }
}
