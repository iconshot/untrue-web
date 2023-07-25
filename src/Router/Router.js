import { Node, Component } from "untrue";

import crossroads from "crossroads";

import { RouterHistory } from "./RouterHistory";

import { Scroller } from "./Scroller";

export class Router extends Component {
  constructor(props) {
    super(props);

    this.state = { route: null };

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
    this.parseRoute();
  };

  handleMountRoutes = () => {
    this.handleRoutes();
  };

  handleUpdateRoutes = () => {
    const { routes } = this.props;
    const { routes: prevRoutes } = this.prevProps;

    if (routes === prevRoutes) {
      return;
    }

    const isEqual = routes.every((route) => {
      const prevRoute = prevRoutes.find(
        (prevRoute) => prevRoute.path === route.path
      );

      if (prevRoute === undefined) {
        return false;
      }

      if (prevRoute.Screen !== route.Screen) {
        return false;
      }

      if (prevRoute.Template !== route.Template) {
        return false;
      }

      return true;
    });

    if (!isEqual) {
      this.handleRoutes();
    }
  };

  // fired on mount and every time there's a change in routes

  handleRoutes() {
    this.resetRoutes();
    this.addRoutes();

    this.parseRoute();
  }

  addRoutes() {
    const { routes } = this.props;

    routes.forEach((route) => {
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
            params[key] = obj[key];
          });

        this.updateState({ route: { ...route, params } });
      });
    });
  }

  resetRoutes() {
    this.router.resetState();
    this.router.removeAllRoutes();
  }

  // pass href to router

  parseRoute() {
    const { href } = window.location;

    const path = `/${href.split("/").slice(3).join("/")}`;

    this.router.parse(path);
  }

  render() {
    const { route } = this.state;

    if (route === null) {
      return null;
    }

    const {
      Template = null,
      path,
      Screen,
      params,
      keyExtractor = null,
    } = route;

    const routeKey = keyExtractor !== null ? keyExtractor(params) : null;

    const key = `${path}${routeKey !== null ? `-${routeKey}` : ""}`;

    // move scrollTop to 0 on every route change

    const node = new Node(Scroller, { key }, new Node(Screen, { params }));

    return Template !== null ? new Node(Template, { params }, node) : node;
  }
}
