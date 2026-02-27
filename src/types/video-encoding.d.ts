declare module "upng-js" {
  export function decode(buffer: ArrayBuffer): any;
  export function toRGBA8(image: any): ArrayBuffer[];
}

declare module "gifenc" {
  export function GIFEncoder(): {
    writeFrame(index: Uint8Array, width: number, height: number, options: { palette: number[]; delay?: number }): void;
    finish(): void;
    bytesView(): Uint8Array;
  };
  export function quantize(data: Uint8Array, maxColors: number): number[];
  export function applyPalette(data: Uint8Array, palette: number[]): Uint8Array;
}