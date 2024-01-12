import { $, Comparer, Component } from "untrue";

import crossroads from "crossroads";

import { RouterHistory } from "./RouterHistory";

import { Scroller } from "./Scroller";

export class Router extends Component {
  constructor(props) {
    super(props);

    this.locationPath = null;

    this.route = null;

    this.on("mount", this.handleMountHistory);
    this.on("unmount", this.handleUnmountHistory);
  }

  handleMountHistory = () => {
    RouterHistory.init();

    window.addEventListener("locationchange", this.locationListener);
  };

  handleUnmountHistory = () => {
    RouterHistory.reset();

    window.removeEventListener("locationchange", this.locationListener);
  };

  locationListener = () => {
    const locationPath = this.getLocationPath();

    // ignore changes like /page?hello=world -> /page?hello=mars

    if (locationPath === this.locationPath) {
      return;
    }

    const route = this.parseRoute();

    // ignore same path and params

    if (route !== null && this.route !== null) {
      const { path, params } = route;
      const { path: currentPath, params: currentParams } = this.route;

      const notUpdated =
        path === currentPath && Comparer.compareDeep(params, currentParams);

      if (notUpdated) {
        return;
      }
    }

    this.update();
  };

  getLocationPath() {
    return `/${window.location.pathname.replace(/^\/|\/$/g, "")}`;
  }

  parseRoute() {
    const { base = "/", routes } = this.props;

    const router = crossroads.create();

    router.normalizeFn = crossroads.NORM_AS_OBJECT;

    let route = null;

    // default route

    route = { path: null, Screen: null, params: {} };

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
    const { base = "/" } = this.props;

    let {
      scroll = true,
      Template = null,
      props = {},
      uniqueKey = ({ path }) => path,
    } = this.props;

    const route = this.parseRoute();

    this.route = route;

    const { Screen, params, nested = false } = route;

    // override defaults

    if ("scroll" in route) {
      ({ scroll = true } = route);
    }

    if ("Template" in route) {
      ({ Template = null } = route);
    }

    if ("props" in route) {
      ({ props = {} } = route);
    }

    if ("uniqueKey" in route) {
      ({ uniqueKey = ({ path }) => path } = route);
    }

    // route data

    const routePath = !nested
      ? base !== "/"
        ? base !== this.locationPath
          ? this.locationPath.slice(base.length)
          : "/"
        : this.locationPath
      : null;

    const routeObj = { params, path: routePath };

    const routeKey =
      typeof uniqueKey === "function" ? uniqueKey(routeObj) : uniqueKey;

    const routeProps = typeof props === "function" ? props(routeObj) : props;

    // Scroller will set scrollTop to 0 on every route change

    const Container = scroll ? Scroller : null;

    const node = $(
      Container,
      { key: routeKey },
      $(Screen, { ...routeProps, route: routeObj })
    );

    return Template !== null
      ? $(Template, { ...routeProps, route: routeObj }, node)
      : node;
  }
}
