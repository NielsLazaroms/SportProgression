import { Component, computed, input } from '@angular/core';
import {
  LucideArrowLeft,
  LucideCalendar,
  LucideChartColumn,
  LucideCheck,
  LucideChevronRight,
  LucideCirclePlus,
  LucideCircleUserRound,
  LucideClock,
  LucideDumbbell,
  LucideFlame,
  LucideLanguages,
  LucideLayers,
  LucideLink,
  LucideListChecks,
  LucideListPlus,
  LucideLogOut,
  LucideMail,
  LucideMinus,
  LucidePencil,
  LucidePlay,
  LucidePlus,
  LucideRuler,
  LucideSearch,
  LucideSearchX,
  LucideTrash2,
  LucideTrendingUp,
  LucideUser,
  LucideX,
} from '@lucide/angular';

/**
 * App-wide icon by stable name — `<app-icon [data]="{ name: 'dumbbell', size: 22 }" />`.
 * Renders lucide's per-icon SVG directives; icons inherit the surrounding
 * `currentColor`. Add a name here to make it available everywhere.
 */
@Component({
  selector: 'app-icon',
  standalone: true,
  imports: [
    LucideArrowLeft,
    LucideCalendar,
    LucideChartColumn,
    LucideCheck,
    LucideChevronRight,
    LucideCirclePlus,
    LucideCircleUserRound,
    LucideClock,
    LucideDumbbell,
    LucideFlame,
    LucideLanguages,
    LucideLayers,
    LucideLink,
    LucideListChecks,
    LucideListPlus,
    LucideLogOut,
    LucideMail,
    LucideMinus,
    LucidePencil,
    LucidePlay,
    LucidePlus,
    LucideRuler,
    LucideSearch,
    LucideSearchX,
    LucideTrash2,
    LucideTrendingUp,
    LucideUser,
    LucideX,
  ],
  template: `
    @switch (data().name) {
      @case ('arrow-left') { <svg lucideArrowLeft [style.width.px]="size()" [style.height.px]="size()"></svg> }
      @case ('calendar') { <svg lucideCalendar [style.width.px]="size()" [style.height.px]="size()"></svg> }
      @case ('chart-column') { <svg lucideChartColumn [style.width.px]="size()" [style.height.px]="size()"></svg> }
      @case ('check') { <svg lucideCheck [style.width.px]="size()" [style.height.px]="size()"></svg> }
      @case ('chevron-right') { <svg lucideChevronRight [style.width.px]="size()" [style.height.px]="size()"></svg> }
      @case ('plus-circle') { <svg lucideCirclePlus [style.width.px]="size()" [style.height.px]="size()"></svg> }
      @case ('circle-user-round') { <svg lucideCircleUserRound [style.width.px]="size()" [style.height.px]="size()"></svg> }
      @case ('history') { <svg lucideClock [style.width.px]="size()" [style.height.px]="size()"></svg> }
      @case ('languages') { <svg lucideLanguages [style.width.px]="size()" [style.height.px]="size()"></svg> }
      @case ('dumbbell') { <svg lucideDumbbell [style.width.px]="size()" [style.height.px]="size()"></svg> }
      @case ('flame') { <svg lucideFlame [style.width.px]="size()" [style.height.px]="size()"></svg> }
      @case ('layers') { <svg lucideLayers [style.width.px]="size()" [style.height.px]="size()"></svg> }
      @case ('link') { <svg lucideLink [style.width.px]="size()" [style.height.px]="size()"></svg> }
      @case ('list-checks') { <svg lucideListChecks [style.width.px]="size()" [style.height.px]="size()"></svg> }
      @case ('list-plus') { <svg lucideListPlus [style.width.px]="size()" [style.height.px]="size()"></svg> }
      @case ('log-out') { <svg lucideLogOut [style.width.px]="size()" [style.height.px]="size()"></svg> }
      @case ('mail') { <svg lucideMail [style.width.px]="size()" [style.height.px]="size()"></svg> }
      @case ('minus') { <svg lucideMinus [style.width.px]="size()" [style.height.px]="size()"></svg> }
      @case ('pencil') { <svg lucidePencil [style.width.px]="size()" [style.height.px]="size()"></svg> }
      @case ('play') { <svg lucidePlay [style.width.px]="size()" [style.height.px]="size()"></svg> }
      @case ('plus') { <svg lucidePlus [style.width.px]="size()" [style.height.px]="size()"></svg> }
      @case ('ruler') { <svg lucideRuler [style.width.px]="size()" [style.height.px]="size()"></svg> }
      @case ('search') { <svg lucideSearch [style.width.px]="size()" [style.height.px]="size()"></svg> }
      @case ('search-x') { <svg lucideSearchX [style.width.px]="size()" [style.height.px]="size()"></svg> }
      @case ('trash-2') { <svg lucideTrash2 [style.width.px]="size()" [style.height.px]="size()"></svg> }
      @case ('trending-up') { <svg lucideTrendingUp [style.width.px]="size()" [style.height.px]="size()"></svg> }
      @case ('user') { <svg lucideUser [style.width.px]="size()" [style.height.px]="size()"></svg> }
      @case ('x') { <svg lucideX [style.width.px]="size()" [style.height.px]="size()"></svg> }
    }
  `,
})
export class AppIcon {
  readonly data = input<{ name: string; size?: number; color?: string }>({
    name: '',
  });

  readonly size = computed(() => this.data().size ?? 24);
}
