import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ManyfoldService, ManyfoldMember } from '../../services/manyfold.service';

/**
 * Browse-and-pick dialog for linking a product to a Manyfold model.
 * Manyfold's API has no free-text search (only page/creator/collection filters),
 * so this filters client-side over whatever page is currently loaded.
 */
@Component({
  selector: 'app-manyfold-picker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './manyfold-picker.component.html',
  styleUrls: ['./manyfold-picker.component.scss']
})
export class ManyfoldPickerComponent implements OnInit {
  @Input() productId!: number;
  @Input() baseUrl: string = '';
  @Output() linked = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();

  creators: ManyfoldMember[] = [];
  selectedCreatorId: string = '';
  models: ManyfoldMember[] = [];
  page = 1;
  hasNextPage = false;
  filterText = '';
  loading = false;
  linking = false;
  error: string | null = null;

  constructor(private manyfoldService: ManyfoldService) {}

  ngOnInit(): void {
    this.manyfoldService.listCreators(1).subscribe({
      next: (res) => this.creators = res.member || [],
      error: () => {} // creator dropdown is optional; browsing still works without it
    });
    this.loadModels();
  }

  get filteredModels(): ManyfoldMember[] {
    const q = this.filterText.trim().toLowerCase();
    if (!q) return this.models;
    return this.models.filter(m => m.name.toLowerCase().includes(q));
  }

  loadModels(): void {
    this.loading = true;
    this.error = null;
    const creatorId = this.selectedCreatorId ? this.idFromRef(this.selectedCreatorId) : undefined;
    this.manyfoldService.listModels(this.page, creatorId).subscribe({
      next: (res) => {
        this.loading = false;
        this.models = res.member || [];
        this.hasNextPage = !!res.view?.next;
      },
      error: () => {
        this.loading = false;
        this.error = 'Could not load models from Manyfold.';
      }
    });
  }

  onCreatorChange(): void {
    this.page = 1;
    this.loadModels();
  }

  nextPage(): void {
    if (!this.hasNextPage) return;
    this.page++;
    this.loadModels();
  }

  prevPage(): void {
    if (this.page <= 1) return;
    this.page--;
    this.loadModels();
  }

  selectModel(member: ManyfoldMember): void {
    const modelId = this.idFromRef(member['@id']);
    const modelUrl = this.absoluteUrl(member['@id']);
    this.linking = true;
    this.manyfoldService.linkModel(this.productId, modelId, modelUrl).subscribe({
      next: () => {
        this.linking = false;
        this.linked.emit();
      },
      error: () => {
        this.linking = false;
        this.error = 'Could not link this model. Please try again.';
      }
    });
  }

  private idFromRef(ref: string): string {
    return ref.split('/').filter(Boolean).pop() || ref;
  }

  private absoluteUrl(ref: string): string {
    return ref.startsWith('http') ? ref : `${this.baseUrl}${ref}`;
  }

  close(): void {
    this.closed.emit();
  }
}
