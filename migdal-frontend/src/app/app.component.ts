import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TranslationService } from './core/i18n/translation.service';

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [RouterOutlet, ConfirmDialogModule],
    template: `<router-outlet /><p-confirmDialog />`,
})
export class AppComponent {
    // Inject to trigger initialization (sets lang/dir on document)
    private translation = inject(TranslationService);
}
