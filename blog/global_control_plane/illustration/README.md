# Global Control Plane API illustration

Run `node blog/global_control_plane/illustration/render.mjs` from the repository root after installing the site's dependencies. This writes the self-contained 1440 × 800 SVG and a transparent PNG using the site's existing `sharp` dependency. Set `COVER_REVIEW_DIR` to export light, dark, and mobile review images into a separate directory.

The flat, text-free cover simplifies the cloud and hybrid-cloud reference architectures. One central LiteLLM control plane connects to four independent environments, with the same provider-native service icons used in the reference diagrams: EKS with Aurora and ElastiCache; AKS with Azure Database for PostgreSQL and Azure Redis; GKE with Cloud SQL and Memorystore; and on-premises Kubernetes with PostgreSQL and Redis. Purple connections represent management requests; gray database and cache connections stay within each environment.

The LiteLLM logo is reused unchanged from `blog/litellm_private_registry_access/illustration/assets/litellm.svg`. Provider icons come from `static/img/cloud_icons`; their provenance is recorded in that directory's `SOURCES.md`. The exported SVG inlines the official icon artwork and preserves its colors and geometry. The live hero changes only the LiteLLM mark to white in dark mode. No external image requests, fonts, or animation dependencies are required.
