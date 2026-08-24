import { redirect } from "@sveltejs/kit";
const GET = ({ url }) => {
  const range = url.searchParams.get("range");
  throw redirect(308, range ? `/insights?range=${encodeURIComponent(range)}` : "/insights");
};
export {
  GET
};
