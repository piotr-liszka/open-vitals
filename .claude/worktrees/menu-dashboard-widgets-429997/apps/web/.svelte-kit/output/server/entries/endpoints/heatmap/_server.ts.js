import { redirect } from "@sveltejs/kit";
const GET = ({ url }) => {
  const query = url.searchParams.toString();
  throw redirect(308, query ? `/activities/mapa?${query}` : "/activities/mapa");
};
export {
  GET
};
