
export type Point = { x: number; y: number };
export type Line = { p1: Point; p2: Point; color: string; strokeWidth: number; type: 'line' | 'marker'; };
export type Tool = 'select' | 'line' | 'marker' | 'erase' | 'image';
export type SelectionBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};
export type TracingImage = {
    src: string;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    opacity: number;
    visible: boolean;
};
