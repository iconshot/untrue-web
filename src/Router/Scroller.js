import { Component } from "untrue";

// Scroller will move scrollTop to 0 on every route change

export class Scroller extends Component {
  constructor(props) {
    super(props);

    this.on("mount", this.handleMountScroll);
  }

  handleMountScroll = () => {
    window.scrollTo(0, 0);
  };

  render() {
    const { children } = this.props;

    return children;
  }
}
