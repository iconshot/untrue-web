export class Target {
  constructor(public readonly node: Element, public index: number = 0) {}

  insert(child: Node): void {
    // get the currentChild based on this.index, it can be null

    const currentChild: Node | null =
      this.index < this.node.childNodes.length
        ? this.node.childNodes[this.index]
        : null;

    // insert child before currentChild or append child to this.node

    if (currentChild !== null) {
      if (child !== currentChild) {
        this.node.insertBefore(child, currentChild);
      }
    } else {
      this.node.appendChild(child);
    }

    this.index++;
  }

  remove(child: Node): void {
    this.node.removeChild(child);
  }
}
