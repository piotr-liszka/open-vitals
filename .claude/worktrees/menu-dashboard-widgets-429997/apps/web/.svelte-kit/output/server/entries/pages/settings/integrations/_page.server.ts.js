import { redirect } from "@sveltejs/kit";
const load = async () => {
  throw redirect(308, "/settings");
};
export {
  load
};
