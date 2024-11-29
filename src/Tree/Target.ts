export class Target {
  constructor(public readonly element: Element, public index: number = 0) {}

  public insert(child: Node): void {
    // get the currentChild based on this.index, it can be null

    const currentChild: Node | null =
      this.index < this.element.childNodes.length
        ? this.element.childNodes[this.index]
        : null;

    // insert child before currentChild or append child to this.element

    if (currentChild !== null) {
      if (child !== currentChild) {
        this.element.insertBefore(child, currentChild);
      }
    } else {
      this.element.appendChild(child);
    }

    this.index++;
  }

  public remove(child: Node): void {
    this.element.removeChild(child);
  }
}
