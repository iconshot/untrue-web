class StackItem {
  constructor(edge, target, depthIndex) {
    this.edge = edge;
    this.target = target;
    this.depthIndex = depthIndex;
  }

  getEdge() {
    return this.edge;
  }

  getTarget() {
    return this.target;
  }

  getDepthIndex() {
    return this.depthIndex;
  }
}

export default StackItem;
