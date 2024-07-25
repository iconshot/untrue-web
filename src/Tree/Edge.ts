import { Component } from "untrue";

export class Edge {
  constructor(
    public readonly slot: any,
    public readonly parent: Edge | null = null,
    public readonly depth: number = 0,
    public children: Edge[] = [],
    public node: Node | null = null,
    public component: Component | null = null
  ) {}

  clone() {
    return new Edge(
      this.slot,
      this.parent,
      this.depth,
      this.children,
      this.node,
      this.component
    );
  }
}
