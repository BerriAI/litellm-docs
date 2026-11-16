# Global Control Plane illustration

Run `node blog/global_control_plane/illustration/render.mjs` from the repository root after installing the site's dependencies. This writes the editable 1440 × 760 SVG and a transparent PNG using the site's existing `sharp` dependency.

The text-free isometric illustration shows a central control plane with a globe and three independent regional gateways. Each regional island has its own storage. The dashed connections represent management traffic; applications send inference directly to their regional gateway.

The LiteLLM logo is reused unchanged from `blog/litellm_private_registry_access/illustration/assets/litellm.svg`. The isometric geometry and palette follow the existing cache-aware routing cover. The scene uses opaque blue and pale-blue fills on a transparent canvas so the same asset works in light and dark themes. No fonts or animation dependencies are required.
