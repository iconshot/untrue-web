import { Node, Component } from "untrue";

import crossroads from "crossroads";

import { RouterHistory } from "./RouterHistory";

import { Scroller } from "./Scroller";

export class Router extends Component {
  constructor(props) {
    super(props);

    this.router = crossroads.create();

    this.path = null;

    this.normalizeRouter();

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
    const path = this.getLocationPath();

    if (path !== this.path) {
      this.update();
    }
  };

  normalizeRouter() {
    this.router.normalizeFn = crossroads.NORM_AS_OBJECT;
  }

  getLocationPath() {
    const { href } = window.location;

    return `/${href.split("/").slice(3).join("/")}`.split("#")[0];
  }

  parseRoute() {
    const { routes } = this.props;

    // reset router

    this.router.resetState();
    this.router.removeAllRoutes();

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
        this.router.addRoute(tmpRoute.path, (obj = {}) => {
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
              params[key] = obj[key].split("#")[0];
            });

          route = { ...tmpRoute, params };
        });
      });

    // parse path

    const path = this.getLocationPath();

    this.router.parse(path);

    // store path

    this.path = path;

    return route;
  }

  render() {
    const route = this.parseRoute();

    if (route === null) {
      return null;
    }

    const {
      Screen,
      params,
      Template = null,
      props = {},
      keyExtractor = ({ path }) => path,
    } = route;

    const routeObj = { params, path: this.path };

    const key = keyExtractor(routeObj);

    const routeProps = typeof props === "function" ? props(routeObj) : props;

    // move scrollTop to 0 on every route change

    const node = new Node(
      Scroller,
      { key },
      new Node(Screen, { ...routeProps, route: routeObj })
    );

    return Template !== null
      ? new Node(Template, { ...routeProps, route: routeObj }, node)
      : node;
  }
}
