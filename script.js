// solid/solid.js
var setHydrateContext = function(context) {
  sharedConfig.context = context;
};
var nextHydrateContext = function() {
  return {
    ...sharedConfig.context,
    id: `${sharedConfig.context.id}${sharedConfig.context.count++}-`,
    count: 0
  };
};
var createRoot = function(fn, detachedOwner) {
  const listener = Listener, owner = Owner, unowned = fn.length === 0, current = detachedOwner === undefined ? owner : detachedOwner, root = unowned ? UNOWNED : {
    owned: null,
    cleanups: null,
    context: current ? current.context : null,
    owner: current
  }, updateFn = unowned ? fn : () => fn(() => untrack(() => cleanNode(root)));
  Owner = root;
  Listener = null;
  try {
    return runUpdates(updateFn, true);
  } finally {
    Listener = listener;
    Owner = owner;
  }
};
var createSignal = function(value, options) {
  options = options ? Object.assign({}, signalOptions, options) : signalOptions;
  const s = {
    value,
    observers: null,
    observerSlots: null,
    comparator: options.equals || undefined
  };
  const setter = (value2) => {
    if (typeof value2 === "function") {
      if (Transition && Transition.running && Transition.sources.has(s))
        value2 = value2(s.tValue);
      else
        value2 = value2(s.value);
    }
    return writeSignal(s, value2);
  };
  return [readSignal.bind(s), setter];
};
var createRenderEffect = function(fn, value, options) {
  const c = createComputation(fn, value, false, STALE);
  if (Scheduler && Transition && Transition.running)
    Updates.push(c);
  else
    updateComputation(c);
};
var createEffect = function(fn, value, options) {
  runEffects = runUserEffects;
  const c = createComputation(fn, value, false, STALE), s = SuspenseContext && useContext(SuspenseContext);
  if (s)
    c.suspense = s;
  if (!options || !options.render)
    c.user = true;
  Effects ? Effects.push(c) : updateComputation(c);
};
var createMemo = function(fn, value, options) {
  options = options ? Object.assign({}, signalOptions, options) : signalOptions;
  const c = createComputation(fn, value, true, 0);
  c.observers = null;
  c.observerSlots = null;
  c.comparator = options.equals || undefined;
  if (Scheduler && Transition && Transition.running) {
    c.tState = STALE;
    Updates.push(c);
  } else
    updateComputation(c);
  return readSignal.bind(c);
};
var untrack = function(fn) {
  if (Listener === null)
    return fn();
  const listener = Listener;
  Listener = null;
  try {
    return fn();
  } finally {
    Listener = listener;
  }
};
var onMount = function(fn) {
  createEffect(() => untrack(fn));
};
var onCleanup = function(fn) {
  if (Owner === null)
    ;
  else if (Owner.cleanups === null)
    Owner.cleanups = [fn];
  else
    Owner.cleanups.push(fn);
  return fn;
};
var startTransition = function(fn) {
  if (Transition && Transition.running) {
    fn();
    return Transition.done;
  }
  const l = Listener;
  const o = Owner;
  return Promise.resolve().then(() => {
    Listener = l;
    Owner = o;
    let t;
    if (Scheduler || SuspenseContext) {
      t = Transition || (Transition = {
        sources: new Set,
        effects: [],
        promises: new Set,
        disposed: new Set,
        queue: new Set,
        running: true
      });
      t.done || (t.done = new Promise((res) => t.resolve = res));
      t.running = true;
    }
    runUpdates(fn, false);
    Listener = Owner = null;
    return t ? t.done : undefined;
  });
};
var createContext = function(defaultValue, options) {
  const id = Symbol("context");
  return {
    id,
    Provider: createProvider(id),
    defaultValue
  };
};
var useContext = function(context) {
  return Owner && Owner.context && Owner.context[context.id] !== undefined ? Owner.context[context.id] : context.defaultValue;
};
var children = function(fn) {
  const children2 = createMemo(fn);
  const memo = createMemo(() => resolveChildren(children2()));
  memo.toArray = () => {
    const c = memo();
    return Array.isArray(c) ? c : c != null ? [c] : [];
  };
  return memo;
};
var readSignal = function() {
  const runningTransition = Transition && Transition.running;
  if (this.sources && (runningTransition ? this.tState : this.state)) {
    if ((runningTransition ? this.tState : this.state) === STALE)
      updateComputation(this);
    else {
      const updates = Updates;
      Updates = null;
      runUpdates(() => lookUpstream(this), false);
      Updates = updates;
    }
  }
  if (Listener) {
    const sSlot = this.observers ? this.observers.length : 0;
    if (!Listener.sources) {
      Listener.sources = [this];
      Listener.sourceSlots = [sSlot];
    } else {
      Listener.sources.push(this);
      Listener.sourceSlots.push(sSlot);
    }
    if (!this.observers) {
      this.observers = [Listener];
      this.observerSlots = [Listener.sources.length - 1];
    } else {
      this.observers.push(Listener);
      this.observerSlots.push(Listener.sources.length - 1);
    }
  }
  if (runningTransition && Transition.sources.has(this))
    return this.tValue;
  return this.value;
};
var writeSignal = function(node, value, isComp) {
  let current = Transition && Transition.running && Transition.sources.has(node) ? node.tValue : node.value;
  if (!node.comparator || !node.comparator(current, value)) {
    if (Transition) {
      const TransitionRunning = Transition.running;
      if (TransitionRunning || !isComp && Transition.sources.has(node)) {
        Transition.sources.add(node);
        node.tValue = value;
      }
      if (!TransitionRunning)
        node.value = value;
    } else
      node.value = value;
    if (node.observers && node.observers.length) {
      runUpdates(() => {
        for (let i = 0;i < node.observers.length; i += 1) {
          const o = node.observers[i];
          const TransitionRunning = Transition && Transition.running;
          if (TransitionRunning && Transition.disposed.has(o))
            continue;
          if (TransitionRunning ? !o.tState : !o.state) {
            if (o.pure)
              Updates.push(o);
            else
              Effects.push(o);
            if (o.observers)
              markDownstream(o);
          }
          if (!TransitionRunning)
            o.state = STALE;
          else
            o.tState = STALE;
        }
        if (Updates.length > 1e6) {
          Updates = [];
          if (false)
            ;
          throw new Error;
        }
      }, false);
    }
  }
  return value;
};
var updateComputation = function(node) {
  if (!node.fn)
    return;
  cleanNode(node);
  const owner = Owner, listener = Listener, time = ExecCount;
  Listener = Owner = node;
  runComputation(node, Transition && Transition.running && Transition.sources.has(node) ? node.tValue : node.value, time);
  if (Transition && !Transition.running && Transition.sources.has(node)) {
    queueMicrotask(() => {
      runUpdates(() => {
        Transition && (Transition.running = true);
        Listener = Owner = node;
        runComputation(node, node.tValue, time);
        Listener = Owner = null;
      }, false);
    });
  }
  Listener = listener;
  Owner = owner;
};
var runComputation = function(node, value, time) {
  let nextValue;
  try {
    nextValue = node.fn(value);
  } catch (err) {
    if (node.pure) {
      if (Transition && Transition.running) {
        node.tState = STALE;
        node.tOwned && node.tOwned.forEach(cleanNode);
        node.tOwned = undefined;
      } else {
        node.state = STALE;
        node.owned && node.owned.forEach(cleanNode);
        node.owned = null;
      }
    }
    node.updatedAt = time + 1;
    return handleError(err);
  }
  if (!node.updatedAt || node.updatedAt <= time) {
    if (node.updatedAt != null && ("observers" in node)) {
      writeSignal(node, nextValue, true);
    } else if (Transition && Transition.running && node.pure) {
      Transition.sources.add(node);
      node.tValue = nextValue;
    } else
      node.value = nextValue;
    node.updatedAt = time;
  }
};
var createComputation = function(fn, init, pure, state = STALE, options) {
  const c = {
    fn,
    state,
    updatedAt: null,
    owned: null,
    sources: null,
    sourceSlots: null,
    cleanups: null,
    value: init,
    owner: Owner,
    context: Owner ? Owner.context : null,
    pure
  };
  if (Transition && Transition.running) {
    c.state = 0;
    c.tState = state;
  }
  if (Owner === null)
    ;
  else if (Owner !== UNOWNED) {
    if (Transition && Transition.running && Owner.pure) {
      if (!Owner.tOwned)
        Owner.tOwned = [c];
      else
        Owner.tOwned.push(c);
    } else {
      if (!Owner.owned)
        Owner.owned = [c];
      else
        Owner.owned.push(c);
    }
  }
  if (ExternalSourceFactory) {
    const [track, trigger] = createSignal(undefined, {
      equals: false
    });
    const ordinary = ExternalSourceFactory(c.fn, trigger);
    onCleanup(() => ordinary.dispose());
    const triggerInTransition = () => startTransition(trigger).then(() => inTransition.dispose());
    const inTransition = ExternalSourceFactory(c.fn, triggerInTransition);
    c.fn = (x) => {
      track();
      return Transition && Transition.running ? inTransition.track(x) : ordinary.track(x);
    };
  }
  return c;
};
var runTop = function(node) {
  const runningTransition = Transition && Transition.running;
  if ((runningTransition ? node.tState : node.state) === 0)
    return;
  if ((runningTransition ? node.tState : node.state) === PENDING)
    return lookUpstream(node);
  if (node.suspense && untrack(node.suspense.inFallback))
    return node.suspense.effects.push(node);
  const ancestors = [node];
  while ((node = node.owner) && (!node.updatedAt || node.updatedAt < ExecCount)) {
    if (runningTransition && Transition.disposed.has(node))
      return;
    if (runningTransition ? node.tState : node.state)
      ancestors.push(node);
  }
  for (let i = ancestors.length - 1;i >= 0; i--) {
    node = ancestors[i];
    if (runningTransition) {
      let top = node, prev = ancestors[i + 1];
      while ((top = top.owner) && top !== prev) {
        if (Transition.disposed.has(top))
          return;
      }
    }
    if ((runningTransition ? node.tState : node.state) === STALE) {
      updateComputation(node);
    } else if ((runningTransition ? node.tState : node.state) === PENDING) {
      const updates = Updates;
      Updates = null;
      runUpdates(() => lookUpstream(node, ancestors[0]), false);
      Updates = updates;
    }
  }
};
var runUpdates = function(fn, init) {
  if (Updates)
    return fn();
  let wait = false;
  if (!init)
    Updates = [];
  if (Effects)
    wait = true;
  else
    Effects = [];
  ExecCount++;
  try {
    const res = fn();
    completeUpdates(wait);
    return res;
  } catch (err) {
    if (!wait)
      Effects = null;
    Updates = null;
    handleError(err);
  }
};
var completeUpdates = function(wait) {
  if (Updates) {
    if (Scheduler && Transition && Transition.running)
      scheduleQueue(Updates);
    else
      runQueue(Updates);
    Updates = null;
  }
  if (wait)
    return;
  let res;
  if (Transition) {
    if (!Transition.promises.size && !Transition.queue.size) {
      const sources = Transition.sources;
      const disposed = Transition.disposed;
      Effects.push.apply(Effects, Transition.effects);
      res = Transition.resolve;
      for (const e2 of Effects) {
        ("tState" in e2) && (e2.state = e2.tState);
        delete e2.tState;
      }
      Transition = null;
      runUpdates(() => {
        for (const d of disposed)
          cleanNode(d);
        for (const v of sources) {
          v.value = v.tValue;
          if (v.owned) {
            for (let i = 0, len = v.owned.length;i < len; i++)
              cleanNode(v.owned[i]);
          }
          if (v.tOwned)
            v.owned = v.tOwned;
          delete v.tValue;
          delete v.tOwned;
          v.tState = 0;
        }
        setTransPending(false);
      }, false);
    } else if (Transition.running) {
      Transition.running = false;
      Transition.effects.push.apply(Transition.effects, Effects);
      Effects = null;
      setTransPending(true);
      return;
    }
  }
  const e = Effects;
  Effects = null;
  if (e.length)
    runUpdates(() => runEffects(e), false);
  if (res)
    res();
};
var runQueue = function(queue) {
  for (let i = 0;i < queue.length; i++)
    runTop(queue[i]);
};
var scheduleQueue = function(queue) {
  for (let i = 0;i < queue.length; i++) {
    const item = queue[i];
    const tasks = Transition.queue;
    if (!tasks.has(item)) {
      tasks.add(item);
      Scheduler(() => {
        tasks.delete(item);
        runUpdates(() => {
          Transition.running = true;
          runTop(item);
        }, false);
        Transition && (Transition.running = false);
      });
    }
  }
};
var runUserEffects = function(queue) {
  let i, userLength = 0;
  for (i = 0;i < queue.length; i++) {
    const e = queue[i];
    if (!e.user)
      runTop(e);
    else
      queue[userLength++] = e;
  }
  if (sharedConfig.context) {
    if (sharedConfig.count) {
      sharedConfig.effects || (sharedConfig.effects = []);
      sharedConfig.effects.push(...queue.slice(0, userLength));
      return;
    } else if (sharedConfig.effects) {
      queue = [...sharedConfig.effects, ...queue];
      userLength += sharedConfig.effects.length;
      delete sharedConfig.effects;
    }
    setHydrateContext();
  }
  for (i = 0;i < userLength; i++)
    runTop(queue[i]);
};
var lookUpstream = function(node, ignore) {
  const runningTransition = Transition && Transition.running;
  if (runningTransition)
    node.tState = 0;
  else
    node.state = 0;
  for (let i = 0;i < node.sources.length; i += 1) {
    const source = node.sources[i];
    if (source.sources) {
      const state = runningTransition ? source.tState : source.state;
      if (state === STALE) {
        if (source !== ignore && (!source.updatedAt || source.updatedAt < ExecCount))
          runTop(source);
      } else if (state === PENDING)
        lookUpstream(source, ignore);
    }
  }
};
var markDownstream = function(node) {
  const runningTransition = Transition && Transition.running;
  for (let i = 0;i < node.observers.length; i += 1) {
    const o = node.observers[i];
    if (runningTransition ? !o.tState : !o.state) {
      if (runningTransition)
        o.tState = PENDING;
      else
        o.state = PENDING;
      if (o.pure)
        Updates.push(o);
      else
        Effects.push(o);
      o.observers && markDownstream(o);
    }
  }
};
var cleanNode = function(node) {
  let i;
  if (node.sources) {
    while (node.sources.length) {
      const source = node.sources.pop(), index = node.sourceSlots.pop(), obs = source.observers;
      if (obs && obs.length) {
        const n = obs.pop(), s = source.observerSlots.pop();
        if (index < obs.length) {
          n.sourceSlots[s] = index;
          obs[index] = n;
          source.observerSlots[index] = s;
        }
      }
    }
  }
  if (Transition && Transition.running && node.pure) {
    if (node.tOwned) {
      for (i = node.tOwned.length - 1;i >= 0; i--)
        cleanNode(node.tOwned[i]);
      delete node.tOwned;
    }
    reset(node, true);
  } else if (node.owned) {
    for (i = node.owned.length - 1;i >= 0; i--)
      cleanNode(node.owned[i]);
    node.owned = null;
  }
  if (node.cleanups) {
    for (i = node.cleanups.length - 1;i >= 0; i--)
      node.cleanups[i]();
    node.cleanups = null;
  }
  if (Transition && Transition.running)
    node.tState = 0;
  else
    node.state = 0;
};
var reset = function(node, top) {
  if (!top) {
    node.tState = 0;
    Transition.disposed.add(node);
  }
  if (node.owned) {
    for (let i = 0;i < node.owned.length; i++)
      reset(node.owned[i]);
  }
};
var castError = function(err) {
  if (err instanceof Error)
    return err;
  return new Error(typeof err === "string" ? err : "Unknown error", {
    cause: err
  });
};
var runErrors = function(err, fns, owner) {
  try {
    for (const f of fns)
      f(err);
  } catch (e) {
    handleError(e, owner && owner.owner || null);
  }
};
var handleError = function(err, owner = Owner) {
  const fns = ERROR && owner && owner.context && owner.context[ERROR];
  const error = castError(err);
  if (!fns)
    throw error;
  if (Effects)
    Effects.push({
      fn() {
        runErrors(error, fns, owner);
      },
      state: STALE
    });
  else
    runErrors(error, fns, owner);
};
var resolveChildren = function(children2) {
  if (typeof children2 === "function" && !children2.length)
    return resolveChildren(children2());
  if (Array.isArray(children2)) {
    const results = [];
    for (let i = 0;i < children2.length; i++) {
      const result = resolveChildren(children2[i]);
      Array.isArray(result) ? results.push.apply(results, result) : results.push(result);
    }
    return results;
  }
  return children2;
};
var createProvider = function(id, options) {
  return function provider(props) {
    let res;
    createRenderEffect(() => res = untrack(() => {
      Owner.context = {
        ...Owner.context,
        [id]: props.value
      };
      return children(() => props.children);
    }), undefined);
    return res;
  };
};
var dispose = function(d) {
  for (let i = 0;i < d.length; i++)
    d[i]();
};
var mapArray = function(list, mapFn, options = {}) {
  let items = [], mapped = [], disposers = [], len = 0, indexes = mapFn.length > 1 ? [] : null;
  onCleanup(() => dispose(disposers));
  return () => {
    let newItems = list() || [], i, j;
    newItems[$TRACK];
    return untrack(() => {
      let newLen = newItems.length, newIndices, newIndicesNext, temp, tempdisposers, tempIndexes, start, end, newEnd, item;
      if (newLen === 0) {
        if (len !== 0) {
          dispose(disposers);
          disposers = [];
          items = [];
          mapped = [];
          len = 0;
          indexes && (indexes = []);
        }
        if (options.fallback) {
          items = [FALLBACK];
          mapped[0] = createRoot((disposer) => {
            disposers[0] = disposer;
            return options.fallback();
          });
          len = 1;
        }
      } else if (len === 0) {
        mapped = new Array(newLen);
        for (j = 0;j < newLen; j++) {
          items[j] = newItems[j];
          mapped[j] = createRoot(mapper);
        }
        len = newLen;
      } else {
        temp = new Array(newLen);
        tempdisposers = new Array(newLen);
        indexes && (tempIndexes = new Array(newLen));
        for (start = 0, end = Math.min(len, newLen);start < end && items[start] === newItems[start]; start++)
          ;
        for (end = len - 1, newEnd = newLen - 1;end >= start && newEnd >= start && items[end] === newItems[newEnd]; end--, newEnd--) {
          temp[newEnd] = mapped[end];
          tempdisposers[newEnd] = disposers[end];
          indexes && (tempIndexes[newEnd] = indexes[end]);
        }
        newIndices = new Map;
        newIndicesNext = new Array(newEnd + 1);
        for (j = newEnd;j >= start; j--) {
          item = newItems[j];
          i = newIndices.get(item);
          newIndicesNext[j] = i === undefined ? -1 : i;
          newIndices.set(item, j);
        }
        for (i = start;i <= end; i++) {
          item = items[i];
          j = newIndices.get(item);
          if (j !== undefined && j !== -1) {
            temp[j] = mapped[i];
            tempdisposers[j] = disposers[i];
            indexes && (tempIndexes[j] = indexes[i]);
            j = newIndicesNext[j];
            newIndices.set(item, j);
          } else
            disposers[i]();
        }
        for (j = start;j < newLen; j++) {
          if (j in temp) {
            mapped[j] = temp[j];
            disposers[j] = tempdisposers[j];
            if (indexes) {
              indexes[j] = tempIndexes[j];
              indexes[j](j);
            }
          } else
            mapped[j] = createRoot(mapper);
        }
        mapped = mapped.slice(0, len = newLen);
        items = newItems.slice(0);
      }
      return mapped;
    });
    function mapper(disposer) {
      disposers[j] = disposer;
      if (indexes) {
        const [s, set] = createSignal(j);
        indexes[j] = set;
        return mapFn(newItems[j], s);
      }
      return mapFn(newItems[j]);
    }
  };
};
var createComponent = function(Comp, props) {
  if (hydrationEnabled) {
    if (sharedConfig.context) {
      const c = sharedConfig.context;
      setHydrateContext(nextHydrateContext());
      const r = untrack(() => Comp(props || {}));
      setHydrateContext(c);
      return r;
    }
  }
  return untrack(() => Comp(props || {}));
};
var For = function(props) {
  const fallback = ("fallback" in props) && {
    fallback: () => props.fallback
  };
  return createMemo(mapArray(() => props.each, props.children, fallback || undefined));
};
var sharedConfig = {
  context: undefined,
  registry: undefined
};
var equalFn = (a, b) => a === b;
var $PROXY = Symbol("solid-proxy");
var $TRACK = Symbol("solid-track");
var $DEVCOMP = Symbol("solid-dev-component");
var signalOptions = {
  equals: equalFn
};
var ERROR = null;
var runEffects = runQueue;
var STALE = 1;
var PENDING = 2;
var UNOWNED = {
  owned: null,
  cleanups: null,
  context: null,
  owner: null
};
var Owner = null;
var Transition = null;
var Scheduler = null;
var ExternalSourceFactory = null;
var Listener = null;
var Updates = null;
var Effects = null;
var ExecCount = 0;
var [transPending, setTransPending] = createSignal(false);
var SuspenseContext;
var FALLBACK = Symbol("fallback");
var hydrationEnabled = false;
var SuspenseListContext = createContext();

