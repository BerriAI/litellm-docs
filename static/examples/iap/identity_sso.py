"""Browser sign-in through Cloudflare Access, Google IAP, ALB, or Entra App Proxy.

Mount beside config.yaml and set:
  general_settings:
    custom_ui_sso_sign_in_handler: identity_sso.handler
    trusted_proxy_ranges: ["10.0.0.10/32"]  # Direct proxy peers only.

Set IAP_PROVIDER to cloudflare, gcp, aws, or azure. Required environment:
  cloudflare: CF_ACCESS_TEAM_DOMAIN, CF_ACCESS_AUDIENCE
  gcp: GCP_IAP_AUDIENCE
  aws: AWS_ALB_REGION, AWS_ALB_ARN, AWS_ALB_OIDC_CLIENT_ID, AWS_ALB_OIDC_ISSUER
  azure: AZURE_USER_ID_HEADER, AZURE_EMAIL_HEADER

Keep the origin private. Entra must overwrite its configured identity headers.
This hook creates a browser session. It does not authenticate inference API calls
or assign roles. LiteLLM keeps stored roles and gives new users its default role.
Requires LiteLLM Enterprise, PyJWT[crypto], and the normal proxy dependencies.

Token formats:
https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/
https://docs.cloud.google.com/iap/docs/signed-headers-howto
https://docs.aws.amazon.com/elasticloadbalancing/latest/application/listener-authenticate-users.html
"""

import asyncio
import os
import re
import threading
import time
import urllib.request
from collections import OrderedDict
from functools import lru_cache

import jwt
from fastapi import HTTPException, Request
from fastapi_sso.sso.base import OpenID
from litellm.integrations.custom_sso_handler import CustomSSOLoginHandler
from litellm.proxy.auth.trusted_proxy_utils import require_trusted_proxy_request


def _required_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise ValueError(f"Set {name} before loading identity_sso.py")
    return value


def _header(request: Request, name: str) -> str:
    values = request.headers.getlist(name)
    if len(values) != 1 or not values[0] or len(values[0]) > 65536:
        raise ValueError("Missing or ambiguous identity header")
    return values[0]


def _identity_value(value: object) -> str:
    if not isinstance(value, str) or not value or value != value.strip():
        raise ValueError("Missing identity")
    if len(value) > 512 or any(ord(char) < 32 for char in value):
        raise ValueError("Invalid identity")
    return value


@lru_cache(maxsize=4)
def _jwks_client(url: str) -> jwt.PyJWKClient:
    return jwt.PyJWKClient(url, cache_jwk_set=True, lifespan=300, timeout=5)


_ALB_KEYS: OrderedDict[tuple[str, str], tuple[float, bytes]] = OrderedDict()
_ALB_KEYS_LOCK = threading.Lock()


def _alb_public_key(region: str, kid: str) -> bytes:
    # Neither the host nor path can come from an arbitrary JWT URL.
    if not re.fullmatch(r"[a-z]{2}(?:-[a-z]+)+-\d", region):
        raise ValueError("Invalid ALB region")
    if not re.fullmatch(r"[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}", kid):
        raise ValueError("Invalid ALB key ID")
    if region in {"us-gov-west-1", "us-gov-east-1"}:
        url = f"https://s3-{region}.amazonaws.com/aws-elb-public-keys-prod-{region}/{kid}"
    else:
        url = f"https://public-keys.auth.elb.{region}.amazonaws.com/{kid}"

    cache_key = (region, kid)
    with _ALB_KEYS_LOCK:
        cached = _ALB_KEYS.get(cache_key)
        if cached and cached[0] > time.monotonic():
            _ALB_KEYS.move_to_end(cache_key)
            return cached[1]
        with urllib.request.urlopen(url, timeout=5) as response:
            key = response.read(8193)
        if len(key) > 8192 or not key.startswith(b"-----BEGIN PUBLIC KEY-----"):
            raise ValueError("Invalid ALB public key")
        _ALB_KEYS[cache_key] = (time.monotonic() + 300, key)
        _ALB_KEYS.move_to_end(cache_key)
        while len(_ALB_KEYS) > 64:
            _ALB_KEYS.popitem(last=False)
        return key


