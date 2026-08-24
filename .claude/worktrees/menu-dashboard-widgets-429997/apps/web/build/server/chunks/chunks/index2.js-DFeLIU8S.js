import './client2.js-DKEBrJ7O.js';
import { aa as getContext } from './index.js-D7taQuDv.js';

function context() {
  return getContext("__request__");
}
const page$1 = {
  get error() {
    return context().page.error;
  },
  get status() {
    return context().page.status;
  },
  get url() {
    return context().page.url;
  }
};
const page = page$1;

export { page as p };
//# sourceMappingURL=index2.js-DFeLIU8S.js.map
