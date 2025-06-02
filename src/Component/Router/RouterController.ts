import $, {
  Comparer,
  Component,
  Props,
  ComponentType,
  ClassComponent,
  Emitter,
  Hook,
} from "untrue";

import crossroads from "crossroads";

import { Scroller } from "./Scroller";

export interface Params {}

export interface RouteProps<K extends Params = Params> extends Props {
  route: Route<K>;
}

interface Route<K extends Params = Params> {
  path: string | null;
  params: K;
}

interface InternalRoute<K> extends RouterPropsRoute<K> {
  params: Params;
}

interface RouterPropsRoute<K> {
  path: string | null;
  nested?: boolean;
  Screen: ComponentType | null;
  Template?: ComponentType | null;
  props?: K;
  scroll?: boolean;
}

export interface RouterProps<K> extends Props {
  base?: string;
  routes: RouterPropsRoute<K>[];
  Template?: ComponentType | null;
  props?: K;
  scroll?: boolean;
}

type RouterControllerSignatures = {
  locationchange: () => any;
};

class RouterController extends Emitter<RouterControllerSignatures> {
  constructor() {
    super();

    window.addEventListener("popstate", (): void => {
      this.emitLocationChange();
    });
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

  public wrapRouter<K extends Record<string, any>>(): ClassComponent<
    RouterProps<K>
  > {
    const self = this;

    return class Router extends Component<RouterProps<K>> {
      private locationPath: string | null = null;

      private route: InternalRoute<K> | null = null;

      public init(): void {
        const listener = (): void => {
          const locationPath = self.getLocationPath();

          // ignore changes like /page?hello=world -> /page?hello=mars

          if (locationPath === this.locationPath) {
            return;
          }

          const route = this.parseRoute();

          // ignore same path and params

          if (this.route !== null) {
            const { path, params } = route;

            const { path: currentPath, params: currentParams } = this.route;

            const equal =
              Comparer.compare(path, currentPath) &&
              Comparer.compare(params, currentParams);

            if (equal) {
              return;
            }
          }

          this.update();
        };

        this.on("mount", (): void => {
          self.on("locationchange", listener);
        });

        this.on("unmount", (): void => {
          self.off("locationchange", listener);
        });
      }

      private parseRoute(): InternalRoute<K> {
        const { base = "/", routes } = this.props;

        const router = crossroads.create();

        router.normalizeFn = crossroads.NORM_AS_OBJECT;

        let route: InternalRoute<K> = { path: null, Screen: null, params: {} };

        // fallback route

        const fallbackRoute = routes.find(
          (tmpRoute): boolean => tmpRoute.path === null
        );

        if (fallbackRoute !== undefined) {
          route = { ...fallbackRoute, params: {} };
        }

        // add routes

        routes
          .filter((tmpRoute): boolean => tmpRoute.path !== null)
          .forEach((tmpRoute): void => {
            const { nested = false } = tmpRoute;

            let tmpPath = `${base !== "/" ? base : ""}${tmpRoute.path}`;

            if (nested) {
              tmpPath += "/:rest*:";
            }

            router.addRoute(tmpPath, (obj = {}): void => {
              const params = {};

              // filter out crossroads properties

              Object.keys(obj)
                .filter(
                  (key): boolean =>
                    key !== "request_" &&
                    key !== "vals_" &&
                    !Number.isInteger(parseInt(key))
                )
                .forEach((key): void => {
                  params[key] = obj[key];
                });

              if (nested) {
                delete params["rest*"];
              }

              route = { ...tmpRoute, params };
            });
          });

        // parse path

        const locationPath = self.getLocationPath();

        router.parse(locationPath);

        // store path

        this.locationPath = locationPath;

        return route;
      }

      public render(): any {
        let { scroll = true, Template = null, props = {} } = this.props;

        const route = this.parseRoute();

        this.route = route;

        const { path, Screen, params } = route;

        // override defaults

        if (route.scroll !== undefined) {
          scroll = route.scroll;
        }

        if (route.Template !== undefined) {
          Template = route.Template;
        }

        if (route.props !== undefined) {
          props = route.props;
        }

        // route

        const tmpRoute: Route = { path, params };

        const key = JSON.stringify(tmpRoute);

        return $(
          Template,
          $(
            scroll ? Scroller : null,
            { key },
            $(Screen, { ...props, route: tmpRoute } as any)
          )
        );
      }
    };
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

  public bind(component: Component, listener: () => void): void {
    component.on("mount", (): void => {
      this.on("locationchange", listener);
    });

    component.on("unmount", (): void => {
      this.off("locationchange", listener);
    });
  }

  public use(listener: () => void): void {
    const listenerVar = Hook.useVar<() => void>(listener);

    listenerVar.value = listener;

    const callback = Hook.useCallback((): void => {
      const listener = listenerVar.value;

      listener();
    });

    Hook.useMountLifecycle((): void => {
      this.on("locationchange", callback);
    });

    Hook.useUnmountLifecycle((): void => {
      this.off("locationchange", callback);
    });
  }

  public useLocationPath(): string {
    const update = Hook.useUpdate();

    this.use((): void => {
      update();
    });

    return this.getLocationPath();
  }
}

export default new RouterController();
