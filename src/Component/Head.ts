import $, { Component } from "untrue";

import { Tree } from "../Tree/Tree";

export class Head extends Component {
  init(): void {
    let tree: Tree = new Tree(document.head);

    this.on("render", (): void => {
      /*
      
      the new document.head tree will be mounted on every "render",
      this way we handle "mount" and "update" events
  
      */

      const { children } = this.props;

      tree.mount($(null, children));
    });

    this.on("unmount", (): void => {
      // document.head tree will be unmounted when Head is unmounted

      tree.unmount();
    });
  }
}

export default Head;
