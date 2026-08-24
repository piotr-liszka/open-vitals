import { redirect } from "@sveltejs/kit";
const GET = () => {
  throw redirect(308, "/training/rower");
};
export {
  GET
};
