type ThrottleFunction = (...args: any[]) => void;

export default function throttle(func: ThrottleFunction, wait: number): ThrottleFunction {
  let timeout = -1;
  let lastArgs: any[] | null = null;

  return function (this: any, ...args: any[]) {
    if (timeout === -1) {
      func.apply(this, args);
      timeout = setTimeout(() => {
        timeout = -1;
        if (lastArgs) {
          func.apply(this, lastArgs);
          lastArgs = null;
        }
      }, wait);
    }
    else {
      lastArgs = args;
    }
  };
}
