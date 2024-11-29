import {
  Slot,
  Ref,
  Hookster,
  ClassComponent,
  FunctionComponent,
  Comparer,
} from "untrue";

import { Target } from "./Target";
import { Edge } from "./Edge";

import { ErrorHandler } from "../ErrorHandler";

export class Tree {
  private edge: Edge | null = null;

  private stack: Edge[] = [];

  private timeout: number | undefined;

  constructor(private element: Element) {}

  public mount(slot: Slot): void {
    // unmount if there is a root edge

    if (this.edge !== null) {
      this.unmount();
    }

    // create starting target

    const target = new Target(this.element);

    /*
    
    we use Edge objects to store additional data,
    like node and component

    */

    this.edge = new Edge(slot);

    // start the initial render

    this.renderEdge(this.edge, null, target);
  }

  public unmount(): void {
    // ignore if there is not a root edge

    if (this.edge === null) {
      return;
    }

    // create starting target

    const target = new Target(this.element);

    // start the unmounting

    this.unmountEdge(this.edge, target);

    // clear properties

    this.edge = null;

    this.stack = [];

    clearTimeout(this.timeout);
  }

  // add edge to the stack

  private queue(edge: Edge): void {
    this.stack.push(edge);

    // this allows to batch multiple components being updated at the same time

    clearTimeout(this.timeout);

    this.timeout = setTimeout((): void => {
      this.rerender();
    });
  }

  // remove edge from the stack

  private unqueue(edge: Edge): void {
    this.stack = this.stack.filter((tmpEdge): boolean => tmpEdge !== edge);
  }

  private rerender(): void {
    // end the recursion until queue() is called again

    if (this.stack.length === 0) {
      return;
    }

    // get a stack edge, closer to the root first

    this.stack.sort((a, b): number => a.depth - b.depth);

    const edge = this.stack[0];

    const target = this.createTarget(edge);

    /*
    
    clone edge to use with renderEdge

    the clone will have the references to previous components and DOM nodes
    and the overall previous sub-tree
    while edge will be updated inside renderEdge

    */

    const prevEdge = edge.clone();

    // rerender component

    this.renderEdge(edge, prevEdge, target);

    // if there's a new targetNodesCount, propagate the difference

    const difference = edge.targetNodesCount - prevEdge.targetNodesCount;

    if (difference !== 0) {
      this.propagateTargetNodesCountDifference(edge, difference);
    }

    // call again to rerender remaining components

    this.rerender();
  }

  private propagateTargetNodesCountDifference(
    edge: Edge,
    difference: number
  ): void {
    const parent = edge.parent;

    if (parent === null) {
      return;
    }

    const node = parent.node;

    if (node !== null) {
      return;
    }

    parent.targetNodesCount += difference;

    this.propagateTargetNodesCountDifference(parent, difference);
  }

  private renderChildren(
    edge: Edge,
    prevEdge: Edge | null,
    target: Target
  ): void {
    const children: Edge[] = [];
    const prevChildren: (Edge | null)[] = [];

    const toMoveChildren: Edge[] = [];

    const slot: Slot = edge.slot;

    const slots = slot.getChildren();

    const prevSlots = prevEdge?.children.map((child): any => child.slot) ?? [];

    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];

      let child: Edge | null = null;
      let prevChild: Edge | null = null;

      if (slot instanceof Slot && slot.getKey() !== null) {
        // set child as equal previous child (based on type and key)

        for (let j = 0; j < prevSlots.length; j++) {
          const prevSlot = prevSlots[j];

          if (this.isEqual(slot, prevSlot)) {
            child = prevEdge!.children[j];

            if (j !== i) {
              toMoveChildren.push(child);
            }

            break;
          }
        }
      } else if (i < prevSlots.length) {
        // set child as same index previous child (only if they're equal)

        const prevSlot = prevSlots[i];

        if (this.isEqual(slot, prevSlot)) {
          child = prevEdge!.children[i];
        }
      }

      // prepare child

      if (child === null) {
        child = new Edge(slot, edge.depth + 1, edge);
      } else {
        prevChild = child.clone();

        child.slot = slot;
      }

