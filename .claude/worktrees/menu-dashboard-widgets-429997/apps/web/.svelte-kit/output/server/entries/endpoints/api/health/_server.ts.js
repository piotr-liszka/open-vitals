import { json } from "@sveltejs/kit";
const GET = ({ locals }) => {
  return json({
    status: "ok",
    service: "vagus-web",
    time: locals.container.clock.now().toISOString()
  });
};
export {
  GET
};
