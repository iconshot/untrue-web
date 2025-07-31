import { Emitter, Hook } from "untrue";

type RouterControllerSignatures = {
  locationchange: () => any;
  basechange: () => any;
};

class RouterControllerClass extends Emitter<RouterControllerSignatures> {
  private basePath: string = "/";

  constructor() {
    super();

    window.addEventListener("popstate", (): void => {
      this.emitLocationChange();
    });
  }

  public getBasePath(): string {
    return this.basePath;
  }

  public setBasePath(basePath: string): void {
    const tmpBasePath = `/${basePath.replace(/^\/|\/$/g, "")}`;

    if (tmpBasePath === this.basePath) {
      return;
    }

    this.basePath = tmpBasePath;

    this.emit("basechange");
  }

  public pushState(data: any, unused: string, url?: string | URL | null): void {
    window.history.pushState(data, unused, url);

    this.emitLocationChange();
  }

  public replaceState(
    data: any,
    unused: string,
    url?: string | URL | null
  ): void {
    window.history.replaceState(data, unused, url);

    this.emitLocationChange();
  }

  private emitLocationChange(): void {
    this.emit("locationchange");
  }

  public getLocationPath(): string {
    return `/${window.location.pathname.replace(/^\/|\/$/g, "")}`;
  }

  public onClick = (event: MouseEvent): boolean => {
    /*
    
    return true means the click event will be handled by the browser
    return false means the click event won't be handled by the browser
  
    */

    const element = event.currentTarget as HTMLAnchorElement;

    const href = element.href;
    const target = element.target;

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

    const locationUrl = window.location.href.split("#")[0];
    const elementUrl = href.split("#")[0];

    // if urls are different, pushState

    if (locationUrl !== elementUrl) {
      this.pushState(null, "", href);

      return false;
    }

    const hasLocationHash = window.location.href.includes("#");
    const hasElementHash = href.includes("#");

    // if navigating from #hash to no #hash, pushState

    if (hasLocationHash && !hasElementHash) {
      this.pushState(null, "", href);

      return false;
    }

    // if hasElementHash, propagate to browser

    return hasElementHash;
  };

  public useLocationPath(): string {
    const update = Hook.useUpdate();

    const callback = Hook.useCallback((): void => {
      update();
    });

    Hook.useMountLifecycle((): void => {
      this.on("locationchange", callback);
    });

    Hook.useUnmountLifecycle((): void => {
      this.off("locationchange", callback);
    });

    return this.getLocationPath();
  }

  public useBasePath(): string {
    const update = Hook.useUpdate();

    const callback = Hook.useCallback((): void => {
      update();
    });

    Hook.useMountLifecycle((): void => {
      this.on("basechange", callback);
    });

    Hook.useUnmountLifecycle((): void => {
      this.off("basechange", callback);
    });

    return this.basePath;
  }
}

export const RouterController = new RouterControllerClass();
