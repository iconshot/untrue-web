import $, {
  Comparer,
  Component,
  Props,
  ComponentType,
  ClassComponent,
} from "untrue";

import crossroads from "crossroads";

import { RouterHistory } from "./RouterHistory";

import { Scroller } from "./Scroller";

export interface Params {}

export interface Route {
  path: string | null;
  params: Params;
}

interface InternalRoute<K> extends RouterPropsRoute<K> {
  params: Params;
}

interface RouterPropsRoute<K> {
  path: string | null;
  nested?: boolean;
  Screen: ComponentType | null;
  Template?: ComponentType;
  data?: K;
  scroll?: boolean;
}

export interface RouterProps<K> extends Props {
  base?: string;
  routes: RouterPropsRoute<K>[];
  Template?: ComponentType | null;
  data?: K;
  scroll?: boolean;
}

export class Router {
  static wrapRouter<K = { [key: string]: any }>(): ClassComponent<
    RouterProps<K>
  > {
    return class RouterWrapper extends Component<RouterProps<K>> {
      private locationPath: string | null = null;

      private route: InternalRoute<K> | null = null;

      constructor(props: RouterProps<K>) {
        super(props);

        this.on("mount", this.handleMount);
        this.on("unmount", this.handleUnmount);
      }

      private handleMount = () => {
        RouterHistory.init();

        window.addEventListener("locationchange", this.locationListener);
      };

      private handleUnmount = () => {
        window.removeEventListener("locationchange", this.locationListener);
      };

      private locationListener = () => {
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

      private getLocationPath() {
        return `/${window.location.pathname.replace(/^\/|\/$/g, "")}`;
      }

      private parseRoute() {
        const { base = "/", routes } = this.props;

        const router = crossroads.create();

        router.normalizeFn = crossroads.NORM_AS_OBJECT;

        let route: InternalRoute<K> = { path: null, Screen: null, params: {} };

        // fallback route

        const fallbackRoute = routes.find((tmpRoute) => tmpRoute.path === null);

        if (fallbackRoute !== undefined) {
          route = { ...fallbackRoute, params: {} };
        }

        // add routes

        routes
          .filter((tmpRoute) => tmpRoute.path !== null)
          .forEach((tmpRoute) => {
            const { nested = false } = tmpRoute;

            let tmpPath = `${base !== "/" ? base : ""}${tmpRoute.path}`;

            if (nested) {
              tmpPath += "/:rest*:";
            }

            router.addRoute(tmpPath, (obj = {}) => {
              const params = {};

              // filter out crossroads properties

              Object.keys(obj)
                .filter(
                  (key) =>
                    key !== "request_" &&
                    key !== "vals_" &&
                    !Number.isInteger(parseInt(key))
                )
                .forEach((key) => {
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

      render() {
        let { scroll = true, Template = null, data = {} } = this.props;

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

        if (route.data !== undefined) {
          data = route.data;
        }

        // route

        const tmpRoute: Route = { path, params };

        const key = JSON.stringify(tmpRoute);

        return $(
          Template,
          $(
            scroll ? Scroller : null,
            { key },
            $(Screen, { ...data, route: tmpRoute } as any)
          )
        );
      }
    };
  }

  static onClick = (event: MouseEvent, element: HTMLAnchorElement): boolean => {
    /*
    
    return true means the click event will be handled by the browser
    return false means the click event won't be handled by the browser
  
    */

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
      RouterHistory.pushState(null, "", href);

      return false;
    }

    const hasLocationHash = window.location.href.includes("#");
    const hasElementHash = href.includes("#");

    // if navigating from #hash to no #hash, pushState

    if (hasLocationHash && !hasElementHash) {
      RouterHistory.pushState(null, "", href);

      return false;
    }

    // if hasElementHash, propagate to browser

    return hasElementHash;
  };
}
