import { Edge } from "./Edge";

export class StackItem {
  constructor(public readonly edge: Edge, public readonly node: Element) {}
}