// solid/web/web.js
var getPropAlias = function(prop, tagName) {
  const a = PropAliases[prop];
  return typeof a === "object" ? a[tagName] ? a["$"] : undefined : a;
};
var reconcileArrays = function(parentNode, a, b) {
  let bLength = b.length, aEnd = a.length, bEnd = bLength, aStart = 0, bStart = 0, after = a[aEnd - 1].nextSibling, map = null;
  while (aStart < aEnd || bStart < bEnd) {
    if (a[aStart] === b[bStart]) {
      aStart++;
      bStart++;
      continue;
    }
    while (a[aEnd - 1] === b[bEnd - 1]) {
      aEnd--;
      bEnd--;
    }
    if (aEnd === aStart) {
      const node = bEnd < bLength ? bStart ? b[bStart - 1].nextSibling : b[bEnd - bStart] : after;
      while (bStart < bEnd)
        parentNode.insertBefore(b[bStart++], node);
    } else if (bEnd === bStart) {
      while (aStart < aEnd) {
        if (!map || !map.has(a[aStart]))
          a[aStart].remove();
        aStart++;
      }
    } else if (a[aStart] === b[bEnd - 1] && b[bStart] === a[aEnd - 1]) {
      const node = a[--aEnd].nextSibling;
      parentNode.insertBefore(b[bStart++], a[aStart++].nextSibling);
      parentNode.insertBefore(b[--bEnd], node);
      a[aEnd] = b[bEnd];
    } else {
      if (!map) {
        map = new Map;
        let i = bStart;
        while (i < bEnd)
          map.set(b[i], i++);
      }
      const index = map.get(a[aStart]);
      if (index != null) {
        if (bStart < index && index < bEnd) {
          let i = aStart, sequence = 1, t;
          while (++i < aEnd && i < bEnd) {
            if ((t = map.get(a[i])) == null || t !== index + sequence)
              break;
            sequence++;
          }
          if (sequence > index - bStart) {
            const node = a[aStart];
            while (bStart < index)
              parentNode.insertBefore(b[bStart++], node);
          } else
            parentNode.replaceChild(b[bStart++], a[aStart++]);
        } else
          aStart++;
      } else
        a[aStart++].remove();
    }
  }
};
var render = function(code, element, init, options = {}) {
  let disposer;
  createRoot((dispose2) => {
    disposer = dispose2;
    element === document ? code() : insert(element, code(), element.firstChild ? null : undefined, init);
  }, options.owner);
  return () => {
    disposer();
    element.textContent = "";
  };
};
var delegateEvents = function(eventNames, document2 = window.document) {
  const e = document2[$$EVENTS] || (document2[$$EVENTS] = new Set);
  for (let i = 0, l = eventNames.length;i < l; i++) {
    const name = eventNames[i];
    if (!e.has(name)) {
      e.add(name);
      document2.addEventListener(name, eventHandler);
    }
  }
};
var setAttribute = function(node, name, value) {
  if (value == null)
    node.removeAttribute(name);
  else
    node.setAttribute(name, value);
};
var setAttributeNS = function(node, namespace, name, value) {
  if (value == null)
    node.removeAttributeNS(namespace, name);
  else
    node.setAttributeNS(namespace, name, value);
};
var className = function(node, value) {
  if (value == null)
    node.removeAttribute("class");
  else
    node.className = value;
};
var addEventListener = function(node, name, handler, delegate) {
  if (delegate) {
    if (Array.isArray(handler)) {
      node[`\$\$${name}`] = handler[0];
      node[`\$\$${name}Data`] = handler[1];
    } else
      node[`\$\$${name}`] = handler;
  } else if (Array.isArray(handler)) {
    const handlerFn = handler[0];
    node.addEventListener(name, handler[0] = (e) => handlerFn.call(node, handler[1], e));
  } else
    node.addEventListener(name, handler);
};
var classList = function(node, value, prev = {}) {
  const classKeys = Object.keys(value || {}), prevKeys = Object.keys(prev);
  let i, len;
  for (i = 0, len = prevKeys.length;i < len; i++) {
    const key = prevKeys[i];
    if (!key || key === "undefined" || value[key])
      continue;
    toggleClassKey(node, key, false);
    delete prev[key];
  }
  for (i = 0, len = classKeys.length;i < len; i++) {
    const key = classKeys[i], classValue = !!value[key];
    if (!key || key === "undefined" || prev[key] === classValue || !classValue)
      continue;
    toggleClassKey(node, key, true);
    prev[key] = classValue;
  }
  return prev;
};
var style = function(node, value, prev) {
  if (!value)
    return prev ? setAttribute(node, "style") : value;
  const nodeStyle = node.style;
  if (typeof value === "string")
    return nodeStyle.cssText = value;
  typeof prev === "string" && (nodeStyle.cssText = prev = undefined);
  prev || (prev = {});
  value || (value = {});
  let v, s;
  for (s in prev) {
    value[s] == null && nodeStyle.removeProperty(s);
    delete prev[s];
  }
  for (s in value) {
    v = value[s];
    if (v !== prev[s]) {
      nodeStyle.setProperty(s, v);
      prev[s] = v;
    }
  }
  return prev;
};
var spread = function(node, props = {}, isSVG, skipChildren) {
  const prevProps = {};
  if (!skipChildren) {
    createRenderEffect(() => prevProps.children = insertExpression(node, props.children, prevProps.children));
  }
  createRenderEffect(() => props.ref && props.ref(node));
  createRenderEffect(() => assign(node, props, isSVG, true, prevProps, true));
  return prevProps;
};
var dynamicProperty = function(props, key) {
  const src = props[key];
  Object.defineProperty(props, key, {
    get() {
      return src();
    },
    enumerable: true
  });
  return props;
};
var insert = function(parent, accessor, marker, initial) {
  if (marker !== undefined && !initial)
    initial = [];
  if (typeof accessor !== "function")
    return insertExpression(parent, accessor, initial, marker);
  createRenderEffect((current) => insertExpression(parent, accessor(), current, marker), initial);
};
var assign = function(node, props, isSVG, skipChildren, prevProps = {}, skipRef = false) {
  props || (props = {});
  for (const prop in prevProps) {
    if (!(prop in props)) {
      if (prop === "children")
        continue;
      prevProps[prop] = assignProp(node, prop, null, prevProps[prop], isSVG, skipRef);
    }
  }
  for (const prop in props) {
    if (prop === "children") {
      if (!skipChildren)
        insertExpression(node, props.children);
      continue;
    }
    const value = props[prop];
    prevProps[prop] = assignProp(node, prop, value, prevProps[prop], isSVG, skipRef);
  }
};
var toPropertyName = function(name) {
  return name.toLowerCase().replace(/-([a-z])/g, (_, w) => w.toUpperCase());
};
var toggleClassKey = function(node, key, value) {
  const classNames = key.trim().split(/\s+/);
  for (let i = 0, nameLen = classNames.length;i < nameLen; i++)
    node.classList.toggle(classNames[i], value);
};
var assignProp = function(node, prop, value, prev, isSVG, skipRef) {
  let isCE, isProp, isChildProp, propAlias, forceProp;
  if (prop === "style")
    return style(node, value, prev);
  if (prop === "classList")
    return classList(node, value, prev);
  if (value === prev)
    return prev;
  if (prop === "ref") {
    if (!skipRef)
      value(node);
  } else if (prop.slice(0, 3) === "on:") {
    const e = prop.slice(3);
    prev && node.removeEventListener(e, prev);
    value && node.addEventListener(e, value);
  } else if (prop.slice(0, 10) === "oncapture:") {
    const e = prop.slice(10);
    prev && node.removeEventListener(e, prev, true);
    value && node.addEventListener(e, value, true);
  } else if (prop.slice(0, 2) === "on") {
    const name = prop.slice(2).toLowerCase();
    const delegate = DelegatedEvents.has(name);
    if (!delegate && prev) {
      const h = Array.isArray(prev) ? prev[0] : prev;
      node.removeEventListener(name, h);
    }
    if (delegate || value) {
      addEventListener(node, name, value, delegate);
      delegate && delegateEvents([name]);
    }
  } else if (prop.slice(0, 5) === "attr:") {
    setAttribute(node, prop.slice(5), value);
  } else if ((forceProp = prop.slice(0, 5) === "prop:") || (isChildProp = ChildProperties.has(prop)) || !isSVG && ((propAlias = getPropAlias(prop, node.tagName)) || (isProp = Properties.has(prop))) || (isCE = node.nodeName.includes("-"))) {
    if (forceProp) {
      prop = prop.slice(5);
      isProp = true;
    }
    if (prop === "class" || prop === "className")
      className(node, value);
    else if (isCE && !isProp && !isChildProp)
      node[toPropertyName(prop)] = value;
    else
      node[propAlias || prop] = value;
  } else {
    const ns = isSVG && prop.indexOf(":") > -1 && SVGNamespace[prop.split(":")[0]];
    if (ns)
      setAttributeNS(node, ns, prop, value);
    else
      setAttribute(node, Aliases[prop] || prop, value);
  }
  return value;
};
var eventHandler = function(e) {
  const key = `\$\$${e.type}`;
  let node = e.composedPath && e.composedPath()[0] || e.target;
  if (e.target !== node) {
    Object.defineProperty(e, "target", {
      configurable: true,
      value: node
    });
  }
  Object.defineProperty(e, "currentTarget", {
    configurable: true,
    get() {
      return node || document;
    }
  });
  if (sharedConfig.registry && !sharedConfig.done)
    sharedConfig.done = _$HY.done = true;
  while (node) {
    const handler = node[key];
    if (handler && !node.disabled) {
      const data = node[`${key}Data`];
      data !== undefined ? handler.call(node, data, e) : handler.call(node, e);
      if (e.cancelBubble)
        return;
    }
    node = node._$host || node.parentNode || node.host;
  }
};
var insertExpression = function(parent, value, current, marker, unwrapArray) {
  if (sharedConfig.context) {
    !current && (current = [...parent.childNodes]);
    let cleaned = [];
    for (let i = 0;i < current.length; i++) {
      const node = current[i];
      if (node.nodeType === 8 && node.data.slice(0, 2) === "!$")
        node.remove();
      else
        cleaned.push(node);
    }
    current = cleaned;
  }
  while (typeof current === "function")
    current = current();
  if (value === current)
    return current;
  const t = typeof value, multi = marker !== undefined;
  parent = multi && current[0] && current[0].parentNode || parent;
  if (t === "string" || t === "number") {
    if (sharedConfig.context)
      return current;
    if (t === "number")
      value = value.toString();
    if (multi) {
      let node = current[0];
      if (node && node.nodeType === 3) {
        node.data = value;
      } else
        node = document.createTextNode(value);
      current = cleanChildren(parent, current, marker, node);
    } else {
      if (current !== "" && typeof current === "string") {
        current = parent.firstChild.data = value;
      } else
        current = parent.textContent = value;
    }
  } else if (value == null || t === "boolean") {
    if (sharedConfig.context)
      return current;
    current = cleanChildren(parent, current, marker);
  } else if (t === "function") {
    createRenderEffect(() => {
      let v = value();
      while (typeof v === "function")
        v = v();
      current = insertExpression(parent, v, current, marker);
    });
    return () => current;
  } else if (Array.isArray(value)) {
    const array = [];
    const currentArray = current && Array.isArray(current);
    if (normalizeIncomingArray(array, value, current, unwrapArray)) {
      createRenderEffect(() => current = insertExpression(parent, array, current, marker, true));
      return () => current;
    }
    if (sharedConfig.context) {
      if (!array.length)
        return current;
      for (let i = 0;i < array.length; i++) {
        if (array[i].parentNode)
          return current = array;
      }
    }
    if (array.length === 0) {
      current = cleanChildren(parent, current, marker);
      if (multi)
        return current;
    } else if (currentArray) {
      if (current.length === 0) {
        appendNodes(parent, array, marker);
      } else
        reconcileArrays(parent, current, array);
    } else {
      current && cleanChildren(parent);
      appendNodes(parent, array);
    }
    current = array;
  } else if (value.nodeType) {
    if (sharedConfig.context && value.parentNode)
      return current = multi ? [value] : value;
    if (Array.isArray(current)) {
      if (multi)
        return current = cleanChildren(parent, current, marker, value);
      cleanChildren(parent, current, null, value);
    } else if (current == null || current === "" || !parent.firstChild) {
      parent.appendChild(value);
    } else
      parent.replaceChild(value, parent.firstChild);
    current = value;
  } else
    console.warn(`Unrecognized value. Skipped inserting`, value);
  return current;
};
var normalizeIncomingArray = function(normalized, array, current, unwrap) {
  let dynamic = false;
  for (let i = 0, len = array.length;i < len; i++) {
    let item = array[i], prev = current && current[i], t;
    if (item == null || item === true || item === false)
      ;
    else if ((t = typeof item) === "object" && item.nodeType) {
      normalized.push(item);
    } else if (Array.isArray(item)) {
      dynamic = normalizeIncomingArray(normalized, item, prev) || dynamic;
    } else if (t === "function") {
      if (unwrap) {
        while (typeof item === "function")
          item = item();
        dynamic = normalizeIncomingArray(normalized, Array.isArray(item) ? item : [item], Array.isArray(prev) ? prev : [prev]) || dynamic;
      } else {
        normalized.push(item);
        dynamic = true;
      }
    } else {
      const value = String(item);
      if (prev && prev.nodeType === 3 && prev.data === value)
        normalized.push(prev);
      else
        normalized.push(document.createTextNode(value));
    }
  }
  return dynamic;
};
var appendNodes = function(parent, array, marker = null) {
  for (let i = 0, len = array.length;i < len; i++)
    parent.insertBefore(array[i], marker);
};
var cleanChildren = function(parent, current, marker, replacement) {
  if (marker === undefined)
    return parent.textContent = "";
  const node = replacement || document.createTextNode("");
  if (current.length) {
    let inserted = false;
    for (let i = current.length - 1;i >= 0; i--) {
      const el = current[i];
      if (node !== el) {
        const isParent = el.parentNode === parent;
        if (!inserted && !i)
          isParent ? parent.replaceChild(node, el) : parent.insertBefore(node, marker);
        else
          isParent && el.remove();
      } else
        inserted = true;
    }
  } else
    parent.insertBefore(node, marker);
  return [node];
};
var booleans = [
  "allowfullscreen",
  "async",
  "autofocus",
  "autoplay",
  "checked",
  "controls",
  "default",
  "disabled",
  "formnovalidate",
  "hidden",
  "indeterminate",
  "ismap",
  "loop",
  "multiple",
  "muted",
  "nomodule",
  "novalidate",
  "open",
  "playsinline",
  "readonly",
  "required",
  "reversed",
  "seamless",
  "selected"
];
var Properties = new Set([
  "className",
  "value",
  "readOnly",
  "formNoValidate",
  "isMap",
  "noModule",
  "playsInline",
  ...booleans
]);
var ChildProperties = new Set([
  "innerHTML",
  "textContent",
  "innerText",
  "children"
]);
var Aliases = Object.assign(Object.create(null), {
  className: "class",
  htmlFor: "for"
});
var PropAliases = Object.assign(Object.create(null), {
  class: "className",
  formnovalidate: {
    $: "formNoValidate",
    BUTTON: 1,
    INPUT: 1
  },
  ismap: {
    $: "isMap",
    IMG: 1
  },
  nomodule: {
    $: "noModule",
    SCRIPT: 1
  },
  playsinline: {
    $: "playsInline",
    VIDEO: 1
  },
  readonly: {
    $: "readOnly",
    INPUT: 1,
    TEXTAREA: 1
  }
});
var DelegatedEvents = new Set([
  "beforeinput",
  "click",
  "dblclick",
  "contextmenu",
  "focusin",
  "focusout",
  "input",
  "keydown",
  "keyup",
  "mousedown",
  "mousemove",
  "mouseout",
  "mouseover",
  "mouseup",
  "pointerdown",
  "pointermove",
  "pointerout",
  "pointerover",
  "pointerup",
  "touchend",
  "touchmove",
  "touchstart"
]);
var SVGElements = new Set([
  "altGlyph",
  "altGlyphDef",
  "altGlyphItem",
  "animate",
  "animateColor",
  "animateMotion",
  "animateTransform",
  "circle",
  "clipPath",
  "color-profile",
  "cursor",
  "defs",
  "desc",
  "ellipse",
  "feBlend",
  "feColorMatrix",
  "feComponentTransfer",
  "feComposite",
  "feConvolveMatrix",
  "feDiffuseLighting",
  "feDisplacementMap",
  "feDistantLight",
  "feFlood",
  "feFuncA",
  "feFuncB",
  "feFuncG",
  "feFuncR",
  "feGaussianBlur",
  "feImage",
  "feMerge",
  "feMergeNode",
  "feMorphology",
  "feOffset",
  "fePointLight",
  "feSpecularLighting",
  "feSpotLight",
  "feTile",
  "feTurbulence",
  "filter",
  "font",
  "font-face",
  "font-face-format",
  "font-face-name",
  "font-face-src",
  "font-face-uri",
  "foreignObject",
  "g",
  "glyph",
  "glyphRef",
  "hkern",
  "image",
  "line",
  "linearGradient",
  "marker",
  "mask",
  "metadata",
  "missing-glyph",
  "mpath",
  "path",
  "pattern",
  "polygon",
  "polyline",
  "radialGradient",
  "rect",
  "set",
  "stop",
  "svg",
  "switch",
  "symbol",
  "text",
  "textPath",
  "tref",
  "tspan",
  "use",
  "view",
  "vkern"
]);
var SVGNamespace = {
  xlink: "http://www.w3.org/1999/xlink",
  xml: "http://www.w3.org/XML/1998/namespace"
};
var $$EVENTS = "_$DX_DELEGATE";

