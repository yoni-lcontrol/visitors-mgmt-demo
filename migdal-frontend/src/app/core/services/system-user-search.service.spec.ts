import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { SystemUserSearchService, SystemUserSuggestion } from './system-user-search.service';
import { ApiService } from '@core/api/api.service';

describe('SystemUserSearchService', () => {
    let service: SystemUserSearchService;
    let mockApi: jasmine.SpyObj<ApiService>;

    const fakeUser = {
        id: 'u1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '0501234567',
        sector: { name: 'IT' },
    };

    beforeEach(() => {
        mockApi = jasmine.createSpyObj('ApiService', ['get']);

        TestBed.configureTestingModule({
            providers: [
                SystemUserSearchService,
                { provide: ApiService, useValue: mockApi },
            ],
        });

        service = TestBed.inject(SystemUserSearchService);
    });

    it('should return empty array for short queries', (done) => {
        service.searchUsers('a').subscribe((result) => {
            expect(result).toEqual([]);
            expect(mockApi.get).not.toHaveBeenCalled();
            done();
        });
    });

    it('should return empty array for empty string', (done) => {
        service.searchUsers('').subscribe((result) => {
            expect(result).toEqual([]);
            expect(mockApi.get).not.toHaveBeenCalled();
            done();
        });
    });

    it('should call API with isActive filter', (done) => {
        mockApi.get.and.returnValue(of({ items: [fakeUser], total: 1 }));

        service.searchUsers('John').subscribe(() => {
            const [url, params] = mockApi.get.calls.mostRecent().args;
            expect(url).toBe('/users/lookup');
            expect(params!['search']).toBe('John');
            const filters = JSON.parse(params!['filters'] as string);
            expect(filters.isActive).toEqual({ value: true, matchMode: 'equals' });
            done();
        });
    });

    it('should map users to suggestions', (done) => {
        mockApi.get.and.returnValue(of({ items: [fakeUser], total: 1 }));

        service.searchUsers('John').subscribe((result: SystemUserSuggestion[]) => {
            expect(result.length).toBe(1);
            expect(result[0]).toEqual({
                id: 'u1',
                firstName: 'John',
                lastName: 'Doe',
                fullName: 'John Doe',
                email: 'john@example.com',
                phone: '0501234567',
                sectorName: 'IT',
            });
            done();
        });
    });
});
