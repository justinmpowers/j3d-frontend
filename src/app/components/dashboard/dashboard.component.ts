import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from 'services/auth.service';
import { OrderService } from 'services/order.service';
import { FilamentService } from 'services/filament.service';
import { PrinterService, Printer } from 'services/printer.service';
import { AlertsService, AlertSettings } from 'services/alerts.service';
import { ManyfoldService, ManyfoldSettings } from 'services/manyfold.service';
import { Order, Filament, ProductProfile, OrderNote, CommunicationLog } from 'models/types';
import { AnalyticsComponent } from 'components/analytics/analytics.component';
import { ProductionComponent } from 'components/production/production.component';
import { PrinterManagementComponent } from 'components/printer-management/printer-management.component';
import { ManyfoldPickerComponent } from 'components/manyfold-picker/manyfold-picker.component';
import { HttpClient } from '@angular/common/http';
import { environment } from 'environments/environment';

@Component({
    selector: 'app-dashboard',
    standalone: true,
    imports: [CommonModule, FormsModule, AnalyticsComponent, ProductionComponent, PrinterManagementComponent, ManyfoldPickerComponent],
    templateUrl: './dashboard.component.html',
    styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent implements OnInit {
    activeTab: 'orders' | 'filaments' | 'analytics' | 'products' | 'production' | 'printers' | 'integrations' = 'orders';
    orders: Order[] = [];
    selectedOrders: Set<number> = new Set();
    orderFilters: {
        status: string;
        production_status: string;
        product: string;
        start_date: string;
        end_date: string;
        min_total?: number;
        max_total?: number;
    } = {
        status: '',
        production_status: '',
        product: '',
        start_date: '',
        end_date: '',
    };
    noteDrafts: Record<number, string> = {};
    notesCache: Record<number, OrderNote[]> = {};
    commDrafts: Record<number, { message: string; direction: string; channel: string }> = {};
    commCache: Record<number, CommunicationLog[]> = {};
    labelDrafts: Record<number, { provider: string; tracking: string }> = {};
    photoFiles: Record<number, File | null> = {};
    filaments: Filament[] = [];
    lowStockFilaments: Filament[] = [];
    printerIssues: string[] = [];
    private printerPollIntervalId: any = null;
    private dataPollIntervalId: any = null;
    productProfiles: ProductProfile[] = [];
    username: string = '';
    shopName: string = '';
    appVersion: string = '';
    shopId: number | null = null;
    showLinkShop = false;
    linkShopInput = '';
    linkShopError = '';
    syncingOrders = false;
    autoSyncComplete = false;
    syncingProducts = false;
    etsyNeedsReconnect = false;
    showAddFilament = false;
    showAddProduct = false;
    editingFilament: Filament | null = null;
    editingProduct: ProductProfile | null = null;
    filamentForm = {
        material: '',
        color: '',
        initial_amount: 0,
        current_amount: 0,
        cost_per_gram: 0,
        low_stock_threshold: 100
    };
    
    productForm = {
        product_name: '',
        description: '',
        standard_filament_amount: 0,
        preferred_material: '',
        preferred_color: '',
        print_time_minutes: 0,
        notes: '',
        category: '',
        nozzle_temp_c: null as number | null,
        bed_temp_c: null as number | null,
        print_speed_mms: null as number | null,
        support_settings: '',
        infill_percent: null as number | null,
        layer_height_mm: null as number | null,
        material_cost: null as number | null,
        labor_minutes: null as number | null,
        overhead_cost: null as number | null,
        target_margin_pct: null as number | null,
        suggested_price: null as number | null
    };

    manyfoldSettings: ManyfoldSettings = { user_id: 0, base_url: null, client_id: null, has_client_secret: false };
    manyfoldForm = { base_url: '', client_id: '', client_secret: '' };
    savingManyfoldSettings = false;
    linkingProduct: ProductProfile | null = null;

    constructor(
        private authService: AuthService,
        private orderService: OrderService,
        private filamentService: FilamentService,
        private router: Router,
        private http: HttpClient,
            private printerService: PrinterService,
            private alertsService: AlertsService,
            private manyfoldService: ManyfoldService,
            private cdr: ChangeDetectorRef
    ) { }

    ngOnInit(): void {
        this.authService.user$.subscribe(user => {
            if (user) {
                this.username = user.first_name || user.username;
                this.shopName = user.shop_name || '';
                this.shopId = user.shop_id ? Number(user.shop_id) : null;
                this.showLinkShop = !user.shop_id;
                this.cdr.detectChanges();
            }
        });

        this.http.get<{ status: string; version: string }>(`${environment.apiUrl}/health`).subscribe({
            next: (r) => { this.appVersion = r.version; this.cdr.detectChanges(); }
        });

        this.loadOrders();
        this.loadFilaments();
        this.loadProductProfiles();
        this.loadManyfoldSettings();

        // Auto-sync orders on initial load
        this.autoSyncOrders();

        // Initial checks
        this.checkLowStockAlerts();
        this.checkPrinterAlerts();

        // Start periodic printer alert polling
        this.startPrinterAlertPolling();
        this.startDataPolling();
    }

    ngOnDestroy(): void {
        if (this.printerPollIntervalId) {
            clearInterval(this.printerPollIntervalId);
            this.printerPollIntervalId = null;
        }
        if (this.dataPollIntervalId) {
            clearInterval(this.dataPollIntervalId);
            this.dataPollIntervalId = null;
        }
    }

    submitLinkShop(): void {
        const name = this.linkShopInput.trim();
        if (!name) return;
        this.linkShopError = '';
        const headers = { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}`, 'Content-Type': 'application/json' };
        this.http.post<{ shop_id: number; shop_name: string }>(`${environment.apiUrl}/auth/link-shop`, { shop_name: name }, { headers }).subscribe({
            next: (r) => {
                this.shopId = r.shop_id;
                this.shopName = r.shop_name;
                this.showLinkShop = false;
                this.autoSyncOrders();
            },
            error: (e) => {
                this.linkShopError = e.error?.error || 'Failed to link shop. Check the shop name and try again.';
            }
        });
    }

    autoSyncOrders(): void {
        // Only auto-sync if not already synced in this session
        if (!this.autoSyncComplete && !this.syncingOrders) {
            this.syncingOrders = true;
            this.orderService.syncOrders().subscribe({
                next: (response) => {
                    this.syncingOrders = false;
                    this.autoSyncComplete = true;
                    this.loadOrders();
                    console.log('Orders auto-synced successfully');
                },
                error: (error) => {
                    this.syncingOrders = false;
                    console.error('Auto-sync failed:', error);
                    // Don't show alert for auto-sync failures, just log them
                }
            });
        }
    }

    loadOrders(): void {
        const filters = { ...this.orderFilters };
        this.orderService.getOrders(filters).subscribe(
            (response) => {
                this.orders = response.orders;
                // Reset selections for orders that no longer exist
                this.selectedOrders.forEach(id => {
                    if (!this.orders.find(o => o.id === id)) {
                        this.selectedOrders.delete(id);
                    }
                });
                this.orders.forEach(o => {
                    if (!this.noteDrafts[o.id]) this.noteDrafts[o.id] = '';
                    if (!this.commDrafts[o.id]) this.commDrafts[o.id] = { message: '', direction: 'outbound', channel: 'message' };
                    if (!this.labelDrafts[o.id]) this.labelDrafts[o.id] = { provider: o.shipping_provider || 'manual', tracking: o.tracking_number || '' };
                });
                this.cdr.detectChanges();
            },
            (error) => {
                console.error('Error loading orders:', error);
            }
        );
    }

    applyFilters(): void {
        this.loadOrders();
    }

    clearFilters(): void {
        this.orderFilters = {
            status: '',
            production_status: '',
            product: '',
            start_date: '',
            end_date: '',
            min_total: undefined,
            max_total: undefined
        };
        this.loadOrders();
    }

    // Filters UI state
    showFilters: boolean = false;

    ngAfterViewInit(): void {
        // Default collapsed; restore previous state
        const saved = localStorage.getItem('dashboard_filters_collapsed');
        this.showFilters = saved ? saved !== 'true' : false;
    }

    toggleFilters(): void {
        this.showFilters = !this.showFilters;
        localStorage.setItem('dashboard_filters_collapsed', (!this.showFilters).toString());
    }

    activeFilterCount(): number {
        const f = this.orderFilters;
        let count = 0;
        if (f.status) count++;
        if (f.production_status) count++;
        if (f.product) count++;
        if (f.start_date) count++;
        if (f.end_date) count++;
        if (typeof f.min_total === 'number' && f.min_total !== undefined) count++;
        if (typeof f.max_total === 'number' && f.max_total !== undefined) count++;
        return count;
    }

    activeFilterChips(): string[] {
        const chips: string[] = [];
        const f = this.orderFilters;
        if (f.status) chips.push(`Status: ${f.status}`);
        if (f.production_status) chips.push(`Prod: ${f.production_status}`);
        if (f.product) chips.push(`Product: ${f.product}`);
        if (f.start_date) chips.push(`From: ${f.start_date}`);
        if (f.end_date) chips.push(`To: ${f.end_date}`);
        if (typeof f.min_total === 'number' && f.min_total !== undefined) chips.push(`Min: ${f.min_total}`);
        if (typeof f.max_total === 'number' && f.max_total !== undefined) chips.push(`Max: ${f.max_total}`);
        return chips;
    }

    loadFilaments(): void {
        this.filamentService.getFilaments().subscribe(
            (response) => {
                this.filaments = response.filaments;
                this.lowStockFilaments = this.filaments.filter(f => f.is_low_stock || (typeof f.low_stock_threshold === 'number' && f.current_amount <= f.low_stock_threshold));
                this.cdr.detectChanges();
            },
            (error) => {
                console.error('Error loading filaments:', error);
            }
        );
    }

    private checkLowStockAlerts(): void {
        // If filaments already loaded, compute immediately; otherwise rely on loadFilaments callback
        if (this.filaments && this.filaments.length > 0) {
            this.lowStockFilaments = this.filaments.filter(f => f.is_low_stock || (typeof f.low_stock_threshold === 'number' && f.current_amount <= f.low_stock_threshold));
        }
    }

    private startPrinterAlertPolling(): void {
        this.printerPollIntervalId = setInterval(() => {
            this.checkPrinterAlerts();
        }, 60000);
    }

    private startDataPolling(): void {
        // Refresh orders, filaments, and product profiles every 30 seconds
        this.dataPollIntervalId = setInterval(() => {
            this.loadOrders();
            this.loadFilaments();
            this.loadProductProfiles();
        }, 30000);
    }

    private checkPrinterAlerts(): void {
        this.printerService.getPrinters().subscribe({
            next: (printers: Printer[]) => {
                const problematic = printers.filter(p => {
                    const s = (p.status || '').toLowerCase();
                    return s.includes('error') || s.includes('fail') || s.includes('fault') || s.includes('offline');
                });
                this.printerIssues = problematic.map(p => p.name || `Printer #${p.id}`);
                this.cdr.detectChanges();
            },
            error: (err) => {
                // Non-blocking: do not surface to UI
                console.error('Failed to check printer alerts', err);
            }
        });
    }

    getLowStockFilamentsDisplay(): string {
        return this.lowStockFilaments
            .slice(0, 3)
            .map(f => `${f.material} ${f.color} (${f.current_amount}${f.unit})`)
            .join(', ');
    }

    // ===== Alerts integration =====
    showAlertSettings = false;
    alertSettings: AlertSettings = {
        slack_webhook_url: '',
        discord_webhook_url: '',
        email_enabled: false,
        email_to: '',
        telegram_bot_token: '',
        telegram_chat_id: '',
    };
    alertPreview: { low_stock: any[]; printer_issues: any[] } | null = null;
    triggeringAlerts = false;
    savingAlertSettings = false;

    openAlertSettings(): void {
        this.showAlertSettings = true;
        this.loadAlertSettings();
        this.loadAlertPreview();
    }

    closeAlertSettings(): void {
        this.showAlertSettings = false;
    }

    loadAlertSettings(): void {
        this.alertsService.getSettings().subscribe({
            next: (settings) => {
                this.alertSettings = settings || this.alertSettings;
                this.cdr.detectChanges();
            },
            error: (err) => console.error('Failed to load alert settings', err)
        });
    }

    saveAlertSettings(): void {
        this.savingAlertSettings = true;
        this.alertsService.updateSettings(this.alertSettings).subscribe({
            next: (settings) => {
                this.alertSettings = settings;
                this.savingAlertSettings = false;
                alert('Alert settings saved');
                this.cdr.detectChanges();
            },
            error: (err) => {
                console.error('Failed to save alert settings', err);
                this.savingAlertSettings = false;
                alert('Failed to save alert settings');
            }
        });
    }

    loadAlertPreview(): void {
        this.alertsService.preview().subscribe({
            next: (data) => { this.alertPreview = data; this.cdr.detectChanges(); },
            error: (err) => console.error('Failed to load alert preview', err)
        });
    }

    triggerAlerts(): void {
        this.triggeringAlerts = true;
        this.alertsService.trigger().subscribe({
            next: (res) => {
                this.triggeringAlerts = false;
                const ch = (res.channels || []).join(', ') || 'none';
                alert(`Alerts sent: ${res.sent ? 'yes' : 'no'} (channels: ${ch})`);
                this.cdr.detectChanges();
            },
            error: (err) => {
                console.error('Failed to trigger alerts', err);
                this.triggeringAlerts = false;
                alert('Failed to send alerts');
            }
        });
    }

    syncOrders(): void {
        this.syncingOrders = true;
        this.orderService.syncOrders().subscribe({
            next: (response) => {
                this.syncingOrders = false;
                this.loadOrders();
                alert('Orders synced successfully!');
            },
            error: (error) => {
                this.syncingOrders = false;
                console.error('Error syncing orders:', error);
                alert('Failed to sync orders');
            }
        });
    }

    syncEtsyListings(): void {
        this.syncingProducts = true;
        this.http.post<{ success: boolean; needs_reconnect?: boolean; error?: string; message?: string }>(
            `${environment.apiUrl}/products/sync-etsy`, {}
        ).subscribe({
            next: (response) => {
                this.syncingProducts = false;
                if (response.needs_reconnect) {
                    this.etsyNeedsReconnect = true;
                    alert(response.error || 'Please reconnect your Etsy account to sync listings.');
                    return;
                }
                this.etsyNeedsReconnect = false;
                this.loadProductProfiles();
                alert(response.message || 'Products synced successfully!');
            },
            error: (error) => {
                this.syncingProducts = false;
                if (error.error?.needs_reconnect) {
                    this.etsyNeedsReconnect = true;
                }
                console.error('Error syncing Etsy listings:', error);
                alert(error.error?.error || 'Failed to sync products from Etsy');
            }
        });
    }

    reconnectEtsy(): void {
        this.authService.getLoginUrl().subscribe(response => {
            if (response.auth_url && response.code_verifier) {
                sessionStorage.setItem('oauth_code_verifier', response.code_verifier);
                window.location.href = response.auth_url;
            }
        });
    }

    loadManyfoldSettings(): void {
        this.manyfoldService.getSettings().subscribe({
            next: (settings) => {
                this.manyfoldSettings = settings;
                this.manyfoldForm.base_url = settings.base_url || '';
                this.manyfoldForm.client_id = settings.client_id || '';
                this.cdr.detectChanges();
            }
        });
    }

    saveManyfoldSettings(): void {
        this.savingManyfoldSettings = true;
        this.manyfoldService.updateSettings(
            this.manyfoldForm.base_url,
            this.manyfoldForm.client_id,
            this.manyfoldForm.client_secret || undefined
        ).subscribe({
            next: (settings) => {
                this.savingManyfoldSettings = false;
                this.manyfoldSettings = settings;
                this.manyfoldForm.client_secret = '';
                alert('Manyfold settings saved.');
            },
            error: (error) => {
                this.savingManyfoldSettings = false;
                alert(error.error?.error || 'Failed to save Manyfold settings');
            }
        });
    }

    openManyfoldPicker(product: ProductProfile): void {
        this.linkingProduct = product;
    }

    closeManyfoldPicker(): void {
        this.linkingProduct = null;
    }

    onManyfoldLinked(): void {
        this.linkingProduct = null;
        this.loadProductProfiles();
    }

    unlinkManyfold(product: ProductProfile): void {
        this.manyfoldService.unlinkModel(product.id).subscribe({
            next: () => this.loadProductProfiles(),
            error: () => alert('Failed to unlink Manyfold model')
        });
    }

    toggleOrderSelection(orderId: number): void {
        if (this.selectedOrders.has(orderId)) {
            this.selectedOrders.delete(orderId);
        } else {
            this.selectedOrders.add(orderId);
        }
    }

    selectAllOrders(): void {
        this.orders.forEach(o => this.selectedOrders.add(o.id));
    }

    clearSelection(): void {
        this.selectedOrders.clear();
    }

    bulkMarkShipped(): void {
        if (this.selectedOrders.size === 0) {
            alert('Select at least one order');
            return;
        }
        this.orderService.bulkActions(Array.from(this.selectedOrders), 'mark_shipped').subscribe({
            next: () => {
                this.loadOrders();
            },
            error: (err) => {
                console.error('Bulk mark shipped failed', err);
                alert('Bulk mark shipped failed');
            }
        });
    }

    bulkAssignFilament(): void {
        if (this.selectedOrders.size === 0) {
            alert('Select at least one order');
            return;
        }
        this.orderService.bulkActions(Array.from(this.selectedOrders), 'assign_filament').subscribe({
            next: () => {
                this.loadOrders();
                this.loadFilaments();
            },
            error: (err) => {
                console.error('Bulk assign filament failed', err);
                alert('Bulk assign filament failed');
            }
        });
    }

    saveNote(order: Order): void {
        const content = this.noteDrafts[order.id];
        if (!content || !content.trim()) {
            alert('Note cannot be empty');
            return;
        }
        this.orderService.addNote(order.id, content).subscribe({
            next: (note) => {
                this.noteDrafts[order.id] = '';
                if (!this.notesCache[order.id]) this.notesCache[order.id] = [];
                this.notesCache[order.id].unshift(note);
                this.cdr.detectChanges();
            },
            error: (err) => {
                console.error('Failed to add note', err);
                alert('Failed to add note');
            }
        });
    }

    loadNotes(order: Order): void {
        if (this.notesCache[order.id]) return; // already loaded
        this.orderService.listNotes(order.id).subscribe({
            next: (res) => {
                this.notesCache[order.id] = res.notes;
                this.cdr.detectChanges();
            },
            error: (err) => console.error('Failed to load notes', err)
        });
    }

    saveCommunication(order: Order): void {
        const draft = this.commDrafts[order.id] || { message: '', direction: 'outbound', channel: 'message' };
        if (!draft.message || !draft.message.trim()) {
            alert('Message cannot be empty');
            return;
        }
        this.orderService.addCommunication(order.id, draft).subscribe({
            next: (log) => {
                if (!this.commCache[order.id]) this.commCache[order.id] = [];
                this.commCache[order.id].unshift(log);
                this.commDrafts[order.id] = { message: '', direction: 'outbound', channel: 'message' };
                this.loadOrders();
                this.cdr.detectChanges();
            },
            error: (err) => {
                console.error('Failed to add communication', err);
                alert('Failed to add communication');
            }
        });
    }

    loadCommunications(order: Order): void {
        if (this.commCache[order.id]) return;
        this.orderService.listCommunications(order.id).subscribe({
            next: (res) => { this.commCache[order.id] = res.logs; this.cdr.detectChanges(); },
            error: (err) => console.error('Failed to load communications', err)
        });
    }

    onPhotoSelected(event: any, order: Order): void {
        const file = event.target.files?.[0];
        this.photoFiles[order.id] = file || null;
    }

    uploadPhoto(order: Order): void {
        const file = this.photoFiles[order.id];
        if (!file) {
            alert('Select a photo first');
            return;
        }
        this.orderService.uploadPhoto(order.id, file).subscribe({
            next: (res) => {
                order.photo_url = res.photo_url;
                this.photoFiles[order.id] = null;
                this.cdr.detectChanges();
            },
            error: (err) => {
                console.error('Photo upload failed', err);
                alert('Photo upload failed');
            }
        });
    }

    saveShippingLabel(order: Order): void {
        const draft = this.labelDrafts[order.id] || { provider: 'manual', tracking: '' };
        this.orderService.updateShippingLabel(order.id, {
            provider: draft.provider,
            tracking_number: draft.tracking,
            status: 'CREATED'
        }).subscribe({
            next: (updated) => {
                Object.assign(order, updated);
                this.cdr.detectChanges();
            },
            error: (err) => {
                console.error('Shipping label save failed', err);
                alert('Shipping label save failed');
            }
        });
    }

    editFilament(filament: Filament): void {
        this.editingFilament = filament;
        this.filamentForm = {
            material: filament.material,
            color: filament.color,
            initial_amount: filament.initial_amount,
            current_amount: filament.current_amount,
            cost_per_gram: filament.cost_per_gram || 0,
            low_stock_threshold: filament.low_stock_threshold || 100
        };
        this.showAddFilament = true;
    }

    deleteFilament(filamentId: number): void {
        if (confirm('Are you sure you want to delete this filament?')) {
            this.filamentService.deleteFilament(filamentId).subscribe(
                () => {
                    this.loadFilaments();
                },
                (error) => {
                    console.error('Error deleting filament:', error);
                    alert('Failed to delete filament');
                }
            );
        }
    }

    saveFilament(): void {
        if (this.editingFilament) {
            this.filamentService.updateFilament(this.editingFilament.id, this.filamentForm).subscribe(
                () => {
                    this.loadFilaments();
                    this.closeModal();
                },
                (error) => {
                    console.error('Error updating filament:', error);
                    alert('Failed to update filament');
                }
            );
        } else {
            this.filamentService.createFilament(this.filamentForm).subscribe(
                () => {
                    this.loadFilaments();
                    this.closeModal();
                },
                (error) => {
                    console.error('Error creating filament:', error);
                    alert('Failed to create filament');
                }
            );
        }
    }

    editOrderFilament(order: Order): void {
        alert(`Managing filament for order ${order.etsy_order_id} - This feature will be implemented soon`);
    }

    autoAssignFilament(order: Order): void {
        if (confirm(`Auto-assign filament to order #${order.etsy_order_id}? This will match order items to product profiles and deduct filament from inventory.`)) {
            this.orderService.autoAssignFilament(order.id).subscribe({
                next: (response) => {
                    alert(response.message);
                    this.loadOrders();
                    this.loadFilaments();
                },
                error: (error) => {
                    console.error('Error auto-assigning filament:', error);
                    alert(error.error?.message || 'Failed to auto-assign filament');
                }
            });
        }
    }

    loadProductProfiles(): void {
        this.http.get<{ profiles: ProductProfile[], total: number }>(`${environment.apiUrl}/product-profiles`, {
            headers: this.authService.getAuthHeaders()
        }).subscribe({
            next: (response) => {
                this.productProfiles = response.profiles;
                this.cdr.detectChanges();
            },
            error: (error) => {
                console.error('Error loading product profiles:', error);
            }
        });
    }

    editProduct(product: ProductProfile): void {
        this.editingProduct = product;
        this.productForm = {
            product_name: product.product_name,
            description: product.description || '',
            standard_filament_amount: product.standard_filament_amount,
            preferred_material: product.preferred_material || '',
            preferred_color: product.preferred_color || '',
            print_time_minutes: product.print_time_minutes || 0,
            notes: product.notes || '',
            category: product.category || '',
            nozzle_temp_c: product.nozzle_temp_c ?? null,
            bed_temp_c: product.bed_temp_c ?? null,
            print_speed_mms: product.print_speed_mms ?? null,
            support_settings: product.support_settings || '',
            infill_percent: product.infill_percent ?? null,
            layer_height_mm: product.layer_height_mm ?? null,
            material_cost: product.material_cost ?? null,
            labor_minutes: product.labor_minutes ?? null,
            overhead_cost: product.overhead_cost ?? null,
            target_margin_pct: product.target_margin_pct ?? null,
            suggested_price: product.suggested_price ?? null
        };
        this.showAddProduct = true;
    }

    deleteProduct(productId: number): void {
        if (confirm('Are you sure you want to delete this product profile?')) {
            this.http.delete(`${environment.apiUrl}/product-profiles/${productId}`, {
                headers: this.authService.getAuthHeaders()
            }).subscribe({
                next: () => {
                    this.loadProductProfiles();
                },
                error: (error) => {
                    console.error('Error deleting product:', error);
                    alert('Failed to delete product profile');
                }
            });
        }
    }

    saveProduct(): void {
        if (this.editingProduct) {
            this.http.put(`${environment.apiUrl}/product-profiles/${this.editingProduct.id}`, this.productForm, {
                headers: this.authService.getAuthHeaders()
            }).subscribe({
                next: () => {
                    this.loadProductProfiles();
                    this.closeProductModal();
                },
                error: (error) => {
                    console.error('Error updating product:', error);
                    alert('Failed to update product profile');
                }
            });
        } else {
            this.http.post(`${environment.apiUrl}/product-profiles`, this.productForm, {
                headers: this.authService.getAuthHeaders()
            }).subscribe({
                next: () => {
                    this.loadProductProfiles();
                    this.closeProductModal();
                },
                error: (error) => {
                    console.error('Error creating product:', error);
                    alert('Failed to create product profile');
                }
            });
        }
    }

    closeProductModal(): void {
        this.showAddProduct = false;
        this.editingProduct = null;
        this.productForm = {
            product_name: '',
            description: '',
            standard_filament_amount: 0,
            preferred_material: '',
            preferred_color: '',
            print_time_minutes: 0,
            notes: '',
            category: '',
            nozzle_temp_c: null,
            bed_temp_c: null,
            print_speed_mms: null,
            support_settings: '',
            infill_percent: null,
            layer_height_mm: null,
            material_cost: null,
            labor_minutes: null,
            overhead_cost: null,
            target_margin_pct: null,
            suggested_price: null
        };
    }

    closeModal(): void {
        this.showAddFilament = false;
        this.editingFilament = null;
        this.filamentForm = {
            material: '',
            color: '',
            initial_amount: 0,
            current_amount: 0,
            cost_per_gram: 0,
            low_stock_threshold: 100
        };
    }

    formatDate(dateString: string): string {
        const date = new Date(dateString);
        return date.toLocaleDateString();
    }

    logout(): void {
        this.authService.logout().subscribe({
            next: () => {
                this.router.navigate(['/login']);
            },
            error: (error) => {
                console.error('Error logging out:', error);
                // Clear token and navigate anyway
                this.authService.clearToken();
                this.router.navigate(['/login']);
            }
        });
    }
}