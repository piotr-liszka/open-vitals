import { M as redirect } from '../../../chunks/utils.js-D6eaf5bT.js';
import { t as trainingTabs } from '../../../chunks/training-nav.js-D-TPJLDl.js';

const DATA_PROCESSING = "detailed_analytics";
const load = async ({ locals }) => {
  if (!await locals.consent.isEnabled(DATA_PROCESSING)) throw redirect(303, "/");
  const user = locals.user;
  const sports = await locals.container.store.listSports(user.id);
  return { tabs: trainingTabs(sports) };
};

var _layout_server_ts = /*#__PURE__*/Object.freeze({
  __proto__: null,
  load: load
});

export { _layout_server_ts as _ };
//# sourceMappingURL=_layout.server.ts.js-CUBhjraB.js.map
