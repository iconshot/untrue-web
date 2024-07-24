import { Component, Props } from "untrue";

// Scroller will move scrollTop to 0 on every route change

export class Scroller extends Component {
  constructor(props: Props) {
    super(props);

    this.on("mount", this.handleMount);
  }

  private handleMount = () => {
    window.scrollTo(0, 0);
  };

  render() {
    const { children } = this.props;

    return children;
  }
}
