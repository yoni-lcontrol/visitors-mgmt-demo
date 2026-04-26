import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiService } from '@core/api/api.service';
import { VisitorsApiService } from './visitors-api.service';

describe('VisitorsApiService', () => {
    let service: VisitorsApiService;
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
                VisitorsApiService,
                { provide: ApiService, useValue: apiSpy },
            ],
        });

        service = TestBed.inject(VisitorsApiService);
    });

    it('should load visitors with query params', () => {
        service.getAll({ page: 2, limit: 25 }).subscribe();

        expect(apiSpy.get).toHaveBeenCalledWith('/visitors', { page: 2, limit: 25 });
    });

    it('should create a visitor', () => {
        const payload = { personId: '123456789', firstName: 'Jane', lastName: 'Smith', phone: '0501234567' };

        service.create(payload).subscribe();

        expect(apiSpy.post).toHaveBeenCalledWith('/visitors', payload);
    });

    it('should update a visitor', () => {
        service.update('visitor-1', { firstName: 'Updated' }).subscribe();

        expect(apiSpy.patch).toHaveBeenCalledWith('/visitors/visitor-1', { firstName: 'Updated' });
    });

    it('should delete a visitor', () => {
        service.delete('visitor-1').subscribe();

        expect(apiSpy.delete).toHaveBeenCalledWith('/visitors/visitor-1');
    });

    it('should export visitors', () => {
        service.export({ sortBy: 'createdAt', sortOrder: 'DESC' }).subscribe();

        expect(apiSpy.download).toHaveBeenCalledWith('/visitors/export', { sortBy: 'createdAt', sortOrder: 'DESC' });
    });
});
