import { M as redirect } from '../../../chunks/utils.js-D6eaf5bT.js';
import '../../../chunks/utils2.js-BQzn9ikS.js';
import '../../../chunks/uneval.js-BnYgIxRU.js';

const GET = ({ url }) => {
  const query = url.searchParams.toString();
  throw redirect(308, query ? `/activities/mapa?${query}` : "/activities/mapa");
};

export { GET };
//# sourceMappingURL=_server.ts.js-BAAGZUFM.js.map
