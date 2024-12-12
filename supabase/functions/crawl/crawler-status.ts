export interface CrawlerStatus {
  isRunning: boolean;
  startTime: Date | null;
  endTime: Date | null;
  pagesProcessed: number;
  totalPages: number;
  currentUrl: string | null;
  errors: Array<{
    url: string;
    error: string;
    timestamp: Date;
  }>;
  discoveredUrls: Set<string>;
}

export class CrawlerStatusTracker {
  private status: CrawlerStatus = {
    isRunning: false,
    startTime: null,
    endTime: null,
    pagesProcessed: 0,
    totalPages: 0,
    currentUrl: null,
    errors: [],
    discoveredUrls: new Set()
  };

  start() {
    this.status.isRunning = true;
    this.status.startTime = new Date();
    this.status.endTime = null;
    this.status.pagesProcessed = 0;
    this.status.errors = [];
    this.status.discoveredUrls.clear();
  }

  stop() {
    this.status.isRunning = false;
    this.status.endTime = new Date();
  }

  setCurrentUrl(url: string) {
    this.status.currentUrl = url;
  }

  addError(url: string, error: string) {
    this.status.errors.push({
      url,
      error,
      timestamp: new Date()
    });
  }

  addDiscoveredUrl(url: string) {
    this.status.discoveredUrls.add(url);
    this.status.totalPages = this.status.discoveredUrls.size;
  }

  incrementPagesProcessed() {
    this.status.pagesProcessed++;
  }

  getStatus(): CrawlerStatus {
    return { ...this.status, discoveredUrls: new Set(this.status.discoveredUrls) };
  }

  getProgress(): number {
    if (this.status.totalPages === 0) return 0;
    return (this.status.pagesProcessed / this.status.totalPages) * 100;
  }
}