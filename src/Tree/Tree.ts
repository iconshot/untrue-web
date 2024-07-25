import { Slot, Ref, ClassComponent, FunctionComponent } from "untrue";

import { Target } from "./Target";
import { Edge } from "./Edge";
import { StackItem } from "./StackItem";

export class Tree {
  private node: Element;

  private edge: Edge | null = null;

  private stack: StackItem[] = [];

  private timeout: number | undefined;

  constructor(node: Element) {
    // starting target's node

    this.node = node;
  }

  mount(slot: Slot) {
    // unmount if there is a root edge

    if (this.edge !== null) {
      this.unmount();
    }

    // create starting target

    const target = new Target(this.node);

    /*
    
    we use Edge objects to store additional data,
    like node and component

    */

    this.edge = new Edge(slot);

    // start the initial render

    this.renderEdge(this.edge, null, target);
  }

  unmount() {
    // ignore if there is not a root edge

    if (this.edge === null) {
      return;
    }

    // create starting target

    const target = new Target(this.node);

    // start the unmounting

    this.unmountEdge(this.edge, target);

    // clear properties

    this.edge = null;

    this.stack = [];

    clearTimeout(this.timeout);
  }

  private queue(edge: Edge, target: Target) {
    // create new item

    const item = new StackItem(edge, target);

    this.stack.push(item);

    // this allows to batch multiple components being updated at the same time

    clearTimeout(this.timeout);

    this.timeout = setTimeout(() => this.rerender());
  }

  private unqueue(edge: Edge) {
    // remove edge from the stack

    this.stack = this.stack.filter(
      (item) => item.edge.component !== edge.component
    );
  }

  private rerender() {
    // end the recursion until queue() is called again

    if (this.stack.length === 0) {
      return;
    }

    // get a stack item, closer to the root first

    this.stack.sort((a, b) => a.edge.depth - b.edge.depth);

    const item = this.stack[0];

    const edge = item.edge;
    const target = item.target;
    /*
    
    clone edge to use with renderEdge
    
    the clone will have the references to current components and DOM nodes
    and the overall current sub-tree
    while edge will be updated inside renderEdge
    
    */

    const currentEdge = edge.clone();

    /*
    
    targetIndex means where we should start inserting DOM nodes inside target.node
    
    we need to search for it in every rerender
    because a sibling component could remove/add DOM nodes from target.node any time

    */

    const targetIndex = this.findTargetIndex(edge, target.node);

    const tmpTarget = new Target(target.node, targetIndex);

    // rerender component

    this.renderEdge(edge, currentEdge, tmpTarget);

    // call again to rerender remaining components

    this.rerender();
  }

  // convert slot.children to Edge objects

  private createChildren(edge: Edge) {
    const slot = edge.slot;

    const children = slot instanceof Slot ? slot.getChildren() : [];

    const edges = children.map(
      (child) => new Edge(child, edge, edge.depth + 1)
    );

    edge.children = edges;
  }

  private renderChildren(edge: Edge, currentEdge: Edge | null, target: Target) {
    // create the children first

    this.createChildren(edge);

    // children will be an array of Edge objects

    const children = edge.children;

    const currentChildren = currentEdge?.children ?? [];

    // unmount loop

    for (let i = 0; i < currentChildren.length; i++) {
      const currentChild = currentChildren[i];

      let child: Edge | null = null;

      const currentSlot = currentChild.slot;

      // set child as equal child (based on type and key)

      if (currentSlot instanceof Slot && currentSlot.getKey() !== null) {
        for (const tmpChild of children) {
          if (this.isEqual(currentChild, tmpChild)) {
            child = tmpChild;

            break;
          }
        }
      }

      // if child is null, set child as same index child (only if they're equal)

      if (child === null && i < children.length) {
        const tmpChild = children[i];

        if (this.isEqual(currentChild, tmpChild)) {
          child = tmpChild;
        }
      }

      // if no equal child has been found, unmount currentChild

      if (child === null) {
        this.unmountEdge(currentChild, target);
      }
    }

    // render loop

    for (let i = 0; i < children.length; i++) {
      const child = children[i];

      let currentChild: Edge | null = null;

      const slot = child.slot;

      // set currentChild as equal current child (based on type and key)

      if (slot instanceof Slot && slot.getKey() !== null) {
        for (const tmpChild of currentChildren) {
          if (this.isEqual(child, tmpChild)) {
            currentChild = tmpChild;

            break;
          }
        }
      }

      // if currentChild is null, set currentChild as same index current child (only if they're equal)

      if (currentChild === null && i < currentChildren.length) {
        const tmpChild = currentChildren[i];

        if (this.isEqual(child, tmpChild)) {
          currentChild = tmpChild;
        }
      }

      /*
      
      render child

      currentChild will have the references to the current sub-tree

      */

      this.renderEdge(child, currentChild, target);
    }
  }

