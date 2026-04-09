import { Component, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { map, combineLatest } from 'rxjs';
import { WorkstationSessionService } from '../../core/services/workstation-session.service';
import { DeviceStatusService } from '../../core/services/device-status.service';

interface AgentIcon {
    providerType: 'printer' | 'scanner';
    isConnected: boolean;
    icon: string;
}

@Component({
    selector: 'app-agent-status-icons',
    standalone: true,
    imports: [AsyncPipe, TranslateModule],
    template: `
    @if (vm$ | async; as vm) {
      @if (vm.bound) {
        <div class="agent-status-icons">
          @for (agent of vm.agents; track agent.providerType) {
            <span
              class="agent-icon"
              [class.connected]="agent.isConnected"
              [class.disconnected]="!agent.isConnected"
              [title]="(agent.providerType === 'printer'
                ? ('WORKSTATION.PRINTER' | translate)
                : ('WORKSTATION.SCANNER' | translate))
                + ': '
                + (agent.isConnected
                  ? ('WORKSTATION.CONNECTED' | translate)
                  : ('WORKSTATION.DISCONNECTED' | translate))"
            >
              <i class="pi" [class.pi-print]="agent.providerType === 'printer'" [class.pi-camera]="agent.providerType === 'scanner'"></i>
              <span class="status-dot"></span>
            </span>
          }
        </div>
      }
    }
  `,
    styles: [`
    .agent-status-icons {
      display: flex;
      align-items: center;
      gap: 0.35rem;
    }
    .agent-icon {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: var(--radius-sm, 6px);
      font-size: 1rem;
      cursor: default;
      transition: all 0.2s;
    }
    .agent-icon.connected {
      color: #15803d;
      background: #dcfce7;
    }
    .agent-icon.disconnected {
      color: #dc2626;
      background: #fef2f2;
    }
    .status-dot {
      position: absolute;
      bottom: 3px;
      right: 3px;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      border: 1.5px solid #fff;
    }
    .agent-icon.connected .status-dot {
      background: #22c55e;
    }
    .agent-icon.disconnected .status-dot {
      background: #ef4444;
    }
  `],
})
export class AgentStatusIconsComponent {
    private wsSession = inject(WorkstationSessionService);
    private deviceStatus = inject(DeviceStatusService);

    vm$ = combineLatest([
        this.wsSession.state$,
        this.deviceStatus.devices$,
    ]).pipe(
        map(([state, devices]) => {
            if (!state.bound) {
                return { bound: false as const, agents: [] as AgentIcon[] };
            }

            const agents: AgentIcon[] = [
                {
                    providerType: 'printer',
                    isConnected: devices.some((d) => d.providerType === 'printer' && d.isConnected),
                    icon: 'pi-print',
                },
                {
                    providerType: 'scanner',
                    isConnected: devices.some((d) => d.providerType === 'scanner' && d.isConnected),
                    icon: 'pi-camera',
                },
            ];

            return { bound: true as const, agents };
        }),
    );
}
