import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'environments/environment';

export interface ManyfoldSettings {
  user_id: number;
  base_url: string | null;
  client_id: string | null;
  has_client_secret: boolean;
}

export interface ManyfoldMember {
  '@id': string;
  name: string;
}

export interface ManyfoldCollectionPage {
  totalItems: number;
  member: ManyfoldMember[];
  view?: {
    next?: string;
    prev?: string;
    first?: string;
    last?: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class ManyfoldService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getSettings(): Observable<ManyfoldSettings> {
    return this.http.get<ManyfoldSettings>(`${this.apiUrl}/integrations/manyfold/settings`);
  }

  updateSettings(base_url: string, client_id: string, client_secret?: string): Observable<ManyfoldSettings> {
    return this.http.put<ManyfoldSettings>(`${this.apiUrl}/integrations/manyfold/settings`, {
      base_url, client_id, client_secret
    });
  }

  listModels(page: number, creator?: string): Observable<ManyfoldCollectionPage> {
    const params: Record<string, string> = { page: String(page) };
    if (creator) params['creator'] = creator;
    return this.http.get<ManyfoldCollectionPage>(`${this.apiUrl}/integrations/manyfold/models`, { params });
  }

  listCreators(page: number): Observable<ManyfoldCollectionPage> {
    return this.http.get<ManyfoldCollectionPage>(`${this.apiUrl}/integrations/manyfold/creators`, { params: { page: String(page) } });
  }

  linkModel(productId: number, manyfoldModelId: string, manyfoldModelUrl: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/products/${productId}/link-manyfold`, {
      manyfold_model_id: manyfoldModelId,
      manyfold_model_url: manyfoldModelUrl
    });
  }

  unlinkModel(productId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/products/${productId}/link-manyfold`);
  }
}
