const cache = new Map();

/** Loads an external script once (e.g. Razorpay Checkout) and resolves when it is ready. */
export function loadScript(src) {
  if (cache.has(src)) return cache.get(src);
  const promise = new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.src = src;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => { cache.delete(src); el.remove(); reject(new Error('Could not load the payment window. Check your internet connection and try again.')); };
    document.head.appendChild(el);
  });
  cache.set(src, promise);
  return promise;
}
