import { Node, Component } from "untrue";

import crossroads from "crossroads";

import { RouterHistory } from "./RouterHistory";

import { Scroller } from "./Scroller";

export class Router extends Component {
  constructor(props) {
    super(props);

    this.state = { parsed: false, route: null };

    this.router = crossroads.create();

    this.normalize();

    this.on("mount", this.handleMountHistory);
    this.on("unmount", this.handleUnmountHistory);

    this.on("mount", this.handleMountRoutes);
    this.on("update", this.handleUpdateRoutes);
  }

  normalize() {
    this.router.normalizeFn = crossroads.NORM_AS_OBJECT;
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
    this.handleRoutes();
  };

  handleMountRoutes = () => {
    this.handleRoutes();
  };

  handleUpdateRoutes = async () => {
    const { routes } = this.props;
    const { routes: prevRoutes } = this.prevProps;

    if (routes === prevRoutes) {
      return;
    }

    const isEqual =
      routes.length === prevRoutes.length &&
      routes.every((route) => {
        const prevRoute = prevRoutes.find(
          (prevRoute) => prevRoute.path === route.path
        );

        if (prevRoute === undefined) {
          return false;
        }

        if (route.Screen !== prevRoute.Screen) {
          return false;
        }

        if (route.Template !== prevRoute.Template) {
          return false;
        }

        return true;
      });

    if (isEqual) {
      return;
    }

    this.handleRoutes();
  };

  // fired on mount and every time there's a change in routes

  handleRoutes() {
    this.resetRouter();

    this.addRoutes();

    this.parseRoute();
  }

  resetRouter() {
    this.router.resetState();
    this.router.removeAllRoutes();
  }

  addRoutes() {
    const { routes } = this.props;

    routes
      .filter((route) => route.path !== null)
      .forEach((route) => {
        this.router.addRoute(route.path, (obj = {}) => {
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

          this.updateState({ route: { ...route, params } });
        });
      });
  }

  // fallback to null route

  addFallbackRoute() {
    const { routes } = this.props;

    const fallbackRoute = routes.find((route) => route.path === null);

    const route =
      fallbackRoute !== undefined ? { ...fallbackRoute, params: {} } : null;

    this.updateState({ route });
  }

  // pass location path to router

  parseRoute() {
    const { href } = window.location;

    const locationPath = `/${href.split("/").slice(3).join("/")}`.split("#")[0];

    this.updateState({ parsed: true });

    this.addFallbackRoute();

    this.router.parse(locationPath);
  }

  render() {
    const { parsed, route } = this.state;

    if (!parsed) {
      return null;
    }

    if (route === null) {
      return null;
    }

    const {
      path,
      Screen,
      params,
      Template = null,
      props = {},
      keyExtractor = null,
    } = route;

    const routeKey = keyExtractor !== null ? keyExtractor(params) : null;

    const key = `${path}${routeKey !== null ? `-${routeKey}` : ""}`;

    const routeProps = typeof props === "function" ? props(params) : props;

    // move scrollTop to 0 on every route change

    const node = new Node(
      Scroller,
      { key },
      new Node(Screen, { ...routeProps, params })
    );

    return Template !== null
      ? new Node(Template, { ...routeProps, params }, node)
      : node;
  }
}
