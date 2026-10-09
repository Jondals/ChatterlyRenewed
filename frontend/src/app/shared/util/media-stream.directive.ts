/**
 * src/app/shared/util/media-stream.directive.ts
 * Directive that connects a MediaStream to a video or audio element (srcObject has no template binding).
 */
import { Directive, ElementRef, effect, inject, input } from '@angular/core';

/** Binds a MediaStream to a <video>/<audio> element and starts playing it. */
@Directive({ selector: 'video[appMediaStream], audio[appMediaStream]', standalone: true })
export class MediaStreamDirective {
  readonly stream = input<MediaStream | null>(null, { alias: 'appMediaStream' });
  private readonly element = inject<ElementRef<HTMLMediaElement>>(ElementRef);

  /** Keeps the element connected to the stream it is given. */
  constructor() {
    effect(this.connect.bind(this));
  }

  /** Sets the stream on the element and plays it (a blocked autoplay is ignored). */
  private connect(): void {
    const stream = this.stream();
    const media = this.element.nativeElement;
    if (media.srcObject !== stream) {
      media.srcObject = stream;
    }
    if (stream) {
      media.play().catch(this.ignore);
    }
  }

  /** Nothing to do when the browser refuses to autoplay. */
  private ignore(): void {
    return;
  }
}