  private renderEdge(edge: Edge, currentEdge: Edge | null, target: Target) {
    const slot = edge.slot;

    // in case there's an error, edge keeps children from currentEdge

    if (currentEdge !== null) {
      edge.children = currentEdge.children;
    }

    /*

    check type of slot and call the right render method

    null, undefined and false values are ignored

    */

    try {
      if (slot instanceof Slot) {
        if (slot.isComponent()) {
          this.renderComponent(edge, currentEdge, target);
        } else if (slot.isFunction()) {
          this.renderFunction(edge, currentEdge, target);
        } else if (slot.isElement()) {
          this.renderElement(edge, currentEdge, target);
        } else if (slot.isNull()) {
          this.renderNull(edge, currentEdge, target);
        }
      } else if (slot !== null && slot !== undefined && slot !== false) {
        this.renderText(edge, currentEdge, target);
      }
    } catch (error) {
      queueMicrotask(() => {
        throw error;
      });
    }
  }

  private renderComponent(
    edge: Edge,
    currentEdge: Edge | null,
    target: Target
  ) {
    // get slot and currentSlot

    const slot: Slot = edge.slot;

    const currentSlot: Slot | null = currentEdge?.slot ?? null;

    // get type and props

    const contentType = slot.getContentType();
    const props = slot.getProps();

    // get current component (if any)

    let component = currentEdge?.component ?? null;

    // create the new component or update the current one

    if (component === null) {
      const ComponentClass: ClassComponent = contentType as any;

      component = new ComponentClass(props);
    } else {
      component.updateProps(props);
    }

    // update edge with the new component or the current one

    edge.component = component;

    // unqueue edge

    this.unqueue(edge);

    // update ref and currentRef if necessary

    const ref = slot.getRef();

    const currentRef = currentSlot?.getRef() ?? null;

    if (currentRef instanceof Ref && currentRef !== ref) {
      currentRef.current = null;
    }

    if (ref instanceof Ref && ref !== currentRef) {
      ref.current = component;
    }

    // now it's safe to get component's new content

    const children = component.render();

    /*

    store the content inside slot

    the renderChildren() method will then call createChildren(),
    which will convert all the child slots to Edge objects

    for updated components, currentEdge will be a clone of edge,
    meaning slot will be equal to currentEdge.slot,
    but this shouldn't be a problem because first we call slot.setChildren
    which will update slot with the new child slots
    and then we call renderChildren which will call createChildren
    meaning every child edge will be brand new,
    all of this while currentEdge keeps the current sub-tree

    */

    slot.setChildren(children);

    this.renderChildren(edge, currentEdge, target);

    /*
    
    because of this final line, deeper components will trigger render first

    the handler passed to triggerRender will be used
    when there's a "rerender" event fired in the component

    */

    component.triggerRender(() => {
      this.queue(edge, target);
    });
  }

