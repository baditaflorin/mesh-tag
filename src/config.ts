import { createMeshConfig } from "@baditaflorin/mesh-common";

export const config = createMeshConfig({
  appName: "mesh-tag",
  description: "You're it — playground tag, pass 'it' by scanning the next person's QR",
  accentHex: "#f97316",
  version: __APP_VERSION__,
  commit: __GIT_COMMIT__,
});
