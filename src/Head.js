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
    /*
    
    the new Head tree will be mounted on every "render",
    this way we handle "mount" and "update" events

    */

    const { children } = this.props;

    this.tree.mount(new Node(children));
  };

  handleUnmount = () => {
    // tree will be unmounted when Head is unmounted

    this.tree.unmount();
  };
}
