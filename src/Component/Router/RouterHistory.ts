export class RouterHistory {
  private static initialized = false;

  static pushState(data: any, unused: string, url?: string | URL | null) {
    window.history.pushState(data, unused, url);

    this.emitLocationChange();
  }

  static replaceState(data: any, unused: string, url?: string | URL | null) {
    window.history.replaceState(data, unused, url);

    this.emitLocationChange();
  }

  static init() {
    if (this.initialized) {
      return;
    }

    window.addEventListener("popstate", this.emitLocationChange);

    this.initialized = true;
  }

  static emitLocationChange = () => {
    window.dispatchEvent(new Event("locationchange"));
  };
}
