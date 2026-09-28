import { useEffect, useRef, useState } from 'react';
import { Animated } from 'react-native';
import type { Direction } from './motion';
import { depth, route, walkDirection, walkDuration, walkPace, type Spot } from './sceneLayout';

/**
 * One figure walking between named spots of the room. It owns the native position, the walk target and arrival.
 * A new target mid-walk starts from where the figure is. Without motion the figure is placed at once.
 * A walk that would cross the seal pedestals goes around them in two legs, turning at the waypoint.
 */
export function useWalker<Name extends string>(spots: Record<Name, Spot>, start: Spot, allowed: boolean) {
  const [target, setTarget] = useState<Name | null>(null);
  const [arrived, setArrived] = useState<Name | null>(null);
  const [direction, setDirection] = useState<Direction>('back');
  // Each walk gets a new run id, so the sprite restarts its step timer and depth change.
  const [run, setRun] = useState(0);
  const lastDestination = useRef(start);
  const walkFrom = useRef(start);
  // When the current walk started, so a new target mid-walk can start from where the figure is.
  const walkStarted = useRef<number | null>(null);
  const position = useRef(new Animated.ValueXY(start)).current;
  const generation = useRef(0);
  const settled = useRef<Name | null>(null);
  // The legs still to walk, the first one under way.
  const legs = useRef<Spot[]>([]);

  useEffect(() => {
    const request = ++generation.current;
    if (!target || settled.current === target) return;
    const destination = spots[target];
    const origin = walkFrom.current;
    if (!allowed) {
      position.setValue(destination);
      settled.current = target;
      setArrived(target);
      return () => { generation.current++; };
    }
    settled.current = null;
    setArrived(null);
    let movement: Animated.CompositeAnimation | null = null;
    const walk = (index: number) => {
      const from = index === 0 ? origin : legs.current[index - 1];
      const to = legs.current[index] ?? destination;
      if (index > 0) {
        // The next leg faces its own way and restarts the step cycle.
        walkFrom.current = from;
        lastDestination.current = to;
        setDirection(walkDirection(from, to));
        setRun(value => value + 1);
      }
      walkStarted.current = Date.now();
      movement = Animated.timing(position, { toValue: to, duration: walkDuration(from, to), easing: walkPace, useNativeDriver: true });
      movement.start(({ finished }) => {
        if (!finished || generation.current !== request) return;
        if (index + 1 < legs.current.length) { walk(index + 1); return; }
        walkStarted.current = null;
        settled.current = target;
        setArrived(target);
      });
    };
    walk(0);
    return () => {
      generation.current++;
      movement?.stop();
    };
  }, [allowed, position, target]);

  // The native walk cannot be read back synchronously, so the place is computed with the walk's own curve.
  function currentFoot() {
    const to = lastDestination.current;
    if (walkStarted.current === null || !allowed) return to;
    const from = walkFrom.current;
    const done = walkPace(Math.min(1, (Date.now() - walkStarted.current) / walkDuration(from, to)));
    return { x: from.x + (to.x - from.x) * done, y: from.y + (to.y - from.y) * done };
  }
  // Direction and run change in the same update as the target, so the first walking frame already faces the right way.
  function walkTo(spot: Name) {
    if (spot !== target) {
      // Invalidate before React flushes effect cleanup, including a native completion in that gap.
      generation.current++;
      walkFrom.current = currentFoot();
      legs.current = route(walkFrom.current, spots[spot]);
      lastDestination.current = legs.current[0];
      setDirection(walkDirection(walkFrom.current, legs.current[0]));
      setRun(value => value + 1);
    }
    setTarget(spot);
  }

  const walking = !!target && !arrived;
  // Depth size: a fixed number at rest, or from and to over a walk.
  const scale = walking && allowed
    ? { from: depth(walkFrom.current.y), to: depth(lastDestination.current.y), duration: walkDuration(walkFrom.current, lastDestination.current) }
    : depth(lastDestination.current.y);
  return { target, arrived, walking, direction, run, position, scale, now: currentFoot, walkTo };
}
