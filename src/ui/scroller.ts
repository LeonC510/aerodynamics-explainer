/**
 * A scrollable host with a canvas pinned inside it. The canvas always covers the visible
 * area; drawing code offsets by scrollLeft. While "pinned", the view follows the right-hand
 * end of the content as it grows; scrolling back unpins it, scrolling to the end re-pins.
 */
import { PIN_TOLERANCE_PX } from '../config/view';

export class Scroller {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  private readonly el: HTMLDivElement;
  private readonly spacer: HTMLDivElement;
  private _pinned = true;
  private contentWidth = 0;
  private contentHeight = 0;

  constructor(host: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'scroller';
    this.spacer = document.createElement('div');
    this.spacer.className = 'spacer';
    this.canvas = document.createElement('canvas');
    this.spacer.appendChild(this.canvas);
    this.el.appendChild(this.spacer);
    host.appendChild(this.el);
    this.ctx = this.canvas.getContext('2d')!;
    this.el.addEventListener('scroll', () => {
      this._pinned = this.el.scrollLeft >= this.maxScrollLeft() - PIN_TOLERANCE_PX;
    });
  }

  /** Visible width, CSS px. */
  get widthPx(): number { return this.el.clientWidth; }
  /** Visible height, CSS px. */
  get viewHeightPx(): number { return this.el.clientHeight; }
  /** Canvas height, CSS px: the visible height, or the content height if that is taller. */
  get heightPx(): number { return Math.max(this.el.clientHeight, this.contentHeight); }
  get scrollLeft(): number { return this.el.scrollLeft; }
  get pinned(): boolean { return this._pinned; }

  private maxScrollLeft(): number { return Math.max(0, this.el.scrollWidth - this.el.clientWidth); }

  /** Sets the scrollable content size (CSS px); height 0 means "fit the visible height". */
  setContentSize(widthPx: number, heightPx = 0): void {
    if (Math.abs(widthPx - this.contentWidth) > 0.5) {
      this.contentWidth = widthPx;
      this.spacer.style.width = `${Math.round(widthPx)}px`;
    }
    if (heightPx !== this.contentHeight) {
      this.contentHeight = heightPx;
      this.spacer.style.height = heightPx > 0 ? `${Math.round(heightPx)}px` : '';
    }
    if (this._pinned) {
      const max = this.maxScrollLeft();
      if (Math.abs(this.el.scrollLeft - max) > 0.5) this.el.scrollLeft = max;
    }
  }

  /** Sizes the canvas for the current view and pixel density, clears it, and returns the context. */
  begin(): CanvasRenderingContext2D {
    const dpr = window.devicePixelRatio || 1;
    const w = this.widthPx;
    const h = this.heightPx;
    const bw = Math.max(1, Math.round(w * dpr));
    const bh = Math.max(1, Math.round(h * dpr));
    if (this.canvas.width !== bw || this.canvas.height !== bh) {
      this.canvas.width = bw;
      this.canvas.height = bh;
      this.canvas.style.width = `${w}px`;
      this.canvas.style.height = `${h}px`;
    }
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.clearRect(0, 0, w, h);
    return this.ctx;
  }
}