class IdentitySSOHandler(CustomSSOLoginHandler):
    def __init__(self) -> None:
        super().__init__()
        self.provider = _required_env("IAP_PROVIDER")
        if self.provider == "cloudflare":
            self.issuer = _required_env("CF_ACCESS_TEAM_DOMAIN").rstrip("/")
            if not re.fullmatch(r"https://[a-z0-9-]+\.cloudflareaccess\.com", self.issuer):
                raise ValueError("CF_ACCESS_TEAM_DOMAIN must be your HTTPS team domain")
            self.audience = _required_env("CF_ACCESS_AUDIENCE")
            self.jwks_url = f"{self.issuer}/cdn-cgi/access/certs"
            self.algorithm = "RS256"
            self.token_header = "cf-access-jwt-assertion"
        elif self.provider == "gcp":
            self.issuer = "https://cloud.google.com/iap"
            self.audience = _required_env("GCP_IAP_AUDIENCE")
            self.jwks_url = "https://www.gstatic.com/iap/verify/public_key-jwk"
            self.algorithm = "ES256"
            self.token_header = "x-goog-iap-jwt-assertion"
        elif self.provider == "aws":
            self.region = _required_env("AWS_ALB_REGION")
            self.signer = _required_env("AWS_ALB_ARN")
            self.client_id = _required_env("AWS_ALB_OIDC_CLIENT_ID")
            self.issuer = _required_env("AWS_ALB_OIDC_ISSUER")
            if not re.fullmatch(
                rf"arn:(?:aws|aws-us-gov):elasticloadbalancing:{re.escape(self.region)}:"
                r"\d{12}:loadbalancer/app/[A-Za-z0-9-]+/[0-9a-f]+",
                self.signer,
            ):
                raise ValueError("AWS_ALB_ARN must identify the expected ALB in AWS_ALB_REGION")
        elif self.provider == "azure":
            self.user_header = _required_env("AZURE_USER_ID_HEADER")
            self.email_header = _required_env("AZURE_EMAIL_HEADER")
        else:
            raise ValueError("IAP_PROVIDER must be cloudflare, gcp, aws, or azure")

    def _jwt_identity(self, token: str) -> dict:
        header = jwt.get_unverified_header(token)
        if header.get("alg") != self.algorithm or not isinstance(header.get("kid"), str):
            raise ValueError("Invalid JWT header")
        key = _jwks_client(self.jwks_url).get_signing_key_from_jwt(token).key
        return jwt.decode(
            token,
            key,
            algorithms=[self.algorithm],
            issuer=self.issuer,
            audience=self.audience,
            leeway=30,
            options={"require": ["iss", "aud", "sub", "email", "iat", "exp"]},
        )

    def _alb_identity(self, token: str) -> dict:
        header = jwt.get_unverified_header(token)
        if (
            header.get("alg") != "ES256"
            or header.get("signer") != self.signer
            or header.get("client") != self.client_id
            or header.get("iss") != self.issuer
        ):
            raise ValueError("Unexpected ALB signer, client, issuer, or algorithm")
        kid = header.get("kid")
        if not isinstance(kid, str):
            raise ValueError("Missing ALB key ID")
        claims = jwt.decode(
            token,
            _alb_public_key(self.region, kid),
            algorithms=["ES256"],
            options={"verify_aud": False, "require": ["sub", "email"]},
        )
        # ALB puts expiry in its signed header, not the user-info payload.
        expiry = header.get("exp")
        if isinstance(expiry, bool) or not re.fullmatch(r"\d+", str(expiry)):
            raise ValueError("Missing ALB expiry")
        if int(expiry) <= time.time():
            raise ValueError("Expired ALB identity")
        return claims

    async def handle_custom_ui_sso_sign_in(self, request: Request) -> OpenID:
        try:
            # Check the TCP peer. Never use X-Forwarded-For as proof of trust.
            require_trusted_proxy_request(request=request, feature_name="IAP UI sign-in")
            if self.provider == "azure":
                # App Proxy must authenticate the user and overwrite these fields.
                claims = {
                    "sub": _header(request, self.user_header),
                    "email": _header(request, self.email_header),
                }
            elif self.provider == "aws":
                claims = await asyncio.to_thread(self._alb_identity, _header(request, "x-amzn-oidc-data"))
            else:
                claims = await asyncio.to_thread(self._jwt_identity, _header(request, self.token_header))
            return OpenID(
                id=_identity_value(claims.get("sub")),
                email=_identity_value(claims.get("email")),
                provider=self.provider,
            )
        except Exception:
            # Do not expose tokens, claims, keys, or provider errors to the browser.
            raise HTTPException(status_code=401, detail="IAP identity validation failed") from None


handler = IdentitySSOHandler()
