/**
 * src/app/features/voice/device-menu.component.ts
 * The little arrow next to the microphone and the camera buttons of a call (like in Discord): it opens a list of the
 * devices, the one in use is marked, and choosing one switches to it at once, without leaving the call.
 */
import {
  Component,
  ElementRef,
  HostListener,
  inject,
  input,
  signal,
  type OnDestroy,
} from '@angular/core';
import { TranslatePipe } from '../../core/i18n/i18n.service';
import { CallService } from '../../core/services/call.service';
import { SettingsService } from '../../core/services/settings.service';
import { IconComponent } from '../../shared/components/icon.component';

/** One device of the list. */
interface Device {
  id: string;
  label: string;
}

/** Which devices the arrow offers: microphone and speakers, or cameras. */
export type DeviceKind = 'audio' | 'video';

@Component({
  selector: 'app-device-menu',
  standalone: true,
  imports: [IconComponent, TranslatePipe],
  host: { class: 'relative block' },
  template: `
    <button
      type="button"
      class="btn h-12 w-7 !rounded-l-[calc(var(--r)*.4)] !px-0 text-muted hover:text-fg"
      [class.btn-active]="open()"
      [attr.aria-label]="label() | t"
      [attr.aria-expanded]="open()"
      aria-haspopup="menu"
      (click)="toggle()"
    >
      <app-icon name="chevron-up" [size]="14" />
    </button>
    @if (open()) {
      <div
        role="menu"
        class="panel anim-pop absolute bottom-14 left-1/2 z-30 max-h-[60dvh] w-[19rem] -translate-x-1/2 overflow-y-auto !bg-ink-850 p-2 shadow-2xl max-md:fixed max-md:inset-x-3 max-md:bottom-28 max-md:left-3 max-md:w-auto max-md:translate-x-0"
      >
        @if (kind() === 'audio') {
          <div class="label px-2.5 pb-1 pt-1.5">{{ 'Microphone' | t }}</div>
          @for (device of inputs(); track device.id) {
            <button
              type="button"
              role="menuitemradio"
              class="device-item"
              [attr.aria-checked]="settings.inputDeviceId() === device.id"
              (click)="chooseInput(device.id)"
            >
              <span class="min-w-0 flex-1 truncate">{{ device.label | t }}</span>
              @if (settings.inputDeviceId() === device.id) {
                <app-icon name="check" [size]="15" class="text-accent" />
              }
            </button>
          }
          <div class="label px-2.5 pb-1 pt-3">{{ 'Speakers' | t }}</div>
          @for (device of outputs(); track device.id) {
            <button
              type="button"
              role="menuitemradio"
              class="device-item"
              [attr.aria-checked]="settings.outputDeviceId() === device.id"
              (click)="settings.outputDeviceId.set(device.id)"
            >
              <span class="min-w-0 flex-1 truncate">{{ device.label | t }}</span>
              @if (settings.outputDeviceId() === device.id) {
                <app-icon name="check" [size]="15" class="text-accent" />
              }
            </button>
          }
          @if (outputs().length < 2) {
            <p class="px-2.5 pb-1 pt-1 text-[0.6875rem] text-dim">
              {{ 'This browser cannot choose the speakers.' | t }}
            </p>
          }
        } @else {
          <div class="label px-2.5 pb-1 pt-1.5">{{ 'Camera' | t }}</div>
          @for (device of cameras(); track device.id) {
            <button
              type="button"
              role="menuitemradio"
              class="device-item"
              [attr.aria-checked]="settings.cameraDeviceId() === device.id"
              (click)="chooseCamera(device.id)"
            >
              <span class="min-w-0 flex-1 truncate">{{ device.label | t }}</span>
              @if (settings.cameraDeviceId() === device.id) {
                <app-icon name="check" [size]="15" class="text-accent" />
              }
            </button>
          }
        }
      </div>
    }
  `,
  styles: `
    .device-item {
      display: flex;
      width: 100%;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0.65rem;
      border-radius: calc(var(--r) * 0.6);
      text-align: left;
      font-size: 0.8125rem;
    }
    .device-item:hover {
      background: rgba(255, 255, 255, 0.08);
    }
    .device-item[aria-checked='true'] {
      color: var(--accent);
      font-weight: 600;
    }
  `,
})
export class DeviceMenuComponent implements OnDestroy {
  /** Which devices to offer. */
  readonly kind = input.required<DeviceKind>();

  protected readonly settings = inject(SettingsService);
  private readonly call = inject(CallService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly open = signal(false);
  protected readonly inputs = signal<Device[]>([]);
  protected readonly outputs = signal<Device[]>([]);
  protected readonly cameras = signal<Device[]>([]);
  private readonly onDeviceChange = this.refresh.bind(this);

  /** Keeps the list up to date when a device is plugged in or out. */
  constructor() {
    navigator.mediaDevices?.addEventListener?.('devicechange', this.onDeviceChange);
  }

  /** Stops listening for devices. */
  ngOnDestroy(): void {
    navigator.mediaDevices?.removeEventListener?.('devicechange', this.onDeviceChange);
  }

  /** A press anywhere else closes the list. */
  @HostListener('document:mousedown', ['$event'])
  onOutside(event: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) {
      this.open.set(false);
    }
  }

  /** Escape closes the list. */
  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.open.set(false);
  }

  /** The name of what the arrow opens (for screen readers). */
  protected label(): string {
    return this.kind() === 'audio' ? 'Audio devices' : 'Camera';
  }

  /** Opens or closes the list (reading the devices when it opens). */
  protected toggle(): void {
    const next = !this.open();
    this.open.set(next);
    if (next) {
      void this.refresh();
    }
  }

  /** Reads the devices. The names are empty until the browser has given permission, so they get a number then. */
  private async refresh(): Promise<void> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.inputs.set(this.list(devices, 'audioinput', 'Microphone'));
      this.outputs.set(this.list(devices, 'audiooutput', 'Speakers'));
      this.cameras.set(this.list(devices, 'videoinput', 'Camera'));
    } catch {
      /* the browser gives no list: the arrow just shows the default */
    }
  }

  /** The devices of one kind, with the system default first. */
  private list(devices: MediaDeviceInfo[], kind: MediaDeviceKind, name: string): Device[] {
    const real = devices.filter(function ofKind(device) {
      return (
        device.kind === kind &&
        device.deviceId !== 'default' &&
        device.deviceId !== 'communications'
      );
    });
    const out: Device[] = [{ id: 'default', label: 'Default' }];
    real.forEach(function add(device, index) {
      out.push({ id: device.deviceId, label: device.label || name + ' ' + (index + 1) });
    });
    return out;
  }

  /** Switches the microphone of the call. */
  protected chooseInput(id: string): void {
    this.settings.inputDeviceId.set(id);
    void this.call.changeInputDevice();
  }

  /** Switches the camera (when it is on, it restarts with the new one). */
  protected chooseCamera(id: string): void {
    this.settings.cameraDeviceId.set(id);
    void this.call.changeCamera();
  }
}
