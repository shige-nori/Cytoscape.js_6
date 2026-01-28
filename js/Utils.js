/**
 * Small utilities used across panels
 */
export function debounce(fn, wait = 150) {
    let timer = null;
    return function(...args) {
        const ctx = this;
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
            timer = null;
            fn.apply(ctx, args);
        }, wait);
    };
}

export function throttle(fn, wait = 200) {
    let last = 0;
    return function(...args) {
        const now = Date.now();
        if (now - last >= wait) {
            last = now;
            return fn.apply(this, args);
        }
    };
}
