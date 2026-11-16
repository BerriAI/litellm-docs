# Global Control Plane illustration

Run `node blog/global_control_plane/illustration/render.mjs` from the repository root after installing the site's dependencies. This writes the editable desktop and mobile SVGs and transparent light/dark PNG exports. The source uses the site's existing `sharp` dependency. The live hero uses a narrower composition on small screens so its labels remain readable.

The diagram shows management connections only. Applications send inference directly to their regional gateway. The regional boundaries represent independent deployments, each with its own configuration and dependencies.

The LiteLLM logo is reused unchanged from `blog/litellm_private_registry_access/illustration/assets/litellm.svg`. The globe, connectors, and region boundaries are original SVG geometry. No external fonts or runtime animation dependencies are required.
