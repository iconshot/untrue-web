import { Component } from "untrue";

export class Edge {
  constructor(
    public readonly slot: any,
    public readonly depth: number = 0,
    public readonly parent: Edge | null = null,
    public children: Edge[] = [],
    public node: Node | null = null,
    public component: Component | null = null
  ) {}

  clone() {
    return new Edge(
      this.slot,
      this.depth,
      this.parent,
      this.children,
      this.node,
      this.component
    );
  }
}
