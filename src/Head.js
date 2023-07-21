import { Component, Node } from "untrue";

import { Tree } from "./Tree/Tree";

export class Head extends Component {
  constructor(props) {
    super(props);

    this.tree = null;

    this.on("render", this.handleRender);
    this.on("unmount", this.handleUnmount);
  }

  handleRender = () => {
    const { children } = this.props;

    const head = document.head;

    this.tree = new Tree(head);

    this.tree.mount(new Node(children));
  };

  handleUnmount = () => {
    this.tree.unmount();
  };
}
