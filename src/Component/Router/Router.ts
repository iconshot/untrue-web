import $, {
  Comparer,
  Component,
  Props,
  ComponentType,
  ClassComponent,
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

export class Router {
  private static initialized = false;

  public static init(): void {
    if (this.initialized) {
      return;
    }

    window.addEventListener("popstate", (): void => {
      this.emitLocationChange();
    });

    this.initialized = true;
  }

  public static pushState(
    data: any,
    unused: string,
    url?: string | URL | null
  ): void {
    window.history.pushState(data, unused, url);

    this.emitLocationChange();
  }

  public static replaceState(
    data: any,
    unused: string,
    url?: string | URL | null
  ): void {
    window.history.replaceState(data, unused, url);

    this.emitLocationChange();
  }

  private static emitLocationChange(): void {
    window.dispatchEvent(new Event("locationchange"));
  }

  public static wrapRouter<K = { [key: string]: any }>(): ClassComponent<
    RouterProps<K>
  > {
    return class RouterWrapper extends Component<RouterProps<K>> {
      private locationPath: string | null = null;

      private route: InternalRoute<K> | null = null;

      public init(): void {
        const listener = (): void => {
          const locationPath = this.getLocationPath();

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
          window.addEventListener("locationchange", listener);
        });

        this.on("unmount", (): void => {
          window.removeEventListener("locationchange", listener);
        });
      }

      private getLocationPath(): string {
        return `/${window.location.pathname.replace(/^\/|\/$/g, "")}`;
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

        const locationPath = this.getLocationPath();

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

  static onClick = (event: MouseEvent): boolean => {
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
      Router.pushState(null, "", href);

      return false;
    }

    const hasLocationHash = window.location.href.includes("#");
    const hasElementHash = href.includes("#");

    // if navigating from #hash to no #hash, pushState

    if (hasLocationHash && !hasElementHash) {
      Router.pushState(null, "", href);

      return false;
    }

    // if hasElementHash, propagate to browser

    return hasElementHash;
  };
}

Router.init();
