import { Directive, ElementRef, forwardRef, inject } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { MnLanguageService } from 'mn-angular-lib';
import { formatNumber } from '../../shared/format';

/**
 * A weight field that follows the APP language instead of the browser's:
 * `<input type="text" inputmode="decimal" appDecimalInput [ngModel]="kg">`.
 * A `type=number` input draws its decimal mark from the browser locale, so a
 * Dutch browser showed "67,5" in the English app while every list said "67.5".
 * The model stays a number (null while empty or not a number); typing accepts
 * both "," and ".".
 */
@Directive({
  selector: 'input[appDecimalInput]',
  standalone: true,
  host: { '(input)': 'onInput()', '(blur)': 'onBlur()' },
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DecimalInput),
      multi: true,
    },
  ],
})
export class DecimalInput implements ControlValueAccessor {
  private readonly el = inject<ElementRef<HTMLInputElement>>(ElementRef).nativeElement;
  private readonly lang = inject(MnLanguageService);

  private onChange: (value: number | null) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(value: number | string | null | undefined): void {
    this.el.value =
      value == null || value === '' ? '' : formatNumber(value, this.lang.locale);
  }

  registerOnChange(fn: (value: number | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.el.disabled = disabled;
  }

  onInput(): void {
    this.onChange(this.parse());
  }

  /** Tidy what was typed ("67.50" / "67.5" in a Dutch app) once the field is left. */
  onBlur(): void {
    const value = this.parse();
    if (value != null) this.el.value = formatNumber(value, this.lang.locale);
    this.onTouched();
  }

  private parse(): number | null {
    const raw = this.el.value.trim().replace(',', '.');
    if (!raw || !/^\d*\.?\d*$/.test(raw) || raw === '.') return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  }
}
