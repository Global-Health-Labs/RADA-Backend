interface QueueItem {
  task: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: any) => void;
}

export class ExportQueue {
  private queue: QueueItem[] = [];
  private isProcessing = false;
  private static instance: ExportQueue;

  private constructor() {}

  static getInstance(): ExportQueue {
    if (!ExportQueue.instance) {
      ExportQueue.instance = new ExportQueue();
    }
    return ExportQueue.instance;
  }

  async add<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({
        task,
        resolve,
        reject,
      });

      if (!this.isProcessing) {
        this.processQueue();
      }
    });
  }

  private async processQueue() {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      const item = this.queue[0];
      const result = await item.task();
      item.resolve(result);
    } catch (error) {
      this.queue[0].reject(error);
    } finally {
      this.queue.shift(); // Remove the processed item
      this.isProcessing = false;

      if (this.queue.length > 0) {
        // Process next item if queue is not empty
        this.processQueue();
      }
    }
  }

  getQueueLength(): number {
    return this.queue.length;
  }
}
