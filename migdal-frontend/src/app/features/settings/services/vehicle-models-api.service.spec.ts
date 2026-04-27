import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiService } from '@core/api/api.service';
import { VehicleModelsApiService } from './vehicle-models-api.service';

describe('VehicleModelsApiService', () => {
    let service: VehicleModelsApiService;
    let apiSpy: jasmine.SpyObj<ApiService>;

    beforeEach(() => {
        apiSpy = jasmine.createSpyObj<ApiService>('ApiService', ['get', 'post', 'patch', 'delete', 'download']);
        apiSpy.get.and.returnValue(of({ items: [], total: 0, page: 1, limit: 20 }));
        apiSpy.post.and.returnValue(of({}));
        apiSpy.patch.and.returnValue(of({}));
        apiSpy.delete.and.returnValue(of(undefined));
        apiSpy.download.and.returnValue(of(new Blob()));

        TestBed.configureTestingModule({
            providers: [
                VehicleModelsApiService,
                { provide: ApiService, useValue: apiSpy },
            ],
        });

        service = TestBed.inject(VehicleModelsApiService);
    });

    it('should load paginated vehicle models', () => {
        service.getAll({ page: 2, limit: 25 }).subscribe();

        expect(apiSpy.get).toHaveBeenCalledWith('/settings/vehicle-models', { page: 2, limit: 25 });
    });

    it('should create a vehicle model', () => {
        const payload = { manufacturer: 'Toyota', model: 'Corolla' };

        service.create(payload).subscribe();

        expect(apiSpy.post).toHaveBeenCalledWith('/settings/vehicle-models', payload);
    });

    it('should update a vehicle model', () => {
        service.update('vehicle-1', { model: 'Yaris' }).subscribe();

        expect(apiSpy.patch).toHaveBeenCalledWith('/settings/vehicle-models/vehicle-1', { model: 'Yaris' });
    });

    it('should delete a vehicle model', () => {
        service.delete('vehicle-1').subscribe();

        expect(apiSpy.delete).toHaveBeenCalledWith('/settings/vehicle-models/vehicle-1');
    });

    it('should load seeded manufacturers', () => {
        service.getManufacturers().subscribe();

        expect(apiSpy.get).toHaveBeenCalledWith('/settings/vehicle-models/manufacturers');
    });

    it('should export vehicle models', () => {
        service.export({ sortBy: 'manufacturer', sortOrder: 'ASC' }).subscribe();

        expect(apiSpy.download).toHaveBeenCalledWith('/settings/vehicle-models/export', {
            sortBy: 'manufacturer',
            sortOrder: 'ASC',
        });
    });
});
