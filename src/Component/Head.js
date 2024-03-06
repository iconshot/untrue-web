import $, { Component } from "untrue";

import Tree from "../Tree/Tree";

class Head extends Component {
  constructor(props) {
    super(props);

    this.tree = new Tree(document.head);

    this.on("render", this.handleRender);
    this.on("unmount", this.handleUnmount);
  }

  handleRender = () => {
    /*
    
    the new document.head tree will be mounted on every "render",
    this way we handle "mount" and "update" events

    */

    const { children } = this.props;

    this.tree.mount($(children));
  };

  handleUnmount = () => {
    // document.head tree will be unmounted when Head is unmounted

    this.tree.unmount();
  };
}

export default Head;