// solid/h/h.js
var createHyperScript = function(r) {
  function h() {
    let args = [].slice.call(arguments), e, multiExpression = false;
    while (Array.isArray(args[0]))
      args = args[0];
    if (args[0][$ELEMENT])
      args.unshift(h.Fragment);
    typeof args[0] === "string" && detectMultiExpression(args);
    const ret = () => {
      while (args.length)
        item(args.shift());
      return e;
    };
    ret[$ELEMENT] = true;
    return ret;
    function item(l) {
      const type = typeof l;
      if (l == null)
        ;
      else if (type === "string") {
        if (!e)
          parseClass(l);
        else
          e.appendChild(document.createTextNode(l));
      } else if (type === "number" || type === "boolean" || l instanceof Date || l instanceof RegExp) {
        e.appendChild(document.createTextNode(l.toString()));
      } else if (Array.isArray(l)) {
        for (let i = 0;i < l.length; i++)
          item(l[i]);
      } else if (l instanceof Element) {
        r.insert(e, l, multiExpression ? null : undefined);
      } else if (type === "object") {
        let dynamic = false;
        const d = Object.getOwnPropertyDescriptors(l);
        for (const k in d) {
          if (k !== "ref" && k.slice(0, 2) !== "on" && typeof d[k].value === "function") {
            r.dynamicProperty(l, k);
            dynamic = true;
          } else if (d[k].get)
            dynamic = true;
        }
        dynamic ? r.spread(e, l, e instanceof SVGElement, !!args.length) : r.assign(e, l, e instanceof SVGElement, !!args.length);
      } else if (type === "function") {
        if (!e) {
          let props, next = args[0];
          if (next == null || typeof next === "object" && !Array.isArray(next) && !(next instanceof Element))
            props = args.shift();
          props || (props = {});
          if (args.length) {
            props.children = args.length > 1 ? args : args[0];
          }
          const d = Object.getOwnPropertyDescriptors(props);
          for (const k in d) {
            if (Array.isArray(d[k].value)) {
              const list = d[k].value;
              props[k] = () => {
                for (let i = 0;i < list.length; i++) {
                  while (list[i][$ELEMENT])
                    list[i] = list[i]();
                }
                return list;
              };
              r.dynamicProperty(props, k);
            } else if (typeof d[k].value === "function" && !d[k].value.length)
              r.dynamicProperty(props, k);
          }
          e = r.createComponent(l, props);
          args = [];
        } else {
          while (l[$ELEMENT])
            l = l();
          r.insert(e, l, multiExpression ? null : undefined);
        }
      }
    }
    function parseClass(string) {
      const m = string.split(/([\.#]?[^\s#.]+)/);
      if (/^\.|#/.test(m[1]))
        e = document.createElement("div");
      for (let i = 0;i < m.length; i++) {
        const v = m[i], s = v.substring(1, v.length);
        if (!v)
          continue;
        if (!e)
          e = r.SVGElements.has(v) ? document.createElementNS("http://www.w3.org/2000/svg", v) : document.createElement(v);
        else if (v[0] === ".")
          e.classList.add(s);
        else if (v[0] === "#")
          e.setAttribute("id", s);
      }
    }
    function detectMultiExpression(list) {
      for (let i = 1;i < list.length; i++) {
        if (typeof list[i] === "function") {
          multiExpression = true;
          return;
        } else if (Array.isArray(list[i])) {
          detectMultiExpression(list[i]);
        }
      }
    }
  }
  h.Fragment = (props) => props.children;
  return h;
};
var $ELEMENT = Symbol("hyper-element");
var h = createHyperScript({
  spread,
  assign,
  insert,
  createComponent,
  dynamicProperty,
  SVGElements
});

// data.ts
var sequence_1 = {
  "1": {
    lines: {
      "1": {
        text: "I cannot help but look in the mirror and wonder If the blood of a God might save me",
        start_time: 0,
        end_time: 5000
      }
    },
    audio: "audio/chapter1(act1).mp3",
    images: [
      {
        name: "1-eye",
        frames: 24
      },
      {
        name: "2-look",
        frames: 50
      }
    ]
  },
  "2": {
    lines: {
      "1": {
        text: "Make my body as its meant to be",
        start_time: 0,
        end_time: 2800
      },
      "2": {
        text: "Flesh twisting and weaving under skin",
        start_time: 2870,
        end_time: 6000
      },
      "3": {
        text: "Animation of the body The truest image of what that God made",
        start_time: 6000,
        end_time: 11000
      }
    },
    audio: "audio/chapter2(act1).mp3",
    images: [
      {
        name: "3-moth",
        frames: 24
      },
      {
        name: "4-flesh twisting",
        frames: 50
      },
      {
        name: "5-neck",
        frames: 61
      },
      {
        name: "6-animation of the body",
        frames: 60
      }
    ]
  },
  "3": {
    lines: {
      "1": {
        text: "A deity sacrificed to make its creation sing",
        start_time: 0,
        end_time: 3600
      }
    },
    audio: "audio/chapter3(act1).mp3",
    images: [
      {
        name: "7-deity",
        frames: 40
      }
    ]
  },
  "4": {
    lines: {
      "1": {
        text: "Not left unfinished Like a lackluster thesis I am a project worth finishing Even if reality is a medium that cannot hold me",
        start_time: 0,
        end_time: 8550
      }
    },
    audio: "audio/chapter4(act2).mp3",
    images: [
      {
        name: "act2",
        frames: 120
      }
    ]
  },
  "5": {
    lines: {
      "1": {
        text: "How cruel To pin a moving image down to canvas",
        start_time: 0,
        end_time: 3500
      },
      "2": {
        text: "Tell it to be happy with only half itself",
        start_time: 4300,
        end_time: 7000
      }
    },
    audio: "audio/chapter5(act3).mp3",
    images: [
      {
        name: "shape",
        frames: 60
      }
    ]
  },
  "6": {
    lines: {
      "1": { text: "Sometimes", start_time: 0, end_time: 1500 },
      "2": {
        text: "In the moment just before I close my eyes I can see them",
        start_time: 1800,
        end_time: 5600
      },
      "3": { text: "The rest of me", start_time: 6000, end_time: 7000 },
      "4": {
        text: "The before and after image",
        start_time: 7700,
        end_time: 1e4
      },
      "5": {
        text: "The parts of me forgotten in the still shot The pieces that make me a",
        start_time: 1e4,
        end_time: 14000
      },
      "6": { text: "complete idea", start_time: 14000, end_time: 17000 }
    },
    audio: "audio/chapter6(act3).mp3",
    images: [
      {
        name: "shape",
        frames: 60
      }
    ]
  }
};

// helpers.ts
function setDPI(canvas, dpi) {
  canvas.style.width = canvas.style.width || canvas.width + "px";
  canvas.style.height = canvas.style.height || canvas.height + "px";
  var scaleFactor = dpi / 96;
  canvas.width = Math.ceil(canvas.width * scaleFactor);
  canvas.height = Math.ceil(canvas.height * scaleFactor);
  var ctx = canvas.getContext("2d");
  ctx.scale(scaleFactor, scaleFactor);
}
function romanize(num) {
  var lookup = {
    M: 1000,
    CM: 900,
    D: 500,
    CD: 400,
    C: 100,
    XC: 90,
    L: 50,
    XL: 40,
    X: 10,
    IX: 9,
    V: 5,
    IV: 4,
    I: 1
  }, roman = "", i;
  for (i in lookup) {
    while (num >= lookup[i]) {
      roman += i;
      num -= lookup[i];
    }
  }
  return roman;
}
var make_alphabet_dataset = () => {
  let alphabet = "abcdefghijklmnopqrstuvwxyz".split("");
  let images = alphabet.map((letter) => {
    let up = {
      key: letter.toUpperCase(),
      src: `./alphabets/${letter}C.png`
    };
    let low = {
      key: letter.toLowerCase(),
      src: `./alphabets/${letter}.png`
    };
    if (letter === "a")
      low = {
        key: letter.toLowerCase(),
        src: `./alphabets/${letter}.jpg`
      };
    return [up, low];
  });
  return images.flat();
};
var make_frame_dataset = (folder, num) => {
  let images = [];
  for (let i = 1;i <= num; i++) {
    images.push({
      key: folder + i,
      src: `./frames/${folder}/_${i}.png`
    });
  }
  return images;
};
var load_images_as_array = (dataset) => {
  let images = [];
  dataset.forEach((image) => {
    const img = new Image;
    img.src = image.src;
    images.push(img);
  });
  return images;
};
var load_images = (images) => {
  let alphabets = {};
  images.forEach((image) => {
    const img = new Image;
    img.src = image.src;
    alphabets[image.key] = img;
  });
  return alphabets;
};
var load_all_images = (db) => {
  db.type = load_images(make_alphabet_dataset());
  for (const value of Object.values(sequence_1)) {
    value.images.forEach((image) => {
      db[image.name] = load_images_as_array(make_frame_dataset(image.name, image.frames));
    });
  }
};
var current_chapter = () => {
  return sequence_1[tl.chapter];
};
var current_image_set = () => {
  if (current_chapter().images.length === 0)
    return;
  return current_chapter().images[tl.image_set];
};
var next_image_set = () => {
  if (current_chapter().images.length === 0)
    return;
  if (tl.image_set + 1 >= current_chapter().images.length)
    return;
  return current_chapter().images[tl.image_set + 1];
};
var current_total_duration = () => {
  let current_lines = Object.values(current_chapter().lines);
  let total_duration = 0;
  current_lines.forEach((line) => {
    if (line.end_time > total_duration)
      total_duration = line.end_time;
  });
  return total_duration;
};

// index.ts
var setup = function() {
  canvas = document.getElementById("canvas");
  ctx = canvas.getContext("2d");
  let canvas_stats = document.getElementById("canvas_stats");
  stat = canvas_stats?.getContext("2d");
  canvas_stats?.addEventListener("mousemove", (e) => {
    set_mouse({ x: e.clientX, y: e.clientY });
  });
  setDPI(canvas, 300);
  setDPI(canvas_stats, 300);
  load_all_images(img_db);
  set_chapter("3");
  setTimeout(() => {
    requestAnimationFrame(canvas_loop);
  }, 100);
};
var is_time = function() {
  return tl.elapsed > this.next_draw;
};
var reset_type = function() {
  type = {
    x_bound: 0,
    y_bound: 500,
    w_bound: 900,
    h_bound: 1200,
    line: 1,
    last_line_end: 0,
    width: 150,
    height: function() {
      return this.width * img_ratio;
    }
  };
};
var tick = function() {
  this.next_draw += this.interval;
};
var img_ratio = 0.78;
var [mouse, set_mouse] = createSignal({ x: 0, y: 0 });
var type = {
  x_bound: 0,
  y_bound: 0,
  w_bound: 900,
  h_bound: 1200,
  line: 1,
  last_line_end: 0,
  width: 500,
  height: function() {
    return this.width * img_ratio;
  }
};
var other_img_ratio = 0.501;
var image = {
  w: 200,
  h: function() {
    return this.w * other_img_ratio;
  },
  x: 300,
  y: 300,
  w_bound: 200,
  h_bound: 400,
  spatial_randomness: 400,
  temporal_randomness: 0.9,
  size_random_max: 400,
  size_random_min: 200
};
createEffect(() => {
  type.y_bound = mouse().y - type.line * 50;
  type.x_bound = mouse().x > 100 ? 100 : mouse().x;
});
var start;
var canvas;
var ctx;
var stat;
var text = "";
var img_db = {};
var tl = {
  chapter: 1,
  act: 1,
  sequence: 1,
  image_set: 0,
  image_index: 0,
  disturbance: 250,
  text_index: 0,
  typing: false,
  resetting: false,
  elapsed: 0
};
var sequencer = {
  rotation_one: 1,
  rotation_four: 1,
  next_chapter: function() {
    if (parseInt(tl.chapter) === 3)
      this.three();
    else if (parseInt(tl.chapter) === 4)
      this.four();
    else
      this.just_go_next();
  },
  just_go_next: function() {
    set_next_chapter(parseInt(tl.chapter) + 1);
  },
  three: function() {
    if (this.rotation_one < 3) {
      set_next_chapter(1);
      this.rotation_one++;
    } else {
      this.just_go_next();
    }
  },
  four: function() {
    if (this.rotation_four < 3) {
      set_next_chapter(4);
      this.rotation_four++;
    } else {
      this.just_go_next();
    }
  }
};
var timer = {
  type: {
    interval: 50,
    next_draw: 50
  },
  image: {
    interval: 100.1,
    next_draw: 200
  },
  reset: function() {
    this.type.next_draw = 0;
    this.image.next_draw = 0;
  }
};
var disturbance = {
  "1": 280,
  "2": 200,
  "3": 140,
  "4": 80,
  "5": 10,
  "6": 0
};
var [next_chapter, set_next_chapter] = createSignal(1);
var Root = () => {
  return h("div", {
    style: {
      display: "flex",
      "justify-content": "center",
      "align-items": "center",
      height: "100vh"
    }
  }, Frame, ChapterSetter);
};
var Frame = () => {
  onMount(() => {
    setup();
  });
  let style2 = {
    position: "absolute",
    top: "0px",
    left: "0px"
  };
  return [
    h("canvas", {
      id: "canvas",
      style: style2,
      width: window.innerWidth,
      height: window.innerHeight
    }),
    h("canvas", {
      id: "canvas_stats",
      style: style2,
      width: window.innerWidth,
      height: window.innerHeight
    })
  ];
};
var ChapterSetter = () => {
  const chapters = createMemo(() => {
    let chapters2 = [];
    for (let i = 1;i <= next_chapter(); i++) {
      chapters2.push(i);
    }
    return chapters2;
  });
  return h("div", {
    style: {
      position: "absolute",
      bottom: "10px",
      left: "0px",
      width: "100%",
      height: "50px",
      display: "flex",
      "justify-content": "center"
    }
  }, () => For({
    each: chapters(),
    children: (chapter) => h("button", {
      style: {
        "margin-right": "30px"
      },
      onclick: () => {
        set_chapter(chapter);
      }
    }, romanize(parseInt(chapter)))
  }));
};
var increment_image_index = () => {
  if (tl.image_index >= current_image_set().frames - 1) {
    if (next_image_set()) {
      tl.image_set++;
    } else {
      tl.image_set = 0;
    }
    tl.image_index = 0;
  } else
    tl.image_index++;
};
var scheduler = {
  draw_type: function() {
    if (tl.typing) {
      ctx.globalCompositeOperation = "multiply";
      if (text[tl.text_index] !== " ")
        draw_alphabet(text[tl.text_index], tl.text_index + 3);
      tick.call(timer.type);
      increment_index();
    }
  },
  draw_image: function() {
    if (!current_image_set())
      return;
    increment_image_index();
    draw_image_frame(tl.image_index);
    tick.call(timer.image);
  },
  draw_stats: function() {
    draw_stats();
  },
  play: function() {
    scheduler.draw_stats();
    is_time.call(timer.type) && scheduler.draw_type();
    is_time.call(timer.image) && scheduler.draw_image();
    Math.random() < 0.03 && not_clear();
  }
};
var clock = {
  tick: function(timestamp) {
    if (!start)
      start = timestamp;
    if (tl.resetting)
      this.reset(timestamp);
    tl.elapsed = timestamp - start;
  },
  reset: function(timestamp) {
    start = timestamp;
    timer.reset();
    tl.resetting = false;
  }
};
var canvas_loop = (timestamp) => {
  clock.tick(timestamp);
  scheduler.play();
  requestAnimationFrame(canvas_loop);
};
var not_clear = () => {
  let x_disturbance = Math.random() * image.spatial_randomness * pos_or_neg();
  let y_distrubance = Math.random() * image.spatial_randomness * pos_or_neg();
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "rgba(255,255,255,1)";
  ctx.fillRect(0, 0, 1200, 800);
};
var draw_stats = () => {
  stat.clearRect(0, 0, window.innerWidth, window.innerHeight);
  stat.fillStyle = "black";
  stat.font = "9px monospace";
  let s = 3.125;
  let w = parseInt(canvas.width) / s;
  let h3 = parseInt(canvas.height) / s;
  stat.fillText("current time: ".toUpperCase() + Math.floor(tl.elapsed / 1000) + "s", 10, 50);
  stat.fillText("image size: ".toUpperCase() + image.w + "px", 10, 60);
  stat.fillText("image spatial randomness: ".toUpperCase() + image.spatial_randomness + "px", 10, 70);
  stat.fillText("image temporal randomness: ".toUpperCase() + image.temporal_randomness + "%", 10, 80);
  stat.fillText("image max: ".toUpperCase() + image.w_bound + "px", 10, 90);
  stat.fillText("disturbance: ".toUpperCase() + "+-" + Math.floor(tl.disturbance), 10, h3 - 50);
  stat.fillText("chapter: ".toUpperCase() + tl.chapter, w - 100, 50);
  stat.fillText("line: ".toUpperCase() + tl.line, w - 100, h3 - 50);
};
var draw_alphabet = (letter, index) => {
  if (img_db.type) {
    let x = type.x_bound + (index - type.last_line_end) * type.width / 2;
    if (x > type.w_bound) {
      type.line++;
      type.last_line_end = index - 1;
      x = type.x_bound;
    }
    let y = type.y_bound;
    let hr = Math.random() * tl.disturbance * pos_or_neg();
    let wr = Math.random() * tl.disturbance * pos_or_neg();
    y += hr;
    x += wr;
    if (y > type.h_bound) {
      y = type.y_bound - Math.random() * image.spatial_randomness;
    }
    if (x > type.w_bound) {
      x = type.x_bound - Math.random() * image.spatial_randomness;
    }
    ctx.drawImage(img_db.type[letter], x, y, type.width, type.height());
  }
};
var pos_or_neg = () => Math.random() > 0.5 ? 1 : -1;
var draw_image_frame = (index) => {
  if (Math.random() < image.temporal_randomness)
    return;
  if (current_image_set()) {
    let x_disturbance = Math.random() * image.spatial_randomness * pos_or_neg();
    let y_distrubance = Math.random() * image.spatial_randomness * pos_or_neg();
    let x = image.x + x_disturbance;
    let y = image.y + y_distrubance;
    ctx.globalCompositeOperation = "source-over";
    image.w = Math.floor(Math.random() * (image.size_random_max - image.size_random_min) + image.size_random_min);
    let w = image.w;
    let h3 = image.h();
    ctx.drawImage(img_db[current_image_set().name][index], x, y, w, h3);
  }
};
var set_chapter = (number) => {
  tl.chapter = number;
  tl.line = 1;
  tl.resetting = true;
  tl.image_set = 0;
  tl.image_index = 0;
  let cur_audio = new Audio(sequence_1[tl.chapter].audio);
  tl.disturbance = disturbance[tl.chapter];
  tl.text_index = 0;
  reset_type();
  start_lines();
  cur_audio.play();
};
var start_lines = () => {
  tl.typing = true;
  tl.text_index = 0;
  text = sequence_1[tl.chapter].lines[tl.line].text;
  timer.type.interval = (sequence_1[tl.chapter].lines[tl.line].end_time - sequence_1[tl.chapter].lines[tl.line].start_time) / text.length;
  reset_type();
  if (tl.line === 1) {
    for (const [key, value] of Object.entries(sequence_1[tl.chapter].lines)) {
      if (key !== "1") {
        setTimeout(() => {
          tl.line++;
          start_lines();
        }, value.start_time);
      }
    }
  }
};
var increment_index = () => {
  if (tl.text_index < text.length - 1)
    tl.text_index++;
  else {
    if (tl.typing && current_total_duration() < tl.elapsed + 1000) {
      setTimeout(() => sequencer.next_chapter(), 500);
    }
    tl.typing = false;
  }
};
reset_type();
render(Root, document.querySelector(".root"));
export {
  tl,
  img_db
};
