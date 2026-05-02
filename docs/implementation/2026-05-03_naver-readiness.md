# Naver Search Ad Readiness Layer

Date: 2026-05-03

## Scope

Added the server-side foundation for read-only Naver Search Ad API integration.

Implemented:

- environment readiness check
- HMAC-SHA256 signature helper
- Naver Search Ad request header builder
- read-only campaign list helper
- `/api/naver/readiness` endpoint
- UI readiness indicator

## Source References

Primary references:

- Naver Search AD API repository: `https://github.com/naver/searchad-apidoc`
- Naver Search AD Python sample: `https://github.com/naver/searchad-apidoc/tree/master/python-sample`
- Official sample signature helper: `https://raw.githubusercontent.com/naver/searchad-apidoc/master/python-sample/examples/signaturehelper.py`
- Official sample ad management flow: `https://raw.githubusercontent.com/naver/searchad-apidoc/master/python-sample/examples/ad_management_sample.py`

The official sample signs a message in this shape:

```text
{timestamp}.{METHOD}.{uri}
```

The request headers are:

```text
Content-Type: application/json; charset=UTF-8
X-Timestamp: {timestamp}
X-API-KEY: {api key}
X-Customer: {customer id}
X-Signature: {base64 hmac-sha256 signature}
```

## Safety

- The default readiness endpoint does not call Naver externally.
- External read-only check only runs when `GET /api/naver/readiness?check=campaigns` is requested.
- No POST/PUT/DELETE execution route was added.
- API keys and secret values are never returned from the endpoint.
- Error messages are sanitized before returning to the browser.

## Next Step

Add account sync tables and a scheduled read-only sync job after auth/tenant boundaries are defined.
