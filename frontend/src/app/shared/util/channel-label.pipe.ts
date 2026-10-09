/**
 * src/app/shared/util/channel-label.pipe.ts
 * Turns internal channel names into readable text.
 */
import { Pipe, PipeTransform } from '@angular/core';

/** Turns the internal name of a channel ("general-chat") into readable text ("General chat"). */
export function channelLabel(name: string | null | undefined): string {
  const text = (name ?? '').replace(/[-_]+/g, ' ').trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
}

/** The `channelLabel` pipe for templates. */
@Pipe({ name: 'channelLabel', standalone: true })
export class ChannelLabelPipe implements PipeTransform {
  /** Readable text of a channel name. */
  transform(name: string | null | undefined): string {
    return channelLabel(name);
  }
}
