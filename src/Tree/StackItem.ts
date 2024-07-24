import { Edge } from "./Edge";
import { Target } from "./Target";

export class StackItem {
  constructor(public readonly edge: Edge, public readonly target: Target) {}
}
