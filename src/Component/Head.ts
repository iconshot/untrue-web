import $, { Component, Props } from "untrue";

import { Tree } from "../Tree/Tree";

export class Head extends Component {
  private tree: Tree = new Tree(document.head);

  constructor(props: Props) {
    super(props);

    this.on("render", this.handleRender);
    this.on("unmount", this.handleUnmount);
  }

  private handleRender = () => {
    /*
    
    the new document.head tree will be mounted on every "render",
    this way we handle "mount" and "update" events

    */

    const { children } = this.props;

    this.tree.mount($(null, children));
  };

  private handleUnmount = () => {
    // document.head tree will be unmounted when Head is unmounted

    this.tree.unmount();
  };
}

export default Head;
