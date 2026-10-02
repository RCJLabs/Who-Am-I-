class Toasts {
  list = $state<{ id: number; text: string }[]>([]);
  private n = 0;

  push(text: string, ms = 3500): void {
    const id = ++this.n;
    this.list = [...this.list, { id, text }];
    setTimeout(() => (this.list = this.list.filter((t) => t.id !== id)), ms);
  }
}

export const toasts = new Toasts();
