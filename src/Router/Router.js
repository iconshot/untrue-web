import { Node, Component } from "untrue";

import crossroads from "crossroads";

import { RouterHistory } from "./RouterHistory";

import { Scroller } from "./Scroller";

export class Router extends Component {
  constructor(props) {
    super(props);

    this.locationPath = null;

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

    if (locationPath !== this.locationPath) {
      this.update();
    }
  };

  getLocationPath() {
    return `/${window.location.pathname.replace(/^\/|\/$/g, "")}`;
  }

  parseRoute() {
    const { path = "/", routes } = this.props;

    const router = crossroads.create();

    router.normalizeFn = crossroads.NORM_AS_OBJECT;

    let route = null;

    // fallback route

    const fallbackRoute = routes.find((tmpRoute) => tmpRoute.path === null);

    if (fallbackRoute !== undefined) {
      route = { ...fallbackRoute, params: {} };
    }

    // add routes

    routes
      .filter((tmpRoute) => tmpRoute.path !== null)
      .forEach((tmpRoute) => {
        const routePath = `${path !== "/" ? path : ""}${tmpRoute.path}`;

        router.addRoute(routePath, (obj = {}) => {
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
    const { path = "/" } = this.props;

    let {
      Template = null,
      props = {},
      uniqueKey = ({ path }) => path,
    } = this.props;

    const route = this.parseRoute();

    if (route === null) {
      return null;
    }

    const { Screen, params } = route;

    // override Route Template if needed

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

    const routePath =
      path !== "/"
        ? path !== this.locationPath
          ? this.locationPath.slice(path.length)
          : "/"
        : this.locationPath;

    const routeObj = { params, path: routePath };

    const routeKey =
      typeof uniqueKey === "function" ? uniqueKey(routeObj) : uniqueKey;

    const routeProps = typeof props === "function" ? props(routeObj) : props;

    // move scrollTop to 0 on every route change

    const node = new Node(
      Scroller,
      { key: routeKey },
      new Node(Screen, { ...routeProps, route: routeObj })
    );

    return Template !== null
      ? new Node(Template, { ...routeProps, route: routeObj }, node)
      : node;
  }
}
