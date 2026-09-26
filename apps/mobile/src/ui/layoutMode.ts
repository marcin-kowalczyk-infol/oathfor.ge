export type LayoutMode = 'room' | 'simple';
// The room needs 350 pt and a text scale up to 1.3. Otherwise the app uses plain lists.
export const layoutMode = (width: number, fontScale: number): LayoutMode => width < 350 || fontScale > 1.3 ? 'simple' : 'room';
