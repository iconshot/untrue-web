import { Component, Hookster } from "untrue";

export class Edge {
  constructor(
    public slot: any,
    public depth: number = 0,
    public parent: Edge | null = null,
    public children: Edge[] = [],
    public component: Component | null = null,
    public hookster: Hookster | null = null,
    public node: Node | null = null,
    public targetNodesCount: number = 0
  ) {}

  public clone(): Edge {
    return new Edge(
      this.slot,
      this.depth,
      this.parent,
      this.children,
      this.component,
      this.hookster,
      this.node,
      this.targetNodesCount
    );
  }
}
