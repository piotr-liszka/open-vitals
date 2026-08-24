import { redirect } from "@sveltejs/kit";
const GET = () => {
  throw redirect(308, "/training/bieg");
};
export {
  GET
};