  private renderFunction(edge: Edge, currentEdge: Edge | null, target: Target) {
    const slot: Slot = edge.slot;

    const contentType = slot.getContentType();
    const props = slot.getProps();

    const ComponentFunction: FunctionComponent = contentType as any;

    const children = ComponentFunction(props);

    /*
      
    same as with the renderComponent, we call slot.setChildren() and then renderChildren()
    while keeping the current sub-tree inside currentEdge
      
    */

    slot.setChildren(children);

    this.renderChildren(edge, currentEdge, target);
  }

  private renderElement(edge: Edge, currentEdge: Edge | null, target: Target) {
    // node will be an element node

    let node = currentEdge?.node ?? null;

    if (node === null) {
      node = this.createNode(edge);
    }

    edge.node = node;

    this.patchNode(edge, currentEdge);

    /*
    
    tmpTarget is needed to insert child DOM nodes inside node

    no need to find a targetIndex,
    we want target to start from 0 for the next renderChildren,
    every time target.insert() is called
    it increments the target.index internally

    */

    const tmpTarget = new Target(node as Element);

    this.renderChildren(edge, currentEdge, tmpTarget);

    /*
    
    browsers usually optimize reflows but we call insert after renderChildren
    to keep good practices and reduce reflows if possible

    */

    target.insert(node);
  }

  private renderText(edge: Edge, currentEdge: Edge | null, target: Target) {
    // node will be a text node

    let node = currentEdge?.node ?? null;

    if (node === null) {
      node = this.createNode(edge);
    }

    edge.node = node;

    this.patchNode(edge, currentEdge);

    target.insert(node);

    // text nodes are leafs, so no need for renderChildren()
  }

  private renderNull(edge: Edge, currentEdge: Edge | null, target: Target) {
    // if slot type is null, we do nothing but loop through its children

    this.renderChildren(edge, currentEdge, target);
  }

  private createNode(edge: Edge): Node {
    // according to the slot type, create an element node or a text node

    const slot = edge.slot;

    if (slot instanceof Slot) {
      const contentType = slot.getContentType();

      const tagName: string = contentType as any;

      return document.createElement(tagName);
    } else {
      return document.createTextNode("");
    }
  }

