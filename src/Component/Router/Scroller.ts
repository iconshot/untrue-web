import { Component } from "untrue";

// Scroller will move scrollTop to 0 on every route change

export class Scroller extends Component {
  public init(): void {
    this.on("mount", (): void => {
      window.scrollTo(0, 0);
    });
  }

  public render(): any {
    const { children } = this.props;

    return children;
  }
}
