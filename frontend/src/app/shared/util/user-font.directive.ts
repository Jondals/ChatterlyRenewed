/**
 * src/app/shared/util/user-font.directive.ts
 * Gives a name the font the person chose for it (the `font-name-*` classes), so a name looks the same everywhere.
 * Use: `<span [appNameColor]="u.profileColor" [appUserFont]="u.nameFont">`.
 */
import { Directive, computed, input } from '@angular/core';

/** The class that gives a name the font its person chose (nothing for the default font): the one place that knows how it is named. */
export function fontClassOf(font: string | null | undefined): string {
  return font && font !== 'default' ? 'font-name-' + font : '';
}

/** Puts the class of the chosen name font on the element. */
@Directive({
  selector: '[appUserFont]',
  standalone: true,
  host: { '[class]': 'fontClass()' },
})
export class UserFontDirective {
  readonly appUserFont = input<string | null | undefined>('');
  protected readonly fontClass = computed(this.pickClass.bind(this));

  /** The class of the font, or nothing for the default one. */
  private pickClass(): string {
    return fontClassOf(this.appUserFont());
  }
}
