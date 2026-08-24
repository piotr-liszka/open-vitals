import { M as redirect } from '../../../chunks/utils.js-D6eaf5bT.js';
import '../../../chunks/utils2.js-BQzn9ikS.js';
import '../../../chunks/uneval.js-BnYgIxRU.js';

const GET = ({ url }) => {
  const range = url.searchParams.get("range");
  throw redirect(308, range ? `/insights?range=${encodeURIComponent(range)}` : "/insights");
};

export { GET };
//# sourceMappingURL=_server.ts.js-iV7Xm0Na.js.map
