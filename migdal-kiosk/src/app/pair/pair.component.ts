import { Component } from '@angular/core';

@Component({
    selector: 'app-pair',
    templateUrl: './pair.component.html',
    styleUrls: ['./pair.component.css'],
})
export class PairComponent {

    // loading = false;
    // error: string | null = null;
    // success = false;

    // // ✅ Reactive form
    // form = this.fb.group({
    //     deviceId: ['', Validators.required],
    //     deviceSecret: ['', [Validators.required, Validators.minLength(8)]],
    // });

    // constructor(
    //     private fb: FormBuilder,
    //     private auth: AuthService,
    //     private router: Router
    // ) { }

    // get deviceIdCtrl() {
    //     return this.form.get('deviceId');
    // }

    // get deviceSecretCtrl() {
    //     return this.form.get('deviceSecret');
    // }

    // onSubmit() {
    //     this.error = null;
    //     this.success = false;

    //     // Mark touched so validation messages show
    //     this.form.markAllAsTouched();

    //     if (this.form.invalid) {
    //         this.error = 'Device ID and Device Secret are required.';
    //         return;
    //     }

    //     const deviceId = (this.form.value.deviceId || '').trim();
    //     const deviceSecret = (this.form.value.deviceSecret || '').trim();

    //     if (!deviceId || !deviceSecret) {
    //         this.error = 'Device ID and Device Secret are required.';
    //         return;
    //     }

    //     this.loading = true;

    //     // 1) Save creds locally
    //     this.auth.saveDeviceCreds({ deviceId, deviceSecret });

    //     // 2) Try login immediately (validates with server)
    //     this.auth.loginDevice().subscribe({
    //         next: () => {
    //             this.loading = false;
    //             this.success = true;

    //             // Optional: hide secret in UI after success
    //             this.form.patchValue({ deviceSecret: '********' });

    //             // Redirect to home
    //             setTimeout(() => {
    //                 this.router.navigateByUrl(KIOSK_CONFIG.HOME_URL);
    //             }, 800);
    //         },
    //         error: (err) => {
    //             this.loading = false;

    //             // If login failed, remove the bad creds so kiosk isn't stuck
    //             this.auth.logoutDevice();
    //             localStorage.removeItem(KIOSK_CONFIG.STORAGE_DEVICE_ID);
    //             localStorage.removeItem(KIOSK_CONFIG.STORAGE_DEVICE_SECRET);

    //             const msg =
    //                 err?.error?.message ||
    //                 err?.message ||
    //                 'Pairing failed. Please verify the deviceId/deviceSecret and server connectivity.';
    //             this.error = msg;
    //         },
    //     });
    // }

    // clear() {
    //     this.form.reset({
    //         deviceId: '',
    //         deviceSecret: '',
    //     });
    //     this.error = null;
    //     this.success = false;
    // }

    // unpair() {
    //     this.auth.logoutDevice();
    //     localStorage.removeItem(KIOSK_CONFIG.STORAGE_DEVICE_ID);
    //     localStorage.removeItem(KIOSK_CONFIG.STORAGE_DEVICE_SECRET);

    //     this.success = false;
    //     this.error = null;

    //     this.form.reset({
    //         deviceId: '',
    //         deviceSecret: '',
    //     });
    // }
}
