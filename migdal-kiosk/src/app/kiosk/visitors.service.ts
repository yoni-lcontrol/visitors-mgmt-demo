// src/app/services/visitors.service.ts
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class VisitorsService {
  private lastResponse: VisitorCheckinResponse | null = null;

  async checkIn(req: VisitorCheckinRequest): Promise<VisitorCheckinResponse> {
    // Simulate network delay
    await this.delay(600);

    const response: VisitorCheckinResponse = {
      checkinId: this.makeId(),
      createdAt: new Date().toISOString(),
      request: req,
    };

    this.lastResponse = response;
    return response;
  }

  getLastCheckin(): VisitorCheckinResponse | null {
    return this.lastResponse;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private makeId(): string {
    return Math.random().toString(16).slice(2) + '-' + Date.now().toString(16);
  }
}


// src/app/models/visitor-checkin.model.ts
export interface VisitorCheckinRequest {
  firstName: string;
  lastName: string;
  phone: string;
  hostName: string;
  meetingSubject: string;
  meetingTime: string; // ISO or simple string
}

export interface VisitorCheckinResponse {
  checkinId: string;
  createdAt: string;
  request: VisitorCheckinRequest;
}