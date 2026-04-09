import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';
import { TokenService } from '../auth/token.service';

/**
 * WebSocket service that connects to the /ws/users namespace.
 * Used for realtime device command flows (workstation binding, print, scan).
 */
@Injectable({ providedIn: 'root' })
export class UserWebSocketService {
    private socket: Socket | null = null;

    constructor(private tokenService: TokenService) { }

    connect(): void {
        if (this.socket?.connected) return;
        if (!this.tokenService.getAccessToken()) return;

        this.socket = io(`${environment.wsUrl}/ws/users`, {
            auth: (cb) => {
                cb({ token: `Bearer ${this.tokenService.getAccessToken()}` });
            },
            transports: ['websocket'],
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
        });

        this.socket.on('connect', () => {
            console.log('UserWebSocket connected (/ws/users)');
        });

        this.socket.on('disconnect', (reason: string) => {
            console.log('UserWebSocket disconnected:', reason);
        });

        this.socket.on('connect_error', (error: Error) => {
            console.error('UserWebSocket connection error:', error.message);
        });
    }

    disconnect(): void {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }

    on<T>(event: string): Observable<T> {
        return new Observable<T>((observer) => {
            if (!this.socket) {
                observer.error('UserWebSocket not connected');
                return;
            }

            const handler = (data: T) => observer.next(data);
            this.socket.on(event, handler);

            return () => {
                this.socket?.off(event, handler);
            };
        });
    }

    emit(event: string, data: unknown): void {
        this.socket?.emit(event, data);
    }

    get isConnected(): boolean {
        return this.socket?.connected ?? false;
    }
}