  private patchNode(edge: Edge, currentEdge: Edge | null) {
    const slot = edge.slot;
    const node = edge.node!;

    const currentSlot = currentEdge?.slot ?? null;

    if (slot instanceof Slot) {
      // node is an element node

      const element = node as Element;

      const attributes = slot.getAttributes() ?? {};

      const currentAttributes =
        (currentSlot as Slot | null)?.getAttributes() ?? {};

      // loop through attributes

      for (const key in attributes) {
        const { [key]: value = null } = attributes;

        const { [key]: currentValue = null } =
          key in currentAttributes ? currentAttributes : {};

        switch (key) {
          case "key": {
            break;
          }

          case "ref": {
            const ref = value;
            const currentRef = currentValue;

            // update ref and currentRef

            if (currentRef instanceof Ref && currentRef !== ref) {
              currentRef.current = null;
            }

            if (ref instanceof Ref && ref !== currentRef) {
              ref.current = element;
            }

            break;
          }

          default: {
            const isValueHandler = typeof value === "function";
            const isCurrentValueHandler = typeof currentValue === "function";

            if (value !== null) {
              // we have an attribute

              if (isValueHandler) {
                // set the element's handler

                if (currentValue !== null && !isCurrentValueHandler) {
                  element.removeAttribute(key);
                }

                if (value !== currentValue) {
                  const handler = value;

                  element[key] = (...args: any[]) => {
                    return handler(...args, element);
                  };
                }
              } else {
                // set the element's attribute

                if (currentValue !== null && isCurrentValueHandler) {
                  element[key] = null;
                }

                if (value !== currentValue) {
                  try {
                    element.setAttribute(key, value);
                  } catch (error) {
                    queueMicrotask(() => {
                      throw error;
                    });
                  }
                }
              }
            } else {
              // value is null

              if (currentValue !== null) {
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

      // loop through currentAttributes

      for (const key in currentAttributes) {
        // ignore if key not found in attributes

        const found = key in attributes;

        if (found) {
          continue;
        }

        const currentValue = currentAttributes[key];

        switch (key) {
          case "ref": {
            // update currentRef

            const currentRef = currentValue;

            if (currentRef instanceof Ref) {
              currentRef.current = null;
            }
          }

          default: {
            // delete element's handler or attribute

            const isCurrentValueHandler = typeof currentValue === "function";

            if (isCurrentValueHandler) {
              element[key] = null;
            } else {
              element.removeAttribute(key);
            }
          }
        }
      }
    } else {
      // node is a text node

      const text = node as Text;

      const value = `${slot}`;

      const currentValue = currentSlot !== null ? `${currentSlot}` : null;

      if (value !== currentValue) {
        text.nodeValue = value;
      }
    }
  }

  /*

  this method will search for the targetNode inside the edge's previous siblings
  then it will return the right target index used to create a new Target

  if the targetNode is not found in the siblings,
  it will search in the parent siblings, creating a recursion
  
  this means it will start with edge but the cursor will be moved up the tree
  until a value is returned

  it returns 0 in specific cases

  --

  # tree 1:

  Tree.node x

  edge A {
    parent null
    node null
    children {
      edge AA {
        parent A
        node null
        children {
          edge AAA {
            parent AA
            node y
            children {}
          }
        }
      }
      edge AB {
        parent A
        node null
        children {
          edge ABA {
            parent AB
            node z
            children {}
          }
        }
      }
      edge AC {
        parent A
        node null
        children {
          edge ACA {
            parent AC
            node t
            children {}
          }
        }
      }
    }
  }

  findTargetIndex(A, x) => 0 (from parent === null, without recursion)
  findTargetIndex(AA, x) => 0 (from parent === null, with recursion)
  findTargetIndex(AB, x) => 1 (from findNodeIndex, found in 0)
  findTargetIndex(AC, x) => 2 (from findNodeIndex, found in 1)

  --

  # tree 2:

  Tree.node x

  edge A {
    parent null
    node null
    children {
      edge AA {
        parent A
        node y
        children {
          edge AAA {
            parent AA
            node null
            children {
              edge AAAA {
                parent AAA
                node z
                children {}
              }
            }
          }
          edge AAB {
            parent AA
            node null
            children {
              edge AAABA {
                parent AAB
                node t
                children {}
              }
            }
          }
          edge AAC {
            parent AA
            node null
            children {
              edge AAACA {
                parent AAC
                node u
                children {}
              }
            }
          }
        }
      }
    }
  }

  findTargetIndex(AAA, y) => 0 (from node === targetNode)
  findTargetIndex(AAB, y) => 1 (from findNodeIndex, found in 0)
  findTargetIndex(AAC, y) => 2 (from findNodeIndex, found in 1)

  */

  private findTargetIndex(edge: Edge, targetNode: Node): number {
    /*
    
    we work with the parent because we need to loop through the edge's previous siblings

    parent's children = edge siblings

    */

    const parent = edge.parent;

    // no parent means edge is the initial this.edge, fall back to 0

    if (parent === null) {
      return 0;
    }

    const node = parent.node;
    const children = parent.children;

    const index = children.indexOf(edge);

    // loop children from index - 1 to 0

    for (let i = index - 1; i >= 0; i--) {
      const child = children[i];

      const j = this.findNodeIndex(child, targetNode);

      if (j !== null) {
        // j + 1 is needed so we return the index where the Target object needs to start from

        return j + 1;
      }
    }

    /*
    
    targetNode hasn't been found among the edge's previous siblings,
    it's time to start looking in the parent's previous siblings
    
    but first we check for a specific case:
    if node (the parent's node) is the same as targetNode,
    it means parent is the targetNode's edge itself,
    so we can end the recursion and fall back to 0

    */

    if (node === targetNode) {
      return 0;
    }

    // it calls itself again (recursion), but this time with parent instead of edge

    return this.findTargetIndex(parent, targetNode);
  }

  /*

  this method will find the last node in the edge sub-tree
  and return its index in targetNode.childNodes

  if no node is found in the sub-tree, it returns null

  it uses recursion under the hood
  
  we create a loop between the edge's children from last to first
  and we execute findNodeIndex() to every child

  if edge's node is not null, it means we have found the edge we need,
  we return the index of the edge's node as a child of targetNode,
  this will end the entire loop
  
  otherwise we keep the loop going deeper and deeper, from last to first every time,
  until we find an edge that has a node
  
  again, if we don't find any node in the sub-tree, null is returned

  if the very first edge passed has a node, we won't even enter the loop
  it will return the index right away

  --

  # tree:

  Tree.node x

  edge A {
    node null
    children {
      edge AA {
        node null
        children {
          edge AAA {
            node y
            children {}
          }
        }
      }
      edge AB {
        node null
        children {
          edge ABA {
            node z
            children {}
          }
          edge ABB {
            node null
            children {
              edge ABBA {
                node t
                children {}
              }
            }
          }
        }
      }
      edge AC {
        node null
        children {
          edge ACA {
            node null
            children {}
          }
        }
      }
    }
  }

  findNodeIndex(AA, x) -> 0 (found in AAA)
  findNodeIndex(AB, x) -> 2 (found in ABBA)
  findNodeIndex(AC, x) -> null

  */

  private findNodeIndex(edge: Edge, targetNode: Node): number | null {
    const node = edge.node;
    const children = edge.children;

    /*
    
    if node found, get the index
    that will implicitly end the recursion with an actual value

    */

    if (node !== null) {
      return [...targetNode.childNodes].indexOf(node as ChildNode);
    }

    // loop children from last to first

    for (let i = children.length - 1; i >= 0; i--) {
      const child = children[i];

      // apply recursion

      const index = this.findNodeIndex(child, targetNode);

      // as soon as we find an index, the recursion is ended

      if (index !== null) {
        return index;
      }
    }

    // no node has been found in the sub-tree

    return null;
  }

  private unmountEdge(edge: Edge, target: Target | null) {
    const slot = edge.slot;
    const node = edge.node;
    const component = edge.component;
    const children = edge.children;

    let tmpTarget: Target | null = target;

    /*
    
    remove node, if any
    
    tmpTarget will then be set to null and will be passed to children's unmountEdge
    so only the first node in a sub-tree will call remove
    because once a node is removed, all of its children are removed

    */

    if (node !== null && target !== null) {
      target.remove(node);

      tmpTarget = null;
    }

    // update ref

    const ref = slot instanceof Slot ? slot.getRef() : null;

    if (ref instanceof Ref) {
      ref.current = null;
    }

    // unmount children

    for (const child of children) {
      this.unmountEdge(child, tmpTarget);
    }

    /*
    
    unmount component, if any

    this is called at the very end of the method
    to keep consistency with renderComponent

    deeper components will fire the 'unmount' event first

    */

    if (component !== null) {
      this.unqueue(edge);

      component.triggerUnmount();
    }
  }

  private isEqual(edge: Edge, currentEdge: Edge) {
    const slot = edge.slot;
    const currentSlot = currentEdge.slot;

    //  check slots based on type and key

    if (slot instanceof Slot) {
      if (!(currentSlot instanceof Slot)) {
        return false;
      }

      const contentType = slot.getContentType();
      const key = slot.getKey();

      const currentContentType = currentSlot.getContentType();
      const currentKey = currentSlot.getKey();

      return contentType === currentContentType && key === currentKey;
    }

    // null, undefined and false are special cases since they will be ignored by renderEdge

    if (slot === null || slot === undefined || slot === false) {
      return (
        currentSlot === null ||
        currentSlot === undefined ||
        currentSlot === false
      );
    }

    // check if both slots are texts

    return (
      currentSlot !== null &&
      currentSlot !== undefined &&
      currentSlot !== false &&
      !(currentSlot instanceof Slot)
    );
  }
}
