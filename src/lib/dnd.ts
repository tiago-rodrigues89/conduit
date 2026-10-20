// What is being dragged right now (drag events only reveal the data on drop).

export interface DragItem {
  kind: 'session' | 'tab';
  id: string;
}

let current: DragItem | null = null;

export const dnd = {
  start(item: DragItem) {
    current = item;
  },
  end() {
    current = null;
  },
  get(): DragItem | null {
    return current;
  },
};
