import { Component, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { map, combineLatest } from 'rxjs';
import { WorkstationSessionService } from '../../core/services/workstation-session.service';
import { DeviceStatusService } from '../../core/services/device-status.service';

interface AgentIcon {
  providerType: 'printer' | 'scanner';
  isConnected: boolean;
  deviceConnected: boolean | null;
  icon: string;
  /** 'connected' = green, 'device-disconnected' = amber, 'disconnected' = red */
  status: 'connected' | 'device-disconnected' | 'disconnected';
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
              [class.connected]="agent.status === 'connected'"
              [class.device-disconnected]="agent.status === 'device-disconnected'"
              [class.disconnected]="agent.status === 'disconnected'"
              [title]="(agent.providerType === 'printer'
                ? ('WORKSTATION.PRINTER' | translate)
                : ('WORKSTATION.SCANNER' | translate))
                + ': '
                + (agent.status === 'connected'
                  ? ('WORKSTATION.CONNECTED' | translate)
                  : agent.status === 'device-disconnected'
                    ? ('WORKSTATION.DEVICE_DISCONNECTED' | translate)
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
    .agent-icon.device-disconnected {
      color: #b45309;
      background: #fef3c7;
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
    .agent-icon.device-disconnected .status-dot {
      background: #f59e0b;
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
        this.buildAgentIcon('printer', devices),
        this.buildAgentIcon('scanner', devices),
      ];

      return { bound: true as const, agents };
    }),
  );

  private buildAgentIcon(
    providerType: 'printer' | 'scanner',
    devices: { providerType: string; isConnected: boolean; deviceConnected?: boolean | null }[],
  ): AgentIcon {
    const device = devices.find((d) => d.providerType === providerType);
    const isConnected = device?.isConnected ?? false;
    const deviceConnected = device?.deviceConnected ?? null;

    let status: AgentIcon['status'];
    if (!isConnected) {
      status = 'disconnected';
    } else if (deviceConnected === false) {
      status = 'device-disconnected';
    } else {
      // deviceConnected === true or null (unknown/legacy) → show as connected
      status = 'connected';
    }

    return {
      providerType,
      isConnected,
      deviceConnected,
      icon: providerType === 'printer' ? 'pi-print' : 'pi-camera',
      status,
    };
  }
}
