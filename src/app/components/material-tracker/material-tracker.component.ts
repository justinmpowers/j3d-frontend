import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { PrinterService, BambuMaterial, Printer } from '../../services/printer.service';

@Component({
  selector: 'app-material-tracker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './material-tracker.component.html',
  styleUrls: ['./material-tracker.component.scss']
})
export class MaterialTrackerComponent implements OnInit {
  printer: Printer | null = null;
  materials: BambuMaterial[] = [];
  selectedMaterial: BambuMaterial | null = null;
  isAdding = false;
  loading = false;
  error: string | null = null;
  successMessage: string | null = null;

  newMaterial: Partial<BambuMaterial> = {
    slot: 0,
    material_type: 'PLA',
    color: '',
    weight_grams: 250,
    remaining_pct: 100,
    vendor: '',
    cost_per_kg: 25
  };

  materialTypes = ['PLA', 'ABS', 'PETG', 'TPU', 'ASA', 'PA'];

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
      this.loadMaterials(+printerId);
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

  loadMaterials(printerId: number): void {
    this.loading = true;
    this.printerService.getMaterials(printerId).subscribe({
      next: (materials) => {
        this.materials = materials;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.error = 'Failed to load materials';
        this.loading = false;
      }
    });
  }

  selectMaterial(material: BambuMaterial): void {
    this.selectedMaterial = material;
    this.isAdding = false;
    this.resetForm();
  }

  startAdding(): void {
    this.isAdding = true;
    this.selectedMaterial = null;
    this.resetForm();
  }

  saveMaterial(): void {
    if (!this.printer) return;

    if (!this.newMaterial.material_type) {
      this.error = 'Material type is required';
      return;
    }

    this.loading = true;
    this.printerService.addMaterial(this.printer.id, this.newMaterial).subscribe({
      next: (material) => {
        this.materials.push(material);
        this.successMessage = 'Material added successfully';
        this.isAdding = false;
        this.loading = false;
        this.resetForm();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.error = 'Failed to add material: ' + (err.error?.error || err.statusText);
        this.loading = false;
      }
    });
  }

  updateMaterial(): void {
    if (!this.selectedMaterial) return;

    const updates: Partial<BambuMaterial> = {
      remaining_pct: this.newMaterial.remaining_pct
    };

    this.loading = true;
    this.printerService.updateMaterial(this.selectedMaterial.id, updates).subscribe({
      next: (material) => {
        const index = this.materials.findIndex(m => m.id === material.id);
        if (index !== -1) {
          this.materials[index] = material;
        }
        this.selectedMaterial = material;
        this.successMessage = 'Material updated successfully';
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.error = 'Failed to update material: ' + (err.error?.error || err.statusText);
        this.loading = false;
      }
    });
  }

  deleteMaterial(material: BambuMaterial): void {
    if (confirm('Are you sure you want to remove this material?')) {
      // Note: No delete endpoint exists, just remove from list locally
      this.materials = this.materials.filter(m => m.id !== material.id);
      if (this.selectedMaterial?.id === material.id) {
        this.selectedMaterial = null;
      }
      this.successMessage = 'Material removed';
    }
  }

  cancel(): void {
    this.isAdding = false;
    this.resetForm();
  }

  resetForm(): void {
    this.newMaterial = {
      slot: 0,
      material_type: 'PLA',
      color: '',
      weight_grams: 250,
      remaining_pct: 100,
      vendor: '',
      cost_per_kg: 25
    };
  }

  clearMessages(): void {
    this.error = null;
    this.successMessage = null;
  }

  goBack(): void {
    this.router.navigate(['/printers']);
  }

  getProgressColor(remaining: number | undefined): string {
    if (!remaining) return 'good';
    if (remaining >= 50) return 'good';
    if (remaining >= 25) return 'warning';
    return 'critical';
  }

  getProgressLabel(remaining: number | undefined): string {
    if (!remaining) return 'Unknown';
    if (remaining >= 50) return 'Good';
    if (remaining >= 25) return 'Low';
    return 'Critical';
  }
}
