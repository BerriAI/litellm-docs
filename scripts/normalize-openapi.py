#!/usr/bin/env python3
"""Replace retired demo keys in generated OpenAPI examples before publishing."""

import argparse
import json
import re
from pathlib import Path


RETIRED_KEY = "sk-12" "34"
AUTH_HEADER = re.compile(
    r"(?P<quote>['\"])(?P<header>Authorization: Bearer\s*|x-api-key:\s*)"
    + re.escape(RETIRED_KEY)
    + r"(?P=quote)"
)


def normalize(value):
    if isinstance(value, dict):
        return {key: normalize(item) for key, item in value.items()}
    if isinstance(value, list):
        return [normalize(item) for item in value]
    if isinstance(value, str):
        # Double quotes let the shell expand the environment variable in curl.
        value = AUTH_HEADER.sub(
            lambda match: '"' + match["header"].rstrip() + ' $LITELLM_MASTER_KEY"',
            value,
        )
        # Key-management examples also reference a key in a URL or JSON body.
        return value.replace(RETIRED_KEY, "sk-your-key")
    return value


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path)
    args = parser.parse_args()
    document = json.loads(args.source.read_text(encoding="utf-8"))
    args.destination.write_text(
        json.dumps(normalize(document), ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )
