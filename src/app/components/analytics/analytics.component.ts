import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AnalyticsService, AnalyticsSummary, RevenueTrends, ProductPerformanceResponse } from '../../services/analytics.service';

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './analytics.component.html',
  styleUrls: ['./analytics.component.scss']
})
export class AnalyticsComponent implements OnInit {
  summary: AnalyticsSummary | null = null;
  revenueTrends: RevenueTrends | null = null;
  productPerformance: ProductPerformanceResponse | null = null;
  selectedPeriod: 'daily' | 'weekly' | 'monthly' = 'daily';
  loading = true;
  error: string | null = null;

  constructor(private analyticsService: AnalyticsService, private cdr: ChangeDetectorRef) { }

  ngOnInit(): void {
    this.loadAnalytics();
  }

  loadAnalytics(): void {
    this.loading = true;
    this.error = null;

    // Load all analytics data
    this.analyticsService.getSummary().subscribe({
      next: (data) => {
        this.summary = data;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading summary:', error);
        this.error = 'Failed to load analytics summary';
        this.loading = false;
      }
    });

    this.loadRevenueTrends();

    this.analyticsService.getProductPerformance().subscribe({
      next: (data) => {
        this.productPerformance = data;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading product performance:', error);
        this.error = 'Failed to load product performance';
        this.loading = false;
      }
    });
  }

  loadRevenueTrends(): void {
    this.analyticsService.getRevenueTrends(this.selectedPeriod).subscribe({
      next: (data) => {
        this.revenueTrends = data;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading revenue trends:', error);
      }
    });
  }

  onPeriodChange(): void {
    this.loadRevenueTrends();
  }

  getStatusKeys(): string[] {
    return this.summary ? Object.keys(this.summary.orders_by_status) : [];
  }

  getStatusColor(status: string): string {
    const colors: { [key: string]: string } = {
      'PENDING': '#FF9800',
      'PAID': '#4CAF50',
      'SHIPPED': '#2196F3',
      'COMPLETED': '#00897B',
      'DELIVERED': '#9C27B0',
      'CANCELED': '#F44336',
      'CANCELLED': '#F44336',
      'REFUNDED': '#757575'
    };
    return colors[status] || '#757575';
  }

  getTopProducts(limit: number = 10): any[] {
    if (!this.productPerformance) return [];
    return this.productPerformance.products.slice(0, limit);
  }

  getChartMaxValue(): number {
    if (!this.revenueTrends || !this.revenueTrends.trends.length) return 100;
    const maxRevenue = Math.max(...this.revenueTrends.trends.map(t => t.revenue));
    const maxProfit = Math.max(...this.revenueTrends.trends.map(t => t.profit));
    const max = Math.max(maxRevenue, maxProfit);
    return max > 0 ? Math.ceil(max * 1.2) : 100; // Add 20% padding, minimum 100
  }

  getBarHeight(value: number): number {
    const max = this.getChartMaxValue();
    if (max <= 0 || value <= 0) return 0;
    const height = (value / max) * 100;
    return Math.max(height, 2); // Minimum 2% height to be visible
  }

  formatCurrency(value: number): string {
    return `$${value.toFixed(2)}`;
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    if (this.selectedPeriod === 'monthly') {
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
    } else if (this.selectedPeriod === 'weekly') {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  }
}
