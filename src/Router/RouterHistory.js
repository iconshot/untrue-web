export class RouterHistory {
  static pushState(...args) {
    this.emitLocationChange();

    return window.history.pushState(...args);
  }

  static replaceState(...args) {
    this.emitLocationChange();

    return window.history.replaceState(...args);
  }

  static init() {
    if (this.initialized) {
      return;
    }

    window.addEventListener("popstate", this.emitLocationChange);

    this.initialized = true;
  }

  static reset() {
    window.removeEventListener("popstate", this.emitLocationChange);

    this.initialized = false;
  }

  static emitLocationChange() {
    /*
    
    timeout is needed so pushState and replaceState
    have the change reflected in window.history first
    
    */

    setTimeout(() => {
      window.dispatchEvent(new Event("locationchange"));
    });
  }

  static onClick = (event, element) => {
    const { href, target } = element;

    if (
      (target === "" || target === "_self") && // target attributes are handled by the browser
      event.button === 0 && // only allow left clicks
      !event.metaKey &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.shiftKey
    ) {
      if (window.location.href !== href) {
        this.pushState(null, "", href);
      }

      return false;
    }
  };
}

RouterHistory.initialized = false;
