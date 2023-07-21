import { Component, Node } from "untrue";

import { Tree } from "./Tree/Tree";

export class Head extends Component {
  constructor(props) {
    super(props);

    this.tree = new Tree(document.head);

    this.on("render", this.handleRender);
    this.on("unmount", this.handleUnmount);
  }

  handleRender = () => {
    const { children } = this.props;

    this.tree.mount(new Node(children));
  };

  handleUnmount = () => {
    this.tree.unmount();
  };
}
