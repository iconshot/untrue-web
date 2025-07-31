import $, { Component, ComponentType, Props } from "untrue";

import crossroads from "crossroads";

import { Scroller } from "./Scroller";

import { RouterController } from "./RouterController";

export interface RouterProps extends Props {
  routes: RouterPropsRoute[];
  basePath?: string;
  scroll?: boolean;
  Template?: ComponentType | null;
}

export interface RouterPropsRoute {
  path: string | null;
  Screen: ComponentType<RouteProps<any>> | null;
  nested?: boolean;
  scroll?: boolean;
  Template?: ComponentType | null;
}

export type Params = Record<string, string>;

interface InternalRoute extends RouterPropsRoute {
  params: Params;
}

interface Route<K extends Params> {
  path: string | null;
  params: K;
}

export interface RouteProps<K extends Params = Params> extends Props {
  route: Route<K>;
}

export class Router extends Component<RouterProps> {
  private locationPath: string | null = null;

  public init(): void {
    const locationListener = (): void => {
      const locationPath = RouterController.getLocationPath();

      // ignore changes like /page?hello=world -> /page?hello=mars

      if (locationPath === this.locationPath) {
        return;
      }

      this.update();
    };

    const baseListener = (): void => {
      this.update();
    };

    this.on("mount", (): void => {
      RouterController.on("locationchange", locationListener);
      RouterController.on("basechange", baseListener);
    });

    this.on("unmount", (): void => {
      RouterController.off("locationchange", locationListener);
      RouterController.off("basechange", baseListener);
    });
  }

  private parseRoute(): InternalRoute {
    const { basePath = "/", routes } = this.props;

    const router = crossroads.create();

    router.normalizeFn = crossroads.NORM_AS_OBJECT;

    let route: InternalRoute = { path: null, Screen: null, params: {} };

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

        const fullPath = this.concatenatePaths([
          RouterController.getBasePath(),
          basePath,
          tmpRoute.path!,
        ]);

        let tmpPath = fullPath;

        if (nested) {
          if (!tmpPath.endsWith("/")) {
            tmpPath += "/";
          }

          tmpPath += ":rest*:";
        }

        router.addRoute(tmpPath, (obj: any): void => {
          const params: InternalRoute["params"] = {};

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

    const locationPath = RouterController.getLocationPath();

    router.parse(locationPath);

    // store path

    this.locationPath = locationPath;

    return route;
  }

  private concatenatePaths(paths: string[]): string {
    const pieces = paths
      .map((s) => s.replace(/^\/+|\/+$/g, ""))
      .filter((part) => part.length > 0);

    return `/${pieces.join("/")}`;
  }

  public render(): any {
    let { scroll = true, Template = null } = this.props;

    const route = this.parseRoute();

    const { path, Screen, params } = route;

    // override defaults

    if (route.scroll !== undefined) {
      scroll = route.scroll;
    }

    if (route.Template !== undefined) {
      Template = route.Template;
    }

    // route

    const tmpRoute: Route<any> = { path, params };

    const key = JSON.stringify(tmpRoute);

    return $(
      Template,
      $(
        scroll ? Scroller : null,
        { key },
        $(Screen as ComponentType<any>, { route: tmpRoute })
      )
    );
  }
}
