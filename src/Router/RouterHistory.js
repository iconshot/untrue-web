export class RouterHistory {
  static popState() {
    return window.history.back();
  }

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
    /*
    
    return true means the click event will be propagated to the browser
    return false means the event won't be propagated to the browser
  
    */

    const { href, target } = element;

    const locationUrl = window.location.href.split("#")[0];
    const elementUrl = href.split("#")[0];

    const isSelfTarget = target === "" || target === "_self";

    if (
      !isSelfTarget ||
      event.button !== 0 ||
      event.metaKey ||
      event.altKey ||
      event.ctrlKey ||
      event.shiftKey
    ) {
      return true;
    }

    // if urls are different, pushState

    if (locationUrl !== elementUrl) {
      this.pushState(null, "", href);

      return false;
    }

    /*
    
    if there's a hash, propagate
    if there's not a hash, do not propagate

    */

    return href.includes("#");
  };
}

RouterHistory.initialized = false;
