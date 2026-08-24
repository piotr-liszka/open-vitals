import { w as writable } from './exports.js-aFGE3YQF.js';
import './utils2.js-BQzn9ikS.js';
import './utils.js-D6eaf5bT.js';
import './root.js-DLPDgkXe.js';
import { n as noop } from './index.js-D7taQuDv.js';

function create_updated_store() {
  const { set, subscribe } = writable(false);
  {
    return {
      subscribe,
      // eslint-disable-next-line @typescript-eslint/require-await
      check: async () => false
    };
  }
}
const is_legacy = noop.toString().includes("$$") || /function \w+\(\) \{\}/.test(noop.toString());
const placeholder_url = "a:";
if (is_legacy) {
  ({
    url: new URL(placeholder_url)
  });
}
const stores = {
  updated: /* @__PURE__ */ create_updated_store()
};
function goto(url, opts = {}) {
  {
    throw new Error("Cannot call goto(...) on the server");
  }
}
function invalidateAll() {
  {
    throw new Error("Cannot call invalidateAll() on the server");
  }
}

export { goto as g, invalidateAll as i, stores as s };
//# sourceMappingURL=client.js-C1MYAKQX.js.map
