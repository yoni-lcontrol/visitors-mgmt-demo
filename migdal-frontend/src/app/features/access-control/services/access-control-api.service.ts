import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/api/api.service';
import { AcController, Door, Extension, DoorIo, ExtensionIo, AccessLevel, PaginatedResult } from '../../../core/models/entities.model';

@Injectable({ providedIn: 'root' })
export class AccessControlApiService {
    private readonly api = inject(ApiService);
    private readonly basePath = '/access-control';

    // ===== Controllers =====
    getControllers(params: Record<string, string | number>): Observable<PaginatedResult<AcController>> {
        return this.api.get<PaginatedResult<AcController>>(`${this.basePath}/controllers`, params);
    }

    getControllerById(id: string): Observable<AcController> {
        return this.api.get<AcController>(`${this.basePath}/controllers/${id}`);
    }

    createController(payload: Record<string, unknown>): Observable<AcController> {
        return this.api.post<AcController>(`${this.basePath}/controllers`, payload);
    }

    updateController(id: string, payload: Record<string, unknown>): Observable<AcController> {
        return this.api.patch<AcController>(`${this.basePath}/controllers/${id}`, payload);
    }

    deleteController(id: string): Observable<void> {
        return this.api.delete<void>(`${this.basePath}/controllers/${id}`);
    }

    exportControllers(params: Record<string, string | number>): Observable<Blob> {
        return this.api.download(`${this.basePath}/controllers/export`, params);
    }

    importControllers(): Observable<void> {
        return this.api.post<void>(`${this.basePath}/controllers/import`, {});
    }

    // ===== Doors =====
    createDoor(payload: Record<string, unknown>): Observable<Door> {
        return this.api.post<Door>(`${this.basePath}/doors`, payload);
    }

    updateDoor(id: string, payload: Record<string, unknown>): Observable<Door> {
        return this.api.patch<Door>(`${this.basePath}/doors/${id}`, payload);
    }

    deleteDoor(id: string): Observable<void> {
        return this.api.delete<void>(`${this.basePath}/doors/${id}`);
    }

    // ===== Extensions =====
    createExtension(payload: Record<string, unknown>): Observable<Extension> {
        return this.api.post<Extension>(`${this.basePath}/extensions`, payload);
    }

    updateExtension(id: string, payload: Record<string, unknown>): Observable<Extension> {
        return this.api.patch<Extension>(`${this.basePath}/extensions/${id}`, payload);
    }

    deleteExtension(id: string): Observable<void> {
        return this.api.delete<void>(`${this.basePath}/extensions/${id}`);
    }

    // ===== Door IOs =====
    getDoorIos(doorId: string): Observable<DoorIo[]> {
        return this.api.get<DoorIo[]>(`${this.basePath}/door-ios/by-door/${doorId}`);
    }

    createDoorIo(payload: Record<string, unknown>): Observable<DoorIo> {
        return this.api.post<DoorIo>(`${this.basePath}/door-ios`, payload);
    }

    updateDoorIo(id: string, payload: Record<string, unknown>): Observable<DoorIo> {
        return this.api.patch<DoorIo>(`${this.basePath}/door-ios/${id}`, payload);
    }

    deleteDoorIo(id: string): Observable<void> {
        return this.api.delete<void>(`${this.basePath}/door-ios/${id}`);
    }

    // ===== Extension IOs =====
    getExtensionIos(extensionId: string): Observable<ExtensionIo[]> {
        return this.api.get<ExtensionIo[]>(`${this.basePath}/extension-ios/by-extension/${extensionId}`);
    }

    createExtensionIo(payload: Record<string, unknown>): Observable<ExtensionIo> {
        return this.api.post<ExtensionIo>(`${this.basePath}/extension-ios`, payload);
    }

    updateExtensionIo(id: string, payload: Record<string, unknown>): Observable<ExtensionIo> {
        return this.api.patch<ExtensionIo>(`${this.basePath}/extension-ios/${id}`, payload);
    }

    deleteExtensionIo(id: string): Observable<void> {
        return this.api.delete<void>(`${this.basePath}/extension-ios/${id}`);
    }

    // ===== Access Levels =====
    getAccessLevels(params: Record<string, string | number>): Observable<PaginatedResult<AccessLevel>> {
        return this.api.get<PaginatedResult<AccessLevel>>(`${this.basePath}/access-levels`, params);
    }

    createAccessLevel(payload: Record<string, unknown>): Observable<AccessLevel> {
        return this.api.post<AccessLevel>(`${this.basePath}/access-levels`, payload);
    }

    updateAccessLevel(id: string, payload: Record<string, unknown>): Observable<AccessLevel> {
        return this.api.patch<AccessLevel>(`${this.basePath}/access-levels/${id}`, payload);
    }

    deleteAccessLevel(id: string): Observable<void> {
        return this.api.delete<void>(`${this.basePath}/access-levels/${id}`);
    }

    importAccessLevels(): Observable<void> {
        return this.api.post<void>(`${this.basePath}/access-levels/import`, {});
    }
}