      children.push(child);
      prevChildren.push(prevChild);
    }

    edge.children = children;

    // unmount loop

    if (prevEdge !== null) {
      for (const prevChild of prevEdge.children) {
        const shouldBeUnmounted = !children.includes(prevChild);

        if (shouldBeUnmounted) {
          this.unmountEdge(prevChild, target);
        }
      }
    }

    // render loop

    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const prevChild = prevChildren[i];

      const shouldBeMoved = toMoveChildren.includes(child);

      if (shouldBeMoved) {
        const tmpTarget = new Target(target.element, target.index);

        this.moveEdge(child, tmpTarget);
      }

      this.renderEdge(child, prevChild, target);
    }
  }

  private moveEdge(edge: Edge, target: Target): void {
    const node = edge.node;
    const children = edge.children;

    if (node !== null) {
      target.insert(node);

      return;
    }

    for (const child of children) {
      this.moveEdge(child, target);
    }
  }

  /*

  check type of slot and call the right render method

  class/function components may be skipped if they have no updates

  null, undefined and false values are ignored

  */

  private renderEdge(edge: Edge, prevEdge: Edge | null, target: Target): void {
    if (edge.component !== null || edge.hookster !== null) {
      this.unqueue(edge);
    }

    if (prevEdge !== null && edge.slot instanceof Slot) {
      const slot = edge.slot as Slot;
      const prevSlot = prevEdge.slot as Slot;

      if (slot.isClass() || slot.isFunction()) {
        let equal = false;

        if (slot.isClass()) {
          equal = !edge.component!.needsUpdate();
        }

        if (slot.isFunction()) {
          equal = !edge.hookster!.needsUpdate();
        }

        if (equal) {
          equal = Comparer.compare(slot, prevSlot);
        }

        if (equal) {
          target.index += edge.targetNodesCount;

          return;
        }
      }
    }

    const slot = edge.slot;

    const initialTargetIndex = target.index;

    try {
      if (slot instanceof Slot) {
        if (slot.isClass()) {
          this.renderClass(edge, prevEdge, target);
        } else if (slot.isFunction()) {
          this.renderFunction(edge, prevEdge, target);
        } else if (slot.isElement()) {
          this.renderElement(edge, prevEdge, target);
        } else if (slot.isNull()) {
          this.renderNull(edge, prevEdge, target);
        }
      } else if (slot !== null && slot !== undefined && slot !== false) {
        this.renderText(edge, prevEdge, target);
      }

      const targetNodesCount = target.index - initialTargetIndex;

      edge.targetNodesCount = targetNodesCount;
    } catch (error) {
      target.index += edge.targetNodesCount;

      ErrorHandler.handle(error);
    }
  }

  private renderClass(edge: Edge, prevEdge: Edge | null, target: Target): void {
    // get slot and prevSlot

    const slot: Slot = edge.slot;

    const prevSlot: Slot | null = prevEdge?.slot ?? null;

    // get type and props

    const contentType = slot.getContentType();
    const props = slot.getProps();

    // prepare component

    let component = edge.component;

    if (component === null) {
      const ComponentClass = contentType as ClassComponent;

      component = new ComponentClass(props);

      component.initialize((): void => {
        this.queue(edge);
      });
    } else {
      component.updateProps(props);
    }

    edge.component = component;

    // update ref and prevRef if necessary

    const ref = slot.getRef();

    const prevRef = prevSlot?.getRef() ?? null;

    if (prevRef instanceof Ref && prevRef !== ref) {
      prevRef.value = null;
    }

    if (ref instanceof Ref && ref !== prevRef) {
      ref.value = component;
    }

    // now it's safe to get component's new content

    const children = component.render() ?? [];

    /*

    store the content inside slot,
    then on renderChildren we will use these children slots to see
    if we need to create new edges or to re-use the previous ones (from prevEdge)

    */

    slot.setChildren(children);

    this.renderChildren(edge, prevEdge, target);

    /*
    
    because of this final line, deeper components will trigger render first

    the listener passed to triggerRender will be used
    when there's a "rerender" event fired in the component

    */

    component.triggerRender();
  }

  private renderFunction(
    edge: Edge,
    prevEdge: Edge | null,
    target: Target
  ): void {
    const slot: Slot = edge.slot;

    const prevSlot: Slot | null = prevEdge?.slot ?? null;

    const contentType = slot.getContentType();
    const props = slot.getProps();

    let hookster = edge.hookster;

    if (hookster === null) {
      hookster = new Hookster();

      hookster.initialize((): void => {
        this.queue(edge);
      });
    } else {
      hookster.performUpdate();
    }

    edge.hookster = hookster;

    hookster.activate();

    const prevProps = prevSlot?.getProps() ?? null;

    const ComponentFunction = contentType as FunctionComponent;

    const children = ComponentFunction(props, prevProps) ?? [];

    hookster.deactivate();

    /*
    
    same as with the renderClass, we call slot.setChildren() and then renderChildren()
    while keeping the previous sub-tree inside prevEdge
      
    */

    slot.setChildren(children);

    this.renderChildren(edge, prevEdge, target);

    hookster.triggerRender();
  }

  private renderElement(
    edge: Edge,
    prevEdge: Edge | null,
    target: Target
  ): void {
    // node will be an element node

    let node = edge.node;

    if (node === null) {
      node = this.createNode(edge);
    }

    edge.node = node;

    this.patchNode(edge, prevEdge);

    /*
    
    tmpTarget is needed to insert child DOM nodes inside node

    no need to find a targetIndex,
    we want target to start from 0 for the next renderChildren,
    every time target.insert() is called
    it increments the target.index internally

    */

    const tmpTarget = new Target(node as Element);

    this.renderChildren(edge, prevEdge, tmpTarget);

    /*
    
    browsers usually optimize reflows but we call insert after renderChildren
    to keep good practices and reduce reflows if possible

    */

    target.insert(node);
  }

  private renderText(edge: Edge, prevEdge: Edge | null, target: Target): void {
    // node will be a text node

    let node = edge.node;

    if (node === null) {
      node = this.createNode(edge);
    }

    edge.node = node;

    this.patchNode(edge, prevEdge);

    target.insert(node);

    // text nodes are leafs, so no need for renderChildren()
  }

  private renderNull(edge: Edge, prevEdge: Edge | null, target: Target): void {
    // if slot type is null, we do nothing but loop through its children

    this.renderChildren(edge, prevEdge, target);
  }

  private unmountEdge(edge: Edge, target: Target): void {
    const slot = edge.slot;
    const node = edge.node;
    const component = edge.component;
    const hookster = edge.hookster;
    const children = edge.children;

    let tmpTarget = target;

    /*
    
    remove node, if any

    ghost trees are trees that never call unmount()

    it's recommended to always call unmount when the tree
    is no longer visible in the dom, for example
    when the component that created the tree
    gets an "unmount" event

    but ghost trees could be useful too,
    hence this optimization:

    new tmpTarget is needed for every element slot
    so in case there's a ghost tree, tree.element has no parent
    and unmounted elements get freed from memory,
    except for the ones that belong to the ghost tree of course

    in the past we used to call target.remove only for the direct child nodes
    to avoid calling target.remove on elements that would be removed anyway...
    however if there was a whole sequence of elements before a ghost tree's element,
    those elements would still be accesible via element.parentNode
    which could lead to memory leaks

    with this new implementation, target.element (for a ghost tree)
    doesn't have a parentNode anymore

    this approach has another advantage:
    when an event is dispatched in a ghost tree's element,
    which is very rare but could happen,
    the event is bubbled up to tree.element only
    and it doesn't reach unmounted ancestor elements

    */

    if (node !== null) {
      target.remove(node);

      if (slot instanceof Slot && slot.isElement()) {
        tmpTarget = new Target(node as Element);
      }
    }

    // update ref

    const ref = slot instanceof Slot ? slot.getRef() : null;

    if (ref instanceof Ref) {
      ref.value = null;
    }

    // unmount children

    for (const child of children) {
      this.unmountEdge(child, tmpTarget);
    }

    /*
    
    unmount component or hookster

    this is called at the very end of the method
    to keep consistency with renderClass/renderFunction:
    deeper components will reach triggerUnmount first

    */

    if (component !== null) {
      this.unqueue(edge);

      component.triggerUnmount();
    }

    if (hookster !== null) {
      this.unqueue(edge);

      hookster.triggerUnmount();
    }
  }

  private isEqual(slot: any, prevSlot: any): boolean {
    //  check slots based on type and key

    if (slot instanceof Slot) {
      if (!(prevSlot instanceof Slot)) {
        return false;
      }

      const contentType = slot.getContentType();
      const key = slot.getKey();

      const prevContentType = prevSlot.getContentType();
      const prevKey = prevSlot.getKey();

      return contentType === prevContentType && key === prevKey;
    }

    // null, undefined and false are special cases since they will be ignored by renderEdge

    if (slot === null || slot === undefined || slot === false) {
      return prevSlot === null || prevSlot === undefined || prevSlot === false;
    }

    // check if both slots are texts

    return (
      prevSlot !== null &&
      prevSlot !== undefined &&
      prevSlot !== false &&
      !(prevSlot instanceof Slot)
    );
  }

  private createNode(edge: Edge): Node {
    // according to the slot type, create an element node or a text node

    const slot = edge.slot;

    if (slot instanceof Slot) {
      const contentType = slot.getContentType();

      const tagName = contentType as string;

      return document.createElement(tagName);
    } else {
      return document.createTextNode("");
    }
  }

  private patchNode(edge: Edge, prevEdge: Edge | null): void {
    const slot = edge.slot;
    const node = edge.node!;

    const prevSlot = prevEdge?.slot ?? null;

    if (slot instanceof Slot) {
      // node is an element node

      const element = node as Element;

      const attributes = slot.getAttributes() ?? {};

      const prevAttributes = (prevSlot as Slot | null)?.getAttributes() ?? {};

      // loop through attributes

      for (const key in attributes) {
        const value = attributes[key] ?? null;
        const prevValue = prevAttributes[key] ?? null;

        switch (key) {
          case "key": {
            break;
          }

          case "ref": {
            const ref = value;
            const prevRef = prevValue;

            // update ref and prevRef

            if (prevRef instanceof Ref && prevRef !== ref) {
              prevRef.value = null;
            }

            if (ref instanceof Ref && ref !== prevRef) {
              ref.value = element;
            }

            break;
          }

          default: {
            const isValueHandler = typeof value === "function";
            const isCurrentValueHandler = typeof prevValue === "function";

            if (value !== null) {
              // we have an attribute

              if (isValueHandler) {
                // set element's handler

                if (prevValue !== null && !isCurrentValueHandler) {
                  element.removeAttribute(key);
                }

                if (value !== prevValue) {
                  element[key] = value;
                }
              } else {
                // set element's attribute

                if (prevValue !== null && isCurrentValueHandler) {
                  element[key] = null;
                }

                if (value !== prevValue) {
                  try {
                    element.setAttribute(key, value);
                  } catch (error) {
                    ErrorHandler.handle(error);
                  }
                }
              }
            } else {
              // value is null

              if (prevValue !== null) {
                // delete element's handler or attribute

                if (isCurrentValueHandler) {
                  element[key] = null;
                } else {
                  element.removeAttribute(key);
                }
              }
            }

            break;
          }
        }
      }

      // loop through prevAttributes

      for (const key in prevAttributes) {
        // ignore if key found in attributes

        const found = key in attributes;

        if (found) {
          continue;
        }

        const prevValue = prevAttributes[key] ?? null;

        switch (key) {
          case "ref": {
            // update prevRef

            const prevRef = prevValue;

            if (prevRef instanceof Ref) {
              prevRef.value = null;
            }
          }

          default: {
            const isCurrentValueHandler = typeof prevValue === "function";

            if (prevValue !== null) {
              // delete element's handler or attribute

              if (isCurrentValueHandler) {
                element[key] = null;
              } else {
                element.removeAttribute(key);
              }
            }
          }
        }
      }
    } else {
      // node is a text node

      const text = node as Text;

      const value = `${slot}`;

      const prevValue = prevSlot !== null ? `${prevSlot}` : null;

      if (value !== prevValue) {
        text.nodeValue = value;
      }
    }
  }

  /*
  
  loop through preceding siblings and parent to accumulate targetIndex
  and find targetElement (some node in an ancestor edge)

  if parent is null, target element is the tree element

  */

  private createTarget(edge: Edge, targetIndex: number = 0): Target {
    const parent = edge.parent;

    if (parent === null) {
      return new Target(this.element, targetIndex);
    }

    const node = parent.node;
    const children = parent.children;

    const index = children.indexOf(edge);

    for (let i = index - 1; i >= 0; i--) {
      const child = children[i];

      targetIndex += child.targetNodesCount;
    }

    if (node !== null) {
      return new Target(node as Element, targetIndex);
    }

    return this.createTarget(parent, targetIndex);
  }
}
