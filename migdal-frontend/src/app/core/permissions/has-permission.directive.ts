import {
    Directive,
    Input,
    TemplateRef,
    ViewContainerRef,
    OnInit,
    OnDestroy,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { PermissionService } from './permission.service';

@Directive({
    selector: '[hasPermission]',
    standalone: true,
})
export class HasPermissionDirective implements OnInit, OnDestroy {
    @Input('hasPermission') permission!: string;

    private sub?: Subscription;
    private hasView = false;

    constructor(
        private templateRef: TemplateRef<unknown>,
        private viewContainer: ViewContainerRef,
        private permissionService: PermissionService,
        private authService: AuthService,
    ) { }

    ngOnInit() {
        this.sub = this.authService.currentUser$.subscribe(() => {
            this.updateView();
        });
    }

    ngOnDestroy() {
        this.sub?.unsubscribe();
    }

    private updateView(): void {
        const hasPermission = this.permissionService.hasPermission(this.permission);

        if (hasPermission && !this.hasView) {
            this.viewContainer.createEmbeddedView(this.templateRef);
            this.hasView = true;
        } else if (!hasPermission && this.hasView) {
            this.viewContainer.clear();
            this.hasView = false;
        }
    }
}
