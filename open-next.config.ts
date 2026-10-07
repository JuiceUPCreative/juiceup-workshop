import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// No ISR or image optimisation is used, so the default (no incremental cache) is enough.
export default defineCloudflareConfig();
