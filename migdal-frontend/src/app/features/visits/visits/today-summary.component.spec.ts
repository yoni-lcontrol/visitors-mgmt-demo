import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { TodaySummaryComponent } from './today-summary.component';
import { VisitsApiService, TodaySummary } from '../services/visits-api.service';
import { UserWebSocketService } from '@core/websocket/user-websocket.service';

describe('TodaySummaryComponent', () => {
    let component: TodaySummaryComponent;
    let fixture: ComponentFixture<TodaySummaryComponent>;
    let visitsApiSpy: jasmine.SpyObj<VisitsApiService>;
    let wsSpy: jasmine.SpyObj<UserWebSocketService>;

    const mockSummary: TodaySummary = {
        totalVisitsToday: 10,
        arrivedToday: 3,
        checkedInToday: 2,
        completedToday: 5,
    };

    beforeEach(async () => {
        visitsApiSpy = jasmine.createSpyObj('VisitsApiService', ['getTodaySummary']);
        visitsApiSpy.getTodaySummary.and.returnValue(of(mockSummary));

        wsSpy = jasmine.createSpyObj('UserWebSocketService', ['on']);
        wsSpy.on.and.returnValue(new Subject());

        await TestBed.configureTestingModule({
            imports: [TodaySummaryComponent, TranslateModule.forRoot()],
            providers: [
                { provide: VisitsApiService, useValue: visitsApiSpy },
                { provide: UserWebSocketService, useValue: wsSpy },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(TodaySummaryComponent);
        component = fixture.componentInstance;
    });

    it('should create', () => {
        fixture.detectChanges();
        expect(component).toBeTruthy();
    });

    it('should load summary on init', () => {
        fixture.detectChanges();
        expect(visitsApiSpy.getTodaySummary).toHaveBeenCalled();
        expect(component.summary).toEqual(mockSummary);
        expect(component.loading).toBeFalse();
    });

    it('should render 4 summary cards', () => {
        fixture.detectChanges();
        const cards = fixture.nativeElement.querySelectorAll('.summary-card');
        expect(cards.length).toBe(4);
    });

    it('should display correct values in cards', () => {
        fixture.detectChanges();
        const values: HTMLElement[] = fixture.nativeElement.querySelectorAll('.card-value');
        expect(values[0].textContent?.trim()).toBe('10');
        expect(values[1].textContent?.trim()).toBe('3');
        expect(values[2].textContent?.trim()).toBe('2');
        expect(values[3].textContent?.trim()).toBe('5');
    });

    it('should display loading indicator before data loads', () => {
        visitsApiSpy.getTodaySummary.and.returnValue(new Subject());
        fixture.detectChanges();

        const values: HTMLElement[] = fixture.nativeElement.querySelectorAll('.card-value');
        expect(values[0].textContent?.trim()).toBe('...');
    });

    it('should display zeros when summary has zero counts', () => {
        const zeroSummary: TodaySummary = {
            totalVisitsToday: 0,
            arrivedToday: 0,
            checkedInToday: 0,
            completedToday: 0,
        };
        visitsApiSpy.getTodaySummary.and.returnValue(of(zeroSummary));
        fixture.detectChanges();

        const values: HTMLElement[] = fixture.nativeElement.querySelectorAll('.card-value');
        expect(values[0].textContent?.trim()).toBe('0');
        expect(values[1].textContent?.trim()).toBe('0');
        expect(values[2].textContent?.trim()).toBe('0');
        expect(values[3].textContent?.trim()).toBe('0');
    });

    it('should re-fetch summary on WS visitor arrived event', () => {
        const arrivedSubject = new Subject();
        wsSpy.on.and.callFake(<T>(event: string) => {
            if (event === 'visits:visitor:arrived') return arrivedSubject as any;
            return new Subject<T>();
        });

        fixture.detectChanges();
        expect(visitsApiSpy.getTodaySummary).toHaveBeenCalledTimes(1);

        arrivedSubject.next({});
        expect(visitsApiSpy.getTodaySummary).toHaveBeenCalledTimes(2);
    });

    it('should re-fetch summary on WS visitor checked-in event', () => {
        const checkedInSubject = new Subject();
        wsSpy.on.and.callFake(<T>(event: string) => {
            if (event === 'visits:visitor:checked-in') return checkedInSubject as any;
            return new Subject<T>();
        });

        fixture.detectChanges();
        expect(visitsApiSpy.getTodaySummary).toHaveBeenCalledTimes(1);

        checkedInSubject.next({});
        expect(visitsApiSpy.getTodaySummary).toHaveBeenCalledTimes(2);
    });

    it('should re-fetch summary on WS visitor checked-out event', () => {
        const checkedOutSubject = new Subject();
        wsSpy.on.and.callFake(<T>(event: string) => {
            if (event === 'visits:visitor:checked-out') return checkedOutSubject as any;
            return new Subject<T>();
        });

        fixture.detectChanges();
        expect(visitsApiSpy.getTodaySummary).toHaveBeenCalledTimes(1);

        checkedOutSubject.next({});
        expect(visitsApiSpy.getTodaySummary).toHaveBeenCalledTimes(2);
    });

    it('should subscribe to WS events for real-time updates', () => {
        fixture.detectChanges();
        expect(wsSpy.on).toHaveBeenCalledWith('visits:created');
        expect(wsSpy.on).toHaveBeenCalledWith('visits:visitor:arrived');
        expect(wsSpy.on).toHaveBeenCalledWith('visits:visitor:checked-in');
        expect(wsSpy.on).toHaveBeenCalledWith('visits:visitor:checked-out');
    });

    it('should re-fetch summary on WS visit created event', () => {
        const createdSubject = new Subject();
        wsSpy.on.and.callFake(<T>(event: string) => {
            if (event === 'visits:created') return createdSubject as any;
            return new Subject<T>();
        });

        fixture.detectChanges();
        expect(visitsApiSpy.getTodaySummary).toHaveBeenCalledTimes(1);

        createdSubject.next({});
        expect(visitsApiSpy.getTodaySummary).toHaveBeenCalledTimes(2);
    });
});
